"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { type AuthSession } from "@/lib/auth";
import { getBotVersionSettings } from "@/lib/bot-settings";
import {
  applyUpdatedVersionToBot,
  getBotDialogs,
  getNextDialogNo,
  withUpdatedDialogs,
} from "@/lib/dialog-assets";
import {
  type StudioBotApiItem,
  updateStudioBotVersionDialogs,
} from "@/lib/studio-bots-api";
import {
  createEmptyVersionDialog,
  normalizeVersionDialogs,
  normalizeVersionDocument,
  type VersionDialogAsset,
  type VersionDialogType,
} from "@/lib/version-document";

type HelpTooltipProps = {
  id: string;
  label: string;
  description: string;
  active: boolean;
  onOpen: (id: string) => void;
  onClose: () => void;
  align?: "start" | "center" | "end";
};

function HelpTooltip({
  id,
  label,
  description,
  active,
  onOpen,
  onClose,
  align = "center",
}: HelpTooltipProps) {
  return (
    <div
      className="intent-editor-dialog__help"
      onMouseEnter={() => onOpen(id)}
      onMouseLeave={onClose}
    >
      <button
        type="button"
        className="intent-editor-dialog__help-trigger"
        aria-label={`${label} 설명`}
        title={`${label} 설명`}
        aria-expanded={active}
        onClick={() => (active ? onClose() : onOpen(id))}
      >
        i
      </button>
      {active ? (
        <div
          className={`intent-editor-dialog__help-popover intent-editor-dialog__help-popover--${align}`}
        >
          <strong>{label}</strong>
          <p>{description}</p>
        </div>
      ) : null}
    </div>
  );
}

type IntentEditorDialogProps = {
  authSession: AuthSession;
  bot: StudioBotApiItem;
  dialog: VersionDialogAsset | null;
  initialDialogType?: VersionDialogType | null;
  onClose: () => void;
  onSaved: (nextBot: StudioBotApiItem, nextDialog: VersionDialogAsset, successMessage: string) => void;
};

function buildDefaultDialogKey() {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return template.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((item) => item.trim()).filter(Boolean))];
}

export function IntentEditorDialog({
  authSession,
  bot,
  dialog,
  initialDialogType = null,
  onClose,
  onSaved,
}: IntentEditorDialogProps) {
  const NAME_MAX = 100;
  const DISPLAY_NAME_MAX = 40;
  const DIALOG_KEY_MAX = 45;
  const isNew = !dialog;
  const dialogs = useMemo(() => getBotDialogs(bot), [bot]);
  const nextDialogNo = useMemo(() => getNextDialogNo(dialogs), [dialogs]);
  const feedbackMode = getBotVersionSettings(bot).messages.feedback.mode;
  const feedbackEditable = feedbackMode === "per-intent";
  const initialType = dialog?.dialogType ?? initialDialogType ?? 1;
  const versionAiConfig = bot.active_version?.version_json?.system_config?.ai_config;
  const aiConfig = {
    ...(bot.data_json ?? {}),
    ...(versionAiConfig && typeof versionAiConfig === "object" && !Array.isArray(versionAiConfig) ? versionAiConfig : {}),
  } as Record<string, unknown>;
  const answerMode = typeof aiConfig.answer_mode === "string" ? aiConfig.answer_mode : "fixed";
  const usesLlmAnswer = answerMode === "llm" || answerMode === "llm_rag";

  const [dialogType, setDialogType] = useState<VersionDialogType>(initialType);
  const [name, setName] = useState(dialog?.name ?? "");
  const [displayName, setDisplayName] = useState(dialog?.displayName ?? "");
  const [displayNameTouched, setDisplayNameTouched] = useState(
    Boolean(dialog?.displayName && dialog.displayName !== dialog?.name),
  );
  const [dialogKey, setDialogKey] = useState(
    dialog?.dialogKey || buildDefaultDialogKey(),
  );
  const [transitionLocked, setTransitionLocked] = useState(dialog?.transitionLocked ?? false);
  const [returnBlocked, setReturnBlocked] = useState(dialog?.returnBlocked ?? false);
  const [feedbackEnabled, setFeedbackEnabled] = useState(
    feedbackMode === "all" ? true : feedbackMode === "none" ? false : dialog?.feedbackEnabled ?? false,
  );
  const [llmAnswerPrompt, setLlmAnswerPrompt] = useState(
    typeof dialog?.llmAnswerPrompt === "string" ? dialog.llmAnswerPrompt : "",
  );
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(dialog?.tags ?? []);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeHelpId, setActiveHelpId] = useState<string | null>(null);
  const helpContainerRef = useRef<HTMLDivElement | null>(null);
  const dialogTypeLabel = dialogType === 0 ? "모듈" : "의도";
  const dialogTitle = isNew ? `${dialogTypeLabel} 생성` : `${dialogTypeLabel} 수정`;
  const classificationType = dialog?.classificationType ?? "기본";

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!helpContainerRef.current?.contains(event.target as Node)) {
        setActiveHelpId(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    const seedDialogType = dialog?.dialogType ?? initialDialogType ?? 1;
    const seedDialogNo = dialog?.dialogNo ?? nextDialogNo;
    setDialogType(seedDialogType);
    setName(dialog?.name ?? "");
    setDisplayName(dialog?.displayName ?? "");
    setDisplayNameTouched(Boolean(dialog?.displayName && dialog.displayName !== dialog?.name));
    setDialogKey(dialog?.dialogKey || buildDefaultDialogKey());
    setTransitionLocked(dialog?.transitionLocked ?? false);
    setReturnBlocked(dialog?.returnBlocked ?? false);
    setFeedbackEnabled(
      feedbackMode === "all" ? true : feedbackMode === "none" ? false : dialog?.feedbackEnabled ?? false,
    );
    setLlmAnswerPrompt(typeof dialog?.llmAnswerPrompt === "string" ? dialog.llmAnswerPrompt : "");
    setTagInput("");
    setTags(dialog?.tags ?? []);
    setSaving(false);
    setErrorMessage("");
    setActiveHelpId(null);
  }, [dialog, feedbackMode, initialDialogType, nextDialogNo]);

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    const normalizedValue = tagInput.trim();
    if (!normalizedValue) {
      return;
    }

    if (tags.length >= 10) {
      setErrorMessage("태그는 최대 10개까지 등록할 수 있습니다.");
      return;
    }

    setTags((current) => normalizeTags([...current, normalizedValue]));
    setTagInput("");
    setErrorMessage("");
  }

  function removeTag(tag: string) {
    setTags((current) => current.filter((item) => item !== tag));
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!displayNameTouched) {
      setDisplayName(value);
    }
  }

  function handleDisplayNameChange(value: string) {
    setDisplayNameTouched(true);
    setDisplayName(value);
  }

  async function handleSave() {
    if (!bot.active_version) {
      setErrorMessage("활성 버전이 없습니다.");
      return;
    }

    const normalizedName = name.trim();
    if (!normalizedName) {
      setErrorMessage("의도/모듈명을 입력해주세요.");
      return;
    }

    const normalizedDisplayName = displayName.trim() || normalizedName;
    const normalizedDialogKey = isNew
      ? dialogKey.trim() || buildDefaultDialogKey()
      : dialog.dialogKey;
    const nextDialogType = isNew ? dialogType : dialog.dialogType;

    const duplicatedName = dialogs.some(
      (item) => item.name === normalizedName && item.id !== dialog?.id,
    );
    if (duplicatedName) {
      setErrorMessage("이미 사용 중인 의도/모듈명입니다.");
      return;
    }

    const duplicatedDialogKey = dialogs.some(
      (item) => item.dialogKey === normalizedDialogKey && item.id !== dialog?.id,
    );
    if (duplicatedDialogKey) {
      setErrorMessage("이미 사용 중인 의도 Key 입니다.");
      return;
    }

    const now = new Date().toISOString();
    const nextDialog: VersionDialogAsset = {
      ...(dialog ?? createEmptyVersionDialog(nextDialogType)),
      dialogNo: dialog?.dialogNo ?? nextDialogNo,
      dialogType: nextDialogType,
      name: normalizedName,
      displayName: normalizedDisplayName,
      dialogKey: normalizedDialogKey,
      classificationType,
      transitionLocked,
      returnBlocked,
      feedbackEnabled: feedbackMode === "all" ? true : feedbackMode === "none" ? false : feedbackEnabled,
      llmAnswerPrompt: llmAnswerPrompt.trim(),
      tags: normalizeTags(tags),
      updatedAt: now,
      updatedBy: authSession.user.login_id,
    };

    const nextDialogs = dialog
      ? dialogs.map((item) => (item.id === nextDialog.id ? nextDialog : item))
      : [nextDialog, ...dialogs];

    setSaving(true);
    setErrorMessage("");

    try {
      const baseDocument = normalizeVersionDocument(bot.active_version.version_json);
      const response = await updateStudioBotVersionDialogs(
        authSession.access_token,
        bot.id,
        bot.active_version.id,
        nextDialogs,
      );
      const savedDialogs = normalizeVersionDialogs(response.items);
      const savedDialog = savedDialogs.find((item) => item.id === nextDialog.id) ?? nextDialog;
      const nextDocument = withUpdatedDialogs(baseDocument, savedDialogs);
      const updatedVersion = {
        ...response.version,
        version_json: nextDocument,
        asset_counts: response.asset_counts,
        scenario_validation: response.scenario_validation,
      };

      const nextBot = applyUpdatedVersionToBot(bot, updatedVersion);
      onSaved(
        nextBot,
        savedDialog,
        isNew
          ? `${nextDialogType === 0 ? "모듈" : "의도"}이 등록되었습니다.`
          : `${nextDialogType === 0 ? "모듈" : "의도"} 기본 정보가 수정되었습니다.`,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "의도/모듈을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="entity-editor-backdrop" role="presentation">
      <div
        className="intent-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={dialogTitle}
      >
        <div className="entity-editor-dialog__header">
          <strong>{dialogTitle}</strong>
          <button type="button" className="entity-editor-dialog__close" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="entity-editor-dialog__body" ref={helpContainerRef}>
          {errorMessage ? <p className="form-message form-message--error">{errorMessage}</p> : null}

          <p className="intent-editor-dialog__required-hint">
            의도명, 표시명, 의도 Key는 필수값입니다.
          </p>

          <div className="intent-editor-dialog__field-group">
            <span className="intent-editor-dialog__label">구분</span>
            <div className="intent-editor-dialog__radio-row">
              <label className="intent-editor-dialog__radio">
                <input
                  type="radio"
                  name="dialog-type"
                  checked={dialogType === 1}
                  disabled={!isNew || initialDialogType != null}
                  onChange={() => {
                    const nextType: VersionDialogType = 1;
                    setDialogType(nextType);
                  }}
                />
                <span>의도</span>
              </label>
              <label className="intent-editor-dialog__radio">
                <input
                  type="radio"
                  name="dialog-type"
                  checked={dialogType === 0}
                  disabled={!isNew || initialDialogType != null}
                  onChange={() => {
                    const nextType: VersionDialogType = 0;
                    setDialogType(nextType);
                  }}
                />
                <span>모듈</span>
              </label>
            </div>
          </div>

          <div className="intent-editor-dialog__grid">
            <label
              className={`intent-editor-dialog__field${
                activeHelpId === "dialogKey" ? " intent-editor-dialog__field--active-help" : ""
              }`}
            >
              <span className="intent-editor-dialog__label-row">
                <span>{dialogTypeLabel}명</span>
                <span className="intent-editor-dialog__required-mark">*</span>
              </span>
              <input
                type="text"
                className="bot-settings-card__input"
                value={name}
                onChange={(event) => handleNameChange(event.target.value)}
                maxLength={NAME_MAX}
                placeholder={`${dialogTypeLabel}명을 입력하세요.`}
                autoFocus
              />
              <span className="intent-editor-dialog__field-guide">
                <span>한글/영문/숫자/공백/특수문자/-.()로만 입력</span>
                <span>{name.length}/{NAME_MAX}</span>
              </span>
            </label>

            <label className="intent-editor-dialog__field">
              <span className="intent-editor-dialog__label-row">
                <span>표시명</span>
                <span className="intent-editor-dialog__required-mark">*</span>
              </span>
              <input
                type="text"
                className="bot-settings-card__input"
                value={displayName}
                onChange={(event) => handleDisplayNameChange(event.target.value)}
                maxLength={DISPLAY_NAME_MAX}
                placeholder="표시명을 입력하세요."
              />
              <span className="intent-editor-dialog__field-guide">
                <span>한글/영문/숫자/공백/특수문자/-.()로만 입력</span>
                <span>{displayName.length}/{DISPLAY_NAME_MAX}</span>
              </span>
            </label>

            <label className="intent-editor-dialog__field">
              <span className="intent-editor-dialog__label-row">
                <span>의도 Key</span>
                <span className="intent-editor-dialog__required-mark">*</span>
                <HelpTooltip
                  id="dialogKey"
                  label="의도 Key"
                  description="의도/모듈을 내부적으로 식별하는 키입니다. 나중에 엔진이나 외부 연동에서 이름 대신 안정적으로 참조할 수 있도록 유지됩니다."
                  active={activeHelpId === "dialogKey"}
                  onOpen={setActiveHelpId}
                  onClose={() => setActiveHelpId(null)}
                  align="start"
                />
              </span>
              {isNew ? (
                <>
                  <input
                    type="text"
                    className="bot-settings-card__input"
                    value={dialogKey}
                    onChange={(event) => setDialogKey(event.target.value)}
                    maxLength={DIALOG_KEY_MAX}
                  />
                  <span className="intent-editor-dialog__field-guide">
                    <span>영문/숫자/특수문자/_(밑줄)로만 입력</span>
                    <span>{dialogKey.length}/{DIALOG_KEY_MAX}</span>
                  </span>
                </>
              ) : (
                <div className="intent-editor-dialog__readonly-key">{dialogKey}</div>
              )}
            </label>
          </div>

          <div className="intent-editor-dialog__switch-grid">
            <label
              className={`intent-editor-dialog__toggle${
                activeHelpId === "transitionLocked" ? " intent-editor-dialog__toggle--active-help" : ""
              }`}
            >
              <span className="intent-editor-dialog__toggle-head">
                <span className="intent-editor-dialog__toggle-title">
                  <input
                    type="checkbox"
                    checked={transitionLocked}
                    onChange={(event) => setTransitionLocked(event.target.checked)}
                  />
                  <span>의도전환잠금</span>
                </span>
                <HelpTooltip
                  id="transitionLocked"
                  label="의도전환잠금"
                  description="의도에 진입한 뒤에는 시나리오 진행 중 다른 의도로 전환되지 않도록 잠그는 설정입니다. 특정 의도에서 설계한 대화를 반드시 완결해야 할 때 사용합니다."
                  active={activeHelpId === "transitionLocked"}
                  onOpen={setActiveHelpId}
                  onClose={() => setActiveHelpId(null)}
                  align="start"
                />
              </span>
            </label>

            <label
              className={`intent-editor-dialog__toggle${
                activeHelpId === "returnBlocked" ? " intent-editor-dialog__toggle--active-help" : ""
              }`}
            >
              <span className="intent-editor-dialog__toggle-head">
                <span className="intent-editor-dialog__toggle-title">
                  <input
                    type="checkbox"
                    checked={returnBlocked}
                    onChange={(event) => setReturnBlocked(event.target.checked)}
                  />
                  <span>의도복귀차단</span>
                </span>
                <HelpTooltip
                  id="returnBlocked"
                  label="의도복귀차단"
                  description="현재 의도 진행 중 다른 의도로 진입하게 되면, 다시 현재 의도로 복귀하지 않도록 막는 설정입니다."
                  active={activeHelpId === "returnBlocked"}
                  onOpen={setActiveHelpId}
                  onClose={() => setActiveHelpId(null)}
                />
              </span>
            </label>

            <label
              className={`intent-editor-dialog__toggle${
                activeHelpId === "feedbackEnabled" ? " intent-editor-dialog__toggle--active-help" : ""
              }`}
            >
              <span className="intent-editor-dialog__toggle-head">
                <span className="intent-editor-dialog__toggle-title">
                  <input
                    type="checkbox"
                    checked={feedbackMode === "all" ? true : feedbackMode === "none" ? false : feedbackEnabled}
                    onChange={(event) => setFeedbackEnabled(event.target.checked)}
                    disabled={!feedbackEditable}
                  />
                  <span>의도별 피드백</span>
                </span>
                <HelpTooltip
                  id="feedbackEnabled"
                  label="의도별 피드백"
                  description="해당 의도 시나리오가 끝난 뒤 사용자가 점수로 평가할 수 있도록 하는 설정입니다. 실제 피드백 메시지와 척도는 봇 설정의 메시지 설정을 따릅니다."
                  active={activeHelpId === "feedbackEnabled"}
                  onOpen={setActiveHelpId}
                  onClose={() => setActiveHelpId(null)}
                  align="end"
                />
              </span>
            </label>
          </div>

          {!feedbackEditable ? (
            <p className="intent-editor-dialog__hint">
              봇 설정의 메시지 설정에서 피드백 사용 유형이
              {feedbackMode === "none" ? " `사용 안함`" : " `모든 의도 사용`"}으로 설정되어 있어 여기서는 변경할 수 없습니다.
            </p>
          ) : null}

          {dialogType === 1 && usesLlmAnswer ? (
            <label
              className={`intent-editor-dialog__field intent-editor-dialog__field--full${
                activeHelpId === "llmAnswerPrompt" ? " intent-editor-dialog__field--active-help" : ""
              }`}
            >
              <span className="intent-editor-dialog__label-row">
                <span>LLM 답변 프롬프트</span>
                <HelpTooltip
                  id="llmAnswerPrompt"
                  label="LLM 답변 프롬프트"
                  description="이 의도에 진입했을 때 LLM Engine 답변과 LLM Engine RAG 답변 생성에 우선 적용할 지시문입니다. 비워두면 봇 설정의 기본 프롬프트를 사용합니다."
                  active={activeHelpId === "llmAnswerPrompt"}
                  onOpen={setActiveHelpId}
                  onClose={() => setActiveHelpId(null)}
                  align="start"
                />
              </span>
              <textarea
                className="bot-settings-intro__textarea"
                value={llmAnswerPrompt}
                rows={5}
                placeholder="이 의도에서 LLM이 답변을 생성할 때 따를 말투, 형식, 제한사항을 입력하세요."
                onChange={(event) => setLlmAnswerPrompt(event.target.value)}
              />
              <span className="intent-editor-dialog__field-guide">
                <span>비워두면 봇 설정의 기본 LLM 답변 프롬프트를 사용합니다.</span>
              </span>
            </label>
          ) : null}

          <label
            className={`intent-editor-dialog__field${
              activeHelpId === "tags" ? " intent-editor-dialog__field--active-help" : ""
            }`}
          >
            <span className="intent-editor-dialog__label-row">
              <span>태그</span>
              <HelpTooltip
                id="tags"
                label="태그"
                description="유사한 성격의 의도들을 묶어서 조회하고 관리하기 위한 값입니다. 새로운 태그를 입력하고 Enter를 누르면 등록됩니다."
                active={activeHelpId === "tags"}
                onOpen={setActiveHelpId}
                onClose={() => setActiveHelpId(null)}
                align="start"
              />
            </span>
            <input
              type="text"
              className="bot-settings-card__input"
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={handleTagKeyDown}
              maxLength={100}
              placeholder="태그를 입력하고 엔터키를 눌러주세요."
            />
            <span className="intent-editor-dialog__field-guide">
              <span>한글/영문/숫자/공백으로만 입력, 10개까지 입력 가능</span>
              <span>{tags.length}/10</span>
            </span>
          </label>

          {tags.length > 0 ? (
            <div className="intent-editor-dialog__tags">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="intent-editor-dialog__tag"
                  onClick={() => removeTag(tag)}
                >
                  {tag} <span>×</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="entity-editor-dialog__footer">
          <button type="button" className="secondary-action" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="primary-action"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? "저장 중..." : "확인"}
          </button>
        </div>
      </div>
    </div>
  );
}
