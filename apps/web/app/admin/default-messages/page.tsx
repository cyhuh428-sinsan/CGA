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
import { useI18n } from "@/components/language-provider";
import { getLanguageLabel, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/language";
import { DEFAULT_MESSAGES_CATALOGS, formatDefaultMessageText } from "@/lib/i18n/default-messages";

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

function downloadDefaultMessages(items: AdminDefaultMessageItem[], fileName: string) {
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
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AdminDefaultMessagesPage() {
  const { language: uiLanguage } = useI18n();
  const copy = DEFAULT_MESSAGES_CATALOGS[uiLanguage];
  const categoryOptions = [
    { value: "", label: copy.allCategory },
    ...(["intent", "input", "error", "session", "runtime"] as const).map((value) => ({
      value,
      label: copy.categories[value],
    })),
  ];
  const [token, setToken] = useState("");
  const [items, setItems] = useState<AdminDefaultMessageItem[]>([]);
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(uiLanguage);
  const [appliedCategory, setAppliedCategory] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [appliedLanguage, setAppliedLanguage] = useState<SupportedLanguage>(uiLanguage);
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
      setErrorMessage(copy.loginRequired);
      return;
    }
    setToken(session.access_token);
  }, [copy.loginRequired]);

  useEffect(() => {
    if (!token) return;
    let ignore = false;
    setLoading(true);
    setErrorMessage("");
    fetchDefaultMessages(token, {
      category: appliedCategory || undefined,
      status: appliedStatus || undefined,
      language: appliedLanguage,
    })
      .then((response) => {
        if (!ignore) setItems(response.items);
      })
      .catch((error) => {
        if (!ignore) setErrorMessage(error instanceof Error ? error.message : copy.loadFailed);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [appliedCategory, appliedLanguage, appliedStatus, copy.loadFailed, token]);

  async function reload() {
    if (!token) return;
    const response = await fetchDefaultMessages(token, {
      category: appliedCategory || undefined,
      status: appliedStatus || undefined,
      language: appliedLanguage,
    });
    setItems(response.items);
  }

  function applySearch() {
    setAppliedCategory(category);
    setAppliedStatus(status);
    setAppliedLanguage(selectedLanguage);
  }

  function resetSearch() {
    setCategory("");
    setStatus("");
    setSelectedLanguage(uiLanguage);
    setAppliedCategory("");
    setAppliedStatus("");
    setAppliedLanguage(uiLanguage);
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
      setNoticeMessage(copy.saved);
      closeEdit();
      await reload();
    } catch (error) {
      setNoticeMessage(error instanceof Error ? error.message : copy.saveFailed);
    }
  }

  async function restoreDraft() {
    if (!token || !editing || !editing.default_message_text) return;
    try {
      await restoreDefaultMessage(token, editing.id);
      setNoticeMessage(copy.restored);
      closeEdit();
      await reload();
    } catch (error) {
      setNoticeMessage(error instanceof Error ? error.message : copy.restoreFailed);
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
      setNoticeMessage(formatDefaultMessageText(copy.uploadResult, { saved: savedCount, skipped: skippedCount }));
      await reload();
    } catch (error) {
      setNoticeMessage(error instanceof Error ? error.message : copy.uploadFailed);
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
        title={copy.title}
        searchPlaceholder={copy.searchPlaceholder}
        totalText={loading ? copy.loading : formatDefaultMessageText(copy.totalCount, { count: items.length })}
        columns={copy.columns}
        rows={loading || errorMessage ? [] : rows}
        template="0.8fr 1.1fr 0.5fr 0.7fr 0.7fr 2.2fr 1.2fr 0.8fr"
        hideDownloadButton
        onDownload={() => downloadDefaultMessages(items, copy.fileName)}
        loading={loading}
        topRight={
          <div className="admin-history-filters">
            <label className="admin-history-filters__field">
              <span>{copy.category}</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="admin-history-filters__field">
              <span>{copy.status}</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">{copy.allStatus}</option>
                <option value="active">{copy.active}</option>
                <option value="inactive">{copy.inactive}</option>
              </select>
            </label>
            <label className="admin-history-filters__field">
              <span>{copy.language}</span>
              <select value={selectedLanguage} onChange={(event) => setSelectedLanguage(event.target.value as SupportedLanguage)}>
                {SUPPORTED_LANGUAGES.map((option) => (
                  <option key={option.code} value={option.code}>{getLanguageLabel(option.code)}</option>
                ))}
              </select>
            </label>
            <button type="button" className="admin-page__filter admin-page__filter--text" onClick={resetSearch}>{copy.reset}</button>
            <button type="button" className="admin-page__primary" onClick={applySearch}>{copy.search}</button>
            <div className="admin-common-variables__more">
              <button
                type="button"
                className="admin-common-variables__more-button"
                onClick={() => setMenuOpen((current) => !current)}
                aria-label={copy.more}
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
                    {copy.upload}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      downloadDefaultMessages(items, copy.fileName);
                    }}
                  >
                    {copy.download}
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
          <div className="admin-modal" role="dialog" aria-modal="true" aria-label={copy.editTitle}>
            <div className="admin-modal__header">
              <h3>{copy.editTitle}</h3>
              <button type="button" className="icon-button" onClick={closeEdit}>×</button>
            </div>
            <label>
              {copy.messageName}
              <input value={draft.message_name} disabled readOnly />
            </label>
            <label>
              {copy.category}
              <select value={draft.category} disabled>
                {categoryOptions.filter((option) => option.value).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              {copy.language}
              <input value={draft.language} disabled readOnly />
            </label>
            <label>
              {copy.scope}
              <select value={draft.scope} disabled>
                <option value="global">{copy.global}</option>
                <option value="group">{copy.group}</option>
              </select>
            </label>
            <label>
              {copy.status}
              <select value={draft.status} disabled>
                <option value="active">{copy.active}</option>
                <option value="inactive">{copy.inactive}</option>
              </select>
            </label>
            <label className="admin-modal__wide">
              {copy.message}
              <textarea value={draft.message_text} onChange={(event) => setDraft((current) => ({ ...current, message_text: event.target.value }))} rows={5} />
            </label>
            <label className="admin-modal__wide">
              {copy.description}
              <textarea value={draft.description ?? ""} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={3} />
            </label>
            <div className="admin-modal__actions">
              <button type="button" className="ghost-pill" onClick={restoreDraft} disabled={!editing.is_modified}>{copy.restore}</button>
              <button type="button" className="ghost-pill" onClick={closeEdit}>{copy.cancel}</button>
              <button type="button" className="primary-pill" onClick={saveDraft}>{copy.save}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
