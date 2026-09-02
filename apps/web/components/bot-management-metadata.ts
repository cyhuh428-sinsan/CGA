import { createElement } from "react";

type BotManagementMetadataBot = {
  id: string;
  active_version?: {
    name?: string | null;
  } | null;
};

type BotManagementMetadataProps = {
  bot: BotManagementMetadataBot;
  statusLabel: string;
  localeLabel: string;
  locale: string;
};

export function BotManagementMetadata({ bot, statusLabel, localeLabel, locale }: BotManagementMetadataProps) {
  return createElement("span", null, `${bot.active_version?.name || "-"} · ${statusLabel} · ${localeLabel}: ${locale}`);
}
