"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DataGrid, type DataGridRow } from "@/components/data-grid";
import { useI18n } from "@/components/language-provider";
import { StudioPageLoading } from "@/components/studio-page-loading";
import { useStudioWorkspace } from "@/components/studio-workspace-provider";
import { type SummaryStatItem } from "@/components/summary-stat-grid";
import { saveLastBotScreen, type AuthSession } from "@/lib/auth";
import { ANALYSIS_CATALOGS, formatAnalysisText, getAnalysisMethodLabel, type AnalysisCatalog } from "@/lib/i18n/analysis";
import {
  type AdminConversationHistoryItem,
  fetchConversationHistory,
} from "@/lib/admin-api";
import {
  getScenarioTrainingDisabledReason,
  refreshStudioBotSelectedVersion,
  type StudioBotApiItem,
  type StudioBotVersionApiItem,
} from "@/lib/studio-bots-api";

type AnalysisPageClientProps = {
  botId: string;
  versionId: string;
};

type DailyAnalysis = {
  dateKey: string;
  label: string;
  inquiries: number;
  answered: number;
  unanswered: number;
  users: number;
};

type SessionHistoryItem = {
  sessionKey: string;
  representative: AdminConversationHistoryItem;
  startedAt: string;
  firstUtterance: string;
  startIntentOrModuleName: string;
  intentOrKnowledgeName: string;
  channelName: string;
  result: string;
  method: string;
  learningStatus: string;
  messages: Array<Record<string, unknown>>;
};

type UserUtteranceEntry = {
  eventName: string;
  utterance: string;
  occurredAt: string;
};

type ConversationDisplayItem = {
  key: string;
  source: AdminConversationHistoryItem;
  utterance: string;
  startIntentOrModuleName: string;
  intentOrKnowledgeName: string;
  channelName: string;
  result: string;
  method: string;
  learningStatus: string;
  occurredAt: string;
  messages: Array<Record<string, unknown>>;
};

function normalizeConversationChannelName(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "시뮬레이터";
  if (normalized.toLowerCase() === "simulator") return "시뮬레이터";
  return normalized;
}

function AnalysisInfoTip({ text }: { text: string }) {
  return (
    <span
      className="analysis-info-icon"
      tabIndex={0}
      aria-label={text}
      data-help={text}
    >
      i
    </span>
  );
}

function getEntryPayload(item: AdminConversationHistoryItem) {
  const entry = item.data_json?.entry;
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return {};
  }
  const payload = (entry as Record<string, unknown>).payload;
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
}

function getEntryDetail(item: AdminConversationHistoryItem) {
  const payload = getEntryPayload(item);
  const detail = payload.detail;
  return detail && typeof detail === "object" && !Array.isArray(detail)
    ? detail as Record<string, unknown>
    : {};
}

function getEntryLog(item: AdminConversationHistoryItem) {
  const detail = getEntryDetail(item);
  const log = detail.log;
  return log && typeof log === "object" && !Array.isArray(log)
    ? log as Record<string, unknown>
    : {};
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asRecordArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
    : [];
}

function buildVersionAssetHref(
  botId: string,
  versionId: string,
  section: "intents" | "configure" | "qa" | "entities" | "dictionary" | "evaluation" | "retraining" | "analysis",
) {
  return `/studio/bots/${botId}/versions/${versionId}/${section}`;
}

function buildSummaryCards(
  botId: string,
  versionId: string,
  bot: StudioBotApiItem | null,
): SummaryStatItem[] {
  const counts = bot?.active_version?.asset_counts;
  return [
    { label: "의도", value: String(counts?.dialogs ?? counts?.intents ?? 0), href: buildVersionAssetHref(botId, versionId, "intents") },
    { label: "구성", value: "-", href: buildVersionAssetHref(botId, versionId, "configure") },
    { label: "개체", value: String(counts?.entities ?? 0), href: buildVersionAssetHref(botId, versionId, "entities") },
    { label: "사전", value: String(counts?.dictionary ?? 0), href: buildVersionAssetHref(botId, versionId, "dictionary") },
    { label: "평가", value: "-", href: buildVersionAssetHref(botId, versionId, "evaluation") },
    { label: "재학습", value: String(counts?.retraining_records ?? 0), href: buildVersionAssetHref(botId, versionId, "retraining") },
    { label: "분석", value: "-", active: true, href: buildVersionAssetHref(botId, versionId, "analysis") },
  ];
}

function formatMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatKoreanDateTime(value: string, precision: "minute" | "second" = "second") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.replace("T", " ").slice(0, precision === "minute" ? 16 : 19);
  }
  const parts = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: precision === "second" ? "2-digit" : undefined,
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const base = `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
  return precision === "second" ? `${base}:${get("second")}` : base;
}

function localDateKey(value: string) {
  return formatKoreanDateTime(value).slice(0, 10);
}

function parseMonth(value: string) {
  const [year, month] = value.split("-").map((item) => Number(item));
  if (!year || !month) {
    return new Date();
  }
  return new Date(year, month - 1, 1);
}

function shiftMonth(value: string, amount: number) {
  const date = parseMonth(value);
  date.setMonth(date.getMonth() + amount);
  return formatMonth(date);
}

function dayKey(value: string) {
  return localDateKey(value);
}

function monthOf(value: string) {
  return localDateKey(value).slice(0, 7);
}

function isAnswered(item: AdminConversationHistoryItem) {
  return !["미응답", "대화실패", "오류", "진행중"].some((keyword) => item.result.includes(keyword));
}

function getRuntimeEvents(item: AdminConversationHistoryItem) {
  const directEvents = item.data_json?.runtime_events;
  if (Array.isArray(directEvents)) {
    return directEvents.filter((event): event is Record<string, unknown> => (
      !!event && typeof event === "object" && !Array.isArray(event)
    ));
  }
  const payload = getEntryPayload(item);
  const events = payload.runtimeEvents ?? payload.runtime_events;
  return Array.isArray(events)
    ? events.filter((event): event is Record<string, unknown> => (
        !!event && typeof event === "object" && !Array.isArray(event)
      ))
    : [];
}

function nluMethod(value: unknown) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "llm" || normalized.includes("llm")) return "LLM";
  if (normalized.includes("semantic")) return "시멘틱";
  return "ML";
}

function classifyMethod(item: AdminConversationHistoryItem) {
  const terminalEvent = getRuntimeEvents(item).find((event) => [
    "channel.runtime.blocklist_matched",
    "channel.runtime.smalltalk_matched",
    "channel.runtime.exacting_matching_matched",
    "channel.runtime.rule_matched",
    "channel.runtime.intent_matched",
    "channel.runtime.intent_fallback",
  ].includes(String(event.event ?? "")));
  if (terminalEvent) {
    const eventName = String(terminalEvent.event ?? "");
    if (eventName.endsWith("blocklist_matched")) return "제외/무시";
    if (eventName.endsWith("smalltalk_matched")) return "스몰토크";
    if (eventName.endsWith("exacting_matching_matched")) return "Exacting Matching";
    if (eventName.endsWith("rule_matched")) return "룰";
    if (eventName.endsWith("intent_fallback")) return "미응답";
    const data = terminalEvent.data && typeof terminalEvent.data === "object" && !Array.isArray(terminalEvent.data)
      ? terminalEvent.data as Record<string, unknown>
      : {};
    return nluMethod(data.nluType ?? data.nlu_type);
  }

  const payload = getEntryPayload(item);
  const detail = getEntryDetail(item);
  const log = getEntryLog(item);
  const runtime = payload.runtime && typeof payload.runtime === "object" && !Array.isArray(payload.runtime)
    ? payload.runtime as Record<string, unknown>
    : {};
  const raw = String(
    detail.classificationMethod ??
    detail.classification_method ??
    runtime.classificationMethod ??
    runtime.classification_method ??
    log.cardType ??
    "",
  );
  if (/qa/i.test(raw) || item.intent_or_module_name.toUpperCase() === "QA") return "미응답";
  if (/block|ignore|exclude/i.test(raw)) return "제외/무시";
  if (/small/i.test(raw)) return "스몰토크";
  if (/rule|button/i.test(raw)) return "룰";
  if (/exact/i.test(raw)) return "Exacting Matching";
  if (item.intent_or_module_name === "-" || item.intent_or_module_name.includes("미분류")) return "미응답";
  return nluMethod(raw);
}

function responseRate(answered: number, total: number) {
  if (total === 0) return 0;
  return Math.round((answered / total) * 1000) / 10;
}

function buildDailyRows(items: AdminConversationHistoryItem[], month: string): DailyAnalysis[] {
  const daysInMonth = new Date(parseMonth(month).getFullYear(), parseMonth(month).getMonth() + 1, 0).getDate();
  const rows = Array.from({ length: daysInMonth }, (_, index) => {
    const dateKey = `${month}-${String(index + 1).padStart(2, "0")}`;
    return {
      dateKey,
      label: `${String(index + 1).padStart(2, "0")}일`,
      inquiries: 0,
      answered: 0,
      unanswered: 0,
      users: 0,
    };
  });
  const usersByDay = new Map<string, Set<string>>();
  items.forEach((item) => {
    const key = dayKey(item.uttered_at);
    const row = rows.find((candidate) => candidate.dateKey === key);
    if (!row) return;
    row.inquiries += 1;
    if (isAnswered(item)) {
      row.answered += 1;
    } else {
      row.unanswered += 1;
    }
    const users = usersByDay.get(key) ?? new Set<string>();
    users.add(item.user_key);
    usersByDay.set(key, users);
  });
  rows.forEach((row) => {
    row.users = usersByDay.get(row.dateKey)?.size ?? 0;
  });
  return rows;
}

function buildWeekRows(rows: DailyAnalysis[], weekIndex: number) {
  return rows.slice(weekIndex * 7, weekIndex * 7 + 7);
}

function chartBarHeight(value: number, maxValue: number) {
  if (value <= 0) {
    return "0px";
  }
  return `${Math.max(14, Math.round((value / Math.max(maxValue, 1)) * 148))}px`;
}

function getChannels(items: AdminConversationHistoryItem[]) {
  const values = [...new Set(items.map((item) => normalizeConversationChannelName(item.channel_name)))];
  return values.length > 0 ? values : ["시뮬레이터"];
}

function getUserUtterance(item: AdminConversationHistoryItem) {
  const payload = getEntryPayload(item);
  const detail = getEntryDetail(item);
  const log = getEntryLog(item);
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

  const candidates = [
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
  ];
  const found = candidates.find((value) => typeof value === "string" && value.trim());
  return typeof found === "string" ? found : "-";
}

function normalizeDisplayText(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim();
}

function isInternalUtterance(value: unknown) {
  const normalized = normalizeDisplayText(value);
  if (!normalized || normalized === "-") return true;
  if (["END", "START", "__END__", "[END]"].includes(normalized.toUpperCase())) return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized);
}

function isCardNodeName(value: unknown) {
  const normalized = normalizeDisplayText(value);
  return /^(talk|rich\s*form)\s*\d*$/i.test(normalized);
}

function visibleConversationText(message: Record<string, unknown>) {
  return firstTextValue([
    message.text,
    message.display_text,
    message.displayText,
  ]);
}

function isVisibleConversationMessage(message: Record<string, unknown>) {
  const kind = String(message.participant_kind ?? "").toLowerCase();
  if (kind !== "user") {
    return true;
  }
  return !isInternalUtterance(visibleConversationText(message));
}

function firstTextValue(values: unknown[]) {
  return values
    .map((value) => normalizeDisplayText(value))
    .find((value) => value && value !== "-" && !isCardNodeName(value)) ?? "";
}

function getLearningStatus(item: AdminConversationHistoryItem) {
  const payload = getEntryPayload(item);
  const detail = getEntryDetail(item);
  const log = getEntryLog(item);
  const data = item.data_json ?? {};
  const raw = firstTextValue([
    data.learning_status,
    data.learningStatus,
    payload.learningStatus,
    payload.learning_status,
    detail.learningStatus,
    detail.learning_status,
    log.learningStatus,
    log.learning_status,
  ]);
  return raw || "-";
}

function getIntentOrKnowledgeName(item: AdminConversationHistoryItem) {
  const payload = getEntryPayload(item);
  const detail = getEntryDetail(item);
  const log = getEntryLog(item);
  const runtime = asRecord(payload.runtime);
  const data = item.data_json ?? {};
  const runtimeEvents = getRuntimeEvents(item);
  const eventNames = runtimeEvents
    .map((event) => {
      const eventData = asRecord(event.data);
      return firstTextValue([
        eventData.intentName,
        eventData.intent_name,
        eventData.knowledgeName,
        eventData.knowledge_name,
        eventData.moduleName,
        eventData.module_name,
        eventData.dialogName,
        eventData.dialog_name,
      ]);
    })
    .filter(Boolean);
  const raw = firstTextValue([
    data.module_name,
    data.moduleName,
    data.intent_name,
    data.intentName,
    data.knowledge_name,
    data.knowledgeName,
    payload.moduleName,
    payload.module_name,
    payload.intentName,
    payload.intent_name,
    payload.knowledgeName,
    payload.knowledge_name,
    detail.moduleName,
    detail.module_name,
    detail.intentName,
    detail.intent_name,
    detail.knowledgeName,
    detail.knowledge_name,
    runtime.moduleName,
    runtime.module_name,
    runtime.intentName,
    runtime.intent_name,
    runtime.knowledgeName,
    runtime.knowledge_name,
    log.moduleName,
    log.module_name,
    log.intentName,
    log.intent_name,
    log.knowledgeName,
    log.knowledge_name,
    ...eventNames,
    item.intent_or_module_name,
  ]);
  return raw || "-";
}

function getStartIntentOrModuleName(item: AdminConversationHistoryItem) {
  const payload = getEntryPayload(item);
  const detail = getEntryDetail(item);
  const log = getEntryLog(item);
  const runtime = asRecord(payload.runtime);
  const data = item.data_json ?? {};
  const runtimeEvents = getRuntimeEvents(item);
  const firstRuntimeName = runtimeEvents
    .map((event) => {
      const eventData = asRecord(event.data);
      return firstTextValue([
        eventData.startModuleName,
        eventData.start_module_name,
        eventData.moduleName,
        eventData.module_name,
        eventData.dialogName,
        eventData.dialog_name,
        eventData.startIntentName,
        eventData.start_intent_name,
        eventData.intentName,
        eventData.intent_name,
      ]);
    })
    .find(Boolean);

  const raw = firstTextValue([
    data.session_start_module_name,
    data.sessionStartModuleName,
    data.session_start_intent_name,
    data.sessionStartIntentName,
    data.start_dialog_name,
    data.startDialogName,
    data.dialog_name,
    data.dialogName,
    data.start_module_name,
    data.startModuleName,
    data.module_name,
    data.moduleName,
    data.start_intent_name,
    data.startIntentName,
    data.intent_name,
    data.intentName,
    payload.sessionStartModuleName,
    payload.session_start_module_name,
    payload.sessionStartIntentName,
    payload.session_start_intent_name,
    payload.startDialogName,
    payload.start_dialog_name,
    payload.dialogName,
    payload.dialog_name,
    payload.startModuleName,
    payload.start_module_name,
    payload.moduleName,
    payload.module_name,
    payload.startIntentName,
    payload.start_intent_name,
    payload.intentName,
    payload.intent_name,
    detail.sessionStartModuleName,
    detail.session_start_module_name,
    detail.sessionStartIntentName,
    detail.session_start_intent_name,
    detail.startDialogName,
    detail.start_dialog_name,
    detail.dialogName,
    detail.dialog_name,
    detail.startModuleName,
    detail.start_module_name,
    detail.moduleName,
    detail.module_name,
    detail.startIntentName,
    detail.start_intent_name,
    detail.intentName,
    detail.intent_name,
    runtime.sessionStartModuleName,
    runtime.session_start_module_name,
    runtime.sessionStartIntentName,
    runtime.session_start_intent_name,
    runtime.startDialogName,
    runtime.start_dialog_name,
    runtime.dialogName,
    runtime.dialog_name,
    runtime.startModuleName,
    runtime.start_module_name,
    runtime.moduleName,
    runtime.module_name,
    runtime.startIntentName,
    runtime.start_intent_name,
    runtime.intentName,
    runtime.intent_name,
    log.sessionStartModuleName,
    log.session_start_module_name,
    log.sessionStartIntentName,
    log.session_start_intent_name,
    log.startDialogName,
    log.start_dialog_name,
    log.dialogName,
    log.dialog_name,
    log.startModuleName,
    log.start_module_name,
    log.moduleName,
    log.module_name,
    log.startIntentName,
    log.start_intent_name,
    log.intentName,
    log.intent_name,
    firstRuntimeName,
    item.intent_or_module_name,
  ]);
  return raw || "-";
}

function getSubmittedUserUtterances(item: AdminConversationHistoryItem): UserUtteranceEntry[] {
  const data = item.data_json ?? {};
  const entries = asRecordArray(data.entries);
  const directEntries = entries
    .map((entry) => {
      const payload = asRecord(entry.payload);
      const detail = asRecord(payload.detail);
      const log = asRecord(detail.log);
      const eventName = String(entry.event ?? entry.event_name ?? payload.event ?? "").trim();
      const utterance = firstTextValue([
        detail.utterance,
        detail.userUtterance,
        log.utterance,
        log.userUtterance,
      ]);
      const occurredAt = firstTextValue([entry.server_time, entry.serverTime, entry.created_at, entry.createdAt, item.uttered_at]);
      return { eventName, utterance, occurredAt };
    })
    .filter((entry) => entry.eventName === "simulator.user_message" && !isInternalUtterance(entry.utterance));
  if (directEntries.length > 0) {
    return directEntries;
  }

  const rawUtterances = Array.isArray(data.session_user_raw_utterances)
    ? data.session_user_raw_utterances
    : Array.isArray(data.session_user_utterances)
      ? data.session_user_utterances
      : [];
  const fromSession = rawUtterances
    .map((utterance) => ({ eventName: "session.user_message", utterance: firstTextValue([utterance]), occurredAt: item.uttered_at }))
    .filter((entry) => !isInternalUtterance(entry.utterance));
  if (fromSession.length > 0) {
    return fromSession;
  }

  const messageEntries = getSessionMessages(item)
    .filter((message) => String(message.participant_kind ?? "").toLowerCase() === "user")
    .map((message) => ({
      eventName: "message.user",
      utterance: firstTextValue([message.display_text, message.text]),
      occurredAt: firstTextValue([message.created_at, item.uttered_at]),
    }))
    .filter((entry) => !isInternalUtterance(entry.utterance));
  if (messageEntries.length > 0) {
    return messageEntries;
  }

  const fallbackUtterance = firstTextValue([getUserUtterance(item)]);
  return isInternalUtterance(fallbackUtterance)
    ? []
    : [{ eventName: "history.user", utterance: fallbackUtterance, occurredAt: item.uttered_at }];
}

function getSessionKey(item: AdminConversationHistoryItem) {
  const roomId = String(item.data_json?.room_id ?? "").trim();
  if (roomId) {
    return `room:${roomId}`;
  }
  const clientRoomId = String(item.data_json?.client_room_id ?? "").trim();
  if (clientRoomId) {
    return `client:${clientRoomId}`;
  }
  return `user:${item.user_key || item.id}`;
}

function getSessionMessages(item: AdminConversationHistoryItem) {
  return Array.isArray(item.data_json?.messages)
    ? item.data_json.messages.filter((message): message is Record<string, unknown> => (
        !!message && typeof message === "object" && !Array.isArray(message)
      ))
    : [];
}

function getSessionStartTime(item: AdminConversationHistoryItem, messages: Array<Record<string, unknown>>) {
  const userMessageTimes = messages
    .filter((message) => String(message.participant_kind ?? "").toLowerCase() === "user")
    .map((message) => String(message.created_at ?? "").trim())
    .filter(Boolean)
    .sort();
  if (userMessageTimes.length > 0) {
    return userMessageTimes[0];
  }
  return item.uttered_at;
}

function getFirstUserMessageText(item: AdminConversationHistoryItem, messages: Array<Record<string, unknown>>) {
  const firstUserText = messages
    .find((message) => String(message.participant_kind ?? "").toLowerCase() === "user" && String(message.text ?? "").trim());
  if (firstUserText) {
    return String(firstUserText.text ?? "").trim();
  }
  return getUserUtterance(item);
}

function buildSessionHistory(items: AdminConversationHistoryItem[]) {
  return buildConversationDisplayItems(items).map((item) => ({
    sessionKey: item.key,
    representative: item.source,
    startedAt: item.occurredAt,
    firstUtterance: item.utterance,
    startIntentOrModuleName: item.startIntentOrModuleName,
    intentOrKnowledgeName: item.intentOrKnowledgeName,
    channelName: item.channelName,
    result: item.result,
    method: item.method,
    learningStatus: item.learningStatus,
    messages: item.messages,
  }));
}

function buildConversationDisplayItems(items: AdminConversationHistoryItem[]): ConversationDisplayItem[] {
  return items.flatMap((item) => {
    const messages = getSessionMessages(item);
    const utterances = getSubmittedUserUtterances(item);
    if (utterances.length === 0) {
      return [];
    }
    const intentOrKnowledgeName = getIntentOrKnowledgeName(item);
    const startIntentOrModuleName = getStartIntentOrModuleName(item);
    return utterances.map((utterance, index) => ({
      key: `${item.id}:${index}:${utterance.occurredAt}`,
      source: item,
      utterance: utterance.utterance,
      startIntentOrModuleName,
      intentOrKnowledgeName,
      channelName: normalizeConversationChannelName(item.channel_name),
      result: item.result,
      method: classifyMethod(item),
      learningStatus: getLearningStatus(item),
      occurredAt: utterance.occurredAt || item.uttered_at,
      messages,
    }));
  }).sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

function buildTopIntentItems(items: AdminConversationHistoryItem[]) {
  const groups = new Map<string, { name: string; method: string; count: number; answered: number }>();
  items.forEach((item) => {
    const name = getStartIntentOrModuleName(item) || getIntentOrKnowledgeName(item);
    if (!name || name === "-") {
      return;
    }
    const method = classifyMethod(item);
    const current = groups.get(name) ?? { name, method, count: 0, answered: 0 };
    current.count += 1;
    if (isAnswered(item)) {
      current.answered += 1;
    }
    if (current.method === "미응답" && method !== "미응답") {
      current.method = method;
    }
    groups.set(name, current);
  });
  return Array.from(groups.values()).sort((left, right) => right.count - left.count).slice(0, 5);
}

function makeHistoryRows(
  items: SessionHistoryItem[],
  onSelect: (item: SessionHistoryItem) => void,
  copy: AnalysisCatalog,
  limit?: number,
): DataGridRow[] {
  const targetItems = typeof limit === "number" ? items.slice(0, limit) : items;
  return targetItems.map((item) => ({
    key: item.sessionKey,
    cells: [
      <button
        type="button"
        className="analysis-history-link"
        onClick={() => onSelect(item)}
      >
        {item.firstUtterance}
      </button>,
      item.startIntentOrModuleName,
      item.result,
      formatKoreanDateTime(item.startedAt),
    ],
  }));
}

function versionLabel(value?: number | null) {
  return typeof value === "number" && value > 0 ? `v${value}` : "-";
}

function conversationProgressSummary(item: AdminConversationHistoryItem) {
  const data = item.data_json ?? {};
  const runtimeSummary = firstTextValue([
    data.runtime_summary,
    data.runtimeSummary,
    data.problem_location,
    data.problemLocation,
  ]);
  return runtimeSummary || item.result || "정상";
}

function makeConversationLookupRows(
  items: SessionHistoryItem[],
  onSelect: (item: SessionHistoryItem) => void,
  copy: AnalysisCatalog,
): DataGridRow[] {
  return items.map((item) => ({
    key: `lookup-${item.sessionKey}`,
    cells: [
      <button
        key="detail"
        type="button"
        className="analysis-history-link"
        onClick={() => onSelect(item)}
      >
        {copy.details}
      </button>,
      item.representative.group_name,
      item.representative.bot_name,
      versionLabel(item.representative.version_no),
      <button
        key="utterance"
        type="button"
        className="analysis-history-link"
        onClick={() => onSelect(item)}
      >
        {item.firstUtterance}
      </button>,
      item.startIntentOrModuleName,
      formatKoreanDateTime(item.startedAt),
      item.result,
      conversationProgressSummary(item.representative),
    ],
  }));
}

function makeHubHistoryRows(items: AdminConversationHistoryItem[], copy: AnalysisCatalog): DataGridRow[] {
  return items.slice(0, 8).map((item) => ({
    key: item.id,
    cells: [
      formatKoreanDateTime(item.uttered_at, "minute"),
      item.bot_name,
      getAnalysisMethodLabel(copy, classifyMethod(item)),
      item.intent_or_module_name === "-" ? item.result : item.intent_or_module_name,
    ],
  }));
}

export function AnalysisPageClient({ botId: routeBotId, versionId }: AnalysisPageClientProps) {
  const workspace = useStudioWorkspace();
  const { language: uiLanguage } = useI18n();
  const copy = ANALYSIS_CATALOGS[uiLanguage];
  const pathname = usePathname();
  const botId = useMemo(() => decodeURIComponent(routeBotId), [routeBotId]);
  const versionName = useMemo(() => decodeURIComponent(versionId), [versionId]);
  const [authSession, setAuthSession] = useState<AuthSession | null>(workspace.session);
  const [bot, setBot] = useState<StudioBotApiItem | null>(workspace.bot);
  const [versions, setVersions] = useState<StudioBotVersionApiItem[]>(workspace.versions);
  const [conversationRows, setConversationRows] = useState<AdminConversationHistoryItem[]>([]);
  const [month, setMonth] = useState(formatMonth(new Date()));
  const [monthTouched, setMonthTouched] = useState(false);
  const [channel, setChannel] = useState("시뮬레이터");
  const [selectedDate, setSelectedDate] = useState("");
  const [weekIndex, setWeekIndex] = useState(0);
  const [hubQuery, setHubQuery] = useState("");
  const [hubMethod, setHubMethod] = useState("");
  const [hubResult, setHubResult] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedHistory, setSelectedHistory] = useState<SessionHistoryItem | null>(null);
  const [showSelectedDateHistory, setShowSelectedDateHistory] = useState(false);

  useEffect(() => {
    setAuthSession(workspace.session);
    setBot(workspace.bot);
    setVersions(workspace.versions);
    let ignore = false;
    setLoading(conversationRows.length === 0);
    setErrorMessage("");
    fetchConversationHistory(workspace.session.access_token)
      .then((conversations) => {
        if (ignore) return;
        setConversationRows(conversations.items);
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : copy.loadFailed);
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [workspace.bot, workspace.session, workspace.versions]);

  useEffect(() => {
    if (pathname && bot && !errorMessage) {
      saveLastBotScreen(pathname);
    }
  }, [pathname, bot, errorMessage]);
  const effectiveBotId = bot?.id ?? botId;  const effectiveVersion = bot?.active_version ?? versions.find((version) => version.name === versionName || version.id === versionName) ?? null;
  const effectiveVersionName = effectiveVersion?.name ?? versionName;
  const trainingDisabledReason = getScenarioTrainingDisabledReason(effectiveVersion);

  async function refreshCurrentVersionState() {
    if (!authSession || !effectiveVersion) {
      return;
    }

    try {
      const refreshed = await refreshStudioBotSelectedVersion(
        authSession.access_token,
        effectiveBotId,
        effectiveVersionName,
        effectiveVersion.id,
        false,
      );
      setVersions(refreshed.versions);
      setBot(refreshed.bot);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : copy.refreshFailed);
    }
  }
  const botRows = useMemo(
    () => conversationRows.filter((item) => {
      const payload = getEntryPayload(item);
      const rowBotId = String(payload.botId ?? "");
      const rowVersionId = String(payload.versionId ?? "");
      const botMatched =
        item.bot_name === bot?.name ||
        rowBotId === effectiveBotId ||
        (!!bot?.id && rowBotId === bot.id);
      const versionMatched =
        !effectiveVersion?.id ||
        !rowVersionId ||
        rowVersionId === effectiveVersion.id ||
        rowVersionId === effectiveVersionName;
      return botMatched && versionMatched;
    }),
    [bot?.id, bot?.name, conversationRows, effectiveBotId, effectiveVersion?.id, effectiveVersionName],
  );
  const channels = useMemo(() => getChannels(botRows), [botRows]);
  const selectedChannel = channels.includes(channel) ? channel : channels[0] ?? "시뮬레이터";
  const visibleRows = useMemo(
    () => botRows.filter((item) => normalizeConversationChannelName(item.channel_name) === selectedChannel && monthOf(item.uttered_at) === month),
    [botRows, month, selectedChannel],
  );
  const cumulativeRows = useMemo(
    () => botRows.filter((item) => normalizeConversationChannelName(item.channel_name) === selectedChannel),
    [botRows, selectedChannel],
  );
  const latestDataMonth = cumulativeRows[0] ? monthOf(cumulativeRows[0].uttered_at) : "";
  const dailyRows = useMemo(() => buildDailyRows(visibleRows, month), [month, visibleRows]);
  const weekRows = useMemo(() => buildWeekRows(dailyRows, weekIndex), [dailyRows, weekIndex]);
  const selectedDayRows = useMemo(
    () => visibleRows.filter((item) => dayKey(item.uttered_at) === selectedDate),
    [selectedDate, visibleRows],
  );
  const visibleDisplayRows = useMemo(() => buildConversationDisplayItems(visibleRows), [visibleRows]);
  const cumulativeDisplayRows = useMemo(() => buildConversationDisplayItems(cumulativeRows), [cumulativeRows]);
  const selectedRowsForTable = useMemo(
    () => buildSessionHistory(selectedDate ? selectedDayRows : visibleRows),
    [selectedDate, selectedDayRows, visibleRows],
  );
  const totalAnswered = visibleDisplayRows.filter((item) => isAnswered(item.source)).length;
  const cumulativeAnswered = cumulativeDisplayRows.filter((item) => isAnswered(item.source)).length;
  const methodCounts = useMemo(() => {
    const counts = new Map<string, number>();
    cumulativeRows.forEach((item) => {
      const method = classifyMethod(item);
      counts.set(method, (counts.get(method) ?? 0) + 1);
    });
    return ["제외/무시", "스몰토크", "Exacting Matching", "룰", "ML", "시멘틱", "LLM", "미응답"].map((method) => ({
      method,
      count: counts.get(method) ?? 0,
    }));
  }, [cumulativeRows]);
  const periodMethodCounts = useMemo(() => {
    const counts = new Map<string, number>();
    visibleDisplayRows.filter((item) => isAnswered(item.source)).forEach((item) => {
      const method = item.method;
      counts.set(method, (counts.get(method) ?? 0) + 1);
    });
    return ["제외/무시", "스몰토크", "Exacting Matching", "룰", "ML", "시멘틱", "LLM"].map((method) => ({
      method,
      count: counts.get(method) ?? 0,
    }));
  }, [visibleDisplayRows]);
  const topIntents = useMemo(() => buildTopIntentItems(visibleRows), [visibleRows]);
  const maxDailyValue = Math.max(...weekRows.map((row) => Math.max(row.inquiries, row.answered, row.users)), 1);
  const maxWeekIndex = Math.max(0, Math.ceil(dailyRows.length / 7) - 1);
  const syncWeekSelection = useCallback((nextIndex: number) => {
    const clampedIndex = Math.max(0, Math.min(maxWeekIndex, nextIndex));
    const nextWeekRows = buildWeekRows(dailyRows, clampedIndex);
    setWeekIndex(clampedIndex);
    if (nextWeekRows.length === 0) {
      setSelectedDate("");
      return;
    }
    const nextSelectedDate = nextWeekRows.at(-1)?.dateKey ?? nextWeekRows[0].dateKey;
    if (nextSelectedDate && nextSelectedDate !== selectedDate) {
      setSelectedDate(nextSelectedDate);
    }
  }, [dailyRows, maxWeekIndex, selectedDate]);
  const isHub = bot?.data_json?.bot_kind === "hub";
  const hubRows = useMemo(() => {
    return visibleRows.filter((item) => {
      const method = classifyMethod(item);
      if (hubQuery && !item.bot_name.toLowerCase().includes(hubQuery.trim().toLowerCase())) return false;
      if (hubMethod && method !== hubMethod) return false;
      if (hubResult && !item.result.includes(hubResult)) return false;
      return true;
    });
  }, [hubMethod, hubQuery, hubResult, visibleRows]);

  useEffect(() => {
    if (!monthTouched && visibleRows.length === 0 && latestDataMonth && latestDataMonth !== month) {
      setMonth(latestDataMonth);
    }
  }, [latestDataMonth, month, monthTouched, visibleRows.length]);

  useEffect(() => {
    const latestDate = visibleRows[0] ? dayKey(visibleRows[0].uttered_at) : "";
    if (!selectedDate || (selectedDate && !dailyRows.some((row) => row.dateKey === selectedDate))) {
      setSelectedDate(latestDate);
    }
  }, [dailyRows, selectedDate, visibleRows]);

  useEffect(() => {
    if (!selectedDate) {
      return;
    }
    const nextWeekIndex = Math.floor((Number(selectedDate.slice(8, 10)) - 1) / 7);
    if (Number.isFinite(nextWeekIndex) && nextWeekIndex !== weekIndex) {
      setWeekIndex(nextWeekIndex);
    }
  }, [selectedDate, weekIndex]);

  useEffect(() => {
    if (weekIndex > maxWeekIndex) {
      setWeekIndex(maxWeekIndex);
    }
  }, [maxWeekIndex, weekIndex]);

  useEffect(() => {
    if (loading) {
      return;
    }
    workspace.setSummaryCardValue("분석", `${responseRate(totalAnswered, visibleDisplayRows.length)}%`);
  }, [loading, totalAnswered, visibleDisplayRows.length, workspace.setSummaryCardValue]);

  if (!bot || !effectiveVersion) {
    return <StudioPageLoading title={copy.loading} />;
  }

  return (
    <section className="analysis-page">

      {errorMessage ? <p className="analysis-page__error">{errorMessage}</p> : null}

      <div className="analysis-page__filters">
        <select value={selectedChannel} onChange={(event) => setChannel(event.target.value)} aria-label={copy.channelSelect}>
          {channels.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button type="button" onClick={() => {
          setMonthTouched(true);
          setMonth((current) => shiftMonth(current, -1));
        }}>‹</button>
        <strong>{month}</strong>
        <button type="button" onClick={() => {
          setMonthTouched(true);
          setMonth((current) => shiftMonth(current, 1));
        }}>›</button>
      </div>

      {isHub ? (
        <div className="analysis-hub">
          <section className="analysis-panel analysis-panel--hub-rate">
            <h3>{copy.responseOverviewTitle}</h3>
            <div className="analysis-hub-rate">
              <div>
                <strong>{responseRate(totalAnswered, visibleDisplayRows.length)}%</strong>
                <span>{copy.totalResponseRate}</span>
              </div>
              {topIntents.slice(0, 3).map((item) => (
                <div key={item.name}>
                  <strong>{responseRate(item.answered, item.count)}%</strong>
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="analysis-panel analysis-panel--hub-history">
            <h3>{copy.hubHistory}</h3>
            <div className="analysis-hub__search">
              <input value={hubQuery} onChange={(event) => setHubQuery(event.target.value)} placeholder={copy.botName} />
              <select value={hubMethod} onChange={(event) => setHubMethod(event.target.value)}>
                <option value="">{copy.allMethods}</option>
                <option value="제외/무시">{getAnalysisMethodLabel(copy, "제외/무시")}</option>
                <option value="스몰토크">{getAnalysisMethodLabel(copy, "스몰토크")}</option>
                <option value="Exacting Matching">{getAnalysisMethodLabel(copy, "Exacting Matching")}</option>
                <option value="룰">{getAnalysisMethodLabel(copy, "룰")}</option>
                <option value="ML">ML</option>
                <option value="시멘틱">{getAnalysisMethodLabel(copy, "시멘틱")}</option>
                <option value="LLM">LLM</option>
              </select>
              <select value={hubResult} onChange={(event) => setHubResult(event.target.value)}>
                <option value="">{copy.allResults}</option>
                <option value="응답">{copy.classified}</option>
                <option value="유사">{copy.similarIntent}</option>
                <option value="미응답">{copy.unclassified}</option>
              </select>
              <button type="button" onClick={() => { setHubQuery(""); setHubMethod(""); setHubResult(""); }}>{copy.reset}</button>
            </div>
            <DataGrid
              variant="studio"
              template="150px 1fr 140px 180px"
              columns={[copy.utteredAt, copy.botName, copy.classificationMethod, copy.classificationResult]}
              rows={makeHubHistoryRows(hubRows, copy)}
            />
          </section>
        </div>
      ) : (
        <>
          <div className="analysis-page__summary">
            <h2>
              {copy.cumulativeVolume}
                <AnalysisInfoTip text={copy.cumulativeHelp} />
            </h2>
            <div className="analysis-page__legend">
              {methodCounts.map((item) => (
                <span key={item.method}>{getAnalysisMethodLabel(copy, item.method)} {cumulativeRows.length ? Math.round((item.count / cumulativeRows.length) * 100) : 0}% ({item.count} {copy.cases})</span>
              ))}
            </div>
          </div>

          <div className="analysis-dashboard analysis-dashboard--manual">
            <section className="analysis-panel analysis-panel--ring">
              <h3>
                {copy.periodVolume}
                <AnalysisInfoTip text={copy.periodHelp} />
              </h3>
              <div className="analysis-ring">
                <div className="analysis-ring__circle">
                  <strong>{responseRate(totalAnswered, visibleDisplayRows.length)}%</strong>
                  <span>{copy.responseRate}</span>
                  <small>{totalAnswered} / {visibleDisplayRows.length}</small>
                </div>
                <div className="analysis-ring__breakdown">
                  <div className="analysis-ring__breakdown-head">
                    <span />
                    <span>{copy.ratio}</span>
                    <span>{copy.cases}</span>
                  </div>
                  <div className="analysis-ring__breakdown-row analysis-ring__breakdown-row--group">
                    <strong>{copy.response}</strong>
                    <span>{responseRate(totalAnswered, visibleDisplayRows.length)}%</span>
                    <span>{totalAnswered}</span>
                  </div>
                  {periodMethodCounts.map((item) => (
                    <div className="analysis-ring__breakdown-row" key={item.method}>
                      <strong>{getAnalysisMethodLabel(copy, item.method)}</strong>
                      <span>{responseRate(item.count, visibleDisplayRows.length)}%</span>
                      <span>{item.count}</span>
                    </div>
                  ))}
                  <div className="analysis-ring__breakdown-row analysis-ring__breakdown-row--group">
                    <strong>{copy.noResponse}</strong>
                    <span>{responseRate(visibleDisplayRows.length - totalAnswered, visibleDisplayRows.length)}%</span>
                    <span>{visibleDisplayRows.length - totalAnswered}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="analysis-panel">
              <div className="analysis-panel__title-row">
                <h3>
                  {copy.periodTrend}
                  <AnalysisInfoTip text={copy.periodTrendHelp} />
                </h3>
              </div>
              <div className="analysis-period-legend" aria-label={copy.periodLegend}>
                <span className="is-user">{copy.userUtterance}</span>
                <span className="is-inquiry">{copy.inquiry}</span>
                <span className="is-answer">{copy.response}</span>
                <span className="is-user-count">{copy.userCount}</span>
              </div>
              <div className="analysis-period-chart">
                <button
                  type="button"
                  className="analysis-period-chart__move analysis-period-chart__move--prev"
                  onClick={() => syncWeekSelection(weekIndex - 1)}
                  aria-label={copy.previousWeek}
                >
                  ‹
                </button>
                <div className="analysis-chart analysis-chart--manual">
                {weekRows.map((row) => (
                  <button
                    type="button"
                    key={row.dateKey}
                    className={selectedDate === row.dateKey ? "is-active" : ""}
                    onClick={() => setSelectedDate(row.dateKey)}
                  >
                    <span className="is-user" style={{ height: chartBarHeight(row.inquiries, maxDailyValue) }} />
                    <span className="is-inquiry" style={{ height: chartBarHeight(row.inquiries, maxDailyValue) }} />
                    <span className="is-answer" style={{ height: chartBarHeight(row.answered, maxDailyValue) }} />
                    <i>{row.users}</i>
                    <em>{row.label}</em>
                  </button>
                ))}
                </div>
                <button
                  type="button"
                  className="analysis-period-chart__move analysis-period-chart__move--next"
                  onClick={() => syncWeekSelection(weekIndex + 1)}
                  aria-label={copy.nextWeek}
                >
                  ›
                </button>
              </div>
              <div className="analysis-period-chart__pages" aria-label={copy.weekPages}>
                {Array.from({ length: Math.max(1, Math.ceil(dailyRows.length / 7)) }, (_, index) => (
                  <button
                    type="button"
                    key={index}
                    className={index === weekIndex ? "is-active" : ""}
                    onClick={() => syncWeekSelection(index)}
                    aria-label={formatAnalysisText(copy.week, { count: index + 1 })}
                  />
                ))}
              </div>
              <button
                type="button"
                className={`studio-table-page__ghost${selectedDate ? "" : " is-disabled"}`}
                disabled={!selectedDate}
                onClick={() => setShowSelectedDateHistory(true)}
              >
                {copy.selectedDateAll}
              </button>
            </section>

            <section className="analysis-panel">
              <h3>
                {copy.topInquiries}
                <AnalysisInfoTip text={copy.topInquiriesHelp} />
              </h3>
              <DataGrid
                variant="studio"
                template="64px 1fr 120px 90px 90px"
                columns={[copy.rank, copy.intentModuleName, copy.classificationMethod, copy.count, copy.responseRate]}
                rows={topIntents.map((item, index) => ({
                  key: item.name,
                  cells: [String(index + 1), item.name, getAnalysisMethodLabel(copy, item.method), String(item.count), `${responseRate(item.answered, item.count)}%`],
                }))}
              />
            </section>

            <section className="analysis-panel">
              <h3>
                {copy.selectedDateHistory}
                <AnalysisInfoTip text={copy.selectedDateHistoryHelp} />
              </h3>
              <DataGrid
                variant="studio"
                template="1.6fr 1.2fr 1fr 150px"
                columns={[
                  copy.userUtterance,
                  copy.intentModuleName,
                  copy.executionResult,
                  copy.occurredAt,
                ]}
                rows={makeHistoryRows(selectedRowsForTable, setSelectedHistory, copy, 5)}
              />
            </section>
          </div>
        </>
      )}
      {showSelectedDateHistory ? (
        <div className="analysis-conversation-backdrop" role="presentation" onMouseDown={() => setShowSelectedDateHistory(false)}>
          <section
            className="analysis-conversation-dialog analysis-conversation-dialog--list"
            role="dialog"
            aria-modal="true"
            aria-label={copy.selectedDateAll}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <strong>{copy.selectedDateAll}</strong>
                <span>{selectedDate || copy.noSelectedDate} · {selectedRowsForTable.length} {copy.cases}</span>
              </div>
              <button type="button" onClick={() => setShowSelectedDateHistory(false)} aria-label={copy.close}>×</button>
            </header>
            <div className="analysis-conversation-dialog__table">
              <DataGrid
                variant="studio"
                template="64px 130px 140px 72px minmax(220px, 1fr) 170px 160px minmax(220px, 1fr)"
                columns={[
                  "",
                  copy.group,
                  copy.bot,
                  copy.version,
                  copy.userUtterance,
                  copy.intentModuleName,
                  copy.utteredAt,
                  copy.executionResult,
                  copy.errorProgress,
                ]}
                rows={makeConversationLookupRows(selectedRowsForTable, setSelectedHistory, copy)}
              />
            </div>
          </section>
        </div>
      ) : null}
      {selectedHistory ? (
        <div className="analysis-conversation-backdrop" role="presentation" onMouseDown={() => setSelectedHistory(null)}>
          <section
            className="analysis-conversation-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={copy.conversationDetail}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <strong>{selectedHistory.representative.bot_name}</strong>
                <span>{formatKoreanDateTime(selectedHistory.startedAt)}</span>
              </div>
              <button type="button" onClick={() => setSelectedHistory(null)} aria-label={copy.close}>×</button>
            </header>
            <div className="analysis-conversation-dialog__summary">
              <span>{copy.classificationMethod} <strong>{getAnalysisMethodLabel(copy, classifyMethod(selectedHistory.representative))}</strong></span>
              <span>{copy.intentKnowledge} <strong>{selectedHistory.intentOrKnowledgeName}</strong></span>
              <span>{copy.executionResult} <strong>{selectedHistory.result}</strong></span>
            </div>
            <div className="analysis-conversation-dialog__messages">
              {selectedHistory.messages.filter(isVisibleConversationMessage).length > 0
                ? selectedHistory.messages.filter(isVisibleConversationMessage).map((message, index) => {
                    const item = message && typeof message === "object" && !Array.isArray(message)
                      ? message as Record<string, unknown>
                      : {};
                    const isUser = String(item.participant_kind ?? "").toLowerCase() === "user";
                    return (
                      <article className={isUser ? "is-user" : "is-bot"} key={String(item.id ?? index)}>
                        <small>{String(item.participant_name ?? (isUser ? copy.user : selectedHistory.representative.bot_name))}</small>
                        <p>{visibleConversationText(item) || "-"}</p>
                        <time>{formatKoreanDateTime(String(item.created_at ?? ""))}</time>
                      </article>
                    );
                  })
                : (
                  <article className="is-user">
                    <small>{copy.user}</small>
                    <p>{selectedHistory.firstUtterance}</p>
                    <time>{formatKoreanDateTime(selectedHistory.startedAt)}</time>
                  </article>
                )}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
