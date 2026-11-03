"""Telegram→실제 SQLite/native 고정 QA/Node. 외부 HTTP 없음."""
import asyncio,time,queue,json,threading
from datetime import timedelta
from types import SimpleNamespace
from dataclasses import replace
from uuid import uuid4
import pytest
from sqlalchemy import select
from fastapi import HTTPException
from test_channel_connection_state import state_db,KEY
from test_channel_connection_runtime import seed_native,native_orm_bindings
from test_channel_connection_telegram import Http
class NativeHttp(Http):
    def __init__(self):super().__init__();self.queue=queue.Queue();self.polls=[];self.posts=[];self.acks=[];self.fail=False;self.fail_ack=False;self.pending={};self.lock=threading.Lock()
    def call(self,method,token,payload):
        if method=='getUpdates':
            self.polls.append(dict(payload))
            try:
                update=self.queue.get(timeout=.1 if payload.get('timeout') else 0)
                with self.lock:self.pending[update['update_id']]=update
            except queue.Empty:pass
            with self.lock:
                self.pending={k:v for k,v in self.pending.items() if k>=payload.get('offset',0)}
                return [v for k,v in sorted(self.pending.items())][:payload.get('limit',100)]
        if method=='getChat':return {'id':int(payload['chat_id']),'type':'supergroup','permissions':{'can_send_messages':True,'can_send_photos':True}}
        if method in {'sendMessage','sendPhoto'}:
            self.posts.append((method,payload))
            if self.fail:raise TimeoutError('synthetic uncertain POST')
            result={'message_id':len(self.posts),'chat':{'id':int(payload['chat_id'])}}
            if 'message_thread_id' in payload:result['message_thread_id']=payload['message_thread_id']
            return result
        if method=='answerCallbackQuery':
            self.acks.append(payload['callback_query_id'])
            if self.fail_ack:raise TimeoutError('synthetic uncertain callback')
            return True
        return super().call(method,token,payload)


def message(update_id=1,chat=-300,actor=500,*,addressed=True,thread=None):
    text=('@CgaQaBot ' if addressed else '')+'question';body={'message_id':update_id,'date':int(time.time()),'chat':{'id':chat,'type':'supergroup'},'from':{'id':actor,'is_bot':False},'text':text,'entities':[{'type':'mention','offset':0,'length':9}] if addressed else []}
    if thread is not None:body.update(message_thread_id=thread,is_topic_message=True)
    return {'update_id':update_id,'message':body}



def action(update_id,data,stamp,actor=500):return {'update_id':update_id,'callback_query':{'id':'synthetic-callback-'+str(update_id),'from':{'id':actor,'is_bot':False},'message':{'message_id':900,'date':stamp,'from':{'id':100,'is_bot':True},'chat':{'id':-300,'type':'supergroup'}},'data':data}}

@pytest.fixture
def telegram(state_db,monkeypatch):
    from app.models import AdminChannel
    from app.core.config import settings
    from app.services.channel_connections import encrypt_credentials
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    from app.services.channel_connection_telegram import TelegramAdapter
    s,db,row,lease,factory,runtime=seed_native(state_db)
    lease.lease_expires_at=s.clock(db)-timedelta(seconds=1)
    row.provider='telegram';row.installation_id=row.account_id='100';row.target_id='-300'
    db.get(AdminChannel,row.channel_id).code='TELEGRAM'
    row.credential_ciphertext=encrypt_credentials({'bot_token':'synthetic-only'},row.organization_id,row.id,KEY,'v1')
    row.credential_key_version='v1';db.commit()
    monkeypatch.setattr(settings,'channel_connection_encryption_key',KEY)
    config=SimpleNamespace(channel_connection_worker_enabled=True,channel_connection_encryption_key=KEY,channel_connection_key_version='v1')
    h=NativeHttp();adapter=TelegramAdapter(factory,owner='synthetic',http=h)
    worker=ConnectionSupervisor(factory,config=config,adapters={'telegram':adapter});adapter.owner=worker.owner
    return db,row,factory,adapter,worker,h

async def delivered(worker,h,body):
    h.queue.put(body)
    for _ in range(250):
        if not worker.handles:raise AssertionError('Telegram listener missing')
        handle=next(iter(worker.handles.values()))
        if handle.task.done():await handle.task
        if handle.listener.offset>body['update_id']:return
        await asyncio.sleep(.01)
    raise AssertionError('durable Telegram offset missing')

def test_poll_to_native_fixed_qa_duplicate_and_long_poll(telegram):
    from app.models import ChannelConnectionDelivery,ChannelMessage
    db,row,factory,adapter,worker,h=telegram
    async def run():
        try:
            await worker.tick();body=message();await delivered(worker,h,body);await worker.tick()
            db.expire_all();item=db.query(ChannelConnectionDelivery).one()
            assert item.status=='sent' and item.room_id and item.queue_event_id
            assert db.query(ChannelMessage).count()==2 and h.posts[0][1]['text']=='fixed QA answer'
            assert len(h.posts)==1 and any(p['timeout']==20 for p in h.polls)
            await delivered(worker,h,body);await worker.tick();assert len(h.posts)==1
        finally:await worker.stop()
    asyncio.run(run())

def rotate_row(t,token='synthetic-only'):
    from app.services.channel_connections import encrypt_credentials
    from app.services import channel_connection_state as state
    db,row,factory,adapter,worker,h=t
    db.refresh(row);row.generation+=1;row.observed_state='connecting';row.lease_owner=None;row.lease_expires_at=None
    row.credential_ciphertext=encrypt_credentials({'bot_token':token},row.organization_id,row.id,KEY,'v1');row.accept_after=state.clock(db);db.commit()

@pytest.mark.parametrize('token_changed',[False,True])
def test_rotation_without_event_keeps_other_target_and_old_source_drops(telegram,monkeypatch,token_changed):
    from app.models import ChannelConnectionDelivery,ChannelMessage
    db,row,factory,adapter,worker,h=telegram;other=add_target(telegram)
    async def run():
        release=asyncio.Event();entered=asyncio.Event();finished=asyncio.Event()
        try:
            await worker.tick();listener=next(iter(worker.handles.values())).listener;original=listener.handle
            async def blocked(body,receive,**source):
                if body['update_id']==1:
                    entered.set();await release.wait()
                    try:return await original(body,receive,**source)
                    finally:finished.set()
                return await original(body,receive,**source)
            monkeypatch.setattr(listener,'handle',blocked)
            h.queue.put(message());await asyncio.wait_for(entered.wait(),2)
            rotate_row(telegram,'synthetic-rotated' if token_changed else 'synthetic-only')
            await worker.tick();await worker.tick()
            db.refresh(row);db.refresh(other);assert row.observed_state==other.observed_state=='connected'
            h.pending.clear();release.set();await asyncio.wait_for(finished.wait(),2)
            db.expire_all();assert db.query(ChannelConnectionDelivery).count()==db.query(ChannelMessage).count()==0
            assert listener.gate.load_cursor()['offset']==0 and not h.posts and not h.acks
            # 이전 source 한 번을 관찰한 뒤, 신규 source에서 정상 새 update 수신한다.
            h.pending.clear();await delivered(worker,h,message(2));await worker.tick()
            await delivered(worker,h,message(3,chat=-301));await worker.tick()
            assert len(h.posts)==2
        finally:release.set();await worker.stop()
    asyncio.run(run())

def test_offset_commit_failure_restart_replay_executes_and_sends_once(telegram,monkeypatch):
    from app.services.channel_connection_telegram import TelegramAdapter
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    from app.models import ChannelConnectionDelivery,ChannelMessage
    db,row,factory,adapter,worker,h=telegram
    async def run():
        fresh=None
        try:
            await worker.tick();handle=next(iter(worker.handles.values()));listener=handle.listener
            # foreground frame을 사용하고 background가 볼 queue는 비워 둔다.
            async def receive(cid,event):return await worker.runtime.receive(cid,handle.lease_id,worker.owner,handle.fence,event)
            original=listener.gate.advance
            def fail(*a,**k):raise RuntimeError('synthetic durable offset failure')
            monkeypatch.setattr(listener.gate,'advance',fail)
            with pytest.raises(RuntimeError):await listener.handle(message(),receive)
            assert listener.offset==listener.gate.load_cursor()['offset']==0
            monkeypatch.setattr(listener.gate,'advance',original)
            await worker.runtime.process_one(row.id,handle.lease_id,worker.owner,handle.fence,listener)
            await worker.stop();h.queue.put(message())
            current=TelegramAdapter(factory,owner='fresh',http=h)
            fresh=ConnectionSupervisor(factory,config=worker.config,adapters={'telegram':current});current.owner=fresh.owner
            await fresh.tick();await delivered(fresh,h,message());await fresh.tick()
            db.expire_all();assert db.query(ChannelConnectionDelivery).count()==1
            assert db.query(ChannelMessage).count()==2 and len(h.posts)==1
        finally:
            await worker.stop()
            if fresh:await fresh.stop()
    asyncio.run(run())

def test_new_owner_same_generation_restores_established_cutoff(telegram):
    from app.services.channel_connection_telegram import TelegramAdapter
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    db,row,factory,adapter,worker,h=telegram
    async def run():
        fresh=None
        try:
            await worker.tick();db.refresh(row);cutoff=row.accept_after;await worker.stop()
            current=TelegramAdapter(factory,owner='fresh',http=h)
            fresh=ConnectionSupervisor(factory,config=worker.config,adapters={'telegram':current});current.owner=fresh.owner
            await fresh.tick();db.refresh(row);assert row.accept_after==cutoff
            rotate_row((db,row,factory,current,fresh,h));await fresh.tick();db.refresh(row);assert row.accept_after>cutoff
        finally:
            await worker.stop()
            if fresh:await fresh.stop()
    asyncio.run(run())

def test_send_uses_no_new_db_session_preflights_photo_and_receipt(telegram):
    from app.services.channel_connection_runtime import ConnectionTarget
    db,row,factory,adapter,worker,h=telegram
    async def run():
        try:
            await worker.tick();listener=next(iter(worker.handles.values())).listener;target=ConnectionTarget.from_row(row)
            packet={'method':'sendPhoto','parameters':{'chat_id':'-300','photo':'https://example.invalid/qa.png','caption':'QA'}}
            ctx={'bot_id':'100','chat_id':'-300','generation':target.generation,'thread_id':None}
            saved=adapter.sessions
            def forbidden():pytest.fail('provider send opens DB session')
            adapter.sessions=forbidden
            try:
                with pytest.raises(HTTPException):await listener.send(target,[{**packet,'parameters':{**packet['parameters'],'chat_id':'-301'}}],ctx)
                binding=listener.targets[target.id];listener.targets[target.id]=replace(binding,can_send_photos=False)
                with pytest.raises(HTTPException):await listener.send(target,[packet],ctx)
                listener.targets[target.id]=binding
                assert await listener.send(target,[packet],ctx)==['-300:1']
                original=h.call
                h.call=lambda *a,**k:{'message_id':2,'chat':{'id':-301}}
                with pytest.raises(RuntimeError,match='RECEIPT_UNCONFIRMED'):await listener.send(target,[packet],ctx)
                h.call=original
            finally:adapter.sessions=saved
        finally:await worker.stop()
    asyncio.run(run())

def test_general_bot_other_chat_filtered_and_topic_room_separate(telegram):
    from app.models import ChannelConnectionDelivery,ChannelMessage
    db,row,factory,adapter,worker,h=telegram
    async def run():
        try:
            await worker.tick()
            for body in [message(addressed=False),message(2,chat=-301),message(3,actor=100),message(4)]:
                if body['update_id']==4:body['message']['from']['is_bot']=True
                await delivered(worker,h,body);await worker.tick()
            assert not h.posts
            for i,thread in [(5,10),(6,11)]:
                await delivered(worker,h,message(i,thread=thread));await worker.tick()
            db.expire_all();rows=db.query(ChannelConnectionDelivery).filter_by(status='sent').all()
            assert len(rows)==2 and rows[0].room_id!=rows[1].room_id
            assert {x[1]['message_thread_id'] for x in h.posts}=={10,11}
        finally:await worker.stop()
    asyncio.run(run())

def test_send_timeout_unknown_no_retry(telegram):
    from app.models import ChannelConnectionDelivery,ChannelMessage
    db,row,factory,adapter,worker,h=telegram;h.fail=True
    async def run():
        try:
            await worker.tick();await delivered(worker,h,message());await worker.tick()
            for _ in range(3):await worker.tick()
            db.expire_all();assert db.query(ChannelConnectionDelivery).one().status=='unknown'
            assert db.query(ChannelMessage).count()==2 and len(h.posts)==1
        finally:await worker.stop()
    asyncio.run(run())

def test_receive_failure_does_not_advance_offset(telegram):
    db,row,factory,adapter,worker,h=telegram
    async def run():
        try:
            await worker.tick();listener=next(iter(worker.handles.values())).listener
            async def reject(cid,event):raise RuntimeError('synthetic commit failure')
            with pytest.raises(RuntimeError):await listener.handle(message(99),reject)
            assert listener.offset==listener.gate.load_cursor()['offset']==0
        finally:await worker.stop()
    asyncio.run(run())

def test_main_registry_disabled_worker_has_zero_db_and_http(monkeypatch):
    from app.main import connection_supervisor
    from app.services.channel_connection_supervisor import ADAPTERS,ConnectionSupervisor
    from app.services.channel_connection_telegram import TelegramAdapter
    assert isinstance(ADAPTERS['telegram'],TelegramAdapter)
    assert ADAPTERS['telegram'].owner==connection_supervisor.owner
    def forbidden(*a,**k):pytest.fail('disabled touched resource')
    adapter=TelegramAdapter(forbidden,owner='synthetic',http=SimpleNamespace(call=forbidden))
    worker=ConnectionSupervisor(forbidden,config=SimpleNamespace(channel_connection_worker_enabled=False,channel_connection_encryption_key='',channel_connection_key_version='v1'),adapters={'telegram':adapter})
    asyncio.run(worker.start());assert worker.task is None

@pytest.mark.parametrize('unknown',[False,True])
def test_superseded_callback_new_owner_proof_precedes_old_card_cutoff_and_keeps_unknown_block(telegram,monkeypatch,unknown):
    from app.models import ChannelConnection,ChannelConnectionDelivery,ChannelMessage
    from app.services.channel_connection_telegram import TelegramAdapter
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    db,row,factory,adapter,worker,h=telegram;other=add_target(telegram)
    async def run():
        fresh=None
        try:
            source=await button_source(telegram);source_delivery=db.query(ChannelConnectionDelivery).one().id
            handle=next(iter(worker.handles.values()))
            handle.task.cancel();await asyncio.gather(handle.task,return_exceptions=True)
            listener=handle.listener;advance=listener.gate.advance
            def raced(*a,**k):
                with factory() as session:session.get(ChannelConnection,row.id).generation+=1;session.commit()
                return advance(*a,**k)
            monkeypatch.setattr(listener.gate,'advance',raced);h.fail_ack=unknown
            body=action(2,'cga:'+str(source.id)+':0',1)
            async def receive(cid,event):return await worker.runtime.receive(cid,handle.lease_id,worker.owner,handle.fence,event)
            with pytest.raises(HTTPException,match='CONNECTION_CHANGED'):await listener.handle(body,receive)
            db.expire_all();old=next(x for x in db.query(ChannelConnectionDelivery) if x.id!=source_delivery)
            old_id=old.id;old_hash=old.request_hash;count=db.query(ChannelMessage).count()
            assert count==2 and len(h.acks)==1 and len(h.posts)==1
            await worker.stop();h.pending.clear();h.queue.put(body);h.fail_ack=False
            current=TelegramAdapter(factory,owner='fresh',http=h);fresh=ConnectionSupervisor(factory,config=worker.config,adapters={'telegram':current});current.owner=fresh.owner
            await fresh.tick();await delivered(fresh,h,body);await fresh.tick()
            db.expire_all();old=db.get(ChannelConnectionDelivery,old_id)
            assert old.status==('unknown' if unknown else 'cancelled') and old.request_hash==old_hash
            assert db.query(ChannelMessage).count()==count and len(h.acks)==1 and len(h.posts)==1
            await delivered(fresh,h,message(3,chat=-301));await fresh.tick()
            db.expire_all();assert db.query(ChannelConnectionDelivery).filter_by(connection_id=other.id).one().status=='sent'
            assert db.query(ChannelMessage).count()==count+2 and len(h.posts)==2 and len(h.acks)==1
            if unknown:
                await delivered(fresh,h,message(4));await fresh.tick();db.expire_all()
                assert db.query(ChannelConnectionDelivery).filter_by(connection_id=row.id,generation=2).one().status=='received'
                assert db.query(ChannelMessage).count()==count+2 and len(h.posts)==2 and len(h.acks)==1
        finally:
            await worker.stop()
            if fresh:await fresh.stop()
    asyncio.run(run())

@pytest.mark.parametrize('kind',['photo','selection'])
def test_deferred_definitely_invalid_packet_is_isolated_after_target_verification(telegram,kind):
    from app.models import ChannelConnectionDelivery
    from app.services.channel_connection_runtime import ConnectionTarget
    from app.services.channel_connection_telegram_polling import PollBatch
    db,row,factory,adapter,worker,h=telegram;other=add_target(telegram)
    async def run():
        try:
            await worker.tick();handle=next(iter(worker.handles.values()));handle.task.cancel();await asyncio.gather(handle.task,return_exceptions=True)
            listener=handle.listener;binding=listener.targets.pop(other.id);listener.pending_targets=[binding.target]
            cursor=listener.gate.poll_cursor();batch=PollBatch([],dict(listener.targets),listener.digest,cursor)
            body=message(2,chat=-301)
            if kind=='photo':body['message'].pop('text');body['message']['photo']=[{}]
            else:
                body=action(2,'cga:'+str(uuid4())+':0',1);body['callback_query']['message']['chat']['id']=-301
            async def receive(cid,event):return await worker.runtime.receive(cid,handle.lease_id,worker.owner,handle.fence,event)
            await listener.handle(body,receive,batch=batch);assert listener.offset==0
            await listener.update([b.target for b in [*listener.targets.values(),binding]])
            await listener._drain(receive)
            assert listener.offset==3 and listener.gate.load_cursor()['offset']==3 and not listener.deferred
            db.expire_all();assert db.query(ChannelConnectionDelivery).count()==0 and not h.posts and not h.acks
        finally:await worker.stop()
    asyncio.run(run())

def test_callback_offset_failure_new_adapter_preserves_first_deadline_and_single_ack(telegram,monkeypatch):
    from app.models import ChannelConnectionDelivery,ChannelMessage
    from app.services.channel_connection_telegram import TelegramAdapter
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    db,row,factory,adapter,worker,h=telegram
    async def run():
        fresh=None
        try:
            source=await button_source(telegram);handle=next(iter(worker.handles.values()));listener=handle.listener
            body=action(2,'cga:'+str(source.id)+':0',1)
            async def receive(cid,event):return await worker.runtime.receive(cid,handle.lease_id,worker.owner,handle.fence,event)
            advance=listener.gate.advance
            def fail(*a,**k):raise RuntimeError('synthetic callback cursor commit failure')
            monkeypatch.setattr(listener.gate,'advance',fail)
            with pytest.raises(RuntimeError):await listener.handle(body,receive)
            monkeypatch.setattr(listener.gate,'advance',advance)
            await worker.runtime.process_one(row.id,handle.lease_id,worker.owner,handle.fence,listener)
            assert len(h.acks)==1
            await worker.stop();h.pending.clear();h.queue.put(body)
            current=TelegramAdapter(factory,owner='fresh',http=h);fresh=ConnectionSupervisor(factory,config=worker.config,adapters={'telegram':current});current.owner=fresh.owner
            await fresh.tick();await delivered(fresh,h,body);await fresh.tick()
            db.expire_all();assert db.query(ChannelConnectionDelivery).count()==2
            assert all(x.status=='sent' for x in db.query(ChannelConnectionDelivery))
            assert len(h.acks)==1 and len(h.posts)==1 and db.query(ChannelMessage).count()==3
        finally:
            await worker.stop()
            if fresh:await fresh.stop()
    asyncio.run(run())

@pytest.mark.parametrize('failure',['bot','webhook','chat'])
def test_existing_b_proof_cannot_override_fresh_rest_failure(telegram,failure):
    from app.models import ChannelConnectionDelivery,ChannelMessage
    from app.services.channel_connection_telegram import TelegramAdapter
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    db,row,factory,adapter,worker,h=telegram;other=add_target(telegram)
    async def run():
        fresh=None
        try:
            await worker.tick();rotate_row(telegram,'synthetic-rotated');await worker.tick();await worker.stop();original=h.call
            def call(method,token,payload):
                if token=='synthetic-only':
                    if failure=='bot' and method=='getMe':return {'id':101,'is_bot':True,'username':'OtherBot'}
                    if failure=='webhook' and method=='getWebhookInfo':return {'url':'https://example.invalid/existing','pending_update_count':0}
                    if failure=='chat' and method=='getChat':raise __import__('app.services.channel_connection_telegram',fromlist=['TelegramApiRejected']).TelegramApiRejected(403)
                return original(method,token,payload)
            h.call=call;current=TelegramAdapter(factory,owner='fresh',http=h);fresh=ConnectionSupervisor(factory,config=worker.config,adapters={'telegram':current});current.owner=fresh.owner
            await fresh.tick();db.refresh(other);assert other.observed_state=='error'
            h.queue.put(message(2,chat=-301));await asyncio.sleep(.1);await fresh.tick()
            db.expire_all();assert db.query(ChannelConnectionDelivery).filter_by(connection_id=other.id).count()==0
            assert db.query(ChannelMessage).count()==0 and not h.posts and not h.acks
        finally:
            await worker.stop()
            if fresh:await fresh.stop()
    asyncio.run(run())

@pytest.mark.parametrize('code,delay',[(409,None),(429,17)])
def test_conflict_and_rate_limit_backoff_prevent_immediate_reopen(telegram,code,delay):
    from app.services.channel_connection_telegram import TelegramApiRejected
    from app.services.channel_connection_runtime import ConnectionTarget
    db,row,factory,adapter,worker,h=telegram
    async def run():
        try:
            await worker.tick();handle=next(iter(worker.handles.values()));handle.task.cancel();await asyncio.gather(handle.task,return_exceptions=True)
            target=ConnectionTarget.from_row(row);binding=adapter.binding(target);identity={'listener_scope':'telegram-bot:100'}
            def rejected(*args):raise TelegramApiRejected(code,delay)
            h.call=rejected;start=time.monotonic()
            with pytest.raises(TelegramApiRejected):await handle.listener.poll()
            assert adapter.not_before['100']>=start+(17 if delay else 5)
            with pytest.raises(HTTPException,match='POLL_BACKOFF'):await adapter.open([target],binding.credentials,identity)
            assert not h.posts and not h.acks
        finally:await worker.stop()
    asyncio.run(run())

def test_second_worker_same_bot_cannot_poll(telegram):
    from app.services.channel_connection_telegram import TelegramAdapter
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    db,row,factory,adapter,worker,h=telegram;other_http=NativeHttp()
    other=TelegramAdapter(factory,owner='other',http=other_http);second=ConnectionSupervisor(factory,config=worker.config,adapters={'telegram':other});other.owner=second.owner
    async def run():
        try:
            await worker.tick();await second.tick()
            assert worker.handles and not second.handles and not other_http.polls and not other_http.posts
        finally:await second.stop();await worker.stop()
    asyncio.run(run())

@pytest.mark.parametrize('change',['owner','fence'])
def test_late_poll_after_lease_loss_cannot_advance_ack_or_execute(telegram,change):
    from app.models import ChannelInstallationLease,ChannelConnectionDelivery,ChannelMessage
    db,row,factory,adapter,worker,h=telegram
    async def run():
        release=threading.Event();entered=threading.Event();task=None
        try:
            await worker.tick();handle=next(iter(worker.handles.values()));handle.task.cancel();await asyncio.gather(handle.task,return_exceptions=True)
            listener=handle.listener;original=h.call
            def call(method,token,payload):
                if method=='getUpdates':entered.set();assert release.wait(3);return [message()]
                return original(method,token,payload)
            h.call=call;task=asyncio.create_task(listener.poll());assert await asyncio.to_thread(entered.wait,2)
            with factory() as session:
                lease=session.get(ChannelInstallationLease,handle.lease_id)
                if change=='owner':lease.owner='another'
                else:lease.fence+=1
                session.commit()
            release.set()
            with pytest.raises(HTTPException,match='LEASE_LOST'):await task
            db.expire_all();assert db.query(ChannelConnectionDelivery).count()==db.query(ChannelMessage).count()==0
            assert not h.acks and not h.posts and listener.offset==0
        finally:
            release.set()
            if task:await asyncio.gather(task,return_exceptions=True)
            await worker.stop()
    asyncio.run(run())

def test_generation_changes_after_accept_cannot_commit_offset_or_execute(telegram,monkeypatch):
    from app.models import ChannelConnectionDelivery,ChannelMessage
    from app.services.channel_connection_telegram import TelegramAdapter
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    db,row,factory,adapter,worker,h=telegram
    async def run():
        fresh=None
        try:
            await worker.tick();handle=next(iter(worker.handles.values()));handle.task.cancel();await asyncio.gather(handle.task,return_exceptions=True)
            listener=handle.listener;advance=listener.gate.advance
            def raced(*a,**k):
                from app.models import ChannelConnection
                with factory() as session:session.get(ChannelConnection,row.id).generation+=1;session.commit()
                return advance(*a,**k)
            monkeypatch.setattr(listener.gate,'advance',raced)
            async def receive(cid,event):return await worker.runtime.receive(cid,handle.lease_id,worker.owner,handle.fence,event)
            old=message()
            with pytest.raises(HTTPException,match='CONNECTION_CHANGED'):await listener.handle(old,receive)
            db.expire_all();assert db.query(ChannelConnectionDelivery).count()==1
            assert db.query(ChannelMessage).count()==0 and not h.posts and not h.acks
            assert listener.offset==listener.gate.load_cursor()['offset']==0
            await worker.stop();h.pending.clear();h.queue.put(old)
            current=TelegramAdapter(factory,owner='fresh',http=h)
            fresh=ConnectionSupervisor(factory,config=worker.config,adapters={'telegram':current});current.owner=fresh.owner
            await fresh.tick();await delivered(fresh,h,old);await fresh.tick()
            db.expire_all();prior=db.query(ChannelConnectionDelivery).one()
            assert prior.generation==1 and prior.status=='cancelled' and not prior.execution_claim_id
            assert db.query(ChannelMessage).count()==0 and not h.posts and not h.acks
            await delivered(fresh,h,message(2));await fresh.tick()
            db.expire_all();assert db.query(ChannelConnectionDelivery).filter_by(generation=2).one().status=='sent'
            assert db.query(ChannelMessage).count()==2 and len(h.posts)==1 and not h.acks
            assert next(iter(fresh.handles.values())).listener.gate.load_cursor()['offset']==3
        finally:
            await worker.stop()
            if fresh:await fresh.stop()
    asyncio.run(run())

def test_poll_requires_at_least_one_current_active_allowed_target(telegram,monkeypatch):
    from app.services.channel_connections import disconnect_connection
    db,row,factory,adapter,worker,h=telegram
    async def run():
        original=adapter.open
        async def open_without_background_poll(*args):
            listener=await original(*args)
            # 이 검사는 poll preflight 소유다. 취소 전 executor GET을 새 poll로 세지 않는다.
            async def wait(receive):await asyncio.Event().wait()
            listener.listen=wait;return listener
        monkeypatch.setattr(adapter,'open',open_without_background_poll)
        try:
            await worker.tick();handle=next(iter(worker.handles.values()));handle.task.cancel();await asyncio.gather(handle.task,return_exceptions=True)
            count=len(h.polls);disconnect_connection(row);db.commit()
            with pytest.raises(HTTPException):await handle.listener.poll()
            assert len(h.polls)==count and not h.acks and not h.posts
        finally:await worker.stop()
    asyncio.run(run())

def test_late_poll_after_close_or_lease_loss_has_zero_effects(telegram,monkeypatch):
    from app.models import ChannelInstallationLease,ChannelConnectionDelivery,ChannelMessage
    db,row,factory,adapter,worker,h=telegram
    async def run():
        release=threading.Event();entered=threading.Event();task=None
        try:
            await worker.tick();handle=next(iter(worker.handles.values()));handle.task.cancel()
            await asyncio.gather(handle.task,return_exceptions=True)
            listener=handle.listener;original=h.call
            def call(method,token,payload):
                if method=='getUpdates':
                    entered.set();assert release.wait(3);return [message()]
                return original(method,token,payload)
            h.call=call;task=asyncio.create_task(listener.poll())
            assert await asyncio.to_thread(entered.wait,2)
            await listener.close();release.set()
            with pytest.raises(HTTPException):await task
            assert listener.poll_binding is None and not listener.targets
            with pytest.raises(HTTPException):await listener.poll()
            db.expire_all();assert db.query(ChannelConnectionDelivery).count()==db.query(ChannelMessage).count()==0
            assert not h.acks and not h.posts and listener.gate.load_cursor()['offset']==0
        finally:
            release.set()
            if task:await asyncio.gather(task,return_exceptions=True)
            await worker.stop()
    asyncio.run(run())

def test_callback_deadline_starts_at_response_receipt_not_long_poll_start(telegram):
    from datetime import datetime,timezone
    from app.services.channel_connection_telegram_polling import PollBatch
    db,row,factory,adapter,worker,h=telegram
    async def run():
        try:
            source=await button_source(telegram);handle=next(iter(worker.handles.values()));listener=handle.listener
            now=datetime.now(timezone.utc);cursor=listener.gate.poll_cursor()
            cursor.update(request_started_at=(now-timedelta(seconds=24)).isoformat(),received_at=now.isoformat())
            batch=PollBatch([],dict(listener.targets),listener.digest,cursor)
            async def receive(cid,event):return await worker.runtime.receive(cid,handle.lease_id,worker.owner,handle.fence,event)
            await listener.handle(action(2,'cga:'+str(source.id)+':0',1),receive,batch=batch)
            assert len(h.acks)==1
        finally:await worker.stop()
    asyncio.run(run())

def test_current_poll_token_survives_a_removal_without_fallback_to_b(telegram):
    from app.services.channel_connections import disconnect_connection
    db,row,factory,adapter,worker,h=telegram;other=add_target(telegram)
    async def run():
        try:
            await worker.tick();rotate_row(telegram,'synthetic-rotated');await worker.tick()
            with factory() as session:disconnect_connection(session.get(__import__('app.models',fromlist=['ChannelConnection']).ChannelConnection,row.id));session.commit()
            await worker.tick();listener=next(iter(worker.handles.values())).listener
            original=h.call;tokens=[]
            def call(method,token,payload):
                if method=='getUpdates':tokens.append(token)
                return original(method,token,payload)
            h.call=call
            await delivered(worker,h,message(2,chat=-301));await worker.tick()
            assert len(h.posts)==1 and tokens and set(tokens)=={'synthetic-rotated'}
        finally:await worker.stop()
    asyncio.run(run())

def test_rotation_publishes_digest_and_bindings_only_after_prepare(telegram,monkeypatch):
    from app.services.channel_connection_runtime import ConnectionTarget
    db,row,factory,adapter,worker,h=telegram
    async def run():
        release=threading.Event();entered=threading.Event();task=None
        try:
            await worker.tick();handle=next(iter(worker.handles.values()));handle.task.cancel()
            await asyncio.gather(handle.task,return_exceptions=True)
            listener=handle.listener;old_digest=listener.digest;old_bindings=dict(listener.targets)
            rotate_row(telegram,'synthetic-rotated');db.refresh(row);target=ConnectionTarget.from_row(row)
            await adapter.verify(target,{'bot_token':'synthetic-rotated'})
            def prepare(bindings):
                entered.set();assert release.wait(3);return 0
            monkeypatch.setattr(listener.gate,'prepare_targets',prepare)
            monkeypatch.setattr(listener.gate,'mark_ready',lambda bindings:None)
            task=asyncio.create_task(listener.update([target]))
            assert await asyncio.to_thread(entered.wait,2)
            assert listener.digest==old_digest and listener.targets==old_bindings
            release.set();await task
            assert listener.digest!=old_digest and listener.targets[row.id].target==target
        finally:
            release.set()
            if task:await asyncio.gather(task,return_exceptions=True)
            await worker.stop()
    asyncio.run(run())

def test_rotated_token_new_adapter_keeps_existing_b_provenance(telegram):
    from app.models import ChannelConnectionDelivery,ChannelMessage
    from app.services.channel_connection_telegram import TelegramAdapter
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    db,row,factory,adapter,worker,h=telegram;other=add_target(telegram)
    async def run():
        fresh=None
        try:
            await worker.tick();rotate_row(telegram,'synthetic-rotated');await worker.tick();await worker.stop()
            current=TelegramAdapter(factory,owner='fresh',http=h);fresh=ConnectionSupervisor(factory,config=worker.config,adapters={'telegram':current});current.owner=fresh.owner
            await fresh.tick();db.refresh(other);assert other.observed_state=='connected'
            await delivered(fresh,h,message(2,chat=-301));await fresh.tick()
            await delivered(fresh,h,message(2,chat=-301));await fresh.tick()
            db.expire_all();assert db.query(ChannelConnectionDelivery).filter_by(connection_id=other.id).one().status=='sent'
            assert db.query(ChannelMessage).count()==2 and len(h.posts)==1
            listener=next(iter(fresh.handles.values())).listener
            assert listener.digest==__import__('hashlib').sha256(b'synthetic-rotated').hexdigest()
        finally:
            await worker.stop()
            if fresh:await fresh.stop()
    asyncio.run(run())

@pytest.mark.parametrize('limit_kind',['count','bytes','scope'])
def test_pending_bound_preserves_offset_epoch_and_restart_deduplicates_a(telegram,limit_kind):
    from app.models import ChannelConnection,ChannelConnectionDelivery,ChannelMessage
    from app.services.channel_connection_runtime import ConnectionTarget
    from app.services.channel_connection_telegram import TelegramAdapter
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    from app.services.channel_connection_telegram_polling import PollBatch
    db,row,factory,adapter,worker,h=telegram;other=add_target(telegram)
    async def run():
        fresh=None
        try:
            await worker.tick();handle=next(iter(worker.handles.values()));listener=handle.listener
            # 검증 지연을 provider 수준에서 고정: known pending은 유지하되 미설정 chat은 아니다.
            expected=ConnectionTarget.from_row(other);listener.targets.pop(other.id)
            listener.pending_targets=[expected];before=listener.gate.load_cursor()
            cursor=listener.gate.poll_cursor();snapshot=PollBatch([],{row.id:listener.targets[row.id]},listener.digest,cursor)
            async def receive(cid,event):return await worker.runtime.receive(cid,handle.lease_id,worker.owner,handle.fence,event)
            await listener.handle(message(2,chat=-301),receive,batch=snapshot)
            await listener.handle(message(7),receive,batch=snapshot)
            await worker.runtime.process_one(row.id,handle.lease_id,worker.owner,handle.fence,listener)
            if limit_kind=='scope':
                with factory() as session:session.get(ChannelConnection,other.id).generation+=1;session.commit()
                with pytest.raises(HTTPException,match='PENDING_SCOPE_CHANGED'):await listener._drain(receive)
            else:
                for i in range(1,64 if limit_kind=='count' else 1):
                    body=message(10+i,chat=-301)
                    if limit_kind=='bytes':body['padding']='x'*17000
                    await listener.handle(body,receive,batch=snapshot)
                body=message(100,chat=-301)
                if limit_kind=='bytes':body['padding']='x'*1048576
                with pytest.raises(HTTPException,match='PENDING_LIMIT'):await listener.handle(body,receive,batch=snapshot)
            after=listener.gate.load_cursor()
            assert not listener.deferred and adapter.not_before['100']>time.monotonic()
            assert (after['offset'],after['epoch'])==(before['offset'],before['epoch'])
            await worker.stop();h.pending.clear();h.queue.put(message(7))
            current=TelegramAdapter(factory,owner='fresh',http=h);fresh=ConnectionSupervisor(factory,config=worker.config,adapters={'telegram':current});current.owner=fresh.owner
            await fresh.tick();await delivered(fresh,h,message(7));await fresh.tick()
            db.expire_all();assert db.query(ChannelConnectionDelivery).filter_by(connection_id=row.id).count()==1
            assert db.query(ChannelMessage).count()==2 and len(h.posts)==1
        finally:
            await worker.stop()
            if fresh:await fresh.stop()
    asyncio.run(run())

def test_db_generation_change_before_accept_inserts_zero(telegram,monkeypatch):
    from app.models import ChannelConnectionDelivery,ChannelMessage
    db,row,factory,adapter,worker,h=telegram
    async def run():
        release=asyncio.Event();entered=asyncio.Event();finished=asyncio.Event();original=worker.runtime.receive
        async def blocked(*args):
            entered.set();await release.wait()
            try:return await original(*args)
            finally:finished.set()
        monkeypatch.setattr(worker.runtime,'receive',blocked)
        try:
            await worker.tick();h.queue.put(message());await asyncio.wait_for(entered.wait(),2)
            rotate_row(telegram);await worker.tick();h.pending.clear();release.set();await asyncio.wait_for(finished.wait(),2)
            db.expire_all();assert db.query(ChannelConnectionDelivery).count()==db.query(ChannelMessage).count()==0
            assert not h.posts and not h.acks and next(iter(worker.handles.values())).listener.gate.load_cursor()['offset']==0
        finally:release.set();await worker.stop()
    asyncio.run(run())

async def button_source(t):
    from app.models import ChannelMessage
    db,row,factory,adapter,worker,h=t
    await worker.tick();await delivered(worker,h,message());await worker.tick();db.expire_all()
    source=db.query(ChannelMessage).filter_by(participant_kind='bot').one()
    source.message_type='button';source.payload_json={'sourceTalkNodeId':'qa-intent','options':['question']};db.commit()
    return source

@pytest.mark.parametrize('unknown',[False,True])
def test_callback_old_card_date_commits_before_ack_and_redelivery_once(telegram,unknown):
    from app.models import ChannelMessage,ChannelConnectionDelivery
    db,row,factory,adapter,worker,h=telegram
    async def run():
        try:
            source=await button_source(telegram);count=db.query(ChannelMessage).count();original=h.call
            original_delivery=db.query(ChannelConnectionDelivery).one().id
            def call(method,token,payload):
                if method=='answerCallbackQuery':
                    with factory() as session:
                        item=session.query(ChannelConnectionDelivery).filter_by(status='received').one()
                        ctx=next(iter(worker.handles.values())).listener.gate.context(item)
                        assert ctx['telegram_ack']['status']=='sending'
                        assert session.query(ChannelMessage).count()==count
                return original(method,token,payload)
            h.call=call;h.fail_ack=unknown
            body=action(2,'cga:'+str(source.id)+':0',1)
            await delivered(worker,h,body);await worker.tick()
            await delivered(worker,h,body);await worker.tick()
            db.expire_all();items=db.query(ChannelConnectionDelivery).all();item=next(x for x in items if x.id!=original_delivery)
            assert len(items)==2 and len(h.acks)==1 and len(h.posts)==1
            assert item.status==('unknown' if unknown else 'sent')
            ctx=next(iter(worker.handles.values())).listener.gate.context(item)
            assert 'callback_id' not in (ctx.get('event') or ctx)
            assert db.query(ChannelMessage).count()==count+(0 if unknown else 1)
        finally:await worker.stop()
    asyncio.run(run())

@pytest.mark.parametrize('change',['other_room','other_org','user','source','index','generation','old_card'])
def test_selection_source_scope_and_generation_rejected(telegram,change):
    from app.models import ChannelMessage,Bot
    from app.services.channel_connection_runtime import ConnectionTarget
    from app.services.channel_connection_bridge import convert_packet
    db,row,factory,adapter,worker,h=telegram
    async def run():
        try:
            source=await button_source(telegram);listener=next(iter(worker.handles.values())).listener
            target=ConnectionTarget.from_row(row)
            event=convert_packet('telegram','normalize',{'input':action(2,'cga:'+str(source.id)+':0',1),'connection':{'botUserId':'100','botUsername':'CgaQaBot','chatId':'-300','chatType':'supergroup'}})
            if change=='other_room':event['nativeRoomKey']='telegram:["100","supergroup","-301",null]'
            if change=='other_org':db.get(Bot,row.bot_id).organization_id=uuid4()
            if change=='user':source.participant_kind='user'
            if change=='source':event['sourceMessageId']=str(uuid4())
            if change=='index':event['choiceIndex']=25
            if change=='generation':row.generation+=1
            if change=='old_card':source.created_at=row.accept_after-timedelta(seconds=1)
            db.commit()
            with pytest.raises(HTTPException):await asyncio.to_thread(listener.gate.restore_selection,target,event)
            assert not h.acks and len(h.posts)==1
        finally:await worker.stop()
    asyncio.run(run())

def add_target(t):
    from app.models import ChannelConnection
    from app.services.channel_connections import encrypt_credentials
    db,row,factory,adapter,worker,h=t
    other=ChannelConnection(organization_id=row.organization_id,bot_id=row.bot_id,channel_id=row.channel_id,name='QA2',provider='telegram',installation_id='100',account_id='100',target_id='-301',desired_state='connected',observed_state='connecting')
    db.add(other);db.flush();other.credential_ciphertext=encrypt_credentials({'bot_token':'synthetic-only'},other.organization_id,other.id,KEY,'v1');other.credential_key_version='v1';db.commit();return other

def test_new_adapter_second_target_verify_barrier_never_commits_past_unaccepted(telegram):
    from app.models import ChannelConnectionDelivery
    from app.services.channel_connection_telegram import TelegramAdapter
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    db,row,factory,adapter,worker,h=telegram;other=add_target(telegram)
    async def run():
        fresh=None;task=None;release=asyncio.Event()
        try:
            await worker.tick();await worker.stop()
            h.queue.put(message(2,chat=-301))
            current=TelegramAdapter(factory,owner='fresh',http=h)
            fresh=ConnectionSupervisor(factory,config=worker.config,adapters={'telegram':current});current.owner=fresh.owner
            entered=asyncio.Event();verify=current.verify
            async def blocked(target,credentials):
                if target.id==other.id:entered.set();await release.wait()
                return await verify(target,credentials)
            current.verify=blocked;task=asyncio.create_task(fresh.tick());await asyncio.wait_for(entered.wait(),3);await asyncio.sleep(.15)
            listener=next(iter(fresh.handles.values())).listener
            assert listener.offset<3 and listener.gate.load_cursor()['offset']<3
            db.expire_all();assert db.query(ChannelConnectionDelivery).filter_by(connection_id=other.id).count()==0
            h.queue.put(message(7))
            for _ in range(200):
                db.expire_all()
                if db.query(ChannelConnectionDelivery).filter_by(connection_id=row.id).count():break
                await asyncio.sleep(.01)
            assert db.query(ChannelConnectionDelivery).filter_by(connection_id=row.id).count()==1
            assert listener.gate.load_cursor()['offset']<3
            release.set();await task
            for _ in range(200):
                if listener.offset>=8:break
                if next(iter(fresh.handles.values())).task.done():await next(iter(fresh.handles.values())).task
                await asyncio.sleep(.01)
            await fresh.tick();db.expire_all()
            assert listener.offset==8 and db.query(ChannelConnectionDelivery).filter_by(connection_id=other.id).one().status=='sent'
            assert len(h.posts)==2
        finally:
            release.set()
            if task:await task
            await worker.stop()
            if fresh:await fresh.stop()
    asyncio.run(run())
