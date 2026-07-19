from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Any

from app.core.version_documents import normalize_version_document
from app.services.nlu.deep_learning_lite import build_learning_token_context, tokenize_texts_for_deep_learning_lite


@dataclass
class IntentEmbeddingDocument:
    id: str
    intent_id: str
    intent_name: str
    text: str
    tokens: list[str] = field(default_factory=list)
    source: str = "utterance"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class IntentMatch:
    intent_id: str
    intent_name: str
    score: float
    matched_text: str
    provider: str
    metadata: dict[str, Any] = field(default_factory=dict)


def embedding_provider_for_bot(data_json: dict[str, Any] | None) -> str:
    data = data_json if isinstance(data_json, dict) else {}
    nlu_type = str(data.get("nlu_type") or "ml")
    nlu_model = str(data.get("nlu_model") or data.get("nlu_engine") or "deep_learning_lite")
    if nlu_type == "llm":
        return "llm_embedding"
    if nlu_type in {"semantic", "semantic_vector", "semantic_external"}:
        return "ml_embedding"
    if nlu_model == "deep_learning_lite":
        return "local_ml"
    return "unknown"


def _normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _tokenize(
    value: str,
    canonical_map: dict[str, str] | None = None,
    surface_canonical_map: dict[str, str] | None = None,
    ignore_terms: list[str] | None = None,
    ignore_regexes: list[str] | None = None,
) -> list[str]:
    return _tokenize_many([value], canonical_map, surface_canonical_map, ignore_terms, ignore_regexes).get(value, [])


def _tokenize_many(
    values: list[str],
    canonical_map: dict[str, str] | None = None,
    surface_canonical_map: dict[str, str] | None = None,
    ignore_terms: list[str] | None = None,
    ignore_regexes: list[str] | None = None,
) -> dict[str, list[str]]:
    unique_values = list(dict.fromkeys(values))
    if not unique_values:
        return {}
    items = tokenize_texts_for_deep_learning_lite(unique_values, canonical_map, surface_canonical_map, ignore_terms, ignore_regexes)
    result: dict[str, list[str]] = {}
    for item in items:
        text = str(item.get("text") or "")
        result[text] = [str(token) for token in item.get("tokens", []) if str(token)]
    return result


def _term_counts(terms: list[str]) -> dict[str, int]:
    return {term: terms.count(term) for term in set(terms)}


def _cosine_from_terms(query_terms: list[str], doc_terms: list[str]) -> float:
    if not query_terms or not doc_terms:
        return 0.0
    query_counts = _term_counts(query_terms)
    doc_counts = _term_counts(doc_terms)
    common = set(query_counts) & set(doc_counts)
    dot = sum(query_counts[term] * doc_counts[term] for term in common)
    query_norm = math.sqrt(sum(value * value for value in query_counts.values()))
    doc_norm = math.sqrt(sum(value * value for value in doc_counts.values()))
    if query_norm <= 0 or doc_norm <= 0:
        return 0.0
    return dot / (query_norm * doc_norm)


def _dialog_name(dialog: dict[str, Any]) -> str:
    return _normalize_text(dialog.get("displayName") or dialog.get("name") or dialog.get("dialogKey") or dialog.get("id") or "의도")


def _dialog_utterances(dialog: dict[str, Any]) -> list[str]:
    utterances = dialog.get("utterances")
    if not isinstance(utterances, list):
        return []
    texts: list[str] = []
    for item in utterances:
        if isinstance(item, str) and item.strip():
            texts.append(item.strip())
        elif isinstance(item, dict) and str(item.get("text") or "").strip():
            texts.append(str(item.get("text") or "").strip())
    return texts


def intent_embedding_documents_from_version(
    version_json: dict[str, Any] | None,
    *,
    version_settings: dict[str, Any] | None = None,
) -> list[IntentEmbeddingDocument]:
    document = normalize_version_document(version_json)
    token_context = build_learning_token_context(document, version_settings=version_settings)
    canonical_map = token_context["canonical_map"]
    surface_canonical_map = token_context["surface_canonical_map"]
    docs: list[IntentEmbeddingDocument] = []
    pending: list[tuple[str, str, str, str, dict[str, Any]]] = []
    for dialog in document.get("dialogs") or []:
        if not isinstance(dialog, dict):
            continue
        dialog_type = dialog.get("dialogType")
        if str("1" if dialog_type is None else dialog_type) not in {"1", "1.0"}:
            continue
        intent_id = str(dialog.get("id") or dialog.get("dialogKey") or dialog.get("name") or "")
        if not intent_id:
            continue
        intent_name = _dialog_name(dialog)
        for index, text in enumerate(_dialog_utterances(dialog)):
            normalized = _normalize_text(text)
            if not normalized:
                continue
            pending.append((f"{intent_id}:utterance:{index + 1}", intent_id, intent_name, normalized, {"dialog": dialog}))
    tokens_by_text = _tokenize_many(
        [text for _, _, _, text, _ in pending],
        canonical_map,
        surface_canonical_map,
        token_context["ignore_terms"],
        token_context["ignore_regexes"],
    )
    for document_id, intent_id, intent_name, text, metadata in pending:
        docs.append(
            IntentEmbeddingDocument(
                id=document_id,
                intent_id=intent_id,
                intent_name=intent_name,
                text=text,
                tokens=tokens_by_text.get(text, []),
                metadata=metadata,
            )
        )
    return docs


class LocalEmbeddingIntentSearch:
    def __init__(self, documents: list[IntentEmbeddingDocument], *, provider: str = "local_ml") -> None:
        self.documents = documents
        self.provider = provider

    @staticmethod
    def _score(query_terms: list[str], document: IntentEmbeddingDocument) -> float:
        return _cosine_from_terms(query_terms, document.tokens)

    def search(
        self,
        query: str,
        *,
        top_k: int = 3,
        min_score: float = 0.05,
        canonical_map: dict[str, str] | None = None,
        surface_canonical_map: dict[str, str] | None = None,
        ignore_terms: list[str] | None = None,
        ignore_regexes: list[str] | None = None,
    ) -> list[IntentMatch]:
        best_by_intent: dict[str, IntentMatch] = {}
        query_terms = _tokenize(query, canonical_map, surface_canonical_map, ignore_terms, ignore_regexes)
        for document in self.documents:
            score = self._score(query_terms, document)
            if score < min_score:
                continue
            current = best_by_intent.get(document.intent_id)
            if current is None or score > current.score:
                best_by_intent[document.intent_id] = IntentMatch(
                    intent_id=document.intent_id,
                    intent_name=document.intent_name,
                    score=score,
                    matched_text=document.text,
                    provider=self.provider,
                    metadata=document.metadata,
                )
        matches = sorted(best_by_intent.values(), key=lambda item: item.score, reverse=True)
        return matches[: max(1, top_k)]


class BotNluEngine:
    def __init__(
        self,
        version_json: dict[str, Any] | None,
        *,
        provider: str = "local_ml",
        version_settings: dict[str, Any] | None = None,
    ) -> None:
        self.provider = provider
        self.token_context = build_learning_token_context(version_json, version_settings=version_settings)
        self.documents = intent_embedding_documents_from_version(version_json, version_settings=version_settings)
        self.searcher = LocalEmbeddingIntentSearch(self.documents, provider=provider)

    def classify(self, utterance: str, *, top_k: int = 3) -> list[IntentMatch]:
        return self.searcher.search(
            utterance,
            top_k=top_k,
            canonical_map=self.token_context["canonical_map"],
            surface_canonical_map=self.token_context["surface_canonical_map"],
            ignore_terms=self.token_context["ignore_terms"],
            ignore_regexes=self.token_context["ignore_regexes"],
        )
