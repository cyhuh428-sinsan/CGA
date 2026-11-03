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
