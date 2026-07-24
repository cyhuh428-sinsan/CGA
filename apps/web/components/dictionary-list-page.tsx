"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { AssetUploadDialog } from "@/components/asset-upload-dialog";
import { DictionaryEditorDialog } from "@/components/dictionary-editor-dialog";
import { SimulatorFloatingLauncher } from "@/components/simulator-page";
import { StudioPageLoading } from "@/components/studio-page-loading";
import { useStudioWorkspace } from "@/components/studio-workspace-provider";
import { type SummaryStatItem } from "@/components/summary-stat-grid";
import { SortHeaderLabel } from "@/components/sort-header-label";
import { useI18n } from "@/components/language-provider";
import {
  UploadResultDialog,
  type UploadResultSection,
} from "@/components/upload-result-dialog";
import { saveLastBotScreen, type AuthSession } from "@/lib/auth";
import { DICTIONARY_LIST_CATALOGS, formatDictionaryListText, type DictionaryListCatalog } from "@/lib/i18n/dictionary-list";
import {
  buildAssetExportFilename,
  buildDictionaryText,
  parseDictionaryImportRows,
} from "@/lib/asset-text-format";
import {
  applyUpdatedVersionToDictionaryBot,
  formatDictionaryUpdatedAt,
  getBotVersionDocument,
  getDictionaryPreviewValue,
  getVersionDictionary,
  getVersionUserDictionary,
  getVersionDocument,
  validateDictionaryEntries,
  withUpdatedDictionary,
} from "@/lib/dictionary-assets";
import { getVersionUserEntities } from "@/lib/entity-assets";
import {
  getScenarioTrainingDisabledReason,
  fetchStudioBotVersionDictionary,
  refreshStudioBotSelectedVersion,
  type StudioBotApiItem,
  type StudioBotVersionApiItem,
  updateStudioBotVersionDictionary,
} from "@/lib/studio-bots-api";
import { normalizeVersionDictionary } from "@/lib/version-document";
import {
  LIST_PAGE_SIZE_OPTIONS,
  type ListPageSize,
  usePersistedPageSize,
} from "@/lib/use-persisted-page-size";

type SortKey = "word" | "synonym" | "synonymCount" | "intent" | "updated" | "updatedBy";

type DictionaryUsageField = "intentEnabled";
type DictionaryUploadCounts = {
  addedWords: number;
  addedSynonyms: number;
  duplicateWords: number;
  duplicateSynonyms: number;
  overLengthWords: number;
  overLengthSynonyms: number;
};
type UploadDialogState = {
  title: string;
  message: string;
  note?: string;
  sections: UploadResultSection[];
};

function buildVersionAssetHref(
  botId: string,
  versionName: string,
  section: "intents" | "configure" | "qa" | "entities" | "dictionary" | "evaluation" | "retraining" | "analysis",
) {
  return `/studio/bots/${botId}/versions/${versionName}/${section}`;
}

function buildSummaryCards(
  botId: string,
  versionName: string,
  bot?: StudioBotApiItem | null,
  dictionaryCount?: number,
  entityCount?: number,
  copy?: DictionaryListCatalog,
): SummaryStatItem[] {
  const counts = bot?.active_version?.asset_counts;
  const dialogCount = getBotVersionDocument(bot).dialogs.length;
  const retrainingRecords = getBotVersionDocument(bot).system_config?.retraining_records;
  const retrainingCount =
    retrainingRecords && typeof retrainingRecords === "object" && !Array.isArray(retrainingRecords)
      ? Object.keys(retrainingRecords).length
      : 0;
  const intentCount = counts?.dialogs ?? counts?.intents ?? (dialogCount > 0 ? dialogCount : "-");
  const activeDictionaryCount = dictionaryCount === undefined ? (counts?.dictionary ?? "-") : dictionaryCount;
  return [
    {
      label: copy?.summary.intent ?? "-",
      value: String(intentCount),
      href: buildVersionAssetHref(botId, versionName, "intents"),
    },
    {
      label: copy?.summary.configure ?? "-",
      value: "-",
      href: buildVersionAssetHref(botId, versionName, "configure"),
    },
    {
      label: copy?.summary.entity ?? "-",
      value: String(entityCount === undefined ? (counts?.entities ?? "-") : entityCount),
      href: buildVersionAssetHref(botId, versionName, "entities"),
    },
    {
      label: copy?.summary.dictionary ?? "-",
      value: String(activeDictionaryCount),
      active: true,
      href: buildVersionAssetHref(botId, versionName, "dictionary"),
    },
    {
      label: copy?.summary.evaluation ?? "-",
      value: "-",
      href: buildVersionAssetHref(botId, versionName, "evaluation"),
    },
    {
      label: copy?.summary.retraining ?? "-",
      value: String(retrainingCount),
      href: buildVersionAssetHref(botId, versionName, "retraining"),
    },
    {
      label: copy?.summary.analysis ?? "-",
      value: "-",
      href: buildVersionAssetHref(botId, versionName, "analysis"),
    },
  ];
}

function normalizeDictionaryWord(value: string) {
  return value.trim();
}

function normalizeDictionarySynonyms(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function isSameDictionarySynonyms(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function createEmptyDictionaryUploadCounts(): DictionaryUploadCounts {
  return {
    addedWords: 0,
    addedSynonyms: 0,
    duplicateWords: 0,
    duplicateSynonyms: 0,
    overLengthWords: 0,
    overLengthSynonyms: 0,
  };
}

function buildDictionaryUploadDialog(counts: DictionaryUploadCounts, copy: DictionaryListCatalog): UploadDialogState {
  return {
    title: copy.uploadResultTitle,
    message: copy.uploadComplete,
    note: copy.uploadNote,
    sections: [
      {
        rows: [
          { label: copy.addedWords, value: counts.addedWords },
          { label: copy.addedSynonyms, value: counts.addedSynonyms },
        ],
      },
      {
        rows: [
          { label: copy.duplicateWords, value: counts.duplicateWords },
          { label: copy.duplicateSynonyms, value: counts.duplicateSynonyms },
          { label: copy.overLengthWords, value: counts.overLengthWords },
          { label: copy.overLengthSynonyms, value: counts.overLengthSynonyms },
        ],
      },
    ],
  };
}

function buildDictionaryExportName(bot?: StudioBotApiItem | null) {
  const botName = bot?.name ?? "Dictionary";
  const exportBotId = bot?.id?.trim();
  const useIdPrefix = Boolean(exportBotId) && exportBotId !== botName;

  if (useIdPrefix) {
    return buildAssetExportFilename("Dictionary", `${exportBotId}_${botName}`, "txt", "");
  }

  return buildAssetExportFilename("Dictionary", botName, "txt");
}

export function DictionaryListPage() {
  const { language: uiLanguage } = useI18n();
  const copy = DICTIONARY_LIST_CATALOGS[uiLanguage];
  const workspace = useStudioWorkspace();
  const params = useParams<{ botId: string; versionId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const botId = typeof params.botId === "string" ? decodeURIComponent(params.botId) : "";
  const versionName = typeof params.versionId === "string" ? decodeURIComponent(params.versionId) : "v1";

  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const sectionFetchKeyRef = useRef("");
  const [authSession, setAuthSession] = useState<AuthSession | null>(workspace.session);
  const [bot, setBot] = useState<StudioBotApiItem | null>(workspace.bot);
  const [versions, setVersions] = useState<StudioBotVersionApiItem[]>(workspace.versions);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [pageSize, setPageSize] = usePersistedPageSize<ListPageSize>(
    "aidot.page_size.dictionary.list",
    10,
    LIST_PAGE_SIZE_OPTIONS,
  );
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadDialogState | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  useEffect(() => {
    setAuthSession(workspace.session);
    setVersions(workspace.versions);
    setBot(workspace.bot);
    setLoading(false);
    setErrorMessage("");
  }, [workspace.bot, workspace.session, workspace.versions]);

  useEffect(() => {
    const version = bot?.active_version;
    if (!authSession || !bot || !version) {
      return;
    }

    const fetchKey = `${bot.id}:${version.id}`;
    if (sectionFetchKeyRef.current === fetchKey && Array.isArray(version.version_json?.dictionary)) {
      return;
    }
    sectionFetchKeyRef.current = fetchKey;

    let ignore = false;
    setLoading(true);
    fetchStudioBotVersionDictionary(authSession.access_token, bot.id, version.id)
      .then((response) => {
        if (ignore) {
          return;
        }
        const nextDocument = withUpdatedDictionary(getVersionDocument(version), normalizeVersionDictionary(response.items));
        const updatedVersion: StudioBotVersionApiItem = {
          ...response.version,
          version_json: nextDocument,
          asset_counts: response.asset_counts,
          scenario_validation: response.scenario_validation,
        };
        setBot((current) => (current ? applyUpdatedVersionToDictionaryBot(current, updatedVersion) : current));
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : copy.loadFailed);
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
  }, [authSession, bot, bot?.active_version, copy.loadFailed]);

  useEffect(() => {
    if (pathname && bot && !errorMessage) {
      saveLastBotScreen(pathname);
    }
  }, [pathname, bot, errorMessage]);

  if (!loading && !authSession) {
    return null;
  }

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!actionMenuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [menuOpen]);

  const effectiveBotId = bot?.id ?? botId;
  const effectiveVersion = bot?.active_version ?? versions.find((version) => version.name === versionName || version.id === versionName) ?? null;
  const effectiveVersionName = effectiveVersion?.name ?? versionName;
  const dictionary = useMemo(() => getVersionDictionary(effectiveVersion), [effectiveVersion]);
  const userDictionary = useMemo(() => getVersionUserDictionary(effectiveVersion), [effectiveVersion]);
  const dictionaryCountForSummary = Array.isArray(effectiveVersion?.version_json?.dictionary) ? userDictionary.length : undefined;
  const userEntityCountForSummary = useMemo(
    () => Array.isArray(effectiveVersion?.version_json?.entities) ? getVersionUserEntities(effectiveVersion).length : undefined,
    [effectiveVersion],
  );
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
      setErrorMessage(error instanceof Error ? error.message : copy.reloadFailed);
    }
  }
  const summaryCards = useMemo(
    () => buildSummaryCards(effectiveBotId, effectiveVersionName, bot, dictionaryCountForSummary, userEntityCountForSummary, copy),
    [bot, copy, dictionaryCountForSummary, effectiveBotId, effectiveVersionName, userEntityCountForSummary],
  );
  const visibleEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? dictionary.filter((entry) => {
          const haystack = [entry.word, ...entry.synonyms].join(" ").toLowerCase();
          return haystack.includes(normalizedQuery);
        })
      : dictionary;

    return [...filtered].sort((left, right) => {
      const leftValue = (() => {
        switch (sortKey) {
          case "synonym":
            return getDictionaryPreviewValue(left);
          case "synonymCount":
            return String(normalizeDictionarySynonyms(left.synonyms).length).padStart(6, "0");
          case "intent":
            return left.intentEnabled ? "1" : "0";
          case "updated":
            return left.updatedAt;
          case "updatedBy":
            return left.updatedBy;
          case "word":
          default:
            return left.word;
        }
      })().toLowerCase();

      const rightValue = (() => {
        switch (sortKey) {
          case "synonym":
            return getDictionaryPreviewValue(right);
          case "synonymCount":
            return String(normalizeDictionarySynonyms(right.synonyms).length).padStart(6, "0");
          case "intent":
            return right.intentEnabled ? "1" : "0";
          case "updated":
            return right.updatedAt;
          case "updatedBy":
            return right.updatedBy;
          case "word":
          default:
            return right.word;
        }
      })().toLowerCase();

      if (leftValue === rightValue) {
        return 0;
      }

      const compare = leftValue > rightValue ? 1 : -1;
      return sortDirection === "asc" ? compare : compare * -1;
    });
  }, [dictionary, query, sortDirection, sortKey]);

  const selectedEntries = useMemo(
    () => dictionary.filter((entry) => selectedIds.includes(entry.id)),
    [dictionary, selectedIds],
  );
  const selectedIntentStateIsUniform =
    selectedEntries.length > 0 &&
    selectedEntries.every((entry) => entry.intentEnabled === selectedEntries[0]?.intentEnabled);
  const canEnableIntent =
    selectedIntentStateIsUniform &&
    selectedEntries.length > 0 &&
    selectedEntries.every((entry) => !entry.intentEnabled);
  const canDisableIntent =
    selectedIntentStateIsUniform &&
    selectedEntries.length > 0 &&
    selectedEntries.every((entry) => entry.intentEnabled);
  const totalPages = Math.max(1, Math.ceil(visibleEntries.length / pageSize));
  const pagedEntries = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleEntries.slice(start, start + pageSize);
  }, [page, pageSize, visibleEntries]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, query, sortDirection, sortKey]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection("asc");
  }

    async function persistDictionary(nextDictionary: ReturnType<typeof getVersionDictionary>, successMessage: string) {
      if (!authSession || !bot?.active_version) {
        router.replace("/login");
        return;
      }

    setSaving(true);
    setErrorMessage("");
    setMessage("");

    try {
      const nextDocument = withUpdatedDictionary(getVersionDocument(effectiveVersion), nextDictionary);
      const response = await updateStudioBotVersionDictionary(
        authSession.access_token,
        bot.id,
        bot.active_version.id,
        nextDocument.dictionary,
      );
      const updatedVersion: StudioBotVersionApiItem = {
        ...response.version,
        version_json: nextDocument,
        asset_counts: response.asset_counts,
        scenario_validation: response.scenario_validation,
      };
      setBot((current) => (current ? applyUpdatedVersionToDictionaryBot(current, updatedVersion) : current));
      void workspace.refresh();
      setSelectedIds([]);
      setPage(1);
      setMessage(successMessage);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : copy.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.length === 0) {
      return;
    }

    await persistDictionary(
      dictionary.filter((entry) => !selectedIds.includes(entry.id)),
      copy.deleteSuccess,
    );
  }

  async function updateEntryUsage(entryId: string, field: DictionaryUsageField, value: boolean) {
    const target = dictionary.find((entry) => entry.id === entryId);
    if (!target) {
      return;
    }

    const usageLabel = copy.usageLabel;
    await persistDictionary(
      dictionary.map((entry) => (entry.id === entryId ? { ...entry, [field]: value } : entry)),
      formatDictionaryListText(copy.usageChanged, { label: usageLabel }),
    );
  }

  async function updateSelectedUsage(field: DictionaryUsageField, value: boolean) {
    if (selectedEntries.length === 0) {
      return;
    }

    const nextIds = new Set(selectedEntries.map((entry) => entry.id));
    const usageLabel = copy.usageLabel;
    await persistDictionary(
      dictionary.map((entry) => (nextIds.has(entry.id) ? { ...entry, [field]: value } : entry)),
      formatDictionaryListText(copy.selectedUsageChanged, { count: selectedEntries.length, label: usageLabel }),
    );
  }

    async function handleUploadFile(file: File) {
      if (!authSession) {
        router.replace("/login");
        return;
      }

    try {
      const text = await file.text();
      const importedRows = parseDictionaryImportRows(text);
      if (importedRows.length === 0) {
        setErrorMessage(copy.noUploadable);
        return;
      }

      const now = new Date().toISOString();
      const counts = createEmptyDictionaryUploadCounts();
      const touchedWords = new Set<string>();
      const touchedWordOrder: string[] = [];
      const duplicateWords = new Set<string>();
      const nextEntriesByWord = new Map(
        dictionary.map((entry) => [normalizeDictionaryWord(entry.word), structuredClone(entry)]),
      );
      const representativeOwners = new Map<string, string>();
      const synonymOwners = new Map<string, string>();

      for (const entry of nextEntriesByWord.values()) {
        const normalizedWord = normalizeDictionaryWord(entry.word);
        representativeOwners.set(normalizedWord, normalizedWord);
        for (const synonym of normalizeDictionarySynonyms(entry.synonyms)) {
          synonymOwners.set(synonym, normalizedWord);
        }
      }

      for (const row of importedRows) {
        const normalizedWord = normalizeDictionaryWord(row.word);
        const normalizedSynonym = row.synonym.trim();

        if (!normalizedWord) {
          continue;
        }

        if (normalizedWord.length > 100) {
          counts.overLengthWords += 1;
          continue;
        }

        const synonymOwner = synonymOwners.get(normalizedWord);
        if (synonymOwner && synonymOwner !== normalizedWord) {
          counts.duplicateWords += 1;
          continue;
        }

        let target = nextEntriesByWord.get(normalizedWord);
        if (!target) {
          target = {
            id: crypto.randomUUID(),
            word: normalizedWord,
            synonyms: [],
            intentEnabled: true,
            qaEnabled: false,
            domainCandidate: false,
            domainEnabled: false,
            updatedAt: now,
            updatedBy: authSession.user.login_id,
          };
          nextEntriesByWord.set(normalizedWord, target);
          representativeOwners.set(normalizedWord, normalizedWord);
          counts.addedWords += 1;
          touchedWords.add(normalizedWord);
          if (!touchedWordOrder.includes(normalizedWord)) {
            touchedWordOrder.push(normalizedWord);
          }
        } else if (!duplicateWords.has(normalizedWord)) {
          counts.duplicateWords += 1;
          duplicateWords.add(normalizedWord);
        }

        if (!normalizedSynonym) {
          continue;
        }

        if (normalizedSynonym.length > 100) {
          counts.overLengthSynonyms += 1;
          continue;
        }

        if (representativeOwners.has(normalizedSynonym) && normalizedSynonym !== normalizedWord) {
          counts.duplicateSynonyms += 1;
          continue;
        }

        const existingSynonymOwner = synonymOwners.get(normalizedSynonym);
        if (existingSynonymOwner && existingSynonymOwner !== normalizedWord) {
          counts.duplicateSynonyms += 1;
          continue;
        }

        if (target.synonyms.includes(normalizedSynonym)) {
          counts.duplicateSynonyms += 1;
          continue;
        }

        if (target.synonyms.length >= 500) {
          continue;
        }

        target.synonyms.push(normalizedSynonym);
        synonymOwners.set(normalizedSynonym, normalizedWord);
        counts.addedSynonyms += 1;
        touchedWords.add(normalizedWord);
        if (!touchedWordOrder.includes(normalizedWord)) {
          touchedWordOrder.push(normalizedWord);
        }
      }

      const touchedWordSet = new Set(touchedWordOrder);
      const orderedEntries = [
        ...touchedWordOrder
          .map((word) => nextEntriesByWord.get(word))
          .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined),
        ...[...nextEntriesByWord.entries()]
          .filter(([word]) => !touchedWordSet.has(word))
          .map(([, entry]) => entry),
      ];

      const nextDictionary = orderedEntries.map((entry) =>
        touchedWords.has(normalizeDictionaryWord(entry.word))
          ? {
              ...entry,
              updatedAt: now,
              updatedBy: authSession.user.login_id,
            }
          : entry,
      );

      const validationError = validateDictionaryEntries(nextDictionary);
      if (validationError) {
        setErrorMessage(validationError);
        return;
      }

      await persistDictionary(nextDictionary, copy.uploadSuccess);
      setUploadResult(buildDictionaryUploadDialog(counts, copy));
    } catch {
      setErrorMessage(copy.uploadReadFailed);
    }
  }

  function handleDownload() {
    const blob = new Blob([buildDictionaryText(dictionary)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildDictionaryExportName(bot);
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleTemplateDownload() {
    const blob = new Blob([buildDictionaryText([])], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Dictionary_양식.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!bot || !effectiveVersion) {
    return <StudioPageLoading title={copy.pageLoading} />;
  }

  return (
    <section className="manual-main manual-main--dictionary-asset">

      {errorMessage ? <p className="form-message form-message--error">{errorMessage}</p> : null}
      {message ? <p className="form-message form-message--success">{message}</p> : null}

      <div className="manual-main__toolbar">
        <div className="manual-main__toolbar-left">
          <label className="manual-main__search manual-main__search--wide">
            <span aria-hidden="true">⌕</span>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
            />
          </label>
          <button type="button" className="manual-main__icon-button" aria-label={copy.filter}>
            ▾
          </button>
        </div>

        <div className="manual-main__toolbar-right">
          <button type="button" className="manual-main__action-button" onClick={() => setEditingEntryId("new")}>
            {copy.addWord}
          </button>

          <div className="manual-main__menu" ref={actionMenuRef}>
            <button
              type="button"
              className="manual-main__menu-button"
              aria-label={copy.menu}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((current) => !current)}
            >
              ⋮
            </button>

            {menuOpen ? (
              <div className="manual-main__menu-popover manual-main__menu-popover--toolbar">
                <button
                  type="button"
                  className="manual-main__menu-item manual-main__menu-item--button"
                  onClick={() => {
                    setMenuOpen(false);
                    setUploadDialogOpen(true);
                  }}
                >
                  {copy.uploadFile}
                </button>
                <button
                  type="button"
                  className="manual-main__menu-item manual-main__menu-item--button"
                  onClick={() => {
                    setMenuOpen(false);
                    handleDownload();
                  }}
                >
                  {copy.downloadFile}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="manual-main__toolbar manual-main__toolbar--secondary">
        <div className="manual-main__toolbar-left">
          <div className="manual-main__toolbar-group manual-main__toolbar-group--meta">
            <strong>{formatDictionaryListText(copy.totalCount, { count: dictionary.length })}</strong>
            <label className="manual-main__mini-select manual-main__mini-select--select">
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as ListPageSize)}>
                <option value={10}>{formatDictionaryListText(copy.pageSize, { count: 10 })}</option>
                <option value={25}>{formatDictionaryListText(copy.pageSize, { count: 25 })}</option>
                <option value={50}>{formatDictionaryListText(copy.pageSize, { count: 50 })}</option>
                <option value={100}>{formatDictionaryListText(copy.pageSize, { count: 100 })}</option>
                </select>
              </label>
            </div>
            {selectedIds.length > 0 ? <span className="studio-table-page__selection">{formatDictionaryListText(copy.selectedCount, { count: selectedIds.length })}</span> : null}
          </div>
          <div className="manual-main__toolbar-right">
            <div className="manual-main__toolbar-group manual-main__toolbar-group--actions">
              <button
                type="button"
                className="manual-main__ghost-button"
                disabled={selectedIds.length === 0 || saving}
                onClick={() => void handleDeleteSelected()}
              >
                {copy.delete}
              </button>
              <button
                type="button"
                className="manual-main__ghost-button"
                disabled={!canEnableIntent || saving}
                onClick={() => void updateSelectedUsage("intentEnabled", true)}
              >
                {copy.enableIntent}
              </button>
              <button
                type="button"
                className="manual-main__ghost-button"
                disabled={!canDisableIntent || saving}
                onClick={() => void updateSelectedUsage("intentEnabled", false)}
              >
                {copy.disableIntent}
              </button>
            </div>
          </div>
        </div>

      <div className="manual-main__table manual-main__table--dictionary">
        <div className="manual-main__table-header manual-main__table-header--dictionary">
          <span className="manual-main__cell manual-main__cell--check">
            <input
              type="checkbox"
              aria-label={copy.selectAll}
              checked={pagedEntries.length > 0 && pagedEntries.every((entry) => selectedIds.includes(entry.id))}
              onChange={(event) =>
                setSelectedIds(event.target.checked ? pagedEntries.map((entry) => entry.id) : [])
              }
            />
          </span>
          <span className="manual-main__cell">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("word")}>
              <SortHeaderLabel label={copy.columns.word} direction={sortKey === "word" ? sortDirection : "none"} />
            </button>
          </span>
          <span className="manual-main__cell">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("synonym")}>
              <SortHeaderLabel label={copy.columns.synonym} direction={sortKey === "synonym" ? sortDirection : "none"} />
            </button>
          </span>
          <span className="manual-main__cell">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("synonymCount")}>
              <SortHeaderLabel label={copy.columns.synonymCount} direction={sortKey === "synonymCount" ? sortDirection : "none"} />
            </button>
          </span>
          <span className="manual-main__cell">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("intent")}>
              <SortHeaderLabel label={copy.columns.intentUsage} direction={sortKey === "intent" ? sortDirection : "none"} />
            </button>
          </span>
          <span className="manual-main__cell">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("updated")}>
              <SortHeaderLabel label={copy.columns.updatedAt} direction={sortKey === "updated" ? sortDirection : "none"} />
            </button>
          </span>
          <span className="manual-main__cell">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("updatedBy")}>
              <SortHeaderLabel label={copy.columns.updatedBy} direction={sortKey === "updatedBy" ? sortDirection : "none"} />
            </button>
          </span>
        </div>

        {pagedEntries.map((entry) => (
          <div key={entry.id} className="manual-main__table-row manual-main__table-row--dictionary">
            <span className="manual-main__cell manual-main__cell--check">
              <input
                type="checkbox"
                aria-label={formatDictionaryListText(copy.selectRow, { word: entry.word })}
                checked={selectedIds.includes(entry.id)}
                onChange={() =>
                  setSelectedIds((current) =>
                    current.includes(entry.id) ? current.filter((id) => id !== entry.id) : [...current, entry.id],
                  )
                }
              />
            </span>
            <span className="manual-main__cell">
              <button type="button" className="manual-main__link-button" onClick={() => setEditingEntryId(entry.id)}>
                {entry.word}
              </button>
            </span>
            <span className="manual-main__cell">{getDictionaryPreviewValue(entry)}</span>
            <span className="manual-main__cell">{normalizeDictionarySynonyms(entry.synonyms).length}</span>
            <span className="manual-main__cell">
              <button
                type="button"
                className={`table-toggle${entry.intentEnabled ? " is-active" : ""}`}
                disabled={saving}
                onClick={() => void updateEntryUsage(entry.id, "intentEnabled", !entry.intentEnabled)}
              >
                {entry.intentEnabled ? copy.enabled : copy.disabled}
              </button>
            </span>
            <span className="manual-main__cell">{formatDictionaryUpdatedAt(entry)}</span>
            <span className="manual-main__cell">{entry.updatedBy || "-"}</span>
          </div>
        ))}

        {!loading && pagedEntries.length === 0 ? (
          <div className="manual-main__table-row manual-main__table-row--dictionary manual-main__table-row--empty">
            <span className="manual-main__cell manual-main__cell--check" />
            <span className="manual-main__cell manual-main__cell--empty-message">
              {query.trim()
                ? copy.noSearchResults
                : copy.empty}
            </span>
          </div>
        ) : null}
      </div>

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
        <button type="button" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
          ›
        </button>
        <button type="button" disabled={page === totalPages} onClick={() => setPage(totalPages)}>
          »
        </button>
      </div>

      <SimulatorFloatingLauncher />

      {bot && authSession && editingEntryId ? (
        <DictionaryEditorDialog
          authSession={authSession}
          bot={bot}
          entry={editingEntryId === "new" ? null : dictionary.find((item) => item.id === editingEntryId) ?? null}
          onClose={() => setEditingEntryId(null)}
          onSaved={(nextBot, successMessage) => {
            setBot(nextBot);
            void workspace.refresh();
            setSelectedIds([]);
            setPage(1);
            setMessage(successMessage);
            setErrorMessage("");
            setEditingEntryId(null);
          }}
        />
      ) : null}

      {uploadDialogOpen ? (
        <AssetUploadDialog
          title={copy.uploadTitle}
          description={copy.uploadDescription}
          notice={
            <>
              <p>{copy.uploadEncodingHelp}</p>
              <ul className="asset-upload-dialog__list">
                <li>{copy.uploadCsvHelp}</li>
                <li>{copy.uploadSynonymHelp}</li>
                <li>{copy.uploadLimitHelp}</li>
              </ul>
            </>
          }
          exampleTitle={copy.example}
          exampleLines={[
            "대표어,유의어1,유의어2",
            "갤럭시노트9,갤노트9,갤노트나인,갤럭시노트나인",
            "갤럭시s10,갤스10,갤스텐,갤럭시에스텐",
            "새시대건강보험파트너,새건파,새시대건강파트너약관,새건파약관",
          ]}
          accept=".txt,.csv"
          templateFileName="Dictionary_양식.txt"
          onDownloadTemplate={handleTemplateDownload}
          onClose={() => setUploadDialogOpen(false)}
          onConfirm={(file) => {
            setUploadDialogOpen(false);
            return handleUploadFile(file);
          }}
        />
      ) : null}

      {uploadResult ? (
        <UploadResultDialog
          title={uploadResult.title}
          message={uploadResult.message}
          note={uploadResult.note}
          sections={uploadResult.sections}
          onClose={() => setUploadResult(null)}
        />
      ) : null}
    </section>
  );
}
