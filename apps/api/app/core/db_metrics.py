from __future__ import annotations

from contextvars import ContextVar, Token


DBMetrics = dict[str, int | float]
_current_db_metrics: ContextVar[DBMetrics | None] = ContextVar("current_db_metrics", default=None)


def start_db_metrics() -> Token[DBMetrics | None]:
    return _current_db_metrics.set({"db_query_count": 0, "db_duration_ms": 0.0, "db_max_query_ms": 0.0})


def record_db_query(elapsed_ms: float) -> None:
    metrics = _current_db_metrics.get()
    if metrics is None:
        return
    metrics["db_query_count"] = int(metrics["db_query_count"]) + 1
    metrics["db_duration_ms"] = round(float(metrics["db_duration_ms"]) + elapsed_ms, 2)
    metrics["db_max_query_ms"] = max(float(metrics["db_max_query_ms"]), round(elapsed_ms, 2))


def finish_db_metrics(token: Token[DBMetrics | None]) -> DBMetrics:
    metrics = _current_db_metrics.get()
    snapshot: DBMetrics = {
        "db_query_count": int(metrics.get("db_query_count") or 0) if metrics else 0,
        "db_duration_ms": round(float(metrics.get("db_duration_ms") or 0), 2) if metrics else 0.0,
        "db_max_query_ms": round(float(metrics.get("db_max_query_ms") or 0), 2) if metrics else 0.0,
    }
    _current_db_metrics.reset(token)
    return snapshot
