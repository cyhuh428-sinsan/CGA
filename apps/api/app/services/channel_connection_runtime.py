"""인증된 합성/실제 adapter 이벤트를 native 런타임과 전달 원장으로 연결한다."""
from __future__ import annotations
import asyncio
import concurrent.futures
from threading import Event
from dataclasses import dataclass
from types import SimpleNamespace
from typing import Protocol
from uuid import UUID

from sqlalchemy import select
from app.models import ChannelConnection, ChannelConnectionDelivery, ChannelConnectionRoom
from app.services import channel_connection_state as state
from app.services.channel_connections import decrypt_event_context, encrypt_event_context
from app.services.channel_connection_bridge import channel_mapping, convert_packet
from app.services.channel_runtime_native import ConnectionRuntimeEnvelope, run_connection_envelope


@dataclass(frozen=True)
class ConnectionTarget:
    id: UUID
    organization_id: UUID
    bot_id: UUID
    provider: str
    installation_id: str
    account_id: str
    target_id: str
    generation: int

    @classmethod
    def from_row(cls, row):
        return cls(**{name: getattr(row, name) for name in cls.__dataclass_fields__})


class ConnectionListener(Protocol):
    async def listen(self, receive): ...
    async def update(self, targets: list[ConnectionTarget]): ...
    async def close(self): ...
    async def send(self, target: ConnectionTarget, packets: list[dict], context: dict) -> list[str]: ...


class ConnectionAdapter(Protocol):
    async def verify(self, target: ConnectionTarget, credentials: dict) -> dict: ...
    async def open(self, targets: list[ConnectionTarget], credentials: dict, identity: dict) -> ConnectionListener: ...


class ConnectionRuntime:
    def __init__(self, session_factory, *, key, version):
        self.session_factory, self.key, self.version = session_factory, key, version

    async def receive(self, connection_id, installation_id, owner, fence, event):
        return await asyncio.to_thread(self._receive, connection_id, installation_id, owner, fence, event)

    def _receive(self, connection_id, installation_id, owner, fence, event):
        with self.session_factory() as db:
            item = state.accept_delivery(db, connection_id, installation_id, owner, fence, event,
                key=self.key, version=self.version)
            delivery_id = item.id
            db.commit()
        return delivery_id

    async def process_one(self, connection_id, installation_id, owner, fence, listener):
        delivery_id = await asyncio.to_thread(self._execute_one, connection_id, installation_id, owner, fence,
            getattr(listener, 'can_execute', None))
        if delivery_id is None:
            return False
        return await self._send(delivery_id, installation_id, owner, fence, listener)

    def _execute_one(self, connection_id, installation_id, owner, fence, eligibility=None):
        with self.session_factory() as db:
            state._live(db, connection_id, installation_id, owner, fence)
            state.recover_expired(db, connection_id)
            ready = db.scalar(select(ChannelConnectionDelivery.id).where(
                ChannelConnectionDelivery.connection_id == connection_id, ChannelConnectionDelivery.status == "ready")
                .order_by(ChannelConnectionDelivery.created_at).limit(1))
            if ready is not None:
                db.commit()
                return ready
            item = state.claim_delivery(db, connection_id, installation_id, owner, fence, deadline_seconds=300,
                eligibility=eligibility)
            if item is None:
                db.commit(); return None
            delivery_id, claim, generation = item.id, item.execution_claim_id, item.generation
            event = decrypt_event_context(item.context_ciphertext, item.organization_id, item.id,
                self.key, item.context_key_version)
            row = db.get(ChannelConnection, connection_id)
            envelope = ConnectionRuntimeEnvelope(organization_id=row.organization_id, connection_id=row.id,
                bot_id=row.bot_id, channel_type=channel_mapping(row.provider)["runtime"],
                native_room_hash=item.native_room_hash, native_actor_hash=item.native_actor_hash,
                provider_event_key=item.event_key, message=event["message"],
                request=SimpleNamespace(headers={}, client=None, state=SimpleNamespace(request_id=str(delivery_id))),
                language=event.get("language"), source_talk_node_id=event.get("sourceTalkNodeId"))
            # Native helpers commit independently. Persist claim before entering them.
            db.commit()
            def guard(room_id=None):
                live = state._live(db, connection_id, installation_id, owner, fence)
                if live.generation != generation:
                    from fastapi import HTTPException
                    raise HTTPException(409, "CONNECTION_CHANGED")
                delivery = state._delivery(db, delivery_id)
                if delivery.status != "executing" or delivery.execution_claim_id != claim:
                    from fastapi import HTTPException
                    raise HTTPException(409, "EXECUTION_CLAIM_LOST")
                if room_id is not None:
                    mapping = db.scalar(select(ChannelConnectionRoom).where(
                        ChannelConnectionRoom.connection_id == connection_id,
                        ChannelConnectionRoom.native_room_hash == delivery.native_room_hash))
                    if mapping is None:
                        db.add(ChannelConnectionRoom(connection_id=connection_id,
                            native_room_hash=delivery.native_room_hash, room_id=room_id,
                            participant_ciphertext=delivery.context_ciphertext,
                            credential_key_version=delivery.context_key_version))
            try:
                guard()
                result = run_connection_envelope(db, envelope, before_message=guard)
                guard()
                item = state._delivery(db, delivery_id)
                item.room_id = UUID(result["roomId"])
                item.request_message_id = UUID(result["userMessage"]["id"])
                item.queue_event_id = UUID(result["queueEvent"]["id"])
                context = {"event": event, "messages": result["botMessages"]}
                item.context_ciphertext = encrypt_event_context(context, item.organization_id, item.id, self.key, self.version)
                item.context_key_version = self.version
                state.mark_ready(db, delivery_id, {"messageCount": len(result["botMessages"])}, claim,
                    installation_id, owner, fence)
                db.commit()
            except BaseException:
                db.rollback()
                # A room/message may already be committed; execution is never automatically retried.
                item = state._delivery(db, delivery_id)
                if item.status == "executing" and item.execution_claim_id == claim:
                    item.status, item.last_error_code = "unknown", "EXECUTION_UNKNOWN"
                    db.commit()
                raise
        return delivery_id

    async def _send(self, delivery_id, installation_id, owner, fence, listener):
        loop = asyncio.get_running_loop()
        cancelled = Event()
        task = asyncio.create_task(asyncio.to_thread(self._send_transaction, delivery_id,
            installation_id, owner, fence, listener, loop, cancelled))
        try:
            return await asyncio.shield(task)
        except asyncio.CancelledError:
            cancelled.set()
            # DB thread records unknown and releases locks before shutdown returns.
            try: await task
            except concurrent.futures.CancelledError: pass
            raise

    def _send_transaction(self, delivery_id, installation_id, owner, fence, listener, loop, cancelled):
        with self.session_factory() as db:
            claim = state.claim_send(db, delivery_id, installation_id, owner, fence)
            if not claim:
                db.commit(); return False
            item = state._delivery(db, delivery_id)
            row = db.get(ChannelConnection, item.connection_id)
            target = ConnectionTarget.from_row(row)
            context = decrypt_event_context(item.context_ciphertext, item.organization_id, item.id,
                self.key, item.context_key_version)
            db.commit()
            try:
                live = state._live(db, target.id, installation_id, owner, fence)
                if live.generation != item.generation:
                    from fastapi import HTTPException
                    raise HTTPException(409, "CONNECTION_CHANGED")
                # Keep the fresh lease/connection row locks until send completes or becomes unknown.
                packets = convert_packet(target.provider, "replies", {"messages": context["messages"],
                    "destination": context["event"].get("destination", context["event"])})
                if cancelled.is_set(): raise concurrent.futures.CancelledError()
                # 변환 subprocess 대기 동안 시간이 지났을 수 있으므로 송신 직전 DB clock으로 재검사한다.
                state._live(db, target.id, installation_id, owner, fence)
                send_options = {}
                prepare = getattr(listener, 'prepare_send', None)
                if prepare is not None:
                    send_options['send_guard'] = prepare(db, target, item, context['event'], packets, cancelled=cancelled)
                send = asyncio.run_coroutine_threadsafe(
                    asyncio.wait_for(listener.send(target, packets, context["event"], **send_options), timeout=25), loop)
                try:
                    while True:
                        if cancelled.is_set(): raise concurrent.futures.CancelledError()
                        try:
                            ids = send.result(timeout=0.05)
                            break
                        except concurrent.futures.TimeoutError:
                            if send.done(): raise
                except BaseException:
                    send.cancel()
                    raise
                state.record_sent(db, delivery_id, claim, ids)
                db.commit()
            except BaseException as error:
                cancelled.set()
                db.rollback()
                failure = getattr(listener, 'record_send_failure', None)
                if failure is not None:
                    try:
                        failure(db, target, error, installation_id, owner, fence)
                    except Exception:
                        db.rollback()
                state.mark_unknown(db, delivery_id, claim, "DELIVERY_UNKNOWN")
                db.commit()
                if isinstance(error, (asyncio.CancelledError, concurrent.futures.CancelledError)): raise
        return True
