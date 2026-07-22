from __future__ import annotations

from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]


def _read(relative_path: str) -> str:
    return (ROOT_DIR / relative_path).read_text(encoding="utf-8")


def test_full_workspace_context_request_explicitly_includes_document() -> None:
    api_source = _read("apps/web/lib/studio-bots-api.ts")

    assert 'search.set("include_document", includeDocument ? "true" : "false");' in api_source


def test_simulator_requests_the_full_selected_version_document() -> None:
    simulator_source = _read("apps/web/components/simulator-page.tsx")

    assert "refreshStudioBotSelectedVersion(accessToken, botId, versionId, null, true)" in simulator_source
