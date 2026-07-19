from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.api.routes import channels


def test_update_room_conversation_history_for_message_tracks_session_summary() -> None:
    room = SimpleNamespace(
        id=uuid4(),
        client_room_id="room-1",
        participant_id="visitor-1",
        participant_name="사용자",
        channel_type="webchat",
        status="open",
        bot_id=uuid4(),
        bot_version_id=uuid4(),
        metadata_json={},
    )
    user_message = SimpleNamespace(
        created_at=datetime(2026, 6, 18, 9, 23, 12, tzinfo=timezone.utc),
        participant_kind="user",
        text="첫 질문",
    )
    bot_message = SimpleNamespace(
        created_at=datetime(2026, 6, 18, 9, 23, 13, tzinfo=timezone.utc),
        participant_kind="bot",
        text="안녕하세요",
    )

    channels._update_room_conversation_history_for_message(room, user_message)
    channels._update_room_conversation_history_for_message(room, bot_message)

    history = room.metadata_json["conversationHistory"]
    assert history["started_at"] == "2026-06-18T09:23:12+00:00"
    assert history["first_user_utterance"] == "첫 질문"
    assert history["user_utterances"] == ["첫 질문"]
    assert history["user_raw_utterances"] == ["첫 질문"]
    assert history["user_message_count"] == 1
    assert history["message_count"] == 2
    assert history["last_message_at"] == "2026-06-18T09:23:13+00:00"
    assert len(history["transcript"]) == 2
    assert history["transcript"][0]["display_text"] == "첫 질문"
    assert history["transcript"][1]["display_text"] == "안녕하세요"


def test_update_room_conversation_history_for_webchat_payload_stores_readable_user_utterance() -> None:
    room = SimpleNamespace(
        id=uuid4(),
        client_room_id="room-2",
        participant_id="visitor-2",
        participant_name="사용자",
        channel_type="webchat",
        status="open",
        bot_id=uuid4(),
        bot_version_id=uuid4(),
        metadata_json={},
    )
    user_message = SimpleNamespace(
        created_at=datetime(2026, 6, 19, 1, 44, 28, tzinfo=timezone.utc),
        participant_kind="user",
        text='{"webchatRichFormVersion":"1.0","response":{"input":{"value":"BUTTON","title":"BUTTON","validated":true,"key":"input"},"buttonValue":"BUTTON"}}',
        payload_json={},
    )
    bot_message = SimpleNamespace(
        created_at=datetime(2026, 6, 19, 1, 44, 29, tzinfo=timezone.utc),
        participant_kind="bot",
        text="RichForm",
        payload_json={"richForm": {"title": "다음 중 선택하세요", "options": [{"label": "예금"}, {"label": "대출"}]}},
    )

    channels._update_room_conversation_history_for_message(room, user_message)
    channels._update_room_conversation_history_for_message(room, bot_message)

    history = room.metadata_json["conversationHistory"]
    assert history["first_user_utterance"] == "버튼 선택: BUTTON"
    assert history["user_utterances"] == ["버튼 선택: BUTTON"]
    assert history["user_raw_utterances"] == [user_message.text]
    assert history["transcript"][0]["display_text"] == "버튼 선택: BUTTON"
    assert history["transcript"][1]["display_text"] == "다음 중 선택하세요 / 예금, 대출"


def test_update_room_conversation_history_for_queue_event_tracks_completion() -> None:
    room = SimpleNamespace(
        id=uuid4(),
        client_room_id="room-1",
        participant_id="visitor-1",
        participant_name="사용자",
        channel_type="webchat",
        status="closed",
        bot_id=uuid4(),
        bot_version_id=uuid4(),
        metadata_json={"endedAt": "2026-06-18T09:25:00+00:00", "sessionEndReason": "end_session_immediately"},
    )
    queue_event = SimpleNamespace(
        id=uuid4(),
        status="completed",
        intent_name="이체 문의",
        result_json={"dialogEnded": True, "sessionEnded": True, "completionReason": "session_end"},
    )

    channels._update_room_conversation_history_for_queue_event(room, queue_event)

    history = room.metadata_json["conversationHistory"]
    assert history["latest_queue_status"] == "completed"
    assert history["latest_intent_name"] == "이체 문의"
    assert history["start_intent_name"] == "이체 문의"
    assert history["dialog_ended"] is True
    assert history["session_ended"] is True
    assert history["completion_reason"] == "session_end"
    assert history["ended_at"] == "2026-06-18T09:25:00+00:00"
    assert history["session_end_reason"] == "end_session_immediately"


def test_update_room_conversation_history_for_queue_event_tracks_start_module_name() -> None:
    room = SimpleNamespace(
        id=uuid4(),
        client_room_id="room-2",
        participant_id="visitor-2",
        participant_name="사용자",
        channel_type="webchat",
        status="open",
        bot_id=uuid4(),
        bot_version_id=uuid4(),
        metadata_json={},
    )
    queue_event = SimpleNamespace(
        id=uuid4(),
        status="completed",
        intent_name=None,
        result_json={
            "runtimeEvents": [
                {"startModuleName": "콜백 예약"},
                {"dialogName": "답변"},
            ]
        },
    )

    channels._update_room_conversation_history_for_queue_event(room, queue_event)

    history = room.metadata_json["conversationHistory"]
    assert history["start_intent_name"] is None
    assert history["start_module_name"] == "콜백 예약"
