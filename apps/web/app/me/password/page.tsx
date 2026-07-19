"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import { loadAuthSession } from "@/lib/auth";

export default function PasswordPage() {
  const [token, setToken] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
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
    setMessage("");
    setErrorMessage("");

    if (newPassword !== newPasswordConfirm) {
      setErrorMessage("새 비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiRequest<{ message: string }>(
        "/api/v1/auth/change-password",
        {
          method: "POST",
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
            new_password_confirm: newPasswordConfirm,
          }),
        },
        token,
      );
      setMessage(result.message);
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "비밀번호 변경 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <section className="auth-form-card">
        <div className="admin-detail__header">
          <div>
            <h2>비밀번호 변경</h2>
            <p>현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다.</p>
          </div>
          <Link href="/me/profile" className="secondary-action">
            내 정보
          </Link>
        </div>

        <form className="auth-form-card__body" onSubmit={handleSubmit}>
          <label className="field-block">
            <span>현재 비밀번호</span>
            <input
              className="input-control"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>

          <label className="field-block">
            <span>새 비밀번호</span>
            <input
              className="input-control"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
          </label>

          <label className="field-block">
            <span>새 비밀번호 확인</span>
            <input
              className="input-control"
              type="password"
              value={newPasswordConfirm}
              onChange={(event) => setNewPasswordConfirm(event.target.value)}
              autoComplete="new-password"
            />
          </label>

          {message ? <p className="form-message form-message--success">{message}</p> : null}
          {errorMessage ? <p className="form-message form-message--error">{errorMessage}</p> : null}

          <button
            type="submit"
            className="primary-action primary-action--full"
            disabled={
              submitting ||
              !token ||
              !currentPassword ||
              !newPassword ||
              !newPasswordConfirm
            }
          >
            {submitting ? "변경 중..." : "비밀번호 변경"}
          </button>
        </form>
      </section>
    </main>
  );
}
