"""Aidot 핵심 API 계약 회귀 테스트.

Aidot 사용자 매뉴얼의 핵심 화면 흐름이 의존하는 공개 API 경로와
요청 스키마의 기본 계약을 고정한다.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.api.routes.auth import router as auth_router
from app.api.routes.bots import router as bots_router
from app.api.routes.edit_locks import router as edit_locks_router
from app.api.routes.webchat import router as webchat_router
from app.schemas.auth import LoginRequest, LogoutRequest, SignupRequestPayload
from app.schemas.bot import BotCreateRequest, BotUpdateRequest, VersionCreateRequest


def _paths(router) -> set[str]:
    return {route.path for route in router.routes}


def test_auth_contract_exposes_manual_entry_points() -> None:
    assert {
        "/auth/login",
        "/auth/logout",
        "/auth/me",
        "/auth/signup",
        "/auth/change-password",
    } <= _paths(auth_router)


def test_bot_and_version_contract_exposes_manual_entry_points() -> None:
    assert {
        "/bots",
        "/bots/{bot_id}",
        "/bots/{bot_id}/versions",
        "/bots/{bot_id}/versions/{version_id}",
        "/bots/{bot_id}/versions/{version_id}/dialogs",
        "/bots/{bot_id}/versions/{version_id}/entities",
        "/bots/{bot_id}/versions/{version_id}/dictionary",
        "/bots/{bot_id}/versions/{version_id}/apis",
    } <= _paths(bots_router)


def test_edit_lock_contract_exposes_conflict_control() -> None:
    assert {
        "/edit-locks/acquire",
        "/edit-locks/heartbeat",
        "/edit-locks/release",
        "/edit-locks/force-release",
        "/edit-locks/status",
    } <= _paths(edit_locks_router)


def test_webchat_contract_exposes_bootstrap_and_message_entry_points() -> None:
    assert {"/webchat/bootstrap", "/webchat/bots/{bot_id}/rooms/{room_id}/messages"} <= _paths(webchat_router)


def test_login_contract_requires_login_id_and_password() -> None:
    with pytest.raises(ValidationError):
        LoginRequest(login_id="")
    with pytest.raises(ValidationError):
        LoginRequest(password="password")  # type: ignore[call-arg]


def test_signup_contract_normalizes_supported_values() -> None:
    payload = SignupRequestPayload(
        login_id=" test.user ",
        password="Password1!",
        password_confirm="Password1!",
        name=" 홍길동 ",
        comment=" 테스트 ",
        preferred_language="KO",
        group_id=uuid4(),
    )

    assert payload.login_id == "test.user"
    assert payload.name == "홍길동"
    assert payload.comment == "테스트"
    assert payload.preferred_language == "ko"


def test_signup_contract_rejects_password_mismatch() -> None:
    with pytest.raises(ValidationError, match="일치하지 않습니다"):
        SignupRequestPayload(
            login_id="test.user",
            password="Password1!",
            password_confirm="Password2!",
            name="홍길동",
            group_id=uuid4(),
        )


def test_logout_contract_accepts_only_last_bot_intent_screen() -> None:
    payload = LogoutRequest(last_bot_screen=" /studio/bots/bot-1/versions/v1/intents ")
    assert payload.last_bot_screen == "/studio/bots/bot-1/versions/v1/intents"

    with pytest.raises(ValidationError):
        LogoutRequest(last_bot_screen="/admin/users")


def test_bot_create_contract_keeps_manual_default_configuration() -> None:
    payload = BotCreateRequest(name="고객센터봇")

    assert payload.language == "ko"
    assert payload.nlu_type == "ml"
    assert payload.nlu_model == "deep_learning_lite"
    assert payload.answer_mode == "fixed"


def test_bot_create_contract_rejects_invalid_nlu_model_pair() -> None:
    with pytest.raises(ValidationError, match="nlu_model"):
        BotCreateRequest(name="고객센터봇", nlu_type="ml", nlu_model="semantic_engine_default")


def test_bot_update_contract_rejects_invalid_llm_provider_pair() -> None:
    with pytest.raises(ValidationError, match="llm_model"):
        BotUpdateRequest(llm_provider="gemini", llm_model="gpt-4o-mini")


def test_version_create_contract_accepts_optional_metadata() -> None:
    payload = VersionCreateRequest(name="테스트 버전", description="회귀 테스트", comment="초기 기준선")

    assert payload.name == "테스트 버전"
    assert payload.description == "회귀 테스트"
    assert payload.comment == "초기 기준선"
