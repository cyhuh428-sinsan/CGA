import asyncio,json,hashlib
from types import SimpleNamespace
from importlib import import_module
import pytest
from fastapi import HTTPException
from test_channel_connection_discord import Http,spec


def subject():return import_module('app.services.channel_connection_discord_gateway')


class Ws:
    def __init__(self,frames):
        self.queue=asyncio.Queue();self.sent=[];self.closed=False
        for frame in frames:self.queue.put_nowait(json.dumps(frame))
    async def recv(self):
        value=await self.queue.get()
        if isinstance(value,BaseException):raise value
        return value
    async def send(self,raw):self.sent.append(json.loads(raw))
    async def close(self,**kwargs):self.closed=True


class Socket:
    def __init__(self,ws):self.ws=ws;self.urls=[]
    async def open(self,url):self.urls.append(url);return self.ws


class Gate:
    def __init__(self,saved=None):self.saved=saved;self.sequences=[]
    def load_cursor(self):return self.saved
    def save_cursor(self,value):self.saved=value;self.sequences.append(value.get('sequence'))
    def start_cursor(self,value):self.save_cursor(value)
    def fresh_cutoff(self,targets):pass
    def pending_valid(self,target):return True
    def can_execute(self,item):return True
    def reset_cursor(self,targets,reason,from_sequence,through_sequence):self.saved={};self.reset=(reason,from_sequence,through_sequence)


def hello():return {'op':10,'d':{'heartbeat_interval':40000}}
def ready(**changes):return {'op':0,'t':'READY','s':1,'d':{'v':10,'user':{'id':'200','bot':True},'application':{'id':'100'},'session_id':'synthetic-session','resume_gateway_url':'wss://gateway.discord.gg',**changes}}
async def setup(frames,gate=None):
    module=import_module('app.services.channel_connection_discord');h=Http();h.responses['/gateway/bot']={'url':'wss://gateway.discord.gg','shards':1,'session_start_limit':{'remaining':5,'reset_after':1000,'max_concurrency':1}}
    adapter=module.DiscordAdapter(None,owner='c05',http=h);adapter.socket=Socket(Ws(frames));adapter.open_not_before={}
    s=spec();await adapter.verify(s,{'bot_token':'synthetic-only'});target=adapter.bindings[s.id]
    listener=await subject().open_gateway(adapter,[target],gate or Gate());return listener,adapter,target


def test_gateway_ready_is_required_before_connected_and_identify_is_minimal():
    async def run():
        gate=Gate();listener,adapter,target=await setup([hello(),ready()],gate)
        try:
            identify=adapter.socket.ws.sent[0];assert identify['op']==2 and identify['d']['intents']==4609
            assert gate.saved['session_id']=='synthetic-session' and gate.saved['sequence']==1 and listener.accepts_target(target)
            assert adapter.socket.urls==['wss://gateway.discord.gg/?v=10&encoding=json']
        finally:await listener.close()
        with pytest.raises(HTTPException):await setup([hello(),ready(user={'id':'201','bot':True})])
    asyncio.run(run())


def test_gateway_resume_buffers_replay_until_resumed_and_does_not_advance_early():
    async def run():
        gate=Gate({'application_id':'100','bot_user_id':'200','token_hash':hashlib.sha256(b'synthetic-only').hexdigest(),'session_id':'synthetic-session','resume_url':'wss://gateway.discord.gg/?v=10&encoding=json','sequence':7})
        replay={'op':0,'t':'UNKNOWN_EVENT','s':8,'d':{}}
        listener,adapter,target=await setup([hello(),replay,{'op':0,'t':'RESUMED','s':9,'d':{}}],gate)
        try:
            assert adapter.socket.ws.sent[0]['op']==6 and adapter.socket.ws.sent[0]['d']['seq']==7
            assert gate.sequences==[] and listener.resumed
            await listener.handle(replay,lambda _:None,source=listener.ws,revision=listener.revision);assert gate.sequences==[8]
            assert listener.received_sequence==9  # 수신 최고seq와 durable cursor는 다르다.
        finally:await listener.close()
    asyncio.run(run())


def test_heartbeat_ack_and_missed_ack_stop_receiver():
    async def run():
        listener,adapter,_=await setup([hello(),ready()])
        try:
            await listener.heartbeat_once();assert adapter.socket.ws.sent[-1]=={'op':1,'d':1}
            with pytest.raises(RuntimeError):await listener.heartbeat_once()
            await listener.control({'op':11});await listener.heartbeat_once()
        finally:await listener.close()
    asyncio.run(run())


@pytest.mark.parametrize('url',['ws://gateway.discord.gg','wss://evil.test','wss://gateway.discord.gg.evil.test','wss://@gateway.discord.gg','wss://gateway.discord.gg/x','wss://gateway.discord.gg/?token=private'])
def test_gateway_destination_is_fixed_and_has_no_auth_query(url):
    with pytest.raises(HTTPException):subject().validate_gateway_url(url)


def test_callback_transport_uses_type6_fixed_host_without_bot_authorization():
    m=import_module('app.services.channel_connection_discord');calls=[]
    def request(*args):calls.append(args);return 204,None
    h=m.DiscordHttpTransport(request=request);h.ack('600','synthetic-token')
    method,url,headers,body=calls[0];assert method=='POST' and url=='https://discord.com/api/v10/interactions/600/synthetic-token/callback'
    assert 'Authorization' not in headers and json.loads(body)=={'type':6}


def test_invalid_session_clears_only_gateway_context_and_never_reexecutes():
    async def run():
        gate=Gate();listener,_,_=await setup([hello(),ready()],gate)
        try:
            with pytest.raises(RuntimeError):await listener.control({'op':9,'d':False})
            assert gate.saved=={}
        finally:await listener.close()
    asyncio.run(run())


def test_failed_database_commit_does_not_advance_sequence():
    async def run():
        gate=Gate();listener,adapter,target=await setup([hello(),ready()],gate)
        try:
            from test_channel_connection_discord_runtime import message
            async def reject(*_):raise RuntimeError('synthetic DB commit failure')
            with pytest.raises(RuntimeError):await listener.handle(message(),reject,source=listener.ws,revision=listener.revision)
            assert gate.saved['sequence']==1 and gate.sequences==[1]
        finally:await listener.close()
    asyncio.run(run())


def test_default_websocket_disables_redirect_proxy_compression_and_sensitive_logging(monkeypatch):
    import websockets.asyncio.client as client
    captured={}
    class FakeConnect:
        def __init__(self,*args,**kwargs):captured.update(url=args[0],**kwargs);captured['redirect']=self.process_redirect(None)
        def __await__(self):
            async def done():return object()
            return done().__await__()
    monkeypatch.setattr(client,'connect',FakeConnect)
    asyncio.run(subject().DiscordSocketTransport().open('wss://gateway.discord.gg'))
    assert captured['proxy'] is None and captured['compression'] is None and captured['max_queue']==8 and captured['ping_interval'] is None
    assert captured['logger'].disabled and not captured['logger'].propagate and captured['redirect'].__class__.__name__=='SecurityError'


def saved_cursor():return {'application_id':'100','bot_user_id':'200','token_hash':hashlib.sha256(b'synthetic-only').hexdigest(),'session_id':'synthetic-session','resume_url':'wss://gateway.discord.gg/?v=10&encoding=json','sequence':7}


def test_deferred_replay_preserves_dispatch_completion_prefix_not_numeric_sequence():
    from dataclasses import replace
    from uuid import uuid4
    from test_channel_connection_discord_runtime import message
    async def run():
        gate=Gate();listener,adapter,binding=await setup([hello(),ready()],gate)
        pending=replace(binding.target,id=uuid4(),target_id='401');listener.pending_targets=[pending];accepted=[]
        async def receive(cid,event):accepted.append((cid,event['destination']['generation']));return uuid4()
        try:
            frame=message(channel='401');frame['s']=10
            await listener.handle(frame,receive,source=listener.ws,revision=0)
            frame2=message(offset=1);frame2['s']=100
            await listener.handle(frame2,receive,source=listener.ws,revision=0)
            assert listener.cursor['sequence']==1 and accepted==[(binding.target.id,1)]
            adapter.http.responses['/channels/401']={**adapter.http.responses['/channels/400'],'id':'401'}
            await adapter.verify(pending,{'bot_token':'synthetic-only'})
            await listener.update([binding.target,pending]);await listener._drain_deferred(receive)
            assert listener.cursor['sequence']==100 and accepted==[(binding.target.id,1),(pending.id,1)]
            assert not listener.deferred and not listener.checkpoints
        finally:await listener.close()
    asyncio.run(run())


@pytest.mark.parametrize('oversized',[True,False])
def test_deferred_replay_bound_resets_gap_instead_of_checkpointing(oversized):
    from dataclasses import replace
    from uuid import uuid4
    from test_channel_connection_discord_runtime import message
    async def run():
        gate=Gate();listener,adapter,binding=await setup([hello(),ready()],gate)
        listener.pending_targets=[replace(binding.target,id=uuid4(),target_id='401')]
        for index in range(1 if oversized else 65):
            frame=message(channel='401',offset=index)
            if oversized:frame['d']['pad']='x'*1048500
            await listener.ws.queue.put(json.dumps(frame))
        try:
            with pytest.raises(subject().ResumeWindowExceeded):await asyncio.wait_for(listener.listen(lambda *args:pytest.fail('unverified execution')),2)
            assert gate.saved=={} and gate.reset[0]=='DISCORD_RESUME_WINDOW_EXCEEDED'
        finally:await listener.close()
    asyncio.run(run())


def test_deferred_generation_change_resets_without_execution():
    from dataclasses import replace
    from uuid import uuid4
    from test_channel_connection_discord_runtime import message
    async def run():
        gate=Gate();listener,adapter,binding=await setup([hello(),ready()],gate)
        listener.pending_targets=[replace(binding.target,id=uuid4(),target_id='401')]
        async def forbidden(*args):pytest.fail('stale deferred execution')
        try:
            await listener.handle(message(channel='401'),forbidden,source=listener.ws,revision=0)
            gate.pending_valid=lambda target:False
            with pytest.raises(RuntimeError):await listener._drain_deferred(forbidden)
            assert gate.saved=={} and gate.reset[0]=='DISCORD_SESSION_INVALID'
        finally:await listener.close()
    asyncio.run(run())


def test_memory_cursor_advances_only_after_durable_save_confirmed():
    from threading import Event
    async def run():
        gate=Gate();listener,adapter,binding=await setup([hello(),ready()],gate)
        entered,release=Event(),Event();original=gate.save_cursor;handling=None
        def blocked(value):
            entered.set()
            if not release.wait(2):raise TimeoutError('synthetic commit barrier')
            original(value)
        gate.save_cursor=blocked
        try:
            handling=asyncio.create_task(listener.handle({'op':0,'t':'UNKNOWN_EVENT','s':2,'d':{}},lambda *args:None,source=listener.ws,revision=0))
            for _ in range(100):
                if entered.is_set():break
                await asyncio.sleep(.005)
            assert entered.is_set() and listener.cursor['sequence']==1 and gate.saved['sequence']==1
            release.set();await handling
            assert listener.cursor['sequence']==gate.saved['sequence']==2
        finally:
            release.set()
            if handling:await handling
            await listener.close()
    asyncio.run(run())


@pytest.mark.parametrize('code',[4007,4009])
@pytest.mark.parametrize('phase',['handshake','listen'])
def test_expired_close_code_discards_resume_and_next_connection_identifies(code,phase):
    async def run():
        from websockets.exceptions import ConnectionClosedError
        from websockets.frames import Close
        gate=Gate(saved_cursor())
        if phase=='handshake':
            module=import_module('app.services.channel_connection_discord');h=Http();h.responses['/gateway/bot']={'url':'wss://gateway.discord.gg','shards':1,'session_start_limit':{'remaining':5}}
            ws=Ws([hello()]);original=ws.recv
            async def recv():
                if not ws.queue.empty():return await original()
                raise ConnectionClosedError(Close(code,'synthetic'),None)
            ws.recv=recv;adapter=module.DiscordAdapter(None,owner='c05',http=h,socket=Socket(ws));s=spec();await adapter.verify(s,{'bot_token':'synthetic-only'});target=adapter.bindings[s.id]
            with pytest.raises(HTTPException):await subject().open_gateway(adapter,[target],gate)
        else:
            listener,adapter,_=await setup([hello(),{'op':0,'t':'RESUMED','s':8,'d':{}}],gate)
            async def recv():raise ConnectionClosedError(Close(code,'synthetic'),None)
            adapter.socket.ws.recv=recv
            try:
                with pytest.raises(ConnectionClosedError):await listener.listen(lambda _:None)
            finally:await listener.close()
        assert gate.saved=={} and gate.reset[0]=='DISCORD_SESSION_EXPIRED'
        listener,adapter,_=await setup([hello(),ready()],gate)
        try:assert adapter.socket.ws.sent[0]['op']==2
        finally:await listener.close()
    asyncio.run(run())


@pytest.mark.parametrize('count,oversized',[(63,False),(64,False),(1,True)])
def test_resume_buffer_boundary_has_fresh_session_recovery(count,oversized):
    async def run():
        gate=Gate(saved_cursor());frames=[hello()]+[{'op':0,'t':'UNKNOWN_EVENT','s':8+i,'d':{'pad':'x'*1048500 if oversized else ''}} for i in range(count)]+[{'op':0,'t':'RESUMED','s':8+count,'d':{}}]
        if count==63:
            listener,adapter,_=await setup(frames,gate)
            try:assert listener.resumed and len(listener.buffer)==64 and gate.saved['sequence']==7
            finally:await listener.close()
        else:
            with pytest.raises(HTTPException):await setup(frames,gate)
            assert gate.saved=={} and gate.reset[0]=='DISCORD_RESUME_WINDOW_EXCEEDED'
            listener,adapter,_=await setup([hello(),ready()],gate)
            try:assert adapter.socket.ws.sent[0]['op']==2
            finally:await listener.close()
    asyncio.run(run())
