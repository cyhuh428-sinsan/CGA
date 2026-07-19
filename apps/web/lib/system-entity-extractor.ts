export type SystemEntityMatch = {
  value: string;
  target: string;
  start: number;
  end: number;
};

import {
  COMPANY_LOOKUP_ENTRIES,
  LOCATION_LOOKUP_ENTRIES,
  SCHOOL_LOOKUP_ENTRIES,
  type LookupEntry,
} from "@/lib/system-entity-lookup-data";

type SystemEntityExtractor = (text: string) => SystemEntityMatch[];

function collectRegexMatches(pattern: RegExp, text: string) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const regex = new RegExp(pattern.source, flags);
  const matches: SystemEntityMatch[] = [];

  let match = regex.exec(text);
  while (match) {
    const value = match[0]?.trim();
    if (value) {
      matches.push({
        value,
        target: value,
        start: match.index,
        end: match.index + value.length,
      });
    }
    match = regex.exec(text);
  }

  return matches;
}

function uniqueMatches(matches: SystemEntityMatch[]) {
  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = `${match.value}-${match.start}-${match.end}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildRegexExtractor(pattern: RegExp): SystemEntityExtractor {
  return (text) => uniqueMatches(collectRegexMatches(pattern, text));
}

function buildLookupExtractor(patterns: RegExp[]): SystemEntityExtractor {
  return (text) =>
    uniqueMatches(
      patterns.flatMap((pattern) => collectRegexMatches(pattern, text)),
    ).sort((left, right) => left.start - right.start);
}

function extractRangeEndpoints(text: string, keyword: "date" | "day" | "time") {
  const tokenSource =
    keyword === "date"
      ? String.raw`(?:\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}월\s?\d{1,2}일|오늘|내일|모레|어제|그제)`
      : keyword === "day"
        ? String.raw`(?:월요일|화요일|수요일|목요일|금요일|토요일|일요일|평일|주말|오늘|내일|모레|어제)`
        : String.raw`(?:(?:오전|오후)\s*)?\d{1,2}(?::\d{2}(?::\d{2})?)?\s*(?:시|분)?`;
  const rangePattern = new RegExp(
    `${tokenSource}\\s*(?:부터|에서)\\s*${tokenSource}`,
    "g",
  );
  const tokenPattern = new RegExp(tokenSource, "g");
  const startMatches: SystemEntityMatch[] = [];
  const endMatches: SystemEntityMatch[] = [];

  for (const match of text.matchAll(rangePattern)) {
    const segment = match[0];
    const segmentStart = match.index ?? 0;
    const tokenMatches = [...segment.matchAll(tokenPattern)];
    if (tokenMatches.length >= 2) {
      const first = tokenMatches[0];
      const last = tokenMatches[tokenMatches.length - 1];
      const firstValue = first[0]?.trim();
      const lastValue = last[0]?.trim();
      if (firstValue) {
        startMatches.push({
          value: firstValue,
          target: resolveEntityTargetValue(
            keyword === "date" ? "date_start" : keyword === "day" ? "day_start" : "time_start",
            firstValue,
          ),
          start: segmentStart + (first.index ?? 0),
          end: segmentStart + (first.index ?? 0) + firstValue.length,
        });
      }
      if (lastValue) {
        endMatches.push({
          value: lastValue,
          target: resolveEntityTargetValue(
            keyword === "date" ? "date_end" : keyword === "day" ? "day_end" : "time_end",
            lastValue,
          ),
          start: segmentStart + (last.index ?? 0),
          end: segmentStart + (last.index ?? 0) + lastValue.length,
        });
      }
    }
  }

  return {
    start: uniqueMatches(startMatches),
    end: uniqueMatches(endMatches),
  };
}

const NAME_SURNAME =
  "김|이|박|최|정|강|조|윤|장|임|한|오|서|신|권|황|안|송|전|홍|유|고|문|양|손|배|백|허|남궁|황보|제갈|선우|서문|독고|동방|어금";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildLookupAliasMap(entries: LookupEntry[]) {
  return new Map<string, string>(
    entries.flatMap((entry) => entry.aliases.map((alias) => [alias, entry.canonical] as const)),
  );
}

function buildLookupTerms(entries: LookupEntry[]) {
  return [...new Set(entries.flatMap((entry) => entry.aliases))].sort(
    (left, right) => right.length - left.length,
  );
}

function buildCanonicalLookupExtractor(
  entries: LookupEntry[],
  fallbackPatterns: RegExp[] = [],
): SystemEntityExtractor {
  const aliasLookup = buildLookupAliasMap(entries);
  const terms = buildLookupTerms(entries);
  const patterns = terms.length > 0
    ? [new RegExp(`(?:${terms.map(escapeRegex).join("|")})`, "g"), ...fallbackPatterns]
    : [...fallbackPatterns];

  return (text) =>
    uniqueMatches(
      patterns.flatMap((pattern) => collectRegexMatches(pattern, text)).map((match) => ({
        ...match,
        target: aliasLookup.get(match.value) ?? match.value,
      })),
    ).sort((left, right) => left.start - right.start);
}

const LOCATION_LOOKUP_TERMS = [...new Set(LOCATION_LOOKUP_ENTRIES.flatMap((entry) => entry.aliases))]
  .sort((left, right) => right.length - left.length);
const LOCATION_ALIAS_LOOKUP = buildLookupAliasMap(LOCATION_LOOKUP_ENTRIES);
const LOCATION_SUFFIX_SOURCE = String.raw`[가-힣A-Za-z0-9]+(?:동|역|시|도|군|구|읍|면)`;
const LOCATION_TOKEN_SOURCE = String.raw`(?:${LOCATION_LOOKUP_TERMS.map(escapeRegex).join("|")}|${LOCATION_SUFFIX_SOURCE})`;

function normalizeLocationValue(value: string) {
  return LOCATION_ALIAS_LOOKUP.get(value) ?? value;
}

function extractLocationMatches(text: string) {
  return uniqueMatches(
    collectRegexMatches(new RegExp(LOCATION_TOKEN_SOURCE, "g"), text).map((match) => ({
      ...match,
      target: normalizeLocationValue(match.value),
    })),
  ).sort((left, right) => left.start - right.start);
}

function extractLocationBoundaryMatches(text: string, kind: "start" | "end") {
  const pattern =
    kind === "start"
      ? new RegExp(`(${LOCATION_TOKEN_SOURCE})\\s*(?:에서|부터)`, "g")
      : new RegExp(`(?:까지|으로|로)\\s*(${LOCATION_TOKEN_SOURCE})`, "g");
  const matches: SystemEntityMatch[] = [];

  for (const match of text.matchAll(pattern)) {
    const value = match[1]?.trim();
    if (!value) {
      continue;
    }

    const groupIndex = match[0].indexOf(value);
    const start = (match.index ?? 0) + Math.max(groupIndex, 0);
    matches.push({
      value,
      target: normalizeLocationValue(value),
      start,
      end: start + value.length,
    });
  }

  return uniqueMatches(matches);
}

const LOOKUP_PATTERNS = {
  transportation: [/(?:지하철|버스|택시|기차|KTX|SRT|비행기|자전거|도보|자가용|승용차|오토바이|전철)/g],
  appliance: [/(?:냉장고|세탁기|에어컨|청소기|전자레인지|건조기|프린터|모니터|TV|텔레비전|노트북|컴퓨터|정수기|공기청정기)/g],
  company_name: [/[가-힣A-Za-z0-9]+(?:전자|SDS|은행|카드|증권|생명|보험|통신|항공|건설|식품|제약|병원|연구소|공사|공단|재단|주식회사)/g],
  school_name: [/[가-힣A-Za-z0-9]+(?:초등학교|중학교|고등학교|대학교|대학|대학원)/g],
  location: [new RegExp(LOCATION_TOKEN_SOURCE, "g")],
  address: [
    /(?:[가-힣]+(?:특별시|광역시|자치시|도)\s*)?(?:[가-힣]+(?:시|군|구)\s*)?(?:[가-힣0-9]+(?:읍|면|동|로|길)\s*)+(?:\d+(?:-\d+)?)?/g,
  ],
  name: [new RegExp(`(?:${NAME_SURNAME})(?:[가-힣]{1,2})`, "g")],
} as const;

const ENTITY_EXTRACTORS: Record<string, SystemEntityExtractor> = {
  mail: buildRegexExtractor(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi),
  url: buildRegexExtractor(/\b(?:https?:\/\/|www\.)[^\s]+/gi),
  phone_num: buildRegexExtractor(/\b(?:01[016789]-?\d{3,4}-?\d{4}|0\d{1,2}-?\d{3,4}-?\d{4})\b/g),
  percentage: buildRegexExtractor(/\b\d+(?:\.\d+)?\s?(?:%|퍼센트|percent)\b/gi),
  date: buildRegexExtractor(/(?:\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}월\s?\d{1,2}일|오늘|내일|모레|어제|그제)/g),
  amount: buildRegexExtractor(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?(?:원|만원|천원|억원|달러|usd|유로|엔)\b/gi),
  transportation: buildLookupExtractor([...LOOKUP_PATTERNS.transportation]),
  age: buildRegexExtractor(/(?:만\s*)?\d{1,3}\s?(?:세|살)/g),
  times: buildRegexExtractor(/\d+\s?(?:번|회|차례|번째)/g),
  weight: buildRegexExtractor(/\d+(?:\.\d+)?\s?(?:kg|g|그램|킬로그램|톤|lb|파운드)\b/gi),
  location: extractLocationMatches,
  address: buildLookupExtractor([...LOOKUP_PATTERNS.address]),
  name: buildLookupExtractor([...LOOKUP_PATTERNS.name]),
  appliance: buildLookupExtractor([...LOOKUP_PATTERNS.appliance]),
  company_name: buildCanonicalLookupExtractor(COMPANY_LOOKUP_ENTRIES, [...LOOKUP_PATTERNS.company_name]),
  school_name: buildCanonicalLookupExtractor(SCHOOL_LOOKUP_ENTRIES, [...LOOKUP_PATTERNS.school_name]),
  code: buildRegexExtractor(/\b(?=[A-Za-z0-9-]{4,}\b)(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9-]+\b/g),
  volume: buildRegexExtractor(/\d+(?:\.\d+)?\s?(?:ml|mL|l|L|리터|cc|ℓ)\b/g),
  length: buildRegexExtractor(/\d+(?:\.\d+)?\s?(?:mm|cm|m|km|인치|ft|피트)\b/gi),
  number: buildRegexExtractor(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b/g),
  temperature: buildRegexExtractor(/(?:영하|영상)?\s?\d+(?:\.\d+)?\s?(?:℃|도|c)\b/gi),
  speed: buildRegexExtractor(/\d+(?:\.\d+)?\s?(?:km\/h|kmh|m\/s|미터\/초)\b/gi),
  point: buildRegexExtractor(/\d+(?:\.\d+)?\s?(?:포인트|점|p)\b/gi),
  ordinal_num: buildRegexExtractor(/(?:첫|둘|셋|넷|다섯|여섯|일곱|여덟|아홉|열)(?:번째|째)|\d+(?:번째|째|번)/g),
  vehicle_num: buildRegexExtractor(/\b\d{2,3}[가-힣]\d{4}\b/g),
  day: buildRegexExtractor(/(?:월요일|화요일|수요일|목요일|금요일|토요일|일요일|평일|주말|오늘|내일|모레|어제)/g),
  time: buildRegexExtractor(/(?:(?:오전|오후)\s*)?\d{1,2}(?::\d{2}(?::\d{2})?)?\s*(?:시|분)?/g),
};

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateTarget(date: Date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function resolveRelativeDateToken(value: string) {
  const today = new Date();
  const normalized = value.trim();
  const next = new Date(today);

  switch (normalized) {
    case "오늘":
      return formatDateTarget(next);
    case "내일":
      next.setDate(next.getDate() + 1);
      return formatDateTarget(next);
    case "모레":
      next.setDate(next.getDate() + 2);
      return formatDateTarget(next);
    case "어제":
      next.setDate(next.getDate() - 1);
      return formatDateTarget(next);
    case "그제":
      next.setDate(next.getDate() - 2);
      return formatDateTarget(next);
    default:
      return "";
  }
}

function normalizeDateTarget(value: string) {
  const trimmed = value.trim();
  const relative = resolveRelativeDateToken(trimmed);
  if (relative) {
    return relative;
  }

  const fullDateMatch = trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (fullDateMatch) {
    const [, year, month, day] = fullDateMatch;
    return `${year}-${padNumber(Number(month))}-${padNumber(Number(day))}`;
  }

  const monthDayMatch = trimmed.match(/^(\d{1,2})월\s?(\d{1,2})일$/);
  if (monthDayMatch) {
    const [, month, day] = monthDayMatch;
    const year = new Date().getFullYear();
    return `${year}-${padNumber(Number(month))}-${padNumber(Number(day))}`;
  }

  return trimmed;
}

function normalizeTimeTarget(value: string) {
  const trimmed = value.trim();
  const normalized = trimmed.replace(/\s+/g, "");
  const meridiemMatch = normalized.match(/^(오전|오후)?(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?(?:시|분)?$/);
  if (!meridiemMatch) {
    return trimmed;
  }

  const [, meridiem, rawHour, rawMinute, rawSecond] = meridiemMatch;
  let hour = Number(rawHour);
  const minute = Number(rawMinute ?? "0");
  const second = Number(rawSecond ?? "0");

  if (meridiem === "오후" && hour < 12) {
    hour += 12;
  }
  if (meridiem === "오전" && hour === 12) {
    hour = 0;
  }

  return `${padNumber(hour)}:${padNumber(minute)}:${padNumber(second)}`;
}

function normalizePointTarget(value: string) {
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? match[0] : value.trim();
}

function normalizeOrdinalTarget(value: string) {
  const trimmed = value.trim();
  const numberMatch = trimmed.match(/(\d+)/);
  if (numberMatch) {
    return numberMatch[1];
  }

  const ordinalMap: Record<string, string> = {
    첫: "1",
    둘: "2",
    셋: "3",
    넷: "4",
    다섯: "5",
    여섯: "6",
    일곱: "7",
    여덟: "8",
    아홉: "9",
    열: "10",
  };

  const matchedKey = Object.keys(ordinalMap).find((key) => trimmed.startsWith(key));
  return matchedKey ? ordinalMap[matchedKey] : trimmed;
}

function resolveEntityTargetValue(entityName: string, value: string) {
  if (entityName === "date" || entityName === "date_start" || entityName === "date_end") {
    return normalizeDateTarget(value);
  }

  if (entityName === "time" || entityName === "time_start" || entityName === "time_end") {
    return normalizeTimeTarget(value);
  }

  if (entityName === "point") {
    return normalizePointTarget(value);
  }

  if (entityName === "ordinal_num") {
    return normalizeOrdinalTarget(value);
  }

  return value.trim();
}

export function extractSystemEntityMatches(entityName: string, text: string): SystemEntityMatch[] {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return [];
  }

  if (entityName === "date_start" || entityName === "day_start" || entityName === "time_start") {
    const keyword = entityName.startsWith("date")
      ? "date"
      : entityName.startsWith("day")
        ? "day"
        : "time";
    return extractRangeEndpoints(normalizedText, keyword).start;
  }

  if (entityName === "date_end" || entityName === "day_end" || entityName === "time_end") {
    const keyword = entityName.startsWith("date")
      ? "date"
      : entityName.startsWith("day")
        ? "day"
        : "time";
    return extractRangeEndpoints(normalizedText, keyword).end;
  }

  if (entityName === "location_start") {
    return extractLocationBoundaryMatches(normalizedText, "start");
  }

  if (entityName === "location_end") {
    return extractLocationBoundaryMatches(normalizedText, "end");
  }

  const extractor = ENTITY_EXTRACTORS[entityName];
  return extractor
    ? extractor(normalizedText).map((match) => ({
        ...match,
        target: resolveEntityTargetValue(entityName, match.target || match.value),
      }))
    : [];
}

export function formatSystemEntityMatchValues(entityName: string, text: string) {
  return extractSystemEntityMatches(entityName, text).map((match) => match.target || match.value);
}
