import {
  isUserVersionDictionaryAsset,
  normalizeVersionDictionary,
  normalizeVersionDocument,
  type VersionDictionaryAsset,
  type VersionDocument,
} from "@/lib/version-document";
import {
  type StudioBotApiItem,
  type StudioBotVersionApiItem,
} from "@/lib/studio-bots-api";

export function hasUploadedQaKnowledge(bot?: Pick<StudioBotApiItem, "active_version"> | null) {
  return (bot?.active_version?.asset_counts?.qa ?? 0) > 0;
}

export function canEnableDictionaryQa(
  entry: Pick<VersionDictionaryAsset, "synonyms">,
  hasQaKnowledge: boolean,
) {
  return hasQaKnowledge && entry.synonyms.map((value) => value.trim()).filter(Boolean).length > 0;
}

export function getBotVersionDocument(bot?: StudioBotApiItem | null): VersionDocument {
  return normalizeVersionDocument(bot?.active_version?.version_json);
}

export function getVersionDocument(version?: StudioBotVersionApiItem | null): VersionDocument {
  return normalizeVersionDocument(version?.version_json);
}

export function getBotDictionary(bot?: StudioBotApiItem | null): VersionDictionaryAsset[] {
  return normalizeVersionDictionary(getBotVersionDocument(bot).dictionary);
}

export function getVersionDictionary(version?: StudioBotVersionApiItem | null): VersionDictionaryAsset[] {
  return normalizeVersionDictionary(getVersionDocument(version).dictionary);
}

export function getVersionUserDictionary(version?: StudioBotVersionApiItem | null): VersionDictionaryAsset[] {
  return getVersionDictionary(version).filter(isUserVersionDictionaryAsset);
}

export function withUpdatedDictionary(
  document: VersionDocument,
  dictionary: VersionDictionaryAsset[],
): VersionDocument {
  return {
    ...document,
    dictionary,
  };
}

export function applyUpdatedVersionToDictionaryBot(
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

export function formatDictionaryUpdatedAt(item: VersionDictionaryAsset) {
  if (!item.updatedAt) {
    return "-";
  }
  return item.updatedAt.replace("T", " ").slice(0, 16);
}

export function getDictionaryPreviewValue(item: VersionDictionaryAsset) {
  const values = item.synonyms.map((value) => value.trim()).filter(Boolean);
  if (values.length === 0) {
    return "-";
  }
  return values.slice(0, 3).join(", ");
}

function normalizeDictionaryToken(value: string) {
  return value.trim();
}

export function validateDictionaryEntries(entries: VersionDictionaryAsset[]) {
  const normalizedEntries = entries.map((entry) => ({
    ...entry,
    word: normalizeDictionaryToken(entry.word),
    synonyms: entry.synonyms.map((item) => normalizeDictionaryToken(item)).filter(Boolean),
  }));

  const wordOwners = new Map<string, string>();
  const synonymOwners = new Map<string, string>();

  for (const entry of normalizedEntries) {
    if (entry.word) {
      wordOwners.set(entry.word, entry.id);
    }
  }

  for (const entry of normalizedEntries) {
    for (const synonym of entry.synonyms) {
      const ownerWordId = wordOwners.get(synonym);
      if (ownerWordId && ownerWordId !== entry.id) {
        return `'${synonym}'은(는) 이미 대표 단어로 등록되어 있어 동의어로 사용할 수 없습니다.`;
      }

      const ownerSynonymId = synonymOwners.get(synonym);
      if (ownerSynonymId && ownerSynonymId !== entry.id) {
        return `'${synonym}'은(는) 다른 단어의 동의어로 이미 사용 중입니다.`;
      }

      synonymOwners.set(synonym, entry.id);
    }
  }

  for (const entry of normalizedEntries) {
    const ownerSynonymId = synonymOwners.get(entry.word);
    if (ownerSynonymId && ownerSynonymId !== entry.id) {
      return `'${entry.word}'은(는) 다른 단어의 동의어로 이미 사용 중이어서 대표 단어로 등록할 수 없습니다.`;
    }
  }

  return "";
}
