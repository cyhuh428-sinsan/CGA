"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { AssetUploadDialog } from "@/components/asset-upload-dialog";
import { IntentEditorDialog } from "@/components/intent-editor-dialog";
import { SimulatorFloatingLauncher } from "@/components/simulator-page";
import { StudioPageLoading } from "@/components/studio-page-loading";
import { useStudioWorkspace } from "@/components/studio-workspace-provider";
import { type SummaryStatItem } from "@/components/summary-stat-grid";
import { SortHeaderLabel } from "@/components/sort-header-label";
import {
  UploadResultDialog,
  type UploadResultSection,
} from "@/components/upload-result-dialog";
import {
  saveLastBotScreen,
  updateAuthSessionUser,
  type AuthSession,
} from "@/lib/auth";
import { updateAuthPreferences } from "@/lib/auth-api";
import {
  applyUpdatedVersionToBot,
  buildDialogTargetHref,
  buildDialogSearchText,
  findDialogUsageReferences,
  getDialogTypeLabel,
  getNextDialogNo,
  getVersionDialogs,
  withEnsuredDialogFlowGraph,
  withUpdatedDialogs,
} from "@/lib/dialog-assets";
import { getVersionUserDictionary } from "@/lib/dictionary-assets";
import { getVersionUserEntities } from "@/lib/entity-assets";
import {
  fetchStudioBotVersionDialogs,
  fetchStudioBotVersionReferences,
  getCachedStudioBotVersionDialogs,
  refreshStudioBotSelectedVersion,
  type StudioBotApiItem,
  type StudioBotVersionApiItem,
  updateStudioBotVersionConfigure,
  updateStudioBotVersionDialogs,
} from "@/lib/studio-bots-api";
import {
  LIST_PAGE_SIZE_OPTIONS,
  type ListPageSize,
  usePersistedPageSize,
} from "@/lib/use-persisted-page-size";
import {
  loadDialogOptionDisplayMode,
  normalizeDialogOptionDisplayMode,
  type DialogOptionDisplayMode,
} from "@/lib/user-display-preferences";
import {
  createEmptyVersionDialog,
  normalizeVersionDialogs,
  normalizeVersionDocument,
  type VersionDialogAsset,
  type VersionDialogUtterance,
  type VersionDocument,
} from "@/lib/version-document";

type SortKey =
  | "dialogNo"
  | "dialogType"
  | "name"
  | "displayName"
  | "utterances"
  | "cardCount"
  | "tags"
  | "updatedAt"
  | "updatedBy";

type ValidationFilter = "all" | "success" | "failure" | "none";
type DialogFilter = "all" | "intent" | "module";
type SearchType = "all" | "dialogType" | "validation" | "tag";

type IntentUploadRow = {
  name: string;
  displayName: string;
  dialogKey: string;
  utterance: string;
  tags: string[];
};

type IntentUploadResult = {
  message: string;
  note?: string;
  sections: UploadResultSection[];
};

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
  bot?: StudioBotApiItem | null,
  dialogCount?: number,
  assetCounts?: { dictionary?: number; entities?: number },
): SummaryStatItem[] {
  const counts = bot?.active_version?.asset_counts;
  const retrainingCount = "-";
  const intentCount = counts?.dialogs ?? counts?.intents ?? (dialogCount === undefined ? "-" : dialogCount);
  const entityCount = assetCounts?.entities ?? counts?.entities ?? "-";
  const dictionaryCount = assetCounts?.dictionary ?? counts?.dictionary ?? "-";
  return [
    {
      label: "의도",
      value: String(intentCount),
      active: true,
      href: buildVersionAssetHref(botId, versionId, "intents"),
    },
    {
      label: "구성",
      value: "-",
      href: buildVersionAssetHref(botId, versionId, "configure"),
    },
    {
      label: "개체",
      value: String(entityCount),
      href: buildVersionAssetHref(botId, versionId, "entities"),
    },
    {
      label: "사전",
      value: String(dictionaryCount),
      href: buildVersionAssetHref(botId, versionId, "dictionary"),
    },
    {
      label: "평가",
      value: "-",
      href: buildVersionAssetHref(botId, versionId, "evaluation"),
    },
    {
      label: "재학습",
      value: String(retrainingCount),
      href: buildVersionAssetHref(botId, versionId, "retraining"),
    },
    {
      label: "분석",
      value: "-",
      href: buildVersionAssetHref(botId, versionId, "analysis"),
    },
  ];
}

function formatDialogUpdatedAt(value: string) {
  if (!value) {
    return "-";
  }

  return value.replace("T", " ").slice(0, 16);
}

function getScenarioIssueMessage(item: Record<string, unknown>) {
  return typeof item.message === "string" && item.message.trim()
    ? item.message.trim()
    : "대화 설계 오류가 있습니다.";
}

function getScenarioIssueDisplayMessage(item: Record<string, unknown>) {
  const message = getScenarioIssueMessage(item);
  const dialogName = getScenarioIssueDialogName(item);
  const nodeTitle = typeof item.node_title === "string" ? item.node_title.trim() : "";
  const location = [dialogName, nodeTitle].filter(Boolean).join(" / ");
  return location ? `${location}: ${message}` : message;
}

function getScenarioIssueKey(item: Record<string, unknown>) {
  return [
    String(item.code ?? ""),
    getScenarioIssueDialogId(item),
    String(item.node_id ?? item.nodeId ?? ""),
    getScenarioIssueMessage(item),
  ].join("|");
}

function getScenarioIssueDialogId(item: Record<string, unknown>) {
  return String(item.dialog_id ?? item.dialogId ?? item.dialogID ?? "");
}

function getScenarioIssueDialogName(item: Record<string, unknown>) {
  return String(item.dialog_name ?? item.dialogName ?? item.graph_name ?? item.graphName ?? "").trim();
}

function normalizeTextKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function resolveScenarioIssueDialogId(item: Record<string, unknown>, dialogs: VersionDialogAsset[]) {
  const dialogId = getScenarioIssueDialogId(item);
  if (dialogId && dialogs.some((dialog) => dialog.id === dialogId)) {
    return dialogId;
  }

  const dialogName = normalizeTextKey(getScenarioIssueDialogName(item));
  if (!dialogName) {
    return dialogId;
  }

  const matchedDialog = dialogs.find((dialog) =>
    [dialog.name, dialog.displayName, String(dialog.dialogNo)].some((value) => normalizeTextKey(String(value)) === dialogName),
  );
  return matchedDialog?.id ?? dialogId;
}

function downloadTextFile(fileName: string, text: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([`\uFEFF${text}`], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string | number | boolean) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuote && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuote = !inQuote;
      continue;
    }

    if (char === "," && !inQuote) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsvText(text: string) {
  const normalizedText = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let currentLine = "";
  let inQuote = false;

  for (let index = 0; index < normalizedText.length; index += 1) {
    const char = normalizedText[index];
    const nextChar = normalizedText[index + 1];

    if (char === '"' && inQuote && nextChar === '"') {
      currentLine += '""';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuote = !inQuote;
    }

    if (char === "\n" && !inQuote) {
      if (currentLine.trim()) {
        rows.push(splitCsvLine(currentLine));
      }
      currentLine = "";
      continue;
    }

    currentLine += char;
  }

  if (currentLine.trim()) {
    rows.push(splitCsvLine(currentLine));
  }

  return rows;
}

function normalizeHeader(value: string) {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

function getCellByHeaders(
  cells: string[],
  headerMap: Map<string, number>,
  keys: string[],
  fallbackIndex: number,
) {
  for (const key of keys) {
    const index = headerMap.get(normalizeHeader(key));
    if (index != null) {
      return cells[index]?.trim() ?? "";
    }
  }

  return cells[fallbackIndex]?.trim() ?? "";
}

function parseIntentImportRows(text: string): IntentUploadRow[] {
  const rows = parseCsvText(text);
  if (rows.length === 0) {
    return [];
  }

  const firstRow = rows[0].map(normalizeHeader);
  const hasHeader = firstRow.some((cell) =>
    ["의도명", "intentname", "학습문장", "utterance"].includes(cell),
  );
  const headerMap = new Map<string, number>();
  const dataRows = hasHeader ? rows.slice(1) : rows;

  if (hasHeader) {
    rows[0].forEach((header, index) => {
      headerMap.set(normalizeHeader(header), index);
    });
  }

  return dataRows
    .map((cells) => {
      const name = getCellByHeaders(cells, headerMap, ["의도명", "Intent Name", "intentName", "name"], 0);
      const displayName = getCellByHeaders(cells, headerMap, ["표시명", "Display Name", "displayName"], 1);
      const dialogKey = getCellByHeaders(cells, headerMap, ["의도 Key", "Intent Key", "dialogKey"], 2);
      const utterance = getCellByHeaders(cells, headerMap, ["학습문장", "Utterance", "utterance"], 3);
      const tagText = getCellByHeaders(cells, headerMap, ["태그", "Tags", "tags"], 4);

      return {
        name,
        displayName,
        dialogKey,
        utterance,
        tags: tagText
          .split(/[|;]/)
          .map((item) => item.trim())
          .filter(Boolean),
      };
    })
    .filter((row) => row.name || row.displayName || row.dialogKey || row.utterance || row.tags.length > 0);
}

function buildIntentDownloadCsv(dialogs: VersionDialogAsset[]) {
  const rows = [["의도명", "표시명", "의도 Key", "학습문장", "태그"]];

  dialogs
    .filter((dialog) => dialog.dialogType === 1)
    .forEach((dialog) => {
      const tags = dialog.tags.join("|");
      if (dialog.utterances.length === 0) {
        rows.push([dialog.name, dialog.displayName, dialog.dialogKey, "", tags]);
        return;
      }

      dialog.utterances.forEach((utterance) => {
        rows.push([dialog.name, dialog.displayName, dialog.dialogKey, utterance.text, tags]);
      });
    });

  return rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(",")).join("\n");
}

function buildUtterance(text: string): VersionDialogUtterance {
  return {
    id: crypto.randomUUID(),
    text,
    utteranceType: "T",
  };
}

function DialogOptionIcon({ kind }: { kind: "transition" | "return" | "feedback" }) {
  if (kind === "transition") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 7h10" />
        <path d="m14 4 3 3-3 3" />
        <path d="M17 17H7" />
        <path d="m10 14-3 3 3 3" />
      </svg>
    );
  }
  if (kind === "return") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 7 5 11l4 4" />
        <path d="M5 11h9a5 5 0 1 1 0 10h-2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 8h12" />
      <path d="M6 12h8" />
      <path d="M8 18H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-4l-4 3v-3H8Z" />
    </svg>
  );
}

function DialogOptionBadges({ dialog, displayMode }: { dialog: VersionDialogAsset; displayMode: DialogOptionDisplayMode }) {
  const options = [
    { key: "transition" as const, label: "T", active: Boolean(dialog.transitionLocked), title: "의도전환잠금" },
    { key: "return" as const, label: "R", active: Boolean(dialog.returnBlocked), title: "의도복귀차단" },
    { key: "feedback" as const, label: "F", active: Boolean(dialog.feedbackEnabled), title: "의도별 피드백" },
  ];

  return (
    <span className="intent-list-options" aria-label="기타옵션">
      {options.map((option) => (
        <span
          key={option.key}
          className={`intent-list-options__badge${option.active ? " is-active" : ""}`}
          title={option.title}
          aria-label={`${option.title} ${option.active ? "설정됨" : "설정 안 됨"}`}
          tabIndex={0}
        >
          {displayMode === "icon" ? <DialogOptionIcon kind={option.key} /> : option.label}
          <span className="intent-list-options__tooltip" role="tooltip">
            {option.title}
          </span>
        </span>
      ))}
    </span>
  );
}

function ScenarioIssueBadge({ count, title, displayMode }: { count: number; title: string; displayMode: DialogOptionDisplayMode }) {
  if (count <= 0) {
    return null;
  }

  return (
    <span
      className={`intent-list-options__badge intent-list-options__badge--error intent-list-options__badge--scenario${displayMode === "icon" ? " is-icon" : " is-text"}`}
      title={title}
      aria-label={`대화 설계 오류 ${count}건`}
    >
      {displayMode === "icon" ? "!" : "오류"}
    </span>
  );
}

export function IntentListPage() {
  const workspace = useStudioWorkspace();
  const params = useParams<{ botId: string; versionId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const botId = typeof params.botId === "string" ? decodeURIComponent(params.botId) : "";
  const versionName = typeof params.versionId === "string" ? decodeURIComponent(params.versionId) : "v1";

  const headerMenuRef = useRef<HTMLDivElement | null>(null);
  const rowMenuRef = useRef<HTMLDivElement | null>(null);
  const toolbarMenuRef = useRef<HTMLDivElement | null>(null);
  const sectionFetchKeyRef = useRef("");
  const currentBotRef = useRef<StudioBotApiItem | null>(workspace.bot);
  const [bot, setBot] = useState<StudioBotApiItem | null>(workspace.bot);
  const [versions, setVersions] = useState<StudioBotVersionApiItem[]>(workspace.versions);
  const [authSession, setAuthSession] = useState<AuthSession | null>(workspace.session);
  const [referenceDocument, setReferenceDocument] = useState<VersionDocument>(() =>
    normalizeVersionDocument(workspace.bot.active_version?.version_json),
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [favoritePending, setFavoritePending] = useState(false);
  const [favoriteBotIds, setFavoriteBotIds] = useState<string[]>([]);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = usePersistedPageSize<ListPageSize>(
    "aidot.page_size.intent.list",
    10,
    LIST_PAGE_SIZE_OPTIONS,
  );
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("dialogNo");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [dialogFilter, setDialogFilter] = useState<DialogFilter>("all");
  const [validationFilter, setValidationFilter] = useState<ValidationFilter>("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [searchType, setSearchType] = useState<SearchType>("all");
  const [dialogOptionDisplayMode, setDialogOptionDisplayMode] = useState<DialogOptionDisplayMode>("text");
  const [saving, setSaving] = useState(false);
  const [editingDialog, setEditingDialog] = useState<VersionDialogAsset | null>(null);
  const [creatingDialog, setCreatingDialog] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState<IntentUploadResult | null>(null);

  useEffect(() => {
    currentBotRef.current = bot;
  }, [bot]);

  useEffect(() => {
    setAuthSession(workspace.session);
    setFavoriteBotIds(workspace.session.user.favorite_bot_ids ?? []);
    setVersions(workspace.versions);
    const nextDocument = normalizeVersionDocument(workspace.bot.active_version?.version_json);
    const workspaceVersion = workspace.bot.active_version;
    const currentVersion = currentBotRef.current?.active_version;
    const shouldPreserveCurrentDialogs = Boolean(
      workspaceVersion &&
        currentVersion &&
        workspaceVersion.id === currentVersion.id &&
        !Array.isArray(workspaceVersion.version_json?.dialogs) &&
        Array.isArray(currentVersion.version_json?.dialogs),
    );
    setBot((current) => {
      if (shouldPreserveCurrentDialogs && workspaceVersion && currentVersion?.version_json?.dialogs) {
        const preservedDocument = {
          ...normalizeVersionDocument(workspaceVersion.version_json),
          dialogs: currentVersion.version_json.dialogs,
        };
        return {
          ...workspace.bot,
          active_version: {
            ...workspaceVersion,
            version_json: preservedDocument,
          },
        };
      }
      return workspace.bot;
    });
    setReferenceDocument((currentDocument) => {
      if (
        workspace.bot.active_version &&
        !Array.isArray(workspace.bot.active_version.version_json?.dialogs) &&
        Array.isArray(currentDocument.dialogs) &&
        currentDocument.dialogs.length > 0
      ) {
        return currentDocument;
      }
      return nextDocument;
    });
    setLoading(Boolean(workspaceVersion && !Array.isArray(workspaceVersion.version_json?.dialogs) && !shouldPreserveCurrentDialogs));
    setErrorMessage("");
  }, [workspace.bot, workspace.session, workspace.versions]);

  useEffect(() => {
    const version = bot?.active_version;
    if (!authSession || !bot || !version) {
      return;
    }

    const fetchKey = `${bot.id}:${version.id}`;
    if (sectionFetchKeyRef.current === fetchKey && Array.isArray(version.version_json?.dialogs)) {
      return;
    }
    const cachedDialogs = getCachedStudioBotVersionDialogs(authSession.access_token, bot.id, version.id);
    if (cachedDialogs) {
      const baseDocument = normalizeVersionDocument(version.version_json);
      const nextDocument = withUpdatedDialogs(baseDocument, normalizeVersionDialogs(cachedDialogs.items));
      const updatedVersion: StudioBotVersionApiItem = {
        ...cachedDialogs.version,
        version_json: nextDocument,
        asset_counts: cachedDialogs.asset_counts,
        scenario_validation: cachedDialogs.scenario_validation,
      };
      sectionFetchKeyRef.current = fetchKey;
      setReferenceDocument(nextDocument);
      setBot((current) => (current ? applyUpdatedVersionToBot(current, updatedVersion) : current));
      setLoading(false);
      return;
    }
    sectionFetchKeyRef.current = fetchKey;

    let ignore = false;
    setLoading(true);
    fetchStudioBotVersionDialogs(authSession.access_token, bot.id, version.id)
      .then((dialogsResponse) => {
        if (ignore) {
          return;
        }
        const baseDocument = normalizeVersionDocument(version.version_json);
        const nextDocument = withUpdatedDialogs(baseDocument, normalizeVersionDialogs(dialogsResponse.items));
        const updatedVersion: StudioBotVersionApiItem = {
          ...dialogsResponse.version,
          version_json: nextDocument,
          asset_counts: dialogsResponse.asset_counts,
          scenario_validation: dialogsResponse.scenario_validation,
        };
        setReferenceDocument(nextDocument);
        setBot((current) => (current ? applyUpdatedVersionToBot(current, updatedVersion) : current));
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : "의도/모듈 정보를 불러오지 못했습니다.");
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
  }, [authSession, bot, bot?.active_version]);

  useEffect(() => {
    if (pathname && bot && !errorMessage) {
      saveLastBotScreen(pathname);
    }
  }, [pathname, bot, errorMessage]);

  useEffect(() => {
    setDialogOptionDisplayMode(loadDialogOptionDisplayMode());

    function handleDisplayModeChanged(event: Event) {
      const customEvent = event as CustomEvent<{ mode?: string }>;
      setDialogOptionDisplayMode(normalizeDialogOptionDisplayMode(customEvent.detail?.mode));
    }

    function handleStorageChanged(event: StorageEvent) {
      if (!event.key || event.key === "aidot.dialog_option_display_mode") {
        setDialogOptionDisplayMode(loadDialogOptionDisplayMode());
      }
    }

    window.addEventListener("aidot:dialog-option-display-mode", handleDisplayModeChanged);
    window.addEventListener("storage", handleStorageChanged);
    return () => {
      window.removeEventListener("aidot:dialog-option-display-mode", handleDisplayModeChanged);
      window.removeEventListener("storage", handleStorageChanged);
    };
  }, []);

  if (!loading && !authSession) {
    return null;
  }

  useEffect(() => {
    if (!headerMenuOpen && !toolbarMenuOpen && !rowMenuId) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !headerMenuRef.current?.contains(target) &&
        !toolbarMenuRef.current?.contains(target) &&
        !rowMenuRef.current?.contains(target)
      ) {
        setHeaderMenuOpen(false);
        setToolbarMenuOpen(false);
        setRowMenuId(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [headerMenuOpen, toolbarMenuOpen, rowMenuId]);

  const effectiveBotId = bot?.id ?? botId;
  const effectiveVersion = bot?.active_version ?? versions.find((version) => version.name === versionName || version.id === versionName) ?? null;
  const effectiveVersionName = effectiveVersion?.name ?? versionName;
  const dialogs = useMemo(() => getVersionDialogs(effectiveVersion), [effectiveVersion]);
  const dialogCountForSummary = Array.isArray(effectiveVersion?.version_json?.dialogs) ? dialogs.length : undefined;
  const userEntityCountForSummary = useMemo(
    () => Array.isArray(effectiveVersion?.version_json?.entities) ? getVersionUserEntities(effectiveVersion).length : undefined,
    [effectiveVersion],
  );
  const userDictionaryCountForSummary = useMemo(
    () => Array.isArray(effectiveVersion?.version_json?.dictionary) ? getVersionUserDictionary(effectiveVersion).length : undefined,
    [effectiveVersion],
  );
  const scenarioIssueDetails = useMemo(() => {
    const validation = effectiveVersion?.scenario_validation;
    const items = validation?.items ?? [];
    const saveBlockingKeys = new Set((validation?.save_blocking_items ?? []).map((item) => getScenarioIssueKey(item)));
    return items
      .filter((item) => String(item.severity ?? "error") === "error")
      .map((item) => {
        const saveBlocking = saveBlockingKeys.has(getScenarioIssueKey(item));
        const scopeLabel = saveBlocking ? "저장 차단" : "학습/실행 차단";
        return {
          dialogId: resolveScenarioIssueDialogId(item, dialogs),
          message: `[${scopeLabel}] ${getScenarioIssueDisplayMessage(item)}`,
        };
      });
  }, [dialogs, effectiveVersion?.scenario_validation]);
  const scenarioIssueMap = useMemo(() => {
    const issueMap = new Map<string, string[]>();
    const validation = effectiveVersion?.scenario_validation;
    for (const item of scenarioIssueDetails) {
      if (!item.dialogId) {
        continue;
      }
      const messages = issueMap.get(item.dialogId) ?? [];
      messages.push(item.message);
      issueMap.set(item.dialogId, messages);
    }
    for (const dialogId of validation?.blocked_dialog_ids ?? []) {
      const normalizedDialogId = String(dialogId);
      if (!normalizedDialogId || issueMap.has(normalizedDialogId)) {
        continue;
      }
      issueMap.set(normalizedDialogId, ["대화 설계 오류가 있습니다."]);
    }
    return issueMap;
  }, [effectiveVersion?.scenario_validation, scenarioIssueDetails]);
  const scenarioErrorCount = Number(effectiveVersion?.scenario_validation?.error_count ?? 0);
  const displayableScenarioErrorCount = [...scenarioIssueMap.keys()].filter((dialogId) =>
    dialogs.some((dialog) => dialog.id === dialogId),
  ).length;
  const unplacedScenarioIssues = scenarioIssueDetails.filter(
    (item) => !item.dialogId || !dialogs.some((dialog) => dialog.id === item.dialogId),
  );
  const scenarioErrorSummary =
    scenarioErrorCount > 0
      ? [
          `설계 오류 ${scenarioErrorCount}건이 있어 학습할 수 없습니다.`,
          displayableScenarioErrorCount > 0
            ? "오류 칸의 표시가 있는 의도/모듈을 수정해주세요."
            : "목록 행과 연결되지 않은 오류가 있습니다. 대화 설계를 다시 저장한 뒤 확인해주세요.",
          unplacedScenarioIssues.length > 0
            ? `미표시 오류: ${unplacedScenarioIssues.slice(0, 3).map((item) => item.message).join(" / ")}`
            : "",
        ]
          .filter(Boolean)
          .join(" ")
      : "";
  const trainingDisabledReason =
    scenarioErrorCount > 0
      ? displayableScenarioErrorCount > 0
        ? `설계 오류 ${scenarioErrorCount}건이 있어 학습할 수 없습니다. 오류 칸의 표시가 있는 의도/모듈을 수정해주세요.`
        : `설계 오류 ${scenarioErrorCount}건이 있어 학습할 수 없습니다. 대화 설계를 다시 저장한 뒤 오류 위치를 확인해주세요.`
      : "";
  const summaryCards = useMemo(
    () =>
      buildSummaryCards(effectiveBotId, effectiveVersionName, bot, dialogCountForSummary, {
        dictionary: userDictionaryCountForSummary,
        entities: userEntityCountForSummary,
      }),
    [
      bot,
      dialogCountForSummary,
      effectiveBotId,
      effectiveVersionName,
      userDictionaryCountForSummary,
      userEntityCountForSummary,
    ],
  );
  const availableTags = useMemo(
    () =>
      [...new Set(dialogs.flatMap((dialog) => dialog.tags))]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, "ko-KR")),
    [dialogs],
  );

  function handleOpenDialogWorkspace(dialog: VersionDialogAsset) {
    router.push(buildDialogTargetHref(effectiveBotId, effectiveVersionName, dialog));
  }

  function handleOpenDialogDesign(dialog: VersionDialogAsset) {
    if (dialog.dialogType === 1 && dialog.utterances.length === 0) {
      setMessage("");
      setErrorMessage("의도는 학습문장을 등록한 후 대화 설계로 이동할 수 있습니다.");
      return;
    }

    setMessage("");
    setErrorMessage("");
    router.push(
      `/studio/bots/${encodeURIComponent(effectiveBotId)}/versions/${encodeURIComponent(effectiveVersionName)}/flows/${dialog.id}`,
    );
  }

  function handleOpenDialogStart(dialog: VersionDialogAsset) {
    if (dialog.dialogType !== 1) {
      return;
    }

    router.push(
      `/studio/bots/${encodeURIComponent(effectiveBotId)}/versions/${encodeURIComponent(effectiveVersionName)}/intents/${dialog.id}`,
    );
  }

  const visibleDialogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = dialogs.filter((dialog) => {
      if (dialogFilter === "intent" && dialog.dialogType !== 1) {
        return false;
      }

      if (dialogFilter === "module" && dialog.dialogType !== 0) {
        return false;
      }

      const validationStatus = scenarioIssueMap.has(dialog.id) ? "failure" : dialog.validationStatus;
      if (validationFilter !== "all" && validationStatus !== validationFilter) {
        return false;
      }

      if (tagFilter !== "all" && !dialog.tags.includes(tagFilter)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return buildDialogSearchText(dialog).includes(normalizedQuery);
    });

    return [...filtered].sort((left, right) => {
      const leftValue = (() => {
        switch (sortKey) {
          case "dialogNo":
            return left.dialogNo;
          case "dialogType":
            return getDialogTypeLabel(left.dialogType);
          case "name":
            return left.name;
          case "displayName":
            return left.displayName;
          case "utterances":
            return left.utterances.length;
          case "cardCount":
            return left.cardCount;
          case "tags":
            return left.tags.length;
          case "updatedBy":
            return left.updatedBy;
          case "updatedAt":
          default:
            return left.updatedAt;
        }
      })();

      const rightValue = (() => {
        switch (sortKey) {
          case "dialogNo":
            return right.dialogNo;
          case "dialogType":
            return getDialogTypeLabel(right.dialogType);
          case "name":
            return right.name;
          case "displayName":
            return right.displayName;
          case "utterances":
            return right.utterances.length;
          case "cardCount":
            return right.cardCount;
          case "tags":
            return right.tags.length;
          case "updatedBy":
            return right.updatedBy;
          case "updatedAt":
          default:
            return right.updatedAt;
        }
      })();

      const compare =
        typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue), "ko-KR");

      return sortDirection === "asc" ? compare : compare * -1;
    });
  }, [dialogs, dialogFilter, query, scenarioIssueMap, sortDirection, sortKey, tagFilter, validationFilter]);

  const totalPages = Math.max(1, Math.ceil(visibleDialogs.length / pageSize));
  const pagedDialogs = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return visibleDialogs.slice(startIndex, startIndex + pageSize);
  }, [page, pageSize, visibleDialogs]);

  useEffect(() => {
    setPage(1);
  }, [dialogFilter, pageSize, query, sortDirection, sortKey, tagFilter, validationFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (searchType === "all") {
      return;
    }

    setQuery("");

    if (searchType !== "dialogType") {
      setDialogFilter("all");
    }

    if (searchType !== "validation") {
      setValidationFilter("all");
    }

    if (searchType !== "tag") {
      setTagFilter("all");
    }
  }, [searchType]);

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
      setErrorMessage(error instanceof Error ? error.message : "학습 결과를 다시 불러오지 못했습니다.");
    }
  }
  const isFavorite = favoriteBotIds.includes(effectiveBotId);

  async function handleFavoriteToggle() {
    if (!authSession || favoritePending) {
      return;
    }

    const nextFavoriteBotIds = isFavorite
      ? favoriteBotIds.filter((id) => id !== effectiveBotId)
      : [effectiveBotId, ...favoriteBotIds.filter((id) => id !== effectiveBotId)];

    setFavoritePending(true);

    try {
      const updatedUser = await updateAuthPreferences(authSession.access_token, {
        favorite_bot_ids: nextFavoriteBotIds,
      });
      const nextSession = updateAuthSessionUser(() => updatedUser);
      if (nextSession) {
        setAuthSession(nextSession);
        setFavoriteBotIds(nextSession.user.favorite_bot_ids ?? []);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "우선 봇 설정을 저장하지 못했습니다.");
    } finally {
      setFavoritePending(false);
    }
  }

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  async function persistVersionDocument(nextDocument: VersionDocument, successMessage: string) {
    if (!authSession || !bot || !effectiveVersion) {
      router.replace("/login");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setMessage("");

    try {
      const response = await updateStudioBotVersionConfigure(
        authSession.access_token,
        bot.id,
        effectiveVersion.id,
        {
          dialogs: nextDocument.dialogs,
          dialog_flow_graphs: nextDocument.dialog_flow_graphs,
        },
      );
      const updatedVersion: StudioBotVersionApiItem = {
        ...response.version,
        version_json: nextDocument,
        asset_counts: response.asset_counts,
        scenario_validation: response.scenario_validation,
      };
      setReferenceDocument(normalizeVersionDocument(updatedVersion.version_json));
      setBot((current) => (current ? applyUpdatedVersionToBot(current, updatedVersion) : current));
      void workspace.refresh();
      setSelectedIds([]);
      setMessage(successMessage);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "의도/모듈 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function persistDialogs(nextDialogs: VersionDialogAsset[], successMessage: string) {
    if (!authSession || !bot || !effectiveVersion) {
      router.replace("/login");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setMessage("");

    try {
      const response = await updateStudioBotVersionDialogs(
        authSession.access_token,
        bot.id,
        effectiveVersion.id,
        nextDialogs,
      );
      const responseDialogMap = new Map(normalizeVersionDialogs(response.items).map((item) => [item.id, item]));
      const orderedDialogs = nextDialogs
        .map((item) => responseDialogMap.get(item.id) ?? item)
        .concat(
          normalizeVersionDialogs(response.items).filter(
            (item) => !nextDialogs.some((nextItem) => nextItem.id === item.id),
          ),
        );
      const updatedVersion: StudioBotVersionApiItem = {
        ...response.version,
        version_json: withUpdatedDialogs(referenceDocument, orderedDialogs),
        asset_counts: response.asset_counts,
        scenario_validation: response.scenario_validation,
      };
      setReferenceDocument(normalizeVersionDocument(updatedVersion.version_json));
      setBot((current) => (current ? applyUpdatedVersionToBot(current, updatedVersion) : current));
      void workspace.refresh();
      setSelectedIds([]);
      setMessage(successMessage);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "의도/모듈 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.length === 0) {
      return;
    }
    if (!authSession || !bot || !effectiveVersion) {
      router.replace("/login");
      return;
    }

    const selectedIdSet = new Set(selectedIds);
    let referenceResponse: Awaited<ReturnType<typeof fetchStudioBotVersionReferences>>;
    try {
      referenceResponse = await fetchStudioBotVersionReferences(authSession.access_token, bot.id, effectiveVersion.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "의도/모듈 삭제 전 버전 정보를 불러오지 못했습니다.");
      return;
    }
    const fullDocument = {
      ...referenceDocument,
      dialogs: normalizeVersionDialogs(referenceResponse.dialogs),
      dialog_flow_graphs: referenceResponse.dialog_flow_graphs,
      rules: referenceResponse.rules,
    };
    const selectedDialogs = dialogs.filter((dialog) => selectedIds.includes(dialog.id));
    const blocked = selectedDialogs
      .map((dialog) => ({ dialog, usages: findDialogUsageReferences(fullDocument, dialog) }))
      .filter((item) => item.usages.length > 0);

    if (blocked.length > 0) {
      setMessage("");
      setErrorMessage(
        blocked
          .map(
            ({ dialog, usages }) =>
              `'${dialog.name}' ${getDialogTypeLabel(dialog.dialogType)}은(는) ${usages.join(", ")}에서 참조하고 있어 삭제할 수 없습니다.`,
          )
          .join(" "),
      );
      return;
    }

    const nextDocument = {
      ...withUpdatedDialogs(
        fullDocument,
        dialogs.filter((dialog) => !selectedIdSet.has(dialog.id)),
      ),
      dialog_flow_graphs: fullDocument.dialog_flow_graphs.filter((graph) => {
        if (!graph || typeof graph !== "object" || Array.isArray(graph)) {
          return true;
        }
        return !selectedIdSet.has(String((graph as Record<string, unknown>).dialogId ?? ""));
      }),
    };

    await persistVersionDocument(nextDocument, "선택한 의도/모듈과 연결된 대화설계가 삭제되었습니다.");
  }

  function handleDownloadTemplate() {
    downloadTextFile(
      "intent-upload-template.csv",
      [["의도명", "표시명", "의도 Key", "학습문장", "태그"], ["주문조회", "주문조회", "", "주문 상태 알려줘", "주문|배송"]]
        .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
        .join("\n"),
      "text/csv;charset=utf-8",
    );
  }

  function handleDownloadIntents() {
    const csv = buildIntentDownloadCsv(dialogs);
    downloadTextFile("intent-list.csv", csv, "text/csv;charset=utf-8");
  }

  async function handleUploadFile(file: File) {
    if (!authSession || !bot || !effectiveVersion) {
      router.replace("/login");
      return;
    }

    const text = await file.text();
    const rows = parseIntentImportRows(text);
    if (rows.length === 0) {
      setMessage("");
      setErrorMessage("업로드 가능한 의도가 없습니다.");
      return;
    }

    const now = new Date().toISOString();
    const currentDialogs = [...dialogs];
    const nextDialogs = [...currentDialogs];
    const intentByName = new Map(
      currentDialogs
        .filter((dialog) => dialog.dialogType === 1)
        .map((dialog) => [normalizeTextKey(dialog.name), dialog]),
    );
    const utteranceOwners = new Map<string, string>();

    currentDialogs
      .filter((dialog) => dialog.dialogType === 1)
      .forEach((dialog) => {
        dialog.utterances.forEach((utterance) => {
          utteranceOwners.set(normalizeTextKey(utterance.text), dialog.id);
        });
      });

    let nextDialogNo = getNextDialogNo(currentDialogs);
    let addedIntentCount = 0;
    let addedUtteranceCount = 0;
    let duplicateUtteranceCount = 0;
    let invalidRowCount = 0;
    let duplicateKeyCount = 0;
    const updatedIntentIds = new Set<string>();

    for (const row of rows) {
      const normalizedName = row.name.trim();
      if (!normalizedName) {
        invalidRowCount += 1;
        continue;
      }

      const normalizedKey = row.dialogKey.trim();
      const duplicatedKey =
        normalizedKey &&
        nextDialogs.some(
          (dialog) =>
            dialog.dialogKey === normalizedKey &&
            normalizeTextKey(dialog.name) !== normalizeTextKey(normalizedName),
        );
      if (duplicatedKey) {
        duplicateKeyCount += 1;
        continue;
      }

      const intentKey = normalizeTextKey(normalizedName);
      let nextDialog = intentByName.get(intentKey);
      const isNew = !nextDialog;

      if (!nextDialog) {
        nextDialog = {
          ...createEmptyVersionDialog(1),
          dialogNo: nextDialogNo,
          name: normalizedName,
          displayName: row.displayName.trim() || normalizedName,
          dialogKey: normalizedKey || crypto.randomUUID(),
          tags: [],
          updatedAt: now,
          updatedBy: authSession.user.login_id,
        };
        nextDialogNo += 1;
        addedIntentCount += 1;
        intentByName.set(intentKey, nextDialog);
        nextDialogs.unshift(nextDialog);
      } else {
        nextDialog = {
          ...nextDialog,
          displayName: row.displayName.trim() || nextDialog.displayName || normalizedName,
          dialogKey: normalizedKey || nextDialog.dialogKey,
          updatedAt: now,
          updatedBy: authSession.user.login_id,
        };
        updatedIntentIds.add(nextDialog.id);
      }

      if (row.tags.length > 0) {
        nextDialog.tags = [...new Set([...nextDialog.tags, ...row.tags])];
      }

      const normalizedUtterance = row.utterance.trim();
      if (normalizedUtterance) {
        const utteranceKey = normalizeTextKey(normalizedUtterance);
        const existingOwnerId = utteranceOwners.get(utteranceKey);
        if (existingOwnerId && existingOwnerId !== nextDialog.id) {
          duplicateUtteranceCount += 1;
        } else if (nextDialog.utterances.some((item) => normalizeTextKey(item.text) === utteranceKey)) {
          duplicateUtteranceCount += 1;
        } else {
          nextDialog.utterances = [buildUtterance(normalizedUtterance), ...nextDialog.utterances];
          utteranceOwners.set(utteranceKey, nextDialog.id);
          addedUtteranceCount += 1;
        }
      }

      const targetIndex = nextDialogs.findIndex((dialog) => dialog.id === nextDialog?.id);
      if (targetIndex >= 0) {
        nextDialogs[targetIndex] = nextDialog;
      }
    }

    let referenceResponse: Awaited<ReturnType<typeof fetchStudioBotVersionReferences>>;
    try {
      referenceResponse = await fetchStudioBotVersionReferences(authSession.access_token, bot.id, effectiveVersion.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "의도 파일 업로드 전 버전 정보를 불러오지 못했습니다.");
      return;
    }
    let nextDocument = withUpdatedDialogs(
      {
        ...referenceDocument,
        dialogs: normalizeVersionDialogs(referenceResponse.dialogs),
        dialog_flow_graphs: referenceResponse.dialog_flow_graphs,
        rules: referenceResponse.rules,
      },
      nextDialogs,
    );
    nextDialogs
      .filter((dialog) => dialog.dialogType === 1)
      .forEach((dialog) => {
        nextDocument = withEnsuredDialogFlowGraph(nextDocument, dialog);
      });

    await persistVersionDocument(nextDocument, "의도 파일 업로드가 완료되었습니다.");
    setUploadDialogOpen(false);
    setUploadResult({
      message: "업로드가 완료되었습니다.",
      note: "중복되거나 다른 의도에서 이미 사용 중인 학습문장은 등록되지 않습니다.",
      sections: [
        {
          rows: [
            { label: "추가된 의도", value: addedIntentCount },
            { label: "수정된 의도", value: updatedIntentIds.size },
            { label: "추가된 학습문장", value: addedUtteranceCount },
            { label: "중복된 학습문장", value: duplicateUtteranceCount },
            { label: "중복된 의도 Key", value: duplicateKeyCount },
            { label: "제외된 행", value: invalidRowCount },
          ],
        },
      ],
    });
  }

  const activeFilterLabel =
    searchType === "dialogType"
      ? "구분"
      : searchType === "validation"
        ? "Validation"
        : searchType === "tag"
          ? "태그"
          : "전체";

  const emptyText = useMemo(() => {
    if (errorMessage) {
      return errorMessage;
    }
    if (query.trim()) {
      return "검색 조건에 맞는 의도/모듈이 없습니다.";
    }
    if (loading) {
      return "의도/모듈 정보를 불러오는 중입니다.";
    }
    return "등록된 의도/모듈이 없습니다. 먼저 의도/모듈을 추가해주세요.";
  }, [errorMessage, loading, query]);

  if (!bot || !effectiveVersion) {
    return <StudioPageLoading title="의도/모듈 화면을 불러오는 중입니다." />;
  }

  return (
    <section className="manual-main manual-main--intent-list">

      {errorMessage ? <p className="form-message form-message--error">{errorMessage}</p> : null}
      {message ? <p className="form-message form-message--success">{message}</p> : null}
      {scenarioErrorSummary ? <p className="form-message form-message--error">{scenarioErrorSummary}</p> : null}

      <div className="manual-main__toolbar manual-main__toolbar--intent-search">
        <div className="manual-main__toolbar-left manual-main__search-group">
          {searchType === "all" ? (
            <input
              className="manual-main__search"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="의도/모듈명, 학습문장, 대화카드, 의도아이디, 태그를 검색해주세요."
            />
          ) : (
            <div className="manual-main__search manual-main__search--readonly">
              {activeFilterLabel} 조건으로 조회 중입니다.
            </div>
          )}
          <label className="manual-main__mini-select manual-main__mini-select--select">
            <select value={searchType} onChange={(event) => setSearchType(event.target.value as SearchType)}>
              <option value="all">전체</option>
              <option value="dialogType">구분</option>
              <option value="validation">Validation</option>
              <option value="tag">태그</option>
            </select>
          </label>
          {searchType === "dialogType" ? (
            <label className="manual-main__mini-select manual-main__mini-select--select">
              <select value={dialogFilter} onChange={(event) => setDialogFilter(event.target.value as DialogFilter)}>
                <option value="all">전체</option>
                <option value="intent">의도</option>
                <option value="module">모듈</option>
              </select>
            </label>
          ) : null}
          {searchType === "validation" ? (
            <label className="manual-main__mini-select manual-main__mini-select--select">
              <select value={validationFilter} onChange={(event) => setValidationFilter(event.target.value as ValidationFilter)}>
                <option value="all">전체 Validation</option>
                <option value="success">성공</option>
                <option value="failure">실패</option>
                <option value="none">없음</option>
              </select>
            </label>
          ) : null}
          {searchType === "tag" ? (
            <label className="manual-main__mini-select manual-main__mini-select--select">
              <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
                <option value="all">전체 태그</option>
                {availableTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="manual-main__toolbar-right">
          <button
            type="button"
            className="manual-main__action-button manual-main__action-button--dropdown"
            onClick={() => setCreatingDialog(true)}
          >
            + 의도/모듈 추가
          </button>
          <div className="manual-main__menu" ref={toolbarMenuRef}>
            <button
              type="button"
              className="manual-main__menu-button manual-main__menu-button--toolbar"
              aria-label="의도/모듈 파일 메뉴"
              aria-expanded={toolbarMenuOpen}
              disabled={saving}
              onClick={() => setToolbarMenuOpen((current) => !current)}
            >
              ⋮
            </button>
            {toolbarMenuOpen ? (
              <div className="manual-main__menu-popover">
                <button
                  type="button"
                  className="manual-main__menu-item manual-main__menu-item--button"
                  onClick={() => {
                    setToolbarMenuOpen(false);
                    setUploadDialogOpen(true);
                  }}
                >
                  파일 업로드
                </button>
                <button
                  type="button"
                  className="manual-main__menu-item manual-main__menu-item--button"
                  onClick={() => {
                    setToolbarMenuOpen(false);
                    handleDownloadIntents();
                  }}
                >
                  파일 다운로드
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="manual-main__toolbar manual-main__toolbar--secondary manual-main__toolbar--intent-meta">
        <div className="manual-main__toolbar-left">
          <strong>전체 {visibleDialogs.length}건</strong>
          <label className="manual-main__mini-select manual-main__mini-select--select">
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as ListPageSize)}>
              <option value={10}>10개씩 보기</option>
              <option value={25}>25개씩 보기</option>
              <option value={50}>50개씩 보기</option>
              <option value={100}>100개씩 보기</option>
            </select>
          </label>
          <button
            type="button"
            className="manual-main__ghost-button"
            disabled={selectedIds.length === 0 || saving}
            onClick={() => setDeleteConfirmOpen(true)}
          >
            삭제
          </button>
          {selectedIds.length > 0 ? <span className="studio-table-page__selection">{selectedIds.length}개 선택</span> : null}
        </div>
      </div>

      <div className="manual-main__table manual-main__table--intents">
        <div className="manual-main__table-header manual-main__table-header--intents">
          <span className="manual-main__cell manual-main__cell--check">
            <input
              type="checkbox"
              aria-label="전체 선택"
              checked={pagedDialogs.length > 0 && pagedDialogs.every((dialog) => selectedIds.includes(dialog.id))}
              onChange={(event) =>
                setSelectedIds(
                  event.target.checked ? pagedDialogs.map((dialog) => dialog.id) : [],
                )
              }
            />
          </span>
          <span className="manual-main__cell">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("dialogNo")}>
              <SortHeaderLabel label="ID" direction={sortKey === "dialogNo" ? sortDirection : "none"} />
            </button>
          </span>
          <span className="manual-main__cell manual-main__cell--scenario-error">오류</span>
          <span className="manual-main__cell">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("dialogType")}>
              <SortHeaderLabel label="구분" direction={sortKey === "dialogType" ? sortDirection : "none"} />
            </button>
          </span>
          <span className="manual-main__cell manual-main__cell--name">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("name")}>
              <SortHeaderLabel label="의도/모듈명" direction={sortKey === "name" ? sortDirection : "none"} />
            </button>
          </span>
          <span className="manual-main__cell manual-main__cell--display">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("displayName")}>
              <SortHeaderLabel label="표시명" direction={sortKey === "displayName" ? sortDirection : "none"} />
            </button>
          </span>
          <span className="manual-main__cell manual-main__cell--number">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("utterances")}>
              <SortHeaderLabel label="학습문장" direction={sortKey === "utterances" ? sortDirection : "none"} />
            </button>
          </span>
          <span className="manual-main__cell manual-main__cell--number">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("cardCount")}>
              <SortHeaderLabel label="대화카드" direction={sortKey === "cardCount" ? sortDirection : "none"} />
            </button>
          </span>
          <span className="manual-main__cell manual-main__cell--number">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("tags")}>
              <SortHeaderLabel label="태그" direction={sortKey === "tags" ? sortDirection : "none"} />
            </button>
          </span>
          <span className="manual-main__cell">기타옵션</span>
          <span className="manual-main__cell">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("updatedAt")}>
              <SortHeaderLabel label="최종수정일시" direction={sortKey === "updatedAt" ? sortDirection : "none"} />
            </button>
          </span>
          <span className="manual-main__cell">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("updatedBy")}>
              <SortHeaderLabel label="최종수정자" direction={sortKey === "updatedBy" ? sortDirection : "none"} />
            </button>
          </span>
          <span className="manual-main__cell manual-main__cell--actions" />
        </div>

        {pagedDialogs.map((dialog) => {
          const scenarioIssues = scenarioIssueMap.get(dialog.id) ?? [];
          const scenarioIssueTitle = scenarioIssues.join("\n");
          return (
          <div key={dialog.id} className="manual-main__table-row manual-main__table-row--intents">
            <span className="manual-main__cell manual-main__cell--check">
              <input
                type="checkbox"
                aria-label={`${dialog.name} 선택`}
                checked={selectedIds.includes(dialog.id)}
                onChange={() =>
                  setSelectedIds((current) =>
                    current.includes(dialog.id)
                      ? current.filter((id) => id !== dialog.id)
                      : [...current, dialog.id],
                  )
                }
              />
            </span>
            <span className="manual-main__cell">
              {dialog.dialogNo}
            </span>
            <span className="manual-main__cell manual-main__cell--scenario-error" title={scenarioIssueTitle || undefined}>
              <ScenarioIssueBadge count={scenarioIssues.length} title={scenarioIssueTitle} displayMode={dialogOptionDisplayMode} />
            </span>
            <span className="manual-main__cell">{getDialogTypeLabel(dialog.dialogType)}</span>
            <button
              type="button"
              className="manual-main__cell manual-main__cell--name manual-main__cell--link manual-main__cell-button"
              onClick={() => handleOpenDialogWorkspace(dialog)}
              title={scenarioIssueTitle || undefined}
            >
              {dialog.name}
            </button>
            <span className="manual-main__cell manual-main__cell--display">{dialog.displayName || "-"}</span>
            <span className="manual-main__cell manual-main__cell--number">
              {dialog.dialogType === 1 ? (
                <button
                  type="button"
                  className="manual-main__cell-link-button"
                  onClick={() => handleOpenDialogStart(dialog)}
                >
                  {dialog.utterances.length}
                </button>
              ) : (
                <span className="manual-main__number">{dialog.utterances.length}</span>
              )}
            </span>
            <span className="manual-main__cell manual-main__cell--number">
              <button
                type="button"
                className="manual-main__cell-link-button"
                onClick={() => handleOpenDialogDesign(dialog)}
              >
                {dialog.cardCount}
              </button>
            </span>
            <span className="manual-main__cell manual-main__cell--number">
              <span className="manual-main__number">{dialog.tags.length}</span>
            </span>
            <span className="manual-main__cell">
              <DialogOptionBadges dialog={dialog} displayMode={dialogOptionDisplayMode} />
            </span>
            <span className="manual-main__cell">{formatDialogUpdatedAt(dialog.updatedAt)}</span>
            <span className="manual-main__cell">{dialog.updatedBy || "-"}</span>
            <span className="manual-main__cell manual-main__cell--actions">
              <div className="manual-main__menu" ref={rowMenuId === dialog.id ? rowMenuRef : null}>
                <button
                  type="button"
                  className="manual-main__menu-button manual-main__menu-button--row"
                  aria-label={`${dialog.name} 메뉴`}
                  onClick={() => setEditingDialog(dialog)}
                >
                  ⋮
                </button>
              </div>
            </span>
          </div>
        );
        })}
      </div>

      {pagedDialogs.length === 0 ? <p className="manual-main__empty">{emptyText}</p> : null}

      <div className="manual-main__pagination">
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
        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
        >
          ›
        </button>
        <button type="button" disabled={page === totalPages} onClick={() => setPage(totalPages)}>
          »
        </button>
      </div>

      <SimulatorFloatingLauncher />

      {bot && authSession && creatingDialog ? (
        <IntentEditorDialog
          authSession={authSession}
          bot={bot}
          dialog={null}
          onClose={() => setCreatingDialog(false)}
          onSaved={(nextBot, nextDialog, successMessage) => {
            setBot(nextBot);
            void workspace.refresh();
          setMessage(successMessage);
          setErrorMessage("");
          setSelectedIds([]);
          setCreatingDialog(false);
        }}
      />
      ) : null}

      {bot && authSession && editingDialog ? (
        <IntentEditorDialog
          authSession={authSession}
          bot={bot}
          dialog={editingDialog}
          onClose={() => setEditingDialog(null)}
          onSaved={(nextBot, _nextDialog, successMessage) => {
            setBot(nextBot);
            void workspace.refresh();
          setMessage(successMessage);
          setErrorMessage("");
          setSelectedIds([]);
          setEditingDialog(null);
        }}
      />
      ) : null}

      {deleteConfirmOpen ? (
        <div className="entity-editor-backdrop" role="presentation">
          <div className="entity-sub-dialog entity-sub-dialog--delete-confirm" role="dialog" aria-modal="true" aria-label="의도 삭제 확인">
            <div className="entity-editor-dialog__header">
              <strong>의도 삭제</strong>
              <button
                type="button"
                className="entity-editor-dialog__close"
                aria-label="닫기"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="entity-editor-dialog__body">
              <p className="entity-sub-dialog__description entity-sub-dialog__description--delete-confirm">
                선택한 의도/모듈과 연결된 대화설계를 삭제하시겠습니까?
              </p>
            </div>
            <div className="entity-editor-dialog__footer">
              <button type="button" className="secondary-action" onClick={() => setDeleteConfirmOpen(false)}>
                취소
              </button>
              <button
                type="button"
                className="primary-action"
                disabled={saving}
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  void handleDeleteSelected();
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {uploadDialogOpen ? (
        <AssetUploadDialog
          title="파일 업로드"
          description={<p>아래의 버튼으로 양식(.csv)을 다운받으신 후, 파일을 업로드 하세요.</p>}
          notice={
            <>
              <p>UTF-8 형식으로 인코딩된 .csv 파일을 통해 의도를 한꺼번에 업로드할 수 있습니다.</p>
              <ul className="asset-upload-dialog__list">
                <li>헤더는 `의도명,표시명,의도 Key,학습문장,태그` 형식을 사용하세요.</li>
                <li>같은 의도명이 여러 줄이면 학습문장을 같은 의도에 추가합니다.</li>
              </ul>
            </>
          }
          accept=".csv,.txt,text/csv,text/plain"
          templateFileName="intent-upload-template.csv"
          onDownloadTemplate={handleDownloadTemplate}
          onClose={() => setUploadDialogOpen(false)}
          onConfirm={(file) => void handleUploadFile(file)}
        />
      ) : null}

      {uploadResult ? (
        <UploadResultDialog
          title="업로드 결과"
          message={uploadResult.message}
          note={uploadResult.note}
          sections={uploadResult.sections}
          onClose={() => setUploadResult(null)}
        />
      ) : null}
    </section>
  );
}
