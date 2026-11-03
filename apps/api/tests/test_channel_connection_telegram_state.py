import pytest
from importlib import import_module
from test_channel_connection_state import state_db,activated,event,KEY
from types import SimpleNamespace
from sqlalchemy.orm import sessionmaker
@pytest.fixture
def native_context(state_db,monkeypatch):
    from app.core.config import settings
    from app.models import AdminChannel
    s,db,row,lease=activated(state_db)
    row.provider=lease.provider='telegram';row.installation_id=row.account_id='100';row.target_id='-300'
    db.get(AdminChannel,row.channel_id).code='TELEGRAM'
    row.listener_scope_hash=lease.listener_scope_hash=s._listener_scope(row,'telegram-bot:100')
    db.commit();monkeypatch.setattr(settings,'channel_connection_encryption_key',KEY)
    return SimpleNamespace(sessions=sessionmaker(db.bind,expire_on_commit=False),owner='worker-1',leases=[(lease.id,lease.fence)],ids={'connections':[row.id],'org_id':row.organization_id})
def accept(c,incoming):
    from app.services.channel_connection_runtime import ConnectionRuntime
    return ConnectionRuntime(c.sessions,key=KEY,version='v1')._receive(c.ids['connections'][0],*c.leases[0][:1],c.owner,c.leases[0][1],incoming)

from app.services import channel_connection_state as state


def gate(c):
    lid,fence=c.leases[0]
    return import_module('app.services.channel_connection_telegram_polling').TelegramState(c.sessions,lease_id=lid,owner=c.owner,fence=fence,bot_id='100')


@pytest.mark.parametrize('native_context',['telegram'],indirect=True)
def test_offset_is_monotonic_protected_and_owned_by_current_lease(native_context):
    from fastapi import HTTPException
    from app.models import ChannelInstallationLease
    c=native_context;s=gate(c);assert s.load_cursor()['offset']==0;advance(s,17);assert s.load_cursor()['offset']==18;advance(s,16);assert s.load_cursor()['offset']==18
    with c.sessions() as db:assert 'ciphertext' in db.get(ChannelInstallationLease,c.leases[0][0]).cursor_json['telegram_polling']
    other=import_module('app.services.channel_connection_telegram_polling').TelegramState(c.sessions,lease_id=c.leases[0][0],owner='other',fence=c.leases[0][1],bot_id='100')
    with pytest.raises(HTTPException):advance(other,99)
    assert s.load_cursor()['offset']==18


def advance(s,identifier):
    with s.sessions() as db:started=state.clock(db).isoformat()
    return s.advance(identifier,request_started_at=started)


def pending(c):
    from app.models import ChannelConnectionDelivery
    did=accept(c,event());s=gate(c)
    with c.sessions() as db:
        item=db.get(ChannelConnectionDelivery,did);s.write_context(item,{**s.context(item),'callback_id':'synthetic-callback','telegram_ack':{'status':'pending','expires_at':state.clock(db).timestamp()+10}});db.commit()
    return s,did


@pytest.mark.parametrize('native_context',['telegram'],indirect=True)
@pytest.mark.parametrize('outcome',['confirmed','unknown','rejected'])
def test_callback_reserved_once_and_only_confirmed_receipt_can_execute(native_context,outcome):
    from app.models import ChannelConnectionDelivery
    c=native_context;s,did=pending(c);lid,fence=c.leases[0];cid=c.ids['connections'][0]
    reservation=s.reserve_ack(did);assert reservation and 'synthetic-callback' not in repr(reservation)
    assert s.reserve_ack(did) is None
    with c.sessions() as db:assert state.claim_delivery(db,cid,lid,c.owner,fence,deadline_seconds=30,eligibility=s.can_execute) is None
    assert s.finish_ack(did,reservation.claim_id,outcome)
    assert not s.finish_ack(did,reservation.claim_id,'confirmed') and s.reserve_ack(did) is None
    with c.sessions() as db:
        item=db.get(ChannelConnectionDelivery,did);assert 'callback_id' not in s.context(item)
        assert s.can_execute(item)==(outcome=='confirmed') and item.status==({'confirmed':'received','unknown':'unknown','rejected':'failed'}[outcome])


@pytest.mark.parametrize('native_context',['telegram'],indirect=True)
def test_callback_crash_is_never_reissued_and_generation_change_cancels(native_context):
    from app.models import ChannelConnection,ChannelConnectionDelivery
    c=native_context;s,did=pending(c);s.reserve_ack(did)
    with c.sessions() as db:
        item=db.get(ChannelConnectionDelivery,did);ctx=s.context(item);ctx['telegram_ack']['expires_at']=0;s.write_context(item,ctx);db.commit()
    with c.sessions() as db:item=db.get(ChannelConnectionDelivery,did);assert not s.can_execute(item);db.commit()
    with c.sessions() as db:assert db.get(ChannelConnectionDelivery,did).status=='unknown'
    assert s.reserve_ack(did) is None

@pytest.mark.parametrize('native_context',['telegram'],indirect=True)
def test_prepare_keeps_active_target_connected_and_restores_generation_cutoff(native_context):
    from types import SimpleNamespace
    from app.models import ChannelConnection,ChannelInstallationLease
    c=native_context;s=gate(c);cid=c.ids['connections'][0];lid,fence=c.leases[0];scope='telegram-bot:100'
    with c.sessions() as db:
        row=db.get(ChannelConnection,cid);row.listener_scope_hash=state._listener_scope(row,scope);db.get(ChannelInstallationLease,lid).listener_scope_hash=row.listener_scope_hash;generation=row.generation;db.commit()
    from app.services.channel_connection_runtime import ConnectionTarget
    with c.sessions() as db:spec=ConnectionTarget.from_row(db.get(ChannelConnection,cid))
    target=SimpleNamespace(target=spec)
    boundary=s.prepare_targets([target]);assert boundary>0;s.mark_ready([target])
    with c.sessions() as db:
        row=db.get(ChannelConnection,cid);cutoff=row.accept_after;state.activate_connection(db,cid,lid,c.owner,fence,{'installation_id':row.installation_id,'account_id':row.account_id,'listener_scope':scope});db.commit()
    assert s.prepare_targets([target])==0
    with c.sessions() as db:
        row=db.get(ChannelConnection,cid);assert row.observed_state=='connected' and row.accept_after==cutoff


@pytest.mark.parametrize('native_context',['telegram'],indirect=True)
def test_long_idle_resets_once_before_poll_and_preserves_unknown(native_context):
    from datetime import timedelta
    from app.models import ChannelInstallationLease,ChannelConnectionDelivery,AuditLog
    from sqlalchemy import select
    c=native_context;s=gate(c);advance(s,9000)
    s,did=pending(c);reservation=s.reserve_ack(did);s.finish_ack(did,reservation.claim_id,'unknown')
    with c.sessions() as db:
        lease=db.get(ChannelInstallationLease,c.leases[0][0]);v=s._load(lease)
        v['last_commit_at']=(state.clock(db)-timedelta(days=8)).isoformat();v['last_update_lower_bound']=(state.clock(db)-timedelta(days=9)).isoformat();s._save(lease,v);db.commit()
    first=s.poll_cursor();assert first['offset']==0 and first['epoch']==1
    assert s.poll_cursor()['epoch']==1
    recreated=gate(c);assert recreated.poll_cursor()['offset']==0 and recreated.poll_cursor()['epoch']==1
    advance(recreated,3);assert recreated.poll_cursor()['offset']==4 and recreated.poll_cursor()['epoch']==1
    with c.sessions() as db:
        assert db.get(ChannelConnectionDelivery,did).status=='unknown'
        audits=list(db.scalars(select(AuditLog).where(AuditLog.target_id==c.leases[0][0],AuditLog.action_type=='system.connection.telegram_idle_reset')))
        assert len(audits)==1 and audits[0].after_json['reason']=='TELEGRAM_LONG_IDLE'
        for audit in audits:db.delete(audit)
        db.commit()


@pytest.mark.parametrize('native_context',['telegram'],indirect=True)
def test_short_idle_and_duplicate_commit_do_not_extend_idle_window(native_context):
    from datetime import timedelta
    from app.models import ChannelInstallationLease
    c=native_context;s=gate(c);advance(s,30)
    with c.sessions() as db:
        lease=db.get(ChannelInstallationLease,c.leases[0][0]);v=s._load(lease)
        previous=(state.clock(db)-timedelta(days=4)).isoformat();v['last_commit_at']=previous;v['last_update_lower_bound']=(state.clock(db)-timedelta(days=5)).isoformat();s._save(lease,v);db.commit()
    assert s.poll_cursor()['offset']==31 and s.poll_cursor()['epoch']==0
    advance(s,29);assert s.load_cursor()['last_commit_at']==previous


@pytest.mark.parametrize('native_context',['telegram'],indirect=True)
@pytest.mark.parametrize('receive_delay_hours,commit_delay_hours',[(12,0),(24,0),(12,72)])
def test_delayed_receipt_and_commit_use_generation_lower_bound(native_context,monkeypatch,receive_delay_hours,commit_delay_hours):
    from datetime import timedelta
    from app.models import ChannelInstallationLease,AuditLog
    from sqlalchemy import select
    c=native_context;s=gate(c)
    with c.sessions() as db:
        t0=state.clock(db);db.get(ChannelInstallationLease,c.leases[0][0]).lease_expires_at=t0+timedelta(days=30);db.commit()
    request=t0+timedelta(hours=receive_delay_hours);clock=[request+timedelta(hours=commit_delay_hours)]
    monkeypatch.setattr(state,'clock',lambda db:clock[0])
    try:
        s.advance(9000,request_started_at=request.isoformat())
        saved=s.load_cursor();assert saved['last_commit_at']==clock[0].isoformat()
        assert saved['last_update_lower_bound']==(request-timedelta(hours=24)).isoformat()
        clock[0]=t0+timedelta(days=7,hours=1)
        cursor=s.poll_cursor();assert cursor['offset']==0 and cursor['epoch']==1
        assert s.poll_cursor()['epoch']==1 and gate(c).poll_cursor()['offset']==0
    finally:
        with c.sessions() as db:
            for row in db.scalars(select(AuditLog).where(AuditLog.target_id==c.leases[0][0],AuditLog.action_type=='system.connection.telegram_idle_reset')):db.delete(row)
            db.commit()


@pytest.mark.parametrize('native_context',['telegram'],indirect=True)
@pytest.mark.parametrize('seconds_before,expected_offset',[(61,9001),(59,0),(20,0)])
def test_polling_margin_resets_before_generation_boundary(native_context,monkeypatch,seconds_before,expected_offset):
    from datetime import timedelta
    from app.models import ChannelInstallationLease,AuditLog
    from sqlalchemy import select
    c=native_context;s=gate(c)
    with c.sessions() as db:
        start=state.clock(db);db.get(ChannelInstallationLease,c.leases[0][0]).lease_expires_at=start+timedelta(days=30);db.commit()
    clock=[start];monkeypatch.setattr(state,'clock',lambda db:clock[0])
    try:
        s.advance(9000,request_started_at=start.isoformat());clock[0]=start+timedelta(days=6,seconds=-seconds_before)
        assert s.poll_cursor()['offset']==expected_offset
    finally:
        with c.sessions() as db:
            for row in db.scalars(select(AuditLog).where(AuditLog.target_id==c.leases[0][0],AuditLog.action_type=='system.connection.telegram_idle_reset')):db.delete(row)
            db.commit()


@pytest.mark.parametrize('native_context',['telegram'],indirect=True)
@pytest.mark.parametrize('invalid',['future','naive','missing'])
def test_invalid_poll_time_cannot_advance_offset(native_context,invalid):
    from datetime import timedelta
    from fastapi import HTTPException
    c=native_context;s=gate(c)
    with c.sessions() as db:now=state.clock(db)
    value=(now+timedelta(minutes=1)).isoformat() if invalid=='future' else now.replace(tzinfo=None).isoformat() if invalid=='naive' else None
    with pytest.raises(HTTPException,match='TELEGRAM_POLL_TIME_INVALID'):s.advance(9000,request_started_at=value)
    assert s.load_cursor()['offset']==0 and s.load_cursor()['last_commit_at'] is None

@pytest.mark.parametrize('change',['generation','fence','owner'])
def test_superseded_proof_never_bypasses_fresh_offset_transaction_guard(native_context,change):
    from app.models import ChannelConnection,ChannelInstallationLease
    from fastapi import HTTPException
    c=native_context;s,target,replay,did,snapshot=superseded(c)
    assert s.superseded_replay(target,replay) is True
    with c.sessions() as db:
        started=state.clock(db).isoformat()
        if change=='generation':db.get(ChannelConnection,target.id).generation+=1
        else:
            lease=db.get(ChannelInstallationLease,c.leases[0][0])
            if change=='fence':lease.fence+=1
            else:lease.owner='other'
        db.commit()
    with pytest.raises(HTTPException):s.advance(99,request_started_at=started,targets=[target])
    with c.sessions() as db:
        # 원래 owner/fence 검증을 우회하지 않고 저장된 ciphertext의 offset만 읽는다.
        lease=db.get(ChannelInstallationLease,c.leases[0][0])
        assert s._load(lease)['offset']==0

def test_superseded_same_generation_still_uses_common_payload_conflict(native_context):
    from app.models import ChannelConnection
    from app.services.channel_connection_runtime import ConnectionTarget
    from fastapi import HTTPException
    c=native_context;s,target,replay,did,snapshot=superseded(c)
    with c.sessions() as db:
        row=db.get(ChannelConnection,target.id);row.generation=1;target=ConnectionTarget.from_row(row);db.commit()
    replay['generation']=replay['destination']['generation']=1;replay['message']='tampered'
    assert s.superseded_replay(target,replay) is False
    with pytest.raises(HTTPException,match='NATIVE_EVENT_CONFLICT'):accept(c,replay)
    assert s.load_cursor()['offset']==0

def superseded(c,*,status='received',callback=False,ack='pending',wrapped=False):
    from copy import deepcopy
    from uuid import uuid4
    from app.models import ChannelConnection,ChannelConnectionDelivery
    from app.services.channel_connection_runtime import ConnectionTarget
    s=gate(c)
    incoming={**event(),'generation':1,'bot_id':'100','chat_id':'-300','chatId':'-300','thread_id':None,'threadId':None,
        'destination':{'generation':1,'chatId':'-300','threadId':None}}
    if callback:
        incoming.update(sourceMessageId=str(uuid4()),choiceIndex=1,message='validated native selection',
            callback_id='synthetic-replay',telegram_ack={'status':'pending','expires_at':9999999999})
    did=accept(c,incoming)
    replay=deepcopy(incoming);replay['generation']=2;replay['destination']['generation']=2
    if callback:replay['message']='';replay['telegram_ack']['expires_at']=10000000009
    with c.sessions() as db:
        item=db.get(ChannelConnectionDelivery,did);item.status=status
        item.execution_claim_id='synthetic-execution' if status in {'executing','ready','sending','sent','unknown'} else None
        item.send_claim_id='synthetic-send' if status in {'sending','sent','unknown'} else None
        item.last_error_code='CONNECTION_CHANGED' if status=='cancelled' else 'SYNTHETIC_UNCHANGED' if status in {'failed','unknown'} else None
        item.provider_message_ids=['synthetic-receipt'] if status=='sent' else []
        saved=s.context(item)
        if callback:
            saved['telegram_ack']['status']=ack
            if ack!='pending':saved.pop('callback_id',None);saved['telegram_ack']['claim_id']='synthetic-ack'
        if wrapped:saved={'event':saved,'messages':[]}
        s.write_context(item,saved)
        row=db.get(ChannelConnection,c.ids['connections'][0]);row.generation=2;target=ConnectionTarget.from_row(row)
        snapshot=(item.status,item.execution_claim_id,item.send_claim_id,item.last_error_code,item.provider_message_ids,item.request_hash,s.context(item))
        db.commit()
    return s,target,replay,did,snapshot


@pytest.mark.parametrize('status',['received','executing','ready','sending','sent','failed','unknown','cancelled'])
def test_superseded_accepted_proof_preserves_every_delivery_state(native_context,status):
    from app.models import ChannelConnectionDelivery
    c=native_context;s,target,replay,did,snapshot=superseded(c,status=status)
    assert s.superseded_replay(target,replay) is True
    with c.sessions() as db:
        item=db.get(ChannelConnectionDelivery,did)
        assert (item.status,item.execution_claim_id,item.send_claim_id,item.last_error_code,item.provider_message_ids,item.request_hash,s.context(item))==snapshot
    assert s.load_cursor()['offset']==0


@pytest.mark.parametrize('ack',['pending','confirmed','unknown','failed'])
@pytest.mark.parametrize('wrapped',[False,True])
def test_superseded_callback_proof_survives_id_removal_and_wrapper(native_context,ack,wrapped):
    c=native_context;s,target,replay,did,snapshot=superseded(c,status='unknown' if ack=='unknown' else 'sent',callback=True,ack=ack,wrapped=wrapped)
    assert s.superseded_replay(target,replay) is True
    assert s.reserve_ack(did) is None and s.load_cursor()['offset']==0


@pytest.mark.parametrize('field',['message','actor','destination_chat','destination_thread','callback_id','source','index'])
def test_superseded_proof_rejects_mutated_immutable_payload(native_context,field):
    from fastapi import HTTPException
    c=native_context;callback=field in {'callback_id','source','index'}
    s,target,replay,did,snapshot=superseded(c,callback=callback,ack='confirmed')
    if field=='message':replay['message']='tampered'
    if field=='actor':replay['nativeParticipantKey']='different'
    if field=='destination_chat':replay['destination']['chatId']='-301'
    if field=='destination_thread':replay['destination']['threadId']=99
    if field=='callback_id':replay['callback_id']='other-callback'
    if field=='source':replay['sourceMessageId']=str(__import__('uuid').uuid4())
    if field=='index':replay['choiceIndex']=2
    with pytest.raises(HTTPException,match='NATIVE_EVENT_CONFLICT'):s.superseded_replay(target,replay)
    assert s.load_cursor()['offset']==0


@pytest.mark.parametrize('change',['missing','same_generation','room','epoch','organization','account','generation','fence','scope','ciphertext'])
def test_superseded_proof_requires_exact_current_and_accepted_scope(native_context,change):
    from dataclasses import replace
    from app.models import ChannelConnectionDelivery,ChannelConnection,ChannelInstallationLease
    from fastapi import HTTPException
    c=native_context;s,target,replay,did,snapshot=superseded(c)
    if change=='same_generation':
        with c.sessions() as db:db.get(ChannelConnectionDelivery,did).generation=2;db.commit()
    if change=='missing':
        with c.sessions() as db:db.delete(db.get(ChannelConnectionDelivery,did));db.commit()
    if change=='room':replay['nativeRoomKey']='different-room'
    if change=='epoch':replay['eventId']='telegram-epoch:1:'+replay['eventId']
    if change=='organization':target=replace(target,organization_id=__import__('uuid').uuid4())
    if change=='account':target=replace(target,account_id='101')
    if change=='generation':
        with c.sessions() as db:db.get(ChannelConnection,target.id).generation+=1;db.commit()
    if change=='fence':
        with c.sessions() as db:db.get(ChannelInstallationLease,c.leases[0][0]).fence+=1;db.commit()
    if change=='scope':
        with c.sessions() as db:db.get(ChannelConnection,target.id).listener_scope_hash='c'*64;db.commit()
    if change=='ciphertext':
        with c.sessions() as db:db.get(ChannelConnectionDelivery,did).context_ciphertext='corrupt';db.commit()
    if change in {'missing','same_generation','room','epoch'}:assert s.superseded_replay(target,replay) is False
    else:
        with pytest.raises(HTTPException):s.superseded_replay(target,replay)
    if change!='fence':assert s.load_cursor()['offset']==0

@pytest.mark.parametrize('change',['none','pending','ready','generation','deleted','scope','bot','organization'])
def test_restored_existing_binding_requires_ready_proof_and_current_scope(native_context,change):
    from app.models import ChannelConnection,ChannelInstallationLease
    from app.services.channel_connection_runtime import ConnectionTarget
    from dataclasses import replace
    c=native_context;s=gate(c);cid=c.ids['connections'][0]
    with c.sessions() as db:target=ConnectionTarget.from_row(db.get(ChannelConnection,cid))
    binding=SimpleNamespace(target=target,bot_user_id='100')
    s.prepare_targets([binding]);s.mark_ready([binding]);pending=[target]
    if change=='pending':pending=[]
    if change=='bot':binding.bot_user_id='101'
    if change=='organization':binding.target=replace(target,organization_id=__import__('uuid').uuid4())
    with c.sessions() as db:
        row=db.get(ChannelConnection,cid);lease=db.get(ChannelInstallationLease,c.leases[0][0])
        if change=='generation':row.generation+=1
        if change=='deleted':row.deleted_at=state.clock(db)
        if change=='scope':row.listener_scope_hash='c'*64
        if change=='ready':
            value=s._load(lease);value['targets'][str(cid)]['ready']=False;s._save(lease,value)
        db.commit()
    assert s.restore_binding(binding,pending)==(change=='none')

@pytest.mark.parametrize('change',['purpose','unknown','offset_bool','offset_large','epoch_bool','target_ready','target_generation','target_cutoff','idle_reset','aad'])
def test_cursor_rejects_corrupt_internal_shape_and_aad(native_context,change):
    from uuid import uuid4
    from app.models import ChannelInstallationLease
    from app.services.channel_connections import encrypt_event_context
    from fastapi import HTTPException
    c=native_context;s=gate(c);advance(s,7)
    with c.sessions() as db:
        lease=db.get(ChannelInstallationLease,c.leases[0][0]);value=s._load(lease);wrapper={'purpose':'telegram-polling','value':value}
        if change=='purpose':wrapper['purpose']='other'
        if change=='unknown':value['extra']='unexpected'
        if change=='offset_bool':value['offset']=True
        if change=='offset_large':value['offset']=9007199254740992
        if change=='epoch_bool':value['epoch']=True
        if change.startswith('target_'):
            proof={'generation':1,'ready':True,'cutoff':'2026-11-01T00:00:00+00:00'}
            proof[{'target_ready':'ready','target_generation':'generation','target_cutoff':'cutoff'}[change]]={'target_ready':1,'target_generation':True,'target_cutoff':'2026-11-01T00:00:00'}[change]
            value['targets'][str(c.ids['connections'][0])]=proof
        if change=='idle_reset':value['idle_reset']={'reason':'tampered'}
        lease.cursor_json={'telegram_polling':{'ciphertext':encrypt_event_context(wrapper,uuid4() if change=='aad' else lease.organization_id,lease.id,KEY,'v1'),'key_version':'v1'}}
        db.commit()
    with pytest.raises(HTTPException):s.load_cursor()

@pytest.mark.parametrize('change',['owner','fence','generation','active','scope'])
def test_ack_reservation_uses_current_lease_generation_and_scope(native_context,change):
    from app.models import ChannelConnection,ChannelInstallationLease
    from fastapi import HTTPException
    c=native_context;s,did=pending(c)
    with c.sessions() as db:
        lease=db.get(ChannelInstallationLease,c.leases[0][0]);row=db.get(ChannelConnection,c.ids['connections'][0])
        if change=='owner':lease.owner='stale'
        if change=='fence':lease.fence+=1
        if change=='generation':row.generation+=1
        if change=='active':row.desired_state='disconnected'
        if change=='scope':row.listener_scope_hash='b'*64
        db.commit()
    if change in {'generation','active'}:assert s.reserve_ack(did) is None
    else:
        with pytest.raises(HTTPException):s.reserve_ack(did)

def test_callback_redelivery_restores_only_deadline_and_conflict_stays(native_context):
    from copy import deepcopy
    from app.models import ChannelConnectionDelivery,ChannelConnection
    from app.services.channel_connection_runtime import ConnectionTarget
    c=native_context;s=gate(c);lid,fence=c.leases[0];cid=c.ids['connections'][0]
    with c.sessions() as db:target=ConnectionTarget.from_row(db.get(ChannelConnection,cid))
    incoming={**event(), 'callback_id':'synthetic-one','telegram_ack':{'status':'pending','expires_at':9999999999},'destination':{'generation':1,'chatId':'-300'}}
    did=accept(c,incoming);reservation=s.reserve_ack(did);s.finish_ack(did,reservation.claim_id,'confirmed')
    for wrapped in [False,True]:
        if wrapped:
            with c.sessions() as db:
                item=db.get(ChannelConnectionDelivery,did);s.write_context(item,{'event':s.context(item),'messages':[]});db.commit()
        replay=deepcopy(incoming);replay['telegram_ack']['expires_at']=10000000009
        fixed=s.callback_event(target,replay)
        assert fixed['telegram_ack']=={'status':'pending','expires_at':9999999999}
        assert accept(c,fixed)==did and s.reserve_ack(did) is None
        for field,value in [('message','tampered'),('callback_id','different'),('sourceMessageId','tampered')]:
            changed=deepcopy(replay);changed[field]=value
            with pytest.raises(__import__('fastapi').HTTPException,match='NATIVE_EVENT_CONFLICT'):accept(c,s.callback_event(target,changed))
