"use client";

import Link from "next/link";
import { useEffect, useState, type ChangeEvent } from "react";

import { resolveApiAssetPublicUrl } from "@/lib/api";
import { loadAuthSession } from "@/lib/auth";
import { useI18n } from "@/components/language-provider";
import { getStudioPageLabel, STUDIO_PAGE_CATALOGS } from "@/lib/i18n/studio-pages";
import {
  fetchStudioHub,
  type StudioHub,
  updateStudioBot,
  updateStudioHubSettings,
} from "@/lib/studio-bots-api";

type Props = { hubId: string };
type FormState = Pick<StudioHub, "call_method" | "button_match_mode" | "greeting_message" | "intent_cutoff_score" | "similar_intent_score" | "max_intent_candidates" | "show_members_in_greeting" | "unrecognized_message" | "multiple_candidates_message" | "runtime_error_message" | "conversation_in_progress_message" | "timeout_seconds" | "apply_timeout_to_push" | "timeout_message" | "no_bot_label" | "no_bot_message" | "hub_call_rules">;

type ProfileKey = StudioHub["profile_key"];
const PROFILE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

const toForm = (hub: StudioHub): FormState => ({
  call_method: hub.call_method,
  button_match_mode: hub.button_match_mode,
  greeting_message: hub.greeting_message || "",
  intent_cutoff_score: hub.intent_cutoff_score,
  similar_intent_score: hub.similar_intent_score,
  max_intent_candidates: hub.max_intent_candidates,
  show_members_in_greeting: hub.show_members_in_greeting,
  unrecognized_message: hub.unrecognized_message || "",
  multiple_candidates_message: hub.multiple_candidates_message || "",
  runtime_error_message: hub.runtime_error_message || "",
  conversation_in_progress_message: hub.conversation_in_progress_message || "",
  timeout_seconds: hub.timeout_seconds || 0,
  apply_timeout_to_push: hub.apply_timeout_to_push,
  timeout_message: hub.timeout_message || "",
  no_bot_label: hub.no_bot_label || "",
  no_bot_message: hub.no_bot_message || "",
  hub_call_rules: hub.hub_call_rules || [],
});

export function BotHubSettings({ hubId }: Props) {
  const { language: uiLanguage } = useI18n();
  const copy = STUDIO_PAGE_CATALOGS[uiLanguage];
  const [hub, setHub] = useState<StudioHub | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileIntroduction, setProfileIntroduction] = useState("");
  const [profileKey, setProfileKey] = useState<ProfileKey>("accent");
  const [profileImageData, setProfileImageData] = useState<string | null | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  function applyHub(nextHub: StudioHub) {
    setHub(nextHub);
    setForm(toForm(nextHub));
    setProfileName(nextHub.name);
    setProfileIntroduction(nextHub.introduction || "");
    setProfileKey(nextHub.profile_key);
    setProfileImageData(undefined);
  }

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      setMessage("로그인이 필요합니다.");
      return;
    }
    fetchStudioHub(session.access_token, hubId)
      .then(applyHub)
      .catch((error) => setMessage(error instanceof Error ? error.message : "설정을 불러오지 못했습니다."));
  }, [hubId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function handleProfileImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!PROFILE_IMAGE_TYPES.has(file.type)) {
      setMessage("프로필 이미지는 PNG, JPEG 또는 WEBP 파일만 사용할 수 있습니다.");
      return;
    }
    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      setMessage("프로필 이미지는 2MB 이하만 사용할 수 있습니다.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfileImageData(reader.result);
        setMessage("");
      }
    };
    reader.onerror = () => setMessage("프로필 이미지를 읽지 못했습니다.");
    reader.readAsDataURL(file);
  }

  async function saveProfile() {
    const session = loadAuthSession();
    if (!session || !hub) return;
    const name = profileName.trim();
    if (!name) {
      setMessage("봇 허브 이름을 입력해주세요.");
      return;
    }
    setSavingProfile(true);
    setMessage("");
    try {
      await updateStudioBot(session.access_token, hubId, {
        name,
        description: profileIntroduction.trim() || undefined,
        profile_key: profileKey,
        profile_image_data: profileImageData,
        introduction: profileIntroduction.trim() || undefined,
      });
      const savedHub = await fetchStudioHub(session.access_token, hubId);
      applyHub(savedHub);
      setMessage("봇 허브 프로필을 저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "봇 허브 프로필 저장에 실패했습니다.");
    } finally {
      setSavingProfile(false);
    }
  }

  function updateHubCallRule(index: number, updates: Partial<FormState["hub_call_rules"][number]>) {
    setForm((current) => current ? {
      ...current,
      hub_call_rules: current.hub_call_rules.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...updates } : rule),
    } : current);
  }

  function addHubCallRule() {
    setForm((current) => current ? {
      ...current,
      hub_call_rules: [...current.hub_call_rules, { id: `hub-rule-${Date.now()}`, name: "", expression: "", enabled: true }],
    } : current);
  }

  function removeHubCallRule(index: number) {
    setForm((current) => current ? {
      ...current,
      hub_call_rules: current.hub_call_rules.filter((_, ruleIndex) => ruleIndex !== index),
    } : current);
  }

  async function save() {
    const session = loadAuthSession();
    if (!session || !form) return;
    const incompleteCallRule = form.hub_call_rules.find((rule) => !rule.expression.trim());
    if (incompleteCallRule) {
      setMessage("봇 허브 호출 단어 또는 정규식을 입력해주세요.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const saved = await updateStudioHubSettings(session.access_token, hubId, {
        ...form,
        hub_call_rules: form.hub_call_rules.map((rule) => ({
          ...rule,
          name: rule.name.trim(),
          expression: rule.expression.trim(),
        })),
        timeout_seconds: (form.timeout_seconds ?? 0) > 0 ? form.timeout_seconds : null,
      });
      applyHub(saved);
      setMessage("봇 허브 설정을 저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "봇 허브 설정 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (!hub || !form) {
    return <main className="page"><p className="bot-hub__notice">{message || "설정을 불러오는 중입니다..."}</p></main>;
  }

  const natural = form.call_method === "natural";
  const displayedImage = profileImageData === undefined ? hub.profile_image_url : profileImageData;

  return (
    <main className="page bot-hub">
      <header className="bot-hub__header">
        <div>
          <Link href={`/studio/hubs/${hubId}`} className="bot-hub__back">{hub.name} 구성</Link>
          <h1>{getStudioPageLabel(copy,"봇 허브 설정")}</h1>
        </div>
        <button type="button" className="bot-hub__primary" onClick={save} disabled={saving}>{saving ? "저장 중..." : "설정 저장"}</button>
      </header>
      {message ? <p className={`bot-hub__notice${message.endsWith("했습니다.") ? "" : " bot-hub__notice--error"}`}>{message}</p> : null}

      <section className="bot-hub__settings">
        <section className="bot-hub__profile-settings bot-hub__settings-wide" aria-labelledby="hub-profile-title">
          <div className="bot-hub__profile-settings-heading">
            <div><h2 id="hub-profile-title">{getStudioPageLabel(copy,"프로필 설정")}</h2><p>{getStudioPageLabel(copy, "봇 허브의 이름, 기본 프로필 또는 PC 이미지를 관리합니다.")}</p></div>
            <button type="button" className="bot-hub__secondary" onClick={saveProfile} disabled={savingProfile}>{savingProfile ? "저장 중..." : "프로필 저장"}</button>
          </div>
          <div className="bot-hub__profile-editor">
            <div className="bot-hub__profile-preview" aria-label={getStudioPageLabel(copy,"현재 프로필")}>
              {displayedImage ? <img src={displayedImage.startsWith("data:") ? displayedImage : resolveApiAssetPublicUrl(displayedImage)} alt="선택한 봇 허브 프로필" /> : <span className={`bot-hub__profile bot-hub__profile--${profileKey}`} aria-hidden="true" />}
            </div>
            <div className="bot-hub__profile-options">
              <span>{getStudioPageLabel(copy,"기본 프로필")}</span>
              <div>
                {(["gray", "accent", "outline"] as const).map((key) => <button key={key} type="button" className={`bot-hub__profile-option bot-hub__profile--${key}${profileImageData === undefined && !hub.profile_image_url && profileKey === key ? " is-selected" : ""}`} aria-label={`${key} 기본 프로필`} onClick={() => { setProfileKey(key); setProfileImageData(null); }} />)}
              </div>
              <label className="bot-hub__profile-upload">{getStudioPageLabel(copy,"PC 이미지 선택")}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleProfileImageChange} /></label>
              {displayedImage ? <button type="button" className="bot-hub__profile-reset" onClick={() => setProfileImageData(null)}>{getStudioPageLabel(copy,"기본 프로필 사용")}</button> : null}
              <small>{getStudioPageLabel(copy,"PNG, JPEG, WEBP · 2MB 이하")}</small>
            </div>
            <label>{getStudioPageLabel(copy,"봇 허브 이름")}<input value={profileName} maxLength={150} onChange={(event) => setProfileName(event.target.value)} /></label>
            <label>{getStudioPageLabel(copy,"소개")}<textarea value={profileIntroduction} maxLength={2000} onChange={(event) => setProfileIntroduction(event.target.value)} /></label>
          </div>
        </section>

        <section className="bot-hub__settings-section bot-hub__settings-wide" aria-labelledby="hub-basic-settings-title">
          <div className="bot-hub__settings-section-heading">
            <h2 id="hub-basic-settings-title">{getStudioPageLabel(copy,"기본 설정")}</h2>
            <span>{natural ? "자연어 입력형" : "버튼 선택형"}</span>
          </div>
          <div className="bot-hub__settings-fields">
            <label>Bot ID<input value={hub.id} readOnly /></label>
            {natural ? <>
              <label>{getStudioPageLabel(copy, "의도 파악 Cut-off Score")}<input type="number" min="0.01" max="0.99" step="0.01" value={form.intent_cutoff_score} onChange={(event) => update("intent_cutoff_score", Number(event.target.value))} /></label>
              <label>{getStudioPageLabel(copy, "유사 의도 Score")}<input type="number" min="0.01" max="0.99" step="0.01" value={form.similar_intent_score} onChange={(event) => update("similar_intent_score", Number(event.target.value))} /></label>
              <label>{getStudioPageLabel(copy, "의도 파악 결과 최대 개수")}<input type="number" min="1" max="10" value={form.max_intent_candidates} onChange={(event) => update("max_intent_candidates", Number(event.target.value))} /></label>
            </> : null}
            <label>{getStudioPageLabel(copy, "버튼 선택 옵션")}<select value={form.button_match_mode} onChange={(event) => update("button_match_mode", event.target.value as FormState["button_match_mode"])}><option value="contains">{getStudioPageLabel(copy, "포함 일치")}</option><option value="exact">{getStudioPageLabel(copy, "완전 일치")}</option></select></label>
          </div>
        </section>

        <section className="bot-hub__settings-section bot-hub__settings-wide" aria-labelledby="hub-message-settings-title">
          <div className="bot-hub__settings-section-heading"><h2 id="hub-message-settings-title">{getStudioPageLabel(copy,"메시지 설정")}</h2></div>
          <div className="bot-hub__settings-fields">
            <label className="bot-hub__settings-wide">{getStudioPageLabel(copy,"첫 인사말")}<textarea value={form.greeting_message || ""} onChange={(event) => update("greeting_message", event.target.value)} /></label>
            {natural ? <>
              <label className="bot-hub__check"><input type="checkbox" checked={form.show_members_in_greeting} onChange={(event) => update("show_members_in_greeting", event.target.checked)} />{getStudioPageLabel(copy, "첫 인사말에 하위 봇 버튼 노출")}</label>
              <label className="bot-hub__settings-wide">{getStudioPageLabel(copy,"사용자의 의도를 이해하지 못한 경우")}<textarea value={form.unrecognized_message || ""} onChange={(event) => update("unrecognized_message", event.target.value)} /></label>
              <label className="bot-hub__settings-wide">{getStudioPageLabel(copy, "파악된 봇이 여러 개인 경우")}<textarea value={form.multiple_candidates_message || ""} onChange={(event) => update("multiple_candidates_message", event.target.value)} /></label>
              <label className="bot-hub__settings-wide">{getStudioPageLabel(copy, "봇 허브 동작 오류 시")}<textarea value={form.runtime_error_message || ""} onChange={(event) => update("runtime_error_message", event.target.value)} /></label>
              <label className="bot-hub__settings-wide">{getStudioPageLabel(copy,"대화가 진행 중인 경우")}<textarea value={form.conversation_in_progress_message || ""} onChange={(event) => update("conversation_in_progress_message", event.target.value)} /></label>
            </> : null}
            <label>{getStudioPageLabel(copy,"타임아웃 시간(초)")}<input type="number" min="0" max="86400" value={form.timeout_seconds ?? 0} onChange={(event) => update("timeout_seconds", Number(event.target.value))} /></label>
            <label className="bot-hub__check"><input type="checkbox" checked={form.apply_timeout_to_push} onChange={(event) => update("apply_timeout_to_push", event.target.checked)} />{getStudioPageLabel(copy, "Push Message 대화에도 적용")}</label>
            <label className="bot-hub__settings-wide">{getStudioPageLabel(copy,"타임아웃 경과 시")}<textarea value={form.timeout_message || ""} onChange={(event) => update("timeout_message", event.target.value)} /></label>
            <label>{getStudioPageLabel(copy, "원하는 봇 없음 버튼명")}<input value={form.no_bot_label || ""} onChange={(event) => update("no_bot_label", event.target.value)} /></label>
            <label className="bot-hub__settings-wide">{getStudioPageLabel(copy, "원하는 봇이 없다고 응답했을 경우")}<textarea value={form.no_bot_message || ""} onChange={(event) => update("no_bot_message", event.target.value)} /></label>
          </div>
        </section>
        <section className="bot-hub__call-rules bot-hub__settings-wide" aria-labelledby="hub-call-rules-title">
          <div className="bot-hub__call-rules-heading">
            <div><h2 id="hub-call-rules-title">{getStudioPageLabel(copy, "봇 허브 호출 단어")}</h2><p>{getStudioPageLabel(copy, "채널 사용자의 발화가 룰과 일치하면 이 봇 허브의 선택 화면으로 연결됩니다.")}</p></div>
            <button type="button" className="bot-hub__secondary" onClick={addHubCallRule}>{getStudioPageLabel(copy,"+ 룰 추가")}</button>
          </div>
          {form.hub_call_rules.length === 0 ? <p className="bot-hub__call-rules-empty">{getStudioPageLabel(copy, "등록된 호출 단어가 없습니다.")}</p> : form.hub_call_rules.map((rule, index) => (
            <div className="bot-hub__call-rule" key={rule.id || `${rule.expression}-${index}`}>
              <label>{getStudioPageLabel(copy,"룰 이름")}<input value={rule.name} maxLength={120} onChange={(event) => updateHubCallRule(index, { name: event.target.value })} /></label>
              <label>{getStudioPageLabel(copy, "호출 단어 또는 정규식")}<input value={rule.expression} maxLength={500} onChange={(event) => updateHubCallRule(index, { expression: event.target.value })} /></label>
              <label className="bot-hub__check"><input type="checkbox" checked={rule.enabled} onChange={(event) => updateHubCallRule(index, { enabled: event.target.checked })} />{getStudioPageLabel(copy,"사용")}</label>
              <button type="button" className="bot-hub__danger" onClick={() => removeHubCallRule(index)} aria-label={`${rule.name || rule.expression || "호출 단어"} 삭제`}>{getStudioPageLabel(copy,"삭제")}</button>
            </div>
          ))}
        </section>
      </section>
    </main>
  );
}
