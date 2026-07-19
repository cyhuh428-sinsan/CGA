export type VersionDialogType = 0 | 1;

export type VersionDialogUtteranceType = "T" | "V";

export type VersionDialogUtterance = {
  id: string;
  text: string;
  utteranceType: VersionDialogUtteranceType;
};

export type VersionDialogEntityBinding = {
  id: string;
  variableName: string;
  entityId: string;
  entityName: string;
  entityValue: string;
  required: boolean;
  local: boolean;
  chatbotMessages: string[];
};

export type VersionDialogAsset = {
  id: string;
  dialogNo: number;
  dialogType: VersionDialogType;
  name: string;
  displayName: string;
  dialogKey: string;
  classificationType: string;
  transitionLocked: boolean;
  returnBlocked: boolean;
  feedbackEnabled: boolean;
  llmAnswerPrompt: string;
  tags: string[];
  utterances: VersionDialogUtterance[];
  entityBindings: VersionDialogEntityBinding[];
  validationStatus: "none" | "success" | "failure";
  cardCount: number;
  hasFallbackResponse: boolean;
  updatedAt: string;
  updatedBy: string;
  [key: string]: unknown;
};

export type VersionEntityRowType = "S" | "P";

export type VersionEntityRow = {
  id: string;
  value: string;
  rowType: VersionEntityRowType;
  details: string[];
  detail?: string;
};

export type VersionEntityAsset = {
  id: string;
  name: string;
  system?: boolean;
  systemKind?: "regex" | "look-up";
  examples?: string[];
  standardExpression?: string;
  intentEnabled: boolean;
  qaEnabled: boolean;
  rows: VersionEntityRow[];
  updatedAt: string;
  updatedBy: string;
};

export type VersionDictionaryAsset = {
  id: string;
  word: string;
  synonyms: string[];
  system?: boolean;
  intentEnabled: boolean;
  qaEnabled: boolean;
  domainCandidate: boolean;
  domainEnabled: boolean;
  updatedAt: string;
  updatedBy: string;
};

export type VersionDocument = {
  asset_format_version: number;
  dialogs: VersionDialogAsset[];
  dialog_flow_graphs: Record<string, unknown>[];
  entities: Record<string, unknown>[];
  dictionary: Record<string, unknown>[];
  faq_dialogs: Record<string, unknown>[];
  apis: Record<string, unknown>[];
  floating_buttons: Record<string, unknown>[];
  rules: Record<string, unknown>[];
  small_talk: Record<string, unknown>[];
  blacklists: Record<string, unknown>[];
  system_config: Record<string, unknown>;
  [key: string]: unknown;
};

export type VersionAssetCounts = {
  dialogs: number;
  intents: number;
  modules: number;
  dialog_flow_graphs: number;
  entities: number;
  dictionary: number;
  qa: number;
  apis: number;
  floating_buttons: number;
  rules: number;
  small_talk: number;
  blacklists: number;
  retraining_records: number;
};

function isSystemMarker(value: unknown) {
  return typeof value === "string" && value.trim().toLowerCase() === "system";
}

function hasSystemAssetMarker(source: Record<string, unknown>) {
  return (
    source.system === true ||
    source.isSystem === true ||
    source.is_system === true ||
    isSystemMarker(source.systemKind) ||
    isSystemMarker(source.system_kind) ||
    isSystemMarker(source.kind) ||
    isSystemMarker(source.type) ||
    isSystemMarker(source.source) ||
    isSystemMarker(source.category)
  );
}

export function isUserVersionEntityAsset(asset: VersionEntityAsset) {
  return asset.system !== true;
}

export function isUserVersionDictionaryAsset(asset: VersionDictionaryAsset) {
  return asset.system !== true;
}

export const DEFAULT_VERSION_DOCUMENT: VersionDocument = {
  asset_format_version: 1,
  dialogs: [],
  dialog_flow_graphs: [],
  entities: [],
  dictionary: [],
  faq_dialogs: [],
  apis: [],
  floating_buttons: [],
  rules: [],
  small_talk: [],
  blacklists: [],
  system_config: {},
};

function matchesDialogType(value: number | string | undefined, expected: number) {
  if (value === expected) {
    return true;
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value.trim()) === expected;
  }

  return false;
}

function firstStringField(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
}

function stringArrayFromUnknown(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((item) => {
      if (typeof item === "string") {
        return item.trim();
      }
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return "";
      }
      const source = item as Record<string, unknown>;
      return firstStringField(source, ["text", "value", "name", "synonym", "word", "canonical_value"]);
    })
    .filter(Boolean);
}

function normalizeDialogType(value: unknown): VersionDialogType {
  return matchesDialogType(
    typeof value === "number" || typeof value === "string" ? value : undefined,
    0,
  )
    ? 0
    : 1;
}

function normalizeDialogUtteranceType(value: unknown): VersionDialogUtteranceType {
  if (typeof value === "string" && value.trim().toUpperCase() === "V") {
    return "V";
  }
  return "T";
}

function normalizeDialogUtterances(value: unknown): VersionDialogUtterance[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        const text = item.trim();
        if (!text) {
          return null;
        }
        return {
          id: crypto.randomUUID(),
          text,
          utteranceType: "T",
        } satisfies VersionDialogUtterance;
      }

      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const source = item as Record<string, unknown>;
      const text = typeof source.text === "string" ? source.text.trim() : "";
      if (!text) {
        return null;
      }

      return {
        id: typeof source.id === "string" && source.id.trim() ? source.id : crypto.randomUUID(),
        text,
        utteranceType: normalizeDialogUtteranceType(source.utteranceType),
      } satisfies VersionDialogUtterance;
    })
    .filter((item): item is VersionDialogUtterance => item !== null);
}

function getDialogUtteranceSource(source: Record<string, unknown>) {
  return (
    source.utterances ??
    source.utteranceList ??
    source.trainingPhrases ??
    source.trainingSentences ??
    source.training_sentences ??
    source.sentences ??
    source.examples ??
    []
  );
}

function normalizeDialogEntityBindings(value: unknown): VersionDialogEntityBinding[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const source = item as Record<string, unknown>;
      const entityId = typeof source.entityId === "string" ? source.entityId.trim() : "";
      const entityName = typeof source.entityName === "string" ? source.entityName.trim() : "";
      if (!entityId || !entityName) {
        return null;
      }

      const variableName =
        typeof source.variableName === "string" && source.variableName.trim()
          ? source.variableName.trim()
          : entityName;

      return {
        id: typeof source.id === "string" && source.id.trim() ? source.id : crypto.randomUUID(),
        variableName,
        entityId,
        entityName,
        entityValue: typeof source.entityValue === "string" ? source.entityValue.trim() : "",
        required: source.required === true,
        local: source.local === true,
        chatbotMessages: Array.isArray(source.chatbotMessages)
          ? source.chatbotMessages
              .map((item) => (typeof item === "string" ? item.trim() : ""))
              .filter(Boolean)
              .slice(0, 3)
          : [],
      } satisfies VersionDialogEntityBinding;
    })
    .filter((item): item is VersionDialogEntityBinding => item !== null);
}

function normalizeEntityRowType(value: unknown): VersionEntityRowType {
  if (typeof value === "string" && value.trim().toUpperCase() === "P") {
    return "P";
  }
  return "S";
}

function normalizeEntityRowDetails(
  rowType: VersionEntityRowType,
  details: unknown,
  detail: unknown,
) {
  const fromDetails = Array.isArray(details)
    ? details
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];

  if (fromDetails.length > 0) {
    return rowType === "P" ? fromDetails.slice(0, 5) : [...new Set(fromDetails)];
  }

  if (typeof detail !== "string" || !detail.trim()) {
    return [];
  }

  if (rowType === "P") {
    return [detail.trim()];
  }

  return [...new Set(detail.split(",").map((item) => item.trim()).filter(Boolean))];
}

function getEntityRowsSource(source: Record<string, unknown>) {
  const directRows =
    source.rows ??
    source.items ??
    source.values ??
    source.valueList ??
    source.entityValues ??
    source.entity_items ??
    source.entityItems ??
    [];

  if (Array.isArray(directRows) && directRows.length > 0) {
    return directRows;
  }

  const value = firstStringField(source, ["value", "canonical_value", "canonicalValue", "entityValue", "entity_value"]);
  if (!value) {
    return [];
  }

  return [
    {
      value,
      rowType: source.rowType ?? source.row_type ?? source.entity_type,
      details: source.details ?? source.synonyms ?? source.synonyms_json,
      detail: source.detail ?? source.pattern_text ?? source.patternText,
    },
  ];
}

export function createEmptyVersionEntity(): VersionEntityAsset {
  return {
    id: crypto.randomUUID(),
    name: "",
    system: false,
    systemKind: undefined,
    examples: [],
    standardExpression: "",
    intentEnabled: true,
    qaEnabled: false,
    rows: [],
    updatedAt: "",
    updatedBy: "",
  };
}

export function createEmptyVersionDialog(dialogType: VersionDialogType = 1): VersionDialogAsset {
  return {
    id: crypto.randomUUID(),
    dialogNo: 0,
    dialogType,
    name: "",
    displayName: "",
    dialogKey: "",
    classificationType: "기본",
    transitionLocked: false,
    returnBlocked: false,
    feedbackEnabled: false,
    llmAnswerPrompt: "",
    tags: [],
    utterances: [],
    entityBindings: [],
    validationStatus: "none",
    cardCount: 0,
    hasFallbackResponse: false,
    updatedAt: "",
    updatedBy: "",
  };
}

export function normalizeVersionDialog(value: unknown): VersionDialogAsset | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const name = firstStringField(source, [
    "name",
    "displayName",
    "display_name",
    "dialogName",
    "dialog_name",
    "intentName",
    "intent_name",
    "moduleName",
    "module_name",
    "code",
  ]);
  if (!name) {
    return null;
  }

  const dialogType = normalizeDialogType(source.dialogType);
  const utterances = normalizeDialogUtterances(getDialogUtteranceSource(source));
  const entityBindings = normalizeDialogEntityBindings(source.entityBindings);
  const tags = Array.isArray(source.tags)
    ? [...new Set(source.tags.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean))]
    : [];

  return {
    id: typeof source.id === "string" && source.id.trim() ? source.id : crypto.randomUUID(),
    dialogNo:
      typeof source.dialogNo === "number" && Number.isFinite(source.dialogNo)
        ? source.dialogNo
        : 0,
    dialogType,
    name,
    displayName:
      firstStringField(source, ["displayName", "display_name", "dialogName", "dialog_name", "intentName", "intent_name"]) ||
      name,
    dialogKey: typeof source.dialogKey === "string" ? source.dialogKey.trim() : "",
    classificationType:
      typeof source.classificationType === "string" && source.classificationType.trim()
        ? source.classificationType.trim()
        : "기본",
    transitionLocked: source.transitionLocked === true,
    returnBlocked: source.returnBlocked === true,
    feedbackEnabled: source.feedbackEnabled === true,
    llmAnswerPrompt: firstStringField(source, ["llmAnswerPrompt", "llm_answer_prompt", "answerPrompt", "answer_prompt"]),
    tags,
    utterances,
    entityBindings,
    validationStatus:
      source.validationStatus === "success" ||
      source.validationStatus === "failure" ||
      source.validationStatus === "none"
        ? source.validationStatus
        : "none",
    cardCount:
      typeof source.cardCount === "number" && Number.isFinite(source.cardCount)
        ? source.cardCount
        : 0,
    hasFallbackResponse: source.hasFallbackResponse === true,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
    updatedBy: typeof source.updatedBy === "string" ? source.updatedBy : "",
  };
}

export function normalizeVersionDialogs(value: unknown): VersionDialogAsset[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeVersionDialog(item))
    .filter((item): item is VersionDialogAsset => item !== null);
}

export function normalizeVersionEntity(value: unknown): VersionEntityAsset | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const name = firstStringField(source, [
    "name",
    "entityName",
    "entity_name",
    "displayName",
    "display_name",
    "code",
  ]);
  if (!name) {
    return null;
  }

  const incomingRows = getEntityRowsSource(source);
  const rows = incomingRows
    .map((row) => {
      if (typeof row === "string") {
        const value = row.trim();
        if (!value) {
          return null;
        }
        return {
          id: crypto.randomUUID(),
          value,
          rowType: "S",
          details: [],
        } satisfies VersionEntityRow;
      }

      if (!row || typeof row !== "object" || Array.isArray(row)) {
        return null;
      }

      const item = row as Record<string, unknown>;
      const rowType = normalizeEntityRowType(item.rowType ?? item.row_type ?? item.entity_type ?? item.type);
      const rowValue = firstStringField(item, ["value", "canonical_value", "canonicalValue", "entityValue", "entity_value", "name"]);
      if (!rowValue) {
        return null;
      }
      return {
        id: typeof item.id === "string" && item.id.trim() ? item.id : crypto.randomUUID(),
        value: rowValue,
        rowType,
        details: normalizeEntityRowDetails(
          rowType,
          item.details ?? item.synonyms ?? item.synonyms_json,
          item.detail ?? item.pattern_text ?? item.patternText,
        ),
      } satisfies VersionEntityRow;
    })
    .filter((row): row is VersionEntityRow => row !== null);

  return {
    id: typeof source.id === "string" && source.id.trim() ? source.id : crypto.randomUUID(),
    name,
    system: hasSystemAssetMarker(source),
    systemKind:
      source.systemKind === "regex" || source.systemKind === "look-up"
        ? source.systemKind
        : undefined,
    examples: Array.isArray(source.examples)
      ? source.examples.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
    standardExpression:
      typeof source.standardExpression === "string" ? source.standardExpression : "",
    intentEnabled: source.intentEnabled !== false,
    qaEnabled: source.qaEnabled === true,
    rows,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
    updatedBy: typeof source.updatedBy === "string" ? source.updatedBy : "",
  };
}

export function normalizeVersionEntities(value: unknown): VersionEntityAsset[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeVersionEntity(item))
    .filter((item): item is VersionEntityAsset => item !== null);
}

export function createEmptyVersionDictionary(): VersionDictionaryAsset {
  return {
    id: crypto.randomUUID(),
    word: "",
    synonyms: [],
    system: false,
    intentEnabled: true,
    qaEnabled: false,
    domainCandidate: false,
    domainEnabled: false,
    updatedAt: "",
    updatedBy: "",
  };
}

export function normalizeVersionDictionaryItem(value: unknown): VersionDictionaryAsset | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const word = firstStringField(source, ["word", "name", "term", "representative", "representativeWord", "standardExpression"]);
  if (!word) {
    return null;
  }

  const synonyms = stringArrayFromUnknown(
    source.synonyms ??
    source.synonymList ??
    source.synonym_list ??
    source.values ??
    source.valueList ??
    source.dictionaryValues ??
    source.synonym,
  );

  return {
    id: typeof source.id === "string" && source.id.trim() ? source.id : crypto.randomUUID(),
    word,
    synonyms,
    system: hasSystemAssetMarker(source),
    intentEnabled: source.intentEnabled !== false,
    qaEnabled: source.qaEnabled === true,
    domainCandidate: source.domainCandidate === true || source.domain_candidate === true,
    domainEnabled: source.domainEnabled === true || source.domain_enabled === true,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
    updatedBy: typeof source.updatedBy === "string" ? source.updatedBy : "",
  };
}

export function normalizeVersionDictionary(value: unknown): VersionDictionaryAsset[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeVersionDictionaryItem(item))
    .filter((item): item is VersionDictionaryAsset => item !== null);
}

export function normalizeVersionDocument(
  document?: Partial<VersionDocument> | null,
): VersionDocument {
  if (!document || typeof document !== "object") {
    return structuredClone(DEFAULT_VERSION_DOCUMENT);
  }

  const normalized = structuredClone(DEFAULT_VERSION_DOCUMENT);

  for (const [key, defaultValue] of Object.entries(DEFAULT_VERSION_DOCUMENT)) {
    const incomingValue = document[key as keyof VersionDocument];
    if (Array.isArray(defaultValue)) {
      normalized[key as keyof VersionDocument] = Array.isArray(incomingValue)
        ? incomingValue
        : structuredClone(defaultValue);
      continue;
    }

    if (defaultValue && typeof defaultValue === "object") {
      normalized[key as keyof VersionDocument] =
        incomingValue && typeof incomingValue === "object" && !Array.isArray(incomingValue)
          ? (incomingValue as VersionDocument[keyof VersionDocument])
          : structuredClone(defaultValue);
      continue;
    }

    normalized[key as keyof VersionDocument] =
      (incomingValue as VersionDocument[keyof VersionDocument]) ?? defaultValue;
  }

  for (const [key, value] of Object.entries(document)) {
    if (!(key in normalized)) {
      normalized[key] = value;
    }
  }

  return normalized;
}

export function buildVersionAssetCounts(
  document?: Partial<VersionDocument> | null,
): VersionAssetCounts {
  const normalized = normalizeVersionDocument(document);
  const dialogs = normalizeVersionDialogs(normalized.dialogs);
  const entities = normalizeVersionEntities(normalized.entities);
  const dictionary = normalizeVersionDictionary(normalized.dictionary);
  const userEntities = entities.filter(isUserVersionEntityAsset);
  const userDictionary = dictionary.filter(isUserVersionDictionaryAsset);
  const retrainingRecords = normalized.system_config.retraining_records;
  const retrainingRecordCount =
    retrainingRecords && typeof retrainingRecords === "object" && !Array.isArray(retrainingRecords)
      ? Object.keys(retrainingRecords).length
      : 0;

  return {
    dialogs: dialogs.length,
    intents: dialogs.filter((item) => matchesDialogType(item.dialogType, 1)).length,
    modules: dialogs.filter((item) => matchesDialogType(item.dialogType, 0)).length,
    dialog_flow_graphs: normalized.dialog_flow_graphs.length,
    entities: userEntities.length,
    dictionary: userDictionary.length,
    qa: normalized.faq_dialogs.length,
    apis: normalized.apis.length,
    floating_buttons: normalized.floating_buttons.length,
    rules: normalized.rules.length,
    small_talk: normalized.small_talk.length,
    blacklists: normalized.blacklists.length,
    retraining_records: retrainingRecordCount,
  };
}
