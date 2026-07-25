"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { type RecommendedIntentConfig } from "@/lib/bot-settings";
import { BotSettingsShell } from "@/components/bot-settings-shell";
import { getBotDialogs } from "@/lib/dialog-assets";
import { useI18n } from "@/components/language-provider";
import { getStudioPageLabel, STUDIO_PAGE_CATALOGS } from "@/lib/i18n/studio-pages";
import { getStudioRuntimeMessage } from "@/lib/i18n/studio-runtime-native";

type IntentOption = { id: string; label: string };

function createRecommendedIntent(intentId: string, intentOptions: IntentOption[]): RecommendedIntentConfig {
  const option = intentOptions.find((item) => item.id === intentId);
  return {
    id: crypto.randomUUID(),
    intentId,
    label: option?.label ?? intentId,
  };
}

export function MessengerRecommendedIntentsPage() {
  const { language: uiLanguage } = useI18n();
  const copy = STUDIO_PAGE_CATALOGS[uiLanguage];
  return (
    <BotSettingsShell activeMenu="recommended-intents">
      {({ bot, mainHref, versionSettings, saveVersionSettings, setErrorMessage, setMessage }) => {
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
        const [items, setItems] = useState<RecommendedIntentConfig[]>(versionSettings.recommendedIntents);
        const [selectedId, setSelectedId] = useState<string | null>(versionSettings.recommendedIntents[0]?.id ?? null);
        const [newIntentId, setNewIntentId] = useState(firstIntentId);
        const [saving, setSaving] = useState(false);

        useEffect(() => {
          setItems(versionSettings.recommendedIntents);
          setSelectedId(versionSettings.recommendedIntents[0]?.id ?? null);
        }, [versionSettings]);

        useEffect(() => {
          if (!intentOptions.some((option) => option.id === newIntentId)) {
            setNewIntentId(firstIntentId);
          }
        }, [firstIntentId, intentOptions, newIntentId]);

        const canMoveUp = useMemo(() => items.findIndex((item) => item.id === selectedId) > 0, [items, selectedId]);
        const canMoveDown = useMemo(() => {
          const index = items.findIndex((item) => item.id === selectedId);
          return index !== -1 && index < items.length - 1;
        }, [items, selectedId]);

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

        function handleAdd() {
          if (!newIntentId) {
            return;
          }
          setItems((current) => [...current, createRecommendedIntent(newIntentId, intentOptions)]);
        }

        async function handleSave() {
          setSaving(true);
          setErrorMessage("");
          setMessage("");
          try {
            await saveVersionSettings(
              {
                recommendedIntents: items,
              },
              "추천 의도 구성이 저장되었습니다.",
            );
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : getStudioRuntimeMessage(uiLanguage, "추천 의도 저장 중 오류가 발생했습니다."));
          } finally {
            setSaving(false);
          }
        }

        return (
          <>
            <section className="bot-settings-section">
              <h2>{getStudioPageLabel(copy,"추천 의도")}</h2>
              <div className="settings-toolbar">
                <select
                  className="bot-settings-card__select settings-toolbar__select"
                  value={newIntentId}
                  onChange={(event) => setNewIntentId(event.target.value)}
                >
                  {intentOptions.length === 0 ? <option value="">{getStudioPageLabel(copy, "등록된 의도 없음")}</option> : null}
                  {intentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button type="button" className="secondary-action" onClick={handleAdd}>{getStudioPageLabel(copy,"+ 추천 의도 구성")}</button>
                <div className="settings-toolbar__spacer" />
                <button type="button" className="secondary-action" disabled={!canMoveUp} onClick={() => moveSelected(-1)}>
                  ↑
                </button>
                <button type="button" className="secondary-action" disabled={!canMoveDown} onClick={() => moveSelected(1)}>
                  ↓
                </button>
              </div>

              <div className="settings-list-card">
                <div className="settings-list-card__header settings-list-card__header--two">
                  <span>{getStudioPageLabel(copy,"추천 순서")}</span>
                  <span>{getStudioPageLabel(copy,"의도명")}</span>
                </div>

                {items.length === 0 ? <p className="bot-settings-page__loading">{getStudioPageLabel(copy,"구성된 추천 의도가 없습니다.")}</p> : null}

                {items.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`settings-list-row${selectedId === item.id ? " is-selected" : ""}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span>{index + 1}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <div className="bot-settings-page__footer">
              <Link href={mainHref} className="secondary-action">{getStudioPageLabel(copy,"메인 화면으로")}</Link>
              <button type="button" className="primary-action" disabled={saving} onClick={handleSave}>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </>
        );
      }}
    </BotSettingsShell>
  );
}
