"""합성 adapter와 실제 native/DB 실행. paid model·외부 network를 사용하지 않는다."""
from types import SimpleNamespace
from uuid import uuid4
import asyncio
import json
import pytest
from fastapi import HTTPException
from sqlalchemy import select
from test_channel_connection_state import state_db, activated, event, KEY


@pytest.fixture(autouse=True)
def native_orm_bindings(monkeypatch):
    # 기존 runtime_flow는 수집 시 channels를 fake model로 import한다.
    # 이 실제 ORM 검사는 실제 class binding으로 실행하고 종료 후 원상복원한다.
    import app.models as models
    from app.api.routes import channels
    import sys
    for module_name, module in list(sys.modules.items()):
        if not module_name.startswith("app.") or module is None: continue
        for name in dir(models):
            value = getattr(models, name)
            old = getattr(module, name, None)
            if isinstance(value, type) and hasattr(value, "__table__") and isinstance(old, type) and old is not value and old.__module__.startswith("test_"):
                monkeypatch.setattr(module, name, value)


class SyntheticListener:
    def __init__(self): self.sent = []; self.closed = False
    async def send(self, target, packets, context):
        self.sent.append(packets)
        return ["synthetic-provider-message"]
    async def close(self): self.closed = True
    async def update(self, targets): pass


@pytest.mark.parametrize('reject',[False,True])
def test_optional_prepare_send_uses_held_session_and_preserves_unknown(state_db,reject):
    from app.models import ChannelConnectionDelivery
    from sqlalchemy.orm import object_session
    s,db,row,lease,factory,runtime=seed_native(state_db)
    prepared=[];failures=[]
    class Guarded(SyntheticListener):
        def prepare_send(self,session,target,item,incoming,packets,*,cancelled):
            assert object_session(item) is session and item.status=='sending' and item.send_claim_id
            assert not cancelled.is_set() and target.id==row.id and incoming['message']=='question'
            prepared.append(item.id)
            if reject:raise HTTPException(409,'SYNTHETIC_PREPARE_REJECTED')
            return 'synthetic-guard'
        async def send(self,target,packets,incoming,*,send_guard):
            assert send_guard=='synthetic-guard';return await super().send(target,packets,incoming)
        def record_send_failure(self,session,target,error,*scope):failures.append(error)
    listener=Guarded()
    async def run():
        did=await runtime.receive(row.id,lease.id,'worker-1',1,event(channelId='C123'))
        await runtime.process_one(row.id,lease.id,'worker-1',1,listener)
        db.expire_all();item=db.get(ChannelConnectionDelivery,did)
        assert prepared==[did]
        assert item.status==('unknown' if reject else 'sent')
        assert len(listener.sent)==(0 if reject else 1)
        if reject:
            from fastapi import HTTPException as ExpectedHTTPException
            assert len(failures)==1 and isinstance(failures[0],ExpectedHTTPException)
            assert failures[0].status_code==409 and failures[0].detail=='SYNTHETIC_PREPARE_REJECTED'
        else:assert failures==[]
    asyncio.run(run())


def seed_native(state_db):
    from app.models import Base, Bot, BotVersion
    s, db, row, lease = activated(state_db)
    for table in Base.metadata.tables.values(): table.create(db.bind, checkfirst=True)
    bot = db.get(Bot, row.bot_id)
    version = BotVersion(bot_id=bot.id, name="v1", version_no=1, status="active", version_json={
        "dialogs": [{"id": "qa-intent", "name": "QA", "utterances": ["question"], "response": "fixed QA answer"}], "graphs": []})
    db.add(version); db.flush(); bot.active_version_id = version.id
    bot.data_json = {"nlu_type": "ml", "nlu_model": "deep_learning_lite", "answer_mode": "fixed"}
    db.commit()
    from app.services.channel_connection_runtime import ConnectionRuntime
    from sqlalchemy.orm import sessionmaker
    factory = sessionmaker(db.bind, expire_on_commit=False)
    return s, db, row, lease, factory, ConnectionRuntime(factory, key=KEY, version="v1")


def test_listener_eligibility_prevents_native_claim_and_message(state_db):
    from app.models import ChannelConnectionDelivery,ChannelMessage
    s,db,row,lease,factory,runtime=seed_native(state_db)
    listener=SyntheticListener();listener.can_execute=lambda item:False
    async def run():
        did=await runtime.receive(row.id,lease.id,'worker-1',1,event())
        assert not await runtime.process_one(row.id,lease.id,'worker-1',1,listener)
        db.expire_all();assert db.get(ChannelConnectionDelivery,did).status=='received'
        assert db.query(ChannelMessage).count()==0 and listener.sent==[]
    asyncio.run(run())


def test_ready_resume_sends_existing_execution_without_second_native_claim(state_db):
    from app.models import ChannelConnectionDelivery,ChannelMessage
    s,db,row,lease,factory,runtime=seed_native(state_db)
    listener=SyntheticListener();listener.can_execute=lambda item:True
    async def run():
        did=await runtime.receive(row.id,lease.id,'worker-1',1,event(channelId='C123'))
        assert await asyncio.to_thread(runtime._execute_one,row.id,lease.id,'worker-1',1,listener.can_execute)==did
        db.expire_all();assert db.get(ChannelConnectionDelivery,did).status=='ready' and db.query(ChannelMessage).count()==2
        listener.can_execute=lambda item:False
        assert await runtime.process_one(row.id,lease.id,'worker-1',1,listener)
        db.expire_all();assert db.get(ChannelConnectionDelivery,did).status=='sent' and db.query(ChannelMessage).count()==2
        assert len(listener.sent)==1
    asyncio.run(run())


def test_receive_real_native_fixed_answer_and_send(state_db, monkeypatch):
    from app.services.channel_connection_runtime import ConnectionRuntime
    import socket
    runner = asyncio.Runner()
    runner.get_loop()  # Windows asyncio 자체 socketpair는 외부 연결 금지 이전에 생성.
    monkeypatch.setattr(socket.socket, "connect", lambda *a, **kw: pytest.fail("external connection forbidden"))
    from app.models import (Base, Bot, BotVersion, ChannelRoom, ChannelMessage, ChannelQueueEvent,
        ChannelConnectionDelivery, ChannelConnectionRoom)
    s, db, row, lease = activated(state_db)
    # 빠른 SQLite 핵심흐름에서 기존 native 조회가 필요로 하는 빈 시스템 table도 생성.
    for table in Base.metadata.tables.values():
        table.create(db.bind, checkfirst=True)
    bot = db.get(Bot, row.bot_id)
    version = BotVersion(bot_id=bot.id, name="v1", version_no=1, status="active", version_json={
        "dialogs": [{"id": "qa-intent", "name": "QA", "utterances": ["question"], "response": "fixed QA answer"}],
        "graphs": []})
    db.add(version); db.flush(); bot.active_version_id = version.id
    bot.data_json = {"nlu_type": "ml", "nlu_model": "deep_learning_lite", "answer_mode": "fixed"}
    db.commit()
    listener = SyntheticListener()
    runtime = ConnectionRuntime(lambda: db, key=KEY, version="v1")
    # Session 소유권은 production와 동일하게 scope마다 종료되어야 하므로 별도 factory를 사용.
    from sqlalchemy.orm import sessionmaker
    runtime.session_factory = sessionmaker(db.bind, expire_on_commit=False)
    incoming = event(channelId="C123ABC")
    delivery_id = runner.run(runtime.receive(row.id, lease.id, "worker-1", 1, incoming))
    assert runner.run(runtime.process_one(row.id, lease.id, "worker-1", 1, listener)) is True
    db.expire_all()
    item = db.get(ChannelConnectionDelivery, delivery_id)
    assert item.status == "sent"
    assert item.room_id and item.request_message_id and item.queue_event_id
    assert db.scalar(select(ChannelConnectionRoom.room_id)) == item.room_id
    assert db.scalar(select(ChannelQueueEvent.status)) == "completed"
    assert db.scalar(select(ChannelMessage.text).where(ChannelMessage.participant_kind == "bot")) == "fixed QA answer"
    assert listener.sent == [[{"channel": "C123ABC", "text": "fixed QA answer", "mrkdwn": False,
        "parse": "none", "unfurl_links": False, "unfurl_media": False}]]
    assert "raw-room-sensitive" not in json.dumps(item.result_json)
    assert "raw-actor-sensitive" not in json.dumps(item.event_json)
    assert runner.run(runtime.receive(row.id, lease.id, "worker-1", 1, incoming)) == delivery_id
    assert runner.run(runtime.process_one(row.id, lease.id, "worker-1", 1, listener)) is False
    assert len(listener.sent) == 1
    runner.close()


def test_event_crypto_aad_and_no_credential_cross_decryption():
    from app.services.channel_connections import encrypt_event_context, decrypt_event_context, decrypt_credentials
    from fastapi import HTTPException
    org, delivery = uuid4(), uuid4()
    encrypted = encrypt_event_context({"replyToken": "synthetic-sensitive"}, org, delivery, KEY, "v1")
    assert decrypt_event_context(encrypted, org, delivery, KEY, "v1") == {"replyToken": "synthetic-sensitive"}
    for args in ((uuid4(), delivery, "v1"), (org, uuid4(), "v1"), (org, delivery, "v2")):
        with pytest.raises(HTTPException): decrypt_event_context(encrypted, args[0], args[1], KEY, args[2])
    with pytest.raises(HTTPException): decrypt_credentials(encrypted, org, delivery, KEY, "v1")


@pytest.mark.parametrize("channel,admin", [("slack","SLACK"),("discord","DISCORD"),("telegram","TELEGRAM"),("google-chat","GOOGLE_CHAT"),("line","LINE")])
def test_new_native_channel_uses_canonical_admin_and_template(channel, admin):
    from app.api.routes import channels
    assert channels._ensure_channel(channel) == channel
    assert channels._channel_admin_code(channel) == admin
    assert channels._channel_template_code(channel) == admin


def test_legacy_channels_and_unknown_do_not_require_node(monkeypatch):
    from app.api.routes import channels
    from app.core.config import settings
    from fastapi import HTTPException
    monkeypatch.setattr(settings, "channel_connection_node_binary", "missing-node-for-legacy-test")
    for value in ("webchat", "kakao", "ms-teams"):
        assert channels._ensure_channel(value) == value
    with pytest.raises(HTTPException) as error: channels._ensure_channel("unknown")
    assert error.value.status_code == 404


@pytest.mark.parametrize("invalidation", ["generation", "fence"])
def test_invalidation_after_native_room_commit_stops_message(state_db, monkeypatch, invalidation):
    from app.services import channel_runtime_native as native
    from app.services.channel_connections import disconnect_connection
    from app.models import ChannelConnection, ChannelMessage, ChannelQueueEvent, ChannelConnectionDelivery
    from fastapi import HTTPException
    from datetime import timedelta
    s, db, row, lease, factory, runtime = seed_native(state_db)
    original = native.open_native_channel_room
    def invalidate(session, command):
        result = original(session, command)
        with factory() as other:
            changed = other.get(ChannelConnection, row.id)
            if invalidation == "generation": disconnect_connection(changed)
            else:
                from app.models import ChannelInstallationLease
                current = other.get(ChannelInstallationLease, lease.id)
                current.lease_expires_at = s.clock(other) - timedelta(seconds=1)
                other.flush()
                assert s.claim_installation(other, changed, "worker-2", ttl_seconds=30).fence == 2
            other.commit()
        return result
    monkeypatch.setattr(native, "open_native_channel_room", invalidate)
    listener = SyntheticListener()
    delivery = asyncio.run(runtime.receive(row.id, lease.id, "worker-1", 1, event(channelId="C123")))
    with pytest.raises(HTTPException): asyncio.run(runtime.process_one(row.id, lease.id, "worker-1", 1, listener))
    db.expire_all()
    assert db.query(ChannelMessage).count() == 0 and db.query(ChannelQueueEvent).count() == 0
    assert db.get(ChannelConnectionDelivery, delivery).status == "unknown"
    assert listener.sent == []


def test_unknown_send_after_native_commit_never_executes_or_sends_again(state_db):
    from app.models import ChannelConnectionDelivery, ChannelMessage
    s, db, row, lease, factory, runtime = seed_native(state_db)
    class UnknownListener(SyntheticListener):
        async def send(self, target, packets, context):
            self.sent.append(packets)
            raise TimeoutError("synthetic-sensitive-reply-token")
    listener = UnknownListener()
    delivery = asyncio.run(runtime.receive(row.id, lease.id, "worker-1", 1, event(channelId="C123")))
    assert asyncio.run(runtime.process_one(row.id, lease.id, "worker-1", 1, listener))
    assert not asyncio.run(runtime.process_one(row.id, lease.id, "worker-1", 1, listener))
    db.expire_all()
    assert db.get(ChannelConnectionDelivery, delivery).status == "unknown"
    assert db.query(ChannelMessage).count() == 2
    assert len(listener.sent) == 1


def test_supervisor_synthetic_adapter_receive_native_fixed_qa_send(state_db):
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    from app.services.channel_connections import encrypt_credentials
    from app.models import ChannelConnectionDelivery, ChannelQueueEvent
    s, db, row, lease, factory, runtime = seed_native(state_db)
    lease.owner = None
    lease.lease_expires_at = s.clock(db)
    row.credential_ciphertext = encrypt_credentials({"bot_token": "synthetic"}, row.organization_id, row.id, KEY, "v1")
    row.credential_key_version = "v1"; db.commit()
    class Listener(SyntheticListener):
        received = asyncio.Event()
        async def listen(self, receive):
            await receive(row.id, event(channelId="C123"))
            self.received.set()
            await asyncio.Event().wait()
    listener = Listener()
    class Adapter:
        async def verify(self, target, credentials): return {"installation_id": "i", "account_id": "a"}
        async def open(self, targets, credentials, identity): return listener
    config = SimpleNamespace(channel_connection_worker_enabled=True, channel_connection_encryption_key=KEY,
        channel_connection_key_version="v1")
    worker = ConnectionSupervisor(factory, config=config, adapters={"slack": Adapter()})
    async def run():
        try:
            await worker.tick()
            handle = next(iter(worker.handles.values()))
            received = asyncio.create_task(listener.received.wait())
            try:
                done, _ = await asyncio.wait({handle.task, received}, timeout=2, return_when=asyncio.FIRST_COMPLETED)
                if handle.task in done: await handle.task
                assert received in done
            finally:
                received.cancel()
            await worker.tick()
        finally: await worker.stop()
    asyncio.run(run())
    db.expire_all()
    assert db.query(ChannelConnectionDelivery).one().status == "sent"
    assert db.query(ChannelQueueEvent).one().status == "completed"
    assert len(listener.sent) == 1 and listener.sent[0][0]["text"] == "fixed QA answer"
    assert listener.closed


def test_database_wait_does_not_block_async_listener_loop():
    """DB session이 기다려도 async 수신 loop의 해제 처리가 실행된다."""
    from threading import Event
    from app.services.channel_connection_runtime import ConnectionRuntime
    entered, release = Event(), Event()
    class BlockedSession:
        def __enter__(self):
            entered.set()
            if not release.wait(timeout=0.5): raise TimeoutError("DB wait blocked event loop")
            raise RuntimeError("finished synthetic DB boundary")
        def __exit__(self, *args): pass
    runtime = ConnectionRuntime(BlockedSession, key=KEY, version="v1")
    async def run():
        async def release_on_loop():
            while not entered.is_set(): await asyncio.sleep(0.001)
            release.set()
        releaser = asyncio.create_task(release_on_loop())
        try:
            with pytest.raises(RuntimeError, match="finished synthetic DB boundary"):
                await runtime.receive(uuid4(), uuid4(), "owner", 1, event())
        finally:
            release.set()
            await releaser
    asyncio.run(run())


@pytest.mark.parametrize('hook_fails',[False,True])
def test_send_failure_hook_uses_existing_transaction_and_failure_preserves_unknown(state_db,hook_fails):
    from app.models import ChannelConnectionDelivery,ChannelConnection
    s,db,row,lease,factory,runtime=seed_native(state_db)
    class FailureListener(SyntheticListener):
        async def send(self,target,packets,context):raise TimeoutError('synthetic-only')
        def record_send_failure(self,session,target,error,installation_id,owner,fence):
            assert isinstance(error,TimeoutError)
            current=s._live(session,target.id,installation_id,owner,fence)
            current.last_error_code='SYNTHETIC_HOOK_MARKER'
            if hook_fails:raise RuntimeError('synthetic hook failure')
    listener=FailureListener()
    async def run():
        did=await runtime.receive(row.id,lease.id,'worker-1',1,event(channelId='C123'))
        assert await runtime.process_one(row.id,lease.id,'worker-1',1,listener)
        db.expire_all();item=db.get(ChannelConnectionDelivery,did)
        assert item.status=='unknown' and item.last_error_code=='DELIVERY_UNKNOWN'
        assert db.get(ChannelConnection,row.id).last_error_code==(None if hook_fails else 'SYNTHETIC_HOOK_MARKER')
    asyncio.run(run())
