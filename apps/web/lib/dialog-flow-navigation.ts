import type { VersionDialogType } from "./version-document";

export function getDialogStartPath(
  dialogType: VersionDialogType,
  botId: string,
  versionId: string,
  dialogId: string,
) {
  if (dialogType !== 1) {
    return null;
  }

  return `/studio/bots/${botId}/versions/${versionId}/intents/${dialogId}`;
}
