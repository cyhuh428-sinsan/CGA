"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { filterOperationBots, resolveInitialOperationBotId } from "@/components/bot-operation-shared";
import { loadAuthSession, type AuthSession } from "@/lib/auth";
import { fetchStudioBots, type StudioBotApiItem } from "@/lib/studio-bots-api";

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
const STATUS_LABELS: Record<string, string> = {
  todo: "할 일",
  in_progress: "진행 중",
  review: "검토 대기",
  approved: "승인 완료",
  blocked: "차단",
};
const ROLE_LABELS: Record<string, string> = {
  owner: "소유자",
  system_admin: "시스템 관리자",
  group_admin: "그룹 관리자",
  builder: "제작자",
  reviewer: "검수자",
  operator: "운영자",
  viewer: "조회자",
};

function formatDashboardDate(value?: string | null) {
  return value ? value.replace("T", " ").slice(0, 16) : "-";
}

function countBy(items: DashboardWorkItem[], getKey: (item: DashboardWorkItem) => string) {
  return items.reduce<Record<string, number>>((result, item) => {
    const key = getKey(item) || "미지정";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function MetricPanel({ title, description, values }: {
  title: string;
  description: string;
  values: Array<{ key: string; label: string; count: number; status?: string }>;
}) {
  return (
    <article className="cga-dashboard-panel">
      <header><div><strong>{title}</strong><span>{description}</span></div></header>
      <div className="cga-dashboard-metric-strip">
        {values.length ? values.map((item) => (
          <div key={item.key} className={`cga-dashboard-metric${item.status ? ` is-${item.status}` : ""}`}>
            <strong>{item.label}</strong><span>{item.count}건</span>
          </div>
        )) : <div className="cga-dashboard-metric"><strong>미지정</strong><span>0건</span></div>}
      </div>
    </article>
  );
}

export function OperationsDashboardPage() {
  const router = useRouter();
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
      .catch((error) => setMessage(error instanceof Error ? error.message : "봇 목록을 불러오지 못했습니다."))
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
      if (!response.ok) throw new Error(payload.detail || "운영 대시보드를 불러오지 못했습니다.");
      setState(payload);
    } catch (error) {
      setState(null);
      setMessage(error instanceof Error ? error.message : "운영 대시보드를 불러오지 못했습니다.");
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
    const groupCounts = countBy(workItems, (item) => item.group_name || item.group_id || selectedBot?.group_name || groupId);
    const botCounts = countBy(workItems, (item) => item.bot_name || item.bot_id || selectedBot?.name || botId);
    const assigneeCounts = countBy(workItems, (item) => usersById.get(item.assignee_id || "")?.name || item.assignee_id || "미지정");
    const roleCounts = workItems.reduce<Record<string, number>>((result, item) => {
      const role = usersById.get(item.assignee_id || "")?.role || "viewer";
      result[role] = (result[role] || 0) + 1;
      return result;
    }, {});
    return { workItems, usersById, myTasks, reviewQueue, lockedItems, recentUpdates, bottlenecks, groupCounts, botCounts, assigneeCounts, roleCounts };
  }, [botId, groupId, selectedBot, session, state]);

  const groupValues = Object.entries(dashboard.groupCounts).map(([label, count]) => ({ key: label, label, count }));
  const botValues = Object.entries(dashboard.botCounts).map(([label, count]) => ({ key: label, label, count }));
  const roleValues = Object.entries(dashboard.roleCounts).map(([role, count]) => ({ key: role, label: ROLE_LABELS[role] || role, count }));
  const assigneeValues = Object.entries(dashboard.assigneeCounts).map(([label, count]) => ({ key: label, label, count }));
  const statusValues = STATUS_ORDER.map((status) => ({
    key: status,
    label: STATUS_LABELS[status],
    count: dashboard.workItems.filter((item) => item.status === status).length,
    status,
  }));

  return (
    <section className="cga-operation-page cga-dashboard-page">
      <header className="cga-operation-header">
        <div className="cga-operation-heading">
          <span className="cga-operation-code">OD</span>
          <div><strong>운영 대시보드</strong><span>운영 대시보드 기준으로 API, 채널, 봇 상태와 알림을 확인합니다.</span></div>
        </div>
        <button type="button" className="cga-operation-primary-action" onClick={() => void loadDashboard()} disabled={loading || !botId}>새로고침</button>
      </header>

      <div className="cga-operation-summary cga-dashboard-summary">
        <article><strong>내 작업</strong><span>{dashboard.myTasks.length}건</span></article>
        <article><strong>검토 대기</strong><span>{dashboard.reviewQueue.length}건</span></article>
        <article><strong>승인 필요</strong><span>{dashboard.reviewQueue.length}건</span></article>
        <article><strong>잠금 상태</strong><span>{dashboard.lockedItems.length}건</span></article>
        <article><strong>전체 작업</strong><span>{dashboard.workItems.length}건</span></article>
      </div>

      <div className="cga-dashboard-two-column">
        <MetricPanel title="그룹별 진행률" description="그룹 기준 진행 건수" values={groupValues} />
        <MetricPanel title="봇별 진행률" description="봇 단위 진행 건수" values={botValues} />
      </div>

      <MetricPanel title="권한별 할 일" description="역할 기준 누적 항목 수입니다." values={roleValues} />
      <MetricPanel title="작업 상태" description="전체 작업 흐름 상태입니다." values={statusValues} />

      <div className="cga-dashboard-two-column">
        <article className="cga-dashboard-panel">
          <header><div><strong>최근 수정 이력</strong><span>최근 수정 순서로 작업 항목을 확인합니다.</span></div></header>
          <div className="cga-dashboard-task-list">
            {dashboard.recentUpdates.length ? dashboard.recentUpdates.map((item) => (
              <div key={item.id} className="cga-dashboard-task">
                <strong>{item.title || item.id}</strong>
                <span>{item.group_name || selectedBot?.group_name || groupId} / {item.bot_name || selectedBot?.name || botId}</span>
                <span>담당자: {dashboard.usersById.get(item.assignee_id || "")?.name || item.assignee_id || "미지정"}</span>
                <span>최근수정: {formatDashboardDate(item.updated_at)}</span>
              </div>
            )) : <div className="cga-dashboard-empty">최근 수정 이력이 없습니다.</div>}
          </div>
        </article>
        <article className="cga-dashboard-panel">
          <header><div><strong>병목 항목</strong><span>잠금, 검토 지연, 차단 항목을 우선 모읍니다.</span></div></header>
          <div className="cga-dashboard-task-list">
            {dashboard.bottlenecks.length ? dashboard.bottlenecks.map((item) => (
              <div key={item.id} className={`cga-dashboard-task is-${item.status || "todo"}`}>
                <strong>{item.title || item.id}</strong>
                <span>{STATUS_LABELS[item.status || ""] || item.status || "-"} · {selectedBot?.name || botId}</span>
                <span>잠금: {item.lock?.user_id || "없음"}</span>
                <span>담당자: {dashboard.usersById.get(item.assignee_id || "")?.name || item.assignee_id || "미지정"}</span>
              </div>
            )) : <div className="cga-dashboard-empty">현재 병목 항목이 없습니다.</div>}
          </div>
        </article>
      </div>

      <MetricPanel title="담당자별 작업량" description="현재 협업 배분 상태입니다." values={assigneeValues} />
      <div className={`cga-dashboard-message${message ? " is-error" : ""}`}>
        {message || (loading ? "운영 현황을 불러오는 중입니다." : `${selectedBot?.name || "선택 봇"} · ${formatDashboardDate(state?.updated_at)}`)}
      </div>
    </section>
  );
}
