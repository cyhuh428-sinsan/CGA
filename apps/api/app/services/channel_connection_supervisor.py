"""공통 listener supervisor. 실제 provider는 후속 Task에서 명시적으로 등록한다."""
from __future__ import annotations
import asyncio
from dataclasses import dataclass
from uuid import uuid4
from sqlalchemy import select
from app.core.config import settings
from app.core.logging import get_logger
from app.models import ChannelConnection, ChannelInstallationLease
from app.services import channel_connection_state as state
from app.services.channel_connections import _cipher, decrypt_credentials
from app.services.channel_connection_runtime import ConnectionTarget, ConnectionRuntime, ConnectionAdapter

ADAPTERS: dict[str, ConnectionAdapter] = {}
logger = get_logger("cga.channel.connections")


@dataclass
class ListenerHandle:
    listener: object
    task: asyncio.Task
    lease_id: object
    fence: int
    targets: list[ConnectionTarget]


class ConnectionSupervisor:
    def __init__(self, session_factory, *, config=settings, adapters=None):
        self.session_factory, self.config = session_factory, config
        self.adapters = ADAPTERS if adapters is None else adapters
        self.owner = str(uuid4())
        self.task = None
        self.handles = {}
        self.runtime = ConnectionRuntime(session_factory, key=config.channel_connection_encryption_key,
            version=config.channel_connection_key_version)

    async def start(self):
        if not self.config.channel_connection_worker_enabled: return
        _cipher(self.config.channel_connection_encryption_key)
        if self.task is None or self.task.done():
            self.task = asyncio.create_task(self._loop())

    async def stop(self):
        if self.task is not None:
            self.task.cancel()
            try: await self.task
            except asyncio.CancelledError: pass
            self.task = None
        for key in list(self.handles):
            await self._close(key)

    async def _close(self, key):
        handle = self.handles.pop(key)
        handle.task.cancel()
        try: await handle.task
        except (asyncio.CancelledError, Exception): pass
        try: await asyncio.wait_for(handle.listener.close(), timeout=5)
        except Exception:
            logger.warning("Listener close failed", extra={"event": "channel.connection.close_failed"})
        with self.session_factory() as db:
            lease = db.scalar(select(ChannelInstallationLease).where(ChannelInstallationLease.id == handle.lease_id)
                .with_for_update())
            if lease is not None and lease.owner == self.owner and lease.fence == handle.fence:
                lease.owner, lease.lease_expires_at = None, state.clock(db)
            for target in handle.targets:
                row = db.get(ChannelConnection, target.id)
                if row is not None and row.lease_owner == self.owner:
                    row.observed_state = "disconnected" if row.desired_state == "disconnected" else "error"
                    row.lease_owner, row.lease_expires_at = None, None
            db.commit()

    async def _loop(self):
        while True:
            try: await self.tick()
            except asyncio.CancelledError: raise
            except Exception:
                # Exception text/traceback may contain provider payloads and is deliberately not logged.
                logger.warning("Connection supervisor iteration failed", extra={"event": "channel.connection.iteration_failed"})
            await asyncio.sleep(max(0.01, getattr(self.config, "channel_connection_poll_seconds", 2.0)))

    async def tick(self):
        if not self.adapters: return
        with self.session_factory() as db:
            rows = db.scalars(select(ChannelConnection).where(ChannelConnection.desired_state == "connected",
                ChannelConnection.deleted_at.is_(None))).all()
            targets = [ConnectionTarget.from_row(row) for row in rows if row.provider in self.adapters]
        active = set()
        for target in targets:
            adapter = self.adapters[target.provider]
            try:
                with self.session_factory() as db:
                    row = state._connection(db, target.id, lock=False)
                    state._target_active(db, row)
                    credentials = decrypt_credentials(row.credential_ciphertext or "", row.organization_id, row.id,
                        self.config.channel_connection_encryption_key, row.credential_key_version or "")
                identity = await adapter.verify(target, credentials)
                with self.session_factory() as db:
                    row = state._connection(db, target.id, lock=False)
                    lease = state.claim_installation(db, row, self.owner, ttl_seconds=60,
                        listener_scope=identity.get("listener_scope"), exclusive=bool(identity.get("exclusive")))
                    if lease is None:
                        db.commit(); continue
                    row = state.activate_connection(db, row.id, lease.id, self.owner, lease.fence, identity)
                    current = ConnectionTarget.from_row(row)
                    lease_id, fence = lease.id, lease.fence
                    db.commit()
                key = (lease_id, fence)
                active.add(key)
                handle = self.handles.get(key)
                if handle is not None and handle.task.done():
                    await self._close(key)
                    continue
                if handle is None:
                    listener = await adapter.open([current], credentials, identity)
                    async def receive(connection_id, event, lease_id=lease_id, fence=fence):
                        return await self.runtime.receive(connection_id, lease_id, self.owner, fence, event)
                    task = asyncio.create_task(listener.listen(receive))
                    handle = ListenerHandle(listener, task, lease_id, fence, [current])
                    self.handles[key] = handle
                else:
                    members = [x for x in handle.targets if x.id != current.id] + [current]
                    if members != handle.targets:
                        await handle.listener.update(members)
                        handle.targets = members
                await self.runtime.process_one(current.id, lease_id, self.owner, fence, handle.listener)
            except asyncio.CancelledError: raise
            except Exception:
                with self.session_factory() as db:
                    row = state._connection(db, target.id)
                    if row.generation == target.generation:
                        row.observed_state, row.last_error_code = "error", "CONNECTION_RUNTIME_ERROR"
                    db.commit()
                logger.warning("Connection target failed", extra={"event": "channel.connection.target_failed"})
        for key in list(self.handles):
            if key not in active: await self._close(key)
