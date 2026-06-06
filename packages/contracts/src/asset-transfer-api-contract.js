import { ACCESS_SCOPES } from "./access-contract.js";
import {
  AIDOT_PACKAGE_SCOPE,
  createAidotPackageManifest,
  getAidotCompatibleAsset
} from "./aidot-package-contract.js";

export const ASSET_TRANSFER_COMPATIBILITY_MODE = Object.freeze({
  AIDOT: "aidot-compatible",
  CGA: "cga-native"
});

export const ASSET_TRANSFER_API_ROUTES = Object.freeze({
  EXPORT: "/api/cga/groups/{groupId}/bots/{botId}/assets/{scope}/export",
  IMPORT: "/api/cga/groups/{groupId}/bots/{botId}/assets/{scope}/import",
  MANIFEST: "/api/cga/groups/{groupId}/bots/{botId}/assets/{scope}/manifest",
  HISTORY: "/api/cga/groups/{groupId}/bots/{botId}/asset-transfers"
});

export const ASSET_TRANSFER_STATUS = Object.freeze({
  READY: "ready",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  BLOCKED: "blocked"
});

export const ASSET_TRANSFER_DIRECTION = Object.freeze({
  EXPORT: "export",
  IMPORT: "import"
});

export const ASSET_TRANSFER_SCOPE_REQUIREMENTS = Object.freeze({
  [AIDOT_PACKAGE_SCOPE.BOT]: {
    exportScopes: [ACCESS_SCOPES.BOT_VIEW],
    importScopes: [ACCESS_SCOPES.BOT_CREATE]
  },
  [AIDOT_PACKAGE_SCOPE.VERSION]: {
    exportScopes: [ACCESS_SCOPES.BOT_VIEW],
    importScopes: [ACCESS_SCOPES.BOT_UPDATE]
  },
  [AIDOT_PACKAGE_SCOPE.DIALOG]: {
    exportScopes: [ACCESS_SCOPES.BOT_VIEW],
    importScopes: [ACCESS_SCOPES.BOT_UPDATE]
  },
  [AIDOT_PACKAGE_SCOPE.API]: {
    exportScopes: [ACCESS_SCOPES.API_ANSWER_MANAGE],
    importScopes: [ACCESS_SCOPES.API_ANSWER_MANAGE]
  },
  [AIDOT_PACKAGE_SCOPE.INTENT_UTTERANCE]: {
    exportScopes: [ACCESS_SCOPES.BOT_VIEW],
    importScopes: [ACCESS_SCOPES.BOT_UPDATE]
  },
  [AIDOT_PACKAGE_SCOPE.ENTITY]: {
    exportScopes: [ACCESS_SCOPES.BOT_VIEW],
    importScopes: [ACCESS_SCOPES.BOT_UPDATE]
  },
  [AIDOT_PACKAGE_SCOPE.DICTIONARY]: {
    exportScopes: [ACCESS_SCOPES.BOT_VIEW],
    importScopes: [ACCESS_SCOPES.BOT_UPDATE]
  },
  [AIDOT_PACKAGE_SCOPE.BLOCKLIST]: {
    exportScopes: [ACCESS_SCOPES.BOT_VIEW],
    importScopes: [ACCESS_SCOPES.BOT_UPDATE]
  },
  [AIDOT_PACKAGE_SCOPE.RULE]: {
    exportScopes: [ACCESS_SCOPES.BOT_VIEW],
    importScopes: [ACCESS_SCOPES.BOT_UPDATE]
  }
});

export function getAssetTransferScopeRequirement(scope) {
  return ASSET_TRANSFER_SCOPE_REQUIREMENTS[scope] || null;
}

export function createAssetExportRequest({
  groupId,
  botId,
  scope,
  versionId = "",
  botLocale,
  compatibilityMode = ASSET_TRANSFER_COMPATIBILITY_MODE.AIDOT
}) {
  const asset = getAidotCompatibleAsset(scope);
  if (!asset) throw new Error(`Unsupported asset transfer scope: ${scope}`);
  return {
    direction: ASSET_TRANSFER_DIRECTION.EXPORT,
    group_id: groupId,
    bot_id: botId,
    scope,
    version_id: versionId,
    bot_locale: botLocale,
    compatibility_mode: compatibilityMode,
    expected_file_format: asset.fileFormat,
    upload_mode: asset.uploadMode
  };
}

export function createAssetImportRequest({
  groupId,
  botId,
  scope,
  versionId = "",
  botLocale,
  fileName,
  compatibilityMode = ASSET_TRANSFER_COMPATIBILITY_MODE.AIDOT
}) {
  const asset = getAidotCompatibleAsset(scope);
  if (!asset) throw new Error(`Unsupported asset transfer scope: ${scope}`);
  return {
    direction: ASSET_TRANSFER_DIRECTION.IMPORT,
    group_id: groupId,
    bot_id: botId,
    scope,
    version_id: versionId,
    bot_locale: botLocale,
    compatibility_mode: compatibilityMode,
    file_name: fileName,
    expected_file_format: asset.fileFormat,
    upload_mode: asset.uploadMode
  };
}

export function createAssetTransferResponse({
  request,
  status = ASSET_TRANSFER_STATUS.READY,
  transferId = "",
  warnings = [],
  errors = []
}) {
  return {
    transfer_id: transferId,
    status,
    request,
    manifest: createAidotPackageManifest({
      scope: request.scope,
      botId: request.bot_id,
      versionId: request.version_id,
      botLocale: request.bot_locale,
      source: request.compatibility_mode === ASSET_TRANSFER_COMPATIBILITY_MODE.AIDOT ? "cga" : "cga-native"
    }),
    warnings,
    errors
  };
}
