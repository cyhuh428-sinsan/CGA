"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { apiRequest } from "@/lib/api";
import {
  clearAuthSession,
  loadAuthSession,
  loadLastBotScreen,
  roleLabel,
  type AuthSession,
} from "@/lib/auth";
import { fetchStudioBots } from "@/lib/studio-bots-api";

const botVersionPathPattern = /^\/studio\/bots\/([^/]+)\/versions\/([^/]+)/;
const botSettingsPathPattern = /^\/studio\/bots\/([^/]+)\/settings/;

export function CgaStudioHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [language, setLanguage] = useState("ko");
  const [botName, setBotName] = useState("선택 없음");
  const [versionName, setVersionName] = useState("-");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const routeContext = useMemo(() => {
    const versionMatch = pathname.match(botVersionPathPattern);
    const settingsMatch = pathname.match(botSettingsPathPattern);
    return {
      botId: versionMatch?.[1] ?? settingsMatch?.[1] ?? "",
      versionId: versionMatch?.[2] ?? "",
    };
  }, [pathname]);

  useEffect(() => {
    const currentSession = loadAuthSession();
    setSession(currentSession);
    setLanguage(window.localStorage.getItem("aidot.language") ?? "ko");

    if (!currentSession) {
      return;
    }

    fetchStudioBots(currentSession.access_token)
      .then((bots) => {
        const currentBot = bots.find((bot) => bot.id === routeContext.botId);
        setBotName(currentBot?.name ?? (routeContext.botId ? "현재 봇" : "선택 없음"));
        setVersionName(routeContext.versionId || currentBot?.active_version?.name || "-");
      })
      .catch(() => {
        setBotName(routeContext.botId ? "현재 봇" : "선택 없음");
        setVersionName(routeContext.versionId || "-");
      });
  }, [routeContext]);

  function handleLanguageChange(value: string) {
    setLanguage(value);
    window.localStorage.setItem("aidot.language", value);
  }

  async function handleLogout() {
    if (!session || isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await apiRequest<{ message: string }>(
        "/api/v1/auth/logout",
        {
          method: "POST",
          body: JSON.stringify({
            last_bot_screen: loadLastBotScreen(session.user.login_id),
          }),
        },
        session.access_token,
      );
    } catch {
      // 서버 로그아웃 실패 시에도 로컬 세션은 정리한다.
    } finally {
      clearAuthSession();
      setSession(null);
      setIsLoggingOut(false);
      router.push("/login");
      router.refresh();
    }
  }

  const roleSummary = session?.user.roles.map(roleLabel).join(", ") || "권한 없음";

  return (
    <header className="cga-studio-header">
      <div className="cga-studio-header__brand">
        <span className="cga-studio-header__mark">CGA</span>
        <span className="cga-studio-header__title">
          <strong>CGA Studio</strong>
          <small>봇 제작 스튜디오</small>
        </span>
      </div>

      <div className="cga-studio-header__context" aria-label="현재 작업 컨텍스트">
        <span className="cga-studio-header__badge cga-studio-header__badge--auth">
          인증: {session?.user.name ?? "-"} · {roleSummary}
        </span>
        <span className="cga-studio-header__badge">그룹: {session?.user.group_name ?? "-"}</span>
        <span className="cga-studio-header__badge">봇: {botName}</span>
        <span className="cga-studio-header__badge">버전: {versionName}</span>
        <span className="cga-studio-header__badge cga-studio-header__badge--user">
          {session?.user.login_id ?? "-"}
        </span>
        <label className="cga-studio-header__language">
          <span>언어</span>
          <select value={language} onChange={(event) => handleLanguageChange(event.target.value)}>
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </select>
        </label>
        <button type="button" className="cga-studio-header__logout" onClick={handleLogout} disabled={isLoggingOut}>
          {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
        </button>
      </div>
    </header>
  );
}
