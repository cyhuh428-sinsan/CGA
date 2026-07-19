"""
버전 문서 정규화 테스트 — normalize_version_document 동작 검증
"""
from __future__ import annotations

from app.core.version_documents import (
    build_default_version_document,
    normalize_version_document,
)


def test_build_default_version_document_returns_required_keys() -> None:
    doc = build_default_version_document()
    required_keys = {
        "asset_format_version",
        "dialogs",
        "dialog_flow_graphs",
        "entities",
        "dictionary",
        "faq_dialogs",
        "apis",
        "rules",
        "system_config",
    }
    assert required_keys.issubset(set(doc.keys()))


def test_build_default_version_document_deep_copies() -> None:
    d1 = build_default_version_document()
    d2 = build_default_version_document()
    d1["dialogs"].append({"id": "x"})
    assert d2["dialogs"] == []


def test_normalize_version_document_fills_missing_list_fields() -> None:
    result = normalize_version_document({"dialogs": [{"id": "d1"}]})
    assert result["entities"] == []
    assert result["dictionary"] == []


def test_normalize_version_document_keeps_valid_list_fields() -> None:
    result = normalize_version_document({
        "dialogs": [{"id": "d1"}, {"id": "d2"}],
        "entities": [{"id": "e1"}],
    })
    assert len(result["dialogs"]) == 2
    assert len(result["entities"]) == 1


def test_normalize_version_document_replaces_invalid_list_with_default() -> None:
    result = normalize_version_document({"dialogs": "not-a-list"})
    assert result["dialogs"] == []


def test_normalize_version_document_keeps_extra_keys() -> None:
    result = normalize_version_document({"dialogs": [], "custom_field": "hello"})
    assert result["custom_field"] == "hello"


def test_normalize_version_document_handles_none_input() -> None:
    result = normalize_version_document(None)
    assert result["dialogs"] == []
    assert result["system_config"] == {}


def test_normalize_version_document_keeps_valid_system_config() -> None:
    result = normalize_version_document({"system_config": {"answer_training": {"status": "success"}}})
    assert result["system_config"]["answer_training"]["status"] == "success"


def test_normalize_version_document_replaces_invalid_dict_with_default() -> None:
    result = normalize_version_document({"system_config": "invalid"})
    assert result["system_config"] == {}
