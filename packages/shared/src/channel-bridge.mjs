// 순수 packet 변환 전용. 네트워크·인증·대화 실행을 수행하지 않는다.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as sdk from './channel.ts';
import { normalizeChannelProvider, runtimeChannelForProvider, CHANNEL_PROVIDER_MAP } from './channel-provider-map.ts';
import { buildAidotTeamsReplyPayload } from './teams.mjs';

const normalizers = new Map([
  ['slack', sdk.normalizeAidotSlackEvent], ['discord', sdk.normalizeAidotDiscordEvent],
  ['telegram', sdk.normalizeAidotTelegramEvent], ['google-chat', sdk.normalizeAidotGoogleChatEvent], ['line', sdk.normalizeAidotLineEvent],
]);
const builders = new Map([
  ['ms-teams', buildAidotTeamsReplyPayload], ['slack', sdk.buildAidotSlackReplyPayload],
  ['discord', sdk.buildAidotDiscordReplyPayload], ['telegram', sdk.buildAidotTelegramReplyPayload],
  ['google-chat', sdk.buildAidotGoogleChatReplyPayload], ['line', sdk.buildAidotLineMessage],
]);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export async function convert(provider, direction, payload) {
  const channel = runtimeChannelForProvider(normalizeChannelProvider(provider));
  if (!record(payload)) throw Error('input');
  if (direction === 'normalize') {
    if (!normalizers.has(channel) || !record(payload.connection) || !record(payload.input)) throw Error('input');
    return normalizers.get(channel)(payload.input, payload.connection, payload.eventIndex);
  }
  if (direction === 'selection') {
    if (!normalizers.has(channel) || !record(payload.source) || !record(payload.event)) throw Error('input');
    return sdk.restoreAidotNativeSelection(channel, payload.source, payload.event);
  }
  if (direction !== 'replies' || !builders.has(channel)) throw Error('operation');
  if (!Array.isArray(payload.messages) || payload.messages.length > (channel === 'line' ? 5 : 20)) throw Error('messages');
  return payload.messages.map(message => {
    if (!record(message) || typeof message.text !== 'string' || !message.text.trim()) throw Error('message');
    const build = builders.get(channel);
    // 지원하지 않는 표현만 본문으로 대체한다. 대상/본문 검증 실패는 계속 실패한다.
    try { return build(message, payload.destination); }
    catch (error) {
      if (!message.messageType || message.messageType === 'text') throw error;
      return build({...message, messageType: 'text', payload: undefined}, payload.destination);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const source = readFileSync(0, 'utf8');
    if (Buffer.byteLength(source) > 1048576) throw Error('size');
    const input = JSON.parse(source);
    if (!record(input)) throw Error('input');
    const value = input.operation === 'mapping' ? CHANNEL_PROVIDER_MAP : await convert(input.provider, input.operation ?? input.direction, input.payload);
    process.stdout.write(JSON.stringify({ok: true, value}));
  } catch {
    process.stdout.write(JSON.stringify({ok: false, code: 'CHANNEL_PACKET_INVALID'}));
    process.exitCode = 1;
  }
}
