"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { type ComponentType, useEffect, useMemo, useState } from "react";

import { useI18n } from "@/components/language-provider";
import { getBotSettingsVersionName, getBotVersionSettings, type BotVersionSettings } from "@/lib/bot-settings";
import { loadAuthSession, loadLastBotScreen } from "@/lib/auth";
import { BOT_SETTINGS_SHELL_CATALOGS, type BotSettingsShellCatalog } from "@/lib/i18n/bot-settings-shell";
import { SHELL_NAVIGATION, type ShellNavigationCatalog } from "@/lib/i18n/shell-navigation";
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
  titleKey: "settings" | "basicConversation" | "integrations";
  items: Array<{
    key: ActiveMenu;
    labelKey: "aiModelSettings" | "defaultsSettings" | "messageSettings" | "messengerFeatures" | "blocklistSettings" | "ruleSettings" | "smalltalk" | "botstation";
    href: (botId: string) => string;
  }>;
}> = [
  {
    titleKey: "settings",
    items: [
      {
        key: "edit",
        labelKey: "aiModelSettings",
        href: (botId) => `/studio/bots/${botId}/settings`,
      },
      {
        key: "conversation-defaults",
        labelKey: "defaultsSettings",
        href: (botId) => `/studio/bots/${botId}/settings/conversation-defaults`,
      },
      {
        key: "messages",
        labelKey: "messageSettings",
        href: (botId) => `/studio/bots/${botId}/settings/messages`,
      },
      {
        key: "messenger",
        labelKey: "messengerFeatures",
        href: (botId) => `/studio/bots/${botId}/settings/messenger`,
      },
    ],
  },
  {
    titleKey: "basicConversation",
    items: [
      {
        key: "blocklist",
        labelKey: "blocklistSettings",
        href: (botId) => `/studio/bots/${botId}/settings/blocklist`,
      },
      {
        key: "rules",
        labelKey: "ruleSettings",
        href: (botId) => `/studio/bots/${botId}/settings/rules`,
      },
      {
        key: "smalltalk",
        labelKey: "smalltalk",
        href: (botId) => `/studio/bots/${botId}/settings/smalltalk`,
      },
    ],
  },
  {
    titleKey: "integrations",
    items: [
      {
        key: "botstation",
        labelKey: "botstation",
        href: (botId) => `/studio/bots/${botId}/settings/botstation`,
      },
    ],
  },
];

function getSubheadLabel(
  activeMenu: ActiveMenu,
  navigation: ShellNavigationCatalog,
  copy: BotSettingsShellCatalog,
) {
  const labels: Record<ActiveMenu, string> = {
    edit: navigation.aiModelSettings,
    delete: copy.delete,
    "conversation-defaults": navigation.defaultsSettings,
    messages: navigation.messageSettings,
    messenger: navigation.messengerFeatures,
    "floating-buttons": navigation.messengerFeatures,
    "recommended-intents": navigation.messengerFeatures,
    blocklist: navigation.blocklistSettings,
    rules: navigation.ruleSettings,
    smalltalk: navigation.smalltalk,
    botstation: navigation.botstation,
  };
  return labels[activeMenu];
}

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
  const { language: uiLanguage } = useI18n();
  const navigation = SHELL_NAVIGATION[uiLanguage];
  const copy = BOT_SETTINGS_SHELL_CATALOGS[uiLanguage];
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
      setErrorMessage(copy.loginRequired);
      return;
    }

    setToken(session.access_token);
  }, [copy.loginRequired]);

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
          setErrorMessage(error instanceof Error ? error.message : copy.loadError);
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
  }, [botId, copy.loadError, routeVersionHint, token]);

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
  const subheadLabel = getSubheadLabel(activeMenu, navigation, copy);
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
      setErrorMessage(copy.loginRequired);
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
        <Link href={mainHref}>{copy.creationManagement}</Link>
        <span>&gt;</span>
        <Link href={mainHref}>{bot?.name ?? copy.bot}</Link>
        <span>&gt;</span>
        <span>{subheadLabel}</span>
      </div>
      <header className="bot-settings-page__header">
        <div className="bot-settings-page__header-meta">
          <span>{copy.lastModified} : {latestUpdatedAt}</span>
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
            <strong>{bot?.name ?? copy.botSettings}</strong>
            <button type="button" className="bot-settings-sidebar__star" aria-label={copy.priorityBot}>
              ★
            </button>
          </div>

          <div className="bot-settings-sidebar__actions">
            <Link
              href={withVersionQuery(`/studio/bots/${settingsRouteBotId}/settings`, versionName)}
              className={`bot-settings-sidebar__action${activeMenu === "edit" ? " is-active" : ""}`}
            >
              {copy.edit}
            </Link>
            <Link
              href={withVersionQuery(`/studio/bots/${settingsRouteBotId}/settings/delete`, versionName)}
              className={`bot-settings-sidebar__action${activeMenu === "delete" ? " is-active" : ""}`}
            >
              {copy.delete}
            </Link>
          </div>

          <nav className="bot-settings-menu" aria-label={copy.settingsMenu}>
            {MENU_SECTIONS.map((section) => (
              <div key={section.titleKey} className="bot-settings-menu__section">
                <strong className="bot-settings-menu__title">{copy[section.titleKey]}</strong>
                {section.items.map((item) => (
                  <Link
                    key={item.key}
                    href={withVersionQuery(item.href(settingsRouteBotId), versionName)}
                    className={`bot-settings-menu__item${isMenuActive(item.key) ? " is-active" : ""}`}
                  >
                    {navigation[item.labelKey]}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <div className="bot-settings-content">
          {loading ? <p className="bot-settings-page__loading">{copy.loading}</p> : null}
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
