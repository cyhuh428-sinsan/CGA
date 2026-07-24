"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/language-provider";
import { DataGrid, dataGridCellText, type DataGridRow, type DataGridSortState } from "@/components/data-grid";
import {
  createCommonVariable,
  deleteCommonVariable,
  fetchCommonVariables,
  importCommonVariables,
  updateCommonVariable,
  type AdminCommonVariableItem,
  type AdminCommonVariablePayload,
} from "@/lib/admin-api";
import { loadAuthSession } from "@/lib/auth";
import {
  COMMON_VARIABLE_CATALOGS,
  formatCommonVariableText,
  type CommonVariableCatalog,
} from "@/lib/i18n/admin-common-variables";
import { SUPPORTED_LANGUAGES } from "@/lib/language";
import {
  LIST_PAGE_SIZE_OPTIONS,
  type ListPageSize,
  usePersistedPageSize,
} from "@/lib/use-persisted-page-size";

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function downloadVariables(items: AdminCommonVariableItem[], copy: CommonVariableCatalog) {
  const rows = [
    [copy.name, copy.value, copy.description],
    ...items
      .filter((item) => item.kind === "user")
      .map((item) => [item.name, item.value, item.description ?? ""]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${copy.title}.csv`;
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

export default function AdminCommonVariablesPage() {
  const { language: uiLanguage } = useI18n();
  const copy = COMMON_VARIABLE_CATALOGS[uiLanguage];
  const locale = SUPPORTED_LANGUAGES.find((item) => item.code === uiLanguage)?.intlLocale ?? "ko-KR";
  const [token, setToken] = useState("");
  const [variables, setVariables] = useState<AdminCommonVariableItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [appliedKind, setAppliedKind] = useState("");
  const [editing, setEditing] = useState<AdminCommonVariableItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", value: "", description: "" });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [pageSize, setPageSize] = usePersistedPageSize<ListPageSize>(
    "aidot.page_size.admin.common_variables",
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
      setErrorMessage(copy.loginRequired);
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
    fetchCommonVariables(token, {
      query: appliedQuery || undefined,
      kind: appliedKind || undefined,
    })
      .then((response) => {
        if (!ignore) {
          setVariables(response.items);
          setSelectedIds([]);
        }
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : copy.loadFailed);
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
  }, [appliedKind, appliedQuery, copy.loadFailed, token]);

  const userVariableIds = variables.filter((item) => item.kind === "user").map((item) => item.id);
  const allUserSelected = userVariableIds.length > 0 && userVariableIds.every((id) => selectedIds.includes(id));

  function applySearch() {
    setAppliedQuery(query.trim());
    setAppliedKind(kindFilter);
    setPage(1);
  }

  function resetSearch() {
    setQuery("");
    setKindFilter("");
    setAppliedQuery("");
    setAppliedKind("");
    setPage(1);
  }

  function openAddDialog() {
    setEditing(null);
    setDraft({ name: "", value: "", description: "" });
    setDialogOpen(true);
  }

  function openEditDialog(variable: AdminCommonVariableItem) {
    setEditing(variable);
    setDraft({ name: variable.name, value: variable.value, description: variable.description ?? "" });
    setDialogOpen(true);
  }

  function closeDialog() {
    setEditing(null);
    setDialogOpen(false);
    setDraft({ name: "", value: "", description: "" });
  }

  async function reload() {
    if (!token) {
      return;
    }
    const response = await fetchCommonVariables(token, {
      query: appliedQuery || undefined,
      kind: appliedKind || undefined,
    });
    setVariables(response.items);
    setSelectedIds([]);
  }

  async function saveDraft() {
    if (!token || !draft.name.trim() || !draft.value.trim()) {
      return;
    }
    const payload: AdminCommonVariablePayload = {
      name: draft.name.trim(),
      value: draft.value.trim(),
      description: draft.description.trim() || null,
    };
    try {
      if (editing) {
        await updateCommonVariable(token, editing.id, {
          value: payload.value,
          description: payload.description,
        });
        setNoticeMessage(copy.saved);
      } else {
        await createCommonVariable(token, payload);
        setNoticeMessage(copy.added);
      }
      closeDialog();
      await reload();
    } catch (error) {
      setNoticeMessage(error instanceof Error ? error.message : copy.saveFailed);
    }
  }

  function toggleAll() {
    setSelectedIds((current) =>
      allUserSelected
        ? current.filter((id) => !userVariableIds.includes(id))
        : Array.from(new Set([...current, ...userVariableIds])),
    );
  }

  function toggleOne(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function deleteSelected() {
    if (!token || selectedIds.length === 0) {
      return;
    }
    try {
      for (const id of selectedIds) {
        await deleteCommonVariable(token, id);
      }
      setNoticeMessage(copy.deleted);
      await reload();
    } catch (error) {
      setNoticeMessage(error instanceof Error ? error.message : copy.deleteFailed);
    }
  }

  async function handleUpload(file: File | null) {
    if (!token || !file) {
      return;
    }
    const text = await file.text();
    const rows = parseCsv(text).filter((row) => row.length >= 2);
    // Keep compatibility with previously downloaded Korean CSV headers.
    const dataRows = rows[0]?.some((cell) => cell.includes("\uBCC0\uC218") || cell === copy.name || cell === copy.value) ? rows.slice(1) : rows;
    const items = dataRows
      .map((row) => ({
        name: row[0] ?? "",
        value: row[1] ?? "",
        description: row[2] ?? null,
      }))
      .filter((item) => item.name.trim() && item.value.trim());

    if (items.length === 0) {
      setNoticeMessage(copy.noUpload);
      return;
    }

    try {
      const response = await importCommonVariables(token, items);
      setNoticeMessage(formatCommonVariableText(copy.uploadResult, { saved: response.saved_count, skipped: response.skipped_count }));
      await reload();
    } catch (error) {
      setNoticeMessage(error instanceof Error ? error.message : copy.uploadFailed);
    }
  }

  const rows: DataGridRow[] = variables.map((item) => ({
    key: item.id,
    cells: [
      item.kind === "user" ? (
        <input
          key={`check-${item.id}`}
          type="checkbox"
          checked={selectedIds.includes(item.id)}
          onChange={() => toggleOne(item.id)}
          aria-label={`${item.name} ${copy.select}`}
        />
      ) : (
        <input key={`check-${item.id}`} type="checkbox" disabled aria-label={`${item.name} ${copy.unavailable}`} />
      ),
      item.kind === "system" ? copy.system : copy.user,
      <button key={`name-${item.id}`} type="button" className="table-link" onClick={() => openEditDialog(item)}>
        {item.name}
      </button>,
      item.value,
      item.description ?? "",
      formatDate(item.updated_at, locale),
      item.updater_name,
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
        : leftText.localeCompare(rightText, locale, { numeric: true, sensitivity: "base" });
      return sortState.direction === "asc" ? result : -result;
    });
  }, [locale, rows, sortState]);
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
      <h2>{copy.title}</h2>

      <div className="admin-page__search-row admin-common-variables__search-row">
        <label className="admin-page__search">
          <span aria-hidden="true">⌕</span>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
          />
        </label>
        <select className="login-select" value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}>
          <option value="">{copy.allKinds}</option>
          <option value="user">{copy.user}</option>
          <option value="system">{copy.system}</option>
        </select>
        <button type="button" className="admin-page__filter" onClick={resetSearch}>
          {copy.reset}
        </button>
        <div className="admin-page__search-actions">
          <button type="button" className="admin-page__primary" onClick={applySearch}>
            {copy.search}
          </button>
          <button type="button" className="admin-page__primary" onClick={openAddDialog}>
            + {copy.add}
          </button>
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
                    downloadVariables(variables, copy);
                  }}
                >
                  {copy.download}
                </button>
              </div>
            ) : null}
          </div>
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

      <div className="admin-page__toolbar">
        <div className="admin-page__toolbar-left">
          <strong>{copy.total} {variables.length}</strong>
          <label className="manual-main__mini-select manual-main__mini-select--select">
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as ListPageSize)}>
              {LIST_PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} {copy.perPage}
                </option>
              ))}
            </select>
          </label>
          {selectedIds.length > 0 ? <span className="admin-page__selection">{selectedIds.length} {copy.selected}</span> : null}
          <button type="button" className="admin-page__ghost" disabled={selectedIds.length === 0} onClick={deleteSelected}>
            {copy.delete}
          </button>
        </div>
      </div>

      {noticeMessage ? <p className="admin-page__empty">{noticeMessage}</p> : null}
      {errorMessage ? (
        <div className="admin-state-box">
          <p>{errorMessage}</p>
          <Link href="/login" className="ghost-pill">
            {copy.login}
          </Link>
        </div>
      ) : null}

      {!errorMessage ? (
        <>
          <DataGrid
            variant="admin"
            template="44px 90px 210px 180px 1fr 180px 180px"
            columns={[
              <input key="all" type="checkbox" checked={allUserSelected} onChange={toggleAll} aria-label={copy.selectAll} />,
              copy.category,
              copy.name,
              copy.value,
              copy.description,
              copy.updatedAt,
              copy.updatedBy,
            ]}
            rows={loading ? [] : pagedRows}
            sortState={sortState}
            onSort={setSortState}
          />

          {loading ? <p className="admin-page__empty">{copy.loading}</p> : null}
          {!loading && rows.length === 0 ? <p className="admin-page__empty">{copy.empty}</p> : null}

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
              <strong>{editing ? copy.detail : copy.add}</strong>
              <button type="button" className="settings-dialog__close" onClick={closeDialog} aria-label={copy.close}>
                ×
              </button>
            </div>
            <div className="admin-variable-dialog__body">
              {editing?.kind === "system" ? <p className="admin-page__empty">{copy.readOnly}</p> : null}
              <label>
                <span>{copy.name}</span>
                <input
                  type="text"
                  value={draft.name}
                  disabled={Boolean(editing)}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                <span>{copy.value}</span>
                <input
                  type="text"
                  value={draft.value}
                  disabled={editing?.kind === "system"}
                  onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))}
                />
              </label>
              <label>
                <span>{copy.variableDescription}</span>
                <textarea
                  value={draft.description}
                  disabled={editing?.kind === "system"}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                />
              </label>
            </div>
            <div className="entity-editor-dialog__footer">
              <button type="button" className="secondary-action" onClick={closeDialog}>
                {copy.cancel}
              </button>
              {editing?.kind !== "system" ? (
                <button type="button" className="primary-action" onClick={saveDraft}>
                  {copy.confirm}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
