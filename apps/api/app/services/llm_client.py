from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from app.core.config import settings


class LlmClientError(RuntimeError):
    pass


@dataclass(frozen=True)
class LlmProviderConfig:
    provider: str
    model: str
    base_url: str
    api_key: str = ""
    timeout_seconds: int | None = None


@dataclass(frozen=True)
class LlmChatResult:
    content: str
    provider: str
    model: str
    latency_ms: int
    raw: dict[str, Any]


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

_DEFAULT_OLLAMA_BASE_URL = "http://192.168.220.180:11434"
def _env_key(provider: str, suffix: str) -> str:
    return f"AIDOT_{provider.upper()}_{suffix}"


def _env_value(name: str) -> str:
    return os.getenv(name) or str(getattr(settings, name.lower(), "") or "")


def _normalize_ollama_base_url(value: str | None) -> str:
    base_url = (value or _DEFAULT_OLLAMA_BASE_URL).strip().rstrip("/")
    for suffix in ("/api/chat", "/api/generate", "/api/embed", "/api/embeddings"):
        if base_url.endswith(suffix):
            return base_url[: -len(suffix)].rstrip("/")
    return base_url


def resolve_llm_provider_config(
    provider: str | None,
    model: str | None,
    api_key: str | None = None,
    base_url: str | None = None,
    timeout_seconds: int | None = None,
) -> LlmProviderConfig:
    provider_value = (provider or "").strip().lower()
    model_value = (model or "").strip()
    if not provider_value:
        raise LlmClientError("LLM Provider가 설정되지 않았습니다.")
    if not model_value:
        raise LlmClientError("LLM 모델이 설정되지 않았습니다.")
    resolved_model = _MODEL_ALIASES.get(model_value, model_value)
    configured_base_url = (base_url or "").strip()

    if provider_value == "ollama":
        return LlmProviderConfig(
            provider=provider_value,
            model=resolved_model,
            base_url=_normalize_ollama_base_url(
                configured_base_url or _env_value("AIDOT_OLLAMA_BASE_URL") or _env_value("OLLAMA_BASE_URL")
            ),
        )

    if provider_value == "claude":
        return LlmProviderConfig(
            provider=provider_value,
            model=resolved_model,
            base_url=(_env_value("AIDOT_CLAUDE_BASE_URL") or "https://api.anthropic.com/v1").rstrip("/"),
            api_key=_env_value("ANTHROPIC_API_KEY") or _env_value("CLAUDE_API_KEY"),
        )

    if provider_value == "gemini":
        return LlmProviderConfig(
            provider=provider_value,
            model=resolved_model,
            base_url=(_env_value("AIDOT_GEMINI_BASE_URL") or "https://generativelanguage.googleapis.com/v1beta").rstrip("/"),
            api_key=_env_value("GEMINI_API_KEY") or _env_value("GOOGLE_API_KEY"),
        )

    default = _OPENAI_COMPATIBLE_DEFAULTS.get(provider_value)
    if default is None:
        raise LlmClientError(f"지원하지 않는 LLM Provider입니다: {provider_value}")
    default_base_url, api_key_env = default
    return LlmProviderConfig(
        provider=provider_value,
        model=resolved_model,
        base_url=(_env_value(_env_key(provider_value, "BASE_URL")) or default_base_url).rstrip("/"),
        api_key=_env_value(_env_key(provider_value, "API_KEY")) or _env_value(api_key_env),
    )


class LlmChatClient:
    def __init__(self, config: LlmProviderConfig) -> None:
        self.config = config

    def chat(self, *, system_prompt: str, user_prompt: str, json_mode: bool = False) -> LlmChatResult:
        started = time.perf_counter()
        if self.config.provider == "ollama":
            raw = self._chat_ollama(system_prompt=system_prompt, user_prompt=user_prompt, json_mode=json_mode)
            content = str(raw.get("message", {}).get("content") or raw.get("response") or "").strip()
        elif self.config.provider == "claude":
            raw = self._chat_claude(system_prompt=system_prompt, user_prompt=user_prompt)
            content = self._content_from_claude(raw)
        elif self.config.provider == "gemini":
            raw = self._chat_gemini(system_prompt=system_prompt, user_prompt=user_prompt, json_mode=json_mode)
            content = self._content_from_gemini(raw)
        else:
            raw = self._chat_openai_compatible(system_prompt=system_prompt, user_prompt=user_prompt, json_mode=json_mode)
            content = self._content_from_openai(raw)
        if not content:
            raise LlmClientError("LLM 응답 본문이 비어 있습니다.")
        latency_ms = round((time.perf_counter() - started) * 1000)
        return LlmChatResult(
            content=content,
            provider=self.config.provider,
            model=self.config.model,
            latency_ms=latency_ms,
            raw=raw,
        )

    def _post_json(self, endpoint: str, payload: dict[str, Any], headers: dict[str, str] | None = None) -> dict[str, Any]:
        request_headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "Aidot/2.0 LLM Client",
            **(headers or {}),
        }
        if self.config.provider == "openrouter":
            request_headers.setdefault("HTTP-Referer", "http://localhost:3320")
            request_headers.setdefault("X-Title", "Aidot")
        request = Request(
            endpoint,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers=request_headers,
            method="POST",
        )
        try:
            with urlopen(request, timeout=None) as response:
                response_text = response.read().decode("utf-8", errors="replace")
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise LlmClientError(
                f"LLM 호출 실패: endpoint={endpoint}, HTTP {exc.code} {detail}"
            ) from exc
        except Exception as exc:
            raise LlmClientError(
                f"LLM 호출 실패: endpoint={endpoint}, {exc}"
            ) from exc
        try:
            data = json.loads(response_text) if response_text else {}
        except json.JSONDecodeError as exc:
            raise LlmClientError(f"LLM 응답 JSON 파싱 실패: {response_text[:300]}") from exc
        return data if isinstance(data, dict) else {}

    def _chat_ollama(self, *, system_prompt: str, user_prompt: str, json_mode: bool = False) -> dict[str, Any]:
        chat_payload: dict[str, Any] = {
            "model": self.config.model,
            "stream": False,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "options": {"temperature": 0},
        }
        generate_payload: dict[str, Any] = {
            "model": self.config.model,
            "stream": False,
            "prompt": f"{system_prompt}\n\n{user_prompt}",
            "options": {"temperature": 0},
        }
        if json_mode:
            chat_payload["format"] = "json"
            generate_payload["format"] = "json"
        try:
            return self._post_json(
                f"{self.config.base_url}/api/chat",
                chat_payload,
            )
        except LlmClientError as chat_error:
            try:
                return self._post_json(
                    f"{self.config.base_url}/api/generate",
                    generate_payload,
                )
            except LlmClientError as generate_error:
                raise LlmClientError(
                    f"Ollama 호출 실패: /api/chat={chat_error}; /api/generate={generate_error}"
                ) from generate_error

    def _chat_openai_compatible(self, *, system_prompt: str, user_prompt: str, json_mode: bool = False) -> dict[str, Any]:
        if not self.config.api_key:
            raise LlmClientError(f"{self.config.provider} API Key가 설정되지 않았습니다.")
        payload: dict[str, Any] = {
            "model": self.config.model,
            "temperature": 0,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        return self._post_json(
            f"{self.config.base_url}/chat/completions",
            payload,
            {"Authorization": f"Bearer {self.config.api_key}"},
        )

    def _chat_claude(self, *, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        if not self.config.api_key:
            raise LlmClientError("Claude API Key가 설정되지 않았습니다.")
        return self._post_json(
            f"{self.config.base_url}/messages",
            {
                "model": self.config.model,
                "max_tokens": 1000,
                "temperature": 0,
                "system": system_prompt,
                "messages": [{"role": "user", "content": user_prompt}],
            },
            {
                "x-api-key": self.config.api_key,
                "anthropic-version": "2023-06-01",
            },
        )

    def _chat_gemini(self, *, system_prompt: str, user_prompt: str, json_mode: bool = False) -> dict[str, Any]:
        if not self.config.api_key:
            raise LlmClientError("Gemini API Key가 설정되지 않았습니다.")
        endpoint = f"{self.config.base_url}/models/{self.config.model}:generateContent?key={self.config.api_key}"
        generation_config: dict[str, Any] = {"temperature": 0}
        if json_mode:
            generation_config["response_mime_type"] = "application/json"
        return self._post_json(
            endpoint,
            {
                "system_instruction": {"parts": [{"text": system_prompt}]},
                "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                "generationConfig": generation_config,
            },
        )

    @staticmethod
    def _content_from_openai(raw: dict[str, Any]) -> str:
        choices = raw.get("choices")
        if not isinstance(choices, list) or not choices:
            return ""
        first = choices[0]
        if not isinstance(first, dict):
            return ""
        message = first.get("message")
        if isinstance(message, dict):
            return str(message.get("content") or "").strip()
        return str(first.get("text") or "").strip()

    @staticmethod
    def _content_from_claude(raw: dict[str, Any]) -> str:
        content = raw.get("content")
        if not isinstance(content, list):
            return ""
        texts = [str(item.get("text") or "").strip() for item in content if isinstance(item, dict)]
        return "\n".join(text for text in texts if text)

    @staticmethod
    def _content_from_gemini(raw: dict[str, Any]) -> str:
        candidates = raw.get("candidates")
        if not isinstance(candidates, list) or not candidates:
            return ""
        content = candidates[0].get("content") if isinstance(candidates[0], dict) else None
        parts = content.get("parts") if isinstance(content, dict) else None
        if not isinstance(parts, list):
            return ""
        texts = [str(item.get("text") or "").strip() for item in parts if isinstance(item, dict)]
        return "\n".join(text for text in texts if text)
