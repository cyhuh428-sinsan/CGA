"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminInteractiveTablePage } from "@/components/admin-interactive-table-page";
import { type DataGridRow } from "@/components/data-grid";
import { fetchLoginHistory, type AdminLoginHistoryFilter } from "@/lib/admin-api";
import { loadAuthSession } from "@/lib/auth";

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }
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

function todayDateText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AdminLoginHistoryPage() {
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
              formatDate(item.login_at),
              formatDate(item.logout_at),
            ],
          })),
        );
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : "로그인 이력을 불러오지 못했습니다.");
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
  }, [appliedFilter, token]);

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
        <h2>로그인 이력</h2>
        <div className="admin-state-box">
          <p>{errorMessage}</p>
          <Link href="/login" className="ghost-pill">
            로그인으로 이동
          </Link>
        </div>
      </section>
    );
  }

  return (
    <AdminInteractiveTablePage
      title="로그인 이력"
      searchPlaceholder="사용자 계정 또는 사용자 이름을 검색하세요."
      totalText={loading ? "불러오는 중" : `전체 ${total}건`}
      pageSizeText="100개씩 보기"
      columns={["사용자 계정", "사용자 이름", "그룹", "역할", "접속한 IP", "로그인 시간", "로그아웃 시간"]}
      rows={loading ? [] : rows}
      template="200px 160px 180px 160px 190px 190px 190px"
      loading={loading}
      topRight={
        <div className="admin-history-filters">
          <label className="admin-history-filters__field admin-history-filters__field--date">
            <span>시작일</span>
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </label>
          <label className="admin-history-filters__field admin-history-filters__field--date">
            <span>종료일</span>
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </label>
          <button type="button" className="admin-page__filter admin-page__filter--text" onClick={resetDateFilter}>
            초기화
          </button>
          <button type="button" className="admin-page__primary" onClick={handleSearch}>
            조회
          </button>
        </div>
      }
    />
  );
}
