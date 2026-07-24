"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminInteractiveTablePage } from "@/components/admin-interactive-table-page";
import { type DataGridRow } from "@/components/data-grid";
import { fetchLoginHistory, type AdminLoginHistoryFilter } from "@/lib/admin-api";
import { loadAuthSession } from "@/lib/auth";
import { useI18n } from "@/components/language-provider";
import { ADMIN_PAGE_CATALOGS } from "@/lib/i18n/admin-pages";
import { ADMIN_COMMON_CATALOGS, formatAdminText } from "@/lib/i18n/admin-common";
import type { SupportedLanguage } from "@/lib/language";

function formatDate(value: string | null, language: SupportedLanguage) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat(language, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function todayDateText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AdminLoginHistoryPage() {
  const { language } = useI18n();
  const copy = ADMIN_PAGE_CATALOGS[language].loginHistory;
  const commonCopy = ADMIN_COMMON_CATALOGS[language];
  const today = todayDateText();
  const [token, setToken] = useState("");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [appliedFilter, setAppliedFilter] = useState<AdminLoginHistoryFilter>({
    fromDate: today,
    toDate: today,
  });
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<DataGridRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      setLoading(false);
      setErrorMessage(commonCopy.loginRequired);
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
    fetchLoginHistory(token, appliedFilter)
      .then((response) => {
        if (ignore) {
          return;
        }
        setTotal(response.total);
        setRows(
          response.items.map((item) => ({
            key: item.id,
            cells: [
              item.login_id,
              item.name,
              item.group_name,
              item.role_name,
              item.ip_address ?? "-",
              formatDate(item.login_at, language),
              formatDate(item.logout_at, language),
            ],
          })),
        );
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : commonCopy.loadFailed);
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
  }, [appliedFilter, commonCopy.loadFailed, language, token]);

  function handleSearch() {
    setAppliedFilter({
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    });
  }

  function resetDateFilter() {
    setFromDate(today);
    setToDate(today);
    setAppliedFilter({
      fromDate: today,
      toDate: today,
    });
  }

  if (errorMessage) {
    return (
      <section className="admin-page">
        <h2>{copy.title}</h2>
        <div className="admin-state-box">
          <p>{errorMessage}</p>
          <Link href="/login" className="ghost-pill">
            {commonCopy.goToLogin}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <AdminInteractiveTablePage
      title={copy.title}
      searchPlaceholder={copy.searchPlaceholder}
      totalText={loading ? commonCopy.loading : formatAdminText(commonCopy.totalCount, { count: total })}
      pageSizeText={formatAdminText(commonCopy.pageSize, { count: 100 })}
      columns={copy.columns}
      rows={loading ? [] : rows}
      template="200px 160px 180px 160px 190px 190px 190px"
      loading={loading}
      topRight={
        <div className="admin-history-filters">
          <label className="admin-history-filters__field admin-history-filters__field--date">
            <span>{commonCopy.fromDate}</span>
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </label>
          <label className="admin-history-filters__field admin-history-filters__field--date">
            <span>{commonCopy.toDate}</span>
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </label>
          <button type="button" className="admin-page__filter admin-page__filter--text" onClick={resetDateFilter}>
            {commonCopy.reset}
          </button>
          <button type="button" className="admin-page__primary" onClick={handleSearch}>
            {commonCopy.search}
          </button>
        </div>
      }
    />
  );
}
