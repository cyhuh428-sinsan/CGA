from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from app.schemas.auth import SignupRequestPayload
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


@pytest.mark.parametrize("language", SUPPORTED_LANGUAGES)
def test_signup_accepts_every_supported_preferred_language(language: str) -> None:
    payload = SignupRequestPayload(
        login_id="multilingual.user",
        password="Password!1",
        password_confirm="Password!1",
        name="Multilingual User",
        preferred_language=language,
        group_id="00000000-0000-0000-0000-000000000001",
    )

    assert payload.preferred_language == language


def test_web_language_contract_exposes_all_supported_languages() -> None:
    language_source = (ROOT_DIR / "apps/web/lib/language.ts").read_text(encoding="utf-8")

    for language in SUPPORTED_LANGUAGES:
        assert f'code: "{language}"' in language_source


def test_bot_create_and_settings_use_shared_language_options() -> None:
    create_source = (ROOT_DIR / "apps/web/components/bot-create-dialog.tsx").read_text(encoding="utf-8")
    settings_source = (ROOT_DIR / "apps/web/components/bot-settings-page.tsx").read_text(encoding="utf-8")

    assert "SUPPORTED_LANGUAGES" in create_source
    assert "getLanguageLabel" in settings_source


def test_header_and_account_menu_use_shared_language_options() -> None:
    header_source = (ROOT_DIR / "apps/web/components/cga-studio-header.tsx").read_text(encoding="utf-8")
    rail_source = (ROOT_DIR / "apps/web/components/studio-rail.tsx").read_text(encoding="utf-8")

    assert "SUPPORTED_LANGUAGES" in header_source
    assert "SUPPORTED_LANGUAGES" in rail_source


def test_root_layout_installs_shared_language_provider() -> None:
    layout_source = (ROOT_DIR / "apps/web/app/layout.tsx").read_text(encoding="utf-8")

    assert "LanguageProvider" in layout_source
    assert "<LanguageProvider>" in layout_source


def test_every_ui_catalog_has_the_same_translation_keys() -> None:
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/catalogs.ts").read_text(encoding="utf-8")

    for language in SUPPORTED_LANGUAGES:
        assert f'  "{language}":' in catalog_source or f"  {language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage, TranslationCatalog>" in catalog_source


def test_header_rail_and_login_share_reactive_ui_language() -> None:
    header_source = (ROOT_DIR / "apps/web/components/cga-studio-header.tsx").read_text(encoding="utf-8")
    rail_source = (ROOT_DIR / "apps/web/components/studio-rail.tsx").read_text(encoding="utf-8")
    login_source = (ROOT_DIR / "apps/web/app/login/page.tsx").read_text(encoding="utf-8")

    for source in (header_source, rail_source, login_source):
        assert "useI18n" in source
    assert "window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY" not in header_source
    assert "window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY" not in rail_source


def test_signup_and_language_settings_use_shared_language_contract() -> None:
    signup_source = (ROOT_DIR / "apps/web/app/signup/page.tsx").read_text(encoding="utf-8")
    settings_source = (ROOT_DIR / "apps/web/app/me/language/page.tsx").read_text(encoding="utf-8")

    assert "preferred_language: language" in signup_source
    assert "SUPPORTED_LANGUAGES" in signup_source
    assert "useI18n" in settings_source
    assert "SUPPORTED_LANGUAGES" in settings_source
