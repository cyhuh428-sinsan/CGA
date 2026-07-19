"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminInteractiveTablePage } from "@/components/admin-interactive-table-page";
import { type DataGridRow } from "@/components/data-grid";
import { fetchGroups } from "@/lib/admin-api";
import { loadAuthSession } from "@/lib/auth";

function formatDate(value: string | null | undefined) {
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

export default function AdminGroupsPage() {
  const [token, setToken] = useState("");
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
    fetchGroups(token)
      .then((response) => {
        if (ignore) {
          return;
        }
        setTotal(response.total);
        setRows(
          response.items.map((item) => ({
            key: item.id,
            cells: [
              <Link key={`code-${item.id}`} href={`/admin/groups/${item.id}`} className="table-link">
                {item.code}
              </Link>,
              <Link key={`name-${item.id}`} href={`/admin/groups/${item.id}`} className="table-link">
                {item.name}
              </Link>,
              item.status,
              item.creator_name,
              item.updater_name,
              formatDate(item.updated_at),
            ],
          })),
        );
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : "그룹 목록을 불러오지 못했습니다.");
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
  }, [token]);

  if (errorMessage) {
    return (
      <section className="admin-page">
        <h2>그룹 관리</h2>
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
      title="그룹 관리"
      searchPlaceholder="그룹 아이디 또는 그룹 이름을 검색하세요."
      totalText={loading ? "불러오는 중" : `전체 ${total}건`}
      columns={["그룹 아이디", "그룹 이름", "사용여부", "생성자", "최종수정자", "최종수정일시"]}
      rows={loading ? [] : rows}
      template="220px 220px 160px 180px 180px 210px"
      loading={loading}
      topRight={
        <Link href="/admin/groups/new" className="admin-page__primary">
          + 그룹 생성
        </Link>
      }
    />
  );
}
