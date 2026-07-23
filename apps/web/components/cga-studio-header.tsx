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
import { useI18n } from "@/components/language-provider";
import { normalizeSupportedLanguage, SUPPORTED_LANGUAGES } from "@/lib/language";

const botVersionPathPattern = /^\/studio\/bots\/([^/]+)\/versions\/([^/]+)/;
const botSettingsPathPattern = /^\/studio\/bots\/([^/]+)\/settings/;

export function CgaStudioHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage, t } = useI18n();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [botName, setBotName] = useState("");
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

    if (!currentSession) {
      return;
    }

    fetchStudioBots(currentSession.access_token)
      .then((bots) => {
        const currentBot = bots.find((bot) => bot.id === routeContext.botId);
        setBotName(currentBot?.name ?? "");
        setVersionName(routeContext.versionId || currentBot?.active_version?.name || "-");
      })
      .catch(() => {
        setBotName("");
        setVersionName(routeContext.versionId || "-");
      });
  }, [routeContext]);

  function handleLanguageChange(value: string) {
    setLanguage(normalizeSupportedLanguage(value));
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

  const roleSummary = session?.user.roles.map(roleLabel).join(", ") || t("common.noPermission");
  const resolvedBotName = botName || (routeContext.botId ? t("common.currentBot") : t("common.none"));

  return (
    <header className="cga-studio-header">
      <div className="cga-studio-header__brand">
        <span className="cga-studio-header__mark">CGA</span>
        <span className="cga-studio-header__title">
          <strong>CGA Studio</strong>
          <small>{t("brand.subtitle")}</small>
        </span>
      </div>

      <div className="cga-studio-header__context" aria-label={t("header.context")}>
        <span className="cga-studio-header__badge cga-studio-header__badge--auth">
          {t("header.auth")}: {session?.user.name ?? "-"} · {roleSummary}
        </span>
        <span className="cga-studio-header__badge">{t("header.group")}: {session?.user.group_name ?? "-"}</span>
        <span className="cga-studio-header__badge">{t("header.bot")}: {resolvedBotName}</span>
        <span className="cga-studio-header__badge">{t("header.version")}: {versionName}</span>
        <span className="cga-studio-header__badge cga-studio-header__badge--user">
          {session?.user.login_id ?? "-"}
        </span>
        <label className="cga-studio-header__language">
          <span>{t("common.language")}</span>
          <select value={language} onChange={(event) => handleLanguageChange(event.target.value)}>
            {SUPPORTED_LANGUAGES.map((option) => (
              <option key={option.code} value={option.code}>{option.label}</option>
            ))}
          </select>
        </label>
        <button type="button" className="cga-studio-header__logout" onClick={handleLogout} disabled={isLoggingOut}>
          {isLoggingOut ? t("common.loggingOut") : t("common.logout")}
        </button>
      </div>
    </header>
  );
}
