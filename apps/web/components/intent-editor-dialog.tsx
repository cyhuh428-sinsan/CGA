"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { useI18n } from "@/components/language-provider";
import { type AuthSession } from "@/lib/auth";
import { getBotVersionSettings } from "@/lib/bot-settings";
import { INTENT_EDITOR_CATALOGS, formatIntentEditorText } from "@/lib/i18n/intent-editor";
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
  const { language } = useI18n();
  const copy = INTENT_EDITOR_CATALOGS[language];

  return (
    <div
      className="intent-editor-dialog__help"
      onMouseEnter={() => onOpen(id)}
      onMouseLeave={onClose}
    >
      <button
        type="button"
        className="intent-editor-dialog__help-trigger"
        aria-label={formatIntentEditorText(copy.helpAria, { label })}
        title={formatIntentEditorText(copy.helpAria, { label })}
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
  const { language: uiLanguage } = useI18n();
  const copy = INTENT_EDITOR_CATALOGS[uiLanguage];
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
  const dialogTypeLabel = dialogType === 0 ? copy.module : copy.intent;
  const dialogTitle = formatIntentEditorText(isNew ? copy.createTitle : copy.editTitle, { type: dialogTypeLabel });
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
      setErrorMessage(copy.validation.maxTags);
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
      setErrorMessage(copy.validation.noActiveVersion);
      return;
    }

    const normalizedName = name.trim();
    if (!normalizedName) {
      setErrorMessage(copy.validation.nameRequired);
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
      setErrorMessage(copy.validation.duplicateName);
      return;
    }

    const duplicatedDialogKey = dialogs.some(
      (item) => item.dialogKey === normalizedDialogKey && item.id !== dialog?.id,
    );
    if (duplicatedDialogKey) {
      setErrorMessage(copy.validation.duplicateKey);
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
        formatIntentEditorText(isNew ? copy.created : copy.updated, { type: nextDialogType === 0 ? copy.module : copy.intent }),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : copy.validation.saveFailed);
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
          <button type="button" className="entity-editor-dialog__close" aria-label={copy.close} onClick={onClose}>
            ×
          </button>
        </div>

        <div className="entity-editor-dialog__body" ref={helpContainerRef}>
          {errorMessage ? <p className="form-message form-message--error">{errorMessage}</p> : null}

          <p className="intent-editor-dialog__required-hint">
            {copy.requiredHint}
          </p>

          <div className="intent-editor-dialog__field-group">
            <span className="intent-editor-dialog__label">{copy.category}</span>
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
                <span>{copy.intent}</span>
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
                <span>{copy.module}</span>
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
                <span>{formatIntentEditorText(copy.nameLabel, { type: dialogTypeLabel })}</span>
                <span className="intent-editor-dialog__required-mark">*</span>
              </span>
              <input
                type="text"
                className="bot-settings-card__input"
                value={name}
                onChange={(event) => handleNameChange(event.target.value)}
                maxLength={NAME_MAX}
                placeholder={formatIntentEditorText(copy.namePlaceholder, { type: dialogTypeLabel })}
                autoFocus
              />
              <span className="intent-editor-dialog__field-guide">
                <span>{copy.nameGuide}</span>
                <span>{name.length}/{NAME_MAX}</span>
              </span>
            </label>

            <label className="intent-editor-dialog__field">
              <span className="intent-editor-dialog__label-row">
                <span>{copy.displayName}</span>
                <span className="intent-editor-dialog__required-mark">*</span>
              </span>
              <input
                type="text"
                className="bot-settings-card__input"
                value={displayName}
                onChange={(event) => handleDisplayNameChange(event.target.value)}
                maxLength={DISPLAY_NAME_MAX}
                placeholder={copy.displayNamePlaceholder}
              />
              <span className="intent-editor-dialog__field-guide">
                <span>{copy.nameGuide}</span>
                <span>{displayName.length}/{DISPLAY_NAME_MAX}</span>
              </span>
            </label>

            <label className="intent-editor-dialog__field">
              <span className="intent-editor-dialog__label-row">
                <span>{copy.dialogKey}</span>
                <span className="intent-editor-dialog__required-mark">*</span>
                <HelpTooltip
                  id="dialogKey"
                  label={copy.dialogKey}
                  description={copy.dialogKeyDescription}
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
                    <span>{copy.dialogKeyGuide}</span>
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
                  <span>{copy.transitionLocked}</span>
                </span>
                <HelpTooltip
                  id="transitionLocked"
                  label={copy.transitionLocked}
                  description={copy.transitionLockedDescription}
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
                  <span>{copy.returnBlocked}</span>
                </span>
                <HelpTooltip
                  id="returnBlocked"
                  label={copy.returnBlocked}
                  description={copy.returnBlockedDescription}
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
                  <span>{copy.feedbackEnabled}</span>
                </span>
                <HelpTooltip
                  id="feedbackEnabled"
                  label={copy.feedbackEnabled}
                  description={copy.feedbackEnabledDescription}
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
              {formatIntentEditorText(copy.feedbackLocked, {
                mode: feedbackMode === "none" ? copy.feedbackModeNone : copy.feedbackModeAll,
              })}
            </p>
          ) : null}

          {dialogType === 1 && usesLlmAnswer ? (
            <label
              className={`intent-editor-dialog__field intent-editor-dialog__field--full${
                activeHelpId === "llmAnswerPrompt" ? " intent-editor-dialog__field--active-help" : ""
              }`}
            >
              <span className="intent-editor-dialog__label-row">
                <span>{copy.llmPrompt}</span>
                <HelpTooltip
                  id="llmAnswerPrompt"
                  label={copy.llmPrompt}
                  description={copy.llmPromptDescription}
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
                placeholder={copy.llmPromptPlaceholder}
                onChange={(event) => setLlmAnswerPrompt(event.target.value)}
              />
              <span className="intent-editor-dialog__field-guide">
                <span>{copy.llmPromptFallback}</span>
              </span>
            </label>
          ) : null}

          <label
            className={`intent-editor-dialog__field${
              activeHelpId === "tags" ? " intent-editor-dialog__field--active-help" : ""
            }`}
          >
            <span className="intent-editor-dialog__label-row">
              <span>{copy.tags}</span>
              <HelpTooltip
                id="tags"
                label={copy.tags}
                description={copy.tagsDescription}
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
              placeholder={copy.tagsPlaceholder}
            />
            <span className="intent-editor-dialog__field-guide">
              <span>{copy.tagsGuide}</span>
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
            {copy.cancel}
          </button>
          <button
            type="button"
            className="primary-action"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? copy.saving : copy.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
