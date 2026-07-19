"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import {
  loadDialogOptionDisplayMode,
  saveDialogOptionDisplayMode,
  type DialogOptionDisplayMode,
} from "@/lib/user-display-preferences";

export default function LanguagePage() {
  const [language, setLanguage] = useState("ko");
  const [dialogOptionDisplayMode, setDialogOptionDisplayMode] = useState<DialogOptionDisplayMode>("text");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setLanguage(window.localStorage.getItem("aidot.language") ?? "ko");
    setDialogOptionDisplayMode(loadDialogOptionDisplayMode());
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.localStorage.setItem("aidot.language", language);
    saveDialogOptionDisplayMode(dialogOptionDisplayMode);
    setMessage("사용자 설정이 저장되었습니다.");
  }

  return (
    <main className="page">
      <section className="auth-form-card">
        <div className="admin-detail__header">
          <div>
            <h2>사용자 언어 변경</h2>
            <p>로그인 화면과 작업 화면에서 사용할 기본 언어를 선택합니다.</p>
          </div>
          <Link href="/me/profile" className="secondary-action">
            내 정보
          </Link>
        </div>

        <form className="auth-form-card__body" onSubmit={handleSubmit}>
          <label className="field-block">
            <span>언어</span>
            <select
              className="login-select login-select--full"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              <option value="ko">한국어</option>
              <option value="en">English</option>
            </select>
          </label>

          <label className="field-block">
            <span>의도/모듈 기타옵션 표시</span>
            <select
              className="login-select login-select--full"
              value={dialogOptionDisplayMode}
              onChange={(event) => setDialogOptionDisplayMode(event.target.value as DialogOptionDisplayMode)}
            >
              <option value="text">글자</option>
              <option value="icon">아이콘</option>
            </select>
          </label>

          {message ? <p className="form-message form-message--success">{message}</p> : null}

          <button type="submit" className="primary-action primary-action--full">
            저장
          </button>
        </form>
      </section>
    </main>
  );
}
