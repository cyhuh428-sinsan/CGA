"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { DataGrid, dataGridCellText, type DataGridRow, type DataGridSortState } from "@/components/data-grid";
import {
  createChannel,
  deleteChannel,
  fetchChannels,
  testChannelConnection,
  updateChannel,
  type AdminChannelItem,
  type AdminChannelPayload,
} from "@/lib/admin-api";
import { loadAuthSession } from "@/lib/auth";
import {
  LIST_PAGE_SIZE_OPTIONS,
  type ListPageSize,
  usePersistedPageSize,
} from "@/lib/use-persisted-page-size";

type ChannelStatus = AdminChannelItem["status"];

function authTypeGuide(authType: string) {
  switch (authType) {
    case "token":
      return "Token: 요청 헤더의 고정 토큰으로 인증합니다. Kakao는 현재 none 또는 token만 실사용 기준입니다.";
    case "oauth":
      return "OAuth: 외부 서비스가 access token 발급 흐름을 제공할 때 사용합니다. 현재 Kakao 채널 1차 범위에서는 사용하지 않습니다.";
    case "basic":
      return "Basic: id/password를 Base64 헤더로 보내는 방식입니다. 현재 Kakao 채널 1차 범위에서는 사용하지 않습니다.";
    default:
      return "없음: 인증 없이 webhook을 받습니다. 내부 테스트나 초기 연결 확인용으로만 권장합니다.";
  }
}

function isKakaoDraft(provider: string, rendererType: string) {
  return provider.trim().toLowerCase() === "kakao" || rendererType.trim().toLowerCase() === "kakao";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function channelDataText(channel: AdminChannelItem, key: string, fallback = "-") {
  const value = channel.data_json[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function downloadChannels(items: AdminChannelItem[]) {
  const rows = [
    ["순서", "채널 아이디", "채널", "Provider", "렌더러 타입", "사용여부", "생성자", "최종수정자", "최종수정일시", "Endpoint URL", "인증방식", "인증정보JSON", "설명"],
    ...items.map((channel, index) => [
      String(index + 1),
      channel.code,
      channel.name,
      channelDataText(channel, "provider"),
      channelDataText(channel, "renderer_type"),
      channel.status_label,
      channel.creator_name,
      channel.updater_name,
      formatDate(channel.updated_at),
      channelDataText(channel, "endpoint_url", ""),
      channelDataText(channel, "auth_type", "none"),
      JSON.stringify(channel.data_json.auth_config ?? {}),
      channel.description ?? "",
    ]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "채널 관리.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuote = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];
    if (char === '"' && inQuote && nextChar === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (char === "," && !inQuote) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuote) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(cell.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  row.push(cell.trim());
  if (row.some(Boolean)) {
    rows.push(row);
  }
  return rows;
}

export default function AdminChannelsPage() {
  const [token, setToken] = useState("");
  const [channels, setChannels] = useState<AdminChannelItem[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminChannelItem | null>(null);
  const [draft, setDraft] = useState({
    code: "",
    name: "",
    provider: "webchat",
    renderer_type: "webchat",
    endpoint_url: "",
    auth_type: "none",
    auth_config: "",
    description: "",
    status: "active" as ChannelStatus,
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pageSize, setPageSize] = usePersistedPageSize<ListPageSize>(
    "aidot.page_size.admin.channels",
    10,
    LIST_PAGE_SIZE_OPTIONS,
  );
  const [page, setPage] = useState(1);
  const [sortState, setSortState] = useState<DataGridSortState | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    if (!token) {
      return;
    }

    let ignore = false;
    setLoading(true);
    setErrorMessage("");
    fetchChannels(token, {
      query: appliedQuery || undefined,
      status: appliedStatus || undefined,
    })
      .then((response) => {
        if (!ignore) {
          setChannels(response.items);
        }
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : "채널 목록을 불러오지 못했습니다.");
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
  }, [appliedQuery, appliedStatus, token]);

  function applySearch() {
    setAppliedQuery(query.trim());
    setAppliedStatus(status);
    setPage(1);
  }

  function resetSearch() {
    setQuery("");
    setStatus("");
    setAppliedQuery("");
    setAppliedStatus("");
    setPage(1);
  }

  function openCreate() {
    setEditing(null);
    setDraft({
      code: "",
      name: "",
      provider: "webchat",
      renderer_type: "webchat",
      endpoint_url: "",
      auth_type: "none",
      auth_config: "",
      description: "",
      status: "active",
    });
    setDialogOpen(true);
  }

  function openEdit(channel: AdminChannelItem) {
    setEditing(channel);
    setDraft({
      code: channel.code,
      name: channel.name,
      provider: String(channel.data_json.provider ?? "webchat"),
      renderer_type: String(channel.data_json.renderer_type ?? "webchat"),
      endpoint_url: String(channel.data_json.endpoint_url ?? ""),
      auth_type: String(channel.data_json.auth_type ?? "none"),
      auth_config: JSON.stringify(channel.data_json.auth_config ?? {}, null, 2),
      description: channel.description ?? "",
      status: channel.status,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
    setDraft({
      code: "",
      name: "",
      provider: "webchat",
      renderer_type: "webchat",
      endpoint_url: "",
      auth_type: "none",
      auth_config: "",
      description: "",
      status: "active",
    });
  }

  async function reload() {
    if (!token) {
      return;
    }
    const response = await fetchChannels(token, {
      query: appliedQuery || undefined,
      status: appliedStatus || undefined,
    });
    setChannels(response.items);
  }

  async function saveChannel() {
    if (!token || !draft.code.trim() || !draft.name.trim()) {
      return;
    }

    let authConfig: Record<string, unknown> = {};
    if (draft.auth_config.trim()) {
      try {
        const parsed = JSON.parse(draft.auth_config) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          authConfig = parsed as Record<string, unknown>;
        } else {
          setNoticeMessage("인증 정보는 JSON Object 형식이어야 합니다.");
          return;
        }
      } catch {
        setNoticeMessage("인증 정보 JSON 형식을 확인해주세요.");
        return;
      }
    }

    const payload: AdminChannelPayload = {
      code: draft.code.trim().toUpperCase(),
      name: draft.name.trim(),
      provider: draft.provider.trim() || "webchat",
      renderer_type: draft.renderer_type.trim() || "webchat",
      endpoint_url: draft.endpoint_url.trim() || null,
      auth_type: draft.auth_type.trim() || "none",
      auth_config: authConfig,
      description: draft.description.trim() || null,
      status: draft.status,
    };

    try {
      if (editing) {
        await updateChannel(token, editing.id, {
          name: payload.name,
          provider: payload.provider,
          renderer_type: payload.renderer_type,
          endpoint_url: payload.endpoint_url,
          auth_type: payload.auth_type,
          auth_config: payload.auth_config,
          description: payload.description,
          status: payload.status,
        });
        setNoticeMessage("채널 정보가 수정되었습니다.");
      } else {
        await createChannel(token, payload);
        setNoticeMessage("채널이 생성되었습니다.");
      }
      closeDialog();
      await reload();
    } catch (error) {
      setNoticeMessage(error instanceof Error ? error.message : "채널 저장에 실패했습니다.");
    }
  }

  async function checkChannelConnection(channel: AdminChannelItem) {
    if (!token) {
      return;
    }
    try {
      const result = await testChannelConnection(token, channel.id);
      const suffix = result.issues.length > 0 ? ` (${result.issues.join(" / ")})` : "";
      setNoticeMessage(`${channel.name}: ${result.message}${suffix}`);
    } catch (error) {
      setNoticeMessage(error instanceof Error ? error.message : "채널 연결 테스트에 실패했습니다.");
    }
  }
  async function removeChannel() {
    if (!token || !editing) {
      return;
    }

    try {
      await deleteChannel(token, editing.id);
      setNoticeMessage("채널이 삭제되었습니다.");
      closeDialog();
      await reload();
    } catch (error) {
      setNoticeMessage(error instanceof Error ? error.message : "채널 삭제에 실패했습니다.");
    }
  }

  async function handleUpload(file: File | null) {
    if (!token || !file) {
      return;
    }

    try {
      const text = await file.text();
      const rows = parseCsv(text).filter((row) => row.length >= 3);
      const dataRows = rows[0]?.[1]?.includes("채널 아이디") ? rows.slice(1) : rows;
      let savedCount = 0;
      let skippedCount = 0;

      for (const row of dataRows) {
        const [
          ,
          code,
          name,
          provider,
          rendererType,
          statusLabel,
          ,
          ,
          ,
          endpointUrl = "",
          authType = "none",
          authConfig = "{}",
          description = "",
        ] = row;

        if (!(code ?? "").trim() || !(name ?? "").trim()) {
          skippedCount += 1;
          continue;
        }

        let parsedAuthConfig: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(authConfig || "{}");
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            parsedAuthConfig = parsed as Record<string, unknown>;
          }
        } catch {
          parsedAuthConfig = {};
        }

        const payload: AdminChannelPayload = {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          provider: (provider || "webchat").trim(),
          renderer_type: (rendererType || "webchat").trim(),
          endpoint_url: endpointUrl.trim() || null,
          auth_type: (authType || "none").trim(),
          auth_config: parsedAuthConfig,
          description: description.trim() || null,
          status: statusLabel === "미사용" || statusLabel === "inactive" ? "inactive" : "active",
        };

        const existing = channels.find((item) => item.code === payload.code);
        if (existing) {
          await updateChannel(token, existing.id, {
            name: payload.name,
            provider: payload.provider,
            renderer_type: payload.renderer_type,
            endpoint_url: payload.endpoint_url,
            auth_type: payload.auth_type,
            auth_config: payload.auth_config,
            description: payload.description,
            status: payload.status,
          });
        } else {
          await createChannel(token, payload);
        }
        savedCount += 1;
      }

      setMenuOpen(false);
      setNoticeMessage(`${savedCount}건 반영, ${skippedCount}건 제외되었습니다.`);
      await reload();
    } catch (error) {
      setNoticeMessage(error instanceof Error ? error.message : "채널 업로드에 실패했습니다.");
    }
  }

  const rows: DataGridRow[] = channels.map((channel, index) => ({
    key: channel.id,
    cells: [
      String(index + 1),
      channel.code,
      <button key={channel.id} type="button" className="table-link" onClick={() => openEdit(channel)}>
        {channel.name}
      </button>,
      channelDataText(channel, "provider"),
      channelDataText(channel, "renderer_type"),
      channel.status_label,
      channel.creator_name,
      channel.updater_name,
      formatDate(channel.updated_at),
      <div key={`manage-${channel.id}`} className="admin-page__table-actions">
        <button type="button" className="admin-page__ghost" onClick={() => checkChannelConnection(channel)}>
          연결 테스트
        </button>
        <button type="button" className="admin-page__ghost" onClick={() => openEdit(channel)}>
          수정
        </button>
      </div>,
    ],
  }));
  const sortedRows = useMemo(() => {
    if (!sortState) {
      return rows;
    }
    return [...rows].sort((left, right) => {
      const leftText = dataGridCellText(left.cells[sortState.columnIndex]);
      const rightText = dataGridCellText(right.cells[sortState.columnIndex]);
      const leftNumber = Number(leftText.replaceAll(",", ""));
      const rightNumber = Number(rightText.replaceAll(",", ""));
      const bothNumeric =
        leftText.trim() !== "" && rightText.trim() !== "" && Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
      const result = bothNumeric
        ? leftNumber - rightNumber
        : leftText.localeCompare(rightText, "ko-KR", { numeric: true, sensitivity: "base" });
      return sortState.direction === "asc" ? result : -result;
    });
  }, [rows, sortState]);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pagedRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [pageSize, sortState]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <section className="admin-page">
      <h2>채널 관리</h2>

      <div className="admin-page__search-row admin-channels__search-row">
        <label className="admin-page__search">
          <span aria-hidden="true">⌕</span>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="채널 아이디 또는 채널 이름을 검색하세요."
          />
        </label>
        <select className="login-select" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">전체 사용여부</option>
          <option value="active">사용</option>
          <option value="inactive">미사용</option>
        </select>
        <button type="button" className="admin-page__filter" onClick={resetSearch}>
          초기화
        </button>
        <div className="admin-page__search-actions">
          <button type="button" className="admin-page__primary" onClick={applySearch}>
            조회
          </button>
          <button type="button" className="admin-page__primary" onClick={openCreate}>
            + 채널 생성
          </button>
          <div className="admin-common-variables__more">
            <button
              type="button"
              className="admin-common-variables__more-button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-label="채널 더보기"
            >
              <span className="admin-common-variables__more-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
            {menuOpen ? (
              <div className="admin-common-variables__menu">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                >
                  파일 업로드
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    downloadChannels(channels);
                  }}
                >
                  파일 다운로드
                </button>
              </div>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="admin-common-variables__file"
              onChange={(event) => {
                void handleUpload(event.target.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
            />
          </div>
        </div>
      </div>

      <div className="admin-page__toolbar">
        <div className="admin-page__toolbar-left">
          <strong>전체 {channels.length}건</strong>
          <label className="manual-main__mini-select manual-main__mini-select--select">
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as ListPageSize)}>
              {LIST_PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}개씩 보기
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {noticeMessage ? <p className="admin-page__empty">{noticeMessage}</p> : null}
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
            template="70px 130px 150px 120px 130px 100px 130px 130px 170px 180px"
            columns={["순서", "채널 아이디", "채널", "Provider", "렌더러 타입", "사용여부", "생성자", "최종수정자", "최종수정일시", "관리"]}
            rows={loading ? [] : pagedRows}
            sortState={sortState}
            onSort={setSortState}
          />

          {loading ? <p className="admin-page__empty">불러오는 중입니다...</p> : null}
          {!loading && rows.length === 0 ? <p className="admin-page__empty">조회 결과가 없습니다.</p> : null}

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

      {dialogOpen ? (
        <div className="settings-dialog-backdrop">
          <div className="settings-dialog admin-variable-dialog">
            <div className="settings-dialog__header">
              <strong>{editing ? "채널 정보 수정" : "채널 생성"}</strong>
              <button type="button" className="settings-dialog__close" onClick={closeDialog} aria-label="닫기">
                ×
              </button>
            </div>
            <div className="admin-variable-dialog__body">
              {isKakaoDraft(draft.provider, draft.renderer_type) ? (
                <div className="admin-form-guide admin-form-guide--wide">
                  <strong>Kakao 채널 설정 안내</strong>
                  <p>
                    1차 기준 권장값은 <code>Provider = kakao</code>, <code>렌더러 타입 = kakao</code>,{" "}
                    <code>Endpoint URL = /api/v1/channels/kakao/webhook</code> 입니다.
                  </p>
                  <p>
                    인증 방식은 현재 <code>없음</code> 또는 <code>Token</code>만 운영 기준으로 지원합니다.
                    <code>Token</code>을 쓰면 인증 정보 JSON에 <code>{"{\"token\":\"...\"}"}</code> 또는{" "}
                    <code>{"{\"appSecret\":\"...\"}"}</code> 형태로 값을 넣어야 합니다.
                  </p>
                  <p>
                    <code>OAuth</code>, <code>Basic</code>은 공용 채널 모델에 있는 선택지이며, 현재 Kakao 1차 연결 기준에서는 사용하지 않습니다.
                  </p>
                </div>
              ) : null}
              <label>
                <span>채널 아이디</span>
                <input
                  type="text"
                  value={draft.code}
                  disabled={Boolean(editing)}
                  onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))}
                />
              </label>
              <label>
                <span>채널 이름</span>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                <span>Provider</span>
                <select
                  className="login-select"
                  value={draft.provider}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      provider: event.target.value,
                      renderer_type: event.target.value === "ms_teams" ? "adaptive_card" : event.target.value,
                    }))
                  }
                >
                  <option value="webchat">Webchat</option>
                  <option value="kakao">Kakao</option>
                  <option value="ms_teams">MS Teams</option>
                  <option value="simulator">Simulator</option>
                </select>
              </label>
              <label>
                <span>렌더러 타입</span>
                <input
                  type="text"
                  value={draft.renderer_type}
                  onChange={(event) => setDraft((current) => ({ ...current, renderer_type: event.target.value }))}
                />
              </label>
              <label>
                <span>Endpoint URL</span>
                <input
                  type="text"
                  value={draft.endpoint_url}
                  placeholder="https://..."
                  onChange={(event) => setDraft((current) => ({ ...current, endpoint_url: event.target.value }))}
                />
              </label>
              <label>
                <span className="admin-inline-label">
                  인증 방식
                  <span
                    className="admin-inline-help"
                    data-help="없음: 공개 webhook 테스트용입니다. Token: 고정 토큰 또는 appSecret 값을 헤더로 검증합니다. OAuth/Basic: 현재 Kakao 1차 범위에서는 사용하지 않습니다."
                    tabIndex={0}
                    role="img"
                    aria-label="인증 방식 설명"
                  >
                    i
                  </span>
                </span>
                <select
                  className="login-select"
                  value={draft.auth_type}
                  onChange={(event) => setDraft((current) => ({ ...current, auth_type: event.target.value }))}
                >
                  <option value="none">없음</option>
                  <option value="token">Token</option>
                  <option value="oauth">OAuth</option>
                  <option value="basic">Basic</option>
                </select>
              </label>
              <p className="admin-form-guide__inline">{authTypeGuide(draft.auth_type)}</p>
              <label>
                <span className="admin-inline-label">
                  인증 정보 JSON
                  <span
                    className="admin-inline-help"
                    data-help='Token 인증이면 {"token":"..."} 또는 {"appSecret":"..."} 형식으로 입력합니다. 없음이면 {} 로 두면 됩니다.'
                    tabIndex={0}
                    role="img"
                    aria-label="인증 정보 JSON 설명"
                  >
                    i
                  </span>
                </span>
                <textarea
                  value={draft.auth_config}
                  placeholder={'{"token":"..."}'}
                  onChange={(event) => setDraft((current) => ({ ...current, auth_config: event.target.value }))}
                />
              </label>
              <label>
                <span>상세 설명</span>
                <textarea
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                />
              </label>
              <label>
                <span>사용 여부</span>
                <select
                  className="login-select"
                  value={draft.status}
                  onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as ChannelStatus }))}
                >
                  <option value="active">사용</option>
                  <option value="inactive">미사용</option>
                </select>
              </label>
            </div>
            <div className="entity-editor-dialog__footer">
              {editing ? (
                <button type="button" className="secondary-action" onClick={removeChannel}>
                  삭제
                </button>
              ) : null}
              <button type="button" className="secondary-action" onClick={closeDialog}>
                취소
              </button>
              <button type="button" className="primary-action" onClick={saveChannel}>
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
