from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import app.api.routes.bots as bots
from app.api.routes.bots import (
    _assign_version_document,
    _purge_version_cache,
    _serialize_version_configure,
    _serialize_version_dialog_flow,
    _serialize_version_dialogs,
    _serialize_version_reference_items,
    _serialize_version_retraining,
    _serialize_version_settings_summary,
    _serialize_version_summary,
    _version_asset_counts,
    _version_document_with_configure,
    _version_document_with_dialog_flow,
    _version_document_with_dialogs,
    _version_document_with_items,
    _version_document_with_retraining,
)
from app.core.version_storage import sync_version_dialog_split_tables
from app.models import VersionDialogAsset, VersionDialogFlowGraph


class _FakeScalarResult:
    def __init__(self, rows: list[SimpleNamespace]) -> None:
        self._rows = rows

    def all(self) -> list[SimpleNamespace]:
        return self._rows


class _FakeSplitSession:
    def __init__(
        self,
        dialog_rows: list[SimpleNamespace] | None = None,
        graph_rows: list[SimpleNamespace] | None = None,
    ) -> None:
        self._results = [dialog_rows or [], graph_rows or []]
        self.rollback_count = 0

    def scalars(self, _statement: object) -> _FakeScalarResult:
        return _FakeScalarResult(self._results.pop(0))

    def scalar(self, _statement: object) -> object:
        return None

    def rollback(self) -> None:
        self.rollback_count += 1


class _NoAuditSession:
    def scalar(self, _statement: object) -> object:
        raise AssertionError("embedded training state should not query audit logs")


class _FakeSyncSession:
    def __init__(
        self,
        dialog_rows: list[SimpleNamespace | VersionDialogAsset] | None = None,
        graph_rows: list[SimpleNamespace | VersionDialogFlowGraph] | None = None,
    ) -> None:
        self._results = [dialog_rows or [], graph_rows or []]
        self.added: list[object] = []

    def scalars(self, _statement: object) -> _FakeScalarResult:
        return _FakeScalarResult(self._results.pop(0))

    def add(self, row: object) -> None:
        self.added.append(row)


class _FakeWriteSession:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.events: list[str] = []

    def scalars(self, _statement: object) -> _FakeScalarResult:
        return _FakeScalarResult([])

    def add(self, row: object) -> None:
        self.added.append(row)
        self.events.append("add")

    def flush(self) -> None:
        self.events.append("flush")

    def commit(self) -> None:
        self.events.append("commit")

    def refresh(self, _row: object) -> None:
        self.events.append("refresh")


def _fake_bot_version_pair() -> tuple[SimpleNamespace, SimpleNamespace]:
    bot_id = uuid4()
    version_id = uuid4()
    now = datetime(2026, 5, 18, tzinfo=timezone.utc)
    bot = SimpleNamespace(id=bot_id, active_version_id=version_id)
    version = SimpleNamespace(
        id=version_id,
        bot_id=bot_id,
        version_no=1,
        name="v1",
        description=None,
        status="draft",
        comment=None,
        copied_from_version_id=None,
        activated_at=None,
        updated_at=now,
        created_at=now,
        version_json={
            "dialogs": [{"id": "intent-1", "dialogType": 1, "name": "기존"}],
            "dialog_flow_graphs": [{"dialogId": "intent-1", "nodes": []}],
            "system_config": {"nlu_training": {"status": "success"}},
        },
    )
    return bot, version


def _stub_version_write_dependencies(
    monkeypatch,
    bot: SimpleNamespace,
    version: SimpleNamespace,
    db: _FakeWriteSession,
) -> None:
    monkeypatch.setattr(bots, "_get_bot_or_404", lambda *_args, **_kwargs: bot)
    monkeypatch.setattr(bots, "_get_version_or_404", lambda *_args, **_kwargs: version)
    monkeypatch.setattr(bots, "_assert_dialog_updates_not_locked_by_other", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(bots, "_assert_dialog_not_locked_by_other", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(bots, "_write_audit_log", lambda *_args, **_kwargs: db.events.append("audit"))
    monkeypatch.setattr(bots, "scenario_validation_from_version", lambda *_args, **_kwargs: {"items": []})
    monkeypatch.setattr(bots, "save_blocking_scenario_items", lambda *_args, **_kwargs: False)
    monkeypatch.setattr(bots, "success_response", lambda _request, payload: {"data": payload})
    monkeypatch.setattr(
        bots,
        "_purge_version_cache",
        lambda purged_version: db.events.append(f"purge:{purged_version.id}") or {"status": "purged"},
    )


def test_version_document_with_dialogs_replaces_only_dialogs() -> None:
    version = SimpleNamespace(
        version_json={
            "dialogs": [{"id": "old-dialog", "dialogType": 1, "name": "이전"}],
            "dictionary": [{"id": "term-1", "word": "해지"}],
            "system_config": {"nlu_training": {"status": "success"}},
        },
    )

    next_document = _version_document_with_dialogs(
        version,
        [{"id": "new-dialog", "dialogType": 1, "name": "신규"}],
    )

    assert next_document["dialogs"] == [{"id": "new-dialog", "dialogType": 1, "name": "신규"}]
    assert next_document["dictionary"] == [{"id": "term-1", "word": "해지"}]
    assert next_document["system_config"]["nlu_training"] == {"status": "success"}
    assert "scenario_validation" in next_document["system_config"]


def test_version_document_with_items_replaces_requested_section_only() -> None:
    version = SimpleNamespace(
        version_json={
            "dialogs": [{"id": "dialog-1"}],
            "entities": [{"id": "entity-old"}],
            "dictionary": [{"id": "term-1"}],
        },
    )

    next_document = _version_document_with_items(version, "entities", [{"id": "entity-new"}])

    assert next_document["dialogs"] == [{"id": "dialog-1"}]
    assert next_document["entities"] == [{"id": "entity-new"}]
    assert next_document["dictionary"] == [{"id": "term-1"}]


def test_version_document_with_items_dedupes_apis_only() -> None:
    version = SimpleNamespace(
        version_json={
            "dialogs": [{"id": "dialog-1"}],
            "apis": [{"id": "api-keep", "name": "기존"}],
            "dictionary": [{"id": "term-1"}],
        },
    )

    next_document = _version_document_with_items(
        version,
        "apis",
        [
            {"id": "api-1", "name": "JSONPlaceholder 게시글"},
            {"id": "api-1", "name": "JSONPlaceholder 게시글"},
            {"id": "api-2", "name": "httpbin 요청 확인"},
        ],
    )

    assert next_document["dialogs"] == [{"id": "dialog-1"}]
    assert next_document["apis"] == [
        {"id": "api-1", "name": "JSONPlaceholder 게시글"},
        {"id": "api-2", "name": "httpbin 요청 확인"},
    ]
    assert next_document["dictionary"] == [{"id": "term-1"}]


def test_serialize_version_summary_uses_embedded_training_without_audit_query() -> None:
    bot_id = uuid4()
    version_id = uuid4()
    bot = SimpleNamespace(id=bot_id, active_version_id=version_id)
    version = SimpleNamespace(
        id=version_id,
        bot_id=bot_id,
        version_no=1,
        name="v1",
        description=None,
        status="active",
        comment=None,
        copied_from_version_id=None,
        activated_at=None,
        updated_at=datetime(2026, 5, 18, tzinfo=timezone.utc),
        created_at=datetime(2026, 5, 18, tzinfo=timezone.utc),
        version_json={"system_config": {"nlu_training": {"status": "success", "trained_at": "2026-05-18T00:00:00+09:00"}}},
    )

    payload = _serialize_version_summary(bot, version, _NoAuditSession())

    assert payload["is_trained"] is True
    assert payload["nlu_training"]["status"] == "success"


def test_serialize_version_summary_uses_read_snapshot_without_document_load() -> None:
    bot_id = uuid4()
    version_id = uuid4()
    bot = SimpleNamespace(id=bot_id, active_version_id=version_id)

    class SnapshotVersion:
        def __init__(self) -> None:
            self.id = version_id
            self.bot_id = bot_id
            self.version_no = 1
            self.name = "v1"
            self.description = None
            self.status = "active"
            self.comment = None
            self.copied_from_version_id = None
            self.activated_at = None
            self.updated_at = datetime(2026, 5, 18, tzinfo=timezone.utc)
            self.created_at = datetime(2026, 5, 18, tzinfo=timezone.utc)
            self.asset_counts_json = {"dialogs": 17, "intents": 13, "modules": 4}
            self.scenario_validation_json = {"error_count": 0, "items": []}
            self.nlu_training_json = {}

        @property
        def version_json(self) -> dict[str, object]:
            raise AssertionError("summary snapshot should not load version_json")

    payload = _serialize_version_summary(bot, SnapshotVersion())  # type: ignore[arg-type]

    assert payload["asset_counts"]["dialogs"] == 17
    assert payload["asset_counts"]["intents"] == 13
    assert payload["scenario_validation"]["error_count"] == 0


def test_serialize_version_summary_compacts_heavy_system_config_history() -> None:
    bot_id = uuid4()
    version_id = uuid4()
    bot = SimpleNamespace(id=bot_id, active_version_id=version_id)
    version = SimpleNamespace(
        id=version_id,
        bot_id=bot_id,
        version_no=1,
        name="v1",
        description=None,
        status="active",
        comment=None,
        copied_from_version_id=None,
        activated_at=None,
        updated_at=datetime(2026, 7, 15, tzinfo=timezone.utc),
        created_at=datetime(2026, 7, 15, tzinfo=timezone.utc),
        system_config_json={
            "ai_config": {"nlu_cutoff_score": 0.75},
            "nlu_evaluation": {
                "latest": {
                    "fixed_accuracy": 0.91,
                    "random_accuracy": 0.84,
                    "misclassified": [{"utterance": "느린 상세 데이터"}],
                },
                "history": [{"accuracy": 0.8}],
            },
            "last_bot_evaluation": {
                "accuracy": 0.88,
                "rows": [{"utterance": "상세 평가 데이터"}],
            },
            "retraining_records": {"row-1": {"status": "미학습"}},
        },
        version_json={},
        nlu_training_json={},
        asset_counts_json={},
        scenario_validation_json={},
    )

    payload = _serialize_version_summary(bot, version)  # type: ignore[arg-type]

    system_config = payload["system_config"]
    assert system_config["ai_config"] == {"nlu_cutoff_score": 0.75}
    assert system_config["nlu_evaluation"] == {
        "latest": {"fixed_accuracy": 0.91, "random_accuracy": 0.84},
    }
    assert system_config["last_bot_evaluation"] == {"accuracy": 0.88}
    assert "retraining_records" not in system_config


def test_assign_version_document_refreshes_read_snapshot() -> None:
    _bot, version = _fake_bot_version_pair()
    next_document = {
        "dialogs": [
            {"id": "module-1", "dialogType": 0},
            {"id": "intent-1", "dialogType": 1},
        ],
        "entities": [{"id": "entity-1"}],
        "system_config": {"nlu_training": {"status": "success"}},
    }

    _assign_version_document(version, next_document)

    assert version.version_json["dialogs"] == next_document["dialogs"]
    assert version.asset_counts_json["dialogs"] == 2
    assert version.asset_counts_json["intents"] == 1
    assert version.asset_counts_json["modules"] == 1
    assert version.nlu_training_json == {"status": "success"}
    assert isinstance(version.scenario_validation_json, dict)
    assert version.entities_json == [{"id": "entity-1"}]
    assert version.system_config_json == {"nlu_training": {"status": "success"}}


def test_asset_counts_exclude_system_entities_and_dictionary_from_snapshots() -> None:
    version = SimpleNamespace(
        asset_counts_json={"entities": 4, "dictionary": 4},
        entities_json=[
            {"id": "entity-user", "name": "고객명"},
            {"id": "entity-system-bool", "name": "date", "system": True},
            {"id": "entity-system-kind", "name": "number", "kind": "system"},
            {"id": "entity-system-source", "name": "phone", "source": "system"},
        ],
        dictionary_json=[
            {"id": "term-user", "word": "해지"},
            {"id": "term-system-bool", "word": "시스템", "system": True},
            {"id": "term-system-kind", "word": "공통", "kind": "system"},
            {"id": "term-system-category", "word": "기본", "category": "system"},
        ],
        version_json={},
    )

    counts = _version_asset_counts(version)  # type: ignore[arg-type]

    assert counts["entities"] == 1
    assert counts["dictionary"] == 1


def test_serialize_version_settings_summary_keeps_list_payload_light(monkeypatch) -> None:
    bot, version = _fake_bot_version_pair()

    def _fail_training_lookup(_version: object) -> dict[str, object]:
        raise AssertionError("version list settings summary should not read training state")

    def _fail_ai_lookup(_bot: object, _version: object) -> dict[str, object]:
        raise AssertionError("version list settings summary should not read AI config")

    monkeypatch.setattr(bots, "_get_nlu_training_state", _fail_training_lookup)
    monkeypatch.setattr(bots, "_get_version_ai_config", _fail_ai_lookup)

    payload = _serialize_version_settings_summary(bot, version)

    assert "version_json" not in payload
    assert payload["is_trained"] is False
    assert payload["nlu_training"] == {}


def test_serialize_version_settings_summary_includes_selected_ai_config(monkeypatch) -> None:
    bot, version = _fake_bot_version_pair()
    monkeypatch.setattr(bots, "_get_nlu_training_state", lambda _version: {"status": "success"})
    monkeypatch.setattr(bots, "_get_version_ai_config", lambda _bot, _version: {"nlu_type": "semantic"})

    payload = _serialize_version_settings_summary(bot, version, _NoAuditSession(), include_ai_config=True)

    assert payload["is_trained"] is True
    assert payload["version_json"]["system_config"]["ai_config"] == {"nlu_type": "semantic"}
    assert payload["version_json"]["system_config"]["nlu_training"] == {"status": "success"}


def test_get_version_ai_config_uses_system_config_snapshot_without_document_load() -> None:
    bot = SimpleNamespace(data_json={"nlu_type": "ml"})

    class SnapshotVersion:
        system_config_json = {"ai_config": {"nlu_type": "semantic", "provider": "local"}}

        @property
        def version_json(self) -> dict[str, object]:
            raise AssertionError("AI config should use system_config_json snapshot")

    assert bots._get_version_ai_config(bot, SnapshotVersion()) == {"nlu_type": "semantic", "provider": "local"}  # type: ignore[arg-type]


def test_serialize_version_dialogs_returns_partial_payload_without_full_document() -> None:
    bot_id = uuid4()
    version_id = uuid4()
    bot = SimpleNamespace(id=bot_id, active_version_id=version_id)
    version = SimpleNamespace(
        id=version_id,
        bot_id=bot_id,
        version_no=1,
        name="v1",
        description=None,
        status="draft",
        comment=None,
        copied_from_version_id=None,
        activated_at=None,
        updated_at=datetime(2026, 5, 16, tzinfo=timezone.utc),
        created_at=datetime(2026, 5, 16, tzinfo=timezone.utc),
        version_json={
            "dialogs": [{"id": "intent-1", "dialogType": 1, "name": "해지"}],
            "entities": [{"id": "entity-1"}],
        },
    )

    payload = _serialize_version_dialogs(bot, version)

    assert payload["bot_id"] == str(bot_id)
    assert payload["version_id"] == str(version_id)
    assert payload["items"] == [{"id": "intent-1", "dialogType": 1, "name": "해지"}]
    assert payload["asset_counts"]["intents"] == 1
    assert "version_json" not in payload["version"]


def test_serialize_version_dialogs_prefers_split_table_rows_when_available() -> None:
    bot_id = uuid4()
    version_id = uuid4()
    bot = SimpleNamespace(id=bot_id, active_version_id=version_id)
    version = SimpleNamespace(
        id=version_id,
        bot_id=bot_id,
        version_no=1,
        name="v1",
        description=None,
        status="draft",
        comment=None,
        copied_from_version_id=None,
        activated_at=None,
        updated_at=datetime(2026, 5, 16, tzinfo=timezone.utc),
        created_at=datetime(2026, 5, 16, tzinfo=timezone.utc),
        version_json={
            "dialogs": [{"id": "stale-intent", "dialogType": 1, "name": "이전"}],
            "dialog_flow_graphs": [],
            "system_config": {"nlu_training": {"status": "success"}},
        },
    )
    db = _FakeSplitSession(
        dialog_rows=[
            SimpleNamespace(payload_json={"id": "module-1", "dialogType": 0, "name": "모듈"}),
            SimpleNamespace(payload_json={"id": "intent-1", "dialogType": 1, "name": "해지"}),
        ],
        graph_rows=[],
    )

    payload = _serialize_version_dialogs(bot, version, db)

    assert payload["items"] == [
        {"id": "module-1", "dialogType": 0, "name": "모듈"},
        {"id": "intent-1", "dialogType": 1, "name": "해지"},
    ]
    assert payload["asset_counts"]["dialogs"] == 2
    assert payload["asset_counts"]["intents"] == 1
    assert payload["asset_counts"]["modules"] == 1
    assert payload["version"]["asset_counts"]["dialogs"] == 2


def test_serialize_version_dialogs_uses_split_snapshot_without_document_load() -> None:
    bot_id = uuid4()
    version_id = uuid4()
    now = datetime(2026, 5, 18, tzinfo=timezone.utc)
    bot = SimpleNamespace(id=bot_id, active_version_id=version_id)

    class SnapshotVersion:
        def __init__(self) -> None:
            self.id = version_id
            self.bot_id = bot_id
            self.version_no = 1
            self.name = "v1"
            self.description = None
            self.status = "draft"
            self.comment = None
            self.copied_from_version_id = None
            self.activated_at = None
            self.updated_at = now
            self.created_at = now
            self.asset_counts_json = {"dialogs": 2, "intents": 1, "modules": 1}
            self.scenario_validation_json = {"error_count": 0}
            self.nlu_training_json = {}

        @property
        def version_json(self) -> dict[str, object]:
            raise AssertionError("dialog list should use split rows and read snapshot")

    db = _FakeSplitSession(
        dialog_rows=[
            SimpleNamespace(payload_json={"id": "module-1", "dialogType": 0, "name": "모듈"}),
            SimpleNamespace(payload_json={"id": "intent-1", "dialogType": 1, "name": "해지"}),
        ],
        graph_rows=[SimpleNamespace(payload_json={"dialogId": "intent-1", "nodes": []})],
    )

    payload = _serialize_version_dialogs(bot, SnapshotVersion(), db)  # type: ignore[arg-type]

    assert payload["items"] == [
        {"id": "module-1", "dialogType": 0, "name": "모듈"},
        {"id": "intent-1", "dialogType": 1, "name": "해지"},
    ]
    assert payload["version"]["asset_counts"]["dialogs"] == 2
    assert payload["scenario_validation"] == {"error_count": 0}


def test_serialize_version_reference_section_uses_snapshot_without_document_load() -> None:
    bot_id = uuid4()
    version_id = uuid4()
    now = datetime(2026, 5, 18, tzinfo=timezone.utc)
    bot = SimpleNamespace(id=bot_id, active_version_id=version_id)

    class SnapshotVersion:
        def __init__(self) -> None:
            self.id = version_id
            self.bot_id = bot_id
            self.version_no = 1
            self.name = "v1"
            self.description = None
            self.status = "draft"
            self.comment = None
            self.copied_from_version_id = None
            self.activated_at = None
            self.updated_at = now
            self.created_at = now
            self.asset_counts_json = {"entities": 1, "dictionary": 1, "apis": 1}
            self.scenario_validation_json = {"error_count": 0}
            self.nlu_training_json = {}
            self.entities_json = [{"id": "entity-1", "name": "이름"}]
            self.dictionary_json = [{"id": "term-1", "word": "해지"}]
            self.apis_json = [{"id": "api-1", "name": "조회"}]

        @property
        def version_json(self) -> dict[str, object]:
            raise AssertionError("reference section list should use section snapshots")

    version = SnapshotVersion()

    entities_payload = bots._serialize_version_document_items(bot, version, "entities")  # type: ignore[arg-type]
    dictionary_payload = bots._serialize_version_document_items(bot, version, "dictionary")  # type: ignore[arg-type]
    apis_payload = bots._serialize_version_document_items(bot, version, "apis")  # type: ignore[arg-type]

    assert entities_payload["items"] == [{"id": "entity-1", "name": "이름"}]
    assert dictionary_payload["items"] == [{"id": "term-1", "word": "해지"}]
    assert apis_payload["items"] == [{"id": "api-1", "name": "조회"}]
    assert entities_payload["asset_counts"]["entities"] == 1
    assert dictionary_payload["scenario_validation"] == {"error_count": 0}


def test_serialize_version_reference_section_dedupes_api_snapshots() -> None:
    bot_id = uuid4()
    version_id = uuid4()
    now = datetime(2026, 5, 18, tzinfo=timezone.utc)
    bot = SimpleNamespace(id=bot_id, active_version_id=version_id)

    class SnapshotVersion:
        def __init__(self) -> None:
            self.id = version_id
            self.bot_id = bot_id
            self.version_no = 1
            self.name = "v1"
            self.description = None
            self.status = "draft"
            self.comment = None
            self.copied_from_version_id = None
            self.activated_at = None
            self.updated_at = now
            self.created_at = now
            self.asset_counts_json = {"apis": 3}
            self.scenario_validation_json = {"error_count": 0}
            self.nlu_training_json = {}
            self.entities_json = []
            self.dictionary_json = []
            self.apis_json = [
                {"id": "api-1", "name": "조회"},
                {"id": "api-1", "name": "조회"},
                {"id": "api-2", "name": "등록"},
            ]

        @property
        def version_json(self) -> dict[str, object]:
            raise AssertionError("api section snapshot read should not load version_json")

    apis_payload = bots._serialize_version_document_items(bot, SnapshotVersion(), "apis")  # type: ignore[arg-type]

    assert apis_payload["items"] == [
        {"id": "api-1", "name": "조회"},
        {"id": "api-2", "name": "등록"},
    ]


def test_serialize_version_reference_items_returns_reference_sections_only() -> None:
    bot_id = uuid4()
    version_id = uuid4()
    bot = SimpleNamespace(id=bot_id, active_version_id=version_id)
    version = SimpleNamespace(
        id=version_id,
        bot_id=bot_id,
        version_no=1,
        name="v1",
        description=None,
        status="draft",
        comment=None,
        copied_from_version_id=None,
        activated_at=None,
        updated_at=datetime(2026, 5, 16, tzinfo=timezone.utc),
        created_at=datetime(2026, 5, 16, tzinfo=timezone.utc),
        version_json={
            "dialogs": [{"id": "intent-1"}],
            "dialog_flow_graphs": [{"dialogId": "intent-1"}],
            "rules": [{"id": "rule-1"}],
            "entities": [{"id": "entity-1"}],
        },
    )

    payload = _serialize_version_reference_items(bot, version)

    assert payload["dialogs"] == [{"id": "intent-1"}]
    assert payload["dialog_flow_graphs"] == [{"dialogId": "intent-1"}]
    assert payload["rules"] == [{"id": "rule-1"}]
    assert "entities" not in payload
    assert "version_json" not in payload["version"]


def test_serialize_version_dialog_flow_returns_detail_payload_without_full_document() -> None:
    bot_id = uuid4()
    version_id = uuid4()
    bot = SimpleNamespace(id=bot_id, active_version_id=version_id)
    version = SimpleNamespace(
        id=version_id,
        bot_id=bot_id,
        version_no=1,
        name="v1",
        description=None,
        status="draft",
        comment=None,
        copied_from_version_id=None,
        activated_at=None,
        updated_at=datetime(2026, 5, 16, tzinfo=timezone.utc),
        created_at=datetime(2026, 5, 16, tzinfo=timezone.utc),
        version_json={
            "dialogs": [{"id": "intent-1", "dialogType": 1, "name": "해지"}],
            "dialog_flow_graphs": [{"id": "flow-1", "dialogId": "intent-1", "nodes": [], "links": []}],
            "entities": [{"id": "entity-1"}],
            "apis": [{"id": "api-1"}],
            "system_config": {"common_variables": [{"name": "$고객명"}]},
            "dictionary": [{"id": "term-1"}],
        },
    )

    payload = _serialize_version_dialog_flow(bot, version, "intent-1")

    assert payload["dialog"] == {"id": "intent-1", "dialogType": 1, "name": "해지"}
    assert payload["dialog_flow_graphs"] == [{"id": "flow-1", "dialogId": "intent-1", "nodes": [], "links": []}]
    assert payload["entities"] == [{"id": "entity-1"}]
    assert payload["apis"] == [{"id": "api-1"}]
    assert payload["system_config"] == {"common_variables": [{"name": "$고객명"}]}
    assert "dictionary" not in payload
    assert "version_json" not in payload["version"]


def test_serialize_version_dialog_flow_prefers_split_table_rows_when_available() -> None:
    bot_id = uuid4()
    version_id = uuid4()
    bot = SimpleNamespace(id=bot_id, active_version_id=version_id)
    version = SimpleNamespace(
        id=version_id,
        bot_id=bot_id,
        version_no=1,
        name="v1",
        description=None,
        status="draft",
        comment=None,
        copied_from_version_id=None,
        activated_at=None,
        updated_at=datetime(2026, 5, 16, tzinfo=timezone.utc),
        created_at=datetime(2026, 5, 16, tzinfo=timezone.utc),
        version_json={
            "dialogs": [{"id": "stale-intent", "dialogType": 1, "name": "이전"}],
            "dialog_flow_graphs": [{"dialogId": "stale-intent", "nodes": []}],
            "entities": [{"id": "entity-1"}],
            "apis": [{"id": "api-1"}],
            "system_config": {"nlu_training": {"status": "success"}},
        },
    )
    db = _FakeSplitSession(
        dialog_rows=[SimpleNamespace(payload_json={"id": "intent-1", "dialogType": 1, "name": "해지"})],
        graph_rows=[SimpleNamespace(payload_json={"dialogId": "intent-1", "nodes": [{"id": "start"}]})],
    )

    payload = _serialize_version_dialog_flow(bot, version, "intent-1", db)

    assert payload["dialog"] == {"id": "intent-1", "dialogType": 1, "name": "해지"}
    assert payload["dialogs"] == [{"id": "intent-1", "dialogType": 1, "name": "해지"}]
    assert payload["dialog_flow_graphs"] == [{"dialogId": "intent-1", "nodes": [{"id": "start"}]}]
    assert payload["entities"] == [{"id": "entity-1"}]
    assert payload["apis"] == [{"id": "api-1"}]
    assert payload["version"]["asset_counts"]["dialogs"] == 1


def test_serialize_version_dialog_flow_uses_snapshots_without_full_document() -> None:
    bot_id = uuid4()
    version_id = uuid4()
    bot = SimpleNamespace(id=bot_id, active_version_id=version_id)

    class SnapshotVersion:
        def __init__(self) -> None:
            self.id = version_id
            self.bot_id = bot_id
            self.version_no = 1
            self.name = "v1"
            self.description = None
            self.status = "draft"
            self.comment = None
            self.copied_from_version_id = None
            self.activated_at = None
            self.updated_at = datetime(2026, 5, 16, tzinfo=timezone.utc)
            self.created_at = datetime(2026, 5, 16, tzinfo=timezone.utc)
            self.asset_counts_json = {"dialogs": 1, "entities": 1, "apis": 1}
            self.scenario_validation_json = {"error_count": 0, "items": []}
            self.nlu_training_json = {}
            self.entities_json = [{"id": "entity-1"}]
            self.apis_json = [{"id": "api-1"}]
            self.system_config_json = {"common_variables": [{"name": "$고객명"}]}

        @property
        def version_json(self) -> dict[str, object]:
            raise AssertionError("dialog flow snapshot read should not load version_json")

    db = _FakeSplitSession(
        dialog_rows=[SimpleNamespace(payload_json={"id": "intent-1", "dialogType": 1, "name": "해지"})],
        graph_rows=[SimpleNamespace(payload_json={"dialogId": "intent-1", "nodes": [{"id": "start"}]})],
    )

    payload = _serialize_version_dialog_flow(bot, SnapshotVersion(), "intent-1", db)  # type: ignore[arg-type]

    assert payload["dialog"]["name"] == "해지"
    assert payload["entities"] == [{"id": "entity-1"}]
    assert payload["apis"] == [{"id": "api-1"}]
    assert payload["system_config"] == {"common_variables": [{"name": "$고객명"}]}
    assert payload["asset_counts"]["dialogs"] == 1
    assert "version_json" not in payload["version"]


def test_sync_version_dialog_split_tables_creates_dialog_and_graph_rows() -> None:
    bot_id = uuid4()
    version_id = uuid4()
    bot = SimpleNamespace(id=bot_id)
    version = SimpleNamespace(id=version_id)
    db = _FakeSyncSession()
    version_json = {
        "dialogs": [{"id": "intent-1", "dialogType": 1, "name": "해지"}],
        "dialog_flow_graphs": [{"dialogId": "intent-1", "nodes": []}],
    }

    sync_version_dialog_split_tables(
        db,
        bot,
        version,
        version_json,
        include_dialogs=True,
        include_graphs=True,
    )

    dialog_rows = [row for row in db.added if isinstance(row, VersionDialogAsset)]
    graph_rows = [row for row in db.added if isinstance(row, VersionDialogFlowGraph)]
    assert len(dialog_rows) == 1
    assert dialog_rows[0].bot_id == bot_id
    assert dialog_rows[0].version_id == version_id
    assert dialog_rows[0].dialog_id == "intent-1"
    assert dialog_rows[0].kind == "intent"
    assert dialog_rows[0].payload_json == {"id": "intent-1", "dialogType": 1, "name": "해지"}
    assert len(graph_rows) == 1
    assert graph_rows[0].dialog_id == "intent-1"
    assert graph_rows[0].payload_json == {"dialogId": "intent-1", "nodes": []}


def test_sync_version_dialog_split_tables_updates_and_soft_deletes_rows() -> None:
    bot_id = uuid4()
    version_id = uuid4()
    bot = SimpleNamespace(id=bot_id)
    version = SimpleNamespace(id=version_id)
    keep_row = SimpleNamespace(
        bot_id=bot_id,
        version_id=version_id,
        dialog_id="intent-1",
        kind="intent",
        name="이전",
        display_name="이전",
        payload_json={"id": "intent-1", "name": "이전"},
        sort_order=9,
        deleted_at=None,
    )
    stale_row = SimpleNamespace(dialog_id="stale-intent", deleted_at=None)
    stale_graph = SimpleNamespace(dialog_id="stale-intent", deleted_at=None)
    db = _FakeSyncSession(dialog_rows=[keep_row, stale_row], graph_rows=[stale_graph])
    version_json = {
        "dialogs": [{"id": "intent-1", "dialogType": 1, "name": "신규"}],
        "dialog_flow_graphs": [],
    }

    sync_version_dialog_split_tables(
        db,
        bot,
        version,
        version_json,
        include_dialogs=True,
        include_graphs=True,
    )

    assert keep_row.name == "신규"
    assert keep_row.display_name == "신규"
    assert keep_row.sort_order == 0
    assert keep_row.payload_json == {"id": "intent-1", "dialogType": 1, "name": "신규"}
    assert keep_row.deleted_at is None
    assert stale_row.deleted_at is not None
    assert stale_graph.deleted_at is not None


def test_version_document_with_dialog_flow_replaces_dialog_and_graph_only() -> None:
    version = SimpleNamespace(
        version_json={
            "dialogs": [
                {"id": "intent-1", "name": "이전"},
                {"id": "intent-2", "name": "유지"},
            ],
            "dialog_flow_graphs": [
                {"id": "flow-old", "dialogId": "intent-1"},
                {"id": "flow-keep", "dialogId": "intent-2"},
            ],
            "entities": [{"id": "entity-1"}],
            "apis": [{"id": "api-1"}],
            "system_config": {"nlu_training": {"status": "success"}},
        },
    )

    next_document = _version_document_with_dialog_flow(
        version,
        "intent-1",
        {"id": "intent-1", "name": "신규"},
        {"id": "flow-new", "dialogId": "intent-1"},
    )

    assert next_document["dialogs"] == [
        {"id": "intent-1", "name": "신규"},
        {"id": "intent-2", "name": "유지"},
    ]
    assert next_document["dialog_flow_graphs"] == [
        {"id": "flow-keep", "dialogId": "intent-2"},
        {"id": "flow-new", "dialogId": "intent-1"},
    ]
    assert next_document["entities"] == [{"id": "entity-1"}]
    assert next_document["apis"] == [{"id": "api-1"}]
    assert next_document["system_config"]["nlu_training"] == {"status": "success"}


def test_serialize_version_configure_returns_configuration_sections_only() -> None:
    bot_id = uuid4()
    version_id = uuid4()
    bot = SimpleNamespace(id=bot_id, active_version_id=version_id)
    version = SimpleNamespace(
        id=version_id,
        bot_id=bot_id,
        version_no=1,
        name="v1",
        description=None,
        status="draft",
        comment=None,
        copied_from_version_id=None,
        activated_at=None,
        updated_at=datetime(2026, 5, 16, tzinfo=timezone.utc),
        created_at=datetime(2026, 5, 16, tzinfo=timezone.utc),
        version_json={
            "dialogs": [{"id": "intent-1"}],
            "dialog_flow_graphs": [{"dialogId": "intent-1"}],
            "dictionary": [{"id": "term-1"}],
            "entities": [{"id": "entity-1"}],
            "system_config": {"ai_config": {"nlu_type": "ml"}},
            "apis": [{"id": "api-1"}],
        },
    )

    payload = _serialize_version_configure(bot, version)

    assert payload["dialogs"] == [{"id": "intent-1"}]
    assert payload["dialog_flow_graphs"] == [{"dialogId": "intent-1"}]
    assert payload["dictionary"] == [{"id": "term-1"}]
    assert payload["entities"] == [{"id": "entity-1"}]
    assert payload["system_config"] == {"ai_config": {"nlu_type": "ml"}}
    assert "apis" not in payload
    assert "version_json" not in payload["version"]


def test_serialize_version_configure_uses_snapshots_without_full_document() -> None:
    bot_id = uuid4()
    version_id = uuid4()
    bot = SimpleNamespace(id=bot_id, active_version_id=version_id)

    class SnapshotVersion:
        def __init__(self) -> None:
            self.id = version_id
            self.bot_id = bot_id
            self.version_no = 1
            self.name = "v1"
            self.description = None
            self.status = "draft"
            self.comment = None
            self.copied_from_version_id = None
            self.activated_at = None
            self.updated_at = datetime(2026, 5, 16, tzinfo=timezone.utc)
            self.created_at = datetime(2026, 5, 16, tzinfo=timezone.utc)
            self.asset_counts_json = {"dialogs": 1, "intents": 1, "dictionary": 1, "entities": 1}
            self.scenario_validation_json = {"error_count": 0, "items": []}
            self.nlu_training_json = {}
            self.dictionary_json = [{"id": "term-1"}]
            self.entities_json = [{"id": "entity-1"}]
            self.system_config_json = {"ai_config": {"nlu_type": "ml"}}

        @property
        def version_json(self) -> dict[str, object]:
            raise AssertionError("configure snapshot read should not load version_json")

    db = _FakeSplitSession(
        dialog_rows=[SimpleNamespace(payload_json={"id": "intent-1", "dialogType": 1})],
        graph_rows=[SimpleNamespace(payload_json={"dialogId": "intent-1"})],
    )

    payload = _serialize_version_configure(bot, SnapshotVersion(), db)  # type: ignore[arg-type]

    assert payload["dialogs"] == [{"id": "intent-1", "dialogType": 1}]
    assert payload["dialog_flow_graphs"] == [{"dialogId": "intent-1"}]
    assert payload["dictionary"] == [{"id": "term-1"}]
    assert payload["entities"] == [{"id": "entity-1"}]
    assert payload["system_config"] == {"ai_config": {"nlu_type": "ml"}}
    assert payload["asset_counts"]["dictionary"] == 1
    assert "version_json" not in payload["version"]


def test_serialize_version_dialogs_uses_dialog_snapshot_without_graph_rows() -> None:
    bot_id = uuid4()
    version_id = uuid4()
    bot = SimpleNamespace(id=bot_id, active_version_id=version_id)

    class SnapshotVersion:
        def __init__(self) -> None:
            self.id = version_id
            self.bot_id = bot_id
            self.version_no = 1
            self.name = "v1"
            self.description = None
            self.status = "draft"
            self.comment = None
            self.copied_from_version_id = None
            self.activated_at = None
            self.updated_at = datetime(2026, 5, 16, tzinfo=timezone.utc)
            self.created_at = datetime(2026, 5, 16, tzinfo=timezone.utc)
            self.asset_counts_json = {"dialogs": 1, "intents": 1}
            self.scenario_validation_json = {"error_count": 0, "items": []}
            self.nlu_training_json = {}
            self.entities_json = []
            self.dictionary_json = []

        @property
        def version_json(self) -> dict[str, object]:
            raise AssertionError("dialog list snapshot read should not load version_json")

    db = _FakeSplitSession(
        dialog_rows=[SimpleNamespace(payload_json={"id": "intent-1", "dialogType": 1})],
        graph_rows=[],
    )

    payload = _serialize_version_dialogs(bot, SnapshotVersion(), db)  # type: ignore[arg-type]

    assert payload["items"] == [{"id": "intent-1", "dialogType": 1}]
    assert payload["asset_counts"]["dialogs"] == 1
    assert payload["scenario_validation"] == {"error_count": 0, "items": []}
    assert "version_json" not in payload["version"]


def test_version_document_with_configure_replaces_dialogs_and_graphs_only() -> None:
    version = SimpleNamespace(
        version_json={
            "dialogs": [{"id": "intent-old"}],
            "dialog_flow_graphs": [{"dialogId": "intent-old"}],
            "dictionary": [{"id": "term-1"}],
            "entities": [{"id": "entity-1"}],
            "system_config": {"nlu_training": {"status": "success"}},
        },
    )

    next_document = _version_document_with_configure(
        version,
        [{"id": "intent-new"}],
        [{"dialogId": "intent-new"}],
    )

    assert next_document["dialogs"] == [{"id": "intent-new"}]
    assert next_document["dialog_flow_graphs"] == [{"dialogId": "intent-new"}]
    assert next_document["dictionary"] == [{"id": "term-1"}]
    assert next_document["entities"] == [{"id": "entity-1"}]
    assert next_document["system_config"]["nlu_training"] == {"status": "success"}


def test_purge_version_cache_uses_version_wide_pattern(monkeypatch) -> None:
    version_id = uuid4()
    patterns: list[str] = []

    def fake_purge_cache_pattern(pattern: str) -> dict[str, object]:
        patterns.append(pattern)
        return {"status": "purged", "purged": 1, "pattern": pattern}

    monkeypatch.setattr(bots, "purge_cache_pattern", fake_purge_cache_pattern)

    result = _purge_version_cache(SimpleNamespace(id=version_id))

    assert result["status"] == "purged"
    assert patterns == [f"version:{version_id}:*"]


def test_update_version_dialogs_purges_cache_after_successful_commit(monkeypatch) -> None:
    bot, version = _fake_bot_version_pair()
    db = _FakeWriteSession()
    _stub_version_write_dependencies(monkeypatch, bot, version, db)
    next_dialogs = [{"id": "intent-1", "dialogType": 1, "name": "변경"}]

    result = bots.update_version_dialogs(
        bot.id,
        version.id,
        SimpleNamespace(items=next_dialogs),
        SimpleNamespace(),
        SimpleNamespace(id=uuid4()),
        db,
    )

    assert result["data"]["items"] == next_dialogs
    assert version.version_json["dialogs"] == next_dialogs
    assert db.events[-3:] == ["commit", "refresh", f"purge:{version.id}"]


def test_update_version_dialog_flow_purges_cache_after_successful_commit(monkeypatch) -> None:
    bot, version = _fake_bot_version_pair()
    db = _FakeWriteSession()
    _stub_version_write_dependencies(monkeypatch, bot, version, db)
    next_dialog = {"id": "intent-1", "dialogType": 1, "name": "변경"}
    next_graph = {"dialogId": "intent-1", "nodes": [{"id": "start"}], "links": []}

    result = bots.update_version_dialog_flow(
        bot.id,
        version.id,
        "intent-1",
        SimpleNamespace(dialog=next_dialog, graph=next_graph),
        SimpleNamespace(),
        SimpleNamespace(id=uuid4()),
        db,
    )

    assert result["data"]["dialog"] == next_dialog
    assert version.version_json["dialogs"] == [next_dialog]
    assert version.version_json["dialog_flow_graphs"] == [next_graph]
    assert db.events[-3:] == ["commit", "refresh", f"purge:{version.id}"]


def test_serialize_version_retraining_returns_dialogs_and_system_config_only() -> None:
    bot_id = uuid4()
    version_id = uuid4()
    bot = SimpleNamespace(id=bot_id, active_version_id=version_id)
    version = SimpleNamespace(
        id=version_id,
        bot_id=bot_id,
        version_no=1,
        name="v1",
        description=None,
        status="draft",
        comment=None,
        copied_from_version_id=None,
        activated_at=None,
        updated_at=datetime(2026, 5, 16, tzinfo=timezone.utc),
        created_at=datetime(2026, 5, 16, tzinfo=timezone.utc),
        version_json={
            "dialogs": [{"id": "intent-1"}],
            "system_config": {"retraining_records": {"row-1": {"status": "미학습"}}},
            "entities": [{"id": "entity-1"}],
        },
    )

    payload = _serialize_version_retraining(bot, version)

    assert payload["dialogs"] == [{"id": "intent-1"}]
    assert payload["system_config"] == {"retraining_records": {"row-1": {"status": "미학습"}}}
    assert "entities" not in payload
    assert "version_json" not in payload["version"]


def test_serialize_version_retraining_uses_snapshots_without_full_document() -> None:
    bot_id = uuid4()
    version_id = uuid4()
    bot = SimpleNamespace(id=bot_id, active_version_id=version_id)

    class SnapshotVersion:
        def __init__(self) -> None:
            self.id = version_id
            self.bot_id = bot_id
            self.version_no = 1
            self.name = "v1"
            self.description = None
            self.status = "draft"
            self.comment = None
            self.copied_from_version_id = None
            self.activated_at = None
            self.updated_at = datetime(2026, 5, 16, tzinfo=timezone.utc)
            self.created_at = datetime(2026, 5, 16, tzinfo=timezone.utc)
            self.asset_counts_json = {"dialogs": 1, "intents": 1}
            self.scenario_validation_json = {"error_count": 0, "items": []}
            self.nlu_training_json = {}
            self.system_config_json = {"retraining_records": {"row-1": {"status": "미학습"}}}

        @property
        def version_json(self) -> dict[str, object]:
            raise AssertionError("retraining snapshot read should not load version_json")

    db = _FakeSplitSession(dialog_rows=[SimpleNamespace(payload_json={"id": "intent-1"})])

    payload = _serialize_version_retraining(bot, SnapshotVersion(), db)  # type: ignore[arg-type]

    assert payload["dialogs"] == [{"id": "intent-1"}]
    assert payload["system_config"] == {"retraining_records": {"row-1": {"status": "미학습"}}}
    assert payload["asset_counts"]["dialogs"] == 1
    assert "version_json" not in payload["version"]


def test_version_document_with_retraining_replaces_dialogs_and_system_config_only() -> None:
    version = SimpleNamespace(
        version_json={
            "dialogs": [{"id": "intent-old"}],
            "system_config": {"nlu_training": {"status": "success"}},
            "entities": [{"id": "entity-1"}],
            "dictionary": [{"id": "term-1"}],
        },
    )

    next_document = _version_document_with_retraining(
        version,
        [{"id": "intent-new"}],
        {"retraining_records": {"row-1": {"status": "재학습완료"}}},
    )

    assert next_document["dialogs"] == [{"id": "intent-new"}]
    assert next_document["system_config"]["retraining_records"] == {"row-1": {"status": "재학습완료"}}
    assert next_document["system_config"]["nlu_training"] == {"status": "success"}
    assert next_document["entities"] == [{"id": "entity-1"}]
    assert next_document["dictionary"] == [{"id": "term-1"}]
