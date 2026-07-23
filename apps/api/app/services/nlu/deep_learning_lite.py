from __future__ import annotations

import json
import os
import math
import random
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any, Callable, TypedDict
from uuid import UUID

from app.core.config import settings
from app.core.version_documents import normalize_version_document
from app.models import BotVersion
from app.services.nlu.morph import (
    KiwiMorphAnalyzerProvider,
    MorphAnalyzerProvider,
    char_ngrams,
    create_morph_analyzer,
    normalize_text,
    normalize_token,
    select_learning_tokens,
)

class LearningTokenContext(TypedDict):
    canonical_map: dict[str, str]
    surface_canonical_map: dict[str, str]
    ignore_terms: list[str]
    ignore_regexes: list[str]


_GPU_ACCELERATION_RUNTIME: dict[str, Any] = {
    "execution_count": 0,
    "last_execution_at": None,
    "last_operation": None,
}


def _record_gpu_execution(operation: str) -> None:
    _GPU_ACCELERATION_RUNTIME["execution_count"] = int(_GPU_ACCELERATION_RUNTIME["execution_count"]) + 1
    _GPU_ACCELERATION_RUNTIME["last_execution_at"] = datetime.now(timezone.utc).isoformat()
    _GPU_ACCELERATION_RUNTIME["last_operation"] = operation


def get_ml_acceleration_status() -> dict[str, Any]:
    """Return process-local ML CUDA availability and actual execution telemetry."""
    configured = os.getenv("AIDOT_ML_ACCELERATOR", "auto").strip().lower()
    torch = sys.modules.get("torch")
    available: bool | None
    device_name: str | None = None
    if configured == "cpu":
        available = False
        state = "disabled"
    elif torch is None:
        available = None
        state = "not_initialized"
    else:
        try:
            available = bool(torch.cuda.is_available())
            if available:
                device_name = str(torch.cuda.get_device_name(0))
            state = "available" if available else "unavailable"
        except Exception:
            available = False
            state = "unavailable"
    return {
        "configured": configured,
        "available": available,
        "state": state,
        "device": device_name,
        "execution_count": int(_GPU_ACCELERATION_RUNTIME["execution_count"]),
        "last_execution_at": _GPU_ACCELERATION_RUNTIME["last_execution_at"],
        "last_operation": _GPU_ACCELERATION_RUNTIME["last_operation"],
    }

QUESTION_FEATURE_PATTERNS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("who", ("누구", "누가", "누군")),
    ("what", ("무엇", "무슨", "어떤", "뭐", "뭔")),
    ("when", ("언제", "몇시", "어느때")),
    ("where", ("어디", "어느곳")),
    ("why", ("왜", "어째서")),
    ("how", ("어떻게", "어떡", "어찌", "방법", "방식")),
    ("duration", ("얼마", "얼마나", "얼마동안", "몇분", "몇시간", "오래", "잠깐", "금방", "소요", "걸리")),
)

QUESTION_INTENT_PATTERNS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("meaning", ("뜻", "의미", "용어", "무슨말", "무슨뜻", "뭔뜻", "뭐뜻", "뭔데", "뭔가요", "뭐야", "뭐죠", "뭐예요", "뭐에요", "뭡니까", "무엇입니까", "뭘말하")),
    ("content", ("내용", "설명", "안내", "상세", "자세히", "무슨내용", "어떤내용")),
    ("type_choice", ("어떤", "무슨종류", "종류", "타입", "선택")),
    ("method", ("어떻게", "방법", "방식", "어떡", "어찌", "해야", "하라는", "하라")),
    ("duration", ("얼마", "얼마나", "얼마동안", "몇분", "몇시간", "오래", "소요", "소요시간", "잠깐", "금방", "걸리")),
    ("time_point", ("언제", "몇시", "오전", "오후", "이따", "나중", "다음", "이후", "내일", "모레", "오늘")),
    ("possibility", ("가능", "할수", "되나", "되나요", "돼요", "할까요", "있나요", "없나요")),
    ("reason", ("왜", "어째서", "이유", "원인", "때문")),
    ("person", ("누구", "누가", "누군")),
    ("place", ("어디", "어느곳", "위치", "장소")),
)

FUNCTION_FEATURE_PATTERNS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("follow_up", ("다음", "나중", "다시", "뒤", "후", "시간", "이후", "이따", "내일", "모레")),
    ("request", ("주세요", "해줘", "해주", "알려줘", "알려주", "듣고싶", "하고싶", "싶어", "싶다", "부탁")),
    ("completed", ("이미", "다했", "다했어", "다했다", "했어요", "했습니다", "들었", "알고있")),
    ("conditional", ("하면", "한다면", "자꾸", "계속하면", "고소")),
    ("permission", ("해도되", "해도돼", "되죠", "되나요", "될까요", "가능", "괜찮")),
    ("reason_clause", ("니까", "라서", "어서", "때문")),
    ("unknown", ("모르", "알수없", "잘모르", "모릅")),
    ("absence", ("자리없", "자리에없", "비우", "부재", "외출", "이동", "출장", "체류", "군대", "여행", "운전")),
    ("refusal", ("거부", "거절", "싫", "하지마", "하지말", "말라", "말라고", "그만", "안한다고", "안한다구", "안할래")),
)

NEGATIVE_FUNCTION_TOKENS = {"말다", "없다", "않다", "못하다", "거부", "불가"}
NEGATIVE_PREFIX_TOKENS = {"안", "못"}
GENERIC_PREDICATE_MATCH_TOKENS = {"하다", "되다", "있다"}
NEGATIVE_ONLY_SHARED_TOKENS = {"안되다", "못하다", "없다", "않다", "말다", "불가", "거부"}
NEGATIVE_REFUSAL_TOKENS = {"거부", "말다", "않다"}
NEGATIVE_INABILITY_TOKENS = {"안되다", "못하다", "없다", "불가"}
LOW_DISCRIMINATIVE_SHARED_TOKENS = {
    "가능",
    "가능하다",
    "되다",
    "있다",
    "없다",
    "않다",
    "못하다",
    "말다",
    "필요",
    "지금",
    "주다",
    "혹시",
    "어디",
    "얼마",
    "누구",
    "무슨",
    "무엇",
    "뭐",
    "왜",
    "언제",
    "어떻다",
    "도와주다",
}
MEANING_AXIS_SHARED_TOKENS = {"question:what", "question_intent:meaning", "말", "뜻", "의미"}
QUESTION_INTENT_AXIS_SHARED_TOKENS = {"question_intent:meaning", "question_intent:content"}
STANDALONE_QUESTION_INTENT_TOKENS = {"question_intent:meaning", "question_intent:content"}
STRONG_QUESTION_INTENT_AXIS_TOKENS = {"question_intent:duration", "question_intent:source"}
STRONG_FUNCTION_AXIS_TOKENS = {
    "function:unknown",
    "function:absence",
    "function:follow_up",
    "function:call_self_action",
    "function:call_inbound_request",
    "function:call_partner_contact",
}
FOLLOW_UP_AXIS_TOKENS = {"후속", "function:follow_up", "다음", "나중", "다시", "뒤", "후", "시간", "이후", "이따", "내일", "모레", "오늘", "오전", "오후"}
SOURCE_QUESTION_INTENT_TOKENS = {"question_intent:source", "question_intent:person", "question_intent:place"}
GENERIC_EXPLANATION_TOKENS = {"설명", "설명하다", "안내", "안내하다", "알리다", "듣다"}
CALL_ACTION_TOKENS = {"전화", "통화", "연락", "전화하다", "통화하다", "연락하다"}
GENERIC_REQUEST_SHARED_TOKENS = {
    "링크",
    "보내다",
    "부탁",
    "부탁하다",
    "부탁드리다",
    "드리다",
    "확인",
    "확인하다",
    "문의",
    "문의하다",
    "절차",
    "페이지",
    "방법",
    "모르다",
    "처음",
    "오늘",
    "안녕",
    "안녕하다",
}
SPEECH_SPEED_AXIS_TOKENS = {"속도", "발화", "빠르다", "느리다", "천천히", "빨리"}
SPEECH_SPEED_FEATURE_TOKENS = SPEECH_SPEED_AXIS_TOKENS | {"concept:속도"}
AVAILABILITY_BUSY_AXIS_TOKENS = {"바쁘다"}


def _is_intent_dialog(dialog: dict[str, Any]) -> bool:
    value = dialog.get("dialogType")
    if value == 1:
        return True
    return isinstance(value, str) and value.strip() == "1"


def _safe_text(value: object) -> str:
    return str(value or "").strip()


def _utterance_match_key(value: object) -> str:
    return re.sub(r"\s+", "", normalize_text(value))


def _extract_utterance_texts(dialog: dict[str, Any], utterance_type: str | None = None) -> list[str]:
    utterances = dialog.get("utterances")
    if not isinstance(utterances, list):
        return []

    texts: list[str] = []
    for item in utterances:
        if isinstance(item, str):
            if utterance_type and utterance_type != "T":
                continue
            text = item.strip()
        elif isinstance(item, dict):
            current_type = _safe_text(item.get("utteranceType")).upper() or "T"
            if utterance_type and current_type != utterance_type:
                continue
            text = _safe_text(item.get("text"))
        else:
            text = ""
        if text:
            texts.append(text)
    return texts


def _extract_entity_values(entity: dict[str, Any]) -> list[str]:
    values: list[str] = []
    rows = entity.get("rows")
    if not isinstance(rows, list):
        return values

    for row in rows:
        if not isinstance(row, dict):
            continue
        value = _safe_text(row.get("value"))
        if value:
            values.append(value)
        details = row.get("details")
        if isinstance(details, list):
            values.extend(_safe_text(item) for item in details if _safe_text(item))
        detail = _safe_text(row.get("detail"))
        if detail:
            values.append(detail)
    return values


def _lexicon_token_forms(value: object, analyzer: MorphAnalyzerProvider) -> set[str]:
    normalized = normalize_token(value)
    forms = {normalized} if normalized else set()
    for token in select_learning_tokens(analyzer.analyze(str(value or ""))):
        token_value = normalize_token(token)
        if token_value and (len(token_value) >= 2 or token_value == normalized):
            forms.add(token_value)
    return forms


def _load_synonym_entries_from_file(path: Path) -> list[dict[str, Any]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    entries = payload.get("entries") if isinstance(payload, dict) else []
    return [entry for entry in entries if isinstance(entry, dict)]


def _load_system_synonym_entries() -> list[dict[str, Any]]:
    base_dir = Path(__file__).parent
    entries: list[dict[str, Any]] = []
    for filename in ("builtin_synonyms.krdict.json", "builtin_synonyms.ko_basic.json", "system_synonyms.json"):
        entries.extend(_load_synonym_entries_from_file(base_dir / filename))
    return entries


def _load_system_synonym_sources() -> list[tuple[list[dict[str, Any]], bool]]:
    base_dir = Path(__file__).parent
    return [
        (_load_synonym_entries_from_file(base_dir / "builtin_synonyms.krdict.json"), False),
        (_load_synonym_entries_from_file(base_dir / "builtin_synonyms.ko_basic.json"), True),
        (_load_synonym_entries_from_file(base_dir / "system_synonyms.json"), True),
    ]


def extract_enabled_blocklist_patterns(version_settings: dict[str, Any] | None) -> tuple[list[str], list[str]]:
    settings_data = version_settings if isinstance(version_settings, dict) else {}
    word_patterns: list[str] = []
    regex_patterns: list[str] = []
    for item in settings_data.get("blocklists") or []:
        if not isinstance(item, dict) or item.get("enabled") is False:
            continue
        pattern = _safe_text(item.get("pattern"))
        if not pattern:
            continue
        if _safe_text(item.get("type")).lower() == "regex":
            regex_patterns.append(pattern)
        else:
            word_patterns.append(pattern)
    return word_patterns, regex_patterns


def _apply_ignore_patterns(text: str, ignore_terms: list[str] | None, ignore_regexes: list[str] | None) -> str:
    result = str(text or "")
    for term in sorted({term for term in (ignore_terms or []) if term}, key=len, reverse=True):
        result = re.sub(re.escape(term), " ", result, flags=re.IGNORECASE)
    for pattern in ignore_regexes or []:
        try:
            result = re.sub(pattern, " ", result, flags=re.IGNORECASE)
        except re.error:
            continue
    return re.sub(r"\s+", " ", result).strip()


def _merge_dictionary_entry_to_context(
    entry: dict[str, Any],
    analyzer: MorphAnalyzerProvider,
    canonical_map: dict[str, str],
    surface_canonical_map: dict[str, str],
    *,
    override_existing: bool,
) -> None:
    canonical = normalize_token(entry.get("word"))
    if not canonical:
        return
    entry_values = [entry.get("word")]
    match_mode = _safe_text(entry.get("matchMode")).lower()
    concept_mode = match_mode == "concept"
    surface_only = match_mode in {"surface", "concept"}
    surface_canonical = f"concept:{canonical}" if concept_mode else canonical
    if not surface_only:
        for form in _lexicon_token_forms(entry.get("word"), analyzer):
            if override_existing or form not in canonical_map:
                canonical_map[form] = canonical
    synonyms = entry.get("synonyms")
    if not isinstance(synonyms, list):
        synonyms = entry.get("details") if isinstance(entry.get("details"), list) else []
    for synonym in synonyms:
        entry_values.append(synonym)
        if not surface_only:
            for form in _lexicon_token_forms(synonym, analyzer):
                if override_existing or form not in canonical_map:
                    canonical_map[form] = canonical
    for value in entry_values:
        surface_form = normalize_token(value)
        if len(surface_form) >= 2 and (override_existing or surface_form not in surface_canonical_map):
            surface_canonical_map[surface_form] = surface_canonical


def build_learning_token_context(
    version_json: dict[str, Any] | None,
    analyzer: MorphAnalyzerProvider | None = None,
    *,
    version_settings: dict[str, Any] | None = None,
) -> LearningTokenContext:
    document = normalize_version_document(version_json)
    analyzer = analyzer or KiwiMorphAnalyzerProvider()
    canonical_map: dict[str, str] = {}
    surface_canonical_map: dict[str, str] = {}
    if analyzer.provider_name == "kiwipiepy":
        for entries, override_existing in _load_system_synonym_sources():
            for entry in entries:
                _merge_dictionary_entry_to_context(
                    entry,
                    analyzer,
                    canonical_map,
                    surface_canonical_map,
                    override_existing=override_existing,
                )
    for entry in document.get("dictionary") or []:
        if not isinstance(entry, dict) or entry.get("intentEnabled") is False:
            continue
        _merge_dictionary_entry_to_context(
            entry,
            analyzer,
            canonical_map,
            surface_canonical_map,
            override_existing=True,
        )
    ignore_terms, ignore_regexes = extract_enabled_blocklist_patterns(version_settings)
    return {
        "canonical_map": canonical_map,
        "surface_canonical_map": surface_canonical_map,
        "ignore_terms": ignore_terms,
        "ignore_regexes": ignore_regexes,
    }


def build_learning_token_canonical_map(version_json: dict[str, Any] | None) -> dict[str, str]:
    return build_learning_token_context(version_json)["canonical_map"]


def _canonicalize_learning_token(token: str, canonical_map: dict[str, str] | None) -> str:
    normalized = normalize_token(token)
    if not normalized:
        return ""
    return canonical_map.get(normalized, normalized) if canonical_map else normalized


def _canonicalize_surface_token(token: str, surface_canonical_map: dict[str, str] | None) -> str:
    normalized = normalize_token(token)
    if not normalized:
        return ""
    return surface_canonical_map.get(normalized, normalized) if surface_canonical_map else normalized


def _compose_predicate_token(base: str, suffix: str, canonical_map: dict[str, str] | None) -> str:
    normalized_base = normalize_token(base)
    normalized_suffix = normalize_token(suffix)
    if not normalized_base:
        return ""
    if normalized_base.endswith("다"):
        return _canonicalize_learning_token(normalized_base, canonical_map)
    return _canonicalize_learning_token(f"{normalized_base}{normalized_suffix}다", canonical_map)


def _derived_predicate_tokens(
    morph_tokens: list[Any],
    canonical_map: dict[str, str] | None,
    surface_canonical_map: dict[str, str] | None = None,
) -> list[str]:
    return _derived_predicate_token_data(morph_tokens, canonical_map, surface_canonical_map)[0]


def _compound_nominal_token_data(
    morph_tokens: list[Any],
    canonical_map: dict[str, str] | None,
    surface_canonical_map: dict[str, str] | None = None,
) -> tuple[list[str], set[int]]:
    compounds: list[str] = []
    consumed_indexes: set[int] = set()
    for index, token in enumerate(morph_tokens[:-1]):
        if getattr(token, "tag", "") != "XPN":
            continue
        next_token = morph_tokens[index + 1]
        next_tag = getattr(next_token, "tag", "")
        if not next_tag.startswith(("N", "XR", "SL")):
            continue
        prefix = normalize_token(getattr(token, "normalized", "") or getattr(token, "text", ""))
        stem = normalize_token(getattr(next_token, "normalized", "") or getattr(next_token, "text", ""))
        if not prefix or not stem:
            continue
        compound = _canonicalize_learning_token(f"{prefix}{stem}", canonical_map)
        compound = _canonicalize_surface_token(compound, surface_canonical_map)
        if compound:
            compounds.append(compound)
            consumed_indexes.add(index)
            consumed_indexes.add(index + 1)
    return list(dict.fromkeys(compounds)), consumed_indexes


def _derived_predicate_token_data(
    morph_tokens: list[Any],
    canonical_map: dict[str, str] | None,
    surface_canonical_map: dict[str, str] | None = None,
) -> tuple[list[str], set[int]]:
    derived: list[str] = []
    consumed_indexes: set[int] = set()
    for index, token in enumerate(morph_tokens):
        tag = getattr(token, "tag", "")
        if tag == "VV" and normalize_token(getattr(token, "normalized", "") or getattr(token, "text", "")) == "하다":
            base_index = -1
            particle_allowed = True
            for previous_index in range(index - 1, max(-1, index - 4), -1):
                previous = morph_tokens[previous_index]
                previous_tag = getattr(previous, "tag", "")
                if previous_tag.startswith("J"):
                    particle_text = normalize_token(getattr(previous, "text", "") or getattr(previous, "normalized", ""))
                    if previous_tag != "JKO" and particle_text not in {"을", "를"}:
                        particle_allowed = False
                        break
                    continue
                if previous_tag.startswith(("N", "XR", "SL")):
                    base_index = previous_index
                break
            if base_index >= 0 and particle_allowed:
                previous = morph_tokens[base_index]
                base = _canonicalize_learning_token(
                    getattr(previous, "normalized", "") or getattr(previous, "text", ""),
                    canonical_map,
                )
                base = _canonicalize_surface_token(base, surface_canonical_map)
                if base:
                    canonical = _compose_predicate_token(base, "하", canonical_map)
                    if canonical:
                        derived.append(canonical)
                        consumed_indexes.add(base_index)
                        consumed_indexes.add(index)
            next_token = morph_tokens[index + 1] if index + 1 < len(morph_tokens) else None
            next_form = normalize_token(getattr(next_token, "text", "") if next_token else "")
            if next_form == "어야":
                canonical = _canonicalize_learning_token("해야하다", canonical_map)
                if canonical:
                    derived.append(canonical)
                    consumed_indexes.add(index)
                    consumed_indexes.add(index + 1)
            continue
        if tag not in {"XSV", "XSA"}:
            continue
        previous = morph_tokens[index - 1] if index > 0 else None
        previous_tag = getattr(previous, "tag", "") if previous else ""
        if not previous or not previous_tag.startswith(("N", "XR", "SL")):
            continue
        base = _canonicalize_learning_token(getattr(previous, "normalized", "") or getattr(previous, "text", ""), canonical_map)
        base = _canonicalize_surface_token(base, surface_canonical_map)
        suffix = normalize_token(getattr(token, "normalized", "") or getattr(token, "text", ""))
        if base and suffix:
            canonical = _compose_predicate_token(base, suffix, canonical_map)
            if canonical:
                derived.append(canonical)
                consumed_indexes.add(index - 1)
                consumed_indexes.add(index)
    return list(dict.fromkeys(derived)), consumed_indexes


def _prohibited_predicate_tokens(
    morph_tokens: list[Any],
    canonical_map: dict[str, str] | None,
    surface_canonical_map: dict[str, str] | None = None,
) -> list[str]:
    prohibited: list[str] = []
    def append_prohibited(predicate: str) -> None:
        base = _canonicalize_learning_token(predicate, canonical_map)
        if base in GENERIC_PREDICATE_MATCH_TOKENS:
            return
        canonical = _canonicalize_surface_token(base, surface_canonical_map)
        if canonical:
            prohibited.append(f"prohibit:{canonical}")
        if base and base != canonical:
            prohibited.append(f"prohibit:{base}")

    for index, token in enumerate(morph_tokens):
        tag = getattr(token, "tag", "")
        next_token = morph_tokens[index + 1] if index + 1 < len(morph_tokens) else None
        after_next_token = morph_tokens[index + 2] if index + 2 < len(morph_tokens) else None
        next_form = normalize_token(getattr(next_token, "normalized", "") or getattr(next_token, "text", "") if next_token else "")
        after_next_form = normalize_token(
            getattr(after_next_token, "normalized", "") or getattr(after_next_token, "text", "") if after_next_token else ""
        )
        if next_form == "지" and after_next_form == "말다":
            if tag in {"XSV", "XSA"}:
                previous = morph_tokens[index - 1] if index > 0 else None
                previous_tag = getattr(previous, "tag", "") if previous else ""
                if previous and previous_tag.startswith(("N", "XR", "SL")):
                    base = _canonicalize_learning_token(
                        getattr(previous, "normalized", "") or getattr(previous, "text", ""),
                        canonical_map,
                    )
                    base = _canonicalize_surface_token(base, surface_canonical_map)
                    suffix = normalize_token(getattr(token, "normalized", "") or getattr(token, "text", ""))
                    if base and suffix:
                        append_prohibited(_compose_predicate_token(base, suffix, canonical_map))
            elif tag in {"VV", "VA"}:
                predicate = normalize_token(getattr(token, "normalized", "") or getattr(token, "text", ""))
                if predicate:
                    append_prohibited(predicate)
        if tag != "VX":
            continue
        current_form = normalize_token(getattr(token, "normalized", "") or getattr(token, "text", ""))
        if current_form != "하다" or next_form != "지" or after_next_form != "말다":
            continue
        previous = morph_tokens[index - 1] if index > 0 else None
        before_previous = morph_tokens[index - 2] if index > 1 else None
        previous_form = normalize_token(getattr(previous, "normalized", "") or getattr(previous, "text", "") if previous else "")
        before_previous_tag = getattr(before_previous, "tag", "") if before_previous else ""
        if previous_form == "게" and before_previous_tag in {"VV", "VA"}:
            predicate = normalize_token(getattr(before_previous, "normalized", "") or getattr(before_previous, "text", ""))
            if predicate:
                append_prohibited(predicate)
    compact_forms = "".join(normalize_token(getattr(token, "normalized", "") or getattr(token, "text", "")) for token in morph_tokens)
    if any(action in compact_forms for action in ("전화", "통화", "연락")) and any(
        pattern in compact_forms for pattern in ("그만", "하지마", "하지말", "말라", "말라고", "안한다고", "안한다구")
    ):
        if "전화" in compact_forms:
            append_prohibited("전화하다")
        if "통화" in compact_forms:
            append_prohibited("통화하다")
        if "연락" in compact_forms:
            append_prohibited("연락하다")
    return list(dict.fromkeys(prohibited))


def _negated_predicate_tokens(
    morph_tokens: list[Any],
    canonical_map: dict[str, str] | None,
    surface_canonical_map: dict[str, str] | None = None,
) -> list[str]:
    negated: list[str] = []
    for index, token in enumerate(morph_tokens[:-1]):
        current = normalize_token(getattr(token, "normalized", "") or getattr(token, "text", ""))
        if current not in NEGATIVE_PREFIX_TOKENS:
            continue
        next_token = morph_tokens[index + 1]
        next_tag = getattr(next_token, "tag", "")
        if next_tag not in {"VV", "VA"}:
            continue
        predicate = normalize_token(getattr(next_token, "normalized", "") or getattr(next_token, "text", ""))
        if not predicate or predicate in GENERIC_PREDICATE_MATCH_TOKENS:
            continue
        canonical = _canonicalize_learning_token(f"{current}{predicate}", canonical_map)
        canonical = _canonicalize_surface_token(canonical, surface_canonical_map)
        if canonical:
            negated.append(canonical)
    return list(dict.fromkeys(negated))


def _auxiliary_predicate_tokens(
    morph_tokens: list[Any],
    canonical_map: dict[str, str] | None,
    surface_canonical_map: dict[str, str] | None = None,
) -> list[str]:
    tokens: list[str] = []

    def append_token(predicate: str, auxiliary: str) -> None:
        predicate_token = _canonicalize_learning_token(predicate, canonical_map)
        predicate_token = _canonicalize_surface_token(predicate_token, surface_canonical_map)
        auxiliary_token = _canonicalize_learning_token(auxiliary, canonical_map)
        if predicate_token and auxiliary_token:
            tokens.append(f"{predicate_token}{auxiliary_token}")

    for index, token in enumerate(morph_tokens[:-2]):
        connector = morph_tokens[index + 1]
        auxiliary = morph_tokens[index + 2]
        connector_form = normalize_token(getattr(connector, "normalized", "") or getattr(connector, "text", ""))
        auxiliary_tag = getattr(auxiliary, "tag", "")
        auxiliary_form = normalize_token(getattr(auxiliary, "normalized", "") or getattr(auxiliary, "text", ""))
        if connector_form != "고" or auxiliary_tag != "VX" or auxiliary_form not in {"있다", "싶다", "보다", "주다"}:
            continue

        tag = getattr(token, "tag", "")
        if tag in {"VV", "VA"}:
            predicate = normalize_token(getattr(token, "normalized", "") or getattr(token, "text", ""))
            if predicate:
                append_token(predicate, auxiliary_form)
            continue

        if tag not in {"XSV", "XSA"} or index == 0:
            continue
        previous = morph_tokens[index - 1]
        previous_tag = getattr(previous, "tag", "")
        if not previous_tag.startswith(("N", "XR", "SL")):
            continue
        base = _canonicalize_learning_token(getattr(previous, "normalized", "") or getattr(previous, "text", ""), canonical_map)
        base = _canonicalize_surface_token(base, surface_canonical_map)
        suffix = normalize_token(getattr(token, "normalized", "") or getattr(token, "text", ""))
        if base and suffix:
            append_token(_compose_predicate_token(base, suffix, canonical_map), auxiliary_form)

    return list(dict.fromkeys(tokens))


def _self_action_feature_tokens(morph_tokens: list[Any]) -> list[str]:
    has_explicit_self_marker = any(
        normalize_token(getattr(token, "normalized", "") or getattr(token, "text", "")) in {"저", "나", "직접", "알아서", "혼자"}
        for token in morph_tokens
    )
    has_call_action = any(
        normalize_token(getattr(token, "normalized", "") or getattr(token, "text", "")) in {"전화", "통화", "연락", "걸다"}
        for token in morph_tokens
    )
    if not (has_explicit_self_marker or has_call_action):
        return []

    for index, token in enumerate(morph_tokens):
        if getattr(token, "tag", "") != "EF":
            continue
        ending = normalize_token(getattr(token, "normalized", "") or getattr(token, "text", ""))
        if "ᆯ게" not in ending:
            continue
        for previous_index in range(index - 1, -1, -1):
            previous = morph_tokens[previous_index]
            previous_tag = getattr(previous, "tag", "")
            if previous_tag in {"VV", "VA"}:
                predicate = normalize_token(getattr(previous, "normalized", "") or getattr(previous, "text", ""))
                if predicate and (predicate not in GENERIC_PREDICATE_MATCH_TOKENS or has_explicit_self_marker):
                    return ["function:self_action"]
                break
            if previous_tag in {"XSV", "XSA"}:
                for base in reversed(morph_tokens[:previous_index]):
                    base_tag = getattr(base, "tag", "")
                    if base_tag.startswith(("N", "XR", "SL")):
                        predicate = normalize_token(getattr(base, "normalized", "") or getattr(base, "text", ""))
                        if predicate:
                            return ["function:self_action"]
                        break
                    if base_tag.startswith(("J", "E")):
                        continue
                    break
                break
            if previous_tag.startswith(("N", "XR", "SL", "J", "E")):
                continue
            break
    return []


def _imperative_request_feature_tokens(morph_tokens: list[Any]) -> list[str]:
    if any(
        normalize_token(getattr(token, "normalized", "") or getattr(token, "text", "")) in {"못", "안", "말다", "않다"}
        for token in morph_tokens
    ):
        return []
    has_request_object = any(getattr(token, "tag", "").startswith(("N", "XR", "SL")) for token in morph_tokens)
    for index, token in enumerate(morph_tokens):
        tag = getattr(token, "tag", "")
        ending = normalize_token(getattr(token, "normalized", "") or getattr(token, "text", ""))
        if tag == "VX" and ending == "주다":
            return ["function:request"]
        is_sentence_final_connector = tag == "EC" and ending in {"어", "아"} and index == len(morph_tokens) - 1
        is_clear_polite_request = tag == "EF" and ending in {"어", "아", "세요", "십시오"}
        if not (is_clear_polite_request or is_sentence_final_connector):
            continue
        for previous_index in range(index - 1, -1, -1):
            previous = morph_tokens[previous_index]
            previous_tag = getattr(previous, "tag", "")
            if previous_tag in {"VV", "VA"}:
                predicate = normalize_token(getattr(previous, "normalized", "") or getattr(previous, "text", ""))
                if predicate and (predicate not in GENERIC_PREDICATE_MATCH_TOKENS or (is_clear_polite_request and has_request_object)):
                    return ["function:request"]
                break
            if previous_tag == "XSV" and previous_index > 0:
                base = morph_tokens[previous_index - 1]
                base_tag = getattr(base, "tag", "")
                predicate = normalize_token(getattr(base, "normalized", "") or getattr(base, "text", ""))
                if base_tag.startswith(("N", "XR", "SL")) and predicate:
                    return ["function:request"]
                break
            if previous_tag.startswith(("J", "E")):
                continue
            break
    return []


def _has_separated_negative_auxiliary(morph_tokens: list[Any]) -> bool:
    for index, token in enumerate(morph_tokens[:-1]):
        current = normalize_token(getattr(token, "normalized", "") or getattr(token, "text", ""))
        if current != "못":
            continue
        for following in morph_tokens[index + 1 : index + 4]:
            tag = getattr(following, "tag", "")
            value = normalize_token(getattr(following, "normalized", "") or getattr(following, "text", ""))
            if tag.startswith("E"):
                continue
            if value in {"하다", "되다"}:
                return True
            if tag.startswith(("J", "N", "XR", "SL")):
                continue
            break
    return False


def _call_direction_feature_tokens(morph_tokens: list[Any], selected_tokens: list[str], function_tokens: list[str]) -> list[str]:
    selected = set(selected_tokens)
    functions = set(function_tokens)
    if not (selected & CALL_ACTION_TOKENS):
        return []

    features: list[str] = []
    has_explicit_self_marker = any(
        normalize_token(getattr(token, "normalized", "") or getattr(token, "text", "")) in {"저", "나", "직접", "알아서", "혼자"}
        for token in morph_tokens
    )
    has_partner_contact = False
    for index, token in enumerate(morph_tokens):
        value = normalize_token(getattr(token, "normalized", "") or getattr(token, "text", ""))
        if value not in {"전화", "통화", "연락"}:
            continue
        has_partner_marker = any(
            normalize_token(getattr(previous, "normalized", "") or getattr(previous, "text", "")) in {"랑", "이랑", "하고", "와", "과"}
            and getattr(previous, "tag", "").startswith(("J", "M"))
            for previous in morph_tokens[max(0, index - 4) : index]
        )
        if has_partner_marker:
            has_partner_contact = True
            break
    if "function:self_action" in functions:
        features.append("function:call_partner_contact" if has_partner_contact else "function:call_self_action")
    elif has_partner_contact and "function:request" in functions:
        features.append("function:call_partner_contact")
    elif has_explicit_self_marker and "function:permission" in functions:
        features.append("function:call_self_action")
    elif "function:request" in functions:
        features.append("function:call_inbound_request")

    for index, token in enumerate(morph_tokens):
        value = normalize_token(getattr(token, "normalized", "") or getattr(token, "text", ""))
        tag = getattr(token, "tag", "")
        if value != "주다":
            continue
        previous_has_call = False
        for previous in reversed(morph_tokens[max(0, index - 4) : index]):
            previous_tag = getattr(previous, "tag", "")
            previous_value = normalize_token(getattr(previous, "normalized", "") or getattr(previous, "text", ""))
            if previous_tag.startswith("E"):
                continue
            if previous_value in {"전화", "통화", "연락"}:
                previous_has_call = True
                break
            if previous_tag.startswith(("N", "XR", "SL", "VV", "VA", "XSV", "XSA")):
                continue
            break
        if not previous_has_call:
            continue
        polite_or_conditional = any(
            normalize_token(getattr(following, "normalized", "") or getattr(following, "text", "")) in {"시", "세요", "시면", "실"}
            or getattr(following, "tag", "") in {"EP", "EF", "EC", "ETM"}
            for following in morph_tokens[index + 1 : index + 4]
        )
        if polite_or_conditional:
            features.append("function:call_inbound_request")
            break

    return list(dict.fromkeys(features))


def _matched_surface_entries(text: str, surface_canonical_map: dict[str, str] | None) -> list[tuple[str, str]]:
    if not surface_canonical_map:
        return []
    compact_text = normalize_token(text)
    if not compact_text:
        return []

    candidates: set[str] = set()
    candidates.add(compact_text)
    for eojeol in re.split(r"[^\w가-힣]+", str(text or "")):
        compact_eojeol = normalize_token(eojeol)
        if not compact_eojeol:
            continue
        candidates.add(compact_eojeol)
        for size in range(2, len(compact_eojeol) + 1):
            candidates.add(compact_eojeol[:size])

    for surface, canonical in surface_canonical_map.items():
        if str(canonical).startswith("concept:") and len(surface) >= 2 and surface in compact_text:
            candidates.add(surface)
        elif len(surface) >= 4 and surface in compact_text:
            candidates.add(surface)
    matched = [
        (surface, surface_canonical_map[surface])
        for surface in candidates
        if surface in surface_canonical_map
    ]
    return sorted(matched, key=lambda item: len(item[0]), reverse=True)


def _surface_canonical_tokens(text: str, surface_canonical_map: dict[str, str] | None) -> list[str]:
    matched: list[str] = []
    for surface, canonical in _matched_surface_entries(text, surface_canonical_map):
        min_length = 2 if str(canonical).startswith("concept:") else 2
        if len(surface) >= min_length:
            matched.append(canonical)
    return list(dict.fromkeys(matched))


def _lexicon_matched_morph_tokens(
    morph_tokens: list[Any],
    canonical_map: dict[str, str] | None,
    surface_canonical_map: dict[str, str] | None,
) -> list[str]:
    matched: list[str] = []
    for token in morph_tokens:
        tag = getattr(token, "tag", "")
        if tag != "MAG":
            continue
        value = normalize_token(getattr(token, "normalized", "") or getattr(token, "text", ""))
        if not value:
            continue
        if canonical_map and value in canonical_map:
            matched.append(_canonicalize_learning_token(value, canonical_map))
            continue
        if surface_canonical_map and value in surface_canonical_map:
            matched.append(value)
    return list(dict.fromkeys(token for token in matched if token))


def _surface_derived_predicate_tokens(
    text: str,
    canonical_map: dict[str, str] | None,
    surface_canonical_map: dict[str, str] | None,
) -> list[str]:
    if not surface_canonical_map:
        return []
    compact_text = normalize_token(text)
    if not compact_text:
        return []

    matched: list[str] = []
    for surface, canonical in _matched_surface_entries(text, surface_canonical_map):
        if not surface:
            continue
        if str(canonical).startswith("concept:"):
            continue
        if re.search(rf"{re.escape(surface)}(?:을|를)?(?:하|했|할|한|함)", compact_text):
            predicate = canonical if str(canonical).endswith("다") else f"{canonical}하다"
            token = _canonicalize_learning_token(predicate, canonical_map)
            if token:
                matched.append(token)
    return list(dict.fromkeys(matched))


def _question_feature_tokens(text: str, selected_tokens: list[str], morph_tokens: list[Any]) -> list[str]:
    compact_text = normalize_token(text)
    compact_tokens = "".join(selected_tokens)
    haystacks = (compact_text, compact_tokens)
    features: list[str] = []
    source_question_like = "어디" in compact_text and any(
        pattern in compact_text for pattern in ("전화", "보험사", "회사", "삼성", "거기", "소속")
    )
    question_like = bool(
        "?" in str(text or "")
        or source_question_like
        or any(pattern in compact_text for pattern in ("왜", "뭐", "무슨", "어떻게", "얼마나", "누구", "되나요", "있나요", "없나요", "입니까", "뭔데", "뭔가요", "뭐야", "시라구", "시라고", "어디시", "어디서전화", "어디에서전화", "어디세요"))
    )
    for axis, patterns in QUESTION_FEATURE_PATTERNS:
        if axis in {"where", "when"} and not question_like:
            continue
        if any(pattern in haystack for pattern in patterns for haystack in haystacks):
            features.append(f"question:{axis}")
    for axis, patterns in QUESTION_INTENT_PATTERNS:
        if axis in {"place", "time_point"} and not question_like:
            continue
        if any(pattern in haystack for pattern in patterns for haystack in haystacks):
            features.append(f"question_intent:{axis}")
    for axis, patterns in FUNCTION_FEATURE_PATTERNS:
        if any(pattern in haystack for pattern in patterns for haystack in haystacks):
            features.append(f"function:{axis}")
    if (
        "function:follow_up" in features
        and any(token.startswith("prohibit:") or token in NEGATIVE_REFUSAL_TOKENS or token == "싫다" for token in selected_tokens)
        and any(pattern in compact_text for pattern in ("다시는", "다시전화하지", "다시통화하지", "다시연락하지"))
    ):
        features = [feature for feature in features if feature != "function:follow_up"]
    if (
        "question:where" in features
        and any(pattern in compact_text for pattern in ("전화", "보험사", "회사", "어디시", "어디서", "거기", "소속"))
    ) or (
        "question:who" in features
        and any(pattern in compact_text for pattern in ("전화", "누가", "누구", "누군"))
    ) or (
        source_question_like
    ):
        features.append("question_intent:source")
    separated_negative_auxiliary = _has_separated_negative_auxiliary(morph_tokens)
    if any(
        token.startswith("prohibit:")
        or token in NEGATIVE_FUNCTION_TOKENS
        or any(token == f"{prefix}{predicate}" for prefix in NEGATIVE_PREFIX_TOKENS for predicate in GENERIC_PREDICATE_MATCH_TOKENS)
        for token in selected_tokens
    ) or separated_negative_auxiliary or any(pattern in compact_text for pattern in ("안되", "안돼", "안됩", "못하", "못해", "안하", "안해", "안했")):
        features.append("function:negative")
    if any(token.startswith("prohibit:") or token in NEGATIVE_REFUSAL_TOKENS or token == "싫다" for token in selected_tokens):
        features.append("function:refusal")
    if separated_negative_auxiliary or any(token in NEGATIVE_INABILITY_TOKENS for token in selected_tokens) or any(
        pattern in compact_text for pattern in ("안되", "안돼", "안됩", "못하", "못해", "불가")
    ):
        features.append("function:inability")
    return features


def _has_speech_speed_context(text: str, selected_tokens: list[str]) -> bool:
    selected = set(selected_tokens)
    if not (selected & SPEECH_SPEED_FEATURE_TOKENS):
        return False

    compact_text = normalize_token(text)
    has_speech_context = any(
        pattern in compact_text
        for pattern in ("말", "발화", "읽", "설명", "안내", "목소리", "음성", "속도")
    ) or bool(selected & {"말", "발화", "설명", "설명하다", "알리다"})
    if has_speech_context:
        return True

    has_other_action = any(
        token.endswith("하다")
        and len(token) > 2
        and token not in SPEECH_SPEED_AXIS_TOKENS
        and token not in GENERIC_PREDICATE_MATCH_TOKENS
        and token not in LOW_DISCRIMINATIVE_SHARED_TOKENS
        for token in selected
        if not token.startswith(("question:", "question_intent:", "prohibit:", "concept:", "function:", "gram:"))
    )
    return not has_other_action


def _tokenize_for_learning(
    text: str,
    analyzer: MorphAnalyzerProvider,
    canonical_map: dict[str, str] | None = None,
    surface_canonical_map: dict[str, str] | None = None,
    ignore_terms: list[str] | None = None,
    ignore_regexes: list[str] | None = None,
    include_semantic_adverbs: bool = True,
) -> list[str]:
    text = _apply_ignore_patterns(text, ignore_terms, ignore_regexes)
    morph_tokens = analyzer.analyze(text)
    compound_tokens, compound_source_indexes = _compound_nominal_token_data(
        morph_tokens,
        canonical_map,
        surface_canonical_map,
    )
    derived_tokens, derived_source_indexes = _derived_predicate_token_data(
        morph_tokens,
        canonical_map,
        surface_canonical_map,
    )
    surface_derived_tokens = _surface_derived_predicate_tokens(
        text,
        canonical_map,
        surface_canonical_map,
    )
    prohibited_tokens = _prohibited_predicate_tokens(
        morph_tokens,
        canonical_map,
        surface_canonical_map,
    )
    negated_tokens = _negated_predicate_tokens(
        morph_tokens,
        canonical_map,
        surface_canonical_map,
    )
    auxiliary_tokens = _auxiliary_predicate_tokens(
        morph_tokens,
        canonical_map,
        surface_canonical_map,
    )
    if surface_derived_tokens and "해야" not in normalize_token(text):
        derived_tokens = [token for token in derived_tokens if token != "해야하다"]
    selected_morph_tokens = select_learning_tokens(
        morph_tokens,
        include_semantic_adverbs=include_semantic_adverbs,
    )
    morph_selected = [
        canonical
        for token in selected_morph_tokens
        if (canonical := _canonicalize_learning_token(token, canonical_map))
    ]
    consumed_indexes = derived_source_indexes | compound_source_indexes
    if consumed_indexes:
        morph_selected = [
            canonical
            for index, token in enumerate(morph_tokens)
            if index not in consumed_indexes
            for selected in select_learning_tokens([token])
            if (canonical := _canonicalize_learning_token(selected, canonical_map))
        ]
    derived_base_tokens = {
        token[:-2]
        for token in derived_tokens
        if token.endswith("하다") and len(token) > 2
    }
    surface_tokens = [
        token
        for token in _surface_canonical_tokens(text, surface_canonical_map)
        if token not in derived_base_tokens
    ]
    lexicon_morph_tokens = _lexicon_matched_morph_tokens(
        morph_tokens,
        canonical_map,
        surface_canonical_map,
    )
    if derived_base_tokens:
        morph_selected = [token for token in morph_selected if token != "하다"]
    selected = list(
        dict.fromkeys(
            [
                *surface_tokens,
                *lexicon_morph_tokens,
                *compound_tokens,
                *surface_derived_tokens,
                *derived_tokens,
                *derived_base_tokens,
                *prohibited_tokens,
                *negated_tokens,
                *auxiliary_tokens,
                *morph_selected,
            ]
        )
    )
    compact_text = normalize_token(text)
    if (
        any(token.startswith("prohibit:") or token in NEGATIVE_REFUSAL_TOKENS or token == "싫다" for token in selected)
        and any(pattern in compact_text for pattern in ("다시는", "다시전화하지", "다시통화하지", "다시연락하지"))
    ):
        selected = [token for token in selected if token not in FOLLOW_UP_AXIS_TOKENS]
    has_speech_speed_context = _has_speech_speed_context(text, selected)
    if not has_speech_speed_context:
        selected = [token for token in selected if token not in SPEECH_SPEED_FEATURE_TOKENS]
    elif set(selected) & SPEECH_SPEED_AXIS_TOKENS and "concept:속도" not in selected:
        selected = list(dict.fromkeys(["concept:속도", *selected]))
    self_action_feature_tokens = _self_action_feature_tokens(morph_tokens)
    imperative_request_feature_tokens = _imperative_request_feature_tokens(morph_tokens)
    question_feature_tokens = _question_feature_tokens(text, selected, morph_tokens)
    call_direction_feature_tokens = _call_direction_feature_tokens(
        morph_tokens,
        selected,
        [*question_feature_tokens, *self_action_feature_tokens, *imperative_request_feature_tokens],
    )
    return list(
        dict.fromkeys(
            [
                *selected,
                *question_feature_tokens,
                *self_action_feature_tokens,
                *imperative_request_feature_tokens,
                *call_direction_feature_tokens,
            ]
        )
    )


def tokenize_texts_for_deep_learning_lite(
    texts: list[str],
    canonical_map: dict[str, str] | None = None,
    surface_canonical_map: dict[str, str] | None = None,
    ignore_terms: list[str] | None = None,
    ignore_regexes: list[str] | None = None,
    language: str = "ko",
) -> list[dict[str, Any]]:
    analyzer = create_morph_analyzer(language)
    return [
        {
            "text": text,
            "tokens": _tokenize_for_learning(
                text,
                analyzer,
                canonical_map,
                surface_canonical_map,
                ignore_terms,
                ignore_regexes,
            ),
        }
        for text in texts
    ]


def configure_intents_with_deep_learning_lite(
    utterances: list[str],
    target_count: int,
    target_count_policy: str = "near",
    seed_intents: list[dict[str, Any]] | None = None,
    version_document: dict[str, Any] | None = None,
    version_settings: dict[str, Any] | None = None,
    language: str = "ko",
) -> dict[str, Any]:
    analyzer = create_morph_analyzer(language)
    document = normalize_version_document(version_document or {})
    token_context = build_learning_token_context(document, analyzer, version_settings=version_settings)
    canonical_map = token_context["canonical_map"]
    surface_canonical_map = token_context["surface_canonical_map"]
    ignore_terms = token_context["ignore_terms"]
    ignore_regexes = token_context["ignore_regexes"]

    documents = _build_configure_documents(
        utterances,
        analyzer,
        canonical_map,
        surface_canonical_map,
        ignore_terms,
        ignore_regexes,
    )

    seed_groups = _configure_groups_from_seed_intents(
        documents,
        seed_intents,
        analyzer,
        canonical_map,
        surface_canonical_map,
        ignore_terms,
        ignore_regexes,
        target_count,
    )
    if seed_groups is not None:
        return {
            "provider": "local-ml",
            "model": "deep_learning_lite",
            "target_count": target_count,
            "target_count_policy": target_count_policy,
            "groups": seed_groups,
            "morph_analyzer": "kiwipiepy",
            "seed_mode": True,
            "assignment_policy": {
                "min_score": SEED_INTENT_ASSIGN_MIN_SCORE,
                "margin": SEED_INTENT_ASSIGN_MARGIN,
                "unmatched": "review_required",
            },
        }

    idf = _attach_configure_vectors(documents)

    clusters = _cluster_documents_for_configure(documents, max(1, int(target_count or 1)), target_count_policy, idf)
    groups = []
    for index, cluster in enumerate(clusters):
        sorted_documents = sorted(cluster["documents"], key=lambda item: int(item.get("index", 0)))
        groups.append(
            {
                "id": f"ml-{index + 1}",
                "name": f"의도 {index + 1}",
                "answer": f"의도 {index + 1}에 대해 안내드리겠습니다.",
                "utterances": [document_item["text"] for document_item in sorted_documents],
                "reason": _configure_cluster_reason(cluster),
            }
        )

    return {
        "provider": "local-ml",
        "model": "deep_learning_lite",
        "target_count": target_count,
        "target_count_policy": target_count_policy,
        "groups": groups,
        "morph_analyzer": "kiwipiepy",
    }


def _build_configure_documents(
    utterances: list[str],
    analyzer: MorphAnalyzerProvider,
    canonical_map: dict[str, str] | None = None,
    surface_canonical_map: dict[str, str] | None = None,
    ignore_terms: list[str] | None = None,
    ignore_regexes: list[str] | None = None,
) -> list[dict[str, Any]]:
    unique_utterances = list(dict.fromkeys(_safe_text(value) for value in utterances if _safe_text(value)))
    documents: list[dict[str, Any]] = []
    for index, utterance in enumerate(unique_utterances):
        tokens = _tokenize_for_learning(utterance, analyzer, canonical_map, surface_canonical_map, ignore_terms, ignore_regexes, include_semantic_adverbs=False)
        documents.append(
            {
                "index": index,
                "text": utterance,
                "tokens": tokens,
                "tf": _tf(tokens),
            }
        )
    return documents


def _attach_configure_vectors(documents: list[dict[str, Any]]) -> dict[str, float]:
    idf = _idf(documents)
    for document_item in documents:
        # Intent auto-configuration retains its existing clustering evidence. Runtime
        # intent classification uses only linguistic tokens through _vectorize().
        document_item["vector"] = _vectorize_for_configuration(document_item["tf"], idf)
    return idf


def _tf(tokens: list[str]) -> dict[str, float]:
    counts = Counter(tokens)
    return {token: float(count) for token, count in counts.items()}


def _token_feature_weight(token: str) -> float:
    """Return the classifier weight for an observed linguistic token.

    Rule-derived features describe the utterance for tracing and conflict handling,
    but they are not independent training evidence. Intent discrimination therefore
    uses morphological tokens and their intent-level TF-IDF only.
    """
    if token.startswith(("gram:", "question:", "question_intent:", "prohibit:", "concept:", "function:")):
        return 0.0
    return 1.0
def _configuration_token_feature_weight(token: str) -> float:
    """Preserve the established evidence weighting used by intent auto-configuration."""
    if token.startswith("question_intent:"):
        return 3.0
    if token.startswith("question:"):
        return 1.8
    if token.startswith("prohibit:"):
        return 2.2
    if token.startswith("concept:"):
        return 2.4
    if token.startswith("function:"):
        return 0.65 if token in {
            "function:request", "function:permission", "function:follow_up",
            "function:self_action", "function:completed", "function:reason_clause",
        } else 1.5
    if token.startswith("gram:"):
        return 0.0
    if token.endswith("하다") and len(token) > 2:
        return 1.55
    if token.endswith(("되다", "받다", "주다", "않다", "없다", "있다")):
        return 1.25
    if token.endswith("다") and len(token) > 1:
        return 1.12
    return 1.0


def _scoring_token_weight(
    token: str,
    idf: dict[str, float] | None = None,
    token_weight: Callable[[str], float] = _token_feature_weight,
) -> float:
    return token_weight(token) * (idf.get(token, 1.0) if idf else 1.0)


def _idf(documents: list[dict[str, Any]]) -> dict[str, float]:
    doc_count = len(documents)
    df: Counter[str] = Counter()
    for document in documents:
        df.update(set(document["tokens"]))
    return {token: math.log((doc_count + 1) / (count + 1)) + 1 for token, count in df.items()}


def _idf_by_group(documents: list[dict[str, Any]], primary_group_key: str) -> dict[str, float]:
    groups: set[str] = set()
    token_groups: defaultdict[str, set[str]] = defaultdict(set)
    for index, document in enumerate(documents):
        group = _safe_text(document.get(primary_group_key))
        if not group:
            group = _safe_text(document.get("entity_id"))
        if not group:
            group = f"{_safe_text(document.get('kind'))}:{index}"
        groups.add(group)
        for token in set(document.get("tokens") or []):
            token_groups[token].add(group)

    group_count = len(groups)
    if group_count <= 0:
        return {}
    return {token: math.log((group_count + 1) / (len(values) + 1)) for token, values in token_groups.items()}



def _configuration_idf_by_group(documents: list[dict[str, Any]], primary_group_key: str) -> dict[str, float]:
    """Retain the established IDF floor used by automatic intent configuration."""
    return {token: weight + 1.0 for token, weight in _idf_by_group(documents, primary_group_key).items()}

def _vectorize_for_configuration(term_frequency: dict[str, float], idf: dict[str, float]) -> dict[str, float]:
    """Keep automatic intent configuration compatible with its existing evidence."""
    weighted = {token: value * idf.get(token, 1.0) for token, value in term_frequency.items()}
    norm = math.sqrt(sum(value * value for value in weighted.values())) or 1.0
    return {token: value / norm for token, value in weighted.items()}


def _vectorize(term_frequency: dict[str, float], idf: dict[str, float]) -> dict[str, float]:
    weighted = {token: value * idf.get(token, 1.0) * _token_feature_weight(token) for token, value in term_frequency.items()}
    norm = math.sqrt(sum(value * value for value in weighted.values())) or 1.0
    return {token: value / norm for token, value in weighted.items()}


def _centroid(vectors: list[dict[str, float]]) -> dict[str, float]:
    merged: defaultdict[str, float] = defaultdict(float)
    for vector in vectors:
        for token, value in vector.items():
            merged[token] += value

    divisor = max(len(vectors), 1)
    averaged = {token: value / divisor for token, value in merged.items()}
    norm = math.sqrt(sum(value * value for value in averaged.values())) or 1.0
    return {token: value / norm for token, value in averaged.items()}


def _cosine(left: dict[str, float], right: dict[str, float]) -> float:
    return sum(value * right.get(token, 0.0) for token, value in left.items())


def _prepare_cuda_centroid_batch(intents: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Build the reusable CUDA centroid matrix for one evaluation model."""
    if os.getenv("AIDOT_ML_ACCELERATOR", "auto").strip().lower() == "cpu":
        return None
    try:
        import torch
    except Exception:
        return None
    if not torch.cuda.is_available():
        return None
    vocabulary = sorted({token for intent in intents for token in (intent.get("centroid") or {})})
    try:
        centroids = (
            torch.tensor(
                [[(intent.get("centroid") or {}).get(token, 0.0) for token in vocabulary] for intent in intents],
                dtype=torch.float64,
                device="cuda",
            )
            if vocabulary
            else None
        )
        return {
            "vocabulary": vocabulary,
            "centroids": centroids,
            "intent_count": len(intents),
        }
    except Exception:
        return None


def _cuda_centroid_scores(
    vector: dict[str, float],
    intents: list[dict[str, Any]],
    prepared_batch: dict[str, Any] | None = None,
) -> list[float] | None:
    """Score one vector against a centroid matrix that can be reused across rows."""
    batch = prepared_batch or _prepare_cuda_centroid_batch(intents)
    if batch is None or int(batch.get("intent_count") or 0) != len(intents):
        return None
    vocabulary = batch.get("vocabulary")
    if not isinstance(vocabulary, list):
        return None
    if not vocabulary:
        return [0.0 for _ in intents]
    centroids = batch.get("centroids")
    if centroids is None:
        return None
    try:
        import torch

        query = torch.tensor([vector.get(token, 0.0) for token in vocabulary], dtype=torch.float64, device="cuda")
        scores = [float(score) for score in torch.matmul(centroids, query).cpu().tolist()]
        _record_gpu_execution("centroid_scoring")
        return scores
    except Exception:
        return None

def _ml_evaluation_execution_device() -> str:
    if os.getenv("AIDOT_ML_ACCELERATOR", "auto").strip().lower() == "cpu":
        return "cpu"
    try:
        import torch
    except Exception:
        return "cpu"
    return "cuda" if torch.cuda.is_available() else "cpu"


INTERNAL_CLUSTER_MIN_SIMILARITY = 0.42


def _documents_by_dialog(documents: list[dict[str, Any]]) -> defaultdict[str, list[dict[str, Any]]]:
    grouped: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    for document in documents:
        dialog_id = _safe_text(document.get("dialog_id"))
        if dialog_id:
            grouped[dialog_id].append(document)
    return grouped


def _cluster_documents_by_vector(documents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    clusters: list[dict[str, Any]] = []
    for document in documents:
        vector = document.get("vector")
        if not isinstance(vector, dict):
            vector = {}

        best_index = -1
        best_score = -1.0
        for index, cluster in enumerate(clusters):
            score = _cosine(vector, cluster["centroid"])
            if score > best_score:
                best_index = index
                best_score = score

        if best_index >= 0 and best_score >= INTERNAL_CLUSTER_MIN_SIMILARITY:
            cluster = clusters[best_index]
            cluster["documents"].append(document)
            cluster["centroid"] = _centroid([item.get("vector", {}) for item in cluster["documents"]])
            continue

        clusters.append(
            {
                "documents": [document],
                "centroid": vector,
            }
        )
    return clusters


def _build_internal_intent_models(
    documents: list[dict[str, Any]],
    dialogs_by_id: dict[str, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    models: list[dict[str, Any]] = []
    for dialog_id, items in _documents_by_dialog(documents).items():
        dialog = (dialogs_by_id or {}).get(dialog_id, {})
        dialog_name = _safe_text(dialog.get("name")) or _safe_text(items[0].get("dialog_name"))
        display_name = _safe_text(dialog.get("displayName"))
        clusters = _cluster_documents_by_vector(items)
        for index, cluster in enumerate(clusters, start=1):
            cluster_documents = cluster["documents"]
            models.append(
                {
                    "dialog_id": dialog_id,
                    "dialog_name": dialog_name,
                    "display_name": display_name,
                    "internal_cluster_id": f"{dialog_id}:cluster:{index}",
                    "internal_cluster_index": index,
                    "internal_cluster_count": len(clusters),
                    "utterance_count": len(cluster_documents),
                    "seed_text": _safe_text(cluster_documents[0].get("text")) if cluster_documents else "",
                    "document_texts": [_safe_text(document.get("text")) for document in cluster_documents],
                    "centroid": cluster["centroid"],
                }
            )
    return models


LOW_VALUE_KOREAN_WORDS = {
    "요",
    "나요",
    "인가요",
    "죠",
    "지요",
    "은",
    "는",
    "이",
    "가",
    "을",
    "를",
    "에",
    "에서",
    "으로",
    "로",
    "와",
    "과",
    "도",
    "만",
}

def _is_meaningful_token(value: str) -> bool:
    token = normalize_text(value)
    return len(token) > 1 and token not in LOW_VALUE_KOREAN_WORDS and not token.endswith(("나요", "인가요", "지요"))


def _dice(left: list[str], right: list[str]) -> float:
    left_set = set(left)
    right_set = set(right)
    if not left_set or not right_set:
        return 0.0
    return (2 * len(left_set & right_set)) / (len(left_set) + len(right_set))


def _word_similarity(left: str, right: str) -> float:
    left_text = normalize_text(left)
    right_text = normalize_text(right)
    if not left_text or not right_text:
        return 0.0
    if left_text == right_text:
        return 1.0
    if left_text.startswith(("question:", "question_intent:", "prohibit:", "concept:", "function:")) or right_text.startswith(
        ("question:", "question_intent:", "prohibit:", "concept:", "function:")
    ):
        return 0.0
    if left_text in LOW_VALUE_KOREAN_WORDS or right_text in LOW_VALUE_KOREAN_WORDS:
        return min(_dice(char_ngrams(left_text, 2), char_ngrams(right_text, 2)) * 0.2, 0.03)
    if min(len(left_text), len(right_text)) >= 2 and max(len(left_text), len(right_text)) >= 4 and (
        left_text in right_text or right_text in left_text
    ):
        return 0.82
    if left_text.endswith("다") and right_text.endswith("다"):
        return min(
            max(
                _dice(char_ngrams(left_text, 2), char_ngrams(right_text, 2)) * 0.5,
                _dice(char_ngrams(left_text, 3), char_ngrams(right_text, 3)) * 0.55,
            ),
            0.42,
        )
    return max(
        _dice(char_ngrams(left_text, 2), char_ngrams(right_text, 2)) * 0.86,
        _dice(char_ngrams(left_text, 3), char_ngrams(right_text, 3)) * 0.92,
    )


def _intent_coverage_score(tokens: list[str], documents: list[dict[str, Any]], idf: dict[str, float] | None = None, token_weight: Callable[[str], float] = _token_feature_weight) -> float:
    input_tokens = [token for token in dict.fromkeys(tokens) if _is_scoring_token(token)]
    document_tokens = [
        token
        for token in dict.fromkeys(token for document in documents for token in document.get("tokens", []))
        if _is_scoring_token(token)
    ]
    if not input_tokens or not document_tokens:
        return 0.0

    input_weight = sum(_scoring_token_weight(token, idf, token_weight) for token in input_tokens) or 1.0
    document_weight = sum(_scoring_token_weight(token, idf, token_weight) for token in document_tokens) or 1.0
    input_coverage = sum(
        _scoring_token_weight(token, idf, token_weight) * max(_word_similarity(token, candidate) for candidate in document_tokens)
        for token in input_tokens
    ) / input_weight
    document_coverage = sum(
        _scoring_token_weight(token, idf, token_weight) * max(_word_similarity(token, candidate) for candidate in input_tokens)
        for token in document_tokens
    ) / document_weight
    coverage = (
        (2 * input_coverage * document_coverage) / (input_coverage + document_coverage)
        if input_coverage > 0 and document_coverage > 0
        else 0.0
    )
    exact_weight = sum(_scoring_token_weight(token, idf, token_weight) for token in set(input_tokens) & set(document_tokens))
    exact = (2 * exact_weight) / max(1.0, input_weight + document_weight)
    compound_soft_match_count = sum(
        1
        for candidate in document_tokens
        if max(_word_similarity(token, candidate) for token in input_tokens) >= 0.82
    )
    if coverage >= 0.62 and len(input_tokens) == 1 and compound_soft_match_count >= 2:
        return min(0.72, coverage * 0.9)
    if coverage < 0.68 and exact < 0.45:
        return 0.0
    return min(0.94, max(coverage * 0.9, exact * 0.96))


def _is_strong_shared_evidence_token(token: str) -> bool:
    if not _is_meaningful_token(token):
        return False
    if token.startswith("gram:"):
        return False
    if token in GENERIC_PREDICATE_MATCH_TOKENS:
        return False
    if token == "지금":
        return False
    if token in LOW_DISCRIMINATIVE_SHARED_TOKENS or token in NEGATIVE_ONLY_SHARED_TOKENS:
        return False
    if token in GENERIC_EXPLANATION_TOKENS or token in GENERIC_REQUEST_SHARED_TOKENS:
        return False
    if token in CALL_ACTION_TOKENS:
        return False
    if token in STANDALONE_QUESTION_INTENT_TOKENS:
        return True
    if token in STRONG_QUESTION_INTENT_AXIS_TOKENS or token in STRONG_FUNCTION_AXIS_TOKENS:
        return True
    if token.startswith(("question:", "question_intent:", "function:")):
        return False
    return True


def _is_scoring_token(token: str) -> bool:
    return _is_meaningful_token(token) and not token.startswith("gram:")


def _strong_shared_evidence_tokens(tokens: set[str]) -> set[str]:
    return {token for token in tokens if _is_strong_shared_evidence_token(token)}


def _has_unshared_action_token(tokens: set[str], shared: set[str]) -> bool:
    for token in tokens - shared:
        if token.startswith(("question:", "question_intent:", "prohibit:", "concept:", "function:", "gram:")):
            continue
        if token in GENERIC_PREDICATE_MATCH_TOKENS or token in LOW_DISCRIMINATIVE_SHARED_TOKENS:
            continue
        if token.endswith("하다") and len(token) > 2:
            return True
    return False


def _is_discriminative_content_token(token: str) -> bool:
    if not _is_scoring_token(token):
        return False
    if token.startswith(("question:", "question_intent:", "prohibit:", "concept:", "function:", "gram:")):
        return False
    if token in GENERIC_PREDICATE_MATCH_TOKENS:
        return False
    if token in LOW_DISCRIMINATIVE_SHARED_TOKENS or token in NEGATIVE_ONLY_SHARED_TOKENS:
        return False
    if token in GENERIC_EXPLANATION_TOKENS or token in CALL_ACTION_TOKENS or token in GENERIC_REQUEST_SHARED_TOKENS:
        return False
    return True


def _has_unshared_content_token(tokens: set[str], shared: set[str]) -> bool:
    return any(_is_discriminative_content_token(token) for token in tokens - shared)


def _has_content_token(tokens: set[str]) -> bool:
    return any(_is_discriminative_content_token(token) for token in tokens)


def _is_action_like_shared_token(token: str, shared: set[str]) -> bool:
    if token.endswith("다") and len(token) > 1:
        return True
    return f"{token}하다" in shared


def _cap_token_similarity_score(input_tokens: list[str], document_tokens: list[str], score: float) -> float:
    """Apply penalties only when the two utterances contain contradictory meaning.

    Similarity is calculated from weighted content-token overlap.  Missing a polite
    ending, a request marker, or one generic word is not a semantic contradiction
    and must not impose an arbitrary score ceiling.
    """
    input_meaningful = {token for token in input_tokens if _is_scoring_token(token)}
    document_meaningful = {token for token in document_tokens if _is_scoring_token(token)}

    input_question_intents = {token for token in input_meaningful if token.startswith("question_intent:")}
    document_question_intents = {token for token in document_meaningful if token.startswith("question_intent:")}
    if input_question_intents and document_question_intents and not (input_question_intents & document_question_intents):
        score = min(score, 0.42)

    input_negative_tokens = input_meaningful & NEGATIVE_ONLY_SHARED_TOKENS
    document_negative_tokens = document_meaningful & NEGATIVE_ONLY_SHARED_TOKENS
    if input_negative_tokens and document_negative_tokens:
        refusal_vs_inability = (
            (input_negative_tokens & NEGATIVE_REFUSAL_TOKENS and document_negative_tokens & NEGATIVE_INABILITY_TOKENS)
            or (input_negative_tokens & NEGATIVE_INABILITY_TOKENS and document_negative_tokens & NEGATIVE_REFUSAL_TOKENS)
        )
        if refusal_vs_inability:
            score = min(score, 0.48)

    input_call_direction = input_meaningful & {
        "function:call_self_action",
        "function:call_inbound_request",
        "function:call_partner_contact",
    }
    document_call_direction = document_meaningful & {
        "function:call_self_action",
        "function:call_inbound_request",
        "function:call_partner_contact",
    }
    if input_call_direction and document_call_direction and input_call_direction != document_call_direction:
        score = min(score, 0.34)

    return score

def _document_score(_input_text: str, input_tokens: list[str], document: dict[str, Any], idf: dict[str, float] | None = None, token_weight: Callable[[str], float] = _token_feature_weight) -> float:
    document_tokens = document.get("tokens", [])
    input_meaningful = {token for token in input_tokens if _is_scoring_token(token)}
    document_meaningful = {token for token in document_tokens if _is_scoring_token(token)}
    shared = input_meaningful & document_meaningful
    input_weight = sum(_scoring_token_weight(token, idf, token_weight) for token in input_meaningful) or 1.0
    document_weight = sum(_scoring_token_weight(token, idf, token_weight) for token in document_meaningful) or 1.0
    shared_weight = sum(_scoring_token_weight(token, idf, token_weight) for token in shared)
    exact = (2 * shared_weight) / max(1.0, input_weight + document_weight)
    soft = _intent_coverage_score(input_tokens, [document], idf, token_weight)
    score = min(1.0, max(exact * 0.96, soft))
    if not shared:
        compound_soft_match_count = sum(
            1
            for candidate in document_meaningful
            if max(_word_similarity(token, candidate) for token in input_meaningful) >= 0.82
        )
        if score >= 0.52 and len(input_meaningful) == 1 and compound_soft_match_count >= 2:
            return min(score, 0.72)
    return _cap_token_similarity_score(input_tokens, document_tokens, score)


def _configure_tokens(document: dict[str, Any]) -> set[str]:
    return {token for token in document.get("tokens", []) if _is_scoring_token(token)}


def _configure_content_tokens(tokens: set[str]) -> set[str]:
    return {token for token in tokens if _is_discriminative_content_token(token)}


def _has_soft_content_overlap(left_tokens: set[str], right_tokens: set[str]) -> bool:
    left_content = _configure_content_tokens(left_tokens)
    right_content = _configure_content_tokens(right_tokens)
    if left_content & right_content:
        return True
    return any(_word_similarity(left, right) >= 0.82 for left in left_content for right in right_content)


def _has_configure_merge_evidence(left_tokens: set[str], right_tokens: set[str]) -> bool:
    if _has_soft_content_overlap(left_tokens, right_tokens):
        return True

    left_content = _configure_content_tokens(left_tokens)
    right_content = _configure_content_tokens(right_tokens)
    shared_question_intents = {
        token
        for token in left_tokens & right_tokens
        if token.startswith("question_intent:")
    }
    if shared_question_intents and (
        "question_intent:meaning" in shared_question_intents
        or "question_intent:content" in shared_question_intents
        or not (left_content and right_content)
    ):
        return True

    shared_concepts = {token for token in left_tokens & right_tokens if token.startswith("concept:")}
    if shared_concepts and not (left_content and right_content):
        return True

    strong_shared_functions = {
        token
        for token in left_tokens & right_tokens
        if token
        in {
            "function:refusal",
            "function:inability",
            "function:absence",
            "function:follow_up",
            "function:call_self_action",
            "function:call_inbound_request",
            "function:call_partner_contact",
        }
    }
    if strong_shared_functions and not (left_content and right_content):
        return True

    return False


def _configure_pair_score(left: dict[str, Any], right: dict[str, Any], idf: dict[str, float]) -> float:
    return min(
        _document_score(left.get("text", ""), left.get("tokens", []), right, idf),
        _document_score(right.get("text", ""), right.get("tokens", []), left, idf),
    )


def _configure_cluster_document_key(document: dict[str, Any]) -> int:
    return int(document.get("_cluster_index", document.get("index", 0)))


def _has_configure_hard_conflict(
    left_tokens: set[str],
    right_tokens: set[str],
    *,
    require_merge_evidence: bool = True,
) -> bool:
    if not left_tokens or not right_tokens:
        return False

    if require_merge_evidence and not _has_configure_merge_evidence(left_tokens, right_tokens):
        return True

    left_question_intents = {token for token in left_tokens if token.startswith("question_intent:")}
    right_question_intents = {token for token in right_tokens if token.startswith("question_intent:")}
    if left_question_intents and right_question_intents and not left_question_intents.intersection(right_question_intents):
        return True

    left_call_self = "function:call_self_action" in left_tokens or "function:self_action" in left_tokens
    right_call_self = "function:call_self_action" in right_tokens or "function:self_action" in right_tokens
    left_call_inbound = "function:call_inbound_request" in left_tokens
    right_call_inbound = "function:call_inbound_request" in right_tokens
    left_partner_contact = "function:call_partner_contact" in left_tokens
    right_partner_contact = "function:call_partner_contact" in right_tokens
    if (left_call_self and (right_call_inbound or right_partner_contact)) or (
        right_call_self and (left_call_inbound or left_partner_contact)
    ):
        return True

    left_speech_speed = bool(left_tokens & SPEECH_SPEED_FEATURE_TOKENS)
    right_speech_speed = bool(right_tokens & SPEECH_SPEED_FEATURE_TOKENS)
    left_busy_or_unavailable = bool(left_tokens & AVAILABILITY_BUSY_AXIS_TOKENS) or bool(
        {"function:inability", "function:refusal", "function:absence"}.intersection(left_tokens)
    )
    right_busy_or_unavailable = bool(right_tokens & AVAILABILITY_BUSY_AXIS_TOKENS) or bool(
        {"function:inability", "function:refusal", "function:absence"}.intersection(right_tokens)
    )
    if left_speech_speed != right_speech_speed and (left_busy_or_unavailable or right_busy_or_unavailable):
        return True

    left_refusal = "function:refusal" in left_tokens
    right_refusal = "function:refusal" in right_tokens
    left_inability = "function:inability" in left_tokens
    right_inability = "function:inability" in right_tokens
    if (left_refusal and right_inability) or (right_refusal and left_inability):
        return True

    return False


def _clusters_have_configure_hard_conflict(
    left: dict[str, Any],
    right: dict[str, Any],
    *,
    require_merge_evidence: bool = True,
) -> bool:
    for left_document in left["documents"]:
        left_tokens = _configure_tokens(left_document)
        for right_document in right["documents"]:
            if _has_configure_hard_conflict(
                left_tokens,
                _configure_tokens(right_document),
                require_merge_evidence=require_merge_evidence,
            ):
                return True
    return False


def _configure_cluster_merge_score(
    left: dict[str, Any],
    right: dict[str, Any],
    idf: dict[str, float],
    pair_score_cache: dict[tuple[int, int], float] | None = None,
    *,
    require_merge_evidence: bool = True,
) -> float:
    if _clusters_have_configure_hard_conflict(
        left,
        right,
        require_merge_evidence=require_merge_evidence,
    ):
        return -1.0

    def pair_score(left_document: dict[str, Any], right_document: dict[str, Any]) -> float:
        left_index = _configure_cluster_document_key(left_document)
        right_index = _configure_cluster_document_key(right_document)
        cache_key = (left_index, right_index) if left_index <= right_index else (right_index, left_index)
        if pair_score_cache is not None and cache_key in pair_score_cache:
            return pair_score_cache[cache_key]
        score = _configure_pair_score(left_document, right_document, idf)
        if pair_score_cache is not None:
            pair_score_cache[cache_key] = score
        return score

    pair_scores = [
        pair_score(left_document, right_document)
        for left_document in left["documents"]
        for right_document in right["documents"]
    ]
    if not pair_scores:
        return -1.0

    left_best = [
        max(pair_score(left_document, right_document) for right_document in right["documents"])
        for left_document in left["documents"]
    ]
    right_best = [
        max(pair_score(right_document, left_document) for left_document in left["documents"])
        for right_document in right["documents"]
    ]
    bridge_score = (sum(left_best) + sum(right_best)) / max(1, len(left_best) + len(right_best))
    average_score = sum(pair_scores) / len(pair_scores)
    min_score = min(pair_scores)
    return bridge_score * 0.68 + average_score * 0.24 + min_score * 0.08


def _configure_stop_threshold(target_count: int, target_count_policy: str, current_count: int) -> float:
    if current_count > max(target_count * 2, target_count + 12):
        return 0.18
    if target_count_policy in {"minimize", "exact"} and current_count > target_count:
        return 0.0
    if current_count > target_count:
        return 0.2
    return 0.34


def _cluster_documents_for_configure(
    documents: list[dict[str, Any]],
    target_count: int,
    target_count_policy: str,
    idf: dict[str, float],
    *,
    require_merge_evidence: bool = True,
) -> list[dict[str, Any]]:
    local_documents = [
        {**document, "_cluster_index": index}
        for index, document in enumerate(documents)
    ]
    clusters: list[dict[str, Any]] = [{"documents": [document]} for document in local_documents]
    if len(clusters) <= 1:
        return clusters

    normalized_policy = target_count_policy if target_count_policy in {"minimize", "near", "exact"} else "near"
    pair_score_cache: dict[tuple[int, int], float] = {}
    edges: list[tuple[float, int, int]] = []
    for left_index in range(len(local_documents)):
        for right_index in range(left_index + 1, len(local_documents)):
            left_document = local_documents[left_index]
            right_document = local_documents[right_index]
            if _has_configure_hard_conflict(
                _configure_tokens(left_document),
                _configure_tokens(right_document),
                require_merge_evidence=require_merge_evidence,
            ):
                continue
            score = _configure_pair_score(left_document, right_document, idf)
            pair_score_cache[(left_index, right_index)] = score
            if score > 0:
                edges.append((score, left_index, right_index))
    edges.sort(reverse=True)

    def cluster_index_by_document_index() -> dict[int, int]:
        return {
            _configure_cluster_document_key(document): cluster_index
            for cluster_index, cluster in enumerate(clusters)
            for document in cluster["documents"]
        }

    merged = True
    while merged and len(clusters) > 1:
        merged = False
        membership = cluster_index_by_document_index()
        for edge_score, left_document_index, right_document_index in edges:
            left_cluster_index = membership.get(left_document_index)
            right_cluster_index = membership.get(right_document_index)
            if left_cluster_index is None or right_cluster_index is None or left_cluster_index == right_cluster_index:
                continue
            left_cluster = clusters[left_cluster_index]
            right_cluster = clusters[right_cluster_index]
            if _clusters_have_configure_hard_conflict(
                left_cluster,
                right_cluster,
                require_merge_evidence=require_merge_evidence,
            ):
                continue
            merge_score = _configure_cluster_merge_score(
                left_cluster,
                right_cluster,
                idf,
                pair_score_cache,
                require_merge_evidence=require_merge_evidence,
            )
            threshold = _configure_stop_threshold(target_count, normalized_policy, len(clusters))
            if merge_score < threshold and edge_score < threshold:
                continue

            if right_cluster_index < left_cluster_index:
                left_cluster_index, right_cluster_index = right_cluster_index, left_cluster_index
                left_cluster, right_cluster = right_cluster, left_cluster
            left_cluster["documents"].extend(right_cluster["documents"])
            clusters.pop(right_cluster_index)
            merged = True
            membership = cluster_index_by_document_index()

            if normalized_policy == "near" and len(clusters) <= target_count and merge_score < 0.4:
                merged = False
                break
            if normalized_policy in {"minimize", "exact"} and len(clusters) <= target_count:
                merged = False
                break

    clusters.sort(key=lambda cluster: min(int(document.get("index", 0)) for document in cluster["documents"]))
    return clusters


def _configure_cluster_reason(cluster: dict[str, Any]) -> str:
    token_counts = Counter(
        token
        for document in cluster["documents"]
        for token in _configure_tokens(document)
        if _is_discriminative_content_token(token) or token.startswith(("question_intent:", "function:", "concept:"))
    )
    return ", ".join(token for token, _ in token_counts.most_common(6))


SEED_INTENT_ASSIGN_MIN_SCORE = 0.42
SEED_INTENT_ASSIGN_MARGIN = 0.08
SEED_INTENT_ASSIGN_SOFT_MIN_SCORE = 0.34
SEED_INTENT_ASSIGN_SOFT_RATIO = 1.22
SEED_INTENT_ASSIGN_AXIS_MIN_SCORE = 0.34
SEED_INTENT_ASSIGN_AXIS_MARGIN = 0.01
SEED_INTENT_ASSIGN_DIRECTION_MIN_SCORE = 0.23
SEED_INTENT_ASSIGN_DIRECTION_MARGIN = 0.04
SEED_INTENT_ASSIGN_AXIS_FEATURES = {
    "question_intent:meaning",
    "question_intent:duration",
    "question_intent:source",
    "question_intent:person",
    "question_intent:place",
    "function:self_action",
    "function:follow_up",
    "function:call_self_action",
    "function:call_inbound_request",
    "function:call_partner_contact",
}
SEED_INTENT_ASSIGN_DIRECTION_FEATURES = {
    "function:self_action",
    "function:call_self_action",
    "function:call_inbound_request",
    "function:call_partner_contact",
}


def _seed_feature_matches_dialog_name(feature: str, dialog_name: str) -> bool:
    normalized_feature = normalize_token(feature)
    normalized_name = normalize_token(dialog_name)
    if not normalized_feature or not normalized_name:
        return False
    if normalized_feature in normalized_name:
        return True
    return len(normalized_feature) >= 3 and normalized_feature[:2] in normalized_name


def _normalize_seed_intents(seed_intents: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    if not isinstance(seed_intents, list):
        return normalized

    for index, item in enumerate(seed_intents):
        if not isinstance(item, dict):
            continue
        name = _safe_text(item.get("name"))
        if not name:
            continue
        representative_utterances = []
        raw_utterances = item.get("representative_utterances")
        if isinstance(raw_utterances, list):
            representative_utterances = list(dict.fromkeys(_safe_text(value) for value in raw_utterances if _safe_text(value)))[:20]
        normalized.append(
            {
                "id": f"seed-{index + 1}",
                "name": name,
                "representative_utterances": representative_utterances,
            }
        )
    return normalized


def _seed_intent_rows(seed_intents: list[dict[str, Any]]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for seed in seed_intents:
        seed_id = _safe_text(seed.get("id"))
        name = _safe_text(seed.get("name"))
        if not seed_id or not name:
            continue
        seed_texts = [name, *(seed.get("representative_utterances") or [])]
        for text in seed_texts:
            safe_text = _safe_text(text)
            if not safe_text:
                continue
            rows.append(
                {
                    "dialog_id": seed_id,
                    "dialog_name": name,
                    "text": safe_text,
                }
            )
    return rows


def _is_confident_seed_assignment(top: dict[str, Any] | None, second: dict[str, Any] | None) -> bool:
    if not top:
        return False
    if bool(top.get("exact_match")):
        return True
    top_score = float(top.get("score") or 0.0)
    second_score = float(second.get("score") or 0.0) if second else 0.0
    features = [str(feature) for feature in top.get("features") or []]
    second_features = {str(feature) for feature in (second.get("features") if second else []) or []}
    axis_features = set(features) & SEED_INTENT_ASSIGN_AXIS_FEATURES
    strong_features = [feature for feature in features if _is_strong_shared_evidence_token(feature)]
    if (
        len(strong_features) == 1
        and not axis_features
        and not any(feature.startswith(("function:", "question:", "question_intent:", "prohibit:")) for feature in features)
        and not (set(str(token) for token in top.get("shared_tokens") or []) - set(strong_features))
        and not strong_features[0].endswith("다")
        and top_score < 0.52
        and not _seed_feature_matches_dialog_name(strong_features[0], _safe_text(top.get("dialog_name")))
    ):
        return False
    if top_score >= SEED_INTENT_ASSIGN_MIN_SCORE and top_score >= second_score + SEED_INTENT_ASSIGN_MARGIN:
        return True
    if (
        axis_features
        and top_score >= SEED_INTENT_ASSIGN_AXIS_MIN_SCORE
        and top_score >= second_score + SEED_INTENT_ASSIGN_AXIS_MARGIN
        and not axis_features.intersection(second_features)
    ):
        return True
    direction_features = axis_features & SEED_INTENT_ASSIGN_DIRECTION_FEATURES
    if (
        direction_features
        and top_score >= SEED_INTENT_ASSIGN_DIRECTION_MIN_SCORE
        and top_score >= second_score + SEED_INTENT_ASSIGN_DIRECTION_MARGIN
        and not direction_features.intersection(second_features)
    ):
        return True
    if (
        "function:follow_up" in axis_features
        and "function:call_self_action" not in features
        and "function:call_partner_contact" not in features
        and top_score >= SEED_INTENT_ASSIGN_SOFT_MIN_SCORE
        and top_score >= second_score + 0.05
    ):
        return True
    if top_score < SEED_INTENT_ASSIGN_SOFT_MIN_SCORE:
        return False
    if top_score < second_score + SEED_INTENT_ASSIGN_MARGIN:
        return False
    if second_score > 0 and top_score < second_score * SEED_INTENT_ASSIGN_SOFT_RATIO:
        return False
    return any(_is_strong_shared_evidence_token(feature) for feature in features)


def _configure_groups_from_seed_intents(
    documents: list[dict[str, Any]],
    seed_intents: list[dict[str, Any]] | None,
    analyzer: MorphAnalyzerProvider,
    canonical_map: dict[str, str] | None = None,
    surface_canonical_map: dict[str, str] | None = None,
    ignore_terms: list[str] | None = None,
    ignore_regexes: list[str] | None = None,
    target_count: int = 50,
) -> list[dict[str, Any]] | None:
    normalized_seed_intents = _normalize_seed_intents(seed_intents)
    if not normalized_seed_intents:
        return None

    rows = _seed_intent_rows(normalized_seed_intents)
    model = _build_intent_eval_model(
        rows,
        analyzer,
        canonical_map,
        surface_canonical_map,
        ignore_terms,
        ignore_regexes,
        runtime_scoring=False,
    )
    if not model.get("intents"):
        return None

    assigned: dict[str, list[dict[str, Any]]] = defaultdict(list)
    fallback_documents: list[dict[str, Any]] = []
    for document in documents:
        text = _safe_text(document.get("text"))
        scores = _score_eval_model(
            model,
            text,
            analyzer,
            canonical_map,
            surface_canonical_map,
            ignore_terms,
            ignore_regexes,
            allow_dialog_union_score=True,
        )
        top = scores[0] if scores else None
        second = scores[1] if len(scores) > 1 else None
        if _is_confident_seed_assignment(top, second):
            assigned[_safe_text(top.get("dialog_id"))].append(document)
            continue
        fallback_documents.append(document)

    groups: list[dict[str, Any]] = []
    names_by_seed_id = {seed["id"]: seed["name"] for seed in normalized_seed_intents}
    for seed in normalized_seed_intents:
        seed_id = seed["id"]
        group_documents = sorted(assigned.get(seed_id) or [], key=lambda item: int(item.get("index", 0)))
        if not group_documents:
            continue
        name = names_by_seed_id.get(seed_id) or f"의도 {len(groups) + 1}"
        groups.append(
            {
                "id": f"ml-seed-{len(groups) + 1}",
                "name": name,
                "answer": f"{name}에 대해 안내드리겠습니다.",
                "utterances": [document["text"] for document in group_documents],
                "reason": "seed_intent",
            }
        )

    if fallback_documents:
        fallback_target_count = max(1, int(target_count or 1) - len(groups))
        fallback_idf = _attach_configure_vectors(fallback_documents)
        fallback_clusters = _cluster_documents_for_configure(
            fallback_documents,
            fallback_target_count,
            "near",
            fallback_idf,
            require_merge_evidence=True,
        )
        for index, cluster in enumerate(fallback_clusters, start=1):
            sorted_documents = sorted(cluster["documents"], key=lambda item: int(item.get("index", 0)))
            suffix = f" {index}" if len(fallback_clusters) > 1 else ""
            groups.append(
                {
                    "id": f"ml-review-{index}",
                    "name": f"검토 필요{suffix}",
                    "answer": "검토 필요 문장입니다.",
                    "utterances": [document["text"] for document in sorted_documents],
                    "reason": f"review_required: {_configure_cluster_reason(cluster)}",
                }
            )

    return groups


def _build_intent_eval_model(
    rows: list[dict[str, str]],
    analyzer: MorphAnalyzerProvider,
    canonical_map: dict[str, str] | None = None,
    surface_canonical_map: dict[str, str] | None = None,
    ignore_terms: list[str] | None = None,
    ignore_regexes: list[str] | None = None,
    runtime_scoring: bool = True,
) -> dict[str, Any]:
    documents: list[dict[str, Any]] = []
    for row in rows:
        tokens = _tokenize_for_learning(row["text"], analyzer, canonical_map, surface_canonical_map, ignore_terms, ignore_regexes, include_semantic_adverbs=runtime_scoring)
        if not tokens:
            continue
        documents.append(
            {
                "dialog_id": row["dialog_id"],
                "dialog_name": row["dialog_name"],
                "text": row["text"],
                "tokens": tokens,
                "tf": _tf(tokens),
            }
        )

    idf = (_idf_by_group(documents, "dialog_id") if runtime_scoring else _configuration_idf_by_group(documents, "dialog_id")) if documents else {}
    vectorize = _vectorize if runtime_scoring else _vectorize_for_configuration
    for document in documents:
        vector = vectorize(document["tf"], idf)
        document["vector"] = vector

    return {
        "idf": idf,
        "runtime_scoring": runtime_scoring,
        "documents": documents,
        "intents": _build_internal_intent_models(documents),
    }


def _classify_eval_model(
    model: dict[str, Any],
    text: str,
    analyzer: MorphAnalyzerProvider,
    canonical_map: dict[str, str] | None = None,
    surface_canonical_map: dict[str, str] | None = None,
    ignore_terms: list[str] | None = None,
    ignore_regexes: list[str] | None = None,
    use_gpu_centroid_batch: bool = False,
    prepared_cuda_centroid_batch: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    scores = _score_eval_model(
        model,
        text,
        analyzer,
        canonical_map,
        surface_canonical_map,
        ignore_terms,
        ignore_regexes,
        use_gpu_centroid_batch=use_gpu_centroid_batch,
        prepared_cuda_centroid_batch=prepared_cuda_centroid_batch,
    )
    return scores[0] if scores else None


def _score_eval_model(
    model: dict[str, Any],
    text: str,
    analyzer: MorphAnalyzerProvider,
    canonical_map: dict[str, str] | None = None,
    surface_canonical_map: dict[str, str] | None = None,
    ignore_terms: list[str] | None = None,
    ignore_regexes: list[str] | None = None,
    allow_dialog_union_score: bool = False,
    use_gpu_centroid_batch: bool = False,
    prepared_cuda_centroid_batch: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    runtime_scoring = bool(model.get("runtime_scoring", True))
    tokens = _tokenize_for_learning(text, analyzer, canonical_map, surface_canonical_map, ignore_terms, ignore_regexes, include_semantic_adverbs=runtime_scoring)
    if not tokens:
        return []

    normalized_input_text = _utterance_match_key(text)
    vectorize = _vectorize if runtime_scoring else _vectorize_for_configuration
    token_weight = _token_feature_weight if runtime_scoring else _configuration_token_feature_weight
    vector = vectorize(_tf(tokens), model.get("idf") or {})
    documents_by_dialog: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    for document in model.get("documents") or []:
        documents_by_dialog[document["dialog_id"]].append(document)
    scores_by_dialog: dict[str, dict[str, Any]] = {}
    intents = [intent for intent in model.get("intents") or [] if isinstance(intent, dict)]
    gpu_centroid_scores = (
        _cuda_centroid_scores(vector, intents, prepared_cuda_centroid_batch)
        if use_gpu_centroid_batch
        else None
    )
    for intent_index, intent in enumerate(intents):
        dialog_id = intent["dialog_id"]
        documents = documents_by_dialog[dialog_id]
        cluster_document_keys = {_utterance_match_key(value) for value in intent.get("document_texts") or []}
        cluster_documents = [
            document for document in documents if _utterance_match_key(document.get("text")) in cluster_document_keys
        ] or documents
        exact_match = any(_utterance_match_key(document.get("text")) == normalized_input_text for document in cluster_documents)
        dialog_union_score = 0.0
        if allow_dialog_union_score and len(documents) > len(cluster_documents):
            dialog_union_score = _cap_token_similarity_score(
                tokens,
                list(dict.fromkeys(token for document in documents for token in document.get("tokens", []))),
                _intent_coverage_score(tokens, documents, model.get("idf") or {}, token_weight),
            )
        score = max(
            1.0 if exact_match else 0.0,
            gpu_centroid_scores[intent_index] if gpu_centroid_scores is not None else _cosine(vector, intent["centroid"]),
            _intent_coverage_score(tokens, cluster_documents, model.get("idf") or {}, token_weight),
            max(
                (_document_score(text, tokens, document, model.get("idf") or {}, token_weight) for document in cluster_documents),
                default=0.0,
            ),
            dialog_union_score,
        )
        if not exact_match:
            cluster_tokens = list(dict.fromkeys(token for document in cluster_documents for token in document.get("tokens", [])))
            input_meaningful = [token for token in tokens if _is_scoring_token(token)]
            cluster_meaningful = [token for token in cluster_tokens if _is_scoring_token(token)]
            compound_soft_match_count = sum(
                1
                for candidate in cluster_meaningful
                if input_meaningful and max(_word_similarity(token, candidate) for token in input_meaningful) >= 0.82
            )
            if not (score >= 0.52 and len(input_meaningful) == 1 and compound_soft_match_count >= 2):
                score = _cap_token_similarity_score(tokens, cluster_tokens, score)
        cluster_token_set = set(token for document in cluster_documents for token in document.get("tokens", []))
        candidate = {
            "dialog_id": dialog_id,
            "dialog_name": intent["dialog_name"],
            "score": score,
            "exact_match": exact_match,
            "internal_cluster_id": intent.get("internal_cluster_id"),
            "internal_cluster_index": intent.get("internal_cluster_index"),
            "internal_cluster_count": intent.get("internal_cluster_count"),
            "shared_tokens": [
                token
                for token in dict.fromkeys(tokens)
                if token in cluster_token_set and _is_scoring_token(token)
            ],
            "features": _extract_score_features(tokens, vector, intent["centroid"], cluster_documents, token_weight),
        }
        previous = scores_by_dialog.get(dialog_id)
        if previous is None or (bool(candidate.get("exact_match")), candidate["score"]) > (
            bool(previous.get("exact_match")),
            previous["score"],
        ):
            scores_by_dialog[dialog_id] = candidate
    return sorted(scores_by_dialog.values(), key=lambda item: (bool(item.get("exact_match")), item["score"]), reverse=True)


def _extract_score_features(
    tokens: list[str],
    input_vector: dict[str, float],
    centroid: dict[str, float],
    documents: list[dict[str, Any]],
    token_weight: Callable[[str], float] = _token_feature_weight,
) -> list[str]:
    document_tokens = set(token for document in documents for token in document.get("tokens", []))
    matched = [token for token in dict.fromkeys(tokens) if token in document_tokens and token_weight(token) > 0]
    weighted = sorted(
        (
            (token, input_vector.get(token, 0.0) * centroid.get(token, 0.0))
            for token in set(input_vector) & set(centroid)
            if token_weight(token) > 0
        ),
        key=lambda item: item[1],
        reverse=True,
    )
    return list(dict.fromkeys([*matched, *(token for token, _ in weighted)]))[:8]


def _cached_eval_scores(
    score_cache: dict[str, list[dict[str, Any]]] | None,
    model: dict[str, Any],
    text: str,
    analyzer: MorphAnalyzerProvider,
    canonical_map: dict[str, str] | None,
    surface_canonical_map: dict[str, str] | None,
    ignore_terms: list[str] | None,
    ignore_regexes: list[str] | None,
    prepared_cuda_centroid_batch: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    if score_cache is not None and text in score_cache:
        return score_cache[text]

    scores = _score_eval_model(
        model,
        text,
        analyzer,
        canonical_map,
        surface_canonical_map,
        ignore_terms,
        ignore_regexes,
        use_gpu_centroid_batch=prepared_cuda_centroid_batch is not None,
        prepared_cuda_centroid_batch=prepared_cuda_centroid_batch,
    )
    if score_cache is not None:
        score_cache[text] = scores
    return scores


def _calculate_accuracy(
    model: dict[str, Any],
    rows: list[dict[str, str]],
    analyzer: MorphAnalyzerProvider,
    canonical_map: dict[str, str] | None = None,
    surface_canonical_map: dict[str, str] | None = None,
    ignore_terms: list[str] | None = None,
    ignore_regexes: list[str] | None = None,
    prepared_cuda_centroid_batch: dict[str, Any] | None = None,
    score_cache: dict[str, list[dict[str, Any]]] | None = None,
) -> float | None:
    if not rows:
        return None

    correct = 0
    for row in rows:
        if score_cache is None:
            predicted = _classify_eval_model(
                model,
                row["text"],
                analyzer,
                canonical_map,
                surface_canonical_map,
                ignore_terms,
                ignore_regexes,
                use_gpu_centroid_batch=prepared_cuda_centroid_batch is not None,
                prepared_cuda_centroid_batch=prepared_cuda_centroid_batch,
            )
        else:
            scores = _cached_eval_scores(
                score_cache,
                model,
                row["text"],
                analyzer,
                canonical_map,
                surface_canonical_map,
                ignore_terms,
                ignore_regexes,
                prepared_cuda_centroid_batch,
            )
            predicted = scores[0] if scores else None
        if predicted and predicted["dialog_id"] == row["dialog_id"]:
            correct += 1
    return correct / len(rows)


def _build_evaluation_snapshot(
    model: dict[str, Any],
    rows: list[dict[str, str]],
    analyzer: MorphAnalyzerProvider,
    canonical_map: dict[str, str] | None = None,
    surface_canonical_map: dict[str, str] | None = None,
    ignore_terms: list[str] | None = None,
    ignore_regexes: list[str] | None = None,
    prepared_cuda_centroid_batch: dict[str, Any] | None = None,
    score_cache: dict[str, list[dict[str, Any]]] | None = None,
) -> dict[str, Any]:
    evaluated_rows: list[dict[str, Any]] = []
    intent_ids = list(dict.fromkeys(row["dialog_id"] for row in rows if row.get("dialog_id")))
    intent_names = {
        row["dialog_id"]: row["dialog_name"]
        for row in rows
        if row.get("dialog_id")
    }

    for index, row in enumerate(rows):
        scores = _cached_eval_scores(
            score_cache,
            model,
            row["text"],
            analyzer,
            canonical_map,
            surface_canonical_map,
            ignore_terms,
            ignore_regexes,
            prepared_cuda_centroid_batch,
        )
        top = scores[0] if scores else None
        evaluated_rows.append(
            {
                "id": f"training-{index}",
                "utterance": row["text"],
                "expected_dialog_id": row["dialog_id"],
                "expected_name": row["dialog_name"],
                "predicted_dialog_id": top["dialog_id"] if top else "",
                "predicted_name": top["dialog_name"] if top else "-",
                "score": round(float(top["score"]) * 100, 2) if top else 0,
                "features": top.get("features", []) if top else [],
                "correct": bool(top and top["dialog_id"] == row["dialog_id"]),
                "scores": [
                    {
                        "dialog_id": score["dialog_id"],
                        "dialog_name": score["dialog_name"],
                        "score": round(float(score["score"]) * 100, 2),
                        "features": score.get("features", []),
                    }
                    for score in scores[:10]
                ],
            }
        )

    intent_metrics: list[dict[str, Any]] = []
    for dialog_id in intent_ids:
        expected = [row for row in evaluated_rows if row["expected_dialog_id"] == dialog_id]
        tp = sum(1 for row in evaluated_rows if row["expected_dialog_id"] == dialog_id and row["predicted_dialog_id"] == dialog_id)
        fp = sum(1 for row in evaluated_rows if row["expected_dialog_id"] != dialog_id and row["predicted_dialog_id"] == dialog_id)
        fn = sum(1 for row in evaluated_rows if row["expected_dialog_id"] == dialog_id and row["predicted_dialog_id"] != dialog_id)
        precision = tp / (tp + fp) if tp + fp else 0
        recall = tp / (tp + fn) if tp + fn else 0
        f1 = (2 * precision * recall / (precision + recall)) if precision + recall else 0
        feature_count = len(set(feature for row in expected for feature in row["features"]))
        intent_metrics.append(
            {
                "dialog_id": dialog_id,
                "dialog_name": intent_names.get(dialog_id, ""),
                "utterance_count": len(expected),
                "feature_count": feature_count,
                "accuracy": (sum(1 for row in expected if row["correct"]) / len(expected)) if expected else 0,
                "precision": precision,
                "recall": recall,
                "f1": f1,
            }
        )

    confusion_matrix = [
        {
            "expected_dialog_id": expected_id,
            "predicted_dialog_id": predicted_id,
            "count": sum(
                1
                for row in evaluated_rows
                if row["expected_dialog_id"] == expected_id and row["predicted_dialog_id"] == predicted_id
            ),
        }
        for expected_id in intent_ids
        for predicted_id in intent_ids
    ]

    return {
        "training_rows": evaluated_rows,
        "intent_metrics": intent_metrics,
        "confusion_matrix": confusion_matrix,
    }


def _classify_quality_status(
    row: dict[str, str],
    scores: list[dict[str, Any]],
    score_cutoff: float,
    similar_intent_score: float,
) -> tuple[str, str, str]:
    top = scores[0] if scores else None
    second = scores[1] if len(scores) > 1 else None
    expected = next((score for score in scores if score["dialog_id"] == row["dialog_id"]), None)
    if top is None or expected is None:
        return "미분류", "학습문장 부족", "분류 가능한 Feature가 부족합니다."

    top_score = float(top["score"])
    expected_score = float(expected["score"])
    if row.get("row_type") == "T" and expected.get("exact_match") and expected["dialog_id"] == row["dialog_id"]:
        return "정상", "정상", "학습문장 원문과 동일하게 매칭되었습니다."
    if top["dialog_id"] != row["dialog_id"]:
        return "오분류", "공통 Feature 충돌", f"{top['dialog_name']} 의도가 기대 의도보다 높게 분류되었습니다."
    if top_score < score_cutoff:
        return "Cut-off 미달", "학습문장 부족", "기대 의도는 1순위지만 Cut-off 기준을 통과하지 못했습니다."
    if second and float(second["score"]) >= score_cutoff and float(second["score"]) >= top_score * similar_intent_score:
        return "유사의도 충돌", "공통 Feature 충돌", f"{second['dialog_name']} 의도가 유사의도 기준 안에 있습니다."
    if expected_score - score_cutoff <= 0.05:
        return "Cut-off 근접", "Score 설정 후보", "현재는 통과하지만 Cut-off와의 차이가 작아 보완 후보입니다."
    return "정상", "정상", "정상 분류되었습니다."


def _build_quality_diagnostics(
    model: dict[str, Any],
    training_rows: list[dict[str, str]],
    validation_rows: list[dict[str, str]],
    analyzer: MorphAnalyzerProvider,
    score_cutoff: float,
    similar_intent_score: float,
    max_intent_results: int,
    canonical_map: dict[str, str] | None = None,
    surface_canonical_map: dict[str, str] | None = None,
    ignore_terms: list[str] | None = None,
    ignore_regexes: list[str] | None = None,
    prepared_cuda_centroid_batch: dict[str, Any] | None = None,
    score_cache: dict[str, list[dict[str, Any]]] | None = None,
) -> dict[str, Any]:
    rows_with_type = [
        *({"row_type": "T", **row} for row in training_rows),
        *({"row_type": "V", **row} for row in validation_rows),
    ]
    items: list[dict[str, Any]] = []

    for index, row in enumerate(rows_with_type):
        scores = _cached_eval_scores(
            score_cache,
            model,
            row["text"],
            analyzer,
            canonical_map,
            surface_canonical_map,
            ignore_terms,
            ignore_regexes,
            prepared_cuda_centroid_batch,
        )
        top = scores[0] if scores else None
        second = scores[1] if len(scores) > 1 else None
        expected = next((score for score in scores if score["dialog_id"] == row["dialog_id"]), None)
        status_label, diagnosis_type, reason = _classify_quality_status(row, scores, score_cutoff, similar_intent_score)
        if status_label == "정상":
            continue

        expected_score = float(expected["score"]) if expected else 0.0
        top_score = float(top["score"]) if top else 0.0
        second_score = float(second["score"]) if second else 0.0
        recommendation = (
            "해당 의도에 의미가 같은 T 문장을 보강하세요."
            if diagnosis_type == "학습문장 부족"
            else "충돌 의도의 공통 Feature를 줄이거나 구분되는 학습문장을 추가하세요."
            if diagnosis_type == "공통 Feature 충돌"
            else "학습문장 보강 후에도 반복되면 Cut-off/유사의도 Score를 마지막에 조정하세요."
        )
        items.append(
            {
                "id": f"{row['row_type'].lower()}-{index}",
                "row_type": row["row_type"],
                "utterance": row["text"],
                "expected_dialog_id": row["dialog_id"],
                "expected_name": row["dialog_name"],
                "predicted_dialog_id": top["dialog_id"] if top else "",
                "predicted_name": top["dialog_name"] if top else "-",
                "status": status_label,
                "diagnosis_type": diagnosis_type,
                "expected_score": round(expected_score * 100, 2),
                "top_score": round(top_score * 100, 2),
                "second_name": second["dialog_name"] if second else "-",
                "second_score": round(second_score * 100, 2),
                "cutoff_score": round(score_cutoff * 100, 2),
                "features": top.get("features", []) if top else [],
                "expected_features": expected.get("features", []) if expected else [],
                "scores": [
                    {
                        "dialog_id": score["dialog_id"],
                        "dialog_name": score["dialog_name"],
                        "score": round(float(score["score"]) * 100, 2),
                        "features": score.get("features", []),
                    }
                    for score in scores[:max_intent_results]
                ],
                "reason": reason,
                "recommendation": recommendation,
            }
        )

    status_counts = Counter(item["status"] for item in items)
    diagnosis_counts = Counter(item["diagnosis_type"] for item in items)
    return {
        "settings": {
            "score_cutoff": score_cutoff,
            "similar_intent_score": similar_intent_score,
            "max_intent_results": max_intent_results,
        },
        "summary": {
            "total_checked": len(rows_with_type),
            "training_checked": len(training_rows),
            "validation_checked": len(validation_rows),
            "problem_count": len(items),
            "status_counts": dict(status_counts),
            "diagnosis_counts": dict(diagnosis_counts),
        },
        "items": items[:100],
    }


def _extract_intent_eval_rows(document: dict[str, Any]) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    training_rows: list[dict[str, str]] = []
    validation_rows: list[dict[str, str]] = []
    for dialog in document["dialogs"]:
        if not isinstance(dialog, dict) or not _is_intent_dialog(dialog):
            continue

        dialog_id = _safe_text(dialog.get("id"))
        dialog_name = _safe_text(dialog.get("name"))
        if not dialog_id:
            continue

        for text in _extract_utterance_texts(dialog, "T"):
            training_rows.append({"dialog_id": dialog_id, "dialog_name": dialog_name, "text": text})
        for text in _extract_utterance_texts(dialog, "V"):
            validation_rows.append({"dialog_id": dialog_id, "dialog_name": dialog_name, "text": text})

    return training_rows, validation_rows


def calculate_nlu_evaluation(
    version: BotVersion,
    trained_at: str,
    score_cutoff: float = 0.75,
    similar_intent_score: float = 0.85,
    max_intent_results: int = 3,
    version_settings: dict[str, Any] | None = None,
    language: str = "ko",
) -> dict[str, Any]:
    analyzer = create_morph_analyzer(language)
    document = normalize_version_document(version.version_json)
    token_context = build_learning_token_context(document, analyzer, version_settings=version_settings)
    canonical_map = token_context["canonical_map"]
    surface_canonical_map = token_context["surface_canonical_map"]
    ignore_terms = token_context["ignore_terms"]
    ignore_regexes = token_context["ignore_regexes"]
    training_rows, validation_rows = _extract_intent_eval_rows(document)

    fixed_model = _build_intent_eval_model(training_rows, analyzer, canonical_map, surface_canonical_map, ignore_terms, ignore_regexes)
    fixed_cuda_centroid_batch = _prepare_cuda_centroid_batch(fixed_model.get("intents") or [])
    fixed_score_cache: dict[str, list[dict[str, Any]]] = {}
    fixed_accuracy = _calculate_accuracy(
        fixed_model,
        validation_rows,
        analyzer,
        canonical_map,
        surface_canonical_map,
        ignore_terms,
        ignore_regexes,
        fixed_cuda_centroid_batch,
        fixed_score_cache,
    )
    snapshot = _build_evaluation_snapshot(
        fixed_model,
        training_rows,
        analyzer,
        canonical_map,
        surface_canonical_map,
        ignore_terms,
        ignore_regexes,
        fixed_cuda_centroid_batch,
        fixed_score_cache,
    )
    quality_diagnostics = _build_quality_diagnostics(
        fixed_model,
        training_rows,
        validation_rows,
        analyzer,
        score_cutoff,
        similar_intent_score,
        max_intent_results,
        canonical_map,
        surface_canonical_map,
        ignore_terms,
        ignore_regexes,
        fixed_cuda_centroid_batch,
        fixed_score_cache,
    )

    all_rows = [*training_rows, *validation_rows]
    rng = random.Random(f"{version.id}:{trained_at}")
    rows_by_dialog: defaultdict[str, list[dict[str, str]]] = defaultdict(list)
    for row in all_rows:
        rows_by_dialog[row["dialog_id"]].append(row)

    random_train_rows: list[dict[str, str]] = []
    random_test_rows: list[dict[str, str]] = []
    for rows in rows_by_dialog.values():
        shuffled = rows[:]
        rng.shuffle(shuffled)
        if len(shuffled) <= 1:
            random_train_rows.extend(shuffled)
            continue
        test_count = max(1, round(len(shuffled) * 0.1))
        random_test_rows.extend(shuffled[:test_count])
        random_train_rows.extend(shuffled[test_count:])

    random_model = _build_intent_eval_model(random_train_rows, analyzer, canonical_map, surface_canonical_map, ignore_terms, ignore_regexes)
    random_cuda_centroid_batch = _prepare_cuda_centroid_batch(random_model.get("intents") or [])
    random_accuracy = _calculate_accuracy(
        random_model,
        random_test_rows,
        analyzer,
        canonical_map,
        surface_canonical_map,
        ignore_terms,
        ignore_regexes,
        random_cuda_centroid_batch,
    )
    gap = (
        abs(random_accuracy - fixed_accuracy)
        if random_accuracy is not None and fixed_accuracy is not None
        else None
    )

    return {
        "trained_at": trained_at,
        "evaluation_execution_device": _ml_evaluation_execution_device(),
        "random_accuracy": random_accuracy,
        "fixed_accuracy": fixed_accuracy,
        "gap": gap,
        "intent_count": len({row["dialog_id"] for row in all_rows if row["dialog_id"]}),
        "training_utterance_count": len(training_rows),
        "validation_utterance_count": len(validation_rows),
        "random_train_count": len(random_train_rows),
        "random_test_count": len(random_test_rows),
        "snapshot": snapshot,
        "quality_diagnostics": quality_diagnostics,
    }


def _model_dir(bot_id: UUID, version_id: UUID) -> Path:
    return settings.nlu_model_storage_dir / str(bot_id) / str(version_id)


def _model_path(bot_id: UUID, version_id: UUID) -> Path:
    return _model_dir(bot_id, version_id) / "deep_learning_lite.json"


def _write_model_atomic(model_path: Path, model: dict[str, Any]) -> None:
    model_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path: Path | None = None
    try:
        with NamedTemporaryFile(
            "w",
            encoding="utf-8",
            dir=model_path.parent,
            prefix=f".{model_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temp_file:
            temp_path = Path(temp_file.name)
            temp_file.write(json.dumps(model, ensure_ascii=False, indent=2))
            temp_file.flush()
            os.fsync(temp_file.fileno())
        temp_path.replace(model_path)
    except Exception:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
        raise


def _apply_imbalance_oversampling(training_documents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    documents_by_dialog: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    for document in training_documents:
        dialog_id = str(document.get("dialog_id") or "")
        if dialog_id:
            documents_by_dialog[dialog_id].append(document)

    if len(documents_by_dialog) < 2:
        return training_documents

    max_count = max(len(items) for items in documents_by_dialog.values())
    if max_count <= 1:
        return training_documents

    oversampled = list(training_documents)
    for dialog_id, items in documents_by_dialog.items():
        if not items:
            continue
        missing_count = max_count - len(items)
        for index in range(missing_count):
            source = items[index % len(items)]
            clone = dict(source)
            clone["oversampled"] = True
            clone["oversample_source_index"] = index % len(items)
            oversampled.append(clone)
    return oversampled


def build_deep_learning_lite_model(
    version: BotVersion,
    *,
    imbalance_oversampling: bool = False,
    version_settings: dict[str, Any] | None = None,
    language: str = "ko",
) -> dict[str, Any]:
    analyzer = create_morph_analyzer(language)
    document = normalize_version_document(version.version_json)
    token_context = build_learning_token_context(document, analyzer, version_settings=version_settings)
    canonical_map = token_context["canonical_map"]
    surface_canonical_map = token_context["surface_canonical_map"]
    ignore_terms = token_context["ignore_terms"]
    ignore_regexes = token_context["ignore_regexes"]

    training_documents: list[dict[str, Any]] = []
    for dialog in document["dialogs"]:
        if not isinstance(dialog, dict) or not _is_intent_dialog(dialog):
            continue
        dialog_id = _safe_text(dialog.get("id"))
        dialog_name = _safe_text(dialog.get("name"))
        utterance_texts = _extract_utterance_texts(dialog, "T")
        if not utterance_texts:
            utterance_texts = _extract_utterance_texts(dialog)
        for utterance in utterance_texts:
            tokens = _tokenize_for_learning(utterance, analyzer, canonical_map, surface_canonical_map, ignore_terms, ignore_regexes)
            if not tokens:
                continue
            training_documents.append(
                {
                    "kind": "intent_utterance",
                    "dialog_id": dialog_id,
                    "dialog_name": dialog_name,
                    "text": utterance,
                    "tokens": tokens,
                    "tf": _tf(tokens),
                }
            )

    original_training_document_count = len(training_documents)
    if imbalance_oversampling:
        training_documents = _apply_imbalance_oversampling(training_documents)

    entity_documents: list[dict[str, Any]] = []
    for entity in document["entities"]:
        if not isinstance(entity, dict):
            continue
        entity_id = _safe_text(entity.get("id"))
        entity_name = _safe_text(entity.get("name"))
        for value in _extract_entity_values(entity):
            tokens = _tokenize_for_learning(value, analyzer, canonical_map, surface_canonical_map, ignore_terms, ignore_regexes)
            if not tokens:
                continue
            entity_documents.append(
                {
                    "kind": "entity_value",
                    "entity_id": entity_id,
                    "entity_name": entity_name,
                    "text": value,
                    "tokens": tokens,
                    "tf": _tf(tokens),
                }
            )

    all_documents = [*training_documents, *entity_documents]
    idf = _idf_by_group(all_documents, "dialog_id") if all_documents else {}

    for item in training_documents:
        vector = _vectorize(item["tf"], idf)
        item["vector"] = vector

    entity_vectors: list[dict[str, Any]] = []
    for item in entity_documents:
        entity_vectors.append(
            {
                "entity_id": item["entity_id"],
                "entity_name": item["entity_name"],
                "text": item["text"],
                "tokens": item["tokens"],
                "vector": _vectorize(item["tf"], idf),
            }
        )

    dialogs_by_id = {
        _safe_text(dialog.get("id")): dialog
        for dialog in document["dialogs"]
        if isinstance(dialog, dict) and _is_intent_dialog(dialog)
    }
    intent_models = _build_internal_intent_models(training_documents, dialogs_by_id)
    external_intent_ids = {item["dialog_id"] for item in training_documents if item["dialog_id"]}

    return {
        "schema_version": 1,
        "engine_type": "ml",
        "model": "deep_learning_lite",
        "morph_analyzer": analyzer.provider_name,
        "language": language,
        "bot_id": str(version.bot_id),
        "version_id": str(version.id),
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "counts": {
            "intent_documents": len(training_documents),
            "original_intent_documents": original_training_document_count,
            "oversampled_intent_documents": max(0, len(training_documents) - original_training_document_count),
            "entity_documents": len(entity_documents),
            "intents": len(external_intent_ids),
            "internal_intents": len(intent_models),
            "entities": len({item["entity_id"] for item in entity_documents if item["entity_id"]}),
            "vocabulary": len(idf),
        },
        "training_options": {
            "imbalance_oversampling": bool(imbalance_oversampling),
            "internal_cluster_min_similarity": INTERNAL_CLUSTER_MIN_SIMILARITY,
            "idf_scope": "intent",
            "ignore_terms": ignore_terms,
            "ignore_regexes": ignore_regexes,
        },
        "vocabulary": idf,
        "intents": intent_models,
        "entities": entity_vectors,
    }


def train_and_save_deep_learning_lite_model(
    version: BotVersion,
    *,
    imbalance_oversampling: bool = False,
    version_settings: dict[str, Any] | None = None,
    language: str = "ko",
) -> dict[str, Any]:
    model = build_deep_learning_lite_model(
        version,
        imbalance_oversampling=imbalance_oversampling,
        version_settings=version_settings,
        language=language,
    )
    model_path = _model_path(version.bot_id, version.id)
    _write_model_atomic(model_path, model)
    return {
        "model_path": str(model_path),
        "model": {
            key: model[key]
            for key in ["schema_version", "engine_type", "model", "morph_analyzer", "language", "bot_id", "version_id", "trained_at", "counts"]
        },
    }



def score_deep_learning_lite_model(
    version: BotVersion,
    text: str,
    *,
    version_settings: dict[str, Any] | None = None,
    language: str | None = None,
) -> list[dict[str, Any]]:
    """Score a runtime message with the model saved by the latest successful training."""
    model_path = _model_path(version.bot_id, version.id)
    if not model_path.exists():
        return []

    try:
        saved_model = json.loads(model_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []

    if saved_model.get("model") != "deep_learning_lite":
        return []

    intents = saved_model.get("intents")
    vocabulary = saved_model.get("vocabulary")
    if not isinstance(intents, list) or not isinstance(vocabulary, dict):
        return []

    resolved_language = str(language or saved_model.get("language") or "ko")
    analyzer = create_morph_analyzer(resolved_language)
    document = normalize_version_document(version.version_json)
    token_context = build_learning_token_context(document, analyzer, version_settings=version_settings)
    canonical_map = token_context["canonical_map"]
    surface_canonical_map = token_context["surface_canonical_map"]
    ignore_terms = token_context["ignore_terms"]
    ignore_regexes = token_context["ignore_regexes"]

    documents: list[dict[str, Any]] = []
    seen_documents: set[tuple[str, str]] = set()
    for intent in intents:
        if not isinstance(intent, dict):
            continue
        dialog_id = _safe_text(intent.get("dialog_id"))
        dialog_name = _safe_text(intent.get("dialog_name"))
        for document_text in intent.get("document_texts") or []:
            normalized_text = _safe_text(document_text)
            key = (dialog_id, normalized_text)
            if not dialog_id or not normalized_text or key in seen_documents:
                continue
            tokens = _tokenize_for_learning(
                normalized_text,
                analyzer,
                canonical_map,
                surface_canonical_map,
                ignore_terms,
                ignore_regexes,
            )
            if not tokens:
                continue
            seen_documents.add(key)
            documents.append(
                {
                    "dialog_id": dialog_id,
                    "dialog_name": dialog_name,
                    "text": normalized_text,
                    "tokens": tokens,
                    "tf": _tf(tokens),
                }
            )

    if not documents:
        return []

    runtime_model = {"idf": vocabulary, "documents": documents, "intents": intents}
    return _score_eval_model(
        runtime_model,
        text,
        analyzer,
        canonical_map,
        surface_canonical_map,
        ignore_terms,
        ignore_regexes,
    )


def classify_deep_learning_lite_model(
    version: BotVersion,
    text: str,
    *,
    version_settings: dict[str, Any] | None = None,
    language: str | None = None,
) -> dict[str, Any] | None:
    scores = score_deep_learning_lite_model(version, text, version_settings=version_settings, language=language)
    return scores[0] if scores else None

def get_deep_learning_lite_model_manifest(bot_id: UUID, version_id: UUID) -> dict[str, Any]:
    model_path = _model_path(bot_id, version_id)
    if not model_path.exists():
        return {"exists": False, "model_path": str(model_path), "model": None}

    data = json.loads(model_path.read_text(encoding="utf-8"))
    return {
        "exists": True,
        "model_path": str(model_path),
        "model": {
            key: data.get(key)
            for key in ["schema_version", "engine_type", "model", "morph_analyzer", "language", "bot_id", "version_id", "trained_at", "counts"]
        },
    }
