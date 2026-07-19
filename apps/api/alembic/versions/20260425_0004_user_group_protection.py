"""Add group and protection columns to users.

Revision ID: 20260425_0004
Revises: 20260425_0003
Create Date: 2026-04-25 00:10:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260425_0004"
down_revision = "20260425_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("group_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("is_protected", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_foreign_key("fk_users_group_id", "users", "groups", ["group_id"], ["id"])
    op.create_index("idx_users_group_id", "users", ["group_id"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_users_group_id", table_name="users")
    op.drop_constraint("fk_users_group_id", "users", type_="foreignkey")
    op.drop_column("users", "is_protected")
    op.drop_column("users", "group_id")
