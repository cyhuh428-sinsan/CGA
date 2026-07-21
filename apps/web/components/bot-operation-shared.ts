import { loadLastBotScreen, saveLastBotScreen, type AuthSession } from "@/lib/auth";
import type { StudioBotApiItem, StudioBotVersionApiItem } from "@/lib/studio-bots-api";

export type RecentOperationBot = {
  botId: string;
  name: string;
  version: string;
  status: string;
  touchedAt: number;
};

const RECENT_BOTS_KEY = "cga.operation.recent_bots";
const LAST_BOT_PATH_PATTERN = /^\/studio\/bots\/([^/]+)\/versions\/([^/]+)/;

export function formatOperationDate(value?: string | null) {
  return value ? value.replace("T", " ").slice(0, 16) : "-";
}

export function safeOperationFilePart(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "_").trim() || "bot";
}

export function downloadOperationJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function operationVersionName(version?: StudioBotVersionApiItem | null) {
  return version?.name || (version ? `v${version.version_no}` : "v1");
}

export function operationBotLocale(bot?: StudioBotApiItem | null) {
  return bot?.data_json?.language || "ko";
}

export function operationBotGroupName(session: AuthSession | null, bot?: StudioBotApiItem | null) {
  return bot?.group_name || session?.user.group_name || bot?.group_code || session?.user.group_code || "-";
}

export function filterOperationBots(session: AuthSession, bots: StudioBotApiItem[]) {
  return bots.filter((bot) => {
    const isBot = bot.data_json?.bot_kind !== "hub";
    const isCurrentGroup = !session.user.group_id || bot.group_id === session.user.group_id;
    return isBot && isCurrentGroup && bot.status !== "deleted";
  });
}

export function loadRecentOperationBots() {
  try {
    const value = JSON.parse(window.localStorage.getItem(RECENT_BOTS_KEY) || "[]") as unknown;
    return Array.isArray(value) ? (value as RecentOperationBot[]).slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function saveRecentOperationBot(bot: StudioBotApiItem, version: string) {
  const current = loadRecentOperationBots().filter((item) => item.botId !== bot.id);
  const next: RecentOperationBot[] = [
    { botId: bot.id, name: bot.name, version, status: bot.status, touchedAt: Date.now() },
    ...current,
  ].slice(0, 8);
  window.localStorage.setItem(RECENT_BOTS_KEY, JSON.stringify(next));
  return next;
}

export function resolveInitialOperationBotId(session: AuthSession, bots: StudioBotApiItem[], requestedBotId = "") {
  if (requestedBotId && bots.some((bot) => bot.id === requestedBotId)) return requestedBotId;
  const lastPath = loadLastBotScreen(session.user.login_id) || session.user.last_bot_screen || "";
  const lastBotId = lastPath.match(LAST_BOT_PATH_PATTERN)?.[1] || "";
  return bots.some((bot) => bot.id === lastBotId) ? lastBotId : bots[0]?.id || "";
}

export function rememberOperationVersion(session: AuthSession, bot: StudioBotApiItem, version: StudioBotVersionApiItem) {
  const versionName = operationVersionName(version);
  saveLastBotScreen(`/studio/bots/${bot.id}/versions/${encodeURIComponent(versionName)}/intents`, session.user.login_id);
  saveRecentOperationBot(bot, versionName);
}

export function readOperationNluEngine(bot: StudioBotApiItem, version: StudioBotVersionApiItem) {
  const config = version.system_config as Record<string, unknown> | undefined;
  const aiConfig = config?.ai_config as Record<string, unknown> | undefined;
  const value = aiConfig?.nlu_model || config?.nlu_model || bot.data_json?.nlu_model || bot.data_json?.nlu_engine;
  return typeof value === "string" && value ? value : "-";
}

export function readOperationAiDetails(bot: StudioBotApiItem, version: StudioBotVersionApiItem) {
  const versionConfig = version.system_config as Record<string, unknown> | undefined;
  const versionAiConfig = versionConfig?.ai_config as Record<string, unknown> | undefined;
  const botConfig = bot.data_json as Record<string, unknown> | undefined;

  function readValue(...keys: string[]) {
    for (const source of [versionAiConfig, versionConfig, botConfig]) {
      for (const key of keys) {
        const value = source?.[key];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
    }
    return "-";
  }

  return {
    nluType: readValue("nlu_type"),
    nluModel: readValue("nlu_model", "nlu_engine"),
    answerMode: readValue("answer_mode"),
    llmModel: readValue("llm_model"),
  };
}

export function readOperationEvaluation(version: StudioBotVersionApiItem) {
  const document = version.version_json as Record<string, unknown> | undefined;
  const evaluation = document?.evaluation as Record<string, unknown> | undefined;
  const score = evaluation?.score ?? evaluation?.accuracy;
  if (typeof score !== "number") return "-";
  return `${Math.round(score <= 1 ? score * 100 : score)}%`;
}
