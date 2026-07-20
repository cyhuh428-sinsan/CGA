"""Remove the legacy bot slug identity.

Revision ID: 20260720_0027
Revises: 20260715_0026
Create Date: 2026-07-20
"""

from __future__ import annotations

import json
from urllib.parse import unquote
from uuid import UUID

from alembic import op
import sqlalchemy as sa


revision = "20260720_0027"
down_revision = "20260715_0026"
branch_labels = None
depends_on = None


def _uuid_text(value: object) -> str | None:
    try:
        return str(UUID(str(value).strip()))
    except (AttributeError, TypeError, ValueError):
        return None


def _rewrite_bot_identifiers(value: object, *, bot_id: str) -> tuple[object, bool]:
    if isinstance(value, list):
        changed = False
        items: list[object] = []
        for item in value:
            rewritten, item_changed = _rewrite_bot_identifiers(item, bot_id=bot_id)
            items.append(rewritten)
            changed = changed or item_changed
        return items, changed
    if not isinstance(value, dict):
        return value, False

    changed = False
    result: dict[str, object] = {}
    for key, item in value.items():
        if key == "botIdentifier" and item != bot_id:
            result[key] = bot_id
            changed = True
            continue
        rewritten, item_changed = _rewrite_bot_identifiers(item, bot_id=bot_id)
        result[key] = rewritten
        changed = changed or item_changed
    return result, changed


def _rewrite_last_bot_screen(value: object, key_to_id: dict[str, str]) -> str | None:
    if not isinstance(value, str) or not value.startswith("/studio/bots/"):
        return None
    remainder = value.removeprefix("/studio/bots/")
    raw_bot_key, separator, version_path = remainder.partition("/versions/")
    if not separator:
        return None
    decoded_key = unquote(raw_bot_key)
    bot_id = key_to_id.get(decoded_key) or _uuid_text(decoded_key)
    if bot_id is None:
        return None
    return f"/studio/bots/{bot_id}/versions/{version_path}"


def upgrade() -> None:
    connection = op.get_bind()
    bot_rows = connection.execute(sa.text("SELECT id, slug, data_json FROM bots")).mappings().all()
    key_to_id = {str(row["slug"]): str(row["id"]) for row in bot_rows}

    for row in bot_rows:
        bot_id = str(row["id"])
        data_json = row["data_json"] if isinstance(row["data_json"], dict) else {}
        rewritten, changed = _rewrite_bot_identifiers(data_json, bot_id=bot_id)
        if changed:
            connection.execute(
                sa.text("UPDATE bots SET data_json = CAST(:data_json AS jsonb) WHERE id = :bot_id"),
                {"data_json": json.dumps(rewritten, ensure_ascii=False), "bot_id": row["id"]},
            )

    user_rows = connection.execute(sa.text("SELECT id, data_json FROM users")).mappings().all()
    for row in user_rows:
        data_json = dict(row["data_json"]) if isinstance(row["data_json"], dict) else {}
        changed = False

        favorites = data_json.get("favorite_bot_ids")
        if isinstance(favorites, list):
            normalized: list[str] = []
            for item in favorites:
                bot_id = key_to_id.get(str(item)) or _uuid_text(item)
                if bot_id is not None and bot_id not in normalized:
                    normalized.append(bot_id)
            if normalized != favorites:
                data_json["favorite_bot_ids"] = normalized[:20]
                changed = True

        if "last_bot_screen" in data_json:
            rewritten_screen = _rewrite_last_bot_screen(data_json.get("last_bot_screen"), key_to_id)
            if rewritten_screen is None:
                data_json.pop("last_bot_screen", None)
                changed = True
            elif rewritten_screen != data_json.get("last_bot_screen"):
                data_json["last_bot_screen"] = rewritten_screen
                changed = True

        if changed:
            connection.execute(
                sa.text("UPDATE users SET data_json = CAST(:data_json AS jsonb) WHERE id = :user_id"),
                {"data_json": json.dumps(data_json, ensure_ascii=False), "user_id": row["id"]},
            )

    op.drop_constraint("uq_bots_slug", "bots", type_="unique")
    op.drop_column("bots", "slug")


def downgrade() -> None:
    op.add_column("bots", sa.Column("slug", sa.String(length=150), nullable=True))
    op.execute("UPDATE bots SET slug = CAST(id AS VARCHAR)")
    op.alter_column("bots", "slug", nullable=False)
    op.create_unique_constraint("uq_bots_slug", "bots", ["slug"])
