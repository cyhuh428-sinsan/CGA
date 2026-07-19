"use client";

import { useEffect, useRef, useState } from "react";

import { AdminInteractiveTablePage } from "@/components/admin-interactive-table-page";
import { type DataGridRow } from "@/components/data-grid";
import {
  fetchDefaultMessages,
  restoreDefaultMessage,
  updateDefaultMessage,
  type AdminDefaultMessageItem,
  type AdminDefaultMessagePayload,
} from "@/lib/admin-api";
import { loadAuthSession } from "@/lib/auth";

const CATEGORY_OPTIONS = [
  { value: "", label: "전체 구분" },
  { value: "intent", label: "의도" },
  { value: "input", label: "입력" },
  { value: "error", label: "오류" },
  { value: "session", label: "세션" },
];

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

function downloadDefaultMessages(items: AdminDefaultMessageItem[]) {
  const rows = [
    ["메시지명", "구분", "언어", "적용범위", "사용여부", "메시지", "설명"],
    ...items.map((item) => [
      item.message_name,
      item.category,
      item.language,
      item.scope,
      item.status,
      item.message_text,
      item.description ?? "",
    ]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "기본 메시지 관리.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AdminDefaultMessagesPage() {
  const [token, setToken] = useState("");
  const [items, setItems] = useState<AdminDefaultMessageItem[]>([]);
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [appliedCategory, setAppliedCategory] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [editing, setEditing] = useState<AdminDefaultMessageItem | null>(null);
  const [draft, setDraft] = useState<AdminDefaultMessagePayload>({
    message_name: "",
    category: "intent",
    language: "ko",
    scope: "global",
    message_text: "",
    description: "",
    status: "active",
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
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
    if (!token) return;
    let ignore = false;
    setLoading(true);
    setErrorMessage("");
    fetchDefaultMessages(token, {
      category: appliedCategory || undefined,
      status: appliedStatus || undefined,
    })
      .then((response) => {
        if (!ignore) setItems(response.items);
      })
      .catch((error) => {
        if (!ignore) setErrorMessage(error instanceof Error ? error.message : "기본 메시지를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [appliedCategory, appliedStatus, token]);

  async function reload() {
    if (!token) return;
    const response = await fetchDefaultMessages(token, {
      category: appliedCategory || undefined,
      status: appliedStatus || undefined,
    });
    setItems(response.items);
  }

  function applySearch() {
    setAppliedCategory(category);
    setAppliedStatus(status);
  }

  function resetSearch() {
    setCategory("");
    setStatus("");
    setAppliedCategory("");
    setAppliedStatus("");
  }

  function openEdit(item: AdminDefaultMessageItem) {
    setEditing(item);
    setDraft({
      message_name: item.message_name,
      category: item.category,
      language: item.language,
      scope: item.scope,
      message_text: item.message_text,
      description: item.description ?? "",
      status: item.status,
    });
  }

  function closeEdit() {
    setEditing(null);
    setDraft({
      message_name: "",
      category: "intent",
      language: "ko",
      scope: "global",
      message_text: "",
      description: "",
      status: "active",
    });
  }

  async function saveDraft() {
    if (!token || !editing || !draft.message_name.trim() || !draft.message_text.trim()) return;
    try {
      await updateDefaultMessage(token, editing.id, {
        ...draft,
        message_name: draft.message_name.trim(),
        category: draft.category.trim(),
        language: draft.language.trim(),
        message_text: draft.message_text.trim(),
        description: draft.description?.trim() || null,
      });
      setNoticeMessage("기본 메시지가 저장되었습니다.");
      closeEdit();
      await reload();
    } catch (error) {
      setNoticeMessage(error instanceof Error ? error.message : "기본 메시지 저장에 실패했습니다.");
    }
  }

  async function restoreDraft() {
    if (!token || !editing || !editing.default_message_text) return;
    try {
      await restoreDefaultMessage(token, editing.id);
      setNoticeMessage("기본 메시지가 기본값으로 복원되었습니다.");
      closeEdit();
      await reload();
    } catch (error) {
      setNoticeMessage(error instanceof Error ? error.message : "기본 메시지 복원에 실패했습니다.");
    }
  }

  async function handleUpload(file: File | null) {
    if (!token || !file) {
      return;
    }

    try {
      const text = await file.text();
      const rows = parseCsv(text).filter((row) => row.length >= 6);
      const dataRows = rows[0]?.[0]?.includes("메시지명") ? rows.slice(1) : rows;
      let savedCount = 0;
      let skippedCount = 0;

      for (const row of dataRows) {
        const [messageName, categoryValue, language, scope, statusValue, messageText, description] = row;
        const matched = items.find(
          (item) =>
            item.message_name === (messageName ?? "") &&
            item.category === (categoryValue ?? "") &&
            item.language === (language ?? "") &&
            item.scope === (scope ?? ""),
        );

        if (!matched || !(messageText ?? "").trim()) {
          skippedCount += 1;
          continue;
        }

        await updateDefaultMessage(token, matched.id, {
          message_name: matched.message_name,
          category: matched.category,
          language: matched.language,
          scope: matched.scope,
          status: statusValue === "inactive" ? "inactive" : "active",
          message_text: messageText.trim(),
          description: description?.trim() ?? "",
        });
        savedCount += 1;
      }

      setMenuOpen(false);
      setNoticeMessage(`${savedCount}건 반영, ${skippedCount}건 제외되었습니다.`);
      await reload();
    } catch (error) {
      setNoticeMessage(error instanceof Error ? error.message : "기본 메시지 업로드에 실패했습니다.");
    }
  }

  const rows: DataGridRow[] = items.map((item) => ({
    key: item.id,
    cells: [
      item.category_label,
      <button key="name" type="button" className="admin-link-button" onClick={() => openEdit(item)}>
        {item.message_name}
      </button>,
      item.language,
      item.scope_label,
      item.status_label,
      <span key="text" className="admin-truncate" title={item.message_text}>{item.message_text}</span>,
      formatDate(item.updated_at),
      item.updater_name,
    ],
  }));

  return (
    <>
      {noticeMessage ? <p className="admin-page__empty">{noticeMessage}</p> : null}
      {errorMessage ? <p className="admin-page__empty">{errorMessage}</p> : null}
      <AdminInteractiveTablePage
        title="기본 메시지 관리"
        searchPlaceholder="메시지명 또는 메시지 내용을 검색하세요."
        totalText={loading ? "불러오는 중" : `전체 ${items.length}건`}
        columns={["구분", "메시지명", "언어", "적용 범위", "사용여부", "메시지", "최종수정일시", "최종수정자"]}
        rows={loading || errorMessage ? [] : rows}
        template="0.8fr 1.1fr 0.5fr 0.7fr 0.7fr 2.2fr 1.2fr 0.8fr"
        hideDownloadButton
        onDownload={() => downloadDefaultMessages(items)}
        loading={loading}
        topRight={
          <div className="admin-history-filters">
            <label className="admin-history-filters__field">
              <span>구분</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="admin-history-filters__field">
              <span>사용여부</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">전체 사용여부</option>
                <option value="active">사용</option>
                <option value="inactive">미사용</option>
              </select>
            </label>
            <button type="button" className="admin-page__filter admin-page__filter--text" onClick={resetSearch}>초기화</button>
            <button type="button" className="admin-page__primary" onClick={applySearch}>조회</button>
            <div className="admin-common-variables__more">
              <button
                type="button"
                className="admin-common-variables__more-button"
                onClick={() => setMenuOpen((current) => !current)}
                aria-label="기본 메시지 더보기"
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
                      downloadDefaultMessages(items);
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
        }
      />

      {editing ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div className="admin-modal" role="dialog" aria-modal="true" aria-label="기본 메시지 수정">
            <div className="admin-modal__header">
              <h3>기본 메시지 수정</h3>
              <button type="button" className="icon-button" onClick={closeEdit}>×</button>
            </div>
            <label>
              메시지명
              <input value={draft.message_name} disabled readOnly />
            </label>
            <label>
              구분
              <select value={draft.category} disabled>
                {CATEGORY_OPTIONS.filter((option) => option.value).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              언어
              <input value={draft.language} disabled readOnly />
            </label>
            <label>
              적용 범위
              <select value={draft.scope} disabled>
                <option value="global">전체</option>
                <option value="group">그룹</option>
              </select>
            </label>
            <label>
              사용 여부
              <select value={draft.status} disabled>
                <option value="active">사용</option>
                <option value="inactive">미사용</option>
              </select>
            </label>
            <label className="admin-modal__wide">
              메시지
              <textarea value={draft.message_text} onChange={(event) => setDraft((current) => ({ ...current, message_text: event.target.value }))} rows={5} />
            </label>
            <label className="admin-modal__wide">
              설명
              <textarea value={draft.description ?? ""} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={3} />
            </label>
            <div className="admin-modal__actions">
              <button type="button" className="ghost-pill" onClick={restoreDraft} disabled={!editing.is_modified}>기본값 복원</button>
              <button type="button" className="ghost-pill" onClick={closeEdit}>취소</button>
              <button type="button" className="primary-pill" onClick={saveDraft}>저장</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
