"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import { useI18n } from "@/components/language-provider";
import { getStudioPageLabel, STUDIO_PAGE_CATALOGS } from "@/lib/i18n/studio-pages";
import { ACCOUNT_PAGE_CATALOGS, getAccountRoleLabel } from "@/lib/i18n/account-pages";
import {
  type AuthSession,
  clearAuthSession,
  loadLastBotScreen,
  loadAuthSession,
  refreshAuthSessionCookies,

} from "@/lib/auth";

export function AuthSessionToolbar() {
  const { language: uiLanguage } = useI18n();
  const copy = STUDIO_PAGE_CATALOGS[uiLanguage];
  const accountCopy = ACCOUNT_PAGE_CATALOGS[uiLanguage];
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const currentSession = loadAuthSession();
    setSession(currentSession);
    refreshAuthSessionCookies();
  }, []);

  async function handleLogout() {
    if (!session || isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
      const lastBotScreen = loadLastBotScreen(session.user.login_id);
      await apiRequest<{ message: string }>(
        "/api/v1/auth/logout",
        {
          method: "POST",
          body: JSON.stringify({
            last_bot_screen: lastBotScreen,
          }),
        },
        session.access_token,
      );
    } catch {
      // 서버 로그아웃 실패 시에도 로컬 세션은 정리한다.
    } finally {
      clearAuthSession();
      setSession(null);
      router.push("/login");
      router.refresh();
      setIsLoggingOut(false);
    }
  }

  if (!session) {
    return (
      <div className="session-toolbar">
        <div className="session-toolbar__user">
          <strong>{getStudioPageLabel(copy,"로그인 정보 없음")}</strong>
          <span>{getStudioPageLabel(copy,"세션이 만료되었거나 로그인이 필요합니다.")}</span>
        </div>
        <div className="session-toolbar__actions">
          <Link href="/login" className="secondary-action">{getStudioPageLabel(copy,"로그인")}</Link>
        </div>
      </div>
    );
  }

  const roleSummary = session.user.roles.map((role) => getAccountRoleLabel(accountCopy, role)).join(", ");

  return (
    <div className="session-toolbar">
      <div className="session-toolbar__user">
        <strong>{session.user.name}</strong>
        <span>
          {session.user.login_id} | {roleSummary || getStudioPageLabel(copy, "권한 없음")}
        </span>
      </div>

      <div className="session-toolbar__actions">
        <Link href="/me/profile" className="secondary-action">{getStudioPageLabel(copy,"내 정보")}</Link>
        <Link href="/me/password" className="secondary-action">{getStudioPageLabel(copy,"비밀번호 변경")}</Link>
        <button
          type="button"
          className="primary-action"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          {getStudioPageLabel(copy, isLoggingOut ? "로그아웃 중..." : "로그아웃")}
        </button>
      </div>
    </div>
  );
}
