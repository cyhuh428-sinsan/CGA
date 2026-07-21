"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";

import {
  downloadOperationJson,
  filterOperationBots,
  formatOperationDate,
  operationBotGroupName,
  operationBotLocale,
  operationVersionName,
  readOperationAiDetails,
  readOperationEvaluation,
  readOperationNluEngine,
  rememberOperationVersion,
  resolveInitialOperationBotId,
  safeOperationFilePart,
} from "@/components/bot-operation-shared";
import { loadAuthSession, type AuthSession } from "@/lib/auth";
import {
  activateStudioBotVersion,
  copyStudioBotVersion,
  createStudioBotVersion,
  deactivateStudioBotVersion,
  deleteStudioBotVersion,
  exportStudioBotAidotPackage,
  exportStudioBotVersionPackage,
  fetchStudioBots,
  fetchStudioBotVersions,
  importStudioBotAidotPackage,
  isStudioAidotBotPackage,
  updateStudioBotVersion,
  type StudioBotApiItem,
  type StudioBotVersionApiItem,
} from "@/lib/studio-bots-api";
import { normalizeVersionDocument, type VersionDocument } from "@/lib/version-document";

export function BotManagementPage() {
  const router = useRouter();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [bots, setBots] = useState<StudioBotApiItem[]>([]);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [versions, setVersions] = useState<StudioBotVersionApiItem[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const selectedBot = useMemo(
    () => bots.find((bot) => bot.id === selectedBotId) || null,
    [bots, selectedBotId],
  );
  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) || versions.find((version) => version.is_active) || versions[0] || null,
    [selectedVersionId, versions],
  );
  const activeVersion = useMemo(() => versions.find((version) => version.is_active) || null, [versions]);

  useEffect(() => {
    const currentSession = loadAuthSession();
    if (!currentSession) {
      router.replace("/login");
      return;
    }
    setSession(currentSession);
    const requestedBotId = new URLSearchParams(window.location.search).get("bot") || "";
    fetchStudioBots(currentSession.access_token, true)
      .then((items) => {
        const operationBots = filterOperationBots(currentSession, items);
        setBots(operationBots);
        setSelectedBotId(resolveInitialOperationBotId(currentSession, operationBots, requestedBotId));
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "봇 목록을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!session || !selectedBotId) {
      setVersions([]);
      return;
    }
    setBusy(true);
    fetchStudioBotVersions(session.access_token, selectedBotId, true)
      .then((items) => {
        const sorted = [...items].sort((left, right) => (right.updated_at || "").localeCompare(left.updated_at || ""));
        setVersions(sorted);
        setSelectedVersionId((current) => current && sorted.some((item) => item.id === current)
          ? current
          : (sorted.find((item) => item.is_active) || sorted[0])?.id || "");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "버전 목록을 불러오지 못했습니다."))
      .finally(() => setBusy(false));
  }, [selectedBotId, session]);

  function chooseBot(bot: StudioBotApiItem) {
    setSelectedBotId(bot.id);
    setSelectedVersionId("");
    router.replace(`/studio/bots?bot=${encodeURIComponent(bot.id)}`);
  }

  function chooseVersion(version: StudioBotVersionApiItem) {
    setSelectedVersionId(version.id);
    if (session && selectedBot) rememberOperationVersion(session, selectedBot, version);
  }

  async function refreshVersions(preferredId = "") {
    if (!session || !selectedBot) return;
    const items = await fetchStudioBotVersions(session.access_token, selectedBot.id, true);
    const sorted = [...items].sort((left, right) => (right.updated_at || "").localeCompare(left.updated_at || ""));
    setVersions(sorted);
    setSelectedVersionId(preferredId || (sorted.find((item) => item.is_active) || sorted[0])?.id || "");
  }

  async function runVersionAction(action: "add" | "copy" | "delete" | "activate") {
    if (!session || !selectedBot || (action !== "add" && !selectedVersion)) return;
    if (action === "delete" && !window.confirm(`${selectedVersion?.name} 버전을 삭제하시겠습니까?`)) return;
    setBusy(true);
    setMessage("");
    try {
      if (action === "add") {
        const nextNo = Math.max(0, ...versions.map((item) => item.version_no)) + 1;
        const created = await createStudioBotVersion(session.access_token, selectedBot.id, {
          name: `v${nextNo}`,
          description: "",
          comment: "빈 새 버전",
        });
        await refreshVersions(created.id);
        setMessage(`${created.name} 버전을 추가했습니다.`);
      } else if (action === "copy" && selectedVersion) {
        const copied = await copyStudioBotVersion(session.access_token, selectedBot.id, selectedVersion.id);
        await refreshVersions(copied.id);
        setMessage(`${selectedVersion.name} 버전을 복사했습니다.`);
      } else if (action === "delete" && selectedVersion) {
        await deleteStudioBotVersion(session.access_token, selectedBot.id, selectedVersion.id);
        await refreshVersions();
        setMessage(`${selectedVersion.name} 버전을 삭제했습니다.`);
      } else if (action === "activate" && selectedVersion) {
        const changed = selectedVersion.is_active
          ? await deactivateStudioBotVersion(session.access_token, selectedBot.id, selectedVersion.id)
          : await activateStudioBotVersion(session.access_token, selectedBot.id, selectedVersion.id);
        await refreshVersions(changed.id);
        setMessage(selectedVersion.is_active ? "운영 버전을 해제했습니다." : "운영 버전을 적용했습니다.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "버전 작업에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(aidot: boolean) {
    if (!session || !selectedBot || !selectedVersion) return;
    setBusy(true);
    setMessage("");
    try {
      const data = aidot
        ? await exportStudioBotAidotPackage(session.access_token, selectedBot.id, selectedVersion.id)
        : await exportStudioBotVersionPackage(session.access_token, selectedBot.id, selectedVersion.id);
      const prefix = aidot ? "Bot" : safeOperationFilePart(selectedBot.name);
      downloadOperationJson(
        `${prefix}_${safeOperationFilePart(selectedBot.name)}_${safeOperationFilePart(selectedVersion.name)}.json`,
        data,
      );
      setMessage(aidot ? "Aidot 봇 패키지를 다운로드했습니다." : "버전 파일을 다운로드했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "파일 다운로드에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(file: File | null) {
    if (!file || !session || !selectedBot || !selectedVersion) return;
    setBusy(true);
    setMessage("");
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (isStudioAidotBotPackage(parsed)) {
        const result = await importStudioBotAidotPackage(session.access_token, selectedBot.id, selectedVersion.id, parsed);
        await refreshVersions(result.version.id);
        setMessage(`Aidot 봇 패키지 ${file.name}을 업로드했습니다.`);
      } else {
        const source = parsed && typeof parsed === "object" && !Array.isArray(parsed) && "version_json" in parsed
          ? (parsed as { version_json?: Partial<VersionDocument> }).version_json
          : parsed;
        if (!source || typeof source !== "object" || Array.isArray(source)) {
          throw new Error("버전 파일 형식이 맞지 않습니다.");
        }
        const changed = await updateStudioBotVersion(session.access_token, selectedBot.id, selectedVersion.id, {
          version_json: normalizeVersionDocument(source as Partial<VersionDocument>),
        });
        await refreshVersions(changed.id);
        setMessage(`버전 파일 ${file.name}을 업로드했습니다.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "JSON 파일 업로드에 실패했습니다.");
    } finally {
      if (uploadRef.current) uploadRef.current.value = "";
      setBusy(false);
    }
  }

  const counts = selectedVersion?.asset_counts;
  const aiDetails = selectedBot && selectedVersion
    ? readOperationAiDetails(selectedBot, selectedVersion)
    : { nluType: "-", nluModel: "-", answerMode: "-", llmModel: "-" };
  const columns = {
    "--operation-cols": ".55fr .65fr .75fr 1.35fr .45fr .45fr .45fr .45fr .55fr .95fr .85fr 1fr",
  } as CSSProperties;

  return (
    <section className="cga-operation-page">
      <header className="cga-operation-header">
        <div className="cga-operation-heading">
          <span className="cga-operation-code">BM</span>
          <div><strong>봇 관리</strong><span>봇 단위 자산/버전/운영 상태를 Aidot 호환 기준으로 관리합니다.</span></div>
        </div>
        <Link href="/studio/bots/new" className="cga-operation-primary-action">+ 봇 생성</Link>
      </header>

      <div className="cga-operation-summary cga-operation-summary--management">
        <article><strong>그룹</strong><span>{operationBotGroupName(session, selectedBot)}</span></article>
        <article><strong>봇 수</strong><span>{bots.length}개</span></article>
        <article><strong>선택 봇</strong><span>{selectedBot?.name || "-"}</span></article>
        <article><strong>버전 항목</strong><span>{versions.length}개</span></article>
        <article><strong>작업 버전</strong><span>{selectedVersion ? operationVersionName(selectedVersion) : "-"}</span></article>
        <article><strong>운영 버전</strong><span>{activeVersion ? operationVersionName(activeVersion) : "-"}</span></article>
      </div>

      <div className="cga-bot-management-grid">
        <article className="cga-operation-panel cga-operation-panel--bot-list">
          <header><div><strong>봇 목록 조회</strong><span>그룹 내 봇 목록과 기본 상태입니다.</span></div></header>
          <div className="cga-bot-card-list">
            {bots.map((bot) => (
              <button key={bot.id} type="button" className={`cga-bot-select-card${bot.id === selectedBotId ? " is-selected" : ""}`} onClick={() => chooseBot(bot)}>
                <strong>{bot.name}</strong>
                <span>{bot.id} · {bot.active_version?.name || "-"} · {bot.status}</span>
                <span>locale: {operationBotLocale(bot)}</span>
              </button>
            ))}
            {!loading && bots.length === 0 ? <div className="cga-operation-empty">관리할 봇이 없습니다.</div> : null}
          </div>
        </article>

        <article className="cga-operation-panel cga-operation-panel--versions">
          <header>
            <div><strong>봇 자산 / 버전</strong><span>작업 버전과 운영 버전을 구분해 관리합니다.</span></div>
            <div className="cga-operation-inline-actions">
              <button type="button" onClick={() => runVersionAction("add")} disabled={busy || !selectedBot}>버전 추가</button>
              <button type="button" onClick={() => runVersionAction("copy")} disabled={busy || !selectedVersion}>복사</button>
              <button type="button" onClick={() => runVersionAction("delete")} disabled={busy || !selectedVersion || selectedVersion.is_active}>삭제</button>
              <button type="button" onClick={() => uploadRef.current?.click()} disabled={busy || !selectedVersion}>버전 파일 업로드</button>
              <button type="button" onClick={() => handleDownload(false)} disabled={busy || !selectedVersion}>버전 파일 다운로드</button>
              <button type="button" onClick={() => runVersionAction("activate")} disabled={busy || !selectedVersion}>운영/해제</button>
            </div>
          </header>
          <div className="cga-operation-table cga-operation-table--versions" style={columns}>
            <div className="cga-operation-row cga-operation-row--head">
              <span>선택</span><span>버전</span><span>상태</span><span>최종 학습 엔진</span><span>의도</span><span>개체</span><span>사전</span><span>API</span><span>평가</span><span>최종수정일시</span><span>최종수정자</span><span>비고</span>
            </div>
            {versions.map((version) => (
              <button key={version.id} type="button" className={`cga-operation-row cga-operation-row--button${version.id === selectedVersion?.id ? " is-selected" : ""}`} onClick={() => chooseVersion(version)}>
                <span><input type="radio" readOnly checked={version.id === selectedVersion?.id} aria-label={`${version.name} 선택`} /></span>
                <strong>{operationVersionName(version)}</strong>
                <span>{version.status}</span>
                <span>{selectedBot ? readOperationNluEngine(selectedBot, version) : "-"}</span>
                <span>{version.asset_counts?.intents ?? 0}</span>
                <span>{version.asset_counts?.entities ?? 0}</span>
                <span>{version.asset_counts?.dictionary ?? 0}</span>
                <span>{version.asset_counts?.apis ?? 0}</span>
                <span>{readOperationEvaluation(version)}</span>
                <span>{formatOperationDate(version.updated_at)}</span>
                <span>{version.updated_by_login_id || "-"}</span>
                <span>{version.comment || (version.is_active ? "운영 버전" : version.id === selectedVersion?.id ? "작업 버전" : "-")}</span>
              </button>
            ))}
            {!busy && versions.length === 0 ? <div className="cga-operation-empty">버전 이력이 없습니다.</div> : null}
          </div>
        </article>

        <article className="cga-operation-panel cga-operation-panel--bot-detail">
          <header><div><strong>봇 상세 정보 및 호환 운영</strong><span>선택한 작업 버전 패키지와 운영 상태를 관리합니다.</span></div></header>
          <dl className="cga-operation-definition">
            <div><dt>봇 ID</dt><dd>{selectedBot?.id || "-"}</dd></div>
            <div><dt>봇 이름</dt><dd>{selectedBot?.name || "-"}</dd></div>
            <div><dt>작업버전</dt><dd>{selectedVersion ? operationVersionName(selectedVersion) : "-"}</dd></div>
            <div><dt>운영버전</dt><dd>{activeVersion ? operationVersionName(activeVersion) : "-"}</dd></div>
            <div><dt>상태</dt><dd>{selectedBot?.status || "-"}</dd></div>
            <div><dt>언어</dt><dd>{operationBotLocale(selectedBot)}</dd></div>
            <div><dt>NLU 방식</dt><dd>{aiDetails.nluType}</dd></div>
            <div><dt>NLU 모델</dt><dd>{aiDetails.nluModel}</dd></div>
            <div><dt>답변 방식</dt><dd>{aiDetails.answerMode}</dd></div>
            <div><dt>LLM</dt><dd>{aiDetails.llmModel}</dd></div>
            <div><dt>버전 목록</dt><dd>{versions.length}개</dd></div>
            <div><dt>업데이트</dt><dd>{formatOperationDate(selectedBot?.updated_at)}</dd></div>
          </dl>
          <div className="cga-operation-action-stack">
            <button type="button" onClick={() => handleDownload(true)} disabled={busy || !selectedVersion}><strong>Aidot 봇 패키지 다운로드</strong><span>현재 작업 버전 1개</span></button>
            <button type="button" onClick={() => uploadRef.current?.click()} disabled={busy || !selectedVersion}><strong>Aidot 봇 패키지 업로드</strong><span>현재 작업 버전에 반영</span></button>
          </div>
          <div className={`cga-operation-note${message ? " is-active" : ""}`}>
            {message || (loading || busy
              ? "봇 정보를 불러오는 중입니다."
              : `의도 ${counts?.intents ?? 0} · 개체 ${counts?.entities ?? 0} · 사전 ${counts?.dictionary ?? 0} · API ${counts?.apis ?? 0}`)}
          </div>
          <input ref={uploadRef} type="file" accept="application/json,.json" hidden onChange={(event) => handleUpload(event.target.files?.[0] || null)} />
        </article>
      </div>
    </section>
  );
}
