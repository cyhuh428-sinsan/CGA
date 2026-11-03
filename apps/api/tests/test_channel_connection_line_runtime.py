"""합성 HMAC·실제 SQLite ORM/native/Node만 사용한 LINE 수신/회신."""
import asyncio,json,time,base64,hmac,hashlib
from copy import deepcopy
from dataclasses import replace
from datetime import timedelta
from types import SimpleNamespace
from uuid import UUID,uuid4
import pytest
from fastapi import HTTPException
from test_channel_connection_state import state_db,KEY
from test_channel_connection_runtime import seed_native,native_orm_bindings

BOT='U'+'1'*32;TARGET='C'+'2'*32;SECRET='synthetic-line-secret'


def raw(body):return json.dumps(body,ensure_ascii=False,separators=(',',':')).encode()
def signature(body,secret=SECRET):return base64.b64encode(hmac.new(secret.encode(),body,hashlib.sha256).digest()).decode()
def event(identifier='m1',*,target=TARGET,actor='U'+'5'*32):
    return dict(destination=BOT,events=[dict(type='message',mode='active',timestamp=int(time.time()*1000),
        webhookEventId=identifier,replyToken='synthetic-reply-'+identifier,
        source=dict(type='group',groupId=target,userId=actor),
        message=dict(id=identifier,type='text',text='@CGA question',mention=dict(mentionees=[dict(type='user',userId=BOT,isSelf=True,index=0,length=5)])),
        deliveryContext=dict(isRedelivery=False))])


class Http:
    def __init__(self):self.posts=[];self.tokens=[];self.fail=False;self.receipt=None
    def bot_info(self,token):return dict(userId=BOT)
    def reply(self,token,body):
        self.posts.append(deepcopy(body));self.tokens.append(token)
        if self.fail:raise TimeoutError('synthetic uncertain reply')
        return dict(sentMessages=[dict(id=self.receipt if self.receipt is not None else 'out'+str(len(self.posts)))])


@pytest.fixture
def line(state_db):
    from app.models import AdminChannel
    from app.services.channel_connections import encrypt_credentials
    from app.services.channel_connection_runtime import ConnectionTarget
    from app.services.channel_connection_line import LineAdapter
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    s,db,row,lease,factory,runtime=seed_native(state_db)
    lease.owner=None;lease.lease_expires_at=s.clock(db)-timedelta(seconds=1)
    row.provider='line';row.installation_id=BOT;row.account_id=BOT;row.target_id=TARGET
    row.observed_state='connecting';row.lease_owner=None;row.lease_expires_at=None;row.listener_scope_hash=None;row.accept_after=None
    db.get(AdminChannel,row.channel_id).code='LINE'
    c=dict(access_token='synthetic-access',channel_secret=SECRET)
    row.credential_ciphertext=encrypt_credentials(c,row.organization_id,row.id,KEY,'v1');row.credential_key_version='v1';db.commit()
    config=SimpleNamespace(channel_connection_worker_enabled=True,channel_connection_encryption_key=KEY,channel_connection_key_version='v1')
    h=Http();a=LineAdapter(factory,owner='qa',config=config,http=h);w=ConnectionSupervisor(factory,config=config,adapters={'line':a});a.owner=w.owner
    return db,row,c,ConnectionTarget.from_row(row),a,w,h


async def receive(a,body):
    data=raw(body);return await a.receive(signature(data),data)
async def finish(w):await w.tick();await w.tick()
async def handshake(g,body):
    task=asyncio.create_task(receive(g[4],body))
    try:
        for _ in range(120):
            await asyncio.sleep(.02);await g[5].tick()
            if task.done():return await task
        raise AssertionError('first request deadline')
    finally:
        if not task.done():task.cancel()


def test_first_signed_event_native_answer_and_duplicate_preserves_context(line):
    from app.models import ChannelConnectionDelivery,ChannelMessage,ChannelInstallationLease
    db,row,c,t,a,w,h=line
    async def run():
        try:
            await w.tick();body=event();first=await handshake(line,body);await finish(w)
            db.expire_all();item=db.get(ChannelConnectionDelivery,UUID(first['deliveries'][0]));saved=(item.context_ciphertext,item.request_hash,item.execution_claim_id,item.send_claim_id)
            assert item.status=='sent' and item.room_id and item.queue_event_id
            assert db.query(ChannelMessage).count()==2 and h.posts[0]['messages']==[dict(type='text',text='fixed QA answer')]
            body['events'][0]['deliveryContext']['isRedelivery']=True
            assert await receive(a,body)==first;await finish(w);db.refresh(item)
            assert saved==(item.context_ciphertext,item.request_hash,item.execution_claim_id,item.send_claim_id) and len(h.posts)==1
            plain=json.dumps(db.query(ChannelInstallationLease).filter_by(provider='line').one().cursor_json)+json.dumps(item.event_json)+json.dumps(item.result_json)
            for secret in [BOT,TARGET,'U'+'5'*32,'synthetic-reply','synthetic-access',SECRET]:assert secret not in plain
        finally:await w.stop()
    asyncio.run(run())


@pytest.mark.parametrize('change',['message','token','event-with-token','destination','source','actor','mode','time','unaddressed','standby'])
def test_untrusted_and_replayed_changes_never_execute_twice(line,change):
    from app.models import ChannelMessage
    db,row,c,t,a,w,h=line
    async def run():
        try:
            await w.tick();body=event();await handshake(line,body);await finish(w);bad=deepcopy(body);v=bad['events'][0]
            if change=='message':v['message']['text']='changed'
            if change=='token':v['replyToken']='changed'
            if change=='event-with-token':v['webhookEventId']='different'
            if change=='destination':bad['destination']='U'+'9'*32
            if change=='source':v['source']['groupId']='C'+'3'*32
            if change=='actor':v['source']['userId']='malformed'
            if change=='mode':v['mode']='untrusted-mode'
            if change=='time':v['timestamp']=True
            if change=='unaddressed':v['message'].pop('mention')
            if change=='standby':v['mode']='standby'
            if change in {'unaddressed','standby'}:assert await receive(a,bad)==dict(deliveries=[])
            else:
                with pytest.raises(HTTPException):await receive(a,bad)
            await finish(w);db.expire_all();assert len(h.posts)==1 and db.query(ChannelMessage).count()==2
        finally:await w.stop()
    asyncio.run(run())


def test_bad_signature_precedes_json_and_empty_probe_cannot_prove(line):
    from app.models import ChannelConnectionDelivery
    from app.services.channel_connection_supervisor import NativeHandshakePending
    db,row,c,t,a,w,h=line
    async def run():
        try:
            await w.tick()
            with pytest.raises(HTTPException) as err:await a.receive(signature(b'{}'),b'{')
            assert err.value.status_code==401
            with pytest.raises(HTTPException) as err:await a.receive(signature(b'{'),b'{')
            assert err.value.status_code==422
            assert await receive(a,dict(destination=BOT,events=[]))==dict(deliveries=[])
            with pytest.raises(NativeHandshakePending):await a.verify(t,c)
            db.expire_all();assert db.query(ChannelConnectionDelivery).count()==0 and not h.posts
        finally:await w.stop()
    asyncio.run(run())


@pytest.mark.parametrize('receipt',[12345678901234567890,True,1.5,'bad value'])
def test_receipt_numeric_normalization_and_unknown_no_retry(line,receipt):
    from app.models import ChannelConnectionDelivery
    from app.services.channel_connection_state import scoped_hash
    db,row,c,t,a,w,h=line;h.receipt=receipt
    async def run():
        try:
            await w.tick();body=event();first=await handshake(line,body);await finish(w)
            db.expire_all();item=db.get(ChannelConnectionDelivery,UUID(first['deliveries'][0]))
            assert item.status==('sent' if type(receipt) is int else 'unknown')
            if type(receipt) is int:assert item.provider_message_ids==[scoped_hash('12345678901234567890')]
            assert await receive(a,body)==first;await finish(w);assert len(h.posts)==1
        finally:await w.stop()
    asyncio.run(run())


def test_reply_unknown_never_retries_after_new_adapter(line):
    from app.models import ChannelConnectionDelivery
    from app.services.channel_connection_line import LineAdapter
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    db,row,c,t,a,w,h=line;h.fail=True
    async def run():
        fresh=None
        try:
            await w.tick();body=event();first=await handshake(line,body);await finish(w);await w.stop()
            b=LineAdapter(a.sessions,owner='new',config=a.config,http=h);fresh=ConnectionSupervisor(a.sessions,config=a.config,adapters={'line':b});b.owner=fresh.owner
            await fresh.tick();second=await handshake((db,row,c,t,b,fresh,h),body);await finish(fresh)
            db.expire_all();assert second==first and db.get(ChannelConnectionDelivery,UUID(first['deliveries'][0])).status=='unknown' and len(h.posts)==1
        finally:
            await w.stop()
            if fresh:await fresh.stop()
    asyncio.run(run())


@pytest.mark.parametrize('field',['timestamp','message-id','raw-text','unknown-field','missing-receipt'])
def test_duplicate_raw_payload_change_or_missing_receipt_fails_closed(line,field):
    from app.models import ChannelInstallationLease,ChannelConnectionDelivery
    db,row,c,t,a,w,h=line
    async def run():
        try:
            await w.tick();body=event();first=await handshake(line,body);await finish(w)
            db.expire_all();item=db.get(ChannelConnectionDelivery,UUID(first['deliveries'][0]));saved=(item.context_ciphertext,item.request_hash)
            if field=='timestamp':body['events'][0]['timestamp']-=1
            if field=='message-id':body['events'][0]['message']['id']='another-id'
            if field=='raw-text':body['events'][0]['message']['text']+=' '
            if field=='unknown-field':body['events'][0]['futureField']='changed'
            if field=='missing-receipt':
                lease=db.query(ChannelInstallationLease).filter_by(provider='line').one();cursor=dict(lease.cursor_json);cursor['line_events']={};cursor['line_reply_tokens']={};lease.cursor_json=cursor;db.commit()
            with pytest.raises(HTTPException):await receive(a,body)
            db.refresh(item);assert saved==(item.context_ciphertext,item.request_hash) and len(h.posts)==1
        finally:await w.stop()
    asyncio.run(run())


async def accept_only(g,body):
    from app.models import ChannelInstallationLease
    from app.services import channel_connection_state as state
    from app.services.channel_connection_supervisor import NativeHandshakePending
    db,row,c,t,a,w,h=g
    await w.tick();await asyncio.sleep(.002)
    body['events'][0]['timestamp']=int(time.time()*1000)
    request=asyncio.create_task(receive(a,body))
    try:
        for _ in range(120):
            await asyncio.sleep(.02)
            try:identity=await a.verify(t,c)
            except NativeHandshakePending:continue
            with a.sessions() as session:
                lease=session.query(ChannelInstallationLease).filter_by(provider='line').one()
                state.activate_connection(session,row.id,lease.id,a.owner,lease.fence,identity);session.commit();lid,fence=lease.id,lease.fence
            return await request,lid,fence,await a.open([t],c,identity)
        raise AssertionError('proof deadline')
    finally:
        if not request.done():request.cancel()


@pytest.mark.parametrize('phase',['received','ready','sent','unknown'])
def test_duplicate_preserves_original_context_hash_claim_and_receipt(line,phase):
    from app.models import ChannelConnectionDelivery,ChannelInstallationLease
    db,row,c,t,a,w,h=line
    async def run():
        listener=None
        try:
            body=event();first,lid,fence,listener=await accept_only(line,body);did=UUID(first['deliveries'][0])
            if phase!='received':await asyncio.to_thread(w.runtime._execute_one,row.id,lid,a.owner,fence,listener.can_execute)
            if phase in {'sent','unknown'}:
                h.fail=phase=='unknown';await w.runtime._send(did,lid,a.owner,fence,listener)
            db.expire_all();item=db.get(ChannelConnectionDelivery,did);lease=db.query(ChannelInstallationLease).filter_by(provider='line').one()
            saved=(item.context_ciphertext,item.request_hash,item.execution_claim_id,item.send_claim_id,deepcopy(lease.cursor_json['line_reply_tokens']))
            assert item.status==phase
            body['events'][0]['deliveryContext']['isRedelivery']=True;assert await receive(a,body)==first
            db.refresh(item);db.refresh(lease)
            assert saved==(item.context_ciphertext,item.request_hash,item.execution_claim_id,item.send_claim_id,lease.cursor_json['line_reply_tokens'])
        finally:
            if listener:await listener.close()
            await w.stop()
    asyncio.run(run())


@pytest.mark.parametrize('phase',['before-native','after-native'])
@pytest.mark.parametrize('bad',['expired','reservation','context-message'])
def test_expiry_reservation_and_context_hash_guard_native_and_post(line,phase,bad):
    from app.models import ChannelConnectionDelivery,ChannelInstallationLease,ChannelMessage
    from app.services.channel_connections import decrypt_event_context,encrypt_event_context
    db,row,c,t,a,w,h=line
    async def run():
        listener=None
        try:
            first,lid,fence,listener=await accept_only(line,event());did=UUID(first['deliveries'][0])
            if phase=='after-native':await asyncio.to_thread(w.runtime._execute_one,row.id,lid,a.owner,fence,listener.can_execute)
            with a.sessions() as session:
                item=session.get(ChannelConnectionDelivery,did)
                context=decrypt_event_context(item.context_ciphertext,item.organization_id,did,KEY,item.context_key_version)
                frame=context.get('event',context)
                if bad=='expired':frame['line_reply']['received_at']-=56
                elif bad=='context-message':frame['message']='tampered accepted message'
                else:
                    lease=session.get(ChannelInstallationLease,lid);cursor=dict(lease.cursor_json);cursor['line_reply_tokens']={};lease.cursor_json=cursor
                item.context_ciphertext=encrypt_event_context(context,item.organization_id,did,KEY,item.context_key_version);session.commit()
            if phase=='before-native':assert not await w.runtime.process_one(row.id,lid,a.owner,fence,listener)
            else:await w.runtime._send(did,lid,a.owner,fence,listener)
            db.expire_all();assert db.get(ChannelConnectionDelivery,did).status==('failed' if phase=='before-native' else 'unknown')
            assert db.query(ChannelMessage).count()==(0 if phase=='before-native' else 2) and not h.posts
        finally:
            if listener:await listener.close()
            await w.stop()
    asyncio.run(run())


@pytest.mark.parametrize('change',['expiry','cancel','timeout','stop','remove','rotate','event','packet'])
def test_late_executor_cannot_post_after_guard_invalidation(line,monkeypatch,change):
    import threading
    from app.models import ChannelConnectionDelivery
    from app.services import channel_connection_line as module,channel_connection_runtime as runtime_module
    db,row,c,t,a,w,h=line;entered=threading.Event();release=threading.Event();done=threading.Event()
    async def run():
        listener=None;task=None
        try:
            first,lid,fence,listener=await accept_only(line,event());did=UUID(first['deliveries'][0])
            await asyncio.to_thread(w.runtime._execute_one,row.id,lid,a.owner,fence,listener.can_execute)
            original=listener._post
            def delayed(target,packets,frame,guard):
                entered.set()
                try:
                    if not release.wait(3):raise AssertionError('executor barrier deadline')
                    if change=='event':frame['message']='changed'
                    if change=='packet':packets[0]['text']='changed'
                    return original(target,packets,frame,guard)
                finally:done.set()
            listener._post=delayed
            if change=='timeout':
                class AsyncProxy:
                    def __getattr__(self,name):return getattr(asyncio,name)
                    async def wait_for(self,future,timeout):return await asyncio.wait_for(future,.05 if timeout==25 else timeout)
                monkeypatch.setattr(runtime_module,'asyncio',AsyncProxy())
            task=asyncio.create_task(w.runtime._send(did,lid,a.owner,fence,listener))
            assert await asyncio.to_thread(entered.wait,3)
            if change=='expiry':monkeypatch.setattr(module,'time',SimpleNamespace(monotonic=lambda:time.monotonic()+56))
            if change=='stop':await listener.close()
            if change=='remove':await listener.update([])
            if change=='rotate':listener.targets[row.id]=replace(listener.targets[row.id],credentials=dict(access_token='new-synthetic',channel_secret=SECRET))
            if change=='cancel':
                task.cancel()
                with pytest.raises(asyncio.CancelledError):await task
            if change=='timeout':await asyncio.wait_for(task,2)
            release.set()
            if change not in {'cancel','timeout'}:await task
            assert await asyncio.to_thread(done.wait,3)
            db.expire_all();assert db.get(ChannelConnectionDelivery,did).status=='unknown' and not h.posts
        finally:
            release.set()
            if task and not task.done():task.cancel()
            if listener:await listener.close()
            await w.stop()
    asyncio.run(run())


def test_card_postback_restores_real_native_variable_and_answer(line):
    from app.models import Bot,BotVersion,ChannelConnectionDelivery,ChannelMessage
    db,row,c,t,a,w,h=line
    version=db.get(BotVersion,db.get(Bot,row.bot_id).active_version_id)
    version.version_json={'dialogs':[{'id':'qa','name':'QA','dialogType':1,'utterances':[{'text':'question','utteranceType':'T'}]}],
        'dialog_flow_graphs':[{'id':'graph-qa','dialogId':'qa','nodes':[
            {'id':'start','kind':'start','config':{}},
            {'id':'choice','kind':'talk','config':{'messageType':'button','basicMessages':['choose'],'messages':['one','two'],'responseType':'relay','responseVariableName':'choice'}},
            {'id':'result','kind':'talk','config':{'messageType':'text','basicMessages':['selected: {{$choice}}'],'responseType':'none'}},
            {'id':'end','kind':'end','config':{}}],
            'links':[{'sourceNodeId':'start','sourcePort':'next','targetNodeId':'choice'},
                {'sourceNodeId':'choice','sourcePort':'next','targetNodeId':'result'},
                {'sourceNodeId':'result','sourcePort':'next','targetNodeId':'end'}]}],'apis':[]};db.commit()
    def click(data,identifier='click',actor='U'+'5'*32):
        body=event(identifier,actor=actor);native=body['events'][0];native['type']='postback';native.pop('message');native['postback']=dict(data=data);return body
    async def run():
        try:
            await w.tick();await handshake(line,event());await finish(w)
            data=h.posts[0]['messages'][0]['contents']['footer']['contents'][1]['action']['data']
            for wrong in ['cga:'+str(uuid4())+':1',data.rsplit(':',1)[0]+':99']:
                with pytest.raises(HTTPException):await receive(a,click(wrong,'bad'+str(len(wrong))))
            body=click(data);accepted=await receive(a,body);await finish(w)
            assert h.posts[-1]['messages']==[dict(type='text',text='selected: two')]
            assert await receive(a,body)==accepted;await finish(w);assert len(h.posts)==2
            db.expire_all();item=db.get(ChannelConnectionDelivery,UUID(accepted['deliveries'][0]));assert item.status=='sent'
            user=db.get(ChannelMessage,item.request_message_id);assert 'two' in user.text and 'sourceMessageId' in user.text
        finally:await w.stop()
    asyncio.run(run())


@pytest.mark.parametrize('change',['generation','owner','fence','scope'])
def test_changed_binding_requires_fresh_handshake_and_rejects_stale_activation(line,change):
    from app.models import ChannelInstallationLease
    from app.services import channel_connection_state as state
    from app.services.channel_connection_supervisor import NativeHandshakePending
    from app.services.channel_connection_runtime import ConnectionTarget
    db,row,c,t,a,w,h=line
    async def run():
        try:
            await w.tick();await handshake(line,event());await finish(w);identity=await a.verify(t,c)
            old_candidate=a._candidates()[0];old_listener=next(iter(w.handles.values())).listener
            db.refresh(row);cutoff=row.accept_after
            await a.verify(t,c);db.refresh(row);assert row.accept_after==cutoff
            with a.sessions() as session:
                current=session.get(type(row),row.id);lease=session.query(ChannelInstallationLease).filter_by(provider='line').one()
                if change=='generation':current.generation+=1
                elif change=='scope':current.target_id='R'+'a'*32
                else:
                    lease.lease_expires_at=state.clock(session)-timedelta(seconds=1)
                    if change=='owner':a.owner='new-worker'
                session.commit();fresh=ConnectionTarget.from_row(current)
            with pytest.raises(NativeHandshakePending):await a.verify(fresh,c)
            if change=='scope':
                # 직접 DB samegen 변조는 정식 update 불변조건을 우회한다. provider proof/수신/송신은 계속 차단한다.
                with pytest.raises(HTTPException,match='CONNECTION_CHANGED'):
                    a._accept(old_candidate,{},'unused',0,'unused')
                with a.sessions() as session:
                    from app.models import ChannelConnectionDelivery
                    item=session.query(ChannelConnectionDelivery).one()
                    with pytest.raises(HTTPException,match='CONNECTION_LEASE_LOST'):old_listener._reservation(session,item,old_listener._context(item))
                    session.get(type(row),row.id).generation+=1;session.commit()
            with a.sessions() as session:
                lease=session.query(ChannelInstallationLease).filter_by(provider='line').one()
                with pytest.raises(HTTPException):state.activate_connection(session,row.id,lease.id,a.owner,lease.fence,identity)
            db.refresh(row);assert row.accept_after>cutoff and len(h.posts)==1
        finally:await w.stop()
    asyncio.run(run())


def add_target(line):
    from app.models import ChannelConnection
    from app.services.channel_connections import encrypt_credentials
    db,row,c,t,a,w,h=line
    other=ChannelConnection(organization_id=row.organization_id,channel_id=row.channel_id,bot_id=row.bot_id,
        name='second QA',provider='line',installation_id=BOT,account_id=BOT,target_id='C'+'3'*32,desired_state='connected',observed_state='connecting')
    db.add(other);db.flush();other_c=dict(access_token='synthetic-access-B',channel_secret=SECRET)
    other.credential_ciphertext=encrypt_credentials(other_c,row.organization_id,other.id,KEY,'v1');other.credential_key_version='v1';db.commit();return other


def test_token_and_event_receipts_are_bot_scoped_across_target_and_generation(line):
    from app.services.channel_connection_runtime import ConnectionTarget
    from app.services.channel_connection_supervisor import NativeHandshakePending
    from app.models import ChannelConnectionDelivery
    db,row,c,t,a,w,h=line;other=add_target(line)
    async def run():
        try:
            await w.tick();original=event();await handshake(line,original);await finish(w)
            for different_event in [False,True]:
                body=event('other' if different_event else 'm1',target=other.target_id)
                if different_event:body['events'][0]['replyToken']=original['events'][0]['replyToken']
                else:body['events'][0]['replyToken']='different-proof'
                with pytest.raises(HTTPException) as err:await receive(a,body)
                assert err.value.status_code==409
            with a.sessions() as session:
                current=session.get(type(row),row.id);current.generation+=1;session.commit();fresh=ConnectionTarget.from_row(current)
            with pytest.raises(NativeHandshakePending):await a.verify(fresh,c)
            body=event('new-generation');body['events'][0]['replyToken']=original['events'][0]['replyToken']
            with pytest.raises(HTTPException) as err:await receive(a,body)
            assert err.value.status_code==409
            db.expire_all();assert db.query(ChannelConnectionDelivery).count()==1 and len(h.posts)==1
        finally:await w.stop()
    asyncio.run(run())


def test_per_target_credentials_survive_A_rotation_and_removal(line):
    from app.services.channel_connections import encrypt_credentials
    db,row,c,t,a,w,h=line;other=add_target(line)
    async def run():
        try:
            await w.tick();await handshake(line,event());await handshake(line,event('B',target=other.target_id));await finish(w)
            assert h.tokens==['synthetic-access','synthetic-access-B']
            with a.sessions() as session:
                current=session.get(type(row),row.id);current.generation+=1
                updated=dict(access_token='synthetic-access-A2',channel_secret=SECRET)
                current.credential_ciphertext=encrypt_credentials(updated,row.organization_id,row.id,KEY,'v1');session.commit()
            await w.tick();await handshake(line,event('A2'));await finish(w)
            with a.sessions() as session:session.get(type(row),row.id).desired_state='disconnected';session.commit()
            await w.tick();await receive(a,event('B2',target=other.target_id));await finish(w)
            assert h.tokens==['synthetic-access','synthetic-access-B','synthetic-access-A2','synthetic-access-B']
        finally:await w.stop()
    asyncio.run(run())


def test_json_format_and_batch_reorder_preserve_event_receipt(line):
    from app.models import ChannelMessage
    db,row,c,t,a,w,h=line
    async def run():
        try:
            await w.tick();body=event();first=await handshake(line,body);await finish(w)
            body['events'].append(event('m2')['events'][0]);await receive(a,body);await finish(w)
            body['events'].reverse()
            for native in body['events']:native['deliveryContext']['isRedelivery']=True
            data=json.dumps(body,ensure_ascii=True,indent=2).encode()
            result=await a.receive(signature(data),data);await finish(w)
            assert result['deliveries'][1]==first['deliveries'][0] and len(h.posts)==2
            db.expire_all();assert db.query(ChannelMessage).count()==4
        finally:await w.stop()
    asyncio.run(run())


def test_guard_single_use_is_atomic_and_send_never_opens_another_session(line):
    from app.models import ChannelConnectionDelivery
    db,row,c,t,a,w,h=line
    async def run():
        listener=None
        try:
            first,lid,fence,listener=await accept_only(line,event());did=UUID(first['deliveries'][0])
            await asyncio.to_thread(w.runtime._execute_one,row.id,lid,a.owner,fence,listener.can_execute)
            send=listener.send
            async def twice(target,packets,frame,*,send_guard):
                result=await asyncio.gather(send(target,packets,frame,send_guard=send_guard),send(target,packets,frame,send_guard=send_guard),return_exceptions=True)
                assert sum(isinstance(x,HTTPException) for x in result)==1
                return next(x for x in result if isinstance(x,list))
            listener.send=twice;saved=a.sessions
            def forbidden():pytest.fail('LINE send must reuse held DB session')
            a.sessions=forbidden
            try:await w.runtime._send(did,lid,a.owner,fence,listener)
            finally:a.sessions=saved
            db.expire_all();assert db.get(ChannelConnectionDelivery,did).status=='sent' and len(h.posts)==1
        finally:
            if listener:await listener.close()
            await w.stop()
    asyncio.run(run())


@pytest.mark.parametrize('change',['remove','rotate','close'])
def test_already_started_post_uses_original_credentials_and_changes_result_to_unknown(line,change):
    import threading
    from app.models import ChannelConnectionDelivery
    db,row,c,t,a,w,h=line;entered=threading.Event();release=threading.Event();reply=h.reply
    def blocked(token,body):
        entered.set()
        if not release.wait(3):raise AssertionError('HTTP barrier deadline')
        return reply(token,body)
    h.reply=blocked
    async def run():
        listener=None;task=None
        try:
            first,lid,fence,listener=await accept_only(line,event());did=UUID(first['deliveries'][0])
            await asyncio.to_thread(w.runtime._execute_one,row.id,lid,a.owner,fence,listener.can_execute)
            task=asyncio.create_task(w.runtime._send(did,lid,a.owner,fence,listener));assert await asyncio.to_thread(entered.wait,3)
            if change=='remove':await listener.update([])
            if change=='rotate':listener.targets[row.id]=replace(listener.targets[row.id],credentials=dict(access_token='new-synthetic',channel_secret=SECRET))
            if change=='close':await listener.close()
            release.set();await task
            db.expire_all();assert db.get(ChannelConnectionDelivery,did).status=='unknown'
            assert h.tokens==['synthetic-access'] and len(h.posts)==1
            await w.runtime.process_one(row.id,lid,a.owner,fence,listener);assert len(h.posts)==1
        finally:
            release.set()
            if task and not task.done():await task
            if listener:await listener.close()
            await w.stop()
    asyncio.run(run())


def test_ready_context_resumes_with_fresh_owner_proof_without_second_native(line):
    from app.models import ChannelConnectionDelivery,ChannelInstallationLease,ChannelMessage
    from app.services import channel_connection_state as state
    from app.services.channel_connection_line import LineAdapter
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    db,row,c,t,a,w,h=line
    async def run():
        listener=None;fresh=None
        try:
            original=event();accepted,lid,fence,listener=await accept_only(line,original);did=UUID(accepted['deliveries'][0])
            await asyncio.to_thread(w.runtime._execute_one,row.id,lid,a.owner,fence,listener.can_execute)
            db.expire_all();item=db.get(ChannelConnectionDelivery,did);saved=(item.context_ciphertext,item.request_hash,item.execution_claim_id)
            assert item.status=='ready' and db.query(ChannelMessage).count()==2
            await listener.close()
            with a.sessions() as session:
                lease=session.get(ChannelInstallationLease,lid);lease.lease_expires_at=state.clock(session)-timedelta(seconds=1);session.commit()
            b=LineAdapter(a.sessions,owner='new',config=a.config,http=h);fresh=ConnectionSupervisor(a.sessions,config=a.config,adapters={'line':b});b.owner=fresh.owner
            await fresh.tick();assert not fresh.handles and not h.posts
            assert await receive(b,original)==accepted
            db.refresh(item);assert saved==(item.context_ciphertext,item.request_hash,item.execution_claim_id)
            body=event('fresh-proof');await handshake((db,row,c,t,b,fresh,h),body);await finish(fresh)
            db.refresh(item);assert item.status=='sent' and item.execution_claim_id==saved[2]
            assert h.posts[0]['replyToken']=='synthetic-reply-m1' and h.posts[0]['messages']==[dict(type='text',text='fixed QA answer')]
            assert sum(p['replyToken']=='synthetic-reply-m1' for p in h.posts)==1
            db.expire_all();assert db.query(ChannelMessage).count()==4
        finally:
            if listener:await listener.close()
            await w.stop()
            if fresh:await fresh.stop()
    asyncio.run(run())


def test_node_delay_is_rechecked_using_db_clock_before_post(line,monkeypatch):
    from app.services import channel_connection_runtime as runtime_module,channel_connection_state as state
    from app.models import ChannelConnectionDelivery
    db,row,c,t,a,w,h=line
    async def run():
        listener=None
        try:
            first,lid,fence,listener=await accept_only(line,event());did=UUID(first['deliveries'][0])
            await asyncio.to_thread(w.runtime._execute_one,row.id,lid,a.owner,fence,listener.can_execute)
            convert=runtime_module.convert_packet;clock=state.clock
            def delayed(*args):
                packets=convert(*args)
                monkeypatch.setattr(state,'clock',lambda session:clock(session)+timedelta(seconds=55))
                return packets
            monkeypatch.setattr(runtime_module,'convert_packet',delayed)
            await w.runtime._send(did,lid,a.owner,fence,listener)
            db.expire_all();assert db.get(ChannelConnectionDelivery,did).status=='unknown' and not h.posts
        finally:
            if listener:await listener.close()
            await w.stop()
    asyncio.run(run())


@pytest.mark.parametrize('native',[{'deliveryContext':'not-an-object'},{'source':'not-an-object'},{'timestamp':None}])
def test_malformed_signed_native_is_rejected_before_proof(line,native):
    from app.models import ChannelConnectionDelivery
    from app.services.channel_connection_supervisor import NativeHandshakePending
    db,row,c,t,a,w,h=line
    async def run():
        try:
            await w.tick();body=event();body['events'][0].update(native)
            with pytest.raises(HTTPException) as error:await receive(a,body)
            assert error.value.status_code==422
            with pytest.raises(NativeHandshakePending):await a.verify(t,c)
            assert db.query(ChannelConnectionDelivery).count()==0 and not h.posts
        finally:await w.stop()
    asyncio.run(run())


def test_batches_are_bounded_and_invalid_signature_uses_current_secret(line):
    from app.services.channel_connections import encrypt_credentials
    db,row,c,t,a,w,h=line
    async def run():
        try:
            await w.tick();assert await receive(a,dict(destination=BOT,events=[dict(type='unfollow')]*100))==dict(deliveries=[])
            with pytest.raises(HTTPException) as error:await receive(a,dict(destination=BOT,events=[dict(type='unfollow')]*101))
            assert error.value.status_code==422
            updated=dict(c,channel_secret='synthetic-rotated-secret')
            with a.sessions() as session:
                current=session.get(type(row),row.id);current.generation+=1;current.credential_ciphertext=encrypt_credentials(updated,row.organization_id,row.id,KEY,'v1');session.commit()
            await w.tick();body=raw(dict(destination=BOT,events=[]))
            with pytest.raises(HTTPException) as error:await a.receive(signature(body),body)
            assert error.value.status_code==401
            assert await a.receive(signature(body,updated['channel_secret']),body)==dict(deliveries=[])
        finally:await w.stop()
    asyncio.run(run())


def test_inactive_unrelated_candidate_does_not_block_healthy_target(line):
    from app.models import Bot
    db,row,c,t,a,w,h=line;other=add_target(line);bot=db.get(Bot,row.bot_id)
    other_bot=Bot(organization_id=row.organization_id,group_id=bot.group_id,name='Other QA');db.add(other_bot);db.flush();other.bot_id=other_bot.id;db.commit()
    async def run():
        try:
            await w.tick();await handshake(line,event());await finish(w)
            with a.sessions() as session:session.get(Bot,other_bot.id).status='inactive';session.commit()
            await receive(a,event('healthy'));await finish(w);assert len(h.posts)==2
        finally:await w.stop()
    asyncio.run(run())


def test_send_snapshot_cannot_use_credentials_changed_without_generation(line):
    from app.models import ChannelConnectionDelivery
    from app.services.channel_connections import encrypt_credentials
    db,row,c,t,a,w,h=line
    async def run():
        listener=None
        try:
            first,lid,fence,listener=await accept_only(line,event());did=UUID(first['deliveries'][0])
            await asyncio.to_thread(w.runtime._execute_one,row.id,lid,a.owner,fence,listener.can_execute)
            with a.sessions() as session:
                current=session.get(type(row),row.id)
                current.credential_ciphertext=encrypt_credentials(dict(c,access_token='new-synthetic'),row.organization_id,row.id,KEY,'v1');session.commit()
            await w.runtime._send(did,lid,a.owner,fence,listener)
            db.expire_all();assert db.get(ChannelConnectionDelivery,did).status=='unknown' and not h.posts
        finally:
            if listener:await listener.close()
            await w.stop()
    asyncio.run(run())
