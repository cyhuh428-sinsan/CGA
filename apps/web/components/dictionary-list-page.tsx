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
import {
  UploadResultDialog,
  type UploadResultSection,
} from "@/components/upload-result-dialog";
import { saveLastBotScreen, type AuthSession } from "@/lib/auth";
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
      label: "의도",
      value: String(intentCount),
      href: buildVersionAssetHref(botId, versionName, "intents"),
    },
    {
      label: "구성",
      value: "-",
      href: buildVersionAssetHref(botId, versionName, "configure"),
    },
    {
      label: "개체",
      value: String(entityCount === undefined ? (counts?.entities ?? "-") : entityCount),
      href: buildVersionAssetHref(botId, versionName, "entities"),
    },
    {
      label: "사전",
      value: String(activeDictionaryCount),
      active: true,
      href: buildVersionAssetHref(botId, versionName, "dictionary"),
    },
    {
      label: "평가",
      value: "-",
      href: buildVersionAssetHref(botId, versionName, "evaluation"),
    },
    {
      label: "재학습",
      value: String(retrainingCount),
      href: buildVersionAssetHref(botId, versionName, "retraining"),
    },
    {
      label: "분석",
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

function buildDictionaryUploadDialog(counts: DictionaryUploadCounts): UploadDialogState {
  return {
    title: "업로드 결과",
    message: "등록이 완료되었습니다.",
    note: "단, 중복되거나 100자 초과 단어는 등록되지 않습니다. 동의어 개수 초과 시 최대 개수(500개)까지만 등록됩니다.",
    sections: [
      {
        rows: [
          { label: "추가된 단어", value: counts.addedWords },
          { label: "추가된 동의어", value: counts.addedSynonyms },
        ],
      },
      {
        rows: [
          { label: "중복된 단어", value: counts.duplicateWords },
          { label: "중복된 동의어", value: counts.duplicateSynonyms },
          { label: "100자를 초과하는 단어", value: counts.overLengthWords },
          { label: "100자를 초과하는 동의어", value: counts.overLengthSynonyms },
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
          setErrorMessage(error instanceof Error ? error.message : "사전 정보를 불러오지 못했습니다.");
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
      setErrorMessage(error instanceof Error ? error.message : "학습 결과를 다시 불러오지 못했습니다.");
    }
  }
  const summaryCards = useMemo(
    () => buildSummaryCards(effectiveBotId, effectiveVersionName, bot, dictionaryCountForSummary, userEntityCountForSummary),
    [bot, dictionaryCountForSummary, effectiveBotId, effectiveVersionName, userEntityCountForSummary],
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
      setErrorMessage(error instanceof Error ? error.message : "사전 저장 중 오류가 발생했습니다.");
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
      "선택한 사전이 삭제되었습니다.",
    );
  }

  async function updateEntryUsage(entryId: string, field: DictionaryUsageField, value: boolean) {
    const target = dictionary.find((entry) => entry.id === entryId);
    if (!target) {
      return;
    }

    const usageLabel = "의도 사용여부";
    await persistDictionary(
      dictionary.map((entry) => (entry.id === entryId ? { ...entry, [field]: value } : entry)),
      `${usageLabel} 변경에 성공하였습니다.`,
    );
  }

  async function updateSelectedUsage(field: DictionaryUsageField, value: boolean) {
    if (selectedEntries.length === 0) {
      return;
    }

    const nextIds = new Set(selectedEntries.map((entry) => entry.id));
    const usageLabel = "의도 사용여부";
    await persistDictionary(
      dictionary.map((entry) => (nextIds.has(entry.id) ? { ...entry, [field]: value } : entry)),
      `${selectedEntries.length}건의 ${usageLabel}를 변경했습니다.`,
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
        setErrorMessage("업로드 가능한 사전이 없습니다.");
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

      await persistDictionary(nextDictionary, "사전 업로드가 완료되었습니다.");
      setUploadResult(buildDictionaryUploadDialog(counts));
    } catch {
      setErrorMessage("사전 업로드 파일을 읽지 못했습니다.");
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
    return <StudioPageLoading title="사전 화면을 불러오는 중입니다." />;
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
              placeholder="단어 또는 동의어를 검색하세요."
            />
          </label>
          <button type="button" className="manual-main__icon-button" aria-label="필터">
            ▾
          </button>
        </div>

        <div className="manual-main__toolbar-right">
          <button type="button" className="manual-main__action-button" onClick={() => setEditingEntryId("new")}>
            + 단어 추가
          </button>

          <div className="manual-main__menu" ref={actionMenuRef}>
            <button
              type="button"
              className="manual-main__menu-button"
              aria-label="사전 메뉴"
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
                  파일 업로드
                </button>
                <button
                  type="button"
                  className="manual-main__menu-item manual-main__menu-item--button"
                  onClick={() => {
                    setMenuOpen(false);
                    handleDownload();
                  }}
                >
                  파일 다운로드
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="manual-main__toolbar manual-main__toolbar--secondary">
        <div className="manual-main__toolbar-left">
          <div className="manual-main__toolbar-group manual-main__toolbar-group--meta">
            <strong>전체 {dictionary.length}건</strong>
            <label className="manual-main__mini-select manual-main__mini-select--select">
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as ListPageSize)}>
                <option value={10}>10개씩 보기</option>
                <option value={25}>25개씩 보기</option>
                <option value={50}>50개씩 보기</option>
                <option value={100}>100개씩 보기</option>
                </select>
              </label>
            </div>
            {selectedIds.length > 0 ? <span className="studio-table-page__selection">{selectedIds.length}개 선택</span> : null}
          </div>
          <div className="manual-main__toolbar-right">
            <div className="manual-main__toolbar-group manual-main__toolbar-group--actions">
              <button
                type="button"
                className="manual-main__ghost-button"
                disabled={selectedIds.length === 0 || saving}
                onClick={() => void handleDeleteSelected()}
              >
                삭제
              </button>
              <button
                type="button"
                className="manual-main__ghost-button"
                disabled={!canEnableIntent || saving}
                onClick={() => void updateSelectedUsage("intentEnabled", true)}
              >
                의도 사용
              </button>
              <button
                type="button"
                className="manual-main__ghost-button"
                disabled={!canDisableIntent || saving}
                onClick={() => void updateSelectedUsage("intentEnabled", false)}
              >
                의도 미사용
              </button>
            </div>
          </div>
        </div>

      <div className="manual-main__table manual-main__table--dictionary">
        <div className="manual-main__table-header manual-main__table-header--dictionary">
          <span className="manual-main__cell manual-main__cell--check">
            <input
              type="checkbox"
              aria-label="전체 선택"
              checked={pagedEntries.length > 0 && pagedEntries.every((entry) => selectedIds.includes(entry.id))}
              onChange={(event) =>
                setSelectedIds(event.target.checked ? pagedEntries.map((entry) => entry.id) : [])
              }
            />
          </span>
          <span className="manual-main__cell">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("word")}>
              <SortHeaderLabel label="단어" direction={sortKey === "word" ? sortDirection : "none"} />
            </button>
          </span>
          <span className="manual-main__cell">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("synonym")}>
              <SortHeaderLabel label="동의어" direction={sortKey === "synonym" ? sortDirection : "none"} />
            </button>
          </span>
          <span className="manual-main__cell">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("synonymCount")}>
              <SortHeaderLabel label="동의어 개수" direction={sortKey === "synonymCount" ? sortDirection : "none"} />
            </button>
          </span>
          <span className="manual-main__cell">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("intent")}>
              <SortHeaderLabel label="의도 사용여부" direction={sortKey === "intent" ? sortDirection : "none"} />
            </button>
          </span>
          <span className="manual-main__cell">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("updated")}>
              <SortHeaderLabel label="최종수정일시" direction={sortKey === "updated" ? sortDirection : "none"} />
            </button>
          </span>
          <span className="manual-main__cell">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("updatedBy")}>
              <SortHeaderLabel label="최종수정자" direction={sortKey === "updatedBy" ? sortDirection : "none"} />
            </button>
          </span>
        </div>

        {pagedEntries.map((entry) => (
          <div key={entry.id} className="manual-main__table-row manual-main__table-row--dictionary">
            <span className="manual-main__cell manual-main__cell--check">
              <input
                type="checkbox"
                aria-label={`${entry.word} 선택`}
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
                {entry.intentEnabled ? "사용" : "미사용"}
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
                ? "검색 조건에 맞는 사전이 없습니다."
                : "등록된 사전이 없습니다. 먼저 단어를 추가해주세요."}
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
          title="파일 업로드"
          description="아래의 버튼으로 양식(.txt)을 다운받으신 후, 파일을 업로드 하세요."
          notice={
            <>
              <p>UTF-8 형식으로 인코딩된 .txt/.csv 파일을 통해 사전을 한번에 업로드 할 수 있습니다.</p>
              <ul className="asset-upload-dialog__list">
                <li>쉼표(,)로 구분하는 CSV 형식을 사용하세요.</li>
                <li>동의어는 필수값이 아닙니다. 대표어만 입력도 가능합니다.</li>
                <li>단어 길이는 100자로 제한하며, 동의어 개수는 최대 500개까지 허용합니다.</li>
              </ul>
            </>
          }
          exampleTitle="예시"
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
