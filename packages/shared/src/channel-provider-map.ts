export const CHANNEL_PROVIDER_MAP = [
  {admin: 'WEBCHAT', provider: 'webchat', runtime: 'webchat', bridge: 'webchat'},
  {admin: 'KAKAO', provider: 'kakao', runtime: 'kakao', bridge: 'kakao'},
  {admin: 'TEAMS', provider: 'ms_teams', runtime: 'ms-teams', bridge: 'ms-teams'},
  {admin: 'SLACK', provider: 'slack', runtime: 'slack', bridge: 'slack'},
  {admin: 'DISCORD', provider: 'discord', runtime: 'discord', bridge: 'discord'},
  {admin: 'TELEGRAM', provider: 'telegram', runtime: 'telegram', bridge: 'telegram'},
  {admin: 'GOOGLE_CHAT', provider: 'google_chat', runtime: 'google-chat', bridge: 'google-chat'},
  {admin: 'LINE', provider: 'line', runtime: 'line', bridge: 'line'},
] as const;

export type ChannelProviderCode = typeof CHANNEL_PROVIDER_MAP[number]['provider'];
export type RuntimeChannelType = typeof CHANNEL_PROVIDER_MAP[number]['runtime'];

export function normalizeChannelProvider(value: unknown): ChannelProviderCode {
  const row = CHANNEL_PROVIDER_MAP.find(row => row.admin === value || row.provider === value || row.runtime === value);
  if (!row) throw new Error('CHANNEL_PROVIDER_INVALID');
  return row.provider;
}

export function runtimeChannelForProvider(provider: ChannelProviderCode): RuntimeChannelType {
  const row = CHANNEL_PROVIDER_MAP.find(row => row.provider === provider);
  if (!row) throw new Error('CHANNEL_PROVIDER_INVALID');
  return row.runtime;
}
