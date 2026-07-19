"""Add version JSON document column for bot versions.

Revision ID: 20260427_0008
Revises: 20260426_0007
Create Date: 2026-04-27 10:20:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260427_0008"
down_revision = "20260426_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "bot_versions",
        sa.Column(
            "version_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("bot_versions", "version_json")
