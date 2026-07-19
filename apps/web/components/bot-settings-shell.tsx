"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { type ComponentType, useEffect, useMemo, useState } from "react";

import { getBotSettingsVersionName, getBotVersionSettings, type BotVersionSettings } from "@/lib/bot-settings";
import { loadAuthSession, loadLastBotScreen } from "@/lib/auth";
import {
  fetchStudioBot,
  fetchStudioBots,
  refreshStudioBotSettingsContext,
  type StudioBotApiItem,
  type UpdateBotPayload,
  updateStudioBot,
} from "@/lib/studio-bots-api";

type ActiveMenu =
  | "edit"
  | "delete"
  | "conversation-defaults"
  | "messages"
  | "messenger"
  | "floating-buttons"
  | "recommended-intents"
  | "blocklist"
  | "rules"
  | "smalltalk"
  | "botstation";

type BotSettingsShellChildrenArgs = {
  bot: StudioBotApiItem;
  token: string;
  mainHref: string;
  versionName: string;
  versionSettings: BotVersionSettings;
  setBot: (bot: StudioBotApiItem) => void;
  setMessage: (value: string) => void;
  setErrorMessage: (value: string) => void;
  saveVersionSettings: (settingsJson: Partial<BotVersionSettings>, successMessage: string) => Promise<void>;
};

type BotSettingsShellProps = {
  activeMenu: ActiveMenu;
  children: ComponentType<BotSettingsShellChildrenArgs>;
};

const MENU_SECTIONS: Array<{
  title: string;
  items: Array<{ key: ActiveMenu; label: string; href: (botId: string) => string }>;
}> = [
  {
    title: "설정",
    items: [
      {
        key: "edit",
        label: "AI 모델 설정",
        href: (botId) => `/studio/bots/${botId}/settings`,
      },
      {
        key: "conversation-defaults",
        label: "기본값 설정",
        href: (botId) => `/studio/bots/${botId}/settings/conversation-defaults`,
      },
      {
        key: "messages",
        label: "메시지 설정",
        href: (botId) => `/studio/bots/${botId}/settings/messages`,
      },
      {
        key: "messenger",
        label: "메신저 편의 기능",
        href: (botId) => `/studio/bots/${botId}/settings/messenger`,
      },
    ],
  },
  {
    title: "기본 대화",
    items: [
      {
        key: "blocklist",
        label: "제외/무시 목록 설정",
        href: (botId) => `/studio/bots/${botId}/settings/blocklist`,
      },
      {
        key: "rules",
        label: "룰 설정",
        href: (botId) => `/studio/bots/${botId}/settings/rules`,
      },
      {
        key: "smalltalk",
        label: "스몰토크",
        href: (botId) => `/studio/bots/${botId}/settings/smalltalk`,
      },
    ],
  },
  {
    title: "연계",
    items: [
      {
        key: "botstation",
        label: "봇스테이션",
        href: (botId) => `/studio/bots/${botId}/settings/botstation`,
      },
    ],
  },
];

const MENU_SUBHEAD_LABELS: Record<ActiveMenu, string> = {
  edit: "AI 모델 설정",
  delete: "봇 삭제",
  "conversation-defaults": "기본값 설정",
  messages: "메시지 설정",
  messenger: "메신저 편의 기능",
  "floating-buttons": "메신저 편의 기능",
  "recommended-intents": "메신저 편의 기능",
  blocklist: "제외/무시 목록 설정",
  rules: "룰 설정",
  smalltalk: "스몰토크",
  botstation: "봇스테이션",
};

const BOT_VERSION_PATH_PATTERN = /^\/studio\/bots\/([^/]+)\/versions\/([^/]+)/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function withVersionQuery(href: string, versionName: string) {
  if (!versionName) {
    return href;
  }
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}version=${encodeURIComponent(versionName)}`;
}

function isVersionName(value?: string | null) {
  return /^v\d+$/i.test(value?.trim() ?? "");
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value.trim());
}

function decodeRouteValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function BotSettingsShell({ activeMenu, children }: BotSettingsShellProps) {
  const params = useParams<{ botId: string }>();
  const searchParams = useSearchParams();
  const rawBotId = typeof params.botId === "string" ? params.botId : "";
  const botId = decodeRouteValue(rawBotId);
  const routeVersionHint = searchParams.get("version");

  const [token, setToken] = useState("");
  const [bot, setBot] = useState<StudioBotApiItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      setLoading(false);
      setErrorMessage("로그인이 필요합니다.");
      return;
    }

    setToken(session.access_token);
  }, []);

  useEffect(() => {
    if (!token || !botId) {
      return;
    }

    let ignore = false;
    setLoading(true);
    setMessage("");
    setErrorMessage("");

    const session = loadAuthSession();
    const lastBotScreen = session ? loadLastBotScreen(session.user.login_id) : null;
    const versionMatch = lastBotScreen?.match(BOT_VERSION_PATH_PATTERN);
    const loadBotSettings = async () => {
      const routeBot = isUuid(botId) ? await fetchStudioBot(token, botId).catch(() => null) : null;
      const resolvedBotId = routeBot?.id ?? botId;
      const lastScreenBotKey = decodeRouteValue(versionMatch?.[1] ?? "");
      const versionHint =
        routeVersionHint ||
        (versionMatch && (lastScreenBotKey === botId || lastScreenBotKey === resolvedBotId) ? versionMatch[2] : null);

      try {
        return await refreshStudioBotSettingsContext(token, resolvedBotId, versionHint);
      } catch (error) {
        const botCandidates = await fetchStudioBots(token, false);
        const normalizedBotId = botId.trim().toLowerCase();
        const matchedBot = botCandidates.find((item) => (
          item.id.toLowerCase() === normalizedBotId ||
          item.name.trim().toLowerCase() === normalizedBotId
        ));
        if (!matchedBot || matchedBot.id === resolvedBotId) {
          throw error;
        }
        return refreshStudioBotSettingsContext(token, matchedBot.id, versionHint);
      }
    };

    loadBotSettings()
      .then((data) => {
        if (!ignore) {
          setBot(data.bot);
        }
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : "봇 설정 정보를 불러오지 못했습니다.");
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
  }, [botId, routeVersionHint, token]);

  const activeVersionName = bot?.active_version?.name?.trim() ?? "";
  const routeVersionName = isVersionName(routeVersionHint) ? routeVersionHint?.trim() ?? "" : "";
  const versionName = bot
    ? getBotSettingsVersionName(bot, activeVersionName || routeVersionName)
    : routeVersionName || "v1";
  const mainHref = useMemo(() => {
    if (!bot) {
      return "/studio/bots";
    }

    return `/studio/bots/${bot.id}/versions/${encodeURIComponent(versionName)}/intents`;
  }, [bot, versionName]);

  const versionScope = bot?.active_version?.id ?? versionName;
  const versionSettings = bot ? getBotVersionSettings(bot, versionScope) : getBotVersionSettings({});
  const latestUpdatedAt = bot?.updated_at ? bot.updated_at.replace("T", " ").slice(0, 16) : "-";
  const Content = children;
  const subheadLabel = MENU_SUBHEAD_LABELS[activeMenu];
  const settingsRouteBotId = bot?.id ?? botId;

  function isMenuActive(key: ActiveMenu) {
    if (key === "messenger") {
      return (
        activeMenu === "messenger" ||
        activeMenu === "floating-buttons" ||
        activeMenu === "recommended-intents"
      );
    }

    return activeMenu === key;
  }

  async function saveVersionSettings(settingsJson: Partial<BotVersionSettings>, successMessage: string) {
    if (!bot || !token) {
      setErrorMessage("로그인이 필요합니다.");
      return;
    }

    const payload: UpdateBotPayload = {
      settings_scope: versionScope,
      settings_json: settingsJson,
    };

    const updatedBot = await updateStudioBot(token, bot.id, payload, {
      responseMode: "settings",
      versionScope,
    });
    const refreshed = await refreshStudioBotSettingsContext(token, updatedBot.id, versionScope);
    setBot(refreshed.bot);
    setMessage(successMessage);
    setErrorMessage("");
  }

  return (
    <section className="bot-settings-page">
      <div className="bot-settings-page__crumb">
        <Link href={mainHref}>챗봇 생성 및 관리하기</Link>
        <span>&gt;</span>
        <Link href={mainHref}>{bot?.name ?? "봇"}</Link>
        <span>&gt;</span>
        <span>{subheadLabel}</span>
      </div>
      <header className="bot-settings-page__header">
        <div className="bot-settings-page__header-meta">
          <span>최종수정일시 : {latestUpdatedAt}</span>
        </div>
      </header>

      <div className="bot-settings-layout" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <aside className="bot-settings-sidebar" style={{ display: "none" }} aria-hidden="true">
          <div className="bot-settings-sidebar__bot">
            <div className="bot-settings-sidebar__avatar" aria-hidden="true">
              <span className="manual-main__avatar-face">
                <span />
                <span />
              </span>
            </div>
            <strong>{bot?.name ?? "봇 설정"}</strong>
            <button type="button" className="bot-settings-sidebar__star" aria-label="우선 봇">
              ★
            </button>
          </div>

          <div className="bot-settings-sidebar__actions">
            <Link
              href={withVersionQuery(`/studio/bots/${settingsRouteBotId}/settings`, versionName)}
              className={`bot-settings-sidebar__action${activeMenu === "edit" ? " is-active" : ""}`}
            >
              수정
            </Link>
            <Link
              href={withVersionQuery(`/studio/bots/${settingsRouteBotId}/settings/delete`, versionName)}
              className={`bot-settings-sidebar__action${activeMenu === "delete" ? " is-active" : ""}`}
            >
              삭제
            </Link>
          </div>

          <nav className="bot-settings-menu" aria-label="설정 메뉴">
            {MENU_SECTIONS.map((section) => (
              <div key={section.title} className="bot-settings-menu__section">
                <strong className="bot-settings-menu__title">{section.title}</strong>
                {section.items.map((item) => (
                  <Link
                    key={item.key}
                    href={withVersionQuery(item.href(settingsRouteBotId), versionName)}
                    className={`bot-settings-menu__item${isMenuActive(item.key) ? " is-active" : ""}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <div className="bot-settings-content">
          {loading ? <p className="bot-settings-page__loading">설정 화면을 불러오는 중입니다...</p> : null}
          {errorMessage ? <p className="form-message form-message--error">{errorMessage}</p> : null}
          {message ? <p className="form-message form-message--success">{message}</p> : null}

          {!loading && bot
            ? (
              <Content
                bot={bot}
                token={token}
                mainHref={mainHref}
                versionName={versionName}
                versionSettings={versionSettings}
                setBot={setBot}
                setMessage={setMessage}
                setErrorMessage={setErrorMessage}
                saveVersionSettings={saveVersionSettings}
              />
            )
            : null}
        </div>
      </div>
    </section>
  );
}
