"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { fetchAdminUserDetail, type AdminUserDetail } from "@/lib/admin-api";
import { apiRequest } from "@/lib/api";
import { loadAuthSession, roleLabel } from "@/lib/auth";

const ROLE_OPTIONS = [
  { value: "curator", label: "큐레이터" },
  { value: "operation_manager", label: "운영관리자" },
  { value: "system_manager", label: "시스템관리자" },
  { value: "it_admin", label: "IT관리자" },
] as const;

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

export default function AdminUserDetailPage() {
  const router = useRouter();
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
      setErrorMessage("로그인이 필요합니다.");
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
        setErrorMessage("사용자 식별 정보가 올바르지 않습니다.");
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
        setSelectedStatus(
          data.account_status === "활성"
            ? "active"
            : data.account_status === "잠김"
              ? "locked"
              : data.account_status === "비밀번호 초기화"
                ? "password_reset"
                : "inactive",
        );
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : "상세 정보를 불러오지 못했습니다.");
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
            role_name: roleLabel(selectedRole),
            group_id: selectedGroupId,
            group_name:
              detail.available_groups.find((group) => group.id === selectedGroupId)?.name ??
              detail.group_name,
            account_status:
              selectedStatus === "active"
                ? "활성"
                : selectedStatus === "locked"
                  ? "잠김"
                  : selectedStatus === "password_reset"
                    ? "비밀번호 초기화"
                    : "비활성",
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
          setMessage("사용자 정보가 변경되었습니다.");
        } else if (action === "delete") {
          await apiRequest(
            `/api/v1/admin/users/${entryInfo.id}`,
            { method: "DELETE" },
            token,
          );
          setMessage("사용자가 삭제되었습니다.");
          router.push("/admin/users");
          router.refresh();
          return;
        }
      }

      if (entryInfo.kind === "signup_request") {
        setMessage(action === "approve" ? "회원가입 신청이 승인되었습니다." : "회원가입 신청이 반려되었습니다.");
        router.push("/admin/users");
        router.refresh();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "작업 처리 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="admin-detail">
      <div className="admin-detail__header">
        <div>
          <h2>사용자 상세</h2>
          <p>사용자 관리 화면과 연결된 승인/상태 관리 페이지입니다.</p>
        </div>
        <Link href="/admin/users" className="secondary-action">
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
                <dt>사용자 계정</dt>
                <dd>{detail.login_id}</dd>
              </div>
              <div>
                <dt>사용자 이름</dt>
                <dd>{detail.name}</dd>
              </div>
              <div>
                <dt>서버</dt>
                <dd>{detail.organization_name === "기본 테넌트" ? "기본 서버" : detail.organization_name}</dd>
              </div>
              <div>
                <dt>그룹</dt>
                <dd>{detail.group_name}</dd>
              </div>
              <div>
                <dt>신청일시</dt>
                <dd>{formatDate(detail.requested_at)}</dd>
              </div>
              <div>
                <dt>가입상태</dt>
                <dd>{detail.signup_status}</dd>
              </div>
              <div>
                <dt>계정상태</dt>
                <dd>{detail.account_status}</dd>
              </div>
              <div>
                <dt>언어</dt>
                <dd>{detail.preferred_language === "ko" ? "한국어" : detail.preferred_language}</dd>
              </div>
              {detail.comment ? (
                <div className="admin-detail__wide">
                  <dt>코멘트</dt>
                  <dd>{detail.comment}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="admin-detail__card">
            <h3>{detail.kind === "signup_request" ? "사용자 승인" : "사용자 정보 수정"}</h3>
            <label className="field-block">
              <span>사용자 이름</span>
              <input
                className="input-control"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={submitting || detail.kind === "signup_request"}
              />
            </label>

            <label className="field-block">
              <span>역할</span>
              <select
                className="login-select"
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
                disabled={submitting}
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-block">
              <span>그룹</span>
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
                <span>계정 상태</span>
                <select
                  className="login-select"
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value)}
                  disabled={submitting}
                >
                  <option value="active">활성</option>
                  <option value="inactive">비활성</option>
                  <option value="locked">잠김</option>
                  <option value="password_reset">비밀번호 초기화</option>
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
                  승인
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => handleAction("reject")}
                  disabled={submitting}
                >
                  반려
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
                  저장
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => handleAction("delete")}
                  disabled={submitting || detail.is_protected}
                >
                  {detail.is_protected ? "삭제 불가" : "삭제"}
                </button>
              </div>
            )}

            <p className="admin-detail__hint">
              현재 선택 역할: <strong>{roleLabel(selectedRole)}</strong>
            </p>
            <p className="admin-detail__hint">
              현재 선택 그룹으로 변경되면 해당 그룹에 소속된 봇만 접근 가능합니다.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
