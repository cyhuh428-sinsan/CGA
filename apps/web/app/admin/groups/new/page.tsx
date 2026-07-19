"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import { loadAuthSession } from "@/lib/auth";

export default function AdminGroupCreatePage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      setErrorMessage("로그인이 필요합니다.");
      return;
    }
    setToken(session.access_token);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    setMessage("");

    try {
      const result = await apiRequest<{ message: string }>("/api/v1/admin/groups", {
        method: "POST",
        body: JSON.stringify({ name }),
      }, token);
      setMessage(result.message);
      router.push("/admin/groups");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "그룹 생성 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="admin-detail">
      <div className="admin-detail__header">
        <div>
          <h2>그룹 생성</h2>
          <p>현재 서버에 속한 새 그룹을 생성합니다.</p>
        </div>
        <Link href="/admin/groups" className="secondary-action">
          목록으로
        </Link>
      </div>

      <form className="admin-detail__card admin-detail__card--narrow" onSubmit={handleSubmit}>
        <label className="field-block">
          <span>그룹 이름</span>
          <input
            className="input-control"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="그룹 이름을 입력하세요."
          />
        </label>

        {message ? <p className="form-message form-message--success">{message}</p> : null}
        {errorMessage ? <p className="form-message form-message--error">{errorMessage}</p> : null}

        <div className="admin-detail__actions">
          <button type="submit" className="primary-action" disabled={submitting || !name.trim() || !token}>
            {submitting ? "생성 중..." : "그룹 생성"}
          </button>
        </div>
      </form>
    </section>
  );
}
