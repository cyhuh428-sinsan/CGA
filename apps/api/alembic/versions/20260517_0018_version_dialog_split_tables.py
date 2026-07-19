"""Create version dialog split tables.

Revision ID: 20260517_0018
Revises: 20260517_0017
Create Date: 2026-05-17 21:40:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260517_0018"
down_revision = "20260517_0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "version_dialog_assets",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("bot_id", sa.Uuid(), nullable=False),
        sa.Column("version_id", sa.Uuid(), nullable=False),
        sa.Column("dialog_id", sa.String(length=120), nullable=False),
        sa.Column("kind", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=True),
        sa.Column("display_name", sa.String(length=200), nullable=True),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["bot_id"], ["bots.id"], name="fk_version_dialog_assets_bot_id"),
        sa.ForeignKeyConstraint(["version_id"], ["bot_versions.id"], name="fk_version_dialog_assets_version_id"),
    )
    op.create_index(
        "uq_version_dialog_assets_active_dialog",
        "version_dialog_assets",
        ["version_id", "dialog_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_version_dialog_assets_version_sort",
        "version_dialog_assets",
        ["version_id", "sort_order"],
        unique=False,
    )
    op.create_index(
        "idx_version_dialog_assets_version_kind",
        "version_dialog_assets",
        ["version_id", "kind"],
        unique=False,
    )

    op.create_table(
        "version_dialog_flow_graphs",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("bot_id", sa.Uuid(), nullable=False),
        sa.Column("version_id", sa.Uuid(), nullable=False),
        sa.Column("dialog_id", sa.String(length=120), nullable=False),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["bot_id"], ["bots.id"], name="fk_version_dialog_flow_graphs_bot_id"),
        sa.ForeignKeyConstraint(["version_id"], ["bot_versions.id"], name="fk_version_dialog_flow_graphs_version_id"),
    )
    op.create_index(
        "uq_version_dialog_flow_graphs_active_dialog",
        "version_dialog_flow_graphs",
        ["version_id", "dialog_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_version_dialog_flow_graphs_version",
        "version_dialog_flow_graphs",
        ["version_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_version_dialog_flow_graphs_version", table_name="version_dialog_flow_graphs")
    op.drop_index("uq_version_dialog_flow_graphs_active_dialog", table_name="version_dialog_flow_graphs")
    op.drop_table("version_dialog_flow_graphs")
    op.drop_index("idx_version_dialog_assets_version_kind", table_name="version_dialog_assets")
    op.drop_index("idx_version_dialog_assets_version_sort", table_name="version_dialog_assets")
    op.drop_index("uq_version_dialog_assets_active_dialog", table_name="version_dialog_assets")
    op.drop_table("version_dialog_assets")
