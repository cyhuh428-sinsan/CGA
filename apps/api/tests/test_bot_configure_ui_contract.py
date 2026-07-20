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
