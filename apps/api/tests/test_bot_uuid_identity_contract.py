import importlib.util
from pathlib import Path
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.auth import UserPreferenceUpdateRequest


REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATION_PATH = REPO_ROOT / "apps/api/alembic/versions/20260720_0027_remove_bot_slug.py"


def _read(relative_path: str) -> str:
    return (REPO_ROOT / relative_path).read_text(encoding="utf-8")


def _load_migration():
    spec = importlib.util.spec_from_file_location("remove_bot_slug_migration", MIGRATION_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_bot_identity_contract_has_no_active_slug_usage() -> None:
    active_sources = (
        "apps/api/app/models/studio.py",
        "apps/api/app/api/routes/auth.py",
        "apps/api/app/api/routes/bots.py",
        "apps/api/app/api/routes/channels.py",
        "apps/api/app/api/routes/hubs.py",
        "apps/api/app/api/routes/webchat.py",
        "apps/web/lib/studio-bots-api.ts",
        "apps/web/components/botstation-settings-page.tsx",
        "packages/shared/src/channel.ts",
        "compat-samples/Aidot 봇_v1.json",
    )

    for relative_path in active_sources:
        source = _read(relative_path)
        assert "slug" not in source.lower(), relative_path


def test_latest_migration_removes_bot_slug_column() -> None:
    migration = _read("apps/api/alembic/versions/20260720_0027_remove_bot_slug.py")

    assert 'op.drop_column("bots", "slug")' in migration
    assert 'op.add_column("bots", sa.Column("slug"' in migration


def test_favorite_bot_ids_accept_only_uuid_values() -> None:
    bot_id = str(uuid4())

    payload = UserPreferenceUpdateRequest(favorite_bot_ids=[bot_id, bot_id])
    assert payload.favorite_bot_ids == [bot_id]

    with pytest.raises(ValidationError):
        UserPreferenceUpdateRequest(favorite_bot_ids=["legacy-bot-slug"])


def test_migration_rewrites_saved_bot_identifiers_to_uuid() -> None:
    migration = _load_migration()
    bot_id = str(uuid4())
    source = {
        "settings_by_version": {
            "v1": {
                "botstation": {
                    "channels": [
                        {"channelCode": "WEBCHAT", "botIdentifier": "legacy-bot-slug"},
                    ]
                }
            }
        }
    }

    rewritten, changed = migration._rewrite_bot_identifiers(source, bot_id=bot_id)

    assert changed is True
    assert rewritten["settings_by_version"]["v1"]["botstation"]["channels"][0]["botIdentifier"] == bot_id


def test_migration_rewrites_last_screen_bot_key_to_uuid() -> None:
    migration = _load_migration()
    bot_id = str(uuid4())

    rewritten = migration._rewrite_last_bot_screen(
        "/studio/bots/legacy-bot-slug/versions/v1/intents",
        {"legacy-bot-slug": bot_id},
    )

    assert rewritten == f"/studio/bots/{bot_id}/versions/v1/intents"
    assert migration._rewrite_last_bot_screen("/studio/bots/unknown/versions/v1/intents", {}) is None
