"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteStudioBot } from "@/lib/studio-bots-api";
import { BotSettingsShell } from "@/components/bot-settings-shell";

export function BotDeletePage() {
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
            setErrorMessage("삭제를 진행하려면 DELETE를 입력해주세요.");
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
            setErrorMessage(error instanceof Error ? error.message : "봇 삭제 중 오류가 발생했습니다.");
            setIsDeleting(false);
          }
        }

        return (
          <section className="bot-settings-section">
            <h2>봇 삭제하기</h2>
            <div className="bot-delete-card">
              <strong>{bot.name}</strong>
              <p>
                봇을 삭제하면 연결된 버전 정보도 함께 삭제됩니다.
                <br />
                삭제 후에는 되돌릴 수 없습니다.
              </p>
            </div>

            <label className="settings-form-card">
              <span>DELETE 입력</span>
              <input
                type="text"
                className="bot-settings-card__input"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder="DELETE"
              />
            </label>

            <div className="bot-settings-page__footer">
              <Link href={mainHref} className="secondary-action">
                취소
              </Link>
              <button type="button" className="primary-action primary-action--danger" disabled={isDeleting} onClick={handleDelete}>
                {isDeleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </section>
        );
      }}
    </BotSettingsShell>
  );
}
