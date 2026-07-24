"use client";

import { useRouter } from "next/navigation";
import { CSSProperties, useEffect, useMemo, useState } from "react";

import {
  filterOperationBots,
  formatOperationDate,
  loadRecentOperationBots,
  operationBotGroupName,
  operationBotLocale,
  operationVersionName,
  resolveInitialOperationBotId,
  saveRecentOperationBot,
  type RecentOperationBot,
} from "@/components/bot-operation-shared";
import { useI18n } from "@/components/language-provider";
import { loadAuthSession, saveLastBotScreen, type AuthSession } from "@/lib/auth";
import { BOT_WORKSPACE_CATALOGS } from "@/lib/i18n/bot-workspace";
import {
  fetchStudioBots,
  fetchStudioWorkspaceContext,
  type StudioBotApiItem,
  type StudioBotVersionApiItem,
  type StudioWorkspaceContextApiResponse,
} from "@/lib/studio-bots-api";
import { SimulatorFloatingLauncher } from "@/components/simulator-page";

type WorkspaceEvaluationRow = {
  id: string;
  utterance: string;
  expectedName: string;
  predictedName: string;
  score: number;
  correct: boolean;
};

type WorkspaceCollision = {
  expectedName: string;
  predictedName: string;
  count: number;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readText(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "-";
}

function readWorkspaceEvaluationRows(version: StudioBotVersionApiItem | null): WorkspaceEvaluationRow[] {
  const versionJson = asRecord(version?.version_json);
  const systemConfig = asRecord(versionJson.system_config);
  const evaluation = asRecord(systemConfig.nlu_evaluation);
  const snapshot = asRecord(evaluation.snapshot);
  const rows = Array.isArray(snapshot.training_rows) ? snapshot.training_rows : [];

  return rows.flatMap((value, index) => {
    const row = asRecord(value);
    if (
      typeof row.utterance !== "string"
      || typeof row.score !== "number"
      || typeof row.correct !== "boolean"
    ) {
      return [];
    }
    return [{
      id: typeof row.id === "string" ? row.id : String(index + 1),
      utterance: row.utterance,
      expectedName: readText(row, ["expectedName", "expected_name"]),
      predictedName: readText(row, ["predictedName", "predicted_name"]),
      score: row.score,
      correct: row.correct,
    }];
  });
}

function buildWorkspaceCollisions(rows: WorkspaceEvaluationRow[]): WorkspaceCollision[] {
  const pairs = new Map<string, WorkspaceCollision>();
  rows.forEach((row) => {
    if (row.correct || row.predictedName === "-" || row.expectedName === row.predictedName) return;
    const key = `${row.expectedName}::${row.predictedName}`;
    const current = pairs.get(key) ?? {
      expectedName: row.expectedName,
      predictedName: row.predictedName,
      count: 0,
    };
    pairs.set(key, { ...current, count: current.count + 1 });
  });
  return Array.from(pairs.values()).sort((left, right) => right.count - left.count).slice(0, 6);
}

function formatWorkspaceScore(value: number) {
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.max(0, Math.min(100, normalized)).toFixed(2)}%`;
}

export function BotOperationsWorkspacePage() {
  const router = useRouter();
  const { language } = useI18n();
  const copy = BOT_WORKSPACE_CATALOGS[language];
  const [session, setSession] = useState<AuthSession | null>(null);
  const [bots, setBots] = useState<StudioBotApiItem[]>([]);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [context, setContext] = useState<StudioWorkspaceContextApiResponse | null>(null);
  const [recentBots, setRecentBots] = useState<RecentOperationBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const selectedBot = useMemo(
    () => bots.find((bot) => bot.id === selectedBotId) || null,
    [bots, selectedBotId],
  );
  const selectedVersion = context?.version || selectedBot?.active_version || null;
  const versionName = operationVersionName(selectedVersion);

  useEffect(() => {
    const currentSession = loadAuthSession();
    if (!currentSession) {
      router.replace("/login");
      return;
    }
    setSession(currentSession);
    setRecentBots(loadRecentOperationBots());
    fetchStudioBots(currentSession.access_token, true)
      .then((items) => {
        const operationBots = filterOperationBots(currentSession, items);
        setBots(operationBots);
        setSelectedBotId(resolveInitialOperationBotId(currentSession, operationBots));
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : copy.loadBotsError))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!session || !selectedBot) {
      setContext(null);
      return;
    }
    setLoading(true);
    setMessage("");
    const preferredVersion = selectedBot.active_version?.name || selectedBot.active_version?.id || "v1";
    fetchStudioWorkspaceContext(
      session.access_token,
      selectedBot.id,
      preferredVersion,
      true,
      "dialogs",
      session.user.login_id,
    )
      .then((value) => {
        setContext(value);
        const currentVersionName = operationVersionName(value.version || selectedBot.active_version);
        setRecentBots(saveRecentOperationBot(selectedBot, currentVersionName));
        saveLastBotScreen(
          `/studio/bots/${selectedBot.id}/versions/${encodeURIComponent(currentVersionName)}/intents`,
          session.user.login_id,
        );
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : copy.loadWorkspaceError))
      .finally(() => setLoading(false));
  }, [selectedBot, session]);

  const workRows = useMemo(() => {
    const dialogs = selectedVersion?.version_json?.dialogs || [];
    return dialogs.slice(0, 18).map((item, index) => {
      const record = asRecord(item);
      const dialogType = readText(record, ["dialog_type", "type"]);
      return {
        id: readText(record, ["id", "dialog_id", "intent_id"]) || String(index + 1),
        type: dialogType === "2" || dialogType.toLowerCase() === "module" ? copy.module : copy.intent,
        name: readText(record, ["display_name", "displayName", "name", "intent_name", "id"]),
      };
    });
  }, [copy.intent, copy.module, selectedVersion]);
  const evaluationRows = useMemo(
    () => readWorkspaceEvaluationRows(selectedVersion),
    [selectedVersion],
  );
  const misclassifiedRows = useMemo(
    () => evaluationRows.filter((row) => !row.correct).slice(0, 10),
    [evaluationRows],
  );
  const lowScoreRows = useMemo(
    () => evaluationRows.filter((row) => row.score < 70).slice(0, 10),
    [evaluationRows],
  );
  const collisions = useMemo(() => buildWorkspaceCollisions(evaluationRows), [evaluationRows]);

  function selectBot(botId: string) {
    if (!bots.some((bot) => bot.id === botId)) return;
    setMessage("");
    setSelectedBotId(botId);
  }

  function openCurrent(target: "settings" | "configure" | "management" | "build") {
    if (!selectedBot || !selectedVersion) return;
    const version = encodeURIComponent(versionName);
    if (target === "settings") router.push(`/studio/bots/${selectedBot.id}/settings?version=${version}`);
    if (target === "configure") router.push(`/studio/bots/${selectedBot.id}/versions/${version}/configure`);
    if (target === "management") router.push(`/studio/bots?bot=${encodeURIComponent(selectedBot.id)}`);
    if (target === "build") router.push(`/studio/bots/${selectedBot.id}/versions/${version}/intents`);
  }

  function saveWorkspace() {
    if (!selectedBot) return;
    setRecentBots(saveRecentOperationBot(selectedBot, versionName));
    setMessage(copy.workspaceSaved);
  }

  const itemColumns = { "--operation-cols": ".8fr .8fr 1.6fr" } as CSSProperties;
  const recentColumns = { "--operation-cols": "1.5fr 1fr .8fr .8fr 1.1fr" } as CSSProperties;

  return (
    <section className="cga-operation-page">
      <header className="cga-operation-header">
        <div className="cga-operation-heading">
          <span className="cga-operation-code">BOT</span>
          <div><strong>{copy.title}</strong><span>{copy.description}</span></div>
        </div>
        <button type="button" className="cga-operation-primary-action" onClick={saveWorkspace} disabled={!selectedBot}>{copy.save}</button>
      </header>

      <div className="cga-operation-summary cga-operation-summary--workspace">
        <article>
          <strong>{copy.groupSelection}</strong>
          <select value={session?.user.group_id || ""} disabled>
            <option value={session?.user.group_id || ""}>{session?.user.group_name || session?.user.group_code || copy.defaultGroup}</option>
          </select>
        </article>
        <article><strong>{copy.accessibleBots}</strong><span>{bots.length}{copy.countUnit}</span></article>
        <article><strong>{copy.currentWorkBot}</strong><span>{selectedBot ? `${selectedBot.name} (${selectedBot.id})` : copy.none}</span></article>
        <article><strong>{copy.recentWork}</strong><span>{recentBots.length}{copy.countUnit}</span></article>
      </div>

      <div className="cga-workspace-grid">
        <aside className="cga-operation-panel cga-workspace-current-panel">
          <header><div><strong>{copy.currentTarget}</strong><span>{copy.currentTargetDescription}</span></div></header>
          <label className="cga-workspace-bot-select">
            <span>{copy.selectBot}</span>
            <select value={selectedBotId} onChange={(event) => selectBot(event.target.value)}>
              {bots.map((bot) => <option key={bot.id} value={bot.id}>{bot.name}</option>)}
            </select>
          </label>
          <dl className="cga-operation-definition">
            <div><dt>{copy.group}</dt><dd>{operationBotGroupName(session, selectedBot)}</dd></div>
            <div><dt>{copy.bot}</dt><dd>{selectedBot?.name || "-"}</dd></div>
            <div><dt>{copy.version}</dt><dd>{selectedVersion ? versionName : "-"}</dd></div>
            <div><dt>{copy.status}</dt><dd>{selectedBot?.status || "-"}</dd></div>
            <div><dt>{copy.language}</dt><dd>{operationBotLocale(selectedBot)}</dd></div>
            <div><dt>{copy.lastWork}</dt><dd>{formatOperationDate(selectedBot?.updated_at)}</dd></div>
          </dl>
          <div className="cga-operation-action-stack cga-operation-action-stack--plain">
            <button type="button" onClick={() => openCurrent("settings")} disabled={!selectedVersion}>{copy.openSettings}</button>
            <button type="button" onClick={() => openCurrent("configure")} disabled={!selectedVersion}>{copy.openConfiguration}</button>
            <button type="button" onClick={() => openCurrent("management")} disabled={!selectedVersion}>{copy.openManagement}</button>
            <button type="button" onClick={() => openCurrent("build")} disabled={!selectedVersion}>{copy.openBuild}</button>
          </div>
          <div className="cga-workspace-recent">
            <strong>{copy.recentBots}</strong>
            <div className="cga-operation-table" style={recentColumns}>
              <div className="cga-operation-row cga-operation-row--head"><span>{copy.bot}</span><span>ID</span><span>{copy.version}</span><span>{copy.status}</span><span>{copy.workTime}</span></div>
              {recentBots.map((item) => (
                <button key={item.botId} type="button" className="cga-operation-row cga-operation-row--button" onClick={() => selectBot(item.botId)}>
                  <span>{item.name}</span><span>{item.botId}</span><span>{item.version}</span><span>{item.botId === selectedBotId ? copy.currentBot : item.status}</span><span>{new Date(item.touchedAt).toLocaleString(language)}</span>
                </button>
              ))}
              {recentBots.length === 0 ? <div className="cga-operation-empty">{copy.noRecentBots}</div> : null}
            </div>
          </div>
        </aside>

        <article className="cga-operation-panel cga-workspace-items-panel">
          <header><div><strong>{copy.workItems}</strong><span>{copy.workItemsDescription}</span></div></header>
          <div className="cga-operation-table" style={itemColumns}>
            <div className="cga-operation-row cga-operation-row--head"><span>ID</span><span>{copy.category}</span><span>{copy.intentModuleName}</span></div>
            {workRows.map((item, index) => (
              <div key={`${item.id}-${index}`} className="cga-operation-row"><span>{item.id}</span><span>{item.type}</span><strong>{item.name}</strong></div>
            ))}
            {!loading && workRows.length === 0 ? <div className="cga-operation-empty">{copy.noWorkItems}</div> : null}
          </div>
        </article>

        <aside className="cga-workspace-diagnostics" aria-label={copy.evaluationDiagnostics}>
          <article className="cga-operation-panel cga-workspace-diagnostic-panel">
            <header><div><strong>{copy.misclassified}</strong></div></header>
            <div className="cga-workspace-diagnostic-table cga-workspace-diagnostic-table--errors">
              <div className="cga-workspace-diagnostic-row cga-workspace-diagnostic-row--head"><span>{copy.utterance}</span><span>{copy.expectedIntent}</span><span>{copy.predictedIntentScore}</span></div>
              <div className="cga-workspace-diagnostic-body">
                {misclassifiedRows.map((row) => (
                  <div key={row.id} className="cga-workspace-diagnostic-row"><span>{row.utterance}</span><span>{row.expectedName}</span><span className="is-failure">{row.predictedName} / {formatWorkspaceScore(row.score)}</span></div>
                ))}
                {misclassifiedRows.length === 0 ? <div className="cga-workspace-diagnostic-empty">{copy.noMisclassified}</div> : null}
              </div>
            </div>
          </article>

          <article className="cga-operation-panel cga-workspace-diagnostic-panel">
            <header><div><strong>{copy.lowScore}</strong></div></header>
            <div className="cga-workspace-diagnostic-table cga-workspace-diagnostic-table--low-score">
              <div className="cga-workspace-diagnostic-row cga-workspace-diagnostic-row--head"><span>{copy.utterance}</span><span>{copy.intent}</span><span>{copy.score}</span></div>
              <div className="cga-workspace-diagnostic-body">
                {lowScoreRows.map((row) => (
                  <div key={row.id} className="cga-workspace-diagnostic-row"><span>{row.utterance}</span><span>{row.expectedName}</span><span>{formatWorkspaceScore(row.score)}</span></div>
                ))}
                {lowScoreRows.length === 0 ? <div className="cga-workspace-diagnostic-empty">{copy.noLowScore}</div> : null}
              </div>
            </div>
          </article>

          <article className="cga-operation-panel cga-workspace-diagnostic-panel">
            <header><div><strong>{copy.similarIntentCollisions}</strong></div></header>
            <div className="cga-workspace-diagnostic-table cga-workspace-diagnostic-table--collisions">
              <div className="cga-workspace-diagnostic-row cga-workspace-diagnostic-row--head"><span>{copy.expectedIntent}</span><span>{copy.predictedIntent}</span><span>{copy.cases}</span></div>
              <div className="cga-workspace-diagnostic-body">
                {collisions.map((item) => (
                  <div key={`${item.expectedName}-${item.predictedName}`} className="cga-workspace-diagnostic-row"><span>{item.expectedName}</span><span>{item.predictedName}</span><span>{item.count}{copy.countUnit}</span></div>
                ))}
                {collisions.length === 0 ? <div className="cga-workspace-diagnostic-empty">{copy.noCollisions}</div> : null}
              </div>
            </div>
          </article>
        </aside>
      </div>
      {selectedBot && selectedVersion ? (
        <SimulatorFloatingLauncher botIdOverride={selectedBot.id} versionIdOverride={versionName} />
      ) : null}
      {message ? <div className="cga-operation-floating-message">{message}</div> : null}
    </section>
  );
}
