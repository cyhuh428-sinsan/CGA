"""합성 값만 사용하는 연결 암호화·모델 계약 검사."""
import base64
from datetime import datetime, timedelta, timezone
from importlib import import_module, util
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

KEY = base64.urlsafe_b64encode(bytes(range(32))).decode()


def service():
    assert util.find_spec("app.services.channel_connections"), "credential service missing"
    return import_module("app.services.channel_connections")


def test_roundtrip_and_random_nonce():
    api = service()
    org, connection = uuid4(), uuid4()
    args = ({"bot_token": "synthetic-token"}, org, connection, KEY, "v1")
    ciphertext = api.encrypt_credentials(*args)
    assert ciphertext != api.encrypt_credentials(*args)
    assert "synthetic-token" not in ciphertext
    assert api.decrypt_credentials(ciphertext, *args[1:]) == args[0]


@pytest.mark.parametrize("position", [0, 1, 3])
def test_aad_mismatch_fails_closed(position):
    api = service()
    args = [uuid4(), uuid4(), KEY, "v1"]
    ciphertext = api.encrypt_credentials({"bot_token": "synthetic-token"}, *args)
    args[position] = "v2" if position == 3 else uuid4()
    with pytest.raises(HTTPException) as error:
        api.decrypt_credentials(ciphertext, *args)
    assert error.value.status_code == 503
    assert "synthetic-token" not in str(error.value)


@pytest.mark.parametrize("key", ["", "invalid", base64.b64encode(bytes(16)).decode()])
def test_invalid_key(key):
    api = service()
    with pytest.raises(HTTPException) as error:
        api.encrypt_credentials({"bot_token": "synthetic-token"}, uuid4(), uuid4(), key, "v1")
    assert error.value.status_code == 503


@pytest.mark.parametrize("credentials", [{}, {"unknown": "value"}, {"bot_token": " "}, {"bot_token": "등록됨"}, {"bot_token": "••••••••"}, {"bot_token": "****"}, {"bot_token": "a" * 32769}, {"bot_token": None}])
def test_invalid_credentials(credentials):
    with pytest.raises(HTTPException) as error:
        service().encrypt_credentials(credentials, uuid4(), uuid4(), KEY, "v1")
    assert error.value.status_code == 422


@pytest.mark.parametrize("provider, fields", [("ms_teams", {"client_id", "client_secret", "tenant_id"}), ("slack", {"bot_token", "app_token"}), ("discord", {"bot_token"}), ("telegram", {"bot_token"}), ("google_chat", {"service_account_json", "project_id"}), ("line", {"access_token", "channel_secret"})])
def test_provider_allowlist(provider, fields):
    api = service()
    api.validate_credentials(provider, {field: "synthetic" for field in fields})
    with pytest.raises(HTTPException):
        api.validate_credentials(provider, {"unknown": "synthetic"})
    other = "client_secret" if provider != "ms_teams" else "bot_token"
    with pytest.raises(HTTPException):
        api.validate_credentials(provider, {other: "synthetic"})


def test_serialize_hides_credentials_and_requires_live_lease():
    now = datetime.now(timezone.utc)
    row = SimpleNamespace(id=uuid4(), channel_id=uuid4(), bot_id=uuid4(), name="QA", provider="slack", installation_id="configured-installation", account_id="configured-account", target_id="configured-target", desired_state="connected", observed_state="connected", generation=1, credential_ciphertext="do-not-expose", last_error_code=None, last_checked_at=None, created_at=now, updated_at=now, lease_expires_at=now + timedelta(seconds=30))
    result = service().serialize_connection(row)
    assert result["credentials_registered"] is True
    assert result["identity_verified"] is True
    assert not any("ciphertext" in name or "token" in name for name in result)
    row.lease_expires_at = now - timedelta(seconds=1)
    result = service().serialize_connection(row)
    assert result["observed_state"] == "error"
    assert result["last_error_code"] == "LEASE_EXPIRED"


def test_models_registered_and_schema_secret_repr():
    import app.models as models
    for name in ["channel_connections", "channel_installation_leases", "channel_connection_rooms", "channel_connection_deliveries"]:
        assert name in models.Base.metadata.tables
    assert util.find_spec("app.schemas.channel_connection")
    schema = import_module("app.schemas.channel_connection").ConnectionWrite
    row = schema(name="QA", bot_id=uuid4(), installation_id="a", account_id="b", target_id="c", credentials={"bot_token": "synthetic-sensitive"})
    assert "synthetic-sensitive" not in repr(row)


@pytest.fixture
def management(monkeypatch):
    """실제 ORM/SQLite로 scope와 저장을 검증; 외부 I/O는 socket 단계에서 금지."""
    import socket
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.ext.compiler import compiles
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy.orm import Session
    from sqlalchemy.pool import StaticPool
    from app.api.deps import get_current_user, get_db
    from app.api.router import api_router
    from app.core.config import settings
    from app.models import Organization, Group, User, Role, UserRole, AdminChannel, Bot, ChannelConnection, AuditLog

    @compiles(JSONB, "sqlite")
    def jsonb_sqlite(_type, compiler, **kw):
        return "JSON"

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    tables = [x.__table__ for x in (Organization, Group, User, Role, UserRole, AdminChannel, Bot, ChannelConnection, AuditLog)]
    for table in tables:
        table.create(engine)
    db = Session(engine, expire_on_commit=False)
    org, other = Organization(name="QA", code="qa"), Organization(name="Other", code="other")
    db.add_all([org, other]); db.flush()
    group = Group(organization_id=org.id, code="qa", name="QA")
    db.add(group); db.flush()
    user = User(organization_id=org.id, group_id=group.id, name="QA", login_id="qa", password_hash="synthetic", status="active")
    role = Role(code="system_manager", name="QA")
    parent = AdminChannel(organization_id=org.id, code="SLACK", name="Slack", data_json={"provider": "slack"})
    foreign = AdminChannel(organization_id=other.id, code="SLACK", name="Other", data_json={"provider": "slack"})
    bot = Bot(organization_id=org.id, group_id=group.id, name="QA")
    foreign_bot = Bot(organization_id=other.id, group_id=group.id, name="Other")
    db.add_all([user, role, parent, foreign, bot, foreign_bot]); db.flush()
    db.add(UserRole(user_id=user.id, role_id=role.id)); db.commit()
    app = FastAPI()
    app.include_router(api_router, prefix="/api/v1")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    monkeypatch.setattr(settings, "channel_connection_encryption_key", KEY, raising=False)
    with TestClient(app) as client:
        # Windows 이벤트 루프의 자체 socketpair 생성 이후 외부 접속을 금지한다.
        monkeypatch.setattr(socket.socket, "connect", lambda *a, **k: pytest.fail("external network forbidden"))
        yield SimpleNamespace(client=client, db=db, user=user, role=role, parent=parent, foreign=foreign,
            bot=bot, foreign_bot=foreign_bot, settings=settings,
            url=f"/api/v1/admin/channels/{parent.id}/connections",
            payload=dict(name="QA connection", bot_id=str(bot.id), installation_id="qa-installation", account_id="qa-account", target_id="qa-target", credentials={"bot_token": "synthetic-sensitive", "app_token": "synthetic-app"}))
    db.close(); engine.dispose()


def test_management_crud_preserves_ciphertext_and_never_echoes_secrets(management):
    from app.models import ChannelConnection
    qa = management
    created = qa.client.post(qa.url, json=qa.payload)
    assert created.status_code == 200, created.text
    row = qa.db.query(ChannelConnection).one()
    ciphertext = row.credential_ciphertext
    assert "synthetic-sensitive" not in created.text and ciphertext not in created.text
    assert created.json()["data"]["credentials_registered"] is True
    payload = dict(qa.payload, credentials={"bot_token": "", "app_token": ""}, name="Renamed")
    updated = qa.client.patch(f"{qa.url}/{row.id}", json=payload)
    assert updated.status_code == 200, updated.text
    assert row.credential_ciphertext == ciphertext
    assert qa.client.get(qa.url).json()["data"]["items"][0]["name"] == "Renamed"
    checked = qa.client.post(f"{qa.url}/{row.id}/check")
    assert checked.status_code == 200, checked.text
    assert checked.json()["data"]["identity_verified"] is False
    assert checked.json()["data"]["last_checked_at"]
    assert qa.client.post(f"{qa.url}/{row.id}/connect").status_code == 409
    assert row.desired_state == "disconnected" and row.observed_state == "disconnected"
    assert qa.client.post(f"{qa.url}/{row.id}/disconnect").status_code == 200
    assert qa.client.delete(f"{qa.url}/{row.id}").status_code == 200
    assert qa.client.get(qa.url).json()["data"]["items"] == []


def test_management_org_role_and_bot_boundaries(management):
    from app.models import ChannelConnection
    qa = management
    foreign_url = f"/api/v1/admin/channels/{qa.foreign.id}/connections"
    assert qa.client.get(foreign_url).status_code == 404
    assert qa.client.post(foreign_url, json=qa.payload).status_code == 404
    assert qa.client.post(qa.url, json=dict(qa.payload, bot_id=str(qa.foreign_bot.id))).status_code == 422
    assert qa.db.query(ChannelConnection).count() == 0
    qa.role.code = "operation_manager"; qa.db.commit()
    assert qa.client.get(qa.url).status_code == 403
    assert qa.client.post(qa.url, json=qa.payload).status_code == 403
    assert qa.db.query(ChannelConnection).count() == 0


def test_management_duplicate_connected_guards_and_parent_guards(management):
    from app.models import ChannelConnection
    qa = management
    assert qa.client.post(qa.url, json=qa.payload).status_code == 200
    row = qa.db.query(ChannelConnection).one()
    assert qa.client.post(qa.url, json=qa.payload).status_code == 409
    row.desired_state = "connected"; row.observed_state = "connecting"; qa.db.commit()
    assert qa.client.patch(f"{qa.url}/{row.id}", json=qa.payload).status_code == 409
    assert qa.client.delete(f"{qa.url}/{row.id}").status_code == 409
    assert qa.client.delete(f"/api/v1/admin/channels/{qa.parent.id}").status_code == 409
    response = qa.client.patch(f"/api/v1/admin/channels/{qa.parent.id}", json={"name":"QA", "provider":"discord", "renderer_type":"discord", "auth_type":"none", "auth_config":{}, "status":"active"})
    assert response.status_code == 409, response.text
    assert qa.parent.data_json["provider"] == "slack"


@pytest.mark.parametrize("credentials", [{"client_secret":"synthetic-sensitive"}, {"bot_token":"****"}, {"bot_token":34}, {"bot_token":{"value":"synthetic-sensitive"}}])
def test_management_validation_never_echoes_credentials(management, credentials):
    qa = management
    response = qa.client.post(qa.url, json=dict(qa.payload, credentials=credentials))
    assert response.status_code == 422, response.text
    assert "synthetic-sensitive" not in response.text
    assert "input" not in response.text


def test_management_key_fail_closed_and_provider_validation(management, monkeypatch):
    qa = management
    monkeypatch.setattr(qa.settings, "channel_connection_encryption_key", "")
    assert qa.client.post(qa.url, json=qa.payload).status_code == 503
    qa.parent.data_json = {"provider":"webchat"}; qa.db.commit()
    assert qa.client.post(qa.url, json=qa.payload).status_code == 422


def test_python_mapping_consumes_shared_contract_and_fails_closed(monkeypatch):
    assert util.find_spec("app.services.channel_connection_bridge"), "shared mapping consumer missing"
    bridge = import_module("app.services.channel_connection_bridge")
    assert bridge.normalize_channel_provider("TEAMS") == "ms_teams"
    assert bridge.normalize_channel_provider("google-chat") == "google_chat"
    with pytest.raises(HTTPException) as invalid:
        bridge.normalize_channel_provider("teams")
    assert invalid.value.status_code == 422
    bridge.provider_mapping.cache_clear()
    monkeypatch.setattr(bridge.settings, "channel_connection_node_binary", "missing-synthetic-node")
    with pytest.raises(HTTPException) as unavailable:
        bridge.provider_mapping()
    assert unavailable.value.status_code == 503
    assert "CHANNEL_PACKET_RUNTIME_UNAVAILABLE" in unavailable.value.detail
    bridge.provider_mapping.cache_clear()


@pytest.mark.parametrize("provider, credentials", [("ms_teams", {"client_id":"synthetic-sensitive"}), ("slack", {"bot_token":"synthetic-sensitive"}), ("google_chat", {"service_account_json":"not-json-synthetic-sensitive"}), ("line", {"access_token":"synthetic-sensitive"})])
def test_settings_check_rejects_incomplete_provider_credentials(management, provider, credentials):
    qa = management
    qa.parent.data_json = {"provider": provider}; qa.db.commit()
    response = qa.client.post(qa.url, json=dict(qa.payload, credentials=credentials))
    assert response.status_code == 200, response.text
    connection_id = response.json()["data"]["id"]
    checked = qa.client.post(f"{qa.url}/{connection_id}/check")
    assert checked.status_code == 422, checked.text
    assert "synthetic-sensitive" not in checked.text


def test_management_inactive_organization_and_group_rejected(management):
    from app.models import Organization, Group, ChannelConnection
    qa = management
    group = qa.db.get(Group, qa.bot.group_id)
    group.status = "inactive"; qa.db.commit()
    assert qa.client.post(qa.url, json=qa.payload).status_code == 422
    assert qa.client.get(qa.url).json()["data"]["bots"] == []
    group.status = "active"
    qa.db.get(Organization, qa.user.organization_id).status = "inactive"; qa.db.commit()
    assert qa.client.get(qa.url).status_code == 403
    assert qa.client.post(qa.url, json=qa.payload).status_code == 403
    assert qa.db.query(ChannelConnection).count() == 0
