from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.services.edit_lock_cleanup import delete_expired_edit_locks


def _session_with_locks(now: datetime) -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    with engine.begin() as connection:
        connection.exec_driver_sql(
            """
            CREATE TABLE edit_locks (
                id VARCHAR(36) PRIMARY KEY,
                expires_at DATETIME NOT NULL,
                released_at DATETIME NULL
            )
            """
        )
        connection.execute(
            text(
                """
                INSERT INTO edit_locks (id, expires_at, released_at)
                VALUES
                    ('expired', :expired_at, NULL),
                    ('active', :active_at, NULL),
                    ('released', :released_at, :released_at)
                """
            ),
            {
                "expired_at": now - timedelta(seconds=1),
                "active_at": now + timedelta(seconds=1),
                "released_at": now - timedelta(minutes=1),
            },
        )
    return Session(engine, future=True)


def test_delete_expired_edit_locks_removes_only_unreleased_expired_rows() -> None:
    now = datetime(2026, 7, 22, 4, 0, tzinfo=timezone.utc)
    db = _session_with_locks(now)

    deleted_count = delete_expired_edit_locks(db, now=now)
    db.commit()

    remaining_ids = set(db.scalars(text("SELECT id FROM edit_locks")).all())
    assert deleted_count == 1
    assert remaining_ids == {"active", "released"}


def test_delete_expired_edit_locks_includes_exact_expiration_boundary() -> None:
    now = datetime(2026, 7, 22, 4, 0, tzinfo=timezone.utc)
    db = _session_with_locks(now)
    db.execute(text("UPDATE edit_locks SET expires_at = :now WHERE id = 'expired'"), {"now": now})

    deleted_count = delete_expired_edit_locks(db, now=now)
    db.commit()

    assert deleted_count == 1
    assert db.scalar(text("SELECT COUNT(*) FROM edit_locks WHERE id = 'expired'")) == 0
