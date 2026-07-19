"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { loadAuthSession } from "@/lib/auth";
import { createStudioBot } from "@/lib/studio-bots-api";

const NAME_PATTERN = /^[0-9A-Za-z가-힣 _().-]+$/;
const MAX_NAME_LENGTH = 40;
const MAX_INTRODUCTION_LENGTH = 40;

type ProfileKey = "gray" | "accent" | "outline";
type CallMethod = "button" | "natural";

const PROFILE_OPTIONS: Array<{ key: ProfileKey; label: string; color: string }> = [
  { key: "gray", label: "기본 프로필", color: "#d5d5d5" },
  { key: "accent", label: "기본 허브 프로필", color: "#d99b58" },
  { key: "outline", label: "테두리 프로필", color: "#ffffff" },
];

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("프로필 이미지를 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
}

export function BotHubCreateForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [callMethod, setCallMethod] = useState<CallMethod>("button");
  const [profileKey, setProfileKey] = useState<ProfileKey>("accent");
  const [profileImageData, setProfileImageData] = useState<string>();
  const [name, setName] = useState("");
  const [introduction, setIntroduction] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMessage("프로필 이미지는 이미지 파일만 선택할 수 있습니다.");
      return;
    }
    try {
      setProfileImageData(await readImage(file));
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "프로필 이미지를 읽을 수 없습니다.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage("봇 허브 이름을 입력해주세요.");
      return;
    }
    if (!NAME_PATTERN.test(trimmedName)) {
      setErrorMessage("봇 허브 이름은 한글/영문/숫자/공백 및 - _ . ( ) 만 사용할 수 있습니다.");
      return;
    }

    const session = loadAuthSession();
    if (!session?.access_token) {
      setErrorMessage("로그인 정보를 확인할 수 없습니다. 다시 로그인해주세요.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const hub = await createStudioBot(session.access_token, {
        name: trimmedName,
        description: introduction.trim() || undefined,
        bot_kind: "hub",
        bot_mode: "text",
        profile_key: profileKey,
        profile_image_data: profileImageData,
        language: "ko",
        introduction: introduction.trim() || undefined,
        hub_call_method: callMethod,
      });
      router.replace("/studio/hubs/" + hub.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "봇 허브를 생성하지 못했습니다.");
      setIsSubmitting(false);
    }
  }

  return (
    <form className="hub-create" onSubmit={handleSubmit}>
      <section>
        <h1>봇/봇 허브 생성</h1>
        <label className="type"><input type="radio" disabled /> 봇</label>
        <span className="disabled-mode">텍스트형</span>
        <span className="disabled-mode">보이스형</span>
        <label className="type"><input type="radio" checked readOnly /> 봇 허브</label>
      </section>

      <label>
        <strong>호출 방법 <em>*</em></strong>
        <select value={callMethod} onChange={(event) => setCallMethod(event.target.value as CallMethod)}>
          <option value="button">버튼 선택형</option>
          <option value="natural">자연어 입력형</option>
        </select>
      </label>

      <section>
        <strong>봇 프로필 <em>*</em></strong>
        <div className="profiles">
          <button className="upload" type="button" onClick={() => fileInputRef.current?.click()}>
            {profileImageData ? <img src={profileImageData} alt="선택한 프로필" /> : "이미지"}
          </button>
          {PROFILE_OPTIONS.map((profile) => (
            <button
              key={profile.key}
              type="button"
              aria-label={profile.label}
              aria-pressed={profileKey === profile.key && !profileImageData}
              className={profileKey === profile.key && !profileImageData ? "profile selected" : "profile"}
              style={{ background: profile.color }}
              onClick={() => { setProfileKey(profile.key); setProfileImageData(undefined); }}
            />
          ))}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} hidden />
        </div>
      </section>

      <label>
        <strong>봇 이름 <em>*</em></strong>
        <input value={name} maxLength={MAX_NAME_LENGTH} onChange={(event) => setName(event.target.value)} placeholder="봇 허브 이름을 입력해주세요." />
        <small>한글/영문/숫자/공백/특수문자(-, _, ., ( ))만 입력</small>
        <i>{name.length}/{MAX_NAME_LENGTH}</i>
      </label>

      <label>
        <strong>언어 <em>*</em></strong>
        <select value="ko" disabled><option value="ko">한국어</option></select>
      </label>

      <label>
        <strong>소개</strong>
        <textarea value={introduction} maxLength={MAX_INTRODUCTION_LENGTH} onChange={(event) => setIntroduction(event.target.value)} placeholder="봇 허브를 설명할 수 있는 소개 문장을 입력해주세요." />
        <i>{introduction.length}/{MAX_INTRODUCTION_LENGTH}</i>
      </label>

      {errorMessage ? <p className="error" role="alert">{errorMessage}</p> : null}
      <footer>
        <button type="button" onClick={() => router.push("/studio/hubs")}>취소</button>
        <button type="submit" disabled={isSubmitting}>{isSubmitting ? "생성 중" : "확인"}</button>
      </footer>

      <style jsx>{[
        ".hub-create { width: min(620px, 100%); padding: 28px; border: 1px solid #d7e0eb; background: #fff; }",
        "section, label { display: block; margin: 0 0 24px; }",
        "h1 { margin: 0 0 22px; color: #34465f; font-size: 22px; }",
        "strong { display: block; margin-bottom: 9px; color: #43536a; font-size: 14px; }",
        "em { color: #d84949; font-style: normal; }",
        "input:not([type=radio]), select, textarea { box-sizing: border-box; width: 100%; min-height: 42px; padding: 10px 12px; border: 1px solid #cbd7e5; border-radius: 0; background: #fff; color: #26364d; font: inherit; }",
        "textarea { min-height: 82px; resize: vertical; }",
        ".type { display: inline-flex; align-items: center; gap: 6px; margin-right: 12px; color: #40516a; font-size: 14px; }",
        ".disabled-mode { display: inline-block; padding: 8px 12px; color: #99a5b5; background: #f3f5f8; font-size: 13px; }",
        ".profiles { display: flex; align-items: center; gap: 14px; margin-top: 10px; }",
        ".profile, .upload { width: 58px; height: 58px; overflow: hidden; border: 1px solid #d7e0eb; border-radius: 50%; cursor: pointer; }",
        ".profile.selected { outline: 3px solid #2d82cb; outline-offset: 3px; }",
        ".upload { display: grid; place-items: center; color: #fff; background: #8a95a3; font-size: 11px; }",
        ".upload img { width: 100%; height: 100%; object-fit: cover; }",
        "small { display: block; margin-top: 6px; color: #8592a4; font-size: 12px; }",
        "i { display: block; margin-top: 4px; color: #8592a4; text-align: right; font-size: 12px; font-style: normal; }",
        ".error { color: #b72f38; font-size: 14px; }",
        "footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 30px; }",
        "footer button { min-width: 96px; min-height: 42px; border: 1px solid #bcc9d9; background: #fff; color: #40516a; font: inherit; cursor: pointer; }",
        "footer button[type=submit] { border-color: #2f4f78; background: #2f4f78; color: #fff; }",
      ].join("\\n")}</style>
    </form>
  );
}

