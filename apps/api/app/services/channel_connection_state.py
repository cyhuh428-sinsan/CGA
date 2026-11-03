"""설치 lease·전달 원장의 원자 전이. 네트워크/모델 호출 없음.

각 함수는 호출자 transaction 안에서 실행한다. lock 순서는 lease→connection→delivery.
실행/송신 claim은 외부 작업 전에 commit하고, 불명 결과는 다시 claim하지 않는다.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
import hashlib
import json
import re
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from app.models import (Organization, Group, Bot, AdminChannel, ChannelConnection,
    ChannelInstallationLease, ChannelConnectionDelivery)
from app.services.channel_connections import encrypt_event_context


def clock(db):
    if db.bind.dialect.name == "postgresql":
        return db.scalar(select(func.clock_timestamp()))
    return datetime.now(timezone.utc)


def _utc(value):
    return value.replace(tzinfo=timezone.utc) if value is not None and value.tzinfo is None else value


def scoped_hash(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _digest(parts):
    return scoped_hash(json.dumps(parts, ensure_ascii=False, sort_keys=True, separators=(",", ":")))


def _connection(db, connection_id, *, lock=True):
    query = select(ChannelConnection).where(ChannelConnection.id == connection_id,
        ChannelConnection.deleted_at.is_(None)).execution_options(populate_existing=True)
    row = db.scalar(query.with_for_update() if lock else query)
    if row is None: raise HTTPException(404, "CONNECTION_NOT_FOUND")
    return row


def _target_active(db, row):
    org = db.get(Organization, row.organization_id, populate_existing=True)
    parent = db.get(AdminChannel, row.channel_id, populate_existing=True)
    bot = db.get(Bot, row.bot_id, populate_existing=True)
    group = db.get(Group, bot.group_id, populate_existing=True) if bot else None
    if row.desired_state != "connected" or any(x is None or x.deleted_at is not None or x.status != "active" for x in (org, parent, bot, group)):
        raise HTTPException(409, "CONNECTION_TARGET_INACTIVE")
    if any(x.organization_id != row.organization_id for x in (parent, bot, group)):
        raise HTTPException(409, "CONNECTION_TARGET_INACTIVE")


def _listener_scope(row, verified_scope=None):
    if verified_scope is not None:
        if not isinstance(verified_scope, str) or not verified_scope.strip() or len(verified_scope) > 300:
            raise HTTPException(422, "INVALID_LISTENER_SCOPE")
        return _digest([row.provider, "verified-listener", verified_scope])
    return _digest([row.provider, row.installation_id, row.account_id])


def _installation(db, installation_id, owner, fence):
    lease = db.scalar(select(ChannelInstallationLease).where(ChannelInstallationLease.id == installation_id)
        .with_for_update().execution_options(populate_existing=True))
    if lease is None or lease.owner != owner or lease.fence != fence or lease.lease_expires_at is None or _utc(lease.lease_expires_at) <= clock(db):
        raise HTTPException(409, "INSTALLATION_LEASE_LOST")
    return lease


def claim_installation(db, connection, owner, *, ttl_seconds, listener_scope=None, exclusive=False):
    if not isinstance(owner, str) or not owner or len(owner) > 120 or not 5 <= ttl_seconds <= 600:
        raise HTTPException(422, "INVALID_LEASE_INPUT")
    row = _connection(db, connection.id, lock=False)
    _target_active(db, row)
    scope = _listener_scope(row, listener_scope)
    values = dict(organization_id=row.organization_id, provider=row.provider, listener_scope_hash=scope)
    if exclusive and db.bind.dialect.name == "postgresql":
        # 설치 identity가 조직을 넘어 겹쳐도 polling 독점성을 유지한다.
        number = int(scope[:16], 16)
        db.execute(select(func.pg_advisory_xact_lock(number if number < 2**63 else number - 2**64)))
        other = db.scalar(select(ChannelInstallationLease.id).where(ChannelInstallationLease.provider == row.provider,
            ChannelInstallationLease.listener_scope_hash == scope,
            ChannelInstallationLease.organization_id != row.organization_id,
            ChannelInstallationLease.owner.is_not(None), ChannelInstallationLease.lease_expires_at > clock(db)))
        if other is not None: return None
    insert = pg_insert
    if db.bind.dialect.name == "sqlite":
        from sqlalchemy.dialects.sqlite import insert
    db.execute(insert(ChannelInstallationLease).values(id=uuid4(), installation_id=row.installation_id,
        account_id=row.account_id, cursor_json={}, **values).on_conflict_do_nothing(
            index_elements=["organization_id", "provider", "listener_scope_hash"]))
    lease = db.scalar(select(ChannelInstallationLease).filter_by(**values).with_for_update()
        .execution_options(populate_existing=True))
    now = clock(db)
    if lease.owner != owner and lease.lease_expires_at is not None and _utc(lease.lease_expires_at) > now:
        return None
    if lease.owner != owner or lease.lease_expires_at is None or _utc(lease.lease_expires_at) <= now:
        lease.fence += 1
    lease.owner, lease.lease_expires_at = owner, now + timedelta(seconds=ttl_seconds)
    db.flush()
    return lease


def activate_connection(db, connection_id, installation_id, owner, fence, verified_identity):
    lease = _installation(db, installation_id, owner, fence)
    row = _connection(db, connection_id)
    _target_active(db, row)
    expected = _listener_scope(row, verified_identity.get("listener_scope"))
    if (row.organization_id, row.provider, expected) != (lease.organization_id, lease.provider, lease.listener_scope_hash):
        raise HTTPException(409, "INSTALLATION_SCOPE_MISMATCH")
    if verified_identity.get("installation_id") != row.installation_id or verified_identity.get("account_id") != row.account_id:
        raise HTTPException(409, "VERIFIED_IDENTITY_MISMATCH")
    pending = verified_identity.get("pending_activation")
    current_scope = {"generation": row.generation, "owner": owner, "fence": fence}
    if "pending_activation" in verified_identity and pending != current_scope:
        raise HTTPException(409, "VERIFIED_IDENTITY_MISMATCH")
    preserve_pending = (row.observed_state == "connecting" and row.lease_owner == owner
        and row.accept_after is not None and pending == current_scope)
    if (row.observed_state != "connected" or row.lease_owner != owner) and not preserve_pending:
        row.accept_after = clock(db)
    row.listener_scope_hash = expected
    row.observed_state, row.lease_owner, row.lease_expires_at = "connected", owner, lease.lease_expires_at
    row.last_error_code = None
    db.flush()
    return row


def _live(db, connection_id, installation_id, owner, fence):
    lease = _installation(db, installation_id, owner, fence)
    row = _connection(db, connection_id)
    _target_active(db, row)
    if (row.organization_id, row.provider, row.listener_scope_hash) != (lease.organization_id, lease.provider, lease.listener_scope_hash):
        raise HTTPException(409, "INSTALLATION_SCOPE_MISMATCH")
    if row.observed_state != "connected" or row.lease_owner != owner or row.lease_expires_at is None or _utc(row.lease_expires_at) <= clock(db):
        raise HTTPException(409, "CONNECTION_LEASE_LOST")
    return row


def _event(event):
    if not isinstance(event, dict) or any(not isinstance(event.get(k), str) or not event[k] or len(event[k]) > limit
        for k, limit in (("eventId", 512), ("nativeRoomKey", 2048), ("nativeParticipantKey", 512))):
        raise HTTPException(422, "INVALID_NATIVE_EVENT")
    if not isinstance(event.get("message"), str) or not event["message"].strip() or len(event["message"]) > 4000:
        raise HTTPException(422, "INVALID_NATIVE_EVENT")
    if event.get("participantKind") not in {"user", "bot"} or event.get("roomMode") not in {"private", "shared"} or type(event.get("addressed")) is not bool:
        raise HTTPException(422, "INVALID_NATIVE_EVENT")
    try:
        if len(json.dumps(event, ensure_ascii=False).encode()) > 65536: raise ValueError()
    except (TypeError, ValueError):
        raise HTTPException(422, "INVALID_NATIVE_EVENT") from None


def accept_delivery(db, connection_id, installation_id, owner, fence, event, *, key, version):
    row = _live(db, connection_id, installation_id, owner, fence)
    _event(event)
    # event IDs are provider-local: include installation/account/target/room before hashing.
    scope = [row.provider, row.installation_id, row.account_id, row.target_id, event["nativeRoomKey"]]
    event_key = _digest([scope, event["eventId"]])
    immutable = {k: v for k, v in event.items() if k not in {"timestamp", "redelivery", "occurredAt", "replyToken"}}
    request_hash = _digest([scope, immutable])
    existing = db.scalar(select(ChannelConnectionDelivery).where(ChannelConnectionDelivery.connection_id == row.id,
        ChannelConnectionDelivery.event_key == event_key).with_for_update())
    if existing is not None:
        if existing.request_hash != request_hash: raise HTTPException(409, "NATIVE_EVENT_CONFLICT")
        return existing
    item = ChannelConnectionDelivery(id=uuid4(), organization_id=row.organization_id, connection_id=row.id,
        generation=row.generation, installation_fence=fence, native_room_hash=_digest(scope),
        native_actor_hash=_digest([scope, event["nativeParticipantKey"]]), event_key=event_key,
        request_hash=request_hash, status="received", event_json={}, result_json={}, provider_message_ids=[])
    item.context_ciphertext = encrypt_event_context(event, row.organization_id, item.id, key, version)
    item.context_key_version = version
    if event["participantKind"] == "bot" or not event["addressed"]:
        item.status, item.last_error_code = "cancelled", "EVENT_NOT_ADDRESSED"
    if event.get("occurredAt") is not None:
        try:
            occurred = datetime.fromisoformat(event["occurredAt"])
            if occurred.tzinfo is None: raise ValueError()
        except (ValueError, TypeError): raise HTTPException(422, "INVALID_NATIVE_EVENT_TIME") from None
        if row.accept_after is not None and occurred < _utc(row.accept_after):
            item.status, item.last_error_code = "cancelled", "BEFORE_CONNECTION"
    db.add(item); db.flush()
    return item


def _delivery(db, delivery_id):
    item = db.scalar(select(ChannelConnectionDelivery).where(ChannelConnectionDelivery.id == delivery_id)
        .with_for_update().execution_options(populate_existing=True))
    if item is None: raise HTTPException(404, "CONNECTION_DELIVERY_NOT_FOUND")
    return item


def claim_delivery(db, connection_id, installation_id, owner, fence, *, deadline_seconds):
    if not 5 <= deadline_seconds <= 7200: raise HTTPException(422, "INVALID_EXECUTION_DEADLINE")
    row = _live(db, connection_id, installation_id, owner, fence)
    items = db.scalars(select(ChannelConnectionDelivery).where(ChannelConnectionDelivery.connection_id == row.id,
        ChannelConnectionDelivery.status.in_(["received", "executing", "ready", "sending", "unknown"]))
        .order_by(ChannelConnectionDelivery.created_at, ChannelConnectionDelivery.id).with_for_update()
        .execution_options(populate_existing=True)).all()
    blocked = {x.native_room_hash for x in items if x.status != "received"}
    for item in items:
        if item.status != "received": continue
        if item.generation != row.generation:
            item.status, item.last_error_code = "cancelled", "CONNECTION_CHANGED"
        elif item.native_room_hash not in blocked:
            item.status, item.execution_claim_id, item.installation_fence = "executing", str(uuid4()), fence
            item.deadline_at = clock(db) + timedelta(seconds=deadline_seconds)
            db.flush(); return item
    db.flush(); return None


def mark_ready(db, delivery_id, result, execution_claim_id, installation_id, owner, fence):
    initial = db.get(ChannelConnectionDelivery, delivery_id)
    if initial is None: raise HTTPException(404, "CONNECTION_DELIVERY_NOT_FOUND")
    row = _live(db, initial.connection_id, installation_id, owner, fence)
    item = _delivery(db, delivery_id)
    if item.generation != row.generation or item.installation_fence != fence or not execution_claim_id or item.execution_claim_id != execution_claim_id or item.status != "executing":
        raise HTTPException(409, "EXECUTION_CLAIM_LOST")
    item.result_json, item.status, item.deadline_at = result, "ready", None
    db.flush(); return item


def claim_send(db, delivery_id, installation_id, owner, fence, *, deadline_seconds=30):
    initial = db.get(ChannelConnectionDelivery, delivery_id)
    if initial is None: raise HTTPException(404, "CONNECTION_DELIVERY_NOT_FOUND")
    row = _live(db, initial.connection_id, installation_id, owner, fence)
    item = _delivery(db, delivery_id)
    if item.status != "ready": return None
    if item.generation != row.generation:
        item.status, item.last_error_code = "cancelled", "CONNECTION_CHANGED"
        db.flush(); return None
    item.status, item.send_claim_id, item.installation_fence = "sending", str(uuid4()), fence
    item.deadline_at = clock(db) + timedelta(seconds=deadline_seconds)
    db.flush(); return item.send_claim_id


def mark_unknown(db, delivery_id, send_claim_id, code):
    if not re.fullmatch(r"[A-Z0-9_]{1,80}", code): raise HTTPException(422, "INVALID_DELIVERY_ERROR_CODE")
    item = _delivery(db, delivery_id)
    if not send_claim_id or item.send_claim_id != send_claim_id or item.status != "sending": return False
    item.status, item.last_error_code = "unknown", code
    db.flush(); return True


def record_sent(db, delivery_id, send_claim_id, provider_message_ids):
    item = _delivery(db, delivery_id)
    if not send_claim_id or item.send_claim_id != send_claim_id or item.status != "sending": return False
    if not isinstance(provider_message_ids, list) or len(provider_message_ids) > 20 or any(not isinstance(x, str) or len(x) > 512 for x in provider_message_ids):
        raise HTTPException(422, "INVALID_DELIVERY_RECEIPT")
    item.status, item.provider_message_ids, item.deadline_at = "sent", [scoped_hash(x) for x in provider_message_ids], None
    db.flush(); return True


def recover_expired(db, connection_id):
    _connection(db, connection_id)
    items = db.scalars(select(ChannelConnectionDelivery).where(ChannelConnectionDelivery.connection_id == connection_id,
        ChannelConnectionDelivery.status.in_(["executing", "sending"]), ChannelConnectionDelivery.deadline_at < clock(db)).with_for_update()).all()
    for item in items:
        item.last_error_code = "EXECUTION_UNKNOWN" if item.status == "executing" else "DELIVERY_UNKNOWN"
        item.status = "unknown"
    db.flush(); return len(items)
