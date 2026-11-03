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


@pytest.fixture
def slack_management(slack, monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.deps import get_current_user, get_db
    from app.api.routes.channel_connections import router
    from app.core.config import settings
    from app.models import Bot, User, Role, UserRole, ChannelConnection
    from app.services.channel_connection_supervisor import ADAPTERS
    from app.services.channel_connections import encrypt_credentials
    db, row, factory, adapter, worker, http, ws = slack
    user = User(organization_id=row.organization_id, group_id=db.get(Bot, row.bot_id).group_id,
        name='QA', login_id='slack-management', password_hash='synthetic', status='active')
    role = Role(code='system_manager', name='QA')
    db.add_all([user, role]); db.flush(); db.add(UserRole(user_id=user.id, role_id=role.id))
    other = ChannelConnection(organization_id=row.organization_id, bot_id=row.bot_id, channel_id=row.channel_id,
        name='QA2', provider='slack', installation_id='TQA001', account_id='UQA001', target_id='CQA002',
        desired_state='connected', observed_state='connecting')
    db.add(other); db.flush()
    other.credential_ciphertext = encrypt_credentials(CREDENTIALS, other.organization_id, other.id, KEY, 'v1')
    other.credential_key_version = 'v1'; db.commit()
    app = FastAPI(); app.include_router(router, prefix='/api/v1')
    def session():
        with factory() as current: yield current
    app.dependency_overrides[get_db] = session
    app.dependency_overrides[get_current_user] = lambda: user
    monkeypatch.setattr(settings, 'channel_connection_encryption_key', KEY)
    monkeypatch.setattr(settings, 'channel_connection_worker_enabled', True)
    monkeypatch.setitem(ADAPTERS, 'slack', adapter)
    with TestClient(app) as client:
        yield client, f'/api/v1/admin/channels/{row.channel_id}/connections/{row.id}', other


def rotate_through_management(client, url, row, app_token):
    disconnected = client.post(url + '/disconnect')
    assert disconnected.status_code == 200, disconnected.text
    assert disconnected.json()['data']['observed_state'] == 'disconnected'
    updated = client.patch(url, json=dict(name='Rotated', bot_id=str(row.bot_id), installation_id=row.installation_id,
        account_id=row.account_id, target_id=row.target_id, credentials=dict(bot_token=CREDENTIALS['bot_token'], app_token=app_token)))
    assert updated.status_code == 200, updated.text
    connected = client.post(url + '/connect')
    assert connected.status_code == 200, connected.text
    return connected.json()['data']['generation']


@pytest.mark.parametrize('rotate_token', [True, False])
def test_management_rotation_recovers_without_inbound_event_and_preserves_other_target(slack, slack_management, rotate_token):
    db, row, factory, adapter, worker, http, old_ws = slack
    client, url, other = slack_management
    fresh = Ws()
    async def run():
        try:
            await worker.tick(); handle = next(iter(worker.handles.values()))
            old_task = handle.task
            token = 'synthetic-rotated-app-token' if rotate_token else CREDENTIALS['app_token']
            generation = rotate_through_management(client, url, row, token)
            assert old_ws.sent == []  # 3개 관리 요청 사이에 worker tick/수신 이벤트 없음.
            adapter.socket = Socket(fresh)
            for _ in range(3): await worker.tick()
            db.refresh(row); db.refresh(other)
            assert row.observed_state == 'connected' and row.generation == generation
            live = next(iter(worker.handles.values()))
            assert live.task is old_task and not old_task.done()
            assert other.observed_state == 'connected' and len(live.targets) == 2
            if rotate_token:
                assert old_ws.closed and live.listener.ws is fresh
                assert [c[1] for c in http.calls if c[0] == 'apps.connections.open'] == [CREDENTIALS['app_token'], token]
            active_ws = fresh if rotate_token else old_ws
            await deliver(worker, active_ws, frame()); await worker.tick()
            body = frame(); body['envelope_id'] = 'unrelated-still-live'; body['payload']['event']['channel'] = 'CQA002'
            await deliver(worker, active_ws, body); await worker.tick()
            assert [p['channel'] for p in http.posts] == ['CQA001', 'CQA002']
        finally: await worker.stop()
        assert old_ws.closed and (fresh.closed if rotate_token else True)
    asyncio.run(run())


def test_failed_rotation_hello_keeps_unrelated_target_but_never_executes_rotated_target(slack, slack_management):
    from fastapi import HTTPException
    from app.services.channel_connection_runtime import ConnectionTarget
    db, row, factory, adapter, worker, http, old_ws = slack
    client, url, other = slack_management
    fresh = Ws('AOTHER')
    async def run():
        try:
            await worker.tick(); handle = next(iter(worker.handles.values()))
            old_target = next(t for t in handle.targets if t.id == row.id)
            rotate_through_management(client, url, row, 'synthetic-rotated-app-token')
            adapter.socket = Socket(fresh); await worker.tick()
            db.refresh(row); db.refresh(other)
            assert fresh.closed and not old_ws.closed
            assert row.observed_state == 'error' and other.observed_state == 'connected'
            for changed in (old_target, ConnectionTarget.from_row(row)):
                with pytest.raises(HTTPException): await handle.listener.send(changed, [], {})
            stale = frame(); stale['envelope_id'] = 'invalid-rotated-target'
            await old_ws.queue.put(json.dumps(stale))
            good = frame(); good['envelope_id'] = 'normal-after-failed-rotation'; good['payload']['event']['channel'] = 'CQA002'
            await deliver(worker, old_ws, good); await worker.tick()
            assert not any(v['envelope_id'] == 'invalid-rotated-target' for v in old_ws.sent)
            assert [p['channel'] for p in http.posts] == ['CQA002']
        finally: await worker.stop()
    asyncio.run(run())


@pytest.mark.parametrize('rotate_token', [True, False])
def test_frame_received_before_rotation_but_handled_after_is_not_accepted_or_acked(slack, slack_management, monkeypatch, rotate_token):
    from app.models import ChannelConnectionDelivery, ChannelMessage, ChannelQueueEvent
    db, row, factory, adapter, worker, http, old_ws = slack
    client, url, other = slack_management
    fresh = Ws()
    async def run():
        paused, release, completed = asyncio.Event(), asyncio.Event(), asyncio.Event()
        try:
            await worker.tick(); live = next(iter(worker.handles.values())).listener
            original = live.handle
            async def scheduled(value, receive, **source):
                # 실제 recv 완료/검사 뒤 wait_for가 예약한 handler의 첫 실행 직전에 정지한다.
                paused.set(); await release.wait()
                try: return await original(value, receive, **source)
                finally: completed.set()
            monkeypatch.setattr(live, 'handle', scheduled)
            old_frame = frame(); old_frame['envelope_id'] = 'old-frame-across-rotation'
            await old_ws.queue.put(json.dumps(old_frame))
            await asyncio.wait_for(paused.wait(), 1)
            token = 'synthetic-rotated-app-token' if rotate_token else CREDENTIALS['app_token']
            rotate_through_management(client, url, row, token)
            adapter.socket = Socket(fresh); await worker.tick()
            if rotate_token: assert old_ws.closed and live.ws is fresh
            else: assert not old_ws.closed and live.ws is old_ws
            release.set(); await asyncio.wait_for(completed.wait(), 1)
            await worker.tick()
            db.expire_all()
            assert db.query(ChannelConnectionDelivery).count() == 0
            assert db.query(ChannelMessage).count() == 0 and db.query(ChannelQueueEvent).count() == 0
            assert old_ws.sent == [] and fresh.sent == [] and http.posts == []
            assert not next(iter(worker.handles.values())).task.done()
            monkeypatch.setattr(live, 'handle', original)
            valid = frame(); valid['envelope_id'] = 'new-frame-after-rotation'
            await deliver(worker, live.ws, valid); await worker.tick()
            assert [v['envelope_id'] for v in live.ws.sent] == ['new-frame-after-rotation']
            assert len(http.posts) == 1
        finally: release.set(); await worker.stop()
    asyncio.run(run())


def test_old_socket_frame_for_unchanged_target_is_rejected_after_normalization_crosses_rotation(slack, slack_management, monkeypatch):
    from threading import Event
    from app.models import ChannelConnectionDelivery, ChannelMessage
    db, row, factory, adapter, worker, http, old_ws = slack
    client, url, other = slack_management
    entered, release = Event(), Event(); fresh = Ws()
    original = subject().convert_packet
    def blocked(provider, direction, payload):
        entered.set()
        if not release.wait(3): raise TimeoutError('synthetic normalization barrier')
        return original(provider, direction, payload)
    monkeypatch.setattr(subject(), 'convert_packet', blocked)
    async def run():
        completed = asyncio.Event()
        try:
            await worker.tick()
            live = next(iter(worker.handles.values())).listener
            original_handle = live.handle
            async def observed(value, receive, **source):
                try: return await original_handle(value, receive, **source)
                finally: completed.set()
            monkeypatch.setattr(live, 'handle', observed)
            body = frame(); body['envelope_id'] = 'old-socket-unchanged-target'; body['payload']['event']['channel'] = 'CQA002'
            await old_ws.queue.put(json.dumps(body))
            for _ in range(100):
                if entered.is_set(): break
                await asyncio.sleep(.005)
            assert entered.is_set()
            rotate_through_management(client, url, row, 'synthetic-rotated-app-token')
            adapter.socket = Socket(fresh); await worker.tick(); release.set()
            await asyncio.wait_for(completed.wait(), 1)
            await worker.tick(); db.expire_all()
            assert db.query(ChannelConnectionDelivery).count() == 0 and db.query(ChannelMessage).count() == 0
            assert old_ws.sent == [] and fresh.sent == [] and http.posts == []
        finally: release.set(); await worker.stop()
    asyncio.run(run())


@pytest.mark.parametrize('future_clock', [False, True])
def test_generation_rotation_after_provider_guard_before_real_common_receive(slack, slack_management, monkeypatch, future_clock):
    import time
    from app.models import ChannelConnectionDelivery, ChannelMessage
    db, row, factory, adapter, worker, http, old_ws = slack
    client, url, other = slack_management
    async def run():
        paused, release, completed = asyncio.Event(), asyncio.Event(), asyncio.Event()
        original = worker.runtime.receive
        async def guarded(*args):
            # provider 최종 guard 통과 뒤, 실제 common receive/to_thread 시작 직전 경계.
            paused.set(); await release.wait()
            try: return await original(*args)
            finally: completed.set()
        monkeypatch.setattr(worker.runtime, 'receive', guarded)
        try:
            await worker.tick()
            body = frame()
            if future_clock: body['payload']['event']['ts'] = f'{time.time() + 30:.6f}'
            await old_ws.queue.put(json.dumps(body)); await asyncio.wait_for(paused.wait(), 1)
            rotate_through_management(client, url, row, 'synthetic-rotated-app-token')
            adapter.socket = Socket(Ws()); await worker.tick()
            release.set(); await asyncio.wait_for(completed.wait(), 1); await worker.tick()
            db.expire_all()
            found = [(v.status, v.generation, v.last_error_code) for v in db.query(ChannelConnectionDelivery)]
            assert found == [], dict(deliveries=found, native_messages=db.query(ChannelMessage).count())
            assert db.query(ChannelMessage).count() == 0 and http.posts == []
        finally: release.set(); await worker.stop()
    asyncio.run(run())
