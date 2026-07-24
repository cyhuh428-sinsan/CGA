"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { filterOperationBots, resolveInitialOperationBotId } from "@/components/bot-operation-shared";
import { useI18n } from "@/components/language-provider";
import { loadAuthSession, type AuthSession } from "@/lib/auth";
import { fetchStudioBots, type StudioBotApiItem } from "@/lib/studio-bots-api";
import { STUDIO_OPERATIONS_DASHBOARD_CATALOGS, formatStudioOperationsDashboardText, type StudioOperationsDashboardCatalog } from "@/lib/i18n/studio-operations-dashboard";

type DashboardUser = { id: string; name?: string; role?: string };
type DashboardWorkItem = {
  id: string;
  type?: string;
  title?: string;
  assignee_id?: string;
  status?: string;
  updated_at?: string | null;
  group_id?: string;
  group_name?: string;
  bot_id?: string;
  bot_name?: string;
  lock?: { user_id?: string } | null;
};
type DashboardState = {
  users?: DashboardUser[];
  workItems?: DashboardWorkItem[];
  group_id?: string;
  bot_id?: string;
  updated_at?: string | null;
};

const STATUS_ORDER = ["todo", "in_progress", "review", "approved", "blocked"];

function formatDashboardDate(value?: string | null) {
  return value ? value.replace("T", " ").slice(0, 16) : "-";
}

function countBy(items: DashboardWorkItem[], getKey: (item: DashboardWorkItem) => string, fallbackLabel: string) {
  return items.reduce<Record<string, number>>((result, item) => {
    const key = getKey(item) || fallbackLabel;
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function MetricPanel({ title, description, values, countTemplate, unspecified }: {
  title: string;
  description: string;
  values: Array<{ key: string; label: string; count: number; status?: string }>;
  countTemplate: string;
  unspecified: string;
}) {
  return (
    <article className="cga-dashboard-panel">
      <header><div><strong>{title}</strong><span>{description}</span></div></header>
      <div className="cga-dashboard-metric-strip">
        {values.length ? values.map((item) => (
          <div key={item.key} className={`cga-dashboard-metric${item.status ? ` is-${item.status}` : ""}`}>
            <strong>{item.label}</strong><span>{formatStudioOperationsDashboardText(countTemplate, { count: item.count })}</span>
          </div>
        )) : <div className="cga-dashboard-metric"><strong>{unspecified}</strong><span>{formatStudioOperationsDashboardText(countTemplate, { count: 0 })}</span></div>}
      </div>
    </article>
  );
}

export function OperationsDashboardPage() {
  const router = useRouter();
  const { language } = useI18n();
  const copy: StudioOperationsDashboardCatalog = STUDIO_OPERATIONS_DASHBOARD_CATALOGS[language];
  const [session, setSession] = useState<AuthSession | null>(null);
  const [bots, setBots] = useState<StudioBotApiItem[]>([]);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const selectedBot = useMemo(() => bots.find((bot) => bot.id === selectedBotId) || null, [bots, selectedBotId]);
  const groupId = selectedBot?.group_code || session?.user.group_code || selectedBot?.group_id || session?.user.group_id || "";
  const botId = selectedBot?.id || "";

  useEffect(() => {
    const currentSession = loadAuthSession();
    if (!currentSession) {
      router.replace("/login");
      return;
    }
    setSession(currentSession);
    fetchStudioBots(currentSession.access_token, true)
      .then((items) => {
        const operationBots = filterOperationBots(currentSession, items);
        setBots(operationBots);
        setSelectedBotId(resolveInitialOperationBotId(currentSession, operationBots));
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : copy.botLoadFailed))
      .finally(() => setLoading(false));
  }, [router]);

  async function loadDashboard() {
    if (!groupId || !botId) {
      setState(null);
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const query = new URLSearchParams({ group_id: groupId, bot_id: botId });
      const response = await fetch(`/api/legacy-cga/collaboration-state?${query}`, { cache: "no-store" });
      const payload = await response.json() as DashboardState & { detail?: string };
      if (!response.ok) throw new Error(payload.detail || copy.dashboardLoadFailed);
      setState(payload);
    } catch (error) {
      setState(null);
      setMessage(error instanceof Error ? error.message : copy.dashboardLoadFailed);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [groupId, botId]);

  const dashboard = useMemo(() => {
    const workItems = state?.workItems || [];
    const users = state?.users || [];
    const currentUserId = session?.user.login_id || "";
    const usersById = new Map(users.map((user) => [user.id, user]));
    const myTasks = workItems.filter((item) => item.assignee_id === currentUserId);
    const reviewQueue = workItems.filter((item) => item.status === "review");
    const lockedItems = workItems.filter((item) => item.lock?.user_id);
    const recentUpdates = [...workItems]
      .sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")))
      .slice(0, 5);
    const bottlenecks = workItems
      .filter((item) => item.status === "blocked" || item.status === "review" || item.lock?.user_id)
      .slice(0, 5);
    const groupCounts = countBy(workItems, (item) => item.group_name || item.group_id || selectedBot?.group_name || groupId, copy.unspecified);
    const botCounts = countBy(workItems, (item) => item.bot_name || item.bot_id || selectedBot?.name || botId, copy.unspecified);
    const assigneeCounts = countBy(workItems, (item) => usersById.get(item.assignee_id || "")?.name || item.assignee_id || copy.unspecified, copy.unspecified);
    const roleCounts = workItems.reduce<Record<string, number>>((result, item) => {
      const role = usersById.get(item.assignee_id || "")?.role || "viewer";
      result[role] = (result[role] || 0) + 1;
      return result;
    }, {});
    return { workItems, usersById, myTasks, reviewQueue, lockedItems, recentUpdates, bottlenecks, groupCounts, botCounts, assigneeCounts, roleCounts };
  }, [botId, copy.unspecified, groupId, selectedBot, session, state]);

  const groupValues = Object.entries(dashboard.groupCounts).map(([label, count]) => ({ key: label, label, count }));
  const botValues = Object.entries(dashboard.botCounts).map(([label, count]) => ({ key: label, label, count }));
  const roleValues = Object.entries(dashboard.roleCounts).map(([role, count]) => ({ key: role, label: copy.roles[role] || role, count }));
  const assigneeValues = Object.entries(dashboard.assigneeCounts).map(([label, count]) => ({ key: label, label, count }));
  const statusValues = STATUS_ORDER.map((status) => ({
    key: status,
    label: copy.statuses[status],
    count: dashboard.workItems.filter((item) => item.status === status).length,
    status,
  }));

  return (
    <section className="cga-operation-page cga-dashboard-page">
      <header className="cga-operation-header">
        <div className="cga-operation-heading">
          <span className="cga-operation-code">OD</span>
          <div><strong>{copy.title}</strong><span>{copy.subtitle}</span></div>
        </div>
        <button type="button" className="cga-operation-primary-action" onClick={() => void loadDashboard()} disabled={loading || !botId}>{copy.refresh}</button>
      </header>

      <div className="cga-operation-summary cga-dashboard-summary">
        <article><strong>{copy.myTasks}</strong><span>{formatStudioOperationsDashboardText(copy.count, { count: dashboard.myTasks.length })}</span></article>
        <article><strong>{copy.reviewQueue}</strong><span>{formatStudioOperationsDashboardText(copy.count, { count: dashboard.reviewQueue.length })}</span></article>
        <article><strong>{copy.approvalRequired}</strong><span>{formatStudioOperationsDashboardText(copy.count, { count: dashboard.reviewQueue.length })}</span></article>
        <article><strong>{copy.lockedItems}</strong><span>{formatStudioOperationsDashboardText(copy.count, { count: dashboard.lockedItems.length })}</span></article>
        <article><strong>{copy.totalTasks}</strong><span>{formatStudioOperationsDashboardText(copy.count, { count: dashboard.workItems.length })}</span></article>
      </div>

      <div className="cga-dashboard-two-column">
        <MetricPanel title={copy.groupProgress} description={copy.groupProgressDescription} values={groupValues} countTemplate={copy.count} unspecified={copy.unspecified} />
        <MetricPanel title={copy.botProgress} description={copy.botProgressDescription} values={botValues} countTemplate={copy.count} unspecified={copy.unspecified} />
      </div>

      <MetricPanel title={copy.roleTasks} description={copy.roleTasksDescription} values={roleValues} countTemplate={copy.count} unspecified={copy.unspecified} />
      <MetricPanel title={copy.taskStatus} description={copy.taskStatusDescription} values={statusValues} countTemplate={copy.count} unspecified={copy.unspecified} />

      <div className="cga-dashboard-two-column">
        <article className="cga-dashboard-panel">
          <header><div><strong>{copy.recentUpdates}</strong><span>{copy.recentUpdatesDescription}</span></div></header>
          <div className="cga-dashboard-task-list">
            {dashboard.recentUpdates.length ? dashboard.recentUpdates.map((item) => (
              <div key={item.id} className="cga-dashboard-task">
                <strong>{item.title || item.id}</strong>
                <span>{item.group_name || selectedBot?.group_name || groupId} / {item.bot_name || selectedBot?.name || botId}</span>
                <span>{copy.assignee}: {dashboard.usersById.get(item.assignee_id || "")?.name || item.assignee_id || copy.unspecified}</span>
                <span>{copy.lastUpdated}: {formatDashboardDate(item.updated_at)}</span>
              </div>
            )) : <div className="cga-dashboard-empty">{copy.noRecentUpdates}</div>}
          </div>
        </article>
        <article className="cga-dashboard-panel">
          <header><div><strong>{copy.bottlenecks}</strong><span>{copy.bottlenecksDescription}</span></div></header>
          <div className="cga-dashboard-task-list">
            {dashboard.bottlenecks.length ? dashboard.bottlenecks.map((item) => (
              <div key={item.id} className={`cga-dashboard-task is-${item.status || "todo"}`}>
                <strong>{item.title || item.id}</strong>
                <span>{copy.statuses[item.status || ""] || item.status || "-"} · {selectedBot?.name || botId}</span>
                <span>{copy.lock}: {item.lock?.user_id || copy.none}</span>
                <span>{copy.assignee}: {dashboard.usersById.get(item.assignee_id || "")?.name || item.assignee_id || copy.unspecified}</span>
              </div>
            )) : <div className="cga-dashboard-empty">{copy.noBottlenecks}</div>}
          </div>
        </article>
      </div>

      <MetricPanel title={copy.assigneeWorkload} description={copy.assigneeWorkloadDescription} values={assigneeValues} countTemplate={copy.count} unspecified={copy.unspecified} />
      <div className={`cga-dashboard-message${message ? " is-error" : ""}`}>
        {message || (loading ? copy.loading : `${selectedBot?.name || copy.selectedBot} · ${formatDashboardDate(state?.updated_at)}`)}
      </div>
    </section>
  );
}
