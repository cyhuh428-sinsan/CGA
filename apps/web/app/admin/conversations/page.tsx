"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import { AdminHistoryTablePage } from "@/components/admin-history-table-page";
import { useI18n } from "@/components/language-provider";
import { fetchConversationHistory, type AdminConversationHistoryItem } from "@/lib/admin-api";
import {
  ADMIN_CONVERSATION_CATALOGS,
  ADMIN_CONVERSATION_RUNTIME_CATALOGS,
  type AdminConversationRuntimeCatalog,
} from "@/lib/i18n/admin-conversations";
import { SUPPORTED_LANGUAGES } from "@/lib/language";

function formatDate(value: string, locale = "ko-KR") {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatDateTime(value: string, locale = "ko-KR") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.replace("T", " ").slice(0, 19);
  }
  const parts = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function parseJsonLike(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return value;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function firstReadableString(value: unknown, visited?: Set<object>): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed && !trimmed.includes("webchatRichFormVersion")) {
      return trimmed;
    }
    return "";
  }
  if (!visited) {
    visited = new Set<object>();
  }
  if (Array.isArray(value)) {
    if (visited.has(value)) {
      return "";
    }
    visited.add(value);
    for (const item of value) {
      const found = firstReadableString(item, visited);
      if (found) return found;
    }
    return "";
  }
  const record = asRecord(value);
  if (!Object.keys(record).length) {
    return "";
  }
  if (visited.has(record)) {
    return "";
  }
  visited.add(record);
  for (const key of ["label", "text", "title", "name", "value", "buttonValue"]) {
    const found = firstReadableString(record[key], visited);
    if (found) return found;
  }
  for (const entry of Object.values(record)) {
    const found = firstReadableString(entry, visited);
    if (found) return found;
  }
  return "";
}

function summarizeWebchatSelection(value: unknown, copy: AdminConversationRuntimeCatalog): string {
  const parsed = parseJsonLike(value);
  const root = asRecord(parsed);
  if (!String(root.webchatRichFormVersion || "").trim()) {
    return typeof value === "string" ? value : "";
  }

  const response = asRecord(root.response);
  const directButtonValue = firstReadableString(response.buttonValue);
  if (directButtonValue) {
    return `${copy.buttonSelection}: ${directButtonValue}`;
  }
  const responseEntry = Object.entries(response).find(([, entryValue]) => {
    if (typeof entryValue === "string") return entryValue.trim().length > 0;
    if (Array.isArray(entryValue)) return entryValue.length > 0;
    return Object.keys(asRecord(entryValue)).length > 0;
  });
  if (!responseEntry) {
    return copy.richFormResponse;
  }

  const [responseType, responseValue] = responseEntry;
  const responseRecord = asRecord(responseValue);
  const candidates = [
    responseRecord.buttonValue,
    responseRecord.displayValue,
    responseRecord.display_text,
    responseRecord.text,
    responseRecord.label,
    responseRecord.title,
    responseRecord.value,
    responseValue,
  ];
  const resolved = candidates.map((candidate) => firstReadableString(candidate)).find(Boolean) || responseType.toUpperCase();
  const normalizedType = responseType.toUpperCase();

  if (["INPUT", "TEXTAREA", "ADDRESS"].includes(normalizedType)) {
    return `${copy.input}: ${resolved}`;
  }
  if (["CHECK", "CHECKBOX", "RADIO", "RADIOBUTTON", "COMBO", "COMBOBOX", "SELECT"].includes(normalizedType)) {
    return `${copy.selection}: ${resolved}`;
  }
  if (["TAB", "BUTTON", "TOGGLEBUTTON"].includes(normalizedType)) {
    return `${copy.buttonSelection}: ${resolved}`;
  }
  return `${normalizedType}: ${resolved}`;
}

function summarizeConversationText(value: unknown, copy: AdminConversationRuntimeCatalog) {
  if (typeof value !== "string") {
    return firstReadableString(value) || "-";
  }
  const trimmed = value.trim();
  if (!trimmed) return "-";
  if (trimmed.includes("webchatRichFormVersion")) {
    return summarizeWebchatSelection(trimmed, copy);
  }
  return trimmed;
}

function isInternalUtterance(value: unknown) {
  const normalized = String(value ?? "").normalize("NFKC").trim();
  if (!normalized || normalized === "-") {
    return true;
  }
  const upper = normalized.toUpperCase();
  if (["END", "START", "__END__", "[END]"].includes(upper)) {
    return true;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized);
}

function isCardNodeName(value: unknown) {
  return /^(talk|rich\s*form)\s*\d*$/i.test(String(value ?? "").normalize("NFKC").trim());
}

function displayStartModule(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized && normalized !== "-" && !isCardNodeName(normalized) ? normalized : "-";
}

function firstTextValue(values: unknown[]) {
  return values
    .map((value) => String(value ?? "").normalize("NFKC").trim())
    .find((value) => value && value !== "-" && !isCardNodeName(value)) ?? "";
}

function entryPayload(dataJson: Record<string, unknown>) {
  const entry = asRecord(dataJson.entry);
  return asRecord(entry.payload);
}

function entryDetail(dataJson: Record<string, unknown>) {
  return asRecord(entryPayload(dataJson).detail);
}

function entryLog(dataJson: Record<string, unknown>) {
  return asRecord(entryDetail(dataJson).log);
}

function startIntentOrModuleName(item: AdminConversationHistoryItem) {
  const dataJson = item.data_json || {};
  const payload = entryPayload(dataJson);
  const detail = entryDetail(dataJson);
  const log = entryLog(dataJson);
  const runtime = asRecord(payload.runtime);
  const firstRuntimeName = runtimeEvents(dataJson)
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

  return displayStartModule(firstTextValue([
    dataJson.start_module_name,
    dataJson.startModuleName,
    dataJson.module_name,
    dataJson.moduleName,
    dataJson.start_intent_name,
    dataJson.startIntentName,
    dataJson.intent_name,
    dataJson.intentName,
    payload.startModuleName,
    payload.start_module_name,
    payload.moduleName,
    payload.module_name,
    payload.startIntentName,
    payload.start_intent_name,
    payload.intentName,
    payload.intent_name,
    detail.startModuleName,
    detail.start_module_name,
    detail.moduleName,
    detail.module_name,
    detail.startIntentName,
    detail.start_intent_name,
    detail.intentName,
    detail.intent_name,
    runtime.startModuleName,
    runtime.start_module_name,
    runtime.moduleName,
    runtime.module_name,
    runtime.startIntentName,
    runtime.start_intent_name,
    runtime.intentName,
    runtime.intent_name,
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
  ]));
}

function summarizeRichFormBotPayload(payload: unknown, copy: AdminConversationRuntimeCatalog) {
  const payloadRecord = asRecord(payload);
  const richForm = asRecord(payloadRecord.richForm || payloadRecord.richform || payloadRecord.response || payloadRecord.payload);
  const title = firstReadableString(richForm.title || richForm.name || payloadRecord.title || payloadRecord.name);
  const text = firstReadableString(richForm.text || richForm.message || payloadRecord.text || payloadRecord.message);
  const options = Array.isArray(richForm.options)
    ? richForm.options.map((option) => firstReadableString(option)).filter(Boolean)
    : [];
  const details = [title, text, options.slice(0, 3).join(", ")].filter(Boolean);
  return details.length > 0 ? details.join(" / ") : copy.richFormCard;
}

function normalizeTranscriptText(message: Record<string, unknown>, fallbackBotName: string, copy: AdminConversationRuntimeCatalog) {
  const displayText = String(message.display_text || "").trim();
  if (displayText) {
    return displayText;
  }
  const participantKind = String(message.participant_kind || "").toLowerCase();
  const rawText = String(message.text || "").trim();
  const payloadJson = asRecord(message.payload_json);

  if (participantKind === "user") {
    return summarizeConversationText(rawText || payloadJson, copy);
  }

  if (!rawText || rawText === "RichForm") {
    return summarizeRichFormBotPayload(payloadJson, copy);
  }

  return summarizeConversationText(rawText, copy);
}

function isVisibleConversationMessage(message: Record<string, unknown>, fallbackBotName: string, copy: AdminConversationRuntimeCatalog) {
  if (String(message.participant_kind || "").toLowerCase() !== "user") {
    return true;
  }
  return !isInternalUtterance(normalizeTranscriptText(message, fallbackBotName, copy));
}

function runtimeEvents(dataJson: Record<string, unknown>) {
  const snakeCaseEvents = asRecordArray(dataJson.runtime_events);
  if (snakeCaseEvents.length > 0) return snakeCaseEvents;
  return asRecordArray(dataJson.runtimeEvents);
}

function conversationMessages(dataJson: Record<string, unknown>) {
  const history = asRecord(dataJson.conversation_history);
  const transcript = asRecordArray(history.transcript);
  if (transcript.length > 0) {
    return transcript;
  }
  return asRecordArray(dataJson.messages);
}

function sessionUtterances(dataJson: Record<string, unknown>) {
  const values = dataJson.session_user_utterances;
  return Array.isArray(values)
    ? values.filter((item): item is string => typeof item === "string" && !isInternalUtterance(item))
    : [];
}

function conversationUtterance(item: AdminConversationHistoryItem, copy: AdminConversationRuntimeCatalog) {
  const dataJson = item.data_json || {};
  const firstUtterance = summarizeConversationText(String(dataJson.session_first_user_utterance || "").trim(), copy);
  if (!isInternalUtterance(firstUtterance)) {
    return firstUtterance;
  }
  const utterances = sessionUtterances(dataJson);
  if (utterances.length > 0) {
    return summarizeConversationText(utterances[0], copy);
  }
  const message = asRecord(dataJson.message);
  const entry = asRecord(dataJson.entry);
  const payload = asRecord(entry.payload);
  const detail = asRecord(payload.detail);
  const log = asRecord(detail.log);
  const variables = asRecord(detail.variables);
  const candidates = [
    message.text,
    detail.utterance,
    detail.userUtterance,
    log.utterance,
    log.userUtterance,
    variables.userUtterance,
    variables.utterance,
    variables.input,
    variables.select,
    variables.message,
  ];
  const found = candidates.find((value) => typeof value === "string" && !isInternalUtterance(value));
  return typeof found === "string" ? summarizeConversationText(found, copy) : "-";
}

function versionLabel(value?: number | null) {
  return typeof value === "number" && value > 0 ? `v${value}` : "-";
}

function formatJson(value: unknown) {
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value ?? {}, null, 2);
}

function eventTitle(event: Record<string, unknown>, index: number) {
  return String(event.event || event.message || `event-${index + 1}`);
}

function eventLocation(event: Record<string, unknown>) {
  const dialogName = String(event.dialogName || event.dialog_name || "").trim();
  const nodeTitle = String(event.nodeTitle || event.node_title || "").trim();
  const nodeKind = String(event.nodeKind || event.node_kind || "").trim();
  const nodeId = String(event.nodeId || event.node_id || "").trim();
  const location = [dialogName, nodeTitle].filter(Boolean).join(" / ");
  const nodeMeta = [nodeKind, nodeId].filter(Boolean).join(" · ");
  if (location && nodeMeta) return `${location} (${nodeMeta})`;
  return location || nodeMeta || "-";
}

function runtimeSummary(dataJson: Record<string, unknown>, copy: AdminConversationRuntimeCatalog) {
  const storedSummary = String(dataJson.runtime_summary || "");
  if (storedSummary) return storedSummary;
  const events = runtimeEvents(dataJson);
  const problem = [...events].reverse().find((event) => ["warning", "error"].includes(String(event.level || "").toLowerCase()));
  if (problem) {
    return String(problem.message || problem.event || copy.runtimeError);
  }
  const entry = asRecord(dataJson.entry);
  const payload = asRecord(entry.payload);
  const detail = asRecord(payload.detail);
  const log = asRecord(detail.log);
  return String(log.description || detail.resultType || copy.normal);
}

function latestProblemEvent(events: Array<Record<string, unknown>>) {
  return [...events].reverse().find((event) => ["warning", "error"].includes(String(event.level || "").toLowerCase())) || null;
}

function storedProblemEvent(dataJson: Record<string, unknown>, events: Array<Record<string, unknown>>) {
  const stored = asRecord(dataJson.latest_problem_event);
  if (Object.keys(stored).length > 0) return stored;
  return latestProblemEvent(events);
}

function traceValue(dataJson: Record<string, unknown>, key: string) {
  const value = dataJson[key];
  return typeof value === "string" && value.trim() ? value : "-";
}

function traceHref(path: string, value: string) {
  return value && value !== "-" ? `${path}?q=${encodeURIComponent(value)}` : "";
}

function problemLocation(dataJson: Record<string, unknown>, event: Record<string, unknown> | null) {
  if (event) {
    const location = eventLocation(event);
    if (location !== "-") return location;
  }
  return traceValue(dataJson, "problem_location");
}

function variableTrace(events: Array<Record<string, unknown>>) {
  return events
    .map((event, index) => {
      const data = asRecord(event.data);
      const updatedVariablesSource = Array.isArray(data.updatedVariables) ? data.updatedVariables : data.updated_variables;
      const updatedVariables = Array.isArray(updatedVariablesSource)
        ? updatedVariablesSource.map((item) => String(item)).filter(Boolean)
        : [];
      const valuePreviews = asRecord(data.valuePreviews ?? data.value_previews);
      if (updatedVariables.length === 0 && Object.keys(valuePreviews).length === 0) {
        return null;
      }
      return {
        index,
        event,
        updatedVariables,
        valuePreviews,
      };
    })
    .filter((item): item is { index: number; event: Record<string, unknown>; updatedVariables: string[]; valuePreviews: Record<string, unknown> } => item !== null);
}

function sessionMetaCount(dataJson: Record<string, unknown>, key: string) {
  const value = dataJson[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sessionStartedAt(item: AdminConversationHistoryItem) {
  const startedAt = String(item.data_json.session_started_at || "").trim();
  return startedAt || item.uttered_at;
}

function isSimulatorConversation(item: AdminConversationHistoryItem) {
  return ["simulator", "시뮬레이터"].includes(item.channel_name.trim().toLowerCase());
}

function localDateBoundaryIso(value: string, endOfDay = false) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return undefined;
  }
  return new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  ).toISOString();
}

export default function AdminConversationsPage() {
  const { language: uiLanguage } = useI18n();
  const copy = ADMIN_CONVERSATION_CATALOGS[uiLanguage];
  const runtimeCopy = ADMIN_CONVERSATION_RUNTIME_CATALOGS[uiLanguage];
  const locale = SUPPORTED_LANGUAGES.find((item) => item.code === uiLanguage)?.intlLocale ?? "ko-KR";
  const [selectedItem, setSelectedItem] = useState<AdminConversationHistoryItem | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<AdminConversationHistoryItem | null>(null);
  const [selectedConversationTurn, setSelectedConversationTurn] = useState(0);
  const fetchItems = useCallback(
    (token: string, request?: {
      fromDate: string;
      toDate: string;
      query?: string;
      page?: number;
      pageSize?: number;
      group?: string;
      bot?: string;
      channel?: string;
    }) =>
      fetchConversationHistory(token, {
        fromDate: request?.fromDate ? localDateBoundaryIso(request.fromDate) : undefined,
        toDate: request?.toDate ? localDateBoundaryIso(request.toDate, true) : undefined,
        query: request?.query,
        page: request?.page,
        pageSize: request?.pageSize,
        group: request?.group,
        bot: request?.bot,
        channel: request?.channel,
      }),
    [],
  );
  const buildRow = useCallback((item: AdminConversationHistoryItem) => ({
    key: item.id,
    cells: [
      <button key="detail" type="button" className="admin-page__link-button" onClick={() => setSelectedItem(item)}>
        {copy.detail}
      </button>,
      item.group_name,
      item.channel_name,
      item.bot_name,
      versionLabel(item.version_no),
      <button key="utterance" type="button" className="admin-page__link-button admin-page__link-button--text" onClick={() => {
        setSelectedConversationTurn(0);
        setSelectedConversation(item);
      }}>
        {conversationUtterance(item, runtimeCopy)}
      </button>,
      startIntentOrModuleName(item),
      formatDate(item.uttered_at, locale),
      item.result,
      runtimeSummary(item.data_json, runtimeCopy),
    ],
  }), [copy.detail, locale, runtimeCopy]);
  const selectedRuntimeEvents = selectedItem ? runtimeEvents(selectedItem.data_json) : [];
  const selectedMessages = selectedItem ? conversationMessages(selectedItem.data_json) : [];
  const problemEvent = selectedItem ? storedProblemEvent(selectedItem.data_json, selectedRuntimeEvents) : null;
  const selectedVariableTrace = variableTrace(selectedRuntimeEvents);
  const selectedQueueId = selectedItem ? traceValue(selectedItem.data_json, "queue_event_id") : "-";
  const selectedConversationMessages = useMemo(
    () => selectedConversation ? conversationMessages(selectedConversation.data_json) : [],
    [selectedConversation],
  );
  const selectedConversationTurns = useMemo(
    () =>
      selectedConversationMessages
        .map((message, index) => ({ message, index }))
        .filter((entry) => String(entry.message.participant_kind || "").toLowerCase() === "user")
        .filter((entry) => !isInternalUtterance(normalizeTranscriptText(entry.message, selectedConversation?.bot_name || runtimeCopy.defaultBot, runtimeCopy)))
        .map((entry, turnIndex) => ({
          turnIndex,
          messageIndex: entry.index,
          summary: normalizeTranscriptText(entry.message, selectedConversation?.bot_name || runtimeCopy.defaultBot, runtimeCopy),
          createdAt: String(entry.message.created_at || ""),
        })),
    [runtimeCopy, selectedConversation, selectedConversationMessages],
  );
  const selectedConversationAverageResponse = useMemo(() => {
    if (!selectedConversation) return 0;
    let lastUserAt = 0;
    const durations: number[] = [];
    selectedConversationMessages.forEach((message) => {
      const createdAt = new Date(String(message.created_at || "")).getTime();
      if (!Number.isFinite(createdAt)) return;
      const kind = String(message.participant_kind || "").toLowerCase();
      if (kind === "user") {
        lastUserAt = createdAt;
        return;
      }
      if (kind === "bot" && lastUserAt > 0) {
        durations.push(Math.max(0, createdAt - lastUserAt));
        lastUserAt = 0;
      }
    });
    if (durations.length === 0) return 0;
    return Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length);
  }, [selectedConversation, selectedConversationMessages]);

  return (
    <>
      <AdminHistoryTablePage
        title={copy.title}
        searchPlaceholder={copy.searchPlaceholder}
        pageSizeText={copy.pageSize}
        columns={copy.columns}
        template="64px 130px 110px 140px 72px minmax(220px, 1fr) 170px 160px 120px minmax(240px, 1fr)"
        fetchItems={fetchItems}
        buildRow={buildRow}
        filterColumns={{ group: 1, channel: 2, bot: 3, date: 7 }}
        serverDateFilter
        serverPagination
      />
      {selectedItem ? (
        <>
          <div className="admin-log-detail__scrim" onClick={() => setSelectedItem(null)} />
          <section className="admin-log-detail" role="dialog" aria-modal="true" aria-label={copy.sessionConversation}>
            <header className="admin-log-detail__header">
              <div>
                <strong>{isSimulatorConversation(selectedItem) ? copy.sessionDetail : copy.sessionConversation}</strong>
                <p>{selectedItem.channel_name} / {selectedItem.bot_name} / {selectedItem.user_key}</p>
              </div>
              <button type="button" className="admin-log-detail__close" onClick={() => setSelectedItem(null)} aria-label={copy.close}>
                ×
              </button>
            </header>
            <div className="admin-log-detail__body">
              <section className="admin-log-detail__section">
                <h3>{copy.diagnosticSummary}</h3>
                <dl className="admin-log-detail__summary">
                  <div><dt>{copy.channel}</dt><dd>{selectedItem.channel_name}</dd></div>
                  <div><dt>{copy.bot}</dt><dd>{selectedItem.bot_name}</dd></div>
                  <div><dt>{copy.user}</dt><dd>{selectedItem.user_key}</dd></div>
                  <div><dt>{copy.sessionStart}</dt><dd>{formatDate(selectedItem.uttered_at, locale)}</dd></div>
                  <div><dt>{copy.result}</dt><dd>{selectedItem.result}</dd></div>
                  <div><dt>{copy.userCount}</dt><dd>{sessionMetaCount(selectedItem.data_json, "session_user_message_count") || sessionUtterances(selectedItem.data_json).length || "-"}</dd></div>
                  <div><dt>{copy.messageCount}</dt><dd>{sessionMetaCount(selectedItem.data_json, "session_message_count") || selectedMessages.length || "-"}</dd></div>
                  <div><dt>{copy.completionReason}</dt><dd>{traceValue(selectedItem.data_json, "completion_reason")}</dd></div>
                  <div><dt>{copy.dialogEnded}</dt><dd>{selectedItem.data_json.dialog_ended === true ? copy.yes : copy.no}</dd></div>
                  <div><dt>{copy.sessionEnded}</dt><dd>{selectedItem.data_json.session_ended === true ? copy.yes : copy.no}</dd></div>
                  <div><dt>{copy.runtime}</dt><dd>{runtimeSummary(selectedItem.data_json, runtimeCopy)}</dd></div>
                  <div><dt>{copy.recentProblem}</dt><dd>{problemEvent ? eventTitle(problemEvent, selectedRuntimeEvents.indexOf(problemEvent)) : "-"}</dd></div>
                  <div><dt>{copy.problemLocation}</dt><dd>{problemLocation(selectedItem.data_json, problemEvent)}</dd></div>
                  <div><dt>Queue ID</dt><dd>{traceValue(selectedItem.data_json, "queue_event_id")}</dd></div>
                  <div><dt>{copy.roomId}</dt><dd>{traceValue(selectedItem.data_json, "room_id")}</dd></div>
                  <div><dt>{copy.externalRoom}</dt><dd>{traceValue(selectedItem.data_json, "client_room_id")}</dd></div>
                </dl>
                {selectedQueueId !== "-" ? (
                  <div className="admin-log-detail__actions">
                    <Link href={traceHref("/admin/queue-history", selectedQueueId)} className="admin-page__link-button">
                      {copy.viewQueue}
                    </Link>
                    <Link href={traceHref("/admin/api-call-history", selectedQueueId)} className="admin-page__link-button">
                      {copy.viewApi}
                    </Link>
                  </div>
                ) : null}
              </section>
              <section className="admin-log-detail__section">
                <h3>{copy.conversationFlow}</h3>
                {selectedMessages.length > 0 ? (
                  <ol className="admin-log-detail__transcript">
                    {selectedMessages.filter((message) => isVisibleConversationMessage(message, selectedItem.bot_name, runtimeCopy)).map((message, index) => (
                      <li key={`${selectedItem.id}-message-${index}`} className={`admin-log-detail__bubble is-${String(message.participant_kind || "info").toLowerCase()}`}>
                        <div className="admin-log-detail__bubble-meta">
                          <strong>{String(message.participant_name || message.participant_kind || "-")}</strong>
                          <span>{String(message.created_at || "-")}</span>
                        </div>
                        <p className="admin-log-detail__bubble-text">{normalizeTranscriptText(message, selectedItem.bot_name, runtimeCopy)}</p>
                        {Object.keys(asRecord(message.payload_json)).length > 0 ? (
                          <pre>{formatJson(message.payload_json)}</pre>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : sessionUtterances(selectedItem.data_json).length > 0 ? (
                  <ol className="admin-log-detail__events">
                    {sessionUtterances(selectedItem.data_json).map((utterance, index) => (
                      <li key={`${selectedItem.id}-utterance-${index}`} className="admin-log-detail__event is-user">
                        <div>
                          <strong>{copy.userUtterance} {index + 1}</strong>
                        </div>
                        <p>{utterance}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="admin-log-detail__empty">{copy.emptyMessages}</p>
                )}
              </section>
              <section className="admin-log-detail__section">
                <h3>{copy.variableTrace}</h3>
                {selectedVariableTrace.length > 0 ? (
                  <ol className="admin-log-detail__events">
                    {selectedVariableTrace.map((trace) => (
                      <li key={`${selectedItem.id}-variable-${trace.index}`} className="admin-log-detail__event is-info">
                        <div>
                          <strong>{eventTitle(trace.event, trace.index)}</strong>
                          <span>{String(trace.event.time || "-")}</span>
                        </div>
                        <small>{eventLocation(trace.event)}</small>
                        <p>{trace.updatedVariables.length > 0 ? trace.updatedVariables.join(", ") : copy.variablePreview}</p>
                        <pre>{formatJson(trace.valuePreviews)}</pre>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="admin-log-detail__empty">{copy.emptyVariables}</p>
                )}
              </section>
              <section className="admin-log-detail__section">
                <h3>{copy.progressEvents}</h3>
                {selectedRuntimeEvents.length > 0 ? (
                  <ol className="admin-log-detail__events">
                    {selectedRuntimeEvents.map((event, index) => (
                      <li key={`${selectedItem.id}-${index}`} className={`admin-log-detail__event is-${String(event.level || "info").toLowerCase()}`}>
                        <div>
                          <strong>{eventTitle(event, index)}</strong>
                          <span>{String(event.time || "-")}</span>
                        </div>
                        <small>{eventLocation(event)}</small>
                        <p>{String(event.message || "-")}</p>
                        <pre>{formatJson(event)}</pre>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="admin-log-detail__empty">{copy.emptyEvents}</p>
                )}
              </section>
              <section className="admin-log-detail__section">
                <h3>{copy.storedData}</h3>
                <pre>{formatJson(selectedItem.data_json)}</pre>
              </section>
            </div>
          </section>
        </>
      ) : null}
      {selectedConversation ? (
        <div className="analysis-conversation-backdrop" role="presentation" onMouseDown={() => setSelectedConversation(null)}>
          <section
            className="analysis-conversation-dialog analysis-conversation-dialog--history"
            role="dialog"
            aria-modal="true"
            aria-label={copy.conversationFlow}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <strong>{selectedConversation.bot_name}</strong>
                <span>{formatDateTime(sessionStartedAt(selectedConversation), locale)}</span>
              </div>
              <button type="button" onClick={() => setSelectedConversation(null)} aria-label={copy.close}>×</button>
            </header>
            <div className="analysis-conversation-dialog__summary">
              <span>{copy.channel} <strong>{selectedConversation.channel_name}</strong></span>
              <span>{copy.intentModule} <strong>{startIntentOrModuleName(selectedConversation)}</strong></span>
              <span>{copy.result} <strong>{selectedConversation.result}</strong></span>
            </div>
            <div className="analysis-conversation-dialog__layout">
              <aside className="analysis-conversation-dialog__sidebar">
                <strong>{copy.userUtterance}</strong>
                <div className="analysis-conversation-dialog__turns">
                  {selectedConversationTurns.length > 0 ? selectedConversationTurns.map((turn) => (
                    <button
                      key={`${selectedConversation.id}-turn-${turn.turnIndex}`}
                      type="button"
                      className={turn.turnIndex === selectedConversationTurn ? "is-active" : undefined}
                      onClick={() => setSelectedConversationTurn(turn.turnIndex)}
                    >
                      {turn.summary}
                    </button>
                  )) : <p>{copy.emptyUtterances}</p>}
                </div>
              </aside>
              <div className="analysis-conversation-dialog__messages">
                {selectedConversationMessages.length > 0
                ? selectedConversationMessages.filter((message) => isVisibleConversationMessage(message, selectedConversation.bot_name, runtimeCopy)).map((message, index) => {
                    const isUser = String(message.participant_kind ?? "").toLowerCase() === "user";
                    const turnMatch = selectedConversationTurns.find((turn) => turn.messageIndex === index);
                    return (
                      <article className={`${isUser ? "is-user" : "is-bot"}${turnMatch?.turnIndex === selectedConversationTurn ? " is-focused" : ""}`} key={String(message.id ?? index)}>
                        <small>{String(message.participant_name ?? (isUser ? copy.user : selectedConversation.bot_name))}</small>
                        <p>{normalizeTranscriptText(message, selectedConversation.bot_name, runtimeCopy)}</p>
                        <time>{formatDateTime(String(message.created_at ?? ""), locale)}</time>
                      </article>
                    );
                  })
                : (
                  <article className="is-user">
                    <small>{copy.user}</small>
                    <p>{conversationUtterance(selectedConversation, runtimeCopy)}</p>
                    <time>{formatDateTime(sessionStartedAt(selectedConversation), locale)}</time>
                  </article>
                )}
              </div>
              <aside className="analysis-conversation-dialog__meta-panel">
                <div className="analysis-conversation-dialog__bot-card">
                  <span className="analysis-conversation-dialog__bot-avatar" aria-hidden="true" />
                  <strong>{selectedConversation.bot_name}</strong>
                </div>
                <div className="analysis-conversation-dialog__metric analysis-conversation-dialog__metric--datetime">
                  <strong>{formatDate(sessionStartedAt(selectedConversation), locale)}</strong>
                </div>
                <div className="analysis-conversation-dialog__metric">
                  <span>{copy.averageResponseTime}</span>
                  <strong>{selectedConversationAverageResponse}</strong>
                  <small>ms</small>
                </div>
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
