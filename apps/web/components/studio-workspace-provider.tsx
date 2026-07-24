"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";

import { BotWorkspaceHeader } from "@/components/bot-workspace-header";
import { StudioPageLoading } from "@/components/studio-page-loading";
import { useI18n } from "@/components/language-provider";
import { getStudioPageLabel, STUDIO_PAGE_CATALOGS } from "@/lib/i18n/studio-pages";
import { type AdminConversationHistoryItem, fetchConversationHistory } from "@/lib/admin-api";
import { loadAuthSession, type AuthSession } from "@/lib/auth";
import {
  botWithWorkspaceContext,
  clearStudioWorkspaceContextCache,
  fetchStudioBotVersionRetraining,
  fetchStudioWorkspaceContext,
  getCachedStudioWorkspaceContext,
  hasFreshCachedStudioWorkspaceContext,
  prefetchStudioBotVersionCoreSections,
  type StudioBotApiItem,
  type StudioBotVersionApiItem,
  type StudioWorkspaceContextApiResponse,
} from "@/lib/studio-bots-api";
import { normalizeVersionDocument } from "@/lib/version-document";
import type { SummaryStatItem } from "@/components/summary-stat-grid";

type StudioWorkspaceContextValue = {
  session: AuthSession;
  context: StudioWorkspaceContextApiResponse;
  bot: StudioBotApiItem;
  versions: StudioBotVersionApiItem[];
  refresh: () => Promise<void>;
  setSummaryCardValue: (label: string, value: string | null) => void;
};

const StudioWorkspaceContext = createContext<StudioWorkspaceContextValue | null>(null);

const workspaceSummaryOverrideCache = new Map<string, Record<string, string>>();
const WORKSPACE_VOLATILE_SUMMARY_LABELS = new Set(["재학습"]);

function filterWorkspaceSummaryOverrideValues(value: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(value).filter(([label]) => !WORKSPACE_VOLATILE_SUMMARY_LABELS.has(label)),
  );
}


function getWorkspaceSummaryOverrideStorageKey(cacheKey: string) {
  return `aidot.workspace.summary.${cacheKey}`;
}

function readWorkspaceSummaryOverrideCache(cacheKey: string) {
  const cached = workspaceSummaryOverrideCache.get(cacheKey);
  if (cached) {
    return filterWorkspaceSummaryOverrideValues(cached);
  }
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.sessionStorage.getItem(getWorkspaceSummaryOverrideStorageKey(cacheKey));
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const next = filterWorkspaceSummaryOverrideValues(Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    ));
    if (Object.keys(next).length > 0) {
      workspaceSummaryOverrideCache.set(cacheKey, next);
    }
    return next;
  } catch {
    return {};
  }
}

function writeWorkspaceSummaryOverrideCache(cacheKey: string, value: Record<string, string>) {
  const persistentValue = filterWorkspaceSummaryOverrideValues(value);
  if (Object.keys(persistentValue).length === 0) {
    workspaceSummaryOverrideCache.delete(cacheKey);
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(getWorkspaceSummaryOverrideStorageKey(cacheKey));
      } catch {}
    }
    return;
  }
  workspaceSummaryOverrideCache.set(cacheKey, persistentValue);
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(getWorkspaceSummaryOverrideStorageKey(cacheKey), JSON.stringify(persistentValue));
    } catch {}
  }
}

type StudioWorkspaceProviderProps = {
  children: ReactNode;
};

function normalizeRouteParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return decodeURIComponent(value[0] ?? "");
  }
  return decodeURIComponent(value ?? "");
}

type WorkspaceSection = "intents" | "configure" | "entities" | "dictionary" | "evaluation" | "retraining" | "analysis";

const SHELL_HEADER_SECTIONS = new Set<WorkspaceSection>([
  "intents",
  "configure",
  "entities",
  "dictionary",
  "evaluation",
  "retraining",
  "analysis",
]);

function getWorkspaceSection(pathname: string | null): WorkspaceSection | null {
  const match = pathname?.match(/\/versions\/[^/]+\/([^/]+)(?:\/)?$/);
  const section = match?.[1] as WorkspaceSection | undefined;
  return section && SHELL_HEADER_SECTIONS.has(section) ? section : null;
}

function buildVersionAssetHref(botId: string, versionScope: string, section: WorkspaceSection) {
  return `/studio/bots/${botId}/versions/${versionScope}/${section}`;
}

function numberFromSummaryRecord(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatWorkspaceEvaluationPercent(value: number | null) {
  if (value == null) {
    return "-";
  }
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
}

function getWorkspaceEvaluationLabel(version?: StudioBotVersionApiItem | null) {
  const systemConfig = version?.system_config ?? version?.version_json?.system_config;
  const evaluationStore = systemConfig?.nlu_evaluation;
  if (!evaluationStore || typeof evaluationStore !== "object" || Array.isArray(evaluationStore)) {
    return "-";
  }
  const latestSource = (evaluationStore as Record<string, unknown>).latest;
  const latest =
    latestSource && typeof latestSource === "object" && !Array.isArray(latestSource)
      ? latestSource as Record<string, unknown>
      : evaluationStore as Record<string, unknown>;
  const fixedAccuracy = numberFromSummaryRecord(latest, "fixed_accuracy");
  const randomAccuracy = numberFromSummaryRecord(latest, "random_accuracy");
  const accuracy = numberFromSummaryRecord(latest, "accuracy");
  return formatWorkspaceEvaluationPercent(fixedAccuracy ?? randomAccuracy ?? accuracy);
}

function buildWorkspaceSummaryCards(
  botId: string,
  versionScope: string,
  activeSection: WorkspaceSection,
  bot: StudioBotApiItem,
): SummaryStatItem[] {
  const counts = bot.active_version?.asset_counts;
  const retrainingCount = "-";
  const intentCount = counts?.dialogs ?? counts?.intents ?? "-";
  return [
    {
      label: "의도",
      value: String(intentCount),
      active: activeSection === "intents",
      href: buildVersionAssetHref(botId, versionScope, "intents"),
    },
    {
      label: "구성",
      value: "-",
      active: activeSection === "configure",
      href: buildVersionAssetHref(botId, versionScope, "configure"),
    },
    {
      label: "개체",
      value: String(counts?.entities ?? "-"),
      active: activeSection === "entities",
      href: buildVersionAssetHref(botId, versionScope, "entities"),
    },
    {
      label: "사전",
      value: String(counts?.dictionary ?? "-"),
      active: activeSection === "dictionary",
      href: buildVersionAssetHref(botId, versionScope, "dictionary"),
    },
    {
      label: "평가",
      value: getWorkspaceEvaluationLabel(bot.active_version),
      active: activeSection === "evaluation",
      href: buildVersionAssetHref(botId, versionScope, "evaluation"),
    },
    {
      label: "재학습",
      value: String(retrainingCount),
      active: activeSection === "retraining",
      href: buildVersionAssetHref(botId, versionScope, "retraining"),
    },
    {
      label: "분석",
      value: "-",
      active: activeSection === "analysis",
      href: buildVersionAssetHref(botId, versionScope, "analysis"),
    },
  ];
}

function workspaceAnalysisMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseWorkspaceDateValue(value: string) {
  const trimmed = String(value ?? "").trim();
  const koreanTimeMatch = trimmed.match(/^(\d{4})[-.]\s*(\d{1,2})[-.]\s*(\d{1,2})\.?\s*(오전|오후)\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (koreanTimeMatch) {
    const [, year, month, day, meridiem, hourText, minute, second = "0"] = koreanTimeMatch;
    let hour = Number(hourText);
    if (meridiem === "오후" && hour < 12) hour += 12;
    if (meridiem === "오전" && hour === 12) hour = 0;
    return new Date(Number(year), Number(month) - 1, Number(day), hour, Number(minute), Number(second));
  }
  const plainTimeMatch = trimmed.match(/^(\d{4})[-.]\s*(\d{1,2})[-.]\s*(\d{1,2})\.?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (plainTimeMatch) {
    const [, year, month, day, hour, minute, second = "0"] = plainTimeMatch;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  }
  return new Date(value);
}
function workspaceDateKey(value: string) {
  const date = parseWorkspaceDateValue(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  const parts = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function workspaceMonthOf(value: string) {
  return workspaceDateKey(value).slice(0, 7);
}

function workspaceDayOf(value: string) {
  return workspaceDateKey(value);
}

function workspaceTodayText() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isWorkspaceRetrainingUnhandled(status?: string) {
  return !status || status === "미학습";
}


function normalizeWorkspaceConversationChannel(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "시뮬레이터";
  return normalized.toLowerCase() === "simulator" ? "시뮬레이터" : normalized;
}

function workspaceAsRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function workspaceAsRecordArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
    : [];
}

function workspaceEntryPayload(item: AdminConversationHistoryItem) {
  const entry = item.data_json?.entry;
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return {};
  }
  const payload = (entry as Record<string, unknown>).payload;
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
}

function workspaceEntryDetail(item: AdminConversationHistoryItem) {
  const detail = workspaceEntryPayload(item).detail;
  return detail && typeof detail === "object" && !Array.isArray(detail)
    ? detail as Record<string, unknown>
    : {};
}

function workspaceEntryLog(item: AdminConversationHistoryItem) {
  const log = workspaceEntryDetail(item).log;
  return log && typeof log === "object" && !Array.isArray(log)
    ? log as Record<string, unknown>
    : {};
}

function workspaceEntryPayloadFromRecord(entry: Record<string, unknown>) {
  const payload = entry.payload;
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
}

function workspaceEntryDetailFromRecord(entry: Record<string, unknown>) {
  const detail = workspaceEntryPayloadFromRecord(entry).detail;
  return detail && typeof detail === "object" && !Array.isArray(detail)
    ? detail as Record<string, unknown>
    : {};
}

function workspaceEntryLogFromRecord(entry: Record<string, unknown>) {
  const log = workspaceEntryDetailFromRecord(entry).log;
  return log && typeof log === "object" && !Array.isArray(log)
    ? log as Record<string, unknown>
    : {};
}

function normalizeWorkspaceDisplayText(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim();
}

function isWorkspaceCardNodeName(value: unknown) {
  const normalized = normalizeWorkspaceDisplayText(value);
  return /^(talk|rich\s*form)\s*\d*$/i.test(normalized);
}

function workspaceFirstTextValue(values: unknown[]) {
  return values
    .map((value) => normalizeWorkspaceDisplayText(value))
    .find((value) => value && value !== "-" && !isWorkspaceCardNodeName(value) && !isWorkspaceInternalUtterance(value)) ?? "";
}

function isWorkspaceInternalUtterance(value: unknown) {
  const normalized = normalizeWorkspaceDisplayText(value);
  if (!normalized || normalized === "-") return true;
  if (["END", "START", "__END__", "[END]"].includes(normalized.toUpperCase())) return true;
  if (/webchatRichFormVersion|buttonValue|"response"\s*:/i.test(normalized)) return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized);
}

function workspaceUserUtterance(item: AdminConversationHistoryItem) {
  const detail = workspaceEntryDetail(item);
  const log = workspaceEntryLog(item);
  const message = item.data_json?.message;
  const messageMap = message && typeof message === "object" && !Array.isArray(message)
    ? message as Record<string, unknown>
    : {};
  const variables = detail && typeof detail === "object" && !Array.isArray(detail)
    ? (detail as Record<string, unknown>).variables
    : null;
  const variableMap = variables && typeof variables === "object" && !Array.isArray(variables)
    ? variables as Record<string, unknown>
    : {};
  const found = [
    messageMap.text,
    detail.utterance,
    detail.userUtterance,
    log.utterance,
    log.userUtterance,
    variableMap.userUtterance,
    variableMap.utterance,
    variableMap.input,
    variableMap.select,
    variableMap.message,
  ].find((value) => typeof value === "string" && value.trim());
  return typeof found === "string" ? found : "-";
}

function workspaceSessionMessages(item: AdminConversationHistoryItem) {
  return Array.isArray(item.data_json?.messages)
    ? item.data_json.messages.filter((message): message is Record<string, unknown> => (
        !!message && typeof message === "object" && !Array.isArray(message)
      ))
    : [];
}

function workspaceSessionUserUtterances(item: AdminConversationHistoryItem) {
  const values = item.data_json?.session_user_utterances;
  return Array.isArray(values)
    ? values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
}

function workspaceRetrainingUserUtterance(item: AdminConversationHistoryItem) {
  const detail = workspaceEntryDetail(item);
  const log = workspaceEntryLog(item);
  const message = item.data_json?.message;
  const messageMap = message && typeof message === "object" && !Array.isArray(message)
    ? message as Record<string, unknown>
    : {};
  const variables = detail.variables && typeof detail.variables === "object" && !Array.isArray(detail.variables)
    ? detail.variables as Record<string, unknown>
    : {};
  const entryUtterance = workspaceFirstTextValue([
    messageMap.text,
    item.data_json?.session_candidate_utterance,
    detail.utterance,
    detail.userUtterance,
    log.utterance,
    log.userUtterance,
    variables.userUtterance,
    variables.utterance,
    variables.input,
    variables.select,
    variables.message,
  ]);
  if (entryUtterance && !isWorkspaceInternalUtterance(entryUtterance)) {
    return entryUtterance;
  }
  if (item.id.includes(":entry:")) {
    return "-";
  }
  const sessionUtterance = workspaceFirstTextValue([
    item.data_json?.session_first_user_utterance,
    ...workspaceSessionUserUtterances(item),
  ]);
  return sessionUtterance && !isWorkspaceInternalUtterance(sessionUtterance) ? sessionUtterance : "-";
}

function workspaceNormalizeResultType(item: AdminConversationHistoryItem) {
  const detail = workspaceEntryDetail(item);
  const runtimeEvents = Array.isArray(detail.runtimeEvents)
    ? detail.runtimeEvents
    : Array.isArray(detail.runtime_events)
      ? detail.runtime_events
      : Array.isArray(item.data_json?.runtimeEvents)
        ? item.data_json.runtimeEvents
        : Array.isArray(item.data_json?.runtime_events)
          ? item.data_json.runtime_events
          : [];
  const event = runtimeEvents.find((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const name = String((value as Record<string, unknown>).event ?? "");
    return name === "channel.runtime.intent_matched" || name === "channel.runtime.intent_fallback";
  });
  const runtimeEventName =
    event && typeof event === "object" && !Array.isArray(event)
      ? String((event as Record<string, unknown>).event ?? "")
      : "";
  if (runtimeEventName === "channel.runtime.intent_fallback") return "의도 추출 오류";
  if (runtimeEventName === "channel.runtime.intent_matched") return "정상분류";
  if (item.result.includes("유사")) return "유사의도발생";
  if (item.result.includes("미응답") || item.result.includes("미분류") || item.intent_or_module_name.includes("미분류") || item.intent_or_module_name === "-") {
    return "의도 추출 오류";
  }
  return "정상분류";
}

function isWorkspaceRetrainingCandidate(item: AdminConversationHistoryItem) {
  const resultType = workspaceNormalizeResultType(item);
  return resultType === "의도 추출 오류" || resultType === "유사의도발생";
}

function workspaceSessionEntries(item: AdminConversationHistoryItem) {
  const values = item.data_json?.entries;
  return Array.isArray(values)
    ? values.filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value))
    : [];
}

function workspaceIsRetrainingEntryEvent(entry: Record<string, unknown>) {
  const payload = workspaceEntryPayloadFromRecord(entry);
  const detail = workspaceEntryDetailFromRecord(entry);
  const eventName = String(entry.eventName || entry.event || payload.event || "").trim();
  if (eventName === "simulator.user_utterance") return true;
  if (eventName !== "simulator.user_message") return false;
  return Boolean(detail.resultType || detail.result_type);
}

function workspaceBuildEntryConversationItem(
  base: AdminConversationHistoryItem,
  entry: Record<string, unknown>,
  index: number,
): AdminConversationHistoryItem {
  const payload = workspaceEntryPayloadFromRecord(entry);
  const detail = workspaceEntryDetailFromRecord(entry);
  const log = workspaceEntryLogFromRecord(entry);
  const occurredAt = String(entry.serverTime || payload.serverTime || payload.clientTime || detail.createdAt || detail.updatedAt || base.uttered_at);
  const intentOrModuleName = String(
    detail.selectedIntentName ??
    detail.intentName ??
    detail.intent_name ??
    log.selectedIntentName ??
    log.intentName ??
    log.intent_name ??
    base.intent_or_module_name ??
    "-",
  ).trim() || "-";
  const result = String(detail.resultType || base.result || "").trim() || base.result;

  return {
    ...base,
    id: `${base.id}:entry:${index}`,
    intent_or_module_name: intentOrModuleName,
    uttered_at: occurredAt,
    result,
    data_json: {
      ...base.data_json,
      entry,
    },
  };
}

function getWorkspaceRetrainingCount(
  rows: AdminConversationHistoryItem[],
  bot: StudioBotApiItem,
  versionScope: string,
) {
  const effectiveBotId = bot.id ?? "";
  const effectiveVersion = bot.active_version;
  const document = normalizeVersionDocument(bot.active_version?.version_json);
  const records = document.system_config?.retraining_records;
  const retrainingRecords =
    records && typeof records === "object" && !Array.isArray(records)
      ? records as Record<string, { status?: string; utterance?: string }>
      : {};
  const rowCandidates = rows.flatMap((item) => {
    const payload = workspaceEntryPayload(item);
    const rowBotId = String(payload.botId ?? "");
    const rowVersionId = String(payload.versionId ?? "");
    const botMatched =
      item.bot_name === bot.name ||
      rowBotId === effectiveBotId;
    const versionMatched =
      !effectiveVersion?.id ||
      !rowVersionId ||
      rowVersionId === effectiveVersion.id ||
      rowVersionId === versionScope;
    const today = workspaceTodayText();
    if (!botMatched || !versionMatched || !isWorkspaceRetrainingUnhandled(retrainingRecords[item.id]?.status)) {
      return [];
    }
    const retrainingEntries = workspaceSessionEntries(item).filter(workspaceIsRetrainingEntryEvent);
    const entryCandidates = retrainingEntries
      .map((entry, index) => workspaceBuildEntryConversationItem(item, entry, index))
      .filter((entryItem) => isWorkspaceRetrainingUnhandled(retrainingRecords[entryItem.id]?.status))
      .filter((entryItem) => workspaceDayOf(entryItem.uttered_at) === today)
      .filter((entryItem) => isWorkspaceRetrainingCandidate(entryItem))
      .filter((entryItem) => workspaceRetrainingUserUtterance(entryItem) !== "-");
    const entryUtteranceKeys = new Set(entryCandidates.map((entryItem) => normalizeWorkspaceDisplayText(workspaceRetrainingUserUtterance(entryItem)).toLowerCase()));
    const sessionCandidates = retrainingEntries.length > 0
      ? []
      : workspaceSessionUserUtterances(item)
      .map((utterance, index) => ({
        ...item,
        id: `${item.id}:session:${index}`,
        data_json: {
          ...item.data_json,
          session_candidate_utterance: utterance,
        },
      }))
      .filter((sessionItem) => workspaceDayOf(sessionItem.uttered_at) === today)
      .filter((sessionItem) => isWorkspaceRetrainingUnhandled(retrainingRecords[sessionItem.id]?.status))
      .filter((sessionItem) => isWorkspaceRetrainingCandidate(sessionItem))
      .filter((sessionItem) => workspaceRetrainingUserUtterance(sessionItem) !== "-")
      .filter((sessionItem) => !entryUtteranceKeys.has(normalizeWorkspaceDisplayText(workspaceRetrainingUserUtterance(sessionItem)).toLowerCase()));
    if (entryCandidates.length > 0 || sessionCandidates.length > 0) {
      return [...entryCandidates, ...sessionCandidates];
    }
    if (workspaceDayOf(item.uttered_at) !== today || !isWorkspaceRetrainingCandidate(item)) {
      return [];
    }
    return workspaceRetrainingUserUtterance(item) !== "-" ? [item] : [];
  });
  const seenRowKeys = new Set<string>();
  const dedupedRowCandidates = rowCandidates.filter((item) => {
    const key = [
      normalizeWorkspaceDisplayText(workspaceRetrainingUserUtterance(item)).toLowerCase(),
      item.intent_or_module_name,
      workspaceNormalizeResultType(item),
      workspaceDateKey(item.uttered_at),
    ].join("|");
    if (seenRowKeys.has(key)) {
      return false;
    }
    seenRowKeys.add(key);
    return true;
  });
  return dedupedRowCandidates.length;
}

async function getWorkspaceBotWithFreshRetrainingRecords(
  token: string,
  bot: StudioBotApiItem,
) {
  const activeVersion = bot.active_version;
  if (!activeVersion?.id) {
    return bot;
  }
  try {
    const retrainingSection = await fetchStudioBotVersionRetraining(token, bot.id, activeVersion.id);
    const sectionVersionDocument = normalizeVersionDocument(retrainingSection.version.version_json);
    const nextVersionDocument = {
      ...sectionVersionDocument,
      dialogs: retrainingSection.dialogs ?? sectionVersionDocument.dialogs,
      system_config: {
        ...sectionVersionDocument.system_config,
        ...(retrainingSection.version.system_config ?? {}),
        ...(retrainingSection.system_config ?? {}),
      },
    };
    return {
      ...bot,
      active_version: {
        ...activeVersion,
        ...retrainingSection.version,
        version_json: nextVersionDocument,
        system_config: nextVersionDocument.system_config,
        asset_counts: retrainingSection.asset_counts ?? retrainingSection.version.asset_counts ?? activeVersion.asset_counts,
        scenario_validation: retrainingSection.scenario_validation ?? retrainingSection.version.scenario_validation ?? activeVersion.scenario_validation,
      },
    };
  } catch {
    return bot;
  }
}
function countWorkspaceAnalysisUtterances(item: AdminConversationHistoryItem) {
  const data = item.data_json ?? {};
  const entries = workspaceAsRecordArray(data.entries);
  const directEntries = entries
    .map((entry) => {
      const payload = workspaceAsRecord(entry.payload);
      const detail = workspaceAsRecord(payload.detail);
      const log = workspaceAsRecord(detail.log);
      const eventName = String(entry.event ?? entry.event_name ?? payload.event ?? "").trim();
      const utterance = workspaceFirstTextValue([
        detail.utterance,
        detail.userUtterance,
        log.utterance,
        log.userUtterance,
      ]);
      return { eventName, utterance };
    })
    .filter((entry) => entry.eventName === "simulator.user_message" && !isWorkspaceInternalUtterance(entry.utterance));
  if (directEntries.length > 0) {
    return directEntries.length;
  }
  const rawUtterances = Array.isArray(data.session_user_raw_utterances)
    ? data.session_user_raw_utterances
    : Array.isArray(data.session_user_utterances)
      ? data.session_user_utterances
      : [];
  const fromSession = rawUtterances
    .map((utterance) => workspaceFirstTextValue([utterance]))
    .filter((utterance) => !isWorkspaceInternalUtterance(utterance));
  if (fromSession.length > 0) {
    return fromSession.length;
  }
  const messageEntries = workspaceSessionMessages(item)
    .filter((message) => String(message.participant_kind ?? "").toLowerCase() === "user")
    .map((message) => workspaceFirstTextValue([message.display_text, message.text]))
    .filter((utterance) => !isWorkspaceInternalUtterance(utterance));
  if (messageEntries.length > 0) {
    return messageEntries.length;
  }
  const fallbackUtterance = workspaceFirstTextValue([workspaceUserUtterance(item)]);
  return isWorkspaceInternalUtterance(fallbackUtterance) ? 0 : 1;
}

function isWorkspaceAnalysisAnswered(item: AdminConversationHistoryItem) {
  return !["미응답", "대화실패", "오류", "진행중"].some((keyword) => item.result.includes(keyword));
}

function computeWorkspaceAnalysisSummary(
  rows: AdminConversationHistoryItem[],
  bot: StudioBotApiItem,
  versionScope: string,
) {
  const effectiveBotId = bot.id ?? "";
  const effectiveVersion = bot.active_version;
  const currentMonth = workspaceAnalysisMonth(new Date());
  const botRows = rows.filter((item) => {
    const entry = item.data_json?.entry;
    const entryRecord = entry && typeof entry === "object" && !Array.isArray(entry)
      ? entry as Record<string, unknown>
      : {};
    const payload = entryRecord.payload && typeof entryRecord.payload === "object" && !Array.isArray(entryRecord.payload)
      ? entryRecord.payload as Record<string, unknown>
      : {};
    const rowBotId = String(payload.botId ?? "");
    const rowVersionId = String(payload.versionId ?? "");
    const botMatched =
      item.bot_name === bot.name ||
      rowBotId === effectiveBotId;
    const versionMatched =
      !effectiveVersion?.id ||
      !rowVersionId ||
      rowVersionId === effectiveVersion.id ||
      rowVersionId === versionScope;
    return botMatched && versionMatched;
  });
  const channels = [...new Set(botRows.map((item) => normalizeWorkspaceConversationChannel(item.channel_name)))];
  const selectedChannel = channels.includes("시뮬레이터") ? "시뮬레이터" : channels[0] ?? "시뮬레이터";
  let visibleRows = botRows.filter((item) => (
    normalizeWorkspaceConversationChannel(item.channel_name) === selectedChannel &&
    workspaceMonthOf(item.uttered_at) === currentMonth
  ));
  if (visibleRows.length === 0) {
    const latestMonth = botRows.find((item) => normalizeWorkspaceConversationChannel(item.channel_name) === selectedChannel);
    const fallbackMonth = latestMonth ? workspaceMonthOf(latestMonth.uttered_at) : "";
    if (fallbackMonth) {
      visibleRows = botRows.filter((item) => (
        normalizeWorkspaceConversationChannel(item.channel_name) === selectedChannel &&
        workspaceMonthOf(item.uttered_at) === fallbackMonth
      ));
    }
  }
  if (visibleRows.length === 0) {
    return "-";
  }
  const totalUtteranceCount = visibleRows.reduce((sum, item) => sum + countWorkspaceAnalysisUtterances(item), 0);
  if (totalUtteranceCount === 0) {
    return "-";
  }
  const answeredUtteranceCount = visibleRows.reduce((sum, item) => (
    sum + (isWorkspaceAnalysisAnswered(item) ? countWorkspaceAnalysisUtterances(item) : 0)
  ), 0);
  return `${Math.round((answeredUtteranceCount / totalUtteranceCount) * 1000) / 10}%`;
}

export function StudioWorkspaceProvider({ children }: StudioWorkspaceProviderProps) {
  const params = useParams<{ botId?: string; versionId?: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const { language: uiLanguage } = useI18n();
  const copy = STUDIO_PAGE_CATALOGS[uiLanguage];
  const botId = normalizeRouteParam(params.botId);
  const versionScope = normalizeRouteParam(params.versionId) || "v1";
  const activeSection = getWorkspaceSection(pathname);
  const isIntentDetailRoute = Boolean(pathname) && /\/versions\/[^/]+\/intents\/[^/]+$/.test(pathname);
  const includeDocument = false;
  const allowFullContextFallback = !isIntentDetailRoute;
  const prefetchSection = undefined;
  const [session, setSession] = useState<AuthSession | null>(null);
  const [context, setContext] = useState<StudioWorkspaceContextApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [headerErrorMessage, setHeaderErrorMessage] = useState("");

  useEffect(() => {
    const activeSession = loadAuthSession();
    setSession(activeSession);

    if (!activeSession) {
      setLoading(false);
      router.replace("/login");
      return;
    }

    let ignore = false;
    const cachedContext = getCachedStudioWorkspaceContext(
      activeSession.access_token,
      botId,
      versionScope,
      includeDocument,
      true,
      prefetchSection,
      activeSession.user.login_id,
      allowFullContextFallback,
    );
    const hasFreshContext = hasFreshCachedStudioWorkspaceContext(
      activeSession.access_token,
      botId,
      versionScope,
      includeDocument,
      prefetchSection,
      activeSession.user.login_id,
      allowFullContextFallback,
    );
    if (cachedContext) {
      setContext(cachedContext);
      setLoading(false);
      if (hasFreshContext) {
        return () => {
          ignore = true;
        };
      }
    } else {
      setLoading(true);
    }
    setErrorMessage("");

    fetchStudioWorkspaceContext(
      activeSession.access_token,
      botId,
      versionScope,
      includeDocument,
      prefetchSection,
      activeSession.user.login_id,
      allowFullContextFallback,
    )
      .then((nextContext) => {
        if (!ignore) {
          setContext(nextContext);
          setErrorMessage("");
        }
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : "봇 작업 공간을 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [allowFullContextFallback, botId, includeDocument, prefetchSection, router, versionScope]);

  useEffect(() => {
    if (!session || !context || includeDocument || !context.version || activeSection === "intents") {
      return;
    }

    const timer = window.setTimeout(() => {
      prefetchStudioBotVersionCoreSections(session.access_token, context.version!.bot_id, context.version!.id);
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeSection, context, includeDocument, session]);

  useEffect(() => {
    const canonicalBotId = context?.bot.id;
    if (!canonicalBotId || !pathname || botId === canonicalBotId) {
      return;
    }

    const canonicalPath = pathname.replace(/\/studio\/bots\/[^/]+/, `/studio/bots/${canonicalBotId}`);
    if (canonicalPath === pathname) {
      return;
    }

    const search = typeof window !== "undefined" ? window.location.search : "";
    router.replace(`${canonicalPath}${search}`);
  }, [botId, context?.bot.id, pathname, router]);

  const value = useMemo<StudioWorkspaceContextValue | null>(() => {
    if (!session || !context) {
      return null;
    }

    return {
      session,
      context,
      bot: botWithWorkspaceContext(context),
      versions: context.versions,
      refresh: async () => {
        clearStudioWorkspaceContextCache();
        const nextContext = await fetchStudioWorkspaceContext(
          session.access_token,
          botId,
          versionScope,
          includeDocument,
          prefetchSection,
          session.user.login_id,
          allowFullContextFallback,
        );
        setContext(nextContext);
      },
      setSummaryCardValue: () => {},
    };
  }, [allowFullContextFallback, botId, context, includeDocument, prefetchSection, session, versionScope]);

  if (!value) {
    return (
      <StudioPageLoading
        title={getStudioPageLabel(copy, errorMessage || "봇 작업 공간을 불러오는 중입니다.")}
        description={getStudioPageLabel(copy, loading ? "봇/버전 공통 정보를 확인하는 중입니다." : "작업 공간 정보를 확인할 수 없습니다.")}
      />
    );
  }

  if (activeSection && value.versions.length === 0) {
    const effectiveBotId = value.bot.id ?? botId;
    return (
      <StudioWorkspaceContext.Provider value={value}>
        <section className="studio-page-state">
          <div className="admin-state-box">
            <strong>{getStudioPageLabel(copy, "이 봇에는 등록된 버전이 없습니다.")}</strong>
            <p>
              {getStudioPageLabel(copy, "정상 봇은 생성 시 기본 v1 버전이 함께 생성됩니다. 이 상태에서는 의도/모듈 화면을 열 수 없으므로 봇 삭제 설정에서 봇을 삭제하거나 버전 관리에서 새 버전을 추가해야 합니다.")}
            </p>
            <div className="studio-page-state__actions">
              <Link href={`/studio/bots/${effectiveBotId}/settings/delete`} className="primary-action">
                {getStudioPageLabel(copy, "봇 삭제 설정")}
              </Link>
              <Link href={`/studio/bots/${effectiveBotId}/versions`} className="secondary-action">
                {getStudioPageLabel(copy, "버전 관리")}
              </Link>
            </div>
          </div>
        </section>
      </StudioWorkspaceContext.Provider>
    );
  }

  return (
    <StudioWorkspaceContext.Provider value={value}>
      <StudioWorkspaceShell
        botId={botId}
        versionScope={versionScope}
        headerErrorMessage={headerErrorMessage}
        onHeaderError={setHeaderErrorMessage}
        onRefresh={value.refresh}
      >
        {children}
      </StudioWorkspaceShell>
    </StudioWorkspaceContext.Provider>
  );
}

export function useStudioWorkspace() {
  const value = useContext(StudioWorkspaceContext);
  if (!value) {
    throw new Error("useStudioWorkspace must be used inside StudioWorkspaceProvider.");
  }
  return value;
}

type StudioWorkspaceShellProps = {
  botId: string;
  versionScope: string;
  headerErrorMessage: string;
  children: ReactNode;
  onHeaderError: (message: string) => void;
  onRefresh: () => Promise<void>;
};

function StudioWorkspaceShell({
  botId,
  versionScope,
  headerErrorMessage,
  children,
  onHeaderError,
  onRefresh,
}: StudioWorkspaceShellProps) {
  const pathname = usePathname();
  const workspace = useStudioWorkspace();
  const { bot, versions } = workspace;
  const activeSection = getWorkspaceSection(pathname);
  const summaryOverrideCacheKey = `${bot.id}:${bot.active_version?.id ?? versionScope}`;
  const [summaryValueOverrides, setSummaryValueOverrides] = useState<Record<string, string>>(() => readWorkspaceSummaryOverrideCache(summaryOverrideCacheKey));
  const setSummaryCardValue = useCallback((label: string, value: string | null) => {
    setSummaryValueOverrides((current) => {
      const next = { ...current };
      if (value == null) {
        delete next[label];
      } else {
        next[label] = value;
      }
      writeWorkspaceSummaryOverrideCache(summaryOverrideCacheKey, next);
      return next;
    });
  }, [summaryOverrideCacheKey]);

  useEffect(() => {
    setSummaryValueOverrides(readWorkspaceSummaryOverrideCache(summaryOverrideCacheKey));
  }, [summaryOverrideCacheKey]);

  useEffect(() => {
    if (!workspace.session || !bot.active_version?.id) {
      return;
    }
    let ignore = false;
    fetchConversationHistory(workspace.session.access_token, { fromDate: workspaceTodayText(), toDate: workspaceTodayText(), pageSize: 500 })
      .then(async (conversations) => {
        if (ignore) return;
        const retrainingBot = await getWorkspaceBotWithFreshRetrainingRecords(workspace.session.access_token, bot);
        if (ignore) return;
        setSummaryCardValue("재학습", String(getWorkspaceRetrainingCount(conversations.items, retrainingBot, versionScope)));
        setSummaryCardValue("분석", computeWorkspaceAnalysisSummary(conversations.items, bot, versionScope));
      })
      .catch(() => {
        if (ignore) return;
      });
    return () => {
      ignore = true;
    };
  }, [
    bot.active_version?.id,
    bot.id,
    bot.name,

    setSummaryCardValue,
    versionScope,
    workspace.session,
  ]);

  const shellValue = useMemo(() => ({
    ...workspace,
    setSummaryCardValue,
  }), [setSummaryCardValue, workspace]);

  if (!activeSection || !bot.active_version) {
    return <>{children}</>;
  }

  const effectiveBotId = bot.id ?? botId;
  const summaryCards = buildWorkspaceSummaryCards(effectiveBotId, versionScope, activeSection, bot)
    .map((item) => ({
      ...item,
      value: summaryValueOverrides[item.label] ?? item.value,
    }));

  return (
    <StudioWorkspaceContext.Provider value={shellValue}>
      <div className="studio-workspace-shell">
      <BotWorkspaceHeader
        bot={bot}
        botId={effectiveBotId}
        currentVersionId={bot.active_version.id}
        fallbackVersionNo={bot.active_version.version_no ?? 1}
        version={bot.active_version}
        versions={versions}
        summaryCards={summaryCards}
        compact={activeSection === "configure"}
        hideSummary={
          activeSection === "intents"
          || activeSection === "entities"
          || activeSection === "dictionary"
          || activeSection === "evaluation"
          || activeSection === "retraining"
          || activeSection === "analysis"
        }
        onError={onHeaderError}
        onTrained={() => void onRefresh()}
      />
      {headerErrorMessage ? <p className="form-message form-message--error">{headerErrorMessage}</p> : null}
      {children}
      </div>
    </StudioWorkspaceContext.Provider>
  );
}
