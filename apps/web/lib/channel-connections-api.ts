import { apiRequest } from "@/lib/api";
import { normalizeChannelProvider } from "../../../packages/shared/src/channel-provider-map";

export type ChannelConnection = {
  id: string; channel_id: string; bot_id: string; name: string; provider: string;
  installation_id: string; account_id: string; target_id: string;
  desired_state: "connected" | "disconnected";
  observed_state: "connected" | "disconnected" | "connecting" | "disconnecting" | "error";
  generation: number; credentials_registered: boolean; identity_verified: boolean;
  last_error_code: string | null; last_checked_at: string | null;
};
export type ConnectionDraft = Pick<ChannelConnection, "name" | "bot_id" | "installation_id" | "account_id" | "target_id">;
export type ConnectionPayload = ConnectionDraft & { credentials?: Record<string, string> };
export type ConnectionList = {items: ChannelConnection[]; bots: {id: string; name: string}[]; total: number};
export type ConnectionAction = "check" | "connect" | "disconnect" | "delete";

const CREDENTIAL_FIELDS: Record<string, readonly string[]> = {
  ms_teams: ["client_id", "client_secret", "tenant_id"], slack: ["bot_token", "app_token", "signing_secret"],
  discord: ["bot_token"], telegram: ["bot_token"], google_chat: ["service_account_json", "project_id"],
  line: ["access_token", "channel_secret"],
};

export function credentialFieldsForProvider(provider: unknown): readonly string[] {
  try { return CREDENTIAL_FIELDS[normalizeChannelProvider(provider)] ?? []; }
  catch { return []; }
}

export function buildConnectionPayload(draft: ConnectionDraft, credentials: Record<string, string>): ConnectionPayload {
  const values = Object.fromEntries(Object.entries(credentials).filter(([, value]) => value.trim()));
  return {...draft, name: draft.name.trim(), ...(Object.keys(values).length ? {credentials: values} : {})};
}

function path(channelId: string, id?: string) {
  return `/api/v1/admin/channels/${encodeURIComponent(channelId)}/connections${id ? `/${encodeURIComponent(id)}` : ""}`;
}
export function fetchChannelConnections(token: string, channelId: string) {
  return apiRequest<ConnectionList>(path(channelId), {}, token);
}
export function saveChannelConnection(token: string, channelId: string, payload: ConnectionPayload, id?: string) {
  return apiRequest<ChannelConnection>(path(channelId, id), {method: id ? "PATCH" : "POST", body: JSON.stringify(payload)}, token);
}
export function actOnChannelConnection(token: string, channelId: string, id: string, action: ConnectionAction) {
  return apiRequest<ChannelConnection | {deleted: boolean}>(`${path(channelId, id)}${action === "delete" ? "" : `/${action}`}`,
    {method: action === "delete" ? "DELETE" : "POST"}, token);
}
