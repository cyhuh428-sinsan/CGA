"""합성 Gateway→실제 SQLite/native 고정Q&A/Node→HTTP double."""
import asyncio,json,time
from datetime import timedelta
from types import SimpleNamespace
from dataclasses import replace
import pytest
from test_channel_connection_state import state_db,KEY
from test_channel_connection_runtime import seed_native,native_orm_bindings
from test_channel_connection_discord import Http
from test_channel_connection_discord_gateway import Ws,Socket,hello,ready


def snowflake(offset=0):return str(((int(time.time()*1000)+100-1420070400000)<<22)+offset)
def message(channel='400',actor='500',*,offset=0,addressed=True):
    return {'op':0,'t':'MESSAGE_CREATE','s':2+offset,'d':{'id':snowflake(offset),'channel_id':channel,'guild_id':'300','author':{'id':actor},'content':('<@200> ' if addressed else '')+'question','mentions':[{'id':'200'}] if addressed else []}}


class NativeHttp(Http):
    def __init__(self):super().__init__();self.posts=[];self.acks=[];self.fail=False;self.fail_ack=False
    def call(self,method,path,token,payload=None):
        if path=='/gateway/bot':return {'url':'wss://gateway.discord.gg','shards':1,'session_start_limit':{'remaining':10}}
        if method=='GET' and path.startswith('/channels/'):
            return self.responses.get(path,{'id':path.split('/')[2],'guild_id':'300','type':0,'permission_overwrites':[]})
        if method=='POST':
            self.posts.append((path,payload))
            if self.fail:raise TimeoutError('synthetic uncertain send')
            return {'id':'700','channel_id':path.split('/')[2]}
        return super().call(method,path,token,payload)
    def ack(self,iid,token):
        self.acks.append(iid)
        if self.fail_ack:raise TimeoutError('synthetic uncertain ACK')


@pytest.fixture
def discord(state_db,monkeypatch):
    from app.core.config import settings
    from app.services.channel_connections import encrypt_credentials
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    from app.services.channel_connection_discord import DiscordAdapter
    from app.models import AdminChannel
    s,db,row,lease,factory,runtime=seed_native(state_db)
    lease.lease_expires_at=s.clock(db)-timedelta(seconds=1)
    row.provider='discord';row.installation_id,row.account_id,row.target_id='300','200','400'
    db.get(AdminChannel,row.channel_id).code='DISCORD'
    row.credential_ciphertext=encrypt_credentials({'bot_token':'synthetic-only'},row.organization_id,row.id,KEY,'v1')
    row.credential_key_version='v1';db.commit()
    monkeypatch.setattr(settings,'channel_connection_encryption_key',KEY)
    config=SimpleNamespace(channel_connection_worker_enabled=True,channel_connection_encryption_key=KEY,channel_connection_key_version='v1')
    h=NativeHttp();ws=Ws([hello(),ready()]);adapter=DiscordAdapter(factory,owner='synthetic',http=h,socket=Socket(ws))
    worker=ConnectionSupervisor(factory,config=config,adapters={'discord':adapter});adapter.owner=worker.owner
    return db,row,factory,adapter,worker,h,ws


async def delivered(worker,ws,body):
    await ws.queue.put(json.dumps(body))
    for _ in range(200):
        handle=next(iter(worker.handles.values()))
        if handle.task.done():await handle.task
        if handle.listener.cursor.get('sequence',0)>=body['s']:return
        await asyncio.sleep(.01)
    raise AssertionError('durable Discord sequence missing')


def test_gateway_to_native_fixed_qa_and_duplicate_once(discord):
    from app.models import ChannelConnectionDelivery,ChannelMessage,ChannelQueueEvent
    db,row,factory,adapter,worker,h,ws=discord
    async def run():
        try:
            await worker.tick();body=message();await delivered(worker,ws,body)
            handle=next(iter(worker.handles.values()))
            await worker.runtime.process_one(row.id,handle.lease_id,worker.owner,handle.fence,handle.listener)
            body['s']=3;await delivered(worker,ws,body);await worker.tick()
            db.expire_all();item=db.query(ChannelConnectionDelivery).one()
            assert item.status=='sent' and item.room_id and item.queue_event_id and item.event_json=={}
            assert db.query(ChannelMessage).count()==2 and db.query(ChannelQueueEvent).one().status=='completed'
            assert len(h.posts)==1 and h.posts[0][1]['content']=='fixed QA answer'
        finally:await worker.stop()
    asyncio.run(run())


def test_unknown_send_never_retries_after_next_tick(discord):
    from app.models import ChannelConnectionDelivery,ChannelMessage
    db,row,factory,adapter,worker,h,ws=discord;h.fail=True
    async def run():
        try:
            await worker.tick();await delivered(worker,ws,message());await worker.tick();await worker.tick()
            db.expire_all();assert db.query(ChannelConnectionDelivery).one().status=='unknown'
            assert len(h.posts)==1 and db.query(ChannelMessage).count()==2
        finally:await worker.stop()
    asyncio.run(run())


def test_general_chat_bot_and_off_target_do_not_execute(discord):
    from app.models import ChannelConnectionDelivery,ChannelMessage
    db,row,factory,adapter,worker,h,ws=discord
    async def run():
        try:
            await worker.tick()
            for body in [message(addressed=False),message(actor='200',offset=1),message(channel='401',offset=2),message(actor='501',offset=3)]:
                if body['d']['author']['id'] in {'200','501'}:body['d']['author']['bot']=True
                await delivered(worker,ws,body);await worker.tick()
            assert not h.posts
            db.expire_all();assert db.query(ChannelMessage).count()==0
            assert all(x.status=='cancelled' for x in db.query(ChannelConnectionDelivery))
        finally:await worker.stop()
    asyncio.run(run())


def test_main_registry_and_disabled_discord_open_zero(monkeypatch):
    from app.main import connection_supervisor
    from app.services.channel_connection_supervisor import ADAPTERS,ConnectionSupervisor
    from app.services.channel_connection_discord import DiscordAdapter
    assert isinstance(ADAPTERS['discord'],DiscordAdapter)
    assert ADAPTERS['discord'].owner==connection_supervisor.owner
    def forbidden(*args,**kwargs):pytest.fail('disabled worker touched external or DB')
    adapter=DiscordAdapter(forbidden,owner='test',http=SimpleNamespace(call=forbidden),socket=SimpleNamespace(open=forbidden))
    worker=ConnectionSupervisor(forbidden,config=SimpleNamespace(channel_connection_worker_enabled=False,channel_connection_encryption_key='',channel_connection_key_version='v1'),adapters={'discord':adapter})
    asyncio.run(worker.start());assert worker.task is None


@pytest.fixture
def discord_management(discord,monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.deps import get_current_user,get_db
    from app.api.routes.channel_connections import router
    from app.core.config import settings
    from app.models import Bot,User,Role,UserRole,ChannelConnection
    from app.services.channel_connection_supervisor import ADAPTERS
    from app.services.channel_connections import encrypt_credentials
    db,row,factory,adapter,worker,h,ws=discord
    user=User(organization_id=row.organization_id,group_id=db.get(Bot,row.bot_id).group_id,name='QA',login_id='discord-management',password_hash='synthetic',status='active')
    role=Role(code='system_manager',name='QA');db.add_all([user,role]);db.flush();db.add(UserRole(user_id=user.id,role_id=role.id))
    other=ChannelConnection(organization_id=row.organization_id,bot_id=row.bot_id,channel_id=row.channel_id,name='QA2',provider='discord',installation_id='300',account_id='200',target_id='401',desired_state='connected',observed_state='connecting')
    db.add(other);db.flush();other.credential_ciphertext=encrypt_credentials({'bot_token':'synthetic-only'},other.organization_id,other.id,KEY,'v1');other.credential_key_version='v1';db.commit()
    app=FastAPI();app.include_router(router,prefix='/api/v1')
    def session():
        with factory() as current:yield current
    app.dependency_overrides[get_db]=session;app.dependency_overrides[get_current_user]=lambda:user
    monkeypatch.setattr(settings,'channel_connection_worker_enabled',True);monkeypatch.setitem(ADAPTERS,'discord',adapter)
    with TestClient(app) as client:yield client,f'/api/v1/admin/channels/{row.channel_id}/connections/{row.id}',other


def rotate(client,url,row,token):
    assert client.post(url+'/disconnect').status_code==200
    response=client.patch(url,json=dict(name='Rotated',bot_id=str(row.bot_id),installation_id=row.installation_id,account_id=row.account_id,target_id=row.target_id,credentials={'bot_token':token}))
    assert response.status_code==200,response.text
    connected=client.post(url+'/connect');assert connected.status_code==200,connected.text
    return connected.json()['data']['generation']


@pytest.mark.parametrize('token_changed',[True,False])
def test_management_rotation_recovers_without_event_preserves_other_target(discord,discord_management,token_changed):
    db,row,factory,adapter,worker,h,old=discord;client,url,other=discord_management
    fresh=Ws([hello(),ready(session_id='rotated-session')])
    async def run():
        try:
            await worker.tick();handle=next(iter(worker.handles.values()));original_task=handle.task
            generation=rotate(client,url,row,'synthetic-rotated' if token_changed else 'synthetic-only')
            adapter.socket=Socket(fresh);await worker.tick();db.refresh(row);db.refresh(other)
            assert row.observed_state==other.observed_state=='connected' and row.generation==generation
            assert handle.task is original_task and not original_task.done() and len(handle.targets)==2
            active=fresh if token_changed else old
            if token_changed:assert old.closed and handle.listener.ws is fresh
            await delivered(worker,active,message());await worker.tick()
            await delivered(worker,active,message(channel='401',offset=1));await worker.tick()
            assert [x[0] for x in h.posts]==['/channels/400/messages','/channels/401/messages']
        finally:await worker.stop()
    asyncio.run(run())


@pytest.mark.parametrize('token_changed',[True,False])
def test_pre_rotation_frame_scheduled_after_update_is_not_inserted(discord,discord_management,monkeypatch,token_changed):
    from app.models import ChannelConnectionDelivery,ChannelMessage
    db,row,factory,adapter,worker,h,old=discord;client,url,other=discord_management;fresh=Ws([hello(),ready()])
    async def run():
        paused,release,finished=asyncio.Event(),asyncio.Event(),asyncio.Event()
        try:
            await worker.tick();listener=next(iter(worker.handles.values())).listener;original=listener.handle
            async def scheduled(frame,receive,**source):
                paused.set();await release.wait()
                try:return await original(frame,receive,**source)
                finally:finished.set()
            monkeypatch.setattr(listener,'handle',scheduled)
            await old.queue.put(json.dumps(message()));await asyncio.wait_for(paused.wait(),1)
            rotate(client,url,row,'synthetic-rotated' if token_changed else 'synthetic-only')
            adapter.socket=Socket(fresh);await worker.tick();release.set();await asyncio.wait_for(finished.wait(),1)
            db.expire_all();assert db.query(ChannelConnectionDelivery).count()==db.query(ChannelMessage).count()==0 and not h.posts and not h.acks
            assert not next(iter(worker.handles.values())).task.done()
        finally:release.set();await worker.stop()
    asyncio.run(run())


async def button_source(discord):
    from app.models import ChannelMessage
    db,row,factory,adapter,worker,h,ws=discord
    await worker.tick();await delivered(worker,ws,message());await worker.tick();db.expire_all()
    source=db.query(ChannelMessage).filter_by(participant_kind='bot').one()
    source.message_type='button';source.payload_json={'sourceTalkNodeId':'qa-intent','options':['question']};db.commit()
    return source


def interaction(source,seq=3):
    return {'op':0,'s':seq,'t':'INTERACTION_CREATE','d':{'id':snowflake(10),'application_id':'100','type':3,'guild_id':'300','channel_id':'400','member':{'user':{'id':'500'}},'message':{'author':{'id':'200'}},'token':'synthetic-callback','data':{'component_type':2,'custom_id':'cga:'+str(source.id)+':0'}}}


@pytest.mark.parametrize('unknown',[True,False])
def test_interaction_commits_before_single_ack_then_executes_only_confirmed(discord,unknown):
    from app.models import ChannelConnectionDelivery,ChannelMessage
    from app.services.channel_connections import decrypt_event_context
    db,row,factory,adapter,worker,h,ws=discord
    async def run():
        try:
            source=await button_source(discord)
            old_count=db.query(ChannelMessage).count();original=h.ack
            def ack(iid,token):
                with factory() as session:
                    pending=session.query(ChannelConnectionDelivery).filter_by(status='received').one()
                    ctx=decrypt_event_context(pending.context_ciphertext,pending.organization_id,pending.id,KEY,'v1')
                    assert ctx['discord_ack']['status']=='sending' and session.query(ChannelMessage).count()==old_count
                return original(iid,token)
            h.ack=ack;h.fail_ack=unknown;body=interaction(source)
            await delivered(worker,ws,body);await worker.tick()
            body['s']=4;await delivered(worker,ws,body);await worker.tick()
            assert len(h.acks)==1
            db.expire_all();items=db.query(ChannelConnectionDelivery).all()
            item=next(x for x in items if x.id!=min(items,key=lambda x:x.created_at).id)
            assert len(items)==2 and item.status==('unknown' if unknown else 'sent')
            ctx=decrypt_event_context(item.context_ciphertext,item.organization_id,item.id,KEY,'v1')
            assert 'callback_token' not in (ctx.get('event') or ctx)
            # 이 fixture는 고정 Q&A이며 구조화 선택 후 추가 Talk 출력은 없다.
            assert len(h.posts)==1 and db.query(ChannelMessage).count()==old_count+(0 if unknown else 1)
        finally:await worker.stop()
    asyncio.run(run())


@pytest.mark.parametrize('new_generation',[False,True])
def test_valid_resume_restores_only_established_same_generation_cutoff(discord,discord_management,new_generation):
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    from app.models import ChannelConnectionDelivery
    db,row,factory,adapter,worker,h,ws=discord;client,url,other=discord_management
    async def run():
        restarted=None
        try:
            await worker.tick();await delivered(worker,ws,message());await worker.tick();db.refresh(row)
            prior=row.accept_after
            replay=message(offset=1);replay['d']['id']=str((int(time.time()*1000)-1420070400000)<<22)
            await worker.stop()
            if new_generation:rotate(client,url,row,'synthetic-only')
            fresh=Ws([hello(),replay,{'op':0,'t':'RESUMED','s':4,'d':{}}]);adapter.socket=Socket(fresh);adapter.open_not_before.clear()
            restarted=ConnectionSupervisor(factory,config=worker.config,adapters={'discord':adapter});adapter.owner=restarted.owner
            await restarted.tick()
            for _ in range(200):
                handle=next(iter(restarted.handles.values()))
                if handle.task.done():await handle.task
                if handle.listener.cursor.get('sequence',0)>=4:break
                await asyncio.sleep(.01)
            await restarted.tick();db.refresh(row)
            assert fresh.sent[0]['op']==6
            assert (row.accept_after>prior) if new_generation else (row.accept_after==prior)
            db.expire_all()
            statuses=[(x.status,x.last_error_code) for x in db.query(ChannelConnectionDelivery)]
            assert len(h.posts)==(1 if new_generation else 2),statuses
        finally:
            await worker.stop()
            if restarted:await restarted.stop()
    asyncio.run(run())


@pytest.mark.parametrize('change',['other_room','other_org','user','source','index','generation'])
def test_selection_restore_rejects_out_of_scope_sources(discord,change):
    from app.models import ChannelMessage,Bot
    from app.services.channel_connection_runtime import ConnectionTarget
    from fastapi import HTTPException
    db,row,factory,adapter,worker,h,ws=discord
    async def run():
        try:
            source=await button_source(discord)
            listener=next(iter(worker.handles.values())).listener
            target=ConnectionTarget.from_row(row)
            event={'nativeRoomKey':'discord:["300","400"]','channelId':'400','sourceMessageId':str(source.id),'choiceIndex':0}
            if change=='other_room':event['nativeRoomKey']='discord:["300","401"]'
            if change=='other_org':db.get(Bot,row.bot_id).organization_id=__import__('uuid').uuid4()
            if change=='user':source.participant_kind='user'
            if change=='source':event['sourceMessageId']=str(__import__('uuid').uuid4())
            if change=='index':event['choiceIndex']=25
            if change=='generation':row.generation+=1
            db.commit()
            with pytest.raises(HTTPException):await asyncio.to_thread(listener.gate.restore_selection,target,event)
            assert not h.acks and len(h.posts)==1
        finally:await worker.stop()
    asyncio.run(run())


def test_new_adapter_resume_does_not_checkpoint_unverified_second_target_replay(discord,discord_management):
    from app.models import ChannelConnectionDelivery
    from app.services.channel_connection_discord import DiscordAdapter
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    db,row,factory,adapter,worker,h,ws=discord;client,url,other=discord_management
    async def run():
        restarted=None;release=asyncio.Event();pending_tick=None
        try:
            await worker.tick();await delivered(worker,ws,message());await worker.tick();await worker.stop()
            replay=message(channel='401',offset=1)
            fresh=Ws([hello(),replay,{'op':0,'t':'RESUMED','s':4,'d':{}}])
            fresh_adapter=DiscordAdapter(factory,owner='restart',http=h,socket=Socket(fresh))
            restarted=ConnectionSupervisor(factory,config=worker.config,adapters={'discord':fresh_adapter});fresh_adapter.owner=restarted.owner
            entered=asyncio.Event();original=fresh_adapter.verify
            async def blocked(target,credentials):
                if target.id==other.id:entered.set();await release.wait()
                return await original(target,credentials)
            fresh_adapter.verify=blocked;pending_tick=asyncio.create_task(restarted.tick())
            await asyncio.wait_for(entered.wait(),2)
            await asyncio.sleep(.1)
            listener=next(iter(restarted.handles.values())).listener
            assert listener.cursor['sequence']<3
            db.expire_all();assert db.query(ChannelConnectionDelivery).filter_by(connection_id=other.id).count()==0
            # 두번째target 미검증이어도 첫target 정상 이벤트의 원장접수는 계속한다.
            await fresh.queue.put(json.dumps(message(offset=3)))
            for _ in range(100):
                db.expire_all()
                if db.query(ChannelConnectionDelivery).filter_by(connection_id=row.id).count()==2:break
                await asyncio.sleep(.01)
            assert db.query(ChannelConnectionDelivery).filter_by(connection_id=row.id).count()==2
            assert listener.cursor['sequence']<3
            release.set();await pending_tick
            for _ in range(100):
                if listener.cursor['sequence']>=5:break
                await asyncio.sleep(.01)
            await restarted.tick();db.expire_all()
            assert db.query(ChannelConnectionDelivery).filter_by(connection_id=other.id).one().status=='sent'
            assert listener.cursor['sequence']==5
        finally:
            release.set()
            if pending_tick:await pending_tick
            await worker.stop()
            if restarted:await restarted.stop()
    asyncio.run(run())


def test_generation_rotation_between_provider_guard_and_database_accept_inserts_zero(discord,discord_management,monkeypatch):
    from app.models import ChannelConnectionDelivery,ChannelMessage
    db,row,factory,adapter,worker,h,ws=discord;client,url,other=discord_management
    async def run():
        entered,release,finished=asyncio.Event(),asyncio.Event(),asyncio.Event();original=worker.runtime.receive
        async def blocked(*args):
            entered.set();await release.wait()
            try:return await original(*args)
            finally:finished.set()
        monkeypatch.setattr(worker.runtime,'receive',blocked)
        try:
            await worker.tick();await ws.queue.put(json.dumps(message()));await asyncio.wait_for(entered.wait(),1)
            rotate(client,url,row,'synthetic-only');await worker.tick();release.set();await asyncio.wait_for(finished.wait(),1)
            db.expire_all();assert db.query(ChannelConnectionDelivery).count()==db.query(ChannelMessage).count()==0
            assert not h.posts and not h.acks
        finally:release.set();await worker.stop()
    asyncio.run(run())


def test_send_rejects_wrong_destination_or_stale_binding_without_session(discord):
    from app.services.channel_connection_runtime import ConnectionTarget
    from app.services.channel_connection_bridge import convert_packet
    from fastapi import HTTPException
    db,row,factory,adapter,worker,h,ws=discord
    async def run():
        try:
            await worker.tick();listener=next(iter(worker.handles.values())).listener;target=ConnectionTarget.from_row(row)
            context=dict(application_id='100',bot_user_id='200',guild_id='300',channel_id='400',generation=1)
            packets=convert_packet('discord','replies',{'messages':[{'text':'safe'}],'destination':{'channelId':'400'}})
            adapter.sessions=lambda:pytest.fail('send must not open a DB session')
            assert await listener.send(target,packets,context)==['400:700']
            for wrong in [{**context,'generation':2},{**context,'channel_id':'401'}]:
                with pytest.raises(HTTPException):await listener.send(target,packets,wrong)
            bad=[{**packets[0],'allowed_mentions':{'parse':['everyone']}}]
            with pytest.raises(HTTPException):await listener.send(target,bad,context)
            assert len(h.posts)==1
        finally:await worker.stop()
    asyncio.run(run())


def test_cursor_save_failure_replay_keeps_native_execution_exactly_once(discord):
    from app.models import ChannelConnectionDelivery,ChannelMessage
    from app.services.channel_connection_discord import DiscordAdapter
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    db,row,factory,adapter,worker,h,ws=discord
    async def run():
        restarted=None
        try:
            await worker.tick();listener=next(iter(worker.handles.values())).listener
            def failure(value):raise RuntimeError('synthetic cursor commit failure')
            listener.gate.save_cursor=failure;body=message()
            await ws.queue.put(json.dumps(body));task=next(iter(worker.handles.values())).task
            with pytest.raises(RuntimeError,match='cursor commit failure'):await asyncio.wait_for(task,2)
            assert listener.cursor['sequence']==1
            db.expire_all();assert db.query(ChannelConnectionDelivery).one().status=='received' and db.query(ChannelMessage).count()==0
            await worker.stop()
            fresh=Ws([hello(),body,{'op':0,'t':'RESUMED','s':3,'d':{}}])
            other=DiscordAdapter(factory,owner='restarted',http=h,socket=Socket(fresh))
            restarted=ConnectionSupervisor(factory,config=worker.config,adapters={'discord':other});other.owner=restarted.owner
            await restarted.tick()
            for _ in range(200):
                live=next(iter(restarted.handles.values())).listener
                if live.cursor.get('sequence')==3:break
                await asyncio.sleep(.01)
            await restarted.tick();await restarted.tick();db.expire_all()
            assert db.query(ChannelConnectionDelivery).one().status=='sent' and db.query(ChannelMessage).count()==2
            assert len(h.posts)==1 and fresh.sent[0]['op']==6
        finally:
            await worker.stop()
            if restarted:await restarted.stop()
    asyncio.run(run())


def test_thread_and_private_dm_share_gateway_but_use_distinct_native_rooms(discord,discord_management):
    from app.models import ChannelConnectionDelivery
    db,row,factory,adapter,worker,h,ws=discord;client,url,other=discord_management
    h.responses['/channels/400']={'id':'400','guild_id':'300','type':11,'parent_id':'402','thread_metadata':{'archived':False,'locked':False}}
    h.responses['/guilds/300']['roles'][0]['permissions']=str(3072+(1<<38))
    h.responses['/channels/401']={'id':'401','type':1,'recipients':[{'id':'501'}]}
    other.installation_id='DM';db.commit()
    async def run():
        try:
            await worker.tick();await delivered(worker,ws,message());await worker.tick()
            dm=message(channel='401',actor='501',offset=1,addressed=False);dm['d'].pop('guild_id')
            await delivered(worker,ws,dm);await worker.tick();db.expire_all()
            items=db.query(ChannelConnectionDelivery).all()
            assert len(worker.handles)==1 and len(items)==2 and len({x.room_id for x in items})==2
            assert all(x.status=='sent' for x in items) and len(h.posts)==2
        finally:await worker.stop()
    asyncio.run(run())


def test_failed_rotation_ready_does_not_harm_other_verified_target(discord,discord_management):
    from app.models import ChannelConnectionDelivery
    db,row,factory,adapter,worker,h,old=discord;client,url,other=discord_management
    bad=Ws([hello(),ready(user={'id':'201','bot':True})])
    async def run():
        try:
            await worker.tick();rotate(client,url,row,'synthetic-rotated');adapter.socket=Socket(bad);await worker.tick()
            db.refresh(row);db.refresh(other)
            assert row.observed_state=='error' and other.observed_state=='connected' and bad.closed and not old.closed
            await old.queue.put(json.dumps(message()))
            await delivered(worker,old,message(channel='401',offset=1));await worker.tick();db.expire_all()
            assert db.query(ChannelConnectionDelivery).filter_by(connection_id=row.id).count()==0
            assert [x[0] for x in h.posts]==['/channels/401/messages']
        finally:await worker.stop()
    asyncio.run(run())
