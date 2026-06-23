export const AIDOT_PACKAGE_FORMAT_VERSION = 1;
export const AIDOT_CONTRACT_VERSION = "v1.0";
export const AIDOT_SUPPORTED_CONTRACT_VERSIONS = Object.freeze([AIDOT_CONTRACT_VERSION]);

export const AIDOT_PACKAGE_SCOPE = Object.freeze({
  BOT: "bot",
  VERSION: "version",
  DIALOG: "dialog",
  API: "api",
  INTENT_UTTERANCE: "intent_utterance",
  ENTITY: "entity",
  DICTIONARY: "dictionary",
  BLOCKLIST: "blocklist",
  RULE: "rule"
});

export const AIDOT_PACKAGE_FILE_FORMAT = Object.freeze({
  JSON: "json",
  TXT: "txt"
});

export const AIDOT_PACKAGE_UPLOAD_MODE = Object.freeze({
  REPLACE: "replace",
  MERGE: "merge"
});

export const AIDOT_BOT_JSON_TOP_LEVEL_KEYS = Object.freeze([
  "AIDOTAssistantVersion",
  "messageDigest",
  "botVo",
  "licenseVo",
  "botSystemConfigVoList",
  "dialogList",
  "dialogFlowGraphList",
  "entityTypeList",
  "faqDialogList",
  "floatingButtonVoList",
  "ruleVoList",
  "smallTalkVoList",
  "dictionaryVoList",
  "blacklistList"
]);

export const AIDOT_DIALOG_JSON_TOP_LEVEL_KEYS = Object.freeze([
  "flowGraph",
  "licenseInfo",
  "AIDOTAssistantVersion",
  "dialogType",
  "messageDigest"
]);

export const AIDOT_VERSION_JSON_TOP_LEVEL_KEYS = Object.freeze([
  "asset_format_version",
  "dialogs",
  "dialog_flow_graphs",
  "entities",
  "dictionary",
  "faq_dialogs",
  "apis",
  "floating_buttons",
  "rules",
  "small_talk",
  "blacklists",
  "system_config"
]);

export const AIDOT_API_JSON_TOP_LEVEL_KEYS = Object.freeze([
  "asset_format_version",
  "exported_at",
  "apis"
]);

export const AIDOT_DIALOG_TYPE = Object.freeze({
  MODULE: 0,
  INTENT: 1
});

export const AIDOT_TEXT_ASSET_HEADERS = Object.freeze({
  entity: ["개체명", "개체값", "유형(S/P)", "상세"],
  dictionary: ["대표어", "유의어1", "유의어2", "..."],
  dictionaryLegacy: ["단어", "동의어"],
  blocklist: ["Blocklist 이름", "유형", "제외 단어/정규 표현식", "사용여부"],
  rule: ["룰 이름", "룰 설명", "룰 표현식", "연결 의도/모듈", "사용여부(Y/N)"],
  intentUtterance: ["발화문", "구분값"]
});

export const AIDOT_COMPATIBLE_PACKAGE_ASSETS = Object.freeze([
  {
    scope: AIDOT_PACKAGE_SCOPE.BOT,
    label: "Bot full package",
    fileFormat: AIDOT_PACKAGE_FILE_FORMAT.JSON,
    uploadMode: AIDOT_PACKAGE_UPLOAD_MODE.REPLACE,
    requiredTopLevelKeys: AIDOT_BOT_JSON_TOP_LEVEL_KEYS,
    aidotUploadCompatible: true,
    multilingualBoundary: "single_bot_language"
  },
  {
    scope: AIDOT_PACKAGE_SCOPE.VERSION,
    label: "Bot version package",
    fileFormat: AIDOT_PACKAGE_FILE_FORMAT.JSON,
    uploadMode: AIDOT_PACKAGE_UPLOAD_MODE.REPLACE,
    aidotUploadCompatible: true,
    requiredTopLevelKeys: AIDOT_VERSION_JSON_TOP_LEVEL_KEYS,
    multilingualBoundary: "single_bot_language"
  },
  {
    scope: AIDOT_PACKAGE_SCOPE.DIALOG,
    label: "Dialog module or intent",
    fileFormat: AIDOT_PACKAGE_FILE_FORMAT.JSON,
    uploadMode: AIDOT_PACKAGE_UPLOAD_MODE.REPLACE,
    requiredTopLevelKeys: AIDOT_DIALOG_JSON_TOP_LEVEL_KEYS,
    aidotUploadCompatible: true,
    dialogType: AIDOT_DIALOG_TYPE
  },
  {
    scope: AIDOT_PACKAGE_SCOPE.API,
    label: "API definition",
    fileFormat: AIDOT_PACKAGE_FILE_FORMAT.JSON,
    uploadMode: AIDOT_PACKAGE_UPLOAD_MODE.REPLACE,
    aidotUploadCompatible: true,
    requiredTopLevelKeys: AIDOT_API_JSON_TOP_LEVEL_KEYS
  },
  {
    scope: AIDOT_PACKAGE_SCOPE.ENTITY,
    label: "Entity",
    fileFormat: AIDOT_PACKAGE_FILE_FORMAT.TXT,
    uploadMode: AIDOT_PACKAGE_UPLOAD_MODE.MERGE,
    headers: AIDOT_TEXT_ASSET_HEADERS.entity,
    aidotUploadCompatible: true
  },
  {
    scope: AIDOT_PACKAGE_SCOPE.DICTIONARY,
    label: "Dictionary",
    fileFormat: AIDOT_PACKAGE_FILE_FORMAT.TXT,
    uploadMode: AIDOT_PACKAGE_UPLOAD_MODE.MERGE,
    headers: AIDOT_TEXT_ASSET_HEADERS.dictionary,
    legacyHeaders: AIDOT_TEXT_ASSET_HEADERS.dictionaryLegacy,
    aidotUploadCompatible: true
  },
  {
    scope: AIDOT_PACKAGE_SCOPE.BLOCKLIST,
    label: "Blocklist",
    fileFormat: AIDOT_PACKAGE_FILE_FORMAT.TXT,
    uploadMode: AIDOT_PACKAGE_UPLOAD_MODE.MERGE,
    headers: AIDOT_TEXT_ASSET_HEADERS.blocklist,
    aidotUploadCompatible: true
  },
  {
    scope: AIDOT_PACKAGE_SCOPE.INTENT_UTTERANCE,
    label: "Intent utterance",
    fileFormat: AIDOT_PACKAGE_FILE_FORMAT.TXT,
    uploadMode: AIDOT_PACKAGE_UPLOAD_MODE.MERGE,
    headers: AIDOT_TEXT_ASSET_HEADERS.intentUtterance,
    hasHeaderRow: false,
    aidotUploadCompatible: true
  },
  {
    scope: AIDOT_PACKAGE_SCOPE.RULE,
    label: "Rule",
    fileFormat: AIDOT_PACKAGE_FILE_FORMAT.TXT,
    uploadMode: AIDOT_PACKAGE_UPLOAD_MODE.MERGE,
    headers: AIDOT_TEXT_ASSET_HEADERS.rule,
    aidotUploadCompatible: true
  }
]);

export function getAidotCompatibleAsset(scope) {
  return AIDOT_COMPATIBLE_PACKAGE_ASSETS.find((item) => item.scope === scope) || null;
}

export function createAidotPackageManifest({
  scope,
  botId,
  versionId = "",
  botLocale,
  source = "cga",
  createdAt = new Date().toISOString()
}) {
  const asset = getAidotCompatibleAsset(scope);
  if (!asset) {
    throw new Error(`Unsupported Aidot package scope: ${scope}`);
  }

  return {
    package_format_version: AIDOT_PACKAGE_FORMAT_VERSION,
    contract_version: AIDOT_CONTRACT_VERSION,
    supported_contract_versions: [...AIDOT_SUPPORTED_CONTRACT_VERSIONS],
    scope,
    file_format: asset.fileFormat,
    upload_mode: asset.uploadMode,
    aidot_upload_compatible: asset.aidotUploadCompatible === true,
    bot_id: botId,
    version_id: versionId,
    bot_locale: botLocale,
    locale_mode: asset.multilingualBoundary || "asset_defined",
    source,
    created_at: createdAt
  };
}
