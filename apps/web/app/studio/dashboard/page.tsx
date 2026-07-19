"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { loadAuthSession, loadLastBotScreen } from "@/lib/auth";
import { fetchStudioBots } from "@/lib/studio-bots-api";

export default function StudioDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      router.replace("/login");
      return;
    }

    let ignore = false;

    fetchStudioBots(session.access_token)
      .then((items) => {
        if (ignore) {
          return;
        }

        const textBots = items.filter((item) => item.data_json?.bot_kind !== "hub");
        const lastBotScreen = loadLastBotScreen(session.user.login_id);
        const lastBotMatch = lastBotScreen?.match(/^\/studio\/bots\/([^/]+)\/versions\/([^/]+)\/intents(?:\?.*)?$/);
        const lastBot = lastBotMatch
          ? textBots.find((item) => item.id === lastBotMatch[1])
          : null;
        if (lastBot && lastBotScreen) {
          router.replace(lastBotScreen);
          return;
        }

        const firstTextBot = textBots[0];

        if (firstTextBot?.active_version?.name) {
          router.replace(`/studio/bots/${firstTextBot.id}/versions/${firstTextBot.active_version.name}/intents`);
          return;
        }

        if (firstTextBot) {
          router.replace(`/studio/bots/${firstTextBot.id}`);
          return;
        }

        const firstHub = items.find((item) => item.data_json?.bot_kind === "hub");
        if (firstHub) {
          router.replace(`/studio/hubs/${firstHub.id}`);
          return;
        }

        router.replace("/studio/bots");
      })
      .catch(() => {
        if (!ignore) {
          router.replace("/studio/bots");
        }
      });

    return () => {
      ignore = true;
    };
  }, [router]);

  return <p className="bots-workspace__notice">메인 화면을 준비하는 중입니다...</p>;
}
