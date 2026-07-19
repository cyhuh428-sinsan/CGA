from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class IntentDocument(BaseModel):
    intent_id: str = Field(alias="intentId", min_length=1)
    intent_name: str = Field(alias="intentName", default="")
    utterances: list[str] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class IntentIndexRequest(BaseModel):
    bot_id: str = Field(alias="botId", min_length=1)
    version_id: str = Field(alias="versionId", min_length=1)
    index_name: str = Field(alias="indexName", min_length=1)
    intents: list[IntentDocument] = Field(default_factory=list)
    dictionary_terms: list["ConfigureTerm"] = Field(alias="dictionaryTerms", default_factory=list)

    model_config = {"populate_by_name": True}


class IntentSearchRequest(BaseModel):
    bot_id: str = Field(alias="botId", min_length=1)
    version_id: str = Field(alias="versionId", min_length=1)
    index_name: str = Field(alias="indexName", min_length=1)
    query: str = Field(min_length=1)
    top_k: int = Field(alias="topK", default=3, ge=1, le=20)
    dictionary_terms: list["ConfigureTerm"] = Field(alias="dictionaryTerms", default_factory=list)

    model_config = {"populate_by_name": True}


class IntentMatch(BaseModel):
    intent_id: str = Field(alias="intentId")
    intent_name: str = Field(alias="intentName")
    score: float
    matched_text: str = Field(alias="matchedText")
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class IntentSearchResponse(BaseModel):
    matches: list[IntentMatch]


class IntentBatchSearchRequest(BaseModel):
    bot_id: str = Field(alias="botId", min_length=1)
    version_id: str = Field(alias="versionId", min_length=1)
    index_name: str = Field(alias="indexName", min_length=1)
    queries: list[str] = Field(min_length=1, max_length=500)
    top_k: int = Field(alias="topK", default=3, ge=1, le=20)
    dictionary_terms: list["ConfigureTerm"] = Field(alias="dictionaryTerms", default_factory=list)

    model_config = {"populate_by_name": True}


class IntentBatchSearchResponse(BaseModel):
    matches: list[list[IntentMatch]]


class ConfigureTerm(BaseModel):
    name: str = ""
    values: list[str] = Field(default_factory=list)
    domain_candidate: bool = Field(alias="domainCandidate", default=False)
    domain_enabled: bool = Field(alias="domainEnabled", default=False)

    model_config = {"populate_by_name": True}


class IntentConfigureRequest(BaseModel):
    bot_id: str = Field(alias="botId", min_length=1)
    version_id: str = Field(alias="versionId", min_length=1)
    index_name: str = Field(alias="indexName", default="aidot-intent")
    utterances: list[str] = Field(min_length=1, max_length=500)
    target_count: int = Field(alias="targetCount", default=50, ge=1, le=100)
    target_count_policy: str = Field(alias="targetCountPolicy", default="near")
    dictionary_terms: list[ConfigureTerm] = Field(alias="dictionaryTerms", default_factory=list)
    entity_terms: list[ConfigureTerm] = Field(alias="entityTerms", default_factory=list)
    scoring: dict[str, float] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class IntentConfigureGroup(BaseModel):
    id: str
    name: str
    answer: str = ""
    utterances: list[str] = Field(default_factory=list)
    score: float = 0
    seed: str = ""


class IntentConfigureResponse(BaseModel):
    provider: str
    model: str
    target_count: int = Field(alias="targetCount")
    target_count_policy: str = Field(alias="targetCountPolicy")
    groups: list[IntentConfigureGroup]
    diagnostics: dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class KnowledgeDocument(BaseModel):
    document_id: str = Field(alias="documentId", min_length=1)
    title: str = ""
    text: str = Field(min_length=1)
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class AnswerIndexRequest(BaseModel):
    bot_id: str = Field(alias="botId", min_length=1)
    version_id: str = Field(alias="versionId", min_length=1)
    index_name: str = Field(alias="indexName", min_length=1)
    documents: list[KnowledgeDocument] = Field(default_factory=list)
    embedding_provider: str | None = Field(alias="embeddingProvider", default=None)
    embedding_model: str | None = Field(alias="embeddingModel", default=None)

    model_config = {"populate_by_name": True}


class AnswerSearchRequest(BaseModel):
    bot_id: str = Field(alias="botId", min_length=1)
    version_id: str = Field(alias="versionId", min_length=1)
    index_name: str = Field(alias="indexName", min_length=1)
    query: str = Field(min_length=1)
    top_k: int = Field(alias="topK", default=3, ge=1, le=20)
    intent_ids: list[str] = Field(alias="intentIds", default_factory=list)
    embedding_provider: str | None = Field(alias="embeddingProvider", default=None)
    embedding_model: str | None = Field(alias="embeddingModel", default=None)

    model_config = {"populate_by_name": True}


class AnswerMatch(BaseModel):
    document_id: str = Field(alias="documentId")
    title: str = ""
    text: str = ""
    score: float
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class AnswerSearchResponse(BaseModel):
    matches: list[AnswerMatch] = Field(default_factory=list)


class AnswerExportRequest(BaseModel):
    bot_id: str = Field(alias="botId", min_length=1)
    version_id: str = Field(alias="versionId", min_length=1)
    index_name: str = Field(alias="indexName", min_length=1)

    model_config = {"populate_by_name": True}


class AnswerExportResponse(BaseModel):
    found: bool = False
    index_name: str = Field(alias="indexName", default="")
    payload: dict[str, Any] | None = None

    model_config = {"populate_by_name": True}


class AnswerImportRequest(BaseModel):
    bot_id: str = Field(alias="botId", min_length=1)
    version_id: str = Field(alias="versionId", min_length=1)
    index_name: str = Field(alias="indexName", min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class AnswerCopyRequest(BaseModel):
    source_bot_id: str = Field(alias="sourceBotId", min_length=1)
    source_version_id: str = Field(alias="sourceVersionId", min_length=1)
    target_bot_id: str = Field(alias="targetBotId", min_length=1)
    target_version_id: str = Field(alias="targetVersionId", min_length=1)
    index_name: str = Field(alias="indexName", min_length=1)

    model_config = {"populate_by_name": True}
