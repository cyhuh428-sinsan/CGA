from __future__ import annotations

import json
import logging
import time
from collections.abc import Callable
from copy import deepcopy
from typing import TypeVar

from app.core.config import settings

try:
    import redis
except ImportError:  # pragma: no cover - optional runtime dependency
    redis = None


logger = logging.getLogger(__name__)
T = TypeVar("T")
_REDIS_RETRY_INTERVAL_SECONDS = 30.0
_redis_client: object | None = None
_redis_unavailable = False
_redis_unavailable_at: float | None = None
_redis_unavailable_reason: str | None = None
_metrics: dict[str, object] = {
    "hits": 0,
    "misses": 0,
    "fallbacks": 0,
    "read_errors": 0,
    "write_errors": 0,
    "purges": 0,
    "purge_errors": 0,
    "last_error": None,
}


def _log_cache_event(level: int, event: str, message: str, **data: object) -> None:
    logger.log(level, message, extra={"event": event, "extra_data": data})


def _increment_metric(name: str) -> None:
    _metrics[name] = int(_metrics.get(name) or 0) + 1


def _record_error(name: str, exc: Exception) -> None:
    _increment_metric(name)
    _metrics["last_error"] = str(exc)


def _mark_redis_unavailable(reason: str) -> None:
    global _redis_client, _redis_unavailable, _redis_unavailable_at, _redis_unavailable_reason
    _redis_client = None
    _redis_unavailable = True
    _redis_unavailable_at = time.monotonic()
    _redis_unavailable_reason = reason
    _metrics["last_error"] = reason


def _reset_cache_metrics() -> None:
    """Reset in-memory counters for isolated tests."""
    global _redis_client, _redis_unavailable, _redis_unavailable_at, _redis_unavailable_reason
    for name in ("hits", "misses", "fallbacks", "read_errors", "write_errors", "purges", "purge_errors"):
        _metrics[name] = 0
    _metrics["last_error"] = None
    _redis_client = None
    _redis_unavailable = False
    _redis_unavailable_at = None
    _redis_unavailable_reason = None


def _empty_memory_snapshot() -> dict[str, int | float | None]:
    return {
        "memory_used_bytes": None,
        "memory_max_bytes": None,
        "memory_usage_percent": None,
    }


def _redis_memory_snapshot(client: object | None) -> dict[str, int | float | None]:
    if client is None:
        return _empty_memory_snapshot()
    info = getattr(client, "info", None)
    if not callable(info):
        return _empty_memory_snapshot()
    try:
        memory_info = info("memory")
    except Exception as exc:  # pragma: no cover - depends on external Redis
        _log_cache_event(
            logging.WARNING,
            "cache.memory_status_failed",
            "Redis memory status check failed.",
            error_type=type(exc).__name__,
            error_message=str(exc),
        )
        return _empty_memory_snapshot()
    if not isinstance(memory_info, dict):
        return _empty_memory_snapshot()

    used_bytes = int(memory_info.get("used_memory") or 0)
    max_bytes = int(memory_info.get("maxmemory") or 0)
    usage_percent = round((used_bytes / max_bytes) * 100, 2) if max_bytes > 0 else None
    return {
        "memory_used_bytes": used_bytes,
        "memory_max_bytes": max_bytes if max_bytes > 0 else None,
        "memory_usage_percent": usage_percent,
    }


def cache_status_snapshot() -> dict[str, object]:
    snapshot = deepcopy(_metrics)
    hits = int(snapshot.get("hits") or 0)
    misses = int(snapshot.get("misses") or 0)
    total_reads = hits + misses
    client = _client() if settings.cache_enabled else None
    redis_url_configured = bool(settings.redis_url)
    package_installed = redis is not None
    if not settings.cache_enabled:
        connection_state = "disabled"
    elif not redis_url_configured:
        connection_state = "not_configured"
    elif not package_installed:
        connection_state = "package_missing"
    elif client is not None:
        connection_state = "available"
    elif _redis_unavailable:
        connection_state = "unavailable"
    else:
        connection_state = "unknown"
    snapshot.update(
        {
            "enabled": bool(settings.cache_enabled),
            "backend": "redis" if settings.cache_enabled and settings.redis_url else "disabled",
            "available": bool(settings.cache_enabled and redis_url_configured and package_installed and client is not None),
            "redis_url_configured": redis_url_configured,
            "package_installed": package_installed,
            "connection_state": connection_state,
            "hit_rate": round((hits / total_reads) * 100, 2) if total_reads else 0,
            "last_error": snapshot.get("last_error") or _redis_unavailable_reason,
            **_redis_memory_snapshot(client),
        }
    )
    return snapshot


def _client() -> object | None:
    global _redis_client, _redis_unavailable, _redis_unavailable_at, _redis_unavailable_reason
    if not settings.cache_enabled or not settings.redis_url:
        return None
    if _redis_unavailable:
        if _redis_unavailable_at is None or time.monotonic() - _redis_unavailable_at < _REDIS_RETRY_INTERVAL_SECONDS:
            return None
        _redis_unavailable = False
        _redis_unavailable_at = None
        _redis_unavailable_reason = None
        _redis_client = None
    if not settings.cache_enabled or not settings.redis_url:
        return None
    if redis is None:
        _mark_redis_unavailable("redis package is not installed")
        _log_cache_event(
            logging.WARNING,
            "cache.redis_package_missing",
            "Redis cache disabled because redis package is not installed.",
        )
        return None
    if _redis_client is None:
        try:
            _redis_client = redis.Redis.from_url(
                settings.redis_url,
                socket_connect_timeout=0.2,
                socket_timeout=0.2,
                decode_responses=True,
            )
            _redis_client.ping()
        except Exception as exc:  # pragma: no cover - depends on external Redis
            reason = f"{type(exc).__name__}: {exc}"
            _mark_redis_unavailable(reason)
            _log_cache_event(
                logging.WARNING,
                "cache.redis_connection_failed",
                "Redis cache disabled after connection failure.",
                error_type=type(exc).__name__,
                error_message=str(exc),
            )
            return None
    return _redis_client


def purge_cache_pattern(pattern: str) -> dict[str, object]:
    client = _client()
    if client is None:
        _increment_metric("fallbacks")
        _log_cache_event(
            logging.INFO,
            "cache.purge_skipped",
            "Redis cache purge skipped because cache is unavailable.",
            pattern=pattern,
            reason="cache_unavailable",
        )
        return {
            "status": "skipped",
            "purged": 0,
            "pattern": pattern,
            "reason": "cache_unavailable",
        }

    purged = 0
    try:
        batch: list[str] = []
        for key in client.scan_iter(match=pattern, count=500):
            batch.append(str(key))
            if len(batch) >= 500:
                purged += int(client.delete(*batch) or 0)
                batch = []
        if batch:
            purged += int(client.delete(*batch) or 0)
    except Exception as exc:  # pragma: no cover - depends on external Redis
        _record_error("purge_errors", exc)
        _log_cache_event(
            logging.WARNING,
            "cache.purge_failed",
            "Redis cache purge failed.",
            pattern=pattern,
            purged=purged,
            error_type=type(exc).__name__,
            error_message=str(exc),
        )
        return {
            "status": "failed",
            "purged": purged,
            "pattern": pattern,
            "reason": str(exc),
        }

    _increment_metric("purges")
    _log_cache_event(
        logging.INFO,
        "cache.purge_completed",
        "Redis cache purge completed.",
        pattern=pattern,
        purged=purged,
    )
    return {
        "status": "purged",
        "purged": purged,
        "pattern": pattern,
        "reason": None,
    }


def cache_aside_json(key: str, producer: Callable[[], T], ttl_seconds: int | None = None) -> T:
    client = _client()
    if client is None:
        _increment_metric("fallbacks")
        return producer()

    try:
        cached = client.get(key)
        if cached:
            _increment_metric("hits")
            return json.loads(cached)
        _increment_metric("misses")
    except Exception as exc:  # pragma: no cover - depends on external Redis
        _record_error("read_errors", exc)
        _increment_metric("fallbacks")
        _log_cache_event(
            logging.WARNING,
            "cache.read_failed",
            "Redis cache read failed.",
            key=key,
            error_type=type(exc).__name__,
            error_message=str(exc),
        )
        return producer()

    value = producer()
    try:
        client.setex(
            key,
            max(1, int(ttl_seconds or settings.cache_default_ttl_seconds)),
            json.dumps(value, ensure_ascii=False, separators=(",", ":")),
        )
    except Exception as exc:  # pragma: no cover - depends on external Redis
        _record_error("write_errors", exc)
        _log_cache_event(
            logging.WARNING,
            "cache.write_failed",
            "Redis cache write failed.",
            key=key,
            error_type=type(exc).__name__,
            error_message=str(exc),
        )
    return value
