const BOT_VERSION_PATH_PATTERN = /^\/studio\/bots\/([^/]+)\/versions\/([^/]+)/;
const BOT_SETTINGS_PATH_PATTERN = /^\/studio\/bots\/([^/]+)\/settings(?:\/.*)?$/;

type StudioWorkContextInput = {
  pathname: string;
  selectedBotId?: string | null;
  selectedVersionId?: string | null;
  lastBotScreen?: string | null;
};

export type StudioWorkContext = {
  botId: string;
  versionId: string;
};

type StudioVersionOption = {
  id: string;
  name?: string | null;
  is_active?: boolean;
};

function parseVersionPath(pathname?: string | null): StudioWorkContext {
  const match = pathname?.match(BOT_VERSION_PATH_PATTERN);
  return {
    botId: match?.[1] ?? "",
    versionId: match?.[2] ?? "",
  };
}

export function resolveStudioWorkContext({
  pathname,
  selectedBotId,
  selectedVersionId,
  lastBotScreen,
}: StudioWorkContextInput): StudioWorkContext {
  const routeContext = parseVersionPath(pathname);
  if (routeContext.botId) {
    return routeContext;
  }

  const lastContext = parseVersionPath(lastBotScreen);
  const settingsBotId = pathname.match(BOT_SETTINGS_PATH_PATTERN)?.[1] ?? "";
  const isSelectionPath = pathname === "/studio/bots" || pathname === "/studio/workspace";
  const queryBotId = isSelectionPath ? selectedBotId?.trim() ?? "" : "";
  const queryVersionId = isSelectionPath || settingsBotId ? selectedVersionId?.trim() ?? "" : "";
  const botId = settingsBotId || queryBotId || lastContext.botId;

  return {
    botId,
    versionId:
      queryVersionId ||
      (lastContext.botId === botId ? lastContext.versionId : ""),
  };
}

export function buildStudioSelectionHref(
  pathname: string,
  currentSearch: string,
  botId: string,
  versionId = "",
): string {
  const params = new URLSearchParams(currentSearch);
  params.set("bot", botId);
  if (versionId) {
    params.set("version", versionId);
  } else {
    params.delete("version");
  }

  return `${pathname}?${params.toString()}`;
}

export function resolveStudioVersionId(
  versions: StudioVersionOption[],
  requestedVersion: string,
): string {
  const requested = requestedVersion.trim();
  const matched = requested
    ? versions.find((version) => version.id === requested || version.name === requested)
    : null;
  return matched?.id || versions.find((version) => version.is_active)?.id || versions[0]?.id || "";
}

export function resolveStudioQueryVersion(currentSearch: string, botId: string): string {
  const params = new URLSearchParams(currentSearch);
  return params.get("bot") === botId ? params.get("version")?.trim() || "" : "";
}
