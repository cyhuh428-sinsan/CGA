import json
from types import SimpleNamespace

from sqlalchemy.exc import SQLAlchemyError

from app.core.db_metrics import finish_db_metrics, record_db_query, start_db_metrics
from app.core.config import settings
from app.db import session as db_session
from app.main import _queue_worker_sleep_seconds, _request_log_data, _should_log_slow_api_request, readiness_check
from app.api.routes.bots import _matches_version_scope


def test_request_log_data_keeps_operational_context_without_auth_header() -> None:
    request = SimpleNamespace(
        query_params={"botId": "bot-1", "channel": "WEBCHAT"},
        headers={
            "content-type": "application/json",
            "content-length": "123",
            "origin": "https://example.test",
            "referer": "https://example.test/chat",
            "user-agent": "AidotTest/1.0",
            "authorization": "Bearer secret-token",
        },
    )

    data = _request_log_data(request)

    assert data == {
        "query_params": {"botId": "bot-1", "channel": "WEBCHAT"},
        "content_type": "application/json",
        "content_length": "123",
        "origin": "https://example.test",
        "referer": "https://example.test/chat",
        "user_agent": "AidotTest/1.0",
    }


def test_request_log_data_includes_db_metrics_when_provided() -> None:
    request = SimpleNamespace(
        query_params={},
        headers={},
    )

    data = _request_log_data(request, {"db_query_count": 2, "db_duration_ms": 12.5, "db_max_query_ms": 9.0})

    assert data["db_query_count"] == 2
    assert data["db_duration_ms"] == 12.5
    assert data["db_max_query_ms"] == 9.0


def test_db_metrics_records_queries_inside_context() -> None:
    token = start_db_metrics()
    record_db_query(10.25)
    record_db_query(5.5)

    metrics = finish_db_metrics(token)

    assert metrics == {"db_query_count": 2, "db_duration_ms": 15.75, "db_max_query_ms": 10.25}


def test_db_connect_args_uses_configured_timeout(monkeypatch) -> None:
    monkeypatch.setattr(settings, "db_connect_timeout_seconds", 2)

    assert db_session._db_connect_args() == {"connect_timeout": 2}


def test_readiness_check_returns_unavailable_when_database_fails(monkeypatch) -> None:
    class FailingSession:
        def __enter__(self) -> "FailingSession":
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def execute(self, _statement: object) -> None:
            raise SQLAlchemyError("down")

    monkeypatch.setattr("app.main.SessionLocal", lambda: FailingSession())

    response = readiness_check()

    assert response.status_code == 503
    assert json.loads(response.body)["database"] == "unavailable"


def test_readiness_check_returns_ok_when_database_responds(monkeypatch) -> None:
    class ReadySession:
        def __enter__(self) -> "ReadySession":
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def execute(self, _statement: object) -> None:
            return None

    monkeypatch.setattr("app.main.SessionLocal", lambda: ReadySession())

    response = readiness_check()

    assert response.status_code == 200
    assert json.loads(response.body)["database"] == "ok"


def test_queue_worker_sleep_seconds_backs_off_after_failures(monkeypatch) -> None:
    monkeypatch.setattr(settings, "channel_queue_worker_error_backoff_seconds", 30.0)

    assert _queue_worker_sleep_seconds(2.0, 0) == 2.0
    assert _queue_worker_sleep_seconds(2.0, 1) == 2.0
    assert _queue_worker_sleep_seconds(2.0, 2) == 4.0
    assert _queue_worker_sleep_seconds(2.0, 5) == 30.0


def test_should_log_slow_api_request_only_for_api_paths(monkeypatch) -> None:
    monkeypatch.setattr(settings, "api_slow_request_threshold_ms", 1000.0)
    api_request = SimpleNamespace(url=SimpleNamespace(path="/api/v1/bots"))
    health_request = SimpleNamespace(url=SimpleNamespace(path="/health"))

    assert _should_log_slow_api_request(api_request, 1000.0) is True
    assert _should_log_slow_api_request(api_request, 999.9) is False
    assert _should_log_slow_api_request(health_request, 5000.0) is False


def test_should_skip_slow_api_request_when_threshold_disabled(monkeypatch) -> None:
    monkeypatch.setattr(settings, "api_slow_request_threshold_ms", 0.0)
    request = SimpleNamespace(url=SimpleNamespace(path="/api/v1/bots"))

    assert _should_log_slow_api_request(request, 5000.0) is False


def test_matches_version_scope_supports_id_name_and_version_number() -> None:
    version = SimpleNamespace(
        id="A326E6F2-3D64-45D6-8A9C-7D6D93F2DA19",
        name="Draft",
        version_no=3,
    )

    assert _matches_version_scope(version, "a326e6f2-3d64-45d6-8a9c-7d6d93f2da19") is True
    assert _matches_version_scope(version, "draft") is True
    assert _matches_version_scope(version, "v3") is True
    assert _matches_version_scope(version, "3") is True
    assert _matches_version_scope(version, "v2") is False
