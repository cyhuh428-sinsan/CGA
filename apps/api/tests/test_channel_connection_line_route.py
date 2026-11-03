from types import SimpleNamespace
import pytest
from fastapi import FastAPI,HTTPException
from fastapi.testclient import TestClient
from app.api.routes import channel_connection_events as route
from test_channel_connection_state import KEY

def client(monkeypatch,enabled=True,fail=False):
    calls=[]
    async def receive(header,body):
        calls.append((header,body))
        if fail:raise HTTPException(503,'SYNTHETIC_COMMIT_FAILED')
    monkeypatch.setattr(route.settings,'channel_connection_worker_enabled',enabled)
    monkeypatch.setattr(route.settings,'channel_connection_encryption_key',KEY)
    monkeypatch.setitem(route.ADAPTERS,'line',SimpleNamespace(receive=receive))
    app=FastAPI();app.include_router(route.router,prefix='/api/v1');return TestClient(app),calls

def test_disabled_line_receiver_never_executes(monkeypatch):
    c,calls=client(monkeypatch,False);r=c.post('/api/v1/channel-connections/line/events',content=b'{}');assert r.status_code==503 and not calls

def test_line_signature_receives_unmodified_bytes_before_json(monkeypatch):
    c,calls=client(monkeypatch);raw=b'{ "events": [], "destination": "synthetic-only" }';r=c.post('/api/v1/channel-connections/line/events',content=raw,headers={'x-line-signature':'synthetic-signature'})
    assert r.status_code==200 and r.json()=={} and calls==[('synthetic-signature',raw)]

def test_line_commit_failure_is_not_acknowledged_or_retried(monkeypatch):
    c,calls=client(monkeypatch,fail=True);r=c.post('/api/v1/channel-connections/line/events',content=b'{}');assert r.status_code==503 and len(calls)==1

def test_line_large_body_is_rejected_before_adapter(monkeypatch):
    c,calls=client(monkeypatch);r=c.post('/api/v1/channel-connections/line/events',content=b'x'*262145);assert r.status_code==413 and not calls


@pytest.mark.parametrize('length,status',[('-1',400),('broken',400),('262145',413)])
def test_line_declared_body_boundary_precedes_adapter(monkeypatch,length,status):
    c,calls=client(monkeypatch)
    result=c.post('/api/v1/channel-connections/line/events',content=b'{',headers={'content-length':length})
    assert result.status_code==status and calls==[]


@pytest.mark.parametrize('disabled',['key','invalid-key','adapter'])
def test_line_missing_runtime_configuration_rejects_before_adapter(monkeypatch,disabled):
    c,calls=client(monkeypatch)
    if disabled=='key':monkeypatch.setattr(route.settings,'channel_connection_encryption_key','')
    if disabled=='invalid-key':monkeypatch.setattr(route.settings,'channel_connection_encryption_key','invalid')
    if disabled=='adapter':monkeypatch.delitem(route.ADAPTERS,'line')
    result=c.post('/api/v1/channel-connections/line/events',content=b'{')
    assert result.status_code==503 and not calls


from test_channel_connection_line_runtime import line,state_db,native_orm_bindings,event,raw,signature


def test_signed_asgi_route_executes_real_native_and_sends_actual_answer(line,monkeypatch):
    import asyncio,httpx
    from app.models import ChannelMessage,ChannelConnectionDelivery
    from test_channel_connection_state import KEY
    db,row,credentials,target,a,w,h=line
    monkeypatch.setattr(route.settings,'channel_connection_worker_enabled',True)
    monkeypatch.setattr(route.settings,'channel_connection_encryption_key',KEY)
    monkeypatch.setitem(route.ADAPTERS,'line',a)
    app=FastAPI();app.include_router(route.router,prefix='/api/v1')
    async def run():
        task=None
        try:
            await w.tick()
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://qa.invalid') as c:
                bad=await c.post('/api/v1/channel-connections/line/events',content=b'{',headers={'x-line-signature':signature(b'{}')})
                assert bad.status_code==401 and h.posts==[]
                body=raw(event());task=asyncio.create_task(c.post('/api/v1/channel-connections/line/events',content=body,headers={'x-line-signature':signature(body)}))
                for _ in range(120):
                    await asyncio.sleep(.02);await w.tick()
                    if task.done():break
                result=await task;assert result.status_code==200 and result.json()=={}
                await w.tick();await w.tick()
                duplicate=await c.post('/api/v1/channel-connections/line/events',content=body,headers={'x-line-signature':signature(body)})
                assert duplicate.status_code==200 and duplicate.json()=={}
            db.expire_all();assert db.query(ChannelConnectionDelivery).one().status=='sent' and db.query(ChannelMessage).count()==2
            assert h.posts[0]['messages']==[dict(type='text',text='fixed QA answer')] and len(h.posts)==1
        finally:
            if task and not task.done():task.cancel()
            await w.stop()
    asyncio.run(run())
