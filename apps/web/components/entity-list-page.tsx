"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { AssetUploadDialog } from "@/components/asset-upload-dialog";
import { EntityNameDialog } from "@/components/entity-name-dialog";
import { EntityEditorDialog } from "@/components/entity-editor-dialog";
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
  buildEntityText,
  parseEntityImportRows,
} from "@/lib/asset-text-format";
import {
  applyUpdatedVersionToBot,
  findEntityUsageReferences,
  formatEntityUpdatedAt,
  getBotUserEntities,
  getBotVersionDocument,
  getEntityPreviewValue,
  getEntityTypeLabel,
  getVersionDocument,
  getVersionEntities,
  getVersionUserEntities,
  withUpdatedEntities,
} from "@/lib/entity-assets";
import {
  getScenarioTrainingDisabledReason,
  fetchStudioBotVersionEntities,
  fetchStudioBotVersionReferences,
  refreshStudioBotSelectedVersion,
  type StudioBotApiItem,
  type StudioBotVersionApiItem,
  updateStudioBotVersionEntities,
} from "@/lib/studio-bots-api";
import {
  normalizeVersionDialogs,
  normalizeVersionDocument,
  normalizeVersionEntities,
  type VersionDocument,
} from "@/lib/version-document";
import {
  LIST_PAGE_SIZE_OPTIONS,
  type ListPageSize,
  usePersistedPageSize,
} from "@/lib/use-persisted-page-size";

type SortKey = "category" | "name" | "value" | "updated" | "updatedBy";
type EntityUploadCounts = {
  addedEntityNames: number;
  addedEntityValues: number;
  addedDetails: number;
  duplicateEntityNames: number;
  duplicateEntityValues: number;
  duplicateDetails: number;
  invalidDetailTypes: number;
  maxPatternCountExceeded: number;
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
  const activeEntityCount = entityCount === undefined ? (counts?.entities ?? "-") : entityCount;
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
      value: String(activeEntityCount),
      active: true,
      href: buildVersionAssetHref(botId, versionName, "entities"),
    },
    {
      label: "사전",
      value: String(counts?.dictionary ?? "-"),
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

function stampImportedEntityName(name: string) {
  return name.trim();
}

function cloneEntityMap(entities: ReturnType<typeof getBotUserEntities>) {
  return new Map(
    entities.map((entity) => [
      stampImportedEntityName(entity.name),
      structuredClone(entity),
    ]),
  );
}

function createEmptyEntityUploadCounts(): EntityUploadCounts {
  return {
    addedEntityNames: 0,
    addedEntityValues: 0,
    addedDetails: 0,
    duplicateEntityNames: 0,
    duplicateEntityValues: 0,
    duplicateDetails: 0,
    invalidDetailTypes: 0,
    maxPatternCountExceeded: 0,
  };
}

function buildEntityUploadResultDialog(counts: EntityUploadCounts): UploadDialogState {
  return {
    title: "업로드 결과",
    message: "업로드가 완료되었습니다.",
    sections: [
      {
        rows: [
          { label: "추가된 개체명", value: counts.addedEntityNames },
          { label: "추가된 개체값", value: counts.addedEntityValues },
          { label: "추가된 동의어/패턴", value: counts.addedDetails },
        ],
      },
      {
        rows: [
          { label: "중복된 개체명", value: counts.duplicateEntityNames },
          { label: "중복된 개체값", value: counts.duplicateEntityValues },
          { label: "중복된 동의어/패턴", value: counts.duplicateDetails },
          { label: "유형이 잘못되어 등록되지 않은 동의어/패턴", value: counts.invalidDetailTypes },
          { label: "Max 값을 초과한 패턴", value: counts.maxPatternCountExceeded },
        ],
      },
    ],
  };
}

export function EntityListPage() {
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
  const [referenceDocument, setReferenceDocument] = useState<VersionDocument>(() => getVersionDocument(workspace.bot.active_version));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [pageSize, setPageSize] = usePersistedPageSize<ListPageSize>(
    "aidot.page_size.entity.list",
    10,
    LIST_PAGE_SIZE_OPTIONS,
  );
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [creatingEntityName, setCreatingEntityName] = useState(false);
  const [editingEntityValueId, setEditingEntityValueId] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadDialogState | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  useEffect(() => {
    setAuthSession(workspace.session);
    setVersions(workspace.versions);
    setBot(workspace.bot);
    setReferenceDocument(getVersionDocument(workspace.bot.active_version));
    setLoading(false);
    setErrorMessage("");
  }, [workspace.bot, workspace.session, workspace.versions]);

  useEffect(() => {
    const version = bot?.active_version;
    if (!authSession || !bot || !version) {
      return;
    }

    const fetchKey = `${bot.id}:${version.id}`;
    if (sectionFetchKeyRef.current === fetchKey && Array.isArray(version.version_json?.entities)) {
      return;
    }
    sectionFetchKeyRef.current = fetchKey;

    let ignore = false;
    setLoading(true);
    fetchStudioBotVersionEntities(authSession.access_token, bot.id, version.id)
      .then((entitiesResponse) => {
        if (ignore) {
          return;
        }
        const baseDocument = normalizeVersionDocument(version.version_json);
        const nextDocument = withUpdatedEntities(baseDocument, normalizeVersionEntities(entitiesResponse.items));
        const updatedVersion: StudioBotVersionApiItem = {
          ...entitiesResponse.version,
          version_json: nextDocument,
          asset_counts: entitiesResponse.asset_counts,
          scenario_validation: entitiesResponse.scenario_validation,
        };
        setReferenceDocument(nextDocument);
        setBot((current) => (current ? applyUpdatedVersionToBot(current, updatedVersion) : current));
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : "개체 정보를 불러오지 못했습니다.");
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
  const entities = useMemo(() => getVersionEntities(effectiveVersion), [effectiveVersion]);
  const userEntities = useMemo(() => getVersionUserEntities(effectiveVersion), [effectiveVersion]);
  const entityCountForSummary = Array.isArray(effectiveVersion?.version_json?.entities) ? userEntities.length : undefined;
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
    () => buildSummaryCards(effectiveBotId, effectiveVersionName, bot, entityCountForSummary),
    [bot, entityCountForSummary, effectiveBotId, effectiveVersionName],
  );
  const visibleEntities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? entities.filter((entity) => {
          const haystack = [
            entity.name,
            getEntityTypeLabel(entity),
            ...entity.rows.map((row) => row.value),
            ...entity.rows.flatMap((row) => row.details),
            ...(entity.examples ?? []),
            entity.standardExpression ?? "",
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(normalizedQuery);
        })
      : entities;

    return [...filtered].sort((left, right) => {
      if (left.system !== right.system) {
        return left.system ? 1 : -1;
      }

      const leftValue = (() => {
        switch (sortKey) {
          case "category":
            return getEntityTypeLabel(left);
          case "value":
            return getEntityPreviewValue(left);
          case "updated":
            return left.updatedAt;
          case "updatedBy":
            return left.updatedBy;
          case "name":
          default:
            return left.name;
        }
      })().toLowerCase();

      const rightValue = (() => {
        switch (sortKey) {
          case "category":
            return getEntityTypeLabel(right);
          case "value":
            return getEntityPreviewValue(right);
          case "updated":
            return right.updatedAt;
          case "updatedBy":
            return right.updatedBy;
          case "name":
          default:
            return right.name;
        }
      })().toLowerCase();

      if (leftValue === rightValue) {
        return 0;
      }

      const compare = leftValue > rightValue ? 1 : -1;
      return sortDirection === "asc" ? compare : compare * -1;
    });
  }, [entities, query, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(visibleEntities.length / pageSize));
  const pagedEntities = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleEntities.slice(start, start + pageSize);
  }, [page, pageSize, visibleEntities]);

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

    async function persistEntities(nextEntities: ReturnType<typeof getVersionEntities>, successMessage: string) {
      if (!authSession || !bot?.active_version) {
        router.replace("/login");
        return;
      }

    setSaving(true);
    setErrorMessage("");
    setMessage("");

    try {
      const response = await updateStudioBotVersionEntities(
        authSession.access_token,
        bot.id,
        bot.active_version.id,
        nextEntities,
      );
      const updatedDocument = withUpdatedEntities(referenceDocument, normalizeVersionEntities(response.items));
      const updatedVersion: StudioBotVersionApiItem = {
        ...response.version,
        version_json: updatedDocument,
        asset_counts: response.asset_counts,
        scenario_validation: response.scenario_validation,
      };
      setBot((current) => (current ? applyUpdatedVersionToBot(current, updatedVersion) : current));
      void workspace.refresh();
      setSelectedIds([]);
      setPage(1);
      setMessage(successMessage);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "개체 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.length === 0) {
      return;
    }

    if (!authSession || !bot?.active_version) {
      router.replace("/login");
      return;
    }

    let versionDocument: VersionDocument;
    try {
      const references = await fetchStudioBotVersionReferences(authSession.access_token, bot.id, bot.active_version.id);
      versionDocument = {
        ...referenceDocument,
        dialogs: normalizeVersionDialogs(references.dialogs),
        dialog_flow_graphs: references.dialog_flow_graphs,
        rules: references.rules,
      };
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "개체 삭제 전 버전 정보를 불러오지 못했습니다.");
      return;
    }

    const selectedEntities = entities.filter((entity) => selectedIds.includes(entity.id));
    const blockedEntities = selectedEntities
      .map((entity) => ({
        entity,
        usages: findEntityUsageReferences(versionDocument, entity),
      }))
      .filter((item) => item.usages.length > 0);

    if (blockedEntities.length > 0) {
      setMessage("");
      setErrorMessage(
        blockedEntities
          .map(
            ({ entity, usages }) =>
              `'${entity.name}' 사용자 개체는 ${usages.join(", ")}에서 사용하고 있어 삭제할 수 없습니다.`,
          )
          .join(" "),
      );
      return;
    }

    await persistEntities(
      entities.filter((entity) => !selectedIds.includes(entity.id)),
      "선택한 개체가 삭제되었습니다.",
    );
  }

    async function handleUploadFile(file: File) {
      if (!authSession) {
        router.replace("/login");
        return;
      }

    try {
      const text = await file.text();
      const parsedRows = parseEntityImportRows(text);
      if (parsedRows.length === 0) {
        setErrorMessage("업로드 가능한 개체가 없습니다.");
        return;
      }

      const nextEntitiesMap = cloneEntityMap(userEntities);
      const counts = createEmptyEntityUploadCounts();
      const touchedEntityNames = new Set<string>();
      const touchedEntityOrder: string[] = [];
      const duplicateEntityNameSet = new Set<string>();
      const now = new Date().toISOString();

      for (const row of parsedRows) {
        const normalizedName = stampImportedEntityName(row.name);
        const normalizedValue = row.value.trim();
        const normalizedType = row.rowType.trim().toUpperCase();
        const normalizedDetail = row.detail.trim();

        if (!normalizedName || !normalizedValue) {
          continue;
        }

        if (normalizedType !== "S" && normalizedType !== "P") {
          counts.invalidDetailTypes += 1;
          continue;
        }

        const detailValues =
          normalizedType === "P"
            ? normalizedDetail
              ? [normalizedDetail]
              : []
            : normalizedDetail
              ? normalizedDetail
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              : [];

        if (normalizedType === "P" && detailValues.length === 0) {
          counts.invalidDetailTypes += 1;
          continue;
        }

        const hasExistingEntity = nextEntitiesMap.has(normalizedName);
        let nextEntity = nextEntitiesMap.get(normalizedName);

        if (!nextEntity) {
          nextEntity = {
            id: crypto.randomUUID(),
            name: normalizedName,
            system: false,
            intentEnabled: true,
            qaEnabled: false,
            rows: [],
            updatedAt: now,
            updatedBy: authSession.user.login_id,
          };
          nextEntitiesMap.set(normalizedName, nextEntity);
          counts.addedEntityNames += 1;
        } else if (hasExistingEntity && !duplicateEntityNameSet.has(normalizedName)) {
          counts.duplicateEntityNames += 1;
          duplicateEntityNameSet.add(normalizedName);
        }

        let nextRow = nextEntity.rows.find((item) => item.value === normalizedValue);
        if (!nextRow) {
          nextRow = {
            id: crypto.randomUUID(),
            value: normalizedValue,
            rowType: normalizedType,
            details: [],
          };
          nextEntity.rows.unshift(nextRow);
          counts.addedEntityValues += 1;
          touchedEntityNames.add(normalizedName);
          if (!touchedEntityOrder.includes(normalizedName)) {
            touchedEntityOrder.push(normalizedName);
          }
        } else {
          if (nextRow.rowType !== normalizedType) {
            counts.invalidDetailTypes += 1;
            continue;
          }
          counts.duplicateEntityValues += 1;
        }

        for (const detail of detailValues) {
          if (!detail) {
            continue;
          }

          if (normalizedType === "P" && detail.length > 256) {
            counts.maxPatternCountExceeded += 1;
            continue;
          }

          if (nextRow.details.includes(detail)) {
            counts.duplicateDetails += 1;
            continue;
          }

          if (normalizedType === "P" && nextRow.details.length >= 5) {
            counts.maxPatternCountExceeded += 1;
            continue;
          }

          nextRow.details.push(detail);
          counts.addedDetails += 1;
          touchedEntityNames.add(normalizedName);
          if (!touchedEntityOrder.includes(normalizedName)) {
            touchedEntityOrder.push(normalizedName);
          }
        }
      }

      const touchedEntitySet = new Set(touchedEntityOrder);
      const orderedEntities = [
        ...touchedEntityOrder
          .map((name) => nextEntitiesMap.get(name))
          .filter((entity): entity is NonNullable<typeof entity> => entity !== undefined),
        ...[...nextEntitiesMap.entries()]
          .filter(([name]) => !touchedEntitySet.has(name))
          .map(([, entity]) => entity),
      ];

      const nextEntities = orderedEntities.map((entity) =>
        touchedEntityNames.has(stampImportedEntityName(entity.name))
          ? {
              ...entity,
              updatedAt: now,
              updatedBy: authSession.user.login_id,
            }
          : entity,
      );

      await persistEntities(nextEntities, "개체 업로드가 완료되었습니다.");
      setUploadResult(buildEntityUploadResultDialog(counts));
    } catch {
      setErrorMessage("개체 업로드 파일을 읽지 못했습니다.");
    }
  }

  function handleDownload() {
    const blob = new Blob([buildEntityText(userEntities)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildAssetExportFilename("Entity", bot?.name ?? "Entity");
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleTemplateDownload() {
    const blob = new Blob([buildEntityText([])], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Entity_양식.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!bot || !effectiveVersion) {
    return <StudioPageLoading title="개체 화면을 불러오는 중입니다." />;
  }

  return (
    <section className="manual-main manual-main--entity-asset">

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
              placeholder="개체명, 개체값, 정규식 또는 패턴을 검색하세요."
            />
          </label>
          <button type="button" className="manual-main__icon-button" aria-label="필터">
            ▾
          </button>
        </div>

        <div className="manual-main__toolbar-right">
          <button type="button" className="manual-main__action-button" onClick={() => setCreatingEntityName(true)}>
            + 개체명 추가
          </button>

          <div className="manual-main__menu" ref={actionMenuRef}>
            <button
              type="button"
              className="manual-main__menu-button"
              aria-label="개체 메뉴"
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
            <strong>전체 {userEntities.length}건</strong>
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
          <button
            type="button"
            className="manual-main__ghost-button"
            disabled={selectedIds.length === 0 || saving}
            onClick={() => void handleDeleteSelected()}
          >
            삭제
          </button>
        </div>
      </div>

      <div className="manual-main__table manual-main__table--entity">
        <div className="manual-main__table-header manual-main__table-header--entity">
          <span className="manual-main__cell manual-main__cell--check">
            <input
              type="checkbox"
              aria-label="전체 선택"
                    checked={
                      pagedEntities.filter((entity) => !entity.system).length > 0 &&
                      pagedEntities
                        .filter((entity) => !entity.system)
                        .every((entity) => selectedIds.includes(entity.id))
                    }
                  onChange={(event) =>
                    setSelectedIds(
                      event.target.checked
                        ? pagedEntities.filter((entity) => !entity.system).map((entity) => entity.id)
                        : [],
                    )
                  }
                  />
                </span>
          <span className="manual-main__cell">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("category")}>
              <SortHeaderLabel label="구분" direction={sortKey === "category" ? sortDirection : "none"} />
            </button>
          </span>
          <span className="manual-main__cell">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("name")}>
              <SortHeaderLabel label="개체명" direction={sortKey === "name" ? sortDirection : "none"} />
            </button>
          </span>
          <span className="manual-main__cell">
            <button type="button" className="settings-sort-button" onClick={() => toggleSort("value")}>
              <SortHeaderLabel label="개체값" direction={sortKey === "value" ? sortDirection : "none"} />
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

        {pagedEntities.map((entity) => (
          <div key={entity.id} className="manual-main__table-row manual-main__table-row--entity">
            <span className="manual-main__cell manual-main__cell--check">
              <input
                type="checkbox"
                aria-label={`${entity.name} 선택`}
                checked={selectedIds.includes(entity.id)}
                disabled={entity.system}
                onChange={() =>
                  setSelectedIds((current) =>
                    current.includes(entity.id) ? current.filter((id) => id !== entity.id) : [...current, entity.id],
                  )
                }
              />
            </span>
            <span className="manual-main__cell">{getEntityTypeLabel(entity)}</span>
            <span className="manual-main__cell">
              <button
                type="button"
                className="manual-main__link-button"
                onClick={() => {
                  setEditingEntityValueId(entity.id);
                }}
              >
                {entity.name}
              </button>
            </span>
            <span className="manual-main__cell">
              <button
                type="button"
                className="manual-main__link-button"
                onClick={() => setEditingEntityValueId(entity.id)}
              >
                {getEntityPreviewValue(entity) || "개체값 등록"}
              </button>
            </span>
            <span className="manual-main__cell">{formatEntityUpdatedAt(entity)}</span>
            <span className="manual-main__cell">{entity.updatedBy || "-"}</span>
          </div>
        ))}
      </div>

      {!loading && pagedEntities.length === 0 ? (
        <div className="manual-main__table-row manual-main__table-row--entity manual-main__table-row--empty">
          <span className="manual-main__cell manual-main__cell--check" />
          <span className="manual-main__cell manual-main__cell--empty-message">
            {query.trim()
              ? "검색 조건에 맞는 개체가 없습니다."
              : "등록된 개체가 없습니다. 먼저 개체를 추가해주세요."}
          </span>
        </div>
      ) : null}

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

      {bot && authSession && creatingEntityName ? (
        <EntityNameDialog
          authSession={authSession}
          bot={bot}
          entity={null}
          onClose={() => setCreatingEntityName(false)}
          onSaved={(nextBot, successMessage) => {
            setBot(nextBot);
            void workspace.refresh();
            setSelectedIds([]);
            setPage(1);
            setMessage(successMessage);
            setErrorMessage("");
            setCreatingEntityName(false);
            const nextUserEntity = getBotUserEntities(nextBot)[0];
            if (nextUserEntity) {
              setEditingEntityValueId(nextUserEntity.id);
            }
          }}
        />
      ) : null}

      {bot && authSession && editingEntityValueId ? (
        <EntityEditorDialog
          authSession={authSession}
          bot={bot}
          entity={entities.find((item) => item.id === editingEntityValueId) ?? null}
          onClose={() => setEditingEntityValueId(null)}
          onSaved={(nextBot, successMessage) => {
            setBot(nextBot);
            void workspace.refresh();
            setSelectedIds([]);
            setPage(1);
            setMessage(successMessage);
            setErrorMessage("");
            setEditingEntityValueId(null);
          }}
        />
      ) : null}

      {uploadDialogOpen ? (
        <AssetUploadDialog
          title="파일 업로드"
          description="아래의 버튼으로 양식(.txt)을 다운받으신 후, 파일을 업로드 하세요."
          notice={
            <>
              <p>UTF-8 형식으로 인코딩된 .txt/.csv 파일을 통해 개체를 한번에 업로드 할 수 있습니다.</p>
              <ul className="asset-upload-dialog__list">
                <li>헤더는 `개체명,개체값,유형(S/P),상세` 형식을 사용하세요.</li>
                <li>`S`는 동의어형, `P`는 패턴형입니다.</li>
                <li>패턴형은 한 줄에 1개씩 입력하고, 최대 5개까지 등록할 수 있습니다.</li>
              </ul>
            </>
          }
          exampleTitle="예시"
          exampleLines={[
            "개체명,개체값,유형(S/P),상세",
            "국가,미국,S,아메리카",
            "국가,일본,P,.*일본.*",
          ]}
          accept=".txt,.csv"
          templateFileName="Entity_양식.txt"
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
