"use client";

import { formatStudioRuntimeMessage, getStudioRuntimeMessage } from "@/lib/i18n/studio-runtime-native";

import { useEffect, useMemo, useState } from "react";

import { DataGrid, type DataGridRow, type DataGridSortState } from "@/components/data-grid";
import {
  type BotStationChannelConfig,
  type BotStationSettingsConfig,
  getBotSettingsVersionName,
  getBotVersionSettings,
} from "@/lib/bot-settings";
import { loadAuthSession, type AuthSession } from "@/lib/auth";
import {
  fetchChannelHealth,
  fetchChannels,
  fetchGroups,
  fetchSystemLogs,
  type AdminSystemLogItem,
  type AdminChannelItem,
  type AdminGroupListItem,
  type ChannelHealthDetail,
} from "@/lib/admin-api";
import {
  fetchStudioBots,
  isStudioBotVersionTrained,
  type StudioBotApiItem,
  updateStudioBot,
} from "@/lib/studio-bots-api";
import {
  LIST_PAGE_SIZE_OPTIONS,
  type ListPageSize,
  usePersistedPageSize,
} from "@/lib/use-persisted-page-size";
import { useI18n } from "@/components/language-provider";
import { ADMIN_COMMON_CATALOGS } from "@/lib/i18n/admin-common";
import { ADMIN_BOTSTATION_STATUS_CATALOGS, getAdminBotstationStatusLabel } from "@/lib/i18n/admin-botstation-status";
import type { SupportedLanguage } from "@/lib/language";

type BotStationStatus = "전체" | "Active" | "Inactive";

type BotStationFilters = {
  botName: string;
  updatedBy: string;
  groupId: string;
  channelCode: string;
  status: BotStationStatus;
  startDate: string;
  endDate: string;
};

type BotStationRow = {
  bot: StudioBotApiItem;
  versionName: string;
  groupId: string;
  groupName: string;
  botName: string;
  status: Exclude<BotStationStatus, "전체">;
  operatingVersion: string;
  operatingStatus: string;
  channelSummary: string;
  channelCodes: string[];
  activeMessengerCount: number;
  issueMessage: string;
  updatedAt: string;
  updatedBy: string;
  settings: BotStationSettingsConfig;
};

type BotStationDialog =
  | { type: "status"; row: BotStationRow; enabled: boolean }
  | { type: "messenger"; row: BotStationRow; settings: BotStationSettingsConfig; selectedChannelId: string };

type KakaoLogSummary = {
  statusLabel: string;
  statusTone: "ok" | "warn";
  respondedCount: number;
  rejectedCount: number;
  failedCount: number;
  lastSuccessAt: string;
  lastFailureAt: string;
  lastFailureMessage: string;
  lastRejectedStatusCode: string;
  lastFallbackReasons: string[];
};

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDefaultFilters(): BotStationFilters {
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 1);

  return {
    botName: "",
    updatedBy: "",
    groupId: "",
    channelCode: "",
    status: "전체",
    startDate: toDateInputValue(start),
    endDate: toDateInputValue(end),
  };
}

function formatDateTime(value: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function isKakaoFailureEvent(eventName: string) {
  return eventName === "kakao.webhook.failed" || eventName === "kakao.webhook.rejected";
}

function normalizeFallbackReasons(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function buildKakaoLogSummary(logs: AdminSystemLogItem[], language: SupportedLanguage): KakaoLogSummary {
  const respondedLogs = logs.filter((item) => String(item.event || "").trim() === "kakao.webhook.responded");
  const rejectedLogs = logs.filter((item) => String(item.event || "").trim() === "kakao.webhook.rejected");
  const failedLogs = logs.filter((item) => String(item.event || "").trim() === "kakao.webhook.failed");
  const latestFailure = logs.find((item) => isKakaoFailureEvent(String(item.event || "").trim()));
  const latestResponded = respondedLogs[0];
  const latestRejected = rejectedLogs[0];
  const latestFallback = logs.find((item) => {
    const data = item.data as Record<string, unknown>;
    return data?.fallback_used === true;
  });
  const fallbackReasons = latestFallback ? normalizeFallbackReasons((latestFallback.data as Record<string, unknown>)?.fallback_reasons) : [];

  return {
    statusLabel: getStudioRuntimeMessage(language, latestFailure ? "최근 실패 있음" : latestResponded ? "최근 응답 정상" : "최근 이력 확인 필요"),
    statusTone: latestFailure ? "warn" : "ok",
    respondedCount: respondedLogs.length,
    rejectedCount: rejectedLogs.length,
    failedCount: failedLogs.length,
    lastSuccessAt: latestResponded?.time || "",
    lastFailureAt: latestFailure?.time || "",
    lastFailureMessage: latestFailure?.message || "",
    lastRejectedStatusCode: latestRejected?.status_code ? String(latestRejected.status_code) : "-",
    lastFallbackReasons: fallbackReasons,
  };
}

function getTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getLastUpdatedAt(bot: StudioBotApiItem, settings: BotStationSettingsConfig) {
  const candidates = [
    bot.updated_at,
    bot.active_version?.activated_at ?? "",
    bot.active_version?.updated_at ?? "",
    settings.connectedAt,
    ...settings.channels.map((channel) => channel.updatedAt),
  ].filter(Boolean);

  return candidates.reduce((latest, current) => (getTime(current) > getTime(latest) ? current : latest), "");
}

function getUpdatedBy(bot: StudioBotApiItem) {
  const candidate = bot as StudioBotApiItem & {
    updated_by?: string | null;
    updatedBy?: string | null;
    modified_by?: string | null;
    modifier_name?: string | null;
  };
  return candidate.updated_by ?? candidate.updatedBy ?? candidate.modified_by ?? candidate.modifier_name ?? "-";
}

function normalizeChannel(channel: Partial<BotStationChannelConfig>): BotStationChannelConfig {
  const channelId = channel.channelId ?? channel.id ?? "";
  const channelName = channel.channelName ?? channel.name ?? "";

  return {
    ...channel,
    id: channel.id ?? channelId,
    channelId,
    channelCode: channel.channelCode ?? channel.id ?? "",
    channelName,
    botIdentifier: channel.botIdentifier ?? "",
    botName: channel.botName ?? "",
    name: channel.name ?? channelName,
    enabled: Boolean(channel.enabled),
    appId: channel.appId ?? "",
    appSecret: channel.appSecret ?? "",
    callbackUrl: channel.callbackUrl ?? "",
    description: channel.description ?? "",
    updatedAt: channel.updatedAt ?? "",
  };
}

function cloneSettings(settings: BotStationSettingsConfig): BotStationSettingsConfig {
  return {
    ...settings,
    channels: settings.channels.map(normalizeChannel),
  };
}

function buildChannelConfig(
  adminChannel: AdminChannelItem,
  current?: Partial<BotStationChannelConfig>,
  bot?: StudioBotApiItem,
): BotStationChannelConfig {
  return normalizeChannel({
    ...current,
    id: adminChannel.id,
    channelId: adminChannel.id,
    channelCode: adminChannel.code,
    channelName: adminChannel.name,
    botIdentifier: current?.botIdentifier ?? bot?.id ?? "",
    botName: current?.botName ?? bot?.name ?? "",
    name: adminChannel.name,
  });
}

function buildSettingsForAdminChannels(
  bot: StudioBotApiItem,
  settings: BotStationSettingsConfig,
  adminChannels: AdminChannelItem[],
): BotStationSettingsConfig {
  const savedChannels = new Map(
    settings.channels.map((channel) => {
      const normalized = normalizeChannel(channel);
      return [normalized.channelId || normalized.id || normalized.channelCode, normalized];
    }),
  );

  const activeAdminChannels = adminChannels.filter((channel) => channel.status === "active");
  const channels = activeAdminChannels.map((adminChannel) => {
    const saved = savedChannels.get(adminChannel.id) ?? savedChannels.get(adminChannel.code);
    return buildChannelConfig(adminChannel, saved, bot);
  });

  return {
    ...settings,
    channels,
  };
}

function getVersionStatusLabel(bot: StudioBotApiItem, language: SupportedLanguage) {
  if (!bot.active_version) {
    return getStudioRuntimeMessage(language, "운영버전 없음");
  }
  if (!isStudioBotVersionTrained(bot.active_version)) {
    return getStudioRuntimeMessage(language, "학습 필요");
  }
  return bot.active_version.status === "active" ? getStudioRuntimeMessage(language, "운영") : bot.active_version.status;
}

function buildRows(bots: StudioBotApiItem[], adminChannels: AdminChannelItem[], language: SupportedLanguage): BotStationRow[] {
  return bots.map((bot) => {
    const versionName = getBotSettingsVersionName(bot);
    const settings = buildSettingsForAdminChannels(bot, cloneSettings(getBotVersionSettings(bot).botstation), adminChannels);
    const activeChannels = settings.channels.filter((channel) => channel.enabled);
    const activeMessengerCount = activeChannels.length;
    const hasActiveVersion = Boolean(bot.active_version);
    const status = hasActiveVersion && settings.connected && settings.enabled && activeMessengerCount > 0 ? "Active" : "Inactive";
    const issueMessage = getStudioRuntimeMessage(language, !hasActiveVersion
      ? "운영버전 없음"
      : !settings.enabled
        ? "봇스테이션 미사용"
        : activeMessengerCount === 0
          ? "활성 채널 없음"
          : "정상");

    return {
      bot,
      versionName,
      groupId: bot.group_id,
      groupName: bot.group_name ?? bot.group_code ?? "-",
      botName: bot.name,
      status,
      operatingVersion: bot.active_version ? `${bot.active_version.name} / ${getVersionStatusLabel(bot, language)}` : "-",
      operatingStatus: getVersionStatusLabel(bot, language),
      channelSummary: activeChannels.map((channel) => channel.channelName || channel.name).join(", ") || "-",
      channelCodes: activeChannels.map((channel) => channel.channelCode || channel.id),
      activeMessengerCount,
      issueMessage,
      updatedAt: getLastUpdatedAt(bot, settings),
      updatedBy: getUpdatedBy(bot),
      settings,
    };
  });
}

function isInPeriod(updatedAt: string, filters: BotStationFilters) {
  const valueTime = getTime(updatedAt);
  if (!valueTime) {
    return true;
  }

  const startTime = filters.startDate ? new Date(`${filters.startDate}T00:00:00`).getTime() : 0;
  const endTime = filters.endDate ? new Date(`${filters.endDate}T23:59:59`).getTime() : 0;

  if (startTime && valueTime < startTime) {
    return false;
  }
  if (endTime && valueTime > endTime) {
    return false;
  }
  return true;
}

function buildCsv(rows: BotStationRow[]) {
  const header = ["상태", "그룹", "채널", "봇 이름", "운영버전", "활성 채널", "메시지", "최종수정일시", "최종수정자"];
  const body = rows.map((row) => [
    row.status,
    row.groupName,
    row.channelSummary,
    row.botName,
    row.operatingVersion,
    String(row.activeMessengerCount),
    row.issueMessage,
    formatDateTime(row.updatedAt),
    row.updatedBy,
  ]);

  return [header, ...body]
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

function downloadCsv(rows: BotStationRow[]) {
  const blob = new Blob([`\ufeff${buildCsv(rows)}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "봇스테이션 연계 현황.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
function getSortValue(row: BotStationRow, columnIndex: number) {
  const values = [
    row.status,
    row.groupName,
    row.channelSummary,
    row.botName,
    row.operatingVersion,
    String(row.activeMessengerCount),
    row.issueMessage,
    formatDateTime(row.updatedAt),
    row.updatedBy,
  ];
  return values[columnIndex] ?? "";
}

function sortRows(rows: BotStationRow[], sortState: DataGridSortState | null) {
  if (!sortState) {
    return rows;
  }
  return [...rows].sort((left, right) => {
    const leftText = getSortValue(left, sortState.columnIndex);
    const rightText = getSortValue(right, sortState.columnIndex);
    const result = leftText.localeCompare(rightText, "ko-KR", { numeric: true, sensitivity: "base" });
    return sortState.direction === "asc" ? result : -result;
  });
}

export function AdminBotstationStatusPage() {
  const { language } = useI18n();
  const uiLanguage = language;
  const copy = ADMIN_COMMON_CATALOGS[language];
  const stationCopy = ADMIN_BOTSTATION_STATUS_CATALOGS[uiLanguage];
  const [session, setSession] = useState<AuthSession | null>(null);
  const [bots, setBots] = useState<StudioBotApiItem[]>([]);
  const [adminChannels, setAdminChannels] = useState<AdminChannelItem[]>([]);
  const [channelHealthDetails, setChannelHealthDetails] = useState<ChannelHealthDetail[]>([]);
  const [channelLogItems, setChannelLogItems] = useState<AdminSystemLogItem[]>([]);
  const [groups, setGroups] = useState<AdminGroupListItem[]>([]);
  const [draftFilters, setDraftFilters] = useState<BotStationFilters>(() => buildDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<BotStationFilters>(() => buildDefaultFilters());
  const [dialog, setDialog] = useState<BotStationDialog | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pageSize, setPageSize] = usePersistedPageSize<ListPageSize>(
    "aidot.page_size.admin.botstation_status",
    10,
    LIST_PAGE_SIZE_OPTIONS,
  );
  const [page, setPage] = useState(1);
  const [sortState, setSortState] = useState<DataGridSortState | null>(null);

  useEffect(() => {
    const currentSession = loadAuthSession();
    setSession(currentSession);

    if (!currentSession) {
      setLoading(false);
      setErrorMessage(getAdminBotstationStatusLabel(stationCopy, "로그인 정보가 없습니다."));
      return;
    }

    let ignore = false;
    setLoading(true);
    Promise.all([
      fetchStudioBots(currentSession.access_token),
      fetchChannels(currentSession.access_token),
      fetchGroups(currentSession.access_token),
      fetchChannelHealth(currentSession.access_token),
      fetchSystemLogs(currentSession.access_token, { file: "app", query: "kakao.webhook", limit: 50 }),
    ])
      .then(([items, channelResponse, groupResponse, channelHealthResponse, systemLogResponse]) => {
        if (!ignore) {
          setBots(items);
          setAdminChannels(channelResponse.items);
          setGroups(groupResponse.items);
          setChannelHealthDetails(channelHealthResponse.details ?? []);
          setChannelLogItems(systemLogResponse.items ?? []);
          setErrorMessage("");
        }
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : getAdminBotstationStatusLabel(stationCopy, "봇스테이션 연계 현황을 불러오지 못했습니다."));
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
  }, []);

  const allRows = useMemo(() => buildRows(bots, adminChannels, uiLanguage), [adminChannels, bots, uiLanguage]);
  const filteredRows = useMemo(() => {
    const botName = appliedFilters.botName.trim().toLowerCase();
    const updatedBy = appliedFilters.updatedBy.trim().toLowerCase();

    return allRows.filter((row) => {
      if (botName && !row.botName.toLowerCase().includes(botName)) {
        return false;
      }
      if (updatedBy && !row.updatedBy.toLowerCase().includes(updatedBy)) {
        return false;
      }
      if (appliedFilters.groupId && row.groupId !== appliedFilters.groupId) {
        return false;
      }
      if (appliedFilters.channelCode && !row.channelCodes.includes(appliedFilters.channelCode)) {
        return false;
      }
      if (appliedFilters.status !== "전체" && row.status !== appliedFilters.status) {
        return false;
      }
      return isInPeriod(row.updatedAt, appliedFilters);
    });
  }, [allRows, appliedFilters]);
  const sortedRows = useMemo(() => sortRows(filteredRows, sortState), [filteredRows, sortState]);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pagedRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [appliedFilters, pageSize, sortState]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const gridRows: DataGridRow[] = pagedRows.map((row) => ({
    key: row.bot.id,
    cells: [
      <button
        key="status"
        type="button"
        className={`admin-botstation__link admin-botstation__status-link ${
          row.status === "Active" ? "is-active" : ""
        }`}
        onClick={() => setDialog({ type: "status", row, enabled: row.settings.enabled })}
      >
        {row.status}
      </button>,
      row.groupName,
      row.channelSummary,
      row.botName,
      row.operatingVersion,
      <button
        key="messenger"
        type="button"
        className="admin-botstation__link"
        onClick={() =>
          setDialog({
            type: "messenger",
            row,
            settings: cloneSettings(row.settings),
            selectedChannelId: row.settings.channels[0]?.id ?? "",
          })
        }
      >
        {row.activeMessengerCount}
      </button>,
      row.issueMessage,
      formatDateTime(row.updatedAt),
      row.updatedBy,
    ],
  }));

  function handleReset() {
    const nextFilters = buildDefaultFilters();
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }

  async function saveBotStation(row: BotStationRow, settings: BotStationSettingsConfig, successMessage: string) {
    if (!session) {
      setErrorMessage(getAdminBotstationStatusLabel(stationCopy, "로그인 정보가 없습니다."));
      return;
    }

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const updatedBot = await updateStudioBot(
        session.access_token,
        row.bot.id,
        {
          settings_scope: row.bot.active_version?.id ?? row.versionName,
          settings_json: {
            botstation: settings,
          },
        },
        { responseMode: "summary" },
      );
      setBots((current) => current.map((bot) => (bot.id === updatedBot.id ? updatedBot : bot)));
      setDialog(null);
      setMessage(successMessage);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : getAdminBotstationStatusLabel(stationCopy, "봇스테이션 설정 저장 중 오류가 발생했습니다."));
    } finally {
      setSaving(false);
    }
  }

  function handleSaveStatus() {
    if (!dialog || dialog.type !== "status") {
      return;
    }

    if (dialog.enabled && !dialog.row.bot.active_version) {
      setErrorMessage(getAdminBotstationStatusLabel(stationCopy, "운영버전이 지정된 봇만 봇스테이션을 사용할 수 있습니다."));
      return;
    }

    const now = new Date().toISOString();
    const nextSettings: BotStationSettingsConfig = {
      ...dialog.row.settings,
      connected: dialog.row.settings.connected || dialog.enabled,
      enabled: dialog.enabled,
      connectedAt: dialog.row.settings.connectedAt || (dialog.enabled ? now : ""),
    };

    void saveBotStation(dialog.row, nextSettings, getAdminBotstationStatusLabel(stationCopy, "봇스테이션 상세정보가 저장되었습니다."));
  }

  function handleChangeMessengerChannel(channelId: string, patch: Partial<BotStationChannelConfig>) {
    setDialog((current) => {
      if (!current || current.type !== "messenger") {
        return current;
      }

      return {
        ...current,
        settings: {
          ...current.settings,
          channels: current.settings.channels.map((channel) =>
            channel.id === channelId ? { ...channel, ...patch } : channel,
          ),
        },
      };
    });
  }

  function handleSaveMessenger() {
    if (!dialog || dialog.type !== "messenger") {
      return;
    }

    if (!dialog.row.bot.active_version) {
      setErrorMessage(getAdminBotstationStatusLabel(stationCopy, "운영버전이 지정된 봇만 채널 연결을 저장할 수 있습니다."));
      return;
    }

    const now = new Date().toISOString();
    const nextSettings: BotStationSettingsConfig = {
      ...dialog.settings,
      connected: true,
      connectedAt: dialog.settings.connectedAt || now,
      channels: dialog.settings.channels.map((channel) =>
        channel.id === dialog.selectedChannelId ? { ...channel, updatedAt: now } : channel,
      ),
    };

    void saveBotStation(dialog.row, nextSettings, getAdminBotstationStatusLabel(stationCopy, "메신저 연결 상세정보가 저장되었습니다."));
  }

  const selectedChannel =
    dialog?.type === "messenger"
      ? dialog.settings.channels.find((channel) => channel.id === dialog.selectedChannelId) ?? null
      : null;
  const selectedHealthDetail =
    selectedChannel
      ? channelHealthDetails.find(
          (item) => item.channel === String(selectedChannel.channelCode || "").trim().toLowerCase(),
        ) ?? null
      : null;
  const selectedChannelAllLogs =
    selectedChannel && String(selectedChannel.channelCode || "").trim().toUpperCase() === "KAKAO"
      ? channelLogItems.filter((item) => String(item.event || "").startsWith("kakao.webhook."))
      : [];
  const selectedChannelLogs = selectedChannelAllLogs.slice(0, 5);
  const selectedKakaoLogSummary = selectedChannelAllLogs.length ? buildKakaoLogSummary(selectedChannelAllLogs, uiLanguage) : null;

  return (
    <section className="admin-page admin-botstation">
      <h2>{getAdminBotstationStatusLabel(stationCopy,"봇스테이션 연계 현황")}</h2>

      <div className="admin-botstation__filters" aria-label={getAdminBotstationStatusLabel(stationCopy,"검색 조건")}>
        <label>
          <span>{getAdminBotstationStatusLabel(stationCopy,"봇 이름")}</span>
          <input
            value={draftFilters.botName}
            onChange={(event) => setDraftFilters((current) => ({ ...current, botName: event.target.value }))}
          />
        </label>
        <label>
          <span>{getAdminBotstationStatusLabel(stationCopy,"최종 수정자")}</span>
          <input
            value={draftFilters.updatedBy}
            onChange={(event) => setDraftFilters((current) => ({ ...current, updatedBy: event.target.value }))}
          />
        </label>
        <label>
          <span>{copy.group}</span>
          <select
            value={draftFilters.groupId}
            onChange={(event) => setDraftFilters((current) => ({ ...current, groupId: event.target.value }))}
          >
            <option value="">{getAdminBotstationStatusLabel(stationCopy,"전체")}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{copy.channel}</span>
          <select
            value={draftFilters.channelCode}
            onChange={(event) => setDraftFilters((current) => ({ ...current, channelCode: event.target.value }))}
          >
            <option value="">{getAdminBotstationStatusLabel(stationCopy,"전체")}</option>
            {adminChannels.map((channel) => (
              <option key={channel.id} value={channel.code}>
                {channel.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{getAdminBotstationStatusLabel(stationCopy,"상태")}</span>
          <select
            value={draftFilters.status}
            onChange={(event) =>
              setDraftFilters((current) => ({ ...current, status: event.target.value as BotStationStatus }))
            }
          >
            <option value="전체">{getAdminBotstationStatusLabel(stationCopy,"전체")}</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </label>
        <label>
          <span>{copy.fromDate}</span>
          <input
            type="date"
            value={draftFilters.startDate}
            onChange={(event) => setDraftFilters((current) => ({ ...current, startDate: event.target.value }))}
          />
        </label>
        <label>
          <span>{copy.toDate}</span>
          <input
            type="date"
            value={draftFilters.endDate}
            onChange={(event) => setDraftFilters((current) => ({ ...current, endDate: event.target.value }))}
          />
        </label>
        <div className="admin-botstation__filter-actions">
          <button type="button" className="admin-page__ghost" onClick={handleReset}>
            {copy.reset}
          </button>
          <button type="button" className="admin-page__primary" onClick={() => setAppliedFilters(draftFilters)}>
            {copy.confirm}
          </button>
          <div className="admin-common-variables__more">
            <button
              type="button"
              className="admin-common-variables__more-button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-label={getAdminBotstationStatusLabel(stationCopy,"봇스테이션 더보기")}
            >
              ⋮
            </button>
            {menuOpen ? (
              <div className="admin-common-variables__menu">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    downloadCsv(sortedRows);
                  }}
                >
                  {copy.download}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="admin-page__toolbar">
        <div className="admin-page__toolbar-left">
          <strong>
            {loading
              ? getStudioRuntimeMessage(uiLanguage, "조회 중")
              : `${getAdminBotstationStatusLabel(stationCopy, "전체")} ${formatStudioRuntimeMessage(uiLanguage, "{count}건", { count: filteredRows.length })}`}
          </strong>
          <label className="manual-main__mini-select manual-main__mini-select--select">
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as ListPageSize)}>
              {LIST_PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}개씩 보기
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {message ? <p className="admin-botstation__message">{message}</p> : null}
      {errorMessage ? <p className="admin-botstation__error">{errorMessage}</p> : null}

      <div className="admin-page__grid-scroll">
        <DataGrid
          variant="admin"
          className="admin-botstation__grid"
          template="96px 140px minmax(150px, 1fr) minmax(160px, 1fr) 150px 96px minmax(140px, 1fr) 160px 120px"
          columns={["상태", "그룹", "채널", "봇 이름", "운영버전", "활성 채널", "메시지", "최종수정일시", "최종수정자"].map((label) => getAdminBotstationStatusLabel(stationCopy, label))}
          rows={gridRows}
          sortState={sortState}
          onSort={setSortState}
        />
      </div>
      {!loading && filteredRows.length === 0 ? <p className="admin-page__empty">{copy.noData}</p> : null}

      <div className="admin-page__pagination">
        <button type="button" disabled={page === 1} onClick={() => setPage(1)}>
          «
        </button>
        <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
          ‹
        </button>
        <button type="button" className="is-active">
          {page}
        </button>
        <button type="button" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
          ›
        </button>
        <button type="button" disabled={page === totalPages} onClick={() => setPage(totalPages)}>
          »
        </button>
      </div>

      {dialog?.type === "status" ? (
        <div className="entity-editor-backdrop" role="presentation">
          <div className="admin-botstation-dialog admin-botstation-dialog--status" role="dialog" aria-modal="true">
            <div className="entity-editor-dialog__header">
              <strong>{getAdminBotstationStatusLabel(stationCopy,"봇스테이션 상세정보")}</strong>
              <button
                type="button"
                className="entity-editor-dialog__close"
                aria-label={getAdminBotstationStatusLabel(stationCopy,"닫기")}
                onClick={() => setDialog(null)}
              >
                ×
              </button>
            </div>
            <div className="admin-botstation-dialog__body">
              <dl className="admin-botstation-dialog__summary">
                <div>
                  <dt>{getAdminBotstationStatusLabel(stationCopy,"봇 이름")}</dt>
                  <dd>{dialog.row.botName}</dd>
                </div>
                <div>
                  <dt>{getAdminBotstationStatusLabel(stationCopy,"그룹")}</dt>
                  <dd>{dialog.row.groupName}</dd>
                </div>
                <div>
                  <dt>{getAdminBotstationStatusLabel(stationCopy,"운영버전")}</dt>
                  <dd>{dialog.row.operatingVersion}</dd>
                </div>
                <div>
                  <dt>{getAdminBotstationStatusLabel(stationCopy,"메시지")}</dt>
                  <dd>{dialog.row.issueMessage}</dd>
                </div>
                <div>
                  <dt>{getAdminBotstationStatusLabel(stationCopy,"최종수정일시")}</dt>
                  <dd>{formatDateTime(dialog.row.updatedAt)}</dd>
                </div>
              </dl>
              <label className="admin-botstation-dialog__switch">
                <input
                  type="checkbox"
                  checked={dialog.enabled}
                  disabled={!dialog.row.bot.active_version}
                  onChange={(event) => setDialog({ ...dialog, enabled: event.target.checked })}
                />
                <span>{dialog.enabled ? "Active" : "Inactive"}</span>
              </label>
            </div>
            <div className="entity-editor-dialog__footer">
              <button type="button" className="secondary-action" disabled={saving} onClick={() => setDialog(null)}>{getAdminBotstationStatusLabel(stationCopy,"취소")}</button>
              <button type="button" className="primary-action" disabled={saving} onClick={handleSaveStatus}>{getAdminBotstationStatusLabel(stationCopy,"확인")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {dialog?.type === "messenger" && selectedChannel ? (
        <div className="entity-editor-backdrop" role="presentation">
          <div className="admin-botstation-dialog admin-botstation-dialog--messenger" role="dialog" aria-modal="true">
            <div className="entity-editor-dialog__header">
              <strong>{getAdminBotstationStatusLabel(stationCopy,"메신저 연결 상세정보")}</strong>
              <button
                type="button"
                className="entity-editor-dialog__close"
                aria-label={getAdminBotstationStatusLabel(stationCopy,"닫기")}
                onClick={() => setDialog(null)}
              >
                ×
              </button>
            </div>
            <div className="admin-botstation-dialog__body">
              <div className="admin-botstation-dialog__tabs" role="tablist" aria-label={getAdminBotstationStatusLabel(stationCopy,"메신저")}>
                {dialog.settings.channels.map((channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    className={channel.id === dialog.selectedChannelId ? "is-active" : ""}
                    onClick={() => setDialog({ ...dialog, selectedChannelId: channel.id })}
                  >
                    {channel.name}
                  </button>
                ))}
              </div>

              <div className="admin-botstation-dialog__form">
                {selectedHealthDetail ? (
                  <div className="admin-botstation-dialog__health admin-botstation-dialog__field--wide">
                    <strong>{getAdminBotstationStatusLabel(stationCopy,"운영 점검 정보")}</strong>
                    <dl className="admin-botstation-dialog__health-list">
                      <div>
                        <dt>Provider</dt>
                        <dd>{selectedHealthDetail.provider || "-"}</dd>
                      </div>
                      <div>
                        <dt>Renderer</dt>
                        <dd>{selectedHealthDetail.renderer || "-"}</dd>
                      </div>
                      <div>
                        <dt>Webhook</dt>
                        <dd>{selectedHealthDetail.webhook_endpoint || "-"}</dd>
                      </div>
                      <div>
                        <dt>{getAdminBotstationStatusLabel(stationCopy,"인증 헤더")}</dt>
                        <dd>{selectedHealthDetail.auth_header || "-"}</dd>
                      </div>
                      <div>
                        <dt>{getAdminBotstationStatusLabel(stationCopy,"지원 출력")}</dt>
                        <dd>{selectedHealthDetail.supported_outputs?.join(", ") || "-"}</dd>
                      </div>
                      <div>
                        <dt>{getAdminBotstationStatusLabel(stationCopy,"로그 이벤트")}</dt>
                        <dd>{selectedHealthDetail.logging_events?.join(", ") || "-"}</dd>
                      </div>
                    </dl>
                  </div>
                ) : null}
                {selectedKakaoLogSummary ? (
                  <div className="admin-botstation-dialog__health admin-botstation-dialog__field--wide">
                    <strong>{getAdminBotstationStatusLabel(stationCopy,"최근 상태 요약")}</strong>
                    <dl className="admin-botstation-dialog__health-list">
                      <div>
                        <dt>{getAdminBotstationStatusLabel(stationCopy,"현재 상태")}</dt>
                        <dd>
                          <span className={`admin-botstation-dialog__status-pill admin-botstation-dialog__status-pill--${selectedKakaoLogSummary.statusTone}`}>
                            {selectedKakaoLogSummary.statusLabel}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt>{getAdminBotstationStatusLabel(stationCopy,"최근 응답/거부/실패")}</dt>
                        <dd>
                          {selectedKakaoLogSummary.respondedCount} / {selectedKakaoLogSummary.rejectedCount} / {selectedKakaoLogSummary.failedCount}
                        </dd>
                      </div>
                      <div>
                        <dt>{getAdminBotstationStatusLabel(stationCopy,"마지막 성공")}</dt>
                        <dd>{formatDateTime(selectedKakaoLogSummary.lastSuccessAt)}</dd>
                      </div>
                      <div>
                        <dt>{getAdminBotstationStatusLabel(stationCopy,"마지막 실패")}</dt>
                        <dd>{formatDateTime(selectedKakaoLogSummary.lastFailureAt)}</dd>
                      </div>
                      <div>
                        <dt>{getAdminBotstationStatusLabel(stationCopy,"최근 실패 사유")}</dt>
                        <dd>{selectedKakaoLogSummary.lastFailureMessage || "-"}</dd>
                      </div>
                      <div>
                        <dt>{getAdminBotstationStatusLabel(stationCopy,"최근 거부 상태코드")}</dt>
                        <dd>{selectedKakaoLogSummary.lastRejectedStatusCode}</dd>
                      </div>
                      <div>
                        <dt>{getAdminBotstationStatusLabel(stationCopy,"최근 fallback 이유")}</dt>
                        <dd>{selectedKakaoLogSummary.lastFallbackReasons.join(", ") || "-"}</dd>
                      </div>
                    </dl>
                  </div>
                ) : null}
                {selectedChannelLogs.length ? (
                  <div className="admin-botstation-dialog__health admin-botstation-dialog__field--wide">
                    <strong>{getAdminBotstationStatusLabel(stationCopy,"최근 카카오 로그")}</strong>
                    <ul className="admin-botstation-dialog__log-list">
                      {selectedChannelLogs.map((item) => (
                        <li key={item.id}>
                          <span>{formatDateTime(item.time || "")}</span>
                          <strong>{item.event || item.level}</strong>
                          <p>{item.message}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {String(selectedChannel.channelCode || "").trim().toUpperCase() === "KAKAO" ? (
                  <div className="admin-botstation-dialog__health admin-botstation-dialog__field--wide">
                    <strong>{getAdminBotstationStatusLabel(stationCopy,"Kakao 입력/테스트 안내")}</strong>
                    <ul className="admin-form-guide__list">
                      <li>
                        <code>App ID</code>: {getAdminBotstationStatusLabel(stationCopy, "카카오 앱 또는 스킬 식별값")}
                      </li>
                      <li>
                        <code>App Secret</code>: {getAdminBotstationStatusLabel(stationCopy, "webhook 보호용 비밀값 또는 토큰 값")}
                      </li>
                      <li>
                        <code>Callback URL</code>: {getAdminBotstationStatusLabel(stationCopy, "카카오 관리자센터에 등록할 실제 webhook 주소")}
                      </li>
                      <li>
                        {getAdminBotstationStatusLabel(stationCopy, "1차 연결 테스트는 안녕 같은 단순 발화로 webhook 응답, 대화 이력 저장, 최근 카카오 로그 적재까지 함께 확인합니다.")}
                      </li>
                    </ul>
                  </div>
                ) : null}
                <label className="admin-botstation-dialog__switch admin-botstation-dialog__switch--inline">
                  <input
                    type="checkbox"
                    checked={selectedChannel.enabled}
                    onChange={(event) =>
                      handleChangeMessengerChannel(selectedChannel.id, { enabled: event.target.checked })
                    }
                  />
                  <span>{getAdminBotstationStatusLabel(stationCopy,"사용")}</span>
                </label>
                <label>
                  <span>{getAdminBotstationStatusLabel(stationCopy,"메신저")}</span>
                  <input
                    value={selectedChannel.name}
                    onChange={(event) => handleChangeMessengerChannel(selectedChannel.id, { name: event.target.value })}
                  />
                </label>
                <label>
                  <span className="admin-inline-label">
                    App ID
                    <span
                      className="admin-inline-help"
                      data-help={getAdminBotstationStatusLabel(stationCopy, "카카오 앱 또는 스킬 식별값입니다. 운영자가 어떤 카카오 자원과 연결되는지 구분할 때 사용합니다.")}
                      tabIndex={0}
                      role="img"
                      aria-label={getAdminBotstationStatusLabel(stationCopy,"App ID 설명")}
                    >
                      i
                    </span>
                  </span>
                  <input
                    value={selectedChannel.appId}
                    onChange={(event) =>
                      handleChangeMessengerChannel(selectedChannel.id, { appId: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span className="admin-inline-label">
                    App Secret
                    <span
                      className="admin-inline-help"
                      data-help={getAdminBotstationStatusLabel(stationCopy, "카카오 webhook 보호용 비밀값입니다. token 인증을 쓸 때는 채널 인증 정보와 같은 값으로 맞춰 관리하는 것을 권장합니다.")}
                      tabIndex={0}
                      role="img"
                      aria-label={getAdminBotstationStatusLabel(stationCopy,"App Secret 설명")}
                    >
                      i
                    </span>
                  </span>
                  <input
                    value={selectedChannel.appSecret}
                    onChange={(event) =>
                      handleChangeMessengerChannel(selectedChannel.id, { appSecret: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span className="admin-inline-label">
                    Callback URL
                    <span
                      className="admin-inline-help"
                      data-help={getAdminBotstationStatusLabel(stationCopy, "카카오 관리자센터에 등록할 실제 webhook 주소입니다. 외부에서 호출 가능한 운영 도메인 주소여야 합니다.")}
                      tabIndex={0}
                      role="img"
                      aria-label={getAdminBotstationStatusLabel(stationCopy,"Callback URL 설명")}
                    >
                      i
                    </span>
                  </span>
                  <input
                    value={selectedChannel.callbackUrl}
                    onChange={(event) =>
                      handleChangeMessengerChannel(selectedChannel.id, { callbackUrl: event.target.value })
                    }
                  />
                </label>
                <label className="admin-botstation-dialog__field--wide">
                  <span>{getAdminBotstationStatusLabel(stationCopy,"설명")}</span>
                  <textarea
                    value={selectedChannel.description}
                    onChange={(event) =>
                      handleChangeMessengerChannel(selectedChannel.id, { description: event.target.value })
                    }
                  />
                </label>
              </div>
            </div>
            <div className="entity-editor-dialog__footer">
              <button type="button" className="secondary-action" disabled={saving} onClick={() => setDialog(null)}>{getAdminBotstationStatusLabel(stationCopy,"취소")}</button>
              <button type="button" className="primary-action" disabled={saving} onClick={handleSaveMessenger}>{getAdminBotstationStatusLabel(stationCopy,"확인")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
