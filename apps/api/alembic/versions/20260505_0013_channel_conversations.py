"""Create channel conversation tables.

Revision ID: 20260505_0013
Revises: 20260504_0012
Create Date: 2026-05-05 22:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260505_0013"
down_revision = "20260504_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "channel_rooms",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("channel_type", sa.String(length=40), nullable=False),
        sa.Column("client_room_id", sa.String(length=150), nullable=True),
        sa.Column("bot_id", sa.Uuid(), nullable=False),
        sa.Column("bot_version_id", sa.Uuid(), nullable=False),
        sa.Column("participant_id", sa.String(length=120), nullable=False),
        sa.Column("participant_name", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["bot_id"], ["bots.id"], name="fk_channel_rooms_bot_id"),
        sa.ForeignKeyConstraint(["bot_version_id"], ["bot_versions.id"], name="fk_channel_rooms_bot_version_id"),
        sa.UniqueConstraint("channel_type", "client_room_id", name="uq_channel_rooms_channel_client_room"),
    )
    op.create_index("idx_channel_rooms_channel_type", "channel_rooms", ["channel_type"], unique=False)
    op.create_index("idx_channel_rooms_bot_id", "channel_rooms", ["bot_id"], unique=False)
    op.create_index("idx_channel_rooms_status", "channel_rooms", ["status"], unique=False)

    op.create_table(
        "channel_messages",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("room_id", sa.Uuid(), nullable=False),
        sa.Column("channel_type", sa.String(length=40), nullable=False),
        sa.Column("participant_id", sa.String(length=120), nullable=False),
        sa.Column("participant_kind", sa.String(length=20), nullable=False),
        sa.Column("participant_name", sa.String(length=120), nullable=False),
        sa.Column("message_type", sa.String(length=40), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["room_id"], ["channel_rooms.id"], name="fk_channel_messages_room_id"),
    )
    op.create_index("idx_channel_messages_room_id", "channel_messages", ["room_id"], unique=False)
    op.create_index("idx_channel_messages_channel_type", "channel_messages", ["channel_type"], unique=False)
    op.create_index("idx_channel_messages_created_at", "channel_messages", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_channel_messages_created_at", table_name="channel_messages")
    op.drop_index("idx_channel_messages_channel_type", table_name="channel_messages")
    op.drop_index("idx_channel_messages_room_id", table_name="channel_messages")
    op.drop_table("channel_messages")
    op.drop_index("idx_channel_rooms_status", table_name="channel_rooms")
    op.drop_index("idx_channel_rooms_bot_id", table_name="channel_rooms")
    op.drop_index("idx_channel_rooms_channel_type", table_name="channel_rooms")
    op.drop_table("channel_rooms")
