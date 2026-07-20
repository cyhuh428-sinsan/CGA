from types import SimpleNamespace
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
import pytest

from app.api.routes import am


class _FakeSession:
    def __init__(self, scalar_value: Any = None, get_value: Any = None) -> None:
        self.scalar_value = scalar_value
        self.get_value = get_value

    def __enter__(self) -> "_FakeSession":
        return self

    def __exit__(self, *_args: object) -> None:
        pass

    def scalar(self, *_args: object, **_kwargs: object) -> Any:
        return self.scalar_value

    def get(self, *_args: object, **_kwargs: object) -> Any:
        return self.get_value

    def add(self, *_args: object, **_kwargs: object) -> None:
        pass

    def commit(self) -> None:
        pass

    def refresh(self, *_args: object, **_kwargs: object) -> None:
        pass


def _fake_request() -> SimpleNamespace:
    return SimpleNamespace(state=SimpleNamespace(request_id="req"))


def test_resolve_bot_id_supports_bot_id(monkeypatch: pytest.MonkeyPatch) -> None:
    bot_id = uuid4()
    bot = SimpleNamespace(id=bot_id, name="테스트봇")
    monkeypatch.setattr(am, "SessionLocal", lambda: _FakeSession())
    monkeypatch.setattr(
        am,
        "_list_active_channel_bots",
        lambda _db, channel_type, include_runtime_blocked=False: [(bot, object(), object())],
    )

    assert am._resolve_bot_id(str(bot_id), "webchat") == str(bot_id)


def test_resolve_bot_id_raises_when_not_found(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(am, "SessionLocal", lambda: _FakeSession())
    monkeypatch.setattr(
        am,
        "_list_active_channel_bots",
        lambda _db, channel_type, include_runtime_blocked=False: [],
    )

    with pytest.raises(HTTPException) as exc_info:
        am._resolve_bot_id("missing-bot", "webchat")

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "운영 채널 봇을 찾을 수 없습니다."


def test_resolve_room_requires_room_id_or_session_or_client_room_id() -> None:
    with pytest.raises(HTTPException) as exc_info:
        am._resolve_room("webchat", room_id=None, session_id=None, client_room_id=None)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "roomId, sessionId 또는 clientRoomId가 필요합니다."


def test_resolve_room_returns_open_room_by_room_id(monkeypatch: pytest.MonkeyPatch) -> None:
    room_id = uuid4()
    room = SimpleNamespace(id=room_id)
    monkeypatch.setattr(am, "SessionLocal", lambda: _FakeSession(scalar_value=room))

    assert am._resolve_room("webchat", room_id=room_id, session_id=None, client_room_id=None) is room


def test_resolve_room_returns_open_room_by_client_room_id(monkeypatch: pytest.MonkeyPatch) -> None:
    room = SimpleNamespace(id=uuid4())
    monkeypatch.setattr(am, "SessionLocal", lambda: _FakeSession(scalar_value=room))

    assert am._resolve_room("webchat", room_id=None, session_id=None, client_room_id="client-1") is room


def test_resolve_room_not_found_returns_404(monkeypatch: pytest.MonkeyPatch) -> None:
    room_id = uuid4()
    monkeypatch.setattr(am, "SessionLocal", lambda: _FakeSession(scalar_value=None))

    with pytest.raises(HTTPException) as exc_info:
        am._resolve_room("webchat", room_id=room_id, session_id=None, client_room_id=None)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "열린 대화 세션을 찾을 수 없습니다."


def test_start_am_session_reuses_existing_room_when_room_id_provided(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    room_id = uuid4()
    room = SimpleNamespace(id=room_id)
    monkeypatch.setattr(am, "_resolve_room", lambda _channel, _room_id, _session_id, _client_room_id: room)
    monkeypatch.setattr(am, "SessionLocal", lambda: _FakeSession(get_value=room))
    monkeypatch.setattr(am, "_serialize_room", lambda _db, _room: {"id": str(room_id)})

    response = am.start_am_session(
        "bot-1",
        am.AmSessionStartRequest(roomId=str(room_id)),
        _fake_request(),
    )

    assert response["data"]["sessionId"] == str(room_id)
    assert response["data"]["initialMessages"] == []


def test_create_am_room_builds_payload_with_resolved_bot_id(monkeypatch: pytest.MonkeyPatch) -> None:
    room_id = uuid4()

    called: dict[str, object] = {}

    def _fake_verify_key(_api_key: str | None) -> None:
        return None

    def _fake_create_room(
        channel: str,
        payload: am.ChannelRoomCreateRequest,
        _request: object,
        _api_key: str | None,
    ) -> dict[str, object]:
        called["channel"] = channel
        called["bot_id"] = payload.bot_id
        called["client_room_id"] = payload.client_room_id
        called["participant_id"] = payload.participant_id
        return {
            "data": {
                "room": {"id": str(room_id)},
                "sessionId": str(room_id),
                "roomId": str(room_id),
                "channelType": channel,
            },
            "meta": {"request_id": "req"},
        }

    monkeypatch.setattr(am, "_verify_channel_key", _fake_verify_key)
    monkeypatch.setattr(
        am,
        "create_channel_room",
        _fake_create_room,
    )
    monkeypatch.setattr(am, "_resolve_bot_id", lambda _bot_id, _channel_type: "bot-1")

    response = am.create_am_room(
        "bot-1",
        am.AmRoomCreateRequest(clientRoomId="c-1", participantId="user1"),
        _fake_request(),
    )

    assert called["channel"] == "webchat"
    assert called["bot_id"] == "bot-1"
    assert called["client_room_id"] == "c-1"
    assert called["participant_id"] == "user1"
    assert response["data"]["sessionId"] == str(room_id)

def test_start_am_session_reuses_existing_room_when_session_id_provided(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    room_id = uuid4()
    room = SimpleNamespace(id=room_id)
    monkeypatch.setattr(am, "_resolve_room", lambda _channel, _room_id, _session_id, _client_room_id: room)
    monkeypatch.setattr(am, "SessionLocal", lambda: _FakeSession(get_value=room))
    monkeypatch.setattr(am, "_serialize_room", lambda _db, _room: {"id": str(room_id)})

    response = am.start_am_session(
        "bot-1",
        am.AmSessionStartRequest(sessionId=str(room_id)),
        _fake_request(),
    )

    assert response["data"]["sessionId"] == str(room_id)
    assert response["data"]["initialMessages"] == []


def test_start_am_session_calls_create_room_when_room_not_provided(monkeypatch: pytest.MonkeyPatch) -> None:
    called = {"count": 0}

    def _fake_create_room(_bot_id: str, _payload: object, _request: object, _webchat_key: str | None) -> dict[str, object]:
        called["count"] += 1
        return {
            "data": {
                "room": {"id": "room-1"},
                "sessionId": "room-1",
                "roomId": "room-1",
                "channelType": "webchat",
            },
            "meta": {"request_id": "req"},
        }

    monkeypatch.setattr(am, "create_am_room", _fake_create_room)

    response = am.start_am_session("bot-1", am.AmSessionStartRequest(), _fake_request())

    assert called["count"] == 1
    assert response["data"]["sessionId"] == "room-1"


def test_send_am_chat_wraps_room_and_channel_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    room_id = uuid4()
    room = SimpleNamespace(id=room_id)

    def _fake_create_room_message(
        channel: str,
        target_room_id: str,
        message_request: object,
        request: object,
        webchat_key: str | None,
    ) -> dict[str, object]:
        assert channel == "webchat"
        assert str(target_room_id) == str(room_id)
        assert getattr(message_request, "message") == "안녕하세요"
        return {
            "data": {
                "messages": [{"type": "text", "text": "안녕하세요"}],
                "room": {"id": str(room_id)},
            },
            "meta": {"request_id": "req"},
        }

    monkeypatch.setattr(am, "_resolve_room", lambda _channel, _room_id, _session_id, _client_room_id: room)
    monkeypatch.setattr(am, "create_channel_room_message", _fake_create_room_message)

    response = am.send_am_chat(
        "bot-1",
        am.AmChatRequest(roomId=str(room_id), message="안녕하세요"),
        _fake_request(),
    )

    assert response["data"]["sessionId"] == str(room_id)
    assert response["data"]["roomId"] == str(room_id)
    assert response["data"]["channelType"] == "webchat"
    assert response["data"]["messages"] == [{"type": "text", "text": "안녕하세요"}]


def test_start_am_dialog_delegates_to_session_start_and_chat(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = {"start": 0, "chat": 0}
    room_id = uuid4()

    def _fake_start_session(
        _bot_id: str,
        _payload: object,
        _request: object,
        _webchat_key: str | None,
    ) -> dict[str, object]:
        calls["start"] += 1
        return {
            "data": {
                "sessionId": str(room_id),
                "roomId": str(room_id),
            },
            "meta": {"request_id": "req"},
        }

    def _fake_send_chat(
        _bot_id: str,
        _payload: object,
        _request: object,
        _webchat_key: str | None,
    ) -> dict[str, object]:
        calls["chat"] += 1
        return {
            "data": {
                "messages": [{"type": "text", "text": "안녕하세요"}],
                "room": {"id": str(room_id)},
                "sessionId": str(room_id),
                "roomId": str(room_id),
                "channelType": "webchat",
            },
            "meta": {"request_id": "req"},
        }

    monkeypatch.setattr(am, "start_am_session", _fake_start_session)
    monkeypatch.setattr(am, "send_am_chat", _fake_send_chat)

    response = am.start_am_dialog(
        "bot-1",
        am.AmDialogStartRequest(message="안녕하세요"),
        _fake_request(),
    )

    assert calls["start"] == 1
    assert calls["chat"] == 1
    assert response["data"]["started"] is True
    assert response["data"]["messages"] == [{"type": "text", "text": "안녕하세요"}]


def test_start_am_dialog_raises_when_session_id_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_start_session(
        _bot_id: str,
        _payload: object,
        _request: object,
        _webchat_key: str | None,
    ) -> dict[str, object]:
        return {"data": {}, "meta": {"request_id": "req"}}

    monkeypatch.setattr(am, "start_am_session", _fake_start_session)

    with pytest.raises(HTTPException) as exc_info:
        am.start_am_dialog("bot-1", am.AmDialogStartRequest(message="안녕하세요"), _fake_request())

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "대화 세션을 시작하지 못했습니다."


def test_end_am_session_marks_room_closed_and_sets_metadata(monkeypatch: pytest.MonkeyPatch) -> None:
    room_id = uuid4()
    room = SimpleNamespace(id=room_id, metadata_json={})
    monkeypatch.setattr(am, "_resolve_bot_id", lambda _bot_id, _channel: "bot-1")
    monkeypatch.setattr(am, "_resolve_room", lambda _channel, _room_id, _session_id, _client_room_id: room)
    monkeypatch.setattr(am, "SessionLocal", lambda: _FakeSession(get_value=room))
    monkeypatch.setattr(am, "_serialize_room", lambda _db, _room: {"id": str(room_id)})
    monkeypatch.setattr(am, "flag_modified", lambda *_args, **_kwargs: None)

    response = am.end_am_session(
        "bot-1",
        am.AmSessionEndRequest(roomId=str(room_id)),
        _fake_request(),
    )

    assert response["data"]["ended"] is True
    assert response["data"]["sessionId"] == str(room_id)
    assert room.status == "closed"
    assert room.metadata_json["sessionEndReason"] == "external_session_end"
    assert room.metadata_json["endedAt"] is not None


def test_create_am_room_rejects_invalid_webchat_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        am,
        "_verify_channel_key",
        lambda _api_key: (_ for _ in ()).throw(
            HTTPException(status_code=401, detail="채널 API 인증이 필요합니다.")
        ),
    )

    with pytest.raises(HTTPException) as exc_info:
        am.create_am_room("bot-1", am.AmRoomCreateRequest(), _fake_request())

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "채널 API 인증이 필요합니다."
