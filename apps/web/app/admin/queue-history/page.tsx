"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

import { AdminHistoryTablePage } from "@/components/admin-history-table-page";
import { useI18n } from "@/components/language-provider";
import { fetchQueueHistory, processQueueEvents, type AdminQueueHistoryItem } from "@/lib/admin-api";
import { loadAuthSession } from "@/lib/auth";
import { ADMIN_QUEUE_HISTORY_CATALOGS, formatQueueHistoryText } from "@/lib/i18n/admin-queue-history";
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

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function runtimeEvents(dataJson: Record<string, unknown>) {
  const camelCaseEvents = asRecordArray(dataJson.runtimeEvents);
  if (camelCaseEvents.length > 0) return camelCaseEvents;
  return asRecordArray(dataJson.runtime_events);
}

function queueRuntimeSummary(dataJson: Record<string, unknown>, runtimeError: string) {
  const storedSummary = String(dataJson.runtime_summary || "");
  if (storedSummary) return storedSummary;
  const errorMessage = String(dataJson.error_message || "");
  if (errorMessage) return errorMessage;
  const events = runtimeEvents(dataJson);
  const problem = [...events].reverse().find((event) => ["warning", "error"].includes(String(event.level || "").toLowerCase()));
  if (problem) {
    return String(problem.message || problem.event || runtimeError);
  }
  return String(dataJson.queue_status || "queued");
}

function queueStatus(dataJson: Record<string, unknown>) {
  return String(dataJson.queue_status || "-");
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

export default function AdminQueueHistoryPage() {
  const { language: uiLanguage } = useI18n();
  const copy = ADMIN_QUEUE_HISTORY_CATALOGS[uiLanguage];
  const locale = SUPPORTED_LANGUAGES.find((item) => item.code === uiLanguage)?.intlLocale ?? "ko-KR";
  const [selectedItem, setSelectedItem] = useState<AdminQueueHistoryItem | null>(null);
  const [processMessage, setProcessMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
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
    }) => fetchQueueHistory(token, {
      ...request,
      fromDate: request?.fromDate,
      toDate: request?.toDate,
    }),
    [],
  );
  const buildRow = useCallback((item: AdminQueueHistoryItem) => ({
    key: item.id,
    cells: [
      <button key="detail" type="button" className="admin-page__link-button" onClick={() => setSelectedItem(item)}>
        {copy.detail}
      </button>,
      item.intent_name,
      item.sender_system,
      item.priority,
      item.parameter,
      item.channel_name,
      item.bot_name,
      item.receiver,
      item.receive_status,
      queueStatus(item.data_json),
      formatDate(item.requested_at, locale),
      formatDate(item.status_changed_at, locale),
      queueRuntimeSummary(item.data_json, copy.runtimeError),
    ],
  }), [copy.detail, copy.runtimeError, locale]);
  const selectedRuntimeEvents = selectedItem ? runtimeEvents(selectedItem.data_json) : [];
  const problemEvent = selectedItem ? storedProblemEvent(selectedItem.data_json, selectedRuntimeEvents) : null;
  const selectedVariableTrace = variableTrace(selectedRuntimeEvents);
  const selectedQueueId = selectedItem?.id || "";

  async function handleProcessQueued() {
    const session = loadAuthSession();
    if (!session) {
      setProcessMessage(copy.loginRequired);
      return;
    }
    setProcessing(true);
    setProcessMessage("");
    try {
      const result = await processQueueEvents(session.access_token);
      setProcessMessage(formatQueueHistoryText(copy.processed, result.processed));
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setProcessMessage(error instanceof Error ? error.message : copy.processFailed);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <>
      <AdminHistoryTablePage
        key={refreshKey}
        title={copy.title}
        searchPlaceholder={copy.searchPlaceholder}
        pageSizeText={copy.pageSize}
        columns={copy.columns}
        template="64px 140px 110px 80px 130px 100px 130px 150px 110px 110px 160px 160px minmax(240px, 1fr)"
        fetchItems={fetchItems}
        buildRow={buildRow}
        filterColumns={{ channel: 5, bot: 6, date: 10 }}
        serverDateFilter
        serverPagination
        toolbarRight={
          <>
            {processMessage ? <span className="admin-page__hint">{processMessage}</span> : null}
            <button type="button" className="admin-page__ghost" onClick={handleProcessQueued} disabled={processing}>
              {processing ? copy.processing : copy.processQueued}
            </button>
          </>
        }
        emptyText={copy.empty}
      />
      {selectedItem ? (
        <>
          <div className="admin-log-detail__scrim" onClick={() => setSelectedItem(null)} />
          <section className="admin-log-detail" role="dialog" aria-modal="true" aria-label={copy.detailTitle}>
            <header className="admin-log-detail__header">
              <div>
                <strong>{copy.detailTitle}</strong>
                <p>{selectedItem.channel_name} / {selectedItem.bot_name} / {selectedItem.id}</p>
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
                  <div><dt>{copy.processStatus}</dt><dd>{queueStatus(selectedItem.data_json)}</dd></div>
                  <div><dt>{copy.receiveStatus}</dt><dd>{selectedItem.receive_status}</dd></div>
                  <div><dt>{copy.completionReason}</dt><dd>{traceValue(selectedItem.data_json, "completion_reason")}</dd></div>
                  <div><dt>{copy.dialogEnded}</dt><dd>{selectedItem.data_json.dialog_ended === true ? copy.yes : copy.no}</dd></div>
                  <div><dt>{copy.sessionEnded}</dt><dd>{selectedItem.data_json.session_ended === true ? copy.yes : copy.no}</dd></div>
                  <div><dt>{copy.runtime}</dt><dd>{queueRuntimeSummary(selectedItem.data_json, copy.runtimeError)}</dd></div>
                  <div><dt>{copy.recentProblem}</dt><dd>{problemEvent ? eventTitle(problemEvent, selectedRuntimeEvents.indexOf(problemEvent)) : "-"}</dd></div>
                  <div><dt>{copy.problemLocation}</dt><dd>{problemLocation(selectedItem.data_json, problemEvent)}</dd></div>
                  <div><dt>Queue ID</dt><dd>{selectedItem.id}</dd></div>
                  <div><dt>{copy.roomId}</dt><dd>{traceValue(selectedItem.data_json, "room_id")}</dd></div>
                  <div><dt>{copy.requestMessageId}</dt><dd>{traceValue(selectedItem.data_json, "request_message_id")}</dd></div>
                </dl>
                <div className="admin-log-detail__actions">
                  <Link href={traceHref("/admin/conversations", selectedQueueId)} className="admin-page__link-button">
                    {copy.viewConversation}
                  </Link>
                  <Link href={traceHref("/admin/api-call-history", selectedQueueId)} className="admin-page__link-button">
                    {copy.viewApi}
                  </Link>
                </div>
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
                <h3>{copy.requestParameters}</h3>
                <pre>{formatJson(selectedItem.parameter)}</pre>
              </section>
              <section className="admin-log-detail__section">
                <h3>{copy.storedData}</h3>
                <pre>{formatJson(selectedItem.data_json)}</pre>
              </section>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
