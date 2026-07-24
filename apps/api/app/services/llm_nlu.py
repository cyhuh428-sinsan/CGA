from __future__ import annotations

from typing import Any

from app.core.version_documents import normalize_version_document
from app.services.llm_client import LlmClientError
from app.services.llm_intent import LlmIntentClassification, classify_intent_with_llm


LLM_NLU_PROMPT_VERSION = "aidot-llm-nlu-v1"


def _safe_text(value: Any) -> str:
    return str(value or "").strip()


def _is_intent_dialog(dialog: dict[str, Any]) -> bool:
    value = dialog.get("dialogType")
    if value == 1:
        return True
    return isinstance(value, str) and value.strip() == "1"


def _training_utterances(dialog: dict[str, Any]) -> list[str]:
    utterances = dialog.get("utterances")
    if not isinstance(utterances, list):
        return []

    texts: list[str] = []
    for item in utterances:
        if isinstance(item, str):
            text = item.strip()
        elif isinstance(item, dict):
            utterance_type = _safe_text(item.get("utteranceType")).upper() or "T"
            if utterance_type != "T":
                continue
            text = _safe_text(item.get("text"))
        else:
            text = ""
        if text:
            texts.append(text)
    return texts


def llm_intent_documents_from_version(version_json: dict[str, Any] | None) -> list[dict[str, Any]]:
    document = normalize_version_document(version_json)
    items: list[dict[str, Any]] = []
    for dialog in document.get("dialogs", []):
        if not isinstance(dialog, dict) or not _is_intent_dialog(dialog):
            continue
        utterances = _training_utterances(dialog)
        if not utterances:
            continue
        items.append(
            {
                "intentId": _safe_text(dialog.get("id")),
                "intentName": _safe_text(dialog.get("name")) or _safe_text(dialog.get("displayName")),
                "utterances": utterances,
            }
        )
    return items


def llm_dictionary_terms_from_version(version_json: dict[str, Any] | None) -> list[dict[str, Any]]:
    document = normalize_version_document(version_json)
    terms: list[dict[str, Any]] = []
    for item in document.get("dictionary", []):
        if not isinstance(item, dict):
            continue
        word = _safe_text(item.get("word"))
        if not word:
            continue
        synonyms = item.get("synonyms")
        values = [_safe_text(value) for value in synonyms] if isinstance(synonyms, list) else []
        terms.append({"name": word, "values": [value for value in values if value]})
    return terms


def llm_entity_terms_from_version(version_json: dict[str, Any] | None) -> list[dict[str, Any]]:
    document = normalize_version_document(version_json)
    terms: list[dict[str, Any]] = []
    for item in document.get("entities", []):
        if not isinstance(item, dict):
            continue
        name = _safe_text(item.get("name"))
        if not name:
            continue
        values: list[str] = []
        examples = item.get("examples")
        if isinstance(examples, list):
            values.extend(_safe_text(value) for value in examples)
        rows = item.get("rows")
        if isinstance(rows, list):
            for row in rows:
                if not isinstance(row, dict):
                    continue
                values.append(_safe_text(row.get("value")))
                details = row.get("details")
                if isinstance(details, list):
                    values.extend(_safe_text(value) for value in details)
        terms.append({"name": name, "values": [value for value in values if value]})
    return terms


def build_llm_nlu_training_snapshot(
    *,
    version_json: dict[str, Any] | None,
    ai_config: dict[str, Any] | None,
    trained_at: str,
    trained_by_login_id: str,
    score_cutoff: float = 0.75,
    similar_intent_score: float = 0.85,
    max_intent_results: int = 3,
) -> dict[str, Any]:
    config = ai_config if isinstance(ai_config, dict) else {}
    intent_documents = llm_intent_documents_from_version(version_json)
    dictionary_terms = llm_dictionary_terms_from_version(version_json)
    entity_terms = llm_entity_terms_from_version(version_json)
    utterance_count = sum(len(item.get("utterances", [])) for item in intent_documents)
    provider = _safe_text(config.get("llm_provider") or "chatgpt")
    model = _safe_text(config.get("llm_model") or "gpt-4o-mini")
    return {
        "status": "success",
        "schema_version": "aidot-llm-nlu-training-v1",
        "nlu_type": "llm",
        "nlu_model": _safe_text(config.get("nlu_model") or config.get("nlu_engine") or "llm_engine_default"),
        "engine_type": "llm",
        "trained_at": trained_at,
        "trained_by_login_id": trained_by_login_id,
        "intent_count": len(intent_documents),
        "utterance_count": utterance_count,
        "model_path": None,
        "provider": provider,
        "model": model,
        "llm_provider": provider,
        "llm_model": model,
        "llm_base_url": _safe_text(config.get("llm_base_url")),
        "language": _safe_text(config.get("language") or "ko"),
        "prompt_version": LLM_NLU_PROMPT_VERSION,
        "classification_policy": {
            "score_cutoff": score_cutoff,
            "similar_intent_score": similar_intent_score,
            "max_intent_results": max(1, max_intent_results),
        },
        "snapshot": {
            "intents": intent_documents,
            "dictionary_terms": dictionary_terms,
            "entity_terms": entity_terms,
        },
        "counts": {
            "intent_documents": utterance_count,
            "entity_documents": len(entity_terms),
            "dictionary_terms": len(dictionary_terms),
            "vocabulary": len(dictionary_terms),
        },
    }


def classify_intent_with_llm_snapshot(
    *,
    training_snapshot: dict[str, Any] | None,
    ai_config: dict[str, Any] | None,
    query: str,
    top_k: int = 3,
) -> LlmIntentClassification:
    snapshot = training_snapshot if isinstance(training_snapshot, dict) else {}
    config = ai_config if isinstance(ai_config, dict) else {}
    snapshot_payload = snapshot.get("snapshot")
    snapshot_payload = snapshot_payload if isinstance(snapshot_payload, dict) else {}
    provider = _safe_text(snapshot.get("llm_provider") or snapshot.get("provider") or config.get("llm_provider") or "chatgpt")
    model = _safe_text(snapshot.get("llm_model") or snapshot.get("model") or config.get("llm_model") or "gpt-4o-mini")
    base_url = _safe_text(snapshot.get("llm_base_url") or config.get("llm_base_url"))
    intents = snapshot_payload.get("intents")
    if not isinstance(intents, list):
        intents = []
    dictionary_terms = snapshot_payload.get("dictionary_terms")
    if not isinstance(dictionary_terms, list):
        dictionary_terms = []
    entity_terms = snapshot_payload.get("entity_terms")
    if not isinstance(entity_terms, list):
        entity_terms = []
    if not intents:
        raise LlmClientError("LLM NLU 학습 스냅샷에 사용할 의도와 학습문장이 없습니다.")
    return classify_intent_with_llm(
        provider=provider,
        model=model,
        api_key=None,
        base_url=base_url,
        timeout_seconds=None,
        query=query,
        intents=intents,
        top_k=top_k,
        dictionary_terms=dictionary_terms,
        entity_terms=entity_terms,
        language=_safe_text(snapshot.get("language") or config.get("language") or "ko"),
    )
