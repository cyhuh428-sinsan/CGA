"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

import { AdminHistoryTablePage } from "@/components/admin-history-table-page";
import { fetchQueueHistory, processQueueEvents, type AdminQueueHistoryItem } from "@/lib/admin-api";
import { loadAuthSession } from "@/lib/auth";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
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

function queueRuntimeSummary(dataJson: Record<string, unknown>) {
  const storedSummary = String(dataJson.runtime_summary || "");
  if (storedSummary) return storedSummary;
  const errorMessage = String(dataJson.error_message || "");
  if (errorMessage) return errorMessage;
  const events = runtimeEvents(dataJson);
  const problem = [...events].reverse().find((event) => ["warning", "error"].includes(String(event.level || "").toLowerCase()));
  if (problem) {
    return String(problem.message || problem.event || "런타임 오류");
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
        상세
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
      formatDate(item.requested_at),
      formatDate(item.status_changed_at),
      queueRuntimeSummary(item.data_json),
    ],
  }), []);
  const selectedRuntimeEvents = selectedItem ? runtimeEvents(selectedItem.data_json) : [];
  const problemEvent = selectedItem ? storedProblemEvent(selectedItem.data_json, selectedRuntimeEvents) : null;
  const selectedVariableTrace = variableTrace(selectedRuntimeEvents);
  const selectedQueueId = selectedItem?.id || "";

  async function handleProcessQueued() {
    const session = loadAuthSession();
    if (!session) {
      setProcessMessage("로그인이 필요합니다.");
      return;
    }
    setProcessing(true);
    setProcessMessage("");
    try {
      const result = await processQueueEvents(session.access_token);
      setProcessMessage(`queued 작업 ${result.processed}건을 처리했습니다.`);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setProcessMessage(error instanceof Error ? error.message : "Queue 처리에 실패했습니다.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <>
      <AdminHistoryTablePage
        key={refreshKey}
        title="Queue 이력 조회"
        searchPlaceholder="의도명을 검색하세요."
        pageSizeText="20개씩 보기"
        columns={["", "의도명", "발송 시스템", "우선순위", "파라미터", "채널", "봇", "수신자", "수신 상태", "처리 상태", "요청시간", "수신상태 변경시간", "오류/진행"]}
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
              {processing ? "Queue 처리 중" : "Queued 처리"}
            </button>
          </>
        }
        emptyText="실제 Queue 이력 저장소에 기록된 데이터가 없습니다."
      />
      {selectedItem ? (
        <>
          <div className="admin-log-detail__scrim" onClick={() => setSelectedItem(null)} />
          <section className="admin-log-detail" role="dialog" aria-modal="true" aria-label="Queue 상세 이력">
            <header className="admin-log-detail__header">
              <div>
                <strong>Queue 상세 이력</strong>
                <p>{selectedItem.channel_name} / {selectedItem.bot_name} / {selectedItem.id}</p>
              </div>
              <button type="button" className="admin-log-detail__close" onClick={() => setSelectedItem(null)} aria-label="닫기">
                ×
              </button>
            </header>
            <div className="admin-log-detail__body">
              <section className="admin-log-detail__section">
                <h3>진단 요약</h3>
                <dl className="admin-log-detail__summary">
                  <div><dt>채널</dt><dd>{selectedItem.channel_name}</dd></div>
                  <div><dt>봇</dt><dd>{selectedItem.bot_name}</dd></div>
                  <div><dt>처리 상태</dt><dd>{queueStatus(selectedItem.data_json)}</dd></div>
                  <div><dt>수신 상태</dt><dd>{selectedItem.receive_status}</dd></div>
                  <div><dt>완료 사유</dt><dd>{traceValue(selectedItem.data_json, "completion_reason")}</dd></div>
                  <div><dt>대화 종료</dt><dd>{selectedItem.data_json.dialog_ended === true ? "예" : "아니오"}</dd></div>
                  <div><dt>세션 종료</dt><dd>{selectedItem.data_json.session_ended === true ? "예" : "아니오"}</dd></div>
                  <div><dt>오류/진행</dt><dd>{queueRuntimeSummary(selectedItem.data_json)}</dd></div>
                  <div><dt>최근 문제 이벤트</dt><dd>{problemEvent ? eventTitle(problemEvent, selectedRuntimeEvents.indexOf(problemEvent)) : "-"}</dd></div>
                  <div><dt>문제 위치</dt><dd>{problemLocation(selectedItem.data_json, problemEvent)}</dd></div>
                  <div><dt>Queue ID</dt><dd>{selectedItem.id}</dd></div>
                  <div><dt>대화방 ID</dt><dd>{traceValue(selectedItem.data_json, "room_id")}</dd></div>
                  <div><dt>요청 메시지 ID</dt><dd>{traceValue(selectedItem.data_json, "request_message_id")}</dd></div>
                </dl>
                <div className="admin-log-detail__actions">
                  <Link href={traceHref("/admin/conversations", selectedQueueId)} className="admin-page__link-button">
                    대화 이력에서 보기
                  </Link>
                  <Link href={traceHref("/admin/api-call-history", selectedQueueId)} className="admin-page__link-button">
                    API 이력에서 보기
                  </Link>
                </div>
              </section>
              <section className="admin-log-detail__section">
                <h3>진행 이벤트</h3>
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
                  <p className="admin-log-detail__empty">저장된 런타임 이벤트가 없습니다.</p>
                )}
              </section>
              <section className="admin-log-detail__section">
                <h3>변수 변경 추적</h3>
                {selectedVariableTrace.length > 0 ? (
                  <ol className="admin-log-detail__events">
                    {selectedVariableTrace.map((trace) => (
                      <li key={`${selectedItem.id}-variable-${trace.index}`} className="admin-log-detail__event is-info">
                        <div>
                          <strong>{eventTitle(trace.event, trace.index)}</strong>
                          <span>{String(trace.event.time || "-")}</span>
                        </div>
                        <small>{eventLocation(trace.event)}</small>
                        <p>{trace.updatedVariables.length > 0 ? trace.updatedVariables.join(", ") : "변수 값 미리보기"}</p>
                        <pre>{formatJson(trace.valuePreviews)}</pre>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="admin-log-detail__empty">저장된 변수 변경 이벤트가 없습니다.</p>
                )}
              </section>
              <section className="admin-log-detail__section">
                <h3>요청 파라미터</h3>
                <pre>{formatJson(selectedItem.parameter)}</pre>
              </section>
              <section className="admin-log-detail__section">
                <h3>저장 데이터</h3>
                <pre>{formatJson(selectedItem.data_json)}</pre>
              </section>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
