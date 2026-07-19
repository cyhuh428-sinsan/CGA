import {
  createEmptyVersionEntity,
  isUserVersionEntityAsset,
  normalizeVersionDocument,
  normalizeVersionEntities,
  type VersionDocument,
  type VersionEntityAsset,
} from "@/lib/version-document";
import {
  type StudioBotApiItem,
  type StudioBotVersionApiItem,
} from "@/lib/studio-bots-api";

export function getBotVersionDocument(bot?: StudioBotApiItem | null): VersionDocument {
  return normalizeVersionDocument(bot?.active_version?.version_json);
}

export function getVersionDocument(version?: StudioBotVersionApiItem | null): VersionDocument {
  return normalizeVersionDocument(version?.version_json);
}

type SystemEntityDefinition = {
  id: string;
  name: string;
  systemKind: "regex" | "look-up";
  examples: string[];
  standardExpression?: string;
};

const SYSTEM_ENTITY_DEFINITIONS: SystemEntityDefinition[] = [
  { id: "sys-address", name: "address", systemKind: "look-up", examples: ["서울시 강남구 삼성동", "부산시 부산진구 연지동"] },
  { id: "sys-age", name: "age", systemKind: "regex", examples: ["만 16세", "28살"] },
  { id: "sys-amount", name: "amount", systemKind: "regex", examples: ["10000원", "100달러"] },
  { id: "sys-appliance", name: "appliance", systemKind: "look-up", examples: ["냉장고", "프린터"] },
  { id: "sys-code", name: "code", systemKind: "regex", examples: ["abcd1234", "A123B"] },
  { id: "sys-company", name: "company_name", systemKind: "look-up", examples: ["삼성전자", "삼성SDS"] },
  { id: "sys-date", name: "date", systemKind: "regex", examples: ["오늘", "2018-04-01"], standardExpression: "yyyy/mm/dd hh:mi" },
  { id: "sys-date-end", name: "date_end", systemKind: "regex", examples: ["2020/03/31 00:00:00"], standardExpression: "yyyy/mm/dd hh:mi" },
  { id: "sys-date-start", name: "date_start", systemKind: "regex", examples: ["2020/01/01 00:00:00"], standardExpression: "yyyy/mm/dd hh:mi" },
  { id: "sys-day", name: "day", systemKind: "regex", examples: ["오늘"] },
  { id: "sys-day-end", name: "day_end", systemKind: "regex", examples: ["2020/03/31 00:00:00"], standardExpression: "yyyy/mm/dd hh:mi" },
  { id: "sys-day-start", name: "day_start", systemKind: "regex", examples: ["2020/01/01 00:00:00"], standardExpression: "yyyy/mm/dd hh:mi" },
  { id: "sys-length", name: "length", systemKind: "regex", examples: ["10미터", "10km"] },
  {
    id: "sys-location",
    name: "location",
    systemKind: "look-up",
    examples: ["가락동", "삼성역", "서울시", "서초구"],
    standardExpression: "동명, 역명, 시도, 시군구 단위",
  },
  { id: "sys-location-end", name: "location_end", systemKind: "look-up", examples: ["잠실", "수원"] },
  { id: "sys-location-start", name: "location_start", systemKind: "look-up", examples: ["수원", "잠실"] },
  { id: "sys-mail", name: "mail", systemKind: "regex", examples: ["test@samsung.com"] },
  { id: "sys-name", name: "name", systemKind: "look-up", examples: ["홍길동", "김철수"] },
  { id: "sys-number", name: "number", systemKind: "regex", examples: ["1000", "1만 5천"] },
  { id: "sys-ordinal", name: "ordinal_num", systemKind: "regex", examples: ["첫번째", "13번"], standardExpression: "N(숫자)" },
  { id: "sys-percentage", name: "percentage", systemKind: "regex", examples: ["10%", "10퍼센트"] },
  { id: "sys-phone", name: "phone_num", systemKind: "regex", examples: ["010-1234-1234", "02-6155-1111"] },
  { id: "sys-point", name: "point", systemKind: "regex", examples: ["10포인트"], standardExpression: "N(숫자)" },
  { id: "sys-school", name: "school_name", systemKind: "look-up", examples: ["가락초등학교", "우면중학교"] },
  { id: "sys-speed", name: "speed", systemKind: "regex", examples: ["100km/h"] },
  { id: "sys-temperature", name: "temperature", systemKind: "regex", examples: ["영상 10℃"] },
  { id: "sys-time", name: "time", systemKind: "regex", examples: ["2020-02-28 15:15:00"] },
  { id: "sys-time-end", name: "time_end", systemKind: "regex", examples: ["2020-02-28 16:30:00"] },
  { id: "sys-time-start", name: "time_start", systemKind: "regex", examples: ["2020-02-28 15:15:00"] },
  { id: "sys-times", name: "times", systemKind: "regex", examples: ["100번", "100회"] },
  { id: "sys-transportation", name: "transportation", systemKind: "regex", examples: ["지하철", "버스"] },
  { id: "sys-url", name: "url", systemKind: "regex", examples: ["http://www.test.com"] },
  { id: "sys-vehicle", name: "vehicle_num", systemKind: "regex", examples: ["12가3456", "123나4567"] },
  { id: "sys-volume", name: "volume", systemKind: "regex", examples: ["10ml", "10L"] },
  { id: "sys-weight", name: "weight", systemKind: "regex", examples: ["10kg", "100g"] },
];

function createSystemEntity(definition: SystemEntityDefinition): VersionEntityAsset {
  const base = createEmptyVersionEntity();
  return {
    ...base,
    id: definition.id,
    name: definition.name,
    system: true,
    systemKind: definition.systemKind,
    examples: definition.examples,
    standardExpression: definition.standardExpression ?? "",
    intentEnabled: true,
    qaEnabled: false,
    rows: [
      {
        id: `${definition.id}-row`,
        value: definition.examples[0] ?? "",
        rowType: definition.systemKind === "regex" ? "P" : "S",
        details: definition.examples,
      },
    ],
    updatedAt: "",
    updatedBy: "-",
  };
}

export function getSystemEntities(): VersionEntityAsset[] {
  return SYSTEM_ENTITY_DEFINITIONS.map((item) => createSystemEntity(item));
}

export function getBotUserEntities(bot?: StudioBotApiItem | null): VersionEntityAsset[] {
  return normalizeVersionEntities(getBotVersionDocument(bot).entities).filter(isUserVersionEntityAsset);
}

export function getBotEntities(bot?: StudioBotApiItem | null): VersionEntityAsset[] {
  return [...getBotUserEntities(bot), ...getSystemEntities()];
}

export function getVersionUserEntities(version?: StudioBotVersionApiItem | null): VersionEntityAsset[] {
  return normalizeVersionEntities(getVersionDocument(version).entities).filter(isUserVersionEntityAsset);
}

export function getVersionEntities(version?: StudioBotVersionApiItem | null): VersionEntityAsset[] {
  return [...getVersionUserEntities(version), ...getSystemEntities()];
}

export function withUpdatedEntities(
  document: VersionDocument,
  entities: VersionEntityAsset[],
): VersionDocument {
  return {
    ...document,
    entities: entities.filter((item) => !item.system),
  };
}

export function applyUpdatedVersionToBot(
  bot: StudioBotApiItem,
  version: StudioBotVersionApiItem,
): StudioBotApiItem {
  if (!bot.active_version || bot.active_version.id !== version.id) {
    return bot;
  }

  return {
    ...bot,
    active_version: version,
    active_version_id: version.id,
    updated_at: version.updated_at ?? bot.updated_at,
  };
}

export function getEntityTypeLabel(entity: VersionEntityAsset) {
  if (entity.system) {
    return "시스템 개체";
  }
  return "사용자 개체";
}

export function getEntityValueCount(entity: VersionEntityAsset) {
  return entity.rows.length;
}

export function formatEntityUpdatedAt(entity: VersionEntityAsset) {
  if (!entity.updatedAt) {
    return "-";
  }
  return entity.updatedAt.replace("T", " ").slice(0, 16);
}

export function getEntityPreviewValue(entity: VersionEntityAsset) {
  if (entity.rows.length > 0) {
    return entity.rows
      .map((row) => row.value.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");
  }

  if (entity.system && entity.examples && entity.examples.length > 0) {
    return entity.examples.slice(0, 3).join(", ");
  }

  return "";
}

type EntityUsageTarget = {
  key: "dialogs" | "dialog_flow_graphs";
  section: string;
};

const ENTITY_USAGE_TARGETS: EntityUsageTarget[] = [
  { key: "dialogs", section: "대화(시작표현)" },
  { key: "dialog_flow_graphs", section: "대화설계" },
];

function hasExactEntityReference(value: unknown, needles: string[]): boolean {
  const normalizedNeedles = needles.map((item) => item.trim()).filter(Boolean);
  if (normalizedNeedles.length === 0) {
    return false;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim();
    return normalizedNeedles.includes(normalizedValue);
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasExactEntityReference(item, normalizedNeedles));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((item) => hasExactEntityReference(item, normalizedNeedles));
  }

  return false;
}

function resolveUsageLabel(source: Record<string, unknown>, fallback: string) {
  const candidates = [
    source.displayName,
    source.dialogName,
    source.dialog_name,
    source.title,
    source.name,
    source.label,
    source.word,
    source.id,
  ];

  const value = candidates.find((item): item is string => typeof item === "string" && item.trim().length > 0);
  return value?.trim() || fallback;
}

function scanUsageCollection(
  value: unknown,
  needles: string[],
  section: string,
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return [];
      }

      if (!hasExactEntityReference(item, needles)) {
        return [];
      }

      const label = resolveUsageLabel(item as Record<string, unknown>, `${section} ${index + 1}`);
      return [`${section}(${label})`];
    });
  }

  if (value && typeof value === "object" && hasExactEntityReference(value, needles)) {
    return [section];
  }

  return [];
}

export function findEntityUsageReferences(
  document: VersionDocument,
  entity: Pick<VersionEntityAsset, "id" | "name">,
) {
  const normalizedNeedles = [entity.id, entity.name].map((item) => item.trim()).filter(Boolean);
  if (normalizedNeedles.length === 0) {
    return [];
  }

  const matches = ENTITY_USAGE_TARGETS.flatMap((target) =>
    scanUsageCollection(document[target.key], normalizedNeedles, target.section),
  );

  return [...new Set(matches)];
}
