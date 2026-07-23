"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

import { AdminHistoryTablePage } from "@/components/admin-history-table-page";
import { fetchApiCallHistory, type AdminApiCallHistoryItem } from "@/lib/admin-api";
import { useI18n } from "@/components/language-provider";
import { ADMIN_PAGE_CATALOGS } from "@/lib/i18n/admin-pages";

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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
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

function apiCallDetail(dataJson: Record<string, unknown>) {
  const runtimeEvent = asRecord(dataJson.runtime_event);
  const runtimeData = asRecord(runtimeEvent.data);
  const eventMessage = String(runtimeEvent.message || "");
  if (eventMessage) return eventMessage;
  const entry = asRecord(dataJson.entry);
  const payload = asRecord(entry.payload);
  const detail = asRecord(payload.detail);
  return String(runtimeData.statusText || runtimeData.message || detail.statusText || detail.message || "-");
}

function apiElapsedMs(dataJson: Record<string, unknown>) {
  const runtimeEvent = asRecord(dataJson.runtime_event);
  const runtimeData = asRecord(runtimeEvent.data);
  const entry = asRecord(dataJson.entry);
  const payload = asRecord(entry.payload);
  const detail = asRecord(payload.detail);
  const value = runtimeData.elapsedMs ?? runtimeData.elapsed_ms ?? detail.elapsedMs ?? detail.elapsed_ms;
  return typeof value === "number" || typeof value === "string" ? String(value) : "-";
}

function apiRequestSummary(dataJson: Record<string, unknown>) {
  const runtimeEvent = asRecord(dataJson.runtime_event);
  const runtimeData = asRecord(runtimeEvent.data);
  const request = asRecord(runtimeData.request);
  const entry = asRecord(dataJson.entry);
  const payload = asRecord(entry.payload);
  const detail = asRecord(payload.detail);
  return {
    parameterValues: request.parameterValues ?? request.parameter_values ?? detail.parameterValues ?? detail.parameter_values ?? {},
    pathParams: request.pathParams ?? request.path_params ?? {},
    queryParams: request.queryParams ?? request.query_params ?? {},
  };
}

function apiResponseSummary(dataJson: Record<string, unknown>) {
  const runtimeEvent = asRecord(dataJson.runtime_event);
  const runtimeData = asRecord(runtimeEvent.data);
  const entry = asRecord(dataJson.entry);
  const payload = asRecord(entry.payload);
  const detail = asRecord(payload.detail);
  return {
    ok: runtimeData.ok ?? (String(payload.event || "") === "simulator.function_call_success"),
    status: runtimeData.status ?? detail.status ?? "-",
    statusText: runtimeData.statusText ?? detail.statusText ?? "-",
    elapsedMs: runtimeData.elapsedMs ?? runtimeData.elapsed_ms ?? detail.elapsedMs ?? detail.elapsed_ms ?? "-",
    responsePreview: runtimeData.responsePreview ?? runtimeData.response_preview ?? detail.responsePreview ?? detail.response_preview ?? "-",
    updatedVariables: runtimeData.updatedVariables ?? runtimeData.updated_variables ?? detail.updatedVariables ?? detail.updated_variables ?? [],
    valuePreviews: runtimeData.valuePreviews ?? runtimeData.value_previews ?? detail.valuePreviews ?? detail.value_previews ?? {},
    outputMappingCount: runtimeData.outputMappingCount ?? runtimeData.output_mapping_count ?? detail.outputMappingCount ?? detail.output_mapping_count ?? "-",
    error: runtimeData.error ?? detail.error ?? "-",
  };
}

function apiRuntimeEvent(dataJson: Record<string, unknown>) {
  const runtimeEvent = asRecord(dataJson.runtime_event);
  return Object.keys(runtimeEvent).length > 0 ? runtimeEvent : null;
}

function apiCallLocation(dataJson: Record<string, unknown>) {
  const runtimeEvent = apiRuntimeEvent(dataJson);
  if (runtimeEvent) {
    const location = eventLocation(runtimeEvent);
    if (location !== "-") return location;
  }
  const value = dataJson.problem_location;
  return typeof value === "string" && value.trim() ? value : "-";
}

function traceValue(dataJson: Record<string, unknown>, key: string) {
  const value = dataJson[key];
  return typeof value === "string" && value.trim() ? value : "-";
}

function traceHref(path: string, value: string) {
  return value && value !== "-" ? `${path}?q=${encodeURIComponent(value)}` : "";
}

export default function AdminApiCallHistoryPage() {
  const { language } = useI18n();
  const copy = ADMIN_PAGE_CATALOGS[language].apiCallHistory;
  const [selectedItem, setSelectedItem] = useState<AdminApiCallHistoryItem | null>(null);
  const fetchItems = useCallback((token: string) => fetchApiCallHistory(token), []);
  const buildRow = useCallback((item: AdminApiCallHistoryItem) => ({
    key: item.id,
    cells: [
      <button key="detail" type="button" className="admin-page__link-button" onClick={() => setSelectedItem(item)}>
        {copy.detail}
      </button>,
      item.method,
      item.filters,
      item.api_name,
      item.api_type,
      item.url,
      item.transfer_type,
      item.channel_name,
      item.group_name,
      item.bot_name,
      String(item.version_no || "-"),
      item.intent_name,
      item.response_code,
      apiElapsedMs(item.data_json),
      item.user_key,
      formatDate(item.called_at),
      apiCallDetail(item.data_json),
    ],
  }), [copy.detail]);
  const selectedRuntimeEvent = selectedItem ? apiRuntimeEvent(selectedItem.data_json) : null;
  const selectedQueueId = selectedItem ? traceValue(selectedItem.data_json, "queue_event_id") : "-";

  return (
    <>
      <AdminHistoryTablePage
        title={copy.title}
        searchPlaceholder={copy.searchPlaceholder}
        columns={copy.columns}
        template="64px 70px 90px 150px 80px 220px 70px 100px 100px 130px 60px 140px 110px 80px 180px 160px minmax(220px, 1fr)"
        fetchItems={fetchItems}
        buildRow={buildRow}
        filterColumns={{ channel: 7, group: 8, bot: 9, date: 15 }}
      />
      {selectedItem ? (
        <>
          <div className="admin-log-detail__scrim" onClick={() => setSelectedItem(null)} />
          <section className="admin-log-detail" role="dialog" aria-modal="true" aria-label="API 호출 상세 이력">
            <header className="admin-log-detail__header">
              <div>
                <strong>API 호출 상세 이력</strong>
                <p>{selectedItem.api_name} / {selectedItem.bot_name} / {selectedItem.called_at}</p>
              </div>
              <button type="button" className="admin-log-detail__close" onClick={() => setSelectedItem(null)} aria-label={copy.close}>
                ×
              </button>
            </header>
            <div className="admin-log-detail__body">
              <section className="admin-log-detail__section">
                <h3>요약</h3>
                <dl className="admin-log-detail__summary">
                  <div><dt>Method</dt><dd>{selectedItem.method}</dd></div>
                  <div><dt>URL</dt><dd>{selectedItem.url}</dd></div>
                  <div><dt>채널</dt><dd>{selectedItem.channel_name}</dd></div>
                  <div><dt>응답코드</dt><dd>{selectedItem.response_code}</dd></div>
                  <div><dt>소요시간</dt><dd>{apiElapsedMs(selectedItem.data_json)} ms</dd></div>
                  <div><dt>상세</dt><dd>{apiCallDetail(selectedItem.data_json)}</dd></div>
                  <div><dt>발생 위치</dt><dd>{apiCallLocation(selectedItem.data_json)}</dd></div>
                  <div><dt>완료 사유</dt><dd>{traceValue(selectedItem.data_json, "completion_reason")}</dd></div>
                  <div><dt>대화 종료</dt><dd>{selectedItem.data_json.dialog_ended === true ? "예" : "아니오"}</dd></div>
                  <div><dt>세션 종료</dt><dd>{selectedItem.data_json.session_ended === true ? "예" : "아니오"}</dd></div>
                  <div><dt>Queue ID</dt><dd>{traceValue(selectedItem.data_json, "queue_event_id")}</dd></div>
                </dl>
                {selectedQueueId !== "-" ? (
                  <div className="admin-log-detail__actions">
                    <Link href={traceHref("/admin/queue-history", selectedQueueId)} className="admin-page__link-button">
                      Queue 이력에서 보기
                    </Link>
                    <Link href={traceHref("/admin/conversations", selectedQueueId)} className="admin-page__link-button">
                      대화 이력에서 보기
                    </Link>
                  </div>
                ) : null}
              </section>
              <section className="admin-log-detail__section">
                <h3>요청 데이터</h3>
                <pre>{formatJson(apiRequestSummary(selectedItem.data_json))}</pre>
              </section>
              <section className="admin-log-detail__section">
                <h3>응답 데이터</h3>
                <pre>{formatJson(apiResponseSummary(selectedItem.data_json))}</pre>
              </section>
              {selectedRuntimeEvent ? (
                <section className="admin-log-detail__section">
                  <h3>런타임 이벤트</h3>
                  <pre>{formatJson(selectedRuntimeEvent)}</pre>
                </section>
              ) : null}
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
