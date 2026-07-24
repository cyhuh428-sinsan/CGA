"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import { useI18n } from "@/components/language-provider";
import { normalizeSupportedLanguage, SUPPORTED_LANGUAGES } from "@/lib/language";
import { ACCOUNT_PAGE_CATALOGS } from "@/lib/i18n/account-pages";

type SignupOptions = {
  organization: {
    id: string;
    code: string;
    name: string;
  };
  groups: Array<{
    id: string;
    code: string;
    name: string;
  }>;
};

export default function SignupPage() {
  const { language, setLanguage, t } = useI18n();
  const copy = ACCOUNT_PAGE_CATALOGS[language].signup;
  const [options, setOptions] = useState<SignupOptions | null>(null);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [groupId, setGroupId] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;

    apiRequest<SignupOptions>("/api/v1/auth/signup-options")
      .then((data) => {
        if (ignore) {
          return;
        }
        setOptions(data);
        if (data.groups[0]) {
          setGroupId(data.groups[0].id);
        }
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : copy.loadFailed);
        }
      });

    return () => {
      ignore = true;
    };
  }, [copy.loadFailed]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const result = await apiRequest<{ message: string; status: string }>("/api/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          login_id: loginId,
          password,
          password_confirm: passwordConfirm,
          name,
          comment,
          preferred_language: language,
          group_id: groupId,
        }),
      });
      setMessage(result.message);
      setLoginId("");
      setPassword("");
      setPasswordConfirm("");
      setName("");
      setComment("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : copy.submitFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page auth-page--form auth-page--signup">
      <section className="auth-form-card auth-form-card--signup">
        <div className="auth-form-card__header">
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>

        <form className="auth-form-card__body auth-form-card__body--signup" onSubmit={handleSubmit}>
          <label className="field-block">
            <span>{copy.loginId}</span>
            <input
              className="input-control"
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
              placeholder={copy.loginIdPlaceholder}
            />
          </label>

          <label className="field-block">
            <span>{copy.password}</span>
            <input
              className="input-control"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={copy.passwordPlaceholder}
            />
          </label>

          <label className="field-block">
            <span>{copy.passwordConfirm}</span>
            <input
              className="input-control"
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              placeholder={copy.passwordConfirmPlaceholder}
            />
          </label>

          <label className="field-block">
            <span>{copy.name}</span>
            <input
              className="input-control"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={copy.namePlaceholder}
            />
          </label>

          <label className="field-block field-block--full">
            <span>{copy.comment}</span>
            <textarea
              className="textarea-control"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={copy.commentPlaceholder}
            />
          </label>

          <label className="field-block">
            <span>{copy.server}</span>
            <input
              className="input-control"
              value={
                options?.organization.name === "기본 테넌트"
                  ? copy.defaultServer
                  : options?.organization.name ?? copy.defaultServer
              }
              readOnly
              disabled
            />
          </label>

          <label className="field-block">
            <span>{copy.group}</span>
            <select
              className="login-select"
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
              disabled={!options}
            >
              {options?.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span>{t("common.language")}</span>
            <select
              className="login-select"
              value={language}
              onChange={(event) => setLanguage(normalizeSupportedLanguage(event.target.value))}
            >
              {SUPPORTED_LANGUAGES.map((option) => (
                <option key={option.code} value={option.code}>{option.label}</option>
              ))}
            </select>
          </label>

          {message ? <p className="form-message form-message--success field-block--full">{message}</p> : null}
          {errorMessage ? <p className="form-message form-message--error field-block--full">{errorMessage}</p> : null}

          <button
            type="submit"
            className="primary-action primary-action--full field-block--full"
            disabled={isSubmitting || !groupId}
          >
            {isSubmitting ? copy.submitting : copy.submit}
          </button>
        </form>

        <div className="auth-form-card__footer">
          <span>{copy.existingAccount}</span>
          <Link href="/login" className="ghost-pill">
            {copy.login}
          </Link>
        </div>
      </section>
    </main>
  );
}
