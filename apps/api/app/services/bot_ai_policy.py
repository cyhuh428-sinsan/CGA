from __future__ import annotations

from typing import Any

from app.services.vector_search import intent_vector_config


SUPPORTED_NLU_TYPE = "ml"
SUPPORTED_NLU_MODEL = "deep_learning_lite"
SUPPORTED_ANSWER_MODE = "fixed"
RUNTIME_SUPPORTED_ANSWER_MODES = {"fixed", "semantic_rag", "llm_rag", "llm"}
SEMANTIC_NLU_TYPES = {"semantic", "semantic_vector", "semantic_external"}
UNSUPPORTED_ANSWER_MODE_REASON = (
    "선택한 답변 방식은 아직 실행 엔진에 연결되지 않았습니다. "
    "현재 실행 가능한 답변 방식은 정해진 답변, Semantic RAG 답변, LLM RAG 답변입니다."
)


def runtime_block_reason(data_json: dict[str, Any] | None) -> str | None:
    data = data_json if isinstance(data_json, dict) else {}
    nlu_type = str(data.get("nlu_type") or SUPPORTED_NLU_TYPE)
    nlu_model = str(data.get("nlu_model") or data.get("nlu_engine") or SUPPORTED_NLU_MODEL)
    answer_mode = str(data.get("answer_mode") or SUPPORTED_ANSWER_MODE)
    if answer_mode not in RUNTIME_SUPPORTED_ANSWER_MODES:
        return UNSUPPORTED_ANSWER_MODE_REASON
    if nlu_type == SUPPORTED_NLU_TYPE and answer_mode != SUPPORTED_ANSWER_MODE:
        return UNSUPPORTED_ANSWER_MODE_REASON
    if nlu_type in SEMANTIC_NLU_TYPES and answer_mode in {"llm", "llm_rag"}:
        return UNSUPPORTED_ANSWER_MODE_REASON
    if nlu_type == "llm" and answer_mode == "semantic_rag":
        return UNSUPPORTED_ANSWER_MODE_REASON
    if nlu_type in SEMANTIC_NLU_TYPES:
        config = intent_vector_config(data)
        if not config.is_ready:
            missing = ", ".join(config.missing_fields)
            return f"Semantic NLU 실행에는 Intent Vector DB 연결 설정이 필요합니다. 누락: {missing}"
        return None
    if nlu_type == "llm":
        return None
    if nlu_type != SUPPORTED_NLU_TYPE or nlu_model != SUPPORTED_NLU_MODEL:
        return "선택한 NLU 엔진은 아직 실행 엔진에 연결되지 않았습니다. 현재 실행 가능한 조합은 ML + DeepLearning Lite입니다."
    return None


def training_block_reason(data_json: dict[str, Any] | None) -> str | None:
    data = data_json if isinstance(data_json, dict) else {}
    nlu_type = str(data.get("nlu_type") or SUPPORTED_NLU_TYPE)
    nlu_model = str(data.get("nlu_model") or data.get("nlu_engine") or SUPPORTED_NLU_MODEL)
    if nlu_type in SEMANTIC_NLU_TYPES:
        config = intent_vector_config(data)
        if not config.is_ready:
            missing = ", ".join(config.missing_fields)
            return f"Semantic NLU 학습에는 Intent Vector DB 연결 설정이 필요합니다. 누락: {missing}"
        return None
    if nlu_type == "llm":
        return None
    if nlu_type != SUPPORTED_NLU_TYPE or nlu_model != SUPPORTED_NLU_MODEL:
        return "선택한 NLU 엔진은 아직 학습 엔진에 연결되지 않았습니다. 현재 학습 가능한 조합은 ML + DeepLearning Lite입니다."
    return None
