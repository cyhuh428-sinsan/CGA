"""Add bot group ownership for access control.

Revision ID: 20260426_0006
Revises: 20260426_0005
Create Date: 2026-04-26 16:40:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260426_0006"
down_revision = "20260426_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bots", sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_bots_group_id_groups",
        "bots",
        "groups",
        ["group_id"],
        ["id"],
    )

    op.execute(
        """
        UPDATE bots
        SET group_id = users.group_id
        FROM users
        WHERE bots.created_by = users.id
          AND bots.group_id IS NULL
          AND users.group_id IS NOT NULL
        """
    )

    op.execute(
        """
        UPDATE bots
        SET group_id = (
            SELECT groups.id
            FROM groups
            WHERE groups.organization_id = bots.organization_id
              AND groups.deleted_at IS NULL
            ORDER BY groups.created_at ASC
            LIMIT 1
        )
        WHERE bots.group_id IS NULL
        """
    )

    op.alter_column("bots", "group_id", nullable=False)


def downgrade() -> None:
    op.drop_constraint("fk_bots_group_id_groups", "bots", type_="foreignkey")
    op.drop_column("bots", "group_id")
