"""합성 HTTP/WS 경계로 Slack 인증·ACK·목적지 검증을 실행한다."""
import asyncio
import json
from dataclasses import replace
from importlib import import_module
from uuid import uuid4

import pytest
from fastapi import HTTPException
from app.services.channel_connection_runtime import ConnectionTarget


def subject(): return import_module('app.services.channel_connection_slack')


def target(**changes):
    return ConnectionTarget(**{**dict(id=uuid4(), organization_id=uuid4(), bot_id=uuid4(),
        provider='slack', installation_id='TQA001', account_id='UQA001', target_id='CQA001', generation=1), **changes})


CREDENTIALS = dict(bot_token='synthetic-bot-token', app_token='synthetic-app-token')


class Http:
    def __init__(self):
        self.calls, self.posts = [], []
        self.responses = {
            'auth.test': dict(ok=True, team_id='TQA001', user_id='UQA001', bot_id='BQA001'),
            'bots.info': dict(ok=True, bot=dict(id='BQA001', app_id='AQA001', user_id='UQA001', deleted=False)),
            'apps.connections.open': dict(ok=True, url='wss://wss.slack.com/link/?ticket=synthetic-only')}
    def call(self, method, token, payload):
        self.calls.append((method, token, payload))
        if method == 'conversations.info':
            return dict(ok=True, channel=dict(id=payload['channel'], is_member=True, is_archived=False))
        if method == 'chat.postMessage':
            self.posts.append(payload)
            return dict(ok=True, channel=payload['channel'], ts='1700000001.000001')
        return self.responses[method]


class Ws:
    def __init__(self, app='AQA001'):
        self.queue, self.sent, self.closed = asyncio.Queue(), [], False
        self.queue.put_nowait(json.dumps(dict(type='hello', connection_info=dict(app_id=app))))
    async def recv(self): return await self.queue.get()
    async def send(self, raw): self.sent.append(json.loads(raw))
    async def close(self): self.closed = True


class Socket:
    def __init__(self, ws): self.ws, self.urls = ws, []
    async def open(self, url): self.urls.append(url); return self.ws


def frame():
    import time
    return dict(type='events_api', envelope_id='envelope-1', payload=dict(type='event_callback',
        api_app_id='AQA001', team_id='TQA001', event_id='EvQA001', event=dict(type='message',
        channel='CQA001', user='UQA002', text='<@UQA001> question', ts=f'{time.time():.6f}')))


async def listener(ws=None):
    http, socket = Http(), Socket(ws or Ws())
    adapter = subject().SlackAdapter(None, owner='slack-test', http=http, socket=socket)
    spec = target(); identity = await adapter.verify(spec, CREDENTIALS)
    return await adapter.open([spec], CREDENTIALS, identity), adapter, http, socket, spec


def test_verify_binds_identity_without_opening_socket_or_exposing_credentials():
    async def run():
        adapter = subject().SlackAdapter(None, owner='slack-test', http=Http())
        identity = await adapter.verify(target(), CREDENTIALS)
        assert identity == dict(installation_id='TQA001', account_id='UQA001', listener_scope='slack-app:AQA001',
            exclusive=True, app_id='AQA001', bot_id='BQA001')
        assert [c[0] for c in adapter.http.calls] == ['auth.test', 'bots.info', 'conversations.info']
        assert 'synthetic-' not in repr(identity) + repr(adapter)
    asyncio.run(run())


@pytest.mark.parametrize('method,field,value', [
    ('auth.test', 'team_id', 'TOTHER'), ('auth.test', 'user_id', 'UOTHER'), ('auth.test', 'bot_id', None),
    ('bots.info', 'bot', dict(id='BOTHER', app_id='AQA001', user_id='UQA001')),
    ('bots.info', 'bot', dict(id='BQA001', app_id='AQA001', user_id='UOTHER')),
    ('bots.info', 'bot', dict(id='BQA001', app_id='AQA001', user_id='UQA001', deleted=True))])
def test_mismatched_identity_never_verifies(method, field, value):
    async def run():
        http = Http(); http.responses[method][field] = value
        with pytest.raises(HTTPException):
            await subject().SlackAdapter(None, owner='test', http=http).verify(target(), CREDENTIALS)
    asyncio.run(run())


@pytest.mark.parametrize('info', [dict(id='COTHER', is_member=True), dict(id='CQA001', is_member=False),
    dict(id='CQA001', is_member=True, is_archived=True)])
def test_channel_access_is_required(info):
    async def run():
        http = Http(); original = http.call
        http.call = lambda method, token, payload: dict(ok=True, channel=info) if method == 'conversations.info' else original(method, token, payload)
        with pytest.raises(HTTPException): await subject().SlackAdapter(None, owner='test', http=http).verify(target(), CREDENTIALS)
    asyncio.run(run())


def test_http_fixed_methods_get_and_secret_free_query():
    calls = []
    def post(url, headers, body): calls.append((url, headers, body)); return dict(ok=True)
    http = subject().SlackHttpTransport(post=post)
    http.call('auth.test', 'synthetic-only', {})
    http.call('bots.info', 'synthetic-only', dict(bot='BQA001'))
    assert calls[0] == ('https://slack.com/api/auth.test', {'Authorization':'Bearer synthetic-only',
        'Content-Type':'application/json', 'Accept':'application/json'}, b'{}')
    assert calls[1][0] == 'https://slack.com/api/bots.info?bot=BQA001' and calls[1][2] is None
    for method, token in [('https://invalid.test', 'synthetic-only'), ('auth.test', 'bad token')]:
        with pytest.raises(HTTPException): http.call(method, token, {})
    assert len(calls) == 2


@pytest.mark.parametrize('url', ['ws://wss.slack.com/link/?ticket=test', 'wss://invalid.test/link/?ticket=test',
    'wss://wss.slack.com:8443/link/?ticket=test', 'wss://wss.slack.com/other?ticket=test',
    'wss://wss.slack.com/link/', 'wss://wss.slack.com/link/?ticket=test#fragment',
    'wss://wss.slack.com/link/?ticket=a&ticket=b', 'wss://wss.slack.com/link/?ticket='])
def test_socket_destination_rejected_before_ticket_submission(url):
    with pytest.raises(HTTPException): subject().validate_socket_url(url)


def test_socket_hello_must_match_app_and_failed_open_backs_off():
    async def run():
        ws = Ws('AOTHER'); http = Http(); sock = Socket(ws)
        adapter = subject().SlackAdapter(None, owner='test', http=http, socket=sock)
        spec = target(); identity = await adapter.verify(spec, CREDENTIALS)
        with pytest.raises(HTTPException): await adapter.open([spec], CREDENTIALS, identity)
        assert ws.closed
        with pytest.raises(HTTPException) as error: await adapter.open([spec], CREDENTIALS, identity)
        assert error.value.detail == 'SLACK_SOCKET_RECONNECT_DELAY' and len(sock.urls) == 1
    asyncio.run(run())


def test_ack_waits_only_for_durable_receipt_not_bot_execution():
    async def run():
        live, adapter, http, sock, spec = await listener(); entered, release = asyncio.Event(), asyncio.Event()
        seen = []
        async def receive(cid, event):
            seen.append((cid, event)); entered.set(); await release.wait(); return uuid4()
        task = asyncio.create_task(live.handle(frame(), receive, source=live.ws, revision=live.revision))
        try:
            await asyncio.wait_for(entered.wait(), 2)
            assert sock.ws.sent == [] and http.posts == []
            release.set(); await task
            assert sock.ws.sent == [dict(envelope_id='envelope-1')]
            assert seen[0][0] == spec.id and seen[0][1]['message'] == 'question'
            assert seen[0][1]['destination']['channelId'] == 'CQA001'
        finally: task.cancel(); await live.close()
    asyncio.run(run())


@pytest.mark.parametrize('failure', ['raise', 'none', 'bridge'])
def test_failed_or_unconfirmed_commit_is_not_acked(monkeypatch, failure):
    async def run():
        live, adapter, http, sock, spec = await listener()
        async def receive(cid, event):
            if failure == 'raise': raise RuntimeError('synthetic commit unknown')
            return None
        def broken(*args): raise HTTPException(503, 'CHANNEL_PACKET_RUNTIME_UNAVAILABLE')
        if failure == 'bridge': monkeypatch.setattr(subject(), 'convert_packet', broken)
        try:
            with pytest.raises((RuntimeError, HTTPException)): await live.handle(frame(), receive, source=live.ws, revision=live.revision)
            assert sock.ws.sent == []
        finally: await live.close()
    asyncio.run(run())


def test_self_and_other_targets_are_ignored_but_normal_chat_is_normalized():
    async def run():
        live, adapter, http, sock, spec = await listener(); seen = []
        async def receive(cid, event): seen.append(event); return uuid4()
        try:
            body = frame(); body['payload']['event']['user'] = 'UQA001'; await live.handle(body, receive, source=live.ws, revision=live.revision)
            body = frame(); body['payload']['event']['channel'] = 'COTHER'; await live.handle(body, receive, source=live.ws, revision=live.revision)
            assert not seen and len(sock.ws.sent) == 2
            body = frame(); body['payload']['event']['text'] = '일반 대화'; await live.handle(body, receive, source=live.ws, revision=live.revision)
            assert len(seen) == 1 and seen[0]['addressed'] is False
            body = frame(); body['payload']['api_app_id'] = 'AOTHER'
            with pytest.raises(HTTPException): await live.handle(body, receive, source=live.ws, revision=live.revision)
            assert len(sock.ws.sent) == 3
        finally: await live.close()
    asyncio.run(run())


def test_binding_update_rejects_unverified_generation_and_different_token_without_dropping_live_target():
    async def run():
        live, adapter, http, sock, spec = await listener()
        try:
            for bad in [replace(spec, generation=2), replace(spec, target_id='COTHER')]:
                with pytest.raises(HTTPException): await live.update([bad])
                assert live.targets == {spec.id: spec}
            other = replace(spec, id=uuid4(), target_id='CQA002')
            await adapter.verify(other, {**CREDENTIALS, 'app_token':'synthetic-other-token'})
            with pytest.raises(HTTPException): await live.update([spec, other])
            assert live.targets == {spec.id: spec} and not sock.ws.closed
        finally: await live.close()
    asyncio.run(run())


def test_disconnect_requires_new_socket_and_close_blocks_send():
    async def run():
        live, adapter, http, sock, spec = await listener()
        await sock.ws.queue.put(json.dumps(dict(type='disconnect', reason='refresh_requested')))
        with pytest.raises(RuntimeError, match='REFRESH_REQUIRED'): await live.listen(None)
        await live.close(); assert sock.ws.closed
        fresh = Ws(); adapter.socket = Socket(fresh)
        identity = await adapter.verify(spec, CREDENTIALS)
        again = await adapter.open([spec], CREDENTIALS, identity)
        assert again is not live and not fresh.closed
        await again.close()
        with pytest.raises(HTTPException): await again.send(spec, [], {})
        assert http.posts == []
    asyncio.run(run())


def test_native_transport_disables_redirects_proxy_and_sensitive_logging(monkeypatch):
    async def run():
        import websockets.asyncio.client as client
        from websockets.exceptions import SecurityError
        calls = []; ws = Ws()
        class Connect:
            def __init__(self, url, **options): calls.append((url, options, self))
            def __await__(self):
                async def result(): return ws
                return result().__await__()
        monkeypatch.setattr(client, 'connect', Connect)
        assert await subject().SlackSocketTransport().open('wss://wss-primary.slack.com/link/?ticket=synthetic-only') is ws
        url, options, transport = calls[0]
        assert options['proxy'] is None and options['max_size'] == 262144 and options['max_queue'] == 8
        assert options['logger'].disabled and not options['logger'].propagate
        assert options['open_timeout'] == 5 and options['close_timeout'] == 2 and options['compression'] is None
        assert isinstance(transport.process_redirect(ValueError()), SecurityError)
        assert subject()._NoRedirect().redirect_request(None, None, 302, '', {}, 'https://invalid.test') is None
    asyncio.run(run())


def test_invalid_app_token_does_not_backoff_other_valid_target_of_same_app():
    async def run():
        http = Http(); valid, wrong = Ws(), Ws('AOTHER')
        class MultiSocket:
            async def open(self, url): return wrong if 'ticket=other' in url else valid
        original = http.call
        def call(method, token, payload):
            if method == 'apps.connections.open' and token == 'synthetic-other-token':
                return dict(ok=True, url='wss://wss.slack.com/link/?ticket=other')
            return original(method, token, payload)
        http.call = call
        adapter = subject().SlackAdapter(None, owner='test', http=http, socket=MultiSocket())
        bad, good = target(), target(target_id='CQA002')
        other_credentials = {**CREDENTIALS, 'app_token':'synthetic-other-token'}
        bad_identity = await adapter.verify(bad, other_credentials)
        with pytest.raises(HTTPException): await adapter.open([bad], other_credentials, bad_identity)
        good_identity = await adapter.verify(good, CREDENTIALS)
        live = await adapter.open([good], CREDENTIALS, good_identity)
        try: assert wrong.closed and not valid.closed and live.targets == {good.id:good}
        finally: await live.close()
    asyncio.run(run())


@pytest.mark.parametrize('change', ['channel', 'thread', 'generation', 'packet-channel', 'unsafe-parse', 'receipt'])
def test_send_rejects_cross_target_stale_or_unsafe_packet(change):
    from app.services.channel_connection_bridge import convert_packet
    async def run():
        live, adapter, http, sock, spec = await listener(); seen = []
        async def receive(cid, event): seen.append(event); return uuid4()
        try:
            body = frame(); body['payload']['event']['thread_ts'] = '1700000000.000001'
            await live.handle(body, receive, source=live.ws, revision=live.revision); event = seen[0]
            packets = convert_packet('slack', 'replies', dict(messages=[dict(text='safe <text>')], destination=event['destination']))
            if change == 'channel': event['destination']['channelId'] = 'COTHER'
            if change == 'thread': event['destination']['threadTs'] = '1700000000.000002'
            if change == 'generation': event['destination']['generation'] = 2
            if change == 'packet-channel': packets[0]['channel'] = 'COTHER'
            if change == 'unsafe-parse': packets[0]['parse'] = 'full'
            if change == 'receipt':
                original = http.call
                http.call = lambda method, token, payload: dict(ok=True, channel='COTHER', ts='1700000001.000001') if method == 'chat.postMessage' else original(method, token, payload)
            with pytest.raises((HTTPException, RuntimeError)): await live.send(spec, packets, event)
            assert http.posts == []
        finally: await live.close()
    asyncio.run(run())


def test_reply_uses_verified_token_exact_thread_and_safe_native_packet_without_db():
    from app.services.channel_connection_bridge import convert_packet
    async def run():
        live, adapter, http, sock, spec = await listener(); seen = []
        async def receive(cid, event): seen.append(event); return uuid4()
        try:
            body = frame(); body['payload']['event']['thread_ts'] = '1700000000.000001'
            await live.handle(body, receive, source=live.ws, revision=live.revision); event = seen[0]
            packets = convert_packet('slack', 'replies', dict(messages=[dict(text='safe <text>')], destination=event['destination']))
            assert await live.send(spec, packets, event) == ['CQA001:1700000001.000001']
            assert http.posts == [dict(channel='CQA001', text='safe &lt;text&gt;', thread_ts='1700000000.000001',
                mrkdwn=False, parse='none', unfurl_links=False, unfurl_media=False)]
            assert http.calls[-1][1] == 'synthetic-bot-token'
        finally: await live.close()
    asyncio.run(run())


class TrackingWs(Ws):
    def __init__(self):
        super().__init__()
        self.waiting, self.recv_started = 0, asyncio.Event()
        self.close_started, self.close_release = asyncio.Event(), asyncio.Event()
        self.close_release.set()
    async def recv(self):
        if not self.queue.empty(): return await super().recv()
        self.waiting += 1; self.recv_started.set()
        try: return await super().recv()
        finally: self.waiting -= 1
    async def close(self):
        self.close_started.set(); await self.close_release.wait(); await super().close()


async def rotated(live, adapter, spec, fresh):
    changed = replace(spec, generation=spec.generation + 1)
    await adapter.verify(changed, {**CREDENTIALS, 'app_token':'synthetic-rotated-app-token'})
    adapter.socket = Socket(fresh)
    return changed


def test_socket_rotation_wakes_old_recv_and_close_joins_all_listener_waiters():
    async def run():
        old, fresh = TrackingWs(), TrackingWs()
        live, adapter, http, sock, spec = await listener(old)
        running = asyncio.create_task(live.listen(None))
        try:
            await asyncio.wait_for(old.recv_started.wait(), 1)
            changed = await rotated(live, adapter, spec, fresh)
            await live.update([changed])
            await asyncio.wait_for(fresh.recv_started.wait(), 1)
            assert old.closed and old.waiting == 0 and fresh.waiting == 1
            await live.close(); await asyncio.wait_for(running, 1)
            assert fresh.closed and fresh.waiting == 0
        finally:
            running.cancel(); await asyncio.gather(running, return_exceptions=True)
            await live.close()
    asyncio.run(run())


@pytest.mark.parametrize('phase', ['hello', 'retire'])
def test_cancelled_rotation_closes_only_owned_candidate_or_retired_socket(phase):
    async def run():
        old, fresh = TrackingWs(), TrackingWs()
        live, adapter, http, sock, spec = await listener(old)
        changed = await rotated(live, adapter, spec, fresh)
        if phase == 'hello': fresh.queue.get_nowait()
        else: old.close_release.clear()
        updating = asyncio.create_task(live.update([changed]))
        try:
            await asyncio.wait_for((fresh.recv_started if phase == 'hello' else old.close_started).wait(), 1)
            updating.cancel(); old.close_release.set()
            with pytest.raises(asyncio.CancelledError): await updating
            if phase == 'hello':
                assert fresh.closed and fresh.waiting == 0 and not old.closed and live.ws is old
                with pytest.raises(HTTPException): await live.send(spec, [], {})
            else:
                assert old.closed and live.ws is fresh and not fresh.closed
        finally:
            old.close_release.set()
            if not updating.done(): updating.cancel()
            await asyncio.gather(updating, return_exceptions=True)
            await live.close()
        assert old.closed and fresh.closed
    asyncio.run(run())


def test_close_during_replacement_hello_closes_both_sockets():
    async def run():
        old, fresh = TrackingWs(), TrackingWs()
        live, adapter, http, sock, spec = await listener(old)
        changed = await rotated(live, adapter, spec, fresh); fresh.queue.get_nowait()
        updating = asyncio.create_task(live.update([changed]))
        try:
            await asyncio.wait_for(fresh.recv_started.wait(), 1)
            await live.close()
            fresh.queue.put_nowait(json.dumps(dict(type='hello', connection_info=dict(app_id='AQA001'))))
            with pytest.raises(HTTPException): await updating
            assert old.closed and fresh.closed and fresh.waiting == 0
        finally:
            updating.cancel(); await asyncio.gather(updating, return_exceptions=True)
            await live.close()
    asyncio.run(run())


def test_identical_reverify_update_does_not_discard_already_received_frame(monkeypatch):
    async def run():
        live, adapter, http, sock, spec = await listener()
        paused, release, committed = asyncio.Event(), asyncio.Event(), asyncio.Event()
        original = live.handle
        async def scheduled(value, receive, **source):
            paused.set(); await release.wait(); return await original(value, receive, **source)
        monkeypatch.setattr(live, 'handle', scheduled)
        async def receive(cid, event): committed.set(); return uuid4()
        running = asyncio.create_task(live.listen(receive))
        try:
            await sock.ws.queue.put(json.dumps(frame()))
            await asyncio.wait_for(paused.wait(), 1)
            await adapter.verify(spec, CREDENTIALS); await live.update([spec])
            release.set(); await asyncio.wait_for(committed.wait(), 1)
            for _ in range(100):
                if sock.ws.sent: break
                await asyncio.sleep(.005)
            assert sock.ws.sent == [dict(envelope_id='envelope-1')]
        finally:
            release.set(); running.cancel(); await asyncio.gather(running, return_exceptions=True)
            await live.close()
    asyncio.run(run())
