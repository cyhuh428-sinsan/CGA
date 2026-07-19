"""Create bot and version foundation tables.

Revision ID: 20260424_0002
Revises: 20260423_0001
Create Date: 2026-04-24 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260424_0002"
down_revision = "20260423_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bots",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("slug", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("active_version_id", sa.Uuid(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_bots_organization_id"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_bots_created_by"),
        sa.UniqueConstraint("slug", name="uq_bots_slug"),
    )
    op.create_index("idx_bots_organization_id", "bots", ["organization_id"], unique=False)
    op.create_index("idx_bots_active_version_id", "bots", ["active_version_id"], unique=False)

    op.create_table(
        "bot_versions",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("bot_id", sa.Uuid(), nullable=False),
        sa.Column("version_no", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("copied_from_version_id", sa.Uuid(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("activated_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["bot_id"], ["bots.id"], name="fk_bot_versions_bot_id"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_bot_versions_created_by"),
        sa.ForeignKeyConstraint(["activated_by"], ["users.id"], name="fk_bot_versions_activated_by"),
        sa.UniqueConstraint("bot_id", "version_no", name="uq_bot_versions_bot_id_version_no"),
    )
    op.create_index("idx_bot_versions_bot_id", "bot_versions", ["bot_id"], unique=False)
    op.create_index("idx_bot_versions_status", "bot_versions", ["status"], unique=False)

    op.create_foreign_key(
        "fk_bots_active_version_id",
        "bots",
        "bot_versions",
        ["active_version_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_bot_versions_copied_from_version_id",
        "bot_versions",
        "bot_versions",
        ["copied_from_version_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_bot_versions_copied_from_version_id", "bot_versions", type_="foreignkey")
    op.drop_constraint("fk_bots_active_version_id", "bots", type_="foreignkey")
    op.drop_index("idx_bot_versions_status", table_name="bot_versions")
    op.drop_index("idx_bot_versions_bot_id", table_name="bot_versions")
    op.drop_table("bot_versions")
    op.drop_index("idx_bots_active_version_id", table_name="bots")
    op.drop_index("idx_bots_organization_id", table_name="bots")
    op.drop_table("bots")
