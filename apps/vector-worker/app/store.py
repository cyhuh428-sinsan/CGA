from __future__ import annotations

import json
import math
import os
import re
import sys
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter
from typing import Any

from app.embeddings import EmbeddingModel
from app.schemas import AnswerMatch, ConfigureTerm, IntentConfigureGroup, IntentDocument, IntentMatch, KnowledgeDocument


class EmbeddingIndexMismatchError(RuntimeError):
    """Raised when a persisted vector index does not match the active embedding engine."""


_GPU_ACCELERATION_RUNTIME: dict[str, Any] = {
    "execution_count": 0,
    "last_execution_at": None,
    "last_operation": None,
}


def _record_gpu_execution(operation: str) -> None:
    _GPU_ACCELERATION_RUNTIME["execution_count"] = int(_GPU_ACCELERATION_RUNTIME["execution_count"]) + 1
    _GPU_ACCELERATION_RUNTIME["last_execution_at"] = datetime.now(timezone.utc).isoformat()
    _GPU_ACCELERATION_RUNTIME["last_operation"] = operation


def acceleration_status() -> dict[str, Any]:
    """Return worker-process CUDA availability and actual batch execution telemetry."""
    configured = os.getenv("AIDOT_VECTOR_ACCELERATOR", os.getenv("AIDOT_EMBEDDING_DEVICE", "auto")).strip().lower()
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

def _safe_name(value: str) -> str:
    safe = re.sub(r"[^0-9a-zA-Z가-힣_.-]+", "_", value.strip())
    return safe or "default"


def _elapsed_ms(started_at: float) -> float:
    return round((perf_counter() - started_at) * 1000, 3)


def _normalize_text(value: str) -> str:
    text = str(value or "").replace("_", " ")
    return re.sub(r"\s+", " ", text.strip().lower())


def _compact_text(value: str) -> str:
    return re.sub(r"[^0-9a-zA-Z가-힣_]+", "", _normalize_text(value))


def _text_tokens(value: str) -> list[str]:
    return re.findall(r"[0-9a-zA-Z가-힣_]+", _normalize_text(value))


def _configure_features(
    value: str,
    domain_terms: set[str] | None = None,
    candidate_domain_terms: set[str] | None = None,
) -> Counter[str]:
    compact = _compact_text(value)
    tokens = _text_tokens(value)
    domain_values = domain_terms or set()
    candidate_domain_values = candidate_domain_terms or set()
    features: Counter[str] = Counter()
    for token in tokens:
        if len(token) >= 2:
            features[f"tok:{token}"] += 2.0
        if len(token) >= 3:
            features[f"head:{token[:2]}"] += 0.35
            features[f"tail:{token[-2:]}"] += 0.35
    for size, weight in [(2, 0.85), (3, 1.0), (4, 0.45)]:
        if len(compact) < size:
            continue
        for index in range(0, len(compact) - size + 1):
            features[f"ng{size}:{compact[index:index + size]}"] += weight
    for axis in _question_axes(value):
        features[f"q:{axis}"] += 7.0
    for axis in _action_axes(value):
        features[f"a:{axis}"] += 12.0
    for term in _domain_hits(value, domain_values):
        features[f"domain:{term}"] += 10.0
    for term in _domain_hits(value, candidate_domain_values):
        features[f"candidate_domain:{term}"] += 4.0
    return features


def _build_configure_vectors(
    values: list[str],
    domain_terms: set[str] | None = None,
    candidate_domain_terms: set[str] | None = None,
) -> list[dict[str, float]]:
    raw_vectors = [_configure_features(value, domain_terms, candidate_domain_terms) for value in values]
    document_frequency: Counter[str] = Counter()
    for vector in raw_vectors:
        document_frequency.update(vector.keys())
    total = max(1, len(raw_vectors))
    vectors: list[dict[str, float]] = []
    for vector in raw_vectors:
        weighted: dict[str, float] = {}
        for key, count in vector.items():
            idf = math.log((total + 1) / (document_frequency[key] + 1)) + 1.0
            weighted[key] = float(count) * idf
        vectors.append(weighted)
    return vectors


def _sparse_cosine(left: dict[str, float], right: dict[str, float]) -> float:
    if not left or not right:
        return 0.0
    if len(left) > len(right):
        left, right = right, left
    dot = sum(value * right.get(key, 0.0) for key, value in left.items())
    left_norm = math.sqrt(sum(value * value for value in left.values()))
    right_norm = math.sqrt(sum(value * value for value in right.values()))
    if left_norm <= 0 or right_norm <= 0:
        return 0.0
    return max(0.0, min(1.0, dot / (left_norm * right_norm)))


def _text_match_score(query: str, candidate: str) -> float:
    normalized_query = _normalize_text(query)
    normalized_candidate = _normalize_text(candidate)
    compact_query = _compact_text(query)
    compact_candidate = _compact_text(candidate)
    if not normalized_query or not normalized_candidate:
        return 0.0
    if normalized_query == normalized_candidate or compact_query == compact_candidate:
        return 1.0
    if compact_query and compact_candidate and (compact_query in compact_candidate or compact_candidate in compact_query):
        shorter = min(len(compact_query), len(compact_candidate))
        longer = max(len(compact_query), len(compact_candidate))
        coverage = shorter / longer if longer > 0 else 0.0
        if coverage >= 0.82:
            return 0.92
        return min(0.62, 0.38 + coverage * 0.32)

    query_tokens = set(re.findall(r"[0-9a-zA-Z가-힣_]+", normalized_query))
    candidate_tokens = set(re.findall(r"[0-9a-zA-Z가-힣_]+", normalized_candidate))
    if not query_tokens or not candidate_tokens:
        return 0.0
    overlap = len(query_tokens & candidate_tokens)
    if overlap > 0:
        return min(0.88, overlap / max(len(query_tokens), len(candidate_tokens)))
    return _compact_ngram_score(compact_query, compact_candidate)


def _compact_ngram_score(left: str, right: str) -> float:
    if len(left) < 4 or len(right) < 4:
        return 0.0
    left_grams = {left[index : index + 2] for index in range(len(left) - 1)}
    right_grams = {right[index : index + 2] for index in range(len(right) - 1)}
    if not left_grams or not right_grams:
        return 0.0
    overlap = len(left_grams & right_grams)
    if overlap <= 0:
        return 0.0
    return min(0.32, (overlap / max(len(left_grams), len(right_grams))) * 0.82)


def _weighted_overlap_ratio(
    query_tokens: set[str],
    candidate_tokens: set[str],
    token_weights: dict[str, float] | None = None,
) -> float:
    if not query_tokens or not candidate_tokens:
        return 0.0
    weights = token_weights or {}
    overlap_tokens = query_tokens & candidate_tokens
    if not overlap_tokens:
        return 0.0
    query_weight = sum(weights.get(token, 1.0) for token in query_tokens)
    candidate_weight = sum(weights.get(token, 1.0) for token in candidate_tokens)
    overlap_weight = sum(weights.get(token, 1.0) for token in overlap_tokens)
    denominator = max(query_weight, candidate_weight)
    if denominator <= 0:
        return 0.0
    return overlap_weight / denominator


def _intent_name_match_score(query: str, candidate: str, token_weights: dict[str, float] | None = None) -> float:
    normalized_query = _normalize_text(query)
    normalized_candidate = _normalize_text(candidate)
    compact_query = _compact_text(query)
    compact_candidate = _compact_text(candidate)
    if not normalized_query or not normalized_candidate:
        return 0.0
    if normalized_query == normalized_candidate or compact_query == compact_candidate:
        return 1.0
    if compact_query and compact_candidate and (compact_query in compact_candidate or compact_candidate in compact_query):
        if len(compact_query) >= 4 and len(compact_candidate) >= 4:
            return 0.96
        return 0.72

    query_tokens = set(_text_tokens(normalized_query))
    candidate_tokens = set(_text_tokens(normalized_candidate))
    if not query_tokens or not candidate_tokens:
        return 0.0
    overlap = len(query_tokens & candidate_tokens)
    if overlap <= 0:
        return 0.0
    query_token_list = _text_tokens(normalized_query)
    candidate_token_list = _text_tokens(normalized_candidate)
    if (
        len(query_token_list) >= 2
        and len(candidate_token_list) >= 2
        and query_token_list[:2] == candidate_token_list[:2]
    ):
        return 0.9
    ratio = _weighted_overlap_ratio(query_tokens, candidate_tokens, token_weights)
    if query_tokens <= candidate_tokens and overlap >= 2:
        return max(0.88, min(0.94, ratio))
    if overlap >= 2:
        return min(0.72, ratio)
    return min(0.18, ratio)


def _intent_name_token_weights(records: list[Any]) -> dict[str, float]:
    tokens_by_intent: dict[str, set[str]] = defaultdict(set)
    for record in records:
        metadata = getattr(record, "metadata", {})
        if not isinstance(metadata, dict):
            continue
        intent_id = str(metadata.get("intentId") or "")
        intent_name = str(metadata.get("intentName") or "")
        if not intent_id or not intent_name:
            continue
        tokens_by_intent[intent_id].update(_text_tokens(intent_name))
    if not tokens_by_intent:
        return {}
    document_frequency: Counter[str] = Counter()
    for tokens in tokens_by_intent.values():
        document_frequency.update(tokens)
    total = max(1, len(tokens_by_intent))
    max_idf = math.log((total + 1) / 2) + 1.0 if total > 1 else 1.0
    weights: dict[str, float] = {}
    for token, count in document_frequency.items():
        idf = math.log((total + 1) / (count + 1)) + 1.0
        weights[token] = max(0.2, min(1.0, idf / max_idf))
    return weights


def _record_vector_score(
    query_vector: list[float],
    record_vector: list[float],
    metadata: dict[str, Any],
    text: str | None = None,
) -> float:
    return _record_vector_score_from_cosine(_cosine(query_vector, record_vector), metadata, text)


def _record_vector_score_from_cosine(score: float, metadata: dict[str, Any], text: str | None = None) -> float:
    source = _record_source(metadata, text)
    if source in {"intentName", "intentNameSynonym"}:
        return min(0.08, score * 0.35)
    return score


def _record_source(metadata: dict[str, Any], text: str | None = None) -> str:
    source = str(metadata.get("source") or "").strip()
    if source:
        return source
    intent_name = str(metadata.get("intentName") or "").strip()
    if text is not None:
        if intent_name and _is_exact_text_match(text, intent_name):
            return "intentName"
        return "utterance"
    if metadata.get("utteranceIndex") is None and intent_name:
        return "intentName"
    return "utterance"


def _is_exact_text_match(query: str, candidate: str) -> bool:
    normalized_query = _normalize_text(query)
    normalized_candidate = _normalize_text(candidate)
    return bool(normalized_query) and (
        normalized_query == normalized_candidate or _compact_text(query) == _compact_text(candidate)
    )


def _record_text_match_score(
    query: str,
    text: str,
    metadata: dict[str, Any],
    token_weights: dict[str, float] | None = None,
) -> float:
    source = _record_source(metadata, text)
    if source in {"intentName", "intentNameSynonym"}:
        score = _intent_name_match_score(query, text, token_weights)
        if _is_exact_text_match(query, text):
            return score
        if score >= 0.95:
            return 0.9
        if score >= 0.88:
            return 0.84
        return min(0.28, score)
    return _text_match_score(query, text)


def _record_intent_name_match_score(
    query: str,
    metadata: dict[str, Any],
    text: str | None = None,
    token_weights: dict[str, float] | None = None,
) -> float:
    source = _record_source(metadata, text)
    intent_name = str(metadata.get("intentName") or "")
    if source in {"intentName", "intentNameSynonym"}:
        score = _intent_name_match_score(query, intent_name, token_weights)
        if _is_exact_text_match(query, intent_name):
            return score
        if score >= 0.95:
            return 0.9
        if score >= 0.88:
            return 0.84
        return min(0.28, score)
    return min(0.22, _intent_name_match_score(query, intent_name, token_weights))


def _cosine(left: list[float], right: list[float]) -> float:
    if not left or not right:
        return 0.0
    size = min(len(left), len(right))
    dot = sum(left[index] * right[index] for index in range(size))
    left_norm = math.sqrt(sum(value * value for value in left[:size]))
    right_norm = math.sqrt(sum(value * value for value in right[:size]))
    if left_norm <= 0 or right_norm <= 0:
        return 0.0
    return max(0.0, min(1.0, dot / (left_norm * right_norm)))


def _gpu_batch_cosine(query: list[float], vectors: list[list[float]]) -> list[float] | None:
    """Use CUDA for large equal-width vector batches; otherwise retain CPU scoring."""
    if len(vectors) < 32 or not query or any(len(vector) != len(query) for vector in vectors):
        return None
    if os.getenv("AIDOT_VECTOR_ACCELERATOR", os.getenv("AIDOT_EMBEDDING_DEVICE", "auto")).strip().lower() == "cpu":
        return None
    try:
        import torch
    except Exception:
        return None
    if not torch.cuda.is_available():
        return None
    try:
        query_tensor = torch.tensor(query, dtype=torch.float64, device="cuda")
        matrix = torch.tensor(vectors, dtype=torch.float64, device="cuda")
        denominator = torch.linalg.vector_norm(matrix, dim=1) * torch.linalg.vector_norm(query_tensor)
        scores = torch.where(denominator > 0, torch.matmul(matrix, query_tensor) / denominator, torch.zeros_like(denominator))
        result = [max(0.0, min(1.0, float(score))) for score in scores.cpu().tolist()]
        _record_gpu_execution("batch_cosine")
        return result
    except Exception:
        return None


def _term_values(terms: list[ConfigureTerm]) -> set[str]:
    values: set[str] = set()
    for term in terms:
        for value in [term.name, *term.values]:
            normalized = _normalize_text(value)
            compact = _compact_text(value)
            if normalized:
                values.add(normalized)
            if compact:
                values.add(compact)
    return values


def _dictionary_synonym_replacements(terms: list[ConfigureTerm]) -> list[tuple[str, str]]:
    replacements: dict[str, str] = {}
    for term in terms:
        canonical = _normalize_text(term.name)
        if not canonical:
            continue
        for value in term.values:
            synonym = _normalize_text(value)
            if not synonym or synonym == canonical:
                continue
            replacements.setdefault(synonym, canonical)
    return sorted(replacements.items(), key=lambda item: len(item[0]), reverse=True)


def _apply_dictionary_synonyms(value: str, replacements: list[tuple[str, str]]) -> str:
    normalized = _normalize_text(value)
    if not normalized or not replacements:
        return normalized
    converted = normalized
    for synonym, canonical in replacements:
        converted = converted.replace(synonym, canonical)
    return _normalize_text(converted)


def _semantic_text_candidates(value: str, replacements: list[tuple[str, str]]) -> list[str]:
    normalized = _normalize_text(value)
    converted = _apply_dictionary_synonyms(normalized, replacements)
    if converted and converted != normalized:
        return [normalized, converted]
    return [normalized] if normalized else []


def _domain_term_values(terms: list[ConfigureTerm]) -> set[str]:
    values: set[str] = set()
    for term in terms:
        if not term.domain_enabled:
            continue
        compact = _compact_text(term.name)
        if len(compact) >= 2:
            values.add(compact)
    return values


def _candidate_domain_term_values(terms: list[ConfigureTerm]) -> set[str]:
    values: set[str] = set()
    for term in terms:
        if term.domain_enabled or not term.domain_candidate:
            continue
        compact = _compact_text(term.name)
        if len(compact) >= 2:
            values.add(compact)
    return values


def _domain_hits(value: str, domain_terms: set[str]) -> set[str]:
    compact = _compact_text(value)
    if not compact or not domain_terms:
        return set()
    return {term for term in domain_terms if term in compact}


def _linguistic_signatures(
    value: str,
    domain_terms: set[str],
    candidate_domain_terms: set[str],
) -> set[str]:
    signatures = {f"domain:{term}" for term in _domain_hits(value, domain_terms)}
    signatures.update(f"candidate_domain:{term}" for term in _domain_hits(value, candidate_domain_terms))
    signatures.update(f"a:{axis}" for axis in _action_axes(value))
    signatures.update(f"q:{axis}" for axis in _question_axes(value))
    return signatures


def _term_boost(left: str, right: str, terms: set[str], weight: float) -> float:
    if not terms:
        return 0.0
    left_normalized = _normalize_text(left)
    right_normalized = _normalize_text(right)
    left_compact = _compact_text(left)
    right_compact = _compact_text(right)
    for term in terms:
        if (term in left_normalized or term in left_compact) and (term in right_normalized or term in right_compact):
            return max(0.0, weight)
    return 0.0


def _has_any(compact: str, terms: tuple[str, ...]) -> bool:
    return any(_compact_text(term) in compact for term in terms)


def _question_axes(value: str) -> set[str]:
    compact = _compact_text(value)
    axes: set[str] = set()
    if not compact:
        return axes

    if _has_any(compact, ("왜", "이유", "원인", "목적", "까닭", "때문", "뭐 때문에", "뭐때문", "무엇때문", "무슨 일", "무슨일", "어떤 일", "어떤일", "무슨 용건", "무슨용건")):
        axes.add("why")
    if _has_any(compact, ("누구", "누가", "전화한 분", "전화한분", "발신자")):
        axes.add("who")
    if _has_any(compact, ("어디서", "어디에", "어디", "어느 곳", "어느곳")):
        axes.add("where")
    if _has_any(compact, ("언제", "몇 시", "몇시", "몇 분", "몇분", "얼마나", "얼마", "소요", "걸리", "오래", "시간")):
        axes.add("when")
    if _has_any(compact, ("무슨 말", "무슨말", "무슨 뜻", "무슨뜻", "뜻", "용어", "고지의무", "전자서명", "우량체", "담보")):
        axes.add("what_meaning")
    elif not axes and _has_any(compact, ("무엇", "뭐", "무슨")):
        axes.add("what")
    if _has_any(compact, ("어떻게", "어찌", "방법", "절차", "방식", "수단", "어떤 방식", "어떤방식", "어떡", "어케")):
        axes.add("how")
    return axes


def _action_axes(value: str) -> set[str]:
    compact = _compact_text(value)
    axes: set[str] = set()
    if not compact:
        return axes

    has_contact = _has_any(compact, ("전화", "통화", "연락", "콜"))
    if _has_any(compact, ("상담사", "상담원", "직원", "담당자", "사람")) and _has_any(compact, ("연결", "전환", "바꿔", "바꾸", "통화", "요청", "불러", "넘겨", "할래")):
        axes.add("transfer")
    if _has_any(compact, ("해지", "취소", "철회", "탈퇴", "해약", "끊")):
        axes.add("cancel")
    if (has_contact and _has_any(compact, ("하지마", "말라", "말고", "그만", "거부", "못", "불가", "안한다", "안할"))) or _has_any(compact, ("바쁩", "바쁜", "귀찮", "싫", "안해", "안함", "필요없", "짜증")):
        axes.add("refuse")
    if has_contact and _has_any(compact, ("나중", "다음", "이후", "뒤", "오후", "오전", "내일", "모레", "몇시", "십분", "분뒤", "시간", "다섯시", "신분", "가능")):
        axes.add("callback")
    if _has_any(compact, ("보험", "암보험", "생명", "보험사", "피보험자", "디비", "db")) and _has_any(compact, ("뭐", "무엇", "무슨", "어디", "왜", "인가", "알려", "설명", "문의", "궁금", "없", "넣", "가입", "관리", "모르", "뜻", "내용")):
        axes.add("insurance")
    if _has_any(compact, ("가입", "계약", "보험", "디비", "db")) and _has_any(
        compact,
        ("가입했", "가입한", "가입안", "안했", "없", "없는데", "무동의", "모르", "했다고", "했다", "있나요", "있는지"),
    ):
        axes.add("enrollment_status")
    if _has_any(compact, ("가입", "신청", "계약", "등록", "개통")) and "cancel" not in axes:
        axes.add("apply")
    if has_contact and not (axes & {"transfer", "refuse", "callback"}):
        axes.add("call")
    if _has_any(compact, ("시간", "얼마나", "걸리", "느려", "빠르", "소요", "나중", "이후", "내일")):
        axes.add("time")
    if _has_any(compact, ("증명", "서류", "인증", "확인", "신분", "서명", "고지", "의무")):
        axes.add("identity")
    if _has_any(compact, ("설명", "안내", "알려", "문의", "궁금", "뭐", "무슨", "내용", "뜻")):
        axes.add("explain")
    return axes


def _contact_direction_axes(value: str) -> set[str]:
    compact = _compact_text(value)
    if not compact or not _has_any(compact, ("전화", "통화", "연락", "콜")):
        return set()

    axes: set[str] = set()
    has_self_subject = _has_any(compact, ("내가", "제가", "나는", "저는", "직접"))
    has_self_contact_clause = _has_any(compact, ("전화해서", "통화해서", "연락해서", "전화걸어서", "연락드려서"))
    if has_self_subject and _has_any(
        compact,
        ("전화할게", "전화하겠습니다", "전화드릴게", "연락할게", "연락드릴게", "통화할게", "할게", "하겠습니다"),
    ):
        axes.add("self_contact")
    if has_self_contact_clause and _has_any(compact, ("해도되", "되죠", "될까", "진행", "할게", "하겠습니다", "해볼")):
        axes.add("self_contact")
    if (
        _has_any(
            compact,
            (
                "전화해줘",
                "전화해주세요",
                "전화줘",
                "전화주세요",
                "연락해줘",
                "연락주세요",
                "연락주시",
                "전화주시",
                "통화해줘",
                "통화해주세요",
                "콜백",
            ),
        )
        or compact.endswith(("전화해", "전화해요", "연락해", "연락해요", "통화해", "통화해요"))
    ):
        axes.add("request_contact")
    if _has_any(compact, ("전화하지마", "전화하지말", "연락하지마", "통화거절", "통화거부", "전화그만", "다시는전화")):
        axes.add("reject_contact")
    return axes


def _has_contact_direction_conflict(left: str, right: str) -> bool:
    left_axes = _contact_direction_axes(left)
    right_axes = _contact_direction_axes(right)
    return bool(left_axes and right_axes and left_axes.isdisjoint(right_axes))


def _is_short_semantic_pair(left: str, right: str) -> bool:
    return any(
        len(_compact_text(value)) <= 5 or len(_text_tokens(value)) <= 1
        for value in (left, right)
    )


def _semantic_guard_score(
    left: str,
    right: str,
    domain_terms: set[str],
    candidate_domain_terms: set[str],
) -> float:
    left_compact = _compact_text(left)
    right_compact = _compact_text(right)
    if not left_compact or not right_compact:
        return 0.0

    left_domains = _domain_hits(left, domain_terms)
    right_domains = _domain_hits(right, domain_terms)
    left_candidates = _domain_hits(left, candidate_domain_terms)
    right_candidates = _domain_hits(right, candidate_domain_terms)
    left_axes = _question_axes(left)
    right_axes = _question_axes(right)
    left_actions = _action_axes(left)
    right_actions = _action_axes(right)
    left_contact_directions = _contact_direction_axes(left)
    right_contact_directions = _contact_direction_axes(right)
    score = 0.0

    if left_contact_directions and right_contact_directions:
        score += 0.22 if left_contact_directions & right_contact_directions else -0.55
    if left_domains and right_domains:
        score += 0.28 if left_domains & right_domains else -0.6
    elif left_domains or right_domains:
        score -= 0.08
    if left_actions and right_actions:
        shared_actions = left_actions & right_actions
        if shared_actions:
            score += 0.24
            strict_difference = (left_actions ^ right_actions) & {
                "cancel",
                "transfer",
                "enrollment_status",
                "callback",
                "refuse",
            }
            if strict_difference and not (shared_actions & {"cancel", "transfer", "enrollment_status", "callback", "refuse"}):
                score -= 0.18
        else:
            score -= 0.6
    elif left_actions or right_actions:
        score -= 0.08
    if left_axes and right_axes:
        score += 0.18 if left_axes & right_axes else -0.5
    elif left_axes or right_axes:
        score -= 0.05
    if left_candidates and right_candidates:
        score += 0.08 if left_candidates & right_candidates else -0.1
    elif left_candidates or right_candidates:
        score -= 0.02
    return max(-0.9, min(0.5, score))


def _pair_similarity(
    left: tuple[str, list[float], str, list[float]],
    right: tuple[str, list[float], str, list[float]],
    *,
    configure_score: float,
    dictionary_terms: set[str],
    entity_terms: set[str],
    domain_terms: set[str],
    candidate_domain_terms: set[str],
    scoring: dict[str, float],
    hash_embedding: bool,
) -> float:
    left_text, left_vector, left_synonym_text, left_synonym_vector = left
    right_text, right_vector, right_synonym_text, right_synonym_vector = right
    vector_score = max(
        _cosine(left_vector, right_vector),
        _cosine(left_synonym_vector, right_synonym_vector),
    )
    text_score = max(
        _text_match_score(left_text, right_text),
        _text_match_score(left_synonym_text, right_synonym_text),
    )
    dictionary_boost = max(
        _term_boost(left_text, right_text, dictionary_terms, float(scoring.get("dictionaryWeight", 1)) * 0.035),
        _term_boost(left_synonym_text, right_synonym_text, dictionary_terms, float(scoring.get("dictionaryWeight", 1)) * 0.035),
    )
    semantic_guard = max(
        _semantic_guard_score(left_text, right_text, domain_terms, candidate_domain_terms),
        _semantic_guard_score(left_synonym_text, right_synonym_text, domain_terms, candidate_domain_terms),
    )
    if hash_embedding:
        base_score = max(configure_score, text_score * 0.96)
    else:
        blended_score = vector_score * 0.82 + configure_score * 0.18
        base_score = max(blended_score, vector_score, text_score * 0.96)
    score = base_score + dictionary_boost + semantic_guard
    return max(0.0, min(1.0, score))


def _cluster_merge_score(left: list[int], right: list[int], matrix: list[list[float]]) -> float:
    scores = [matrix[left_index][right_index] for left_index in left for right_index in right]
    if not scores:
        return 0.0
    return (sum(scores) / len(scores)) * 0.75 + min(scores) * 0.25


def _cluster_signatures(indexes: list[int], signature_sets: list[set[str]]) -> set[str]:
    signatures: set[str] = set()
    for index in indexes:
        signatures.update(signature_sets[index])
    return signatures


def _signature_values(signatures: set[str], namespace: str) -> set[str]:
    prefix = f"{namespace}:"
    return {signature[len(prefix):] for signature in signatures if signature.startswith(prefix)}


def _has_hard_signature_conflict(left_signatures: set[str], right_signatures: set[str]) -> bool:
    for namespace in ("domain", "a", "q"):
        left_values = _signature_values(left_signatures, namespace)
        right_values = _signature_values(right_signatures, namespace)
        if left_values and right_values and not (left_values & right_values):
            return True
    return False


def _has_shared_hard_signature(left_signatures: set[str], right_signatures: set[str]) -> bool:
    return any(
        _signature_values(left_signatures, namespace) & _signature_values(right_signatures, namespace)
        for namespace in ("domain", "a", "q")
    )


def _hard_signature_key(signatures: set[str]) -> str:
    hard_signatures = sorted(
        signature for signature in signatures if signature.startswith(("domain:", "a:", "q:"))
    )
    return "|".join(hard_signatures) or "none"


def _cluster_merge_allowed(left: list[int], right: list[int], signature_sets: list[set[str]]) -> bool:
    left_signatures = _cluster_signatures(left, signature_sets)
    right_signatures = _cluster_signatures(right, signature_sets)
    if _has_hard_signature_conflict(left_signatures, right_signatures):
        return False
    if not left_signatures or not right_signatures:
        return True
    return bool(left_signatures & right_signatures) or _has_shared_hard_signature(left_signatures, right_signatures)


def _cluster_required_merge_score(
    left: list[int],
    right: list[int],
    signature_sets: list[set[str]],
    base_floor: float,
) -> float:
    left_signatures = _cluster_signatures(left, signature_sets)
    right_signatures = _cluster_signatures(right, signature_sets)
    if _has_hard_signature_conflict(left_signatures, right_signatures):
        return 1.01
    if _has_shared_hard_signature(left_signatures, right_signatures):
        return min(base_floor, 0.1)
    if left_signatures and right_signatures:
        if left_signatures & right_signatures:
            return min(base_floor, 0.18)
        return 1.01
    if left_signatures or right_signatures:
        return max(base_floor, 0.38)
    return base_floor


def _split_cluster(indexes: list[int], matrix: list[list[float]], max_size: int) -> list[list[int]]:
    ordered = sorted(indexes)
    if len(ordered) <= max_size or len(ordered) <= 1:
        return [ordered]

    seed_left = ordered[0]
    seed_right = ordered[-1]
    lowest_score = 2.0
    for left_index, left in enumerate(ordered):
        for right in ordered[left_index + 1 :]:
            score = matrix[left][right]
            if score < lowest_score:
                lowest_score = score
                seed_left = left
                seed_right = right

    left_bucket: list[int] = []
    right_bucket: list[int] = []
    for item in ordered:
        if matrix[item][seed_left] >= matrix[item][seed_right]:
            left_bucket.append(item)
        else:
            right_bucket.append(item)

    if not left_bucket or not right_bucket:
        midpoint = max(1, len(ordered) // 2)
        left_bucket = ordered[:midpoint]
        right_bucket = ordered[midpoint:]

    return [
        split
        for bucket in (left_bucket, right_bucket)
        for split in _split_cluster(bucket, matrix, max_size)
        if split
    ]


def _split_cluster_by_signatures(
    indexes: list[int],
    signature_sets: list[set[str]],
    matrix: list[list[float]],
    max_size: int,
) -> list[list[int]]:
    ordered = sorted(indexes)
    if len(ordered) <= 1:
        return [ordered]

    groups: dict[str, list[int]] = defaultdict(list)
    for index in ordered:
        groups[_hard_signature_key(signature_sets[index])].append(index)
    if len(groups) <= 1:
        return _split_cluster(ordered, matrix, max_size)
    return [
        split
        for group in groups.values()
        for split in _split_cluster(group, matrix, max_size)
        if split
    ]


def _configure_max_cluster_size(total_count: int, target_count: int, policy: str) -> int:
    average_size = total_count / max(1, target_count)
    if policy == "minimize":
        factor = 3.0
    elif policy == "exact":
        factor = 1.8
    else:
        factor = 2.0
    return max(4, math.ceil(average_size * factor))


def _rebalance_clusters(
    cluster_indexes: list[list[int]],
    matrix: list[list[float]],
    target_count: int,
    *,
    max_size: int,
    signature_sets: list[set[str]],
    min_merge_score: float | None = None,
) -> list[list[int]]:
    if not cluster_indexes or target_count <= 0:
        return cluster_indexes

    rebalanced: list[list[int]] = []
    for cluster in cluster_indexes:
        rebalanced.extend(_split_cluster_by_signatures(cluster, signature_sets, matrix, max_size))

    while len(rebalanced) > target_count:
        best_left: int | None = None
        best_right: int | None = None
        best_score = -1.0
        for left_index in range(len(rebalanced)):
            for right_index in range(left_index + 1, len(rebalanced)):
                combined_size = len(rebalanced[left_index]) + len(rebalanced[right_index])
                if combined_size > max_size:
                    continue
                if not _cluster_merge_allowed(rebalanced[left_index], rebalanced[right_index], signature_sets):
                    continue
                score = _cluster_merge_score(rebalanced[left_index], rebalanced[right_index], matrix)
                if min_merge_score is not None:
                    required_score = _cluster_required_merge_score(
                        rebalanced[left_index],
                        rebalanced[right_index],
                        signature_sets,
                        min_merge_score,
                    )
                    if score < required_score:
                        continue
                if score > best_score:
                    best_left = left_index
                    best_right = right_index
                    best_score = score
        if best_left is None or best_right is None:
            break
        if min_merge_score is not None and best_score < min_merge_score:
            break
        rebalanced[best_left] = [*rebalanced[best_left], *rebalanced[best_right]]
        rebalanced.pop(best_right)

    while len(rebalanced) < target_count:
        largest_index = max(range(len(rebalanced)), key=lambda index: len(rebalanced[index]))
        if len(rebalanced[largest_index]) <= 1:
            break
        split = _split_cluster(rebalanced[largest_index], matrix, max(1, len(rebalanced[largest_index]) // 2))
        if len(split) <= 1:
            break
        rebalanced.pop(largest_index)
        rebalanced.extend(split[:2])

    return [sorted(cluster) for cluster in rebalanced]


def _cluster_by_embedding(vectors: list[list[float]], target_count: int) -> list[list[int]] | None:
    if not vectors or target_count <= 0:
        return None
    if len(vectors) <= target_count:
        return [[index] for index in range(len(vectors))]
    if any(not vector for vector in vectors):
        return None

    try:
        from sklearn.cluster import AgglomerativeClustering
    except Exception:
        return None

    try:
        model = AgglomerativeClustering(n_clusters=target_count, metric="cosine", linkage="average")
        labels = model.fit_predict(vectors)
    except Exception:
        return None

    clusters: dict[int, list[int]] = {}
    for index, label in enumerate(labels):
        clusters.setdefault(int(label), []).append(index)
    return [sorted(indexes) for indexes in clusters.values() if indexes]


def _select_seed(indexes: list[int], utterances: list[str], matrix: list[list[float]]) -> tuple[int, str, float]:
    best_index = indexes[0] if indexes else 0
    best_score = -1.0
    for candidate in indexes:
        score = sum(matrix[candidate][other] for other in indexes) / max(1, len(indexes))
        if score > best_score:
            best_score = score
            best_index = candidate
    return best_index, utterances[best_index] if 0 <= best_index < len(utterances) else "", best_score


def _normalize_policy(value: str) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in {"minimize", "exact"}:
        return normalized
    return "near"


@dataclass
class VectorRecord:
    id: str
    text: str
    vector: list[float]
    metadata: dict[str, Any]


class JsonVectorStore:
    def __init__(
        self,
        storage_dir: Path,
        embedding_model: EmbeddingModel,
        embedding_provider: str | None = None,
    ) -> None:
        self.storage_dir = storage_dir
        self.embedding_model = embedding_model
        self.embedding_provider = str(embedding_provider or "").strip().lower()
        self.last_configure_diagnostics: dict[str, Any] = {}
        self._record_cache: dict[Path, tuple[int, int, list[VectorRecord]]] = {}
        self._metadata_cache: dict[Path, tuple[int, int, dict[str, Any]]] = {}
        self._embedding_cache: dict[tuple[str, str], list[float]] = {}
        self._intent_search_cache: dict[Any, list[IntentMatch]] = {}
        self._answer_search_cache: dict[Any, list[AnswerMatch]] = {}
        self._intent_token_weight_cache: dict[Any, dict[str, float]] = {}
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def _path(self, kind: str, bot_id: str, version_id: str, index_name: str) -> Path:
        return (
            self.storage_dir
            / _safe_name(kind)
            / _safe_name(bot_id)
            / _safe_name(version_id)
            / f"{_safe_name(index_name)}.json"
        )

    def answer_index_metadata(self, *, bot_id: str, version_id: str, index_name: str) -> dict[str, Any]:
        return self._read_index_metadata(self._path("answer", bot_id, version_id, index_name))

    def export_answer_index(self, *, bot_id: str, version_id: str, index_name: str) -> dict[str, Any] | None:
        path = self._path("answer", bot_id, version_id, index_name)
        if not path.exists():
            return None
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        return payload if isinstance(payload, dict) else None

    def import_answer_index(self, *, bot_id: str, version_id: str, index_name: str, payload: dict[str, Any]) -> int:
        metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
        records = payload.get("records") if isinstance(payload.get("records"), list) else []
        next_payload = {
            "metadata": {
                **metadata,
                "kind": "answer",
                "botId": bot_id,
                "versionId": version_id,
                "indexName": index_name,
                "recordCount": len(records),
            },
            "records": records,
        }
        path = self._path("answer", bot_id, version_id, index_name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(next_payload, ensure_ascii=False, indent=2), encoding="utf-8")
        self._record_cache.pop(path, None)
        self._metadata_cache.pop(path, None)
        self._answer_search_cache.clear()
        return len(records)

    def copy_answer_index(
        self,
        *,
        source_bot_id: str,
        source_version_id: str,
        target_bot_id: str,
        target_version_id: str,
        index_name: str,
    ) -> int:
        payload = self.export_answer_index(bot_id=source_bot_id, version_id=source_version_id, index_name=index_name)
        if payload is None:
            return 0
        return self.import_answer_index(
            bot_id=target_bot_id,
            version_id=target_version_id,
            index_name=index_name,
            payload=payload,
        )

    def _path_signature(self, path: Path) -> tuple[int, int]:
        try:
            stat = path.stat()
        except FileNotFoundError:
            return (0, 0)
        return (stat.st_mtime_ns, stat.st_size)

    def _terms_signature(self, terms: list[ConfigureTerm] | None) -> tuple[tuple[str, tuple[str, ...], bool, bool], ...]:
        rows: list[tuple[str, tuple[str, ...], bool, bool]] = []
        for term in terms or []:
            name = _normalize_text(getattr(term, "term", ""))
            synonyms = tuple(
                sorted(
                    normalized
                    for value in getattr(term, "synonyms", None) or []
                    if (normalized := _normalize_text(value))
                )
            )
            rows.append(
                (
                    name,
                    synonyms,
                    bool(getattr(term, "domain_enabled", False)),
                    bool(getattr(term, "domain_candidate", False)),
                )
            )
        return tuple(sorted(rows))

    def _remember_cache(self, cache: dict[Any, Any], key: Any, value: Any, limit: int = 256) -> None:
        if len(cache) >= limit:
            cache.clear()
        cache[key] = value

    def _intent_name_token_weights_cached(self, path: Path, records: list[VectorRecord]) -> dict[str, float]:
        key = (str(path), self._path_signature(path))
        cached = self._intent_token_weight_cache.get(key)
        if cached is not None:
            return cached
        weights = _intent_name_token_weights(records)
        self._remember_cache(self._intent_token_weight_cache, key, weights)
        return weights

    def _write_records(
        self,
        path: Path,
        records: list[VectorRecord],
        metadata: dict[str, Any],
        embedding_model: EmbeddingModel | None = None,
        embedding_provider: str | None = None,
    ) -> None:
        model = embedding_model or self.embedding_model
        provider = str(
            embedding_provider or metadata.get("embeddingProvider") or self.embedding_provider or ""
        ).strip().lower()
        vector_dimension = next((len(record.vector) for record in records if record.vector), 0)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "metadata": {
                **metadata,
                **({"embeddingProvider": provider} if provider else {}),
                "embeddingModel": model.name,
                **({"embeddingDimension": vector_dimension} if vector_dimension else {}),
                "recordCount": len(records),
            },
            "records": [asdict(record) for record in records],
        }
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        self._record_cache.pop(path, None)
        self._metadata_cache.pop(path, None)
        self._intent_search_cache.clear()
        self._answer_search_cache.clear()
        self._intent_token_weight_cache.clear()

    def _read_index_metadata(self, path: Path) -> dict[str, Any]:
        if not path.exists():
            return {}
        stat = path.stat()
        cached = self._metadata_cache.get(path)
        if cached is not None and cached[0] == stat.st_mtime_ns and cached[1] == stat.st_size:
            return dict(cached[2])
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
        metadata = payload.get("metadata") if isinstance(payload, dict) else {}
        result = metadata if isinstance(metadata, dict) else {}
        self._metadata_cache[path] = (stat.st_mtime_ns, stat.st_size, result)
        return dict(result)

    def _validate_intent_index_embedding(self, path: Path) -> None:
        metadata = self._read_index_metadata(path)
        if not metadata:
            return
        stored_model = str(metadata.get("embeddingModel") or "").strip()
        stored_provider = str(metadata.get("embeddingProvider") or "").strip().lower()
        current_model = str(self.embedding_model.name or "").strip()
        if stored_model and current_model and stored_model != current_model:
            raise EmbeddingIndexMismatchError(
                "시멘틱 인덱스의 임베딩 모델이 현재 설정과 다릅니다. "
                f"저장 모델={stored_model}, 현재 모델={current_model}. 시멘틱 봇을 다시 학습해야 합니다."
            )
        if stored_provider and self.embedding_provider and stored_provider != self.embedding_provider:
            raise EmbeddingIndexMismatchError(
                "시멘틱 인덱스의 임베딩 제공자가 현재 설정과 다릅니다. "
                f"저장 제공자={stored_provider}, 현재 제공자={self.embedding_provider}. "
                "시멘틱 봇을 다시 학습해야 합니다."
            )

    def _validate_intent_vector_dimensions(
        self,
        records: list[VectorRecord],
        query_vectors: list[list[float]],
    ) -> None:
        record_dimensions = {len(record.vector) for record in records if record.vector}
        query_dimensions = {len(vector) for vector in query_vectors if vector}
        if not record_dimensions or not query_dimensions or record_dimensions == query_dimensions:
            return
        raise EmbeddingIndexMismatchError(
            "시멘틱 인덱스의 벡터 차원이 현재 임베딩 결과와 다릅니다. "
            f"저장 차원={sorted(record_dimensions)}, 현재 차원={sorted(query_dimensions)}. "
            "시멘틱 봇을 다시 학습해야 합니다."
        )

    def _read_records(self, path: Path) -> list[VectorRecord]:
        if not path.exists():
            return []
        stat = path.stat()
        cache_key = path
        cached = self._record_cache.get(cache_key)
        if cached is not None and cached[0] == stat.st_mtime_ns and cached[1] == stat.st_size:
            return cached[2]
        payload = json.loads(path.read_text(encoding="utf-8"))
        raw_records = payload.get("records") if isinstance(payload, dict) else []
        records: list[VectorRecord] = []
        if not isinstance(raw_records, list):
            return records
        for item in raw_records:
            if not isinstance(item, dict):
                continue
            records.append(
                VectorRecord(
                    id=str(item.get("id") or ""),
                    text=str(item.get("text") or ""),
                    vector=[float(value) for value in item.get("vector", []) if isinstance(value, int | float)],
                    metadata=item.get("metadata") if isinstance(item.get("metadata"), dict) else {},
                )
            )
        self._record_cache[cache_key] = (stat.st_mtime_ns, stat.st_size, records)
        return records

    def _embed_cached(self, text: str, embedding_model: EmbeddingModel | None = None) -> list[float]:
        model = embedding_model or self.embedding_model
        normalized = _normalize_text(text)
        if not normalized:
            return model.embed(text)
        cache_key = (model.name, normalized)
        cached = self._embedding_cache.get(cache_key)
        if cached is not None:
            return cached
        vector = model.embed(text)
        if len(self._embedding_cache) > 1024:
            self._embedding_cache.clear()
        self._embedding_cache[cache_key] = vector
        return vector

    def _embed_many_cached(
        self,
        texts: list[str],
        embedding_model: EmbeddingModel | None = None,
    ) -> list[list[float]]:
        model = embedding_model or self.embedding_model
        normalized_texts = [_normalize_text(text) for text in texts]
        text_by_key: dict[tuple[str, str], str] = {}
        missing_by_key: dict[tuple[str, str], str] = {}
        for text, normalized in zip(texts, normalized_texts, strict=True):
            cache_key = (model.name, normalized)
            if not normalized:
                continue
            text_by_key.setdefault(cache_key, text)
            if cache_key not in self._embedding_cache:
                missing_by_key.setdefault(cache_key, text)

        if len(self._embedding_cache) + len(missing_by_key) > 1024:
            self._embedding_cache.clear()
            missing_by_key = dict(text_by_key)

        if missing_by_key:
            missing_keys = list(missing_by_key)
            missing_texts = [missing_by_key[key] for key in missing_keys]
            embed_many = getattr(model, "embed_many", None)
            vectors = embed_many(missing_texts) if callable(embed_many) else [model.embed(text) for text in missing_texts]
            if len(vectors) != len(missing_keys):
                raise RuntimeError("임베딩 배치 응답 개수가 요청 개수와 일치하지 않습니다.")
            for cache_key, vector in zip(missing_keys, vectors, strict=True):
                self._embedding_cache[cache_key] = vector

        return [
            self._embedding_cache[(model.name, normalized)] if normalized else model.embed(text)
            for text, normalized in zip(texts, normalized_texts, strict=True)
        ]

    def index_intents(
        self,
        *,
        bot_id: str,
        version_id: str,
        index_name: str,
        intents: list[IntentDocument],
        dictionary_terms: list[ConfigureTerm] | None = None,
    ) -> int:
        synonym_replacements = _dictionary_synonym_replacements(dictionary_terms or [])
        records: list[VectorRecord] = []
        for intent in intents:
            intent_name = intent.intent_name.strip()
            if intent_name:
                records.append(
                    VectorRecord(
                        id=f"{intent.intent_id}:intent-name",
                        text=intent_name,
                        vector=[],
                        metadata={
                            "intentId": intent.intent_id,
                            "intentName": intent.intent_name,
                            "source": "intentName",
                        },
                    )
                )
                normalized_intent_name = _apply_dictionary_synonyms(intent_name, synonym_replacements)
                if normalized_intent_name and normalized_intent_name != _normalize_text(intent_name):
                    records.append(
                        VectorRecord(
                            id=f"{intent.intent_id}:intent-name:synonym",
                            text=normalized_intent_name,
                            vector=[],
                            metadata={
                                "intentId": intent.intent_id,
                                "intentName": intent.intent_name,
                                "source": "intentNameSynonym",
                                "originalText": intent_name,
                            },
                        )
                    )
            for utterance_index, utterance in enumerate(intent.utterances):
                text = utterance.strip()
                if not text:
                    continue
                records.append(
                    VectorRecord(
                        id=f"{intent.intent_id}:{utterance_index}",
                        text=text,
                        vector=[],
                        metadata={
                            "intentId": intent.intent_id,
                            "intentName": intent.intent_name,
                            "utteranceIndex": utterance_index,
                            "source": "utterance",
                        },
                    )
                )
                normalized_text = _apply_dictionary_synonyms(text, synonym_replacements)
                if normalized_text and normalized_text != _normalize_text(text):
                    records.append(
                        VectorRecord(
                            id=f"{intent.intent_id}:{utterance_index}:synonym",
                            text=normalized_text,
                            vector=[],
                            metadata={
                                "intentId": intent.intent_id,
                                "intentName": intent.intent_name,
                                "utteranceIndex": utterance_index,
                                "source": "utteranceSynonym",
                                "originalText": text,
                            },
                        )
                    )
        vectors = self._embed_many_cached([record.text for record in records])
        for record, vector in zip(records, vectors, strict=True):
            record.vector = vector
        self._write_records(
            self._path("intent", bot_id, version_id, index_name),
            records,
            {
                "kind": "intent",
                "botId": bot_id,
                "versionId": version_id,
                "indexName": index_name,
                "dictionarySynonymCount": len(synonym_replacements),
            },
        )
        return len(records)

    def search_intents_batch(
        self,
        *,
        bot_id: str,
        version_id: str,
        index_name: str,
        queries: list[str],
        top_k: int,
        dictionary_terms: list[ConfigureTerm] | None = None,
    ) -> list[list[IntentMatch]]:
        self._validate_intent_index_embedding(self._path("intent", bot_id, version_id, index_name))
        synonym_replacements = _dictionary_synonym_replacements(dictionary_terms or [])
        candidate_texts = [
            candidate
            for query in queries
            for candidate in _semantic_text_candidates(query, synonym_replacements)
        ]
        self._embed_many_cached(candidate_texts)
        return [
            self.search_intents(
                bot_id=bot_id,
                version_id=version_id,
                index_name=index_name,
                query=query,
                top_k=top_k,
                dictionary_terms=dictionary_terms,
            )
            for query in queries
        ]

    def search_intents(
        self,
        *,
        bot_id: str,
        version_id: str,
        index_name: str,
        query: str,
        top_k: int,
        dictionary_terms: list[ConfigureTerm] | None = None,
        diagnostics: dict[str, Any] | None = None,
    ) -> list[IntentMatch]:
        started_at = perf_counter()
        path = self._path("intent", bot_id, version_id, index_name)
        self._validate_intent_index_embedding(path)
        read_started_at = perf_counter()
        records = self._read_records(path)
        read_elapsed_ms = _elapsed_ms(read_started_at)
        top_k = max(1, top_k)
        cache_key = (
            str(path),
            self._path_signature(path),
            _normalize_text(query),
            top_k,
            self._terms_signature(dictionary_terms),
        )
        cached = self._intent_search_cache.get(cache_key)
        if cached is not None:
            if diagnostics is not None:
                diagnostics.update(
                    {
                        "kind": "intent",
                        "cacheHit": True,
                        "recordCount": len(records),
                        "queryCandidateCount": 0,
                        "readElapsedMs": read_elapsed_ms,
                        "embeddingElapsedMs": 0.0,
                        "scoringElapsedMs": 0.0,
                        "elapsedMs": _elapsed_ms(started_at),
                    }
                )
            return list(cached)
        synonym_replacements = _dictionary_synonym_replacements(dictionary_terms or [])
        domain_terms = _domain_term_values(dictionary_terms or [])
        candidate_domain_terms = _candidate_domain_term_values(dictionary_terms or [])
        intent_name_token_weights = self._intent_name_token_weights_cached(path, records)
        query_texts = _semantic_text_candidates(query, synonym_replacements)
        embedding_started_at = perf_counter()
        query_vectors = [(text, self._embed_cached(text)) for text in query_texts]
        self._validate_intent_vector_dimensions(records, [vector for _, vector in query_vectors])
        embedding_elapsed_ms = _elapsed_ms(embedding_started_at)
        scoring_started_at = perf_counter()
        intent_records: dict[str, list[tuple[VectorRecord, float]]] = defaultdict(list)
        record_vectors = [record.vector for record in records]
        gpu_scores_by_query = [_gpu_batch_cosine(query_vector, record_vectors) for _, query_vector in query_vectors]
        for record_index, record in enumerate(records):
            intent_id = str(record.metadata.get("intentId") or "")
            if not intent_id:
                continue
            vector_score = max(
                (
                    _record_vector_score_from_cosine(gpu_scores_by_query[query_index][record_index], record.metadata, record.text)
                    if gpu_scores_by_query[query_index] is not None
                    else _record_vector_score(query_vector, record.vector, record.metadata, record.text)
                    for query_index, (_, query_vector) in enumerate(query_vectors)
                ),
                default=0.0,
            )
            text_score = max(
                (
                    _record_text_match_score(
                        query_text,
                        record.text,
                        record.metadata,
                        intent_name_token_weights,
                    )
                    for query_text, _ in query_vectors
                ),
                default=0.0,
            )
            intent_name_score = max(
                (
                    _record_intent_name_match_score(
                        query_text,
                        record.metadata,
                        record.text,
                        intent_name_token_weights,
                    )
                    for query_text, _ in query_vectors
                ),
                default=0.0,
            )
            source = _record_source(record.metadata, record.text)
            if source in {"intentName", "intentNameSynonym"}:
                score = max(text_score, intent_name_score)
            else:
                guard_score = max(
                    (
                        _semantic_guard_score(query_text, record.text, domain_terms, candidate_domain_terms)
                        for query_text in query_texts
                    ),
                    default=0.0,
                )
                if text_score >= 0.95:
                    score = max(text_score, vector_score)
                elif text_score >= 0.55:
                    score = max(text_score, vector_score * 0.82 + text_score * 0.18)
                else:
                    score = vector_score * 0.72 + text_score * 0.28
                score += guard_score * 0.22
                if any(_has_contact_direction_conflict(query_text, record.text) for query_text in query_texts):
                    score = min(score, 0.48)
                if text_score < 0.12 and guard_score <= 0 and any(
                    _is_short_semantic_pair(query_text, record.text) for query_text in query_texts
                ):
                    score = min(score, 0.58)
                if text_score < 0.12 and guard_score < -0.15:
                    score = min(score, 0.62)
            intent_records[intent_id].append((record, max(0.0, min(1.0, score))))

        scored: list[tuple[VectorRecord, float]] = []
        for items in intent_records.values():
            items.sort(key=lambda item: item[1], reverse=True)
            top_record, top_score = items[0]
            support_cutoff = max(0.1, top_score * 0.62)
            support_scores = [score for _, score in items[:4] if score >= support_cutoff]
            support_average = sum(support_scores) / len(support_scores) if support_scores else top_score
            support_bonus = min(0.06, max(0, len(support_scores) - 1) * 0.02)
            aggregate_score = 1.0 if top_score >= 0.999 else top_score * 0.72 + support_average * 0.22 + support_bonus
            scored.append((top_record, max(0.0, min(1.0, aggregate_score))))
        scored.sort(key=lambda item: item[1], reverse=True)
        scoring_elapsed_ms = _elapsed_ms(scoring_started_at)
        matches: list[IntentMatch] = []
        seen_intents: set[str] = set()
        for record, score in scored:
            intent_id = str(record.metadata.get("intentId") or "")
            if not intent_id or intent_id in seen_intents:
                continue
            seen_intents.add(intent_id)
            matches.append(
                IntentMatch(
                    intentId=intent_id,
                    intentName=str(record.metadata.get("intentName") or ""),
                    score=round(score, 6),
                    matchedText=record.text,
                    metadata=record.metadata,
                )
            )
            if len(matches) >= top_k:
                break
        self._remember_cache(self._intent_search_cache, cache_key, list(matches))
        if diagnostics is not None:
            diagnostics.update(
                {
                    "kind": "intent",
                    "cacheHit": False,
                    "recordCount": len(records),
                    "queryCandidateCount": len(query_texts),
                    "readElapsedMs": read_elapsed_ms,
                    "embeddingElapsedMs": embedding_elapsed_ms,
                    "scoringElapsedMs": scoring_elapsed_ms,
                    "elapsedMs": _elapsed_ms(started_at),
                }
            )
        return matches

    def configure_intents(
        self,
        *,
        utterances: list[str],
        target_count: int,
        target_count_policy: str,
        dictionary_terms: list[ConfigureTerm],
        entity_terms: list[ConfigureTerm],
        scoring: dict[str, float] | None = None,
    ) -> list[IntentConfigureGroup]:
        normalized_utterances = []
        seen: set[str] = set()
        for utterance in utterances:
            text = str(utterance or "").strip()
            key = _normalize_text(text)
            if not text or key in seen:
                continue
            seen.add(key)
            normalized_utterances.append(text)
        if not normalized_utterances:
            self.last_configure_diagnostics = {"inputCount": len(utterances), "deduplicatedCount": 0}
            return []

        count = max(1, min(target_count, len(normalized_utterances)))
        policy = _normalize_policy(target_count_policy)
        synonym_replacements = _dictionary_synonym_replacements(dictionary_terms)
        synonym_utterances = [_apply_dictionary_synonyms(utterance, synonym_replacements) for utterance in normalized_utterances]
        pair_items = [
            (
                utterance,
                self.embedding_model.embed(utterance),
                synonym_utterances[index],
                self.embedding_model.embed(synonym_utterances[index]),
            )
            for index, utterance in enumerate(normalized_utterances)
        ]
        dictionary_values = _term_values(dictionary_terms)
        entity_values = _term_values(entity_terms)
        domain_values = _domain_term_values(dictionary_terms)
        candidate_domain_values = _candidate_domain_term_values(dictionary_terms)
        configure_vectors = _build_configure_vectors(synonym_utterances, domain_values, candidate_domain_values)
        effective_scoring = scoring or {}
        signature_sets = [
            _linguistic_signatures(utterance, domain_values, candidate_domain_values)
            for utterance in synonym_utterances
        ]
        embedding_type = type(self.embedding_model).__name__.lower()
        hash_embedding = "hash" in embedding_type or self.embedding_model.name.lower().startswith("local-hash")
        matrix = [[0.0 for _ in normalized_utterances] for _ in normalized_utterances]
        for left_index, left in enumerate(pair_items):
            matrix[left_index][left_index] = 1.0
            for right_index in range(left_index + 1, len(pair_items)):
                score = _pair_similarity(
                    left,
                    pair_items[right_index],
                    configure_score=_sparse_cosine(configure_vectors[left_index], configure_vectors[right_index]),
                    dictionary_terms=dictionary_values,
                    entity_terms=entity_values,
                    domain_terms=domain_values,
                    candidate_domain_terms=candidate_domain_values,
                    scoring=effective_scoring,
                    hash_embedding=hash_embedding,
                )
                matrix[left_index][right_index] = score
                matrix[right_index][left_index] = score

        merge_floor = {"minimize": 0.78, "near": 0.18, "exact": -1.0}[policy]
        max_cluster_size = _configure_max_cluster_size(len(normalized_utterances), count, policy)
        merge_scores: list[float] = []
        cluster_source = "pairwise"
        cluster_indexes = None
        if cluster_indexes is None:
            cluster_indexes = [[index] for index in range(len(normalized_utterances))]
            while len(cluster_indexes) > count:
                best_left: int | None = None
                best_right: int | None = None
                best_score = -1.0
                for left_index in range(len(cluster_indexes)):
                    for right_index in range(left_index + 1, len(cluster_indexes)):
                        if len(cluster_indexes[left_index]) + len(cluster_indexes[right_index]) > max_cluster_size:
                            continue
                        if not _cluster_merge_allowed(cluster_indexes[left_index], cluster_indexes[right_index], signature_sets):
                            continue
                        score = _cluster_merge_score(cluster_indexes[left_index], cluster_indexes[right_index], matrix)
                        if policy in {"minimize", "near"}:
                            required_score = _cluster_required_merge_score(
                                cluster_indexes[left_index],
                                cluster_indexes[right_index],
                                signature_sets,
                                merge_floor,
                            )
                            if score < required_score:
                                continue
                        if score > best_score:
                            best_left = left_index
                            best_right = right_index
                            best_score = score
                if best_left is None or best_right is None:
                    break
                if policy in {"minimize", "near"} and best_score < merge_floor:
                    break
                cluster_indexes[best_left] = [*cluster_indexes[best_left], *cluster_indexes[best_right]]
                cluster_indexes.pop(best_right)
                merge_scores.append(best_score)
        else:
            cluster_source = "sklearn-agglomerative-cosine"

        if policy == "minimize":
            while len(cluster_indexes) > 1:
                best_left = None
                best_right = None
                best_score = -1.0
                for left_index in range(len(cluster_indexes)):
                    for right_index in range(left_index + 1, len(cluster_indexes)):
                        if len(cluster_indexes[left_index]) + len(cluster_indexes[right_index]) > max_cluster_size:
                            continue
                        if not _cluster_merge_allowed(cluster_indexes[left_index], cluster_indexes[right_index], signature_sets):
                            continue
                        score = _cluster_merge_score(cluster_indexes[left_index], cluster_indexes[right_index], matrix)
                        required_score = _cluster_required_merge_score(
                            cluster_indexes[left_index],
                            cluster_indexes[right_index],
                            signature_sets,
                            merge_floor,
                        )
                        if score < required_score:
                            continue
                        if score > best_score:
                            best_left = left_index
                            best_right = right_index
                            best_score = score
                if best_left is None or best_right is None:
                    break
                if best_score < merge_floor:
                    break
                cluster_indexes[best_left] = [*cluster_indexes[best_left], *cluster_indexes[best_right]]
                cluster_indexes.pop(best_right)
                merge_scores.append(best_score)

        if policy in {"near", "exact"}:
            cluster_indexes = _rebalance_clusters(
                cluster_indexes,
                matrix,
                count,
                max_size=max_cluster_size,
                signature_sets=signature_sets,
                min_merge_score=merge_floor if policy == "near" else None,
            )

        if policy == "minimize":
            signature_split_indexes: list[list[int]] = []
            for indexes in cluster_indexes:
                signature_split_indexes.extend(
                    _split_cluster_by_signatures(indexes, signature_sets, matrix, max_cluster_size)
                )
            cluster_indexes = signature_split_indexes

        groups: list[IntentConfigureGroup] = []
        for index, indexes in enumerate(cluster_indexes):
            ordered = sorted(indexes)
            _, seed, average_score = _select_seed(ordered, normalized_utterances, matrix)
            name = seed[:32].strip() or f"의도 {index + 1}"
            groups.append(
                IntentConfigureGroup(
                    id=f"semantic-{index + 1}",
                    name=name,
                    answer=f"{name}에 대해 안내드리겠습니다.",
                    utterances=[normalized_utterances[item_index] for item_index in ordered],
                    seed=seed,
                    score=round(max(0.0, min(1.0, average_score)), 6),
                )
            )
        group_scores = [group.score for group in groups]
        self.last_configure_diagnostics = {
            "inputCount": len(utterances),
            "deduplicatedCount": len(normalized_utterances),
            "groupCount": len(groups),
            "embeddingProvider": type(self.embedding_model).__name__,
            "embeddingModel": self.embedding_model.name,
            "hashEmbedding": hash_embedding,
            "dictionarySynonymCount": len(synonym_replacements),
            "domainTermCount": len(domain_values),
            "domainCandidateCount": len(candidate_domain_values),
            "clusterSource": cluster_source,
            "maxClusterSize": max_cluster_size,
            "mergeFloor": merge_floor,
            "mergeScoreMin": round(min(merge_scores), 6) if merge_scores else None,
            "mergeScoreAvg": round(sum(merge_scores) / len(merge_scores), 6) if merge_scores else None,
            "groupScoreMin": round(min(group_scores), 6) if group_scores else None,
            "groupScoreAvg": round(sum(group_scores) / len(group_scores), 6) if group_scores else None,
            "groupSizeMax": max((len(group.utterances) for group in groups), default=0),
        }
        return groups

    def index_answers(
        self,
        *,
        bot_id: str,
        version_id: str,
        index_name: str,
        documents: list[KnowledgeDocument],
        embedding_model: EmbeddingModel | None = None,
        embedding_provider: str | None = None,
    ) -> int:
        model = embedding_model or self.embedding_model
        records = [
            VectorRecord(
                id=document.document_id,
                text=document.text,
                vector=model.embed(f"{document.title}\n{document.text}"),
                metadata={
                    "documentId": document.document_id,
                    "title": document.title,
                    **({"embeddingProvider": embedding_provider} if embedding_provider else {}),
                    "embeddingModel": model.name,
                    **document.metadata,
                },
            )
            for document in documents
        ]
        self._write_records(
            self._path("answer", bot_id, version_id, index_name),
            records,
            {"kind": "answer", "botId": bot_id, "versionId": version_id, "indexName": index_name},
            embedding_model=model,
            embedding_provider=embedding_provider,
        )
        return len(records)

    def search_answers(
        self,
        *,
        bot_id: str,
        version_id: str,
        index_name: str,
        query: str,
        top_k: int,
        intent_ids: list[str] | None = None,
        embedding_model: EmbeddingModel | None = None,
        diagnostics: dict[str, Any] | None = None,
    ) -> list[AnswerMatch]:
        started_at = perf_counter()
        path = self._path("answer", bot_id, version_id, index_name)
        model = embedding_model or self.embedding_model
        read_started_at = perf_counter()
        records = self._read_records(path)
        read_elapsed_ms = _elapsed_ms(read_started_at)
        top_k = max(1, top_k)
        allowed_tuple = tuple(sorted(str(value).strip() for value in intent_ids or [] if str(value).strip()))
        cache_key = (str(path), self._path_signature(path), model.name, _normalize_text(query), top_k, allowed_tuple)
        cached = self._answer_search_cache.get(cache_key)
        if cached is not None:
            if diagnostics is not None:
                diagnostics.update(
                    {
                        "kind": "answer",
                        "cacheHit": True,
                        "recordCount": len(records),
                        "filteredRecordCount": len(records),
                        "readElapsedMs": read_elapsed_ms,
                        "embeddingElapsedMs": 0.0,
                        "scoringElapsedMs": 0.0,
                        "elapsedMs": _elapsed_ms(started_at),
                    }
                )
            return list(cached)
        allowed_intents = set(allowed_tuple)
        if allowed_intents:
            records = [record for record in records if str(record.metadata.get("intentId") or "") in allowed_intents]
        filtered_record_count = len(records)
        embedding_started_at = perf_counter()
        query_vector = self._embed_cached(query, model)
        embedding_elapsed_ms = _elapsed_ms(embedding_started_at)
        scoring_started_at = perf_counter()
        gpu_scores = _gpu_batch_cosine(query_vector, [record.vector for record in records])
        scored = sorted(
            (
                (
                    record,
                    max(
                        gpu_scores[record_index] if gpu_scores is not None else _cosine(query_vector, record.vector),
                        _text_match_score(query, record.text),
                        _text_match_score(query, str(record.metadata.get("title") or "")),
                    ),
                )
                for record_index, record in enumerate(records)
            ),
            key=lambda item: item[1],
            reverse=True,
        )
        scoring_elapsed_ms = _elapsed_ms(scoring_started_at)
        matches: list[AnswerMatch] = []
        for record, score in scored[:top_k]:
            matches.append(
                AnswerMatch(
                    documentId=str(record.metadata.get("documentId") or record.id),
                    title=str(record.metadata.get("title") or ""),
                    text=record.text,
                    score=round(max(0.0, min(1.0, score)), 6),
                    metadata=record.metadata,
                )
            )
        self._remember_cache(self._answer_search_cache, cache_key, list(matches))
        if diagnostics is not None:
            diagnostics.update(
                {
                    "kind": "answer",
                    "cacheHit": False,
                    "recordCount": len(self._read_records(path)),
                    "filteredRecordCount": filtered_record_count,
                    "readElapsedMs": read_elapsed_ms,
                    "embeddingElapsedMs": embedding_elapsed_ms,
                    "scoringElapsedMs": scoring_elapsed_ms,
                    "elapsedMs": _elapsed_ms(started_at),
                }
            )
        return matches
