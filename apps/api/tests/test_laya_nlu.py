import io
import json
from urllib.error import HTTPError

import pytest

from app.core.config import settings
from app.services import laya_nlu
from app.services.laya_nlu import LayaNluError, build_intent_criteria, classify_intent_with_laya


DIALOGS = [
    {"id": "refund", "displayName": "환불 요청", "dialogType": "1", "utterances": ["돈 돌려주세요", "환불해 주세요"]},
    {"id": "status", "name": "청구 진행", "dialogType": "1", "utterances": [{"text": "심사 언제 끝나요"}]},
    {"id": "greeting", "displayName": "인사", "dialogType": "2", "utterances": ["안녕"]},
]


class _FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def test_criteria_keep_intents_only_and_include_examples():
    criteria = build_intent_criteria(DIALOGS)
    assert set(criteria) == {"refund", "status"}
    assert criteria["refund"] == "환불 요청 (예: 돈 돌려주세요 / 환불해 주세요)"
    assert criteria["status"] == "청구 진행 (예: 심사 언제 끝나요)"


def test_criteria_handle_missing_dialogs():
    assert build_intent_criteria(None) == {}
    assert build_intent_criteria("not-a-list") == {}


def test_classify_posts_one_choice_question_and_ranks_probabilities(monkeypatch):
    monkeypatch.setattr(settings, "laya_serve_base_url", "http://laya-serve:8000/")
    monkeypatch.setattr(settings, "laya_serve_api_key", "secret")
    monkeypatch.setattr(settings, "laya_serve_model_name", "intent")
    captured = {}

    def fake_urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["auth"] = request.get_header("Authorization")
        captured["timeout"] = timeout
        captured["body"] = json.loads(request.data.decode("utf-8"))
        body = {"answers": {"intent": {"type": "choice", "choice": "refund",
                                       "probabilities": {"status": 0.2, "refund": 0.8}}}}
        return _FakeResponse(json.dumps(body).encode("utf-8"))

    monkeypatch.setattr(laya_nlu, "urlopen", fake_urlopen)
    ranked = classify_intent_with_laya(query="돈 돌려주세요", criteria=build_intent_criteria(DIALOGS))

    assert ranked == [("refund", 0.8), ("status", 0.2)]
    assert captured["url"] == "http://laya-serve:8000/v1/systemone"
    assert captured["auth"] == "Bearer secret"
    assert captured["timeout"] == settings.laya_serve_timeout_seconds
    assert captured["body"]["model"] == "intent"
    assert captured["body"]["state"] == "돈 돌려주세요"
    question = captured["body"]["questions"]["intent"]
    assert question["type"] == "choice"
    assert set(question["criteria"]) == {"refund", "status"}


def test_classify_requires_a_configured_server(monkeypatch):
    monkeypatch.setattr(settings, "laya_serve_base_url", "")
    with pytest.raises(LayaNluError):
        classify_intent_with_laya(query="x", criteria={"a": "A", "b": "B"})


def test_classify_wraps_http_errors(monkeypatch):
    monkeypatch.setattr(settings, "laya_serve_base_url", "http://laya-serve:8000")

    def fake_urlopen(request, timeout):
        raise HTTPError(request.full_url, 401, "Unauthorized", {}, None)

    monkeypatch.setattr(laya_nlu, "urlopen", fake_urlopen)
    with pytest.raises(LayaNluError, match="HTTP 401"):
        classify_intent_with_laya(query="x", criteria={"a": "A", "b": "B"})


def test_single_intent_needs_no_server_call(monkeypatch):
    monkeypatch.setattr(settings, "laya_serve_base_url", "http://laya-serve:8000")

    def fail(*args, **kwargs):
        raise AssertionError("no request expected")

    monkeypatch.setattr(laya_nlu, "urlopen", fail)
    assert classify_intent_with_laya(query="x", criteria={"only": "Only"}) == [("only", 1.0)]
