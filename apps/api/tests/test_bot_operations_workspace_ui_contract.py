from __future__ import annotations

from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]


def _read(relative_path: str) -> str:
    return (ROOT_DIR / relative_path).read_text(encoding="utf-8")


def test_workspace_renders_three_evaluation_diagnostics() -> None:
    workspace = _read("apps/web/components/bot-operations-workspace-page.tsx")

    assert "오분류 문장" in workspace
    assert "낮은 Score 문장" in workspace
    assert "유사 의도 충돌" in workspace
    assert "training_rows" in workspace
    assert "row.score < 70" in workspace
    assert "!row.correct" in workspace
    assert "시뮬레이터 미리보기" not in workspace


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
