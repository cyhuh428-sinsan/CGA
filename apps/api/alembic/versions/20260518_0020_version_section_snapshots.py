"""Add version section snapshot columns.

Revision ID: 20260518_0020
Revises: 20260518_0019
Create Date: 2026-05-18 23:50:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260518_0020"
down_revision = "20260518_0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bot_versions", sa.Column("entities_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("bot_versions", sa.Column("dictionary_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("bot_versions", sa.Column("apis_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    op.execute(
        """
        UPDATE bot_versions
        SET
            entities_json = CASE WHEN jsonb_typeof(version_json->'entities') = 'array' THEN version_json->'entities' ELSE '[]'::jsonb END,
            dictionary_json = CASE WHEN jsonb_typeof(version_json->'dictionary') = 'array' THEN version_json->'dictionary' ELSE '[]'::jsonb END,
            apis_json = CASE WHEN jsonb_typeof(version_json->'apis') = 'array' THEN version_json->'apis' ELSE '[]'::jsonb END
        WHERE version_json IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_column("bot_versions", "apis_json")
    op.drop_column("bot_versions", "dictionary_json")
    op.drop_column("bot_versions", "entities_json")
