"""조직 범위가 검증된 내부 연결 작업을 기존 CGA 런타임으로 전달한다.

공개 인증 경로가 아니다. 호출자는 provider 인증 및 delivery 중복 검증을 먼저
끝내야 하며, 같은 DB 세션과 민감정보 없는 감사 request 컨텍스트를 전달한다.
HTTP API의 key 검증과 세션 소유권은 기존 route에 남긴다.
"""
from __future__ import annotations

from dataclasses import dataclass
import re
from typing import TYPE_CHECKING, Any
from uuid import UUID

from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from app.api.routes.channels import ChannelMessageRequest, ChannelRoomCreateRequest

NativeRoomResult = dict[str, Any]
NativeMessageResult = dict[str, Any]
ConnectionRuntimeResult = dict[str, Any]


@dataclass(frozen=True, kw_only=True)
class NativeRoomCommand:
    organization_id: UUID
    channel_type: str
    payload: ChannelRoomCreateRequest
    request: Request


@dataclass(frozen=True, kw_only=True)
class NativeMessageCommand:
    organization_id: UUID
    bot_id: UUID
    channel_type: str
    room_id: UUID
    payload: ChannelMessageRequest
    request: Request


@dataclass(frozen=True, kw_only=True)
class ConnectionRuntimeEnvelope:
    organization_id: UUID
    connection_id: UUID
    bot_id: UUID
    channel_type: str
    native_room_hash: str
    native_actor_hash: str
    provider_event_key: str
    message: str
    request: Request
    language: str | None = None
    source_talk_node_id: str | None = None


def _not_found() -> None:
    raise HTTPException(status_code=404, detail="채널 대상을 찾을 수 없습니다.")


def open_native_channel_room(db: Session, command: NativeRoomCommand) -> NativeRoomResult:
    from app.api.routes import channels

    channel = channels._ensure_channel(command.channel_type)
    try:
        bot_id = UUID(str(command.payload.bot_id).strip())
    except (TypeError, ValueError):
        _not_found()
    scoped_bot = db.get(channels.Bot, bot_id)
    if scoped_bot is None or command.organization_id is None or scoped_bot.organization_id != command.organization_id:
        _not_found()
    bot, _, _ = channels._get_active_bot_version(db, command.payload.bot_id, channel)
    if command.organization_id is None or bot.organization_id != command.organization_id:
        _not_found()
    if command.payload.client_room_id:
        existing = db.scalar(select(channels.ChannelRoom).where(
            channels.ChannelRoom.channel_type == channel,
            channels.ChannelRoom.client_room_id == command.payload.client_room_id,
            channels.ChannelRoom.deleted_at.is_(None),
        ))
        if existing is not None and existing.bot_id != bot.id:
            _not_found()
    return channels._open_native_channel_room(db, channel, command.payload, command.request)["data"]


def execute_native_channel_message(db: Session, command: NativeMessageCommand) -> NativeMessageResult:
    from app.api.routes import channels

    channel = channels._ensure_channel(command.channel_type)
    room = db.scalar(select(channels.ChannelRoom).where(
        channels.ChannelRoom.id == command.room_id,
        channels.ChannelRoom.channel_type == channel,
        channels.ChannelRoom.status == "open",
        channels.ChannelRoom.deleted_at.is_(None),
    ))
    if room is None or room.bot_id != command.bot_id:
        _not_found()
    bot = db.get(channels.Bot, room.bot_id)
    if bot is None or command.organization_id is None or bot.organization_id != command.organization_id:
        _not_found()
    return channels._execute_native_channel_message(
        db, channel, command.room_id, command.payload, command.request,
    )["data"]


def run_connection_envelope(db: Session, envelope: ConnectionRuntimeEnvelope, *, before_message=None) -> ConnectionRuntimeResult:
    from app.api.routes.channels import ChannelMessageRequest, ChannelRoomCreateRequest

    # 외부 식별자는 hash만 허용한다. 중복 제거와 mapping 저장은 호출자 책임이다.
    for value in (envelope.native_room_hash, envelope.native_actor_hash, envelope.provider_event_key):
        if not re.fullmatch(r"[0-9a-f]{64}", value):
            raise ValueError("연결 식별자는 SHA-256 hash여야 합니다.")
    message_payload = ChannelMessageRequest(
        message=envelope.message, participant_id=envelope.native_actor_hash,
        language=envelope.language, source_talk_node_id=envelope.source_talk_node_id,
    )
    room_result = open_native_channel_room(db, NativeRoomCommand(
        organization_id=envelope.organization_id, channel_type=envelope.channel_type,
        request=envelope.request,
        payload=ChannelRoomCreateRequest(
            bot_id=str(envelope.bot_id),
            client_room_id=f"connection:{envelope.connection_id}:{envelope.native_room_hash}",
            participant_id=envelope.native_actor_hash, participant_name="사용자",
            language=envelope.language, start_immediately=False,
        ),
    ))
    # 방 open은 기존 contract상 commit한다. 메시지 실행 전 lease/generation을 재검증한다.
    if before_message is not None:
        before_message(UUID(room_result["room"]["id"]))
    message_result = execute_native_channel_message(db, NativeMessageCommand(
        organization_id=envelope.organization_id, bot_id=envelope.bot_id,
        channel_type=envelope.channel_type, room_id=UUID(room_result["room"]["id"]),
        request=envelope.request,
        payload=message_payload,
    ))
    return message_result
