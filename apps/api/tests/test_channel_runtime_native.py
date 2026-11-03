"""CGA native entrypoint scope and existing HTTP contract characterization."""
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from unittest.mock import MagicMock


@pytest.fixture
def room_case(monkeypatch):
    from app.api.routes import channels
    bot = SimpleNamespace(id=uuid4(), organization_id=uuid4(), name="봇")
    version = SimpleNamespace(id=uuid4())
    room = SimpleNamespace(id=uuid4(), bot_id=bot.id, bot_version_id=version.id,
                           metadata_json={}, status="open")
    db = MagicMock()
    db.__enter__.return_value = db
    db.scalar.return_value = room
    monkeypatch.setattr(channels, "SessionLocal", lambda: db)
    monkeypatch.setattr(channels, "select", lambda *a: MagicMock())
    monkeypatch.setattr(channels, "ChannelRoom", MagicMock())
    monkeypatch.setattr(channels, "_verify_channel_key", lambda key: None)
    monkeypatch.setattr(channels, "_get_active_bot_version", lambda *a: (bot, version, None))
    monkeypatch.setattr(channels, "flag_modified", lambda *a: None)
    monkeypatch.setattr(channels, "_ensure_room_started", lambda *a: [])
    monkeypatch.setattr(channels, "_serialize_room", lambda db, value: {"id": str(value.id)})
    request = SimpleNamespace(headers={"accept-language": "en"}, state=SimpleNamespace(request_id="native-test"))
    return channels, db, bot, version, room, request


@pytest.mark.parametrize("channel", ["webchat", "kakao", "ms-teams"])
def test_http_room_reuse_preserves_response_language_and_one_commit(room_case, channel):
    channels, db, bot, version, room, request = room_case
    response = channels.create_channel_room(channel, channels.ChannelRoomCreateRequest(
        bot_id=str(bot.id), client_room_id="synthetic-room", language="ja"), request, "synthetic-key")
    assert response == {"data": {"room": {"id": str(room.id)}, "messages": [], "initialMessages": []},
                        "meta": {"request_id": "native-test"}}
    assert room.metadata_json["language"] == "ja"
    assert db.commit.call_count == 1


def test_http_room_version_replacement_writes_audit_before_commit(room_case, monkeypatch):
    channels, db, bot, version, room, request = room_case
    room.bot_version_id = uuid4()
    prior = str(room.bot_version_id)
    monkeypatch.setattr(channels, "_apply_active_version_to_room", lambda *a: prior)
    audits = []
    monkeypatch.setattr(channels, "_write_channel_audit_log", lambda db, req, event, rid, data: audits.append((event, data)))
    response = channels.create_channel_room("webchat", channels.ChannelRoomCreateRequest(
        bot_id=str(bot.id), client_room_id="synthetic-room"), request, "synthetic-key")
    assert response["data"]["room"]["id"] == str(room.id)
    assert audits == [("channel.session.version_applied", {"channel": "webchat", "bot_id": str(bot.id),
                       "previous_version_id": prior, "active_version_id": str(version.id)})]
    assert db.commit.call_count == 1


def test_native_room_rejects_cross_organization_before_writing(monkeypatch):
    from app.services import channel_runtime_native as native
    from app.api.routes import channels

    bot = SimpleNamespace(id=uuid4(), organization_id=uuid4())
    monkeypatch.setattr(channels, "_get_active_bot_version", lambda *a: (bot, None, None))
    db = SimpleNamespace(get=lambda *a: bot)
    command = native.NativeRoomCommand(
        organization_id=uuid4(), channel_type="webchat",
        payload=channels.ChannelRoomCreateRequest(bot_id=str(bot.id)),
        request=SimpleNamespace(headers={}, state=SimpleNamespace(request_id="native-test")),
    )
    with pytest.raises(HTTPException) as error:
        native.open_native_channel_room(db, command)
    assert error.value.status_code == 404


def test_native_room_cross_org_hides_inactive_version_before_resolution(monkeypatch):
    from app.services import channel_runtime_native as native
    from app.api.routes import channels
    bot = SimpleNamespace(id=uuid4(), organization_id=uuid4(), active_version_id=None)
    resolved = []
    def active_version(*args):
        resolved.append(True)
        raise HTTPException(status_code=409, detail="운영버전이 지정되지 않은 봇입니다.")
    monkeypatch.setattr(channels, "_get_active_bot_version", active_version)
    db = SimpleNamespace(get=lambda *a: bot)
    command = native.NativeRoomCommand(organization_id=uuid4(), channel_type="webchat",
        payload=channels.ChannelRoomCreateRequest(bot_id=str(bot.id)), request=SimpleNamespace())
    with pytest.raises(HTTPException) as error:
        native.open_native_channel_room(db, command)
    assert error.value.status_code == 404
    assert resolved == []


@pytest.mark.parametrize("boundary", ["organization", "bot", "room"])
def test_native_message_rejects_scope_mismatch_without_writes(room_case, boundary, monkeypatch):
    from app.services import channel_runtime_native as native
    channels, db, bot, version, room, request = room_case
    monkeypatch.setattr(native, "select", lambda *a: MagicMock())
    db.get.return_value = bot
    command = native.NativeMessageCommand(organization_id=uuid4() if boundary == "organization" else bot.organization_id,
        bot_id=uuid4() if boundary == "bot" else bot.id, channel_type="webchat", room_id=room.id,
        payload=channels.ChannelMessageRequest(message="synthetic"), request=request)
    if boundary == "room":
        db.scalar.return_value = None
    with pytest.raises(HTTPException) as error:
        native.execute_native_channel_message(db, command)
    assert error.value.status_code == 404
    assert db.add.call_count == 0
    assert db.commit.call_count == 0


@pytest.mark.parametrize("channel", ["webchat", "kakao", "ms-teams"])
@pytest.mark.parametrize("entry,outcome", [
    (entry, outcome) for entry in ("http", "native") for outcome in ("success", "ended", "error", "deferred")
] + [("envelope", outcome) for outcome in ("success", "ended", "error")])
def test_message_preserves_queue_output_session_and_error(room_case, monkeypatch, channel, outcome, entry):
    channels, db, bot, version, room, request = room_case
    class Room(SimpleNamespace):
        id = MagicMock()
        client_room_id = MagicMock()
        channel_type = MagicMock()
        status = MagicMock()
        deleted_at = MagicMock()
    room = Room(**vars(room), channel_type=channel, client_room_id="synthetic-room",
                participant_id="synthetic-actor", participant_name="사용자")
    monkeypatch.setattr(channels, "ChannelRoom", Room)
    db.scalar.return_value = room
    version.status = "active"
    version.name = "v1"
    version.version_no = 1
    version.version_json = {}
    bot.active_version_id = version.id
    bot.data_json = {}
    db.get.side_effect = lambda cls, key: bot if key == bot.id else version
    records = []
    def add(value):
        if not getattr(value, "id", None) or isinstance(value.id, MagicMock):
            value.id = uuid4()
        records.append(value)
    db.add.side_effect = add
    monkeypatch.setattr(channels, "ChannelMessage", lambda **kw: SimpleNamespace(id=uuid4(), **kw))
    monkeypatch.setattr(channels, "ChannelQueueEvent", lambda **kw: SimpleNamespace(id=uuid4(), intent_name=None, error_message=None, **kw))
    monkeypatch.setattr(channels, "AuditLog", lambda **kw: SimpleNamespace(**kw))
    monkeypatch.setattr(channels, "_serialize_message", lambda m: {"id": str(m.id), "text": m.text})
    monkeypatch.setattr(channels, "_ensure_botstation_connection", lambda *a: None)
    monkeypatch.setattr(channels, "_ensure_runtime_supported", lambda *a: None)
    monkeypatch.setattr(channels, "_load_default_messages", lambda *a: {})
    monkeypatch.setattr(channels, "_set_runtime_system_variables", lambda *a, **kw: None)
    monkeypatch.setattr(channels, "_interrupt_waiting_talk_with_intent", lambda doc, state, *a: ([], state, None, False))
    monkeypatch.setattr(channels, "_store_form_result_variable", lambda *a: (False, None))
    def execute(doc, state, *a):
        if outcome == "error":
            state["shouldRollback"] = True
            raise ValueError("synthetic-runtime-error")
        if outcome == "ended":
            state["sessionEnded"] = True
        return [{"text": "synthetic-reply"}], state
    monkeypatch.setattr(channels, "_handle_runtime_message", execute)
    request.client = None
    payload = channels.ChannelMessageRequest(message="synthetic-question", defer_processing=outcome == "deferred")
    if entry == "http":
        data = channels.create_channel_room_message(channel, room.id, payload, request, "key")["data"]
    else:
        from app.services import channel_runtime_native as native
        monkeypatch.setattr(native, "select", lambda *a: MagicMock())
        if entry == "native":
            data = native.execute_native_channel_message(db, native.NativeMessageCommand(
                organization_id=bot.organization_id, bot_id=bot.id, channel_type=channel,
                room_id=room.id, payload=payload, request=request))
        else:
            data = native.run_connection_envelope(db, native.ConnectionRuntimeEnvelope(
                organization_id=bot.organization_id, connection_id=uuid4(), bot_id=bot.id,
                channel_type=channel, native_room_hash="a" * 64, native_actor_hash="b" * 64,
                provider_event_key="c" * 64, message="synthetic-question", request=request))
    assert data["userMessage"]["text"] == "synthetic-question"
    assert data["channelType"] == channel
    assert db.commit.call_count == (2 if entry == "envelope" else 1)
    events = [r for r in records if hasattr(r, "request_message_id")]
    assert len(events) == 1
    if entry == "envelope":
        assert events[0].participant_id == "b" * 64
    assert events[0].parameter_json["message"] == "synthetic-question"
    assert data["queueEvent"]["status"] == {"deferred": "queued", "error": "failed"}.get(outcome, "completed")
    audits = [r for r in records if hasattr(r, "action_type")]
    if outcome == "deferred":
        assert data["botMessages"] == []
        assert data["queued"] is True
    elif outcome == "error":
        assert not room.metadata_json.get("shouldRollback")
        assert audits[-1].action_type == "channel.runtime.error"
        assert data["botMessage"]["text"] != "synthetic-reply"
    else:
        assert data["botMessages"][0]["text"] == "synthetic-reply"
        assert data["runtime"]["sessionEnded"] is (outcome == "ended")
        if outcome == "ended":
            assert room.status == "closed"
            assert audits[-1].action_type == "channel.session.closed"


@pytest.mark.parametrize("field", ["native_room_hash", "native_actor_hash", "provider_event_key"])
def test_envelope_rejects_external_raw_identifiers_before_database_access(field):
    from app.services import channel_runtime_native as native
    data = dict(organization_id=uuid4(), connection_id=uuid4(), bot_id=uuid4(), channel_type="webchat",
        native_room_hash="a" * 64, native_actor_hash="b" * 64, provider_event_key="c" * 64,
        message="synthetic", request=SimpleNamespace())
    data[field] = "synthetic-raw-external-id"
    db = MagicMock()
    with pytest.raises(ValueError):
        native.run_connection_envelope(db, native.ConnectionRuntimeEnvelope(**data))
    assert db.mock_calls == []


def test_http_key_rejection_does_not_open_database(room_case, monkeypatch):
    channels, db, bot, version, room, request = room_case
    def reject(key):
        raise HTTPException(status_code=401, detail="synthetic")
    monkeypatch.setattr(channels, "_verify_channel_key", reject)
    with pytest.raises(HTTPException) as error:
        channels.create_channel_room("webchat", channels.ChannelRoomCreateRequest(bot_id=str(bot.id)), request, None)
    assert error.value.status_code == 401
    assert db.mock_calls == []


def test_envelope_validates_message_before_room_creation(monkeypatch):
    from app.services import channel_runtime_native as native
    from pydantic import ValidationError
    writes = []
    def opened(db, command):
        writes.append(command.payload.client_room_id)
        return {"room": {"id": str(uuid4())}}
    monkeypatch.setattr(native, "open_native_channel_room", opened)
    with pytest.raises(ValidationError):
        native.run_connection_envelope(SimpleNamespace(), native.ConnectionRuntimeEnvelope(
            organization_id=uuid4(), connection_id=uuid4(), bot_id=uuid4(), channel_type="webchat",
            native_room_hash="a" * 64, native_actor_hash="b" * 64, provider_event_key="c" * 64,
            message="", request=SimpleNamespace()))
    assert writes == []
