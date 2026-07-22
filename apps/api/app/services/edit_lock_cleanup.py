from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import EditLock


def delete_expired_edit_locks(db: Session, *, now: datetime | None = None) -> int:
    """만료됐지만 명시적으로 해제되지 않은 편집 잠금만 삭제한다."""
    current_time = now or datetime.now(timezone.utc)
    result = db.execute(
        delete(EditLock).where(
            EditLock.released_at.is_(None),
            EditLock.expires_at <= current_time,
        )
    )
    return int(result.rowcount or 0)
