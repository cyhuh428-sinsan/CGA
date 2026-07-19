"""Aidot 사용자 매뉴얼 기준 핵심 동작 회귀 테스트.

이 파일은 운영 코드의 내부 구현이 아니라 사용자가 관찰하는 핵심 계약을 고정한다.
DB/외부 서비스가 필요한 시나리오는 별도 통합·E2E 테스트에서 다룬다.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.api.routes.bots import router as bots_router
from app.api.routes.auth import router as auth_router
from app.api.routes.edit_locks import router as edit_locks_router
from app.core.version_documents import build_default_version_document, normalize_version_document
from app.schemas.auth import LoginRequest, LogoutRequest, SignupRequestPayload
from app.schemas.bot import BotCreateRequest, BotUpdateRequest


def _route_paths(router) -> set[str]:
    return {route.path for route in router.routes}


def test_regression_auth_routes_keep_manual_entry_points() -> None:
    paths = _route_paths(auth_router)

    assert {"/login", "/logout", "/me", "/signup", "/change-password"} <= paths


def test_regression_bot_routes_keep_core_management_entry_points() -> None:
    paths = _route_paths(bots_router)

    assert {"", "/{bot_id}", "/{bot_id}/versions", "/{bot_id}/versions/{version_id}"} <= paths


def test_regression_edit_lock_routes_keep_save_conflict_contract() -> None:
    paths = _route_paths(edit_locks_router)

    assert {"/acquire", "/heartbeat", "/release", "/force-release", "/status"} <= paths


def test_regression_login_requires_both_credentials() -> None:
    with pytest.raises(ValidationError):
        LoginRequest(login_id="")

    with pytest.raises(ValidationError):
        LoginRequest(password="password")  # type: ignore[call-arg]


def test_regression_signup_normalizes_supported_user_input() -> None:
    payload = SignupRequestPayload(
        login_id=" test.user ",
        password="Password1!",
        password_confirm="Password1!",
        name=" 홍길동 ",
        comment="  테스트 가입 ",
        preferred_language="KO",
        group_id=uuid4(),
    )

    assert payload.login_id == "test.user"
    assert payload.name == "홍길동"
    assert payload.comment == "테스트 가입"
    assert payload.preferred_language == "ko"


def test_regression_signup_rejects_mismatched_password_confirmation() -> None:
    with pytest.raises(ValidationError, match="일치하지 않습니다"):
        SignupRequestPayload(
            login_id="test.user",
            password="Password1!",
            password_confirm="Password2!",
            name="홍길동",
            group_id=uuid4(),
        )


def test_regression_logout_only_accepts_last_bot_intent_screen() -> None:
    payload = LogoutRequest(last_bot_screen=" /studio/bots/bot-1/versions/v1/intents ")

    assert payload.last_bot_screen == "/studio/bots/bot-1/versions/v1/intents"

    with pytest.raises(ValidationError):
        LogoutRequest(last_bot_screen="/admin/users")


def test_regression_bot_creation_keeps_manual_default_engine_configuration() -> None:
    payload = BotCreateRequest(name="고객센터봇")

    assert payload.language == "ko"
    assert payload.nlu_type == "ml"
    assert payload.nlu_model == "deep_learning_lite"
    assert payload.answer_mode == "fixed"


def test_regression_bot_creation_rejects_unsupported_nlu_model_combination() -> None:
    with pytest.raises(ValidationError, match="nlu_model"):
        BotCreateRequest(
            name="고객센터봇",
            nlu_type="ml",
            nlu_model="semantic_engine_default",
        )


def test_regression_bot_update_rejects_unsupported_llm_provider_model_combination() -> None:
    with pytest.raises(ValidationError, match="llm_model"):
        BotUpdateRequest(
            llm_provider="gemini",
            llm_model="gpt-4o-mini",
        )


def test_regression_new_version_document_contains_core_assets() -> None:
    document = build_default_version_document()

    assert {
        "dialogs",
        "dialog_flow_graphs",
        "entities",
        "dictionary",
        "apis",
        "rules",
        "system_config",
    } <= document.keys()


def test_regression_version_document_normalization_preserves_core_assets() -> None:
    document = normalize_version_document(
        {
            "dialogs": [{"id": "intent-1", "dialogType": 1}],
            "entities": [{"id": "entity-1", "name": "지역"}],
            "dictionary": [{"id": "term-1", "source": "서울", "target": "서울시"}],
            "apis": [{"id": "api-1", "method": "GET"}],
            "system_config": {"training": {"status": "required"}},
        }
    )

    assert document["dialogs"][0]["dialogType"] == 1
    assert document["entities"][0]["name"] == "지역"
    assert document["dictionary"][0]["target"] == "서울시"
    assert document["apis"][0]["method"] == "GET"
    assert document["system_config"]["training"]["status"] == "required"


def test_regression_version_document_normalization_does_not_share_mutable_defaults() -> None:
    first = normalize_version_document(None)
    second = normalize_version_document(None)

    first["dialogs"].append({"id": "intent-1"})
    first["system_config"]["training"] = {"status": "required"}

    assert second["dialogs"] == []
    assert second["system_config"] == {}


def test_regression_invalid_flow_payload_is_not_treated_as_valid_asset() -> None:
    document = normalize_version_document(
        {
            "dialogs": "invalid",
            "dialog_flow_graphs": {"nodes": []},
            "entities": None,
            "dictionary": "invalid",
        }
    )

    assert document["dialogs"] == []
    assert document["dialog_flow_graphs"] == []
    assert document["entities"] == []
    assert document["dictionary"] == []
