import { type BlocklistConfig, type RuleConfig, type SmalltalkItemConfig } from "@/lib/bot-settings";
import {
  createEmptyVersionDictionary,
  type VersionDictionaryAsset,
  type VersionEntityAsset,
  type VersionEntityRow,
} from "@/lib/version-document";

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, "");
}

function splitLines(text: string) {
  return stripBom(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseDelimitedLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function escapeDelimitedValue(value: string) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export type ParsedEntityImportRow = {
  name: string;
  value: string;
  rowType: string;
  detail: string;
};

export type ParsedDictionaryImportRow = {
  word: string;
  synonym: string;
};

export function buildAssetExportFilename(
  prefix: string,
  name: string,
  extension = "txt",
  betweenPrefixAndName = "_",
) {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const sanitizedName = name
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, "_");

  const fallbackName = sanitizedName || prefix;
  return `${prefix}${betweenPrefixAndName}${fallbackName}_${yyyy}${mm}${dd}.${extension}`;
}

function toEnabledFlag(value: string) {
  return value.trim().toUpperCase() !== "N";
}

function fromEnabledFlag(value: boolean) {
  return value ? "Y" : "N";
}

function parseBlocklistType(value: string): BlocklistConfig["type"] {
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "regex" || normalized === "정규표현식") {
    return "regex";
  }
  return "word";
}

function serializeBlocklistType(value: BlocklistConfig["type"]) {
  return value === "regex" ? "1" : "0";
}

function serializeEntityRowType(value: VersionEntityRow["rowType"]) {
  return value === "P" ? "P" : "S";
}

function createEntityBucket(name: string): VersionEntityAsset {
  return {
    id: crypto.randomUUID(),
    name,
    intentEnabled: true,
    qaEnabled: false,
    rows: [],
    updatedAt: "",
    updatedBy: "",
  };
}

export function parseBlocklistText(text: string): BlocklistConfig[] {
  const lines = splitLines(text);
  if (lines.length === 0) {
    return [];
  }

  const header = parseDelimitedLine(lines[0]);
  const dataLines = header[0] === "Blocklist 이름" ? lines.slice(1) : lines;

  return dataLines.reduce<BlocklistConfig[]>((items, line) => {
    const cells = parseDelimitedLine(line);
      const [name = "", type = "", pattern = "", enabled = "Y"] = cells;
      if (!name || !pattern) {
        return items;
      }

      items.push({
        id: crypto.randomUUID(),
        name,
        type: parseBlocklistType(type),
        pattern,
        description: "",
        enabled: toEnabledFlag(enabled),
        updatedAt: "",
        updatedBy: "",
      } satisfies BlocklistConfig);
      return items;
    }, []);
}

export function buildBlocklistText(items: BlocklistConfig[]) {
  const header = ["Blocklist 이름", "유형", "제외 단어/정규 표현식", "사용여부"];
  const rows = items.map((item) => [
    item.name,
    serializeBlocklistType(item.type),
    item.pattern,
    fromEnabledFlag(item.enabled),
  ]);

  return [header, ...rows]
    .map((row) => row.map((cell) => escapeDelimitedValue(cell)).join(","))
    .join("\r\n");
}

export function parseRuleText(text: string): RuleConfig[] {
  const lines = splitLines(text);
  if (lines.length === 0) {
    return [];
  }

  const header = parseDelimitedLine(lines[0]);
  const dataLines = header[0] === "룰 이름" ? lines.slice(1) : lines;

  return dataLines.reduce<RuleConfig[]>((items, line) => {
    const cells = parseDelimitedLine(line);
      const [name = "", description = "", expression = "", target = "", enabled = "Y"] = cells;
      if (!name || !expression) {
        return items;
      }

      items.push({
        id: crypto.randomUUID(),
        name,
        description,
        expression,
        target,
        enabled: toEnabledFlag(enabled),
        updatedAt: "",
        updatedBy: "",
      } satisfies RuleConfig);
      return items;
    }, []);
}

export function buildRuleText(items: RuleConfig[]) {
  const header = ["룰 이름", "룰 설명", "룰 표현식", "연결 의도/모듈", "사용여부(Y/N)"];
  const rows = items.map((item) => [
    item.name,
    item.description,
    item.expression,
    item.target,
    fromEnabledFlag(item.enabled),
  ]);

  return [header, ...rows]
    .map((row) => row.map((cell) => escapeDelimitedValue(cell)).join(","))
    .join("\r\n");
}

function parseSmalltalkPriority(value: string): SmalltalkItemConfig["priority"] {
  const normalized = value.trim().toLowerCase();
  if (normalized === "high") {
    return "High";
  }
  if (normalized === "low") {
    return "Low";
  }
  return "Medium";
}

function splitSmalltalkMessages(value: string) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseSmalltalkText(text: string): SmalltalkItemConfig[] {
  const lines = splitLines(text);
  if (lines.length === 0) {
    return [];
  }

  const header = parseDelimitedLine(lines[0]);
  const dataLines = header[0] === "스몰토크 이름" ? lines.slice(1) : lines;

  return dataLines.reduce<SmalltalkItemConfig[]>((items, line) => {
    const cells = parseDelimitedLine(line);
    const [title = "", priority = "Medium", userMessages = "", botMessages = "", enabled = "Y"] = cells;
    if (!title.trim()) {
      return items;
    }

    const normalizedUserMessages = splitSmalltalkMessages(userMessages);
    const normalizedBotMessages = splitSmalltalkMessages(botMessages);
    if (normalizedUserMessages.length === 0 || normalizedBotMessages.length === 0) {
      return items;
    }

    items.push({
      id: crypto.randomUUID(),
      title: title.trim(),
      priority: parseSmalltalkPriority(priority),
      utterance: normalizedUserMessages[0] ?? "",
      response: normalizedBotMessages[0] ?? "",
      userMessages: normalizedUserMessages,
      botMessages: normalizedBotMessages,
      enabled: toEnabledFlag(enabled),
      createdAt: "",
      createdBy: "",
      updatedAt: "",
      updatedBy: "",
    } satisfies SmalltalkItemConfig);
    return items;
  }, []);
}

export function buildSmalltalkText(items: SmalltalkItemConfig[]) {
  const header = ["스몰토크 이름", "우선순위", "사용자 메시지", "봇 메시지", "사용여부(Y/N)"];
  const rows = items.map((item) => [
    item.title,
    item.priority ?? "Medium",
    (item.userMessages ?? []).map((value) => value.trim()).filter(Boolean).join("|"),
    (item.botMessages ?? []).map((value) => value.trim()).filter(Boolean).join("|"),
    fromEnabledFlag(item.enabled),
  ]);

  return [header, ...rows]
    .map((row) => row.map((cell) => escapeDelimitedValue(cell)).join(","))
    .join("\r\n");
}

export function parseEntityText(text: string): VersionEntityAsset[] {
  const rows = parseEntityImportRows(text);
  const buckets = new Map<string, VersionEntityAsset>();

  for (const row of rows) {
    const normalizedName = row.name.trim();
    const normalizedValue = row.value.trim();
    const normalizedType = row.rowType.trim().toUpperCase() === "P" ? "P" : "S";
    const normalizedDetail = row.detail.trim();

    if (!normalizedName || !normalizedValue) {
      continue;
    }

    if (normalizedType === "P" && !normalizedDetail) {
      continue;
    }

    if (!buckets.has(normalizedName)) {
      buckets.set(normalizedName, createEntityBucket(normalizedName));
    }

    const bucket = buckets.get(normalizedName);
    if (!bucket) {
      continue;
    }

    const existingRow = bucket.rows.find(
      (item) => item.value === normalizedValue && item.rowType === normalizedType,
    );

    const normalizedDetails =
      normalizedType === "P"
        ? normalizedDetail
          ? [normalizedDetail]
          : []
        : normalizedDetail
          ? normalizedDetail
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : [];

    if (existingRow) {
      const merged =
        existingRow.rowType === "P"
          ? [...existingRow.details, ...normalizedDetails].slice(0, 5)
          : [...new Set([...existingRow.details, ...normalizedDetails])];
      existingRow.details = merged;
      continue;
    }

    bucket.rows.push({
      id: crypto.randomUUID(),
      value: normalizedValue,
      rowType: serializeEntityRowType(normalizedType),
      details: normalizedDetails,
    });
  }

  return [...buckets.values()].filter((item) => item.rows.length > 0);
}

export function parseEntityImportRows(text: string): ParsedEntityImportRow[] {
  const lines = splitLines(text);
  if (lines.length === 0) {
    return [];
  }

  const header = parseDelimitedLine(lines[0]);
  const dataLines = header[0] === "개체명" ? lines.slice(1) : lines;
  return dataLines.map((line) => {
    const [name = "", value = "", rowType = "", detail = ""] = parseDelimitedLine(line);
    return {
      name: name.trim(),
      value: value.trim(),
      rowType: rowType.trim(),
      detail: detail.trim(),
    };
  });
}

export function buildEntityText(items: VersionEntityAsset[]) {
  const header = ["개체명", "개체값", "유형(S/P)", "상세"];
  const rows = items.flatMap((item) =>
    item.rows.flatMap((row) => {
      if (row.rowType === "P") {
        return row.details.map((detail) => [
          item.name,
          row.value,
          serializeEntityRowType(row.rowType),
          detail,
        ]);
      }

      return [
        [
          item.name,
          row.value,
          serializeEntityRowType(row.rowType),
          row.details.join(","),
        ],
      ];
    }),
  );

  return [header, ...rows]
    .map((row) => row.map((cell) => escapeDelimitedValue(cell)).join(","))
    .join("\r\n");
}

export function parseDictionaryText(text: string): VersionDictionaryAsset[] {
  const rows = parseDictionaryImportRows(text);
  const lines = splitLines(text);
  if (lines.length === 0) {
    return [];
  }
  const buckets = new Map<string, VersionDictionaryAsset>();

  for (const { word, synonym } of rows) {
    if (!word.trim()) {
      continue;
    }

    if (!buckets.has(word.trim())) {
      const item = createEmptyVersionDictionary();
      item.word = word.trim();
      item.synonyms = [];
      buckets.set(word.trim(), item);
    }

    if (synonym.trim()) {
      buckets.get(word.trim())?.synonyms.push(synonym.trim());
    }
  }

  return [...buckets.values()];
}

export function parseDictionaryImportRows(text: string): ParsedDictionaryImportRow[] {
  const lines = splitLines(text);
  if (lines.length === 0) {
    return [];
  }

  const header = parseDelimitedLine(lines[0]);
  const headerFirstCell = (header[0] ?? "").trim();
  const hasDictionaryHeader = headerFirstCell === "단어" || headerFirstCell === "대표어";
  const dataLines = hasDictionaryHeader ? lines.slice(1) : lines;

  return dataLines.flatMap((line) => {
    const cells = parseDelimitedLine(line);
    const [word = "", ...synonymCells] = cells;
    const normalizedWord = word.trim();
    if (!normalizedWord) {
      return [];
    }

    if (synonymCells.length === 0) {
      return [{ word: normalizedWord, synonym: "" }];
    }

    const normalizedSynonyms = synonymCells.map((item) => item.trim());
    if (normalizedSynonyms.every((item) => !item)) {
      return [{ word: normalizedWord, synonym: "" }];
    }

    return normalizedSynonyms.map((synonym) => ({
      word: normalizedWord,
      synonym,
    }));
  });
}

export function buildDictionaryText(items: VersionDictionaryAsset[]) {
  const maxSynonymCount = Math.max(
    1,
    ...items.map((item) => item.synonyms.map((value) => value.trim()).filter(Boolean).length),
  );
  const header = ["대표어", ...Array.from({ length: maxSynonymCount }, (_, index) => `유의어${index + 1}`)];
  const rows = items.map((item) => {
    const synonyms = item.synonyms.map((value) => value.trim()).filter(Boolean);
    return [
      item.word,
      ...Array.from({ length: maxSynonymCount }, (_, index) => synonyms[index] ?? ""),
    ];
  });

  return [header, ...rows]
    .map((row) => row.map((cell) => escapeDelimitedValue(cell)).join(","))
    .join("\r\n");
}
