"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { type FloatingButtonConfig, type RecommendedIntentConfig } from "@/lib/bot-settings";
import { BotSettingsShell } from "@/components/bot-settings-shell";
import { getBotDialogs } from "@/lib/dialog-assets";

function createEmptyFloatingButton(): FloatingButtonConfig {
  return {
    id: crypto.randomUUID(),
    label: "",
    actionType: "key",
    actionValue: "",
    enabled: true,
  };
}

type MessengerTab = "floating-buttons" | "recommended-intents";
type IntentOption = { id: string; label: string };

function createRecommendedIntent(intentId: string, intentOptions: IntentOption[]): RecommendedIntentConfig {
  const option = intentOptions.find((item) => item.id === intentId);
  return {
    id: crypto.randomUUID(),
    intentId,
    label: option?.label ?? intentId,
  };
}

export function MessengerSettingsPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "recommended-intents" ? "recommended-intents" : "floating-buttons";

  return (
    <BotSettingsShell activeMenu="messenger">
      {({ bot, versionSettings, saveVersionSettings, setErrorMessage, setMessage }) => {
        const [floatingButtons, setFloatingButtons] = useState<FloatingButtonConfig[]>(versionSettings.floatingButtons);
        const [selectedButtonId, setSelectedButtonId] = useState<string | null>(
          versionSettings.floatingButtons[0]?.id ?? null,
        );
        const [editingButton, setEditingButton] = useState<FloatingButtonConfig>(createEmptyFloatingButton());
        const [buttonEditorOpen, setButtonEditorOpen] = useState(false);
        const [activeTab, setActiveTab] = useState<MessengerTab>(initialTab);
        const intentOptions = useMemo(
          () =>
            getBotDialogs(bot)
              .filter((dialog) => dialog.dialogType === 1)
              .sort((left, right) => left.dialogNo - right.dialogNo)
              .map((dialog) => ({
                id: dialog.id,
                label: dialog.name || dialog.displayName || dialog.dialogKey,
              })),
          [bot],
        );
        const firstIntentId = intentOptions[0]?.id ?? "";
        const [recommendedIntents, setRecommendedIntents] = useState<RecommendedIntentConfig[]>(
          versionSettings.recommendedIntents,
        );
        const [selectedIntentConfigId, setSelectedIntentConfigId] = useState<string | null>(
          versionSettings.recommendedIntents[0]?.id ?? null,
        );
        const [newIntentId, setNewIntentId] = useState(firstIntentId);
        const [saving, setSaving] = useState(false);

        useEffect(() => {
          setActiveTab(initialTab);
        }, [initialTab]);

        useEffect(() => {
          setFloatingButtons(versionSettings.floatingButtons);
          setSelectedButtonId(versionSettings.floatingButtons[0]?.id ?? null);
          setEditingButton(versionSettings.floatingButtons[0] ?? createEmptyFloatingButton());
          setRecommendedIntents(versionSettings.recommendedIntents);
          setSelectedIntentConfigId(versionSettings.recommendedIntents[0]?.id ?? null);
          setButtonEditorOpen(false);
        }, [versionSettings]);

        useEffect(() => {
          if (!intentOptions.some((option) => option.id === newIntentId)) {
            setNewIntentId(firstIntentId);
          }
        }, [firstIntentId, intentOptions, newIntentId]);

        const canMoveButtonUp = useMemo(
          () => floatingButtons.findIndex((item) => item.id === selectedButtonId) > 0,
          [floatingButtons, selectedButtonId],
        );
        const canMoveButtonDown = useMemo(() => {
          const index = floatingButtons.findIndex((item) => item.id === selectedButtonId);
          return index !== -1 && index < floatingButtons.length - 1;
        }, [floatingButtons, selectedButtonId]);
        const canMoveIntentUp = useMemo(
          () => recommendedIntents.findIndex((item) => item.id === selectedIntentConfigId) > 0,
          [recommendedIntents, selectedIntentConfigId],
        );
        const canMoveIntentDown = useMemo(() => {
          const index = recommendedIntents.findIndex((item) => item.id === selectedIntentConfigId);
          return index !== -1 && index < recommendedIntents.length - 1;
        }, [recommendedIntents, selectedIntentConfigId]);

        async function persistMessengerSettings(
          nextFloatingButtons: FloatingButtonConfig[],
          nextRecommendedIntents: RecommendedIntentConfig[],
          successMessage: string,
        ) {
          setSaving(true);
          setErrorMessage("");
          setMessage("");
          try {
            await saveVersionSettings(
              {
                floatingButtons: nextFloatingButtons,
                recommendedIntents: nextRecommendedIntents,
              },
              successMessage,
            );
            setFloatingButtons(nextFloatingButtons);
            setRecommendedIntents(nextRecommendedIntents);
            return true;
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "메신저 편의 기능 저장 중 오류가 발생했습니다.");
            return false;
          } finally {
            setSaving(false);
          }
        }

        async function moveFloatingButton(direction: -1 | 1) {
          if (!selectedButtonId) {
            return;
          }
          const index = floatingButtons.findIndex((item) => item.id === selectedButtonId);
          if (index === -1) {
            return;
          }
          const targetIndex = index + direction;
          if (targetIndex < 0 || targetIndex >= floatingButtons.length) {
            return;
          }
          const next = [...floatingButtons];
          const [moved] = next.splice(index, 1);
          next.splice(targetIndex, 0, moved);
          await persistMessengerSettings(next, recommendedIntents, "플로팅 버튼 순서가 저장되었습니다.");
        }

        function handleCreateFloatingButton() {
          const nextItem = createEmptyFloatingButton();
          setEditingButton(nextItem);
          setSelectedButtonId(nextItem.id);
          setButtonEditorOpen(true);
        }

        function handleSelectFloatingButton(item: FloatingButtonConfig) {
          setSelectedButtonId(item.id);
          setEditingButton(item);
          setButtonEditorOpen(true);
        }

        async function handleSaveFloatingButtonToList() {
          if (!editingButton.label.trim() || !editingButton.actionValue.trim()) {
            setErrorMessage("버튼명과 Key/Command 값을 입력해주세요.");
            return;
          }

          setErrorMessage("");
          const currentIndex = floatingButtons.findIndex((item) => item.id === editingButton.id);
          const nextButtons =
            currentIndex === -1
              ? [...floatingButtons, editingButton]
              : floatingButtons.map((item, index) => (index === currentIndex ? editingButton : item));
          const saved = await persistMessengerSettings(nextButtons, recommendedIntents, "메신저 편의 기능 설정이 저장되었습니다.");
          if (!saved) {
            return;
          }
          setSelectedButtonId(editingButton.id);
          setButtonEditorOpen(false);
        }

        async function toggleFloatingButtonEnabled(item: FloatingButtonConfig) {
          const nextButtons = floatingButtons.map((currentItem) =>
            currentItem.id === item.id ? { ...currentItem, enabled: !currentItem.enabled } : currentItem,
          );
          await persistMessengerSettings(nextButtons, recommendedIntents, "메신저 편의 기능 설정이 저장되었습니다.");
        }

        async function moveRecommendedIntent(direction: -1 | 1) {
          if (!selectedIntentConfigId) {
            return;
          }
          const index = recommendedIntents.findIndex((item) => item.id === selectedIntentConfigId);
          if (index === -1) {
            return;
          }
          const targetIndex = index + direction;
          if (targetIndex < 0 || targetIndex >= recommendedIntents.length) {
            return;
          }
          const next = [...recommendedIntents];
          const [moved] = next.splice(index, 1);
          next.splice(targetIndex, 0, moved);
          await persistMessengerSettings(floatingButtons, next, "추천 의도 순서가 저장되었습니다.");
        }

        async function handleAddRecommendedIntent() {
          if (!newIntentId) {
            return;
          }
          const nextItem = createRecommendedIntent(newIntentId, intentOptions);
          const nextIntents = [...recommendedIntents, nextItem];
          const saved = await persistMessengerSettings(floatingButtons, nextIntents, "추천 의도 구성이 저장되었습니다.");
          if (!saved) {
            return;
          }
          setSelectedIntentConfigId(nextItem.id);
        }

        return (
          <>
            <section className="bot-settings-section messenger-settings-section">
              <h2>메신저 편의 기능</h2>

              <div className="messenger-settings__tabs" role="tablist" aria-label="메신저 편의 기능 탭">
                <button
                  type="button"
                  className={`messenger-settings__tab${activeTab === "floating-buttons" ? " is-active" : ""}`}
                  onClick={() => setActiveTab("floating-buttons")}
                >
                  플로팅 버튼
                </button>
                <button
                  type="button"
                  className={`messenger-settings__tab${activeTab === "recommended-intents" ? " is-active" : ""}`}
                  onClick={() => setActiveTab("recommended-intents")}
                >
                  추천 의도
                </button>
              </div>

              {activeTab === "floating-buttons" ? (
                <>
                  <div className="settings-toolbar settings-toolbar--between">
                    <div className="settings-toolbar__spacer" />
                    <div className="settings-toolbar__group">
                    <button
                      type="button"
                      className="secondary-action"
                      disabled={saving || !canMoveButtonUp}
                      onClick={() => void moveFloatingButton(-1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="secondary-action"
                      disabled={saving || !canMoveButtonDown}
                      onClick={() => void moveFloatingButton(1)}
                    >
                      ↓
                    </button>
                    <button type="button" className="primary-action" disabled={saving} onClick={handleCreateFloatingButton}>
                      + 플로팅 버튼 추가
                    </button>
                    </div>
                  </div>

                  <div className="settings-list-card">
                    <div className="settings-list-card__header settings-list-card__header--four">
                      <span>버튼명</span>
                      <span>연결 유형</span>
                      <span>값</span>
                      <span>사용</span>
                    </div>

                    {floatingButtons.length === 0 ? (
                      <p className="bot-settings-page__loading">등록된 플로팅 버튼이 없습니다.</p>
                    ) : null}

                    {floatingButtons.map((item) => (
                      <div
                        key={item.id}
                        className={`settings-list-row settings-list-row--four${selectedButtonId === item.id ? " is-selected" : ""}`}
                      >
                        <button type="button" className="settings-link-button" onClick={() => handleSelectFloatingButton(item)}>
                          {item.label}
                        </button>
                        <span>{item.actionType === "key" ? "Key" : "Command"}</span>
                        <span>{item.actionValue}</span>
                        <label className="settings-toggle settings-list-card__check">
                          <input
                            type="checkbox"
                            checked={item.enabled}
                            disabled={saving}
                            onChange={() => void toggleFloatingButtonEnabled(item)}
                          />
                          <span>{item.enabled ? "사용" : "미사용"}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="bot-settings-page__pagination">
                    <button type="button" className="secondary-action" disabled>
                      «
                    </button>
                    <button type="button" className="secondary-action" disabled>
                      ‹
                    </button>
                    <strong>1</strong>
                    <button type="button" className="secondary-action" disabled>
                      ›
                    </button>
                    <button type="button" className="secondary-action" disabled>
                      »
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="settings-toolbar settings-toolbar--between">
                    <div className="settings-toolbar__spacer" />
                    <div className="settings-toolbar__group">
                    <button
                      type="button"
                      className="secondary-action"
                      disabled={saving || !canMoveIntentUp}
                      onClick={() => void moveRecommendedIntent(-1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="secondary-action"
                      disabled={saving || !canMoveIntentDown}
                      onClick={() => void moveRecommendedIntent(1)}
                    >
                      ↓
                    </button>
                    <button type="button" className="primary-action" disabled={saving || !newIntentId} onClick={() => void handleAddRecommendedIntent()}>
                      + 추천 의도 구성
                    </button>
                    </div>
                  </div>

                  <div className="settings-search-grid settings-search-grid--single messenger-settings__recommend-picker">
                    <label className="settings-form-card">
                      <span>구성할 추천 의도</span>
                      <select
                        className="bot-settings-card__select"
                        value={newIntentId}
                        onChange={(event) => setNewIntentId(event.target.value)}
                      >
                        {intentOptions.length === 0 ? <option value="">등록된 의도 없음</option> : null}
                        {intentOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="settings-list-card">
                    <div className="settings-list-card__header settings-list-card__header--two">
                      <span>추천 순서</span>
                      <span>의도명</span>
                    </div>

                    {recommendedIntents.length === 0 ? (
                      <p className="bot-settings-page__loading">구성된 추천 의도가 없습니다.</p>
                    ) : null}

                    {recommendedIntents.map((item, index) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`settings-list-row settings-list-row--two${selectedIntentConfigId === item.id ? " is-selected" : ""}`}
                        onClick={() => setSelectedIntentConfigId(item.id)}
                      >
                        <span>{index + 1}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="bot-settings-page__pagination">
                    <button type="button" className="secondary-action" disabled>
                      «
                    </button>
                    <button type="button" className="secondary-action" disabled>
                      ‹
                    </button>
                    <strong>1</strong>
                    <button type="button" className="secondary-action" disabled>
                      ›
                    </button>
                    <button type="button" className="secondary-action" disabled>
                      »
                    </button>
                  </div>
                </>
              )}

              {buttonEditorOpen ? (
                <div className="settings-dialog-backdrop" role="presentation" onClick={() => setButtonEditorOpen(false)}>
                  <div
                    className="settings-dialog settings-dialog--wide"
                    role="dialog"
                    aria-modal="true"
                    aria-label="플로팅 버튼"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="settings-dialog__header">
                      <strong>플로팅 버튼</strong>
                      <button type="button" className="settings-dialog__close" onClick={() => setButtonEditorOpen(false)} aria-label="닫기">
                        ×
                      </button>
                    </div>
                    <div className="settings-dialog__body settings-dialog__body--form">
                      <div className="messenger-settings__form-grid">
                        <label className="settings-form-card">
                          <span>버튼명</span>
                          <input
                            type="text"
                            className="bot-settings-card__input"
                            value={editingButton.label}
                            onChange={(event) =>
                              setEditingButton((current) => ({
                                ...current,
                                label: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <label className="settings-form-card">
                          <span>Key/Command 옵션</span>
                          <select
                            className="bot-settings-card__select"
                            value={editingButton.actionType}
                            onChange={(event) =>
                              setEditingButton((current) => ({
                                ...current,
                                actionType: event.target.value as "key" | "command",
                                actionValue: event.target.value === "command" ? "처음으로" : current.actionValue,
                              }))
                            }
                          >
                            <option value="key">Key</option>
                            <option value="command">Command</option>
                          </select>
                        </label>

                        <label className="settings-form-card">
                          <span>Key/Command 값</span>
                          {editingButton.actionType === "command" ? (
                            <select
                              className="bot-settings-card__select"
                              value={editingButton.actionValue}
                              onChange={(event) =>
                                setEditingButton((current) => ({
                                  ...current,
                                  actionValue: event.target.value,
                                }))
                              }
                            >
                              <option value="처음으로">처음으로</option>
                            </select>
                          ) : (
                            <input
                              type="text"
                              className="bot-settings-card__input"
                              value={editingButton.actionValue}
                              onChange={(event) =>
                                setEditingButton((current) => ({
                                  ...current,
                                  actionValue: event.target.value,
                                }))
                              }
                            />
                          )}
                        </label>

                        <label className="settings-form-card settings-form-card--check">
                          <input
                            type="checkbox"
                            checked={editingButton.enabled}
                            onChange={(event) =>
                              setEditingButton((current) => ({
                                ...current,
                                enabled: event.target.checked,
                              }))
                            }
                          />
                          <span>사용 여부</span>
                        </label>
                      </div>
                    </div>
                    <div className="settings-dialog__footer">
                      <button type="button" className="secondary-action" onClick={() => setButtonEditorOpen(false)}>
                        취소
                      </button>
                      <button type="button" className="primary-action" disabled={saving} onClick={() => void handleSaveFloatingButtonToList()}>
                        {saving ? "저장 중..." : "확인"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

          </>
        );
      }}
    </BotSettingsShell>
  );
}
