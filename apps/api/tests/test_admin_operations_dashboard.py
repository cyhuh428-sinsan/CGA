import json
from types import SimpleNamespace
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.api.routes import admin


@pytest.fixture(autouse=True)
def isolate_container_log_root(tmp_path, monkeypatch):
    """컨테이너 절대 경로를 임시 경로로 돌려 호스트 로그가 섞이지 않게 한다.

    로그 조회는 ROOT_DIR 기준 경로 외에 컨테이너 배포용 절대 경로도 함께 훑는다.
    ROOT_DIR만 tmp_path로 바꾸면 그 절대 경로는 그대로 남아, 실행 호스트에 같은
    경로가 실재할 경우 실제 로그가 결과에 섞여 테스트가 환경에 따라 실패한다.
    """

    monkeypatch.setattr(admin, "CONTAINER_ROOT_DIR", tmp_path / "__absent_container_root__")


class _FakeScalarResult:
    def __init__(self, rows: list[SimpleNamespace]) -> None:
        self._rows = rows

    def all(self) -> list[SimpleNamespace]:
        return self._rows


class _FakeDb:
    def __init__(self, *row_sets: list[SimpleNamespace]) -> None:
        self._row_sets = list(row_sets)

    def scalars(self, *_args: object, **_kwargs: object) -> _FakeScalarResult:
        return _FakeScalarResult(self._row_sets.pop(0) if self._row_sets else [])


def test_recent_system_error_snapshot_counts_all_recent_errors(tmp_path, monkeypatch) -> None:
    log_dir = tmp_path / "logs" / "api"
    log_dir.mkdir(parents=True)
    now = datetime.now(timezone.utc)
    lines = [
        json.dumps(
            {
                "time": (now - timedelta(days=10)).isoformat(),
                "level": "error",
                "message": "기간 밖 오류",
            },
            ensure_ascii=False,
        )
    ]
    for index in reversed(range(25)):
        lines.append(
            json.dumps(
                {
                    "time": (now - timedelta(minutes=index)).isoformat(),
                    "level": "error",
                    "logger": "aidot.test",
                    "event": "test.error",
                    "message": f"오류 {index}",
                    "path": "/api/test",
                    "request_id": f"req-{index}",
                },
                ensure_ascii=False,
            )
        )
    (log_dir / "error.log").write_text("\n".join(lines), encoding="utf-8")

    monkeypatch.setattr(admin, "ROOT_DIR", tmp_path)

    total, rows = admin._recent_system_error_snapshot(now - timedelta(days=7), limit=20)

    assert total == 25
    assert len(rows) == 20
    assert rows[0]["message"] == "오류 0"


def test_recent_slow_db_request_count_uses_request_log_metrics(tmp_path, monkeypatch) -> None:
    log_dir = tmp_path / "logs" / "api"
    log_dir.mkdir(parents=True)
    now = datetime.now(timezone.utc)
    lines = [
        json.dumps(
            {
                "time": (now - timedelta(days=10)).isoformat(),
                "level": "info",
                "event": "api.request",
                "message": "기간 밖 느린 DB",
                "data": {"db_duration_ms": 900, "db_query_count": 9},
            },
            ensure_ascii=False,
        ),
        json.dumps(
            {
                "time": (now - timedelta(minutes=3)).isoformat(),
                "level": "info",
                "event": "api.request",
                "message": "정상 DB",
                "data": {"db_duration_ms": 100, "db_query_count": 2},
            },
            ensure_ascii=False,
        ),
        json.dumps(
            {
                "time": (now - timedelta(minutes=2)).isoformat(),
                "level": "info",
                "event": "api.request",
                "message": "느린 DB",
                "data": {"db_duration_ms": 800, "db_query_count": 8},
            },
            ensure_ascii=False,
        ),
    ]
    (log_dir / "app.log").write_text("\n".join(lines), encoding="utf-8")
    monkeypatch.setattr(admin, "ROOT_DIR", tmp_path)

    assert admin._recent_slow_db_request_count(now - timedelta(days=7), 700) == 1


def test_slow_request_summary_groups_by_kind_method_and_path() -> None:
    rows = [
        {
            "kind": "api",
            "method": "GET",
            "path": "/api/v1/bots",
            "elapsed_ms": 1200,
            "db_duration_ms": 400,
            "occurred_at": "2026-05-18T01:00:00+00:00",
        },
        {
            "kind": "api",
            "method": "GET",
            "path": "/api/v1/bots",
            "elapsed_ms": 800,
            "db_duration_ms": 200,
            "occurred_at": "2026-05-18T01:01:00+00:00",
        },
        {
            "kind": "db",
            "method": "GET",
            "path": "/api/v1/admin/operations-dashboard",
            "elapsed_ms": 300,
            "db_duration_ms": 900,
            "occurred_at": "2026-05-18T01:02:00+00:00",
        },
    ]

    summary = admin._slow_request_summary_rows(rows)

    assert summary[0]["id"] == "api:GET:/api/v1/bots"
    assert summary[0]["count"] == 2
    assert summary[0]["max_elapsed_ms"] == 1200
    assert summary[0]["avg_elapsed_ms"] == 1000
    assert summary[0]["max_db_duration_ms"] == 400
    assert summary[0]["avg_db_duration_ms"] == 300
    assert summary[0]["latest_occurred_at"] == "2026-05-18T01:01:00+00:00"


def test_slow_request_rows_preserve_source_log_id() -> None:
    occurred_at = "2026-05-18T01:00:00+00:00"
    rows = admin._recent_slow_request_rows(
        datetime.fromisoformat("2026-05-18T00:00:00+00:00"),
        0.0,
        recent_items=[
            {
                "id": "app.log:42",
                "time": occurred_at,
                "event": "api.slow_request",
                "method": "GET",
                "path": "/api/v1/bots",
                "elapsed_ms": 1200,
                "data": {"db_duration_ms": 400, "db_query_count": 3},
            }
        ],
    )

    assert rows[0]["id"] == "app.log:42"


def test_operations_dashboard_summary_includes_slow_thresholds(monkeypatch) -> None:
    monkeypatch.setattr(admin.settings, "api_slow_request_threshold_ms", 1200.0)
    monkeypatch.setattr(admin.settings, "db_slow_query_threshold_ms", 650.0)

    summary = admin._slow_request_threshold_summary()

    assert summary["slow_api_threshold_ms"] == 1200.0
    assert summary["slow_db_threshold_ms"] == 650.0


def test_runtime_event_location_formats_dialog_and_node_metadata() -> None:
    location = admin._runtime_event_location(
        {
            "dialogName": "예약 모듈",
            "nodeTitle": "API 호출",
            "nodeKind": "function",
            "nodeId": "function-1",
        }
    )

    assert location == "예약 모듈 / API 호출 (function · function-1)"


def test_runtime_summary_prefers_latest_problem_event() -> None:
    summary = admin._runtime_summary(
        [
            {"level": "info", "event": "channel.runtime.message_received", "message": "메시지를 수신했습니다."},
            {"level": "error", "event": "channel.runtime.function_failed", "message": "Function 실행에 실패했습니다."},
            {"level": "info", "event": "channel.runtime.completed", "message": "채널 Queue 처리를 완료했습니다."},
        ],
        "completed",
    )

    assert summary == "Function 실행에 실패했습니다."


def test_runtime_summary_uses_last_event_when_no_problem() -> None:
    summary = admin._runtime_summary(
        [
            {"level": "info", "event": "channel.runtime.message_received", "message": "메시지를 수신했습니다."},
            {"level": "info", "event": "channel.runtime.completed", "message": "대화가 종료되었습니다."},
        ],
        "completed",
    )

    assert summary == "대화가 종료되었습니다."


def test_channel_conversation_result_marks_dialog_and_session_completion() -> None:
    room = SimpleNamespace(status="open")

    failed = admin._channel_conversation_result(SimpleNamespace(status="completed", error_message="오류"), room, {})
    session_ended = admin._channel_conversation_result(SimpleNamespace(status="completed", error_message=None), room, {"sessionEnded": True, "dialogEnded": True})
    dialog_ended = admin._channel_conversation_result(SimpleNamespace(status="completed", error_message=None), room, {"dialogEnded": True})
    running = admin._channel_conversation_result(SimpleNamespace(status="processing", error_message=None), room, {})
    no_event = admin._channel_conversation_result(None, room, {})

    assert failed == "실패"
    assert session_ended == "세션종료"
    assert dialog_ended == "대화종료"
    assert running == "processing"
    assert no_event == "open"


def test_build_channel_session_history_item_prefers_room_history_snapshot() -> None:
    room_id = uuid4()
    queue_event_id = uuid4()
    room = SimpleNamespace(
        id=room_id,
        channel_type="webchat",
        participant_id="visitor-1",
        client_room_id="room-1",
        status="closed",
        created_at=datetime(2026, 6, 18, 9, 0, tzinfo=timezone.utc),
        metadata_json={
            "conversationHistory": {
                "started_at": "2026-06-18T09:23:12+00:00",
                "first_user_utterance": "안녕하세요",
                "user_utterances": ["안녕하세요", "계좌이체 문의"],
                "user_message_count": 2,
                "message_count": 5,
                "latest_queue_event_id": str(queue_event_id),
                "latest_queue_status": "completed",
                "latest_intent_name": "이체 문의",
                "dialog_ended": True,
                "session_ended": True,
                "completion_reason": "session_end",
                "ended_at": "2026-06-18T09:25:00+00:00",
                "session_end_reason": "end_session_immediately",
            }
        },
    )
    latest_event = SimpleNamespace(
        id=queue_event_id,
        status="completed",
        error_message=None,
        intent_name=None,
        result_json={
            "runtimeEvents": [
                {
                    "event": "channel.runtime.completed",
                    "message": "채널 Queue 처리를 완료했습니다.",
                }
            ]
        },
    )

    item = admin._build_channel_session_history_item(
        room=room,
        room_messages=[
            {"participant_kind": "user", "participant_name": "사용자", "text": "안녕하세요", "created_at": "2026-06-18T09:23:12+00:00"},
            {"participant_kind": "bot", "participant_name": "봇", "text": "무엇을 도와드릴까요?", "created_at": "2026-06-18T09:23:13+00:00"},
        ],
        latest_event=latest_event,
        runtime_events=[{"event": "channel.runtime.completed", "message": "채널 Queue 처리를 완료했습니다."}],
        bot=SimpleNamespace(name="Aidot 봇"),
        version=SimpleNamespace(version_no=1),
        group=SimpleNamespace(name="기본그룹"),
    )

    assert item.intent_or_module_name == "이체 문의"
    assert item.uttered_at.isoformat() == "2026-06-18T09:23:12+00:00"
    assert item.data_json["session_first_user_utterance"] == "안녕하세요"
    assert item.data_json["session_user_message_count"] == 2
    assert item.data_json["session_message_count"] == 5
    assert item.data_json["queue_event_id"] == str(queue_event_id)
    assert item.data_json["session_end_reason"] == "end_session_immediately"


def test_build_channel_session_history_item_formats_kakao_channel_name() -> None:
    room_id = uuid4()
    room = SimpleNamespace(
        id=room_id,
        channel_type="kakao",
        participant_id="kakao-user-1",
        client_room_id="kakao-room-1",
        status="open",
        created_at=datetime(2026, 6, 22, 12, 0, tzinfo=timezone.utc),
        metadata_json={
            "conversationHistory": {
                "started_at": "2026-06-22T12:00:00+00:00",
                "first_user_utterance": "상담원 연결해줘",
                "user_utterances": ["상담원 연결해줘"],
                "user_raw_utterances": ["상담원 연결해줘"],
                "user_message_count": 1,
                "message_count": 2,
                "start_intent_name": "상담원 연결",
            }
        },
    )

    item = admin._build_channel_session_history_item(
        room=room,
        room_messages=[
            {"participant_kind": "user", "participant_name": "사용자", "text": "상담원 연결해줘", "created_at": "2026-06-22T12:00:00+00:00"},
            {"participant_kind": "bot", "participant_name": "Aidot 봇", "text": "상담원을 연결하겠습니다.", "created_at": "2026-06-22T12:00:01+00:00"},
        ],
        latest_event=None,
        runtime_events=[],
        bot=SimpleNamespace(name="Aidot 봇"),
        version=SimpleNamespace(version_no=1),
        group=SimpleNamespace(name="기본그룹"),
    )

    assert item.channel_name == "Kakao"
    assert item.intent_or_module_name == "상담원 연결"
    assert item.data_json["session_user_utterances"] == ["상담원 연결해줘"]
    assert item.data_json["session_first_user_utterance"] == "상담원 연결해줘"


def test_default_admin_templates_include_kakao_supported_renderers() -> None:
    kakao_templates = [item for item in admin.DEFAULT_ADMIN_TEMPLATES if item["channel_code"] == "KAKAO"]

    assert [item["renderer_type"] for item in kakao_templates] == [
        "simple-text",
        "quick-reply",
        "basic-card",
        "list-card",
        "carousel",
    ]
    assert [item["name"] for item in kakao_templates] == [
        "기본 메시지",
        "Quick Replies",
        "Basic Card",
        "List Card",
        "Carousel",
    ]


def test_template_renderer_issues_accepts_only_kakao_supported_renderers_for_kakao_channel() -> None:
    assert admin._template_renderer_issues(channel_code="KAKAO", renderer_type="simple-text") == []
    assert admin._template_renderer_issues(channel_code="KAKAO", renderer_type="quick-reply") == []
    assert admin._template_renderer_issues(channel_code="KAKAO", renderer_type="basic-card") == []
    assert admin._template_renderer_issues(channel_code="KAKAO", renderer_type="list-card") == []
    assert admin._template_renderer_issues(channel_code="KAKAO", renderer_type="carousel") == []
    assert admin._template_renderer_issues(channel_code="KAKAO", renderer_type="html") == [
        "카카오 템플릿은 simple-text, quick-reply, basic-card, list-card, carousel만 지원합니다."
    ]


def test_template_renderer_issues_blocks_only_kakao_specific_renderers_on_other_channels() -> None:
    assert admin._template_renderer_issues(channel_code="SM_CHAT", renderer_type="simple-text") == [
        "카카오 전용 템플릿은 KAKAO 채널에서만 사용할 수 있습니다."
    ]
    assert admin._template_renderer_issues(channel_code="SIMULATOR", renderer_type="basic-card") == [
        "카카오 전용 템플릿은 KAKAO 채널에서만 사용할 수 있습니다."
    ]
    assert admin._template_renderer_issues(channel_code="SM_CHAT", renderer_type="carousel") == []
    assert admin._template_renderer_issues(channel_code="WEBCHAT", renderer_type="carousel") == []
    assert admin._template_renderer_issues(channel_code="SM_CHAT", renderer_type="text") == []


def test_recent_runtime_event_rows_include_problem_location() -> None:
    bot_id = uuid4()
    queue_event = SimpleNamespace(
        id=uuid4(),
        bot_id=bot_id,
        channel_type="webchat",
        room_id=uuid4(),
        status="completed",
        error_message=None,
        intent_name=None,
        status_changed_at=datetime.now(timezone.utc),
        parameter_json={"message": "예약"},
        result_json={
            "runtimeEvents": [
                {
                    "time": "2026-05-09T01:02:03+00:00",
                    "level": "error",
                    "event": "channel.runtime.function_failed",
                    "message": "Function 실행 실패 후 예외 흐름이 없어 대화를 종료합니다.",
                    "dialogName": "예약 모듈",
                    "nodeTitle": "예약 API",
                    "nodeKind": "function",
                    "nodeId": "function-1",
                }
            ]
        },
    )
    bot = SimpleNamespace(name="테스트봇")

    rows = admin._recent_runtime_event_rows([queue_event], {bot_id: bot})

    assert rows[0]["data_json"]["problem_location"] == "예약 모듈 / 예약 API (function · function-1)"
    assert rows[0]["data_json"]["queue_payload"] == {"message": "예약"}


def test_queue_status_counts_separates_worker_states() -> None:
    queue_events = [
        SimpleNamespace(status="queued", error_message=None),
        SimpleNamespace(status="processing", error_message=None),
        SimpleNamespace(status="completed", error_message=None),
        SimpleNamespace(status="failed", error_message="실패"),
        SimpleNamespace(status="completed", error_message="후처리 오류"),
    ]

    assert admin._queue_status_counts(queue_events) == {
        "queue_queued": 1,
        "queue_processing": 1,
        "queue_completed": 2,
        "queue_failed": 2,
    }


def test_operations_alerts_include_lock_conflict_and_expired_lock() -> None:
    alerts = admin._operations_alerts(
        {
            "period_days": 7,
            "system_errors": 0,
            "queue_failed": 0,
            "slow_api_requests": 0,
            "slow_db_requests": 0,
            "runtime_problem_events": 0,
            "api_errors": 0,
            "training_failed": 0,
            "active_edit_locks": 0,
            "expired_edit_locks": 2,
            "edit_lock_conflicts": 3,
        },
        {
            "enabled": False,
            "available": False,
            "read_errors": 0,
            "write_errors": 0,
            "purge_errors": 0,
            "hits": 0,
            "misses": 0,
            "hit_rate": 0,
            "memory_usage_percent": None,
        },
    )

    assert {item["code"] for item in alerts} == {"edit_lock_conflicts", "expired_edit_locks"}


def test_operations_alerts_include_version_storage_status() -> None:
    alerts = admin._operations_alerts(
        {
            "period_days": 7,
            "system_errors": 0,
            "queue_failed": 0,
            "slow_api_requests": 0,
            "slow_db_requests": 0,
            "runtime_problem_events": 0,
            "api_errors": 0,
            "training_failed": 0,
            "active_edit_locks": 0,
            "expired_edit_locks": 0,
            "edit_lock_conflicts": 0,
            "version_storage_missing_versions": 2,
            "version_storage_mismatch_versions": 1,
        },
        {
            "enabled": False,
            "available": False,
            "read_errors": 0,
            "write_errors": 0,
            "purge_errors": 0,
            "hits": 0,
            "misses": 0,
            "hit_rate": 0,
            "memory_usage_percent": None,
        },
    )

    assert {item["code"] for item in alerts} == {"version_storage_mismatch", "version_storage_missing"}


def test_operations_alerts_include_version_read_snapshot_status() -> None:
    alerts = admin._operations_alerts(
        {
            "period_days": 7,
            "version_read_snapshot_missing_versions": 3,
        },
        {
            "enabled": False,
            "available": False,
            "read_errors": 0,
            "write_errors": 0,
            "purge_errors": 0,
            "hits": 0,
            "misses": 0,
            "hit_rate": 0,
            "memory_usage_percent": None,
        },
    )

    assert {item["code"] for item in alerts} == {"version_read_snapshot_missing"}


def test_assign_version_read_snapshot_updates_summary_columns() -> None:
    version = SimpleNamespace(
        asset_counts_json=None,
        scenario_validation_json=None,
        nlu_training_json=None,
    )

    admin._assign_version_read_snapshot(
        version,
        {
            "dialogs": [
                {"id": "module-1", "dialogType": 0},
                {"id": "intent-1", "dialogType": 1},
            ],
            "entities": [{"id": "entity-1"}],
            "dictionary": [{"id": "term-1"}],
            "apis": [{"id": "api-1"}],
            "system_config": {"nlu_training": {"status": "success"}},
        },
    )

    assert version.asset_counts_json["dialogs"] == 2
    assert version.asset_counts_json["intents"] == 1
    assert version.asset_counts_json["modules"] == 1
    assert version.asset_counts_json["entities"] == 1
    assert isinstance(version.scenario_validation_json, dict)
    assert version.nlu_training_json == {"status": "success"}
    assert version.entities_json == [{"id": "entity-1"}]
    assert version.dictionary_json == [{"id": "term-1"}]
    assert version.apis_json == [{"id": "api-1"}]
    assert version.system_config_json == {"nlu_training": {"status": "success"}}


def test_version_dialog_split_summary_counts_missing_and_mismatch_versions() -> None:
    complete_version_id = uuid4()
    missing_version_id = uuid4()
    mismatch_version_id = uuid4()
    versions = [
        SimpleNamespace(
            id=complete_version_id,
            version_json={
                "dialogs": [{"id": "intent-1", "dialogType": 1}],
                "dialog_flow_graphs": [{"dialogId": "intent-1"}],
            },
        ),
        SimpleNamespace(
            id=missing_version_id,
            version_json={
                "dialogs": [{"id": "intent-2", "dialogType": 1}],
                "dialog_flow_graphs": [],
            },
        ),
        SimpleNamespace(
            id=mismatch_version_id,
            version_json={
                "dialogs": [{"id": "intent-3", "dialogType": 1}],
                "dialog_flow_graphs": [{"dialogId": "intent-3"}],
            },
        ),
    ]

    summary = admin._version_dialog_split_summary(
        versions,
        {
            complete_version_id: [SimpleNamespace(dialog_id="intent-1")],
            mismatch_version_id: [SimpleNamespace(dialog_id="stale-intent")],
        },
        {
            complete_version_id: [SimpleNamespace(dialog_id="intent-1")],
            mismatch_version_id: [SimpleNamespace(dialog_id="intent-3")],
        },
    )

    assert summary["total_versions"] == 3
    assert summary["split_versions"] == 2
    assert summary["missing_versions"] == 1
    assert summary["mismatch_versions"] == 2
    assert summary["dialog_mismatch_versions"] == 2
    assert summary["graph_mismatch_versions"] == 0
    assert summary["expected_dialog_rows"] == 3
    assert summary["actual_dialog_rows"] == 2


def test_version_dialog_split_issue_rows_lists_problem_versions() -> None:
    bot_id = uuid4()
    complete_version_id = uuid4()
    missing_version_id = uuid4()
    mismatch_version_id = uuid4()
    bot = SimpleNamespace(id=bot_id, name="테스트봇")
    complete_version = SimpleNamespace(
        id=complete_version_id,
        name="v1",
        version_no=1,
        updated_at=datetime(2026, 5, 18, tzinfo=timezone.utc),
        version_json={
            "dialogs": [{"id": "intent-1", "dialogType": 1}],
            "dialog_flow_graphs": [{"dialogId": "intent-1"}],
        },
    )
    missing_version = SimpleNamespace(
        id=missing_version_id,
        name="v2",
        version_no=2,
        updated_at=datetime(2026, 5, 18, tzinfo=timezone.utc),
        version_json={
            "dialogs": [{"id": "intent-2", "dialogType": 1}],
            "dialog_flow_graphs": [],
        },
    )
    mismatch_version = SimpleNamespace(
        id=mismatch_version_id,
        name="v3",
        version_no=3,
        updated_at=datetime(2026, 5, 18, tzinfo=timezone.utc),
        version_json={
            "dialogs": [{"id": "intent-3", "dialogType": 1}],
            "dialog_flow_graphs": [{"dialogId": "intent-3"}],
        },
    )

    rows = admin._version_dialog_split_issue_rows(
        [(complete_version, bot), (missing_version, bot), (mismatch_version, bot)],
        {
            complete_version_id: [SimpleNamespace(dialog_id="intent-1")],
            mismatch_version_id: [SimpleNamespace(dialog_id="stale-intent")],
        },
        {
            complete_version_id: [SimpleNamespace(dialog_id="intent-1")],
            mismatch_version_id: [SimpleNamespace(dialog_id="intent-3")],
        },
    )

    assert [row["version_name"] for row in rows] == ["v2", "v3"]
    assert rows[0]["status"] == "missing"
    assert rows[0]["missing_dialog_ids"] == ["intent-2"]
    assert rows[1]["status"] == "mismatch"
    assert rows[1]["missing_dialog_ids"] == ["intent-3"]
    assert rows[1]["extra_dialog_ids"] == ["stale-intent"]


def test_intent_feedback_collects_fallback_and_low_score_diagnostics(monkeypatch) -> None:
    organization_id = uuid4()
    group_id = uuid4()
    bot_id = uuid4()
    version_id = uuid4()
    fallback_message_id = uuid4()
    low_score_message_id = uuid4()
    now = datetime.now(timezone.utc)
    fallback_event = SimpleNamespace(
        id=uuid4(),
        bot_id=bot_id,
        bot_version_id=version_id,
        request_message_id=fallback_message_id,
        channel_type="kakao",
        intent_name="",
        result_json={
            "intentId": None,
            "intentScore": 0,
            "runtimeEvents": [
                {
                    "event": "channel.runtime.intent_fallback",
                    "data": {"messagePreview": "배송 조회해줘", "intentScore": 0},
                }
            ],
        },
        status_changed_at=now,
    )
    low_score_event = SimpleNamespace(
        id=uuid4(),
        bot_id=bot_id,
        bot_version_id=version_id,
        request_message_id=low_score_message_id,
        channel_type="kakao",
        intent_name="예약",
        result_json={
            "intentId": str(uuid4()),
            "intentScore": 42,
            "runtimeEvents": [
                {
                    "event": "channel.runtime.intent_matched",
                    "data": {"intentName": "예약", "intentScore": 42},
                }
            ],
        },
        status_changed_at=now,
    )
    bot = SimpleNamespace(id=bot_id, group_id=group_id, name="상담봇")
    version = SimpleNamespace(
        id=version_id,
        version_no=3,
        version_json={
            "system_config": {
                "nlu_evaluation": {
                    "quality_diagnostics": {
                        "summary": {"warning_count": 1},
                        "settings": {"cutoff": 50},
                        "items": [
                            {
                                "expected_name": "예약",
                                "predicted_name": "예약",
                                "feature": "예약변경",
                                "score": 42,
                            }
                        ],
                    }
                }
            }
        },
    )
    fallback_message = SimpleNamespace(id=fallback_message_id, text="배송 조회해줘")
    low_score_message = SimpleNamespace(id=low_score_message_id, text="예약 바꿔줘")
    group = SimpleNamespace(id=group_id, name="고객센터")
    db = _FakeDb(
        [fallback_event, low_score_event],
        [bot],
        [version],
        [fallback_message, low_score_message],
        [group],
    )
    request = SimpleNamespace(state=SimpleNamespace(request_id="req"))
    current_user = SimpleNamespace(id=uuid4(), organization_id=organization_id)
    monkeypatch.setattr(admin, "_require_operations_view_user", lambda *_args: None)

    response = admin.list_intent_feedback(request, query=None, db=db, current_user=current_user)

    items = response["data"]["items"]
    assert response["data"]["total"] == 2
    fallback = next(item for item in items if item["intent_name"] == "의도 미분류")
    low_score = next(item for item in items if item["intent_name"] == "예약")
    assert fallback["channel_name"] == "Kakao"
    assert fallback["data_json"]["fallback_count"] == 1
    assert fallback["data_json"]["suggested_training_sentences"] == ["배송 조회해줘"]
    assert low_score["average_score"] == 42
    assert low_score["data_json"]["low_score_count"] == 1
    assert low_score["data_json"]["recommendation"] == "유사 의도와 Feature/Score 비교 필요"
    assert low_score["data_json"]["related_quality_diagnostics"][0]["feature"] == "예약변경"


def test_list_queue_history_formats_kakao_channel_name(monkeypatch) -> None:
    organization_id = uuid4()
    group_id = uuid4()
    bot_id = uuid4()
    version_id = uuid4()
    room_id = uuid4()
    event = SimpleNamespace(
        id=uuid4(),
        bot_id=bot_id,
        bot_version_id=version_id,
        room_id=room_id,
        intent_name="상담원 연결",
        sender_system="KAKAO",
        priority="normal",
        parameter_json={"utterance": "상담원 연결해줘"},
        channel_type="kakao",
        receiver="aidot-api",
        receive_status="completed",
        created_at=datetime(2026, 6, 23, 1, 0, tzinfo=timezone.utc),
        status_changed_at=datetime(2026, 6, 23, 1, 0, 1, tzinfo=timezone.utc),
        status="completed",
        error_message=None,
        result_json={},
        participant_id="kakao-user-1",
        request_message_id=None,
    )
    bot = SimpleNamespace(id=bot_id, group_id=group_id, name="Aidot 봇")
    version = SimpleNamespace(id=version_id, version_no=1)
    room = SimpleNamespace(id=room_id, status="open")
    group = SimpleNamespace(id=group_id, name="기본그룹")
    db = _FakeDb([event], [bot], [version], [room], [group])
    request = SimpleNamespace(state=SimpleNamespace(request_id="req"))
    current_user = SimpleNamespace(id=uuid4(), organization_id=organization_id)
    monkeypatch.setattr(admin, "_require_operations_view_user", lambda *_args: None)

    response = admin.list_queue_history(request, query=None, db=db, current_user=current_user)

    assert response["data"]["items"][0]["channel_name"] == "Kakao"
    assert response["data"]["total"] == 1
    assert response["data"]["page"] == 1
    assert response["data"]["page_size"] == 20
    assert response["data"]["filter_options"]["channels"] == ["Kakao"]


def test_simulator_transcript_display_text_prefers_rich_form_title_and_actions() -> None:
    display_text = admin._simulator_transcript_display_text(
        {
            "template": {
                "kind": "rich-form",
                "title": "FORM TITLE",
                "lines": ["설명 첫 줄", "설명 둘째 줄"],
                "actions": ["안녕", "넌 누구야", "종료"],
            }
        }
    )

    assert display_text == "FORM TITLE / 설명 첫 줄 / 안녕, 넌 누구야, 종료"


def test_list_conversation_history_includes_full_simulator_transcript_and_all_user_utterances(monkeypatch) -> None:
    organization_id = uuid4()
    session_id = "sim-session-1"
    started_at = "2026-06-21T12:52:20+00:00"
    user_first_at = "2026-06-21T12:52:26+00:00"
    bot_first_at = "2026-06-21T12:52:27+00:00"
    user_second_at = "2026-06-21T12:52:30+00:00"
    bot_second_at = "2026-06-21T12:52:31+00:00"

    def _entry(
        *,
        server_time: str,
        event: str,
        detail: dict[str, object] | None = None,
    ) -> dict[str, object]:
        return {
            "serverTime": server_time,
            "payload": {
                "event": event,
                "simulatorSessionId": session_id,
                "botId": "test-bot",
                "botName": "Aidot 봇",
                "versionId": 1,
                "detail": detail or {},
            },
        }

    monkeypatch.setattr(admin, "_require_operations_view_user", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(admin, "_bot_group_context_map", lambda *_args, **_kwargs: {})
    monkeypatch.setattr(admin, "success_response", lambda _request, data, meta=None: {"data": data, "meta": meta or {}})
    monkeypatch.setattr(
        admin,
        "_read_web_jsonl_logs",
        lambda *_args, **_kwargs: [
            _entry(
                server_time=started_at,
                event="simulator.transcript_message",
                detail={
                    "participantKind": "bot",
                    "participantName": "Aidot 봇",
                    "createdAt": started_at,
                    "message": {"cardTitle": "테스트종료 / FORM TITLE"},
                    "startDialogId": "Talk 1",
                },
            ),
            _entry(
                server_time=user_first_at,
                event="simulator.user_message",
                detail={"utterance": "안녕"},
            ),
            _entry(
                server_time=user_first_at,
                event="simulator.transcript_message",
                detail={
                    "participantKind": "user",
                    "participantName": "사용자",
                    "createdAt": user_first_at,
                    "message": {"text": "안녕"},
                },
            ),
            _entry(
                server_time=bot_first_at,
                event="simulator.transcript_message",
                detail={
                    "participantKind": "bot",
                    "participantName": "Aidot 봇",
                    "createdAt": bot_first_at,
                    "message": {"text": "반갑습니다"},
                    "resultType": "진행중",
                },
            ),
            _entry(
                server_time=user_second_at,
                event="simulator.user_message",
                detail={"utterance": "넌 누구야"},
            ),
            _entry(
                server_time=user_second_at,
                event="simulator.transcript_message",
                detail={
                    "participantKind": "user",
                    "participantName": "사용자",
                    "createdAt": user_second_at,
                    "message": {"text": "넌 누구야"},
                },
            ),
            _entry(
                server_time=bot_second_at,
                event="simulator.transcript_message",
                detail={
                    "participantKind": "bot",
                    "participantName": "Aidot 봇",
                    "createdAt": bot_second_at,
                    "message": {"text": "발신자 확인"},
                },
            ),
        ],
    )

    response = admin.list_conversation_history(
        request=SimpleNamespace(),
        query=None,
        db=_FakeDb([]),
        current_user=SimpleNamespace(organization_id=organization_id),
    )

    assert response["data"]["total"] == 1
    assert response["data"]["page"] == 1
    assert response["data"]["page_size"] == 20
    item = response["data"]["items"][0]
    assert item["channel_name"] == "시뮬레이터"
    assert item["intent_or_module_name"] == "Talk 1"
    assert item["data_json"]["session_user_utterances"] == ["안녕", "넌 누구야"]
    assert item["data_json"]["session_first_user_utterance"] == "안녕"
    assert [message["display_text"] for message in item["data_json"]["messages"]] == [
        "테스트종료 / FORM TITLE",
        "안녕",
        "반갑습니다",
        "넌 누구야",
        "발신자 확인",
    ]


def test_list_conversation_history_uses_simulator_card_name_when_intent_name_is_missing(monkeypatch) -> None:
    organization_id = uuid4()
    session_id = "sim-session-card-name"

    def _entry(
        *,
        server_time: str,
        event: str,
        detail: dict[str, object] | None = None,
    ) -> dict[str, object]:
        return {
            "serverTime": server_time,
            "payload": {
                "event": event,
                "simulatorSessionId": session_id,
                "botId": "test-bot",
                "botName": "Aidot 봇",
                "versionId": 1,
                "detail": detail or {},
            },
        }

    monkeypatch.setattr(admin, "_require_operations_view_user", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(admin, "_bot_group_context_map", lambda *_args, **_kwargs: {})
    monkeypatch.setattr(admin, "success_response", lambda _request, data, meta=None: {"data": data, "meta": meta or {}})
    monkeypatch.setattr(
        admin,
        "_read_web_jsonl_logs",
        lambda *_args, **_kwargs: [
            _entry(
                server_time="2026-06-30T12:11:15+00:00",
                event="simulator.user_message",
                detail={"utterance": "한 다섯시 이후로 다시 통화 주실래요"},
            ),
            _entry(
                server_time="2026-06-30T12:11:16+00:00",
                event="simulator.analysis_log",
                detail={
                    "log": {
                        "cardType": "Talk",
                        "cardName": "콜백 예약",
                    }
                },
            ),
        ],
    )

    response = admin.list_conversation_history(
        request=SimpleNamespace(),
        query=None,
        db=_FakeDb([]),
        current_user=SimpleNamespace(organization_id=organization_id),
    )

    assert response["data"]["total"] == 1
    item = response["data"]["items"][0]
    assert item["intent_or_module_name"] == "콜백 예약"


def test_list_login_history_accepts_date_filters_and_keeps_same_day_sessions(monkeypatch) -> None:
    organization_id = uuid4()
    user_id = uuid4()
    group_id = uuid4()
    login_at = datetime(2026, 6, 29, 0, 10, tzinfo=timezone.utc)
    logout_at = datetime(2026, 6, 29, 23, 50, tzinfo=timezone.utc)

    class _ExecuteResult:
        def __init__(self, rows: list[SimpleNamespace]) -> None:
            self._rows = rows

        def scalars(self) -> _FakeScalarResult:
            return _FakeScalarResult(self._rows)

    class _ExecuteDb:
        def __init__(self, *row_sets: list[SimpleNamespace]) -> None:
            self._row_sets = list(row_sets)

        def execute(self, *_args: object, **_kwargs: object) -> _ExecuteResult:
            return _ExecuteResult(self._row_sets.pop(0) if self._row_sets else [])

    monkeypatch.setattr(admin, "_require_admin_user", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(admin, "_get_user_role_map", lambda *_args, **_kwargs: {user_id: SimpleNamespace(name="시스템관리자")})
    monkeypatch.setattr(admin, "_get_group_name_map", lambda *_args, **_kwargs: {group_id: SimpleNamespace(name="기본그룹")})
    monkeypatch.setattr(admin, "success_response", lambda _request, data, meta=None: {"data": data, "meta": meta or {}})

    db = _ExecuteDb(
        [
            SimpleNamespace(
                id=uuid4(),
                actor_user_id=user_id,
                action_type="auth.login",
                ip_address="127.0.0.1",
                created_at=login_at,
            ),
            SimpleNamespace(
                id=uuid4(),
                actor_user_id=user_id,
                action_type="auth.logout",
                ip_address="127.0.0.1",
                created_at=logout_at,
            ),
        ],
        [
            SimpleNamespace(
                id=user_id,
                login_id="cyhuh",
                name="허철영",
                group_id=group_id,
            )
        ],
    )

    response = admin.list_login_history(
        request=SimpleNamespace(),
        query=None,
        from_date=date(2026, 6, 29),
        to_date=date(2026, 6, 29),
        db=db,
        current_user=SimpleNamespace(organization_id=organization_id),
    )

    assert response["data"]["total"] == 1
    item = response["data"]["items"][0]
    assert item["login_id"] == "cyhuh"
    assert item["group_name"] == "기본그룹"
    assert item["login_at"] == login_at
    assert item["logout_at"] == logout_at


def test_cached_version_integrity_status_keeps_full_status_payload(monkeypatch) -> None:
    organization_id = uuid4()
    expected = {
        "dialog_split": {"total_versions": 2, "issues": [{"version_id": "version-1"}]},
        "read_snapshot": {"total_versions": 2, "missing_versions": 1},
    }
    captured: dict[str, object] = {}

    monkeypatch.setattr(admin, "_version_integrity_cache_key", lambda *_args, **_kwargs: "integrity-key")
    monkeypatch.setattr(
        admin,
        "cache_aside_json",
        lambda key, producer, ttl_seconds: captured.update({"key": key, "ttl": ttl_seconds}) or producer(),
    )
    monkeypatch.setattr(admin, "_version_dialog_split_status", lambda *_args, **_kwargs: expected["dialog_split"])
    monkeypatch.setattr(admin, "_version_read_snapshot_status", lambda *_args, **_kwargs: expected["read_snapshot"])

    result = admin._cached_version_integrity_status(SimpleNamespace(), organization_id)

    assert result == expected
    assert captured == {"key": "integrity-key", "ttl": admin.settings.cache_default_ttl_seconds}


def test_purge_version_integrity_cache_uses_organization_scoped_pattern(monkeypatch) -> None:
    organization_id = uuid4()
    captured: dict[str, object] = {}
    monkeypatch.setattr(
        admin,
        "purge_cache_pattern",
        lambda pattern: captured.update({"pattern": pattern}) or {"purged": 3},
    )

    assert admin._purge_version_integrity_cache(organization_id) == 3
    assert captured["pattern"] == f"admin:version-integrity:v1:{organization_id}:*"


def test_read_web_jsonl_logs_filters_entries_while_streaming(tmp_path, monkeypatch) -> None:
    log_dir = tmp_path / "apps" / "web" / "logs" / "simulator"
    log_dir.mkdir(parents=True)
    log_file = log_dir / "simulator-20260714.log"
    log_file.write_text(
        "\n".join(
            [
                json.dumps({"serverTime": "2026-06-01T00:00:00+00:00", "payload": {"event": "old"}}),
                json.dumps({"serverTime": "2026-07-14T00:00:00+00:00", "payload": {"event": "current"}}),
            ]
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(admin, "ROOT_DIR", tmp_path)

    entries = admin._read_web_jsonl_logs(
        "simulator",
        "simulator",
        start_at=datetime(2026, 7, 1, tzinfo=timezone.utc),
        end_at=datetime(2026, 7, 31, 23, 59, 59, tzinfo=timezone.utc),
    )

    assert [entry["payload"]["event"] for entry in entries] == ["current"]


def test_read_web_jsonl_logs_keeps_latest_entries_with_limits(tmp_path, monkeypatch) -> None:
    log_dir = tmp_path / "apps" / "web" / "logs" / "simulator"
    log_dir.mkdir(parents=True)
    log_file = log_dir / "simulator-20260714.log"
    log_file.write_text(
        "\n".join(
            json.dumps({"serverTime": f"2026-07-14T00:00:0{index}+00:00", "index": index})
            for index in range(4)
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(admin, "ROOT_DIR", tmp_path)

    entries = admin._read_web_jsonl_logs(
        "simulator",
        "simulator",
        max_entries=2,
        max_bytes_per_file=1024,
    )

    assert [entry["index"] for entry in entries] == [2, 3]


def test_recent_system_log_items_reads_bounded_recent_window(tmp_path, monkeypatch) -> None:
    log_dir = tmp_path / "logs" / "api"
    log_dir.mkdir(parents=True)
    log_file = log_dir / admin.SYSTEM_LOG_FILES["app"]
    rows = [
        json.dumps({"time": "2026-07-13T00:00:00+00:00", "event": "api.request"}),
        json.dumps({"time": "2026-07-14T00:00:00+00:00", "event": "api.request"}),
        json.dumps({"time": "2026-07-14T01:00:00+00:00", "event": "api.slow_request"}),
    ]
    log_file.write_text("\n".join(rows), encoding="utf-8")
    monkeypatch.setattr(admin, "ROOT_DIR", tmp_path)
    monkeypatch.setattr(admin.settings, "admin_log_scan_max_bytes", 1024)
    monkeypatch.setattr(admin.settings, "admin_log_scan_max_lines", 2)

    items, metadata = admin._recent_system_log_items(
        datetime(2026, 7, 13, 12, 0, tzinfo=timezone.utc),
    )

    assert [item["event"] for item in items] == ["api.slow_request", "api.request"]
    assert metadata["scanned_lines"] == 2
    assert metadata["truncated"] is True


def test_list_conversation_history_applies_date_range_before_session_assembly(monkeypatch) -> None:
    organization_id = uuid4()
    captured_range: dict[str, datetime | None] = {}

    def _entry(session_id: str, server_time: str, utterance: str) -> dict[str, object]:
        return {
            "serverTime": server_time,
            "payload": {
                "event": "simulator.user_message",
                "simulatorSessionId": session_id,
                "botId": "test-bot",
                "botName": "Aidot",
                "versionId": 1,
                "detail": {"utterance": utterance},
            },
        }

    def _read_logs(*_args, **kwargs):
        captured_range["start_at"] = kwargs.get("start_at")
        captured_range["end_at"] = kwargs.get("end_at")
        return [
            _entry("old-session", "2026-06-01T00:00:00+00:00", "old"),
            _entry("current-session", "2026-07-14T00:00:00+00:00", "current"),
        ]

    monkeypatch.setattr(admin, "_require_operations_view_user", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(admin, "_bot_group_context_map", lambda *_args, **_kwargs: {})
    monkeypatch.setattr(admin, "success_response", lambda _request, data, meta=None: {"data": data, "meta": meta or {}})
    monkeypatch.setattr(admin, "_read_web_jsonl_logs", _read_logs)

    response = admin.list_conversation_history(
        request=SimpleNamespace(),
        query=None,
        start_date="2026-07-01T00:00:00+00:00",
        end_date="2026-07-31T23:59:59+00:00",
        db=_FakeDb([]),
        current_user=SimpleNamespace(organization_id=organization_id),
    )

    assert captured_range == {
        "start_at": datetime(2026, 7, 1, tzinfo=timezone.utc),
        "end_at": datetime(2026, 7, 31, 23, 59, 59, tzinfo=timezone.utc),
    }
    assert response["data"]["total"] == 1
    assert response["data"]["items"][0]["user_key"] == "current-session"


def test_operations_dashboard_local_cache_expires(monkeypatch) -> None:
    clock = {"value": 100.0}
    monkeypatch.setattr(admin, "monotonic", lambda: clock["value"])
    monkeypatch.setattr(admin.settings, "operations_dashboard_cache_ttl_seconds", 15)
    admin._purge_operations_dashboard_cache()

    payload = {"summary": {"total_bots": 3}}
    admin._set_operations_dashboard_cache("dashboard-key", payload)

    assert admin._get_operations_dashboard_cache("dashboard-key") == payload
    clock["value"] = 116.0
    assert admin._get_operations_dashboard_cache("dashboard-key") is None


def test_operations_dashboard_version_integrity_is_separate(monkeypatch) -> None:
    organization_id = uuid4()
    monkeypatch.setattr(admin, "_require_operations_view_user", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(admin, "_get_default_organization", lambda *_args, **_kwargs: SimpleNamespace(id=organization_id))
    monkeypatch.setattr(
        admin,
        "_cached_version_integrity_status",
        lambda *_args, **_kwargs: {
            "dialog_split": {
                "total_versions": 2,
                "split_versions": 1,
                "missing_versions": 1,
                "mismatch_versions": 0,
                "expected_dialog_rows": 4,
                "actual_dialog_rows": 2,
                "expected_graph_rows": 2,
                "actual_graph_rows": 1,
                "issues": [{"version_id": "version-1"}],
            },
            "read_snapshot": {
                "total_versions": 2,
                "complete_versions": 1,
                "missing_versions": 1,
                "missing_asset_counts": 1,
                "missing_scenario_validation": 0,
                "missing_nlu_training": 0,
                "missing_entities": 0,
                "missing_dictionary": 0,
                "missing_apis": 0,
                "missing_system_config": 0,
            },
        },
    )
    monkeypatch.setattr(admin, "success_response", lambda _request, data: data)

    response = admin.get_operations_dashboard_version_integrity(
        request=SimpleNamespace(),
        group_id=None,
        bot_id=None,
        db=SimpleNamespace(),
        current_user=SimpleNamespace(),
    )

    assert response["summary"]["version_storage_missing_versions"] == 1
    assert response["summary"]["version_read_snapshot_missing_versions"] == 1
    assert response["version_storage_issues"] == [{"version_id": "version-1"}]
    assert {item["code"] for item in response["alerts"]} == {
        "version_storage_missing",
        "version_read_snapshot_missing",
    }
