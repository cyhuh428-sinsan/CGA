from __future__ import annotations

from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]


def _read(relative_path: str) -> str:
    return (ROOT_DIR / relative_path).read_text(encoding="utf-8")


def test_retraining_fetches_conversation_history_with_api_safe_pagination() -> None:
    admin_api = _read("apps/web/lib/admin-api.ts")
    retraining_page = _read("apps/web/components/retraining-page.tsx")

    assert "fetchAllConversationHistory" in admin_api
    assert "const pageSize = 100" in admin_api
    assert "pageSize: 500" not in retraining_page
    assert retraining_page.count("fetchAllConversationHistory(") == 2
