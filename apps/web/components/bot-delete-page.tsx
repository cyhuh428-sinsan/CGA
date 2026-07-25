"use client";

import { getStudioRuntimeMessage } from "@/lib/i18n/studio-runtime-native";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteStudioBot } from "@/lib/studio-bots-api";
import { BotSettingsShell } from "@/components/bot-settings-shell";
import { useI18n } from "@/components/language-provider";
import { getStudioPageLabel, STUDIO_PAGE_CATALOGS } from "@/lib/i18n/studio-pages";

export function BotDeletePage() {
  const { language: uiLanguage } = useI18n();
  const copy = STUDIO_PAGE_CATALOGS[uiLanguage];
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  return (
    <BotSettingsShell activeMenu="delete">
      {({ bot, token, mainHref, setErrorMessage, setMessage }) => {
        async function handleDelete() {
          if (isDeleting) {
            return;
          }
          if (confirmText.trim().toUpperCase() !== "DELETE") {
            setErrorMessage(getStudioRuntimeMessage(uiLanguage, "삭제를 진행하려면 DELETE를 입력해주세요."));
            return;
          }

          setIsDeleting(true);
          setErrorMessage("");
          setMessage("");

          try {
            await deleteStudioBot(token, bot.id);
            router.push("/studio/bots");
            router.refresh();
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : getStudioRuntimeMessage(uiLanguage, "봇 삭제 중 오류가 발생했습니다."));
            setIsDeleting(false);
          }
        }

        return (
          <section className="bot-settings-section">
            <h2>{getStudioPageLabel(copy,"봇 삭제하기")}</h2>
            <div className="bot-delete-card">
              <strong>{bot.name}</strong>
              <p>{getStudioPageLabel(copy,"봇을 삭제하면 연결된 버전 정보도 함께 삭제됩니다.")}<br />{getStudioPageLabel(copy,"삭제 후에는 되돌릴 수 없습니다.")}</p>
            </div>

            <label className="settings-form-card">
              <span>{getStudioPageLabel(copy,"DELETE 입력")}</span>
              <input
                type="text"
                className="bot-settings-card__input"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder="DELETE"
              />
            </label>

            <div className="bot-settings-page__footer">
              <Link href={mainHref} className="secondary-action">{getStudioPageLabel(copy,"취소")}</Link>
              <button type="button" className="primary-action primary-action--danger" disabled={isDeleting} onClick={handleDelete}>
                {isDeleting ? getStudioRuntimeMessage(uiLanguage, "삭제 중...") : getStudioRuntimeMessage(uiLanguage, "삭제")}
              </button>
            </div>
          </section>
        );
      }}
    </BotSettingsShell>
  );
}
