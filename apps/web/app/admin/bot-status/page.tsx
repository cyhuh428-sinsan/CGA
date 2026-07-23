"use client";

import { useEffect, useMemo, useState } from "react";

import { AdminInteractiveTablePage } from "@/components/admin-interactive-table-page";
import { type DataGridRow } from "@/components/data-grid";
import { loadAuthSession } from "@/lib/auth";
import { fetchStudioBots, type StudioBotApiItem } from "@/lib/studio-bots-api";
import { useI18n } from "@/components/language-provider";
import { ADMIN_PAGE_CATALOGS } from "@/lib/i18n/admin-pages";
import { ADMIN_COMMON_CATALOGS, formatAdminText } from "@/lib/i18n/admin-common";

function formatDate(value?: string | null) {
  return value ? value.replace("T", " ").slice(0, 19) : "-";
}

function readString(value: unknown, fallback = "-") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getBotNluLabel(bot: StudioBotApiItem) {
  const nluType = readString(bot.data_json?.nlu_type ?? bot.data_json?.nlu_engine);
  const nluModel = readString(bot.data_json?.nlu_model ?? bot.data_json?.nlu_engine, "");

  if (!nluModel || nluModel === nluType) {
    return nluType;
  }

  return `${nluType} / ${nluModel}`;
}

export default function AdminBotStatusPage() {
  const { language } = useI18n();
  const copy = ADMIN_PAGE_CATALOGS[language].botStatus;
  const commonCopy = ADMIN_COMMON_CATALOGS[language];
  const [bots, setBots] = useState<StudioBotApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const session = loadAuthSession();

    if (!session) {
      setMessage(commonCopy.loginRequired);
      setLoading(false);
      return;
    }

    fetchStudioBots(session.access_token)
      .then((items) => {
        setBots(items);
        setMessage("");
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : commonCopy.loadFailed);
      })
      .finally(() => setLoading(false));
  }, [commonCopy.loadFailed, commonCopy.loginRequired]);

  const rows = useMemo<DataGridRow[]>(
    () =>
      bots.map((bot) => ({
        key: bot.id,
        searchText: [bot.group_name, bot.name, bot.id, bot.status, getBotNluLabel(bot)].filter(Boolean).join(" "),
        cells: [
          <input key={`${bot.id}-check`} type="checkbox" aria-label={`${bot.name} 선택`} />,
          bot.group_name || bot.group_code || "-",
          bot.name,
          readString(bot.data_json?.language, "-"),
          getBotNluLabel(bot),
          String(bot.version_count ?? 0),
          readString(bot.creator_name ?? bot.creator_login_id, "-"),
          formatDate(bot.created_at),
        ],
      })),
    [bots],
  );

  return (
    <AdminInteractiveTablePage
      title={copy.title}
      searchPlaceholder={copy.searchPlaceholder}
      totalText={formatAdminText(commonCopy.totalCount, { count: bots.length })}
      columns={copy.columns}
      rows={rows}
      template="48px 1fr 1.4fr 0.7fr 1.3fr 0.8fr 1fr 1.3fr"
      toolbarRight={message ? <span className="form-message form-message--error">{message}</span> : null}
      loading={loading}
    />
  );
}
