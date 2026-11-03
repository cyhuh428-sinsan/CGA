"""조직과 부모 채널에 격리된 관리 API. 저장/검사는 외부 연결을 하지 않는다."""
from __future__ import annotations

from datetime import datetime, timezone
import json
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.routes.admin import _require_admin_user
from app.core.config import settings
from app.core.responses import success_response
from app.models import AdminChannel, AuditLog, Bot, ChannelConnection, Group, Organization, User
from app.schemas.channel_connection import ConnectionWrite
from app.services.channel_connection_bridge import normalize_channel_provider
from app.services.channel_connections import (
    PROVIDER_CREDENTIAL_FIELDS, decrypt_credentials, disconnect_connection,
    encrypt_credentials, serialize_connection, validate_credentials,
)


class CredentialSafeRoute(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()

        async def sanitized(request: Request):
            try:
                return await original(request)
            except RequestValidationError:
                # FastAPI 기본 errors()는 SecretStr 변환 전 input도 포함한다.
                raise HTTPException(422, "INVALID_CONNECTION: 입력 형식을 확인하세요.") from None
        return sanitized


router = APIRouter(prefix="/admin/channels/{channel_id}/connections", tags=["channel-connections"], route_class=CredentialSafeRoute)


def _parent(db: Session, user: User, channel_id: UUID) -> AdminChannel:
    _require_admin_user(db, user)
    organization = db.get(Organization, user.organization_id)
    if organization is None or organization.deleted_at is not None or organization.status != "active":
        raise HTTPException(403, "ORGANIZATION_INACTIVE")
    parent = db.scalar(select(AdminChannel).where(AdminChannel.id == channel_id,
        AdminChannel.organization_id == user.organization_id, AdminChannel.deleted_at.is_(None)).with_for_update())
    if parent is None:
        raise HTTPException(404, "CHANNEL_NOT_FOUND")
    return parent


def _provider(parent: AdminChannel) -> str:
    provider = normalize_channel_provider(str((parent.data_json or {}).get("provider") or parent.code))
    if provider not in PROVIDER_CREDENTIAL_FIELDS:
        raise HTTPException(422, "CHANNEL_PROVIDER_NOT_CONNECTABLE")
    return provider


def _row(db: Session, user: User, channel_id: UUID, connection_id: UUID) -> ChannelConnection:
    _parent(db, user, channel_id)
    row = db.scalar(select(ChannelConnection).where(ChannelConnection.id == connection_id,
        ChannelConnection.organization_id == user.organization_id, ChannelConnection.channel_id == channel_id,
        ChannelConnection.deleted_at.is_(None)).with_for_update())
    if row is None:
        raise HTTPException(404, "CONNECTION_NOT_FOUND")
    return row


def _editable(row: ChannelConnection) -> None:
    if row.desired_state != "disconnected" or row.observed_state not in {"disconnected", "error"}:
        raise HTTPException(409, "CONNECTION_ACTIVE: 먼저 연결을 해제하세요.")


def _commit(db: Session, user: User, row: ChannelConnection, action: str) -> None:
    # 설정값/credential/외부 대상 식별자는 감사 로그에 복사하지 않는다.
    db.add(AuditLog(actor_user_id=user.id, action_type=f"admin.connection.{action}",
        target_type="channel_connection", target_id=row.id, after_json={"action": action}))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "CONNECTION_TARGET_DUPLICATE") from None


def _apply(db: Session, user: User, row: ChannelConnection, payload: ConnectionWrite) -> None:
    bot = _bot(db, user, payload.bot_id)
    if bot is None:
        raise HTTPException(422, "CONNECTION_BOT_INVALID")
    duplicate = db.scalar(select(ChannelConnection.id).where(
        ChannelConnection.organization_id == user.organization_id, ChannelConnection.provider == row.provider,
        ChannelConnection.installation_id == payload.installation_id, ChannelConnection.account_id == payload.account_id,
        ChannelConnection.target_id == payload.target_id, ChannelConnection.deleted_at.is_(None), ChannelConnection.id != row.id))
    if duplicate:
        raise HTTPException(409, "CONNECTION_TARGET_DUPLICATE")
    incoming = {key: value.get_secret_value() for key, value in (payload.credentials or {}).items()}
    # 빈 값만 기존 암호문 유지. 마스킹 placeholder는 validate_credentials가 거부한다.
    nonempty = {key: value for key, value in incoming.items() if value.strip()}
    if incoming and set(incoming) - PROVIDER_CREDENTIAL_FIELDS[row.provider]:
        raise HTTPException(422, "INVALID_CREDENTIALS")
    if nonempty:
        validate_credentials(row.provider, nonempty)
        existing = decrypt_credentials(row.credential_ciphertext, user.organization_id, row.id,
            settings.channel_connection_encryption_key, row.credential_key_version) if row.credential_ciphertext else {}
        merged = {**existing, **nonempty}
        validate_credentials(row.provider, merged)
        row.credential_ciphertext = encrypt_credentials(merged, user.organization_id, row.id,
            settings.channel_connection_encryption_key, settings.channel_connection_key_version)
        row.credential_key_version = settings.channel_connection_key_version
    elif not row.credential_ciphertext:
        raise HTTPException(422, "CONNECTION_CREDENTIALS_REQUIRED")
    else:
        # 키가 사라진 경우에도 수정은 fail closed.
        validate_credentials(row.provider, decrypt_credentials(row.credential_ciphertext, user.organization_id,
            row.id, settings.channel_connection_encryption_key, row.credential_key_version))
    row.name, row.bot_id = payload.name, payload.bot_id
    row.installation_id, row.account_id, row.target_id = payload.installation_id, payload.account_id, payload.target_id
    row.updated_by = user.id


def _bot(db: Session, user: User, bot_id: UUID):
    return db.scalar(select(Bot).join(Group, Group.id == Bot.group_id).where(Bot.id == bot_id,
        Bot.organization_id == user.organization_id, Bot.deleted_at.is_(None), Bot.status == "active",
        Group.organization_id == user.organization_id, Group.deleted_at.is_(None), Group.status == "active"))


def _check_configuration(db: Session, user: User, row: ChannelConnection) -> None:
    parent = _parent(db, user, row.channel_id)
    if parent.status != "active" or _provider(parent) != row.provider:
        raise HTTPException(422, "CONNECTION_CHANNEL_INVALID")
    if _bot(db, user, row.bot_id) is None:
        raise HTTPException(422, "CONNECTION_BOT_INVALID")
    credentials = decrypt_credentials(row.credential_ciphertext or "", row.organization_id,
        row.id, settings.channel_connection_encryption_key, row.credential_key_version or "")
    validate_credentials(row.provider, credentials)
    required = PROVIDER_CREDENTIAL_FIELDS[row.provider] - {"signing_secret", "project_id"}
    if required - credentials.keys():
        raise HTTPException(422, "INVALID_CREDENTIALS: 필수 인증정보를 입력하세요.")
    try:
        if row.provider == "ms_teams":
            if str(UUID(credentials["tenant_id"])) != row.installation_id or str(UUID(credentials["client_id"])) != row.account_id:
                raise ValueError()
        if row.provider == "google_chat":
            service_account = json.loads(credentials["service_account_json"])
            if not isinstance(service_account, dict) or service_account.get("type") != "service_account":
                raise ValueError()
            if any(not isinstance(service_account.get(key), str) or not service_account[key].strip()
                for key in ("project_id", "client_email", "private_key_id", "private_key")):
                raise ValueError()
            if service_account.get("token_uri") != "https://oauth2.googleapis.com/token" or credentials.get("project_id", service_account["project_id"]) != service_account["project_id"]:
                raise ValueError()
        elif any(any(character.isspace() for character in value) for key, value in credentials.items() if key != "client_secret"):
            raise ValueError()
    except (ValueError, KeyError, TypeError):
        raise HTTPException(422, "INVALID_CREDENTIALS: 인증정보 형식을 확인하세요.") from None


@router.get("")
def list_connections(channel_id: UUID, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    parent = _parent(db, current_user, channel_id)
    _provider(parent)
    rows = db.scalars(select(ChannelConnection).where(ChannelConnection.channel_id == channel_id,
        ChannelConnection.organization_id == current_user.organization_id, ChannelConnection.deleted_at.is_(None)).order_by(ChannelConnection.created_at)).all()
    bots = db.scalars(select(Bot).join(Group, Group.id == Bot.group_id).where(Bot.organization_id == current_user.organization_id,
        Bot.deleted_at.is_(None), Bot.status == "active", Group.organization_id == current_user.organization_id,
        Group.deleted_at.is_(None), Group.status == "active").order_by(Bot.name)).all()
    return success_response(request, {"items": [serialize_connection(row) for row in rows],
        "bots": [{"id": str(bot.id), "name": bot.name} for bot in bots], "total": len(rows)})


@router.post("")
def create_connection(channel_id: UUID, payload: ConnectionWrite, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    parent = _parent(db, current_user, channel_id)
    row = ChannelConnection(id=uuid4(), organization_id=current_user.organization_id, channel_id=channel_id,
        provider=_provider(parent), created_by=current_user.id, generation=1, desired_state="disconnected", observed_state="disconnected")
    _apply(db, current_user, row, payload)
    db.add(row)
    _commit(db, current_user, row, "create")
    return success_response(request, serialize_connection(row))


@router.patch("/{connection_id}")
def update_connection(channel_id: UUID, connection_id: UUID, payload: ConnectionWrite, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = _row(db, current_user, channel_id, connection_id)
    _editable(row)
    _apply(db, current_user, row, payload)
    row.generation += 1
    row.last_checked_at = None
    row.last_error_code = None
    _commit(db, current_user, row, "update")
    return success_response(request, serialize_connection(row))


@router.delete("/{connection_id}")
def delete_connection(channel_id: UUID, connection_id: UUID, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = _row(db, current_user, channel_id, connection_id)
    _editable(row)
    row.deleted_at = datetime.now(timezone.utc)
    _commit(db, current_user, row, "delete")
    return success_response(request, {"deleted": True})


@router.post("/{connection_id}/check")
def check_connection(channel_id: UUID, connection_id: UUID, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = _row(db, current_user, channel_id, connection_id)
    _check_configuration(db, current_user, row)
    row.last_checked_at = datetime.now(timezone.utc)
    _commit(db, current_user, row, "check")
    return success_response(request, serialize_connection(row))


@router.post("/{connection_id}/connect")
def connect_connection(channel_id: UUID, connection_id: UUID, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = _row(db, current_user, channel_id, connection_id)
    # 키 부재/손상은 worker 미준비보다 먼저 실패시킨다. 실제 identity 확인은 후속 worker 담당.
    _check_configuration(db, current_user, row)
    raise HTTPException(409, "CONNECTION_WORKER_UNAVAILABLE: 연결 실행 기능은 준비 중입니다.")


@router.post("/{connection_id}/disconnect")
def disconnect(channel_id: UUID, connection_id: UUID, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = _row(db, current_user, channel_id, connection_id)
    disconnect_connection(row)
    row.updated_by = current_user.id
    _commit(db, current_user, row, "disconnect")
    return success_response(request, serialize_connection(row))
