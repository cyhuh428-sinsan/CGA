"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import { loadAuthSession, roleLabel } from "@/lib/auth";
import { loadDialogOptionDisplayMode, type DialogOptionDisplayMode } from "@/lib/user-display-preferences";

type MeResponse = {
  id: string;
  login_id: string;
  name: string;
  email: string | null;
  roles: string[];
};

export default function ProfilePage() {
  const [token, setToken] = useState("");
  const [language, setLanguage] = useState("ko");
  const [dialogOptionDisplayMode, setDialogOptionDisplayMode] = useState<DialogOptionDisplayMode>("text");
  const [profile, setProfile] = useState<MeResponse | null>(null);
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
    setLanguage(window.localStorage.getItem("aidot.language") ?? "ko");
    setDialogOptionDisplayMode(loadDialogOptionDisplayMode());
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    let ignore = false;
    setLoading(true);
    apiRequest<MeResponse>("/api/v1/auth/me", {}, token)
      .then((data) => {
        if (!ignore) {
          setProfile(data);
        }
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : "내 정보를 불러오지 못했습니다.");
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

  return (
    <main className="page">
      <section className="auth-form-card auth-form-card--wide">
        <div className="admin-detail__header">
          <div>
            <h2>내 정보</h2>
            <p>현재 로그인한 사용자의 기본 정보를 확인합니다.</p>
          </div>
          <div className="admin-detail__actions admin-detail__actions--compact">
            <Link href="/me/password" className="secondary-action">
              비밀번호 변경
            </Link>
            <Link href="/me/language" className="secondary-action">
              사용자 언어 변경
            </Link>
          </div>
        </div>

        {errorMessage ? (
          <div className="admin-state-box">
            <p>{errorMessage}</p>
            <Link href="/login" className="ghost-pill">
              로그인으로 이동
            </Link>
          </div>
        ) : null}

        {loading ? <p className="admin-page__empty">불러오는 중입니다...</p> : null}

        {profile ? (
          <div className="admin-detail__card">
            <dl className="admin-detail__list">
              <div>
                <dt>사용자 계정</dt>
                <dd>{profile.login_id}</dd>
              </div>
              <div>
                <dt>사용자 이름</dt>
                <dd>{profile.name}</dd>
              </div>
              <div>
                <dt>이메일</dt>
                <dd>{profile.email ?? "-"}</dd>
              </div>
              <div>
                <dt>사용자 언어</dt>
                <dd>{language === "ko" ? "한국어" : "English"}</dd>
              </div>
              <div>
                <dt>기타옵션 표시</dt>
                <dd>{dialogOptionDisplayMode === "icon" ? "아이콘" : "글자"}</dd>
              </div>
              <div className="admin-detail__wide">
                <dt>역할</dt>
                <dd>{profile.roles.map(roleLabel).join(", ")}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </section>
    </main>
  );
}
