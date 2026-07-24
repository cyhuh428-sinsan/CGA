"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { type FloatingButtonConfig } from "@/lib/bot-settings";
import { BotSettingsShell } from "@/components/bot-settings-shell";
import { useI18n } from "@/components/language-provider";
import { getStudioPageLabel, STUDIO_PAGE_CATALOGS } from "@/lib/i18n/studio-pages";

function createEmptyFloatingButton(): FloatingButtonConfig {
  return {
    id: crypto.randomUUID(),
    label: "",
    actionType: "key",
    actionValue: "",
    enabled: true,
  };
}

export function MessengerFloatingButtonsPage() {
  const { language: uiLanguage } = useI18n();
  const copy = STUDIO_PAGE_CATALOGS[uiLanguage];
  return (
    <BotSettingsShell activeMenu="floating-buttons">
      {({ mainHref, versionSettings, saveVersionSettings, setErrorMessage, setMessage }) => {
        const [items, setItems] = useState<FloatingButtonConfig[]>(versionSettings.floatingButtons);
        const [editingItem, setEditingItem] = useState<FloatingButtonConfig>(createEmptyFloatingButton());
        const [selectedId, setSelectedId] = useState<string | null>(versionSettings.floatingButtons[0]?.id ?? null);
        const [saving, setSaving] = useState(false);

        useEffect(() => {
          setItems(versionSettings.floatingButtons);
          setSelectedId(versionSettings.floatingButtons[0]?.id ?? null);
          setEditingItem(versionSettings.floatingButtons[0] ?? createEmptyFloatingButton());
        }, [versionSettings]);

        useEffect(() => {
          if (!selectedId) {
            return;
          }
          const current = items.find((item) => item.id === selectedId);
          if (current) {
            setEditingItem(current);
          }
        }, [items, selectedId]);

        const canMoveUp = useMemo(() => items.findIndex((item) => item.id === selectedId) > 0, [items, selectedId]);
        const canMoveDown = useMemo(() => {
          const index = items.findIndex((item) => item.id === selectedId);
          return index !== -1 && index < items.length - 1;
        }, [items, selectedId]);

        function handleAddNew() {
          const nextItem = createEmptyFloatingButton();
          setEditingItem(nextItem);
          setSelectedId(nextItem.id);
        }

        function handleSelect(item: FloatingButtonConfig) {
          setSelectedId(item.id);
          setEditingItem(item);
        }

        function handleToggle(targetId: string) {
          setItems((current) =>
            current.map((item) =>
              item.id === targetId
                ? {
                    ...item,
                    enabled: !item.enabled,
                  }
                : item,
            ),
          );
        }

        function moveSelected(direction: -1 | 1) {
          if (!selectedId) {
            return;
          }
          setItems((current) => {
            const index = current.findIndex((item) => item.id === selectedId);
            if (index === -1) {
              return current;
            }
            const targetIndex = index + direction;
            if (targetIndex < 0 || targetIndex >= current.length) {
              return current;
            }
            const next = [...current];
            const [moved] = next.splice(index, 1);
            next.splice(targetIndex, 0, moved);
            return next;
          });
        }

        function handleSaveItem() {
          if (!editingItem.label.trim() || !editingItem.actionValue.trim()) {
            setErrorMessage("버튼명과 Key/Command 값을 입력해주세요.");
            return;
          }

          setErrorMessage("");
          setItems((current) => {
            const index = current.findIndex((item) => item.id === editingItem.id);
            if (index === -1) {
              return [...current, editingItem];
            }
            const next = [...current];
            next[index] = editingItem;
            return next;
          });
          setSelectedId(editingItem.id);
        }

        async function handlePersist() {
          setSaving(true);
          setErrorMessage("");
          setMessage("");
          try {
            await saveVersionSettings(
              {
                floatingButtons: items,
              },
              "플로팅 버튼 설정이 저장되었습니다.",
            );
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "플로팅 버튼 저장 중 오류가 발생했습니다.");
          } finally {
            setSaving(false);
          }
        }

        return (
          <>
            <section className="bot-settings-section">
              <h2>{getStudioPageLabel(copy,"플로팅 버튼")}</h2>
              <div className="settings-toolbar">
                <button type="button" className="secondary-action" onClick={handleAddNew}>{getStudioPageLabel(copy,"+ 플로팅 버튼 추가")}</button>
                <div className="settings-toolbar__spacer" />
                <button type="button" className="secondary-action" disabled={!canMoveUp} onClick={() => moveSelected(-1)}>
                  ↑
                </button>
                <button type="button" className="secondary-action" disabled={!canMoveDown} onClick={() => moveSelected(1)}>
                  ↓
                </button>
              </div>

              <div className="settings-master-detail">
                <div className="settings-list-card">
                  <div className="settings-list-card__header settings-list-card__header--four">
                    <span>{getStudioPageLabel(copy,"버튼명")}</span>
                    <span>{getStudioPageLabel(copy,"연결 유형")}</span>
                    <span>{getStudioPageLabel(copy,"값")}</span>
                    <span>{getStudioPageLabel(copy,"사용")}</span>
                  </div>

                  {items.length === 0 ? <p className="bot-settings-page__loading">{getStudioPageLabel(copy,"등록된 플로팅 버튼이 없습니다.")}</p> : null}

                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`settings-list-row${selectedId === item.id ? " is-selected" : ""}`}
                      onClick={() => handleSelect(item)}
                    >
                      <span>{item.label}</span>
                      <span>{item.actionType === "key" ? "Key" : "Command"}</span>
                      <span>{item.actionValue}</span>
                      <span>
                        <label className="settings-toggle">
                          <input
                            type="checkbox"
                            checked={item.enabled}
                            onChange={(event) => {
                              event.stopPropagation();
                              handleToggle(item.id);
                            }}
                          />
                          <span>{item.enabled ? "사용" : "미사용"}</span>
                        </label>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="settings-detail-card">
                  <h3>{getStudioPageLabel(copy,"플로팅 버튼 상세")}</h3>
                  <div className="settings-form-grid settings-form-grid--compact">
                    <label className="settings-form-card">
                      <span>{getStudioPageLabel(copy,"버튼명")}</span>
                      <input
                        type="text"
                        className="bot-settings-card__input"
                        value={editingItem.label}
                        onChange={(event) =>
                          setEditingItem((current) => ({
                            ...current,
                            label: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="settings-form-card">
                      <span>{getStudioPageLabel(copy, "Key/Command 옵션")}</span>
                      <select
                        className="bot-settings-card__select"
                        value={editingItem.actionType}
                        onChange={(event) =>
                          setEditingItem((current) => ({
                            ...current,
                            actionType: event.target.value as "key" | "command",
                          }))
                        }
                      >
                        <option value="key">Key</option>
                        <option value="command">Command</option>
                      </select>
                    </label>

                    <label className="settings-form-card">
                      <span>{getStudioPageLabel(copy, "Key/Command 값")}</span>
                      <input
                        type="text"
                        className="bot-settings-card__input"
                        value={editingItem.actionValue}
                        onChange={(event) =>
                          setEditingItem((current) => ({
                            ...current,
                            actionValue: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="settings-form-card settings-form-card--check">
                      <input
                        type="checkbox"
                        checked={editingItem.enabled}
                        onChange={(event) =>
                          setEditingItem((current) => ({
                            ...current,
                            enabled: event.target.checked,
                          }))
                        }
                      />
                      <span>{getStudioPageLabel(copy,"사용 여부")}</span>
                    </label>
                  </div>

                  <div className="settings-detail-card__actions">
                    <button type="button" className="secondary-action" onClick={handleSaveItem}>{getStudioPageLabel(copy,"목록에 반영")}</button>
                  </div>
                </div>
              </div>
            </section>

            <div className="bot-settings-page__footer">
              <Link href={mainHref} className="secondary-action">{getStudioPageLabel(copy,"메인 화면으로")}</Link>
              <button type="button" className="primary-action" disabled={saving} onClick={handlePersist}>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </>
        );
      }}
    </BotSettingsShell>
  );
}
