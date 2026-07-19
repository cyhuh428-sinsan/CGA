from __future__ import annotations

from copy import deepcopy
from typing import Any


DEFAULT_VERSION_DOCUMENT: dict[str, Any] = {
    "asset_format_version": 1,
    "dialogs": [],
    "dialog_flow_graphs": [],
    "entities": [],
    "dictionary": [],
    "faq_dialogs": [],
    "apis": [],
    "floating_buttons": [],
    "rules": [],
    "small_talk": [],
    "blacklists": [],
    "system_config": {},
}


def build_default_version_document() -> dict[str, Any]:
    return deepcopy(DEFAULT_VERSION_DOCUMENT)


def normalize_version_document(document: dict[str, Any] | None) -> dict[str, Any]:
    normalized = build_default_version_document()
    if not isinstance(document, dict):
        return normalized

    for key, default_value in DEFAULT_VERSION_DOCUMENT.items():
        incoming_value = document.get(key)
        if isinstance(default_value, list):
            normalized[key] = incoming_value if isinstance(incoming_value, list) else deepcopy(default_value)
            continue
        if isinstance(default_value, dict):
            normalized[key] = incoming_value if isinstance(incoming_value, dict) else deepcopy(default_value)
            continue
        normalized[key] = incoming_value if incoming_value is not None else default_value

    for key, value in document.items():
        if key not in normalized:
            normalized[key] = value

    return normalized


def _matches_dialog_type(value: Any, expected: int) -> bool:
    if value == expected:
        return True
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip()) == expected
    return False


def _is_system_marker(value: Any) -> bool:
    return isinstance(value, str) and value.strip().lower() == "system"


def is_system_version_asset(item: dict[str, Any]) -> bool:
    return (
        item.get("system") is True
        or item.get("isSystem") is True
        or item.get("is_system") is True
        or _is_system_marker(item.get("systemKind"))
        or _is_system_marker(item.get("system_kind"))
        or _is_system_marker(item.get("kind"))
        or _is_system_marker(item.get("type"))
        or _is_system_marker(item.get("source"))
        or _is_system_marker(item.get("category"))
    )


def build_version_asset_counts(document: dict[str, Any] | None) -> dict[str, int]:
    normalized = normalize_version_document(document)
    dialogs = [item for item in normalized["dialogs"] if isinstance(item, dict)]
    user_entities = [
        item
        for item in normalized["entities"]
        if isinstance(item, dict) and not is_system_version_asset(item)
    ]
    user_dictionary = [
        item
        for item in normalized["dictionary"]
        if isinstance(item, dict) and not is_system_version_asset(item)
    ]
    retraining_records = normalized["system_config"].get("retraining_records")
    retraining_record_count = len(retraining_records) if isinstance(retraining_records, dict) else 0

    return {
        "dialogs": len(dialogs),
        "intents": sum(1 for item in dialogs if _matches_dialog_type(item.get("dialogType"), 1)),
        "modules": sum(1 for item in dialogs if _matches_dialog_type(item.get("dialogType"), 0)),
        "dialog_flow_graphs": len(normalized["dialog_flow_graphs"]),
        "entities": len(user_entities),
        "dictionary": len(user_dictionary),
        "qa": len(normalized["faq_dialogs"]),
        "apis": len(normalized["apis"]),
        "floating_buttons": len(normalized["floating_buttons"]),
        "rules": len(normalized["rules"]),
        "small_talk": len(normalized["small_talk"]),
        "blacklists": len(normalized["blacklists"]),
        "retraining_records": retraining_record_count,
    }
