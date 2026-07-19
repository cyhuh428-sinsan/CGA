from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.embeddings import HashEmbeddingModel, OllamaEmbeddingModel, create_embedding_model
from app.main import app
from app.schemas import IntentDocument
from app.store import EmbeddingIndexMismatchError, JsonVectorStore, _has_contact_direction_conflict, _record_source


DOMAIN_DICTIONARY_TERMS = [
    {"name": "해지", "values": ["해약"], "domainEnabled": True},
    {"name": "취소", "values": [], "domainEnabled": True},
    {"name": "가입", "values": [], "domainEnabled": True},
    {"name": "계약", "values": [], "domainEnabled": True},
    {"name": "전화", "values": [], "domainEnabled": True},
    {"name": "통화", "values": [], "domainEnabled": True},
    {"name": "상담원", "values": [], "domainEnabled": True},
    {"name": "상담사", "values": [], "domainEnabled": True},
    {"name": "소요시간", "values": [], "domainEnabled": True},
    {"name": "상품", "values": [], "domainEnabled": True},
    {"name": "용어", "values": [], "domainEnabled": True},
]

CANDIDATE_DICTIONARY_TERMS = [
    *DOMAIN_DICTIONARY_TERMS,
    {"name": "고지의무", "values": [], "domainCandidate": True},
    {"name": "발신자", "values": [], "domainCandidate": True},
]


def test_aidot_vector_worker_provider_uses_local_embedding_model() -> None:
    model = create_embedding_model("aidot_vector_worker", "semantic_engine_default", dimension=64)

    assert isinstance(model, HashEmbeddingModel)
    assert model.name == "semantic_engine_default"


def test_vector_worker_health_reports_internal_default_engine() -> None:
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["embeddingProvider"] == "aidot_vector_worker"
    assert payload["embeddingModel"] == "semantic_engine_default"
    assert payload["embeddingDevice"] == "cpu"
    assert payload["ollamaBaseUrl"] is None
    assert payload["acceleration"]["available"] is None or isinstance(payload["acceleration"]["available"], bool)
    assert isinstance(payload["acceleration"]["execution_count"], int)


def test_ollama_embed_many_uses_one_batch_request(monkeypatch) -> None:
    model = OllamaEmbeddingModel("bge-m3:latest", base_url="http://ollama:11434")
    calls: list[tuple[str, dict[str, object]]] = []

    def fake_post_json(path: str, payload: dict[str, object]) -> dict[str, object]:
        calls.append((path, payload))
        return {"embeddings": [[3.0, 4.0], [0.0, 2.0]]}

    monkeypatch.setattr(model, "_post_json", fake_post_json)

    vectors = model.embed_many(["첫 문장", "", "둘째 문장"])

    assert calls == [
        ("/api/embed", {"model": "bge-m3:latest", "input": ["첫 문장", "둘째 문장"]})
    ]
    assert vectors == [[0.6, 0.8], [], [0.0, 1.0]]
    assert model.device == "ollama"


def test_intent_index_and_search(tmp_path) -> None:
    store = JsonVectorStore(tmp_path, HashEmbeddingModel(dimension=64))

    indexed = store.index_intents(
        bot_id="bot-1",
        version_id="version-1",
        index_name="aidot-intent",
        intents=[
            IntentDocument(intentId="intent-1", intentName="암진단비", utterances=["암 진단비 알려줘", "암 보장 금액"]),
            IntentDocument(intentId="intent-2", intentName="보험료", utterances=["보험료 납입 방법"]),
        ],
    )
    matches = store.search_intents(
        bot_id="bot-1",
        version_id="version-1",
        index_name="aidot-intent",
        query="암 보장 알려줘",
        top_k=3,
    )

    assert indexed == 5
    assert matches
    assert matches[0].intent_id == "intent-1"


def test_intent_name_is_indexed_and_exact_normalized_match_wins(tmp_path) -> None:
    store = JsonVectorStore(tmp_path, HashEmbeddingModel(dimension=64))

    store.index_intents(
        bot_id="bot-1",
        version_id="version-1",
        index_name="aidot-intent",
        intents=[
            IntentDocument(intentId="intent-1", intentName="용어 설명", utterances=["무슨 뜻이야"]),
            IntentDocument(intentId="intent-2", intentName="상품 설명 요청", utterances=["상품 설명"]),
        ],
    )
    matches = store.search_intents(
        bot_id="bot-1",
        version_id="version-1",
        index_name="aidot-intent",
        query="용어설명",
        top_k=3,
    )

    assert matches
    assert matches[0].intent_id == "intent-1"
    assert matches[0].score == 1.0


def test_legacy_intent_name_record_source_is_inferred() -> None:
    assert _record_source({"intentName": "발신자 확인"}) == "intentName"
    assert _record_source({"intentName": "발신자 확인"}, "발신자 확인") == "intentName"
    assert _record_source({"intentName": "발신자 확인"}, "바쁩니다") == "utterance"
    assert _record_source({"intentName": "발신자 확인", "utteranceIndex": 0}) == "utterance"


def test_contact_direction_conflict_detects_request_and_self_contact() -> None:
    assert _has_contact_direction_conflict("다음에 전화해", "제가 다음에 전화할게요")
    assert _has_contact_direction_conflict("다음에 전화해", "다음에 전화해서 해도 되죠")
    assert not _has_contact_direction_conflict("다음에 전화해", "내일 다시 전화해주세요")


def test_intent_index_and_search_api() -> None:
    client = TestClient(app)

    index_response = client.post(
        "/intent/index",
        json={
            "botId": "bot-api",
            "versionId": "version-api",
            "indexName": "aidot-intent",
            "intents": [
                {
                    "intentId": "intent-1",
                    "intentName": "암진단비",
                    "utterances": ["암 진단비 알려줘"],
                }
            ],
        },
    )
    search_response = client.post(
        "/intent/search",
        json={
            "botId": "bot-api",
            "versionId": "version-api",
            "indexName": "aidot-intent",
            "query": "암 진단비",
            "topK": 1,
        },
    )

    assert index_response.status_code == 200
    assert search_response.status_code == 200
    assert search_response.json()["matches"][0]["intentId"] == "intent-1"


def test_intent_batch_search_matches_single_search(tmp_path) -> None:
    class CountingEmbeddingModel(HashEmbeddingModel):
        def __init__(self) -> None:
            super().__init__(dimension=64, name="counting-hash")
            self.batch_calls: list[list[str]] = []

        def embed_many(self, texts: list[str]) -> list[list[float]]:
            self.batch_calls.append(list(texts))
            return super().embed_many(texts)

    model = CountingEmbeddingModel()
    store = JsonVectorStore(tmp_path, model)
    store.index_intents(
        bot_id="bot-batch",
        version_id="version-batch",
        index_name="aidot-intent",
        intents=[
            IntentDocument(intentId="intent-1", intentName="암진단비", utterances=["암 진단비 알려줘"]),
            IntentDocument(intentId="intent-2", intentName="보험료", utterances=["보험료 납입 방법"]),
        ],
    )
    queries = ["암 보장 알려줘", "보험료 어떻게 내요"]
    batch_matches = store.search_intents_batch(
        bot_id="bot-batch",
        version_id="version-batch",
        index_name="aidot-intent",
        queries=queries,
        top_k=2,
    )
    single_matches = [
        store.search_intents(
            bot_id="bot-batch",
            version_id="version-batch",
            index_name="aidot-intent",
            query=query,
            top_k=2,
        )
        for query in queries
    ]

    assert batch_matches == single_matches
    assert len(model.batch_calls) == 2
    assert model.batch_calls[1] == queries


def test_intent_batch_search_api() -> None:
    client = TestClient(app)
    index_response = client.post(
        "/intent/index",
        json={
            "botId": "bot-batch-api",
            "versionId": "version-batch-api",
            "indexName": "aidot-intent",
            "intents": [
                {"intentId": "intent-1", "intentName": "암진단비", "utterances": ["암 진단비 알려줘"]},
                {"intentId": "intent-2", "intentName": "보험료", "utterances": ["보험료 납입 방법"]},
            ],
        },
    )
    response = client.post(
        "/intent/search-batch",
        json={
            "botId": "bot-batch-api",
            "versionId": "version-batch-api",
            "indexName": "aidot-intent",
            "queries": ["암 보장 알려줘", "보험료 어떻게 내요"],
            "topK": 2,
        },
    )

    assert index_response.status_code == 200
    assert response.status_code == 200
    assert len(response.json()["matches"]) == 2
    assert response.json()["matches"][0][0]["intentId"] == "intent-1"


def test_intent_search_rejects_index_from_different_embedding_engine(tmp_path) -> None:
    indexed_store = JsonVectorStore(
        tmp_path,
        HashEmbeddingModel(dimension=64, name="legacy-hash"),
        "aidot_vector_worker",
    )
    indexed_store.index_intents(
        bot_id="bot-mismatch",
        version_id="version-mismatch",
        index_name="aidot-intent",
        intents=[IntentDocument(intentId="intent-1", intentName="상품 설명", utterances=["상품 설명해줘"])],
    )
    current_store = JsonVectorStore(
        tmp_path,
        HashEmbeddingModel(dimension=96, name="bge-m3:latest"),
        "ollama",
    )

    with pytest.raises(EmbeddingIndexMismatchError, match="다시 학습"):
        current_store.search_intents_batch(
            bot_id="bot-mismatch",
            version_id="version-mismatch",
            index_name="aidot-intent",
            queries=["상품 설명해줘"],
            top_k=1,
        )


def test_intent_search_api_returns_conflict_for_embedding_mismatch(tmp_path, monkeypatch) -> None:
    from app import main as vector_main

    indexed_store = JsonVectorStore(
        tmp_path,
        HashEmbeddingModel(dimension=64, name="legacy-hash"),
        "aidot_vector_worker",
    )
    indexed_store.index_intents(
        bot_id="bot-mismatch-api",
        version_id="version-mismatch-api",
        index_name="aidot-intent",
        intents=[IntentDocument(intentId="intent-1", intentName="상품 설명", utterances=["상품 설명해줘"])],
    )
    monkeypatch.setattr(
        vector_main,
        "store",
        JsonVectorStore(
            tmp_path,
            HashEmbeddingModel(dimension=96, name="bge-m3:latest"),
            "ollama",
        ),
    )

    response = TestClient(vector_main.app).post(
        "/intent/search",
        json={
            "botId": "bot-mismatch-api",
            "versionId": "version-mismatch-api",
            "indexName": "aidot-intent",
            "query": "상품 설명해줘",
            "topK": 1,
        },
    )

    assert response.status_code == 409
    assert "다시 학습" in response.json()["detail"]


def test_intent_configure_api_groups_similar_utterances() -> None:
    client = TestClient(app)

    response = client.post(
        "/intent/configure",
        json={
            "botId": "bot-configure",
            "versionId": "version-configure",
            "indexName": "aidot-intent",
            "utterances": [
                "해약한다고요",
                "해약 할겁니다",
                "취소를 하고싶어서요",
                "취소 신청 도와주세요",
            ],
            "targetCount": 2,
            "targetCountPolicy": "near",
            "dictionaryTerms": CANDIDATE_DICTIONARY_TERMS,
            "entityTerms": [],
            "scoring": {"dictionaryWeight": 1, "entityWeight": 1},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["targetCount"] == 2
    assert len(payload["groups"]) == 2
    assert sum(len(group["utterances"]) for group in payload["groups"]) == 4


def test_intent_configure_api_avoids_oversized_mixed_customer_groups() -> None:
    client = TestClient(app)

    utterances = [
        "계약 안했어요",
        "가입안했어요",
        "내가 가입 안했어요",
        "해약한다고요",
        "해지할게요",
        "보험 해지할래요",
        "지금 전화 못 해",
        "전화하지 말라고",
        "자꾸 전화하지 말라고",
        "상담원 바꿔주세요",
        "상담사 연결해주세요",
        "사람이랑 통화할래요",
        "이거 얼마나 걸리는데요",
        "소요시간 문의",
        "몇 분 걸려요",
        "보험 보장 내용을 자세히 듣고싶어",
        "상품 설명 요청",
        "보험 설명해줘",
        "무슨 말인지 알려주세요",
        "용어 설명",
    ]
    response = client.post(
        "/intent/configure",
        json={
            "botId": "bot-configure-mixed",
            "versionId": "version-configure-mixed",
            "indexName": "aidot-intent",
            "utterances": utterances,
            "targetCount": 6,
            "targetCountPolicy": "near",
            "dictionaryTerms": DOMAIN_DICTIONARY_TERMS,
            "entityTerms": [{"name": "보험", "values": ["암보험", "화재보험"]}],
            "scoring": {"dictionaryWeight": 1, "entityWeight": 10},
        },
    )

    assert response.status_code == 200
    groups = response.json()["groups"]
    assert 6 <= len(groups) <= 10
    assert max(len(group["utterances"]) for group in groups) <= 11
    joined_groups = ["\n".join(group["utterances"]) for group in groups]
    assert not any("계약 안했어요" in group and "상담원 바꿔주세요" in group for group in joined_groups)
    assert not any("보험 해지할래요" in group and "소요시간 문의" in group for group in joined_groups)
    assert not any("가입안했어요" in group and "전화하지 말라고" in group for group in joined_groups)
    assert not any("상담원 바꿔주세요" in group and "소요시간 문의" in group for group in joined_groups)
    assert not any("무슨 말인지 알려주세요" in group and "지금 전화 못 해" in group for group in joined_groups)


def test_intent_configure_api_respects_question_axes() -> None:
    client = TestClient(app)

    utterances = [
        "가입안했어요",
        "내가 가입 안했어요",
        "계약 안했어요",
        "디비에 보험 없는데 왜 전화해요",
        "왜 전화했어요",
        "무슨 일로 전화했어요",
        "전화한 분 누구에요",
        "어디서 전화했어요",
        "발신자 확인",
        "이거 얼마나 걸리는데요",
        "몇 분 걸려요",
        "소요시간 문의",
        "보험 보장 내용을 자세히 듣고싶어",
        "상품 설명 요청",
        "해지 어떻게 해요",
        "보험 해지할래요",
        "상담원 바꿔주세요",
        "사람이랑 통화할래요",
    ]
    response = client.post(
        "/intent/configure",
        json={
            "botId": "bot-configure-question-axis",
            "versionId": "version-configure-question-axis",
            "indexName": "aidot-intent",
            "utterances": utterances,
            "targetCount": 7,
            "targetCountPolicy": "near",
            "dictionaryTerms": CANDIDATE_DICTIONARY_TERMS,
            "entityTerms": [{"name": "보험", "values": ["암보험", "화재보험"]}],
            "scoring": {"dictionaryWeight": 1, "entityWeight": 10},
        },
    )

    assert response.status_code == 200
    groups = response.json()["groups"]
    assert len(groups) >= 6
    assert max(len(group["utterances"]) for group in groups) <= 7
    joined_groups = ["\n".join(group["utterances"]) for group in groups]
    assert not any("가입안했어요" in group and "왜 전화했어요" in group for group in joined_groups)
    assert not any("디비에 보험 없는데 왜 전화해요" in group and "가입안했어요" in group for group in joined_groups)
    assert not any("전화한 분 누구에요" in group and "보험 보장 내용을 자세히 듣고싶어" in group for group in joined_groups)
    assert not any("이거 얼마나 걸리는데요" in group and "왜 전화했어요" in group for group in joined_groups)
    assert not any("해지 어떻게 해요" in group and "전화한 분 누구에요" in group for group in joined_groups)


def test_intent_configure_api_prevents_giant_near_policy_group() -> None:
    client = TestClient(app)

    utterances: list[str] = []
    for index in range(18):
        utterances.extend(
            [
                f"해지 요청합니다 {index}",
                f"가입 안했어요 {index}",
                f"전화하지 마세요 {index}",
                f"지금 통화 못해요 {index}",
                f"상담원 연결해주세요 {index}",
                f"소요시간 알려주세요 {index}",
                f"상품 보장 설명해주세요 {index}",
                f"고지의무 뜻 알려주세요 {index}",
            ]
        )

    response = client.post(
        "/intent/configure",
        json={
            "botId": "bot-configure-large",
            "versionId": "version-configure-large",
            "indexName": "aidot-intent",
            "utterances": utterances,
            "targetCount": 20,
            "targetCountPolicy": "near",
            "dictionaryTerms": CANDIDATE_DICTIONARY_TERMS,
            "entityTerms": [{"name": "보험", "values": ["암보험", "화재보험"]}],
            "scoring": {"dictionaryWeight": 1, "entityWeight": 10},
        },
    )

    assert response.status_code == 200
    groups = response.json()["groups"]
    assert len(groups) >= 20
    assert len(groups) <= 25
    assert max(len(group["utterances"]) for group in groups) <= 15
    joined_groups = ["\n".join(group["utterances"]) for group in groups]
    assert not any("가입 안했어요" in group and "상담원 연결해주세요" in group for group in joined_groups)
    assert not any("전화하지 마세요" in group and "소요시간 알려주세요" in group for group in joined_groups)
    assert not any("상품 보장 설명해주세요" in group and "고지의무 뜻 알려주세요" in group for group in joined_groups)
    diagnostics = response.json()["diagnostics"]
    assert diagnostics["domainTermCount"] == len(DOMAIN_DICTIONARY_TERMS)
    assert diagnostics["domainCandidateCount"] == 2


def test_answer_search_uses_embedding_engine_locked_at_index_time(tmp_path, monkeypatch) -> None:
    from app import main as vector_main

    vector_main.store = JsonVectorStore(tmp_path, HashEmbeddingModel(dimension=64, name="default-engine"))
    calls: list[tuple[str | None, str | None]] = []

    def fake_answer_embedding_model(provider: str | None, model_name: str | None):
        calls.append((provider, model_name))
        return HashEmbeddingModel(dimension=64, name=model_name or "default-engine")

    monkeypatch.setattr(vector_main, "_answer_embedding_model", fake_answer_embedding_model)
    client = TestClient(vector_main.app)

    index_response = client.post(
        "/answer/index",
        json={
            "botId": "bot-rag",
            "versionId": "version-rag",
            "indexName": "aidot-answer",
            "embeddingProvider": "provider-indexed",
            "embeddingModel": "engine-indexed",
            "documents": [
                {
                    "documentId": "answer-1",
                    "title": "보장 안내",
                    "text": "암 진단비 보장 내용을 안내합니다.",
                    "metadata": {"sourceType": "text"},
                }
            ],
        },
    )
    search_response = client.post(
        "/answer/search",
        json={
            "botId": "bot-rag",
            "versionId": "version-rag",
            "indexName": "aidot-answer",
            "embeddingProvider": "provider-requested",
            "embeddingModel": "engine-requested",
            "query": "암 진단비",
            "topK": 1,
        },
    )

    assert index_response.status_code == 200
    assert search_response.status_code == 200
    assert calls[0] == ("provider-indexed", "engine-indexed")
    assert calls[1] == ("provider-indexed", "engine-indexed")
