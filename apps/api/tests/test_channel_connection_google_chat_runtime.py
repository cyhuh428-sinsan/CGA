"""실제 native/SQLite/Node를 통한 Google Chat 수신→봇→회신."""
import asyncio,json
from copy import deepcopy
from datetime import timedelta
from uuid import UUID,uuid4,uuid5,NAMESPACE_URL
import pytest
from fastapi import HTTPException
from test_channel_connection_google_chat_identity import google,credentials,signing,state_db,native_orm_bindings,event,handshake


async def finish(g):await g[5].tick();await g[5].tick()


async def accept_only(g,body):
    """수신/activate까지만 실제 실행하여 native/send 직전의 정확한 barrier를 만든다."""
    from app.models import ChannelInstallationLease
    from app.services import channel_connection_state as state
    from app.services.channel_connection_supervisor import NativeHandshakePending
    db,row,c,t,a,w,h,header=g
    await w.tick();request=asyncio.create_task(a.receive(header,body))
    try:
        for _ in range(120):
            await asyncio.sleep(.02)
            try:identity=await a.verify(t,c)
            except NativeHandshakePending:continue
            with a.sessions() as session:
                lease=session.query(ChannelInstallationLease).filter_by(provider='google_chat').one()
                state.activate_connection(session,row.id,lease.id,a.owner,lease.fence,identity);session.commit();lid,fence=lease.id,lease.fence
            listener=await a.open([t],c,identity)
            return await request,lid,fence,listener
        raise AssertionError('proof deadline')
    finally:
        if not request.done():request.cancel()


def test_first_signed_message_native_answer_and_duplicate_one_post(google):
    from app.models import ChannelConnectionDelivery,ChannelMessage,ChannelQueueEvent
    db,row,c,t,a,w,h,header=google
    async def run():
        try:
            await w.tick();body=event();first=await handshake(google,body);await finish(google)
            assert await a.receive(header,body)==first;await finish(google)
            db.expire_all();item=db.get(ChannelConnectionDelivery,UUID(first['delivery_id']))
            assert item.status=='sent' and item.room_id and item.request_message_id and item.queue_event_id
            assert db.query(ChannelMessage).count()==2 and db.query(ChannelQueueEvent).one().status=='completed'
            assert len(h.posts)==1 and h.posts[0][1]['text']=='fixed QA answer'
            assert h.posts[0][1]['thread']=={'name':'spaces/QA/threads/T'} and h.posts[0][3]=='REPLY_MESSAGE_OR_FAIL'
            assert h.posts[0][2]==str(uuid5(NAMESPACE_URL,'cga-google-chat:'+first['delivery_id']+':0'))
            changed=deepcopy(body);changed['message']['text']='@CGA changed'
            with pytest.raises(HTTPException,match='NATIVE_EVENT_CONFLICT'):await a.receive(header,changed)
            assert len(h.posts)==1 and item.event_json=={}
        finally:await w.stop()
    asyncio.run(run())


def test_uncertain_post_never_retries_but_next_question_is_allowed(google):
    from app.models import ChannelConnectionDelivery
    db,row,c,t,a,w,h,header=google;h.fail=True
    async def run():
        try:
            await w.tick();first=await handshake(google,event());await finish(google);await finish(google)
            db.expire_all();assert db.get(ChannelConnectionDelivery,UUID(first['delivery_id'])).status=='unknown'
            assert len(h.posts)==1
            h.fail=False;await a.receive(header,event('new',thread='OTHER'));await finish(google)
            assert len(h.posts)==2
        finally:await w.stop()
    asyncio.run(run())


def test_sender_mismatch_is_atomic_unknown_and_persistent_generation_block(google):
    from app.models import ChannelConnectionDelivery,ChannelInstallationLease
    from app.services.channel_connection_google_chat import GoogleChatAdapter
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    db,row,c,t,a,w,h,header=google;h.sender='users/WRONG'
    async def run():
        fresh=None
        try:
            await w.tick();first=await handshake(google,event());await finish(google)
            db.expire_all();item=db.get(ChannelConnectionDelivery,UUID(first['delivery_id']));db.refresh(row)
            assert item.status=='unknown' and row.observed_state=='error'
            lease=db.query(ChannelInstallationLease).filter_by(provider='google_chat').one()
            assert lease.cursor_json['google_chat_identity_errors'][str(row.id)]==row.generation
            assert str(row.id) not in lease.cursor_json['google_chat_proofs']
            await w.stop()
            current=GoogleChatAdapter(a.sessions,owner='new',config=a.config,http=h,authenticator=a.authenticator)
            fresh=ConnectionSupervisor(a.sessions,config=w.config,adapters={'google_chat':current});current.owner=fresh.owner
            await fresh.tick()
            with pytest.raises(HTTPException):await current.receive(header,event('second'))
            assert len(h.posts)==1
        finally:
            await w.stop()
            if fresh:await fresh.stop()
    asyncio.run(run())


def test_sparse_receipt_reads_metadata_and_send_opens_no_db_session(google):
    from app.services.channel_connection_runtime import ConnectionTarget
    from app.services.channel_connection_bridge import convert_packet
    db,row,c,t,a,w,h,header=google
    async def run():
        try:
            await w.tick();first=await handshake(google,event());await finish(google)
            listener=next(iter(w.handles.values())).listener;target=ConnectionTarget.from_row(row)
            destination=dict(project='1234567890',project_id='cga-qa-project',bot='users/100',space='spaces/QA',space_type='SPACE',generation=1,spaceName='spaces/QA',threadName='spaces/QA/threads/T',delivery_id=first['delivery_id'])
            frame={'destination':destination,'google_chat_delivery_id':first['delivery_id']};packets=convert_packet('google_chat','replies',dict(messages=[dict(id=str(uuid4()),participantKind='bot',messageType='text',text='QA')],destination=destination))
            saved=a.sessions
            def forbidden():pytest.fail('send must not reopen DB')
            a.sessions=forbidden;send=h.send
            def sparse(*args):result=send(*args);result.pop('sender');return result
            h.send=sparse
            try:assert await listener.send(target,packets,frame)==['spaces/QA/messages/out2']
            finally:a.sessions=saved
            assert h.reads[-1]=='spaces/QA/messages/out2'
        finally:await w.stop()
    asyncio.run(run())


def click(packet,*,source=None,index='1',actor='users/500',thread='T'):
    body=event(actor=actor,thread=thread);body['type']='CARD_CLICKED';body['message']['name']='spaces/QA/messages/out1'
    body['message']['sender']=dict(name='users/100',type='BOT');body['message'].pop('text');body['message'].pop('annotations')
    buttons=next(w['buttonList']['buttons'] for w in packet['cardsV2'][0]['card']['sections'][0]['widgets'] if 'buttonList' in w)
    params=deepcopy(buttons[1]['onClick']['action']['parameters'])
    if source:next(p for p in params if p['key']=='sourceMessageId')['value']=source
    next(p for p in params if p['key']=='choiceIndex')['value']=index
    body['action']=dict(actionMethodName='cga.select',parameters=params);return body


def test_card_selection_restores_native_choice_and_rejects_cross_room_and_index(google):
    from app.models import Bot,BotVersion,ChannelConnectionDelivery,ChannelMessage
    db,row,c,t,a,w,h,header=google
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
    async def run():
        try:
            await w.tick();await handshake(google,event());await finish(google);packet=h.posts[0][1]
            for body in [click(packet,source=str(uuid4())),click(packet,index='99'),click(packet,thread='OTHER')]:
                with pytest.raises(HTTPException):await a.receive(header,body)
            body=click(packet);accepted=await a.receive(header,body);await finish(google)
            assert await a.receive(header,body)==accepted;await finish(google)
            db.expire_all();item=db.get(ChannelConnectionDelivery,UUID(accepted['delivery_id']))
            assert item.status=='sent' and len(h.posts)==2
            assert h.posts[1][1]['text']=='selected: two'
            user=db.get(ChannelMessage,item.request_message_id)
            assert 'two' in user.text and 'sourceMessageId' in user.text
        finally:await w.stop()
    asyncio.run(run())


@pytest.mark.parametrize('change',['generation','owner','fence'])
def test_old_sender_mismatch_cannot_contaminate_new_binding(google,change):
    from app.models import ChannelInstallationLease,ChannelConnectionDelivery
    from app.services import channel_connection_state as state
    db,row,c,t,a,w,h,header=google;send=h.send
    def interleave(*args):
        result=send(*args);result['sender']['name']='users/WRONG'
        with a.sessions() as session:
            current=session.get(type(row),row.id);lease=session.query(ChannelInstallationLease).filter_by(provider='google_chat').one()
            if change=='generation':current.generation+=1;current.observed_state='connecting'
            elif change=='owner':lease.owner='replacement-owner'
            else:lease.fence+=1
            session.commit()
        return result
    h.send=interleave
    async def run():
        try:
            await w.tick();first,lid,fence,listener=await accept_only(google,event())
            await w.runtime.process_one(row.id,lid,w.owner,fence,listener)
            db.expire_all();assert db.get(ChannelConnectionDelivery,UUID(first['delivery_id'])).status=='unknown'
            lease=db.query(ChannelInstallationLease).filter_by(provider='google_chat').one()
            assert str(row.id) not in lease.cursor_json.get('google_chat_identity_errors',{})
            db.refresh(row);assert row.last_error_code!='GOOGLE_CHAT_SENDER_VERIFICATION_FAILED'
        finally:await w.stop()
    asyncio.run(run())


@pytest.mark.parametrize('kind',['DIRECT_MESSAGE','GROUP_CHAT'])
def test_non_named_space_omits_reply_option_and_direct_uses_private_room(google,kind):
    from app.models import ChannelConnectionDelivery
    from app.services.channel_connections import decrypt_event_context
    from test_channel_connection_state import KEY
    db,row,c,t,a,w,h,header=google;h.kind=kind
    async def run():
        try:
            await w.tick();first=await handshake(google,event(kind=kind,addressed=kind!='DIRECT_MESSAGE'));await finish(google)
            db.expire_all();item=db.get(ChannelConnectionDelivery,UUID(first['delivery_id']))
            value=decrypt_event_context(item.context_ciphertext,item.organization_id,item.id,KEY,'v1')
            assert item.status=='sent' and h.posts[0][3] is None
            assert value['event']['roomMode']==('private' if kind=='DIRECT_MESSAGE' else 'shared')
        finally:await w.stop()
    asyncio.run(run())


def test_delay_before_verify_preserves_first_question_after_connect_cutoff(google):
    from app.models import ChannelConnectionDelivery
    from app.services import channel_connection_state as state
    db,row,c,t,a,w,h,header=google
    row.accept_after=state.clock(db);db.commit();body=event()
    async def run():
        try:
            await asyncio.sleep(.03);await w.tick();first=await handshake(google,body);await finish(google)
            db.expire_all();assert db.get(ChannelConnectionDelivery,UUID(first['delivery_id'])).status=='sent' and len(h.posts)==1
        finally:await w.stop()
    asyncio.run(run())


def test_pre_connect_event_is_durably_cancelled_without_native_execution(google):
    from app.models import ChannelConnectionDelivery,ChannelMessage
    db,row,c,t,a,w,h,header=google
    async def run():
        try:
            from app.services import channel_connection_state as state
            await w.tick();db.refresh(row);body=event();body['eventTime']=(state._utc(row.accept_after)-timedelta(seconds=1)).isoformat()
            first=await handshake(google,body);await finish(google)
            db.expire_all();item=db.get(ChannelConnectionDelivery,UUID(first['delivery_id']))
            assert item.status=='cancelled' and item.last_error_code=='BEFORE_CONNECTION' and not h.posts and db.query(ChannelMessage).count()==0
        finally:await w.stop()
    asyncio.run(run())


def test_ready_ciphertext_and_hash_are_unchanged_by_duplicate_then_restart_sends_once(google):
    from app.models import ChannelConnectionDelivery,ChannelMessage
    db,row,c,t,a,w,h,header=google
    async def run():
        try:
            await w.tick();body=event();first,lid,fence,listener=await accept_only(google,body)
            did=UUID(first['delivery_id']);await asyncio.to_thread(w.runtime._execute_one,row.id,lid,w.owner,fence)
            db.expire_all();item=db.get(ChannelConnectionDelivery,did);original=(item.request_hash,item.context_ciphertext,item.execution_claim_id)
            assert item.status=='ready' and db.query(ChannelMessage).count()==2
            assert await a.receive(header,body)==first
            changed=deepcopy(body);changed['message']['text']='@CGA changed'
            with pytest.raises(HTTPException,match='NATIVE_EVENT_CONFLICT'):await a.receive(header,changed)
            db.refresh(item);assert (item.request_hash,item.context_ciphertext,item.execution_claim_id)==original
            # 새 listener는 DB/context를 다시 만들지 않고 원래 delivery UUID로 requestId를 복구한다.
            identity=await a.verify(t,c);listener=await a.open([t],c,identity)
            assert await w.runtime._send(did,lid,w.owner,fence,listener)
            assert not await w.runtime._send(did,lid,w.owner,fence,listener)
            assert len(h.posts)==1 and h.posts[0][2]==str(uuid5(NAMESPACE_URL,'cga-google-chat:'+str(did)+':0'))
        finally:await w.stop()
    asyncio.run(run())


def test_each_target_keeps_own_credential_after_other_rotation_and_removal(google):
    from app.models import ChannelConnection
    from app.services.channel_connections import encrypt_credentials,disconnect_connection
    from test_channel_connection_state import KEY
    db,row,c,t,a,w,h,header=google
    second_credentials=deepcopy(c);raw=json.loads(c['service_account_json']);raw['client_email']='second@cga-qa-project.iam.gserviceaccount.com'
    second_credentials['service_account_json']=json.dumps(raw)
    second=ChannelConnection(organization_id=row.organization_id,channel_id=row.channel_id,bot_id=row.bot_id,
        name='second',provider='google_chat',installation_id=row.installation_id,account_id=row.account_id,target_id='spaces/SECOND',
        desired_state='connected',observed_state='connecting')
    db.add(second);db.flush();second.credential_ciphertext=encrypt_credentials(second_credentials,second.organization_id,second.id,KEY,'v1');second.credential_key_version='v1';db.commit()
    h.oauth=lambda identity:dict(access_token=identity.client_email,token_type='Bearer',expires_in=3600)
    sends=[];send=h.send
    def record(space,token,*args):sends.append((space,token));return send(space,token,*args)
    h.send=record
    async def run():
        try:
            await w.tick();await handshake(google,event());await finish(google)
            await handshake(google,event('b',space='spaces/SECOND'));await finish(google)
            assert sends==[('spaces/QA','qa@cga-qa-project.iam.gserviceaccount.com'),('spaces/SECOND','second@cga-qa-project.iam.gserviceaccount.com')]
            db.refresh(row);row.generation+=1;row.observed_state='connecting';row.lease_owner=None;row.lease_expires_at=None
            rotated=deepcopy(c);value=json.loads(rotated['service_account_json']);value['client_email']='rotated@cga-qa-project.iam.gserviceaccount.com';rotated['service_account_json']=json.dumps(value)
            row.credential_ciphertext=encrypt_credentials(rotated,row.organization_id,row.id,KEY,'v1');db.commit()
            await w.tick();await handshake(google,event('rotated'));await finish(google)
            assert sends[-1]==('spaces/QA','rotated@cga-qa-project.iam.gserviceaccount.com')
            db.refresh(row);disconnect_connection(row);db.commit();await w.tick()
            await a.receive(header,event('b2',space='spaces/SECOND'));await finish(google)
            assert sends[-1]==('spaces/SECOND','second@cga-qa-project.iam.gserviceaccount.com') and len(sends)==4
        finally:await w.stop()
    asyncio.run(run())


def test_listener_removal_during_http_post_preserves_unknown_not_sent(google):
    from app.models import ChannelConnectionDelivery
    db,row,c,t,a,w,h,header=google
    async def run():
        try:
            await w.tick();first,lid,fence,listener=await accept_only(google,event())
            send=h.send
            def removed(*args):
                value=send(*args);listener.targets={};return value
            h.send=removed
            await w.runtime.process_one(row.id,lid,w.owner,fence,listener)
            db.expire_all();assert db.get(ChannelConnectionDelivery,UUID(first['delivery_id'])).status=='unknown' and len(h.posts)==1
        finally:await w.stop()
    asyncio.run(run())


def test_real_asgi_signed_request_commits_native_reply_and_rejects_shared_api_key(google,monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.routes import channel_connection_events as route
    from test_channel_connection_state import KEY
    db,row,c,t,a,w,h,header=google
    monkeypatch.setattr(route.settings,'channel_connection_worker_enabled',True)
    monkeypatch.setattr(route.settings,'channel_connection_encryption_key',KEY);monkeypatch.setitem(route.ADAPTERS,'google_chat',a)
    app=FastAPI();app.include_router(route.router,prefix='/api/v1');client=TestClient(app);url='/api/v1/channel-connections/google-chat/events'
    async def run():
        request=None
        try:
            await w.tick();body=event()
            bad=await asyncio.to_thread(client.post,url,json=body,headers={'X-Aidot-Api-Key':'synthetic-shared-only'})
            assert bad.status_code==401 and not h.posts
            request=asyncio.create_task(asyncio.to_thread(client.post,url,json=body,headers={'Authorization':header}))
            for _ in range(120):
                await asyncio.sleep(.02);await w.tick()
                if request.done():break
            response=await request;assert response.status_code==200 and response.json()=={}
            await finish(google);assert len(h.posts)==1
            response=await asyncio.to_thread(client.post,url,json=body,headers={'Authorization':header})
            assert response.status_code==200;await finish(google);assert len(h.posts)==1
        finally:
            if request and not request.done():request.cancel()
            client.close();await w.stop()
    asyncio.run(run())


@pytest.mark.parametrize('stage',['received','ready','sent','unknown'])
def test_changed_duplicate_does_not_overwrite_hash_context_or_durable_uuid(google,stage):
    from app.models import ChannelConnectionDelivery
    db,row,c,t,a,w,h,header=google
    async def run():
        try:
            await w.tick();body=event();first,lid,fence,listener=await accept_only(google,body);did=UUID(first['delivery_id'])
            if stage=='ready':await asyncio.to_thread(w.runtime._execute_one,row.id,lid,w.owner,fence)
            if stage in {'sent','unknown'}:
                h.fail=stage=='unknown';await w.runtime.process_one(row.id,lid,w.owner,fence,listener)
            db.expire_all();item=db.get(ChannelConnectionDelivery,did)
            before=(item.request_hash,item.context_ciphertext,item.execution_claim_id,item.send_claim_id,item.status,list(item.provider_message_ids))
            assert item.status==stage
            assert await a.receive(header,body)==first
            forged=deepcopy(body);forged['message']['text']='@CGA forged'
            with pytest.raises(HTTPException,match='NATIVE_EVENT_CONFLICT'):await a.receive(header,forged)
            db.refresh(item);assert (item.request_hash,item.context_ciphertext,item.execution_claim_id,item.send_claim_id,item.status,list(item.provider_message_ids))==before
        finally:await w.stop()
    asyncio.run(run())
