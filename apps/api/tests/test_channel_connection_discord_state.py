"""Discord ACK·cursor의 실제 SQLite 원장 경계. 외부 서비스 없음."""
from datetime import timedelta
from dataclasses import replace
from uuid import uuid4
import pytest
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException
from test_channel_connection_state import state_db, activated, event, KEY


@pytest.fixture
def discord_state(state_db):
    from app.services.channel_connection_discord_gateway import DiscordState
    s, db, row, lease = activated(state_db)
    row.provider = lease.provider = 'discord'
    row.installation_id, row.account_id, row.target_id = '300', '200', '400'
    row.listener_scope_hash = lease.listener_scope_hash = s._listener_scope(row, 'discord-app:100')
    db.commit()
    factory = sessionmaker(db.bind, expire_on_commit=False)
    gate = DiscordState(factory, lease_id=lease.id, owner='worker-1', fence=1, scope='discord-app:100', key=KEY, version='v1')
    return s, db, row, lease, factory, gate


def pending(c, **changes):
    s, db, row, lease, factory, gate = c
    incoming = {**event(), 'interaction_id':'600', 'callback_token':'synthetic-callback',
        'destination':{'generation':1, 'channelId':'400'},
        'discord_ack':{'status':'pending','expires_at':s.clock(db).timestamp()+30}, **changes}
    item = s.accept_delivery(db, row.id, lease.id, 'worker-1', 1, incoming, key=KEY, version='v1')
    db.commit();return item.id, incoming


def test_ack_is_claimed_once_confirmed_before_execution_and_preserves_event(discord_state):
    from app.models import ChannelConnectionDelivery
    c=discord_state;s,db,row,lease,factory,gate=c;did,incoming=pending(c)
    assert s.claim_delivery(db,row.id,lease.id,'worker-1',1,deadline_seconds=30,eligibility=gate.can_execute) is None
    db.commit()
    reservation=gate.reserve_ack(did)
    assert reservation.interaction_id=='600' and 'synthetic-callback' not in repr(reservation)
    assert gate.reserve_ack(did) is None and gate.finish_ack(did,reservation.claim_id,'confirmed')
    db.expire_all();item=db.get(ChannelConnectionDelivery,did);ctx=gate.context(item)
    assert ctx['message']=='question' and ctx['destination']==incoming['destination'] and 'callback_token' not in ctx
    assert s.accept_delivery(db,row.id,lease.id,'worker-1',1,incoming,key=KEY,version='v1').id==did
    assert s.claim_delivery(db,row.id,lease.id,'worker-1',1,deadline_seconds=30,eligibility=gate.can_execute).id==did


@pytest.mark.parametrize('outcome,status', [('unknown','unknown'),('rejected','failed')])
def test_uncertain_or_rejected_ack_never_retries_or_executes(discord_state,outcome,status):
    from app.models import ChannelConnectionDelivery
    c=discord_state;s,db,row,lease,factory,gate=c;did,_=pending(c)
    reservation=gate.reserve_ack(did)
    assert gate.finish_ack(did,reservation.claim_id,outcome)
    assert gate.reserve_ack(did) is None and not gate.finish_ack(did,reservation.claim_id,'confirmed')
    db.expire_all();item=db.get(ChannelConnectionDelivery,did)
    assert item.status==status and not gate.can_execute(item) and 'callback_token' not in gate.context(item)


@pytest.mark.parametrize('sending,status', [(False,'failed'),(True,'unknown')])
def test_ack_expiry_blocks_current_room_but_not_other_room(discord_state,sending,status):
    from app.models import ChannelConnectionDelivery
    c=discord_state;s,db,row,lease,factory,gate=c;did,_=pending(c)
    if sending:gate.reserve_ack(did)
    db.expire_all();item=db.get(ChannelConnectionDelivery,did);ctx=gate.context(item)
    ctx['discord_ack']['expires_at']=0;gate._write(item,ctx)
    same=s.accept_delivery(db,row.id,lease.id,'worker-1',1,{**event(),'eventId':'same2'},key=KEY,version='v1')
    other=s.accept_delivery(db,row.id,lease.id,'worker-1',1,{**event(),'eventId':'other','nativeRoomKey':'independent'},key=KEY,version='v1')
    now=s.clock(db);item.created_at,same.created_at,other.created_at=now-timedelta(seconds=3),now-timedelta(seconds=2),now-timedelta(seconds=1)
    db.flush()
    assert s.claim_delivery(db,row.id,lease.id,'worker-1',1,deadline_seconds=30,eligibility=gate.can_execute).id==other.id
    assert item.status==status and same.status=='received'
    db.commit()
    next_item=s.claim_delivery(db,row.id,lease.id,'worker-1',1,deadline_seconds=30,eligibility=gate.can_execute)
    assert (next_item is None) if sending else (next_item.id==same.id)


def cursor():return {'application_id':'100','bot_user_id':'200','token_hash':'a'*64,'session_id':'synthetic-session','resume_url':'wss://gateway.discord.gg/?v=10&encoding=json','sequence':7}


def test_cursor_is_encrypted_scoped_and_checks_purpose(discord_state):
    from app.services.channel_connections import encrypt_event_context
    s,db,row,lease,factory,gate=discord_state
    gate.save_cursor(cursor());assert gate.load_cursor()==cursor()
    db.expire_all();assert 'synthetic-session' not in str(lease.cursor_json)
    lease.cursor_json={'discord_gateway':{'ciphertext':encrypt_event_context({'purpose':'wrong','value':cursor()},lease.organization_id,lease.id,KEY,'v1'),'key_version':'v1'}};db.commit()
    with pytest.raises(HTTPException):gate.load_cursor()


@pytest.mark.parametrize('change', ['owner','fence','scope','key'])
def test_stale_cursor_writer_fails_closed(discord_state,change):
    from app.services.channel_connection_discord_gateway import DiscordState
    s,db,row,lease,factory,gate=discord_state;gate.save_cursor(cursor())
    args=dict(lease_id=lease.id,owner='worker-1',fence=1,scope='discord-app:100',key=KEY,version='v1')
    args[change]={'owner':'stale','fence':2,'scope':'discord-app:101','key':'invalid'}[change]
    stale=DiscordState(factory,**args)
    with pytest.raises(HTTPException):stale.load_cursor()
    assert gate.load_cursor()['sequence']==7


def test_generation_changed_prevents_ack_and_fresh_cutoff_keeps_connected(discord_state):
    from app.services.channel_connection_runtime import ConnectionTarget
    from app.models import ChannelConnectionDelivery
    from types import SimpleNamespace
    s,db,row,lease,factory,gate=discord_state;did,_=pending(discord_state)
    target=ConnectionTarget.from_row(row);gate.fresh_cutoff([SimpleNamespace(target=target)])
    db.expire_all();assert row.observed_state=='connected'
    row.generation+=1;db.commit();assert gate.reserve_ack(did) is None
    db.expire_all();assert db.get(ChannelConnectionDelivery,did).status=='cancelled'


@pytest.mark.parametrize('value', [{'bot_token':'synthetic'}, {'application_id':'100','bot_user_id':'200','token_hash':'a'*64,'session_id':'s','resume_url':'wss://evil.test','sequence':1}])
def test_cursor_rejects_invalid_shape_and_destination(discord_state,value):
    with pytest.raises(HTTPException):discord_state[-1].save_cursor(value)
