"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { AdminInteractiveTablePage } from "@/components/admin-interactive-table-page";
import { dataGridCellText, type DataGridRow } from "@/components/data-grid";
import { loadAuthSession } from "@/lib/auth";
import { type ListPageSize } from "@/lib/use-persisted-page-size";
import { useI18n } from "@/components/language-provider";
import { ADMIN_COMMON_CATALOGS, formatAdminText } from "@/lib/i18n/admin-common";

type AdminHistoryFilterColumns = {
  group?: number;
  bot?: number;
  channel?: number;
  date?: number;
};

type AdminHistoryDateRange = {
  fromDate: string;
  toDate: string;
};

type AdminHistoryRequest = AdminHistoryDateRange & {
  query?: string;
  page?: number;
  pageSize?: number;
  group?: string;
  bot?: string;
  channel?: string;
};

type AdminHistoryResponse<T> = {
  items: T[];
  total: number;
  filter_options?: {
    groups?: string[];
    bots?: string[];
    channels?: string[];
  };
};

type AdminHistoryTablePageProps<T> = {
  title: string;
  searchPlaceholder: string;
  pageSizeText?: string;
  columns: ReactNode[];
  template: string;
  fetchItems: (token: string, request?: AdminHistoryRequest) => Promise<AdminHistoryResponse<T>>;
  buildRow: (item: T, index: number) => DataGridRow;
  emptyText?: string;
  topRight?: ReactNode;
  toolbarRight?: ReactNode;
  filterColumns?: AdminHistoryFilterColumns;
  rowFilter?: (row: DataGridRow) => boolean;
  serverDateFilter?: boolean;
  serverPagination?: boolean;
};

function getCellValue(row: DataGridRow, columnIndex?: number) {
  if (columnIndex === undefined) {
    return "";
  }
  return dataGridCellText(row.cells[columnIndex]).trim();
}

function uniqueCellValues(rows: DataGridRow[], columnIndex?: number) {
  if (columnIndex === undefined) {
    return [];
  }
  return Array.from(new Set(rows.map((row) => getCellValue(row, columnIndex)).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, "ko-KR", { numeric: true, sensitivity: "base" }),
  );
}

function parseHistoryDate(value: string) {
  const match = value.match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})(?:[.\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (!match) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)).getTime();
}

function dateInputTime(value: string, endOfDay = false) {
  if (!value) {
    return 0;
  }
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return 0;
  }
  return new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0).getTime();
}

function todayDateText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateTextDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AdminHistoryTablePage<T>({
  title,
  searchPlaceholder,
  pageSizeText,
  columns,
  template,
  fetchItems,
  buildRow,
  emptyText,
  topRight,
  toolbarRight,
  filterColumns,
  rowFilter,
  serverDateFilter = false,
  serverPagination = false,
}: AdminHistoryTablePageProps<T>) {
  const { language } = useI18n();
  const copy = ADMIN_COMMON_CATALOGS[language];
  const resolvedEmptyText = emptyText ?? copy.noData;
  const today = todayDateText();
  const defaultFromDate = dateTextDaysAgo(30);
  const [rows, setRows] = useState<DataGridRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [botFilter, setBotFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(today);
  const defaultPageSize = Number(pageSizeText?.match(/\d+/)?.[0]) || 10;
  const [serverRequest, setServerRequest] = useState({ query: "", page: 1, pageSize: defaultPageSize });
  const [serverTotal, setServerTotal] = useState(0);
  const [serverFilterOptions, setServerFilterOptions] = useState<NonNullable<AdminHistoryResponse<T>["filter_options"]>>({});
  const requestedFromDate = serverDateFilter ? fromDate : "";
  const requestedToDate = serverDateFilter ? toDate : "";

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      setLoading(false);
      setErrorMessage(copy.loginRequired);
      return;
    }

    let ignore = false;
    setLoading(true);
    setErrorMessage("");
    fetchItems(
      session.access_token,
      serverPagination || serverDateFilter
        ? {
            fromDate: requestedFromDate,
            toDate: requestedToDate,
            query: serverPagination ? serverRequest.query : undefined,
            page: serverPagination ? serverRequest.page : undefined,
            pageSize: serverPagination ? serverRequest.pageSize : undefined,
            group: serverPagination ? groupFilter : undefined,
            bot: serverPagination ? botFilter : undefined,
            channel: serverPagination ? channelFilter : undefined,
          }
        : undefined,
    )
      .then((response) => {
        if (!ignore) {
          setRows(response.items.map(buildRow));
          setServerTotal(response.total);
          setServerFilterOptions(response.filter_options ?? {});
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
  }, [
    botFilter,
    buildRow,
    channelFilter,
    fetchItems,
    groupFilter,
    requestedFromDate,
    requestedToDate,
    serverDateFilter,
    serverPagination,
    serverRequest,
    copy.loadFailed,
    copy.loginRequired,
  ]);

  const groupOptions = useMemo(
    () => serverPagination ? serverFilterOptions.groups ?? [] : uniqueCellValues(rows, filterColumns?.group),
    [filterColumns?.group, rows, serverFilterOptions.groups, serverPagination],
  );
  const botOptions = useMemo(
    () => serverPagination ? serverFilterOptions.bots ?? [] : uniqueCellValues(rows, filterColumns?.bot),
    [filterColumns?.bot, rows, serverFilterOptions.bots, serverPagination],
  );
  const channelOptions = useMemo(
    () => serverPagination ? serverFilterOptions.channels ?? [] : uniqueCellValues(rows, filterColumns?.channel),
    [filterColumns?.channel, rows, serverFilterOptions.channels, serverPagination],
  );

  const filteredRows = useMemo(() => {
    if (serverPagination) {
      return rows.filter((row) => !rowFilter || rowFilter(row));
    }
    const fromTime = dateInputTime(fromDate);
    const toTime = dateInputTime(toDate, true);
    return rows.filter((row) => {
      if (groupFilter && getCellValue(row, filterColumns?.group) !== groupFilter) {
        return false;
      }
      if (botFilter && getCellValue(row, filterColumns?.bot) !== botFilter) {
        return false;
      }
      if (channelFilter && getCellValue(row, filterColumns?.channel) !== channelFilter) {
        return false;
      }
      if ((fromTime || toTime) && filterColumns?.date !== undefined) {
        const rowTime = parseHistoryDate(getCellValue(row, filterColumns.date));
        if (!rowTime) {
          return false;
        }
        if (fromTime && rowTime < fromTime) {
          return false;
        }
        if (toTime && rowTime > toTime) {
          return false;
        }
      }
      if (rowFilter && !rowFilter(row)) {
        return false;
      }
      return true;
    });
  }, [botFilter, channelFilter, filterColumns, fromDate, groupFilter, rowFilter, rows, serverPagination, toDate]);

  const handleServerRequestChange = useCallback(
    (nextRequest: { query: string; page: number; pageSize: ListPageSize }) => {
      setServerRequest((current) => (
        current.query === nextRequest.query
        && current.page === nextRequest.page
        && current.pageSize === nextRequest.pageSize
          ? current
          : nextRequest
      ));
    },
    [],
  );

  useEffect(() => {
    if (!serverPagination) {
      return;
    }
    setServerRequest((current) => current.page === 1 ? current : { ...current, page: 1 });
  }, [botFilter, channelFilter, fromDate, groupFilter, serverPagination, toDate]);

  function resetStructuredFilters() {
    setGroupFilter("");
    setBotFilter("");
    setChannelFilter("");
    setFromDate(defaultFromDate);
    setToDate(today);
  }

  const filterControls = filterColumns ? (
    <div className="admin-history-filters">
      {filterColumns.group !== undefined ? (
        <label className="admin-history-filters__field">
          <span>{copy.group}</span>
          <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
            <option value="">{copy.allGroups}</option>
            {groupOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {filterColumns.bot !== undefined ? (
        <label className="admin-history-filters__field">
          <span>{copy.bot}</span>
          <select value={botFilter} onChange={(event) => setBotFilter(event.target.value)}>
            <option value="">{copy.allBots}</option>
            {botOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {filterColumns.channel !== undefined ? (
        <label className="admin-history-filters__field">
          <span>{copy.channel}</span>
          <select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)}>
            <option value="">{copy.allChannels}</option>
            {channelOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {filterColumns.date !== undefined ? (
        <>
          <label className="admin-history-filters__field admin-history-filters__field--date">
            <span>{copy.fromDate}</span>
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </label>
          <label className="admin-history-filters__field admin-history-filters__field--date">
            <span>{copy.toDate}</span>
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </label>
        </>
      ) : null}
      <button type="button" className="admin-page__filter admin-page__filter--text" onClick={resetStructuredFilters}>
        {copy.reset}
      </button>
    </div>
  ) : null;

  const composedTopRight = filterControls || topRight ? (
    <div className="admin-history-controls">
      {filterControls}
      {topRight}
    </div>
  ) : null;

  if (errorMessage) {
    return (
      <section className="admin-page">
        <h2>{title}</h2>
        <div className="admin-state-box">
          <p>{errorMessage}</p>
          <Link href="/login" className="ghost-pill">
            {copy.goToLogin}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <AdminInteractiveTablePage
        title={title}
        searchPlaceholder={searchPlaceholder}
        totalText={loading ? copy.loading : formatAdminText(copy.totalCount, { count: serverPagination ? serverTotal : filteredRows.length })}
        pageSizeText={pageSizeText}
        columns={columns}
        rows={filteredRows}
        template={template}
        loading={loading}
        topRight={composedTopRight}
        toolbarRight={toolbarRight}
        serverPagination={serverPagination ? { total: serverTotal, onRequestChange: handleServerRequestChange } : undefined}
      />
      {loading ? <p className="admin-page__empty">{copy.loadingDetail}</p> : null}
      {!loading && rows.length === 0 ? <p className="admin-page__empty">{resolvedEmptyText}</p> : null}
    </>
  );
}
