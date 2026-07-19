from __future__ import annotations

import json
import threading
from http.client import HTTPConnection, HTTPSConnection, HTTPException
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

from app.core.config import settings


@dataclass(frozen=True)
class VectorDbConfig:
    enabled: bool
    endpoint_url: str
    index_name: str
    api_key: str = ""

    @property
    def is_ready(self) -> bool:
        return self.enabled and bool(self.endpoint_url.strip()) and bool(self.index_name.strip())

    @property
    def missing_fields(self) -> list[str]:
        missing: list[str] = []
        if not self.enabled:
            missing.append("사용 여부")
        if not self.endpoint_url.strip():
            missing.append("검색 API URL")
        if not self.index_name.strip():
            missing.append("Index 이름")
        return missing


@dataclass(frozen=True)
class VectorIntentMatch:
    intent_id: str
    intent_name: str
    score: float
    matched_text: str = ""
    raw: dict[str, Any] | None = None


@dataclass(frozen=True)
class VectorAnswerMatch:
    document_id: str
    title: str
    text: str
    score: float
    metadata: dict[str, Any] | None = None


def _enabled(value: Any) -> bool:
    if value is True:
        return True
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes", "y", "on", "사용"}
    return False


def _first_text(source: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = source.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def intent_vector_config(data_json: dict[str, Any] | None) -> VectorDbConfig:
    data = data_json if isinstance(data_json, dict) else {}
    vector_connections = data.get("vector_connections")
    if not isinstance(vector_connections, dict):
        vector_connections = {}
    intent_config = vector_connections.get("intent")
    if not isinstance(intent_config, dict):
        intent_config = {}
    index_name = _first_text(intent_config, "index_name", "indexName")
    endpoint_url = _first_text(intent_config, "endpoint_url", "endpointUrl", "search_url", "searchUrl")
    nlu_type = _first_text(data, "nlu_type", "nluType")
    if not endpoint_url and nlu_type in {"semantic", "semantic_vector"}:
        endpoint_url = f"{settings.aidot_vector_worker_base_url.rstrip('/')}/intent/search"
    enabled = _enabled(intent_config.get("enabled"))
    if "enabled" not in intent_config and nlu_type in {"semantic", "semantic_vector"}:
        enabled = True
    return VectorDbConfig(
        enabled=enabled,
        endpoint_url=endpoint_url,
        index_name=index_name or ("aidot-intent" if endpoint_url else ""),
        api_key=_first_text(intent_config, "api_key", "apiKey"),
    )


def answer_vector_config(data_json: dict[str, Any] | None) -> VectorDbConfig:
    data = data_json if isinstance(data_json, dict) else {}
    vector_connections = data.get("vector_connections")
    if not isinstance(vector_connections, dict):
        vector_connections = {}
    answer_config = vector_connections.get("answer")
    if not isinstance(answer_config, dict):
        answer_config = {}
    raw_index_name = _first_text(answer_config, "index_name", "indexName")
    raw_endpoint_url = _first_text(answer_config, "endpoint_url", "endpointUrl", "search_url", "searchUrl")
    index_name = raw_index_name
    endpoint_url = raw_endpoint_url
    answer_mode = _first_text(data, "answer_mode", "answerMode")
    is_rag_answer = answer_mode in {"semantic_rag", "llm_rag"}
    default_endpoint_url = f"{settings.aidot_vector_worker_base_url.rstrip('/')}/answer/search"
    if not endpoint_url and is_rag_answer:
        endpoint_url = default_endpoint_url
    enabled = _enabled(answer_config.get("enabled"))
    uses_default_answer_connection = (
        is_rag_answer
        and endpoint_url == default_endpoint_url
        and (not raw_endpoint_url or raw_endpoint_url == default_endpoint_url)
    )
    if uses_default_answer_connection:
        enabled = True
    elif "enabled" not in answer_config and is_rag_answer:
        enabled = True
    return VectorDbConfig(
        enabled=enabled,
        endpoint_url=endpoint_url,
        index_name=index_name or ("aidot-answer" if endpoint_url else ""),
        api_key=_first_text(answer_config, "api_key", "apiKey"),
    )


class VectorSearchError(RuntimeError):
    pass


class _JsonHttpConnection:
    def __init__(self, scheme: str, host: str, port: int) -> None:
        self.scheme = scheme
        self.host = host
        self.port = port
        self.connection: HTTPConnection | HTTPSConnection | None = None

    def _connect(self, timeout: float) -> HTTPConnection | HTTPSConnection:
        if self.connection is None:
            connection_class = HTTPSConnection if self.scheme == "https" else HTTPConnection
            self.connection = connection_class(self.host, self.port, timeout=timeout)
        else:
            self.connection.timeout = timeout
        return self.connection

    def close(self) -> None:
        if self.connection is not None:
            self.connection.close()
            self.connection = None


_THREAD_LOCAL_CONNECTIONS = threading.local()


def _default_port(scheme: str, port: int | None) -> int:
    if port is not None:
        return port
    return 443 if scheme == "https" else 80


def _get_thread_connection(scheme: str, host: str, port: int) -> _JsonHttpConnection:
    connections = getattr(_THREAD_LOCAL_CONNECTIONS, "connections", None)
    if not isinstance(connections, dict):
        connections = {}
        _THREAD_LOCAL_CONNECTIONS.connections = connections
    key = (scheme, host, port)
    connection = connections.get(key)
    if connection is None:
        connection = _JsonHttpConnection(scheme, host, port)
        connections[key] = connection
    return connection


def _post_json(endpoint_url: str, payload: dict[str, Any], headers: dict[str, str], timeout: float) -> dict[str, Any]:
    parsed = urlparse(endpoint_url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise VectorSearchError(f"Vector DB URL 형식이 올바르지 않습니다: {endpoint_url}")
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"
    port = _default_port(parsed.scheme, parsed.port)
    connection = _get_thread_connection(parsed.scheme, parsed.hostname, port)

    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request_headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Content-Length": str(len(body)),
        "Connection": "keep-alive",
        **headers,
    }
    for attempt in range(2):
        try:
            client = connection._connect(timeout)
            client.request("POST", path, body=body, headers=request_headers)
            response = client.getresponse()
            response_body = response.read().decode("utf-8", errors="replace")
            if response.status >= 400:
                raise VectorSearchError(f"Vector DB 요청 실패: HTTP {response.status} {response_body}")
            return json.loads(response_body) if response_body else {}
        except VectorSearchError:
            connection.close()
            raise
        except (OSError, HTTPException) as exc:
            connection.close()
            if attempt == 0:
                continue
            raise VectorSearchError(f"Vector DB 요청 실패: {exc}") from exc
    return {}


def _index_endpoint_url(endpoint_url: str) -> str:
    endpoint_url = endpoint_url.strip()
    if endpoint_url.rstrip("/").endswith("/search"):
        return f"{endpoint_url.rstrip('/')[:-len('/search')]}/index"
    return endpoint_url


def _batch_search_endpoint_url(endpoint_url: str) -> str:
    endpoint_url = endpoint_url.strip()
    if endpoint_url.rstrip("/").endswith("/search"):
        return f"{endpoint_url.rstrip('/')}-batch"
    return endpoint_url


def _parse_intent_matches(raw_matches: Any, top_k: int) -> list[VectorIntentMatch]:
    if not isinstance(raw_matches, list):
        return []
    matches: list[VectorIntentMatch] = []
    for item in raw_matches:
        if not isinstance(item, dict):
            continue
        intent_id = str(item.get("intentId") or item.get("intent_id") or "").strip()
        if not intent_id:
            continue
        score = item.get("score")
        try:
            score_value = float(score)
        except (TypeError, ValueError):
            score_value = 0.0
        if score_value > 1:
            score_value = score_value / 100
        matches.append(
            VectorIntentMatch(
                intent_id=intent_id,
                intent_name=str(item.get("intentName") or item.get("intent_name") or "").strip(),
                score=max(0.0, min(1.0, score_value)),
                matched_text=str(item.get("matchedText") or item.get("matched_text") or "").strip(),
                raw=item,
            )
        )
    return sorted(matches, key=lambda item: item.score, reverse=True)[: max(1, top_k)]


class IntentVectorSearchClient:
    def __init__(self, config: VectorDbConfig) -> None:
        self.config = config

    def search(
        self,
        *,
        bot_id: str,
        version_id: str,
        query: str,
        top_k: int = 3,
        dictionary_terms: list[dict[str, Any]] | None = None,
    ) -> list[VectorIntentMatch]:
        if not self.config.is_ready:
            raise VectorSearchError("Intent Vector DB 연결 설정이 완료되지 않았습니다.")

        payload = {
            "botId": bot_id,
            "versionId": version_id,
            "indexName": self.config.index_name,
            "query": query,
            "topK": max(1, top_k),
        }
        if dictionary_terms is not None:
            payload["dictionaryTerms"] = dictionary_terms
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        data = _post_json(self.config.endpoint_url, payload, headers, timeout=max(8.0, float(settings.aidot_vector_embedding_timeout_seconds)))

        raw_matches = data.get("matches") if isinstance(data, dict) else None
        return _parse_intent_matches(raw_matches, top_k)

    def search_batch(
        self,
        *,
        bot_id: str,
        version_id: str,
        queries: list[str],
        top_k: int = 3,
        dictionary_terms: list[dict[str, Any]] | None = None,
    ) -> list[list[VectorIntentMatch]]:
        if not self.config.is_ready:
            raise VectorSearchError("Intent Vector DB 연결 설정이 완료되지 않았습니다.")
        if not queries:
            return []

        payload = {
            "botId": bot_id,
            "versionId": version_id,
            "indexName": self.config.index_name,
            "queries": queries,
            "topK": max(1, top_k),
        }
        if dictionary_terms is not None:
            payload["dictionaryTerms"] = dictionary_terms
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        try:
            data = _post_json(
                _batch_search_endpoint_url(self.config.endpoint_url),
                payload,
                headers,
                timeout=max(8.0, float(settings.aidot_vector_embedding_timeout_seconds)),
            )
        except VectorSearchError as exc:
            if "HTTP 404" not in str(exc) and "HTTP 405" not in str(exc):
                raise
            return [
                self.search(
                    bot_id=bot_id,
                    version_id=version_id,
                    query=query,
                    top_k=top_k,
                    dictionary_terms=dictionary_terms,
                )
                for query in queries
            ]

        raw_batches = data.get("matches") if isinstance(data, dict) else None
        if not isinstance(raw_batches, list) or len(raw_batches) != len(queries):
            raise VectorSearchError("Vector DB 배치 검색 응답 개수가 요청 개수와 일치하지 않습니다.")
        return [_parse_intent_matches(raw_matches, top_k) for raw_matches in raw_batches]

    def index_intents(
        self,
        *,
        bot_id: str,
        version_id: str,
        intents: list[dict[str, Any]],
        dictionary_terms: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        if not self.config.is_ready:
            raise VectorSearchError("Intent Vector DB 연결 설정이 완료되지 않았습니다.")

        endpoint_url = self._index_endpoint_url()
        payload = {
            "botId": bot_id,
            "versionId": version_id,
            "indexName": self.config.index_name,
            "intents": intents,
        }
        if dictionary_terms is not None:
            payload["dictionaryTerms"] = dictionary_terms
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        data = _post_json(endpoint_url, payload, headers, timeout=30)

        return data if isinstance(data, dict) else {}

    def configure_intents(
        self,
        *,
        bot_id: str,
        version_id: str,
        utterances: list[str],
        target_count: int,
        target_count_policy: str,
        dictionary_terms: list[dict[str, Any]],
        entity_terms: list[dict[str, Any]],
        scoring: dict[str, float],
    ) -> dict[str, Any]:
        if not self.config.is_ready:
            raise VectorSearchError("Intent Vector DB 연결 설정이 완료되지 않았습니다.")

        endpoint_url = self._configure_endpoint_url()
        payload = {
            "botId": bot_id,
            "versionId": version_id,
            "indexName": self.config.index_name,
            "utterances": utterances,
            "targetCount": target_count,
            "targetCountPolicy": target_count_policy,
            "dictionaryTerms": dictionary_terms,
            "entityTerms": entity_terms,
            "scoring": scoring,
        }
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        data = _post_json(endpoint_url, payload, headers, timeout=120)

        return data if isinstance(data, dict) else {}

    def _index_endpoint_url(self) -> str:
        return _index_endpoint_url(self.config.endpoint_url)

    def _configure_endpoint_url(self) -> str:
        endpoint_url = self.config.endpoint_url.strip()
        if endpoint_url.rstrip("/").endswith("/search"):
            return f"{endpoint_url.rstrip('/')[:-len('/search')]}/configure"
        if endpoint_url.rstrip("/").endswith("/index"):
            return f"{endpoint_url.rstrip('/')[:-len('/index')]}/configure"
        return endpoint_url


class AnswerVectorSearchClient:
    def __init__(self, config: VectorDbConfig) -> None:
        self.config = config

    def index_answers(
        self,
        *,
        bot_id: str,
        version_id: str,
        documents: list[dict[str, Any]],
        embedding_provider: str | None = None,
        embedding_model: str | None = None,
    ) -> dict[str, Any]:
        if not self.config.is_ready:
            raise VectorSearchError("Answer Vector DB 연결 설정이 완료되지 않았습니다.")

        payload = {
            "botId": bot_id,
            "versionId": version_id,
            "indexName": self.config.index_name,
            "documents": documents,
        }
        if embedding_provider:
            payload["embeddingProvider"] = embedding_provider
        if embedding_model:
            payload["embeddingModel"] = embedding_model
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        data = _post_json(
            _index_endpoint_url(self.config.endpoint_url),
            payload,
            headers,
            timeout=max(30.0, float(settings.answer_vector_index_timeout_seconds)),
        )

        return data if isinstance(data, dict) else {}

    def search(
        self,
        *,
        bot_id: str,
        version_id: str,
        query: str,
        top_k: int = 3,
        intent_ids: list[str] | None = None,
        embedding_provider: str | None = None,
        embedding_model: str | None = None,
    ) -> list[VectorAnswerMatch]:
        if not self.config.is_ready:
            raise VectorSearchError("Answer Vector DB 연결 설정이 완료되지 않았습니다.")

        payload: dict[str, Any] = {
            "botId": bot_id,
            "versionId": version_id,
            "indexName": self.config.index_name,
            "query": query,
            "topK": max(1, top_k),
        }
        if intent_ids is not None:
            payload["intentIds"] = intent_ids
        if embedding_provider:
            payload["embeddingProvider"] = embedding_provider
        if embedding_model:
            payload["embeddingModel"] = embedding_model
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        data = _post_json(self.config.endpoint_url, payload, headers, timeout=max(8.0, float(settings.aidot_vector_embedding_timeout_seconds)))

        raw_matches = data.get("matches") if isinstance(data, dict) else None
        if not isinstance(raw_matches, list):
            return []

        matches: list[VectorAnswerMatch] = []
        for item in raw_matches:
            if not isinstance(item, dict):
                continue
            score = item.get("score")
            try:
                score_value = float(score)
            except (TypeError, ValueError):
                score_value = 0.0
            if score_value > 1:
                score_value = score_value / 100
            matches.append(
                VectorAnswerMatch(
                    document_id=str(item.get("documentId") or item.get("document_id") or "").strip(),
                    title=str(item.get("title") or "").strip(),
                    text=str(item.get("text") or "").strip(),
                    score=max(0.0, min(1.0, score_value)),
                    metadata=item.get("metadata") if isinstance(item.get("metadata"), dict) else None,
                )
            )
        return sorted(matches, key=lambda item: item.score, reverse=True)[: max(1, top_k)]

    def export_answers(self, *, bot_id: str, version_id: str) -> dict[str, Any] | None:
        if not self.config.is_ready:
            raise VectorSearchError("Answer Vector DB 연결 설정이 완료되지 않았습니다.")

        endpoint_url = self._operation_endpoint_url("export")
        payload = {
            "botId": bot_id,
            "versionId": version_id,
            "indexName": self.config.index_name,
        }
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        data = _post_json(endpoint_url, payload, headers, timeout=30)
        if not isinstance(data, dict) or data.get("found") is not True:
            return None
        exported = data.get("payload")
        return exported if isinstance(exported, dict) else None

    def import_answers(self, *, bot_id: str, version_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.config.is_ready:
            raise VectorSearchError("Answer Vector DB 연결 설정이 완료되지 않았습니다.")

        endpoint_url = self._operation_endpoint_url("import")
        request_payload = {
            "botId": bot_id,
            "versionId": version_id,
            "indexName": self.config.index_name,
            "payload": payload,
        }
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        data = _post_json(endpoint_url, request_payload, headers, timeout=120)
        return data if isinstance(data, dict) else {}

    def copy_answers(
        self,
        *,
        source_bot_id: str,
        source_version_id: str,
        target_bot_id: str,
        target_version_id: str,
    ) -> dict[str, Any]:
        if not self.config.is_ready:
            raise VectorSearchError("Answer Vector DB 연결 설정이 완료되지 않았습니다.")

        endpoint_url = self._operation_endpoint_url("copy")
        payload = {
            "sourceBotId": source_bot_id,
            "sourceVersionId": source_version_id,
            "targetBotId": target_bot_id,
            "targetVersionId": target_version_id,
            "indexName": self.config.index_name,
        }
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        data = _post_json(endpoint_url, payload, headers, timeout=120)
        return data if isinstance(data, dict) else {}

    def _operation_endpoint_url(self, operation: str) -> str:
        endpoint_url = self.config.endpoint_url.strip()
        for suffix in ("/search", "/index"):
            if endpoint_url.rstrip("/").endswith(suffix):
                return f"{endpoint_url.rstrip('/')[:-len(suffix)]}/{operation}"
        return endpoint_url
