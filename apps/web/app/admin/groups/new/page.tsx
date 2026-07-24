"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { useI18n } from "@/components/language-provider";
import { apiRequest } from "@/lib/api";
import { loadAuthSession } from "@/lib/auth";
import { ADMIN_GROUPS_CATALOGS, type AdminGroupsCatalog } from "@/lib/i18n/admin-groups";

export default function AdminGroupCreatePage() {
  const router = useRouter();
  const { language: uiLanguage } = useI18n();
  const copy: AdminGroupsCatalog = ADMIN_GROUPS_CATALOGS[uiLanguage];
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      setErrorMessage(copy.loginRequired);
      return;
    }
    setToken(session.access_token);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    setMessage("");

    try {
      const result = await apiRequest<{ message: string }>("/api/v1/admin/groups", {
        method: "POST",
        body: JSON.stringify({ name }),
      }, token);
      setMessage(result.message);
      router.push("/admin/groups");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : copy.createForm.submitError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="admin-detail">
      <div className="admin-detail__header">
        <div>
          <h2>{copy.createForm.title}</h2>
          <p>{copy.createForm.subtitle}</p>
        </div>
        <Link href="/admin/groups" className="secondary-action">
          {copy.createForm.back}
        </Link>
      </div>

      <form className="admin-detail__card admin-detail__card--narrow" onSubmit={handleSubmit}>
        <label className="field-block">
          <span>{copy.createForm.name}</span>
          <input
            className="input-control"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={copy.createForm.placeholder}
          />
        </label>

        {message ? <p className="form-message form-message--success">{message}</p> : null}
        {errorMessage ? <p className="form-message form-message--error">{errorMessage}</p> : null}

        <div className="admin-detail__actions">
          <button type="submit" className="primary-action" disabled={submitting || !name.trim() || !token}>
            {submitting ? copy.createForm.submitting : copy.createForm.submit}
          </button>
        </div>
      </form>
    </section>
  );
}
