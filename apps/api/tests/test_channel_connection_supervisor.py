import asyncio
from types import SimpleNamespace
import pytest
from test_channel_connection_state import KEY
from test_channel_connection_state import state_db


def config(enabled=False, key=""):
    return SimpleNamespace(channel_connection_worker_enabled=enabled, channel_connection_encryption_key=key,
        channel_connection_key_version="v1", channel_connection_poll_seconds=0.02)


def test_disabled_worker_does_not_construct_session_or_query():
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    def forbidden(): pytest.fail("disabled worker touched DB")
    worker = ConnectionSupervisor(forbidden, config=config())
    async def run():
        await worker.start(); assert worker.task is None; await worker.stop()
    asyncio.run(run())


def test_invalid_key_prevents_any_session_or_adapter():
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    from fastapi import HTTPException
    worker = ConnectionSupervisor(lambda: pytest.fail("invalid key touched DB"), config=config(True, "bad"))
    with pytest.raises(HTTPException): asyncio.run(worker.start())


def test_registry_defaults_empty_and_shutdown_cancels_cleanly():
    from app.services.channel_connection_supervisor import ConnectionSupervisor, ADAPTERS
    worker = ConnectionSupervisor(lambda: pytest.fail("empty registry touched DB"), config=config(True, KEY), adapters={})
    async def run():
        await worker.start(); await asyncio.sleep(0.03); await worker.stop(); assert worker.task is None
    asyncio.run(run())


@pytest.mark.parametrize("crash", [False, True])
def test_synthetic_listener_graceful_disconnect_or_crash_is_closed(state_db, crash, caplog):
    from sqlalchemy.orm import sessionmaker
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    from app.services.channel_connections import encrypt_credentials, disconnect_connection
    from app.models import ChannelConnection
    db, row = state_db
    row.credential_ciphertext = encrypt_credentials({"bot_token": "synthetic"}, row.organization_id, row.id, KEY, "v1")
    row.credential_key_version = "v1"; db.commit()
    class Listener:
        closed = False
        async def listen(self, receive):
            if crash: raise RuntimeError("synthetic-sensitive-provider-payload")
            await asyncio.Event().wait()
        async def close(self): self.closed = True
        async def update(self, targets): pass
    listener = Listener()
    class Adapter:
        async def verify(self, target, credentials):
            return {"installation_id": "i", "account_id": "a"}
        async def open(self, targets, credentials, identity): return listener
    worker = ConnectionSupervisor(sessionmaker(db.bind, expire_on_commit=False), config=config(True, KEY),
        adapters={"slack": Adapter()})
    async def run():
        await worker.tick()
        assert len(worker.handles) == 1
        await asyncio.sleep(0)
        if not crash:
            with SessionFactory() as session:
                disconnect_connection(session.get(ChannelConnection, row.id)); session.commit()
        await worker.tick()
        assert not worker.handles
        assert listener.closed
        await worker.stop()
    SessionFactory = sessionmaker(db.bind, expire_on_commit=False)
    asyncio.run(run())
    assert "synthetic-sensitive-provider-payload" not in caplog.text


def test_registered_enabled_connect_only_sets_desired_state(management, monkeypatch):
    from app.services.channel_connection_supervisor import ADAPTERS
    from app.models import ChannelConnection
    qa = management
    assert qa.client.post(qa.url, json=qa.payload).status_code == 200
    row = qa.db.query(ChannelConnection).one()
    monkeypatch.setattr(qa.settings, "channel_connection_worker_enabled", True)
    monkeypatch.setitem(ADAPTERS, "slack", object())
    response = qa.client.post(f"{qa.url}/{row.id}/connect")
    assert response.status_code == 200
    assert row.desired_state == "connected" and row.observed_state == "connecting"
    assert response.json()["data"]["identity_verified"] is False
    generation = row.generation
    assert qa.client.post(f"{qa.url}/{row.id}/connect").status_code == 200
    assert row.generation == generation


from test_channel_connections import management


def test_listener_update_removes_disconnected_target_and_keeps_other(state_db):
    from sqlalchemy.orm import sessionmaker
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    from app.services.channel_connections import encrypt_credentials, disconnect_connection
    from app.models import ChannelConnection
    db, first = state_db
    first.credential_ciphertext = encrypt_credentials({"bot_token": "synthetic"}, first.organization_id, first.id, KEY, "v1")
    first.credential_key_version = "v1"
    second = ChannelConnection(organization_id=first.organization_id, channel_id=first.channel_id, bot_id=first.bot_id,
        name="B", provider="slack", installation_id="i", account_id="a", target_id="other",
        desired_state="connected", observed_state="connecting")
    db.add(second); db.flush()
    second.credential_ciphertext = encrypt_credentials({"bot_token": "synthetic"}, second.organization_id, second.id, KEY, "v1")
    second.credential_key_version = "v1"; db.commit()
    class Listener:
        closed = False
        targets = set()
        async def listen(self, receive): await asyncio.Event().wait()
        async def update(self, targets): self.targets = {x.id for x in targets}
        async def close(self): self.closed = True
    listener = Listener()
    class Adapter:
        async def verify(self, target, credentials): return {"installation_id": "i", "account_id": "a"}
        async def open(self, targets, credentials, identity):
            await listener.update(targets)
            return listener
    factory = sessionmaker(db.bind, expire_on_commit=False)
    worker = ConnectionSupervisor(factory, config=config(True, KEY), adapters={"slack": Adapter()})
    async def run():
        try:
            await worker.tick()
            assert listener.targets == {first.id, second.id}
            with factory() as session:
                disconnect_connection(session.get(ChannelConnection, first.id)); session.commit()
            await worker.tick()
            assert listener.targets == {second.id}
            assert not listener.closed
            assert next(iter(worker.handles.values())).targets[0].id == second.id
        finally: await worker.stop()
    asyncio.run(run())
