"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";

import {
  DataGrid,
  dataGridCellText,
  type DataGridRow,
  type DataGridSortState,
} from "@/components/data-grid";
import {
  LIST_PAGE_SIZE_OPTIONS,
  type ListPageSize,
  usePersistedPageSize,
} from "@/lib/use-persisted-page-size";
import { useI18n } from "@/components/language-provider";
import { ADMIN_COMMON_CATALOGS, formatAdminText } from "@/lib/i18n/admin-common";

type AdminInteractiveTablePageProps = {
  title: string;
  searchPlaceholder: string;
  totalText: string;
  pageSizeText?: string;
  columns: ReactNode[];
  rows: DataGridRow[];
  template: string;
  topRight?: ReactNode;
  toolbarLeftExtra?: ReactNode;
  toolbarRight?: ReactNode;
  hideDownloadButton?: boolean;
  onDownload?: () => void;
  loading?: boolean;
  serverPagination?: {
    total: number;
    onRequestChange: (request: { query: string; page: number; pageSize: ListPageSize }) => void;
  };
};

function downloadCsv(title: string, columns: ReactNode[], rows: DataGridRow[]) {
  const csvRows = [columns.map(dataGridCellText), ...rows.map((row) => row.cells.map(dataGridCellText))];
  const csv = csvRows
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminInteractiveTablePage({
  title,
  searchPlaceholder,
  totalText,
  pageSizeText,
  columns,
  rows,
  template,
  topRight,
  toolbarLeftExtra,
  toolbarRight,
  hideDownloadButton = false,
  onDownload,
  loading = false,
  serverPagination,
}: AdminInteractiveTablePageProps) {
  const { language } = useI18n();
  const copy = ADMIN_COMMON_CATALOGS[language];
  const serverTotal = serverPagination?.total;
  const onServerRequestChange = serverPagination?.onRequestChange;
  const [query, setQuery] = useState("");
  const [sortState, setSortState] = useState<DataGridSortState | null>(null);
  const defaultPageSize = (Number(pageSizeText?.match(/\d+/)?.[0]) || 10) as ListPageSize;
  const [pageSize, setPageSize] = usePersistedPageSize<ListPageSize>(
    `aidot.page_size.admin.${title}`,
    LIST_PAGE_SIZE_OPTIONS.includes(defaultPageSize) ? defaultPageSize : 10,
    LIST_PAGE_SIZE_OPTIONS,
  );
  const [page, setPage] = useState(1);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const initialQuery = searchParams.get("q");
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, []);

  const filteredRows = useMemo(() => {
    if (serverPagination) {
      return rows;
    }
    const lowered = query.trim().toLowerCase();
    if (!lowered) {
      return rows;
    }
    return rows.filter((row) =>
      [row.searchText ?? "", ...row.cells.map(dataGridCellText)].some((text) => text.toLowerCase().includes(lowered)),
    );
  }, [query, rows, serverPagination]);
  const sortedRows = useMemo(() => {
    if (!sortState) {
      return filteredRows;
    }
    return [...filteredRows].sort((left, right) => {
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
  }, [filteredRows, sortState]);
  const totalPages = Math.max(1, Math.ceil((serverTotal ?? sortedRows.length) / pageSize));
  const pagedRows = serverPagination ? sortedRows : sortedRows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (!onServerRequestChange) {
      return;
    }
    onServerRequestChange({ query: query.trim(), page, pageSize });
  }, [onServerRequestChange, page, pageSize, query]);

  function updatePageSize(nextPageSize: ListPageSize) {
    setPageSize(nextPageSize);
    setPage(1);
  }

  return (
    <section className="admin-page">
      <h2>{title}</h2>

      <div className="admin-page__search-row admin-interactive-table__search-row">
        <label className="admin-page__search">
          <span aria-hidden="true">⌕</span>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
          />
        </label>

        <button type="button" className="admin-page__filter admin-page__filter--text" onClick={() => setQuery("")}>
          {copy.reset}
        </button>

        {topRight ? <div className="admin-page__search-actions">{topRight}</div> : null}
      </div>

      <div className="admin-page__toolbar">
        <div className="admin-page__toolbar-left">
          <strong>{serverPagination ? totalText : query.trim() ? formatAdminText(copy.totalCount, { count: filteredRows.length }) : totalText}</strong>
          <label className="manual-main__mini-select manual-main__mini-select--select">
            <select value={pageSize} onChange={(event) => updatePageSize(Number(event.target.value) as ListPageSize)}>
              {LIST_PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatAdminText(copy.pageSize, { count: option })}
                </option>
              ))}
            </select>
          </label>
          {toolbarLeftExtra}
          {!hideDownloadButton ? (
            <button
              type="button"
              className="admin-page__ghost"
              onClick={() => {
                if (onDownload) {
                  onDownload();
                  return;
                }
                downloadCsv(title, columns, sortedRows);
              }}
            >
              {copy.download}
            </button>
          ) : null}
        </div>

        {toolbarRight ? <div className="admin-page__toolbar-right">{toolbarRight}</div> : null}
      </div>

      <div className="admin-page__grid-scroll">
        <DataGrid
          variant="admin"
          columns={columns}
          rows={pagedRows}
          template={template}
          sortState={sortState}
          onSort={setSortState}
        />
      </div>
      {!loading && filteredRows.length === 0 ? <p className="admin-page__empty">{copy.noData}</p> : null}

      <div className="admin-page__pagination">
        <button type="button" disabled={page === 1} onClick={() => setPage(1)}>
          «
        </button>
        <button type="button" aria-label={copy.previousPage} disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
          ‹
        </button>
        <button type="button" className="is-active">
          {page}
        </button>
        <button type="button" aria-label={copy.nextPage} disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
          ›
        </button>
        <button type="button" disabled={page === totalPages} onClick={() => setPage(totalPages)}>
          »
        </button>
      </div>
    </section>
  );
}
