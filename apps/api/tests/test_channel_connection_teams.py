"""공개 endpoint는 worker/key/body 경계를 인증 및 DB 접근 전에 적용한다."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from test_channel_connection_state import KEY


@pytest.fixture
def receiver(monkeypatch):
    from app.api.routes.channel_connection_events import router
    from app.core.config import settings
    from app.services.channel_connection_supervisor import ADAPTERS
    class Adapter:
        calls = []
        async def receive(self, authorization, value):
            self.calls.append((authorization, value))
            return {"accepted": True}
    adapter = Adapter()
    monkeypatch.setitem(ADAPTERS, "ms_teams", adapter)
    monkeypatch.setattr(settings, "channel_connection_worker_enabled", True)
    monkeypatch.setattr(settings, "channel_connection_encryption_key", KEY)
    app = FastAPI(); app.include_router(router, prefix="/api/v1")
    with TestClient(app) as client:
        yield client, settings, adapter


def test_disabled_receiver_never_reads_or_authenticates(receiver, monkeypatch):
    client, settings, adapter = receiver
    monkeypatch.setattr(settings, "channel_connection_worker_enabled", False)
    response = client.post("/api/v1/channel-connections/ms-teams/events", content=b"malformed")
    assert response.status_code == 503 and not adapter.calls


def test_empty_key_blocks_receiver(receiver, monkeypatch):
    client, settings, adapter = receiver
    monkeypatch.setattr(settings, "channel_connection_encryption_key", "")
    assert client.post("/api/v1/channel-connections/ms-teams/events", json={}).status_code == 503
    assert not adapter.calls


def test_invalid_key_blocks_receiver_before_authentication(receiver, monkeypatch):
    client, settings, adapter = receiver
    monkeypatch.setattr(settings, "channel_connection_encryption_key", "invalid")
    assert client.post("/api/v1/channel-connections/ms-teams/events", json={}).status_code == 503
    assert not adapter.calls


@pytest.mark.parametrize("content,headers,status", [
    (b"{}", {"content-length": "262145"}, 413),
    (b"x" * 262145, {}, 413), (b"[]", {}, 422), (b"broken", {}, 422),
    (b"{}", {"content-length": "-1"}, 400),
], ids=["declared-limit", "stream-limit", "array", "malformed", "negative-length"])
def test_body_rejection_before_adapter(receiver, content, headers, status):
    client, settings, adapter = receiver
    response = client.post("/api/v1/channel-connections/ms-teams/events", content=content, headers=headers)
    assert response.status_code == status and not adapter.calls


def test_authenticated_adapter_is_only_ack_authority(receiver):
    client, settings, adapter = receiver
    response = client.post("/api/v1/channel-connections/ms-teams/events", json={"type": "message"},
                           headers={"authorization": "Bearer synthetic"})
    assert response.status_code == 200 and response.json() == {}
    assert adapter.calls == [("Bearer synthetic", {"type": "message"})]


def test_main_registers_only_teams_with_matching_supervisor_owner_and_disabled_start():
    import asyncio
    from types import SimpleNamespace
    from app.main import connection_supervisor
    from app.services.channel_connection_supervisor import ADAPTERS, ConnectionSupervisor
    from app.services.channel_connection_teams import TeamsAdapter
    assert set(ADAPTERS) == {"ms_teams"}
    assert isinstance(ADAPTERS["ms_teams"], TeamsAdapter)
    assert ADAPTERS["ms_teams"].owner == connection_supervisor.owner
    config = SimpleNamespace(channel_connection_worker_enabled=False, channel_connection_encryption_key="",
        channel_connection_key_version="v1")
    def forbidden(): pytest.fail("disabled Teams worker touched DB")
    worker = ConnectionSupervisor(forbidden, config=config)
    async def run():
        await worker.start(); assert worker.task is None; await worker.stop()
    asyncio.run(run())
