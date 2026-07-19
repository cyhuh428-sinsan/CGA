function repairLooseJsonBackslashes(value: string) {
  return value.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
}

function parseJsonCandidate(value: string): unknown | null {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    const repaired = repairLooseJsonBackslashes(value);
    if (repaired === value) return null;
    try {
      return JSON.parse(repaired) as unknown;
    } catch {
      return null;
    }
  }
}

function parseJsonOrComponentList(value: string): unknown | null {
  const direct = parseJsonCandidate(value);
  if (direct !== null) return direct;
  return parseJsonCandidate(`[${value}]`);
}
export type AidotRichFormComponent = {
  type?: string;
  [key: string]: unknown;
};

export type AidotRichFormEnvelope = {
  webchatRichFormVersion?: string;
  richForm?: AidotRichFormComponent[];
  [key: string]: unknown;
};

export function parseAidotRichForm(value: unknown): AidotRichFormEnvelope | null {
  let parsed = value;
  if (typeof parsed === "string") {
    const trimmed = parsed.trim();
    if (!trimmed) return null;
    try {
      parsed = parseJsonOrComponentList(trimmed);
    } catch {
      return null;
    }
  }

  if (Array.isArray(parsed)) {
    return { richForm: parsed.filter((item): item is AidotRichFormComponent => Boolean(item) && typeof item === "object") };
  }

  if (!parsed || typeof parsed !== "object") return null;
  if (typeof (parsed as AidotRichFormComponent).type === "string") {
    return { richForm: [parsed as AidotRichFormComponent] };
  }
  const record = parsed as AidotRichFormEnvelope;
  if (!Array.isArray(record.richForm)) return null;
  return {
    ...record,
    richForm: record.richForm.filter((item): item is AidotRichFormComponent => Boolean(item) && typeof item === "object"),
  };
}

export function getAidotRichFormComponents(value: unknown): AidotRichFormComponent[] {
  return parseAidotRichForm(value)?.richForm || [];
}

export function readAidotRichFormString(component: AidotRichFormComponent, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = component[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
  }
  return fallback;
}

export function readAidotRichFormArray(component: AidotRichFormComponent, keys: string[]) {
  for (const key of keys) {
    const value = component[key];
    if (Array.isArray(value)) return value;
  }
  return [] as unknown[];
}

