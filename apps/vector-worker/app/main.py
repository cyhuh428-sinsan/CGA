from __future__ import annotations

import logging
from time import perf_counter

from fastapi import FastAPI, HTTPException

from app.embeddings import EmbeddingModel, create_embedding_model, embedding_runtime_device
from app.schemas import (
    AnswerIndexRequest,
    AnswerCopyRequest,
    AnswerExportRequest,
    AnswerExportResponse,
    AnswerImportRequest,
    AnswerSearchRequest,
    AnswerSearchResponse,
    IntentConfigureRequest,
    IntentConfigureResponse,
    IntentBatchSearchRequest,
    IntentBatchSearchResponse,
    IntentIndexRequest,
    IntentSearchRequest,
    IntentSearchResponse,
)
from app.settings import load_settings
from app.store import EmbeddingIndexMismatchError, JsonVectorStore, acceleration_status


settings = load_settings()
embedding_model = create_embedding_model(
    settings.embedding_provider,
    settings.embedding_model,
    dimension=settings.vector_dimension,
    ollama_base_url=settings.ollama_base_url,
    timeout_seconds=settings.embedding_timeout_seconds,
)
store = JsonVectorStore(settings.storage_dir, embedding_model, settings.embedding_provider)
logger = logging.getLogger("aidot.vector_worker")
_answer_embedding_models: dict[tuple[str, str], EmbeddingModel] = {
    (settings.embedding_provider, embedding_model.name): embedding_model,
}

app = FastAPI(title="Aidot Vector Worker", version="0.1.0")


def _elapsed_ms(started_at: float) -> float:
    return round((perf_counter() - started_at) * 1000, 3)


def _answer_embedding_model(provider: str | None, model_name: str | None) -> EmbeddingModel:
    resolved_provider = (provider or "aidot_vector_worker").strip().lower()
    resolved_model = (model_name or "semantic_engine_default").strip()
    key = (resolved_provider, resolved_model)
    model = _answer_embedding_models.get(key)
    if model is None:
        model = create_embedding_model(
            resolved_provider,
            resolved_model,
            dimension=settings.vector_dimension,
            ollama_base_url=settings.ollama_base_url,
            timeout_seconds=settings.embedding_timeout_seconds,
        )
        _answer_embedding_models[key] = model
    return model


@app.get("/health")
def health() -> dict[str, object]:
    uses_ollama = settings.embedding_provider in {"ollama", "llm:ollama"}
    return {
        "status": "ok",
        "embeddingProvider": settings.embedding_provider,
        "embeddingModel": embedding_model.name,
        "embeddingDevice": embedding_runtime_device(embedding_model),
        "ollamaBaseUrl": settings.ollama_base_url if uses_ollama else None,
        "storageDir": str(settings.storage_dir),
        "acceleration": acceleration_status(),
    }


@app.post("/intent/index")
def index_intents(payload: IntentIndexRequest) -> dict[str, object]:
    started_at = perf_counter()
    count = store.index_intents(
        bot_id=payload.bot_id,
        version_id=payload.version_id,
        index_name=payload.index_name,
        intents=payload.intents,
        dictionary_terms=payload.dictionary_terms,
    )
    logger.info(
        "vector_worker.intent_index_completed",
        extra={
            "event": "vector_worker.intent_index_completed",
            "botId": payload.bot_id,
            "versionId": payload.version_id,
            "indexName": payload.index_name,
            "intentCount": len(payload.intents),
            "recordCount": count,
            "dictionaryTermCount": len(payload.dictionary_terms),
            "elapsedMs": _elapsed_ms(started_at),
        },
    )
    return {"indexed": count, "indexName": payload.index_name}


@app.post("/intent/search", response_model=IntentSearchResponse)
def search_intents(payload: IntentSearchRequest) -> IntentSearchResponse:
    started_at = perf_counter()
    diagnostics: dict[str, object] = {}
    try:
        matches = store.search_intents(
            bot_id=payload.bot_id,
            version_id=payload.version_id,
            index_name=payload.index_name,
            query=payload.query,
            top_k=payload.top_k,
            dictionary_terms=payload.dictionary_terms,
            diagnostics=diagnostics,
        )
    except EmbeddingIndexMismatchError as exc:
        logger.error(
            "vector_worker.intent_index_embedding_mismatch",
            extra={
                "event": "vector_worker.intent_index_embedding_mismatch",
                "botId": payload.bot_id,
                "versionId": payload.version_id,
                "indexName": payload.index_name,
                "error": str(exc),
            },
        )
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    logger.info(
        "vector_worker.intent_search_completed",
        extra={
            "event": "vector_worker.intent_search_completed",
            "botId": payload.bot_id,
            "versionId": payload.version_id,
            "indexName": payload.index_name,
            "queryLength": len(payload.query),
            "topK": payload.top_k,
            "resultCount": len(matches),
            "endpointElapsedMs": _elapsed_ms(started_at),
            **diagnostics,
        },
    )
    return IntentSearchResponse(matches=matches)


@app.post("/intent/search-batch", response_model=IntentBatchSearchResponse)
def search_intents_batch(payload: IntentBatchSearchRequest) -> IntentBatchSearchResponse:
    started_at = perf_counter()
    try:
        matches = store.search_intents_batch(
            bot_id=payload.bot_id,
            version_id=payload.version_id,
            index_name=payload.index_name,
            queries=payload.queries,
            top_k=payload.top_k,
            dictionary_terms=payload.dictionary_terms,
        )
    except EmbeddingIndexMismatchError as exc:
        logger.error(
            "vector_worker.intent_index_embedding_mismatch",
            extra={
                "event": "vector_worker.intent_index_embedding_mismatch",
                "botId": payload.bot_id,
                "versionId": payload.version_id,
                "indexName": payload.index_name,
                "error": str(exc),
            },
        )
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    logger.info(
        "vector_worker.intent_batch_search_completed",
        extra={
            "event": "vector_worker.intent_batch_search_completed",
            "botId": payload.bot_id,
            "versionId": payload.version_id,
            "indexName": payload.index_name,
            "queryCount": len(payload.queries),
            "topK": payload.top_k,
            "resultCount": sum(len(items) for items in matches),
            "endpointElapsedMs": _elapsed_ms(started_at),
        },
    )
    return IntentBatchSearchResponse(matches=matches)


@app.post("/intent/configure", response_model=IntentConfigureResponse)
def configure_intents(payload: IntentConfigureRequest) -> IntentConfigureResponse:
    groups = store.configure_intents(
        utterances=payload.utterances,
        target_count=payload.target_count,
        target_count_policy=payload.target_count_policy,
        dictionary_terms=payload.dictionary_terms,
        entity_terms=payload.entity_terms,
        scoring=payload.scoring,
    )
    return IntentConfigureResponse(
        provider="aidot_vector_worker",
        model=embedding_model.name,
        targetCount=payload.target_count,
        targetCountPolicy=payload.target_count_policy,
        groups=groups,
        diagnostics={
            "inputCount": len(payload.utterances),
            "groupCount": len(groups),
            "dictionaryTerms": len(payload.dictionary_terms),
            "entityTerms": len(payload.entity_terms),
            **store.last_configure_diagnostics,
        },
    )


@app.post("/answer/index")
def index_answers(payload: AnswerIndexRequest) -> dict[str, object]:
    started_at = perf_counter()
    answer_embedding_model = _answer_embedding_model(payload.embedding_provider, payload.embedding_model)
    count = store.index_answers(
        bot_id=payload.bot_id,
        version_id=payload.version_id,
        index_name=payload.index_name,
        documents=payload.documents,
        embedding_model=answer_embedding_model,
        embedding_provider=payload.embedding_provider or "aidot_vector_worker",
    )
    logger.info(
        "vector_worker.answer_index_completed",
        extra={
            "event": "vector_worker.answer_index_completed",
            "botId": payload.bot_id,
            "versionId": payload.version_id,
            "indexName": payload.index_name,
            "documentCount": len(payload.documents),
            "recordCount": count,
            "embeddingProvider": payload.embedding_provider or "aidot_vector_worker",
            "embeddingModel": answer_embedding_model.name,
            "elapsedMs": _elapsed_ms(started_at),
        },
    )
    return {"indexed": count, "indexName": payload.index_name, "embeddingProvider": payload.embedding_provider or "aidot_vector_worker", "embeddingModel": answer_embedding_model.name}


@app.post("/answer/search", response_model=AnswerSearchResponse)
def search_answers(payload: AnswerSearchRequest) -> AnswerSearchResponse:
    started_at = perf_counter()
    diagnostics: dict[str, object] = {}
    index_metadata = store.answer_index_metadata(
        bot_id=payload.bot_id,
        version_id=payload.version_id,
        index_name=payload.index_name,
    )
    stored_model = str(index_metadata.get("embeddingModel") or "").strip()
    stored_provider = str(index_metadata.get("embeddingProvider") or "").strip()
    answer_embedding_model = _answer_embedding_model(
        stored_provider or payload.embedding_provider or None,
        stored_model or payload.embedding_model or None,
    )
    matches = store.search_answers(
        bot_id=payload.bot_id,
        version_id=payload.version_id,
        index_name=payload.index_name,
        query=payload.query,
        top_k=payload.top_k,
        intent_ids=payload.intent_ids,
        embedding_model=answer_embedding_model,
        diagnostics=diagnostics,
    )
    logger.info(
        "vector_worker.answer_search_completed",
        extra={
            "event": "vector_worker.answer_search_completed",
            "botId": payload.bot_id,
            "versionId": payload.version_id,
            "indexName": payload.index_name,
            "queryLength": len(payload.query),
            "topK": payload.top_k,
            "intentIdCount": len(payload.intent_ids or []),
            "resultCount": len(matches),
            "endpointElapsedMs": _elapsed_ms(started_at),
            **diagnostics,
        },
    )
    return AnswerSearchResponse(matches=matches)


@app.post("/answer/export", response_model=AnswerExportResponse)
def export_answers(payload: AnswerExportRequest) -> AnswerExportResponse:
    exported = store.export_answer_index(
        bot_id=payload.bot_id,
        version_id=payload.version_id,
        index_name=payload.index_name,
    )
    return AnswerExportResponse(found=exported is not None, indexName=payload.index_name, payload=exported)


@app.post("/answer/import")
def import_answers(payload: AnswerImportRequest) -> dict[str, object]:
    imported = store.import_answer_index(
        bot_id=payload.bot_id,
        version_id=payload.version_id,
        index_name=payload.index_name,
        payload=payload.payload,
    )
    return {"imported": imported, "indexName": payload.index_name}


@app.post("/answer/copy")
def copy_answers(payload: AnswerCopyRequest) -> dict[str, object]:
    copied = store.copy_answer_index(
        source_bot_id=payload.source_bot_id,
        source_version_id=payload.source_version_id,
        target_bot_id=payload.target_bot_id,
        target_version_id=payload.target_version_id,
        index_name=payload.index_name,
    )
    return {"copied": copied, "indexName": payload.index_name}
