from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

from app.services import license_policy


class _FakeDb:
    def __init__(self, result: object | None) -> None:
        self.result = result
        self.statement = None

    def scalar(self, statement: object) -> object | None:
        self.statement = statement
        return self.result


class _FakeExecuteResult:
    def __init__(self, rows: list[tuple[object, object]]) -> None:
        self.rows = rows

    def all(self) -> list[tuple[object, object]]:
        return self.rows


class _FakeExecuteDb:
    def __init__(self, results: list[list[tuple[object, object]]]) -> None:
        self.results = list(results)
        self.statements: list[object] = []

    def execute(self, statement: object) -> _FakeExecuteResult:
        self.statements.append(statement)
        return _FakeExecuteResult(self.results.pop(0))


def test_get_current_license_matches_admin_license_model_columns() -> None:
    record = SimpleNamespace(id=uuid4())
    db = _FakeDb(record)

    assert license_policy.get_current_license(db, uuid4()) is record
    assert db.statement is not None

def test_get_license_warnings_reuses_supplied_record_and_usage(monkeypatch) -> None:
    record = SimpleNamespace(payload_json={"limits": {"users": 1}})
    db = _FakeDb(None)
    current_license_calls = 0
    usage_calls = 0

    def _current_license(*_args, **_kwargs):
        nonlocal current_license_calls
        current_license_calls += 1
        return None

    def _usage_counts(*_args, **_kwargs):
        nonlocal usage_calls
        usage_calls += 1
        return {"users": 0, "bots": 0, "apis": 0}

    monkeypatch.setattr(license_policy, "get_current_license", _current_license)
    monkeypatch.setattr(license_policy, "get_license_usage_counts", _usage_counts)

    assert license_policy.get_license_warnings(
        db,
        uuid4(),
        license_record=record,
        usage_counts={"users": 1, "bots": 0, "apis": 0},
    ) == ["사용자 사용량이 라이선스 한도에 도달했습니다. 신규 생성이 제한됩니다. (1/1)"]
    assert current_license_calls == 0
    assert usage_calls == 0


def test_count_registered_apis_uses_normalized_api_snapshots() -> None:
    db = _FakeExecuteDb(
        [[
            (uuid4(), [{"id": "api-1"}, {"id": "api-2"}]),
            (uuid4(), [{"id": "api-2"}]),
        ]]
    )

    assert license_policy.count_registered_apis(db, uuid4()) == 2
    assert len(db.statements) == 1
    assert "bot_versions.apis_json" in str(db.statements[0])
    assert "bot_versions.version_json" not in str(db.statements[0])


def test_count_registered_apis_reads_legacy_document_only_for_missing_snapshot() -> None:
    normalized_version_id = uuid4()
    legacy_version_id = uuid4()
    db = _FakeExecuteDb(
        [
            [
                (normalized_version_id, [{"id": "api-1"}]),
                (legacy_version_id, None),
            ],
            [(legacy_version_id, {"apis": [{"id": "api-2"}]})],
        ]
    )

    assert license_policy.count_registered_apis(db, uuid4()) == 2
    assert len(db.statements) == 2
    assert "bot_versions.version_json" in str(db.statements[1])
