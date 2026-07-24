from __future__ import annotations

from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]


def _read(relative_path: str) -> str:
    return (ROOT_DIR / relative_path).read_text(encoding="utf-8")


def test_configure_section_uses_compact_workspace_header() -> None:
    provider = _read("apps/web/components/studio-workspace-provider.tsx")
    header = _read("apps/web/components/bot-workspace-header.tsx")

    assert 'compact={activeSection === "configure"}' in provider
    assert "compact?: boolean;" in header
    assert "{compact ? null : (" in header
    assert "<ManualMainHeaderActions" in header
    assert "<NluTrainingButton" in header
    assert "<SummaryStatGrid" in header


def test_configure_engine_is_fixed_to_llm() -> None:
    configure_page = _read("apps/web/components/intent-configure-page.tsx")

    assert 'const configureNluType: NluType = "llm";' in configure_page
    assert '<select value="llm" disabled>' in configure_page
    assert '<option value="llm">LLM Engine</option>' in configure_page
    assert "NLU_TYPE_OPTIONS.map" not in configure_page
    assert "handleConfigureNluTypeChange" not in configure_page


def test_asset_management_sections_do_not_render_summary_stats() -> None:
    provider = _read("apps/web/components/studio-workspace-provider.tsx")
    header = _read("apps/web/components/bot-workspace-header.tsx")

    assert 'activeSection === "intents"' in provider
    assert 'activeSection === "entities"' in provider
    assert 'activeSection === "dictionary"' in provider
    assert "hideSummary={" in provider
    assert "hideSummary?: boolean;" in header
    assert "compact || hideSummary ? null" in header


def test_evaluation_section_does_not_render_summary_stats() -> None:
    provider = _read("apps/web/components/studio-workspace-provider.tsx")

    assert '|| activeSection === "evaluation"' in provider


def test_bot_test_keeps_analysis_open_but_popup_simulator_can_toggle_it() -> None:
    simulator = _read("apps/web/components/simulator-page.tsx")
    catalog = _read("apps/web/lib/i18n/simulator.ts")

    assert "const [analysisOpen, setAnalysisOpen] = useState(false);" in simulator
    assert "const analysisVisible = !embedded || analysisOpen;" in simulator
    assert 'analysisVisible ? " simulator-workbench--debug-open" : ""' in simulator
    assert '<aside className="simulator-analysis" aria-label={copy.analysisData}>' in simulator
    assert "{copy.analysisData}" in simulator
    assert "aria-label={copy.closeAnalysis}" in simulator
    assert "<h1>{copy.botTestTitle}</h1>" in simulator
    assert '<p className="crumb">{copy.botTestBreadcrumb}</p>' in simulator
    assert "satisfies Record<SupportedLanguage, SimulatorCatalog>" in catalog


def test_operations_retraining_and_analysis_hide_summary_and_simulator() -> None:
    provider = _read("apps/web/components/studio-workspace-provider.tsx")
    retraining = _read("apps/web/components/retraining-page.tsx")
    analysis = _read("apps/web/components/analysis-page.tsx")

    assert '|| activeSection === "retraining"' in provider
    assert '|| activeSection === "analysis"' in provider
    assert "SimulatorFloatingLauncher" not in retraining
    assert "SimulatorFloatingLauncher" not in analysis