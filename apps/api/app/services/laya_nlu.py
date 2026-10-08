"""Laya NLU: intent classification through a self-hosted laya-serve endpoint.

Laya answers one ``choice`` question over the bot's intents and returns a probability per
intent. The intent ids are the criteria keys, so the caller can map the winner back to a dialog.
"""

from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import settings

INTENT_QUESTION_ID = "intent"
INTENT_QUESTION_TEXT = "고객 문의가 원하는 의도는 무엇인가요?"
INTENT_EXAMPLE_LIMIT = 3


class LayaNluError(RuntimeError):
    """Raised when laya-serve cannot be reached or its answer cannot be read."""


def _intent_dialogs(dialogs: Any) -> list[dict[str, Any]]:
    if not isinstance(dialogs, list):
        return []
    return [
        dialog
        for dialog in dialogs
        if isinstance(dialog, dict) and str(dialog.get("dialogType") or "1") in {"1", "1.0"}
    ]


def _intent_key(dialog: dict[str, Any]) -> str:
    for field in ("id", "dialogKey", "name", "displayName"):
        value = str(dialog.get(field) or "").strip()
        if value:
            return value
    return ""


def _example_texts(dialog: dict[str, Any]) -> list[str]:
    utterances = dialog.get("utterances")
    if not isinstance(utterances, list):
        return []
    texts: list[str] = []
    for item in utterances:
        if isinstance(item, dict):
            item = item.get("text")
        text = str(item or "").strip()
        if text:
            texts.append(text)
        if len(texts) >= INTENT_EXAMPLE_LIMIT:
            break
    return texts


def build_intent_criteria(dialogs: Any) -> dict[str, str]:
    """Map each intent key to a description Laya can read (name plus a few example utterances)."""
    criteria: dict[str, str] = {}
    for dialog in _intent_dialogs(dialogs):
        key = _intent_key(dialog)
        if not key or key in criteria:
            continue
        name = str(dialog.get("displayName") or dialog.get("name") or key).strip()
        examples = _example_texts(dialog)
        criteria[key] = f"{name} (예: {' / '.join(examples)})" if examples else name
    return criteria


def classify_intent_with_laya(*, query: str, criteria: dict[str, str]) -> list[tuple[str, float]]:
    """Return (intent_key, probability) pairs, most likely first. Raises LayaNluError on failure."""
    base_url = (settings.laya_serve_base_url or "").rstrip("/")
    if not base_url:
        raise LayaNluError("LAYA_SERVE_BASE_URL is not configured.")
    if not criteria:
        return []
    if len(criteria) == 1:
        only_key = next(iter(criteria))
        return [(only_key, 1.0)]

    body = {
        "state": query,
        "model": settings.laya_serve_model_name,
        "questions": {
            INTENT_QUESTION_ID: {
                "type": "choice",
                "instructions": INTENT_QUESTION_TEXT,
                "criteria": criteria,
            }
        },
    }
    headers = {"Content-Type": "application/json"}
    if settings.laya_serve_api_key:
        headers["Authorization"] = f"Bearer {settings.laya_serve_api_key}"
    request = Request(
        f"{base_url}/v1/systemone",
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urlopen(request, timeout=settings.laya_serve_timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        raise LayaNluError(f"laya-serve returned HTTP {error.code}") from error
    except (URLError, TimeoutError, OSError, ValueError) as error:
        raise LayaNluError(f"laya-serve request failed: {error}") from error

    answers = payload.get("answers") if isinstance(payload, dict) else None
    answer = answers.get(INTENT_QUESTION_ID) if isinstance(answers, dict) else None
    probabilities = answer.get("probabilities") if isinstance(answer, dict) else None
    if not isinstance(probabilities, dict):
        raise LayaNluError("laya-serve response has no intent probabilities.")
    ranked = [(str(key), float(value)) for key, value in probabilities.items()]
    ranked.sort(key=lambda item: item[1], reverse=True)
    return ranked
