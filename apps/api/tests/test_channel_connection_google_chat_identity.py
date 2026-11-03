"""Google 신원/원장: 합성 RSA와 격리 SQLite만 사용한다."""
import asyncio,json
from types import SimpleNamespace
from datetime import datetime,timezone,timedelta
from dataclasses import replace
from uuid import uuid4
import pytest
from fastapi import HTTPException
from test_channel_connection_state import state_db,KEY
from test_channel_connection_runtime import seed_native,native_orm_bindings
from test_channel_connection_google_chat import credentials
from test_channel_connection_google_chat_auth import signing,token


class Http:
    def __init__(self):self.posts=[];self.reads=[];self.oauth_calls=[];self.kind='SPACE';self.fail=False;self.sender='users/100'
    def oauth(self,identity):self.oauth_calls.append(identity.project_id);return dict(access_token='synthetic-access',token_type='Bearer',expires_in=3600)
    def get_project(self,project,token):return dict(projectId=project,projectNumber='1234567890',lifecycleState='ACTIVE')
    def get(self,path,token):self.reads.append(path);return dict(name=path,spaceType=self.kind)
    def get_message(self,name,token):self.reads.append(name);return dict(name=name,sender=dict(name=self.sender,type='BOT'))
    def send(self,space,token,body,request_id,reply_option):
        self.posts.append((space,body,request_id,reply_option))
        if self.fail:raise TimeoutError('synthetic uncertain post')
        return dict(name=space+'/messages/out'+str(len(self.posts)),sender=dict(name=self.sender,type='BOT'))


@pytest.fixture
def google(state_db,credentials,signing):
    from app.models import AdminChannel
    from app.services.channel_connections import encrypt_credentials
    from app.services.channel_connection_google_chat import GoogleChatAdapter
    from app.services.channel_connection_google_chat_auth import GoogleChatAuthenticator
    from app.services.channel_connection_runtime import ConnectionTarget
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    state,db,row,lease,factory,runtime=seed_native(state_db)
    lease.owner=None;lease.lease_expires_at=state.clock(db)-timedelta(seconds=1)
    row.provider='google_chat';row.installation_id='1234567890';row.account_id='users/100';row.target_id='spaces/QA'
    row.observed_state='connecting';row.lease_owner=None;row.lease_expires_at=None;row.listener_scope_hash=None;row.accept_after=None
    db.get(AdminChannel,row.channel_id).code='GOOGLE_CHAT'
    row.credential_ciphertext=encrypt_credentials(credentials,row.organization_id,row.id,KEY,'v1');row.credential_key_version='v1';db.commit()
    config=SimpleNamespace(channel_connection_worker_enabled=True,channel_connection_encryption_key=KEY,channel_connection_key_version='v1')
    h=Http();adapter=GoogleChatAdapter(factory,owner='synthetic-worker',config=config,http=h,
        authenticator=GoogleChatAuthenticator(transport=lambda _: {'synthetic-key':signing[1]}))
    worker=ConnectionSupervisor(factory,config=config,adapters={'google_chat':adapter});adapter.owner=worker.owner
    return db,row,credentials,ConnectionTarget.from_row(row),adapter,worker,h,'Bearer '+token(signing[0])


def event(identifier='m1',*,space='spaces/QA',actor='users/500',thread='T',kind='SPACE',addressed=True):
    room=dict(name=space,spaceType=kind);user=dict(name=actor,type='HUMAN')
    return dict(type='MESSAGE',eventTime=datetime.now(timezone.utc).isoformat(),space=room,user=user,
        message=dict(name=space+'/messages/'+identifier,space=room,sender=user,text=('@CGA ' if addressed else '')+'question',
            thread=dict(name=space+'/threads/'+thread),annotations=[dict(type='USER_MENTION',startIndex=0,length=5,
                userMention=dict(type='MENTION',user=dict(name='users/100',type='BOT')))] if addressed else []))


async def handshake(g,body):
    db,row,credentials,target,adapter,worker,h,header=g
    task=asyncio.create_task(adapter.receive(header,body))
    try:
        for _ in range(120):
            await asyncio.sleep(.02)
            await worker.tick()
            if task.done():return await task
        raise AssertionError('handshake deadline')
    finally:
        if not task.done():task.cancel()


def test_oauth_and_space_access_remain_pending_without_first_authenticated_event(google):
    from app.services.channel_connection_supervisor import NativeHandshakePending
    db,row,credentials,target,a,w,h,header=google
    async def run():
        for _ in range(2):
            with pytest.raises(NativeHandshakePending):await a.verify(target,credentials)
    asyncio.run(run());db.refresh(row)
    assert row.observed_state=='connecting' and len(h.oauth_calls)==1 and h.reads==['spaces/QA','spaces/QA']


@pytest.mark.parametrize('change',[dict(projectId='another-project'),dict(projectNumber='9876543210'),dict(projectNumber=1234567890),dict(lifecycleState='DELETE_REQUESTED')])
def test_project_identity_mismatch_never_claims_scope(google,change):
    from app.models import ChannelInstallationLease
    db,row,c,t,a,w,h,header=google
    h.get_project=lambda project,token:{'projectId':project,'projectNumber':'1234567890','lifecycleState':'ACTIVE',**change}
    with pytest.raises(HTTPException,match='GOOGLE_CHAT_PROJECT_VERIFICATION_FAILED'):asyncio.run(a.verify(t,c))
    assert h.reads==[] and db.query(ChannelInstallationLease).filter_by(provider='google_chat').count()==0


@pytest.mark.parametrize('change',['generation','owner','fence','scope'])
def test_changed_binding_discards_first_event_proof_and_stale_activation(google,change):
    from app.models import ChannelInstallationLease
    from app.services import channel_connection_state as state
    from app.services.channel_connection_runtime import ConnectionTarget
    from app.services.channel_connection_supervisor import NativeHandshakePending
    db,row,c,t,a,w,h,header=google
    async def run():
        await w.tick();await handshake(google,event());identity=await a.verify(t,c)
        with a.sessions() as session:
            current=session.get(type(row),row.id);lease=session.query(ChannelInstallationLease).filter_by(provider='google_chat').one()
            if change=='generation':current.generation+=1
            elif change=='scope':current.account_id='users/101'
            else:
                lease.lease_expires_at=state.clock(session)-timedelta(seconds=1)
                if change=='owner':a.owner='replacement-worker'
            session.commit();fresh=ConnectionTarget.from_row(current)
        with pytest.raises(NativeHandshakePending):await a.verify(fresh,c)
        with a.sessions() as session:
            lease=session.query(ChannelInstallationLease).filter_by(provider='google_chat').one()
            with pytest.raises(HTTPException):state.activate_connection(session,row.id,lease.id,a.owner,lease.fence,identity)
    async def guarded():
        try:await run()
        finally:await w.stop()
    asyncio.run(guarded())


def test_same_binding_reverification_keeps_cutoff_and_cursor_contains_no_external_identifiers(google):
    from app.models import ChannelInstallationLease
    db,row,c,t,a,w,h,header=google
    async def run():
        try:
            await w.tick();await handshake(google,event());db.refresh(row);cutoff=row.accept_after
            await a.verify(t,c);db.refresh(row);assert row.accept_after==cutoff
            db.expire_all();cursor=json.dumps(db.query(ChannelInstallationLease).filter_by(provider='google_chat').one().cursor_json)
            for value in ['spaces/QA','users/100','cga-qa-project','users/500']:assert value not in cursor
        finally:await w.stop()
    asyncio.run(run())


@pytest.mark.parametrize('bad',['signature','space','thread','sender','type','timestamp','unaddressed','bot'])
def test_untrusted_or_unaddressed_input_never_proves_or_executes(google,bad):
    from app.models import ChannelConnectionDelivery,ChannelMessage
    from app.services.channel_connection_supervisor import NativeHandshakePending
    db,row,c,t,a,w,h,header=google
    async def run():
        try:
            await w.tick();body=event()
            if bad=='signature':header_value='Bearer invalid'
            else:header_value=header
            if bad=='space':body['space']['name']='spaces/OTHER'
            if bad=='thread':body['message']['thread']['name']='spaces/OTHER/threads/T'
            if bad=='sender':body['message']['sender']=dict(name='users/OTHER',type='HUMAN')
            if bad=='type':body['space']['spaceType']='DIRECT_MESSAGE'
            if bad=='timestamp':body['eventTime']='2026-11-03T12:00:00'
            if bad=='unaddressed':body=event(addressed=False)
            if bad=='bot':
                body['user']['type']='BOT'
            if bad in {'unaddressed','bot'}:assert await a.receive(header_value,body)=={'ignored':True}
            else:
                with pytest.raises(HTTPException):await a.receive(header_value,body)
            with pytest.raises(NativeHandshakePending):await a.verify(t,c)
            db.expire_all();assert db.query(ChannelConnectionDelivery).count()==0 and db.query(ChannelMessage).count()==0 and not h.posts
        finally:await w.stop()
    asyncio.run(run())


def test_handshake_ciphertext_cannot_be_substituted_by_binding_or_wrong_key(google):
    from app.models import ChannelInstallationLease
    db,row,c,t,a,w,h,header=google
    async def run():
        try:
            await w.tick();await handshake(google,event())
            with a.sessions() as session:
                lease=session.query(ChannelInstallationLease).filter_by(provider='google_chat').one();cursor=dict(lease.cursor_json)
                cursor['google_chat_proofs']={str(row.id):cursor['google_chat_prepared'][str(row.id)]};lease.cursor_json=cursor;session.commit()
            with pytest.raises(HTTPException,match='CONNECTION_CONTEXT_UNAVAILABLE'):await a.verify(t,c)
        finally:await w.stop()
    asyncio.run(run())


def test_first_event_without_supervisor_activation_returns_retry_not_success(google):
    from app.models import ChannelConnectionDelivery
    from app.services.channel_connection_supervisor import NativeHandshakePending
    db,row,c,t,a,w,h,header=google
    async def run():
        with pytest.raises(NativeHandshakePending):await a.verify(t,c)
        with pytest.raises(HTTPException,match='GOOGLE_CHAT_RECEIVER_NOT_READY'):await a.receive(header,event())
    asyncio.run(run());db.expire_all();assert db.query(ChannelConnectionDelivery).count()==0 and not h.posts


def test_project_listener_scope_cannot_be_claimed_by_another_organization(google):
    from app.models import Organization,Group,Bot,AdminChannel,ChannelConnection
    from app.services.channel_connection_runtime import ConnectionTarget
    db,row,c,t,a,w,h,header=google
    org=Organization(name='Other QA',code='other-qa');db.add(org);db.flush()
    group=Group(organization_id=org.id,name='QA',code='qa');parent=AdminChannel(organization_id=org.id,name='Google',code='GOOGLE_CHAT')
    db.add_all([group,parent]);db.flush();bot=Bot(organization_id=org.id,group_id=group.id,name='Other QA');db.add(bot);db.flush()
    other=ChannelConnection(organization_id=org.id,channel_id=parent.id,bot_id=bot.id,name='other',provider='google_chat',
        installation_id=row.installation_id,account_id=row.account_id,target_id='spaces/OTHER',desired_state='connected',observed_state='connecting')
    db.add(other);db.commit()
    async def run():
        try:
            await w.tick()
            with pytest.raises(HTTPException,match='GOOGLE_CHAT_APP_SCOPE_IN_USE'):await a.verify(ConnectionTarget.from_row(other),c)
            db.refresh(other);assert other.observed_state!='connected' and not h.posts
        finally:await w.stop()
    asyncio.run(run())


def test_generation_changed_during_node_normalize_never_enters_delivery(google,monkeypatch):
    from app.models import ChannelConnectionDelivery
    from app.services import channel_connection_google_chat as module
    db,row,c,t,a,w,h,header=google;convert=module.convert_packet
    def interleave(*args):
        value=convert(*args)
        with a.sessions() as session:
            session.get(type(row),row.id).generation+=1;session.commit()
        return value
    monkeypatch.setattr(module,'convert_packet',interleave)
    async def run():
        try:
            await w.tick()
            with pytest.raises(HTTPException,match='CONNECTION_CHANGED'):await a.receive(header,event())
            db.expire_all();assert db.query(ChannelConnectionDelivery).count()==0 and not h.posts
        finally:await w.stop()
    asyncio.run(run())
