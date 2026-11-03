"""채널별 연결의 비밀값 보호와 수명주기. 외부 호출은 하지 않는다."""
from __future__ import annotations
import base64
import binascii
import json
import os
from datetime import datetime, timezone
from uuid import UUID
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag
from fastapi import HTTPException

PROVIDERS = {"webchat", "kakao", "ms_teams", "slack", "discord", "telegram", "google_chat", "line"}
CREDENTIAL_FIELDS = {"bot_token", "app_token", "client_id", "client_secret", "signing_secret", "channel_secret", "access_token", "service_account_json", "tenant_id", "project_id"}
PROVIDER_CREDENTIAL_FIELDS = {
    "ms_teams": {"client_id", "client_secret", "tenant_id"},
    "slack": {"bot_token", "app_token", "signing_secret"},
    "discord": {"bot_token"},
    "telegram": {"bot_token"},
    "google_chat": {"service_account_json", "project_id"},
    "line": {"access_token", "channel_secret"},
}


def validate_credentials(provider: str, credentials: dict[str, str]) -> None:
    allowed = PROVIDER_CREDENTIAL_FIELDS.get(provider)
    if allowed is None or not isinstance(credentials, dict) or not credentials or set(credentials) - allowed:
        raise HTTPException(422, "INVALID_CREDENTIALS: 인증정보 필드를 확인하세요.")
    _validate_values(credentials)


def _validate_values(credentials: dict[str, str]) -> None:
    if not isinstance(credentials, dict) or not credentials:
        raise HTTPException(422, "INVALID_CREDENTIALS")
    if any(k not in CREDENTIAL_FIELDS or not isinstance(v, str) or not v.strip() or v.strip() in {"등록됨", "••••••••"} or set(v.strip()) <= {"*", "•"} for k, v in credentials.items()):
        raise HTTPException(422, "INVALID_CREDENTIALS: 인증정보 이름과 실제 입력을 확인하세요.")
    if len(json.dumps(credentials, ensure_ascii=False).encode()) > 32768:
        raise HTTPException(422, "INVALID_CREDENTIALS: 인증정보 크기를 확인하세요.")


def _cipher(key: str) -> AESGCM:
    try:
        raw = base64.b64decode(key.encode("ascii"), altchars=b"-_", validate=True)
        if len(raw) != 32:
            raise ValueError()
        return AESGCM(raw)
    except (ValueError, UnicodeError, binascii.Error):
        raise HTTPException(503, "CONNECTION_KEY_UNAVAILABLE: 연결 암호화 키 설정이 필요합니다.") from None


def _aad(org: UUID, connection: UUID, version: str) -> bytes:
    return f"cga-channel-connection:{org}:{connection}:{version}".encode()


def encrypt_credentials(credentials: dict[str, str], org: UUID, connection: UUID, key: str, version: str) -> str:
    if not version:
        raise HTTPException(422, "INVALID_CREDENTIALS: 인증정보 형식을 확인하세요.")
    _validate_values(credentials)
    nonce = os.urandom(12)
    ciphertext = _cipher(key).encrypt(nonce, json.dumps(credentials, ensure_ascii=False).encode(), _aad(org, connection, version))
    return base64.urlsafe_b64encode(nonce + ciphertext).decode()


def decrypt_credentials(ciphertext: str, org: UUID, connection: UUID, key: str, version: str) -> dict[str, str]:
    cipher = _cipher(key)
    try:
        raw = base64.b64decode(ciphertext.encode("ascii"), altchars=b"-_", validate=True)
        result = json.loads(cipher.decrypt(raw[:12], raw[12:], _aad(org, connection, version)))
        if not isinstance(result, dict) or any(not isinstance(k, str) or not isinstance(v, str) for k, v in result.items()):
            raise ValueError()
        return result
    except (ValueError, UnicodeError, InvalidTag, binascii.Error):
        raise HTTPException(503, "CONNECTION_CREDENTIALS_UNAVAILABLE: 인증정보를 확인할 수 없습니다.") from None


def encrypt_event_context(context: dict, org: UUID, delivery: UUID, key: str, version: str) -> str:
    if not version or not isinstance(context, dict):
        raise HTTPException(422, "INVALID_EVENT_CONTEXT")
    try:
        plain = json.dumps(context, ensure_ascii=False).encode()
        if len(plain) > 262144:
            raise ValueError()
    except (ValueError, TypeError):
        raise HTTPException(422, "INVALID_EVENT_CONTEXT") from None
    nonce = os.urandom(12)
    return base64.urlsafe_b64encode(nonce + _cipher(key).encrypt(nonce, plain,
        b"event-context:" + _aad(org, delivery, version))).decode()


def decrypt_event_context(ciphertext: str, org: UUID, delivery: UUID, key: str, version: str) -> dict:
    cipher = _cipher(key)
    try:
        raw = base64.b64decode(ciphertext.encode("ascii"), altchars=b"-_", validate=True)
        value = json.loads(cipher.decrypt(raw[:12], raw[12:], b"event-context:" + _aad(org, delivery, version)))
        if not isinstance(value, dict):
            raise ValueError()
        return value
    except (ValueError, TypeError, UnicodeError, InvalidTag, binascii.Error):
        raise HTTPException(503, "CONNECTION_CONTEXT_UNAVAILABLE") from None


def serialize_connection(row, lease=None) -> dict:
    now = datetime.now(timezone.utc)
    observed = row.observed_state
    lease_valid = row.lease_expires_at is not None and row.lease_expires_at > now
    if lease is not None:
        lease_valid = lease_valid and lease.lease_expires_at is not None and lease.lease_expires_at > now and lease.owner == row.lease_owner and lease.listener_scope_hash == row.listener_scope_hash
    if observed == "connected" and not lease_valid:
        observed = "error"
    return dict(id=str(row.id), channel_id=str(row.channel_id), bot_id=str(row.bot_id), name=row.name,
        provider=row.provider, installation_id=row.installation_id, account_id=row.account_id, target_id=row.target_id,
        desired_state=row.desired_state, observed_state=observed, generation=row.generation,
        credentials_registered=bool(row.credential_ciphertext), identity_verified=observed == "connected" and lease_valid,
        last_error_code="LEASE_EXPIRED" if row.observed_state == "connected" and not lease_valid else row.last_error_code,
        last_checked_at=row.last_checked_at.isoformat() if row.last_checked_at else None,
        created_at=row.created_at.isoformat(), updated_at=row.updated_at.isoformat())


def disconnect_connection(row) -> None:
    if row.desired_state == "disconnected" and row.observed_state == "disconnected":
        return
    row.generation += 1
    row.desired_state = "disconnected"
    row.observed_state = "disconnected"
    row.lease_owner = None
    row.lease_expires_at = None
    row.last_error_code = None
