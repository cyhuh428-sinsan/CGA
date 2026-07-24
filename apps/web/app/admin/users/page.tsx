"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DataGrid, type DataGridRow } from "@/components/data-grid";
import { useI18n } from "@/components/language-provider";
import { SortHeaderLabel } from "@/components/sort-header-label";
import {
  fetchAdminUsers,
  fetchGroups,
  type AdminGroupListItem,
  type AdminUserFilter,
  type AdminUserListItem,
} from "@/lib/admin-api";
import { loadAuthSession } from "@/lib/auth";
import { ADMIN_USERS_CATALOGS, formatAdminUsersText, type AdminUsersCatalog } from "@/lib/i18n/admin-users";
import {
  LIST_PAGE_SIZE_OPTIONS,
  type ListPageSize,
  usePersistedPageSize,
} from "@/lib/use-persisted-page-size";

type SortKey =
  | "loginId"
  | "name"
  | "group"
  | "role"
  | "requestedAt"
  | "signupStatus"
  | "accountStatus";

function detailHref(item: AdminUserListItem) {
  return `/admin/users/${item.kind === "user" ? `user_${item.id}` : `signup_${item.id}`}`;
}

export default function AdminUsersPage() {
  const { language: uiLanguage } = useI18n();
  const copy: AdminUsersCatalog = ADMIN_USERS_CATALOGS[uiLanguage];
  function formatDate(value: string) {
    return new Intl.DateTimeFormat(uiLanguage, {
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).format(new Date(value));
  }
  const [token, setToken] = useState("");
  const [items, setItems] = useState<AdminUserListItem[]>([]);
  const [groups, setGroups] = useState<AdminGroupListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [groupId, setGroupId] = useState("");
  const [roleCode, setRoleCode] = useState("");
  const [accountStatus, setAccountStatus] = useState("");
  const [signupStatus, setSignupStatus] = useState("");
  const [appliedFilter, setAppliedFilter] = useState<AdminUserFilter>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("requestedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [pageSize, setPageSize] = usePersistedPageSize<ListPageSize>(
    "aidot.page_size.admin.users",
    100,
    LIST_PAGE_SIZE_OPTIONS,
  );
  const [page, setPage] = useState(1);

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
    fetchGroups(token)
      .then((response) => {
        if (!ignore) {
          setGroups(response.items);
        }
      })
      .catch(() => {
        // Filter loading failure does not block the user list.
      });

    return () => {
      ignore = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let ignore = false;
    setLoading(true);
    setErrorMessage("");
    fetchAdminUsers(token, appliedFilter)
      .then((response) => {
        if (!ignore) {
          setItems(response.items);
          setTotal(response.total);
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
  }, [appliedFilter, token]);

  function handleSearch() {
    setAppliedFilter({
      query: query.trim() || undefined,
      groupId: groupId || undefined,
      roleCode: roleCode || undefined,
      accountStatus: accountStatus || undefined,
      signupStatus: signupStatus || undefined,
    });
  }

  const sortedItems = [...items].sort((left, right) => {
    const leftValue = (() => {
      switch (sortKey) {
        case "loginId":
          return left.login_id;
        case "name":
          return left.name;
        case "group":
          return left.group_name;
        case "role":
          return left.role_name;
        case "signupStatus":
          return left.signup_status;
        case "accountStatus":
          return left.account_status;
        case "requestedAt":
        default:
          return left.requested_at;
      }
    })();
    const rightValue = (() => {
      switch (sortKey) {
        case "loginId":
          return right.login_id;
        case "name":
          return right.name;
        case "group":
          return right.group_name;
        case "role":
          return right.role_name;
        case "signupStatus":
          return right.signup_status;
        case "accountStatus":
          return right.account_status;
        case "requestedAt":
        default:
          return right.requested_at;
      }
    })();
    const compare = String(leftValue).localeCompare(String(rightValue), uiLanguage);
    return sortDirection === "asc" ? compare : compare * -1;
  });

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const pagedItems = sortedItems.slice((page - 1) * pageSize, page * pageSize);
  const allPagedSelected =
    pagedItems.length > 0 && pagedItems.every((item) => selectedIds.includes(`${item.kind}-${item.id}`));

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [appliedFilter, pageSize, sortDirection, sortKey]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  const rows: DataGridRow[] = pagedItems.map((item) => {
    const rowId = `${item.kind}-${item.id}`;
    return {
      key: rowId,
      className: item.kind === "signup_request" ? "data-grid__row--pending" : "",
      cells: [
        <input
          key="check"
          type="checkbox"
          aria-label={formatAdminUsersText(copy.selectUser, { loginId: item.login_id })}
          checked={selectedIds.includes(rowId)}
          onChange={() =>
            setSelectedIds((current) =>
              current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId],
            )
          }
        />,
        <Link key="login" href={detailHref(item)} className="table-link">
          {item.login_id}
        </Link>,
        <Link key="name" href={detailHref(item)} className="table-link">
          {item.name}
        </Link>,
        item.group_name,
        copy.roleNames[item.role_code] ?? item.role_name,
        formatDate(item.requested_at),
        copy.signupStatuses[item.signup_status] ?? item.signup_status,
        copy.accountStatuses[item.account_status] ?? item.account_status,
      ],
    };
  });

  return (
    <section className="admin-page">
      <h2>{copy.title}</h2>

      <div className="admin-page__search-row admin-users-page__search-row">
        <label className="admin-page__search">
          <span aria-hidden="true">⌕</span>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
          />
        </label>

        <select className="login-select" value={groupId} onChange={(event) => setGroupId(event.target.value)}>
          <option value="">{copy.allGroups}</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>

        <select className="login-select" value={roleCode} onChange={(event) => setRoleCode(event.target.value)}>
          <option value="">{copy.allRoles}</option>
          <option value="curator">{copy.roleNames.curator}</option>
          <option value="operation_manager">{copy.roleNames.operation_manager}</option>
          <option value="system_manager">{copy.roleNames.system_manager}</option>
          <option value="it_admin">{copy.roleNames.it_admin}</option>
        </select>

        <select
          className="login-select"
          value={accountStatus}
          onChange={(event) => setAccountStatus(event.target.value)}
        >
          <option value="">{copy.allAccountStatuses}</option>
          <option value="active">{copy.accountStatuses.active}</option>
          <option value="locked">{copy.accountStatuses.locked}</option>
          <option value="password_reset">{copy.accountStatuses.password_reset}</option>
          <option value="inactive">{copy.accountStatuses.inactive}</option>
        </select>

        <select
          className="login-select"
          value={signupStatus}
          onChange={(event) => setSignupStatus(event.target.value)}
        >
          <option value="">{copy.allSignupStatuses}</option>
          <option value="approved">{copy.signupStatuses.approved}</option>
          <option value="pending">{copy.signupStatuses.pending}</option>
          <option value="rejected">{copy.signupStatuses.rejected}</option>
        </select>

        <div className="admin-page__search-actions">
          <button type="button" className="admin-page__primary" onClick={handleSearch}>
            {copy.search}
          </button>
        </div>
      </div>

      <div className="admin-page__toolbar">
        <div className="admin-page__toolbar-left">
          <strong>{formatAdminUsersText(copy.total, { count: total.toLocaleString(uiLanguage) })}</strong>
          <label className="manual-main__mini-select manual-main__mini-select--select">
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as ListPageSize)}>
              {LIST_PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatAdminUsersText(copy.perPage, { count: option.toLocaleString(uiLanguage) })}
                </option>
              ))}
            </select>
          </label>
          {selectedIds.length > 0 ? <span className="admin-page__selection">{formatAdminUsersText(copy.selected, { count: selectedIds.length.toLocaleString(uiLanguage) })}</span> : null}
        </div>
      </div>

      {errorMessage ? (
        <div className="admin-state-box">
          <p>{errorMessage}</p>
          <Link href="/login" className="ghost-pill">
            {copy.goToLogin}
          </Link>
        </div>
      ) : null}

      {!errorMessage ? (
        <>
          <DataGrid
            variant="admin"
            className="admin-users-page__grid"
            template="36px minmax(92px, 0.8fr) minmax(128px, 1fr) minmax(112px, 0.8fr) minmax(112px, 0.8fr) minmax(160px, 1fr) minmax(116px, 0.8fr) minmax(104px, 0.7fr)"
            columns={[
              <input
                key="check"
                type="checkbox"
                aria-label={copy.selectAll}
                checked={allPagedSelected}
                onChange={(event) =>
                  setSelectedIds((current) => {
                    const pageIds = pagedItems.map((item) => `${item.kind}-${item.id}`);
                    if (event.target.checked) {
                      return Array.from(new Set([...current, ...pageIds]));
                    }
                    return current.filter((id) => !pageIds.includes(id));
                  })
                }
              />,
              <button key="login" type="button" className="settings-sort-button" onClick={() => toggleSort("loginId")}>
                <SortHeaderLabel label={copy.columns[1]} direction={sortKey === "loginId" ? sortDirection : "none"} />
              </button>,
              <button key="name" type="button" className="settings-sort-button" onClick={() => toggleSort("name")}>
                <SortHeaderLabel label={copy.columns[2]} direction={sortKey === "name" ? sortDirection : "none"} />
              </button>,
              <button key="group" type="button" className="settings-sort-button" onClick={() => toggleSort("group")}>
                <SortHeaderLabel label={copy.columns[3]} direction={sortKey === "group" ? sortDirection : "none"} />
              </button>,
              <button key="role" type="button" className="settings-sort-button" onClick={() => toggleSort("role")}>
                <SortHeaderLabel label={copy.columns[4]} direction={sortKey === "role" ? sortDirection : "none"} />
              </button>,
              <button key="requested" type="button" className="settings-sort-button" onClick={() => toggleSort("requestedAt")}>
                <SortHeaderLabel label={copy.columns[5]} direction={sortKey === "requestedAt" ? sortDirection : "none"} />
              </button>,
              <button key="signup" type="button" className="settings-sort-button" onClick={() => toggleSort("signupStatus")}>
                <SortHeaderLabel label={copy.columns[6]} direction={sortKey === "signupStatus" ? sortDirection : "none"} />
              </button>,
              <button key="account" type="button" className="settings-sort-button" onClick={() => toggleSort("accountStatus")}>
                <SortHeaderLabel label={copy.columns[7]} direction={sortKey === "accountStatus" ? sortDirection : "none"} />
              </button>,
            ]}
            rows={loading ? [] : rows}
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
    </section>
  );
}
