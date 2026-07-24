"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import { loadAuthSession } from "@/lib/auth";
import { loadDialogOptionDisplayMode, type DialogOptionDisplayMode } from "@/lib/user-display-preferences";
import { useI18n } from "@/components/language-provider";
import { getLanguageLabel } from "@/lib/language";
import { ACCOUNT_PAGE_CATALOGS, getAccountRoleLabel } from "@/lib/i18n/account-pages";

type MeResponse = {
  id: string;
  login_id: string;
  name: string;
  email: string | null;
  roles: string[];
};

export default function ProfilePage() {
  const { language } = useI18n();
  const copy = ACCOUNT_PAGE_CATALOGS[language].profile;
  const accountCatalog = ACCOUNT_PAGE_CATALOGS[language];
  const [token, setToken] = useState("");
  const [dialogOptionDisplayMode, setDialogOptionDisplayMode] = useState<DialogOptionDisplayMode>("text");
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      setLoading(false);
      setErrorMessage(copy.loginRequired);
      return;
    }

    setToken(session.access_token);
    setDialogOptionDisplayMode(loadDialogOptionDisplayMode());
  }, [copy.loginRequired]);

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
          setErrorMessage(error instanceof Error ? error.message : copy.loadFailed);
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
  }, [copy.loadFailed, token]);

  return (
    <main className="page">
      <section className="auth-form-card auth-form-card--wide">
        <div className="admin-detail__header">
          <div>
            <h2>{copy.title}</h2>
            <p>{copy.description}</p>
          </div>
          <div className="admin-detail__actions admin-detail__actions--compact">
            <Link href="/me/password" className="secondary-action">
              {copy.changePassword}
            </Link>
            <Link href="/me/language" className="secondary-action">
              {copy.changeLanguage}
            </Link>
          </div>
        </div>

        {errorMessage ? (
          <div className="admin-state-box">
            <p>{errorMessage}</p>
            <Link href="/login" className="ghost-pill">
              {copy.goToLogin}
            </Link>
          </div>
        ) : null}

        {loading ? <p className="admin-page__empty">{copy.loading}</p> : null}

        {profile ? (
          <div className="admin-detail__card">
            <dl className="admin-detail__list">
              <div>
                <dt>{copy.account}</dt>
                <dd>{profile.login_id}</dd>
              </div>
              <div>
                <dt>{copy.userName}</dt>
                <dd>{profile.name}</dd>
              </div>
              <div>
                <dt>{copy.email}</dt>
                <dd>{profile.email ?? "-"}</dd>
              </div>
              <div>
                <dt>{copy.language}</dt>
                <dd>{getLanguageLabel(language)}</dd>
              </div>
              <div>
                <dt>{copy.optionDisplay}</dt>
                <dd>{dialogOptionDisplayMode === "icon" ? copy.icon : copy.text}</dd>
              </div>
              <div className="admin-detail__wide">
                <dt>{copy.roles}</dt>
                <dd>{profile.roles.map((role) => getAccountRoleLabel(accountCatalog, role)).join(", ")}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </section>
    </main>
  );
}
