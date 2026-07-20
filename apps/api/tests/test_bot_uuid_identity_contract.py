from pathlib import Path
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.auth import UserPreferenceUpdateRequest


REPO_ROOT = Path(__file__).resolve().parents[3]


def _read(relative_path: str) -> str:
    return (REPO_ROOT / relative_path).read_text(encoding="utf-8")


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
