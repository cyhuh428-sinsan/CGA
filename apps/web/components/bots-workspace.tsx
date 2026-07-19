"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";

import { loadAuthSession, type AuthSession } from "@/lib/auth";
import { fetchStudioBots, getCachedStudioBots, type StudioBotApiItem } from "@/lib/studio-bots-api";

type BotsWorkspaceProps = {
  activeTab?: "bot" | "hub";
  overlay?: ReactNode;
};

type WorkspaceItem = {
  id: string;
  name: string;
  type: "텍스트형" | "보이스형" | "봇 허브";
  updatedAt: string;
  updatedBy: string;
  groupName: string;
  status: string;
  trained: boolean;
  href: string;
};

function mapBotType(item: StudioBotApiItem): WorkspaceItem["type"] {
  if (item.data_json?.bot_kind === "hub") {
    return "봇 허브";
  }

  if (item.data_json?.bot_mode === "voice") {
    return "보이스형";
  }

  return "텍스트형";
}

function mapWorkspaceItem(item: StudioBotApiItem): WorkspaceItem {
  const type = mapBotType(item);
  const versionRoute =
    item.active_version?.name ??
    (item.version_count > 0 ? "v1" : null);
  const updatedBy = item.active_version?.updated_by_login_id || item.group_name || "-";
  const trained =
    item.active_version?.is_trained === true ||
    item.active_version?.nlu_training?.status === "success" ||
    typeof item.active_version?.nlu_training?.trained_at === "string";

  return {
    id: item.id,
    name: item.name,
    type,
    updatedAt: item.updated_at.replace("T", " ").slice(0, 16),
    updatedBy,
    groupName: item.group_name || "-",
    status: item.status,
    trained,
    href:
      type === "봇 허브"
        ? `/studio/hubs/${item.id}`
        : versionRoute
          ? `/studio/bots/${item.id}/versions/${versionRoute}/intents`
          : `/studio/bots/${item.id}`,
  };
}

export function BotsWorkspace({ activeTab = "bot", overlay }: BotsWorkspaceProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [token, setToken] = useState("");
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      setLoading(false);
      setErrorMessage("로그인이 필요합니다.");
      return;
    }

    setSession(session);
    setToken(session.access_token);
    const cachedBots = getCachedStudioBots(session.access_token);
    if (cachedBots) {
      setItems(cachedBots.map(mapWorkspaceItem));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    let ignore = false;
    setLoading(!getCachedStudioBots(token));
    setErrorMessage("");

    fetchStudioBots(token)
      .then((response) => {
        if (ignore) {
          return;
        }
        setItems(response.map(mapWorkspaceItem));
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : "봇 목록을 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [token]);

  const favoriteBotIds = session?.user.favorite_bot_ids ?? [];
  const botItems = useMemo(() => {
    const filtered = items.filter((item) => (activeTab === "bot" ? item.type !== "봇 허브" : item.type === "봇 허브"));

    return [...filtered].sort((left, right) => {
      const leftFavoriteIndex = favoriteBotIds.indexOf(left.id);
      const rightFavoriteIndex = favoriteBotIds.indexOf(right.id);
      const leftFavorite = leftFavoriteIndex >= 0;
      const rightFavorite = rightFavoriteIndex >= 0;

      if (leftFavorite || rightFavorite) {
        if (leftFavorite && rightFavorite) {
          return leftFavoriteIndex - rightFavoriteIndex;
        }
        return leftFavorite ? -1 : 1;
      }

      return left.name.localeCompare(right.name, "ko");
    });
  }, [activeTab, favoriteBotIds, items]);
  const activeItemId = botItems[0]?.id;
  const botCount = items.filter((item) => item.type !== "봇 허브").length;
  const hubCount = items.filter((item) => item.type === "봇 허브").length;

  return (
    <section className="bots-workspace">
      <Link href="/studio/bots/new" className="bots-workspace__top-create">
        + 봇/봇 허브 생성
      </Link>

      <div className="bots-workspace__tabs">
        <Link href="/studio/bots" className={activeTab === "bot" ? "is-active" : ""}>
          봇({botCount})
        </Link>
        <Link href="/studio/hubs" className={activeTab === "hub" ? "is-active" : ""}>
          봇 허브({hubCount})
        </Link>
      </div>

      <div className="bots-workspace__body bots-workspace__body--list">
        <aside className="bots-workspace__list">
          <div className="bots-workspace__items">
            {botItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`bots-workspace__item${item.id === activeItemId ? " is-active" : ""}`}
              >
                <span className="bots-workspace__avatar" aria-hidden="true">
                  <span />
                  <span />
                </span>
                <div className="bots-workspace__summary">
                  <div className="bots-workspace__title-row">
                    <span className={`bots-workspace__state bots-workspace__state--${item.trained ? "trained" : "draft"}`} aria-hidden="true">
                      {item.trained ? "✓" : "−"}
                    </span>
                    <strong>{item.name}</strong>
                  </div>
                  <p>
                    {item.updatedAt} <span>{item.updatedBy}</span>
                  </p>
                </div>
                <div className="bots-workspace__meta">
                  <small>{item.type}</small>
                  <small>{item.status === "active" ? "사용" : item.status}</small>
                </div>
              </Link>
            ))}
          </div>

          {loading ? <p className="bots-workspace__notice">봇 목록을 불러오는 중입니다...</p> : null}
          {errorMessage ? <p className="bots-workspace__notice bots-workspace__notice--error">{errorMessage}</p> : null}
        </aside>

        {botItems.length === 0 && !loading && !errorMessage ? (
          <div className="bots-workspace__empty">
            <div className="bots-workspace__empty-icon">
              <span className="bots-workspace__empty-face">
                <span />
                <span />
              </span>
            </div>
            <p>
              아직 생성된 {activeTab === "bot" ? "봇" : "봇 허브"}이 없네요.
              <br />
              새로운 {activeTab === "bot" ? "봇" : "봇 허브"}을 만들고 메인 화면에서 이어서 작업하세요.
            </p>
            <Link href="/studio/bots/new" className="bots-workspace__create-button">
              + 봇/봇 허브 생성
            </Link>
          </div>
        ) : null}
      </div>

      {overlay ? (
        <>
          <div className="bots-workspace__scrim" />
          <div className="bots-workspace__overlay">{overlay}</div>
        </>
      ) : null}
    </section>
  );
}
