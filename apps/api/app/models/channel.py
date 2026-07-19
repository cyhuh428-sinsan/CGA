from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class ChannelRoom(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "channel_rooms"
    __table_args__ = (
        UniqueConstraint("channel_type", "client_room_id", name="uq_channel_rooms_channel_client_room"),
    )

    channel_type: Mapped[str] = mapped_column(String(40), nullable=False)
    client_room_id: Mapped[str | None] = mapped_column(String(150), nullable=True)
    bot_id: Mapped[UUID] = mapped_column(ForeignKey("bots.id"), nullable=False)
    bot_version_id: Mapped[UUID] = mapped_column(ForeignKey("bot_versions.id"), nullable=False)
    participant_id: Mapped[str] = mapped_column(String(120), nullable=False, default="visitor")
    participant_name: Mapped[str] = mapped_column(String(120), nullable=False, default="사용자")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    metadata_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class ChannelMessage(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "channel_messages"

    room_id: Mapped[UUID] = mapped_column(ForeignKey("channel_rooms.id"), nullable=False)
    channel_type: Mapped[str] = mapped_column(String(40), nullable=False)
    participant_id: Mapped[str] = mapped_column(String(120), nullable=False)
    participant_kind: Mapped[str] = mapped_column(String(20), nullable=False)
    participant_name: Mapped[str] = mapped_column(String(120), nullable=False)
    message_type: Mapped[str] = mapped_column(String(40), nullable=False, default="text")
    text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    payload_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class ChannelQueueEvent(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "channel_queue_events"

    room_id: Mapped[UUID | None] = mapped_column(ForeignKey("channel_rooms.id"), nullable=True)
    request_message_id: Mapped[UUID | None] = mapped_column(ForeignKey("channel_messages.id"), nullable=True)
    channel_type: Mapped[str] = mapped_column(String(40), nullable=False)
    bot_id: Mapped[UUID] = mapped_column(ForeignKey("bots.id"), nullable=False)
    bot_version_id: Mapped[UUID] = mapped_column(ForeignKey("bot_versions.id"), nullable=False)
    participant_id: Mapped[str] = mapped_column(String(120), nullable=False, default="visitor")
    intent_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    sender_system: Mapped[str] = mapped_column(String(80), nullable=False, default="external-channel")
    receiver: Mapped[str] = mapped_column(String(120), nullable=False, default="Aidot")
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")
    receive_status: Mapped[str] = mapped_column(String(40), nullable=False, default="received")
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="queued")
    parameter_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    result_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status_changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
