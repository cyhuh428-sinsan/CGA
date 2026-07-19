"""Create edit lock table.

Revision ID: 20260517_0017
Revises: 20260507_0016
Create Date: 2026-05-17 00:20:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260517_0017"
down_revision = "20260507_0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "edit_locks",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("group_id", sa.Uuid(), nullable=False),
        sa.Column("bot_id", sa.Uuid(), nullable=False),
        sa.Column("version_id", sa.Uuid(), nullable=False),
        sa.Column("dialog_id", sa.String(length=120), nullable=False),
        sa.Column("area", sa.String(length=40), nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("owner_login_id", sa.String(length=120), nullable=False),
        sa.Column("owner_name", sa.String(length=120), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["bot_id"], ["bots.id"], name="fk_edit_locks_bot_id"),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], name="fk_edit_locks_group_id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_edit_locks_organization_id"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], name="fk_edit_locks_owner_user_id"),
        sa.ForeignKeyConstraint(["version_id"], ["bot_versions.id"], name="fk_edit_locks_version_id"),
        sa.UniqueConstraint("bot_id", "version_id", "dialog_id", "area", name="uq_edit_locks_target"),
    )
    op.create_index("idx_edit_locks_owner_user_id", "edit_locks", ["owner_user_id"], unique=False)
    op.create_index("idx_edit_locks_expires_at", "edit_locks", ["expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_edit_locks_expires_at", table_name="edit_locks")
    op.drop_index("idx_edit_locks_owner_user_id", table_name="edit_locks")
    op.drop_table("edit_locks")
