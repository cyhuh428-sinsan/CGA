from __future__ import annotations

from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]


def _read(relative_path: str) -> str:
    return (ROOT_DIR / relative_path).read_text(encoding="utf-8")


def test_workspace_renders_three_evaluation_diagnostics() -> None:
    workspace = _read("apps/web/components/bot-operations-workspace-page.tsx")
    catalog = _read("apps/web/lib/i18n/bot-workspace.ts")

    assert "BOT_WORKSPACE_CATALOGS[language]" in workspace
    assert "{copy.misclassified}" in workspace
    assert "{copy.lowScore}" in workspace
    assert "{copy.similarIntentCollisions}" in workspace
    assert "training_rows" in workspace
    assert "row.score < 70" in workspace
    assert "!row.correct" in workspace
    assert "시뮬레이터 미리보기" not in workspace
    assert 'misclassified: "오분류 문장"' in catalog
    assert "satisfies Record<SupportedLanguage, BotWorkspaceCatalog>" in catalog


def test_workspace_simulator_launcher_receives_selected_bot_context() -> None:
    workspace = _read("apps/web/components/bot-operations-workspace-page.tsx")
    simulator = _read("apps/web/components/simulator-page.tsx")

    assert "<SimulatorFloatingLauncher" in workspace
    assert "botIdOverride={selectedBot.id}" in workspace
    assert "versionIdOverride={versionName}" in workspace
    assert "botIdOverride?: string;" in simulator
    assert "versionIdOverride?: string;" in simulator
    assert "<SimulatorPage" in simulator
    assert "botIdOverride={botIdOverride}" in simulator
    assert "versionIdOverride={versionIdOverride}" in simulator


def test_bot_management_shows_selected_version_ai_details() -> None:
    shared = _read("apps/web/components/bot-operation-shared.ts")
    management = _read("apps/web/components/bot-management-page.tsx")
    catalog = _read("apps/web/lib/i18n/bot-management.ts")

    assert "readOperationAiDetails" in shared
    assert "version.system_config" in shared
    assert "bot.data_json" in shared
    assert "{copy.nluType}" in management
    assert "{copy.nluModel}" in management
    assert "{copy.answerMode}" in management
    assert "<dt>LLM</dt>" in management
    assert "readOperationAiDetails(selectedBot, selectedVersion)" in management
    assert 'nluType: "NLU 방식"' in catalog
    assert "satisfies Record<SupportedLanguage, BotManagementCatalog>" in catalog