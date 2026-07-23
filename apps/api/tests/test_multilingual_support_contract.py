from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from app.schemas.bot import BotCreateRequest, BotUpdateRequest


ROOT_DIR = Path(__file__).resolve().parents[3]
SUPPORTED_LANGUAGES = ("ko", "en", "zh-CN", "ja", "vi", "fr", "de")


@pytest.mark.parametrize("language", SUPPORTED_LANGUAGES)
def test_bot_create_accepts_every_supported_language(language: str) -> None:
    payload = BotCreateRequest(name="multilingual bot", language=language)

    assert payload.language == language


@pytest.mark.parametrize("language", SUPPORTED_LANGUAGES)
def test_bot_update_accepts_every_supported_language(language: str) -> None:
    payload = BotUpdateRequest(language=language)

    assert payload.language == language


def test_bot_language_rejects_unsupported_code() -> None:
    with pytest.raises(ValidationError):
        BotCreateRequest(name="unsupported locale bot", language="es")


def test_web_language_contract_exposes_all_supported_languages() -> None:
    language_source = (ROOT_DIR / "apps/web/lib/language.ts").read_text(encoding="utf-8")

    for language in SUPPORTED_LANGUAGES:
        assert f'code: "{language}"' in language_source


def test_bot_create_and_settings_use_shared_language_options() -> None:
    create_source = (ROOT_DIR / "apps/web/components/bot-create-dialog.tsx").read_text(encoding="utf-8")
    settings_source = (ROOT_DIR / "apps/web/components/bot-settings-page.tsx").read_text(encoding="utf-8")

    assert "SUPPORTED_LANGUAGES" in create_source
    assert "SUPPORTED_LANGUAGES" in settings_source


def test_header_and_account_menu_use_shared_language_options() -> None:
    header_source = (ROOT_DIR / "apps/web/components/cga-studio-header.tsx").read_text(encoding="utf-8")
    rail_source = (ROOT_DIR / "apps/web/components/studio-rail.tsx").read_text(encoding="utf-8")

    assert "SUPPORTED_LANGUAGES" in header_source
    assert "SUPPORTED_LANGUAGES" in rail_source

