from __future__ import annotations

import time

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.db_metrics import record_db_query


def _db_connect_args() -> dict[str, int]:
    return {"connect_timeout": max(1, int(settings.db_connect_timeout_seconds))}


engine = create_engine(
    settings.sqlalchemy_database_url,
    future=True,
    pool_pre_ping=True,
    connect_args=_db_connect_args(),
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


@event.listens_for(engine, "before_cursor_execute")
def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany) -> None:
    context._aidot_query_started_at = time.perf_counter()


@event.listens_for(engine, "after_cursor_execute")
def _after_cursor_execute(conn, cursor, statement, parameters, context, executemany) -> None:
    started_at = getattr(context, "_aidot_query_started_at", None)
    if started_at is None:
        return
    record_db_query(round((time.perf_counter() - started_at) * 1000, 2))
