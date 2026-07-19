"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { hasApiWriteRole, loadAuthSession } from "@/lib/auth";
import {
  activateStudioBotVersion,
  deactivateStudioBotVersion,
  copyStudioBotVersion,
  createStudioBotVersion,
  deleteStudioBotVersion,
  exportStudioBotAidotPackage,
  exportStudioBotVersionPackage,
  fetchStudioBots,
  fetchStudioBot,
  fetchStudioBotVersion,
  fetchStudioBotVersions,
  fetchStudioWorkspaceContext,
  getCachedStudioWorkspaceContext,
  importStudioBotAidotPackage,
  importStudioBotVersionRagAnswerIndex,
  isStudioAidotBotPackage,
  isStudioBotVersionTrained,
  type StudioAidotBotPackage,
  type StudioBotApiItem,
  type StudioBotVersionApiItem,
  type StudioBotVersionPackage,
  updateStudioBotVersion,
} from "@/lib/studio-bots-api";
import { getNluModelLabel, getNluTypeLabel, normalizeNluType } from "@/lib/nlu-options";
import { normalizeVersionDocument, type VersionDocument } from "@/lib/version-document";

type VersionAction = "create" | "copy" | "delete" | "upload" | "download" | "toggle" | "comment";
type UploadMode = "new" | "overwrite";

type StudioVersionFixture = {
  id: string;
  name: string;
  versionNo: number;
  status: "active" | "testing" | "draft" | "inactive";
  description: string;
  comment: string;
  updatedAt: string;
  updatedBy?: string;
  counts: {
    intents: number;
    qa: number;
    entities: number;
    dictionary: number;
    apis: number;
    scenarios: number;
  };
  evaluationLabel?: string;
  isTrained?: boolean;
  trainingEngine?: string;
  scenarioErrorCount?: number;
  scenarioErrorMessage?: string;
};

type VersionManagementPageProps = {
  botId: string;
  initialSelectedId?: string;
};

function decodeRouteValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "알 수 없는 오류";
}

const actionLabels: Record<Exclude<VersionAction, "comment">, string> = {
  create: "버전 추가",
  copy: "복사",
  delete: "삭제",
  upload: "버전 파일 업로드",
  download: "버전 파일 다운로드",
  toggle: "운영/해제",
};

function getVersionStatusLabel(status: StudioVersionFixture["status"]) {
  if (status === "active") {
    return "운영";
  }
  if (status === "testing") {
    return "테스트";
  }
  if (status === "draft") {
    return "초안";
  }
  return "미사용";
}

function nowText() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function getVersionStatusClass(status: StudioVersionFixture["status"]) {
  if (status === "active") {
    return "version-dialog__status version-dialog__status--active";
  }

  if (status === "testing") {
    return "version-dialog__status version-dialog__status--testing";
  }

  return "version-dialog__status";
}

function normalizeImportedVersion(
  value: unknown,
  fallback: StudioVersionFixture,
  nextVersionNo: number,
): StudioVersionFixture | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Partial<StudioVersionFixture> & Record<string, unknown>;
  const counts =
    source.counts && typeof source.counts === "object" && !Array.isArray(source.counts)
      ? source.counts
      : fallback.counts;

  return {
    id: typeof source.id === "string" && source.id.trim() ? source.id.trim() : `v${nextVersionNo}`,
    name:
      typeof source.name === "string" && source.name.trim()
        ? source.name.trim()
        : `v${nextVersionNo}`,
    versionNo:
      typeof source.versionNo === "number" && Number.isFinite(source.versionNo)
        ? source.versionNo
        : nextVersionNo,
    status: "draft",
    description:
      typeof source.description === "string" && source.description.trim()
        ? source.description.trim()
        : fallback.description,
    comment: typeof source.comment === "string" ? source.comment : "",
    updatedAt: nowText(),
    counts: {
      intents: typeof counts.intents === "number" ? counts.intents : fallback.counts.intents,
      qa: typeof counts.qa === "number" ? counts.qa : fallback.counts.qa,
      entities: typeof counts.entities === "number" ? counts.entities : fallback.counts.entities,
      dictionary: typeof counts.dictionary === "number" ? counts.dictionary : fallback.counts.dictionary,
      apis: typeof counts.apis === "number" ? counts.apis : fallback.counts.apis,
      scenarios: typeof counts.scenarios === "number" ? counts.scenarios : fallback.counts.scenarios,
    },
  };
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function sanitizeDownloadFilePart(value: string) {
  const sanitized = value.replace(/[\\/:*?"<>|]+/g, "_").trim();
  return sanitized || "bot";
}

function buildVersionDownloadFilename(botName: string, botId: string, versionName: string) {
  const baseName = sanitizeDownloadFilePart(botName || botId);
  const normalizedVersionName = sanitizeDownloadFilePart(versionName);
  return `${baseName}_${normalizedVersionName}.json`;
}

function formatApiDate(value: string | null | undefined) {
  return value ? value.replace("T", " ").slice(0, 16) : nowText();
}

function mapApiVersionStatus(version: StudioBotVersionApiItem): StudioVersionFixture["status"] {
  if (version.is_active && version.status === "active") {
    return "active";
  }
  if (version.status === "testing" || version.status === "active") {
    return "testing";
  }
  if (version.status === "draft") {
    return "draft";
  }
  return "inactive";
}

function getApiVersionCounts(version: StudioBotVersionApiItem): StudioVersionFixture["counts"] {
  const counts = version.asset_counts;
  return {
    intents: counts?.intents ?? 0,
    qa: counts?.qa ?? 0,
    entities: counts?.entities ?? 0,
    dictionary: counts?.dictionary ?? 0,
    apis: counts?.apis ?? 0,
    scenarios: counts?.dialog_flow_graphs ?? counts?.dialogs ?? 0,
  };
}

function numberFromRecord(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatEvaluationPercent(value: number | null) {
  if (value == null) {
    return "-";
  }
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
}

function getApiVersionEvaluationLabel(version: StudioBotVersionApiItem) {
  const systemConfig = version.system_config ?? version.version_json?.system_config;
  const evaluationStore = systemConfig?.nlu_evaluation;
  if (!evaluationStore || typeof evaluationStore !== "object" || Array.isArray(evaluationStore)) {
    return "-";
  }
  const latestSource = (evaluationStore as Record<string, unknown>).latest;
  const latest =
    latestSource && typeof latestSource === "object" && !Array.isArray(latestSource)
      ? latestSource as Record<string, unknown>
      : evaluationStore as Record<string, unknown>;
  const fixedAccuracy = numberFromRecord(latest, "fixed_accuracy");
  const randomAccuracy = numberFromRecord(latest, "random_accuracy");
  const accuracy = numberFromRecord(latest, "accuracy");
  return formatEvaluationPercent(fixedAccuracy ?? randomAccuracy ?? accuracy);
}

function getApiVersionScenarioErrorCount(version: StudioBotVersionApiItem) {
  return Number(version.scenario_validation?.error_count ?? 0);
}

function getApiVersionScenarioErrorMessage(version: StudioBotVersionApiItem) {
  const validation = version.scenario_validation;
  const firstError = validation?.items?.find((item) => String(item.severity ?? "error") === "error");
  if (!firstError) {
    return "";
  }
  const dialogName = typeof firstError.dialog_name === "string" ? firstError.dialog_name.trim() : "";
  const nodeTitle = typeof firstError.node_title === "string" ? firstError.node_title.trim() : "";
  const message = typeof firstError.message === "string" ? firstError.message.trim() : "";
  const code = typeof firstError.code === "string" ? firstError.code.trim() : "";
  const location = [dialogName, nodeTitle].filter(Boolean).join(" / ");
  const detail = message || code || "대화 설계 오류가 있습니다.";
  return location ? `${location}: ${detail}` : detail;
}

function getVersionTrainingEngineLabel(version: StudioBotVersionApiItem) {
  const training = version.nlu_training ?? {};
  const nluType = normalizeNluType(
    typeof training.nlu_type === "string"
      ? training.nlu_type
      : typeof training.engine_type === "string"
        ? training.engine_type
        : undefined,
  );
  const nluModel =
    typeof training.nlu_model === "string"
      ? training.nlu_model
      : typeof training.model === "string"
        ? training.model
        : undefined;
  if (!version.is_trained && !training.trained_at && training.status !== "success") {
    return "-";
  }
  return `${getNluTypeLabel(nluType)} / ${getNluModelLabel(nluType, nluModel)}`;
}

export function mapApiBotToVersionManagementBot(bot: StudioBotApiItem) {
  const versionsSource =
    Array.isArray((bot as StudioBotApiItem & { versions?: StudioBotVersionApiItem[] }).versions)
      ? (bot as StudioBotApiItem & { versions: StudioBotVersionApiItem[] }).versions
      : bot.active_version
        ? [bot.active_version]
        : [];
  const versions = versionsSource
    .map((version) => ({
      id: version.name || version.id,
      name: version.name || `v${version.version_no}`,
      versionNo: version.version_no,
      status: mapApiVersionStatus(version),
      description: version.description ?? "",
      comment: version.comment ?? "",
      updatedAt: formatApiDate(version.updated_at ?? version.created_at),
      updatedBy: version.updated_by_login_id ?? "-",
      counts: getApiVersionCounts(version),
      evaluationLabel: getApiVersionEvaluationLabel(version),
      isTrained: isStudioBotVersionTrained(version),
      trainingEngine: getVersionTrainingEngineLabel(version),
      scenarioErrorCount: getApiVersionScenarioErrorCount(version),
      scenarioErrorMessage: getApiVersionScenarioErrorMessage(version),
    }))
    .sort((left, right) => right.versionNo - left.versionNo);

  return {
    id: bot.id,
    name: bot.name,
    type: bot.data_json?.bot_kind === "hub" ? "봇 허브" : "텍스트형",
    status: versions.some((version) => version.status === "active") ? "운영 중" : "검토",
    groupCode: bot.group_code ?? "",
    groupName: bot.group_name ?? "",
    description: bot.description ?? "",
    updatedAt: formatApiDate(bot.updated_at),
    counts: {
      intents: versions[0]?.counts.intents ?? 0,
      qa: versions[0]?.counts.qa ?? 0,
      entities: versions[0]?.counts.entities ?? 0,
      simulator: versions[0]?.counts.scenarios ?? 0,
    },
    versions,
  };
}

function mapApiVersionToFixture(version: StudioBotVersionApiItem): StudioVersionFixture {
  return {
    id: version.id,
    name: version.name || `v${version.version_no}`,
    versionNo: version.version_no,
    status: mapApiVersionStatus(version),
    description: version.description ?? "",
    comment: version.comment ?? "",
    updatedAt: formatApiDate(version.updated_at ?? version.created_at),
    updatedBy: version.updated_by_login_id ?? "-",
    counts: getApiVersionCounts(version),
    evaluationLabel: getApiVersionEvaluationLabel(version),
    isTrained: isStudioBotVersionTrained(version),
    trainingEngine: getVersionTrainingEngineLabel(version),
    scenarioErrorCount: getApiVersionScenarioErrorCount(version),
    scenarioErrorMessage: getApiVersionScenarioErrorMessage(version),
  };
}

export type VersionManagementBot = ReturnType<typeof mapApiBotToVersionManagementBot>;

export function VersionManagementPage({ botId: routeBotId, initialSelectedId }: VersionManagementPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const routeBotKey = decodeRouteValue(routeBotId);
  const [versions, setVersions] = useState<StudioVersionFixture[]>([]);
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? "");
  const [botId, setBotId] = useState(routeBotKey);
  const [botName, setBotName] = useState("");
  const [apiBotId, setApiBotId] = useState("");
  const [token, setToken] = useState("");
  const [canManageOperatingVersion, setCanManageOperatingVersion] = useState(false);
  const [dialog, setDialog] = useState<VersionAction | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [uploadMode, setUploadMode] = useState<UploadMode>("new");
  const [uploadTargetId, setUploadTargetId] = useState(selectedId);
  const [uploadFileName, setUploadFileName] = useState("선택된 파일 없음");
  const [uploadVersion, setUploadVersion] = useState<VersionDocument | null>(null);
  const [uploadPackage, setUploadPackage] = useState<StudioBotVersionPackage | null>(null);
  const [uploadAidotPackage, setUploadAidotPackage] = useState<StudioAidotBotPackage | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedVersion = versions.find((version) => version.id === selectedId) ?? versions[0];
  const activeVersion = versions.find((version) => version.status === "active") ?? null;
  const selectedVersionIsTrained = Boolean(selectedVersion?.isTrained);
  const selectedVersionScenarioErrorCount = Number(selectedVersion?.scenarioErrorCount ?? 0);
  const selectedVersionScenarioErrorMessage = selectedVersionScenarioErrorCount > 0
    ? selectedVersion?.scenarioErrorMessage || "대화 설계 오류가 있습니다."
    : "";
  const nextVersionNo = Math.max(0, ...versions.map((version) => version.versionNo)) + 1;
  const backdropVersion = selectedVersion ?? activeVersion ?? versions[0] ?? null;

  const refreshVersions = async (nextSelectedId?: string) => {
    if (!token || !apiBotId) {
      return;
    }

    const context = await fetchStudioWorkspaceContext(token, botId, selectedId || "v1", false);
    const freshVersions = context.versions.length > 0
      ? context.versions
      : await fetchStudioBotVersions(token, apiBotId);
    const mappedVersions = freshVersions.map(mapApiVersionToFixture);
    setVersions(mappedVersions);
    const nextSelected =
      nextSelectedId && mappedVersions.some((version) => version.id === nextSelectedId)
        ? nextSelectedId
        : mappedVersions.find((version) => version.status === "active")?.id ?? mappedVersions[0]?.id ?? "";
    setSelectedId(nextSelected);
  };

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      setLoading(false);
      return;
    }

    setToken(session.access_token);
    setCanManageOperatingVersion(hasApiWriteRole(session.user.roles));

    const applyContext = (context: Awaited<ReturnType<typeof fetchStudioWorkspaceContext>>) => {
      const apiBot = context.bot;
      setApiBotId(apiBot.id);
      setBotId(apiBot.id);
      setBotName(apiBot.name);
      const mappedVersions = context.versions.map(mapApiVersionToFixture);
      setVersions(mappedVersions);
      setSelectedId((current) => {
        if (current && mappedVersions.some((version) => version.id === current || version.name === current)) {
          return mappedVersions.find((version) => version.id === current || version.name === current)?.id ?? current;
        }
        return mappedVersions.find((version) => version.status === "active")?.id ?? mappedVersions[0]?.id ?? "";
      });
    };

    let ignore = false;
    const cachedContext = getCachedStudioWorkspaceContext(session.access_token, routeBotKey, initialSelectedId || "v1", false);
    if (cachedContext) {
      applyContext(cachedContext);
      setLoading(false);
    } else {
      setLoading(true);
    }

    fetchStudioWorkspaceContext(session.access_token, routeBotKey, initialSelectedId || "v1", false)
      .then((context) => {
        if (ignore) {
          return;
        }
        applyContext(context);
      })
      .catch(async (contextError) => {
        try {
          let apiBot: StudioBotApiItem | undefined;
          try {
            apiBot = await fetchStudioBot(session.access_token, routeBotKey);
          } catch {
            const apiBots = await fetchStudioBots(session.access_token);
            apiBot =
              apiBots.find((bot) => bot.id === routeBotKey || bot.name === routeBotKey) ??
              apiBot;
          }
          if (!apiBot) {
            throw new Error(`봇을 찾을 수 없습니다: ${routeBotKey}`);
          }
          const apiVersions = await fetchStudioBotVersions(session.access_token, apiBot.id);
          if (!ignore) {
            setApiBotId(apiBot.id);
            setBotId(apiBot.id);
            setBotName(apiBot.name);
            const mappedVersions = apiVersions.map(mapApiVersionToFixture);
            setVersions(mappedVersions);
            setSelectedId((current) => {
              if (current && mappedVersions.some((version) => version.id === current || version.name === current)) {
                return mappedVersions.find((version) => version.id === current || version.name === current)?.id ?? current;
              }
              return mappedVersions.find((version) => version.status === "active")?.id ?? mappedVersions[0]?.id ?? "";
            });
          }
        } catch (fallbackError) {
          if (!ignore) {
            setMessage(
              `버전 정보를 불러오지 못했습니다. 1차: ${getErrorMessage(contextError)} / 2차: ${getErrorMessage(fallbackError)}`,
            );
          }
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
  }, [initialSelectedId, routeBotKey]);

  useEffect(() => {
    if (!apiBotId || !pathname || routeBotKey === apiBotId) {
      return;
    }

    const canonicalPath = pathname.replace(/\/studio\/bots\/[^/]+/, `/studio/bots/${apiBotId}`);
    if (canonicalPath === pathname) {
      return;
    }

    const search = typeof window !== "undefined" ? window.location.search : "";
    router.replace(`${canonicalPath}${search}`);
  }, [apiBotId, pathname, routeBotKey, router]);

  const renderBackdrop = () => (
    <div className="version-overlay-backdrop" aria-hidden="true">
      <header className="version-overlay-backdrop__header">
        <div className="version-overlay-backdrop__bot">
          <div className="version-overlay-backdrop__avatar">
            <span />
            <span />
          </div>
          <div>
            <strong>{apiBotId ? botName : "봇 정보를 불러오는 중입니다"}</strong>
            <p>{apiBotId ? "현재 선택된 봇의 버전 정보를 기준으로 표시합니다." : "버전 정보를 불러오는 중입니다."}</p>
          </div>
        </div>
        <div className="version-overlay-backdrop__tabs">
          <div className="is-active"><span>의도</span><strong>{backdropVersion?.counts.intents ?? "-"}</strong></div>
          <div><span>개체</span><strong>{backdropVersion?.counts.entities ?? "-"}</strong></div>
          <div><span>API</span><strong>{backdropVersion?.counts.apis ?? "-"}</strong></div>
        </div>
      </header>
      <div className="version-overlay-backdrop__meta">
        <span>운영 버전 <strong>{activeVersion?.name ?? "미지정"}</strong></span>
        <span>선택 버전 <strong>{backdropVersion?.name ?? "-"}</strong></span>
        <span>상태 <strong>{backdropVersion ? getVersionStatusLabel(backdropVersion.status) : "-"}</strong></span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <section className="version-overlay-page">
        {renderBackdrop()}
        <div className="version-overlay-scrim" />
        <div className="version-dialog version-dialog--loading">
          <strong>버전 관리</strong>
          <p>버전 정보를 불러오는 중입니다...</p>
        </div>
      </section>
    );
  }

  if (!selectedVersion || !apiBotId) {
    return (
      <section className="version-overlay-page">
        {renderBackdrop()}
        <div className="version-overlay-scrim" />
        <div className="version-dialog version-dialog--loading">
          <strong>버전 관리</strong>
          <p>{message || "버전 정보를 불러오지 못했습니다."}</p>
        </div>
      </section>
    );
  }

  const closeDialog = () => {
    setDialog(null);
    setMessage("");
    setUploadVersion(null);
    setUploadPackage(null);
    setUploadAidotPackage(null);
    setUploadFileName("선택된 파일 없음");
  };

  const openDialog = (mode: VersionAction) => {
    setMessage("");
    if (mode === "delete" && versions.length <= 1) {
      setMessage("마지막 버전은 삭제할 수 없습니다. 봇 삭제를 사용해주세요.");
      return;
    }
    if (mode === "toggle" && !canManageOperatingVersion) {
      setMessage("운영 버전 변경 권한이 없습니다.");
      return;
    }
    if (mode === "comment") {
      setCommentDraft(selectedVersion.comment);
    }
    if (mode === "upload") {
      setUploadMode("new");
      setUploadTargetId(selectedVersion.id);
      setUploadVersion(null);
      setUploadPackage(null);
      setUploadAidotPackage(null);
      setUploadFileName("선택된 파일 없음");
    }
    setDialog(mode);
  };

  const copySelectedVersion = async () => {
    if (token && apiBotId) {
      setBusy(true);
      setMessage("");
      try {
        const copied = await copyStudioBotVersion(token, apiBotId, selectedVersion.id);
        await refreshVersions(copied.id);
        closeDialog();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "버전 복사에 실패했습니다.");
      } finally {
        setBusy(false);
      }
      return;
    }

    const copy: StudioVersionFixture = {
      ...selectedVersion,
      id: `v${nextVersionNo}`,
      name: `v${nextVersionNo}`,
      versionNo: nextVersionNo,
      status: "draft",
      description: `${selectedVersion.name} 복사본`,
      comment: selectedVersion.comment,
      updatedAt: nowText(),
      isTrained: false,
    };
    setVersions((current) => [copy, ...current]);
    setSelectedId(copy.id);
    closeDialog();
  };

  const createEmptyVersion = async () => {
    if (token && apiBotId) {
      setBusy(true);
      setMessage("");
      try {
        const created = await createStudioBotVersion(token, apiBotId, {
          name: `v${nextVersionNo}`,
          description: "",
          comment: "빈 새 버전",
        });
        await refreshVersions(created.id);
        closeDialog();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "버전 추가에 실패했습니다.");
      } finally {
        setBusy(false);
      }
      return;
    }

    const emptyVersion: StudioVersionFixture = {
      id: `v${nextVersionNo}`,
      name: `v${nextVersionNo}`,
      versionNo: nextVersionNo,
      status: "draft",
      description: "",
      comment: "빈 새 버전",
      updatedAt: nowText(),
      counts: {
        intents: 0,
        qa: 0,
        entities: 0,
        dictionary: 0,
        apis: 0,
        scenarios: 0,
      },
      isTrained: false,
      scenarioErrorCount: 0,
      scenarioErrorMessage: "",
    };
    setVersions((current) => [emptyVersion, ...current]);
    setSelectedId(emptyVersion.id);
    closeDialog();
  };

  const deleteSelectedVersion = async () => {
    if (versions.length <= 1) {
      setMessage("마지막 버전은 삭제할 수 없습니다. 봇 삭제를 사용해주세요.");
      return;
    }
    if (selectedVersion.status === "active") {
      setMessage("운영 버전은 삭제할 수 없습니다. 먼저 운영을 해제하세요.");
      return;
    }
    if (token && apiBotId) {
      setBusy(true);
      setMessage("");
      try {
        await deleteStudioBotVersion(token, apiBotId, selectedVersion.id);
        await refreshVersions();
        closeDialog();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "버전 삭제에 실패했습니다.");
      } finally {
        setBusy(false);
      }
      return;
    }

    const remaining = versions.filter((version) => version.id !== selectedVersion.id);
    setVersions(remaining);
    setSelectedId(remaining[0]?.id ?? "");
    closeDialog();
  };

  const toggleOperatingVersion = async () => {
    if (token && apiBotId) {
      if (selectedVersion.status === "active") {
        setBusy(true);
        setMessage("");
        try {
          const deactivated = await deactivateStudioBotVersion(token, apiBotId, selectedVersion.id);
          await refreshVersions(deactivated.id);
          closeDialog();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "운영 버전 해제에 실패했습니다.");
        } finally {
          setBusy(false);
        }
        return;
      }

      if (!selectedVersionIsTrained) {
        setMessage("학습이 완료된 버전만 운영 버전으로 지정할 수 있습니다. 먼저 학습하기를 실행해주세요.");
        return;
      }

      if (selectedVersionScenarioErrorMessage) {
        setMessage(`대화 설계 오류가 있는 버전은 운영 버전으로 지정할 수 없습니다. ${selectedVersionScenarioErrorMessage} 오류를 수정하고 다시 학습해주세요.`);
        return;
      }

      setBusy(true);
      setMessage("");
      try {
        const activated = await activateStudioBotVersion(token, apiBotId, selectedVersion.id);
        await refreshVersions(activated.id);
        closeDialog();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "운영 버전 지정에 실패했습니다.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (selectedVersion.status === "active") {
      setVersions((current) =>
        current.map((version) =>
          version.id === selectedVersion.id
            ? { ...version, status: "inactive", updatedAt: nowText() }
            : version,
        ),
      );
      closeDialog();
      return;
    }

    if (!selectedVersionIsTrained) {
      setMessage("학습이 완료된 버전만 운영 버전으로 지정할 수 있습니다. 먼저 학습하기를 실행해주세요.");
      return;
    }

    if (selectedVersionScenarioErrorMessage) {
      setMessage(`대화 설계 오류가 있는 버전은 운영 버전으로 지정할 수 없습니다. ${selectedVersionScenarioErrorMessage} 오류를 수정하고 다시 학습해주세요.`);
      return;
    }

    setVersions((current) =>
      current.map((version) =>
        version.id === selectedVersion.id
          ? { ...version, status: "active", updatedAt: nowText() }
          : version.status === "active"
            ? { ...version, status: "inactive", updatedAt: nowText() }
            : version,
      ),
    );
    closeDialog();
  };

  const saveComment = async () => {
    if (token && apiBotId) {
      setBusy(true);
      setMessage("");
      try {
        const updated = await updateStudioBotVersion(token, apiBotId, selectedVersion.id, {
          comment: commentDraft,
        });
        await refreshVersions(updated.id);
        closeDialog();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "코멘트 저장에 실패했습니다.");
      } finally {
        setBusy(false);
      }
      return;
    }


    setVersions((current) =>
      current.map((version) =>
        version.id === selectedVersion.id
          ? { ...version, comment: commentDraft, updatedAt: nowText() }
          : version,
      ),
    );
    closeDialog();
  };

  const handleDownload = async () => {
    if (token && apiBotId) {
      setBusy(true);
      setMessage("");
      try {
        const versionPackage = await exportStudioBotVersionPackage(token, apiBotId, selectedVersion.id);
        downloadJson(
          buildVersionDownloadFilename(botName, botId, versionPackage.version?.name ?? selectedVersion.name),
          versionPackage,
        );
        closeDialog();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "버전 파일 다운로드에 실패했습니다.");
      } finally {
        setBusy(false);
      }
      return;
    }

    downloadJson(buildVersionDownloadFilename(botName, botId, selectedVersion.name), {
      botId: botId,
      botName,
      version: selectedVersion,
    });
    closeDialog();
  };

  const handleAidotDownload = async () => {
    if (!token || !apiBotId) {
      setMessage("Aidot 봇 패키지는 API 연결 상태에서만 다운로드할 수 있습니다.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const aidotPackage = await exportStudioBotAidotPackage(token, apiBotId, selectedVersion.id);
      downloadJson(
        `Bot_${sanitizeDownloadFilePart(botName || botId)}_${sanitizeDownloadFilePart(selectedVersion.name)}.json`,
        aidotPackage,
      );
      closeDialog();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Aidot 봇 패키지 다운로드에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = async (file: File | null) => {
    setMessage("");
    setUploadVersion(null);
    setUploadPackage(null);
    setUploadAidotPackage(null);
    if (!file) {
      setUploadFileName("선택된 파일 없음");
      return;
    }
    setUploadFileName(file.name);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (isStudioAidotBotPackage(parsed)) {
        setUploadAidotPackage(parsed);
        setMessage("Aidot 전체 봇 패키지로 확인되었습니다.");
        return;
      }
      const parsedPackage =
        parsed && typeof parsed === "object" && !Array.isArray(parsed) && "version_json" in parsed
          ? (parsed as StudioBotVersionPackage)
          : null;
      const source =
        parsedPackage
          ? parsedPackage.version_json
          : parsed;
      if (!source || typeof source !== "object" || Array.isArray(source)) {
        setMessage("버전 파일 형식이 맞지 않습니다.");
        return;
      }
      setUploadVersion(normalizeVersionDocument(source as Partial<VersionDocument>));
      setUploadPackage(parsedPackage);
    } catch {
      setMessage("JSON 형식의 버전 파일만 업로드할 수 있습니다.");
    }
  };

  const applyUpload = async () => {
    const versionDocument = uploadVersion;
    const aidotPackage = uploadAidotPackage;
    if (!versionDocument && !aidotPackage) {
      setMessage("업로드할 버전 파일을 선택하세요.");
      return;
    }

    if (token && apiBotId) {
      setBusy(true);
      setMessage("");
      try {
        if (uploadMode === "overwrite") {
          const target = versions.find((version) => version.id === uploadTargetId);
          if (target?.status === "active") {
            setMessage("운영 버전에는 덮어쓸 수 없습니다. 먼저 운영을 해제하세요.");
            return;
          }
          if (aidotPackage) {
            const imported = await importStudioBotAidotPackage(token, apiBotId, uploadTargetId, aidotPackage);
            await refreshVersions(imported.version.id);
            closeDialog();
            return;
          }
          if (!versionDocument) {
            throw new Error("버전 파일 형식이 맞지 않습니다.");
          }
          const updated = await updateStudioBotVersion(token, apiBotId, uploadTargetId, {
            version_json: versionDocument,
          });
          await importStudioBotVersionRagAnswerIndex(
            token,
            apiBotId,
            updated.id,
            uploadPackage?.answer_vector_index,
          );
          await refreshVersions(updated.id);
          closeDialog();
          return;
        }

        const created = await createStudioBotVersion(token, apiBotId, {
          name: `v${nextVersionNo}`,
          description: selectedVersion.description,
        });
        if (aidotPackage) {
          const imported = await importStudioBotAidotPackage(token, apiBotId, created.id, aidotPackage);
          await refreshVersions(imported.version.id);
          closeDialog();
          return;
        }
        if (!versionDocument) {
          throw new Error("버전 파일 형식이 맞지 않습니다.");
        }
        const updated = await updateStudioBotVersion(token, apiBotId, created.id, {
          version_json: versionDocument,
        });
        await importStudioBotVersionRagAnswerIndex(
          token,
          apiBotId,
          updated.id,
          uploadPackage?.answer_vector_index,
        );
        await refreshVersions(updated.id);
        closeDialog();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "버전 파일 업로드에 실패했습니다.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (aidotPackage) {
      setMessage("Aidot 봇 패키지는 API 연결 상태에서만 업로드할 수 있습니다.");
      return;
    }
    if (!versionDocument) {
      setMessage("버전 파일 형식이 맞지 않습니다.");
      return;
    }
    const importedFixture = normalizeImportedVersion(versionDocument, selectedVersion, nextVersionNo);
    if (!importedFixture) {
      setMessage("버전 파일 형식이 맞지 않습니다.");
      return;
    }

    if (uploadMode === "overwrite") {
      const target = versions.find((version) => version.id === uploadTargetId);
      if (target?.status === "active") {
        setMessage("운영 버전에는 덮어쓸 수 없습니다. 먼저 운영을 해제하세요.");
        return;
      }

      setVersions((current) =>
        current.map((version) =>
          version.id === uploadTargetId
            ? {
                ...importedFixture,
                id: version.id,
                name: version.name,
                versionNo: version.versionNo,
                status: version.status,
              }
            : version,
        ),
      );
      setSelectedId(uploadTargetId);
      closeDialog();
      return;
    }

    setVersions((current) => [importedFixture, ...current]);
    setSelectedId(importedFixture.id);
    closeDialog();
  };

  const renderDialog = () => {
    if (!dialog) {
      return null;
    }

    if (dialog === "create") {
      return (
        <>
          <div className="version-dialog__modal-scrim" />
          <section className="version-dialog__modal">
            <div className="version-dialog__modal-header">
              <strong>버전 추가</strong>
              <button type="button" className="version-dialog__modal-close" onClick={closeDialog} aria-label="닫기">×</button>
            </div>
            <div className="version-dialog__modal-body">
              <p className="version-dialog__message">빈 새 버전을 생성하시겠습니까?</p>
              <div className="version-dialog__summary">
                <div className="version-dialog__summary-row"><span>생성 버전</span><strong>{`v${nextVersionNo}`}</strong></div>
                <div className="version-dialog__summary-row"><span>초기 데이터</span><strong>없음</strong></div>
              </div>
              <p className="version-dialog__note">복사본이 아니라 의도, 개체, 사전, API가 없는 빈 버전으로 생성됩니다.</p>
              {message ? <p className="version-dialog__alert">{message}</p> : null}
            </div>
            <div className="version-dialog__modal-footer">
              <button type="button" className="version-dialog__modal-button version-dialog__modal-button--ghost" onClick={closeDialog}>취소</button>
              <button type="button" className="version-dialog__modal-button version-dialog__modal-button--primary" onClick={createEmptyVersion} disabled={busy}>확인</button>
            </div>
          </section>
        </>
      );
    }

    if (dialog === "copy") {
      return (
        <>
          <div className="version-dialog__modal-scrim" />
          <section className="version-dialog__modal">
            <div className="version-dialog__modal-header">
              <strong>버전 복사</strong>
              <button type="button" className="version-dialog__modal-close" onClick={closeDialog} aria-label="닫기">×</button>
            </div>
            <div className="version-dialog__modal-body">
              <p className="version-dialog__message"><strong>{selectedVersion.name}</strong> 버전을 복사하시겠습니까?</p>
              <div className="version-dialog__summary">
                <div className="version-dialog__summary-row"><span>복사 원본</span><strong>{selectedVersion.name}</strong></div>
                <div className="version-dialog__summary-row"><span>생성 버전</span><strong>{`v${nextVersionNo}`}</strong></div>
              </div>
            </div>
            <div className="version-dialog__modal-footer">
              <button type="button" className="version-dialog__modal-button version-dialog__modal-button--ghost" onClick={closeDialog}>취소</button>
              <button type="button" className="version-dialog__modal-button version-dialog__modal-button--primary" onClick={copySelectedVersion}>확인</button>
            </div>
          </section>
        </>
      );
    }

    if (dialog === "delete") {
      return (
        <>
          <div className="version-dialog__modal-scrim" />
          <section className="version-dialog__modal">
            <div className="version-dialog__modal-header">
              <strong>버전 삭제</strong>
              <button type="button" className="version-dialog__modal-close" onClick={closeDialog} aria-label="닫기">×</button>
            </div>
            <div className="version-dialog__modal-body">
              <p className="version-dialog__message">
                {selectedVersion.status === "active" ? "운영 버전은 삭제할 수 없습니다." : <><strong>{selectedVersion.name}</strong> 버전을 삭제하시겠습니까?</>}
              </p>
              {message ? <p className="version-dialog__alert">{message}</p> : null}
            </div>
            <div className="version-dialog__modal-footer">
              <button type="button" className="version-dialog__modal-button version-dialog__modal-button--ghost" onClick={closeDialog}>취소</button>
              <button type="button" className="version-dialog__modal-button version-dialog__modal-button--primary" onClick={deleteSelectedVersion}>확인</button>
            </div>
          </section>
        </>
      );
    }

    if (dialog === "download") {
      return (
        <>
          <div className="version-dialog__modal-scrim" />
          <section className="version-dialog__modal">
            <div className="version-dialog__modal-header">
              <strong>버전 파일 다운로드</strong>
              <button type="button" className="version-dialog__modal-close" onClick={closeDialog} aria-label="닫기">×</button>
            </div>
            <div className="version-dialog__modal-body">
              <p className="version-dialog__message"><strong>{selectedVersion.name}</strong> 버전 정보를 다운로드하시겠습니까?</p>
            </div>
            <div className="version-dialog__modal-footer">
              <button type="button" className="version-dialog__modal-button version-dialog__modal-button--ghost" onClick={closeDialog}>취소</button>
              <button type="button" className="version-dialog__modal-button version-dialog__modal-button--ghost" onClick={handleDownload} disabled={busy}>CGA 버전 백업</button>
              <button type="button" className="version-dialog__modal-button version-dialog__modal-button--primary" onClick={handleAidotDownload} disabled={busy}>Aidot 봇 패키지</button>
            </div>
          </section>
        </>
      );
    }

    if (dialog === "toggle") {
      if (!canManageOperatingVersion) {
        return null;
      }
      const isUnassign = selectedVersion.status === "active";
      return (
        <>
          <div className="version-dialog__modal-scrim" />
          <section className="version-dialog__modal">
            <div className="version-dialog__modal-header">
              <strong>{isUnassign ? "운영 버전 해제" : "운영 버전 지정"}</strong>
              <button type="button" className="version-dialog__modal-close" onClick={closeDialog} aria-label="닫기">×</button>
            </div>
            <div className="version-dialog__modal-body">
              <p className="version-dialog__message">
                {isUnassign ? <><strong>{selectedVersion.name}</strong> 버전의 운영을 해제하시겠습니까?</> : <><strong>{selectedVersion.name}</strong> 버전을 운영 버전으로 지정하시겠습니까?</>}
              </p>
              <div className="version-dialog__summary">
                <div className="version-dialog__summary-row"><span>현재 운영</span><strong>{activeVersion?.name ?? "없음"}</strong></div>
                <div className="version-dialog__summary-row"><span>선택 버전</span><strong>{selectedVersion.name}</strong></div>
              </div>
              <p className="version-dialog__note">운영 버전은 외부 메신저 연결에서 실제 실행되는 버전입니다. 학습 완료 버전만 지정할 수 있습니다.</p>
              {!isUnassign && !selectedVersionIsTrained ? <p className="version-dialog__alert">이 버전은 아직 학습되지 않았습니다. 먼저 학습하기를 실행해주세요.</p> : null}
              {!isUnassign && selectedVersionScenarioErrorMessage ? (
                <p className="version-dialog__alert">대화 설계 오류 {selectedVersionScenarioErrorCount}건이 있습니다. {selectedVersionScenarioErrorMessage}</p>
              ) : null}
            </div>
            <div className="version-dialog__modal-footer">
              <button type="button" className="version-dialog__modal-button version-dialog__modal-button--ghost" onClick={closeDialog}>취소</button>
              <button
                type="button"
                className="version-dialog__modal-button version-dialog__modal-button--primary"
                onClick={toggleOperatingVersion}
                disabled={busy || (!isUnassign && (!selectedVersionIsTrained || Boolean(selectedVersionScenarioErrorMessage)))}
              >
                확인
              </button>
            </div>
          </section>
        </>
      );
    }

    if (dialog === "comment") {
      return (
        <>
          <div className="version-dialog__modal-scrim" />
          <section className="version-dialog__modal version-dialog__modal--wide">
            <div className="version-dialog__modal-header">
              <strong>버전 별 코멘트 등록</strong>
              <button type="button" className="version-dialog__modal-close" onClick={closeDialog} aria-label="닫기">×</button>
            </div>
            <div className="version-dialog__modal-body">
              <div className="version-dialog__summary">
                <div className="version-dialog__summary-row"><span>대상 버전</span><strong>{selectedVersion.name}</strong></div>
                <div className="version-dialog__summary-row"><span>현재 상태</span><strong>{getVersionStatusLabel(selectedVersion.status)}</strong></div>
              </div>
              <div className="version-dialog__field-group">
                <label className="version-dialog__field-label" htmlFor="version-comment">비고</label>
                <textarea id="version-comment" className="version-dialog__comment-textarea" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} />
              </div>
            </div>
            <div className="version-dialog__modal-footer">
              <button type="button" className="version-dialog__modal-button version-dialog__modal-button--ghost" onClick={closeDialog}>취소</button>
              <button type="button" className="version-dialog__modal-button version-dialog__modal-button--primary" onClick={saveComment}>저장</button>
            </div>
          </section>
        </>
      );
    }

    return (
      <>
        <div className="version-dialog__modal-scrim" />
        <section className="version-dialog__modal version-dialog__modal--wide">
          <div className="version-dialog__modal-header">
            <strong>버전 파일 업로드</strong>
            <button type="button" className="version-dialog__modal-close" onClick={closeDialog} aria-label="닫기">×</button>
          </div>
          <div className="version-dialog__modal-body">
            <div className="version-dialog__field-group">
              <span className="version-dialog__field-label">업로드 방법</span>
              <div className="version-dialog__upload-options">
                <label className={`version-dialog__upload-option${uploadMode === "new" ? " is-active" : ""}`}>
                  <input type="radio" name="upload-mode" checked={uploadMode === "new"} onChange={() => setUploadMode("new")} />
                  <div><strong>새로운 버전으로 추가</strong><p>업로드 파일 기준으로 새 버전을 생성합니다.</p></div>
                </label>
                <label className={`version-dialog__upload-option${uploadMode === "overwrite" ? " is-active" : ""}`}>
                  <input type="radio" name="upload-mode" checked={uploadMode === "overwrite"} onChange={() => setUploadMode("overwrite")} />
                  <div><strong>기존 버전 덮어쓰기</strong><p>선택한 버전에 업로드 파일 내용을 반영합니다.</p></div>
                </label>
              </div>
            </div>
            {uploadMode === "overwrite" ? (
              <div className="version-dialog__field-group">
                <label className="version-dialog__field-label" htmlFor="upload-target">대상 버전</label>
                <select id="upload-target" className="version-dialog__upload-select" value={uploadTargetId} onChange={(event) => setUploadTargetId(event.target.value)}>
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>{version.name} ({getVersionStatusLabel(version.status)})</option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="version-dialog__field-group">
              <span className="version-dialog__field-label">업로드 파일</span>
              <div className="version-dialog__upload-file">
                <input ref={fileInputRef} className="version-dialog__file-input" type="file" accept=".json,.txt,application/json,text/plain" onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)} />
                <button type="button" className="version-dialog__file-button" onClick={() => fileInputRef.current?.click()}>파일 선택</button>
                <span className="version-dialog__file-name">{uploadFileName}</span>
              </div>
            </div>
            {message ? <p className="version-dialog__alert">{message}</p> : null}
          </div>
          <div className="version-dialog__modal-footer">
            <button type="button" className="version-dialog__modal-button version-dialog__modal-button--ghost" onClick={closeDialog}>취소</button>
            <button type="button" className="version-dialog__modal-button version-dialog__modal-button--primary" onClick={applyUpload}>확인</button>
          </div>
        </section>
      </>
    );
  };

  return (
    <section className="version-overlay-page">
      {renderBackdrop()}
      <div className="version-overlay-scrim" />

      <div className="version-dialog">
        <div className="version-dialog__header">
          <strong>버전 관리</strong>
          <Link href={`/studio/bots/${botId}/versions/${selectedVersion.name}/intents`} className="version-dialog__close" aria-label="닫기">×</Link>
        </div>
        <div className="version-dialog__actions">
          {(Object.keys(actionLabels) as Array<Exclude<VersionAction, "comment">>)
            .filter((mode) => canManageOperatingVersion || mode !== "toggle")
            .map((mode) => (
            <button key={mode} type="button" className={`version-dialog__action${dialog === mode ? " is-active" : ""}`} onClick={() => openDialog(mode)}>{actionLabels[mode]}</button>
          ))}
        </div>
        <div className="version-dialog__guide">
          <p>버전을 선택한 후 원하는 기능을 실행하세요.</p>
          <span>운영 버전: <strong>{activeVersion?.name ?? "미지정"}</strong> / 선택 버전: <strong>{selectedVersion.name}</strong></span>
          {message ? <p className="version-dialog__alert">{message}</p> : null}
        </div>
        <div className="version-dialog__table">
          <div className="version-dialog__row version-dialog__row--header">
            <span>선택</span><span>버전</span><span>상태</span><span>최종 학습 엔진</span><span>의도</span><span>개체</span><span>사전</span><span>API</span><span>평가</span><span>최종수정일시</span><span>최종수정자</span><span>비고</span>
          </div>
          {versions.map((row) => (
            <div key={row.id} className={`version-dialog__row${row.id === selectedVersion.id ? " is-selected" : ""}`}>
              <span className="version-dialog__cell version-dialog__cell--select">
                <button type="button" className="version-dialog__row-link version-dialog__row-link--select" onClick={() => setSelectedId(row.id)} aria-label={`${row.name} 선택`}>
                  <span className="version-dialog__selection-dot" />
                </button>
              </span>
              <span><button type="button" className="version-dialog__row-link" onClick={() => setSelectedId(row.id)}>{row.name}</button></span>
              <span><span className={getVersionStatusClass(row.status)}>{getVersionStatusLabel(row.status)}</span>{row.status !== "active" && !row.isTrained ? <em className="version-dialog__training-state">미학습</em> : null}{Number(row.scenarioErrorCount ?? 0) > 0 ? <em className="version-dialog__training-state" title={row.scenarioErrorMessage || "대화 설계 오류가 있습니다."}>설계오류</em> : null}</span>
              <span className="version-dialog__engine" title={row.trainingEngine ?? "-"}>{row.trainingEngine ?? "-"}</span>
              <span>{row.counts.intents}</span><span>{row.counts.entities}</span><span>{row.counts.dictionary}</span><span>{row.counts.apis}</span><span>{row.evaluationLabel ?? "-"}</span><span>{row.updatedAt}</span><span>{row.updatedBy ?? "-"}</span>
              <span className="version-dialog__comment"><button type="button" className="version-dialog__comment-link" onClick={() => { setSelectedId(row.id); setCommentDraft(row.comment); setDialog("comment"); }}>{row.comment || "-"}</button></span>
            </div>
          ))}
        </div>
        <div className="version-dialog__footer">
          <p className="version-dialog__footer-note">운영 버전은 외부 메신저 연결에서 실행되는 버전이며, 시뮬레이터 테스트 대상과 구분됩니다.</p>
          <Link href={`/studio/bots/${botId}/versions/${selectedVersion.name}/intents`} className="version-dialog__ghost">닫기</Link>
        </div>
        {renderDialog()}
      </div>
    </section>
  );
}
