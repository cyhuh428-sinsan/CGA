"""Add version system config snapshot column.

Revision ID: 20260518_0021
Revises: 20260518_0020
Create Date: 2026-05-18 23:58:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260518_0021"
down_revision = "20260518_0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bot_versions", sa.Column("system_config_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.execute(
        """
        UPDATE bot_versions
        SET system_config_json = CASE
            WHEN jsonb_typeof(version_json->'system_config') = 'object' THEN version_json->'system_config'
            ELSE '{}'::jsonb
        END
        WHERE version_json IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_column("bot_versions", "system_config_json")
