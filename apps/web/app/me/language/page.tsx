"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import {
  loadDialogOptionDisplayMode,
  saveDialogOptionDisplayMode,
  type DialogOptionDisplayMode,
} from "@/lib/user-display-preferences";
import { useI18n } from "@/components/language-provider";
import { normalizeSupportedLanguage, SUPPORTED_LANGUAGES } from "@/lib/language";
import { ACCOUNT_PAGE_CATALOGS } from "@/lib/i18n/account-pages";

export default function LanguagePage() {
  const { language, setLanguage, t } = useI18n();
  const copy = ACCOUNT_PAGE_CATALOGS[language].language;
  const [dialogOptionDisplayMode, setDialogOptionDisplayMode] = useState<DialogOptionDisplayMode>("text");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setDialogOptionDisplayMode(loadDialogOptionDisplayMode());
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveDialogOptionDisplayMode(dialogOptionDisplayMode);
    setMessage(copy.saved);
  }

  return (
    <main className="page">
      <section className="auth-form-card">
        <div className="admin-detail__header">
          <div>
            <h2>{copy.title}</h2>
            <p>{copy.description}</p>
          </div>
          <Link href="/me/profile" className="secondary-action">
            {copy.profile}
          </Link>
        </div>

        <form className="auth-form-card__body" onSubmit={handleSubmit}>
          <label className="field-block">
            <span>{t("common.language")}</span>
            <select
              className="login-select login-select--full"
              value={language}
              onChange={(event) => setLanguage(normalizeSupportedLanguage(event.target.value))}
            >
              {SUPPORTED_LANGUAGES.map((option) => (
                <option key={option.code} value={option.code}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span>{copy.optionDisplay}</span>
            <select
              className="login-select login-select--full"
              value={dialogOptionDisplayMode}
              onChange={(event) => setDialogOptionDisplayMode(event.target.value as DialogOptionDisplayMode)}
            >
              <option value="text">{copy.text}</option>
              <option value="icon">{copy.icon}</option>
            </select>
          </label>

          {message ? <p className="form-message form-message--success">{message}</p> : null}

          <button type="submit" className="primary-action primary-action--full">
            {copy.save}
          </button>
        </form>
      </section>
    </main>
  );
}
