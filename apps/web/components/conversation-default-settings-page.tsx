"use client";

import { getStudioRuntimeMessage } from "@/lib/i18n/studio-runtime-native";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { BotSettingsShell } from "@/components/bot-settings-shell";
import { type ConversationDefaultsConfig } from "@/lib/bot-settings";
import { getBotDialogs } from "@/lib/dialog-assets";
import { type VersionDialogAsset } from "@/lib/version-document";
import { useI18n } from "@/components/language-provider";
import { getStudioPageLabel, STUDIO_PAGE_CATALOGS } from "@/lib/i18n/studio-pages";

type ModuleFieldKey =
  | "overflowModule"
  | "preprocessModule"
  | "beforeSessionEndModule"
  | "multiIntentButtonModule";

const MODULE_FIELD_LABELS: Record<ModuleFieldKey, string> = {
  overflowModule: "의도파악 시도 횟수 초과시 실행할 모듈",
  preprocessModule: "전처리 모듈",
  beforeSessionEndModule: "Session End 전 실행할 모듈",
  multiIntentButtonModule: "파악된 의도가 여러 개일 경우 버튼에 추가할 모듈",
};

function clampNumber(value: number, min?: number, max?: number) {
  let next = Number.isFinite(value) ? value : 0;
  if (min !== undefined) {
    next = Math.max(min, next);
  }
  if (max !== undefined) {
    next = Math.min(max, next);
  }
  return next;
}

function normalizeStepValue(value: number, step: number) {
  const decimalPart = String(step).split(".")[1];
  const digits = decimalPart ? decimalPart.length : 0;
  return Number(value.toFixed(digits));
}

function FieldLabel({ title, help }: { title: string; help?: string }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <span ref={wrapperRef} className="settings-field-label">
      {title}
      {help ? (
        <button
          type="button"
          className="settings-help-tip"
          aria-label={`${title} 설명`}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          i
        </button>
      ) : null}
      {help && open ? <span className="settings-help-popover">{help}</span> : null}
    </span>
  );
}

function SettingsBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="bot-settings-section">
      <h2>{title}</h2>
      <div className="settings-defaults-panel">{children}</div>
    </section>
  );
}

function NumberStepperField({
  title,
  help,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  title: string;
  help?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const normalizedValue = Number.isFinite(value) ? value : min ?? 0;

  function update(nextValue: number) {
    onChange(normalizeStepValue(clampNumber(nextValue, min, max), step));
  }

  return (
    <label className="settings-defaults-field">
      <FieldLabel title={title} help={help} />
      <div className="settings-stepper">
        <button
          type="button"
          className="settings-stepper__button"
          onClick={() => update(normalizedValue - step)}
          aria-label={`${title} 감소`}
        >
          -
        </button>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          className="settings-stepper__input"
          value={normalizedValue}
          onChange={(event) => update(Number(event.target.value))}
        />
        <button
          type="button"
          className="settings-stepper__button"
          onClick={() => update(normalizedValue + step)}
          aria-label={`${title} 증가`}
        >
          +
        </button>
      </div>
    </label>
  );
}

function ToggleField({
  title,
  help,
  checked,
  onChange,
}: {
  title: string;
  help?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { language } = useI18n();
  const copy = STUDIO_PAGE_CATALOGS[language];

  return (
    <div className="settings-switch-row">
      <FieldLabel title={title} help={help} />
      <label className="settings-switch">
        <span>{getStudioPageLabel(copy, "사용")}</span>
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="settings-switch__track" />
      </label>
    </div>
  );
}

function BinaryRadioField({
  title,
  help,
  checked,
  trueLabel = "사용",
  falseLabel = "미사용",
  onChange,
}: {
  title: string;
  help?: string;
  checked: boolean;
  trueLabel?: string;
  falseLabel?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="settings-defaults-field">
      <FieldLabel title={title} help={help} />
      <div className="settings-choice-group">
        <label className="settings-choice-option">
          <input type="radio" checked={!checked} onChange={() => onChange(false)} />
          <span>{falseLabel}</span>
        </label>
        <label className="settings-choice-option">
          <input type="radio" checked={checked} onChange={() => onChange(true)} />
          <span>{trueLabel}</span>
        </label>
      </div>
    </div>
  );
}

function RadioField({
  title,
  help,
  value,
  options,
  onChange,
}: {
  title: string;
  help?: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="settings-defaults-field settings-defaults-field--wide">
      <FieldLabel title={title} help={help} />
      <div className="settings-choice-group">
        {options.map((option) => (
          <label key={option.value} className="settings-choice-option">
            <input type="radio" checked={value === option.value} onChange={() => onChange(option.value)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ModuleField({
  title,
  help,
  value,
  onOpen,
}: {
  title: string;
  help?: string;
  value: string;
  onOpen: () => void;
}) {
  const { language } = useI18n();
  const copy = STUDIO_PAGE_CATALOGS[language];

  return (
    <div className="settings-defaults-field settings-defaults-field--wide">
      <FieldLabel title={title} help={help} />
      <div className="settings-module-field">
        <input
          type="text"
          readOnly
          className="settings-module-field__input"
          value={value}
          placeholder={getStudioPageLabel(copy, "우측 버튼을 클릭해 연결할 모듈을 선택하세요.")}
        />
        <button type="button" className="secondary-action settings-module-field__button" onClick={onOpen}>
          모듈 목록
        </button>
      </div>
    </div>
  );
}

function ModulePickerDialog({
  open,
  title,
  modules,
  selectedValue,
  onClose,
  onSelect,
}: {
  open: boolean;
  title: string;
  modules: VersionDialogAsset[];
  selectedValue: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  const { language } = useI18n();
  const copy = STUDIO_PAGE_CATALOGS[language];

  if (!open) {
    return null;
  }

  return (
    <div className="settings-dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="settings-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="settings-dialog__header">
          <strong>{title}</strong>
          <button type="button" className="settings-dialog__close" onClick={onClose} aria-label={getStudioPageLabel(copy, "닫기")}>
            ×
          </button>
        </div>

        <div className="settings-dialog__body">
          <button
            type="button"
            className={`settings-dialog__row${selectedValue === "" ? " is-selected" : ""}`}
            onClick={() => {
              onSelect("");
              onClose();
            }}
          >
            선택 안 함
          </button>

          {modules.length > 0 ? (
            modules.map((module) => {
              const moduleName = module.name || module.displayName || module.dialogKey;
              const moduleMeta = module.dialogKey || `ID ${module.dialogNo}`;
              return (
                <button
                  key={module.id}
                  type="button"
                  className={`settings-dialog__row${selectedValue === moduleName ? " is-selected" : ""}`}
                  onClick={() => {
                    onSelect(moduleName);
                    onClose();
                  }}
                >
                  <span>{moduleName}</span>
                  <small>{moduleMeta}</small>
                </button>
              );
            })
          ) : (
            <div className="settings-dialog__empty">{getStudioPageLabel(copy, "등록된 모듈이 없습니다.")}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ConversationDefaultSettingsPage() {
  const { language: uiLanguage } = useI18n();
  const copy = STUDIO_PAGE_CATALOGS[uiLanguage];
  return (
    <BotSettingsShell activeMenu="conversation-defaults">
      {({ bot, mainHref, versionSettings, saveVersionSettings, setErrorMessage, setMessage }) => {
        const [form, setForm] = useState<ConversationDefaultsConfig>(versionSettings.conversationDefaults);
        const [saving, setSaving] = useState(false);
        const [modulePickerTarget, setModulePickerTarget] = useState<ModuleFieldKey | null>(null);
        const versionAiConfig = bot.active_version?.version_json?.system_config?.ai_config;
        const aiConfig = {
          ...(bot.data_json ?? {}),
          ...(versionAiConfig && typeof versionAiConfig === "object" && !Array.isArray(versionAiConfig) ? versionAiConfig : {}),
        } as Record<string, unknown>;
        const answerMode = typeof aiConfig.answer_mode === "string" ? aiConfig.answer_mode : "fixed";
        const usesLlmAnswer = answerMode === "llm" || answerMode === "llm_rag";
        const modules = useMemo(
          () =>
            getBotDialogs(bot)
              .filter((dialog) => dialog.dialogType === 0)
              .sort((left, right) => left.dialogNo - right.dialogNo),
          [bot],
        );

        useEffect(() => {
          setForm(versionSettings.conversationDefaults);
        }, [versionSettings]);

        const modulePickerTitle = useMemo(
          () => (modulePickerTarget ? MODULE_FIELD_LABELS[modulePickerTarget] : "모듈 목록"),
          [modulePickerTarget],
        );

        function updateSection<K extends keyof ConversationDefaultsConfig>(
          key: K,
          nextValue: ConversationDefaultsConfig[K],
        ) {
          setForm((current) => ({
            ...current,
            [key]: nextValue,
          }));
        }

        function updateIntentDetectionField(key: ModuleFieldKey, value: string) {
          updateSection("intentDetection", {
            ...form.intentDetection,
            [key]: value,
          });
        }

        async function handleSave() {
          setSaving(true);
          setErrorMessage("");
          setMessage("");
          try {
            await saveVersionSettings(
              {
                conversationDefaults: form,
              },
              "대화 기본값 설정이 저장되었습니다.",
            );
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : getStudioRuntimeMessage(uiLanguage, "대화 기본값 저장 중 오류가 발생했습니다."));
          } finally {
            setSaving(false);
          }
        }

        const isVoiceBot = bot.data_json?.bot_mode === "voice";

        return (
          <>
            <div className="bot-settings-page__top-actions">
              <Link href={mainHref} className="secondary-action">{getStudioPageLabel(copy,"취소")}</Link>
              <button type="button" className="primary-action" disabled={saving} onClick={handleSave}>
                {saving ? getStudioRuntimeMessage(uiLanguage, "저장 중...") : getStudioRuntimeMessage(uiLanguage, "저장")}
              </button>
            </div>

            <SettingsBlock title={getStudioPageLabel(copy,"기본값 설정")}>
              <div className="settings-defaults-stack">
                <section className="settings-defaults-group settings-defaults-group--panel">
                  <h3>{getStudioPageLabel(copy,"기본 정보")}</h3>
                    <div className="settings-defaults-grid settings-defaults-grid--two">
                      <div className="settings-defaults-field settings-defaults-field--readonly">
                        <FieldLabel title={getStudioPageLabel(copy,"봇 ID")} help={getStudioPageLabel(copy, "봇을 내부적으로 식별하는 고유 ID입니다. 이름과 다르게 중복되지 않으며 저장과 참조의 기준이 됩니다.")} />
                        <strong>{bot.id}</strong>
                      </div>

                      <label className="settings-defaults-field settings-defaults-field--wide-mobile">
                        <FieldLabel title="TTS URL" help={getStudioPageLabel(copy, "보이스봇일 때만 사용하는 설정입니다. Talk 카드의 봇 메시지와 개체 추출 필수 메시지를 읽어줄 TTS 연결 URL을 등록합니다.")} />
                        <input
                          type="text"
                          className="settings-defaults-input"
                          value={form.voice.ttsUrl}
                          disabled={!isVoiceBot}
                          placeholder={isVoiceBot ? getStudioRuntimeMessage(uiLanguage, "등록할 URL을 입력하세요.") : getStudioRuntimeMessage(uiLanguage, "보이스봇일 때만 설정할 수 있습니다.")}
                          onChange={(event) =>
                            updateSection("voice", {
                              ttsUrl: event.target.value,
                            })
                          }
                        />
                      </label>
                  </div>
                </section>

                <div className="settings-defaults-two-column">
                  <section className="settings-defaults-group settings-defaults-group--panel">
                    <h3>{getStudioPageLabel(copy, "NLU 판정 기준")}</h3>
                    <div className="settings-defaults-grid settings-defaults-grid--three">
                      <NumberStepperField
                        title={getStudioPageLabel(copy, "의도파악 Cut-off Score")}
                        help={getStudioPageLabel(copy, "챗봇이 사용자의 질문을 의도로 인정할 최소 기준 점수입니다. ML, Semantic, LLM NLU에서 공통 판정 기준으로 사용합니다.")}
                        value={form.ml.cutOffScore}
                        min={0}
                        max={0.99}
                        step={0.01}
                        onChange={(value) =>
                          updateSection("ml", {
                            ...form.ml,
                            cutOffScore: value,
                          })
                        }
                      />
                      <NumberStepperField
                        title={getStudioPageLabel(copy, "유사의도 Score")}
                        help={getStudioPageLabel(copy, "최상위 의도와 얼마나 비슷하면 유사의도로 볼지 정하는 비율값입니다. ML, Semantic, LLM NLU에서 공통 판정 기준으로 사용합니다.")}
                        value={form.ml.similarIntentScore}
                        min={0}
                        max={0.99}
                        step={0.01}
                        onChange={(value) =>
                          updateSection("ml", {
                            ...form.ml,
                            similarIntentScore: value,
                          })
                        }
                      />
                      <NumberStepperField
                        title={getStudioPageLabel(copy, "의도파악결과 최대개수")}
                        help={getStudioPageLabel(copy, "Cut-off를 넘는 의도나 유사의도가 여러 개일 때 상위 몇 개까지 보여줄지 설정합니다. 다중 의도 버튼과 되묻기 후보 수를 제한하는 값입니다.")}
                        value={form.ml.maxIntentResults}
                        min={1}
                        max={10}
                        onChange={(value) =>
                          updateSection("ml", {
                            ...form.ml,
                            maxIntentResults: value,
                          })
                        }
                      />
                    </div>

                    <div className="settings-defaults-grid settings-defaults-grid--two">
                      <RadioField
                        title={getStudioPageLabel(copy, "Validation Set 상태 설정")}
                        help={getStudioPageLabel(copy, "학습 문장을 training/validation으로 분리하는 방식을 Random 또는 Fixed 중에서 선택합니다.")}
                        value={form.validation.mode}
                        options={[
                          { value: "random", label: "Random" },
                          { value: "fixed", label: "Fixed" },
                        ]}
                        onChange={(value) =>
                          updateSection("validation", {
                            ...form.validation,
                            mode: value as "random" | "fixed",
                          })
                        }
                      />

                      <BinaryRadioField
                        title="Exacting Matching"
                        help={getStudioPageLabel(copy, "사용자 발화가 등록된 학습문장과 완전히 동일하면 Score 계산보다 먼저 해당 의도로 진입할지 설정합니다.")}
                        checked={form.exactingMatching.enabled}
                        onChange={(checked) =>
                          updateSection("exactingMatching", {
                            enabled: checked,
                          })
                        }
                      />

                      <BinaryRadioField
                        title={getStudioPageLabel(copy, "Imbalance Oversampling 설정")}
                        help={getStudioPageLabel(copy, "의도별 학습 문장의 feature를 분석하여 데이터 불균형을 자동 보완한 뒤 학습하는 옵션입니다.")}
                        checked={form.validation.imbalanceOversampling}
                        onChange={(checked) =>
                          updateSection("validation", {
                            ...form.validation,
                            imbalanceOversampling: checked,
                          })
                        }
                      />
                    </div>
                  </section>

                </div>

                <div className="settings-defaults-two-column">
                  <section className="settings-defaults-group settings-defaults-group--panel">
                    <h3>{getStudioPageLabel(copy, "타임아웃")}</h3>
                    <ToggleField
                      title={getStudioPageLabel(copy,"타임아웃 사용")}
                      help={getStudioPageLabel(copy, "버전 단위에서 타임아웃 기능을 사용할지 설정합니다. 세션 타이머 활성화 여부를 결정합니다.")}
                      checked={form.timeout.enabled}
                      onChange={(checked) =>
                        updateSection("timeout", {
                          ...form.timeout,
                          enabled: checked,
                        })
                      }
                    />
                    <div className="settings-defaults-grid settings-defaults-grid--two">
                      <NumberStepperField
                        title={getStudioPageLabel(copy, "타임아웃 시간")}
                        help={getStudioPageLabel(copy, "진행 중 대화에서 사용자 추가 발화가 없을 때 대화를 종료하기 전까지 기다릴 시간을 초 단위로 설정합니다.")}
                        value={form.timeout.seconds}
                        min={1}
                        max={999}
                        onChange={(value) =>
                          updateSection("timeout", {
                            ...form.timeout,
                            seconds: value,
                          })
                        }
                      />
                      <BinaryRadioField
                        title={getStudioPageLabel(copy, "Push Message 타임아웃 적용")}
                        help={getStudioPageLabel(copy, "Push Message로 시작한 대화에도 일반 타임아웃 규칙을 적용할지 설정합니다.")}
                        checked={form.timeout.applyToPushMessage}
                        onChange={(checked) =>
                          updateSection("timeout", {
                            ...form.timeout,
                            applyToPushMessage: checked,
                          })
                        }
                      />
                    </div>
                  </section>

                  <section className="settings-defaults-group settings-defaults-group--panel">
                    <h3>{getStudioPageLabel(copy, "개체 파악")}</h3>
                    <div className="settings-defaults-grid settings-defaults-grid--two">
                      <NumberStepperField
                        title={getStudioPageLabel(copy, "사용자에게 개체를 얻기 위한 질문의 최대 반복 횟수")}
                        help={getStudioPageLabel(copy, "Talk 카드의 최대 반복횟수가 0일 때 사용하는 기본값입니다. 의도 시작 문장에서 필수 변수로 설정된 개체에도 적용됩니다.")}
                        value={form.entityPrompt.maxRepeatCount}
                        min={0}
                        max={10}
                        onChange={(value) =>
                          updateSection("entityPrompt", {
                            maxRepeatCount: value,
                          })
                        }
                      />
                    </div>
                  </section>
                </div>

                <div className="settings-defaults-two-column">
                  <section className="settings-defaults-group settings-defaults-group--panel">
                    <h3>{getStudioPageLabel(copy,"실행 제한")}</h3>
                    <div className="settings-defaults-grid settings-defaults-grid--two">
                      <NumberStepperField
                        title={getStudioPageLabel(copy,"사용자 응답 사이 최대 카드 수")}
                        help={getStudioPageLabel(copy, "사용자 응답을 받은 뒤 다음 사용자 응답을 기다리기 전까지 연속 실행할 수 있는 최대 카드 수입니다. 이 값을 초과하면 루핑으로 보고 시나리오를 중단하며 분석 데이터에 오류를 표시합니다.")}
                        value={form.runtime.maxCardsBetweenUserResponses}
                        min={1}
                        max={1000}
                        onChange={(value) =>
                          updateSection("runtime", {
                            maxCardsBetweenUserResponses: value,
                          })
                        }
                      />
                    </div>
                  </section>
                  <section className="settings-defaults-group settings-defaults-group--panel settings-defaults-group--empty" />
                </div>

                {usesLlmAnswer ? (
                  <section className="settings-defaults-group settings-defaults-group--panel">
                    <h3>{getStudioPageLabel(copy, "LLM 답변")}</h3>
                    <label className="settings-defaults-field settings-defaults-field--wide">
                      <FieldLabel
                        title={getStudioPageLabel(copy,"답변 생성 시스템 프롬프트")}
                        help={getStudioPageLabel(copy, "LLM Engine 답변과 LLM Engine RAG 답변이 답변 문장을 생성할 때 사용하는 기본 지시문입니다. RAG 답변에서는 저장된 문서 밖의 지식을 사용하지 못하도록 시스템이 별도 안전 규칙을 추가합니다.")}
                      />
                      <textarea
                        className="bot-settings-intro__textarea"
                        value={form.llmAnswer.systemPrompt}
                        rows={5}
                        placeholder={getStudioPageLabel(copy,"LLM이 답변을 생성할 때 따라야 할 말투, 형식, 제한사항을 입력하세요.")}
                        onChange={(event) =>
                          updateSection("llmAnswer", {
                            systemPrompt: event.target.value,
                          })
                        }
                      />
                    </label>
                  </section>
                ) : null}

                <div className="settings-defaults-two-column">
                  <section className="settings-defaults-group settings-defaults-group--panel">
                    <h3>{getStudioPageLabel(copy, "의도 파악")}</h3>
                    <div className="settings-defaults-grid settings-defaults-grid--two">
                      <NumberStepperField
                        title={getStudioPageLabel(copy, "의도파악 시도 횟수")}
                        help={getStudioPageLabel(copy, "의도 파악을 연속으로 실패했을 때 몇 번까지 재시도할지 설정합니다.")}
                        value={form.intentDetection.retryCount}
                        min={1}
                        max={10}
                        onChange={(value) =>
                          updateSection("intentDetection", {
                            ...form.intentDetection,
                            retryCount: value,
                          })
                        }
                      />
                      <ModuleField
                        title={getStudioPageLabel(copy, "의도파악 시도 횟수 초과시 실행할 모듈")}
                        help={getStudioPageLabel(copy, "의도 인식 실패가 누적되어 최대 시도 횟수를 넘겼을 때 실행할 모듈을 설정합니다.")}
                        value={form.intentDetection.overflowModule}
                        onOpen={() => setModulePickerTarget("overflowModule")}
                      />
                    </div>
                  </section>

                  <section className="settings-defaults-group settings-defaults-group--panel">
                    <h3>{getStudioPageLabel(copy,"모듈 연결")}</h3>
                    <div className="settings-defaults-grid settings-defaults-grid--one">
                      <ModuleField
                        title={getStudioPageLabel(copy, "전처리 모듈")}
                        help={getStudioPageLabel(copy, "봇과 대화를 시작할 때 가장 먼저 실행할 모듈을 설정합니다.")}
                        value={form.intentDetection.preprocessModule}
                        onOpen={() => setModulePickerTarget("preprocessModule")}
                      />
                      <ModuleField
                        title={getStudioPageLabel(copy, "Session End 전 실행할 모듈")}
                        help={getStudioPageLabel(copy, "봇과 대화를 종료하기 직전에 실행할 모듈을 설정합니다.")}
                        value={form.intentDetection.beforeSessionEndModule}
                        onOpen={() => setModulePickerTarget("beforeSessionEndModule")}
                      />
                      <ModuleField
                        title={getStudioPageLabel(copy, "파악된 의도가 여러 개일 경우 버튼에 추가할 모듈")}
                        help={getStudioPageLabel(copy, "파악된 의도가 여러 개일 때 버튼 목록에 추가로 붙일 모듈을 설정합니다.")}
                        value={form.intentDetection.multiIntentButtonModule}
                        onOpen={() => setModulePickerTarget("multiIntentButtonModule")}
                      />
                    </div>
                  </section>
                </div>

                <section className="settings-defaults-group settings-defaults-group--panel">
                  <h3>{getStudioPageLabel(copy,"고급 설정")}</h3>
                  <div className="settings-defaults-grid settings-defaults-grid--two">
                    <RadioField
                      title={getStudioPageLabel(copy, "버튼 선택 옵션")}
                      help={getStudioPageLabel(copy, "Talk 카드 Button 템플릿 사용 시 버튼명과 완전히 같은 경우만 선택할지, 입력 텍스트에 버튼명이 포함되어도 선택으로 볼지 결정합니다.")}
                      value={form.buttonSelection.option}
                      options={[
                        { value: "contains", label: "Contains" },
                        { value: "exact", label: "Exact" },
                      ]}
                      onChange={(value) =>
                        updateSection("buttonSelection", {
                          option: value as "contains" | "exact",
                        })
                      }
                    />
                  </div>
                </section>
              </div>
            </SettingsBlock>

            <ModulePickerDialog
              open={modulePickerTarget !== null}
              title={modulePickerTitle}
              modules={modules}
              selectedValue={modulePickerTarget ? form.intentDetection[modulePickerTarget] : ""}
              onClose={() => setModulePickerTarget(null)}
              onSelect={(value) => {
                if (modulePickerTarget) {
                  updateIntentDetectionField(modulePickerTarget, value);
                }
              }}
            />
          </>
        );
      }}
    </BotSettingsShell>
  );
}
