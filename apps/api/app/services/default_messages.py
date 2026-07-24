from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models import AdminDefaultMessage
from app.services.default_message_catalog import DEFAULT_MESSAGE_CATALOGS


DEFAULT_MESSAGE_FALLBACKS: dict[str, str] = {
    key: definition["message_text"]
    for key, definition in DEFAULT_MESSAGE_CATALOGS["ko"].items()
}


def get_default_message_text(
    db: Session,
    organization_id: UUID,
    message_key: str,
    *,
    languages: tuple[str, ...] = ("ko",),
    language: str | None = None,
    fallback: str | None = None,
) -> str:
    fallback_text = fallback if fallback is not None else DEFAULT_MESSAGE_FALLBACKS.get(message_key, "")
    candidates = ((language,) if language else ()) + languages + ("ko",)
    for candidate in dict.fromkeys(candidates):
        message = db.scalar(
            select(AdminDefaultMessage).where(
                AdminDefaultMessage.organization_id == organization_id,
                AdminDefaultMessage.message_key == message_key,
                AdminDefaultMessage.language == candidate,
                AdminDefaultMessage.status == "active",
                AdminDefaultMessage.deleted_at.is_(None),
            )
        )
        if message is not None and message.message_text.strip():
            return message.message_text.strip()
    return fallback_text


def resolve_default_message_text(
    organization_id: UUID,
    message_key: str,
    *,
    language: str = "ko",
    fallback: str | None = None,
) -> str:
    with SessionLocal() as db:
        return get_default_message_text(db, organization_id, message_key, language=language, fallback=fallback)
