"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DataGrid, dataGridCellText, type DataGridRow, type DataGridSortState } from "@/components/data-grid";
import {
  fetchAuditLogs,
  fetchSystemLogs,
  type AdminAuditLogFilter,
  type AdminAuditLogItem,
  type AdminSystemLogFilter,
  type AdminSystemLogItem,
} from "@/lib/admin-api";
import { loadAuthSession } from "@/lib/auth";
import {
  LIST_PAGE_SIZE_OPTIONS,
  type ListPageSize,
  usePersistedPageSize,
} from "@/lib/use-persisted-page-size";

const ACTION_OPTIONS = [
  { value: "", label: "전체 작업" },
  { value: "admin.user.update", label: "사용자 수정" },
  { value: "admin.user.status", label: "계정 상태 변경" },
  { value: "admin.user.role", label: "역할 변경" },
  { value: "admin.group.update", label: "그룹 수정" },
  { value: "admin.channel.update", label: "채널 수정" },
  { value: "admin.template.update", label: "템플릿 수정" },
  { value: "admin.default_message.update", label: "기본 메시지 수정" },
  { value: "bot.version.nlu.train", label: "학습 실행" },
];

const TARGET_OPTIONS = [
  { value: "", label: "전체 대상" },
  { value: "user", label: "사용자" },
  { value: "group", label: "그룹" },
  { value: "channel", label: "채널" },
  { value: "template", label: "템플릿" },
  { value: "default_message", label: "기본 메시지" },
  { value: "bot_version", label: "봇 버전" },
];

const SYSTEM_LEVEL_OPTIONS = [
  { value: "", label: "전체 레벨" },
  { value: "INFO", label: "INFO" },
  { value: "WARNING", label: "WARNING" },
  { value: "ERROR", label: "ERROR" },
];

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function todayDateText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function downloadCsv(rows: AdminAuditLogItem[]) {
  const headers = ["작업", "대상", "대상 ID", "사용자", "IP", "발생일시", "요약"];
  const lines = rows.map((item) =>
    [
      item.action_type,
      item.target_type,
      item.target_id ?? "",
      item.actor_login_id,
      item.ip_address ?? "",
      formatDate(item.created_at),
      item.summary,
    ]
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
      .join(","),
  );
  const blob = new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `aidot-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadSystemJson(rows: AdminSystemLogItem[]) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `aidot-system-logs-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function sortRows(rows: DataGridRow[], sortState: DataGridSortState | null) {
  if (!sortState) {
    return rows;
  }
  return [...rows].sort((left, right) => {
    const leftText = dataGridCellText(left.cells[sortState.columnIndex]);
    const rightText = dataGridCellText(right.cells[sortState.columnIndex]);
    const result = leftText.localeCompare(rightText, "ko-KR", { numeric: true, sensitivity: "base" });
    return sortState.direction === "asc" ? result : -result;
  });
}

function systemLogParamsFromUrl() {
  if (typeof window === "undefined") {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const query = params.get("request_id") || params.get("query") || "";
  if (params.get("tab") !== "system" && !query) {
    return null;
  }
  return {
    file: params.get("file") === "error" ? ("error" as const) : ("app" as const),
    query,
  };
}

function systemElapsedMs(item: AdminSystemLogItem) {
  const value = item.elapsed_ms;
  return typeof value === "number" || typeof value === "string" ? String(value) : "-";
}

export default function AdminAuditLogsPage() {
  const today = todayDateText();
  const [token, setToken] = useState("");
  const [activeTab, setActiveTab] = useState<"audit" | "system">("audit");

  const [query, setQuery] = useState("");
  const [actionType, setActionType] = useState("");
  const [targetType, setTargetType] = useState("");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [appliedFilter, setAppliedFilter] = useState<AdminAuditLogFilter>({
    fromDate: today,
    toDate: today,
  });
  const [items, setItems] = useState<AdminAuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selected, setSelected] = useState<AdminAuditLogItem | null>(null);

  const [systemQuery, setSystemQuery] = useState("");
  const [systemFile, setSystemFile] = useState<"app" | "error">("app");
  const [systemLevel, setSystemLevel] = useState("");
  const [systemEvent, setSystemEvent] = useState("");
  const [systemAppliedFilter, setSystemAppliedFilter] = useState<AdminSystemLogFilter>({ file: "app", limit: 500 });
  const [systemItems, setSystemItems] = useState<AdminSystemLogItem[]>([]);
  const [systemTotal, setSystemTotal] = useState(0);
  const [systemLogFile, setSystemLogFile] = useState("app.log");
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemErrorMessage, setSystemErrorMessage] = useState("");
  const [selectedSystem, setSelectedSystem] = useState<AdminSystemLogItem | null>(null);

  const [pageSize, setPageSize] = usePersistedPageSize<ListPageSize>(
    "aidot.page_size.admin.audit_logs",
    100,
    LIST_PAGE_SIZE_OPTIONS,
  );
  const [page, setPage] = useState(1);
  const [systemPage, setSystemPage] = useState(1);
  const [sortState, setSortState] = useState<DataGridSortState | null>(null);
  const [systemSortState, setSystemSortState] = useState<DataGridSortState | null>(null);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      setLoading(false);
      setErrorMessage("로그인이 필요합니다.");
      return;
    }
    setToken(session.access_token);
  }, []);

  useEffect(() => {
    const params = systemLogParamsFromUrl();
    if (!params) {
      return;
    }
    setActiveTab("system");
    setSystemQuery(params.query);
    setSystemFile(params.file);
    setSystemLevel("");
    setSystemEvent("");
    setSystemAppliedFilter({
      file: params.file,
      query: params.query.trim() || undefined,
      limit: 500,
    });
    setSystemPage(1);
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    let ignore = false;
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const response = await fetchAuditLogs(token, appliedFilter);
        if (ignore) {
          return;
        }
        setTotal(response.total);
        setItems(response.items);
      } catch (error) {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : "운영 로그를 불러오지 못했습니다.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      ignore = true;
      window.clearTimeout(timeout);
    };
  }, [appliedFilter, token]);

  useEffect(() => {
    if (!token || activeTab !== "system") {
      return;
    }

    let ignore = false;
    const timeout = window.setTimeout(async () => {
      setSystemLoading(true);
      setSystemErrorMessage("");
      try {
        const response = await fetchSystemLogs(token, systemAppliedFilter);
        if (ignore) {
          return;
        }
        setSystemTotal(response.total);
        setSystemItems(response.items);
        setSystemLogFile(response.log_file);
      } catch (error) {
        if (!ignore) {
          setSystemErrorMessage(error instanceof Error ? error.message : "시스템 로그를 불러오지 못했습니다.");
        }
      } finally {
        if (!ignore) {
          setSystemLoading(false);
        }
      }
    }, 250);

    return () => {
      ignore = true;
      window.clearTimeout(timeout);
    };
  }, [activeTab, systemAppliedFilter, token]);

  function handleSearch() {
    setAppliedFilter({
      query: query.trim() || undefined,
      actionType: actionType || undefined,
      targetType: targetType || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    });
    setPage(1);
  }

  function handleSystemSearch() {
    setSystemAppliedFilter({
      file: systemFile,
      query: systemQuery.trim() || undefined,
      level: systemLevel || undefined,
      event: systemEvent.trim() || undefined,
      limit: 500,
    });
    setSystemPage(1);
  }

  function handleSystemRequestIdSearch(requestId: string | null | undefined) {
    const nextQuery = requestId?.trim();
    if (!nextQuery) {
      return;
    }

    setActiveTab("system");
    setSystemQuery(nextQuery);
    setSystemLevel("");
    setSystemEvent("");
    setSystemAppliedFilter({
      file: systemFile,
      query: nextQuery,
      limit: 500,
    });
    setSystemPage(1);
    setSelectedSystem(null);
  }

  function handleSlowApiSearch() {
    setActiveTab("system");
    setSystemFile("app");
    setSystemLevel("WARNING");
    setSystemEvent("api.slow_request");
    setSystemQuery("");
    setSystemAppliedFilter({
      file: "app",
      level: "WARNING",
      event: "api.slow_request",
      limit: 500,
    });
    setSystemPage(1);
    setSelectedSystem(null);
  }

  const allRows = useMemo<DataGridRow[]>(
    () =>
      items.map((item) => ({
        key: item.id,
        cells: [
          item.action_type,
          item.target_type,
          item.actor_login_id,
          item.ip_address ?? "-",
          formatDate(item.created_at),
          item.summary,
          <button key="detail" type="button" className="admin-page__link-button" onClick={() => setSelected(item)}>
            상세
          </button>,
        ],
      })),
    [items],
  );
  const sortedRows = useMemo(() => sortRows(allRows, sortState), [allRows, sortState]);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const rows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

  const allSystemRows = useMemo<DataGridRow[]>(
    () =>
      systemItems.map((item) => ({
        key: item.id,
        cells: [
          formatDate(item.time),
          item.level || "-",
          item.event || "-",
          item.path || "-",
          systemElapsedMs(item),
          item.status_code === null ? "-" : String(item.status_code),
          item.message || "-",
          item.request_id || "-",
          <button key="detail" type="button" className="admin-page__link-button" onClick={() => setSelectedSystem(item)}>
            상세
          </button>,
        ],
      })),
    [systemItems],
  );
  const sortedSystemRows = useMemo(() => sortRows(allSystemRows, systemSortState), [allSystemRows, systemSortState]);
  const systemTotalPages = Math.max(1, Math.ceil(sortedSystemRows.length / pageSize));
  const systemRows = sortedSystemRows.slice((systemPage - 1) * pageSize, systemPage * pageSize);

  useEffect(() => {
    setPage(1);
    setSystemPage(1);
  }, [pageSize, sortState, systemSortState]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (systemPage > systemTotalPages) {
      setSystemPage(systemTotalPages);
    }
  }, [systemPage, systemTotalPages]);

  return (
    <section className="admin-page">
      <h2>운영 로그 조회</h2>

      <div className="admin-page__tabs" role="tablist" aria-label="운영 로그 유형">
        <button type="button" className={activeTab === "audit" ? "is-active" : ""} onClick={() => setActiveTab("audit")}>
          감사 로그
        </button>
        <button type="button" className={activeTab === "system" ? "is-active" : ""} onClick={() => setActiveTab("system")}>
          시스템 로그
        </button>
      </div>

      {activeTab === "audit" ? (
        <>
          <div className="admin-page__search-row admin-audit-logs__search-row">
            <label className="admin-page__search">
              <span aria-hidden="true">⌕</span>
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="작업, 대상, 사용자, IP 또는 내용을 검색하세요."
              />
            </label>

            <select className="login-select" value={actionType} onChange={(event) => setActionType(event.target.value)}>
              {ACTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select className="login-select" value={targetType} onChange={(event) => setTargetType(event.target.value)}>
              {TARGET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <input type="date" className="login-select" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="조회 시작일" />
            <input type="date" className="login-select" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="조회 종료일" />

            <div className="admin-page__search-actions">
              <button type="button" className="admin-page__primary" onClick={handleSearch}>
                조회
              </button>
            </div>
          </div>

          <div className="admin-page__toolbar">
            <div className="admin-page__toolbar-left">
              <strong>전체 {total}건</strong>
              <label className="manual-main__mini-select manual-main__mini-select--select">
                <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as ListPageSize)}>
                  {LIST_PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}개씩 보기
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="admin-page__ghost" onClick={() => downloadCsv(items)} disabled={items.length === 0}>
                다운로드
              </button>
            </div>
          </div>

          {errorMessage ? (
            <div className="admin-state-box">
              <p>{errorMessage}</p>
              <Link href="/login" className="ghost-pill">
                로그인으로 이동
              </Link>
            </div>
          ) : null}

          {!errorMessage ? (
            <>
              <DataGrid
                variant="admin"
                template="220px 140px 150px 160px 190px minmax(260px, 1fr) 90px"
                columns={["작업", "대상", "사용자", "IP", "발생일시", "요약", "상세"]}
                rows={loading ? [] : rows}
                sortableColumns={[true, true, true, true, true, true, false]}
                sortState={sortState}
                onSort={setSortState}
              />

              {loading ? <p className="admin-page__empty">불러오는 중입니다...</p> : null}
              {!loading && items.length === 0 ? <p className="admin-page__empty">조회 결과가 없습니다.</p> : null}

              <div className="admin-page__pagination">
                <button type="button" disabled={page === 1} onClick={() => setPage(1)}>
                  «
                </button>
                <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  ‹
                </button>
                <button type="button" className="is-active">
                  {page}
                </button>
                <button type="button" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                  ›
                </button>
                <button type="button" disabled={page === totalPages} onClick={() => setPage(totalPages)}>
                  »
                </button>
              </div>
            </>
          ) : null}
        </>
      ) : (
        <>
          <div className="admin-page__search-row admin-system-logs__search-row">
            <label className="admin-page__search">
              <span aria-hidden="true">⌕</span>
              <input
                type="text"
                value={systemQuery}
                onChange={(event) => setSystemQuery(event.target.value)}
                placeholder="메시지, 이벤트, 요청 ID, 경로를 검색하세요."
              />
            </label>
            <select className="login-select" value={systemFile} onChange={(event) => setSystemFile(event.target.value as "app" | "error")}>
              <option value="app">app.log</option>
              <option value="error">error.log</option>
            </select>
            <select className="login-select" value={systemLevel} onChange={(event) => setSystemLevel(event.target.value)}>
              {SYSTEM_LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input className="login-select" type="text" value={systemEvent} onChange={(event) => setSystemEvent(event.target.value)} placeholder="이벤트" />
            <div className="admin-page__search-actions">
              <button type="button" className="admin-page__ghost" onClick={handleSlowApiSearch}>
                느린 API
              </button>
              <button type="button" className="admin-page__primary" onClick={handleSystemSearch}>
                조회
              </button>
            </div>
          </div>

          <div className="admin-page__toolbar">
            <div className="admin-page__toolbar-left">
              <strong>전체 {systemTotal}건</strong>
              <span className="admin-page__muted">파일 {systemLogFile}</span>
              <label className="manual-main__mini-select manual-main__mini-select--select">
                <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as ListPageSize)}>
                  {LIST_PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}개씩 보기
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="admin-page__ghost" onClick={() => downloadSystemJson(systemItems)} disabled={systemItems.length === 0}>
                다운로드
              </button>
            </div>
          </div>

          {systemErrorMessage ? (
            <div className="admin-state-box">
              <p>{systemErrorMessage}</p>
              <Link href="/login" className="ghost-pill">
                로그인으로 이동
              </Link>
            </div>
          ) : null}

          {!systemErrorMessage ? (
            <>
              <DataGrid
                variant="admin"
                template="190px 90px 220px minmax(220px, 1fr) 90px 90px minmax(280px, 1.4fr) 260px 90px"
                columns={["일시", "레벨", "이벤트", "경로", "소요(ms)", "상태", "메시지", "요청 ID", "상세"]}
                rows={systemLoading ? [] : systemRows}
                sortableColumns={[true, true, true, true, true, true, true, true, false]}
                sortState={systemSortState}
                onSort={setSystemSortState}
              />
              {systemLoading ? <p className="admin-page__empty">불러오는 중입니다...</p> : null}
              {!systemLoading && systemItems.length === 0 ? <p className="admin-page__empty">조회 결과가 없습니다.</p> : null}

              <div className="admin-page__pagination">
                <button type="button" disabled={systemPage === 1} onClick={() => setSystemPage(1)}>
                  «
                </button>
                <button type="button" disabled={systemPage === 1} onClick={() => setSystemPage((current) => Math.max(1, current - 1))}>
                  ‹
                </button>
                <button type="button" className="is-active">
                  {systemPage}
                </button>
                <button type="button" disabled={systemPage === systemTotalPages} onClick={() => setSystemPage((current) => Math.min(systemTotalPages, current + 1))}>
                  ›
                </button>
                <button type="button" disabled={systemPage === systemTotalPages} onClick={() => setSystemPage(systemTotalPages)}>
                  »
                </button>
              </div>
            </>
          ) : null}
        </>
      )}

      {selected ? (
        <div className="admin-modal-backdrop" role="presentation" onClick={() => setSelected(null)}>
          <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="audit-log-detail-title" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal__header">
              <h3 id="audit-log-detail-title">감사 로그 상세</h3>
              <button type="button" className="icon-button" onClick={() => setSelected(null)} aria-label="닫기">
                ×
              </button>
            </div>
            <label>
              작업
              <input type="text" value={selected.action_type} readOnly />
            </label>
            <label>
              대상
              <input type="text" value={`${selected.target_type}${selected.target_id ? ` / ${selected.target_id}` : ""}`} readOnly />
            </label>
            <label>
              사용자
              <input type="text" value={selected.actor_login_id} readOnly />
            </label>
            <label>
              발생일시
              <input type="text" value={formatDate(selected.created_at)} readOnly />
            </label>
            <label className="admin-modal__wide">
              상세 데이터
              <textarea value={JSON.stringify(selected.data_json, null, 2)} readOnly rows={14} />
            </label>
            <div className="admin-modal__actions">
              <button type="button" className="admin-page__primary" onClick={() => setSelected(null)}>
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedSystem ? (
        <div className="admin-modal-backdrop" role="presentation" onClick={() => setSelectedSystem(null)}>
          <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="system-log-detail-title" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal__header">
              <h3 id="system-log-detail-title">시스템 로그 상세</h3>
              <button type="button" className="icon-button" onClick={() => setSelectedSystem(null)} aria-label="닫기">
                ×
              </button>
            </div>
            <label>
              이벤트
              <input type="text" value={selectedSystem.event ?? "-"} readOnly />
            </label>
            <label>
              레벨
              <input type="text" value={selectedSystem.level || "-"} readOnly />
            </label>
            <label>
              로거
              <input type="text" value={selectedSystem.logger || "-"} readOnly />
            </label>
            <label>
              Method
              <input type="text" value={selectedSystem.method ?? "-"} readOnly />
            </label>
            <label>
              경로
              <input type="text" value={selectedSystem.path ?? "-"} readOnly />
            </label>
            <label>
              상태 코드
              <input type="text" value={selectedSystem.status_code === null ? "-" : String(selectedSystem.status_code)} readOnly />
            </label>
            <label>
              소요시간(ms)
              <input type="text" value={systemElapsedMs(selectedSystem)} readOnly />
            </label>
            <label>
              클라이언트
              <input type="text" value={selectedSystem.client ?? "-"} readOnly />
            </label>
            <label>
              요청 ID
              <input type="text" value={selectedSystem.request_id ?? "-"} readOnly />
            </label>
            <label className="admin-modal__wide">
              메시지
              <textarea value={selectedSystem.message || "-"} readOnly rows={4} />
            </label>
            {selectedSystem.exception ? (
              <label className="admin-modal__wide">
                예외
                <textarea value={selectedSystem.exception} readOnly rows={6} />
              </label>
            ) : null}
            <label className="admin-modal__wide">
              구조화 데이터
              <textarea value={JSON.stringify(selectedSystem.data, null, 2)} readOnly rows={10} />
            </label>
            <label className="admin-modal__wide">
              상세 데이터
              <textarea value={JSON.stringify({ ...selectedSystem, raw: undefined }, null, 2)} readOnly rows={14} />
            </label>
            <label className="admin-modal__wide">
              원문
              <textarea value={selectedSystem.raw} readOnly rows={6} />
            </label>
            <div className="admin-modal__actions">
              {selectedSystem.request_id ? (
                <button type="button" className="admin-page__ghost" onClick={() => handleSystemRequestIdSearch(selectedSystem.request_id)}>
                  요청 ID로 조회
                </button>
              ) : null}
              <button type="button" className="admin-page__primary" onClick={() => setSelectedSystem(null)}>
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
