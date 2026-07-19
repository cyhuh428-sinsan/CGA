from __future__ import annotations

import logging

from app.core import cache
from app.core.config import settings


def setup_function() -> None:
    cache._reset_cache_metrics()


def test_cache_aside_json_uses_producer_when_cache_disabled(monkeypatch) -> None:
    monkeypatch.setattr(settings, "cache_enabled", False)

    calls = 0

    def producer() -> dict[str, object]:
        nonlocal calls
        calls += 1
        return {"items": [1, 2, 3]}

    assert cache.cache_aside_json("test:key", producer) == {"items": [1, 2, 3]}
    assert calls == 1
    snapshot = cache.cache_status_snapshot()
    assert snapshot["backend"] == "disabled"
    assert snapshot["connection_state"] == "disabled"


def test_cache_aside_json_falls_back_when_redis_package_unavailable(monkeypatch, caplog) -> None:
    monkeypatch.setattr(settings, "cache_enabled", True)
    monkeypatch.setattr(cache, "redis", None)
    monkeypatch.setattr(cache, "_redis_client", None)
    monkeypatch.setattr(cache, "_redis_unavailable", False)

    calls = 0

    def producer() -> dict[str, object]:
        nonlocal calls
        calls += 1
        return {"status": "fallback"}

    with caplog.at_level(logging.WARNING):
        assert cache.cache_aside_json("test:key", producer) == {"status": "fallback"}
    assert calls == 1
    snapshot = cache.cache_status_snapshot()
    assert snapshot["package_installed"] is False
    assert snapshot["connection_state"] == "package_missing"
    assert "redis package" in str(snapshot["last_error"])
    assert any(getattr(record, "event", None) == "cache.redis_package_missing" for record in caplog.records)


def test_cache_aside_json_records_hit_and_miss_metrics(monkeypatch) -> None:
    class FakeRedisClient:
        def __init__(self) -> None:
            self.items = {"test:hit": '{"status":"hit"}'}
            self.writes: list[tuple[str, int, str]] = []

        def get(self, key: str) -> str | None:
            return self.items.get(key)

        def setex(self, key: str, ttl: int, value: str) -> None:
            self.writes.append((key, ttl, value))
            self.items[key] = value

    client = FakeRedisClient()
    monkeypatch.setattr(settings, "cache_enabled", True)
    monkeypatch.setattr(settings, "redis_url", "redis://localhost:6379/0")
    monkeypatch.setattr(cache, "redis", object())
    monkeypatch.setattr(cache, "_redis_client", client)
    monkeypatch.setattr(cache, "_redis_unavailable", False)

    calls = 0

    def producer() -> dict[str, object]:
        nonlocal calls
        calls += 1
        return {"status": "miss"}

    assert cache.cache_aside_json("test:hit", producer) == {"status": "hit"}
    assert cache.cache_aside_json("test:miss", producer, ttl_seconds=30) == {"status": "miss"}
    assert calls == 1
    assert client.writes

    snapshot = cache.cache_status_snapshot()
    assert snapshot["enabled"] is True
    assert snapshot["backend"] == "redis"
    assert snapshot["available"] is True
    assert snapshot["redis_url_configured"] is True
    assert snapshot["package_installed"] is True
    assert snapshot["connection_state"] == "available"
    assert snapshot["hits"] == 1
    assert snapshot["misses"] == 1
    assert snapshot["fallbacks"] == 0
    assert snapshot["hit_rate"] == 50
    assert snapshot["memory_used_bytes"] is None
    assert snapshot["memory_max_bytes"] is None
    assert snapshot["memory_usage_percent"] is None


def test_cache_status_snapshot_includes_redis_memory(monkeypatch) -> None:
    class FakeRedisClient:
        def info(self, section: str) -> dict[str, int]:
            assert section == "memory"
            return {"used_memory": 80, "maxmemory": 100}

    monkeypatch.setattr(settings, "cache_enabled", True)
    monkeypatch.setattr(settings, "redis_url", "redis://localhost:6379/0")
    monkeypatch.setattr(cache, "redis", object())
    monkeypatch.setattr(cache, "_redis_client", FakeRedisClient())
    monkeypatch.setattr(cache, "_redis_unavailable", False)

    snapshot = cache.cache_status_snapshot()

    assert snapshot["memory_used_bytes"] == 80
    assert snapshot["memory_max_bytes"] == 100
    assert snapshot["memory_usage_percent"] == 80


def test_cache_aside_json_records_read_error_fallback(monkeypatch, caplog) -> None:
    class FailingRedisClient:
        def get(self, key: str) -> str | None:
            raise RuntimeError(f"read failed: {key}")

    monkeypatch.setattr(settings, "cache_enabled", True)
    monkeypatch.setattr(settings, "redis_url", "redis://localhost:6379/0")
    monkeypatch.setattr(cache, "redis", object())
    monkeypatch.setattr(cache, "_redis_client", FailingRedisClient())
    monkeypatch.setattr(cache, "_redis_unavailable", False)

    with caplog.at_level(logging.WARNING):
        assert cache.cache_aside_json("test:error", lambda: {"status": "fallback"}) == {"status": "fallback"}

    snapshot = cache.cache_status_snapshot()
    assert snapshot["read_errors"] == 1
    assert snapshot["fallbacks"] == 1
    assert "read failed" in str(snapshot["last_error"])
    assert any(getattr(record, "event", None) == "cache.read_failed" for record in caplog.records)


def test_cache_retries_redis_after_connection_failure(monkeypatch) -> None:
    class FakeRedisClient:
        def __init__(self, should_fail: bool) -> None:
            self.should_fail = should_fail
            self.items: dict[str, str] = {}

        def ping(self) -> bool:
            if self.should_fail:
                raise RuntimeError("redis down")
            return True

        def get(self, key: str) -> str | None:
            return self.items.get(key)

        def setex(self, key: str, ttl: int, value: str) -> None:
            self.items[key] = value

    class FakeRedisFactory:
        attempts = 0

        @classmethod
        def from_url(cls, *_args: object, **_kwargs: object) -> FakeRedisClient:
            cls.attempts += 1
            return FakeRedisClient(should_fail=cls.attempts == 1)

    class FakeRedisModule:
        Redis = FakeRedisFactory

    monkeypatch.setattr(settings, "cache_enabled", True)
    monkeypatch.setattr(settings, "redis_url", "redis://localhost:6379/0")
    monkeypatch.setattr(cache, "redis", FakeRedisModule())
    monkeypatch.setattr(cache, "_REDIS_RETRY_INTERVAL_SECONDS", 0)

    assert cache.cache_aside_json("test:retry", lambda: {"status": "fallback"}) == {"status": "fallback"}
    assert cache.cache_status_snapshot()["connection_state"] == "available"
    assert cache.cache_aside_json("test:retry", lambda: {"status": "cached"}) == {"status": "cached"}
    assert FakeRedisFactory.attempts == 2


def test_purge_cache_pattern_deletes_matching_keys(monkeypatch, caplog) -> None:
    class FakeRedisClient:
        def __init__(self) -> None:
            self.items = {"version:1:dialogs": "{}", "other:1": "{}"}

        def scan_iter(self, match: str, count: int = 500):
            prefix = match.rstrip("*")
            return (key for key in list(self.items) if key.startswith(prefix))

        def delete(self, *keys: str) -> int:
            deleted = 0
            for key in keys:
                if key in self.items:
                    del self.items[key]
                    deleted += 1
            return deleted

    client = FakeRedisClient()
    monkeypatch.setattr(settings, "cache_enabled", True)
    monkeypatch.setattr(settings, "redis_url", "redis://localhost:6379/0")
    monkeypatch.setattr(cache, "redis", object())
    monkeypatch.setattr(cache, "_redis_client", client)
    monkeypatch.setattr(cache, "_redis_unavailable", False)

    with caplog.at_level(logging.INFO):
        result = cache.purge_cache_pattern("version:*")

    assert result["status"] == "purged"
    assert result["purged"] == 1
    assert "version:1:dialogs" not in client.items
    assert "other:1" in client.items
    assert cache.cache_status_snapshot()["purges"] == 1
    assert any(getattr(record, "event", None) == "cache.purge_completed" for record in caplog.records)


def test_purge_cache_pattern_logs_skipped_when_cache_unavailable(monkeypatch, caplog) -> None:
    monkeypatch.setattr(settings, "cache_enabled", False)
    monkeypatch.setattr(cache, "_redis_client", None)
    monkeypatch.setattr(cache, "_redis_unavailable", False)

    with caplog.at_level(logging.INFO):
        result = cache.purge_cache_pattern("version:*")

    assert result["status"] == "skipped"
    assert result["reason"] == "cache_unavailable"
    assert any(getattr(record, "event", None) == "cache.purge_skipped" for record in caplog.records)
