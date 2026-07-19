"""Add bot hub foundation tables.

Revision ID: 20260715_0026
Revises: 20260714_0025
Create Date: 2026-07-15
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260715_0026"
down_revision = "20260714_0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bot_hubs",
        sa.Column("bot_id", sa.Uuid(), nullable=False),
        sa.Column("call_method", sa.String(length=20), nullable=False, server_default="button"),
        sa.Column("button_match_mode", sa.String(length=20), nullable=False, server_default="exact"),
        sa.Column("greeting_message", sa.Text(), nullable=True),
        sa.Column("intent_cutoff_score", sa.Float(), nullable=False, server_default="0.75"),
        sa.Column("similar_intent_score", sa.Float(), nullable=False, server_default="0.85"),
        sa.Column("max_intent_candidates", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("show_members_in_greeting", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("unrecognized_message", sa.Text(), nullable=True),
        sa.Column("multiple_candidates_message", sa.Text(), nullable=True),
        sa.Column("runtime_error_message", sa.Text(), nullable=True),
        sa.Column("conversation_in_progress_message", sa.Text(), nullable=True),
        sa.Column("timeout_seconds", sa.Integer(), nullable=True),
        sa.Column("apply_timeout_to_push", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("timeout_message", sa.Text(), nullable=True),
        sa.Column("no_bot_label", sa.String(length=120), nullable=True),
        sa.Column("no_bot_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["bot_id"], ["bots.id"], name="fk_bot_hubs_bot_id"),
        sa.PrimaryKeyConstraint("bot_id"),
    )
    op.create_table(
        "bot_hub_members",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("hub_id", sa.Uuid(), nullable=False),
        sa.Column("bot_id", sa.Uuid(), nullable=False),
        sa.Column("display_name", sa.String(length=150), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("use_as_small_talk", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["hub_id"], ["bot_hubs.bot_id"], name="fk_bot_hub_members_hub_id"),
        sa.ForeignKeyConstraint(["bot_id"], ["bots.id"], name="fk_bot_hub_members_bot_id"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("hub_id", "bot_id", name="uq_bot_hub_members_hub_bot"),
    )
    op.create_index("idx_bot_hub_members_hub_sort", "bot_hub_members", ["hub_id", "sort_order"], unique=False)
    op.execute(
        """
        INSERT INTO bot_hubs (bot_id, call_method, button_match_mode, intent_cutoff_score, similar_intent_score, max_intent_candidates, show_members_in_greeting, apply_timeout_to_push)
        SELECT id, 'button', 'exact', 0.75, 0.85, 3, false, false
        FROM bots
        WHERE COALESCE(data_json->>'bot_kind', 'bot') = 'hub'
        ON CONFLICT (bot_id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index("idx_bot_hub_members_hub_sort", table_name="bot_hub_members")
    op.drop_table("bot_hub_members")
    op.drop_table("bot_hubs")