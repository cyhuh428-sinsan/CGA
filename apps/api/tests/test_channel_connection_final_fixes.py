"""최종 리뷰 결함: 실제 Node/ORM/native, 외부 transport만 합성."""
import asyncio
from copy import deepcopy
from datetime import timedelta
import json
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from test_channel_connection_state import state_db, KEY
from test_channel_connection_runtime import native_orm_bindings
from test_channel_connection_teams_adapter import teams, activity, AUTHORIZATION, CLIENT
from test_channel_connection_slack_runtime import slack, slack_management, deliver
from test_channel_connection_slack import frame
from test_channel_connection_discord_runtime import discord, delivered, message as discord_message, interaction


def choice_graph(db, row, count=2):
    from app.models import Base, Bot, BotVersion
    for table in Base.metadata.tables.values():table.create(db.bind,checkfirst=True)
    bot=db.get(Bot,row.bot_id)
    graph={'dialogs':[{'id':'qa','name':'QA','dialogType':1,'utterances':[{'text':'question','utteranceType':'T'}]}],
        'dialog_flow_graphs':[{'id':'graph-qa','dialogId':'qa','nodes':[
            {'id':'start','kind':'start','config':{}},
            {'id':'choice','kind':'talk','config':{'messageType':'button','basicMessages':['choose'],'messages':(['one','two']+[f'v{i}' for i in range(2,count)])[:count],'responseType':'relay','responseVariableName':'choice'}},
            {'id':'result','kind':'talk','config':{'messageType':'text','basicMessages':['selected: {{$choice}}'],'responseType':'none'}},
            {'id':'end','kind':'end','config':{}}],
            'links':[{'sourceNodeId':'start','sourcePort':'next','targetNodeId':'choice'},
                {'sourceNodeId':'choice','sourcePort':'next','targetNodeId':'result'},
                {'sourceNodeId':'result','sourcePort':'next','targetNodeId':'end'}]}],'apis':[]}
    version=BotVersion(bot_id=bot.id,name='review',version_no=99,status='active',version_json=graph)
    db.add(version);db.flush();bot.active_version_id=version.id
    bot.data_json={'nlu_type':'ml','nlu_model':'deep_learning_lite','answer_mode':'fixed'};db.commit()


def teams_worker(teams,count=2):
    from app.models import AdminChannel
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    db,row,c,target,a=teams
    choice_graph(db,row,count);db.get(AdminChannel,row.channel_id).code='TEAMS';db.commit()
    config=SimpleNamespace(channel_connection_worker_enabled=True,channel_connection_encryption_key=KEY,channel_connection_key_version='v1')
    worker=ConnectionSupervisor(a.sessions,config=config,adapters={'ms_teams':a});a.owner=worker.owner
    return worker


async def teams_start(teams,worker,value=None):
    a=teams[-1]
    await worker.tick()
    receive=asyncio.create_task(a.receive(AUTHORIZATION,value or activity()))
    await asyncio.sleep(.1);await worker.tick();await receive;await worker.tick()


def teams_card_action(packet,selected='two'):
    card=packet['attachments'][0]['content'];value=deepcopy(card['actions'][-1]['data'])
    if len(card['actions'])>1:value=deepcopy(card['actions'][1]['data'])
    for item in card.get('body',[]):
        if item.get('type')=='Input.ChoiceSet':value[item['id']]=selected
    return value


@pytest.mark.parametrize('kind',['button','table'])
@pytest.mark.parametrize('count',[1,2,3,4,5,6,7])
def test_teams_large_choice_packet_roundtrip_reaches_native_answer(teams,kind,count):
    from app.models import ChannelMessage
    from app.services.channel_connection_bridge import convert_packet
    db,row,c,target,a=teams;worker=teams_worker(teams,count)
    selected='one' if count==1 else 'two'
    async def run():
        try:
            await teams_start(teams,worker)
            packet=a.http.sends[0][-1]
            if kind=='table':
                db.expire_all();source=db.query(ChannelMessage).filter_by(participant_kind='bot').one()
                source.message_type='table';source.payload_json={'sourceTalkNodeId':'choice','columns':['key'],'rows':[{'key':v} for v in ['one','two','v2','v3','v4','v5','v6'][:count]],'keyColumn':'key'};db.commit()
                packet=convert_packet('ms_teams','replies',{'messages':[{'id':str(source.id),'messageType':'table','text':'choose','payload':source.payload_json}],'destination':{}})[0]
            await a.receive(AUTHORIZATION,activity(id='choice-submit',value=teams_card_action(packet,selected)))
            await worker.tick()
            assert a.http.sends[-1][-1]['text']=='selected: '+selected
        finally:await worker.stop()
    asyncio.run(run())


@pytest.fixture
def teams_management(teams,monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.deps import get_current_user,get_db
    from app.api.routes.channel_connections import router
    from app.core.config import settings
    from app.models import Bot,User,Role,UserRole
    from app.services.channel_connection_supervisor import ADAPTERS
    db,row,c,target,a=teams
    teams_worker(teams)
    user=User(organization_id=row.organization_id,group_id=db.get(Bot,row.bot_id).group_id,name='QA',login_id='teams-final-management',password_hash='synthetic',status='active')
    role=Role(code='system_manager',name='QA');db.add_all([user,role]);db.flush();db.add(UserRole(user_id=user.id,role_id=role.id));db.commit()
    app=FastAPI();app.include_router(router,prefix='/api/v1')
    def session():
        with a.sessions() as current:yield current
    app.dependency_overrides[get_db]=session;app.dependency_overrides[get_current_user]=lambda:user
    monkeypatch.setattr(settings,'channel_connection_encryption_key',KEY);monkeypatch.setattr(settings,'channel_connection_worker_enabled',True)
    monkeypatch.setitem(ADAPTERS,'ms_teams',a)
    with TestClient(app) as client:yield client,f'/api/v1/admin/channels/{row.channel_id}/connections'


def test_teams_management_rotation_and_distinct_target_credentials_after_token_expiry(teams,teams_management):
    from uuid import UUID
    from app.models import ChannelConnection
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    db,row,c,target,a=teams;client,root=teams_management
    assert client.post(root+'/'+str(row.id)+'/disconnect').status_code==200
    assert client.delete(root+'/'+str(row.id)).status_code==200
    ids=[]
    def payload(room,secret):return dict(name=room,bot_id=str(row.bot_id),installation_id=row.installation_id,account_id=CLIENT,target_id=room,credentials={**c,'client_secret':secret})
    for room,secret in [('room-A','synthetic-A'),('room-B','synthetic-B')]:
        result=client.post(root,json=payload(room,secret));assert result.status_code==200,result.text
        cid=result.json()['data']['id'];ids.append(cid)
        assert client.post(root+'/'+cid+'/connect').status_code==200
    worker=ConnectionSupervisor(a.sessions,config=SimpleNamespace(channel_connection_worker_enabled=True,channel_connection_encryption_key=KEY,channel_connection_key_version='v1'),adapters={'ms_teams':a});a.owner=worker.owner
    calls=[]
    def oauth(tenant,client,secret):calls.append(secret);return dict(access_token='test-access-'+secret,token_type='Bearer',expires_in=3600)
    a.http.oauth=oauth
    async def incoming(room,eid):
        value=activity(id=eid,conversation={'id':room,'conversationType':'personal'})
        receiving=asyncio.create_task(a.receive(AUTHORIZATION,value));await asyncio.sleep(.1);await worker.tick();await receiving;await worker.tick()
    async def run():
        try:
            await worker.tick();await incoming('room-A','A1');await incoming('room-B','B1')
            handle=next(iter(worker.handles.values()));original_task=handle.task
            # 만료되지 않은 옛 access token이 stale credential 선택을 숨기지 않게 한다.
            a.tokens={key:(value[0],0) for key,value in a.tokens.items()}
            url=root+'/'+ids[0]
            assert client.post(url+'/disconnect').status_code==200
            assert client.patch(url,json=payload('room-A','synthetic-A-rotated')).status_code==200
            assert client.post(url+'/connect').status_code==200
            await worker.tick();await incoming('room-A','A2')
            assert a.http.sends[-1][3]=='test-access-synthetic-A-rotated'
            await incoming('room-B','B2');assert a.http.sends[-1][3]=='test-access-synthetic-B'
            assert next(iter(worker.handles.values())).task is original_task
            assert client.post(url+'/disconnect').status_code==200
            assert client.delete(url).status_code==200
            await worker.tick();await incoming('room-B','B3')
            assert a.http.sends[-1][3]=='test-access-synthetic-B'
            assert set(calls)=={'synthetic-A','synthetic-A-rotated','synthetic-B'}
            db.expire_all();assert db.get(ChannelConnection,UUID(ids[1])).observed_state=='connected'
        finally:await worker.stop()
    asyncio.run(run())


def test_teams_reconnect_rejects_previous_card_without_native(teams,teams_management):
    from app.models import ChannelMessage,ChannelConnectionDelivery
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    db,row,c,target,a=teams;client,root=teams_management
    worker=ConnectionSupervisor(a.sessions,config=SimpleNamespace(channel_connection_worker_enabled=True,channel_connection_encryption_key=KEY,channel_connection_key_version='v1'),adapters={'ms_teams':a});a.owner=worker.owner
    async def run():
        try:
            await teams_start(teams,worker);value=teams_card_action(a.http.sends[0][-1])
            assert client.post(root+'/'+str(row.id)+'/disconnect').status_code==200
            assert client.post(root+'/'+str(row.id)+'/connect').status_code==200
            await worker.tick();await worker.tick()
            with pytest.raises(HTTPException) as rejected:await a.receive(AUTHORIZATION,activity(id='old-after-reconnect',value=value))
            assert rejected.value.detail=='TEAMS_CARD_RESPONSE_INVALID'
            db.expire_all();assert db.query(ChannelMessage).count()==2 and db.query(ChannelConnectionDelivery).count()==1 and len(a.http.sends)==1
        finally:await worker.stop()
    asyncio.run(run())


def test_slack_reconnect_rejects_previous_card_without_ack_or_native(slack,slack_management):
    from app.models import ChannelMessage,ChannelConnectionDelivery
    db,row,factory,a,worker,http,ws=slack;client,url,other=slack_management;choice_graph(db,row)
    async def run():
        try:
            await worker.tick();await deliver(worker,ws,frame());await worker.tick()
            button=http.posts[0]['blocks'][-1]['elements'][1]
            assert client.post(url+'/disconnect').status_code==200
            assert client.post(url+'/connect').status_code==200
            await worker.tick();handle=next(iter(worker.handles.values()));listener=handle.listener
            body={'type':'interactive','envelope_id':'old-selection','payload':{'type':'block_actions','api_app_id':'AQA001','team':{'id':'TQA001'},'user':{'id':'UQA002'},'channel':{'id':'CQA001'},'container':{'message_ts':'1700000001.000001'},'actions':[{**button,'action_ts':__import__('time').time().__format__('.6f')}]}}
            async def receive(cid,event):return await worker.runtime.receive(cid,handle.lease_id,worker.owner,handle.fence,event)
            with pytest.raises(HTTPException) as rejected:await listener.handle(body,receive,source=ws,revision=listener.revision)
            assert rejected.value.detail=='SLACK_SELECTION_INVALID'
            db.expire_all();assert db.query(ChannelMessage).count()==2 and db.query(ChannelConnectionDelivery).count()==1 and len(http.posts)==1
            assert not any(x.get('envelope_id')=='old-selection' for x in ws.sent)
        finally:await worker.stop()
    asyncio.run(run())


@pytest.mark.parametrize('action_type',['Action.Submit','Action.Execute'])
def test_teams_form_reserved_name_unicode_and_original_data_remain_inputs(teams,action_type):
    from app.models import ChannelMessage
    from app.services.channel_connection_bridge import convert_packet
    db,row,c,target,a=teams;worker=teams_worker(teams)
    async def run():
        try:
            await teams_start(teams,worker);db.expire_all()
            source=db.query(ChannelMessage).filter_by(participant_kind='bot').one()
            card={'type':'AdaptiveCard','version':'1.6','body':[
                {'type':'Input.Text','id':'__cga_buttonValue'},
                {'type':'Input.Text','id':'이름'}],
                'actions':[{'type':action_type,'title':'제출','data':{'context':{'lang':'ko'}}}]}
            source.message_type='form-a-card';source.payload_json={'sourceTalkNodeId':'choice','adaptiveCard':card};db.commit()
            packet=convert_packet('ms_teams','replies',{'messages':[dict(id=str(source.id),text='입력',messageType=source.message_type,payload=source.payload_json)],'destination':{}})[0]
            rendered=packet['attachments'][0]['content'];value=deepcopy(rendered['actions'][0]['data'])
            value[rendered['body'][0]['id']]='일반 입력';value[rendered['body'][1]['id']]='홍길동'
            incoming=activity(id='form-submit',value=value)
            if action_type=='Action.Execute':incoming=activity(id='form-submit',type='invoke',name='adaptiveCard/action',value={'trigger':'manual','action':{'type':'Action.Execute','data':value}})
            await a.receive(AUTHORIZATION,incoming);await worker.tick();db.expire_all()
            message=db.query(ChannelMessage).filter_by(participant_kind='user').order_by(ChannelMessage.created_at.desc()).first()
            assert json.loads(message.text)['response']=={'context':{'lang':'ko'},'__cga_buttonValue':'일반 입력','이름':'홍길동'}
        finally:await worker.stop()
    asyncio.run(run())


def test_slack_valid_button_roundtrip_has_durable_ack_and_native_selected_answer(slack):
    db,row,factory,a,worker,http,ws=slack;choice_graph(db,row)
    async def run():
        try:
            await worker.tick();await deliver(worker,ws,frame());await worker.tick()
            button=http.posts[0]['blocks'][-1]['elements'][1]
            body={'type':'interactive','envelope_id':'valid-selection','payload':{'type':'block_actions','api_app_id':'AQA001','team':{'id':'TQA001'},'user':{'id':'UQA002'},'channel':{'id':'CQA001'},'container':{'message_ts':'1700000001.000001'},'actions':[{**button,'action_ts':__import__('time').time().__format__('.6f')}]}}
            await deliver(worker,ws,body)
            assert len(http.posts)==1
            await worker.tick();assert http.posts[-1]['text']=='selected: two'
            await deliver(worker,ws,body);await worker.tick();assert len(http.posts)==2
        finally:await worker.stop()
    asyncio.run(run())


def test_discord_current_card_reaches_native_selected_answer(discord):
    from app.models import ChannelMessage
    db,row,factory,a,worker,http,ws=discord;choice_graph(db,row)
    async def run():
        try:
            await worker.tick();await delivered(worker,ws,discord_message());await worker.tick();db.expire_all()
            source=db.query(ChannelMessage).filter_by(participant_kind='bot').one()
            body=interaction(source);body['d']['data']['custom_id']='cga:'+str(source.id)+':1'
            await delivered(worker,ws,body);await worker.tick()
            assert http.posts[-1][1]['content']=='selected: two' and len(http.acks)==1
        finally:await worker.stop()
    asyncio.run(run())


@pytest.mark.parametrize('provider',['teams','slack'])
@pytest.mark.parametrize('change',['missing','other_room','other_bot','other_org','user','deleted','old_card','node','value','text_wire'])
def test_callback_rejects_untrusted_source_before_native_or_ack(request,provider,change):
    from app.models import ChannelMessage,ChannelRoom,Bot,ChannelConnectionDelivery
    if provider=='teams':
        teams=request.getfixturevalue('teams')
        db,row,c,target,a=teams;worker=teams_worker(teams)
    else:
        slack=request.getfixturevalue('slack')
        db,row,factory,a,worker,http,ws=slack;choice_graph(db,row)
    async def run():
        try:
            if provider=='teams':await teams_start(teams,worker)
            else:await worker.tick();await deliver(worker,ws,frame());await worker.tick()
            db.expire_all();source=db.query(ChannelMessage).filter_by(participant_kind='bot').one()
            if provider=='teams':value=teams_card_action(a.http.sends[0][-1]);wire=value
            else:
                button=http.posts[0]['blocks'][-1]['elements'][1];wire=json.loads(button['value'])
                value={'type':'interactive','envelope_id':'selection','payload':{'type':'block_actions','api_app_id':'AQA001','team':{'id':'TQA001'},'user':{'id':'UQA002'},'channel':{'id':'CQA001'},'container':{'message_ts':'1700000001.000001'},'actions':[{**button,'action_ts':__import__('time').time().__format__('.6f')}]}}
            if change=='missing':wire['sourceMessageId' if provider=='teams' else 'messageId']=str(uuid4())
            if change=='other_room':
                room=db.get(ChannelRoom,source.room_id)
                other=ChannelRoom(bot_id=row.bot_id,bot_version_id=room.bot_version_id,channel_type=room.channel_type,status='open');db.add(other);db.flush();source.room_id=other.id
            if change=='other_bot':db.get(ChannelRoom,source.room_id).bot_id=uuid4()
            if change=='other_org':db.get(Bot,row.bot_id).organization_id=uuid4()
            if change=='user':source.participant_kind='user'
            if change=='deleted':source.deleted_at=__import__('datetime').datetime.now(__import__('datetime').timezone.utc)
            if change=='old_card':source.created_at=row.accept_after-timedelta(seconds=1)
            if change=='node':wire['sourceTalkNodeId']='unrelated-node'
            if change=='value':wire['response']['buttonValue']='not-a-choice'
            if change=='text_wire':wire['response']['buttonValue']='not-a-choice'
            db.commit();before=db.query(ChannelMessage).count();deliveries=db.query(ChannelConnectionDelivery).count()
            if provider=='slack':value['payload']['actions'][0]['value']=json.dumps(wire)
            if change=='text_wire' and provider=='slack':
                value=frame();value['payload']['event']['text']='<@UQA001> '+json.dumps(dict(webchatRichFormVersion='1.0',sourceMessageId=wire['messageId'],sourceTalkNodeId=wire['sourceTalkNodeId'],response=wire['response']))
            with pytest.raises(HTTPException) as rejected:
                if provider=='teams':await a.receive(AUTHORIZATION,activity(id='selection',**({'text':json.dumps(value)} if change=='text_wire' else {'value':value})))
                else:
                    listener=next(iter(worker.handles.values())).listener
                    handle=next(iter(worker.handles.values()))
                    async def receive(cid,event):return await worker.runtime.receive(cid,handle.lease_id,worker.owner,handle.fence,event)
                    await listener.handle(value,receive,source=ws,revision=listener.revision)
            if change!='other_org':
                assert rejected.value.status_code==403
                assert rejected.value.detail==('TEAMS_CARD_RESPONSE_INVALID' if provider=='teams' else 'SLACK_SELECTION_INVALID')
            db.expire_all();assert db.query(ChannelMessage).count()==before and db.query(ChannelConnectionDelivery).count()==deliveries
            if provider=='slack':assert not any(x.get('envelope_id')=='selection' for x in ws.sent)
        finally:await worker.stop()
    asyncio.run(run())
