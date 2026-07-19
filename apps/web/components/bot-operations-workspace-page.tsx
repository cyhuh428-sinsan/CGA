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
import { loadAuthSession, saveLastBotScreen, type AuthSession } from "@/lib/auth";
import {
  fetchStudioBots,
  fetchStudioWorkspaceContext,
  type StudioBotApiItem,
  type StudioWorkspaceContextApiResponse,
} from "@/lib/studio-bots-api";

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

export function BotOperationsWorkspacePage() {
  const router = useRouter();
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
      .catch((error) => setMessage(error instanceof Error ? error.message : "봇 목록을 불러오지 못했습니다."))
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
      .catch((error) => setMessage(error instanceof Error ? error.message : "작업공간 정보를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [selectedBot, session]);

  const workRows = useMemo(() => {
    const dialogs = selectedVersion?.version_json?.dialogs || [];
    return dialogs.slice(0, 18).map((item, index) => {
      const record = asRecord(item);
      const dialogType = readText(record, ["dialog_type", "type"]);
      return {
        id: readText(record, ["id", "dialog_id", "intent_id"]) || String(index + 1),
        type: dialogType === "2" || dialogType.toLowerCase() === "module" ? "모듈" : "의도",
        name: readText(record, ["display_name", "displayName", "name", "intent_name", "id"]),
      };
    });
  }, [selectedVersion]);

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
    setMessage("현재 작업 봇을 저장했습니다.");
  }

  const itemColumns = { "--operation-cols": ".8fr .8fr 1.6fr" } as CSSProperties;
  const recentColumns = { "--operation-cols": "1.5fr 1fr .8fr .8fr 1.1fr" } as CSSProperties;

  return (
    <section className="cga-operation-page">
      <header className="cga-operation-header">
        <div className="cga-operation-heading">
          <span className="cga-operation-code">BOT</span>
          <div><strong>봇 작업공간</strong><span>이미 생성된 봇과 버전을 선택해 작업을 이어가는 공간입니다.</span></div>
        </div>
        <button type="button" className="cga-operation-primary-action" onClick={saveWorkspace} disabled={!selectedBot}>저장</button>
      </header>

      <div className="cga-operation-summary cga-operation-summary--workspace">
        <article>
          <strong>그룹 선택</strong>
          <select value={session?.user.group_id || ""} disabled>
            <option value={session?.user.group_id || ""}>{session?.user.group_name || session?.user.group_code || "기본 그룹"}</option>
          </select>
        </article>
        <article><strong>그룹 내 접근 봇</strong><span>{bots.length}개</span></article>
        <article><strong>현재 작업 봇</strong><span>{selectedBot ? `${selectedBot.name} (${selectedBot.id})` : "없음"}</span></article>
        <article><strong>최근 작업</strong><span>{recentBots.length}개</span></article>
      </div>

      <div className="cga-workspace-grid">
        <aside className="cga-operation-panel cga-workspace-current-panel">
          <header><div><strong>현재 작업 대상</strong><span>선택된 봇 기준으로 작업합니다.</span></div></header>
          <label className="cga-workspace-bot-select">
            <span>봇 선택</span>
            <select value={selectedBotId} onChange={(event) => selectBot(event.target.value)}>
              {bots.map((bot) => <option key={bot.id} value={bot.id}>{bot.name}</option>)}
            </select>
          </label>
          <dl className="cga-operation-definition">
            <div><dt>그룹</dt><dd>{operationBotGroupName(session, selectedBot)}</dd></div>
            <div><dt>봇</dt><dd>{selectedBot?.name || "-"}</dd></div>
            <div><dt>버전</dt><dd>{selectedVersion ? versionName : "-"}</dd></div>
            <div><dt>상태</dt><dd>{selectedBot?.status || "-"}</dd></div>
            <div><dt>언어</dt><dd>{operationBotLocale(selectedBot)}</dd></div>
            <div><dt>마지막 작업</dt><dd>{formatOperationDate(selectedBot?.updated_at)}</dd></div>
          </dl>
          <div className="cga-operation-action-stack cga-operation-action-stack--plain">
            <button type="button" onClick={() => openCurrent("settings")} disabled={!selectedVersion}>봇 설정 열기</button>
            <button type="button" onClick={() => openCurrent("configure")} disabled={!selectedVersion}>봇 구성 열기</button>
            <button type="button" onClick={() => openCurrent("management")} disabled={!selectedVersion}>봇 관리 열기</button>
            <button type="button" onClick={() => openCurrent("build")} disabled={!selectedVersion}>봇 제작 열기</button>
          </div>
          <div className="cga-workspace-recent">
            <strong>최근 작업 봇</strong>
            <div className="cga-operation-table" style={recentColumns}>
              <div className="cga-operation-row cga-operation-row--head"><span>봇</span><span>ID</span><span>버전</span><span>상태</span><span>작업시각</span></div>
              {recentBots.map((item) => (
                <button key={item.botId} type="button" className="cga-operation-row cga-operation-row--button" onClick={() => selectBot(item.botId)}>
                  <span>{item.name}</span><span>{item.botId}</span><span>{item.version}</span><span>{item.botId === selectedBotId ? "현재봇" : item.status}</span><span>{new Date(item.touchedAt).toLocaleString()}</span>
                </button>
              ))}
              {recentBots.length === 0 ? <div className="cga-operation-empty">최근 작업 목록 없음</div> : null}
            </div>
          </div>
        </aside>

        <article className="cga-operation-panel cga-workspace-items-panel">
          <header><div><strong>작업 항목</strong><span>현재 봇의 의도와 모듈을 확인합니다.</span></div></header>
          <div className="cga-operation-table" style={itemColumns}>
            <div className="cga-operation-row cga-operation-row--head"><span>ID</span><span>구분</span><span>의도/모듈명</span></div>
            {workRows.map((item, index) => (
              <div key={`${item.id}-${index}`} className="cga-operation-row"><span>{item.id}</span><span>{item.type}</span><strong>{item.name}</strong></div>
            ))}
            {!loading && workRows.length === 0 ? <div className="cga-operation-empty">등록된 작업 항목이 없습니다.</div> : null}
          </div>
        </article>

        <aside className="cga-operation-panel cga-workspace-simulator-panel">
          <header><div><strong>시뮬레이터 미리보기</strong><span>선택 봇의 대화 흐름을 확인합니다.</span></div></header>
          <div className="cga-workspace-simulator-card">
            <div className="cga-workspace-simulator-top">
              <span className="cga-workspace-simulator-avatar" />
              <div><strong>{selectedBot?.name || "CGA Bot"}</strong><span>{versionName} / Simulator</span></div>
            </div>
            <div className="cga-workspace-simulator-body">
              <div className="cga-workspace-simulator-bubble">
                <button type="button">테스트종료</button><button type="button">FORM TITLE</button><button type="button">INPUT</button><button type="button">TEXTAREA</button><button type="button">IMAGE</button>
              </div>
            </div>
            <div className="cga-workspace-simulator-input"><input placeholder="챗봇과 대화를 진행하세요." /><button type="button">전송</button></div>
          </div>
        </aside>
      </div>
      {message ? <div className="cga-operation-floating-message">{message}</div> : null}
    </section>
  );
}
