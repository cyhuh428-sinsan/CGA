"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminInteractiveTablePage } from "@/components/admin-interactive-table-page";
import { type DataGridRow } from "@/components/data-grid";
import { useI18n } from "@/components/language-provider";
import { fetchGroups, type AdminGroupListItem } from "@/lib/admin-api";
import { loadAuthSession } from "@/lib/auth";
import { ADMIN_GROUPS_CATALOGS, formatAdminGroupsText, type AdminGroupsCatalog } from "@/lib/i18n/admin-groups";

export default function AdminGroupsPage() {
  const { language: uiLanguage } = useI18n();
  const copy: AdminGroupsCatalog = ADMIN_GROUPS_CATALOGS[uiLanguage];
  const [token, setToken] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<AdminGroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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
    fetchGroups(token)
      .then((response) => {
        if (ignore) {
          return;
        }
        setTotal(response.total);
        setItems(response.items);
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
  }, [token]);

  function formatDate(value: string | null | undefined) {
    if (!value) return "-";
    return new Intl.DateTimeFormat(uiLanguage, {
      year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false,
    }).format(new Date(value));
  }

  const rows: DataGridRow[] = items.map((item) => ({
    key:item.id,
    cells:[
      <Link key={`code-${item.id}`} href={`/admin/groups/${item.id}`} className="table-link">{item.code}</Link>,
      <Link key={`name-${item.id}`} href={`/admin/groups/${item.id}`} className="table-link">{item.name}</Link>,
      copy.statuses[item.status] ?? item.status,
      item.creator_name,
      item.updater_name,
      formatDate(item.updated_at),
    ],
  }));

  if (errorMessage) {
    return (
      <section className="admin-page">
        <h2>{copy.title}</h2>
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
    <AdminInteractiveTablePage
      title={copy.title}
      searchPlaceholder={copy.searchPlaceholder}
      totalText={loading ? copy.loading : formatAdminGroupsText(copy.total, { count: total.toLocaleString(uiLanguage) })}
      columns={copy.columns}
      rows={loading ? [] : rows}
      template="220px 220px 160px 180px 180px 210px"
      loading={loading}
      topRight={
        <Link href="/admin/groups/new" className="admin-page__primary">
          {copy.create}
        </Link>
      }
    />
  );
}
