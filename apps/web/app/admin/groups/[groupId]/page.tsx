"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useI18n } from "@/components/language-provider";
import { fetchGroupDetail, type AdminGroupDetail } from "@/lib/admin-api";
import { apiRequest } from "@/lib/api";
import { loadAuthSession } from "@/lib/auth";
import { ADMIN_GROUPS_CATALOGS, type AdminGroupsCatalog } from "@/lib/i18n/admin-groups";

export default function AdminGroupDetailPage() {
  const router = useRouter();
  const { language: uiLanguage } = useI18n();
  const copy: AdminGroupsCatalog = ADMIN_GROUPS_CATALOGS[uiLanguage];
  const routeParams = useParams<{ groupId: string }>();
  const resolvedGroupId = typeof routeParams.groupId === "string" ? routeParams.groupId : undefined;
  const [token, setToken] = useState("");
  const [detail, setDetail] = useState<AdminGroupDetail | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
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

    if (!resolvedGroupId) {
      setLoading(false);
      setErrorMessage(copy.detailForm.invalidId);
      return;
    }

    let ignore = false;
    setLoading(true);
    setErrorMessage("");
    fetchGroupDetail(token, resolvedGroupId)
      .then((data) => {
        if (ignore) {
          return;
        }
        setDetail(data);
        setName(data.name);
        setStatus(data.status);
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
  }, [resolvedGroupId, token]);

  async function handleSubmit() {
    if (!token || !detail) {
      return;
    }

    setSubmitting(true);
    setMessage("");
    setErrorMessage("");
    try {
      const result = await apiRequest<{ message: string }>(
        `/api/v1/admin/groups/${detail.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name, status }),
        },
        token,
      );
      setMessage(result.message);
      setDetail({
        ...detail,
        name,
        status,
        status_label: copy.statuses[status] ?? status,
        updated_at: new Date().toISOString(),
        data_json: {
          ...detail.data_json,
          name,
          status,
        },
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : copy.detailForm.updateError);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!token || !detail) {
      return;
    }

    setSubmitting(true);
    setMessage("");
    setErrorMessage("");
    try {
      const result = await apiRequest<{ message: string }>(
        `/api/v1/admin/groups/${detail.id}`,
        {
          method: "DELETE",
        },
        token,
      );
      setMessage(result.message);
      router.push("/admin/groups");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : copy.detailForm.deleteError);
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
        <Link href="/admin/groups" className="secondary-action">
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
                <dt>{copy.detailForm.groupId}</dt>
                <dd>{detail.code}</dd>
              </div>
              <div>
                <dt>{copy.detailForm.userCount}</dt>
                <dd>{detail.user_count.toLocaleString(uiLanguage)}</dd>
              </div>
              <div>
                <dt>{copy.detailForm.creator}</dt>
                <dd>{detail.creator_name}</dd>
              </div>
              <div>
                <dt>{copy.detailForm.updater}</dt>
                <dd>{detail.updater_name}</dd>
              </div>
              <div>
                <dt>{copy.detailForm.createdAt}</dt>
                <dd>{formatDate(detail.created_at)}</dd>
              </div>
              <div>
                <dt>{copy.detailForm.updatedAt}</dt>
                <dd>{formatDate(detail.updated_at)}</dd>
              </div>
            </dl>
          </div>

          <div className="admin-detail__card">
            <h3>{copy.detailForm.edit}</h3>
            <label className="field-block">
              <span>{copy.detailForm.name}</span>
              <input
                className="input-control"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={submitting}
              />
            </label>

            <label className="field-block">
              <span>{copy.detailForm.enabled}</span>
              <select
                className="login-select login-select--full"
                value={status}
                onChange={(event) => setStatus(event.target.value as "active" | "inactive")}
                disabled={submitting}
              >
                <option value="active">{copy.statuses.active}</option>
                <option value="inactive">{copy.statuses.inactive}</option>
              </select>
            </label>

            <div className="admin-detail__actions">
              <button
                type="button"
                className="primary-action"
                onClick={handleSubmit}
                disabled={submitting || !name.trim()}
              >
                {submitting ? copy.detailForm.saving : copy.detailForm.save}
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={handleDelete}
                disabled={submitting}
              >
                {copy.detailForm.delete}
              </button>
            </div>

            <p className="admin-detail__hint">
              {copy.detailForm.hintAccess}
            </p>
            <p className="admin-detail__hint">
              {copy.detailForm.hintDelete}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
