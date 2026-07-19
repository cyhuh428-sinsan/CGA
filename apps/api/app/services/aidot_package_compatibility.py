from __future__ import annotations

from copy import deepcopy
import hashlib
import json
from typing import Any

from app.core.version_documents import normalize_version_document


AIDOT_PACKAGE_META_KEY = "_aidot_package_compatibility"
AIDOT_PACKAGE_SCHEMA = "aidot-bot-package-v1"
AIDOT_PACKAGE_LIST_KEYS = {
    "dialogList": "dialogs",
    "dialogFlowGraphList": "dialog_flow_graphs",
    "faqDialogList": "faq_dialogs",
    "floatingButtonVoList": "floating_buttons",
    "ruleVoList": "rules",
    "smallTalkVoList": "small_talk",
    "blacklistList": "blacklists",
}


def _dict(value: object) -> dict[str, Any]:
    return deepcopy(value) if isinstance(value, dict) else {}


def _list(value: object) -> list[Any]:
    return deepcopy(value) if isinstance(value, list) else []


def _text(source: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = source.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def _stable_id(prefix: str, *values: object) -> str:
    source = "\x1f".join(str(value or "") for value in values)
    digest = hashlib.sha256(source.encode("utf-8")).hexdigest()[:24]
    return f"{prefix}-{digest}"


def _dialog_type(value: object) -> int:
    if value == 0 or (isinstance(value, str) and value.strip() == "0"):
        return 0
    return 1


def _source_body(payload: dict[str, Any]) -> dict[str, Any]:
    wrapped = payload.get("package")
    if isinstance(wrapped, dict) and isinstance(wrapped.get("botVo"), dict):
        return deepcopy(wrapped)
    return deepcopy(payload)


def is_aidot_bot_package(payload: object) -> bool:
    if not isinstance(payload, dict):
        return False
    body = _source_body(payload)
    return isinstance(body.get("botVo"), dict) and any(
        key in body
        for key in (
            "AIDOTAssistantVersion",
            "dialogList",
            "dialogFlowGraphList",
            "entityTypeList",
            "dictionaryVoList",
        )
    )


def _import_dialogs(value: object) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for index, item in enumerate(_list(value)):
        if not isinstance(item, dict):
            continue
        source = deepcopy(item)
        dialog_id = _text(source, "dialogId", "id", "dialogKey") or _stable_id("dialog", index, source)
        display_name = _text(source, "displayName", "dialogName", "name", "intentName", "moduleName") or dialog_id
        source.setdefault("dialogId", dialog_id)
        source["id"] = _text(source, "id") or dialog_id
        source["name"] = _text(source, "name") or display_name
        source["displayName"] = display_name
        source["dialogType"] = _dialog_type(source.get("dialogType"))
        result.append(source)
    return result


def _import_entities(value: object) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for index, item in enumerate(_list(value)):
        if not isinstance(item, dict):
            continue
        source = deepcopy(item)
        name = _text(source, "entityName", "name", "displayName") or _stable_id("entity-name", index, source)
        if name not in grouped:
            grouped[name] = {
                "id": _text(source, "entityTypeId", "entityId", "id") or _stable_id("entity", name),
                "name": name,
                "system": False,
                "intentEnabled": source.get("intentEnabled") is not False,
                "qaEnabled": source.get("qaEnabled") is True,
                "rows": [],
                "updatedAt": _text(source, "updatedAt", "updated_at"),
                "updatedBy": _text(source, "updatedBy", "updated_by"),
            }
            order.append(name)
        rows = source.get("rows")
        if isinstance(rows, list):
            grouped[name]["rows"].extend(deepcopy(rows))
            continue
        row_value = _text(source, "entityValue", "value", "canonicalValue")
        if not row_value:
            continue
        row_type = "P" if _text(source, "entityType", "rowType", "type").upper() == "P" else "S"
        detail = source.get("detail") if source.get("detail") is not None else source.get("pattern")
        details = source.get("details")
        if not isinstance(details, list):
            details = [str(detail)] if detail is not None and str(detail) else []
        grouped[name]["rows"].append(
            {
                "id": _text(source, "entityValueId", "rowId", "id") or _stable_id("entity-row", name, row_value, index),
                "value": row_value,
                "rowType": row_type,
                "details": [str(entry) for entry in details if str(entry)],
            }
        )
    return [grouped[name] for name in order]


def _import_dictionary(value: object) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for index, item in enumerate(_list(value)):
        if not isinstance(item, dict):
            continue
        source = deepcopy(item)
        word = _text(source, "word", "representativeWord", "representative", "name")
        if not word:
            continue
        synonyms = source.get("synonyms")
        if not isinstance(synonyms, list):
            synonyms = source.get("synonymList")
        if not isinstance(synonyms, list):
            synonym = source.get("synonym")
            synonyms = [synonym] if synonym is not None and str(synonym).strip() else []
        source["id"] = _text(source, "id", "dictionaryId") or _stable_id("dictionary", word, index)
        source["word"] = word
        source["synonyms"] = [str(entry).strip() for entry in synonyms if str(entry).strip()]
        source.setdefault("intentEnabled", True)
        source.setdefault("qaEnabled", False)
        source.setdefault("domainCandidate", False)
        source.setdefault("domainEnabled", False)
        source.setdefault("updatedAt", "")
        source.setdefault("updatedBy", "")
        result.append(source)
    return result


def _mapped_payload(document: dict[str, Any]) -> dict[str, Any]:
    normalized = normalize_version_document(document)
    return {
        "dialogs": normalized["dialogs"],
        "dialog_flow_graphs": normalized["dialog_flow_graphs"],
        "entities": normalized["entities"],
        "dictionary": normalized["dictionary"],
        "faq_dialogs": normalized["faq_dialogs"],
        "floating_buttons": normalized["floating_buttons"],
        "rules": normalized["rules"],
        "small_talk": normalized["small_talk"],
        "blacklists": normalized["blacklists"],
        "aidot_bot_system_config": (
            normalized["system_config"].get("aidot_bot_system_config")
            if isinstance(normalized["system_config"], dict)
            else []
        ),
    }


def _mapped_hash(document: dict[str, Any]) -> str:
    serialized = json.dumps(_mapped_payload(document), ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def aidot_bot_package_to_version_document(payload: dict[str, Any]) -> dict[str, Any]:
    if not is_aidot_bot_package(payload):
        raise ValueError("Aidot 봇 패키지 형식이 아닙니다. botVo와 Aidot 자산 목록을 확인해주세요.")
    body = _source_body(payload)
    document = normalize_version_document(
        {
            "asset_format_version": 1,
            "dialogs": _import_dialogs(body.get("dialogList")),
            "dialog_flow_graphs": _list(body.get("dialogFlowGraphList")),
            "entities": _import_entities(body.get("entityTypeList")),
            "dictionary": _import_dictionary(body.get("dictionaryVoList")),
            "faq_dialogs": _list(body.get("faqDialogList")),
            "floating_buttons": _list(body.get("floatingButtonVoList")),
            "rules": _list(body.get("ruleVoList")),
            "small_talk": _list(body.get("smallTalkVoList")),
            "blacklists": _list(body.get("blacklistList")),
            "system_config": {
                "aidot_bot_system_config": _list(body.get("botSystemConfigVoList")),
            },
        }
    )
    document[AIDOT_PACKAGE_META_KEY] = {
        "schema_version": AIDOT_PACKAGE_SCHEMA,
        "source_package": body,
        "mapped_hash": _mapped_hash(document),
    }
    return document


def _source_items(package: dict[str, Any], key: str) -> list[dict[str, Any]]:
    return [item for item in _list(package.get(key)) if isinstance(item, dict)]


def _source_match(items: list[dict[str, Any]], values: tuple[object, ...], keys: tuple[str, ...]) -> dict[str, Any]:
    wanted = {str(value).strip() for value in values if value is not None and str(value).strip()}
    if not wanted:
        return {}
    for item in items:
        if wanted.intersection({_text(item, *keys)}):
            return deepcopy(item)
    return {}


def _export_dialogs(document: dict[str, Any], source: dict[str, Any]) -> list[dict[str, Any]]:
    source_items = _source_items(source, "dialogList")
    result: list[dict[str, Any]] = []
    for index, item in enumerate(_list(document.get("dialogs"))):
        if not isinstance(item, dict):
            continue
        dialog_id = _text(item, "dialogId", "id", "dialogKey") or _stable_id("dialog", index, item)
        raw = _source_match(source_items, (dialog_id, _text(item, "name", "displayName")), ("dialogId", "id", "name", "displayName"))
        raw["dialogId"] = dialog_id
        raw["dialogType"] = _dialog_type(item.get("dialogType"))
        raw["displayName"] = _text(item, "displayName", "name") or dialog_id
        result.append(raw)
    return result


def _export_entities(document: dict[str, Any], source: dict[str, Any]) -> list[dict[str, Any]]:
    source_items = _source_items(source, "entityTypeList")
    result: list[dict[str, Any]] = []
    for item in _list(document.get("entities")):
        if not isinstance(item, dict):
            continue
        name = _text(item, "name", "entityName")
        rows = item.get("rows")
        if not isinstance(rows, list):
            rows = [item]
        for row in rows:
            if not isinstance(row, dict):
                continue
            value = _text(row, "value", "entityValue")
            if not name or not value:
                continue
            raw = _source_match(source_items, (f"{name}\x1f{value}",), ("_never",))
            if not raw:
                for candidate in source_items:
                    if _text(candidate, "entityName", "name") == name and _text(candidate, "entityValue", "value") == value:
                        raw = deepcopy(candidate)
                        break
            details = row.get("details") if isinstance(row.get("details"), list) else []
            raw["entityName"] = name
            raw["entityValue"] = value
            raw["entityType"] = "P" if _text(row, "rowType", "entityType", "type").upper() == "P" else "S"
            raw["detail"] = str(row.get("detail") or (details[0] if raw["entityType"] == "P" and details else ",".join(str(entry) for entry in details)))
            result.append(raw)
    return result


def _export_dictionary(document: dict[str, Any], source: dict[str, Any]) -> list[dict[str, Any]]:
    source_items = _source_items(source, "dictionaryVoList")
    result: list[dict[str, Any]] = []
    for item in _list(document.get("dictionary")):
        if not isinstance(item, dict):
            continue
        word = _text(item, "word", "representativeWord", "name")
        if not word:
            continue
        raw = _source_match(source_items, (word,), ("word", "representativeWord", "representative", "name"))
        raw["word"] = word
        raw["synonyms"] = [str(entry) for entry in item.get("synonyms", [])] if isinstance(item.get("synonyms"), list) else []
        result.append(raw)
    return result


def _export_direct_list(document: dict[str, Any], source: dict[str, Any], source_key: str, document_key: str) -> list[dict[str, Any]]:
    aliases: dict[str, tuple[tuple[str, ...], dict[str, str], tuple[str, ...]]] = {
        "faqDialogList": (("dialogId", "id", "question"), {"id": "dialogId"}, ("dialogId", "question", "answer", "enabled")),
        "floatingButtonVoList": (("buttonId", "id", "label"), {"id": "buttonId"}, ("buttonId", "label", "action", "enabled", "sortOrder")),
        "ruleVoList": (("ruleName", "name"), {"name": "ruleName", "description": "ruleDescription", "expression": "ruleExpression", "target": "targetDialogId"}, ("ruleName", "ruleDescription", "ruleExpression", "targetDialogId", "enabled")),
        "smallTalkVoList": (("trigger", "question", "input"), {}, ("trigger", "response", "enabled")),
        "blacklistList": (("blacklistName", "name"), {"name": "blacklistName", "type": "blacklistType", "pattern": "expression"}, ("blacklistName", "blacklistType", "expression", "enabled")),
    }
    match_keys, field_aliases, passthrough_keys = aliases.get(source_key, (("id", "name"), {}, ()))
    source_items = _source_items(source, source_key)
    result: list[dict[str, Any]] = []
    for item in _list(document.get(document_key)):
        if not isinstance(item, dict):
            continue
        match_values = tuple(item.get(key) for key in set(match_keys).union(field_aliases.keys()))
        raw = _source_match(source_items, match_values, match_keys)
        for key in tuple(raw):
            if key in item:
                raw[key] = deepcopy(item[key])
        for key in passthrough_keys:
            if key in item:
                raw[key] = deepcopy(item[key])
        for internal_key, aidot_key in field_aliases.items():
            if internal_key in item:
                raw[aidot_key] = deepcopy(item[internal_key])
        result.append(raw)
    return result


def version_document_to_aidot_bot_package(
    document: dict[str, Any],
    *,
    bot: dict[str, Any] | None = None,
    version: dict[str, Any] | None = None,
) -> dict[str, Any]:
    normalized = normalize_version_document(document)
    meta = normalized.get(AIDOT_PACKAGE_META_KEY)
    meta = meta if isinstance(meta, dict) else {}
    source = _dict(meta.get("source_package"))
    source_hash = meta.get("mapped_hash")
    if source and isinstance(source_hash, str) and source_hash == _mapped_hash(normalized):
        return source

    package = deepcopy(source)
    bot_meta = bot or {}
    version_meta = version or {}
    package.setdefault("AIDOTAssistantVersion", "CGA-AIDOT-COMPATIBLE-1")
    package["messageDigest"] = ""
    package.setdefault("licenseVo", None)
    bot_vo = _dict(package.get("botVo"))
    bot_vo.setdefault("botId", str(bot_meta.get("id") or ""))
    bot_vo.setdefault("botName", str(bot_meta.get("name") or "CGA Bot"))
    bot_vo.setdefault("description", str(bot_meta.get("description") or ""))
    bot_vo.setdefault("defaultLanguage", str(bot_meta.get("default_language") or bot_meta.get("locale") or "ko"))
    bot_vo.setdefault("versionName", str(version_meta.get("name") or version_meta.get("version_no") or "v1"))
    package["botVo"] = bot_vo

    package["dialogList"] = _export_dialogs(normalized, source)
    package["dialogFlowGraphList"] = _list(normalized.get("dialog_flow_graphs"))
    package["entityTypeList"] = _export_entities(normalized, source)
    package["dictionaryVoList"] = _export_dictionary(normalized, source)
    for source_key, document_key in AIDOT_PACKAGE_LIST_KEYS.items():
        if source_key in {"dialogList", "dialogFlowGraphList"}:
            continue
        package[source_key] = _export_direct_list(normalized, source, source_key, document_key)
    system_config = normalized.get("system_config")
    if isinstance(system_config, dict) and isinstance(system_config.get("aidot_bot_system_config"), list):
        package["botSystemConfigVoList"] = deepcopy(system_config["aidot_bot_system_config"])
    else:
        package.setdefault("botSystemConfigVoList", [])
    return package


def aidot_package_summary(payload: dict[str, Any]) -> dict[str, int | str]:
    body = _source_body(payload)
    return {
        "schema_version": AIDOT_PACKAGE_SCHEMA,
        "dialogs": len(_list(body.get("dialogList"))),
        "dialog_flow_graphs": len(_list(body.get("dialogFlowGraphList"))),
        "entities": len(_list(body.get("entityTypeList"))),
        "dictionary": len(_list(body.get("dictionaryVoList"))),
        "faq": len(_list(body.get("faqDialogList"))),
        "floating_buttons": len(_list(body.get("floatingButtonVoList"))),
        "rules": len(_list(body.get("ruleVoList"))),
        "small_talk": len(_list(body.get("smallTalkVoList"))),
        "blacklists": len(_list(body.get("blacklistList"))),
    }
