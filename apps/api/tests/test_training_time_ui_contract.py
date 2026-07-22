from __future__ import annotations

from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]


def _read(relative_path: str) -> str:
    return (ROOT_DIR / relative_path).read_text(encoding="utf-8")


def test_training_times_are_rendered_in_korean_standard_time() -> None:
    formatter = _read("apps/web/lib/date-time.ts")
    workspace_header = _read("apps/web/components/bot-workspace-header.tsx")
    training_button = _read("apps/web/components/nlu-training-button.tsx")

    assert 'timeZone: "Asia/Seoul"' in formatter
    assert 'hourCycle: "h23"' in formatter
    assert "formatKoreanDateTime(training.trained_at)" in workspace_header
    assert "formatKoreanDateTime(manifest.model?.trained_at)" in training_button
    assert '.replace("T", " ").slice(' not in workspace_header
    assert '.replace("T", " ").slice(' not in training_button
