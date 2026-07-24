"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useI18n } from "@/components/language-provider";
import { fetchAdminUserDetail, type AdminUserDetail } from "@/lib/admin-api";
import { apiRequest } from "@/lib/api";
import { loadAuthSession } from "@/lib/auth";
import { ADMIN_USERS_CATALOGS, formatAdminUsersText, isDefaultOrganizationName, legacyAdminAccountStatusLabel, resolveAdminAccountStatus, resolveAdminSignupStatus, type AdminUsersCatalog } from "@/lib/i18n/admin-users";
import { getLanguageLabel } from "@/lib/language";

const ROLE_OPTIONS = [
  "curator", "operation_manager", "system_manager", "it_admin",
] as const;

export default function AdminUserDetailPage() {
  const router = useRouter();
  const { language: uiLanguage } = useI18n();
  const copy: AdminUsersCatalog = ADMIN_USERS_CATALOGS[uiLanguage];
  const routeParams = useParams<{ entryId: string }>();
  const resolvedEntryId =
    typeof routeParams.entryId === "string" ? routeParams.entryId : undefined;
  const [token, setToken] = useState("");
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState("curator");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("active");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      setLoading(false);
      setErrorMessage(copy.loginRequired);
      return;
    }
    setToken(session.access_token);
  }, []);

  const entryInfo = useMemo(() => {
    if (!resolvedEntryId) {
      return null;
    }
    if (resolvedEntryId.startsWith("user_")) {
      return { kind: "user" as const, id: resolvedEntryId.slice(5) };
    }
    if (resolvedEntryId.startsWith("signup_")) {
      return { kind: "signup_request" as const, id: resolvedEntryId.slice(7) };
    }
    return null;
  }, [resolvedEntryId]);

  useEffect(() => {
    if (!token || !entryInfo) {
      if (!entryInfo) {
        setLoading(false);
        setErrorMessage(copy.detailForm.invalidId);
      }
      return;
    }

    let ignore = false;
    setLoading(true);
    setErrorMessage("");
    fetchAdminUserDetail(token, entryInfo.kind, entryInfo.id)
      .then((data) => {
        if (ignore) {
          return;
        }
        setDetail(data);
        setName(data.name);
        setSelectedRole(data.role_code);
        setSelectedGroupId(data.group_id);
        setSelectedStatus(resolveAdminAccountStatus(data.account_status));
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : copy.detailForm.loadFailed);
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
  }, [entryInfo, token]);

  async function handleAction(action: "approve" | "reject" | "save" | "delete") {
    if (!entryInfo || !detail) {
      return;
    }

    setSubmitting(true);
    setMessage("");
    setErrorMessage("");

    try {
      if (entryInfo.kind === "signup_request") {
        if (action === "approve") {
          await apiRequest(
            `/api/v1/admin/signup-requests/${entryInfo.id}/approve`,
            {
              method: "POST",
              body: JSON.stringify({ role_code: selectedRole, group_id: selectedGroupId }),
            },
            token,
          );
        } else if (action === "reject") {
          await apiRequest(
            `/api/v1/admin/signup-requests/${entryInfo.id}/reject`,
            { method: "POST" },
            token,
          );
        }
      } else {
        if (action === "save") {
          await apiRequest(
            `/api/v1/admin/users/${entryInfo.id}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                name: name.trim(),
                role_code: selectedRole,
                group_id: selectedGroupId,
                status: selectedStatus,
              }),
            },
            token,
          );
          setDetail({
            ...detail,
            name: name.trim(),
            role_code: selectedRole as AdminUserDetail["role_code"],
            role_name: copy.roleNames[selectedRole] ?? detail.role_name,
            group_id: selectedGroupId,
            group_name:
              detail.available_groups.find((group) => group.id === selectedGroupId)?.name ??
              detail.group_name,
            account_status: legacyAdminAccountStatusLabel(selectedStatus),
            data_json: {
              ...detail.data_json,
              name: name.trim(),
              group_id: selectedGroupId,
              group_name:
                detail.available_groups.find((group) => group.id === selectedGroupId)?.name ??
                detail.group_name,
              roles: [selectedRole],
              status: selectedStatus,
            },
          });
          setMessage(copy.detailForm.updated);
        } else if (action === "delete") {
          await apiRequest(
            `/api/v1/admin/users/${entryInfo.id}`,
            { method: "DELETE" },
            token,
          );
          setMessage(copy.detailForm.deleted);
          router.push("/admin/users");
          router.refresh();
          return;
        }
      }

      if (entryInfo.kind === "signup_request") {
        setMessage(action === "approve" ? copy.detailForm.approved : copy.detailForm.rejected);
        router.push("/admin/users");
        router.refresh();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : copy.detailForm.actionError);
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat(uiLanguage, {
      year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false,
    }).format(new Date(value));
  }

  return (
    <section className="admin-detail">
      <div className="admin-detail__header">
        <div>
          <h2>{copy.detailForm.title}</h2>
          <p>{copy.detailForm.subtitle}</p>
        </div>
        <Link href="/admin/users" className="secondary-action">
          {copy.detailForm.back}
        </Link>
      </div>

      {loading ? <p className="admin-page__empty">{copy.detailForm.loading}</p> : null}
      {errorMessage ? <p className="form-message form-message--error">{errorMessage}</p> : null}
      {message ? <p className="form-message form-message--success">{message}</p> : null}

      {detail ? (
        <div className="admin-detail__grid">
          <div className="admin-detail__card">
            <h3>{copy.detailForm.info}</h3>
            <dl className="admin-detail__list">
              <div>
                <dt>{copy.detailForm.account}</dt>
                <dd>{detail.login_id}</dd>
              </div>
              <div>
                <dt>{copy.detailForm.name}</dt>
                <dd>{detail.name}</dd>
              </div>
              <div>
                <dt>{copy.detailForm.server}</dt>
                <dd>{isDefaultOrganizationName(detail.organization_name) ? copy.detailForm.defaultServer : detail.organization_name}</dd>
              </div>
              <div>
                <dt>{copy.detailForm.group}</dt>
                <dd>{detail.group_name}</dd>
              </div>
              <div>
                <dt>{copy.detailForm.requestedAt}</dt>
                <dd>{formatDate(detail.requested_at)}</dd>
              </div>
              <div>
                <dt>{copy.detailForm.signupStatus}</dt>
                <dd>{copy.signupStatuses[resolveAdminSignupStatus(detail.signup_status)] ?? detail.signup_status}</dd>
              </div>
              <div>
                <dt>{copy.detailForm.accountStatus}</dt>
                <dd>{copy.accountStatuses[resolveAdminAccountStatus(detail.account_status)] ?? detail.account_status}</dd>
              </div>
              <div>
                <dt>{copy.detailForm.language}</dt>
                <dd>{getLanguageLabel(detail.preferred_language)}</dd>
              </div>
              {detail.comment ? (
                <div className="admin-detail__wide">
                  <dt>{copy.detailForm.comment}</dt>
                  <dd>{detail.comment}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="admin-detail__card">
            <h3>{detail.kind === "signup_request" ? copy.detailForm.approveTitle : copy.detailForm.editTitle}</h3>
            <label className="field-block">
              <span>{copy.detailForm.name}</span>
              <input
                className="input-control"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={submitting || detail.kind === "signup_request"}
              />
            </label>

            <label className="field-block">
              <span>{copy.detailForm.role}</span>
              <select
                className="login-select"
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
                disabled={submitting}
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {copy.roleNames[role]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-block">
              <span>{copy.detailForm.group}</span>
              <select
                className="login-select"
                value={selectedGroupId}
                onChange={(event) => setSelectedGroupId(event.target.value)}
                disabled={submitting}
              >
                {detail.available_groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>

            {detail.kind === "user" ? (
              <label className="field-block">
                <span>{copy.detailForm.accountStatus}</span>
                <select
                  className="login-select"
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value)}
                  disabled={submitting}
                >
                  <option value="active">{copy.accountStatuses.active}</option>
                  <option value="inactive">{copy.accountStatuses.inactive}</option>
                  <option value="locked">{copy.accountStatuses.locked}</option>
                  <option value="password_reset">{copy.accountStatuses.password_reset}</option>
                </select>
              </label>
            ) : null}

            {detail.kind === "signup_request" ? (
              <div className="admin-detail__actions">
                <button
                  type="button"
                  className="primary-action"
                  onClick={() => handleAction("approve")}
                  disabled={submitting}
                >
                  {copy.detailForm.approve}
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => handleAction("reject")}
                  disabled={submitting}
                >
                  {copy.detailForm.reject}
                </button>
              </div>
            ) : (
              <div className="admin-detail__actions">
                <button
                  type="button"
                  className="primary-action"
                  onClick={() => handleAction("save")}
                  disabled={submitting || !name.trim() || !selectedGroupId}
                >
                  {copy.detailForm.save}
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => handleAction("delete")}
                  disabled={submitting || detail.is_protected}
                >
                  {detail.is_protected ? copy.detailForm.cannotDelete : copy.detailForm.delete}
                </button>
              </div>
            )}

            <p className="admin-detail__hint">
              {formatAdminUsersText(copy.detailForm.currentRole, { role: copy.roleNames[selectedRole] ?? selectedRole })}
            </p>
            <p className="admin-detail__hint">
              {copy.detailForm.groupHint}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
