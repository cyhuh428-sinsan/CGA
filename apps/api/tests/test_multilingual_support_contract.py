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


def test_bot_management_uses_complete_seven_language_catalog() -> None:
    management_source = (ROOT_DIR / "apps/web/components/bot-management-page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/bot-management.ts").read_text(encoding="utf-8")

    assert "useI18n" in management_source
    assert "BOT_MANAGEMENT_CATALOGS[language]" in management_source
    for language in SUPPORTED_LANGUAGES:
        assert f'  "{language}":' in catalog_source or f"  {language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage, BotManagementCatalog>" in catalog_source


def test_bot_operations_workspace_uses_complete_seven_language_catalog() -> None:
    workspace_source = (ROOT_DIR / "apps/web/components/bot-operations-workspace-page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/bot-workspace.ts").read_text(encoding="utf-8")

    assert "useI18n" in workspace_source
    assert "BOT_WORKSPACE_CATALOGS[language]" in workspace_source
    for language in SUPPORTED_LANGUAGES:
        assert f'  "{language}":' in catalog_source or f"  {language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage, BotWorkspaceCatalog>" in catalog_source


def test_bot_create_uses_localized_ai_options_and_seven_language_catalog() -> None:
    create_source = (ROOT_DIR / "apps/web/components/bot-create-dialog.tsx").read_text(encoding="utf-8")
    create_catalog_source = (ROOT_DIR / "apps/web/lib/i18n/bot-create.ts").read_text(encoding="utf-8")
    ai_catalog_source = (ROOT_DIR / "apps/web/lib/i18n/ai-options.ts").read_text(encoding="utf-8")

    assert "useI18n" in create_source
    assert "BOT_CREATE_CATALOGS[uiLanguage]" in create_source
    assert "translateAiOptionText(uiLanguage" in create_source
    for language in SUPPORTED_LANGUAGES:
        assert f'  "{language}":' in create_catalog_source or f"  {language}:" in create_catalog_source
        assert f'  "{language}":' in ai_catalog_source or f"  {language}:" in ai_catalog_source
    assert "satisfies Record<SupportedLanguage, BotCreateCatalog>" in create_catalog_source
    assert "satisfies Record<SupportedLanguage, AiOptionTranslationCatalog>" in ai_catalog_source


def test_bot_name_validation_accepts_unicode_letters_and_numbers() -> None:
    create_source = (ROOT_DIR / "apps/web/components/bot-create-dialog.tsx").read_text(encoding="utf-8")

    assert r"\p{L}\p{N}" in create_source
    assert "[가-힣a-zA-Z0-9" not in create_source


def test_bot_settings_uses_localized_catalog_and_unicode_bot_names() -> None:
    settings_source = (ROOT_DIR / "apps/web/components/bot-settings-page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/bot-settings.ts").read_text(encoding="utf-8")

    assert "useI18n" in settings_source
    assert "BOT_SETTINGS_CATALOGS[uiLanguage]" in settings_source
    assert "translateAiOptionText(uiLanguage" in settings_source
    assert r"\p{L}\p{N}" in settings_source
    assert "[가-힣a-zA-Z0-9" not in settings_source
    for language in SUPPORTED_LANGUAGES:
        assert f'  "{language}":' in catalog_source or f"  {language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage, BotSettingsCatalog>" in catalog_source


def test_bot_settings_shell_uses_shared_navigation_and_localized_messages() -> None:
    shell_source = (ROOT_DIR / "apps/web/components/bot-settings-shell.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/bot-settings-shell.ts").read_text(encoding="utf-8")

    assert "useI18n" in shell_source
    assert "SHELL_NAVIGATION[uiLanguage]" in shell_source
    assert "BOT_SETTINGS_SHELL_CATALOGS[uiLanguage]" in shell_source
    for language in SUPPORTED_LANGUAGES:
        assert f'  "{language}":' in catalog_source or f"  {language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage, BotSettingsShellCatalog>" in catalog_source


def test_shared_training_header_uses_seven_language_catalog() -> None:
    button_source = (ROOT_DIR / "apps/web/components/nlu-training-button.tsx").read_text(encoding="utf-8")
    header_source = (ROOT_DIR / "apps/web/components/bot-workspace-header.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/training.ts").read_text(encoding="utf-8")

    assert "useI18n" in button_source
    assert "TRAINING_CATALOGS[uiLanguage]" in button_source
    assert "useI18n" in header_source
    assert "TRAINING_CATALOGS[uiLanguage]" in header_source
    assert "translateAiOptionText(uiLanguage" in header_source
    for language in SUPPORTED_LANGUAGES:
        assert f'  "{language}":' in catalog_source or f"  {language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage, TrainingCatalog>" in catalog_source


def test_intent_list_uses_seven_language_catalog_without_changing_csv_contract() -> None:
    page_source = (ROOT_DIR / "apps/web/components/intent-list-page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/intent-list.ts").read_text(encoding="utf-8")

    assert "useI18n" in page_source
    assert "INTENT_LIST_CATALOGS[uiLanguage]" in page_source
    assert "formatIntentListText(" in page_source
    for language in SUPPORTED_LANGUAGES:
        assert f'  "{language}":' in catalog_source or f"  {language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage, IntentListCatalog>" in catalog_source
    assert '["의도명", "표시명", "의도 Key", "학습문장", "태그"]' in page_source
    assert '["의도명", "Intent Name", "intentName", "name"]' in page_source


def test_intent_list_localizes_delete_copy_and_preserves_reference_checks() -> None:
    page_source = (ROOT_DIR / "apps/web/components/intent-list-page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/intent-list.ts").read_text(encoding="utf-8")

    assert "copy.deleteDialogTitle" in page_source
    assert "copy.deleteDialogQuestion" in page_source
    assert "copy.deleteReferenced" in page_source
    assert "findDialogUsageReferences" in page_source
    assert "persistVersionDocument" in page_source
    assert "deleteDialogTitle: string" in catalog_source
    assert "deleteReferenced: string" in catalog_source


def test_intent_csv_ui_is_localized_without_translating_csv_headers() -> None:
    page_source = (ROOT_DIR / "apps/web/components/intent-list-page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/intent-list.ts").read_text(encoding="utf-8")

    assert "copy.uploadTitle" in page_source
    assert "copy.uploadResultTitle" in page_source
    assert "copy.addedIntents" in page_source
    assert 'const rows = [["의도명", "표시명", "의도 Key", "학습문장", "태그"]];' in page_source
    assert '["의도명", "Intent Name", "intentName", "name"]' in page_source
    assert "uploadTitle: string" in catalog_source


def test_intent_scenario_errors_localize_guidance_without_changing_training_blocking() -> None:
    page_source = (ROOT_DIR / "apps/web/components/intent-list-page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/intent-list.ts").read_text(encoding="utf-8")

    assert "copy.scenarioIssueFallback" in page_source
    assert "copy.trainingBlockedByScenarioErrors" in page_source
    assert "scenarioErrorCount" in page_source
    assert "trainingDisabledReason" in page_source
    assert "scenarioIssueFallback: string" in catalog_source


def test_admin_navigation_and_shell_use_complete_seven_language_catalog() -> None:
    layout_source = (ROOT_DIR / "apps/web/components/admin-console-layout.tsx").read_text(encoding="utf-8")
    rail_source = (ROOT_DIR / "apps/web/components/studio-rail.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/admin-navigation.ts").read_text(encoding="utf-8")

    for source in (layout_source, rail_source):
        assert "ADMIN_NAVIGATION_CATALOGS[language]" in source
        assert "buildAdminNavigationGroups(" in source
    for language in SUPPORTED_LANGUAGES:
        assert f'  "{language}":' in catalog_source or f"  {language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage, AdminNavigationCatalog>" in catalog_source


def test_shared_admin_components_use_complete_localized_controls() -> None:
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/admin-common.ts").read_text(encoding="utf-8")
    component_paths = (
        "apps/web/components/admin-table-page.tsx",
        "apps/web/components/admin-interactive-table-page.tsx",
        "apps/web/components/admin-history-table-page.tsx",
        "apps/web/components/admin-botstation-status-page.tsx",
    )
    for path in component_paths:
        source = (ROOT_DIR / path).read_text(encoding="utf-8")
        assert "ADMIN_COMMON_CATALOGS[language]" in source
    assert "satisfies Record<SupportedLanguage, AdminCommonCatalog>" in catalog_source


def test_primary_admin_history_routes_use_seven_language_page_catalog() -> None:
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/admin-pages.ts").read_text(encoding="utf-8")
    for path in (
        "apps/web/app/admin/api-call-history/page.tsx",
        "apps/web/app/admin/bot-status/page.tsx",
        "apps/web/app/admin/login-history/page.tsx",
        "apps/web/app/admin/training-history/page.tsx",
        "apps/web/app/admin/intent-feedback/page.tsx",
    ):
        source = (ROOT_DIR / path).read_text(encoding="utf-8")
        assert "ADMIN_PAGE_CATALOGS[language]" in source
    for language in SUPPORTED_LANGUAGES:
        assert f'  "{language}":' in catalog_source or f"  {language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage, AdminPageCatalog>" in catalog_source


def test_default_message_admin_screen_uses_language_filter_and_seven_language_catalog() -> None:
    page_source = (ROOT_DIR / "apps/web/app/admin/default-messages/page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/default-messages.ts").read_text(encoding="utf-8")
    assert "SUPPORTED_LANGUAGES" in page_source
    assert "language: appliedLanguage" in page_source
    assert "DEFAULT_MESSAGES_CATALOGS[uiLanguage]" in page_source
    assert "satisfies Record<SupportedLanguage, DefaultMessagesCatalog>" in catalog_source


def test_bot_test_uses_seven_language_catalog_and_preserves_trace_data() -> None:
    page_source = (ROOT_DIR / "apps/web/components/simulator-page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/simulator.ts").read_text(encoding="utf-8")
    assert "SIMULATOR_CATALOGS[uiLanguage]" in page_source
    assert "copy.botTestBreadcrumb" in page_source
    assert "copy.botTestTitle" in page_source
    assert "copy.analysisData" in page_source
    assert "selectedAnalysis.variableSnapshots" in page_source
    for language in SUPPORTED_LANGUAGES:
        assert f'  "{language}":' in catalog_source or f"  {language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage, SimulatorCatalog>" in catalog_source


def test_group_api_management_uses_seven_language_catalog() -> None:
    list_source = (ROOT_DIR / "apps/web/components/group-api-list-page.tsx").read_text(encoding="utf-8")
    detail_source = (ROOT_DIR / "apps/web/components/group-api-detail-page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/api-management.ts").read_text(encoding="utf-8")
    assert "API_MANAGEMENT_CATALOGS[uiLanguage]" in list_source
    assert "API_MANAGEMENT_CATALOGS[uiLanguage]" in detail_source
    assert "copy.search" in list_source
    assert "copy.methodDescription" in detail_source
    for language in SUPPORTED_LANGUAGES:
        assert f'  "{language}":' in catalog_source or f"  {language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage, ApiManagementCatalog>" in catalog_source


def test_api_editor_uses_seven_language_catalog() -> None:
    editor_source = (ROOT_DIR / "apps/web/components/api-store-list-page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/api-editor.ts").read_text(encoding="utf-8")
    assert "API_EDITOR_CATALOGS[uiLanguage]" in editor_source
    assert "copy.samplePlaceholder" in editor_source
    assert "copy.invalidJson" in editor_source
    for language in SUPPORTED_LANGUAGES:
        assert f'  "{language}":' in catalog_source or f"  {language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage, ApiEditorCatalog>" in catalog_source


def test_common_variable_admin_uses_seven_language_catalog() -> None:
    page_source = (ROOT_DIR / "apps/web/app/admin/common-variables/page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/admin-common-variables.ts").read_text(encoding="utf-8")
    assert "COMMON_VARIABLE_CATALOGS[uiLanguage]" in page_source
    assert "copy.searchPlaceholder" in page_source
    assert "copy.readOnly" in page_source
    for language in SUPPORTED_LANGUAGES:
        assert f'  "{language}":' in catalog_source or f"  {language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage, CommonVariableCatalog>" in catalog_source


def test_license_admin_uses_seven_language_catalog() -> None:
    page_source = (ROOT_DIR / "apps/web/app/admin/license/page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/admin-license.ts").read_text(encoding="utf-8")
    assert "ADMIN_LICENSE_CATALOGS[uiLanguage]" in page_source
    assert "copy.upload" in page_source
    assert "copy.licenseDetails" in page_source
    for language in SUPPORTED_LANGUAGES:
        assert f'  "{language}":' in catalog_source or f"  {language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage, AdminLicenseCatalog>" in catalog_source


def test_channel_admin_list_uses_seven_language_catalog() -> None:
    page_source = (ROOT_DIR / "apps/web/app/admin/channels/page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/admin-channels.ts").read_text(encoding="utf-8")
    assert "ADMIN_CHANNEL_CATALOGS[uiLanguage]" in page_source
    assert "copy.searchPlaceholder" in page_source
    assert "copy.connectionTest" in page_source
    for language in SUPPORTED_LANGUAGES:
        assert f'"{language}":' in catalog_source or f"{language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage,AdminChannelCatalog>" in catalog_source


def test_channel_admin_dialog_uses_seven_language_catalog() -> None:
    page_source = (ROOT_DIR / "apps/web/app/admin/channels/page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/admin-channel-dialog.ts").read_text(encoding="utf-8")
    assert "ADMIN_CHANNEL_DIALOG_CATALOGS[uiLanguage]" in page_source
    assert "dialogCopy.kakaoGuideTitle" in page_source
    assert "dialogCopy.authJsonHelp" in page_source
    for language in SUPPORTED_LANGUAGES:
        assert f'"{language}":' in catalog_source or f"{language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage,AdminChannelDialogCatalog>" in catalog_source


def test_template_admin_uses_seven_language_catalog() -> None:
    page_source = (ROOT_DIR / "apps/web/app/admin/templates/page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/admin-templates.ts").read_text(encoding="utf-8")
    assert "ADMIN_TEMPLATE_CATALOGS[uiLanguage]" in page_source
    assert "copy.searchPlaceholder" in page_source
    assert "copy.kakaoGuideTitle" in page_source
    for language in SUPPORTED_LANGUAGES:
        assert f'"{language}":' in catalog_source or f"{language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage,AdminTemplateCatalog>" in catalog_source


def test_conversation_history_uses_seven_language_catalog() -> None:
    page_source = (ROOT_DIR / "apps/web/app/admin/conversations/page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/admin-conversations.ts").read_text(encoding="utf-8")
    assert "ADMIN_CONVERSATION_CATALOGS[uiLanguage]" in page_source
    assert "copy.diagnosticSummary" in page_source
    assert "copy.averageResponseTime" in page_source
    for language in SUPPORTED_LANGUAGES:
        assert f'"{language}":' in catalog_source or f"{language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage,AdminConversationCatalog>" in catalog_source


def test_queue_history_uses_seven_language_catalog() -> None:
    page_source = (ROOT_DIR / "apps/web/app/admin/queue-history/page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/admin-queue-history.ts").read_text(encoding="utf-8")
    assert "ADMIN_QUEUE_HISTORY_CATALOGS[uiLanguage]" in page_source
    assert "copy.processQueued" in page_source
    assert "copy.requestParameters" in page_source
    for language in SUPPORTED_LANGUAGES:
        assert f'"{language}":' in catalog_source or f"{language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage,AdminQueueHistoryCatalog>" in catalog_source


def test_audit_log_admin_uses_seven_language_catalog() -> None:
    page_source = (ROOT_DIR / "apps/web/app/admin/audit-logs/page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/admin-audit-logs.ts").read_text(encoding="utf-8")
    assert "ADMIN_AUDIT_LOG_CATALOGS[uiLanguage]" in page_source
    assert "copy.auditDetailTitle" in page_source
    assert "copy.systemDetailTitle" in page_source
    for language in SUPPORTED_LANGUAGES:
        assert f'"{language}":' in catalog_source or f"{language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage,AdminAuditLogCatalog>" in catalog_source


def test_operations_dashboard_shell_uses_seven_language_catalog() -> None:
    page_source = (ROOT_DIR / "apps/web/app/admin/operations-dashboard/page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/admin-operations-dashboard.ts").read_text(encoding="utf-8")
    assert "ADMIN_OPERATIONS_DASHBOARD_CATALOGS[uiLanguage]" in page_source
    assert "copy.title" in page_source
    assert "copy.cacheStatus" in page_source
    assert "copy.systemErrorsTitle" in page_source
    for language in SUPPORTED_LANGUAGES:
        assert f'"{language}":' in catalog_source or f"{language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage,AdminOperationsDashboardCatalog>" in catalog_source


def test_operations_dashboard_actions_use_localized_messages() -> None:
    page_source = (ROOT_DIR / "apps/web/app/admin/operations-dashboard/page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/admin-operations-actions.ts").read_text(encoding="utf-8")
    assert "actionCopy.forceRelease" in page_source
    assert "actionCopy.cachePurgeConfirm" in page_source
    assert "actionCopy.dbBackfillConfirm" in page_source
    assert "formatOperationsText" in page_source
    assert "satisfies Record<SupportedLanguage,AdminOperationsActionCatalog>" in catalog_source
