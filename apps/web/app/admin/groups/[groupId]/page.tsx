"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { fetchGroupDetail, type AdminGroupDetail } from "@/lib/admin-api";
import { apiRequest } from "@/lib/api";
import { loadAuthSession } from "@/lib/auth";

function formatDate(value: string) {
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

export default function AdminGroupDetailPage() {
  const router = useRouter();
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
      setErrorMessage("로그인이 필요합니다.");
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
      setErrorMessage("그룹 식별 정보가 올바르지 않습니다.");
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
          setErrorMessage(error instanceof Error ? error.message : "그룹 정보를 불러오지 못했습니다.");
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
        status_label: status === "active" ? "사용" : "미사용",
        updated_at: new Date().toISOString(),
        data_json: {
          ...detail.data_json,
          name,
          status,
        },
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "그룹 수정 중 오류가 발생했습니다.");
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
      setErrorMessage(error instanceof Error ? error.message : "그룹 삭제 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="admin-detail">
      <div className="admin-detail__header">
        <div>
          <h2>그룹 상세</h2>
          <p>현재 서버에 속한 그룹 정보를 확인하고 수정합니다.</p>
        </div>
        <Link href="/admin/groups" className="secondary-action">
          목록으로
        </Link>
      </div>

      {loading ? <p className="admin-page__empty">불러오는 중입니다...</p> : null}
      {errorMessage ? <p className="form-message form-message--error">{errorMessage}</p> : null}
      {message ? <p className="form-message form-message--success">{message}</p> : null}

      {detail ? (
        <div className="admin-detail__grid">
          <div className="admin-detail__card">
            <h3>기본 정보</h3>
            <dl className="admin-detail__list">
              <div>
                <dt>그룹 아이디</dt>
                <dd>{detail.code}</dd>
              </div>
              <div>
                <dt>사용자 수</dt>
                <dd>{detail.user_count}</dd>
              </div>
              <div>
                <dt>생성자</dt>
                <dd>{detail.creator_name}</dd>
              </div>
              <div>
                <dt>최종수정자</dt>
                <dd>{detail.updater_name}</dd>
              </div>
              <div>
                <dt>생성일시</dt>
                <dd>{formatDate(detail.created_at)}</dd>
              </div>
              <div>
                <dt>최종수정일시</dt>
                <dd>{formatDate(detail.updated_at)}</dd>
              </div>
            </dl>
          </div>

          <div className="admin-detail__card">
            <h3>그룹 수정</h3>
            <label className="field-block">
              <span>그룹 이름</span>
              <input
                className="input-control"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={submitting}
              />
            </label>

            <label className="field-block">
              <span>사용 여부</span>
              <select
                className="login-select login-select--full"
                value={status}
                onChange={(event) => setStatus(event.target.value as "active" | "inactive")}
                disabled={submitting}
              >
                <option value="active">사용</option>
                <option value="inactive">미사용</option>
              </select>
            </label>

            <div className="admin-detail__actions">
              <button
                type="button"
                className="primary-action"
                onClick={handleSubmit}
                disabled={submitting || !name.trim()}
              >
                {submitting ? "저장 중..." : "저장"}
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={handleDelete}
                disabled={submitting}
              >
                삭제
              </button>
            </div>

            <p className="admin-detail__hint">
              그룹 사용 여부를 변경하면 이 그룹에 속한 사용자의 봇 접근 범위에 영향을 줍니다.
            </p>
            <p className="admin-detail__hint">
              그룹에 사용자, 봇, API가 연결되어 있으면 삭제되지 않아야 하며 현재는 서버 검증 결과를 그대로 따릅니다.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
