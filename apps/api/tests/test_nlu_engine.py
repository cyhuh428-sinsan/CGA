import inspect
from pathlib import Path
from app.services.bot_ai_policy import runtime_block_reason, training_block_reason
from app.services.nlu_engine import BotNluEngine, embedding_provider_for_bot, intent_embedding_documents_from_version
from app.services.nlu.deep_learning_lite import (
    _calculate_accuracy,
    _classify_eval_model,
    _write_model_atomic,
    build_deep_learning_lite_model,
    build_learning_token_context,
    classify_deep_learning_lite_model,
    configure_intents_with_deep_learning_lite,
    get_ml_acceleration_status,
    train_and_save_deep_learning_lite_model,
    tokenize_texts_for_deep_learning_lite,
)


def test_intent_embedding_documents_from_training_utterances() -> None:
    docs = intent_embedding_documents_from_version(
        {
            "dialogs": [
                {
                    "id": "intent-1",
                    "dialogType": 1,
                    "name": "암진단비",
                    "utterances": [{"text": "암 진단비 알려줘"}, {"text": "암 보장 금액"}],
                },
                {"id": "module-1", "dialogType": 0, "name": "모듈", "utterances": [{"text": "제외"}]},
            ]
        }
    )

    assert len(docs) == 2
    assert docs[0].intent_name == "암진단비"
    assert all(doc.source == "utterance" for doc in docs)


def test_bot_nlu_engine_classifies_by_embedding_similarity() -> None:
    engine = BotNluEngine(
        {
            "dialogs": [
                {"id": "intent-1", "dialogType": 1, "name": "보험료납입", "utterances": [{"text": "보험료 납입 방법"}]},
                {"id": "intent-2", "dialogType": 1, "name": "암진단비", "utterances": [{"text": "암 진단비 알려줘"}]},
            ]
        },
        provider="ml_embedding",
    )

    matches = engine.classify("암 진단비 궁금해")

    assert matches
    assert matches[0].intent_name == "암진단비"
    assert matches[0].provider == "ml_embedding"


def test_embedding_provider_for_bot_separates_ml_and_llm_embedding() -> None:
    assert embedding_provider_for_bot({"nlu_type": "ml", "nlu_model": "deep_learning_lite"}) == "local_ml"
    assert embedding_provider_for_bot({"nlu_type": "semantic", "nlu_model": "semantic_engine_default"}) == "ml_embedding"
    assert embedding_provider_for_bot({"nlu_type": "llm", "nlu_model": "llm_engine_default"}) == "llm_embedding"


def test_runtime_and_training_block_reasons_keep_current_supported_combination() -> None:
    assert runtime_block_reason({"nlu_type": "ml", "nlu_model": "deep_learning_lite", "answer_mode": "fixed"}) is None
    assert training_block_reason({"nlu_type": "ml", "nlu_model": "deep_learning_lite"}) is None
    assert (
        runtime_block_reason(
            {
                "nlu_type": "semantic",
                "nlu_model": "semantic_engine_default",
                "answer_mode": "fixed",
                "vector_connections": {
                    "intent": {
                        "enabled": True,
                        "endpoint_url": "https://vector.example.com/intent/search",
                        "index_name": "aidot-intent",
                    }
                },
            }
        )
        is None
    )
    assert runtime_block_reason({"nlu_type": "semantic", "nlu_model": "semantic_engine_default", "answer_mode": "fixed"}) is None
    assert runtime_block_reason({"nlu_type": "llm", "nlu_model": "llm_engine_default", "answer_mode": "fixed"}) is None
    assert training_block_reason({"nlu_type": "semantic", "nlu_model": "semantic_engine_default"}) is None
    assert (
        training_block_reason(
            {
                "nlu_type": "semantic",
                "nlu_model": "semantic_engine_default",
                "vector_connections": {
                    "intent": {
                        "enabled": True,
                        "endpoint_url": "https://vector.example.com/intent/search",
                        "index_name": "aidot-intent",
                    }
                },
            }
        )
        is None
    )


def test_semantic_vector_policy_accepts_legacy_string_settings() -> None:
    data_json = {
        "nlu_type": "semantic",
        "nlu_model": "semantic_engine_default",
        "answer_mode": "fixed",
        "vector_connections": {
            "intent": {
                "enabled": "true",
                "endpointUrl": "http://localhost:8350/intent/search",
                "indexName": "aidot-intent",
            }
        },
    }

    assert runtime_block_reason(data_json) is None
    assert training_block_reason(data_json) is None


def test_semantic_vector_policy_defaults_intent_index_name() -> None:
    data_json = {
        "nlu_type": "semantic",
        "nlu_model": "semantic_engine_default",
        "answer_mode": "fixed",
        "vector_connections": {
            "intent": {
                "enabled": True,
                "endpoint_url": "http://localhost:8350/intent/search",
            }
        },
    }

    assert runtime_block_reason(data_json) is None
    assert training_block_reason(data_json) is None


def test_rag_answer_training_builds_precomputed_answer_cache() -> None:
    from app.api.routes.bots import (
        _build_answer_training_documents,
        _build_precomputed_answer_training_cache,
    )
    from app.schemas.bot import AnswerTrainingSource, VersionNluTrainRequest

    version_json = {
        "dialogs": [
            {"id": "intent-price", "dialogType": 1, "name": "요금 문의"},
            {"id": "intent-cancel", "dialogType": 1, "name": "해지 요청"},
        ]
    }
    payload = VersionNluTrainRequest(
        answer_training=AnswerTrainingSource(
            source_type="text",
            title="답변",
            text="의도 : 요금 문의\n답변 : 요금은 월 1만원입니다.\n\n의도 : 해지 요청\n답변 : 해지는 고객센터에서 가능합니다.",
        )
    )

    documents = _build_answer_training_documents(version_json, payload, {"nlu_type": "semantic", "answer_mode": "semantic_rag"})
    cache = _build_precomputed_answer_training_cache(documents)

    assert cache["answer_count"] == 2
    assert cache["by_intent_id"]["intent-price"]["text"] == "요금은 월 1만원입니다."
    assert cache["by_intent_name"]["해지요청"]["intentId"] == "intent-cancel"


def test_rag_answer_training_requires_semantic_or_llm_nlu() -> None:
    from app.api.routes.bots import _build_answer_training_documents
    from app.schemas.bot import AnswerTrainingSource, VersionNluTrainRequest
    from fastapi import HTTPException

    payload = VersionNluTrainRequest(
        answer_training=AnswerTrainingSource(
            source_type="text",
            title="답변",
            text="의도 : 요금 문의\n답변 : 요금 안내입니다.",
        )
    )

    assert _build_answer_training_documents({}, payload, {"nlu_type": "ml", "answer_mode": "semantic_rag"}) == []
    try:
        _build_answer_training_documents({}, payload, {"nlu_type": "llm", "answer_mode": "llm_rag"})
    except HTTPException as exc:
        assert exc.status_code == 400
        assert exc.detail == "LLM RAG 답변을 사용하려면 LLM Provider와 모델을 먼저 설정해주세요."
    else:
        raise AssertionError("LLM Provider/모델 누락 시 오류가 발생해야 합니다.")


def test_rag_answer_training_selects_embedding_engine_for_text_and_pdf_sources() -> None:
    from app.api.routes.bots import _build_answer_training_documents
    from app.schemas.bot import AnswerTrainingSource, VersionNluTrainRequest

    text_payload = VersionNluTrainRequest(
        answer_training=AnswerTrainingSource(
            source_type="text",
            title="일반 안내",
            text="의도 : 상품 문의\n답변 : 상품의 주요 내용을 안내합니다.",
        )
    )
    text_documents = _build_answer_training_documents(
        {"dialogs": [{"id": "intent-product", "dialogType": 1, "name": "상품 문의"}]},
        text_payload,
        {"nlu_type": "semantic", "answer_mode": "semantic_rag"},
    )

    assert text_documents[0]["metadata"]["embeddingProvider"] == "aidot_vector_worker"
    assert text_documents[0]["metadata"]["embeddingModel"] == "semantic_engine_default"

    # PDF extraction itself is tested separately; the profile detector must still select a legal-document engine.
    from app.api.routes.bots import _detect_answer_document_profile, _select_answer_embedding_engine

    profile = _detect_answer_document_profile(
        "제1조 목적\n이 약관은 보험계약의 보장내용을 정합니다.\n\n제2조 보험금\n보험금 지급 기준입니다.\n\n제3조 면책\n면책 사항입니다.",
        "pdf",
        "보험 약관",
    )
    engine = _select_answer_embedding_engine(profile)

    assert profile["profile"] == "korean_legal_terms"
    assert engine["embedding_provider"] == "ollama"
    assert engine["embedding_model"] == "bge-m3:latest"


def test_semantic_vector_default_rag_answer_training_does_not_use_external_embedding_server() -> None:
    from app.api.routes.bots import _build_answer_training_documents
    from app.schemas.bot import AnswerTrainingSource, VersionNluTrainRequest

    payload = VersionNluTrainRequest(
        answer_training=AnswerTrainingSource(
            source_type="pdf",
            title="보험 약관",
            text="제1조 목적\n이 약관은 보험계약의 보장내용을 정합니다.\n\n제2조 보험금\n보험금 지급 기준입니다.\n\n제3조 면책\n면책 사항입니다.",
        )
    )

    documents = _build_answer_training_documents(
        {"dialogs": [{"id": "intent-policy", "dialogType": 1, "name": "약관 문의"}]},
        payload,
        {
            "nlu_type": "semantic_vector",
            "nlu_model": "semantic_engine_default",
            "answer_mode": "semantic_rag",
        },
    )

    assert documents[0]["metadata"]["embeddingProvider"] == "aidot_vector_worker"
    assert documents[0]["metadata"]["embeddingModel"] == "semantic_engine_default"


def test_rag_answer_training_uses_semantic_external_embedding_model() -> None:
    from app.api.routes.bots import _build_answer_training_documents
    from app.schemas.bot import AnswerTrainingSource, VersionNluTrainRequest

    payload = VersionNluTrainRequest(
        answer_training=AnswerTrainingSource(
            source_type="text",
            title="답변",
            text="의도 : 약관 문의\n답변 : 약관 내용을 안내합니다.",
        )
    )

    documents = _build_answer_training_documents(
        {"dialogs": [{"id": "intent-policy", "dialogType": 1, "name": "약관 문의"}]},
        payload,
        {
            "nlu_type": "semantic_external",
            "nlu_model": "semantic_ollama_bge_m3",
            "answer_mode": "semantic_rag",
        },
    )

    assert documents[0]["metadata"]["embeddingProvider"] == "ollama"
    assert documents[0]["metadata"]["embeddingModel"] == "bge-m3:latest"
    assert documents[0]["metadata"]["embeddingSelection"] == "auto"


def test_llm_rag_answer_training_uses_selected_llm_model_for_embedding() -> None:
    from app.api.routes.bots import _build_answer_training_documents
    from app.schemas.bot import AnswerTrainingSource, VersionNluTrainRequest

    payload = VersionNluTrainRequest(
        answer_training=AnswerTrainingSource(
            source_type="text",
            title="답변",
            text="의도 : 매뉴얼 문의\n답변 : 매뉴얼 내용을 안내합니다.",
        )
    )

    documents = _build_answer_training_documents(
        {"dialogs": [{"id": "intent-manual", "dialogType": 1, "name": "매뉴얼 문의"}]},
        payload,
        {
            "nlu_type": "llm",
            "nlu_model": "llm_engine_default",
            "answer_mode": "llm_rag",
            "llm_provider": "groq",
            "llm_model": "llama-3.3-70b-versatile",
        },
    )

    assert documents[0]["metadata"]["embeddingProvider"] == "llm:groq"
    assert documents[0]["metadata"]["embeddingModel"] == "llama-3.3-70b-versatile"
    assert documents[0]["metadata"]["embeddingSelection"] == "auto"


def test_rag_pdf_answer_training_builds_vector_documents_without_precomputed_cache() -> None:
    from app.api.routes.bots import (
        _build_answer_training_sections_from_chunks,
        _build_precomputed_answer_training_cache,
    )

    sections = _build_answer_training_sections_from_chunks(
        "보험료 납입 방법\n\n보험료는 자동이체로 납입할 수 있습니다.",
        "보험 약관",
    )
    documents = [
        {
            "documentId": "answer:pdf:1",
            "title": section["intent_name"],
            "text": section["text"],
            "metadata": {"sourceType": "pdf", "fileName": "보험약관.pdf", "intentName": section["intent_name"]},
        }
        for section in sections
    ]
    cache = _build_precomputed_answer_training_cache(documents)

    assert documents[0]["metadata"]["sourceType"] == "pdf"
    assert documents[0]["text"] == "보험료 납입 방법\n\n보험료는 자동이체로 납입할 수 있습니다."
    assert cache["answer_count"] == 0
    assert cache["by_intent_id"] == {}


def test_rag_pdf_intent_candidates_use_headings_not_body_sentences() -> None:
    from app.api.routes.bots import (
        _answer_title_from_text,
        _clean_rag_answer_subject,
        _rag_answer_candidate_utterances_from_documents,
    )

    assert _clean_rag_answer_subject("챗봇 생성 및 관리 62 63 64 65 66 67") == ""
    assert _clean_rag_answer_subject("수 있습니다") == ""
    assert _answer_title_from_text(
        "보험료는 자동이체로 납입할 수 있습니다.\n\n9.2 재학습하기\n재학습할 수 있습니다.",
        "문서",
        1,
    ) == "9.2 재학습하기"

    utterances = _rag_answer_candidate_utterances_from_documents(
        [
            {
                "title": "9.2 재학습하기",
                "text": "수 있습니다\n있습니다",
                "metadata": {"sourceType": "pdf", "intentName": ""},
            }
        ]
    )

    assert utterances == ["재학습 방법 문의"]


def test_rag_pdf_user_manual_sections_ignore_toc_noise() -> None:
    from app.api.routes.bots import (
        _build_answer_training_documents,
        _build_rag_answer_configure_groups,
    )
    from app.schemas.bot import AnswerTrainingSource, VersionNluTrainRequest

    source_text = """
Brity Assistant 사용자 매뉴얼

차례 >
............................... 2
차례 > 2
챗봇 생성 및 관리 62 63 64 65 66 67 68 69 70
vii

1. 챗봇 생성 및 관리하기
챗봇을 생성하고 기본 정보를 관리할 수 있습니다.
봇 목록에서 생성, 수정, 삭제 기능을 사용할 수 있습니다.

9.2 재학습하기
등록한 학습문장을 기준으로 봇을 다시 학습할 수 있습니다.
재학습 완료 후 시뮬레이터에서 결과를 확인할 수 있습니다.

라이선스 조회 방법 120
라이선스 메뉴에서 보유 라이선스와 사용량을 조회할 수 있습니다.
""".strip()
    payload = VersionNluTrainRequest(
        answer_training=AnswerTrainingSource(
            source_type="pdf",
            title="Brity Assistant 사용자 매뉴얼",
            text=source_text,
            file_name="Brity Assistant 사용자 매뉴얼.pdf",
        )
    )

    documents = _build_answer_training_documents(
        {},
        payload,
        {"nlu_type": "semantic", "nlu_model": "semantic_engine_default", "answer_mode": "semantic_rag"},
    )
    titles = [str(document["title"]) for document in documents]

    assert "차례" not in " ".join(titles)
    assert "vii" not in " ".join(titles).lower()
    assert "챗봇 생성 및 관리" not in titles
    assert "챗봇 생성 및 관리 방법" in titles
    assert "재학습 방법" in titles
    assert "라이선스 조회 방법" in titles

    groups = _build_rag_answer_configure_groups(
        documents,
        target_count=10,
        target_count_policy="near",
        ai_config={"answer_mode": "semantic_rag"},
    )
    group_names = [str(group["name"]) for group in groups]

    assert "챗봇 생성 및 관리 방법 문의" in group_names
    assert "재학습 방법 문의" in group_names
    assert "라이선스 조회 방법 문의" in group_names
    assert all("차례" not in name for name in group_names)
    assert all("vii" not in name.lower() for name in group_names)


def test_semantic_rag_pdf_groups_exclude_non_intent_manual_noise() -> None:
    from app.api.routes.bots import _build_rag_answer_configure_groups

    documents = [
        {
            "documentId": "answer:toc:1",
            "title": "",
            "text": "차례\n서문\n1. 개요",
            "metadata": {"sourceType": "pdf", "intentName": "1.개요"},
        },
        {
            "documentId": "answer:preface:1",
            "title": "서문 > 매뉴얼 구성",
            "text": "서문 > 매뉴얼 구성\n이 매뉴얼은 다음과 같은 내용으로 구성되어 있습니다.",
            "metadata": {"sourceType": "pdf", "intentName": "서문 > 매뉴얼 구성"},
        },
        {
            "documentId": "answer:body:1",
            "title": "사용자와 대화를 시작하면서 전달되는 최초 메시지입니다. 메시지를 직접",
            "text": "번호\n항목\n설명\n사용자와 대화를 시작하면서 전달되는 최초 메시지입니다.",
            "metadata": {"sourceType": "pdf", "intentName": "사용자와 대화를 시작하면서 전달되는 최초 메시지입니다. 메시지를 직접"},
        },
        {
            "documentId": "answer:good:1",
            "title": "챗봇 생성 및 관리하기 > 봇 만들기",
            "text": "챗봇 생성 및 관리하기 > 봇 만들기\n봇을 만드는 절차를 설명합니다.",
            "metadata": {"sourceType": "pdf", "intentName": "챗봇 생성 및 관리하기 > 봇 만들기"},
        },
        {
            "documentId": "answer:good:2",
            "title": "재학습 대상 리스트 조회하기",
            "text": "재학습 대상 리스트 조회하기\n재학습 대상 리스트를 조회하는 방법입니다.",
            "metadata": {"sourceType": "pdf", "intentName": "재학습 대상 리스트 조회하기"},
        },
    ]

    groups = _build_rag_answer_configure_groups(
        documents,
        target_count=10,
        target_count_policy="near",
        ai_config={"answer_mode": "semantic_rag"},
    )
    names = [str(group["name"]) for group in groups]

    assert "문서 내용 문의 1" not in names
    assert all("서문" not in name for name in names)
    assert all("메시지입니다" not in name for name in names)
    assert "챗봇 생성 및 관리하기 > 봇 만들기 문의" in names
    assert "재학습 대상 리스트 조회 방법 문의" in names


def test_rag_pdf_answer_training_does_not_use_precomputed_answer_cache() -> None:
    from app.api.routes.bots import _build_precomputed_answer_training_cache

    cache = _build_precomputed_answer_training_cache(
        [
            {
                "documentId": "answer:pdf:1",
                "title": "보험료 납입 방법",
                "text": "보험료는 자동이체로 납입할 수 있습니다.",
                "metadata": {
                    "sourceType": "pdf",
                    "intentId": "intent-price",
                    "intentName": "보험료 납입 방법",
                },
            }
        ]
    )

    assert cache["answer_count"] == 0
    assert cache["by_intent_id"] == {}


def test_rag_answer_embedding_requires_reembed_when_answer_vector_settings_change() -> None:
    from app.api.routes.bots import _answer_vector_config_fingerprint, _mark_answer_training_reembed_required

    before = _answer_vector_config_fingerprint(
        {
            "answer_mode": "semantic_rag",
            "vector_connections": {
                "answer": {
                    "enabled": True,
                    "endpoint_url": "http://localhost:8350/answer/search",
                    "index_name": "aidot-answer",
                }
            },
        }
    )
    after = _answer_vector_config_fingerprint(
        {
            "answer_mode": "semantic_rag",
            "vector_connections": {
                "answer": {
                    "enabled": True,
                    "endpoint_url": "http://localhost:8350/answer/search",
                    "index_name": "aidot-answer-v2",
                }
            },
        }
    )

    version_json = {
        "system_config": {
            "answer_training": {
                "status": "success",
                "embedding_provider": "ollama",
                "embedding_model": "bge-m3:latest",
            }
        }
    }
    marked = _mark_answer_training_reembed_required(
        version_json,
        "Answer Vector DB 설정이 변경되어 답변 문서 재임베딩이 필요합니다.",
    )

    assert before != after
    answer_training = marked["system_config"]["answer_training"]
    assert answer_training["status"] == "reembed_required"
    assert answer_training["embedding_model"] == "bge-m3:latest"


def test_rag_answer_vector_import_with_empty_records_requires_reembed(monkeypatch) -> None:
    from app.api.routes import bots as bot_routes

    class FakeBot:
        id = "bot-1"

    class FakeVersion:
        id = "version-1"

    class FakeAnswerVectorSearchClient:
        def __init__(self, config) -> None:
            self.config = config

        def import_answers(self, *, bot_id: str, version_id: str, payload: dict[str, object]) -> dict[str, object]:
            return {"imported": 0, "indexName": "aidot-answer"}

    monkeypatch.setattr(bot_routes, "AnswerVectorSearchClient", FakeAnswerVectorSearchClient)

    result = bot_routes._import_answer_vector_index(
        FakeBot(),
        FakeVersion(),
        {
            "nlu_type": "semantic",
            "answer_mode": "semantic_rag",
            "vector_connections": {
                "answer": {
                    "enabled": True,
                    "endpoint_url": "http://localhost:8350/answer/search",
                    "index_name": "aidot-answer",
                }
            },
        },
        {"metadata": {}, "records": []},
    )

    assert result is None


def test_semantic_evaluation_exact_intent_name_match_wins() -> None:
    from app.api.routes.bots import _compact_semantic_text, _semantic_exact_intent_lookup, _semantic_exact_match_to_row

    lookup = _semantic_exact_intent_lookup(
        [
            {"intentId": "intent-1", "intentName": "용어 설명", "utterances": ["용어설명"]},
            {"intentId": "intent-2", "intentName": "상품 설명 요청", "utterances": ["상품 설명"]},
        ]
    )
    row = {"dialog_id": "intent-1", "dialog_name": "용어 설명", "text": "용어설명"}

    result = _semantic_exact_match_to_row(row, lookup[_compact_semantic_text(row["text"])], row_id="fixed-0")

    assert result["correct"] is True
    assert result["predicted_dialog_id"] == "intent-1"
    assert result["score"] == 100.0


def test_semantic_training_exact_utterance_match_wins() -> None:
    from app.api.routes.bots import _compact_semantic_text, _semantic_exact_training_lookup, _semantic_exact_match_to_row

    lookup = _semantic_exact_training_lookup(
        [
            {"intentId": "intent-1", "intentName": "해지 요청", "utterances": ["해약한다고요"]},
            {"intentId": "intent-2", "intentName": "상담사 연결", "utterances": ["상담원 연결해줘"]},
        ]
    )
    row = {"dialog_id": "intent-1", "dialog_name": "해지 요청", "text": "해약한다고요"}

    result = _semantic_exact_match_to_row(row, lookup[_compact_semantic_text(row["text"])][0], row_id="training-0")

    assert result["correct"] is True
    assert result["predicted_dialog_id"] == "intent-1"
    assert result["score"] == 100.0


def test_deep_learning_lite_atomic_write_keeps_existing_model_on_replace_failure(tmp_path, monkeypatch) -> None:
    model_path = tmp_path / "bot-1" / "version-1" / "deep_learning_lite.json"
    model_path.parent.mkdir(parents=True)
    model_path.write_text('{"model":"old"}', encoding="utf-8")
    original_replace = Path.replace

    def fail_replace(self: Path, target: Path) -> Path:
        if target == model_path:
            raise OSError("replace failed")
        return original_replace(self, target)

    monkeypatch.setattr(Path, "replace", fail_replace)

    try:
        _write_model_atomic(model_path, {"model": "new"})
    except OSError:
        pass
    else:
        raise AssertionError("expected replace failure")

    assert model_path.read_text(encoding="utf-8") == '{"model":"old"}'
    assert not list(model_path.parent.glob(".deep_learning_lite.json.*.tmp"))


def test_deep_learning_lite_imbalance_oversampling_expands_small_intents() -> None:
    class FakeVersion:
        bot_id = "bot-1"
        id = "version-1"
        version_json = {
            "dialogs": [
                {
                    "id": "intent-1",
                    "dialogType": 1,
                    "name": "많은 의도",
                    "utterances": [{"text": "첫 문장"}, {"text": "두 문장"}, {"text": "세 문장"}],
                },
                {
                    "id": "intent-2",
                    "dialogType": 1,
                    "name": "적은 의도",
                    "utterances": [{"text": "한 문장"}],
                },
            ],
            "entities": [],
        }

    model = build_deep_learning_lite_model(FakeVersion(), imbalance_oversampling=True)

    assert model["training_options"]["imbalance_oversampling"] is True
    assert model["counts"]["original_intent_documents"] == 4
    assert model["counts"]["intent_documents"] == 6
    assert model["counts"]["oversampled_intent_documents"] == 2


def test_deep_learning_lite_runtime_classification_uses_saved_model(tmp_path, monkeypatch) -> None:
    class FakeVersion:
        bot_id = "bot-1"
        id = "version-1"
        version_json = {
            "dialogs": [
                {
                    "id": "intent-agent",
                    "dialogType": 1,
                    "name": "상담사 전환 요청",
                    "utterances": [{"text": "상담사로 바꿔줘"}, {"text": "상담원 연결해줘"}],
                },
                {
                    "id": "intent-product",
                    "dialogType": 1,
                    "name": "상품 문의",
                    "utterances": [{"text": "상품을 알려줘"}],
                },
            ],
            "entities": [],
        }

    monkeypatch.setattr("app.services.nlu.deep_learning_lite._model_path", lambda _bot_id, _version_id: tmp_path / "deep_learning_lite.json")
    version = FakeVersion()
    train_and_save_deep_learning_lite_model(version)

    result = classify_deep_learning_lite_model(version, "상담사 바꿔줘")

    assert result is not None
    assert result["dialog_id"] == "intent-agent"
    assert result["score"] >= 0.8
def test_deep_learning_lite_user_dictionary_overrides_system_synonyms(monkeypatch) -> None:
    from app.services.nlu import deep_learning_lite

    monkeypatch.setattr(
        deep_learning_lite,
        "_load_system_synonym_entries",
        lambda: [{"word": "정정", "synonyms": ["취소"]}],
    )
    context = build_learning_token_context(
        {
            "dictionary": [
                {"word": "해지", "synonyms": ["취소", "철회"], "intentEnabled": True},
            ]
        }
    )

    tokens = tokenize_texts_for_deep_learning_lite(
        ["취소를 하고싶어서요", "계약 철회할게요"],
        context["canonical_map"],
        context["surface_canonical_map"],
    )

    assert "해지하다" in tokens[0]["tokens"]
    assert "정정하다" not in tokens[0]["tokens"]
    assert "해지하다" in tokens[1]["tokens"]


def test_deep_learning_lite_configure_uses_seed_intents_without_reference_version() -> None:
    version_document = {
        "dialogs": [],
        "dictionary": [{"word": "해지", "synonyms": ["해약", "취소", "철회"], "intentEnabled": True}],
    }

    result = configure_intents_with_deep_learning_lite(
        ["계약 철회할게요", "이미 해지했어요", "상담사 전환 요청", "사람이랑 통화할래요"],
        target_count=2,
        target_count_policy="near",
        version_document=version_document,
        seed_intents=[
            {
                "name": "계약 해지",
                "representative_utterances": ["해약한다고요", "이미 해지했어요"],
            },
            {
                "name": "상담원 연결 요청",
                "representative_utterances": ["상담사 전환 요청", "상담원 바꿔주세요", "사람이랑 통화할래요"],
            },
        ],
    )

    groups_by_name = {group["name"]: group["utterances"] for group in result["groups"]}
    assert result["seed_mode"] is True
    assert groups_by_name["계약 해지"] == ["계약 철회할게요", "이미 해지했어요"]
    assert groups_by_name["상담원 연결 요청"] == ["상담사 전환 요청", "사람이랑 통화할래요"]


def test_deep_learning_lite_seed_configure_uses_seed_name_as_exact_example() -> None:
    result = configure_intents_with_deep_learning_lite(
        ["발신자 확인"],
        target_count=1,
        target_count_policy="near",
        version_document={"dialogs": [], "dictionary": []},
        seed_intents=[
            {
                "name": "발신자 확인",
                "representative_utterances": ["누구시죠", "어디서 전화하신거죠"],
            },
        ],
    )

    groups_by_name = {group["name"]: group["utterances"] for group in result["groups"]}
    assert result["seed_mode"] is True
    assert groups_by_name["발신자 확인"] == ["발신자 확인"]


def test_deep_learning_lite_seed_configure_assigns_clear_soft_matches() -> None:
    result = configure_intents_with_deep_learning_lite(
        ["가입안했어요", "사람이랑 통화할래요"],
        target_count=2,
        target_count_policy="near",
        version_document={
            "dialogs": [],
            "dictionary": [
                {"word": "계약", "synonyms": ["가입"], "intentEnabled": True},
                {"word": "상담원", "synonyms": ["상담사", "상담직원"], "intentEnabled": True},
            ],
        },
        seed_intents=[
            {
                "name": "무동의 계약",
                "representative_utterances": ["가입한적이 없습니다", "제가 운전자 계약이 있나요"],
            },
            {
                "name": "상담사 전환 요청",
                "representative_utterances": ["상담사랑 통화하고 싶은데", "사람 바꿔요"],
            },
        ],
    )

    groups_by_name = {group["name"]: group["utterances"] for group in result["groups"]}
    assert groups_by_name["무동의 계약"] == ["가입안했어요"]
    assert groups_by_name["상담사 전환 요청"] == ["사람이랑 통화할래요"]
    assert all(not group["name"].startswith("검토 필요") for group in result["groups"])


def test_deep_learning_lite_seed_configure_keeps_clear_seed_assignments_and_reviews_ambiguous_items() -> None:
    result = configure_intents_with_deep_learning_lite(
        [
            "삼성생명이라고요",
            "너 누군데",
            "사람이랑 통화할래요",
            "상담원이랑 통화할게",
            "다음에 내가 직접 할게",
            "아 제가 다시 전화드려도 될까요",
            "십분 후에 다시 연락 주시면 안 될까요",
            "바쁘니까 나중에 전화해",
            "너무 빠르신 거 같아요",
            "담보가 무슨 말인지 모르겠네",
            "보험 안 넣었는데",
            "다음에 할게요",
        ],
        target_count=20,
        target_count_policy="near",
        version_document={
            "dialogs": [],
            "dictionary": [
                {"word": "해지", "synonyms": ["해약", "취소", "철회"], "intentEnabled": True},
                {"word": "계약", "synonyms": ["가입"], "intentEnabled": True},
                {"word": "상담원", "synonyms": ["상담사", "상담직원", "상담 직원"], "intentEnabled": True},
            ],
        },
        seed_intents=[
            {"name": "무동의 계약", "representative_utterances": ["가입한적이 없습니다", "제가 운전자 계약이 있나요"]},
            {"name": "발신자 확인", "representative_utterances": ["삼성생명 보험인가요", "누구시죠", "어디서 전화하신거죠"]},
            {"name": "발화속도 조절", "representative_utterances": ["느려요", "빠르게 안되나요"]},
            {"name": "상담사 전환 요청", "representative_utterances": ["상담사랑 통화하고 싶은데", "사람 바꿔요"]},
            {"name": "용어 설명", "representative_utterances": ["고지우량체가 무슨 말이야", "피보험자 뜻 좀 알려줘요"]},
            {"name": "인콜 진행 예정", "representative_utterances": ["제가 알아서 할게요", "시간되면 나중에 전화걸게"]},
            {"name": "콜백 예약", "representative_utterances": ["내일해도 되나요", "세시 이후에 전화해주실 수 있나요"]},
        ],
    )

    group_by_utterance = {
        utterance: group["name"]
        for group in result["groups"]
        for utterance in group["utterances"]
    }

    assert group_by_utterance["삼성생명이라고요"] == "발신자 확인"
    assert group_by_utterance["너 누군데"] == "발신자 확인"
    assert group_by_utterance["사람이랑 통화할래요"] == "상담사 전환 요청"
    assert group_by_utterance["상담원이랑 통화할게"] == "상담사 전환 요청"
    assert group_by_utterance["다음에 내가 직접 할게"] == "인콜 진행 예정"
    assert group_by_utterance["아 제가 다시 전화드려도 될까요"] == "인콜 진행 예정"
    assert group_by_utterance["십분 후에 다시 연락 주시면 안 될까요"] == "콜백 예약"
    assert group_by_utterance["바쁘니까 나중에 전화해"] == "콜백 예약"
    assert group_by_utterance["너무 빠르신 거 같아요"] == "발화속도 조절"
    assert group_by_utterance["담보가 무슨 말인지 모르겠네"] == "용어 설명"
    assert group_by_utterance["보험 안 넣었는데"].startswith("검토 필요")
    assert group_by_utterance["다음에 할게요"].startswith("검토 필요")


def test_deep_learning_lite_seed_configure_clusters_unmatched_review_groups() -> None:
    result = configure_intents_with_deep_learning_lite(
        [
            "계약 철회할게요",
            "상담원 바꿔주세요",
            "발신자가 누구시죠",
            "오늘 날씨가 좋아요",
            "아무 문장입니다",
        ],
        target_count=2,
        target_count_policy="near",
        version_document={"dialogs": [], "dictionary": []},
        seed_intents=[
            {
                "name": "계약 해지",
                "representative_utterances": ["계약 철회할게요"],
            },
            {
                "name": "상담원 연결",
                "representative_utterances": ["상담원 바꿔주세요"],
            },
        ],
    )

    groups_by_name = {group["name"]: group["utterances"] for group in result["groups"]}
    assert result["seed_mode"] is True
    assert groups_by_name["계약 해지"] == ["계약 철회할게요"]
    assert groups_by_name["상담원 연결"] == ["상담원 바꿔주세요"]
    review_groups = [group for group in result["groups"] if group["name"].startswith("검토 필요")]
    review_utterances = [utterance for group in review_groups for utterance in group["utterances"]]
    assert len(review_groups) > 1
    assert review_utterances == ["발신자가 누구시죠", "오늘 날씨가 좋아요", "아무 문장입니다"]


def test_deep_learning_lite_question_intent_axis_separates_what_meanings() -> None:
    context = build_learning_token_context({"dictionary": []})

    tokens = tokenize_texts_for_deep_learning_lite(
        ["서비스콜이 뭔데요", "비례보상이 뭔데요", "뭘 자꾸 하라는거죠"],
        context["canonical_map"],
        context["surface_canonical_map"],
    )

    assert "question_intent:meaning" in tokens[0]["tokens"]
    assert "question_intent:meaning" in tokens[1]["tokens"]
    assert "question_intent:method" in tokens[2]["tokens"]


def test_deep_learning_lite_keeps_prohibition_auxiliary_predicates() -> None:
    context = build_learning_token_context({"dictionary": []})

    tokens = tokenize_texts_for_deep_learning_lite(
        ["전화하지 마세요", "귀찮게 하지마", "무동의 계약", "여보세요"],
        context["canonical_map"],
        context["surface_canonical_map"],
    )

    assert "전화하다" in tokens[0]["tokens"]
    assert "말다" in tokens[0]["tokens"]
    assert "prohibit:전화하다" in tokens[0]["tokens"]
    assert "귀찮다" in tokens[1]["tokens"]
    assert "말다" in tokens[1]["tokens"]
    assert "prohibit:귀찮다" in tokens[1]["tokens"]
    assert "무동의" in tokens[2]["tokens"]
    assert "동의" not in tokens[2]["tokens"]
    assert "여보세요" in tokens[3]["tokens"]


def test_deep_learning_lite_speed_concept_keeps_direction_tokens() -> None:
    context = build_learning_token_context({"dictionary": []})

    tokens = tokenize_texts_for_deep_learning_lite(
        ["발화속도 조절", "너무 느려요", "좀 천천히 할 수 없어요?"],
        context["canonical_map"],
        context["surface_canonical_map"],
    )

    assert "concept:속도" in tokens[0]["tokens"]
    assert "concept:속도" in tokens[1]["tokens"]
    assert "concept:속도" in tokens[2]["tokens"]
    assert "느리다" in tokens[1]["tokens"]
    assert "천천히" in tokens[2]["tokens"]
    assert "너무" not in tokens[1]["tokens"]
    assert "좀" not in tokens[2]["tokens"]


def test_deep_learning_lite_separates_busy_from_speech_speed_and_call_direction() -> None:
    context = build_learning_token_context({"dictionary": []})

    tokens = tokenize_texts_for_deep_learning_lite(
        ["바쁩니다", "빠르게 안되나요", "상담원이랑 통화할게", "제가 다음에 전화할게요", "내일 전화해주세요"],
        context["canonical_map"],
        context["surface_canonical_map"],
    )

    assert "concept:속도" not in tokens[0]["tokens"]
    assert "바쁘다" in tokens[0]["tokens"]
    assert "concept:속도" in tokens[1]["tokens"]
    assert "function:call_partner_contact" in tokens[2]["tokens"]
    assert "function:call_self_action" not in tokens[2]["tokens"]
    assert "function:call_self_action" in tokens[3]["tokens"]
    assert "function:call_inbound_request" in tokens[4]["tokens"]


def test_deep_learning_lite_blocklist_removes_tokens_only_for_ml_preprocessing() -> None:
    context = build_learning_token_context(
        {"dictionary": []},
        version_settings={
            "blocklists": [
                {"type": "word", "pattern": "좀", "enabled": True},
                {"type": "word", "pattern": "이제", "enabled": True},
            ],
        },
    )

    tokens = tokenize_texts_for_deep_learning_lite(
        ["이제 좀 천천히 하자"],
        context["canonical_map"],
        context["surface_canonical_map"],
        context["ignore_terms"],
        context["ignore_regexes"],
    )

    assert "좀" not in tokens[0]["tokens"]
    assert "이제" not in tokens[0]["tokens"]
    assert "천천히" in tokens[0]["tokens"]


def test_deep_learning_lite_preserves_semantic_adverbs_and_scores_similar_utterances(tmp_path, monkeypatch) -> None:
    from app.services.nlu import deep_learning_lite

    class FakeVersion:
        bot_id = "bot-meaning"
        id = "version-meaning"
        version_json = {
            "dialogs": [
                {
                    "id": "intent-product-detail",
                    "dialogType": 1,
                    "name": "상품 설명 요청",
                    "utterances": [
                        {"text": "상품 설명 요청"},
                        {"text": "좀 더 자세히 말해"},
                        {"text": "자세히 설명 해주세요"},
                        {"text": "듣기는 했는데 자세히 알려줘"},
                    ],
                },
                {
                    "id": "intent-call",
                    "dialogType": 1,
                    "name": "통화 독려",
                    "utterances": [{"text": "통화 내용을 자세히 말해줘"}, {"text": "설명을 다시 말해줘"}],
                },
                {
                    "id": "intent-term",
                    "dialogType": 1,
                    "name": "용어 설명",
                    "utterances": [{"text": "용어 뜻 알려줘"}, {"text": "용어 설명해줘"}],
                },
            ],
            "entities": [],
        }

    tokens = tokenize_texts_for_deep_learning_lite(["더 자세히 말해줘"])[0]["tokens"]
    assert "자세히" in tokens
    assert not any(token.startswith("gram:") for token in tokens)

    monkeypatch.setattr(deep_learning_lite, "_model_path", lambda _bot_id, _version_id: tmp_path / "deep_learning_lite.json")
    version = FakeVersion()
    train_and_save_deep_learning_lite_model(version)

    for utterance in ("상품 설명 요청해", "더 자세히 말해줘"):
        result = classify_deep_learning_lite_model(version, utterance)
        assert result is not None
        assert result["dialog_id"] == "intent-product-detail"
        assert result["score"] >= 0.75

    candidates = deep_learning_lite.score_deep_learning_lite_model(version, "더 자세히 말해줘")
    call_candidate = next(candidate for candidate in candidates if candidate["dialog_id"] == "intent-call")
    assert call_candidate["score"] < 0.6


def test_deep_learning_lite_intent_idf_decreases_for_widely_used_tokens() -> None:
    from app.services.nlu.deep_learning_lite import _idf_by_group

    documents = [
        {"dialog_id": "one", "tokens": ["a", "b", "common"]},
        {"dialog_id": "two", "tokens": ["a", "b", "common"]},
        {"dialog_id": "three", "tokens": ["a", "b", "common"]},
        {"dialog_id": "four", "tokens": ["b", "common"]},
        {"dialog_id": "five", "tokens": ["common"]},
    ]

    idf = _idf_by_group(documents, "dialog_id")

    assert idf["a"] > idf["b"] > idf["common"]
    assert idf["common"] == 0.0

def test_ml_acceleration_status_exposes_runtime_execution_fields() -> None:
    status = get_ml_acceleration_status()

    assert status["available"] is None or isinstance(status["available"], bool)
    assert isinstance(status["execution_count"], int)
    assert status["last_execution_at"] is None or isinstance(status["last_execution_at"], str)


def test_deep_learning_lite_eval_classifier_accepts_gpu_batch_option() -> None:
    assert "use_gpu_centroid_batch" in inspect.signature(_classify_eval_model).parameters
    assert "prepared_cuda_centroid_batch" in inspect.signature(_classify_eval_model).parameters


def test_deep_learning_lite_accuracy_reuses_prepared_cuda_batch(monkeypatch) -> None:
    from app.services.nlu import deep_learning_lite

    prepared_batch = {"vocabulary": ["상품"], "centroids": object(), "intent_count": 1}
    received_batches: list[object] = []

    def fake_classify(*_args, **kwargs):
        assert kwargs["use_gpu_centroid_batch"] is True
        received_batches.append(kwargs["prepared_cuda_centroid_batch"])
        return {"dialog_id": "intent-1"}

    monkeypatch.setattr(deep_learning_lite, "_classify_eval_model", fake_classify)

    accuracy = _calculate_accuracy(
        {"intents": []},
        [
            {"dialog_id": "intent-1", "text": "상품 설명"},
            {"dialog_id": "intent-1", "text": "자세히 알려줘"},
        ],
        analyzer=object(),
        prepared_cuda_centroid_batch=prepared_batch,
    )

    assert accuracy == 1.0
    assert received_batches == [prepared_batch, prepared_batch]


def test_deep_learning_lite_evaluation_reuses_scores_across_reports(monkeypatch) -> None:
    from app.services.nlu import deep_learning_lite

    score_calls: list[str] = []

    def fake_score(_model, text, *_args, **_kwargs):
        score_calls.append(text)
        return [
            {
                "dialog_id": "intent-1",
                "dialog_name": "상품 설명 요청",
                "score": 0.96,
                "features": ["상품", "설명", "요청"],
                "exact_match": True,
            }
        ]

    monkeypatch.setattr(deep_learning_lite, "_score_eval_model", fake_score)

    model = {"intents": []}
    rows = [{"dialog_id": "intent-1", "dialog_name": "상품 설명 요청", "text": "상품 설명 요청해"}]
    score_cache: dict[str, list[dict[str, object]]] = {}

    accuracy = deep_learning_lite._calculate_accuracy(
        model,
        rows,
        analyzer=object(),
        score_cache=score_cache,
    )
    snapshot = deep_learning_lite._build_evaluation_snapshot(
        model,
        rows,
        analyzer=object(),
        score_cache=score_cache,
    )
    diagnostics = deep_learning_lite._build_quality_diagnostics(
        model,
        rows,
        [],
        analyzer=object(),
        score_cutoff=0.75,
        similar_intent_score=0.85,
        max_intent_results=3,
        score_cache=score_cache,
    )

    assert accuracy == 1.0
    assert snapshot["training_rows"][0]["predicted_dialog_id"] == "intent-1"
    assert diagnostics["summary"]["problem_count"] == 0
    assert score_calls == ["상품 설명 요청해"]
