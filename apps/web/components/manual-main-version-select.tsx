"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { updateAuthPreferences } from "@/lib/auth-api";
import { useI18n } from "@/components/language-provider";
import { getStudioPageLabel, STUDIO_PAGE_CATALOGS } from "@/lib/i18n/studio-pages";
import { loadAuthSession, updateAuthSessionUser } from "@/lib/auth";
import {
  fetchStudioWorkspaceContext,
  isStudioBotVersionTrained,
  type StudioBotVersionApiItem,
} from "@/lib/studio-bots-api";

type ManualMainVersionSelectProps = {
  botId: string;
  currentVersionId?: string;
  fallbackVersionNo?: number;
  versions: StudioBotVersionApiItem[];
};

type ManualMainHeaderActionsProps = {
  botId: string;
  currentVersionId?: string;
  onError?: (message: string) => void;
};

function getVersionOptionStatus(version: StudioBotVersionApiItem) {
  if (version.is_active || version.status === "active") {
    return "운영";
  }

  if (!isStudioBotVersionTrained(version)) {
    return "미학습";
  }

  if (version.status === "testing") {
    return "테스트형";
  }

  if (version.status === "draft") {
    return "작성중";
  }

  return "비활성";
}

export function ManualMainHeaderActions({ botId, currentVersionId, onError }: ManualMainHeaderActionsProps) {
  const { language: uiLanguage } = useI18n();
  const copy = STUDIO_PAGE_CATALOGS[uiLanguage];
  const [favoriteBotIds, setFavoriteBotIds] = useState<string[]>([]);
  const [favoritePending, setFavoritePending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const session = loadAuthSession();
    setFavoriteBotIds(session?.user.favorite_bot_ids ?? []);
  }, []);

  const isFavorite = favoriteBotIds.includes(botId);
  const settingsHref = currentVersionId?.trim()
    ? `/studio/bots/${encodeURIComponent(botId)}/settings?version=${encodeURIComponent(currentVersionId)}`
    : `/studio/bots/${encodeURIComponent(botId)}/settings`;

  async function handleFavoriteToggle() {
    const session = loadAuthSession();
    if (!session || favoritePending) {
      return;
    }

    const nextFavoriteBotIds = isFavorite
      ? favoriteBotIds.filter((id) => id !== botId)
      : [botId, ...favoriteBotIds.filter((id) => id !== botId)];

    setFavoritePending(true);
    try {
      const updatedUser = await updateAuthPreferences(session.access_token, {
        favorite_bot_ids: nextFavoriteBotIds,
      });
      const nextSession = updateAuthSessionUser(() => updatedUser);
      setFavoriteBotIds(nextSession?.user.favorite_bot_ids ?? nextFavoriteBotIds);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : getStudioPageLabel(copy, "우선 봇 설정을 저장하지 못했습니다."));
    } finally {
      setFavoritePending(false);
    }
  }

  return (
    <div className="manual-main__title-actions">
      <button
        type="button"
        className={`manual-main__favorite-button${isFavorite ? " is-active" : ""}`}
        aria-label={getStudioPageLabel(copy, isFavorite ? "우선 봇 해제" : "우선 봇 설정")}
        aria-pressed={isFavorite}
        disabled={favoritePending}
        onClick={() => void handleFavoriteToggle()}
      >
        ★
      </button>

      <div className="manual-main__menu">
        <button
          type="button"
          className="manual-main__menu-button"
          aria-label={getStudioPageLabel(copy, "상세 메뉴")}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
        >
          ⋮
        </button>

        {menuOpen ? (
          <div className="manual-main__menu-popover">
            <Link href={`/studio/bots/${encodeURIComponent(botId)}/versions`} className="manual-main__menu-item">
              {getStudioPageLabel(copy, "버전 관리")}
            </Link>
            <Link href={settingsHref} className="manual-main__menu-item">
              {getStudioPageLabel(copy, "봇 설정")}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ManualMainVersionSelect({
  botId,
  currentVersionId,
  fallbackVersionNo = 1,
  versions,
}: ManualMainVersionSelectProps) {
  const { language: uiLanguage } = useI18n();
  const copy = STUDIO_PAGE_CATALOGS[uiLanguage];
  const pathname = usePathname();
  const router = useRouter();
  const selectedVersion =
    versions.find((version) => version.id === currentVersionId || version.name === currentVersionId) ??
    versions[0] ??
    null;

  if (versions.length === 0 || !selectedVersion) {
    return <span className="manual-main__version">Ver. {fallbackVersionNo}</span>;
  }

  const handleChange = (nextVersionId: string) => {
    const nextVersion = versions.find((version) => version.id === nextVersionId);
    if (!nextVersion) {
      return;
    }

    const nextVersionPath = encodeURIComponent(nextVersion.name || nextVersion.id);
    const nextPath = pathname?.includes("/versions/")
      ? pathname.replace(/\/versions\/[^/]+/, `/versions/${nextVersionPath}`)
      : `/studio/bots/${encodeURIComponent(botId)}/versions/${nextVersionPath}/intents`;
    router.push(nextPath);
  };

  return (
    <label className="manual-main__version-select" aria-label={getStudioPageLabel(copy, "버전 선택")}>
      <select value={selectedVersion.id} onChange={(event) => handleChange(event.target.value)}>
        {versions.map((version) => (
          <option key={version.id} value={version.id}>
            Ver. {version.version_no} · {getStudioPageLabel(copy, getVersionOptionStatus(version))}
          </option>
        ))}
      </select>
    </label>
  );
}

type ManualMainVersionSelectLoaderProps = {
  botId: string;
  currentVersionId?: string;
  fallbackVersionNo?: number;
};

export function ManualMainVersionSelectLoader({
  botId,
  currentVersionId,
  fallbackVersionNo = 1,
}: ManualMainVersionSelectLoaderProps) {
  const [versions, setVersions] = useState<StudioBotVersionApiItem[]>([]);

  useEffect(() => {
    let alive = true;
    const session = loadAuthSession();
    if (!session) {
      return;
    }

    async function loadVersions() {
      const activeSession = session;
      if (!activeSession) {
        return;
      }

      try {
        const context = await fetchStudioWorkspaceContext(activeSession.access_token, botId, currentVersionId || "v1", false);
        const nextVersions = context.versions;
        if (alive) {
          setVersions(nextVersions);
        }
      } catch {
        if (alive) {
          setVersions([]);
        }
      }
    }

    void loadVersions();

    return () => {
      alive = false;
    };
  }, [botId]);

  return (
    <ManualMainVersionSelect
      botId={botId}
      currentVersionId={currentVersionId}
      fallbackVersionNo={fallbackVersionNo}
      versions={versions}
    />
  );
}
