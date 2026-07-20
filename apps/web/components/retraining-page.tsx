"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { DataGrid, type DataGridRow } from "@/components/data-grid";
import { SortHeaderLabel } from "@/components/sort-header-label";
import { StudioPageLoading } from "@/components/studio-page-loading";
import { useStudioWorkspace } from "@/components/studio-workspace-provider";
import { saveLastBotScreen, type AuthSession } from "@/lib/auth";
import { LIST_PAGE_SIZE_OPTIONS, type ListPageSize, usePersistedPageSize } from "@/lib/use-persisted-page-size";
import { type AdminConversationHistoryItem, fetchConversationHistory } from "@/lib/admin-api";
import { getBotDialogs, getNextDialogNo } from "@/lib/dialog-assets";
import {
  fetchStudioBotVersionRetraining,
  getScenarioTrainingDisabledReason,
  refreshStudioBotSelectedVersion,
  updateStudioBotVersionRetraining,
  type StudioBotApiItem,
  type StudioBotVersionApiItem,
} from "@/lib/studio-bots-api";
import {
  createEmptyVersionDialog,
  normalizeVersionDocument,
  normalizeVersionDialogs,
  type VersionDialogAsset,
  type VersionDialogUtterance,
  type VersionDocument,
} from "@/lib/version-document";

type RetrainingPageClientProps = {
  botId: string;
  versionId: string;
};

type RetrainingStatus = "미학습" | "보류" | "재학습제외" | "재학습완료" | "삭제";

type RetrainingRecord = {
  status: RetrainingStatus;
  targetIntentId?: string;
  targetIntentName?: string;
  utterance?: string;
  updatedAt: string;
};

type RetrainingCandidate = {
  id: string;
  utterance: string;
  channel: string;
  resultType: string;
  method: string;
  status: RetrainingStatus;
  intentName: string;
  occurredAt: string;
  source?: AdminConversationHistoryItem;
};

type SortDirection = "asc" | "desc";
type SortKey = "utterance" | "intentName" | "channel" | "resultType" | "method" | "status" | "occurredAt";

const RESULT_OPTIONS = ["전체", "정상분류", "의도 추출 오류", "유사의도발생"];
const METHOD_OPTIONS = ["전체", "M/L", "Rule", "Small Talk", "Exact Matching", "대화 Queue"];
const STATUS_OPTIONS = ["전체", "미학습", "보류", "재학습제외", "재학습완료"];

function normalizeConversationChannelName(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "시뮬레이터";
  if (normalized.toLowerCase() === "simulator") return "시뮬레이터";
  return normalized;
}

function buildVersionAssetHref(
  botId: string,
  versionId: string,
  section: "intents" | "configure" | "qa" | "entities" | "dictionary" | "evaluation" | "retraining" | "analysis",
) {
  return `/studio/bots/${botId}/versions/${versionId}/${section}`;
}

function todayText() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseRetrainingDateValue(value: string) {
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

function formatKoreanDateTime(value: string, precision: "minute" | "second" = "minute") {
  const date = parseRetrainingDateValue(value);
  if (Number.isNaN(date.getTime())) {
    return value.replace("T", " ").slice(0, precision === "second" ? 19 : 16);
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

function dayText(value: string) {
  return formatKoreanDateTime(value).slice(0, 10);
}

function getEntryPayloadFromRecord(entry: Record<string, unknown>) {
  const payload = entry.payload;
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
}

function getEntryDetailFromRecord(entry: Record<string, unknown>) {
  const payload = getEntryPayloadFromRecord(entry);
  const detail = payload.detail;
  return detail && typeof detail === "object" && !Array.isArray(detail)
    ? detail as Record<string, unknown>
    : {};
}

function getEntryLogFromRecord(entry: Record<string, unknown>) {
  const detail = getEntryDetailFromRecord(entry);
  const log = detail.log;
  return log && typeof log === "object" && !Array.isArray(log)
    ? log as Record<string, unknown>
    : {};
}

function getEntryPayload(item: AdminConversationHistoryItem) {
  const entry = item.data_json?.entry;
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return {};
  return getEntryPayloadFromRecord(entry as Record<string, unknown>);
}

function getEntryDetail(item: AdminConversationHistoryItem) {
  return getEntryDetailFromRecord(item.data_json?.entry as Record<string, unknown> ?? {});
}

function getEntryLog(item: AdminConversationHistoryItem) {
  return getEntryLogFromRecord(item.data_json?.entry as Record<string, unknown> ?? {});
}

function getSessionUserUtterances(item: AdminConversationHistoryItem) {
  const values = item.data_json?.session_user_utterances;
  return Array.isArray(values)
    ? values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
}

function normalizeDisplayText(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim();
}

function isInternalUtterance(value: unknown) {
  const normalized = normalizeDisplayText(value);
  if (!normalized || normalized === "-") return true;
  if (["END", "START", "__END__", "[END]"].includes(normalized.toUpperCase())) return true;
  if (/webchatRichFormVersion|buttonValue|"response"\s*:/i.test(normalized)) return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized);
}

function isCardNodeName(value: unknown) {
  const normalized = normalizeDisplayText(value);
  return /^(talk|rich\s*form)\s*\d*$/i.test(normalized);
}

function firstTextValue(values: unknown[]) {
  return values
    .map((value) => normalizeDisplayText(value))
    .find((value) => value && value !== "-" && !isCardNodeName(value) && !isInternalUtterance(value)) ?? "";
}

function getUserUtterance(item: AdminConversationHistoryItem) {
  const detail = getEntryDetail(item);
  const log = getEntryLog(item);
  const message = item.data_json?.message;
  const messageMap = message && typeof message === "object" && !Array.isArray(message)
    ? message as Record<string, unknown>
    : {};
  const variables = detail.variables && typeof detail.variables === "object" && !Array.isArray(detail.variables)
    ? detail.variables as Record<string, unknown>
    : {};
  const entryUtterance = firstTextValue([
    messageMap.text,
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
  if (entryUtterance) {
    return entryUtterance;
  }
  if (item.id.includes(":entry:")) {
    return "-";
  }
  const sessionUtterance = firstTextValue([
    item.data_json?.session_first_user_utterance,
    ...getSessionUserUtterances(item),
  ]);
  return sessionUtterance || "-";
}

function classifyMethod(item: AdminConversationHistoryItem) {
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
  if (/small/i.test(raw)) return "Small Talk";
  if (/rule|button/i.test(raw)) return "Rule";
  if (/exact/i.test(raw)) return "Exact Matching";
  if (item.intent_or_module_name === "-" || item.intent_or_module_name.includes("미분류")) return "미응답";
  return "M/L";
}

function resultTypeOf(item: AdminConversationHistoryItem) {
  const runtimeEvent = getIntentRuntimeEventName(item);
  const result = item.result;
  const intent = item.intent_or_module_name;
  if (runtimeEvent === "channel.runtime.intent_fallback") return "의도 추출 오류";
  if (runtimeEvent === "channel.runtime.intent_matched") return "정상분류";
  if (result.includes("유사")) return "유사의도발생";
  if (result.includes("미응답") || result.includes("미분류") || intent.includes("미분류") || intent === "-") return "의도 추출 오류";
  return "정상분류";
}

function getIntentRuntimeEventName(item: AdminConversationHistoryItem) {
  const detail = getEntryDetail(item);
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
  if (!event || typeof event !== "object" || Array.isArray(event)) return "";
  return String((event as Record<string, unknown>).event ?? "");
}

function isRetrainingCandidate(item: AdminConversationHistoryItem) {
  const resultType = resultTypeOf(item);
  return resultType === "의도 추출 오류" || resultType === "유사의도발생";
}

function getSessionEntries(item: AdminConversationHistoryItem) {
  const values = item.data_json?.entries;
  return Array.isArray(values)
    ? values.filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value))
    : [];
}

function isRetrainingEntryEvent(entry: Record<string, unknown>) {
  const payload = getEntryPayloadFromRecord(entry);
  const eventName = String(entry.eventName || entry.event || payload.event || "").trim();
  if (eventName === "simulator.user_utterance") return true;
  if (eventName !== "simulator.user_message") return false;
  const detail = getEntryDetailFromRecord(entry);
  return Boolean(detail.resultType || detail.result_type);
}

function buildEntryConversationItem(base: AdminConversationHistoryItem, entry: Record<string, unknown>, index: number): AdminConversationHistoryItem {
  const payload = getEntryPayloadFromRecord(entry);
  const detail = getEntryDetailFromRecord(entry);
  const log = getEntryLogFromRecord(entry);
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

function buildSessionUtteranceConversationItem(
  base: AdminConversationHistoryItem,
  utterance: string,
  index: number,
): AdminConversationHistoryItem {
  const messages = Array.isArray(base.data_json?.messages)
    ? base.data_json.messages.filter((message): message is Record<string, unknown> => (
        !!message && typeof message === "object" && !Array.isArray(message)
      ))
    : [];
  const matchedMessage = messages.find((message) => (
    String(message.participant_kind ?? "").toLowerCase() === "user" &&
    firstTextValue([message.display_text, message.text]) === utterance
  ));
  const occurredAt = String(matchedMessage?.created_at ?? base.uttered_at);

  return {
    ...base,
    id: `${base.id}:session:${index}`,
    uttered_at: occurredAt,
    data_json: {
      ...base.data_json,
      session_candidate_utterance: utterance,
    },
  };
}
function getRetrainingRecords(document: VersionDocument): Record<string, RetrainingRecord> {
  const records = document.system_config?.retraining_records;
  return records && typeof records === "object" && !Array.isArray(records)
    ? records as Record<string, RetrainingRecord>
    : {};
}

function normalizeTextKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildUtterance(text: string): VersionDialogUtterance {
  return {
    id: crypto.randomUUID(),
    text,
    utteranceType: "T",
  };
}

function tokenOverlapScore(utterance: string, dialog: VersionDialogAsset) {
  const tokens = new Set(utterance.split(/\s+/).map(normalizeTextKey).filter(Boolean));
  if (tokens.size === 0) return 0;
  const target = [
    dialog.name,
    dialog.displayName,
    ...dialog.tags,
    ...dialog.utterances.map((item) => item.text),
  ].join(" ");
  return Array.from(tokens).filter((token) => normalizeTextKey(target).includes(token)).length;
}

function dedupeRetrainingCandidates(candidates: RetrainingCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((item) => {
    const key = [
      normalizeTextKey(item.utterance),
      item.intentName,
      item.resultType,
      item.method,
      formatKoreanDateTime(item.occurredAt),
    ].join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildCandidates(
  rows: AdminConversationHistoryItem[],
  bot: StudioBotApiItem | null,
  effectiveBotId: string,
  effectiveVersion: StudioBotVersionApiItem | null,
  versionName: string,
  records: Record<string, RetrainingRecord>,
): RetrainingCandidate[] {
  const rowCandidates = rows
    .flatMap((item) => {
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
        rowVersionId === versionName;
      if (records[item.id]?.status === "삭제" || !(botMatched && versionMatched)) {
        return [];
      }
      const sessionEntries = getSessionEntries(item);
      const retrainingEntries = sessionEntries.filter(isRetrainingEntryEvent);
      const entryCandidates = retrainingEntries
        .map((entry, index) => buildEntryConversationItem(item, entry, index))
        .filter((entryItem) => {
          if (records[entryItem.id]?.status === "삭제") {
            return false;
          }
          return isRetrainingCandidate(entryItem);
        })
        .map((entryItem) => {
          const record = records[entryItem.id];
          return {
            id: entryItem.id,
            utterance: record?.utterance || getUserUtterance(entryItem),
            channel: normalizeConversationChannelName(entryItem.channel_name),
            resultType: resultTypeOf(entryItem),
            method: classifyMethod(entryItem),
            status: record?.status ?? "미학습",
            intentName: record?.targetIntentName || entryItem.intent_or_module_name || "-",
            occurredAt: entryItem.uttered_at,
            source: entryItem,
          };
        })
        .filter((entryItem) => entryItem.utterance !== "-");
      const entryUtteranceKeys = new Set(entryCandidates.map((entryItem) => normalizeTextKey(entryItem.utterance)));
      const sessionCandidates = retrainingEntries.length > 0
        ? []
        : getSessionUserUtterances(item)
        .filter((utterance) => !isInternalUtterance(utterance))
        .filter((utterance) => !entryUtteranceKeys.has(normalizeTextKey(utterance)))
        .map((utterance, index) => buildSessionUtteranceConversationItem(item, utterance, index))
        .filter((sessionItem) => {
          if (records[sessionItem.id]?.status === "삭제") {
            return false;
          }
          return isRetrainingCandidate(sessionItem);
        })
        .map((sessionItem) => {
          const record = records[sessionItem.id];
          return {
            id: sessionItem.id,
            utterance: record?.utterance || String(sessionItem.data_json?.session_candidate_utterance ?? getUserUtterance(sessionItem)),
            channel: normalizeConversationChannelName(sessionItem.channel_name),
            resultType: resultTypeOf(sessionItem),
            method: classifyMethod(sessionItem),
            status: record?.status ?? "미학습",
            intentName: record?.targetIntentName || sessionItem.intent_or_module_name || "-",
            occurredAt: sessionItem.uttered_at,
            source: sessionItem,
          };
        })
        .filter((sessionItem) => sessionItem.utterance !== "-");
      if (entryCandidates.length > 0 || sessionCandidates.length > 0) {
        return [...entryCandidates, ...sessionCandidates];
      }
      if (!isRetrainingCandidate(item)) {
        return [];
      }
      const record = records[item.id];
      return [{
        id: item.id,
        utterance: record?.utterance || getUserUtterance(item),
        channel: normalizeConversationChannelName(item.channel_name),
        resultType: resultTypeOf(item),
        method: classifyMethod(item),
        status: record?.status ?? "미학습",
        intentName: record?.targetIntentName || item.intent_or_module_name || "-",
        occurredAt: item.uttered_at,
        source: item,
      }];
    })
    .filter((item) => item.utterance !== "-");
  return dedupeRetrainingCandidates(rowCandidates);
}

export function RetrainingPageClient({ botId: routeBotId, versionId }: RetrainingPageClientProps) {
  const workspace = useStudioWorkspace();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const botId = useMemo(() => decodeURIComponent(routeBotId), [routeBotId]);
  const versionName = useMemo(() => decodeURIComponent(versionId), [versionId]);
  const dateFromParam = searchParams.get("date");
  const hubCandidateId = searchParams.get("hubCandidateId");
  const hubCandidateUtterance = searchParams.get("hubCandidateUtterance");
  const hubCandidateChannel = searchParams.get("hubCandidateChannel");
  const hubCandidateOccurredAt = searchParams.get("hubCandidateOccurredAt");
  const hubCandidateResultType = searchParams.get("hubCandidateResultType");
  const sectionFetchKeyRef = useRef<string | null>(null);
  const hubCandidateSelectionRef = useRef(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(workspace.session);
  const [bot, setBot] = useState<StudioBotApiItem | null>(workspace.bot);
  const [versions, setVersions] = useState<StudioBotVersionApiItem[]>(workspace.versions);
  const [conversationRows, setConversationRows] = useState<AdminConversationHistoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState("전체");
  const [resultType, setResultType] = useState("전체");
  const [method, setMethod] = useState("전체");
  const [status, setStatus] = useState("전체");
  const [fromDate, setFromDate] = useState(dateFromParam || todayText());
  const [toDate, setToDate] = useState(dateFromParam || todayText());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetIntentId, setTargetIntentId] = useState("");
  const [intentMode, setIntentMode] = useState<"recommended" | "all">("recommended");
  const [retrainingAction, setRetrainingAction] = useState<"add-utterance" | "create-intent">("add-utterance");
  const [newIntentName, setNewIntentName] = useState("");
  const [editedUtterance, setEditedUtterance] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageSize, setPageSize] = usePersistedPageSize<ListPageSize>(
    "aidot.page_size.retraining.list",
    25,
    LIST_PAGE_SIZE_OPTIONS,
  );
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("occurredAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    setAuthSession(workspace.session);
    setBot(workspace.bot);
    setVersions(workspace.versions);
    let ignore = false;
    setLoading(conversationRows.length === 0);
    setErrorMessage("");
    fetchConversationHistory(workspace.session.access_token, { fromDate, toDate, pageSize: 500 })
      .then((conversations) => {
        if (ignore) return;
        setConversationRows(conversations.items);
      })
      .catch((error) => {
        if (!ignore) setErrorMessage(error instanceof Error ? error.message : "재학습 정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [fromDate, toDate, workspace.bot, workspace.session, workspace.versions]);

  useEffect(() => {
    if (!authSession || !bot?.id || !bot.active_version?.id) {
      return;
    }

    const version = bot.active_version;
    const loadedDocument = version.version_json;
    const hasSectionDocument = Boolean(
      loadedDocument &&
      Array.isArray(loadedDocument.dialogs) &&
      loadedDocument.system_config,
    );
    const fetchKey = `${bot.id}:${version.id}`;
    if (sectionFetchKeyRef.current === fetchKey && hasSectionDocument) {
      return;
    }

    sectionFetchKeyRef.current = fetchKey;
    let ignore = false;
    setLoading(true);
    setErrorMessage("");

    fetchStudioBotVersionRetraining(authSession.access_token, bot.id, version.id)
      .then((response) => {
        if (ignore) {
          return;
        }

        const currentDocument = normalizeVersionDocument(bot.active_version?.version_json);
        const nextVersion = {
          ...response.version,
          version_json: {
            ...currentDocument,
            dialogs: normalizeVersionDialogs(response.dialogs),
            system_config: response.system_config,
          },
        };
        setBot((current) => (
          current && current.id === bot.id
            ? {
                ...current,
                active_version: nextVersion,
                active_version_id: nextVersion.id,
                updated_at: nextVersion.updated_at ?? current.updated_at,
              }
            : current
        ));
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : "재학습 버전 정보를 불러오지 못했습니다.");
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
  }, [authSession, bot]);

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
      );
      setVersions(refreshed.versions);
      setBot(refreshed.bot);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "학습 결과를 다시 불러오지 못했습니다.");
    }
  }
  const versionDocument = useMemo(() => normalizeVersionDocument(effectiveVersion?.version_json), [effectiveVersion?.version_json]);
  const dialogs = useMemo(() => getBotDialogs(bot).filter((dialog) => dialog.dialogType === 1), [bot]);
  const records = useMemo(() => getRetrainingRecords(versionDocument), [versionDocument]);
  const hubCandidate = useMemo<RetrainingCandidate | null>(() => {
    const utterance = String(hubCandidateUtterance ?? "").trim();
    if (!utterance) {
      return null;
    }
    return {
      id: "hub:" + (hubCandidateId || (normalizeTextKey(utterance) + ":" + (hubCandidateOccurredAt || ""))),
      utterance,
      channel: normalizeConversationChannelName(hubCandidateChannel),
      resultType: hubCandidateResultType || "의도 추출 오류",
      method: "대화 Queue",
      status: "미학습",
      intentName: "-",
      occurredAt: hubCandidateOccurredAt || new Date().toISOString(),
    };
  }, [hubCandidateChannel, hubCandidateId, hubCandidateOccurredAt, hubCandidateResultType, hubCandidateUtterance]);
  const candidates = useMemo(
    () => dedupeRetrainingCandidates([
      ...(hubCandidate ? [hubCandidate] : []),
      ...buildCandidates(conversationRows, bot, effectiveBotId, effectiveVersion, effectiveVersionName, records),
    ]),
    [bot, conversationRows, effectiveBotId, effectiveVersion, effectiveVersionName, hubCandidate, records],
  );
  useEffect(() => {
    if (!hubCandidate || hubCandidateSelectionRef.current || !candidates.some((item) => item.id === hubCandidate.id)) {
      return;
    }
    hubCandidateSelectionRef.current = true;
    setSelectedIds((current) => current.includes(hubCandidate.id) ? current : [hubCandidate.id, ...current]);
    setMessage("봇 허브에서 선택한 재학습 후보를 자동 선택했습니다.");
  }, [candidates, hubCandidate]);
  const channels = useMemo(() => ["전체", ...Array.from(new Set(candidates.map((item) => item.channel)))], [candidates]);
  const filteredCandidates = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    const filtered = candidates.filter((item) => {
      if (channel !== "전체" && item.channel !== channel) return false;
      if (resultType !== "전체" && item.resultType !== resultType) return false;
      if (method !== "전체" && item.method !== method) return false;
      if (status !== "전체" && item.status !== status) return false;
      if (fromDate && dayText(item.occurredAt) < fromDate) return false;
      if (toDate && dayText(item.occurredAt) > toDate) return false;
      if (!lowered) return true;
      return [
        item.utterance,
        item.intentName,
        item.channel,
        item.resultType,
        item.method,
        item.status,
      ].some((value) => value.toLowerCase().includes(lowered));
    });
    return [...filtered].sort((left, right) => {
      const leftValue = left[sortKey];
      const rightValue = right[sortKey];
      const compared = String(leftValue).localeCompare(String(rightValue), "ko", { numeric: true });
      return sortDirection === "asc" ? compared : -compared;
    });
  }, [candidates, channel, fromDate, method, query, resultType, sortDirection, sortKey, status, toDate]);
  const selectedCandidates = useMemo(
    () => filteredCandidates.filter((item) => selectedIds.includes(item.id)),
    [filteredCandidates, selectedIds],
  );
  const selectedPrimary = selectedCandidates[0] ?? null;
  const recommendedDialogs = useMemo(() => {
    if (!selectedPrimary) return dialogs.slice(0, 3);
    const current = dialogs.find((dialog) => dialog.name === selectedPrimary.intentName || dialog.displayName === selectedPrimary.intentName);
    const scored = dialogs
      .filter((dialog) => dialog.id !== current?.id)
      .map((dialog) => ({ dialog, score: tokenOverlapScore(selectedPrimary.utterance, dialog) }))
      .sort((left, right) => right.score - left.score || left.dialog.name.localeCompare(right.dialog.name))
      .slice(0, 3)
      .map((item) => item.dialog);
    return current ? [current, ...scored].slice(0, 3) : scored;
  }, [dialogs, selectedPrimary]);
  const intentOptions = intentMode === "all" ? dialogs : recommendedDialogs;
  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => filteredCandidates.some((item) => item.id === id)));
  }, [filteredCandidates]);

  const unhandledTodayCandidateCount = useMemo(() => {
    const today = todayText();
    return candidates.filter((item) => item.status === "미학습" && dayText(item.occurredAt) === today).length;
  }, [candidates]);

  useEffect(() => {
    workspace.setSummaryCardValue("재학습", String(unhandledTodayCandidateCount));
  }, [unhandledTodayCandidateCount, workspace]);

  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / pageSize));
  const pagedCandidates = filteredCandidates.slice((page - 1) * pageSize, page * pageSize);
  const pageCandidateIds = pagedCandidates.map((item) => item.id);
  const isCurrentPageFullySelected = pageCandidateIds.length > 0 && pageCandidateIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    setPage(1);
  }, [query, channel, resultType, method, status, fromDate, toDate, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (!selectedPrimary) return;
    setEditedUtterance(selectedPrimary.utterance);
    setNewIntentName(selectedPrimary.utterance.length > 30 ? selectedPrimary.utterance.slice(0, 30) : selectedPrimary.utterance);
    const preferred = recommendedDialogs[0] ?? dialogs[0];
    setTargetIntentId(preferred?.id ?? "");
  }, [dialogs, recommendedDialogs, selectedPrimary]);

  function toggleSelected(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleSelectCurrentPage(checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...pageCandidateIds]));
      }
      return current.filter((id) => !pageCandidateIds.includes(id));
    });
  }

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "occurredAt" ? "desc" : "asc");
  }

  function resetFilters() {
    setQuery("");
    setChannel("전체");
    setResultType("전체");
    setMethod("전체");
    setStatus("전체");
    const today = todayText();
    setFromDate(today);
    setToDate(today);
  }

  async function refreshConversationHistory() {
    if (!authSession) return;
    setLoading(true);
    setErrorMessage("");
    setMessage("");
    try {
      const conversations = await fetchConversationHistory(authSession.access_token, { fromDate, toDate, pageSize: 500 });
      setConversationRows(conversations.items);
      setMessage("대화이력을 동기화했습니다.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "대화이력 동기화에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function updateRecordStatus(nextStatus: RetrainingStatus) {
    if (!effectiveVersion || !authSession || selectedIds.length === 0) return;
    const nextRecords = { ...records };
    selectedCandidates.forEach((item) => {
      nextRecords[item.id] = {
        ...(nextRecords[item.id] ?? {}),
        status: nextStatus,
        utterance: item.utterance,
        updatedAt: new Date().toISOString(),
      };
    });
    const actionLabel = nextStatus === "재학습제외" ? "재학습 제외" : nextStatus;
    void saveVersionDocument({
      ...versionDocument,
      system_config: {
        ...versionDocument.system_config,
        retraining_records: nextRecords,
      },
    }, `선택한 ${selectedCandidates.length}건을 ${actionLabel} 처리했습니다.`);
  }

  async function saveVersionDocument(nextDocument: VersionDocument, successMessage: string) {
    if (!authSession || !bot || !effectiveVersion) return;
    setSaving(true);
    setErrorMessage("");
    setMessage("");
    try {
      const response = await updateStudioBotVersionRetraining(authSession.access_token, bot.id, effectiveVersion.id, {
        dialogs: nextDocument.dialogs,
        system_config: nextDocument.system_config,
      });
      const updatedVersion = {
        ...response.version,
        version_json: {
          ...nextDocument,
          dialogs: normalizeVersionDialogs(response.dialogs),
          system_config: response.system_config,
        },
      };
      setBot((current) => current ? { ...current, active_version: updatedVersion } : current);
      setMessage(successMessage);
      setSelectedIds([]);
      setDialogOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "재학습 처리에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function handleOpenRetraining(nextAction: "add-utterance" | "create-intent") {
    if (selectedCandidates.length === 0) {
      setErrorMessage("재학습할 문장을 선택하세요.");
      return;
    }
    const blocked = selectedCandidates.find((item) => ["Rule", "Small Talk"].includes(item.method));
    if (blocked) {
      setErrorMessage("Rule, Small Talk 방식으로 분류된 문장은 재학습할 수 없습니다.");
      return;
    }
    setRetrainingAction(nextAction);
    setErrorMessage("");
    setDialogOpen(true);
  }

  function handleConfirmRetraining() {
    if (retrainingAction === "add-utterance" && !targetIntentId) {
      setErrorMessage("재학습할 의도를 선택하세요.");
      return;
    }
    const existingTargetDialog = retrainingAction === "add-utterance"
      ? dialogs.find((dialog) => dialog.id === targetIntentId)
      : null;
    if (retrainingAction === "add-utterance" && !existingTargetDialog) {
      setErrorMessage("선택한 의도를 찾을 수 없습니다.");
      return;
    }
    const targetIntentName = retrainingAction === "create-intent" ? newIntentName.trim() : existingTargetDialog?.name ?? "";
    if (!targetIntentName) {
      setErrorMessage("새 의도명을 입력하세요.");
      return;
    }
    const utteranceText = editedUtterance.trim();
    if (!utteranceText) {
      setErrorMessage("의도 시작 표현을 입력하세요.");
      return;
    }

    const utteranceOwners = new Map<string, string>();
    versionDocument.dialogs
      .filter((dialog) => dialog.dialogType === 1)
      .forEach((dialog) => {
        dialog.utterances.forEach((utterance) => {
          utteranceOwners.set(normalizeTextKey(utterance.text), dialog.id);
        });
    });
    const textKey = normalizeTextKey(utteranceText);
    const ownerId = utteranceOwners.get(textKey);
    if (ownerId && ownerId !== existingTargetDialog?.id) {
      const owner = dialogs.find((dialog) => dialog.id === ownerId);
      setErrorMessage(`이미 '${owner?.name ?? "다른 의도"}'에서 사용 중인 의도 시작 표현입니다.`);
      return;
    }

    const now = new Date().toISOString().slice(0, 16).replace("T", " ");
    let targetDialog = existingTargetDialog;
    let nextDialogs = versionDocument.dialogs;
    if (retrainingAction === "create-intent") {
      const newDialog: VersionDialogAsset = {
        ...createEmptyVersionDialog(1),
        dialogNo: getNextDialogNo(versionDocument.dialogs.filter((dialog) => dialog.dialogType === 0)),
        name: targetIntentName,
        displayName: targetIntentName,
        dialogKey: crypto.randomUUID(),
        cardCount: 0,
        utterances: [buildUtterance(utteranceText)],
        updatedAt: now,
        updatedBy: authSession?.user.login_id ?? "",
      };
      targetDialog = newDialog;
      nextDialogs = [...versionDocument.dialogs, newDialog];
    } else {
      nextDialogs = versionDocument.dialogs.map((dialog) => {
        if (dialog.id !== existingTargetDialog?.id) return dialog;
        if (dialog.utterances.some((utterance) => normalizeTextKey(utterance.text) === textKey)) return dialog;
        return {
          ...dialog,
          utterances: [buildUtterance(utteranceText), ...dialog.utterances],
          updatedAt: now,
        };
      });
    }
    const nextRecords = { ...records };
    selectedCandidates.forEach((item) => {
      nextRecords[item.id] = {
        status: "재학습완료",
        targetIntentId: targetDialog?.id,
        targetIntentName: targetDialog?.name,
        utterance: utteranceText,
        updatedAt: new Date().toISOString(),
      };
    });
    void saveVersionDocument({
      ...versionDocument,
      dialogs: nextDialogs,
      system_config: {
        ...versionDocument.system_config,
        retraining_records: nextRecords,
      },
    }, retrainingAction === "create-intent"
      ? `선택한 ${selectedCandidates.length}건으로 새 의도를 생성하고 학습문장을 등록했습니다. 대화에 반영하려면 학습하기를 실행하세요.`
      : `선택한 ${selectedCandidates.length}건을 의도 시작 표현으로 등록했습니다. 대화에 반영하려면 학습하기를 실행하세요.`);
  }

  const rows: DataGridRow[] = pagedCandidates.map((item) => ({
    key: item.id,
    cells: [
      <input key={`${item.id}-check`} type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} aria-label={`${item.utterance} 선택`} />,
      item.utterance,
      item.intentName,
      item.channel,
      item.resultType,
      item.method,
      item.status,
      formatKoreanDateTime(item.occurredAt),
    ],
  }));

  if (!bot || !effectiveVersion) {
    return <StudioPageLoading title="재학습 화면을 불러오는 중입니다." />;
  }

  return (
    <section className="retraining-page">

      {errorMessage ? <p className="retraining-page__error">{errorMessage}</p> : null}
      {message ? <p className="retraining-page__notice">{message}</p> : null}

      <section className="retraining-filter">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="의도명/지식명 또는 사용자 발화를 검색하세요." />
        <select value={channel} onChange={(event) => setChannel(event.target.value)} aria-label="채널">
          {channels.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={resultType} onChange={(event) => setResultType(event.target.value)} aria-label="실행결과">
          {RESULT_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={method} onChange={(event) => setMethod(event.target.value)} aria-label="분류방식">
          {METHOD_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="학습상태">
          {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="발생기간 시작" />
        <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="발생기간 종료" />
        <button type="button" onClick={resetFilters}>초기화</button>
        <button type="button" className="retraining-filter__primary">확인</button>
      </section>

      <section className="retraining-actions">
        <strong>전체 {filteredCandidates.length}건</strong>
            <label className="manual-main__mini-select manual-main__mini-select--select">
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as ListPageSize)}>
                {LIST_PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}개씩 보기
                  </option>
                ))}
              </select>
            </label>
        <button type="button" onClick={refreshConversationHistory} disabled={loading || saving}>대화이력 동기화</button>
        <button type="button" className="retraining-actions__primary" onClick={() => handleOpenRetraining("add-utterance")} disabled={selectedIds.length === 0 || saving}>재학습</button>
        <button type="button" onClick={() => handleOpenRetraining("create-intent")} disabled={selectedIds.length === 0 || saving}>의도 생성</button>
        <button type="button" onClick={() => updateRecordStatus("보류")} disabled={selectedIds.length === 0 || saving}>보류</button>
        <button type="button" onClick={() => updateRecordStatus("재학습제외")} disabled={selectedIds.length === 0 || saving}>재학습 제외</button>
        <button type="button" onClick={() => updateRecordStatus("삭제")} disabled={selectedIds.length === 0 || saving}>삭제</button>
        <span>{selectedIds.length}개 선택</span>
      </section>

      <DataGrid
        variant="studio"
        className="retraining-page__grid"
        template="44px minmax(220px, 1.4fr) 180px 110px 130px 120px 120px 150px"
        columns={[
          <input
            key="select-all"
            type="checkbox"
            aria-label="현재 페이지 전체 선택"
            checked={isCurrentPageFullySelected}
            onChange={(event) => toggleSelectCurrentPage(event.target.checked)}
          />,
          <button key="utterance" type="button" className="settings-sort-button" onClick={() => toggleSort("utterance")}>
            <SortHeaderLabel label="사용자 발화" direction={sortKey === "utterance" ? sortDirection : "none"} />
          </button>,
          <button key="intentName" type="button" className="settings-sort-button" onClick={() => toggleSort("intentName")}>
            <SortHeaderLabel label="의도명/지식명" direction={sortKey === "intentName" ? sortDirection : "none"} />
          </button>,
          <button key="channel" type="button" className="settings-sort-button" onClick={() => toggleSort("channel")}>
            <SortHeaderLabel label="채널" direction={sortKey === "channel" ? sortDirection : "none"} />
          </button>,
          <button key="resultType" type="button" className="settings-sort-button" onClick={() => toggleSort("resultType")}>
            <SortHeaderLabel label="실행결과" direction={sortKey === "resultType" ? sortDirection : "none"} />
          </button>,
          <button key="method" type="button" className="settings-sort-button" onClick={() => toggleSort("method")}>
            <SortHeaderLabel label="분류방식" direction={sortKey === "method" ? sortDirection : "none"} />
          </button>,
          <button key="status" type="button" className="settings-sort-button" onClick={() => toggleSort("status")}>
            <SortHeaderLabel label="학습상태" direction={sortKey === "status" ? sortDirection : "none"} />
          </button>,
          <button key="occurredAt" type="button" className="settings-sort-button" onClick={() => toggleSort("occurredAt")}>
            <SortHeaderLabel label="발생시간" direction={sortKey === "occurredAt" ? sortDirection : "none"} />
          </button>,
        ]}
        rows={rows}
      />

      <div className="admin-page__pagination">
        <button type="button" disabled={page === 1} onClick={() => setPage(1)}>
          «
        </button>
        <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
          ‹
        </button>
        {Array.from({ length: totalPages }, (_, index) => index + 1)
          .slice(Math.max(0, page - 3), Math.max(0, page - 3) + 5)
          .map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              className={pageNumber === page ? "is-active" : undefined}
              onClick={() => setPage(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
        <button type="button" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
          ›
        </button>
        <button type="button" disabled={page === totalPages} onClick={() => setPage(totalPages)}>
          »
        </button>
      </div>

      {dialogOpen ? (
        <div className="retraining-modal" role="dialog" aria-modal="true" aria-label="재학습">
          <div className="retraining-modal__box">
            <div className="retraining-modal__head">
              <h2>{retrainingAction === "create-intent" ? "의도 생성" : "재학습"}</h2>
              <button type="button" onClick={() => setDialogOpen(false)} aria-label="닫기">×</button>
            </div>
            <div className="retraining-modal__body">
              <section>
                <h3>재학습 할 대화 목록</h3>
                <div className="retraining-modal__selected">
                  {selectedCandidates.map((item) => (
                    <span key={item.id}>{item.utterance}</span>
                  ))}
                </div>
              </section>
              <section>
                <h3>사용자 발화 수정</h3>
                <input value={editedUtterance} onChange={(event) => setEditedUtterance(event.target.value)} />
              </section>
              {retrainingAction === "add-utterance" ? (
                <section>
                  <div className="retraining-modal__mode">
                    <h3>재학습 의도 목록</h3>
                    <button type="button" className={intentMode === "recommended" ? "is-active" : ""} onClick={() => setIntentMode("recommended")}>추천의도</button>
                    <button type="button" className={intentMode === "all" ? "is-active" : ""} onClick={() => setIntentMode("all")}>전체의도</button>
                  </div>
                  <select value={targetIntentId} onChange={(event) => setTargetIntentId(event.target.value)}>
                    {intentOptions.map((dialog) => (
                      <option key={dialog.id} value={dialog.id}>{dialog.name}</option>
                    ))}
                  </select>
                </section>
              ) : (
                <section>
                  <h3>새 의도명</h3>
                  <input value={newIntentName} onChange={(event) => setNewIntentName(event.target.value)} placeholder="예) 계약 해지 요청" />
                </section>
              )}
            </div>
            <div className="retraining-modal__foot">
              <button type="button" onClick={() => setDialogOpen(false)}>취소</button>
              <button type="button" className="retraining-modal__primary" onClick={handleConfirmRetraining} disabled={saving}>확인</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
