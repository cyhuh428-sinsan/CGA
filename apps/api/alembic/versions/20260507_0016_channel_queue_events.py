"""Create channel queue event table.

Revision ID: 20260507_0016
Revises: 20260507_0015
Create Date: 2026-05-07 18:40:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260507_0016"
down_revision = "20260507_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "channel_queue_events",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("room_id", sa.Uuid(), nullable=True),
        sa.Column("request_message_id", sa.Uuid(), nullable=True),
        sa.Column("channel_type", sa.String(length=40), nullable=False),
        sa.Column("bot_id", sa.Uuid(), nullable=False),
        sa.Column("bot_version_id", sa.Uuid(), nullable=False),
        sa.Column("participant_id", sa.String(length=120), nullable=False),
        sa.Column("intent_name", sa.String(length=200), nullable=True),
        sa.Column("sender_system", sa.String(length=80), nullable=False),
        sa.Column("receiver", sa.String(length=120), nullable=False),
        sa.Column("priority", sa.String(length=20), nullable=False),
        sa.Column("receive_status", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("parameter_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("result_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("status_changed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["bot_id"], ["bots.id"], name="fk_channel_queue_events_bot_id"),
        sa.ForeignKeyConstraint(["bot_version_id"], ["bot_versions.id"], name="fk_channel_queue_events_bot_version_id"),
        sa.ForeignKeyConstraint(["request_message_id"], ["channel_messages.id"], name="fk_channel_queue_events_request_message_id"),
        sa.ForeignKeyConstraint(["room_id"], ["channel_rooms.id"], name="fk_channel_queue_events_room_id"),
    )
    op.create_index("idx_channel_queue_events_channel_type", "channel_queue_events", ["channel_type"], unique=False)
    op.create_index("idx_channel_queue_events_room_id", "channel_queue_events", ["room_id"], unique=False)
    op.create_index("idx_channel_queue_events_status", "channel_queue_events", ["status"], unique=False)
    op.create_index("idx_channel_queue_events_created_at", "channel_queue_events", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_channel_queue_events_created_at", table_name="channel_queue_events")
    op.drop_index("idx_channel_queue_events_status", table_name="channel_queue_events")
    op.drop_index("idx_channel_queue_events_room_id", table_name="channel_queue_events")
    op.drop_index("idx_channel_queue_events_channel_type", table_name="channel_queue_events")
    op.drop_table("channel_queue_events")
