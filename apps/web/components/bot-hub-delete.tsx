"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { loadAuthSession } from "@/lib/auth";
import { deleteStudioHub, fetchStudioHub, type StudioHub } from "@/lib/studio-bots-api";
import { useI18n } from "@/components/language-provider";
import { getStudioPageLabel, STUDIO_PAGE_CATALOGS } from "@/lib/i18n/studio-pages";

type Props = {
  hubId: string;
};


export function BotHubDelete({ hubId }: Props) {
  const { language: uiLanguage } = useI18n();
  const copy = STUDIO_PAGE_CATALOGS[uiLanguage];
  const deleteText = {
    loading: getStudioPageLabel(copy, "봇 허브를 불러오는 중입니다..."),
    required: getStudioPageLabel(copy, "로그인이 필요합니다."),
    error: getStudioPageLabel(copy, "봇 허브를 불러오지 못했습니다."),
    title: getStudioPageLabel(copy, "봇 허브 삭제"),
    detail: getStudioPageLabel(copy, "삭제하면 허브 설정과 구성원 연결만 삭제됩니다. 하위 봇과 그 버전은 삭제되지 않습니다."),
    confirm: getStudioPageLabel(copy, "삭제하기"),
    cancel: getStudioPageLabel(copy, "취소"),
    deleting: getStudioPageLabel(copy, "삭제 중..."),
    failed: getStudioPageLabel(copy, "봇 허브 삭제에 실패했습니다."),
    prompt: getStudioPageLabel(copy, "정말 삭제할까요? 하위 봇은 유지됩니다."),
  };
  const router = useRouter();
  const [hub, setHub] = useState<StudioHub | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      setMessage(deleteText.required);
      setLoading(false);
      return;
    }

    fetchStudioHub(session.access_token, hubId)
      .then(setHub)
      .catch((error) => setMessage(error instanceof Error ? error.message : deleteText.error))
      .finally(() => setLoading(false));
  }, [hubId]);

  async function remove() {
    const session = loadAuthSession();
    if (!session || !hub || deleting || !window.confirm(deleteText.prompt)) return;

    setDeleting(true);
    setMessage("");

    try {
      await deleteStudioHub(session.access_token, hubId);
      router.replace("/studio/hubs");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : deleteText.failed);
      setDeleting(false);
    }
  }

  if (loading) {
    return <main className="page"><p className="bot-hub__notice">{deleteText.loading}</p></main>;
  }

  if (!hub) {
    return <main className="page"><p className="bot-hub__notice bot-hub__notice--error">{message || deleteText.error}</p></main>;
  }

  return (
    <main className="page bot-hub">
      <header className="bot-hub__header">
        <div>
          <h1>{deleteText.title}</h1>
          <p>{hub.name}</p>
        </div>
      </header>
      <section className="bot-hub__panel">
        <p>{deleteText.detail}</p>
        {message ? <p className="bot-hub__notice bot-hub__notice--error">{message}</p> : null}
        <div className="bot-hub__header-actions">
          <button type="button" className="bot-hub__secondary" onClick={() => router.back()}>
            {deleteText.cancel}
          </button>
          <button type="button" className="bot-hub__danger" onClick={remove} disabled={deleting}>
            {deleting ? deleteText.deleting : deleteText.confirm}
          </button>
        </div>
      </section>
    </main>
  );
}
