"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import { useI18n } from "@/components/language-provider";
import { normalizeSupportedLanguage, SUPPORTED_LANGUAGES } from "@/lib/language";

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
          setErrorMessage(error instanceof Error ? error.message : "회원가입 옵션을 불러오지 못했습니다.");
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

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
      setErrorMessage(error instanceof Error ? error.message : "회원가입 처리 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page auth-page--form auth-page--signup">
      <section className="auth-form-card auth-form-card--signup">
        <div className="auth-form-card__header">
          <h1>회원 가입</h1>
          <p>관리자 승인 후 로그인할 수 있습니다.</p>
        </div>

        <form className="auth-form-card__body auth-form-card__body--signup" onSubmit={handleSubmit}>
          <label className="field-block">
            <span>아이디</span>
            <input
              className="input-control"
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
              placeholder="아이디를 입력하세요."
            />
          </label>

          <label className="field-block">
            <span>비밀번호</span>
            <input
              className="input-control"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호를 입력하세요."
            />
          </label>

          <label className="field-block">
            <span>비밀번호 확인</span>
            <input
              className="input-control"
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              placeholder="비밀번호를 다시 입력하세요."
            />
          </label>

          <label className="field-block">
            <span>이름</span>
            <input
              className="input-control"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="이름을 입력하세요."
            />
          </label>

          <label className="field-block field-block--full">
            <span>코멘트</span>
            <textarea
              className="textarea-control"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="코멘트를 입력하세요."
            />
          </label>

          <label className="field-block">
            <span>서버</span>
            <input
              className="input-control"
              value={
                options?.organization.name === "기본 테넌트"
                  ? "기본 서버"
                  : options?.organization.name ?? "기본 서버"
              }
              readOnly
              disabled
            />
          </label>

          <label className="field-block">
            <span>그룹</span>
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
            {isSubmitting ? "회원가입 신청 중..." : "회원가입 신청"}
          </button>
        </form>

        <div className="auth-form-card__footer">
          <span>이미 계정이 있으신가요?</span>
          <Link href="/login" className="ghost-pill">
            로그인
          </Link>
        </div>
      </section>
    </main>
  );
}
