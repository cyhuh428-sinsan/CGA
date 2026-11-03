from types import SimpleNamespace
import pytest
from fastapi import FastAPI,HTTPException
from fastapi.testclient import TestClient
from app.api.routes import channel_connection_events as route
from test_channel_connection_state import KEY


def client(monkeypatch,*,enabled=True,fail=False):
    calls=[]
    async def receive(header,body):
        calls.append((header,body))
        if fail:raise HTTPException(503,'SYNTHETIC_COMMIT_FAILED')
    monkeypatch.setattr(route.settings,'channel_connection_worker_enabled',enabled)
    monkeypatch.setattr(route.settings,'channel_connection_encryption_key',KEY)
    monkeypatch.setitem(route.ADAPTERS,'google_chat',SimpleNamespace(receive=receive))
    app=FastAPI();app.include_router(route.router,prefix='/api/v1');return TestClient(app),calls


def test_disabled_receiver_never_reads_provider_or_executes(monkeypatch):
    c,calls=client(monkeypatch,enabled=False);r=c.post('/api/v1/channel-connections/google-chat/events',json={})
    assert r.status_code==503 and calls==[]


def test_empty_ack_is_returned_only_after_committed_receive(monkeypatch):
    c,calls=client(monkeypatch);r=c.post('/api/v1/channel-connections/google-chat/events',json={'type':'MESSAGE'},headers={'Authorization':'Bearer synthetic-only'})
    assert r.status_code==200 and r.json()=={} and calls==[('Bearer synthetic-only',{'type':'MESSAGE'})]


def test_failed_commit_never_returns_success_or_retries(monkeypatch):
    c,calls=client(monkeypatch,fail=True);r=c.post('/api/v1/channel-connections/google-chat/events',json={})
    assert r.status_code==503 and len(calls)==1


@pytest.mark.parametrize('payload,expected',[(b'[]',422),(b'{',422),(b'x'*(256*1024+1),413)],ids=['non-object','bad-json','oversized'])
def test_invalid_or_oversized_body_never_reaches_adapter(monkeypatch,payload,expected):
    c,calls=client(monkeypatch);r=c.post('/api/v1/channel-connections/google-chat/events',content=payload,headers={'Content-Type':'application/json'})
    assert r.status_code==expected and calls==[]


@pytest.mark.parametrize('header,status',[('262145',413),('-1',400),('invalid',400)])
def test_invalid_content_length_stops_before_adapter(monkeypatch,header,status):
    c,calls=client(monkeypatch);r=c.post('/api/v1/channel-connections/google-chat/events',content=b'{}',headers={'content-length':header})
    assert r.status_code==status and not calls


@pytest.mark.parametrize('key',['','invalid'])
def test_missing_or_invalid_key_stops_before_adapter(monkeypatch,key):
    c,calls=client(monkeypatch);monkeypatch.setattr(route.settings,'channel_connection_encryption_key',key)
    assert c.post('/api/v1/channel-connections/google-chat/events',json={}).status_code==503 and not calls


def test_absent_adapter_stops_before_body(monkeypatch):
    c,calls=client(monkeypatch);monkeypatch.delitem(route.ADAPTERS,'google_chat')
    assert c.post('/api/v1/channel-connections/google-chat/events',content=b'malformed').status_code==503 and not calls


def test_streaming_limit_does_not_depend_on_content_length(monkeypatch):
    import asyncio
    chunks=[]
    class Request:
        headers={}
        async def stream(self):
            for chunk in [b' '*(256*1024),b'X',b'never']:
                chunks.append(len(chunk));yield chunk
    c,calls=client(monkeypatch)
    with pytest.raises(HTTPException) as error:asyncio.run(route.google_chat_event(Request()))
    assert error.value.status_code==413 and chunks==[256*1024,1] and calls==[]


def test_main_registry_owner_and_disabled_start_have_zero_resource_access():
    import asyncio
    from app.main import connection_supervisor
    from app.services.channel_connection_google_chat import GoogleChatAdapter
    from app.services.channel_connection_supervisor import ADAPTERS,ConnectionSupervisor
    assert isinstance(ADAPTERS.get('google_chat'),GoogleChatAdapter)
    assert ADAPTERS['google_chat'].owner==connection_supervisor.owner
    def forbidden():pytest.fail('disabled receiver accessed resource')
    worker=ConnectionSupervisor(forbidden,config=SimpleNamespace(channel_connection_worker_enabled=False,
        channel_connection_encryption_key='',channel_connection_key_version='v1'))
    asyncio.run(worker.start());assert worker.task is None
