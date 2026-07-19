from app.services import vector_search
from app.services.vector_search import IntentVectorSearchClient, VectorDbConfig


def test_intent_search_uses_configured_embedding_timeout(monkeypatch) -> None:
    client = IntentVectorSearchClient(
        VectorDbConfig(enabled=True, endpoint_url="http://vector-worker:8350/intent/search", index_name="aidot-intent")
    )
    monkeypatch.setattr(vector_search.settings, "aidot_vector_embedding_timeout_seconds", 120.0)
    observed: dict[str, float] = {}

    def fake_post_json(endpoint_url, payload, headers, timeout):
        observed["timeout"] = timeout
        return {"matches": []}

    monkeypatch.setattr(vector_search, "_post_json", fake_post_json)

    assert client.search(bot_id="bot", version_id="version", query="검색") == []
    assert observed["timeout"] == 120.0


def test_intent_batch_search_uses_batch_endpoint_and_preserves_order(monkeypatch) -> None:
    client = IntentVectorSearchClient(
        VectorDbConfig(enabled=True, endpoint_url="http://vector-worker:8350/intent/search", index_name="aidot-intent")
    )
    observed: dict[str, object] = {}

    def fake_post_json(endpoint_url, payload, headers, timeout):
        observed["endpoint_url"] = endpoint_url
        observed["queries"] = payload["queries"]
        return {
            "matches": [
                [{"intentId": "intent-1", "intentName": "첫 의도", "score": 0.9, "matchedText": "첫 문장"}],
                [{"intentId": "intent-2", "intentName": "둘째 의도", "score": 0.8, "matchedText": "둘째 문장"}],
            ]
        }

    monkeypatch.setattr(vector_search, "_post_json", fake_post_json)
    matches = client.search_batch(
        bot_id="bot",
        version_id="version",
        queries=["첫 질의", "둘째 질의"],
    )

    assert observed["endpoint_url"] == "http://vector-worker:8350/intent/search-batch"
    assert observed["queries"] == ["첫 질의", "둘째 질의"]
    assert [items[0].intent_id for items in matches] == ["intent-1", "intent-2"]
