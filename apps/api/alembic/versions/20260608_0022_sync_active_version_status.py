"""Sync active bot version status.

Revision ID: 20260608_0022
Revises: 20260518_0021
Create Date: 2026-06-08
"""

from alembic import op


revision = "20260608_0022"
down_revision = "20260518_0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE bot_versions AS v
        SET status = 'testing'
        FROM bots AS b
        WHERE v.bot_id = b.id
          AND b.active_version_id IS NOT NULL
          AND v.id <> b.active_version_id
          AND v.status = 'active'
          AND v.deleted_at IS NULL
          AND b.deleted_at IS NULL
        """
    )
    op.execute(
        """
        UPDATE bot_versions AS v
        SET status = 'active',
            activated_at = COALESCE(v.activated_at, NOW())
        FROM bots AS b
        WHERE v.id = b.active_version_id
          AND v.bot_id = b.id
          AND v.deleted_at IS NULL
          AND b.deleted_at IS NULL
          AND v.status <> 'active'
        """
    )


def downgrade() -> None:
    pass
