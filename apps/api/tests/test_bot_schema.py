import pytest
from pydantic import ValidationError

from app.schemas.bot import BotCreateRequest, BotUpdateRequest


def test_bot_create_defaults_to_fixed_answer_mode() -> None:
    payload = BotCreateRequest(name="상담봇")

    assert payload.answer_mode == "fixed"


def test_bot_update_accepts_supported_answer_modes() -> None:
    payload = BotUpdateRequest(answer_mode="llm_rag")

    assert payload.answer_mode == "llm_rag"


def test_bot_update_accepts_llm_provider_models() -> None:
    payload = BotUpdateRequest(llm_provider="groq", llm_model="llama-3.3-70b-versatile")

    assert payload.llm_provider == "groq"
    assert payload.llm_model == "llama-3.3-70b-versatile"


def test_bot_update_rejects_mismatched_llm_model() -> None:
    with pytest.raises(ValidationError):
        BotUpdateRequest(llm_provider="claude", llm_model="gpt-4o-mini")


def test_bot_create_accepts_semantic_engine_settings() -> None:
    payload = BotCreateRequest(
        name="상담봇",
        nlu_type="semantic",
        nlu_model="semantic_engine_default",
        nlu_engine="semantic_engine_default",
        answer_mode="semantic_rag",
    )

    assert payload.nlu_type == "semantic"
    assert payload.nlu_model == "semantic_engine_default"
    assert payload.answer_mode == "semantic_rag"


def test_bot_create_accepts_vector_connections() -> None:
    payload = BotCreateRequest(
        name="상담봇",
        nlu_type="semantic",
        nlu_model="semantic_engine_default",
        nlu_engine="semantic_engine_default",
        vector_connections={
            "intent": {
                "enabled": True,
                "endpoint_url": "https://vector.example.com/intent/search",
                "index_name": "aidot-intent",
                "api_key": "secret",
            }
        },
    )

    assert payload.vector_connections
    assert payload.vector_connections["intent"]["index_name"] == "aidot-intent"


def test_bot_update_accepts_model_options_per_nlu_type() -> None:
    semantic_payload = BotUpdateRequest(nlu_type="semantic", nlu_model="semantic_embedding_large")
    llm_payload = BotUpdateRequest(nlu_type="llm", nlu_model="llm_intent_reasoning")
    ml_payload = BotUpdateRequest(nlu_type="ml", nlu_model="ml_tfidf_linear")

    assert semantic_payload.nlu_model == "semantic_embedding_large"
    assert llm_payload.nlu_model == "llm_intent_reasoning"
    assert ml_payload.nlu_model == "ml_tfidf_linear"


def test_bot_update_rejects_mismatched_nlu_model() -> None:
    with pytest.raises(ValidationError):
        BotUpdateRequest(nlu_type="semantic", nlu_model="deep_learning_lite")


def test_bot_update_rejects_unknown_answer_mode() -> None:
    with pytest.raises(ValidationError):
        BotUpdateRequest(answer_mode="unknown")
