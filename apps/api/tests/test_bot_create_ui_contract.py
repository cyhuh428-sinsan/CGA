from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]


def test_bot_hub_cannot_be_selected_from_bot_create_page() -> None:
    create_dialog = (ROOT_DIR / "apps/web/components/bot-create-dialog.tsx").read_text(encoding="utf-8")

    hub_option = create_dialog.split('checked={botKind === "hub"}', 1)[1].split("</label>", 1)[0]
    assert "disabled" in hub_option
    assert 'setBotKind("hub")' not in create_dialog
