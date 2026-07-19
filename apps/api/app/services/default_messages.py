from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models import AdminDefaultMessage


DEFAULT_MESSAGE_FALLBACKS: dict[str, str] = {
    "intent_fallback": "질문을 이해하지 못했습니다. 다시 말씀해주세요.",
    "multi_intent_guide": "아래 후보 중 원하는 의도를 선택해주세요.",
    "no_desired_intent": "원하는 의도가 없습니다. 다시 말씀해주세요.",
    "intent_receipt": "{{intentName}} 의도로 접수되었습니다.",
    "invalid_button": "선택할 수 없는 항목입니다. 다시 선택해주세요.",
    "generic_select": "선택하세요.",
    "table_select": "아래 중 선택하세요.",
    "system_error": "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    "runtime_flow_error": "대화 흐름 설정 오류로 대화를 계속할 수 없습니다.",
    "runtime_module_not_found": "연결할 대화 모듈을 찾지 못했습니다.",
    "runtime_flow_limit": "대화 흐름 실행 한도를 초과했습니다.",
    "timeout": "응답 시간이 초과되었습니다. 처음부터 다시 진행해주세요.",
    "session_end": "대화가 종료되었습니다.",
    "conversation_in_progress": "진행 중인 대화가 있습니다. 현재 대화를 먼저 완료해주세요.",
}


def get_default_message_text(
    db: Session,
    organization_id: UUID,
    message_key: str,
    *,
    language: str = "ko",
    fallback: str | None = None,
) -> str:
    fallback_text = fallback if fallback is not None else DEFAULT_MESSAGE_FALLBACKS.get(message_key, "")
    message = db.scalar(
        select(AdminDefaultMessage).where(
            AdminDefaultMessage.organization_id == organization_id,
            AdminDefaultMessage.message_key == message_key,
            AdminDefaultMessage.language == language,
            AdminDefaultMessage.status == "active",
            AdminDefaultMessage.deleted_at.is_(None),
        )
    )
    if message is None or not message.message_text.strip():
        return fallback_text
    return message.message_text.strip()


def resolve_default_message_text(
    organization_id: UUID,
    message_key: str,
    *,
    language: str = "ko",
    fallback: str | None = None,
) -> str:
    with SessionLocal() as db:
        return get_default_message_text(db, organization_id, message_key, language=language, fallback=fallback)
