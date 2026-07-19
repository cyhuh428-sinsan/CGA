from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from app.services.llm_client import LlmChatClient, LlmClientError, LlmProviderConfig, resolve_llm_provider_config


@dataclass(frozen=True)
class LlmIntentCandidate:
    intent_id: str
    intent_name: str
    confidence: float
    reason: str = ""


@dataclass(frozen=True)
class LlmIntentClassification:
    provider: str
    model: str
    latency_ms: int
    candidates: list[LlmIntentCandidate]
    raw_content: str


@dataclass(frozen=True)
class LlmIntentGroup:
    name: str
    answer: str
    utterances: list[str]
    reason: str = ""


@dataclass(frozen=True)
class LlmIntentConfiguration:
    provider: str
    model: str
    latency_ms: int
    groups: list[LlmIntentGroup]
    raw_content: str


def classify_intent_with_llm(
    *,
    provider: str | None,
    model: str | None,
    api_key: str | None = None,
    base_url: str | None = None,
    timeout_seconds: int | None = None,
    query: str,
    intents: list[dict[str, Any]],
    top_k: int = 3,
    dictionary_terms: list[dict[str, Any]] | None = None,
    entity_terms: list[dict[str, Any]] | None = None,
    client: LlmChatClient | None = None,
) -> LlmIntentClassification:
    normalized_query = query.strip()
    if not normalized_query:
        raise LlmClientError("테스트할 사용자 발화를 입력해주세요.")
    intent_payload = _compact_intents(intents)
    if not intent_payload:
        raise LlmClientError("LLM 의도 분류에 사용할 의도와 학습문장이 없습니다.")

    config = client.config if client is not None else resolve_llm_provider_config(
        provider,
        model,
        api_key=api_key,
        base_url=base_url,
        timeout_seconds=timeout_seconds,
    )
    chat_client = client or LlmChatClient(config)
    result, parsed = _chat_json_with_retry(
        chat_client=chat_client,
        system_prompt=_system_prompt(top_k),
        user_prompt=json.dumps(
            {
                "user_utterance": normalized_query,
                "top_k": max(1, top_k),
                "intents": intent_payload,
                "dictionaryTerms": _compact_reference_terms(dictionary_terms or []),
                "entityTerms": _compact_reference_terms(entity_terms or []),
            },
            ensure_ascii=False,
        ),
        required_key="candidates",
    )
    candidates = _parse_candidates(parsed, intent_payload)
    return LlmIntentClassification(
        provider=result.provider,
        model=result.model,
        latency_ms=result.latency_ms,
        candidates=candidates[: max(1, top_k)],
        raw_content=result.content,
    )


def configure_intents_with_llm(
    *,
    provider: str | None,
    model: str | None,
    api_key: str | None = None,
    base_url: str | None = None,
    timeout_seconds: int | None = None,
    utterances: list[str],
    target_count: int,
    target_count_policy: str = "near",
    dictionary_terms: list[dict[str, Any]] | None = None,
    entity_terms: list[dict[str, Any]] | None = None,
    client: LlmChatClient | None = None,
) -> LlmIntentConfiguration:
    normalized_utterances = _normalize_utterances(utterances)
    if not normalized_utterances:
        raise LlmClientError("구성할 학습문장을 입력해주세요.")
    normalized_target_count = max(1, min(100, int(target_count or 1)))
    normalized_target_policy = _normalize_target_count_policy(target_count_policy)
    indexed_utterances = [{"index": index + 1, "text": text} for index, text in enumerate(normalized_utterances)]

    config = client.config if client is not None else resolve_llm_provider_config(
        provider,
        model,
        api_key=api_key,
        base_url=base_url,
        timeout_seconds=timeout_seconds,
    )
    chat_client = client or LlmChatClient(config)
    result, parsed = _chat_json_with_retry(
        chat_client=chat_client,
        system_prompt=_configuration_system_prompt(normalized_target_policy),
        user_prompt=json.dumps(
            {
                "targetGroupCount": normalized_target_count,
                "targetCountPolicy": normalized_target_policy,
                "utterances": indexed_utterances,
                "dictionaryTerms": _compact_reference_terms(dictionary_terms or []),
                "entityTerms": _compact_reference_terms(entity_terms or []),
            },
            ensure_ascii=False,
        ),
        required_key="groups",
    )
    groups = _adjust_groups_to_target(
        _parse_groups(parsed, normalized_utterances),
        normalized_target_count,
        normalized_target_policy,
    )
    if not groups:
        raise LlmClientError(f"LLM 의도 구성 결과가 비어 있습니다: {result.content[:300]}")
    return LlmIntentConfiguration(
        provider=result.provider,
        model=result.model,
        latency_ms=result.latency_ms,
        groups=groups,
        raw_content=result.content,
    )


def _compact_intents(intents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    compacted: list[dict[str, Any]] = []
    for item in intents:
        intent_id = str(item.get("intentId") or item.get("id") or "").strip()
        intent_name = str(item.get("intentName") or item.get("name") or "").strip()
        utterances = item.get("utterances")
        if not intent_id or not intent_name or not isinstance(utterances, list):
            continue
        examples = [str(value).strip() for value in utterances if str(value or "").strip()]
        if not examples:
            continue
        compacted.append(
            {
                "id": intent_id,
                "name": intent_name,
                "examples": examples[:12],
            }
        )
    return compacted


def _system_prompt(top_k: int) -> str:
    return (
        "너는 Aidot의 한국어 NLU 의도 분류 엔진이다. "
        "사용자 발화를 주어진 의도 목록 중 하나 이상으로만 분류한다. "
        "의도 목록에 없는 새 의도를 만들지 않는다. "
        "dictionaryTerms는 기업/업무에서 정의한 대표어와 동의어이며, entityTerms는 업무 개체명과 값이다. "
        "사전과 개체는 발화 해석을 돕는 참고 정보로만 사용하고, 이것만으로 새 의도를 만들거나 서로 다른 목적을 합치지 않는다. "
        "동의어, 부정 표현, 어미, 조사보다 핵심 명사와 동사를 우선한다. "
        "같은 단어가 포함되어도 거절/요청/문의/확인/속도/재연락처럼 목적이 다르면 구분한다. "
        f"가장 가능성이 높은 후보를 최대 {max(1, top_k)}개 반환한다. "
        "응답은 반드시 JSON 객체 하나만 반환한다. "
        "첫 글자는 반드시 { 이고 마지막 글자는 반드시 } 이어야 한다. "
        "JSON 앞뒤 설명, 마크다운, 코드블록, 번호목록, 분석문, 자연어 답변은 절대 쓰지 않는다. "
        "형식: "
        '{"candidates":[{"intentId":"...","confidence":0.0,"reason":"..."}]}'
    )


def _configuration_system_prompt(target_count_policy: str = "near") -> str:
    policy_text = {
        "minimize": (
            "targetGroupCount는 최대 의도 수다. "
            "groups 배열 길이는 targetGroupCount 이하로 유지하되, 의미가 같은 문장은 최대한 적은 의도 그룹으로 묶는다. "
        ),
        "near": (
            "targetGroupCount는 가능한 한 맞춰야 하는 목표 의도 수다. "
            "입력 문장 수가 targetGroupCount보다 많거나 같으면 groups 배열 길이를 targetGroupCount에 최대한 가깝게 반환한다. "
        ),
        "exact": (
            "targetGroupCount는 반드시 맞춰야 하는 목표 의도 수다. "
            "입력 문장 수가 targetGroupCount보다 많거나 같으면 groups 배열 길이를 정확히 targetGroupCount로 반환한다. "
        ),
    }.get(target_count_policy, "")
    return (
        "너는 Aidot의 한국어 NLU 의도 구성 엔진이다. "
        "사용자가 입력한 학습문장을 의미가 같은 의도 후보끼리 묶는다. "
        "반드시 입력된 문장만 사용하고, 문장을 새로 만들거나 삭제하지 않는다. "
        f"{policy_text}"
        "단, 의미가 전혀 다른 문장을 억지로 합치지 않는다. "
        "같은 단어가 있어도 목적이 다르면 분리하고, 부정/거절/요청/문의/확인/속도/재연락은 구분한다. "
        "한국어에서는 조사와 어미보다 핵심 명사와 동사를 우선하되, 뒤쪽 핵심 동사와 부정 표현을 무시하지 않는다. "
        "사전 동의어와 개체명은 참고 정보로만 사용한다. "
        "각 그룹에는 사용자가 수정하기 쉬운 짧은 의도명과 기본 답변 초안을 붙인다. "
        "응답은 반드시 JSON 객체 하나만 반환한다. "
        "첫 글자는 반드시 { 이고 마지막 글자는 반드시 } 이어야 한다. "
        "JSON 앞뒤 설명, 마크다운, 코드블록, 번호목록, 분석문, 자연어 답변은 절대 쓰지 않는다. "
        "형식: "
        '{"groups":[{"name":"의도명","answer":"기본 답변","utteranceIndexes":[1,2],"reason":"분류 근거"}]}'
    )


def _parse_llm_json(content: str) -> dict[str, Any]:
    stripped = content.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped, flags=re.IGNORECASE)
        stripped = re.sub(r"\s*```$", "", stripped)
    try:
        data = json.loads(stripped)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", stripped, flags=re.DOTALL)
        if match is None:
            raise LlmClientError(f"LLM 의도 분류 응답이 JSON이 아닙니다: {content[:300]}")
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError as exc:
            raise LlmClientError(f"LLM 의도 분류 JSON 파싱 실패: {content[:300]}") from exc
    return data if isinstance(data, dict) else {}


def _chat_json_with_retry(
    *,
    chat_client: LlmChatClient,
    system_prompt: str,
    user_prompt: str,
    required_key: str | None = None,
) -> tuple[Any, dict[str, Any]]:
    result = chat_client.chat(system_prompt=system_prompt, user_prompt=user_prompt, json_mode=True)
    try:
        parsed = _parse_llm_json(result.content)
        if _has_required_json_key(parsed, required_key):
            return result, parsed
        first_error = LlmClientError(f"LLM 응답에 필요한 '{required_key}' 배열이 없습니다: {result.content[:300]}")
    except LlmClientError as first_error:
        pass
    retry_prompt = (
        f"{user_prompt}\n\n"
        "이전 응답은 Aidot에서 처리할 수 없는 JSON이었습니다. "
        "반드시 설명 없이 최종 결과 JSON 객체 하나만 다시 반환하세요. "
        "JSON schema, 예시 schema, {\"type\":\"object\"} 같은 형식 설명은 반환하지 마세요. "
        "첫 글자는 {, 마지막 글자는 } 이어야 합니다.\n"
        f"반드시 포함할 최상위 키: {required_key or '요청한 결과 키'}\n"
        f"이전 응답:\n{result.content[:1000]}"
    )
    retry_result = chat_client.chat(system_prompt=system_prompt, user_prompt=retry_prompt, json_mode=False)
    try:
        retry_parsed = _parse_llm_json(retry_result.content)
    except LlmClientError as retry_error:
        raise LlmClientError(f"{first_error}; JSON 재요청 실패: {retry_error}") from retry_error
    if not _has_required_json_key(retry_parsed, required_key):
        raise LlmClientError(f"{first_error}; JSON 재요청에도 필요한 결과가 없습니다: {retry_result.content[:300]}")
    return retry_result, retry_parsed


def _has_required_json_key(parsed: dict[str, Any], required_key: str | None) -> bool:
    if not required_key:
        return bool(parsed)
    return isinstance(parsed.get(required_key), list)


def _normalize_target_count_policy(value: str | None) -> str:
    normalized = str(value or "near").strip().lower()
    return normalized if normalized in {"minimize", "near", "exact"} else "near"


def _parse_candidates(parsed: dict[str, Any], intents: list[dict[str, Any]]) -> list[LlmIntentCandidate]:
    intent_by_id = {str(item["id"]): item for item in intents}
    raw_candidates = parsed.get("candidates")
    if not isinstance(raw_candidates, list):
        raw_candidates = [parsed]

    candidates: list[LlmIntentCandidate] = []
    seen: set[str] = set()
    for raw in raw_candidates:
        if not isinstance(raw, dict):
            continue
        intent_id = str(raw.get("intentId") or raw.get("intent_id") or raw.get("id") or "").strip()
        if intent_id not in intent_by_id or intent_id in seen:
            continue
        confidence = raw.get("confidence")
        try:
            confidence_value = float(confidence)
        except (TypeError, ValueError):
            confidence_value = 0.0
        if confidence_value > 1:
            confidence_value = confidence_value / 100
        seen.add(intent_id)
        candidates.append(
            LlmIntentCandidate(
                intent_id=intent_id,
                intent_name=str(intent_by_id[intent_id]["name"]),
                confidence=max(0.0, min(1.0, confidence_value)),
                reason=str(raw.get("reason") or "").strip(),
            )
        )
    return sorted(candidates, key=lambda item: item.confidence, reverse=True)


def _normalize_utterances(utterances: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for utterance in utterances:
        text = str(utterance or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        normalized.append(text)
    return normalized


def _compact_reference_terms(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    compacted: list[dict[str, Any]] = []
    for item in items[:200]:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or item.get("word") or item.get("term") or item.get("entityName") or "").strip()
        values = item.get("synonyms") or item.get("values") or item.get("examples") or []
        if isinstance(values, str):
            values = [values]
        value_list = [str(value).strip() for value in values if str(value or "").strip()] if isinstance(values, list) else []
        if name or value_list:
            compacted.append({"name": name, "values": value_list[:20]})
    return compacted


def _parse_groups(parsed: dict[str, Any], utterances: list[str]) -> list[LlmIntentGroup]:
    raw_groups = parsed.get("groups")
    if not isinstance(raw_groups, list):
        return []

    used: set[int] = set()
    groups: list[LlmIntentGroup] = []
    for index, raw_group in enumerate(raw_groups):
        if not isinstance(raw_group, dict):
            continue
        indexes = raw_group.get("utteranceIndexes") or raw_group.get("utterance_indexes") or raw_group.get("indexes")
        if not isinstance(indexes, list):
            indexes = []
        group_utterances: list[str] = []
        for raw_index in indexes:
            try:
                utterance_index = int(raw_index) - 1
            except (TypeError, ValueError):
                continue
            if utterance_index < 0 or utterance_index >= len(utterances) or utterance_index in used:
                continue
            used.add(utterance_index)
            group_utterances.append(utterances[utterance_index])
        if not group_utterances:
            continue
        name = str(raw_group.get("name") or raw_group.get("intentName") or f"의도 {index + 1}").strip()
        answer = str(raw_group.get("answer") or f"{name}에 대해 안내드리겠습니다.").strip()
        groups.append(
            LlmIntentGroup(
                name=name or f"의도 {index + 1}",
                answer=answer or f"{name or f'의도 {index + 1}'}에 대해 안내드리겠습니다.",
                utterances=group_utterances,
                reason=str(raw_group.get("reason") or "").strip(),
            )
        )

    for utterance_index, utterance in enumerate(utterances):
        if utterance_index in used:
            continue
        name = f"의도 {len(groups) + 1}"
        groups.append(
            LlmIntentGroup(
                name=name,
                answer=f"{name}에 대해 안내드리겠습니다.",
                utterances=[utterance],
                reason="LLM 결과에서 누락되어 단일 후보로 보존했습니다.",
            )
        )
    return groups


def _adjust_groups_to_target(groups: list[LlmIntentGroup], target_count: int, target_count_policy: str) -> list[LlmIntentGroup]:
    if _normalize_target_count_policy(target_count_policy) == "minimize":
        return groups
    normalized_target = max(1, int(target_count or 1))
    adjusted = list(groups)
    while len(adjusted) > normalized_target:
        tail = adjusted.pop()
        target_index = max(range(len(adjusted)), key=lambda index: len(adjusted[index].utterances), default=-1)
        if target_index < 0:
            adjusted.append(tail)
            break
        target = adjusted[target_index]
        adjusted[target_index] = LlmIntentGroup(
            name=target.name,
            answer=target.answer,
            utterances=[*target.utterances, *tail.utterances],
            reason=(target.reason or tail.reason or "목표 의도 수에 맞추기 위해 초과 그룹을 병합했습니다."),
        )

    while len(adjusted) < normalized_target:
        split_index = max(range(len(adjusted)), key=lambda index: len(adjusted[index].utterances), default=-1)
        if split_index < 0:
            break
        group = adjusted[split_index]
        if len(group.utterances) <= 1:
            break
        head, tail = group.utterances[0], group.utterances[1:]
        adjusted[split_index] = LlmIntentGroup(
            name=group.name,
            answer=group.answer,
            utterances=[head],
            reason=group.reason,
        )
        split_name = f"{group.name} {len(adjusted) + 1}"
        adjusted.append(
            LlmIntentGroup(
                name=split_name,
                answer=group.answer,
                utterances=tail,
                reason="목표 의도 수에 맞추기 위해 큰 그룹을 분리했습니다.",
            )
        )
    return adjusted
