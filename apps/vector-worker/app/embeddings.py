from __future__ import annotations

import hashlib
import json
import math
import os
import re
import threading
import urllib.error
from http.client import HTTPConnection, HTTPSConnection, HTTPException
from typing import Protocol
from urllib.parse import urlparse


class EmbeddingModel(Protocol):
    name: str

    def embed(self, text: str) -> list[float]:
        ...

    def embed_many(self, texts: list[str]) -> list[list[float]]:
        ...


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip().lower())


def _l2_normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vector))
    if norm <= 0:
        return vector
    return [value / norm for value in vector]


class HashEmbeddingModel:
    def __init__(self, *, dimension: int = 384, name: str = "local-hash-ko") -> None:
        self.dimension = max(32, dimension)
        self.name = name

    def embed(self, text: str) -> list[float]:
        normalized = _normalize(text)
        vector = [0.0] * self.dimension
        if not normalized:
            return vector

        tokens = re.findall(r"[0-9a-zA-Z가-힣_]+", normalized)
        features = list(tokens)
        compact = normalized.replace(" ", "")
        features.extend(compact[index : index + 2] for index in range(max(0, len(compact) - 1)))
        features.extend(compact[index : index + 3] for index in range(max(0, len(compact) - 2)))

        for feature in features:
            digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=8).digest()
            bucket = int.from_bytes(digest[:4], "big") % self.dimension
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vector[bucket] += sign
        return _l2_normalize(vector)

    def embed_many(self, texts: list[str]) -> list[list[float]]:
        return [self.embed(text) for text in texts]


class SentenceTransformerEmbeddingModel:
    def __init__(self, model_name: str) -> None:
        try:
            from sentence_transformers import SentenceTransformer
        except Exception as exc:  # pragma: no cover - optional runtime dependency
            raise RuntimeError("sentence-transformers 패키지가 필요합니다.") from exc
        self.name = model_name
        self.device = _resolve_sentence_transformer_device()
        self._model = SentenceTransformer(model_name, device=self.device)

    def embed(self, text: str) -> list[float]:
        vector = self._model.encode(_normalize(text), normalize_embeddings=True)
        return [float(value) for value in vector]

    def embed_many(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        vectors = self._model.encode(
            [_normalize(text) for text in texts],
            normalize_embeddings=True,
        )
        return [[float(value) for value in vector] for vector in vectors]


def _resolve_sentence_transformer_device() -> str:
    """Use CUDA only when the container exposes a usable GPU.

    ``AIDOT_EMBEDDING_DEVICE`` may explicitly request ``cpu`` or ``cuda``.
    The default ``auto`` never fails a request merely because CUDA is absent.
    """
    requested = os.getenv("AIDOT_EMBEDDING_DEVICE", "auto").strip().lower()
    if requested in {"cpu", "mps"}:
        return requested
    try:
        import torch
    except Exception:
        return "cpu"
    if requested == "cuda":
        return "cuda" if torch.cuda.is_available() else "cpu"
    return "cuda" if torch.cuda.is_available() else "cpu"


def embedding_runtime_device(model: EmbeddingModel) -> str:
    return str(getattr(model, "device", "cpu"))


class OllamaEmbeddingModel:
    def __init__(self, model_name: str, *, base_url: str, timeout_seconds: float = 60) -> None:
        self.name = model_name or "bge-m3:latest"
        self.device = "ollama"
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        parsed = urlparse(self.base_url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise RuntimeError("Ollama 임베딩 서버 URL 형식이 올바르지 않습니다.")
        self._scheme = parsed.scheme
        self._host = parsed.hostname
        self._port = parsed.port or (443 if parsed.scheme == "https" else 80)
        base_path = parsed.path.rstrip("/")
        self._base_path = "" if base_path == "/" else base_path
        self._connections = threading.local()

    def _connect(self) -> HTTPConnection | HTTPSConnection:
        connection = getattr(self._connections, "connection", None)
        if connection is None:
            connection_class = HTTPSConnection if self._scheme == "https" else HTTPConnection
            connection = connection_class(self._host, self._port, timeout=self.timeout_seconds)
            self._connections.connection = connection
        else:
            connection.timeout = self.timeout_seconds
        return connection

    def _close(self) -> None:
        connection = getattr(self._connections, "connection", None)
        if connection is not None:
            connection.close()
            self._connections.connection = None

    def _post_json(self, path: str, payload: dict[str, object]) -> dict[str, object]:
        request_body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request_headers = {
            "Content-Type": "application/json",
            "Content-Length": str(len(request_body)),
            "Connection": "keep-alive",
        }
        request_path = f"{self._base_path}{path}"
        for attempt in range(2):
            try:
                connection = self._connect()
                connection.request("POST", request_path, body=request_body, headers=request_headers)
                response = connection.getresponse()
                response_body = response.read()
                if response.status >= 400:
                    self._close()
                    raise urllib.error.HTTPError(
                        f"{self.base_url}{path}",
                        response.status,
                        response.reason,
                        response.headers,
                        None,
                    )
                body = response_body.decode("utf-8")
                break
            except urllib.error.HTTPError:
                raise
            except (OSError, HTTPException) as exc:
                self._close()
                if attempt == 0:
                    continue
                raise urllib.error.URLError(exc) from exc
        else:
            raise urllib.error.URLError("Ollama 임베딩 요청에 실패했습니다.")
        parsed = json.loads(body)
        if not isinstance(parsed, dict):
            raise RuntimeError("Ollama 임베딩 응답 형식이 올바르지 않습니다.")
        return parsed

    def embed(self, text: str) -> list[float]:
        normalized = _normalize(text)
        if not normalized:
            return []

        try:
            response = self._post_json("/api/embed", {"model": self.name, "input": normalized})
            raw_vector = _extract_ollama_embedding(response)
        except urllib.error.HTTPError:
            response = self._post_json("/api/embeddings", {"model": self.name, "prompt": normalized})
            raw_vector = _extract_ollama_embedding(response)
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Ollama 임베딩 서버에 연결할 수 없습니다: {self.base_url}") from exc
        return _l2_normalize([float(value) for value in raw_vector])

    def embed_many(self, texts: list[str]) -> list[list[float]]:
        normalized_texts = [_normalize(text) for text in texts]
        if not normalized_texts:
            return []

        non_empty_indexes = [index for index, text in enumerate(normalized_texts) if text]
        if not non_empty_indexes:
            return [[] for _ in normalized_texts]

        batch_input = [normalized_texts[index] for index in non_empty_indexes]
        try:
            response = self._post_json("/api/embed", {"model": self.name, "input": batch_input})
            batch_vectors = _extract_ollama_embeddings(response)
        except urllib.error.HTTPError:
            return [self.embed(text) if text else [] for text in normalized_texts]
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Ollama 임베딩 서버에 연결할 수 없습니다: {self.base_url}") from exc

        if len(batch_vectors) != len(batch_input):
            raise RuntimeError("Ollama 배치 임베딩 응답 개수가 요청 문장 개수와 다릅니다.")

        result: list[list[float]] = [[] for _ in normalized_texts]
        for index, raw_vector in zip(non_empty_indexes, batch_vectors, strict=True):
            result[index] = _l2_normalize(raw_vector)
        return result


class LlmProviderEmbeddingModel:
    _OPENAI_COMPATIBLE_DEFAULTS: dict[str, tuple[str, str]] = {
        "chatgpt": ("https://api.openai.com/v1", "OPENAI_API_KEY"),
        "groq": ("https://api.groq.com/openai/v1", "GROQ_API_KEY"),
        "cerebras": ("https://api.cerebras.ai/v1", "CEREBRAS_API_KEY"),
        "mistral": ("https://api.mistral.ai/v1", "MISTRAL_API_KEY"),
        "openrouter": ("https://openrouter.ai/api/v1", "OPENROUTER_API_KEY"),
    }

    _MODEL_ALIASES: dict[str, str] = {
        "mistral-small": "mistral-small-latest",
        "mistral-medium": "mistral-medium-latest",
        "mistral-large": "mistral-large-latest",
        "openrouter-auto": "openrouter/auto",
        "openrouter-gpt-4o-mini": "openai/gpt-4o-mini",
        "ollama-local": os.getenv("AIDOT_OLLAMA_MODEL") or os.getenv("OLLAMA_MODEL") or "llama3.1:latest",
        "llama3.1-local": "llama3.1:latest",
    }

    def __init__(self, provider: str, model_name: str, *, ollama_base_url: str, timeout_seconds: float = 60) -> None:
        self.provider = provider.strip().lower()
        self.name = self._MODEL_ALIASES.get((model_name or "").strip(), (model_name or "").strip())
        self.ollama_base_url = ollama_base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        if not self.provider:
            raise RuntimeError("LLM 임베딩 provider가 비어 있습니다.")
        if not self.name:
            raise RuntimeError("LLM 임베딩 model이 비어 있습니다.")
        self._ollama_model = (
            OllamaEmbeddingModel(self.name, base_url=self.ollama_base_url, timeout_seconds=self.timeout_seconds)
            if self.provider == "ollama"
            else None
        )

    def embed(self, text: str) -> list[float]:
        normalized = _normalize(text)
        if not normalized:
            return []
        if self.provider == "ollama":
            assert self._ollama_model is not None
            return self._ollama_model.embed(normalized)
        if self.provider == "gemini":
            return self._embed_gemini(normalized)
        if self.provider == "claude":
            raise RuntimeError("Claude는 현재 임베딩 API를 지원하지 않아 LLM RAG 임베딩에 사용할 수 없습니다.")
        return self._embed_openai_compatible(normalized)

    def embed_many(self, texts: list[str]) -> list[list[float]]:
        if self.provider == "ollama":
            assert self._ollama_model is not None
            return self._ollama_model.embed_many(texts)
        return [self.embed(text) for text in texts]

    def _env_value(self, name: str) -> str:
        return os.getenv(f"AIDOT_{name}") or os.getenv(name) or ""

    def _post_json(self, endpoint: str, payload: dict[str, object], headers: dict[str, str] | None = None) -> dict[str, object]:
        from urllib.request import Request, urlopen

        request_headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "Aidot Vector Worker",
            **(headers or {}),
        }
        if self.provider == "openrouter":
            request_headers.setdefault("HTTP-Referer", "http://localhost:3320")
            request_headers.setdefault("X-Title", "Aidot")
        request = Request(
            endpoint,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers=request_headers,
            method="POST",
        )
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                body = response.read().decode("utf-8", errors="replace")
        except Exception as exc:
            raise RuntimeError(f"LLM 임베딩 호출 실패: endpoint={endpoint}, {exc}") from exc
        try:
            data = json.loads(body) if body else {}
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"LLM 임베딩 응답 JSON 파싱 실패: {body[:300]}") from exc
        return data if isinstance(data, dict) else {}

    def _embed_openai_compatible(self, text: str) -> list[float]:
        default = self._OPENAI_COMPATIBLE_DEFAULTS.get(self.provider)
        if default is None:
            raise RuntimeError(f"지원하지 않는 LLM 임베딩 provider입니다: {self.provider}")
        default_base_url, api_key_env = default
        base_url = self._env_value(f"{self.provider.upper()}_BASE_URL") or default_base_url
        api_key = self._env_value(f"{self.provider.upper()}_API_KEY") or self._env_value(api_key_env)
        if not api_key:
            raise RuntimeError(f"{self.provider} LLM 임베딩 API Key가 설정되지 않았습니다.")
        data = self._post_json(
            f"{base_url.rstrip('/')}/embeddings",
            {"model": self.name, "input": text},
            {"Authorization": f"Bearer {api_key}"},
        )
        raw_items = data.get("data")
        if isinstance(raw_items, list) and raw_items:
            first = raw_items[0]
            if isinstance(first, dict) and isinstance(first.get("embedding"), list):
                return _l2_normalize([float(value) for value in first["embedding"] if isinstance(value, int | float)])
        raise RuntimeError("LLM 임베딩 응답에서 vector를 찾을 수 없습니다.")

    def _embed_gemini(self, text: str) -> list[float]:
        api_key = self._env_value("GEMINI_API_KEY") or self._env_value("GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError("Gemini LLM 임베딩 API Key가 설정되지 않았습니다.")
        base_url = self._env_value("GEMINI_BASE_URL") or "https://generativelanguage.googleapis.com/v1beta"
        data = self._post_json(
            f"{base_url.rstrip('/')}/models/{self.name}:embedContent?key={api_key}",
            {"content": {"parts": [{"text": text}]}},
        )
        embedding = data.get("embedding")
        values = embedding.get("values") if isinstance(embedding, dict) else None
        if isinstance(values, list):
            return _l2_normalize([float(value) for value in values if isinstance(value, int | float)])
        raise RuntimeError("Gemini 임베딩 응답에서 vector를 찾을 수 없습니다.")


def _extract_ollama_embedding(response: dict[str, object]) -> list[float]:
    embedding = response.get("embedding")
    if isinstance(embedding, list):
        return [float(value) for value in embedding if isinstance(value, int | float)]

    embeddings = response.get("embeddings")
    if isinstance(embeddings, list) and embeddings:
        first = embeddings[0]
        if isinstance(first, list):
            return [float(value) for value in first if isinstance(value, int | float)]
    raise RuntimeError("Ollama 임베딩 응답에서 vector를 찾을 수 없습니다.")


def _extract_ollama_embeddings(response: dict[str, object]) -> list[list[float]]:
    embeddings = response.get("embeddings")
    if not isinstance(embeddings, list):
        raise RuntimeError("Ollama 배치 임베딩 응답에서 vectors를 찾을 수 없습니다.")
    return [
        [float(value) for value in vector if isinstance(value, int | float)]
        for vector in embeddings
        if isinstance(vector, list)
    ]


def create_embedding_model(
    provider: str,
    model_name: str,
    *,
    dimension: int = 384,
    ollama_base_url: str = "http://192.168.220.180:11434",
    timeout_seconds: float = 60,
) -> EmbeddingModel:
    if provider.startswith("llm:"):
        return LlmProviderEmbeddingModel(
            provider.removeprefix("llm:"),
            model_name,
            ollama_base_url=ollama_base_url,
            timeout_seconds=timeout_seconds,
        )
    if provider in {"aidot_vector_worker", "local_hash", "hash"}:
        return HashEmbeddingModel(dimension=dimension, name=model_name or "semantic_engine_default")
    if provider == "sentence_transformers":
        return SentenceTransformerEmbeddingModel(model_name)
    if provider == "ollama":
        return OllamaEmbeddingModel(model_name, base_url=ollama_base_url, timeout_seconds=timeout_seconds)
    return HashEmbeddingModel(dimension=dimension, name=model_name or "local-hash-ko")
