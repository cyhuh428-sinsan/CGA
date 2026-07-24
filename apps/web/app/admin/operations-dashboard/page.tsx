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
import { ADMIN_OPERATIONS_ACTION_CATALOGS, formatOperationsText } from "@/lib/i18n/admin-operations-actions";
import { ADMIN_OPERATIONS_DASHBOARD_CATALOGS } from "@/lib/i18n/admin-operations-dashboard";
import { ADMIN_OPERATIONS_DETAILS_CATALOGS } from "@/lib/i18n/admin-operations-details";
import { ADMIN_OPERATIONS_STATUS_CATALOGS, type AdminOperationsStatusCatalog } from "@/lib/i18n/admin-operations-status";
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

const SUMMARY_LABELS: Array<{ key: keyof AdminOperationsDashboardResponse["summary"]; tone?: "warning" | "normal" }> = [
  { key: "total_bots" }, { key: "operating_bots" }, { key: "botstation_connected_bots" }, { key: "active_channels" },
  { key: "channel_rooms" }, { key: "user_messages" }, { key: "queue_events" }, { key: "queue_queued", tone: "warning" },
  { key: "queue_processing" }, { key: "queue_completed" }, { key: "queue_failed", tone: "warning" }, { key: "runtime_events" },
  { key: "runtime_problem_events", tone: "warning" }, { key: "system_errors", tone: "warning" }, { key: "slow_api_requests", tone: "warning" },
  { key: "slow_db_requests", tone: "warning" }, { key: "active_edit_locks", tone: "warning" }, { key: "expired_edit_locks", tone: "warning" },
  { key: "edit_lock_conflicts", tone: "warning" }, { key: "api_calls" }, { key: "api_errors", tone: "warning" },
  { key: "intent_fallbacks", tone: "warning" }, { key: "training_success" }, { key: "training_failed", tone: "warning" },
];

function formatDate(value: string, locale: string) {
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

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatBytes(value: number | null, locale: string) {
  if (value === null) return "-";
  if (value < 1024) return `${value.toLocaleString(locale)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let nextValue = value / 1024;
  let unitIndex = 0;
  while (nextValue >= 1024 && unitIndex < units.length - 1) {
    nextValue /= 1024;
    unitIndex += 1;
  }
  return `${nextValue.toLocaleString(locale, { maximumFractionDigits: 1 })} ${units[unitIndex]}`;
}

function formatMs(value: number | null | undefined, locale: string) {
  if (value === null || value === undefined) return "-";
  return `${value.toLocaleString(locale, { maximumFractionDigits: 1 })}ms`;
}

function slowRequestKindLabel(item: AdminOperationsDashboardSlowRequestItem, statusCopy: AdminOperationsStatusCatalog) {
  return item.kind === "db" ? statusCopy.slowDb : statusCopy.slowApi;
}

function slowRequestSummaryKindLabel(item: AdminOperationsDashboardSlowRequestSummaryItem, statusCopy: AdminOperationsStatusCatalog) {
  return item.kind === "db" ? statusCopy.slowDb : statusCopy.slowApi;
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

function editLockAreaLabel(area: string, statusCopy: AdminOperationsStatusCatalog) {
  if (area in statusCopy.editAreas) return statusCopy.editAreas[area];
  return area || "-";
}

function editLockOwner(item: AdminOperationsDashboardEditLockItem) {
  return item.owner_name?.trim() || item.owner_login_id || "-";
}

function cacheAvailabilityLabel(enabled: boolean, available: boolean | null, statusCopy: AdminOperationsStatusCatalog) {
  if (!enabled) return statusCopy.cacheAvailability.disabled;
  if (available === null) return statusCopy.cacheAvailability.pending;
  return available ? statusCopy.cacheAvailability.available : statusCopy.cacheAvailability.fallback;
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
  const actionCopy = ADMIN_OPERATIONS_ACTION_CATALOGS[uiLanguage];
  const statusCopy = ADMIN_OPERATIONS_STATUS_CATALOGS[uiLanguage];
  const detailsCopy = ADMIN_OPERATIONS_DETAILS_CATALOGS[uiLanguage];
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
      setErrorMessage(statusCopy.loginRequired);
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
        if (!ignore) setErrorMessage(error instanceof Error ? error.message : statusCopy.filterLoadFailed);
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
        setErrorMessage(dashboardResult.reason instanceof Error ? dashboardResult.reason.message : statusCopy.dashboardLoadFailed);
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
        {statusCopy.detail}
      </button>,
      item.source,
      item.bot_name,
      locationFromData(item.data_json),
      item.event || "-",
      item.message,
      formatDate(item.occurred_at, uiLanguage),
    ],
  }));
  const sortedRows = useMemo(() => {
    if (!sortState) {
      return rows;
    }
    return [...rows].sort((left, right) => {
      const leftText = dataGridCellText(left.cells[sortState.columnIndex]);
      const rightText = dataGridCellText(right.cells[sortState.columnIndex]);
      const result = leftText.localeCompare(rightText, uiLanguage, { numeric: true, sensitivity: "base" });
      return sortState.direction === "asc" ? result : -result;
    });
  }, [rows, sortState, uiLanguage]);
  const runtimeRows: DataGridRow[] = (dashboard?.recent_runtime_events ?? []).map((item) => ({
    key: item.id,
    cells: [
      <button key="detail" type="button" className="admin-page__ghost" onClick={() => setSelectedRuntimeEvent(item)}>
        {statusCopy.detail}
      </button>,
      item.source,
      item.level,
      item.bot_name,
      item.dialog_name,
      item.node_title,
      item.event || "-",
      item.message,
      formatDate(item.occurred_at, uiLanguage),
    ],
  }));
  const systemErrorRows: DataGridRow[] = (dashboard?.recent_system_errors ?? []).map((item) => ({
    key: item.id,
    cells: [
      <button key="detail" type="button" className="admin-page__ghost" onClick={() => setSelectedSystemError(item)}>
        {statusCopy.detail}
      </button>,
      item.level || "-",
      item.logger || "-",
      item.event || "-",
      item.path || "-",
      item.status_code ? String(item.status_code) : "-",
      item.message,
      formatDate(item.occurred_at, uiLanguage),
    ],
  }));
  const slowRequestRows: DataGridRow[] = (dashboard?.recent_slow_requests ?? []).map((item) => ({
    key: item.id,
    cells: [
      slowRequestKindLabel(item, statusCopy),
      item.method,
      item.path,
      item.status_code ? String(item.status_code) : "-",
      formatMs(item.elapsed_ms, uiLanguage),
      formatMs(item.db_duration_ms, uiLanguage),
      item.db_query_count.toLocaleString(uiLanguage),
      formatMs(item.threshold_ms, uiLanguage),
      item.request_id ? (
        <Link key="request" href={`/admin/audit-logs?tab=system&file=app&request_id=${encodeURIComponent(item.request_id)}`} className="table-link">
          {item.request_id}
        </Link>
      ) : "-",
      formatDate(item.occurred_at, uiLanguage),
    ],
  }));
  const slowRequestSummaryRows: DataGridRow[] = (dashboard?.recent_slow_request_summary ?? []).map((item) => ({
    key: item.id,
    cells: [
      slowRequestSummaryKindLabel(item, statusCopy),
      item.method,
      item.path,
      item.count.toLocaleString(uiLanguage),
      formatMs(item.max_elapsed_ms, uiLanguage),
      formatMs(item.avg_elapsed_ms, uiLanguage),
      formatMs(item.max_db_duration_ms, uiLanguage),
      formatMs(item.avg_db_duration_ms, uiLanguage),
      formatDate(item.latest_occurred_at, uiLanguage),
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
        {releasingLockId === item.id ? actionCopy.releasing : actionCopy.forceRelease}
      </button>,
      item.bot_name,
      item.version_name,
      editLockAreaLabel(item.area, statusCopy),
      item.dialog_id,
      editLockOwner(item),
      formatDate(item.last_seen_at, uiLanguage),
      formatDate(item.expires_at, uiLanguage),
    ],
  }));
  const cacheRows: DataGridRow[] = dashboard?.cache
    ? [
        {
          key: "status",
          cells: [
            detailsCopy.cache.status,
            cacheAvailabilityLabel(dashboard.cache.enabled, dashboard.cache.available, statusCopy),
            formatOperationsText(detailsCopy.cache.backendState, { backend: dashboard.cache.backend, state: dashboard.cache.connection_state }),
            dashboard.cache.last_error || "-",
          ],
        },
        {
          key: "readiness",
          cells: [
            detailsCopy.cache.readiness,
            dashboard.cache.redis_url_configured ? detailsCopy.cache.redisConfigured : detailsCopy.cache.redisMissing,
            dashboard.cache.package_installed ? detailsCopy.cache.packageInstalled : detailsCopy.cache.packageMissing,
            dashboard.cache.enabled ? detailsCopy.cache.enabled : detailsCopy.cache.disabled,
          ],
        },
        {
          key: "reads",
          cells: [
            detailsCopy.cache.reads,
            `${dashboard.cache.hit_rate.toLocaleString(uiLanguage)}%`,
            `Hit ${dashboard.cache.hits.toLocaleString(uiLanguage)} / Miss ${dashboard.cache.misses.toLocaleString(uiLanguage)}`,
            `Fallback ${dashboard.cache.fallbacks.toLocaleString(uiLanguage)}`,
          ],
        },
        {
          key: "errors",
          cells: [
            detailsCopy.cache.errors,
            `Read ${dashboard.cache.read_errors.toLocaleString(uiLanguage)}`,
            `Write ${dashboard.cache.write_errors.toLocaleString(uiLanguage)}`,
            `Purge ${dashboard.cache.purge_errors.toLocaleString(uiLanguage)}`,
          ],
        },
        {
          key: "purges",
          cells: [
            detailsCopy.cache.purges,
            formatOperationsText(detailsCopy.cache.times, { count: dashboard.cache.purges.toLocaleString(uiLanguage) }),
            "studio read-model cache",
            "-",
          ],
        },
        {
          key: "memory",
          cells: [
            detailsCopy.cache.memory,
            dashboard.cache.memory_usage_percent === null ? "-" : `${dashboard.cache.memory_usage_percent.toLocaleString(uiLanguage)}%`,
            `${formatBytes(dashboard.cache.memory_used_bytes, uiLanguage)} / ${formatBytes(dashboard.cache.memory_max_bytes, uiLanguage)}`,
            dashboard.cache.memory_max_bytes === null ? detailsCopy.cache.maxmemoryUnset : "-",
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
            detailsCopy.integrity.version,
            `${integritySummary.version_storage_split_versions.toLocaleString(uiLanguage)} / ${integritySummary.version_storage_total_versions.toLocaleString(uiLanguage)}`,
            formatOperationsText(detailsCopy.integrity.notApplied, { count: integritySummary.version_storage_missing_versions.toLocaleString(uiLanguage) }),
            formatOperationsText(detailsCopy.integrity.mismatch, { count: integritySummary.version_storage_mismatch_versions.toLocaleString(uiLanguage) }),
          ],
        },
        {
          key: "dialogs",
          cells: [
            detailsCopy.integrity.dialogs,
            integritySummary.version_storage_actual_dialog_rows.toLocaleString(uiLanguage),
            formatOperationsText(detailsCopy.integrity.baseline, { count: integritySummary.version_storage_expected_dialog_rows.toLocaleString(uiLanguage) }),
            integritySummary.version_storage_actual_dialog_rows === integritySummary.version_storage_expected_dialog_rows ? detailsCopy.integrity.match : detailsCopy.integrity.checkRequired,
          ],
        },
        {
          key: "graphs",
          cells: [
            detailsCopy.integrity.graphs,
            integritySummary.version_storage_actual_graph_rows.toLocaleString(uiLanguage),
            formatOperationsText(detailsCopy.integrity.baseline, { count: integritySummary.version_storage_expected_graph_rows.toLocaleString(uiLanguage) }),
            integritySummary.version_storage_actual_graph_rows === integritySummary.version_storage_expected_graph_rows ? detailsCopy.integrity.match : detailsCopy.integrity.checkRequired,
          ],
        },
        {
          key: "read-snapshot",
          cells: [
            detailsCopy.integrity.snapshot,
            `${integritySummary.version_read_snapshot_complete_versions.toLocaleString(uiLanguage)} / ${integritySummary.version_read_snapshot_total_versions.toLocaleString(uiLanguage)}`,
            formatOperationsText(detailsCopy.integrity.missing, { count: integritySummary.version_read_snapshot_missing_versions.toLocaleString(uiLanguage) }),
            [
              integritySummary.version_read_snapshot_missing_asset_counts > 0
                ? `count ${integritySummary.version_read_snapshot_missing_asset_counts.toLocaleString(uiLanguage)}`
                : "",
              integritySummary.version_read_snapshot_missing_scenario_validation > 0
                ? formatOperationsText(detailsCopy.integrity.validation, { count: integritySummary.version_read_snapshot_missing_scenario_validation.toLocaleString(uiLanguage) })
                : "",
              integritySummary.version_read_snapshot_missing_nlu_training > 0
                ? formatOperationsText(detailsCopy.integrity.training, { count: integritySummary.version_read_snapshot_missing_nlu_training.toLocaleString(uiLanguage) })
                : "",
              integritySummary.version_read_snapshot_missing_entities > 0
                ? formatOperationsText(detailsCopy.integrity.entities, { count: integritySummary.version_read_snapshot_missing_entities.toLocaleString(uiLanguage) })
                : "",
              integritySummary.version_read_snapshot_missing_dictionary > 0
                ? formatOperationsText(detailsCopy.integrity.dictionary, { count: integritySummary.version_read_snapshot_missing_dictionary.toLocaleString(uiLanguage) })
                : "",
              integritySummary.version_read_snapshot_missing_apis > 0
                ? `API ${integritySummary.version_read_snapshot_missing_apis.toLocaleString(uiLanguage)}`
                : "",
              integritySummary.version_read_snapshot_missing_system_config > 0
                ? formatOperationsText(detailsCopy.integrity.settings, { count: integritySummary.version_read_snapshot_missing_system_config.toLocaleString(uiLanguage) })
                : "",
            ].filter(Boolean).join(" / ") || detailsCopy.integrity.healthy,
          ],
        },
      ]
    : [];
  const versionStorageIssueRows: DataGridRow[] = (versionIntegrity?.version_storage_issues ?? []).map((item) => ({
    key: item.version_id,
    cells: [
      item.status === "missing" ? detailsCopy.integrity.missingStatus : detailsCopy.integrity.mismatchStatus,
      item.bot_name,
      `v${item.version_no} · ${item.version_name}`,
      `${item.actual_dialog_rows.toLocaleString(uiLanguage)} / ${item.expected_dialog_rows.toLocaleString(uiLanguage)}`,
      `${item.actual_graph_rows.toLocaleString(uiLanguage)} / ${item.expected_graph_rows.toLocaleString(uiLanguage)}`,
      [
        item.missing_dialog_ids.length ? formatOperationsText(detailsCopy.integrity.missingDialog, { ids: item.missing_dialog_ids.join(", ") }) : "",
        item.extra_dialog_ids.length ? formatOperationsText(detailsCopy.integrity.extraDialog, { ids: item.extra_dialog_ids.join(", ") }) : "",
        item.missing_graph_ids.length ? formatOperationsText(detailsCopy.integrity.missingGraph, { ids: item.missing_graph_ids.join(", ") }) : "",
        item.extra_graph_ids.length ? formatOperationsText(detailsCopy.integrity.extraGraph, { ids: item.extra_graph_ids.join(", ") }) : "",
      ].filter(Boolean).join(" / ") || "-",
      item.updated_at ? formatDate(item.updated_at, uiLanguage) : "-",
    ],
  }));
  const healthItems = dashboard
    ? [
        {
          key: "api-readiness",
          label: statusCopy.health.apiReadiness,
          value: apiReadiness?.ok ? statusCopy.health.healthy : statusCopy.health.checkRequired,
          detail: apiReadiness
            ? `API ${apiReadiness.app} · DB ${apiReadiness.database}${apiReadiness.elapsed_ms === null ? "" : ` · ${apiReadiness.elapsed_ms.toLocaleString(uiLanguage)}ms`}`
            : statusCopy.health.checking,
          tone: apiReadiness?.ok ? "normal" : "critical",
        },
        {
          key: "cache",
          label: statusCopy.health.cache,
          value: cacheAvailabilityLabel(dashboard.cache.enabled, dashboard.cache.available, statusCopy),
          detail:
            dashboard.cache.read_errors + dashboard.cache.write_errors + dashboard.cache.purge_errors > 0
              ? formatOperationsText(statusCopy.health.errorCount, { count: (
                  dashboard.cache.read_errors
                  + dashboard.cache.write_errors
                  + dashboard.cache.purge_errors
                ).toLocaleString(uiLanguage) })
              : `Hit Rate ${dashboard.cache.hit_rate.toLocaleString(uiLanguage)}%`,
          tone:
            dashboard.cache.enabled && (!dashboard.cache.available || (dashboard.cache.memory_usage_percent ?? 0) >= 80)
              ? "warning"
              : "normal",
        },
        {
          key: "slow-api",
          label: statusCopy.health.responseDelay,
          value: (
            dashboard.summary.slow_api_requests
            + dashboard.summary.slow_db_requests
          ).toLocaleString(uiLanguage),
          detail: `API ${dashboard.summary.slow_api_requests.toLocaleString(uiLanguage)} / ${formatMs(dashboard.summary.slow_api_threshold_ms, uiLanguage)} · DB ${dashboard.summary.slow_db_requests.toLocaleString(uiLanguage)} / ${formatMs(dashboard.summary.slow_db_threshold_ms, uiLanguage)}`,
          tone: dashboard.summary.slow_api_requests + dashboard.summary.slow_db_requests > 0 ? "warning" : "normal",
        },
        {
          key: "errors",
          label: statusCopy.health.errors,
          value: (
            dashboard.summary.system_errors
            + dashboard.summary.queue_failed
            + dashboard.summary.runtime_problem_events
            + dashboard.summary.api_errors
          ).toLocaleString(uiLanguage),
          detail: formatOperationsText(statusCopy.health.systemQueue, {
            system: dashboard.summary.system_errors.toLocaleString(uiLanguage),
            queue: dashboard.summary.queue_failed.toLocaleString(uiLanguage),
          }),
          tone:
            dashboard.summary.system_errors > 0 || dashboard.summary.queue_failed > 0
              ? "critical"
              : dashboard.summary.runtime_problem_events > 0 || dashboard.summary.api_errors > 0
                ? "warning"
                : "normal",
        },
        {
          key: "locks",
          label: statusCopy.health.editLocks,
          value: (
            dashboard.summary.active_edit_locks
            + dashboard.summary.expired_edit_locks
            + dashboard.summary.edit_lock_conflicts
          ).toLocaleString(uiLanguage),
          detail: formatOperationsText(statusCopy.health.lockDetail, {
            active: dashboard.summary.active_edit_locks.toLocaleString(uiLanguage),
            expired: dashboard.summary.expired_edit_locks.toLocaleString(uiLanguage),
            conflicts: dashboard.summary.edit_lock_conflicts.toLocaleString(uiLanguage),
          }),
          tone:
            dashboard.summary.expired_edit_locks > 0 || dashboard.summary.edit_lock_conflicts > 0 || dashboard.summary.active_edit_locks > 0
              ? "warning"
              : "normal",
        },
        {
          key: "version-storage",
          label: statusCopy.health.dbSplit,
          value: integritySummary
            ? (integritySummary.version_storage_mismatch_versions + integritySummary.version_read_snapshot_missing_versions).toLocaleString(uiLanguage)
            : statusCopy.health.checkPending,
          detail: integritySummary
            ? formatOperationsText(statusCopy.health.splitDetail, {
                missing: integritySummary.version_storage_missing_versions.toLocaleString(uiLanguage),
                snapshots: integritySummary.version_read_snapshot_missing_versions.toLocaleString(uiLanguage),
                split: integritySummary.version_storage_split_versions.toLocaleString(uiLanguage),
                total: integritySummary.version_storage_total_versions.toLocaleString(uiLanguage),
              })
            : statusCopy.health.integrityPrompt,
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
            ? executionCount > 0 ? statusCopy.health.executionConfirmed : statusCopy.health.available
            : acceleration.available === false ? statusCopy.health.disabled : statusCopy.health.gpuPending;
          const detail = acceleration.available === true
            ? `${acceleration.device ?? "CUDA"} · ${formatOperationsText(statusCopy.health.gpuExecution, { count: executionCount.toLocaleString(uiLanguage) })}${acceleration.last_execution_at ? ` · ${formatOperationsText(statusCopy.health.recent, { date: formatDate(acceleration.last_execution_at, uiLanguage) })}` : ""}`
            : acceleration.available === false
              ? acceleration.error ?? statusCopy.health.gpuCheck
              : statusCopy.health.gpuNotRun;          return {
            key: `${engine}-gpu`,
            label: engine === "ml" ? statusCopy.health.mlGpu : statusCopy.health.semanticGpu,
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
          label: statusCopy.health.apiReadiness,
          value: apiReadiness.ok ? statusCopy.health.healthy : statusCopy.health.checkRequired,
          detail: `API ${apiReadiness.app} · DB ${apiReadiness.database}${apiReadiness.elapsed_ms === null ? "" : ` · ${apiReadiness.elapsed_ms.toLocaleString(uiLanguage)}ms`}`,
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
      setErrorMessage(error instanceof Error ? error.message : statusCopy.integrityLoadFailed);
    } finally {
      setCheckingVersionIntegrity(false);
    }
  }

  async function handlePurgeVersionCache() {
    if (!token || purgingCache) {
      return;
    }
    const confirmed = window.confirm(actionCopy.cachePurgeConfirm);
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
          ? formatOperationsText(actionCopy.cachePurged, { count: result.purged.toLocaleString(uiLanguage) })
          : formatOperationsText(actionCopy.cacheSkipped, { reason: result.reason || "-" }),
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
      setErrorMessage(error instanceof Error ? error.message : actionCopy.cachePurgeFailed);
    } finally {
      setPurgingCache(false);
    }
  }

  async function handleForceReleaseEditLock(item: AdminOperationsDashboardEditLockItem) {
    if (!token || releasingLockId) {
      return;
    }
    const confirmed = window.confirm(formatOperationsText(actionCopy.forceReleaseConfirm, { owner: editLockOwner(item) }));
    if (!confirmed) {
      return;
    }
    setReleasingLockId(item.id);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const result = await forceReleaseEditLock(token, item.id);
      setStatusMessage(result.released ? actionCopy.lockReleased : actionCopy.lockNotFound);
      const nextDashboard = await fetchOperationsDashboard(token, {
        ...dashboardPeriodFilters(period),
        group_id: groupId || undefined,
        bot_id: botId || undefined,
        channel_code: channelCode || undefined,
        refresh: true,
      });
      setDashboard(nextDashboard);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : actionCopy.lockReleaseFailed);
    } finally {
      setReleasingLockId("");
    }
  }

  async function handleVersionStorageBackfill(dryRun: boolean) {
    if (!token || backfillingVersionStorage) {
      return;
    }
    if (!dryRun) {
      const confirmed = window.confirm(actionCopy.dbBackfillConfirm);
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
          ? formatOperationsText(actionCopy.dbCheckComplete, { selected: result.selected_versions.toLocaleString(uiLanguage) })
          : formatOperationsText(actionCopy.dbBackfillComplete, {
              processed: result.processed_versions.toLocaleString(uiLanguage),
              failed: failedCount.toLocaleString(uiLanguage),
            }),
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
      setErrorMessage(error instanceof Error ? error.message : actionCopy.dbBackfillFailed);
    } finally {
      setBackfillingVersionStorage("");
    }
  }

  async function handleVersionReadSnapshotBackfill(dryRun: boolean) {
    if (!token || backfillingReadSnapshots) {
      return;
    }
    if (!dryRun) {
      const confirmed = window.confirm(actionCopy.snapshotBackfillConfirm);
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
          ? formatOperationsText(actionCopy.snapshotCheckComplete, { selected: result.selected_versions.toLocaleString(uiLanguage) })
          : formatOperationsText(actionCopy.snapshotBackfillComplete, {
              processed: result.processed_versions.toLocaleString(uiLanguage),
              failed: failedCount.toLocaleString(uiLanguage),
            }),
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
      setErrorMessage(error instanceof Error ? error.message : actionCopy.snapshotBackfillFailed);
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
                <span>{statusCopy.summaryLabels[item.key]}</span>
                <strong>{dashboard.summary[item.key].toLocaleString(uiLanguage)}</strong>
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
                  ? `${copy.integrityDescription} · ${copy.checkIntegrity} ${formatDate(versionIntegrity.generated_at, uiLanguage)}`
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
              <span>{copy.generatedAt} {formatDate(dashboard.generated_at, uiLanguage)}</span>
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
          <section className="admin-log-detail" role="dialog" aria-modal="true" aria-label={detailsCopy.dialogs.operationsErrorTitle}>
            <header className="admin-log-detail__header">
              <div>
                <strong>{detailsCopy.dialogs.operationsErrorTitle}</strong>
                <p>{selectedError.bot_name} · {selectedError.event || "-"}</p>
              </div>
              <button type="button" className="admin-log-detail__close" onClick={() => setSelectedError(null)} aria-label={detailsCopy.dialogs.close}>
                x
              </button>
            </header>
            <div className="admin-log-detail__body">
              <section className="admin-log-detail__section">
                <h3>{detailsCopy.dialogs.errorSummary}</h3>
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
                  <h3>{detailsCopy.dialogs.variableChanges}</h3>
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
                  <h3>{detailsCopy.dialogs.linkedHistory}</h3>
                  <div className="admin-log-detail__actions">
                    <Link href={traceHref("/admin/queue-history", selectedErrorQueueId)} className="admin-page__link-button">
                      {detailsCopy.dialogs.queueHistory}
                    </Link>
                    <Link href={traceHref("/admin/conversations", selectedErrorQueueId)} className="admin-page__link-button">
                      {detailsCopy.dialogs.conversationHistory}
                    </Link>
                    <Link href={traceHref("/admin/api-call-history", selectedErrorQueueId)} className="admin-page__link-button">
                      {detailsCopy.dialogs.apiHistory}
                    </Link>
                  </div>
                </section>
              ) : null}
              <section className="admin-log-detail__section">
                <h3>{detailsCopy.dialogs.detailData}</h3>
                <pre>{formatJson(selectedError.data_json ?? {})}</pre>
              </section>
            </div>
          </section>
        </>
      ) : null}
      {selectedRuntimeEvent ? (
        <>
          <div className="admin-log-detail__scrim" onClick={() => setSelectedRuntimeEvent(null)} />
          <section className="admin-log-detail" role="dialog" aria-modal="true" aria-label={detailsCopy.dialogs.runtimeTitle}>
            <header className="admin-log-detail__header">
              <div>
                <strong>{detailsCopy.dialogs.runtimeTitle}</strong>
                <p>{selectedRuntimeEvent.bot_name} · {selectedRuntimeEvent.event || "-"}</p>
              </div>
              <button type="button" className="admin-log-detail__close" onClick={() => setSelectedRuntimeEvent(null)} aria-label={detailsCopy.dialogs.close}>
                x
              </button>
            </header>
            <div className="admin-log-detail__body">
              <section className="admin-log-detail__section">
                <h3>{detailsCopy.dialogs.runtimeSummary}</h3>
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
                  <h3>{detailsCopy.dialogs.variableChanges}</h3>
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
                  <h3>{detailsCopy.dialogs.linkedHistory}</h3>
                  <div className="admin-log-detail__actions">
                    <Link href={traceHref("/admin/queue-history", selectedRuntimeQueueId)} className="admin-page__link-button">
                      {detailsCopy.dialogs.queueHistory}
                    </Link>
                    <Link href={traceHref("/admin/conversations", selectedRuntimeQueueId)} className="admin-page__link-button">
                      {detailsCopy.dialogs.conversationHistory}
                    </Link>
                    <Link href={traceHref("/admin/api-call-history", selectedRuntimeQueueId)} className="admin-page__link-button">
                      {detailsCopy.dialogs.apiHistory}
                    </Link>
                  </div>
                </section>
              ) : null}
              <section className="admin-log-detail__section">
                <h3>{detailsCopy.dialogs.detailData}</h3>
                <pre>{formatJson(selectedRuntimeEvent.data_json ?? {})}</pre>
              </section>
            </div>
          </section>
        </>
      ) : null}
      {selectedSystemError ? (
        <>
          <div className="admin-log-detail__scrim" onClick={() => setSelectedSystemError(null)} />
          <section className="admin-log-detail" role="dialog" aria-modal="true" aria-label={detailsCopy.dialogs.systemErrorTitle}>
            <header className="admin-log-detail__header">
              <div>
                <strong>{detailsCopy.dialogs.systemErrorTitle}</strong>
                <p>{selectedSystemError.logger || "-"} · {selectedSystemError.event || "-"}</p>
              </div>
              <button type="button" className="admin-log-detail__close" onClick={() => setSelectedSystemError(null)} aria-label={detailsCopy.dialogs.close}>
                x
              </button>
            </header>
            <div className="admin-log-detail__body">
              <section className="admin-log-detail__section">
                <h3>{detailsCopy.dialogs.errorSummary}</h3>
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
                  <h3>{detailsCopy.dialogs.logTrace}</h3>
                  <Link
                    href={`/admin/audit-logs?tab=system&file=error&request_id=${encodeURIComponent(selectedSystemError.request_id)}`}
                    className="admin-page__ghost"
                  >
                    {detailsCopy.dialogs.systemLogsByRequest}
                  </Link>
                </section>
              ) : null}
              {selectedSystemErrorVariableTrace?.hasTrace ? (
                <section className="admin-log-detail__section">
                  <h3>{detailsCopy.dialogs.variableChanges}</h3>
                  <pre>
                    {formatJson({
                      updatedVariables: selectedSystemErrorVariableTrace?.updatedVariables ?? [],
                      valuePreviews: selectedSystemErrorVariableTrace?.valuePreviews ?? {},
                    })}
                  </pre>
                </section>
              ) : null}
              <section className="admin-log-detail__section">
                <h3>{detailsCopy.dialogs.detailData}</h3>
                <pre>{formatJson(selectedSystemError.data_json ?? {})}</pre>
              </section>
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
