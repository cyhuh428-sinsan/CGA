"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import {
  AuthSession,
  loadAuthSession,
  refreshAuthSessionCookies,
  resolvePostLoginPath,
  saveAuthSession,
} from "@/lib/auth";
import { fetchStudioWorkspaceContext } from "@/lib/studio-bots-api";
import { useI18n } from "@/components/language-provider";
import { normalizeSupportedLanguage, SUPPORTED_LANGUAGES } from "@/lib/language";

async function prewarmPostLoginWorkspace(session: AuthSession, targetPath: string) {
  const match = targetPath.match(/^\/studio\/bots\/([^/]+)\/versions\/([^/?#]+)(?:\/([^/?#]+))?/);
  if (!match) {
    return;
  }

  const botId = decodeURIComponent(match[1] ?? "");
  const versionScope = decodeURIComponent(match[2] ?? "v1");
  const section = match[3] ? decodeURIComponent(match[3]) : "";
  const prefetchSection = section === "intents" ? "dialogs" : undefined;

  await fetchStudioWorkspaceContext(
    session.access_token,
    botId,
    versionScope || "v1",
    false,
    prefetchSection,
    session.user.login_id,
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { language, setLanguage, t } = useI18n();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [rememberLoginId, setRememberLoginId] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    try {
      const savedLoginId = window.localStorage.getItem("aidot.login_id");
      const session = loadAuthSession();
      if (savedLoginId) {
        setLoginId(savedLoginId);
        setRememberLoginId(true);
      }
      if (session) {
        refreshAuthSessionCookies();
      }
    } finally {
      setIsHydrated(true);
    }
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const session = await apiRequest<AuthSession>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          login_id: loginId,
          password,
        }),
      });
      saveAuthSession(session);

      if (rememberLoginId) {
        window.localStorage.setItem("aidot.login_id", loginId);
      } else {
        window.localStorage.removeItem("aidot.login_id");
      }
      const targetPath = resolvePostLoginPath(session);
      router.prefetch(targetPath);
      await prewarmPostLoginWorkspace(session, targetPath).catch(() => undefined);
      router.push(targetPath);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("login.error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="login-stage">
        <form className="login-form-card" onSubmit={handleSubmit}>
          <div className="brand-wordmark">
            <span>CGA</span>
            <strong>CGA Studio</strong>
          </div>

          <div className="login-fields">
            <input
              className="input-control"
              type="text"
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
              placeholder={t("login.id")}
              aria-label={t("login.id")}
              autoComplete="username"
            />

            <input
              className="input-control"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("login.password")}
              aria-label={t("login.password")}
              autoComplete="current-password"
            />

            <button
              type="submit"
              className="primary-action primary-action--full login-form-card__submit"
              disabled={isSubmitting || !isHydrated}
            >
              {!isHydrated ? t("login.preparing") : isSubmitting ? t("login.signingIn") : t("common.login")}
            </button>
          </div>

          <div className="login-meta">
            <label className="check-row">
              <input
                type="checkbox"
                checked={rememberLoginId}
                onChange={(event) => setRememberLoginId(event.target.checked)}
              />
              <span>{t("login.rememberId")}</span>
            </label>

            <select
              className="login-select"
              value={language}
              onChange={(event) => setLanguage(normalizeSupportedLanguage(event.target.value))}
            >
              {SUPPORTED_LANGUAGES.map((option) => (
                <option key={option.code} value={option.code}>{option.label}</option>
              ))}
            </select>
          </div>

          {errorMessage ? <p className="form-message form-message--error">{errorMessage}</p> : null}

          <div className="login-signup-row">
            <span>{t("login.noAccount")}</span>
            <Link href="/signup" className="ghost-pill">
              {t("login.signup")}
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
