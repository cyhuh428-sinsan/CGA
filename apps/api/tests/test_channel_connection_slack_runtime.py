"""합성 Socket Mode→실제 SQLite 원장/native 고정답변/Node packet→HTTP double."""
import asyncio
import json
from datetime import timedelta
from types import SimpleNamespace

import pytest
from test_channel_connection_state import KEY, state_db
from test_channel_connection_runtime import native_orm_bindings, seed_native
from test_channel_connection_slack import subject, Http, Ws, Socket, frame, CREDENTIALS


@pytest.fixture
def slack(state_db):
    from app.models import ChannelConnection
    from app.services.channel_connections import encrypt_credentials
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    s, db, row, lease, factory, runtime = seed_native(state_db)
    lease.lease_expires_at = s.clock(db) - timedelta(seconds=1)
    row.installation_id, row.account_id, row.target_id = 'TQA001', 'UQA001', 'CQA001'
    row.credential_ciphertext = encrypt_credentials(CREDENTIALS, row.organization_id, row.id, KEY, 'v1')
    row.credential_key_version = 'v1'; db.commit()
    config = SimpleNamespace(channel_connection_worker_enabled=True, channel_connection_encryption_key=KEY,
        channel_connection_key_version='v1')
    http, ws = Http(), Ws()
    adapter = subject().SlackAdapter(factory, owner='synthetic', http=http, socket=Socket(ws))
    worker = ConnectionSupervisor(factory, config=config, adapters={'slack':adapter})
    return db, row, factory, adapter, worker, http, ws


async def deliver(worker, ws, body):
    await ws.queue.put(json.dumps(body))
    for _ in range(200):
        if any(v.get('envelope_id') == body['envelope_id'] for v in ws.sent): return
        for handle in worker.handles.values():
            if handle.task.done(): await handle.task
        await asyncio.sleep(.01)
    raise AssertionError('durable ACK not received')


def test_socket_to_existing_native_fixed_answer_and_duplicate_envelope_once(slack):
    from app.models import ChannelConnectionDelivery, ChannelMessage, ChannelQueueEvent
    db, row, factory, adapter, worker, http, ws = slack
    async def run():
        try:
            await worker.tick(); body = frame(); await deliver(worker, ws, body)
            db.expire_all(); item = db.query(ChannelConnectionDelivery).one()
            assert item.status == 'received' and item.context_ciphertext and item.event_json == {}
            assert http.posts == []  # ACK는 native 실행보다 먼저 반환된다.
            await worker.tick()
            body['envelope_id'] = 'redelivery-envelope'; await deliver(worker, ws, body); await worker.tick()
            db.expire_all(); item = db.query(ChannelConnectionDelivery).one()
            assert item.status == 'sent' and item.room_id and item.request_message_id and item.queue_event_id
            assert item.provider_message_ids == ['752746507eff74b23697532b75b885bdfa6ef59c30240f9c166a78862cf5faa0']
            assert db.query(ChannelMessage).count() == 2 and db.query(ChannelQueueEvent).one().status == 'completed'
            assert len(http.posts) == 1 and http.posts[0]['text'] == 'fixed QA answer'
            assert http.posts[0]['channel'] == 'CQA001' and http.posts[0]['mrkdwn'] is False
        finally: await worker.stop()
    asyncio.run(run()); assert ws.closed


def test_two_targets_share_socket_remove_independently_and_reconnect(slack):
    from app.models import ChannelConnection
    from app.services.channel_connections import disconnect_connection, encrypt_credentials
    db, row, factory, adapter, worker, http, ws = slack
    other = ChannelConnection(organization_id=row.organization_id, bot_id=row.bot_id, channel_id=row.channel_id,
        name='QA2', provider='slack', installation_id='TQA001', account_id='UQA001', target_id='CQA002',
        desired_state='connected', observed_state='connecting')
    db.add(other); db.flush()
    other.credential_ciphertext = encrypt_credentials(CREDENTIALS, other.organization_id, other.id, KEY, 'v1')
    other.credential_key_version = 'v1'; db.commit()
    async def run():
        try:
            await worker.tick(); assert len(worker.handles) == 1
            assert len(next(iter(worker.handles.values())).targets) == 2
            body = frame(); body['payload']['event']['channel'] = 'CQA002'
            await deliver(worker, ws, body); await worker.tick()
            with factory() as session: disconnect_connection(session.get(ChannelConnection, row.id)); session.commit()
            await worker.tick(); assert len(next(iter(worker.handles.values())).targets) == 1
            ignored = frame(); ignored['envelope_id'] = 'off-target'; await deliver(worker, ws, ignored)
            body = frame(); body['envelope_id'] = 'still-connected'; body['payload']['event']['channel'] = 'CQA002'
            await deliver(worker, ws, body); await worker.tick(); assert len(http.posts) == 2
            fresh = Ws(); adapter.socket = Socket(fresh)
            old_task = next(iter(worker.handles.values())).task
            await ws.queue.put(json.dumps(dict(type='disconnect', reason='refresh_requested')))
            with pytest.raises(RuntimeError): await old_task
            await worker.tick(); await worker.tick()
            assert ws.closed and len(worker.handles) == 1
            body = frame(); body['envelope_id'] = 'reconnected'; body['payload']['event']['channel'] = 'CQA002'
            await deliver(worker, fresh, body); await worker.tick()
            assert len(http.posts) == 3 and all(p['channel'] == 'CQA002' for p in http.posts)
            assert sum(c[0] == 'apps.connections.open' for c in http.calls) == 2
        finally: await worker.stop()
    asyncio.run(run())


def test_unknown_post_is_not_retried_after_worker_restart(slack):
    from app.models import ChannelConnectionDelivery
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    db, row, factory, adapter, worker, http, ws = slack
    original = http.call
    def fail(method, token, payload):
        if method == 'chat.postMessage': http.posts.append(payload); raise TimeoutError('synthetic unknown')
        return original(method, token, payload)
    http.call = fail
    async def run():
        try:
            await worker.tick(); body = frame(); await deliver(worker, ws, body); await worker.tick()
            db.expire_all(); assert db.query(ChannelConnectionDelivery).one().status == 'unknown'
        finally: await worker.stop()
        next_ws = Ws(); fresh = subject().SlackAdapter(factory, owner='restart', http=http, socket=Socket(next_ws))
        restarted = ConnectionSupervisor(factory, config=worker.config, adapters={'slack':fresh})
        try:
            await restarted.tick(); await deliver(restarted, next_ws, body); await restarted.tick()
            db.expire_all(); assert db.query(ChannelConnectionDelivery).one().status == 'unknown'
            assert len(http.posts) == 1
        finally: await restarted.stop()
    asyncio.run(run())


def test_blocked_native_execution_does_not_delay_other_envelope_ack(slack, monkeypatch):
    from threading import Event
    from app.services import channel_connection_runtime as runtime
    db, row, factory, adapter, worker, http, ws = slack
    entered, release = Event(), Event(); original = runtime.run_connection_envelope
    def blocked(*args, **kwargs):
        entered.set()
        if not release.wait(4): raise TimeoutError('synthetic native timeout')
        return original(*args, **kwargs)
    monkeypatch.setattr(runtime, 'run_connection_envelope', blocked)
    async def run():
        tick = None
        try:
            await worker.tick(); await deliver(worker, ws, frame())
            tick = asyncio.create_task(worker.tick())
            for _ in range(200):
                if entered.is_set(): break
                await asyncio.sleep(.005)
            assert entered.is_set()
            other = frame(); other['envelope_id'] = 'while-native-blocked'
            await deliver(worker, ws, other)
            assert not tick.done() and http.posts == []
            release.set(); await tick
        finally:
            release.set()
            if tick: await tick
            await worker.stop()
    asyncio.run(run())


def test_registry_and_disabled_start_never_touch_db_or_http(monkeypatch):
    from app.main import connection_supervisor
    from app.services.channel_connection_supervisor import ADAPTERS, ConnectionSupervisor
    assert isinstance(ADAPTERS['slack'], subject().SlackAdapter)
    assert ADAPTERS['slack'].owner == connection_supervisor.owner
    def forbidden(*args): pytest.fail('disabled worker attempted external operation')
    monkeypatch.setattr(ADAPTERS['slack'].http, 'call', forbidden)
    worker = ConnectionSupervisor(forbidden, config=SimpleNamespace(channel_connection_worker_enabled=False,
        channel_connection_encryption_key='', channel_connection_key_version='v1'))
    async def run(): await worker.start(); assert worker.task is None; await worker.stop()
    asyncio.run(run())


@pytest.mark.parametrize('cold_start', [True, False])
def test_wrong_app_token_cannot_starve_valid_target_in_real_sequential_supervisor(slack, cold_start):
    from app.models import ChannelConnection
    from app.services.channel_connections import encrypt_credentials
    db, row, factory, adapter, worker, http, ws = slack
    wrong_credentials = {**CREDENTIALS, 'app_token':'synthetic-other-token'}
    wrong_ws = Ws('AOTHER'); original = http.call
    def call(method, token, payload):
        if method == 'apps.connections.open' and token == 'synthetic-other-token':
            return dict(ok=True, url='wss://wss.slack.com/link/?ticket=other')
        return original(method, token, payload)
    class MultiSocket:
        async def open(self, url): return wrong_ws if 'ticket=other' in url else ws
    http.call, adapter.socket = call, MultiSocket()
    async def run():
        try:
            if not cold_start: await worker.tick()
            other = ChannelConnection(organization_id=row.organization_id, bot_id=row.bot_id, channel_id=row.channel_id,
                name='QA2', provider='slack', installation_id='TQA001', account_id='UQA001', target_id='CQA002',
                desired_state='connected', observed_state='connecting')
            db.add(other); db.flush()
            bad = row if cold_start else other
            good = other if cold_start else row
            for item in (row, other):
                item.credential_ciphertext = encrypt_credentials(wrong_credentials if item is bad else CREDENTIALS,
                    item.organization_id, item.id, KEY, 'v1')
                item.credential_key_version = 'v1'
            db.commit(); await worker.tick()
            assert len(worker.handles) == 1 and not ws.closed
            handle = next(iter(worker.handles.values()))
            assert [t.id for t in handle.targets] == [good.id]
            db.refresh(bad); assert bad.observed_state == 'error'
            if cold_start: assert wrong_ws.closed
            body = frame(); body['payload']['event']['channel'] = good.target_id
            await deliver(worker, ws, body); await worker.tick()
            assert len(http.posts) == 1 and http.posts[0]['channel'] == good.target_id
        finally: await worker.stop()
    asyncio.run(run())
