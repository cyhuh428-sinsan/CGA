"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { type MessageItemConfig, type MessageSettingsConfig } from "@/lib/bot-settings";
import { BotSettingsShell } from "@/components/bot-settings-shell";
import { getBotDialogs } from "@/lib/dialog-assets";
import { type VersionDialogAsset } from "@/lib/version-document";
import { useI18n } from "@/components/language-provider";
import { getStudioPageLabel, STUDIO_PAGE_CATALOGS } from "@/lib/i18n/studio-pages";

const MESSAGE_HELP: Record<string, string> = {
  "첫 인사말": "사용자와 대화를 시작하면서 전달되는 최초 메시지입니다.",
  "사용자의 의도를 이해하지 못했을 경우 답변":
    "모든 의도의 의도파악 스코어가 Cut-off 이하일 때 사용자에게 보여지는 기본 답변입니다.",
  "의도별 대화 종료시 안내 메시지": "의도가 종료될 때 다음 대화를 위한 안내 메시지입니다.",
  "버튼에 없는 값을 입력했을 경우 제공되는 메시지":
    "사용자가 버튼을 누르지 않고 별도 텍스트를 입력했을 때, 의도 파악 실패 시 보여주는 메시지입니다.",
  "파악된 의도가 여러 개일 경우 안내 메시지":
    "응답 후보가 여러 개일 때 버튼 방식으로 되묻기 전에 보여주는 안내 메시지입니다.",
  "'원하는 의도 없음' 버튼 표시명": "후보 중 원하는 답이 없을 때 사용자가 선택할 버튼명입니다.",
  "'원하는 의도 없음' 선택 시 메시지": "위 버튼을 선택했을 때 보여주는 메시지입니다.",
  "봇 동작 오류시 안내 메시지": "대화 중 시스템 문제 발생 시 사용자에게 보여지는 메시지입니다.",
  "타임아웃 경과시 안내 메시지": "타임아웃 시간 동안 사용자 응답이 없을 때 보여지는 메시지입니다.",
  "Session End 안내 메시지": "세션 종료 후 사용자가 다시 말을 걸었을 때 챗봇이 대답할 메시지입니다.",
  "대화가 진행 중인 경우 안내 메시지": "이미 대화가 진행 중일 때 보여주는 안내 메시지입니다.",
  "의도 전환시도가 최대횟수를 초과했을 때 안내 메시지": "의도 전환 최대 횟수를 초과했을 때 보여지는 메시지입니다.",
  "의도 전환 의사 질문 메시지 (의도명 전)": "전환될 의도명 앞에 붙는 메시지입니다.",
  "의도 전환 의사 질문 메시지 (의도명 후)": "전환될 의도명 뒤에 붙는 메시지입니다.",
  "실행 유형": "의도 복귀 시 사용자에게 물어보는 메시지를 사용할지 선택합니다.",
  "의도 복귀 실행 메시지": "의도 복귀 실행 시 보여지는 메시지입니다.",
  "의도별 피드백을 묻기위해 출력되는 메시지": "피드백 수집 전에 사용자에게 보여줄 질문 메시지입니다.",
};

const MESSAGE_TEXT_MAX_LENGTH = 100;

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

function MessageItemEditor({
  title,
  help,
  value,
  onChange,
  onOpenModulePicker,
}: {
  title: string;
  help?: string;
  value: MessageItemConfig;
  onChange: (nextValue: MessageItemConfig) => void;
  onOpenModulePicker: (title: string, currentValue: string, onSelect: (value: string) => void) => void;
}) {
  const { language } = useI18n();
  const copy = STUDIO_PAGE_CATALOGS[language];

  return (
    <div className="settings-message-item">
      <div className="settings-message-item__header">
        <strong>
          <FieldLabel title={title} help={help} />
        </strong>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(event) =>
              onChange({
                ...value,
                enabled: event.target.checked,
              })
            }
          />
          <span>{getStudioPageLabel(copy, "사용")}</span>
        </label>
      </div>

      <div className="settings-message-item__content">
        <div className="settings-message-item__mode-row">
          <label className="settings-choice-option">
            <input
              type="radio"
              checked={value.mode === "text"}
              onChange={() =>
                onChange({
                  ...value,
                  mode: "text",
                })
              }
            />
            <span>{getStudioPageLabel(copy, "메시지")}</span>
          </label>
          <label className="settings-choice-option">
            <input
              type="radio"
              checked={value.mode === "module"}
              onChange={() =>
                onChange({
                  ...value,
                  mode: "module",
                })
              }
            />
            <span>{getStudioPageLabel(copy, "모듈 연결")}</span>
          </label>
        </div>

        {value.mode === "text" ? (
          <label className="settings-message-item__value">
            <textarea
              className="bot-settings-intro__textarea settings-message-item__textarea"
              rows={2}
              maxLength={MESSAGE_TEXT_MAX_LENGTH}
              value={value.value}
              onChange={(event) =>
                onChange({
                  ...value,
                  value: event.target.value,
                })
              }
            />
            <small className="settings-message-item__count">
              {value.value.length}/{MESSAGE_TEXT_MAX_LENGTH}
            </small>
          </label>
        ) : (
          <div className="settings-message-item__value">
            <div className="settings-module-field">
              <input
                type="text"
                readOnly
                className="settings-module-field__input"
                value={value.value}
                placeholder={getStudioPageLabel(copy, "우측 버튼을 클릭해 연결할 모듈을 선택하세요.")}
              />
              <button
                type="button"
                className="secondary-action settings-module-field__button"
                onClick={() =>
                  onOpenModulePicker(title, value.value, (selectedValue) =>
                    onChange({
                      ...value,
                      value: selectedValue,
                    })
                  )
                }
              >
                모듈 목록
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageSection({
  title,
  description,
  children,
  defaultOpen = false,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="settings-accordion" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="settings-accordion__body">
        {description ? <div className="settings-message-section__description">{description}</div> : null}
        {children}
      </div>
    </details>
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

export function ConversationMessageSettingsPage() {
  const { language: uiLanguage } = useI18n();
  const copy = STUDIO_PAGE_CATALOGS[uiLanguage];
  return (
    <BotSettingsShell activeMenu="messages">
      {({ bot, mainHref, versionSettings, saveVersionSettings, setErrorMessage, setMessage }) => {
        const [form, setForm] = useState<MessageSettingsConfig>(versionSettings.messages);
        const [saving, setSaving] = useState(false);
        const [modulePicker, setModulePicker] = useState<{
          title: string;
          selectedValue: string;
          apply: (value: string) => void;
        } | null>(null);
        const modules = useMemo(
          () =>
            getBotDialogs(bot)
              .filter((dialog) => dialog.dialogType === 0)
              .sort((left, right) => left.dialogNo - right.dialogNo),
          [bot],
        );

        useEffect(() => {
          setForm(versionSettings.messages);
        }, [versionSettings]);

        async function handleSave() {
          setSaving(true);
          setErrorMessage("");
          setMessage("");
          try {
            await saveVersionSettings(
              {
                messages: form,
              },
              "대화 메시지 설정이 저장되었습니다.",
            );
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "대화 메시지 저장 중 오류가 발생했습니다.");
          } finally {
            setSaving(false);
          }
        }

        return (
          <>
            <div className="bot-settings-page__top-actions">
              <Link href={mainHref} className="secondary-action">{getStudioPageLabel(copy,"취소")}</Link>
              <button type="button" className="primary-action" disabled={saving} onClick={handleSave}>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>

            <MessageSection
              title={getStudioPageLabel(copy,"기본 메시지(4)")}
              description={getStudioPageLabel(copy, "대화 시작, 의도 미인식, 의도 종료, 버튼 불일치 등 기본 흐름에서 공통으로 사용하는 메시지를 설정합니다.")}
              defaultOpen
            >
              <div className="settings-message-grid settings-message-grid--two">
                <MessageItemEditor
                  title={getStudioPageLabel(copy,"첫 인사말")}
                  help={MESSAGE_HELP["첫 인사말"]}
                  value={form.greeting}
                  onChange={(nextValue) => setForm((current) => ({ ...current, greeting: nextValue }))}
                  onOpenModulePicker={(title, currentValue, apply) =>
                    setModulePicker({ title, selectedValue: currentValue, apply })
                  }
                />
                <MessageItemEditor
                  title={getStudioPageLabel(copy,"사용자의 의도를 이해하지 못했을 경우 답변")}
                  help={MESSAGE_HELP["사용자의 의도를 이해하지 못했을 경우 답변"]}
                  value={form.fallback}
                  onChange={(nextValue) => setForm((current) => ({ ...current, fallback: nextValue }))}
                  onOpenModulePicker={(title, currentValue, apply) =>
                    setModulePicker({ title, selectedValue: currentValue, apply })
                  }
                />
                <MessageItemEditor
                  title={getStudioPageLabel(copy, "의도별 대화 종료시 안내 메시지")}
                  help={MESSAGE_HELP["의도별 대화 종료시 안내 메시지"]}
                  value={form.intentEndGuide}
                  onChange={(nextValue) => setForm((current) => ({ ...current, intentEndGuide: nextValue }))}
                  onOpenModulePicker={(title, currentValue, apply) =>
                    setModulePicker({ title, selectedValue: currentValue, apply })
                  }
                />
                <MessageItemEditor
                  title={getStudioPageLabel(copy, "버튼에 없는 값을 입력했을 경우 제공되는 메시지")}
                  help={MESSAGE_HELP["버튼에 없는 값을 입력했을 경우 제공되는 메시지"]}
                  value={form.buttonMismatch}
                  onChange={(nextValue) => setForm((current) => ({ ...current, buttonMismatch: nextValue }))}
                  onOpenModulePicker={(title, currentValue, apply) =>
                    setModulePicker({ title, selectedValue: currentValue, apply })
                  }
                />
              </div>
            </MessageSection>

            <MessageSection
              title={getStudioPageLabel(copy,"유사의도/되묻기(2)")}
              description={getStudioPageLabel(copy, "유사 의도가 여러 개 잡혔을 때 사용자에게 보여줄 안내 문구와 '원하는 의도 없음' 처리 메시지를 설정합니다.")}
            >
              <div className="settings-message-grid settings-message-grid--two">
                <div className="settings-message-item">
                  <div className="settings-message-item__header">
                    <strong>
                      <FieldLabel
                        title={getStudioPageLabel(copy, "파악된 의도가 여러 개일 경우 안내 메시지")}
                        help={MESSAGE_HELP["파악된 의도가 여러 개일 경우 안내 메시지"]}
                      />
                    </strong>
                    <label className="settings-toggle">
                      <input
                        type="checkbox"
                        checked={form.multiIntentGuide.enabled}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            multiIntentGuide: {
                              ...current.multiIntentGuide,
                              enabled: event.target.checked,
                            },
                          }))
                        }
                      />
                      <span>{getStudioPageLabel(copy,"사용")}</span>
                    </label>
                  </div>

                  <div className="settings-message-item__content">
                    <label className="settings-message-item__value">
                      <textarea
                        className="bot-settings-intro__textarea settings-message-item__textarea"
                        maxLength={MESSAGE_TEXT_MAX_LENGTH}
                        value={form.multiIntentGuide.message}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            multiIntentGuide: {
                              ...current.multiIntentGuide,
                              message: event.target.value,
                            },
                          }))
                        }
                      />
                      <small className="settings-message-item__count">
                        {form.multiIntentGuide.message.length}/{MESSAGE_TEXT_MAX_LENGTH}
                      </small>
                    </label>
                  </div>
                </div>

                <div className="settings-message-item">
                  <div className="settings-message-item__header">
                    <strong>
                      <FieldLabel
                        title={getStudioPageLabel(copy, "'원하는 의도 없음' 버튼/메시지")}
                        help={getStudioPageLabel(copy, "후보 중 원하는 의도가 없을 때 표시할 버튼명과 선택 후 보여줄 메시지를 설정합니다.")}
                      />
                    </strong>
                  </div>

                  <div className="settings-form-grid settings-form-grid--compact">
                    <label className="settings-form-card">
                      <FieldLabel title={getStudioPageLabel(copy, "'원하는 의도 없음' 버튼 표시명")} help={MESSAGE_HELP["'원하는 의도 없음' 버튼 표시명"]} />
                      <input
                        type="text"
                        className="bot-settings-card__input"
                        value={form.multiIntentGuide.noIntentButtonLabel}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            multiIntentGuide: {
                              ...current.multiIntentGuide,
                              noIntentButtonLabel: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>

                    <label className="settings-form-card settings-form-card--wide">
                      <FieldLabel title={getStudioPageLabel(copy, "'원하는 의도 없음' 선택 시 메시지")} help={MESSAGE_HELP["'원하는 의도 없음' 선택 시 메시지"]} />
                      <textarea
                        className="bot-settings-intro__textarea"
                        value={form.multiIntentGuide.noIntentButtonMessage}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            multiIntentGuide: {
                              ...current.multiIntentGuide,
                              noIntentButtonMessage: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>
              </div>
            </MessageSection>

            <MessageSection
              title={getStudioPageLabel(copy,"대화 종료(4)")}
              description={getStudioPageLabel(copy, "대화중 시스템에 문제가 생겼거나 사용자의 마지막 발화 이후 타임아웃 설정 시간동안 아무런 응답이 없었을 경우 대화가 자동으로 종료됩니다. 사용자에게 대화가 종료된 상황을 안내하기 위한 메시지도 설정해 주세요.")}
            >
              <div className="settings-message-grid settings-message-grid--two">
                <MessageItemEditor
                  title={getStudioPageLabel(copy,"봇 동작 오류시 안내 메시지")}
                  help={MESSAGE_HELP["봇 동작 오류시 안내 메시지"]}
                  value={form.system.errorMessage}
                  onChange={(nextValue) =>
                    setForm((current) => ({
                      ...current,
                      system: {
                        ...current.system,
                        errorMessage: nextValue,
                      },
                    }))
                  }
                  onOpenModulePicker={(title, currentValue, apply) =>
                    setModulePicker({ title, selectedValue: currentValue, apply })
                  }
                />
                <MessageItemEditor
                  title={getStudioPageLabel(copy, "타임아웃 경과시 안내 메시지")}
                  help={MESSAGE_HELP["타임아웃 경과시 안내 메시지"]}
                  value={form.system.timeoutMessage}
                  onChange={(nextValue) =>
                    setForm((current) => ({
                      ...current,
                      system: {
                        ...current.system,
                        timeoutMessage: nextValue,
                      },
                    }))
                  }
                  onOpenModulePicker={(title, currentValue, apply) =>
                    setModulePicker({ title, selectedValue: currentValue, apply })
                  }
                />
                <MessageItemEditor
                  title={getStudioPageLabel(copy,"Session End 안내 메시지")}
                  help={MESSAGE_HELP["Session End 안내 메시지"]}
                  value={form.system.sessionEndMessage}
                  onChange={(nextValue) =>
                    setForm((current) => ({
                      ...current,
                      system: {
                        ...current.system,
                        sessionEndMessage: nextValue,
                      },
                    }))
                  }
                  onOpenModulePicker={(title, currentValue, apply) =>
                    setModulePicker({ title, selectedValue: currentValue, apply })
                  }
                />
                <MessageItemEditor
                  title={getStudioPageLabel(copy, "대화가 진행 중인 경우 안내 메시지")}
                  help={MESSAGE_HELP["대화가 진행 중인 경우 안내 메시지"]}
                  value={form.system.inProgressMessage}
                  onChange={(nextValue) =>
                    setForm((current) => ({
                      ...current,
                      system: {
                        ...current.system,
                        inProgressMessage: nextValue,
                      },
                    }))
                  }
                  onOpenModulePicker={(title, currentValue, apply) =>
                    setModulePicker({ title, selectedValue: currentValue, apply })
                  }
                />
              </div>
            </MessageSection>

            <MessageSection
              title={getStudioPageLabel(copy,"의도 전환/복귀(3)")}
              description={getStudioPageLabel(copy, "의도 전환 실패, 의도 전환 질문, 의도 복귀 실행 여부와 메시지를 설정합니다.")}
            >
              <div className="settings-message-grid settings-message-grid--two">
                <div className="settings-message-item">
                  <div className="settings-message-item__header">
                    <strong>
                      <FieldLabel
                        title={getStudioPageLabel(copy, "의도 전환시도가 최대횟수를 초과했을 때 안내 메시지")}
                        help={MESSAGE_HELP["의도 전환시도가 최대횟수를 초과했을 때 안내 메시지"]}
                      />
                    </strong>
                  </div>
                  <div className="settings-message-item__content">
                    <label className="settings-message-item__value">
                      <textarea
                        className="bot-settings-intro__textarea settings-message-item__textarea"
                        maxLength={MESSAGE_TEXT_MAX_LENGTH}
                        value={form.intentSwitch.maxExceededMessage}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            intentSwitch: {
                              ...current.intentSwitch,
                              maxExceededMessage: event.target.value,
                            },
                          }))
                        }
                      />
                      <small className="settings-message-item__count">
                        {form.intentSwitch.maxExceededMessage.length}/{MESSAGE_TEXT_MAX_LENGTH}
                      </small>
                    </label>
                  </div>
                </div>

                <div className="settings-message-item">
                  <div className="settings-message-item__header">
                    <strong>
                      <FieldLabel title={getStudioPageLabel(copy, "의도 전환 의사 질문 메시지")} help={getStudioPageLabel(copy, "전환될 의도명 앞/뒤에 붙는 문구를 설정합니다.")} />
                    </strong>
                  </div>
                  <div className="settings-form-grid settings-form-grid--compact">
                    <label className="settings-form-card">
                      <FieldLabel title={getStudioPageLabel(copy, "의도명 전")} help={MESSAGE_HELP["의도 전환 의사 질문 메시지 (의도명 전)"]} />
                      <input
                        type="text"
                        className="bot-settings-card__input"
                        value={form.intentSwitch.beforeIntentNameMessage}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            intentSwitch: {
                              ...current.intentSwitch,
                              beforeIntentNameMessage: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>

                    <label className="settings-form-card">
                      <FieldLabel title={getStudioPageLabel(copy, "의도명 후")} help={MESSAGE_HELP["의도 전환 의사 질문 메시지 (의도명 후)"]} />
                      <input
                        type="text"
                        className="bot-settings-card__input"
                        value={form.intentSwitch.afterIntentNameMessage}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            intentSwitch: {
                              ...current.intentSwitch,
                              afterIntentNameMessage: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>

                <div className="settings-message-item">
                  <div className="settings-message-item__header">
                    <strong>
                      <FieldLabel title={getStudioPageLabel(copy, "의도 복귀 실행 메시지")} help={MESSAGE_HELP["의도 복귀 실행 메시지"]} />
                    </strong>
                  </div>
                  <div className="settings-message-item__content">
                    <div className="settings-message-item__mode-row">
                      <label className="settings-choice-option">
                        <input
                          type="radio"
                          checked={!form.intentReturn.enabled}
                          onChange={() =>
                            setForm((current) => ({
                              ...current,
                              intentReturn: {
                                ...current.intentReturn,
                                enabled: false,
                              },
                            }))
                          }
                        />
                        <span>{getStudioPageLabel(copy,"미사용")}</span>
                      </label>
                      <label className="settings-choice-option">
                        <input
                          type="radio"
                          checked={form.intentReturn.enabled}
                          onChange={() =>
                            setForm((current) => ({
                              ...current,
                              intentReturn: {
                                ...current.intentReturn,
                                enabled: true,
                              },
                            }))
                          }
                        />
                        <span>{getStudioPageLabel(copy,"사용")}</span>
                      </label>
                    </div>

                    <label className="settings-message-item__value">
                      <span>
                        <FieldLabel
                          title={getStudioPageLabel(copy, "의도별 피드백을 묻기위해 출력되는 메시지")}
                          help={MESSAGE_HELP["의도별 피드백을 묻기위해 출력되는 메시지"]}
                        />
                      </span>
                      <textarea
                        className="bot-settings-intro__textarea settings-message-item__textarea"
                        maxLength={MESSAGE_TEXT_MAX_LENGTH}
                        value={form.intentReturn.message}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            intentReturn: {
                              ...current.intentReturn,
                              message: event.target.value,
                            },
                          }))
                        }
                      />
                      <small className="settings-message-item__count">
                        {form.intentReturn.message.length}/{MESSAGE_TEXT_MAX_LENGTH}
                      </small>
                    </label>
                  </div>
                </div>
              </div>
            </MessageSection>

            <MessageSection
              title={getStudioPageLabel(copy, "대기업무 메시지")}
              description={getStudioPageLabel(copy, "병렬로 처리할 다른 업무가 생겼을 때 사용자에게 보여줄 안내 문구와 강제 전환 메시지를 설정합니다.")}
            >
              <div className="settings-message-grid settings-message-grid--two">
                <div className="settings-message-item">
                  <div className="settings-message-item__header">
                    <strong>
                      <FieldLabel title={getStudioPageLabel(copy, "대기업무가 발생한 경우 사용자에게 제시할 첫 메시지")} />
                    </strong>
                  </div>
                  <div className="settings-message-item__content">
                    <label className="settings-message-item__value">
                      <textarea
                        className="bot-settings-intro__textarea settings-message-item__textarea"
                        maxLength={MESSAGE_TEXT_MAX_LENGTH}
                        value={form.parallelWork.firstMessage}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            parallelWork: {
                              ...current.parallelWork,
                              firstMessage: event.target.value,
                            },
                          }))
                        }
                      />
                      <small className="settings-message-item__count">
                        {form.parallelWork.firstMessage.length}/{MESSAGE_TEXT_MAX_LENGTH}
                      </small>
                    </label>
                  </div>
                </div>

                <div className="settings-message-item">
                  <div className="settings-message-item__header">
                    <strong>
                      <FieldLabel title={getStudioPageLabel(copy, "'대기업무를 처리하지 않음' 버튼/메시지")} />
                    </strong>
                  </div>
                  <div className="settings-form-grid settings-form-grid--compact">
                    <label className="settings-form-card">
                      <span>{getStudioPageLabel(copy,"버튼 표시명")}</span>
                      <input
                        type="text"
                        maxLength={100}
                        className="bot-settings-card__input"
                        value={form.parallelWork.skipButtonLabel}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            parallelWork: {
                              ...current.parallelWork,
                              skipButtonLabel: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>

                    <label className="settings-message-item__value settings-form-card--wide">
                      <span>{getStudioPageLabel(copy,"선택 시 메시지")}</span>
                      <textarea
                        className="bot-settings-intro__textarea settings-message-item__textarea"
                        maxLength={MESSAGE_TEXT_MAX_LENGTH}
                        value={form.parallelWork.skipButtonMessage}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            parallelWork: {
                              ...current.parallelWork,
                              skipButtonMessage: event.target.value,
                            },
                          }))
                        }
                      />
                      <small className="settings-message-item__count">
                        {form.parallelWork.skipButtonMessage.length}/{MESSAGE_TEXT_MAX_LENGTH}
                      </small>
                    </label>
                  </div>
                </div>

                <div className="settings-message-item">
                  <div className="settings-message-item__header">
                    <strong>
                      <FieldLabel title={getStudioPageLabel(copy, "우선순위가 높은 대기업무 강제 실행 메시지")} />
                    </strong>
                  </div>
                  <div className="settings-message-item__content">
                    <label className="settings-message-item__value">
                      <textarea
                        className="bot-settings-intro__textarea settings-message-item__textarea"
                        maxLength={MESSAGE_TEXT_MAX_LENGTH}
                        value={form.parallelWork.forcedPriorityMessage}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            parallelWork: {
                              ...current.parallelWork,
                              forcedPriorityMessage: event.target.value,
                            },
                          }))
                        }
                      />
                      <small className="settings-message-item__count">
                        {form.parallelWork.forcedPriorityMessage.length}/{MESSAGE_TEXT_MAX_LENGTH}
                      </small>
                    </label>
                  </div>
                </div>

                <div className="settings-message-item">
                  <div className="settings-message-item__header">
                    <strong>
                      <FieldLabel title={getStudioPageLabel(copy, "진행중인 업무 강제 종료 메시지")} />
                    </strong>
                  </div>
                  <div className="settings-message-item__content">
                    <label className="settings-message-item__value">
                      <textarea
                        className="bot-settings-intro__textarea settings-message-item__textarea"
                        maxLength={MESSAGE_TEXT_MAX_LENGTH}
                        value={form.parallelWork.forcedCloseMessage}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            parallelWork: {
                              ...current.parallelWork,
                              forcedCloseMessage: event.target.value,
                            },
                          }))
                        }
                      />
                      <small className="settings-message-item__count">
                        {form.parallelWork.forcedCloseMessage.length}/{MESSAGE_TEXT_MAX_LENGTH}
                      </small>
                    </label>
                  </div>
                </div>
              </div>
            </MessageSection>

            <MessageSection
              title={getStudioPageLabel(copy, "피드백 수집")}
              description={getStudioPageLabel(copy, "답변 후 사용자 만족도를 묻는 방식과 척도 표시 문구를 설정합니다.")}
            >
              <div className="settings-message-grid settings-message-grid--two">
                <div className="settings-message-item">
                  <div className="settings-message-item__header">
                    <strong>
                      <FieldLabel title={getStudioPageLabel(copy, "사용 유형")} help={getStudioPageLabel(copy, "피드백을 사용하지 않거나, 모든 의도 또는 특정 의도에만 피드백을 받을지 선택합니다.")} />
                    </strong>
                  </div>
                  <div className="settings-message-item__content">
                    <div className="settings-message-item__mode-row">
                      <label className="settings-choice-option">
                        <input
                          type="radio"
                          checked={form.feedback.mode === "none"}
                          onChange={() =>
                            setForm((current) => ({
                              ...current,
                              feedback: {
                                ...current.feedback,
                                mode: "none",
                              },
                            }))
                          }
                        />
                        <span>{getStudioPageLabel(copy,"사용 안함")}</span>
                      </label>
                      <label className="settings-choice-option">
                        <input
                          type="radio"
                          checked={form.feedback.mode === "all"}
                          onChange={() =>
                            setForm((current) => ({
                              ...current,
                              feedback: {
                                ...current.feedback,
                                mode: "all",
                              },
                            }))
                          }
                        />
                        <span>{getStudioPageLabel(copy,"모든 의도 사용")}</span>
                      </label>
                      <label className="settings-choice-option">
                        <input
                          type="radio"
                          checked={form.feedback.mode === "per-intent"}
                          onChange={() =>
                            setForm((current) => ({
                              ...current,
                              feedback: {
                                ...current.feedback,
                                mode: "per-intent",
                              },
                            }))
                          }
                        />
                        <span>{getStudioPageLabel(copy,"의도별 사용")}</span>
                      </label>
                    </div>

                    <label className="settings-message-item__value">
                      <textarea
                        className="bot-settings-intro__textarea settings-message-item__textarea"
                        maxLength={MESSAGE_TEXT_MAX_LENGTH}
                        value={form.feedback.promptMessage}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            feedback: {
                              ...current.feedback,
                              promptMessage: event.target.value,
                            },
                          }))
                        }
                      />
                      <small className="settings-message-item__count">
                        {form.feedback.promptMessage.length}/{MESSAGE_TEXT_MAX_LENGTH}
                      </small>
                    </label>
                  </div>
                </div>

                <div className="settings-message-item">
                  <div className="settings-message-item__header">
                    <strong>
                      <FieldLabel title={getStudioPageLabel(copy, "의도별 피드백 척도")} help={getStudioPageLabel(copy, "2점 또는 5점 척도를 선택하고, 각 점수에 표시할 문구를 수정합니다.")} />
                    </strong>
                  </div>

                  <div className="settings-message-item__content">
                    <div className="settings-message-item__mode-row">
                      <label className="settings-choice-option">
                        <input
                          type="radio"
                          checked={form.feedback.scale === "binary"}
                          onChange={() =>
                            setForm((current) => ({
                              ...current,
                              feedback: {
                                ...current.feedback,
                                scale: "binary",
                              },
                            }))
                          }
                        />
                        <span>{getStudioPageLabel(copy, "2점")}</span>
                      </label>
                      <label className="settings-choice-option">
                        <input
                          type="radio"
                          checked={form.feedback.scale === "five-point"}
                          onChange={() =>
                            setForm((current) => ({
                              ...current,
                              feedback: {
                                ...current.feedback,
                                scale: "five-point",
                              },
                            }))
                          }
                        />
                        <span>{getStudioPageLabel(copy, "5점")}</span>
                      </label>
                    </div>

                    <div
                      className={`settings-feedback-scale-grid ${
                        form.feedback.scale === "binary"
                          ? "settings-feedback-scale-grid--binary"
                          : "settings-feedback-scale-grid--five"
                      }`}
                    >
                      {(
                        form.feedback.scale === "binary"
                          ? ([
                              ["one", "1항목"],
                              ["two", "2항목"],
                            ] as const)
                          : ([
                              ["one", "1점"],
                              ["two", "2점"],
                              ["three", "3점"],
                              ["four", "4점"],
                              ["five", "5점"],
                            ] as const)
                      ).map(([key, label]) => (
                        <label key={key} className="settings-message-item__value">
                          <span>{label}</span>
                          <input
                            type="text"
                            maxLength={100}
                            className="bot-settings-card__input settings-feedback-scale-input"
                            value={form.feedback.scaleLabels[key]}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                feedback: {
                                  ...current.feedback,
                                  scaleLabels: {
                                    ...current.feedback.scaleLabels,
                                    [key]: event.target.value,
                                  },
                                },
                              }))
                            }
                          />
                          <small className="settings-message-item__count">
                            {form.feedback.scaleLabels[key].length}/100
                          </small>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </MessageSection>

            <ModulePickerDialog
              open={modulePicker !== null}
              title={modulePicker?.title ?? "모듈 목록"}
              modules={modules}
              selectedValue={modulePicker?.selectedValue ?? ""}
              onClose={() => setModulePicker(null)}
              onSelect={(value) => {
                modulePicker?.apply(value);
                setModulePicker(null);
              }}
            />
          </>
        );
      }}
    </BotSettingsShell>
  );
}
