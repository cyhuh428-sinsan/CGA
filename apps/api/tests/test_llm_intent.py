from __future__ import annotations

import json

from app.services.llm_client import LlmChatClient, LlmChatResult, LlmClientError, LlmProviderConfig, resolve_llm_provider_config
from app.services.llm_intent import classify_intent_with_llm, configure_intents_with_llm
from app.services.llm_nlu import build_llm_nlu_training_snapshot


class FakeLlmClient:
    config = LlmProviderConfig(provider="ollama", model="llama3.1:latest", base_url="http://localhost:11434")

    def chat(self, *, system_prompt: str, user_prompt: str, json_mode: bool = False) -> LlmChatResult:
        assert "한국어 NLU 의도 분류 엔진" in system_prompt
        assert json_mode is True
        assert "상담원 연결해주세요" in user_prompt
        payload = json.loads(user_prompt)
        assert "dictionaryTerms" in payload
        assert "entityTerms" in payload
        return LlmChatResult(
            content='{"candidates":[{"intentId":"intent-2","confidence":0.93,"reason":"상담원 연결 요청"}]}',
            provider="ollama",
            model="llama3.1:latest",
            latency_ms=17,
            raw={},
        )


def test_build_llm_nlu_training_snapshot_stores_training_references() -> None:
    snapshot = build_llm_nlu_training_snapshot(
        version_json={
            "dialogs": [
                {
                    "id": "intent-1",
                    "dialogType": 1,
                    "name": "해지 요청",
                    "utterances": [
                        {"utteranceType": "T", "text": "해약하고 싶어요"},
                        {"utteranceType": "V", "text": "해지할게요"},
                        {"utteranceType": "T", "text": "이미 해지했어요"},
                    ],
                },
                {"id": "dialog-1", "dialogType": 2, "name": "일반 대화", "utterances": ["제외"]},
            ],
            "dictionary": [{"word": "해지", "synonyms": ["해약", "취소"]}],
            "entities": [{"name": "상품", "examples": ["보험"]}],
        },
        ai_config={
            "nlu_type": "llm",
            "nlu_model": "llm_engine_default",
            "llm_provider": "groq",
            "llm_model": "llama-3.3-70b-versatile",
        },
        trained_at="2026-05-19T01:02:03+09:00",
        trained_by_login_id="cyhuh",
        score_cutoff=0.7,
        similar_intent_score=0.82,
        max_intent_results=5,
    )

    assert snapshot["status"] == "success"
    assert snapshot["engine_type"] == "llm"
    assert snapshot["trained_by_login_id"] == "cyhuh"
    assert snapshot["llm_provider"] == "groq"
    assert snapshot["llm_model"] == "llama-3.3-70b-versatile"
    assert snapshot["classification_policy"] == {
        "score_cutoff": 0.7,
        "similar_intent_score": 0.82,
        "max_intent_results": 5,
    }
    assert snapshot["snapshot"]["intents"] == [
        {
            "intentId": "intent-1",
            "intentName": "해지 요청",
            "utterances": ["해약하고 싶어요", "이미 해지했어요"],
        }
    ]
    assert snapshot["snapshot"]["dictionary_terms"] == [{"name": "해지", "values": ["해약", "취소"]}]
    assert snapshot["snapshot"]["entity_terms"] == [{"name": "상품", "values": ["보험"]}]
    assert snapshot["counts"]["intent_documents"] == 2
    assert snapshot["counts"]["entity_documents"] == 1
    assert snapshot["counts"]["vocabulary"] == 1


def test_classify_intent_with_llm_parses_json_candidates() -> None:
    result = classify_intent_with_llm(
        provider="ollama",
        model="llama3.1-local",
        query="상담원 연결해주세요",
        intents=[
            {"intentId": "intent-1", "intentName": "해지 요청", "utterances": ["해약할래요"]},
            {"intentId": "intent-2", "intentName": "상담사 전환 요청", "utterances": ["상담원 연결해줘"]},
        ],
        client=FakeLlmClient(),
    )

    assert result.provider == "ollama"
    assert result.model == "llama3.1:latest"
    assert result.candidates[0].intent_id == "intent-2"
    assert result.candidates[0].intent_name == "상담사 전환 요청"
    assert result.candidates[0].confidence == 0.93


class FakeRetryJsonClient:
    config = LlmProviderConfig(provider="groq", model="llama-3.3-70b-versatile", base_url="https://api.groq.com/openai/v1")

    def __init__(self) -> None:
        self.calls = 0
        self.json_modes: list[bool] = []

    def chat(self, *, system_prompt: str, user_prompt: str, json_mode: bool = False) -> LlmChatResult:
        self.calls += 1
        self.json_modes.append(json_mode)
        if self.calls == 1:
            return LlmChatResult(
                content="이 문장은 상담사 연결 요청으로 보입니다.",
                provider="groq",
                model="llama-3.3-70b-versatile",
                latency_ms=15,
                raw={},
            )
        assert "Aidot에서 처리할 수 없는 JSON" in user_prompt
        return LlmChatResult(
            content='{"candidates":[{"intentId":"intent-2","confidence":0.91,"reason":"재요청 JSON"}]}',
            provider="groq",
            model="llama-3.3-70b-versatile",
            latency_ms=16,
            raw={},
        )


def test_classify_intent_retries_when_response_is_not_json() -> None:
    client = FakeRetryJsonClient()

    result = classify_intent_with_llm(
        provider="groq",
        model="llama-3.3-70b-versatile",
        query="상담원 연결해주세요",
        intents=[
            {"intentId": "intent-1", "intentName": "해지 요청", "utterances": ["해약할래요"]},
            {"intentId": "intent-2", "intentName": "상담사 전환 요청", "utterances": ["상담원 연결해줘"]},
        ],
        client=client,
    )

    assert client.calls == 2
    assert client.json_modes == [True, False]
    assert result.candidates[0].intent_id == "intent-2"


class FakeReferenceAwareLlmClient:
    config = LlmProviderConfig(provider="groq", model="llama-3.3-70b-versatile", base_url="https://api.groq.com/openai/v1")

    def chat(self, *, system_prompt: str, user_prompt: str, json_mode: bool = False) -> LlmChatResult:
        assert "dictionaryTerms" in user_prompt
        assert "entityTerms" in user_prompt
        assert "서로 다른 목적을 합치지 않는다" in system_prompt
        assert json_mode is True
        payload = json.loads(user_prompt)
        assert payload["dictionaryTerms"] == [{"name": "해지", "values": ["해약", "취소"]}]
        assert payload["entityTerms"] == [{"name": "보험사", "values": ["삼성생명"]}]
        return LlmChatResult(
            content='{"candidates":[{"intentId":"intent-1","confidence":88,"reason":"해지 동의어"}]}',
            provider="groq",
            model="llama-3.3-70b-versatile",
            latency_ms=21,
            raw={},
        )


def test_classify_intent_with_llm_includes_dictionary_and_entity_terms() -> None:
    result = classify_intent_with_llm(
        provider="groq",
        model="llama-3.3-70b-versatile",
        query="해약하고 싶어요",
        intents=[
            {"intentId": "intent-1", "intentName": "해지 요청", "utterances": ["해지할래요"]},
        ],
        dictionary_terms=[{"word": "해지", "synonyms": ["해약", "취소"]}],
        entity_terms=[{"name": "보험사", "values": ["삼성생명"]}],
        client=FakeReferenceAwareLlmClient(),
    )

    assert result.candidates[0].confidence == 0.88


class FakeConfigureClient:
    config = LlmProviderConfig(provider="groq", model="llama-3.3-70b-versatile", base_url="https://api.groq.com/openai/v1")

    def chat(self, *, system_prompt: str, user_prompt: str, json_mode: bool = False) -> LlmChatResult:
        assert "한국어 NLU 의도 구성 엔진" in system_prompt
        assert "targetGroupCount" in user_prompt
        assert json_mode is True
        return LlmChatResult(
            content=(
                '{"groups":['
                '{"name":"해지 요청","answer":"해지 요청을 도와드리겠습니다.","utteranceIndexes":[1,2],"reason":"해지 의도"},'
                '{"name":"상담사 연결","answer":"상담사를 연결해드리겠습니다.","utteranceIndexes":[3],"reason":"상담사 연결 요청"}'
                ']}'
            ),
            provider="groq",
            model="llama-3.3-70b-versatile",
            latency_ms=31,
            raw={},
        )


def test_configure_intents_with_llm_groups_by_indexes() -> None:
    result = configure_intents_with_llm(
        provider="groq",
        model="llama-3.3-70b-versatile",
        utterances=["해약하고 싶어요", "이미 해지했어요", "상담사 연결해주세요"],
        target_count=2,
        client=FakeConfigureClient(),
    )

    assert result.provider == "groq"
    assert result.model == "llama-3.3-70b-versatile"
    assert [group.name for group in result.groups] == ["해지 요청", "상담사 연결"]
    assert result.groups[0].utterances == ["해약하고 싶어요", "이미 해지했어요"]


def test_configure_intents_splits_large_groups_toward_target_count() -> None:
    result = configure_intents_with_llm(
        provider="groq",
        model="llama-3.3-70b-versatile",
        utterances=["해약하고 싶어요", "이미 해지했어요", "상담사 연결해주세요"],
        target_count=3,
        client=FakeConfigureClient(),
    )

    assert len(result.groups) == 3
    assert [utterance for group in result.groups for utterance in group.utterances] == [
        "해약하고 싶어요",
        "상담사 연결해주세요",
        "이미 해지했어요",
    ]


def test_configure_intents_minimize_policy_keeps_llm_group_count() -> None:
    result = configure_intents_with_llm(
        provider="groq",
        model="llama-3.3-70b-versatile",
        utterances=["해약하고 싶어요", "이미 해지했어요", "상담사 연결해주세요"],
        target_count=3,
        target_count_policy="minimize",
        client=FakeConfigureClient(),
    )

    assert len(result.groups) == 2
    assert result.groups[0].utterances == ["해약하고 싶어요", "이미 해지했어요"]


class FakeOverGroupedConfigureClient:
    config = LlmProviderConfig(provider="groq", model="llama-3.3-70b-versatile", base_url="https://api.groq.com/openai/v1")

    def chat(self, *, system_prompt: str, user_prompt: str, json_mode: bool = False) -> LlmChatResult:
        assert "정확히 targetGroupCount" in system_prompt
        return LlmChatResult(
            content=(
                '{"groups":['
                '{"name":"해지","answer":"해지를 도와드리겠습니다.","utteranceIndexes":[1],"reason":"해지"},'
                '{"name":"취소","answer":"취소를 도와드리겠습니다.","utteranceIndexes":[2],"reason":"취소"},'
                '{"name":"상담사","answer":"상담사를 연결해드리겠습니다.","utteranceIndexes":[3],"reason":"상담사"}'
                ']}'
            ),
            provider="groq",
            model="llama-3.3-70b-versatile",
            latency_ms=31,
            raw={},
        )


def test_configure_intents_exact_policy_merges_over_target_groups() -> None:
    result = configure_intents_with_llm(
        provider="groq",
        model="llama-3.3-70b-versatile",
        utterances=["해약하고 싶어요", "취소할래요", "상담사 연결해주세요"],
        target_count=2,
        target_count_policy="exact",
        client=FakeOverGroupedConfigureClient(),
    )

    assert len(result.groups) == 2
    assert sum(len(group.utterances) for group in result.groups) == 3


class FakeSchemaOnlyConfigureClient:
    config = LlmProviderConfig(provider="cerebras", model="llama3.1-8b", base_url="https://api.cerebras.ai/v1")

    def __init__(self) -> None:
        self.calls = 0
        self.json_modes: list[bool] = []

    def chat(self, *, system_prompt: str, user_prompt: str, json_mode: bool = False) -> LlmChatResult:
        self.calls += 1
        self.json_modes.append(json_mode)
        if self.calls == 1:
            return LlmChatResult(
                content='{"type":"object"}',
                provider="cerebras",
                model="llama3.1-8b",
                latency_ms=22,
                raw={},
            )
        assert "JSON schema" in user_prompt
        return LlmChatResult(
            content='{"groups":[{"name":"해지","answer":"해지신청을 도와드리겠습니다.","utteranceIndexes":[1,2],"reason":"해지 요청"}]}',
            provider="cerebras",
            model="llama3.1-8b",
            latency_ms=23,
            raw={},
        )


def test_configure_intents_retries_when_provider_returns_schema_object() -> None:
    client = FakeSchemaOnlyConfigureClient()

    result = configure_intents_with_llm(
        provider="cerebras",
        model="llama3.1-8b",
        utterances=["해약한다고요", "이미 해지했어요"],
        target_count=1,
        client=client,
    )

    assert client.calls == 2
    assert client.json_modes == [True, False]
    assert result.groups[0].name == "해지"


def test_ollama_base_url_strips_api_endpoint(monkeypatch) -> None:
    monkeypatch.setenv("AIDOT_OLLAMA_BASE_URL", "http://192.168.220.180:11434/api/chat")

    config = resolve_llm_provider_config("ollama", "llama3.1-local")

    assert config.base_url == "http://192.168.220.180:11434"
    assert config.timeout_seconds is None


def test_resolve_llm_provider_config_requires_explicit_provider_and_model() -> None:
    try:
        resolve_llm_provider_config(None, "llama3.1-local")
    except LlmClientError as exc:
        assert str(exc) == "LLM Provider가 설정되지 않았습니다."
    else:
        raise AssertionError("provider 누락 시 오류가 발생해야 합니다.")

    try:
        resolve_llm_provider_config("ollama", None)
    except LlmClientError as exc:
        assert str(exc) == "LLM 모델이 설정되지 않았습니다."
    else:
        raise AssertionError("model 누락 시 오류가 발생해야 합니다.")


def test_configured_ollama_base_url_takes_priority(monkeypatch) -> None:
    monkeypatch.setenv("AIDOT_OLLAMA_BASE_URL", "http://localhost:11434")

    config = resolve_llm_provider_config(
        "ollama",
        "llama3.1-local",
        base_url="http://192.168.220.180:11434/api/generate",
    )

    assert config.base_url == "http://192.168.220.180:11434"


def test_ollama_timeout_env_is_ignored_in_development(monkeypatch) -> None:
    monkeypatch.setenv("AIDOT_LLM_TIMEOUT_SECONDS", "90")
    monkeypatch.setenv("AIDOT_OLLAMA_TIMEOUT_SECONDS", "420")

    config = resolve_llm_provider_config("ollama", "llama3.1-local")

    assert config.timeout_seconds is None


def test_explicit_ollama_timeout_is_ignored_in_development(monkeypatch) -> None:
    monkeypatch.setenv("AIDOT_OLLAMA_TIMEOUT_SECONDS", "420")

    config = resolve_llm_provider_config("ollama", "llama3.1-local", timeout_seconds=1800)

    assert config.timeout_seconds is None


def test_non_ollama_timeout_env_is_ignored_in_development(monkeypatch) -> None:
    monkeypatch.setenv("AIDOT_LLM_TIMEOUT_SECONDS", "90")
    monkeypatch.setenv("GROQ_API_KEY", "env-key")

    config = resolve_llm_provider_config("groq", "llama-3.3-70b-versatile")

    assert config.timeout_seconds is None


def test_server_env_api_key_takes_priority(monkeypatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "env-key")

    config = resolve_llm_provider_config("groq", "llama-3.3-70b-versatile", api_key="screen-key")

    assert config.api_key == "env-key"


def test_ollama_chat_falls_back_to_generate() -> None:
    calls: list[str] = []

    class GenerateFallbackClient(LlmChatClient):
        def _post_json(self, endpoint: str, payload: dict, headers: dict | None = None) -> dict:
            calls.append(endpoint)
            if endpoint.endswith("/api/chat"):
                raise LlmClientError("chat unavailable")
            return {"response": "ok"}

    client = GenerateFallbackClient(
        LlmProviderConfig(provider="ollama", model="llama3.1:latest", base_url="http://192.168.220.180:11434")
    )

    result = client.chat(system_prompt="system", user_prompt="user")

    assert result.content == "ok"
    assert calls == [
        "http://192.168.220.180:11434/api/chat",
        "http://192.168.220.180:11434/api/generate",
    ]


def test_openai_compatible_json_mode_adds_response_format() -> None:
    payloads: list[dict] = []

    class JsonModeClient(LlmChatClient):
        def _post_json(self, endpoint: str, payload: dict, headers: dict | None = None) -> dict:
            payloads.append(payload)
            return {"choices": [{"message": {"content": '{"ok":true}'}}]}

    client = JsonModeClient(
        LlmProviderConfig(
            provider="groq",
            model="llama-3.3-70b-versatile",
            base_url="https://api.groq.com/openai/v1",
            api_key="key",
        )
    )

    result = client.chat(system_prompt="system", user_prompt="user", json_mode=True)

    assert result.content == '{"ok":true}'
    assert payloads[0]["response_format"] == {"type": "json_object"}


def test_ollama_json_mode_adds_format_to_chat_and_generate() -> None:
    payloads: list[dict] = []

    class JsonModeFallbackClient(LlmChatClient):
        def _post_json(self, endpoint: str, payload: dict, headers: dict | None = None) -> dict:
            payloads.append(payload)
            if endpoint.endswith("/api/chat"):
                raise LlmClientError("chat unavailable")
            return {"response": '{"ok":true}'}

    client = JsonModeFallbackClient(
        LlmProviderConfig(provider="ollama", model="llama3.1:latest", base_url="http://192.168.220.180:11434")
    )

    result = client.chat(system_prompt="system", user_prompt="user", json_mode=True)

    assert result.content == '{"ok":true}'
    assert payloads[0]["format"] == "json"
    assert payloads[1]["format"] == "json"
