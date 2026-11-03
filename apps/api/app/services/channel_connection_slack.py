"""Slack Socket Mode. 원장 접수 ACK와 봇 실행은 공통 runtime에서 분리한다."""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from fastapi import HTTPException
from app.services.channel_connection_bridge import convert_packet
from app.services.channel_connection_runtime import ConnectionTarget

METHODS = frozenset({'auth.test', 'bots.info', 'conversations.info', 'apps.connections.open', 'chat.postMessage'})
SOCKET_HOSTS = frozenset({'wss.slack.com', 'wss-primary.slack.com'})


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl): return None


class SlackApiRejected(Exception):
    """서버가 명시적으로 거부했다. 원문은 로그·원장에 보관하지 않는다."""


def _post(url, headers, body):
    try:
        request = Request(url, data=body, headers=headers, method='GET' if body is None else 'POST')
        with build_opener(_NoRedirect()).open(request, timeout=5) as response:
            raw = response.read(1048577)
            if not 200 <= response.status < 300 or len(raw) > 1048576: raise ValueError()
            value = json.loads(raw)
            if not isinstance(value, dict): raise ValueError()
            return value
    except Exception: raise HTTPException(503, 'SLACK_TRANSPORT_FAILED') from None


class SlackHttpTransport:
    def __init__(self, *, post=_post): self.post = post

    def call(self, method, token, payload):
        if method not in METHODS or not _token(token) or not isinstance(payload, dict):
            raise HTTPException(422, 'SLACK_CONFIGURATION_INVALID')
        raw = json.dumps(payload, ensure_ascii=False).encode()
        if len(raw) > 1000000: raise HTTPException(422, 'SLACK_PACKET_LIMIT')
        url = 'https://slack.com/api/' + method
        if method in {'bots.info', 'conversations.info'}:
            url += '?' + urlencode(payload); raw = None
        value = self.post(url, {'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json', 'Accept': 'application/json'}, raw)
        if not isinstance(value, dict): raise HTTPException(503, 'SLACK_TRANSPORT_FAILED')
        if value.get('ok') is not True:
            if value.get('error') in {'invalid_auth', 'token_revoked', 'token_expired', 'account_inactive',
                'channel_not_found', 'not_in_channel', 'is_archived', 'missing_scope', 'not_authed',
                'no_permission', 'not_allowed_token_type', 'invalid_arguments', 'msg_too_long', 'invalid_blocks'}:
                raise SlackApiRejected() from None
            raise HTTPException(503, 'SLACK_TRANSPORT_FAILED')
        return value


def _token(value):
    return isinstance(value, str) and 0 < len(value) <= 24000 and not any(c.isspace() for c in value)


def _id(value, prefix):
    if not isinstance(value, str) or not re.fullmatch('[' + prefix + '][A-Z0-9]{2,63}', value):
        raise HTTPException(422, 'SLACK_IDENTITY_INVALID')
    return value


def validate_socket_url(value):
    try:
        if not isinstance(value, str) or len(value) > 4096 or any(c.isspace() for c in value) or '\\' in value:
            raise ValueError()
        parsed = urlsplit(value); query = parse_qs(parsed.query, strict_parsing=True)
        if (parsed.scheme != 'wss' or parsed.hostname not in SOCKET_HOSTS or parsed.port not in {None, 443}
            or parsed.username is not None or parsed.password is not None or parsed.path != '/link/'
            or parsed.fragment or len(query.get('ticket', [])) != 1 or not query['ticket'][0]):
            raise ValueError()
        return value
    except (ValueError, TypeError): raise HTTPException(403, 'SLACK_SOCKET_DESTINATION_UNTRUSTED') from None


def _frame(raw):
    try:
        if not isinstance(raw, (str, bytes)) or len(raw.encode() if isinstance(raw, str) else raw) > 262144:
            raise ValueError()
        value = json.loads(raw)
        if not isinstance(value, dict): raise ValueError()
        return value
    except (ValueError, TypeError, UnicodeError): raise HTTPException(422, 'SLACK_ENVELOPE_INVALID') from None


class SlackSocketTransport:
    async def open(self, url):
        from websockets.asyncio.client import connect
        from websockets.exceptions import SecurityError
        class StrictConnect(connect):
            def process_redirect(self, error): return SecurityError('SLACK_SOCKET_REDIRECT_FORBIDDEN')
        logger = logging.getLogger('cga.private.slack.websocket')
        logger.disabled = True; logger.propagate = False
        try:
            return await StrictConnect(validate_socket_url(url), proxy=None, open_timeout=5, ping_interval=20,
                ping_timeout=10, close_timeout=2, max_size=262144, max_queue=8, compression=None, logger=logger)
        except Exception: raise HTTPException(503, 'SLACK_SOCKET_UNAVAILABLE') from None


@dataclass(frozen=True)
class SlackBinding:
    target: ConnectionTarget
    credentials: dict = field(repr=False)
    app_id: str
    bot_id: str
    app_token_digest: str = field(repr=False)


class SlackAdapter:
    def __init__(self, sessions, *, owner, http=None, socket=None):
        self.owner = owner
        self.http, self.socket = http or SlackHttpTransport(), socket or SlackSocketTransport()
        self.bindings, self.open_not_before = {}, {}

    async def verify(self, target, credentials):
        try:
            bot_token, app_token = credentials.get('bot_token'), credentials.get('app_token')
            if target.provider != 'slack' or not _token(bot_token) or not _token(app_token): raise ValueError()
            identity = await asyncio.to_thread(self.http.call, 'auth.test', bot_token, {})
            team = _id(identity.get('team_id'), 'T'); user = _id(identity.get('user_id'), 'UW')
            bot = _id(identity.get('bot_id'), 'B')
            if (team, user) != (target.installation_id, target.account_id): raise ValueError()
            info = (await asyncio.to_thread(self.http.call, 'bots.info', bot_token, {'bot': bot})).get('bot')
            if (not isinstance(info, dict) or info.get('id') != bot or info.get('user_id') != user
                or info.get('deleted', False) is not False): raise ValueError()
            app = _id(info.get('app_id'), 'A')
            channel = (await asyncio.to_thread(self.http.call, 'conversations.info', bot_token,
                {'channel': _id(target.target_id, 'CGD')})).get('channel')
            if (not isinstance(channel, dict) or channel.get('id') != target.target_id
                or channel.get('is_archived', False) is not False
                or not (channel.get('is_member') is True or channel.get('is_im') is True and target.target_id.startswith('D'))):
                raise ValueError()
            self.bindings[target.id] = SlackBinding(target, dict(credentials), app, bot, hashlib.sha256(app_token.encode()).hexdigest())
            return dict(installation_id=team, account_id=user, listener_scope='slack-app:' + app,
                exclusive=True, app_id=app, bot_id=bot)
        except (ValueError, TypeError, KeyError, SlackApiRejected):
            raise HTTPException(403, 'SLACK_IDENTITY_VERIFICATION_FAILED') from None

    def binding(self, target):
        binding = self.bindings.get(target.id)
        if binding is None or binding.target != target: raise HTTPException(409, 'CONNECTION_CHANGED')
        return binding

    async def open(self, targets, credentials, identity):
        if not targets: raise HTTPException(403, 'SLACK_SOCKET_SCOPE_MISMATCH')
        binding = self.binding(targets[0]); app = binding.app_id
        if (credentials != binding.credentials or identity.get('app_id') != app
            or identity.get('listener_scope') != 'slack-app:' + app):
            raise HTTPException(403, 'SLACK_SOCKET_SCOPE_MISMATCH')
        reconnect_key = (app, binding.app_token_digest)
        if self.open_not_before.get(reconnect_key, 0) > time.monotonic(): raise HTTPException(503, 'SLACK_SOCKET_RECONNECT_DELAY')
        ws = None
        try:
            for target in targets:
                other = self.binding(target)
                if other.app_id != app or other.app_token_digest != binding.app_token_digest:
                    raise HTTPException(403, 'SLACK_SOCKET_SCOPE_MISMATCH')
            data = await asyncio.to_thread(self.http.call, 'apps.connections.open', credentials['app_token'], {})
            ws = await self.socket.open(validate_socket_url(data.get('url')))
            hello = _frame(await asyncio.wait_for(ws.recv(), 5))
            if (hello.get('type') != 'hello' or not isinstance(hello.get('connection_info'), dict)
                or hello['connection_info'].get('app_id') != app): raise ValueError()
            self.open_not_before.pop(reconnect_key, None)
            return SlackListener(self, targets, ws, binding)
        except BaseException as error:
            if ws is not None:
                try: await ws.close()
                except Exception: pass
            if isinstance(error, asyncio.CancelledError): raise
            self.open_not_before[reconnect_key] = time.monotonic() + 5
            raise HTTPException(503, 'SLACK_SOCKET_VERIFICATION_FAILED') from None


class SlackListener:
    def __init__(self, adapter, targets, ws, binding):
        self.adapter, self.ws = adapter, ws
        self.app_id, self.app_token_digest = binding.app_id, binding.app_token_digest
        self.targets = {t.id: t for t in targets}
        self.stopped = False

    def _binding(self, target):
        binding = self.adapter.binding(target)
        if binding.app_id != self.app_id or binding.app_token_digest != self.app_token_digest:
            raise HTTPException(403, 'SLACK_SOCKET_SCOPE_MISMATCH')
        return binding

    async def update(self, targets):
        for target in targets: self._binding(target)
        self.targets = {t.id: t for t in targets}

    async def close(self):
        self.stopped = True
        await self.ws.close()

    async def listen(self, receive):
        while not self.stopped:
            value = _frame(await self.ws.recv())
            if value.get('type') == 'disconnect': raise RuntimeError('SLACK_SOCKET_REFRESH_REQUIRED')
            await asyncio.wait_for(self.handle(value, receive), 2.5)

    async def handle(self, value, receive):
        if self.stopped: raise HTTPException(409, 'SLACK_LISTENER_STOPPED')
        if (not isinstance(value, dict) or not isinstance(value.get('envelope_id'), str)
            or not 0 < len(value['envelope_id']) <= 512): raise HTTPException(422, 'SLACK_ENVELOPE_INVALID')
        await self._handle_payload(value, receive)
        await self.ws.send(json.dumps({'envelope_id': value['envelope_id']}))

    async def _handle_payload(self, value, receive):
        if value.get('type') not in {'events_api', 'interactive'}: return
        payload = value.get('payload')
        if not isinstance(payload, dict) or payload.get('api_app_id') != self.app_id:
            raise HTTPException(403, 'SLACK_APP_SCOPE_MISMATCH')
        team_info = payload.get('team')
        team = payload.get('team_id') or (team_info.get('id') if isinstance(team_info, dict) else None)
        event = payload.get('event') if payload.get('type') == 'event_callback' else payload
        if not isinstance(event, dict): raise HTTPException(422, 'SLACK_ENVELOPE_INVALID')
        channel = event.get('channel')
        if isinstance(channel, dict): channel = channel.get('id')
        targets = [t for t in self.targets.values() if (t.installation_id, t.target_id) == (team, channel)]
        if len(targets) > 1: raise HTTPException(409, 'SLACK_TARGET_AMBIGUOUS')
        if not targets: return
        target = targets[0]; binding = self._binding(target)
        normalized = await asyncio.to_thread(convert_packet, 'slack', 'normalize', {'input': payload,
            'connection': {'teamId': team, 'botUserId': target.account_id, 'botId': binding.bot_id}})
        if normalized is None: return
        stamp = event.get('event_ts') or event.get('ts')
        if payload.get('type') == 'block_actions':
            actions = payload.get('actions')
            stamp = actions[0].get('action_ts') if isinstance(actions, list) and actions and isinstance(actions[0], dict) else None
        try:
            if not isinstance(stamp, str) or not re.fullmatch(r'[0-9]{1,12}\.[0-9]{1,9}', stamp): raise ValueError()
            normalized['occurredAt'] = datetime.fromtimestamp(float(stamp), timezone.utc).isoformat()
        except (ValueError, OverflowError, TypeError): raise HTTPException(422, 'SLACK_EVENT_TIME_INVALID') from None
        normalized['destination'] = dict(team_id=team, app_id=self.app_id, bot_user_id=target.account_id,
            channelId=channel, threadTs=normalized.get('threadTs'), generation=target.generation)
        # receive는 암호화 원장 commit만 수행한다. 봇 실행/송신은 supervisor의 별도 작업이다.
        receipt = await receive(target.id, normalized)
        if receipt is None: raise RuntimeError('SLACK_COMMIT_UNCONFIRMED')

    async def send(self, target, packets, event):
        # 공통 runtime이 유효 lease/connection DB lock을 소유한다. 별도 session 재잠금 금지.
        if self.stopped or self.targets.get(target.id) != target: raise HTTPException(409, 'CONNECTION_CHANGED')
        binding = self._binding(target); context = event.get('destination', {})
        if (context.get('team_id'), context.get('app_id'), context.get('bot_user_id'), context.get('channelId'), context.get('generation')) != (
            target.installation_id, self.app_id, target.account_id, target.target_id, target.generation):
            raise HTTPException(409, 'SLACK_DESTINATION_MISMATCH')
        if not isinstance(packets, list) or len(packets) > 20: raise HTTPException(422, 'SLACK_PACKET_LIMIT')
        for packet in packets:
            if (not isinstance(packet, dict) or set(packet) - {'channel', 'text', 'thread_ts', 'blocks', 'mrkdwn', 'parse', 'unfurl_links', 'unfurl_media'}
                or packet.get('channel') != target.target_id or packet.get('thread_ts') != context.get('threadTs')
                or packet.get('mrkdwn') is not False or packet.get('parse') != 'none'
                or packet.get('unfurl_links') is not False or packet.get('unfurl_media') is not False
                or len(json.dumps(packet, ensure_ascii=False).encode()) > 1000000):
                raise HTTPException(422, 'SLACK_PACKET_INVALID')
        receipts = []
        for packet in packets:
            if self.stopped or self.targets.get(target.id) != target or self._binding(target) != binding:
                raise HTTPException(409, 'CONNECTION_CHANGED')
            result = await asyncio.to_thread(self.adapter.http.call, 'chat.postMessage', binding.credentials['bot_token'], packet)
            stamp = result.get('ts')
            if result.get('channel') != target.target_id or not isinstance(stamp, str) or not re.fullmatch(r'[0-9]{1,12}\.[0-9]{1,9}', stamp):
                raise RuntimeError('SLACK_DELIVERY_RECEIPT_UNCONFIRMED')
            receipts.append(target.target_id + ':' + stamp)
        return receipts
