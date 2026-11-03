"""실제 ORM 전이 검사. PostgreSQL 경쟁 검사는 별도 전용 DB에서 실행한다."""
from datetime import timedelta
from uuid import uuid4
import base64
import json

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.ext.compiler import compiles, deregister
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql.elements import TextClause

KEY = base64.urlsafe_b64encode(bytes(range(32))).decode()


@pytest.fixture
def state_db(tmp_path):
    from app.models import (Organization, Group, Bot, AdminChannel, ChannelConnection,
        ChannelInstallationLease, ChannelConnectionDelivery, ChannelConnectionRoom, ChannelRoom,
        ChannelMessage, ChannelQueueEvent, BotVersion, AuditLog)
    @compiles(JSONB, "sqlite")
    def _json(*args, **kw): return "JSON"
    @compiles(TextClause, "sqlite")
    def _text(element, compiler, **kw):
        return element.text.replace("::jsonb", "")
    # thread마다 독립 DB connection을 사용한다. StaticPool은 동시 session rollback을 공유한다.
    engine = create_engine("sqlite:///" + str(tmp_path / "state.sqlite"), connect_args={"check_same_thread": False})
    try:
        for cls in (Organization, Group, Bot, AdminChannel, ChannelConnection, ChannelInstallationLease,
                    ChannelConnectionDelivery, ChannelConnectionRoom, ChannelRoom, ChannelMessage,
                    ChannelQueueEvent, BotVersion, AuditLog):
            cls.__table__.create(engine)
    finally:
        # PostgreSQL DDL default의 ::jsonb 제거에만 사용. 런타임 bind SQL에는 적용하지 않는다.
        deregister(TextClause)
    with Session(engine, expire_on_commit=False) as db:
        org = Organization(name="QA", code="task5")
        db.add(org); db.flush()
        group = Group(organization_id=org.id, name="QA", code="qa")
        parent = AdminChannel(organization_id=org.id, code="SLACK", name="QA")
        db.add_all([group, parent]); db.flush()
        bot = Bot(organization_id=org.id, group_id=group.id, name="QA")
        db.add(bot); db.flush()
        row = ChannelConnection(organization_id=org.id, bot_id=bot.id, channel_id=parent.id,
            name="QA", provider="slack", installation_id="i", account_id="a", target_id="t",
            desired_state="connected", observed_state="connecting")
        db.add(row); db.commit()
        yield db, row
    engine.dispose()


def activated(state_db):
    from app.services import channel_connection_state as s
    db, row = state_db
    lease = s.claim_installation(db, row, "worker-1", ttl_seconds=30)
    s.activate_connection(db, row.id, lease.id, "worker-1", lease.fence,
        {"installation_id": "i", "account_id": "a"})
    db.commit()
    return s, db, row, lease


def event(**overrides):
    return dict(eventId="event-1", nativeRoomKey="raw-room-sensitive", nativeParticipantKey="raw-actor-sensitive",
        participantKind="user", roomMode="shared", addressed=True, message="question", **overrides)


def accept(s, db, row, lease):
    return s.accept_delivery(db, row.id, lease.id, "worker-1", lease.fence, event(), key=KEY, version="v1")


def test_single_live_owner_and_monotonic_fence(state_db):
    s, db, row, lease = activated(state_db)
    assert lease.fence == 1
    assert s.claim_installation(db, row, "worker-2", ttl_seconds=30) is None
    lease.lease_expires_at = s.clock(db) - timedelta(seconds=1); db.flush()
    new = s.claim_installation(db, row, "worker-2", ttl_seconds=30)
    assert new.fence == 2
    with pytest.raises(HTTPException): s._live(db, row.id, lease.id, "worker-1", 1)


def test_delivery_dedupe_scope_and_encrypted_context(state_db):
    s, db, row, lease = activated(state_db)
    first = accept(s, db, row, lease)
    assert accept(s, db, row, lease).id == first.id
    assert first.event_json == {}
    plain = json.dumps(first.event_json) + json.dumps(first.result_json)
    assert "raw-room-sensitive" not in plain and "raw-actor-sensitive" not in plain
    changed = event(); changed["message"] = "changed"
    with pytest.raises(HTTPException) as error:
        s.accept_delivery(db, row.id, lease.id, "worker-1", lease.fence, changed, key=KEY, version="v1")
    assert error.value.detail == "NATIVE_EVENT_CONFLICT"


def test_claims_are_single_use_and_unknown_send_is_never_retried(state_db):
    s, db, row, lease = activated(state_db)
    item = accept(s, db, row, lease)
    claimed = s.claim_delivery(db, row.id, lease.id, "worker-1", 1, deadline_seconds=30)
    assert claimed.id == item.id
    assert s.claim_delivery(db, row.id, lease.id, "worker-1", 1, deadline_seconds=30) is None
    with pytest.raises(HTTPException): s.mark_ready(db, item.id, {}, str(uuid4()), lease.id, "worker-1", 1)
    s.mark_ready(db, item.id, {}, item.execution_claim_id, lease.id, "worker-1", 1)
    claim = s.claim_send(db, item.id, lease.id, "worker-1", 1)
    assert claim
    assert s.mark_unknown(db, item.id, claim, "SEND_UNKNOWN")
    assert s.claim_send(db, item.id, lease.id, "worker-1", 1) is None
    assert item.status == "unknown"


def test_disconnect_generation_and_expired_execution_stop_reexecution(state_db):
    s, db, row, lease = activated(state_db)
    item = accept(s, db, row, lease)
    s.claim_delivery(db, row.id, lease.id, "worker-1", 1, deadline_seconds=30)
    item.deadline_at = s.clock(db) - timedelta(seconds=1)
    assert s.recover_expired(db, row.id) == 1
    assert item.status == "unknown"
    assert s.claim_delivery(db, row.id, lease.id, "worker-1", 1, deadline_seconds=30) is None
    row.generation += 1
    with pytest.raises(HTTPException):
        s.mark_ready(db, item.id, {}, item.execution_claim_id, lease.id, "worker-1", 1)


@pytest.mark.parametrize("kind,addressed", [("bot", True), ("user", False)])
def test_bot_and_unaddressed_events_are_not_executed(state_db, kind, addressed):
    s, db, row, lease = activated(state_db)
    incoming = event(); incoming.update(participantKind=kind, addressed=addressed)
    item = s.accept_delivery(db, row.id, lease.id, "worker-1", 1, incoming, key=KEY, version="v1")
    assert item.status == "cancelled"
    assert s.claim_delivery(db, row.id, lease.id, "worker-1", 1, deadline_seconds=30) is None
