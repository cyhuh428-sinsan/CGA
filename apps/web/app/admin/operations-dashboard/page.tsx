"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DataGrid, dataGridCellText, type DataGridRow, type DataGridSortState } from "@/components/data-grid";
import { useI18n } from "@/components/language-provider";
import {
  backfillVersionReadSnapshots,
  backfillVersionStorage,
  fetchApiReadiness,
  fetchChannels,
  fetchGroups,
  fetchOperationsDashboard,
  fetchOperationsDashboardVersionIntegrity,
  purgeAdminCache,
  type AdminApiReadinessStatus,
  type AdminChannelItem,
  type AdminGroupListItem,
  type AdminOperationsDashboardErrorItem,
  type AdminOperationsDashboardEditLockItem,
  type AdminOperationsDashboardResponse,
  type AdminOperationsDashboardVersionIntegrityResponse,
  type AdminOperationsDashboardRuntimeItem,
  type AdminOperationsDashboardSlowRequestItem,
  type AdminOperationsDashboardSlowRequestSummaryItem,
  type AdminOperationsDashboardSystemErrorItem,
} from "@/lib/admin-api";
import { loadAuthSession } from "@/lib/auth";
import { ADMIN_OPERATIONS_DASHBOARD_CATALOGS } from "@/lib/i18n/admin-operations-dashboard";
import { fetchStudioBots, forceReleaseEditLock, type StudioBotApiItem } from "@/lib/studio-bots-api";

const PERIOD_OPTIONS = [
  { value: "1h", label: "1h", hours: 1 },
  { value: "6h", label: "6h", hours: 6 },
  { value: "24h", label: "24h", hours: 24 },
  { value: "7d", label: "7d", days: 7 },
  { value: "14d", label: "14d", days: 14 },
  { value: "30d", label: "30d", days: 30 },
  { value: "90d", label: "90d", days: 90 },
] as const;

type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

function dashboardPeriodFilters(period: PeriodValue) {
  const option = PERIOD_OPTIONS.find((item) => item.value === period) ?? PERIOD_OPTIONS[3];
  return "hours" in option ? { hours: option.hours } : { days: option.days };
}

const SUMMARY_LABELS: Array<{ key: keyof AdminOperationsDashboardResponse["summary"]; label: string; tone?: "warning" | "normal" }> = [
  { key: "total_bots", label: "전체 봇" },
  { key: "operating_bots", label: "운영 버전 봇" },
  { key: "botstation_connected_bots", label: "봇스테이션 연결" },
  { key: "active_channels", label: "활성 채널" },
  { key: "channel_rooms", label: "대화방" },
  { key: "user_messages", label: "사용자 발화" },
  { key: "queue_events", label: "Queue 전체" },
  { key: "queue_queued", label: "Queue 대기", tone: "warning" },
  { key: "queue_processing", label: "Queue 처리중" },
  { key: "queue_completed", label: "Queue 완료" },
  { key: "queue_failed", label: "Queue 실패", tone: "warning" },
  { key: "runtime_events", label: "실행 이벤트" },
  { key: "runtime_problem_events", label: "실행 경고/오류", tone: "warning" },
  { key: "system_errors", label: "시스템 오류", tone: "warning" },
  { key: "slow_api_requests", label: "느린 API", tone: "warning" },
  { key: "slow_db_requests", label: "DB 지연", tone: "warning" },
  { key: "active_edit_locks", label: "편집 잠금", tone: "warning" },
  { key: "expired_edit_locks", label: "만료 잠금", tone: "warning" },
  { key: "edit_lock_conflicts", label: "편집 충돌", tone: "warning" },
  { key: "api_calls", label: "API 호출" },
  { key: "api_errors", label: "API 오류", tone: "warning" },
  { key: "intent_fallbacks", label: "의도 미분류", tone: "warning" },
  { key: "training_success", label: "학습 성공" },
  { key: "training_failed", label: "학습 확인 필요", tone: "warning" },
];

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

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatBytes(value: number | null) {
  if (value === null) return "-";
  if (value < 1024) return `${value.toLocaleString("ko-KR")} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let nextValue = value / 1024;
  let unitIndex = 0;
  while (nextValue >= 1024 && unitIndex < units.length - 1) {
    nextValue /= 1024;
    unitIndex += 1;
  }
  return `${nextValue.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} ${units[unitIndex]}`;
}

function formatMs(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}ms`;
}

function slowRequestKindLabel(item: AdminOperationsDashboardSlowRequestItem) {
  return item.kind === "db" ? "DB 지연" : "느린 API";
}

function slowRequestSummaryKindLabel(item: AdminOperationsDashboardSlowRequestSummaryItem) {
  return item.kind === "db" ? "DB 지연" : "느린 API";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
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
  return [...events].reverse().find((event) => ["warning", "error"].includes(String(event.level || "").toLowerCase())) || events.at(-1) || null;
}

function runtimeEventFromData(dataJson: Record<string, unknown>) {
  const runtimeEvent = asRecord(dataJson.runtime_event);
  if (Object.keys(runtimeEvent).length > 0) return runtimeEvent;
  const latestProblem = asRecord(dataJson.latest_problem_event);
  if (Object.keys(latestProblem).length > 0) return latestProblem;
  const resultJson = asRecord(dataJson.result_json);
  const resultEvents = asRecordArray(resultJson.runtimeEvents).length > 0 ? asRecordArray(resultJson.runtimeEvents) : asRecordArray(resultJson.runtime_events);
  const resultEvent = latestProblemEvent(resultEvents);
  if (resultEvent) return resultEvent;
  const detail = asRecord(dataJson.detail);
  const detailRuntime = asRecord(detail.runtime);
  if (Object.keys(detailRuntime).length > 0) return detailRuntime;
  const payload = asRecord(dataJson.payload);
  const payloadDetail = asRecord(payload.detail);
  const payloadRuntime = asRecord(payloadDetail.runtime);
  return Object.keys(payloadRuntime).length > 0 ? payloadRuntime : null;
}

function locationFromData(dataJson: Record<string, unknown>) {
  const runtimeEvent = runtimeEventFromData(dataJson);
  if (runtimeEvent) {
    const location = eventLocation(runtimeEvent);
    if (location !== "-") return location;
  }
  const problemLocation = dataJson.problem_location;
  return typeof problemLocation === "string" && problemLocation.trim() ? problemLocation : "-";
}

function runtimeItemLocation(item: AdminOperationsDashboardRuntimeItem) {
  const runtimeEvent = runtimeEventFromData(item.data_json);
  if (runtimeEvent) {
    const location = eventLocation(runtimeEvent);
    if (location !== "-") return location;
  }
  return eventLocation({ dialog_name: item.dialog_name, node_title: item.node_title });
}

function editLockAreaLabel(area: string) {
  if (area === "dialog") return "대화";
  if (area === "start") return "대화 시작";
  if (area === "flow") return "대화 설계";
  if (area === "settings") return "설정";
  return area || "-";
}

function editLockOwner(item: AdminOperationsDashboardEditLockItem) {
  return item.owner_name?.trim() || item.owner_login_id || "-";
}

function cacheAvailabilityLabel(enabled: boolean, available: boolean | null) {
  if (!enabled) return "미사용";
  if (available === null) return "확인 대기";
  return available ? "사용 가능" : "Fallback";
}
function runtimeVariableTrace(dataJson: Record<string, unknown>) {
  const runtimeEvent = runtimeEventFromData(dataJson);
  const data = asRecord(runtimeEvent?.data);
  const updatedVariablesSource = Array.isArray(data.updatedVariables) ? data.updatedVariables : data.updated_variables;
  const updatedVariables = Array.isArray(updatedVariablesSource)
    ? updatedVariablesSource.map((item) => String(item)).filter(Boolean)
    : [];
  const valuePreviews = asRecord(data.valuePreviews ?? data.value_previews);
  return {
    updatedVariables,
    valuePreviews,
    hasTrace: updatedVariables.length > 0 || Object.keys(valuePreviews).length > 0,
  };
}

function traceValue(dataJson: Record<string, unknown>, key: string) {
  const value = dataJson[key];
  return typeof value === "string" && value.trim() ? value : "";
}

function traceHref(path: string, value: string) {
  return value ? `${path}?q=${encodeURIComponent(value)}` : "";
}

export default function AdminOperationsDashboardPage() {
  const { language: uiLanguage } = useI18n();
  const copy = ADMIN_OPERATIONS_DASHBOARD_CATALOGS[uiLanguage];
  const [token, setToken] = useState("");
  const [period, setPeriod] = useState<PeriodValue>("1h");
  const [groupId, setGroupId] = useState("");
  const [botId, setBotId] = useState("");
  const [channelCode, setChannelCode] = useState("");
  const [groups, setGroups] = useState<AdminGroupListItem[]>([]);
  const [bots, setBots] = useState<StudioBotApiItem[]>([]);
  const [channels, setChannels] = useState<AdminChannelItem[]>([]);
  const [dashboard, setDashboard] = useState<AdminOperationsDashboardResponse | null>(null);
  const [versionIntegrity, setVersionIntegrity] = useState<AdminOperationsDashboardVersionIntegrityResponse | null>(null);
  const [apiReadiness, setApiReadiness] = useState<AdminApiReadinessStatus | null>(null);
  const [selectedError, setSelectedError] = useState<AdminOperationsDashboardErrorItem | null>(null);
  const [selectedRuntimeEvent, setSelectedRuntimeEvent] = useState<AdminOperationsDashboardRuntimeItem | null>(null);
  const [selectedSystemError, setSelectedSystemError] = useState<AdminOperationsDashboardSystemErrorItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [purgingCache, setPurgingCache] = useState(false);
  const [backfillingVersionStorage, setBackfillingVersionStorage] = useState<"" | "dry_run" | "run">("");
  const [backfillingReadSnapshots, setBackfillingReadSnapshots] = useState<"" | "dry_run" | "run">("");
  const [checkingVersionIntegrity, setCheckingVersionIntegrity] = useState(false);
  const [releasingLockId, setReleasingLockId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [sortState, setSortState] = useState<DataGridSortState | null>(null);
  const selectedSystemErrorVariableTrace = selectedSystemError ? runtimeVariableTrace(selectedSystemError.data_json) : null;
  const selectedErrorQueueId = selectedError ? traceValue(selectedError.data_json, "queue_event_id") : "";
  const selectedRuntimeQueueId = selectedRuntimeEvent ? traceValue(selectedRuntimeEvent.data_json, "queue_event_id") : "";

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      setLoading(false);
      setErrorMessage("로그인이 필요합니다.");
      return;
    }
    setToken(session.access_token);
  }, []);

  useEffect(() => {
    let ignore = false;
    fetchApiReadiness().then((response) => {
      if (!ignore) setApiReadiness(response);
    });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    let ignore = false;
    Promise.all([fetchGroups(token), fetchStudioBots(token), fetchChannels(token, { status: "active" })])
      .then(([groupResponse, botResponse, channelResponse]) => {
        if (ignore) return;
        setGroups(groupResponse.items);
        setBots(botResponse);
        setChannels(channelResponse.items);
      })
      .catch((error) => {
        if (!ignore) setErrorMessage(error instanceof Error ? error.message : "운영 필터 정보를 불러오지 못했습니다.");
      });
    return () => {
      ignore = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let ignore = false;
    setLoading(true);
    setVersionIntegrity(null);
    setErrorMessage("");
    Promise.allSettled([
      fetchApiReadiness(),
      fetchOperationsDashboard(token, {
        ...dashboardPeriodFilters(period),
        group_id: groupId || undefined,
        bot_id: botId || undefined,
        channel_code: channelCode || undefined,
      }),
    ])
      .then(([readinessResult, dashboardResult]) => {
        if (ignore) return;
        if (readinessResult.status === "fulfilled") {
          setApiReadiness(readinessResult.value);
        }
        if (dashboardResult.status === "fulfilled") {
          setDashboard(dashboardResult.value);
          return;
        }
        setDashboard(null);
        setErrorMessage(dashboardResult.reason instanceof Error ? dashboardResult.reason.message : "운영 현황을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [botId, channelCode, groupId, period, token]);

  const filteredBots = useMemo(
    () => (groupId ? bots.filter((bot) => bot.group_id === groupId) : bots),
    [bots, groupId],
  );
  const selectedErrorVariableTrace = selectedError ? runtimeVariableTrace(selectedError.data_json) : null;
  const selectedRuntimeEventVariableTrace = selectedRuntimeEvent ? runtimeVariableTrace(selectedRuntimeEvent.data_json) : null;

  const rows: DataGridRow[] = (dashboard?.recent_errors ?? []).map((item) => ({
    key: item.id,
    cells: [
      <button key="detail" type="button" className="admin-page__ghost" onClick={() => setSelectedError(item)}>
        상세
      </button>,
      item.source,
      item.bot_name,
      locationFromData(item.data_json),
      item.event || "-",
      item.message,
      formatDate(item.occurred_at),
    ],
  }));
  const sortedRows = useMemo(() => {
    if (!sortState) {
      return rows;
    }
    return [...rows].sort((left, right) => {
      const leftText = dataGridCellText(left.cells[sortState.columnIndex]);
      const rightText = dataGridCellText(right.cells[sortState.columnIndex]);
      const result = leftText.localeCompare(rightText, "ko-KR", { numeric: true, sensitivity: "base" });
      return sortState.direction === "asc" ? result : -result;
    });
  }, [rows, sortState]);
  const runtimeRows: DataGridRow[] = (dashboard?.recent_runtime_events ?? []).map((item) => ({
    key: item.id,
    cells: [
      <button key="detail" type="button" className="admin-page__ghost" onClick={() => setSelectedRuntimeEvent(item)}>
        상세
      </button>,
      item.source,
      item.level,
      item.bot_name,
      item.dialog_name,
      item.node_title,
      item.event || "-",
      item.message,
      formatDate(item.occurred_at),
    ],
  }));
  const systemErrorRows: DataGridRow[] = (dashboard?.recent_system_errors ?? []).map((item) => ({
    key: item.id,
    cells: [
      <button key="detail" type="button" className="admin-page__ghost" onClick={() => setSelectedSystemError(item)}>
        상세
      </button>,
      item.level || "-",
      item.logger || "-",
      item.event || "-",
      item.path || "-",
      item.status_code ? String(item.status_code) : "-",
      item.message,
      formatDate(item.occurred_at),
    ],
  }));
  const slowRequestRows: DataGridRow[] = (dashboard?.recent_slow_requests ?? []).map((item) => ({
    key: item.id,
    cells: [
      slowRequestKindLabel(item),
      item.method,
      item.path,
      item.status_code ? String(item.status_code) : "-",
      formatMs(item.elapsed_ms),
      formatMs(item.db_duration_ms),
      item.db_query_count.toLocaleString("ko-KR"),
      formatMs(item.threshold_ms),
      item.request_id ? (
        <Link key="request" href={`/admin/audit-logs?tab=system&file=app&request_id=${encodeURIComponent(item.request_id)}`} className="table-link">
          {item.request_id}
        </Link>
      ) : "-",
      formatDate(item.occurred_at),
    ],
  }));
  const slowRequestSummaryRows: DataGridRow[] = (dashboard?.recent_slow_request_summary ?? []).map((item) => ({
    key: item.id,
    cells: [
      slowRequestSummaryKindLabel(item),
      item.method,
      item.path,
      item.count.toLocaleString("ko-KR"),
      formatMs(item.max_elapsed_ms),
      formatMs(item.avg_elapsed_ms),
      formatMs(item.max_db_duration_ms),
      formatMs(item.avg_db_duration_ms),
      formatDate(item.latest_occurred_at),
    ],
  }));
  const editLockRows: DataGridRow[] = (dashboard?.active_edit_locks ?? []).map((item) => ({
    key: item.id,
    cells: [
      <button
        key="release"
        type="button"
        className="admin-page__ghost"
        disabled={releasingLockId === item.id}
        onClick={() => void handleForceReleaseEditLock(item)}
      >
        {releasingLockId === item.id ? "해제 중" : "강제 해제"}
      </button>,
      item.bot_name,
      item.version_name,
      editLockAreaLabel(item.area),
      item.dialog_id,
      editLockOwner(item),
      formatDate(item.last_seen_at),
      formatDate(item.expires_at),
    ],
  }));
  const cacheRows: DataGridRow[] = dashboard?.cache
    ? [
        {
          key: "status",
          cells: [
            "상태",
            cacheAvailabilityLabel(dashboard.cache.enabled, dashboard.cache.available),
            `Backend ${dashboard.cache.backend} / 상태 ${dashboard.cache.connection_state}`,
            dashboard.cache.last_error || "-",
          ],
        },
        {
          key: "readiness",
          cells: [
            "준비",
            dashboard.cache.redis_url_configured ? "Redis URL 설정" : "Redis URL 없음",
            dashboard.cache.package_installed ? "redis 패키지 설치됨" : "redis 패키지 없음",
            dashboard.cache.enabled ? "활성화됨" : "비활성화됨",
          ],
        },
        {
          key: "reads",
          cells: [
            "조회",
            `${dashboard.cache.hit_rate.toLocaleString("ko-KR")}%`,
            `Hit ${dashboard.cache.hits.toLocaleString("ko-KR")} / Miss ${dashboard.cache.misses.toLocaleString("ko-KR")}`,
            `Fallback ${dashboard.cache.fallbacks.toLocaleString("ko-KR")}`,
          ],
        },
        {
          key: "errors",
          cells: [
            "오류",
            `Read ${dashboard.cache.read_errors.toLocaleString("ko-KR")}`,
            `Write ${dashboard.cache.write_errors.toLocaleString("ko-KR")}`,
            `Purge ${dashboard.cache.purge_errors.toLocaleString("ko-KR")}`,
          ],
        },
        {
          key: "purges",
          cells: [
            "초기화",
            `${dashboard.cache.purges.toLocaleString("ko-KR")}회`,
            "studio read-model cache",
            "-",
          ],
        },
        {
          key: "memory",
          cells: [
            "메모리",
            dashboard.cache.memory_usage_percent === null ? "-" : `${dashboard.cache.memory_usage_percent.toLocaleString("ko-KR")}%`,
            `${formatBytes(dashboard.cache.memory_used_bytes)} / ${formatBytes(dashboard.cache.memory_max_bytes)}`,
            dashboard.cache.memory_max_bytes === null ? "maxmemory 미설정" : "-",
          ],
        },
      ]
    : [];
  const integritySummary = versionIntegrity?.summary;
  const versionStorageRows: DataGridRow[] = integritySummary
    ? [
        {
          key: "versions",
          cells: [
            "버전",
            `${integritySummary.version_storage_split_versions.toLocaleString("ko-KR")} / ${integritySummary.version_storage_total_versions.toLocaleString("ko-KR")}`,
            `미적용 ${integritySummary.version_storage_missing_versions.toLocaleString("ko-KR")}`,
            `불일치 ${integritySummary.version_storage_mismatch_versions.toLocaleString("ko-KR")}`,
          ],
        },
        {
          key: "dialogs",
          cells: [
            "대화/모듈",
            integritySummary.version_storage_actual_dialog_rows.toLocaleString("ko-KR"),
            `기준 ${integritySummary.version_storage_expected_dialog_rows.toLocaleString("ko-KR")}`,
            integritySummary.version_storage_actual_dialog_rows === integritySummary.version_storage_expected_dialog_rows ? "일치" : "확인 필요",
          ],
        },
        {
          key: "graphs",
          cells: [
            "대화설계 그래프",
            integritySummary.version_storage_actual_graph_rows.toLocaleString("ko-KR"),
            `기준 ${integritySummary.version_storage_expected_graph_rows.toLocaleString("ko-KR")}`,
            integritySummary.version_storage_actual_graph_rows === integritySummary.version_storage_expected_graph_rows ? "일치" : "확인 필요",
          ],
        },
        {
          key: "read-snapshot",
          cells: [
            "요약 스냅샷",
            `${integritySummary.version_read_snapshot_complete_versions.toLocaleString("ko-KR")} / ${integritySummary.version_read_snapshot_total_versions.toLocaleString("ko-KR")}`,
            `누락 ${integritySummary.version_read_snapshot_missing_versions.toLocaleString("ko-KR")}`,
            [
              integritySummary.version_read_snapshot_missing_asset_counts > 0
                ? `count ${integritySummary.version_read_snapshot_missing_asset_counts.toLocaleString("ko-KR")}`
                : "",
              integritySummary.version_read_snapshot_missing_scenario_validation > 0
                ? `검증 ${integritySummary.version_read_snapshot_missing_scenario_validation.toLocaleString("ko-KR")}`
                : "",
              integritySummary.version_read_snapshot_missing_nlu_training > 0
                ? `학습 ${integritySummary.version_read_snapshot_missing_nlu_training.toLocaleString("ko-KR")}`
                : "",
              integritySummary.version_read_snapshot_missing_entities > 0
                ? `개체 ${integritySummary.version_read_snapshot_missing_entities.toLocaleString("ko-KR")}`
                : "",
              integritySummary.version_read_snapshot_missing_dictionary > 0
                ? `사전 ${integritySummary.version_read_snapshot_missing_dictionary.toLocaleString("ko-KR")}`
                : "",
              integritySummary.version_read_snapshot_missing_apis > 0
                ? `API ${integritySummary.version_read_snapshot_missing_apis.toLocaleString("ko-KR")}`
                : "",
              integritySummary.version_read_snapshot_missing_system_config > 0
                ? `설정 ${integritySummary.version_read_snapshot_missing_system_config.toLocaleString("ko-KR")}`
                : "",
            ].filter(Boolean).join(" / ") || "정상",
          ],
        },
      ]
    : [];
  const versionStorageIssueRows: DataGridRow[] = (versionIntegrity?.version_storage_issues ?? []).map((item) => ({
    key: item.version_id,
    cells: [
      item.status === "missing" ? "미적용" : "불일치",
      item.bot_name,
      `v${item.version_no} · ${item.version_name}`,
      `${item.actual_dialog_rows.toLocaleString("ko-KR")} / ${item.expected_dialog_rows.toLocaleString("ko-KR")}`,
      `${item.actual_graph_rows.toLocaleString("ko-KR")} / ${item.expected_graph_rows.toLocaleString("ko-KR")}`,
      [
        item.missing_dialog_ids.length ? `대화 누락 ${item.missing_dialog_ids.join(", ")}` : "",
        item.extra_dialog_ids.length ? `대화 초과 ${item.extra_dialog_ids.join(", ")}` : "",
        item.missing_graph_ids.length ? `그래프 누락 ${item.missing_graph_ids.join(", ")}` : "",
        item.extra_graph_ids.length ? `그래프 초과 ${item.extra_graph_ids.join(", ")}` : "",
      ].filter(Boolean).join(" / ") || "-",
      item.updated_at ? formatDate(item.updated_at) : "-",
    ],
  }));
  const healthItems = dashboard
    ? [
        {
          key: "api-readiness",
          label: "API/DB 준비",
          value: apiReadiness?.ok ? "정상" : "확인 필요",
          detail: apiReadiness
            ? `API ${apiReadiness.app} · DB ${apiReadiness.database}${apiReadiness.elapsed_ms === null ? "" : ` · ${apiReadiness.elapsed_ms.toLocaleString("ko-KR")}ms`}`
            : "확인 중",
          tone: apiReadiness?.ok ? "normal" : "critical",
        },
        {
          key: "cache",
          label: "캐시",
          value: cacheAvailabilityLabel(dashboard.cache.enabled, dashboard.cache.available),
          detail:
            dashboard.cache.read_errors + dashboard.cache.write_errors + dashboard.cache.purge_errors > 0
              ? `오류 ${(
                  dashboard.cache.read_errors
                  + dashboard.cache.write_errors
                  + dashboard.cache.purge_errors
                ).toLocaleString("ko-KR")}건`
              : `Hit Rate ${dashboard.cache.hit_rate.toLocaleString("ko-KR")}%`,
          tone:
            dashboard.cache.enabled && (!dashboard.cache.available || (dashboard.cache.memory_usage_percent ?? 0) >= 80)
              ? "warning"
              : "normal",
        },
        {
          key: "slow-api",
          label: "응답 지연",
          value: (
            dashboard.summary.slow_api_requests
            + dashboard.summary.slow_db_requests
          ).toLocaleString("ko-KR"),
          detail: `API ${dashboard.summary.slow_api_requests.toLocaleString("ko-KR")} / ${formatMs(dashboard.summary.slow_api_threshold_ms)} · DB ${dashboard.summary.slow_db_requests.toLocaleString("ko-KR")} / ${formatMs(dashboard.summary.slow_db_threshold_ms)}`,
          tone: dashboard.summary.slow_api_requests + dashboard.summary.slow_db_requests > 0 ? "warning" : "normal",
        },
        {
          key: "errors",
          label: "오류",
          value: (
            dashboard.summary.system_errors
            + dashboard.summary.queue_failed
            + dashboard.summary.runtime_problem_events
            + dashboard.summary.api_errors
          ).toLocaleString("ko-KR"),
          detail: `시스템 ${dashboard.summary.system_errors.toLocaleString("ko-KR")} · Queue ${dashboard.summary.queue_failed.toLocaleString("ko-KR")}`,
          tone:
            dashboard.summary.system_errors > 0 || dashboard.summary.queue_failed > 0
              ? "critical"
              : dashboard.summary.runtime_problem_events > 0 || dashboard.summary.api_errors > 0
                ? "warning"
                : "normal",
        },
        {
          key: "locks",
          label: "편집 잠금",
          value: (
            dashboard.summary.active_edit_locks
            + dashboard.summary.expired_edit_locks
            + dashboard.summary.edit_lock_conflicts
          ).toLocaleString("ko-KR"),
          detail: `활성 ${dashboard.summary.active_edit_locks.toLocaleString("ko-KR")} · 만료 ${dashboard.summary.expired_edit_locks.toLocaleString("ko-KR")} · 충돌 ${dashboard.summary.edit_lock_conflicts.toLocaleString("ko-KR")}`,
          tone:
            dashboard.summary.expired_edit_locks > 0 || dashboard.summary.edit_lock_conflicts > 0 || dashboard.summary.active_edit_locks > 0
              ? "warning"
              : "normal",
        },
        {
          key: "version-storage",
          label: "DB 분리",
          value: integritySummary
            ? (integritySummary.version_storage_mismatch_versions + integritySummary.version_read_snapshot_missing_versions).toLocaleString("ko-KR")
            : "점검 대기",
          detail: integritySummary
            ? `분리 미적용 ${integritySummary.version_storage_missing_versions.toLocaleString("ko-KR")} · 스냅샷 누락 ${integritySummary.version_read_snapshot_missing_versions.toLocaleString("ko-KR")} · 적용 ${integritySummary.version_storage_split_versions.toLocaleString("ko-KR")}/${integritySummary.version_storage_total_versions.toLocaleString("ko-KR")}`
            : "DB 분리 상태에서 무결성 점검을 실행하세요.",
          tone: !integritySummary
            ? "warning"
            : integritySummary.version_storage_mismatch_versions > 0
              ? "critical"
              : integritySummary.version_storage_missing_versions > 0 || integritySummary.version_read_snapshot_missing_versions > 0
                ? "warning"
                : "normal",
        },
        ...(["ml", "semantic"] as const).map((engine) => {
          const acceleration = dashboard.nlu_acceleration[engine];
          const executionCount = acceleration.execution_count ?? 0;
          const value = acceleration.available === true
            ? executionCount > 0 ? "실행 확인" : "사용 가능"
            : acceleration.available === false ? "미사용" : "확인 대기";
          const detail = acceleration.available === true
            ? `${acceleration.device ?? "CUDA"} · 컨테이너 시작 후 ${executionCount.toLocaleString("ko-KR")}회${acceleration.last_execution_at ? ` · 최근 ${formatDate(acceleration.last_execution_at)}` : ""}`
            : acceleration.available === false
              ? acceleration.error ?? "CUDA 또는 엔진 상태를 확인하세요."
              : "GPU 연산이 아직 실행되지 않았습니다.";          return {
            key: `${engine}-gpu`,
            label: engine === "ml" ? "ML GPU" : "시멘틱 GPU",
            value,
            detail,
            tone: acceleration.available ? "normal" : "warning",
          };
        }),
      ]
    : [];
  const operationsAlerts = dashboard
    ? [...dashboard.alerts, ...(versionIntegrity?.alerts ?? [])]
    : [];
  const readinessOnlyItems = !dashboard && apiReadiness
    ? [
        {
          key: "api-readiness",
          label: "API/DB 준비",
          value: apiReadiness.ok ? "정상" : "확인 필요",
          detail: `API ${apiReadiness.app} · DB ${apiReadiness.database}${apiReadiness.elapsed_ms === null ? "" : ` · ${apiReadiness.elapsed_ms.toLocaleString("ko-KR")}ms`}`,
          tone: apiReadiness.ok ? "normal" : "critical",
        },
      ]
    : [];

  function resetFilters() {
    setPeriod("1h");
    setGroupId("");
    setBotId("");
    setChannelCode("");
  }

  async function handleVersionIntegrityCheck() {
    if (!token || checkingVersionIntegrity) {
      return;
    }
    setCheckingVersionIntegrity(true);
    setErrorMessage("");
    try {
      const result = await fetchOperationsDashboardVersionIntegrity(token, {
        group_id: groupId || undefined,
        bot_id: botId || undefined,
      });
      setVersionIntegrity(result);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "버전 무결성 상태를 불러오지 못했습니다.");
    } finally {
      setCheckingVersionIntegrity(false);
    }
  }

  async function handlePurgeVersionCache() {
    if (!token || purgingCache) {
      return;
    }
    const confirmed = window.confirm("Studio 화면 조회 캐시를 초기화하시겠습니까? 저장 데이터는 삭제되지 않습니다.");
    if (!confirmed) {
      return;
    }
    setPurgingCache(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const result = await purgeAdminCache(token, "studio_read_models");
      setStatusMessage(
        result.status === "purged"
          ? `캐시 초기화 완료: ${result.purged.toLocaleString("ko-KR")}건`
          : `캐시 초기화 건너뜀: ${result.reason || "캐시를 사용할 수 없습니다."}`,
      );
      const nextDashboard = await fetchOperationsDashboard(token, {
        ...dashboardPeriodFilters(period),
        group_id: groupId || undefined,
        bot_id: botId || undefined,
        channel_code: channelCode || undefined,
        refresh: true,
      });
      setDashboard(nextDashboard);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "캐시 초기화에 실패했습니다.");
    } finally {
      setPurgingCache(false);
    }
  }

  async function handleForceReleaseEditLock(item: AdminOperationsDashboardEditLockItem) {
    if (!token || releasingLockId) {
      return;
    }
    const confirmed = window.confirm(
      `${editLockOwner(item)}님의 편집 잠금을 강제 해제하시겠습니까? 저장 중인 사용자의 편집 권한이 해제될 수 있습니다.`,
    );
    if (!confirmed) {
      return;
    }
    setReleasingLockId(item.id);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const result = await forceReleaseEditLock(token, item.id);
      setStatusMessage(result.released ? "편집 잠금을 해제했습니다." : "해제할 편집 잠금을 찾지 못했습니다.");
      const nextDashboard = await fetchOperationsDashboard(token, {
        ...dashboardPeriodFilters(period),
        group_id: groupId || undefined,
        bot_id: botId || undefined,
        channel_code: channelCode || undefined,
        refresh: true,
      });
      setDashboard(nextDashboard);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "편집 잠금을 해제하지 못했습니다.");
    } finally {
      setReleasingLockId("");
    }
  }

  async function handleVersionStorageBackfill(dryRun: boolean) {
    if (!token || backfillingVersionStorage) {
      return;
    }
    if (!dryRun) {
      const confirmed = window.confirm("현재 검색 조건의 DB 분리 backfill을 실행하시겠습니까? version_json은 유지되고 분리 테이블만 동기화됩니다.");
      if (!confirmed) {
        return;
      }
    }
    setBackfillingVersionStorage(dryRun ? "dry_run" : "run");
    setErrorMessage("");
    setStatusMessage("");
    try {
      const result = await backfillVersionStorage(token, {
        dry_run: dryRun,
        limit: 1000,
        group_id: groupId || undefined,
        bot_id: botId || undefined,
      });
      const failedCount = result.failed_versions.length;
      setStatusMessage(
        dryRun
          ? `DB 분리 점검 완료: 대상 ${result.selected_versions.toLocaleString("ko-KR")}개 버전`
          : `DB 분리 backfill 완료: 처리 ${result.processed_versions.toLocaleString("ko-KR")}개, 실패 ${failedCount.toLocaleString("ko-KR")}개`,
      );
      const nextDashboard = await fetchOperationsDashboard(token, {
        ...dashboardPeriodFilters(period),
        group_id: groupId || undefined,
        bot_id: botId || undefined,
        channel_code: channelCode || undefined,
        refresh: true,
      });
      setDashboard(nextDashboard);
      await handleVersionIntegrityCheck();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "DB 분리 backfill에 실패했습니다.");
    } finally {
      setBackfillingVersionStorage("");
    }
  }

  async function handleVersionReadSnapshotBackfill(dryRun: boolean) {
    if (!token || backfillingReadSnapshots) {
      return;
    }
    if (!dryRun) {
      const confirmed = window.confirm("현재 검색 조건의 버전 요약 스냅샷 backfill을 실행하시겠습니까? version_json은 유지되고 요약 컬럼만 갱신됩니다.");
      if (!confirmed) {
        return;
      }
    }
    setBackfillingReadSnapshots(dryRun ? "dry_run" : "run");
    setErrorMessage("");
    setStatusMessage("");
    try {
      const result = await backfillVersionReadSnapshots(token, {
        dry_run: dryRun,
        limit: 1000,
        group_id: groupId || undefined,
        bot_id: botId || undefined,
      });
      const failedCount = result.failed_versions.length;
      setStatusMessage(
        dryRun
          ? `요약 스냅샷 점검 완료: 대상 ${result.selected_versions.toLocaleString("ko-KR")}개 버전`
          : `요약 스냅샷 backfill 완료: 처리 ${result.processed_versions.toLocaleString("ko-KR")}개, 실패 ${failedCount.toLocaleString("ko-KR")}개`,
      );
      const nextDashboard = await fetchOperationsDashboard(token, {
        ...dashboardPeriodFilters(period),
        group_id: groupId || undefined,
        bot_id: botId || undefined,
        channel_code: channelCode || undefined,
        refresh: true,
      });
      setDashboard(nextDashboard);
      await handleVersionIntegrityCheck();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "요약 스냅샷 backfill에 실패했습니다.");
    } finally {
      setBackfillingReadSnapshots("");
    }
  }

  return (
    <section className="admin-page operations-dashboard">
      <div className="admin-page__title-row">
        <div>
          <h2>{copy.title}</h2>
          <p className="operations-dashboard__subtitle">{copy.subtitle}</p>
        </div>
        <div className="admin-page__actions">
          <Link href="/admin/api-call-history" className="admin-page__link-button">
            {copy.apiHistory}
          </Link>
          <Link href="/admin/queue-history" className="admin-page__link-button">
            {copy.queueHistory}
          </Link>
        </div>
      </div>

      <div className="admin-page__filters" aria-label={copy.filters}>
        <select value={period} onChange={(event) => setPeriod(event.target.value as PeriodValue)} aria-label={copy.period}>
          {PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          value={groupId}
          onChange={(event) => {
            setGroupId(event.target.value);
            setBotId("");
          }}
          aria-label={copy.groupFilter}
        >
          <option value="">{copy.allGroups}</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </select>
        <select value={botId} onChange={(event) => setBotId(event.target.value)} aria-label={copy.botFilter}>
          <option value="">{copy.allBots}</option>
          {filteredBots.map((bot) => (
            <option key={bot.id} value={bot.id}>{bot.name}</option>
          ))}
        </select>
        <select value={channelCode} onChange={(event) => setChannelCode(event.target.value)} aria-label={copy.channelFilter}>
          <option value="">{copy.allChannels}</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.code}>{channel.name}</option>
          ))}
        </select>
        <button type="button" className="admin-page__ghost" onClick={resetFilters}>{copy.reset}</button>
      </div>

      {errorMessage ? <p className="admin-error-message">{errorMessage}</p> : null}
      {statusMessage ? <p className="admin-loading-message">{statusMessage}</p> : null}
      {loading ? <p className="admin-loading-message">{copy.loading}</p> : null}
      {readinessOnlyItems.length > 0 ? (
        <div className="operations-dashboard__health" aria-label={copy.readiness}>
          {readinessOnlyItems.map((item) => (
            <article key={item.key} className={`operations-dashboard__health-item is-${item.tone}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </article>
          ))}
        </div>
      ) : null}

      {dashboard ? (
        <>
          <div className="operations-dashboard__health" aria-label={copy.healthSummary}>
            {healthItems.map((item) => (
              <article key={item.key} className={`operations-dashboard__health-item is-${item.tone}`}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </article>
            ))}
          </div>

          <section className="operations-dashboard__panel operations-dashboard__alerts">
            <div className="operations-dashboard__panel-header">
              <h3>{copy.alerts}</h3>
              <span>{copy.alertThreshold}</span>
              <Link href="/admin/audit-logs?tab=system" className="admin-page__link-button">
                {copy.systemLogs}
              </Link>
            </div>
            {operationsAlerts.length > 0 ? (
              <div className="operations-dashboard__alert-list">
                {operationsAlerts.map((item) => (
                  <article key={item.code} className={`operations-dashboard__alert is-${item.level}`}>
                    <strong>{item.title}</strong>
                    <span>{item.message}</span>
                  </article>
                ))}
              </div>
            ) : (
              <p className="operations-dashboard__empty">{copy.noAlerts}</p>
            )}
          </section>

          <div className="operations-dashboard__grid">
            {SUMMARY_LABELS.map((item) => (
              <article key={item.key} className={`operations-dashboard__metric${item.tone === "warning" ? " is-warning" : ""}`}>
                <span>{item.label}</span>
                <strong>{dashboard.summary[item.key].toLocaleString("ko-KR")}</strong>
              </article>
            ))}
          </div>

          <section className="operations-dashboard__panel">
            <div className="operations-dashboard__panel-header">
              <h3>{copy.cacheStatus}</h3>
              <span>{copy.cacheDescription}</span>
              <button type="button" className="admin-page__ghost" disabled={purgingCache} onClick={handlePurgeVersionCache}>
                {purgingCache ? copy.purging : copy.purgeCache}
              </button>
            </div>
            <DataGrid
              variant="admin"
              columns={copy.cacheColumns}
              rows={cacheRows}
              sortableColumns={[false, false, false, false]}
              template="120px 180px 260px minmax(260px, 1fr)"
            />
          </section>

          <section className="operations-dashboard__panel">
            <div className="operations-dashboard__panel-header">
              <h3>{copy.dbIntegrity}</h3>
              <span>
                {versionIntegrity
                  ? `${copy.integrityDescription} · ${copy.checkIntegrity} ${formatDate(versionIntegrity.generated_at)}`
                  : copy.integrityPending}
              </span>
              <button type="button" className="admin-page__ghost" disabled={checkingVersionIntegrity} onClick={handleVersionIntegrityCheck}>
                {checkingVersionIntegrity ? copy.checkingIntegrity : copy.checkIntegrity}
              </button>
              <button type="button" className="admin-page__ghost" disabled={Boolean(backfillingVersionStorage)} onClick={() => handleVersionStorageBackfill(true)}>
                {backfillingVersionStorage === "dry_run" ? copy.checkingIntegrity : copy.backfillCheck}
              </button>
              <button type="button" className="admin-page__ghost" disabled={Boolean(backfillingVersionStorage)} onClick={() => handleVersionStorageBackfill(false)}>
                {backfillingVersionStorage === "run" ? copy.checkingIntegrity : copy.backfillRun}
              </button>
              <button type="button" className="admin-page__ghost" disabled={Boolean(backfillingReadSnapshots)} onClick={() => handleVersionReadSnapshotBackfill(true)}>
                {backfillingReadSnapshots === "dry_run" ? copy.checkingIntegrity : copy.snapshotCheck}
              </button>
              <button type="button" className="admin-page__ghost" disabled={Boolean(backfillingReadSnapshots)} onClick={() => handleVersionReadSnapshotBackfill(false)}>
                {backfillingReadSnapshots === "run" ? copy.checkingIntegrity : copy.snapshotCreate}
              </button>
            </div>
            {versionIntegrity ? (
              <DataGrid
                variant="admin"
                columns={copy.integrityColumns}
                rows={versionStorageRows}
                sortableColumns={[false, false, false, false]}
                template="160px 180px 220px minmax(220px, 1fr)"
              />
            ) : (
              <p className="operations-dashboard__empty">{copy.integrityEmpty}</p>
            )}
            {versionStorageIssueRows.length > 0 ? (
              <DataGrid
                variant="admin"
                columns={copy.versionColumns}
                rows={versionStorageIssueRows}
                sortableColumns={[false, false, false, false, false, false, false]}
                template="90px 170px 140px 100px 100px minmax(320px, 1fr) 180px"
              />
            ) : null}
          </section>

          <section className="operations-dashboard__panel">
            <div className="operations-dashboard__panel-header">
              <h3>{copy.recentErrors}</h3>
              <span>{copy.generatedAt} {formatDate(dashboard.generated_at)}</span>
              <Link href="/admin/queue-history" className="admin-page__link-button">
                {copy.queueHistory}
              </Link>
            </div>
            {sortedRows.length > 0 ? (
              <DataGrid
                variant="admin"
                columns={copy.errorColumns}
                rows={sortedRows}
                sortState={sortState}
                onSort={setSortState}
                sortableColumns={[false, true, true, true, true, true, true]}
                template="76px 120px 170px 220px 220px minmax(320px, 1fr) 180px"
              />
            ) : (
              <p className="operations-dashboard__empty">{copy.noErrors}</p>
            )}
          </section>

          <section className="operations-dashboard__panel">
            <div className="operations-dashboard__panel-header">
              <h3>{copy.slowSummary}</h3>
              <span>{copy.slowSummaryDescription}</span>
              <Link href="/admin/audit-logs?tab=system&file=app" className="admin-page__link-button">
                {copy.systemLogs}
              </Link>
            </div>
            {slowRequestSummaryRows.length > 0 ? (
              <DataGrid
                variant="admin"
                columns={copy.slowSummaryColumns}
                rows={slowRequestSummaryRows}
                sortableColumns={[false, false, false, false, false, false, false, false, false]}
                template="100px 86px minmax(280px, 1fr) 70px 100px 100px 100px 100px 180px"
              />
            ) : (
              <p className="operations-dashboard__empty">{copy.noSlow}</p>
            )}
          </section>

          <section className="operations-dashboard__panel">
            <div className="operations-dashboard__panel-header">
              <h3>{copy.slowDetail}</h3>
              <span>{copy.slowDetailDescription}</span>
            </div>
            {slowRequestRows.length > 0 ? (
              <DataGrid
                variant="admin"
                columns={copy.slowDetailColumns}
                rows={slowRequestRows}
                sortableColumns={[false, false, false, false, false, false, false, false, false, false]}
                template="100px 86px minmax(260px, 1fr) 70px 90px 90px 70px 90px 240px 180px"
              />
            ) : (
              <p className="operations-dashboard__empty">{copy.noSlow}</p>
            )}
          </section>

          <section className="operations-dashboard__panel">
            <div className="operations-dashboard__panel-header">
              <h3>{copy.runtimeFlow}</h3>
              <span>{copy.runtimeDescription}</span>
              <Link href="/admin/conversations" className="admin-page__link-button">
                {copy.conversationHistory}
              </Link>
            </div>
            {runtimeRows.length > 0 ? (
              <DataGrid
                variant="admin"
                columns={copy.runtimeColumns}
                rows={runtimeRows}
                sortableColumns={[false, false, false, false, false, false, false, false, false]}
                template="76px 90px 90px 160px 160px 140px 220px minmax(260px, 1fr) 180px"
              />
            ) : (
              <p className="operations-dashboard__empty">{copy.noRuntime}</p>
            )}
          </section>

          <section className="operations-dashboard__panel">
            <div className="operations-dashboard__panel-header">
              <h3>{copy.editLocks}</h3>
              <span>{copy.editLocksDescription}</span>
              <Link href="/admin/audit-logs?tab=audit&q=edit_lock" className="admin-page__link-button">
                {copy.auditLogs}
              </Link>
            </div>
            {editLockRows.length > 0 ? (
              <DataGrid
                variant="admin"
                columns={copy.lockColumns}
                rows={editLockRows}
                sortableColumns={[false, false, false, false, false, false, false, false]}
                template="100px 160px 120px 110px minmax(180px, 1fr) 140px 180px 180px"
              />
            ) : (
              <p className="operations-dashboard__empty">{copy.noLocks}</p>
            )}
          </section>

          <section className="operations-dashboard__panel">
            <div className="operations-dashboard__panel-header">
              <h3>{copy.systemErrorsTitle}</h3>
              <span>{copy.systemErrorsDescription}</span>
              <Link href="/admin/audit-logs?tab=system&file=error" className="admin-page__link-button">
                {copy.systemLogs}
              </Link>
            </div>
            {systemErrorRows.length > 0 ? (
              <DataGrid
                variant="admin"
                columns={copy.systemErrorColumns}
                rows={systemErrorRows}
                sortableColumns={[false, false, false, false, false, false, false, false]}
                template="76px 80px 140px 220px 220px 80px minmax(300px, 1fr) 180px"
              />
            ) : (
              <p className="operations-dashboard__empty">{copy.noSystemErrors}</p>
            )}
          </section>
        </>
      ) : null}
      {selectedError ? (
        <>
          <div className="admin-log-detail__scrim" onClick={() => setSelectedError(null)} />
          <section className="admin-log-detail" role="dialog" aria-modal="true" aria-label="운영 오류 상세">
            <header className="admin-log-detail__header">
              <div>
                <strong>운영 오류 상세</strong>
                <p>{selectedError.bot_name} · {selectedError.event || "-"}</p>
              </div>
              <button type="button" className="admin-log-detail__close" onClick={() => setSelectedError(null)} aria-label="닫기">
                x
              </button>
            </header>
            <div className="admin-log-detail__body">
              <section className="admin-log-detail__section">
                <h3>오류 요약</h3>
                <pre>
                  {formatJson({
                    source: selectedError.source,
                    bot_name: selectedError.bot_name,
                    location: locationFromData(selectedError.data_json),
                    event: selectedError.event,
                    message: selectedError.message,
                    occurred_at: selectedError.occurred_at,
                  })}
                </pre>
              </section>
              {selectedErrorVariableTrace?.hasTrace ? (
                <section className="admin-log-detail__section">
                  <h3>변수 변경</h3>
                  <pre>
                    {formatJson({
                      updatedVariables: selectedErrorVariableTrace?.updatedVariables ?? [],
                      valuePreviews: selectedErrorVariableTrace?.valuePreviews ?? {},
                    })}
                  </pre>
                </section>
              ) : null}
              {selectedErrorQueueId ? (
                <section className="admin-log-detail__section">
                  <h3>연결 이력</h3>
                  <div className="admin-log-detail__actions">
                    <Link href={traceHref("/admin/queue-history", selectedErrorQueueId)} className="admin-page__link-button">
                      Queue 이력
                    </Link>
                    <Link href={traceHref("/admin/conversations", selectedErrorQueueId)} className="admin-page__link-button">
                      대화 이력
                    </Link>
                    <Link href={traceHref("/admin/api-call-history", selectedErrorQueueId)} className="admin-page__link-button">
                      API 이력
                    </Link>
                  </div>
                </section>
              ) : null}
              <section className="admin-log-detail__section">
                <h3>상세 데이터</h3>
                <pre>{formatJson(selectedError.data_json ?? {})}</pre>
              </section>
            </div>
          </section>
        </>
      ) : null}
      {selectedRuntimeEvent ? (
        <>
          <div className="admin-log-detail__scrim" onClick={() => setSelectedRuntimeEvent(null)} />
          <section className="admin-log-detail" role="dialog" aria-modal="true" aria-label="실행 흐름 상세">
            <header className="admin-log-detail__header">
              <div>
                <strong>실행 흐름 상세</strong>
                <p>{selectedRuntimeEvent.bot_name} · {selectedRuntimeEvent.event || "-"}</p>
              </div>
              <button type="button" className="admin-log-detail__close" onClick={() => setSelectedRuntimeEvent(null)} aria-label="닫기">
                x
              </button>
            </header>
            <div className="admin-log-detail__body">
              <section className="admin-log-detail__section">
                <h3>실행 요약</h3>
                <pre>
                  {formatJson({
                    source: selectedRuntimeEvent.source,
                    level: selectedRuntimeEvent.level,
                    bot_name: selectedRuntimeEvent.bot_name,
                    dialog_name: selectedRuntimeEvent.dialog_name,
                    node_title: selectedRuntimeEvent.node_title,
                    location: runtimeItemLocation(selectedRuntimeEvent),
                    event: selectedRuntimeEvent.event,
                    message: selectedRuntimeEvent.message,
                    occurred_at: selectedRuntimeEvent.occurred_at,
                  })}
                </pre>
              </section>
              {selectedRuntimeEventVariableTrace?.hasTrace ? (
                <section className="admin-log-detail__section">
                  <h3>변수 변경</h3>
                  <pre>
                    {formatJson({
                      updatedVariables: selectedRuntimeEventVariableTrace?.updatedVariables ?? [],
                      valuePreviews: selectedRuntimeEventVariableTrace?.valuePreviews ?? {},
                    })}
                  </pre>
                </section>
              ) : null}
              {selectedRuntimeQueueId ? (
                <section className="admin-log-detail__section">
                  <h3>연결 이력</h3>
                  <div className="admin-log-detail__actions">
                    <Link href={traceHref("/admin/queue-history", selectedRuntimeQueueId)} className="admin-page__link-button">
                      Queue 이력
                    </Link>
                    <Link href={traceHref("/admin/conversations", selectedRuntimeQueueId)} className="admin-page__link-button">
                      대화 이력
                    </Link>
                    <Link href={traceHref("/admin/api-call-history", selectedRuntimeQueueId)} className="admin-page__link-button">
                      API 이력
                    </Link>
                  </div>
                </section>
              ) : null}
              <section className="admin-log-detail__section">
                <h3>상세 데이터</h3>
                <pre>{formatJson(selectedRuntimeEvent.data_json ?? {})}</pre>
              </section>
            </div>
          </section>
        </>
      ) : null}
      {selectedSystemError ? (
        <>
          <div className="admin-log-detail__scrim" onClick={() => setSelectedSystemError(null)} />
          <section className="admin-log-detail" role="dialog" aria-modal="true" aria-label="시스템 오류 상세">
            <header className="admin-log-detail__header">
              <div>
                <strong>시스템 오류 상세</strong>
                <p>{selectedSystemError.logger || "-"} · {selectedSystemError.event || "-"}</p>
              </div>
              <button type="button" className="admin-log-detail__close" onClick={() => setSelectedSystemError(null)} aria-label="닫기">
                x
              </button>
            </header>
            <div className="admin-log-detail__body">
              <section className="admin-log-detail__section">
                <h3>오류 요약</h3>
                <pre>
                  {formatJson({
                    source: selectedSystemError.source,
                    level: selectedSystemError.level,
                    logger: selectedSystemError.logger,
                    event: selectedSystemError.event,
                    message: selectedSystemError.message,
                    path: selectedSystemError.path,
                    status_code: selectedSystemError.status_code,
                    request_id: selectedSystemError.request_id,
                    occurred_at: selectedSystemError.occurred_at,
                  })}
                </pre>
              </section>
              {selectedSystemError.request_id ? (
                <section className="admin-log-detail__section">
                  <h3>로그 추적</h3>
                  <Link
                    href={`/admin/audit-logs?tab=system&file=error&request_id=${encodeURIComponent(selectedSystemError.request_id)}`}
                    className="admin-page__ghost"
                  >
                    요청 ID로 시스템 로그 조회
                  </Link>
                </section>
              ) : null}
              {selectedSystemErrorVariableTrace?.hasTrace ? (
                <section className="admin-log-detail__section">
                  <h3>변수 변경</h3>
                  <pre>
                    {formatJson({
                      updatedVariables: selectedSystemErrorVariableTrace?.updatedVariables ?? [],
                      valuePreviews: selectedSystemErrorVariableTrace?.valuePreviews ?? {},
                    })}
                  </pre>
                </section>
              ) : null}
              <section className="admin-log-detail__section">
                <h3>상세 데이터</h3>
                <pre>{formatJson(selectedSystemError.data_json ?? {})}</pre>
              </section>
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
