import { type VersionDialogAsset, type VersionDocument } from "@/lib/version-document";

export type DeepLearningLiteScore = {
  dialog: VersionDialogAsset;
  score: number;
  features: string[];
};

type TrainingDocument = {
  dialog: VersionDialogAsset;
  text: string;
  tokens: string[];
  termFrequency: Map<string, number>;
};

const MEANINGFUL_QUESTION_WORDS = new Set(["얼마나", "언제", "어디", "무엇", "뭐", "누구", "왜", "어떻게", "몇"]);
const LOW_VALUE_KOREAN_WORDS = new Set([
  "요",
  "나요",
  "인가요",
  "죠",
  "지요",
  "은",
  "는",
  "이",
  "가",
  "을",
  "를",
  "에",
  "에서",
  "으로",
  "로",
  "와",
  "과",
  "도",
  "만",
]);
const SELF_CALL_PATTERNS = [
  /(?:내가|제가|저가|나중에|다음에|추후에|좀 있다가|시간되면).{0,12}전화(?:해서|할게|할게요|걸게|걸게요|드릴게|드릴게요|드려도|하겠습니다)/u,
  /전화(?:해서|할게|할게요|걸게|걸게요|드릴게|드릴게요|드려도|하겠습니다)/u,
  /(?:제가|내가).{0,10}(?:알아서|혼자|직접).{0,10}(?:할게|할게요|하겠습니다)/u,
  /(?:제가|내가).{0,14}(?:다시|나중에|다음에).{0,12}전화(?:드려도|해도|할게|할게요|드릴게요)/u,
  /전화.{0,8}(?:안줘도|안 주셔도|안주셔도|안 줘도).{0,8}(?:됩니다|돼요|괜찮)/u,
];
const CALL_ME_PATTERNS = [
  /전화.{0,8}(?:해줘|해주세요|줘|주세요|주시겠|주실|달라|바랍니다)/u,
  /(?:콜백|연락).{0,8}(?:해줘|해주세요|줘|주세요|주시겠|주실|달라|바랍니다)/u,
];

export type DeepLearningLiteModel = {
  documents: TrainingDocument[];
  inverseDocumentFrequency: Map<string, number>;
  dialogCentroids: Array<{
    dialog: VersionDialogAsset;
    vector: Map<string, number>;
    utteranceCount: number;
  }>;
};

export type DeepLearningLiteTrainOptions = {
  imbalanceOversampling?: boolean;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase() : "";
}

function charNgrams(value: string, size: number) {
  const compact = value.replace(/[^\p{L}\p{N}]+/gu, "");
  if (compact.length < size) {
    return compact ? [compact] : [];
  }

  const grams: string[] = [];
  for (let index = 0; index <= compact.length - size; index += 1) {
    grams.push(compact.slice(index, index + size));
  }
  return grams;
}

function isHangul(value: string) {
  return /^[가-힣]+$/u.test(value);
}

function isLowValueKoreanWord(value: string) {
  const normalized = normalizeText(value);
  if (!isHangul(normalized) || MEANINGFUL_QUESTION_WORDS.has(normalized)) {
    return false;
  }
  return (
    normalized.length <= 1 ||
    LOW_VALUE_KOREAN_WORDS.has(normalized) ||
    /^(요|나요|인가요|죠|지요|습니까)$/u.test(normalized)
  );
}

function hasAnyPattern(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function getCallDirection(value: string) {
  if (hasAnyPattern(value, SELF_CALL_PATTERNS)) {
    return "self" as const;
  }
  if (hasAnyPattern(value, CALL_ME_PATTERNS)) {
    return "call_me" as const;
  }
  return "none" as const;
}

function hasCallDirectionConflict(inputText: string, documentText: string) {
  const inputDirection = getCallDirection(inputText);
  const documentDirection = getCallDirection(documentText);
  return (
    (inputDirection === "call_me" && documentDirection === "self") ||
    (inputDirection === "self" && documentDirection === "call_me")
  );
}

function hasCallDirectionAlignment(inputText: string, documentText: string) {
  const inputDirection = getCallDirection(inputText);
  return inputDirection !== "none" && inputDirection === getCallDirection(documentText);
}

function wordTokens(value: string) {
  return normalizeText(value)
    .split(/[^\p{L}\p{N}_]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hangulSyllables(value: string) {
  return Array.from(value).filter((item) => /^[가-힣]$/u.test(item));
}

function koreanSoftStem(value: string) {
  if (!isHangul(value)) {
    return value;
  }

  return value
    .replace(/(인가요|나요|어요|아요|죠|지요|는데요|는데|나요|습니까|어요)$/u, "")
    .replace(/(걸려|걸리)$/u, "걸")
    .replace(/(하려고|하나요|하나요|해야되요|해야돼요|되나요|돼요)$/u, "하")
    .replace(/(나요|어요|아요|죠|요)$/u, "");
}

function expandedWordTokens(value: string) {
  const tokens = wordTokens(value);
  const expanded = new Set<string>();

  tokens.forEach((token) => {
    expanded.add(token);
    const stem = koreanSoftStem(token);
    if (stem && stem !== token) {
      expanded.add(stem);
    }
    if (isHangul(token) && token.length >= 3) {
      expanded.add(token.slice(0, 2));
      expanded.add(token.slice(0, 3));
    }
  });

  return Array.from(expanded).filter(Boolean);
}

export function tokenizeForDeepLearningLite(value: string) {
  const normalized = normalizeText(value);
  const words = expandedWordTokens(normalized);

  return Array.from(new Set([...words, ...charNgrams(normalized, 2), ...charNgrams(normalized, 3)]));
}

function termFrequency(tokens: string[]) {
  const map = new Map<string, number>();
  tokens.forEach((token) => {
    map.set(token, (map.get(token) ?? 0) + 1);
  });
  return map;
}

function buildVector(termMap: Map<string, number>, inverseDocumentFrequency: Map<string, number>) {
  const vector = new Map<string, number>();
  let norm = 0;

  termMap.forEach((count, token) => {
    const value = count * (inverseDocumentFrequency.get(token) ?? 1);
    vector.set(token, value);
    norm += value * value;
  });

  const length = Math.sqrt(norm) || 1;
  vector.forEach((value, token) => {
    vector.set(token, value / length);
  });

  return vector;
}

function mergeCentroid(vectors: Array<Map<string, number>>) {
  const merged = new Map<string, number>();

  vectors.forEach((vector) => {
    vector.forEach((value, token) => {
      merged.set(token, (merged.get(token) ?? 0) + value);
    });
  });

  const divisor = Math.max(vectors.length, 1);
  merged.forEach((value, token) => {
    merged.set(token, value / divisor);
  });

  let norm = 0;
  merged.forEach((value) => {
    norm += value * value;
  });

  const length = Math.sqrt(norm) || 1;
  merged.forEach((value, token) => {
    merged.set(token, value / length);
  });

  return merged;
}

function cosineSimilarity(left: Map<string, number>, right: Map<string, number>) {
  let score = 0;
  left.forEach((value, token) => {
    score += value * (right.get(token) ?? 0);
  });
  return score;
}

function overlapCount(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((token) => rightSet.has(token)).length;
}

function overlapCoefficient(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }
  return overlapCount(Array.from(new Set(left)), Array.from(new Set(right))) / Math.min(new Set(left).size, new Set(right).size);
}

function diceCoefficient(left: string[], right: string[]) {
  const leftSet = Array.from(new Set(left));
  const rightSet = Array.from(new Set(right));
  if (leftSet.length === 0 || rightSet.length === 0) {
    return 0;
  }
  return (2 * overlapCount(leftSet, rightSet)) / (leftSet.length + rightSet.length);
}

function matchedTokens(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return Array.from(new Set(left.filter((token) => rightSet.has(token)))).slice(0, 5);
}

function wordSimilarity(left: string, right: string) {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }
  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  const hasLowValueWord = isLowValueKoreanWord(normalizedLeft) || isLowValueKoreanWord(normalizedRight);
  const leftStem = koreanSoftStem(normalizedLeft);
  const rightStem = koreanSoftStem(normalizedRight);
  const stemScore = !hasLowValueWord && leftStem && rightStem && leftStem === rightStem ? 0.9 : 0;
  const containsScore =
    !hasLowValueWord &&
    Math.min(normalizedLeft.length, normalizedRight.length) >= 3 &&
    (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft))
      ? 0.82
      : 0;
  const bigramScore = diceCoefficient(charNgrams(normalizedLeft, 2), charNgrams(normalizedRight, 2)) * 0.86;
  const trigramScore = diceCoefficient(charNgrams(normalizedLeft, 3), charNgrams(normalizedRight, 3)) * 0.92;
  const syllableScore = diceCoefficient(hangulSyllables(normalizedLeft), hangulSyllables(normalizedRight)) * 0.94;
  const sameFirstSyllable =
    !hasLowValueWord &&
    hangulSyllables(normalizedLeft)[0] &&
    hangulSyllables(normalizedLeft)[0] === hangulSyllables(normalizedRight)[0]
      ? 0.55
      : 0;

  const score = Math.max(stemScore, containsScore, bigramScore, trigramScore, syllableScore, sameFirstSyllable);
  return hasLowValueWord ? Math.min(score, 0.03) : score;
}

function averageBestWordSimilarity(leftWords: string[], rightWords: string[]) {
  if (leftWords.length === 0 || rightWords.length === 0) {
    return 0;
  }

  const scoreLeftToRight =
    leftWords.reduce((sum, left) => sum + Math.max(...rightWords.map((right) => wordSimilarity(left, right))), 0) /
    leftWords.length;
  const scoreRightToLeft =
    rightWords.reduce((sum, right) => sum + Math.max(...leftWords.map((left) => wordSimilarity(right, left))), 0) /
    rightWords.length;

  return (scoreLeftToRight + scoreRightToLeft) / 2;
}

function documentFeatureMatches(inputText: string, documentText: string, inputTokens: string[], documentTokens: string[]) {
  const documentWords = wordTokens(documentText);
  const exactWords = wordTokens(inputText).filter((token) => documentWords.includes(token));
  const fuzzyWords = wordTokens(inputText).filter(
    (token) => !exactWords.includes(token) && documentWords.some((documentToken) => wordSimilarity(token, documentToken) >= 0.55),
  );
  const tokenMatches = matchedTokens(inputTokens, documentTokens).filter((token) => token.length > 1);

  return Array.from(new Set([...exactWords, ...fuzzyWords, ...tokenMatches])).slice(0, 5);
}

function isMeaningfulLearningToken(value: string) {
  const normalized = normalizeText(value);
  return normalized.length > 1 && !isLowValueKoreanWord(normalized);
}

function calculateIntentCoverageScore(inputText: string, dialogDocuments: TrainingDocument[]) {
  const inputWords = expandedWordTokens(inputText).filter(isMeaningfulLearningToken);
  if (inputWords.length === 0 || dialogDocuments.length === 0) {
    return 0;
  }

  const documentWords = Array.from(
    new Set(dialogDocuments.flatMap((document) => expandedWordTokens(document.text)).filter(isMeaningfulLearningToken)),
  );
  if (documentWords.length === 0) {
    return 0;
  }

  const queryCoverage =
    inputWords.reduce((sum, inputWord) => {
      const best = Math.max(...documentWords.map((documentWord) => wordSimilarity(inputWord, documentWord)));
      return sum + best;
    }, 0) / inputWords.length;
  const exactCoverage = overlapCoefficient(inputWords, documentWords);

  if (queryCoverage < 0.68 && exactCoverage < 0.45) {
    return 0;
  }

  return Math.min(0.94, Math.max(queryCoverage * 0.9, exactCoverage * 0.96));
}

function calculateDocumentScore(inputText: string, documentText: string, inputTokens: string[], documentTokens: string[]) {
  const normalizedInput = normalizeText(inputText);
  const normalizedDocument = normalizeText(documentText);
  if (!normalizedInput || !normalizedDocument) {
    return 0;
  }
  if (normalizedInput === normalizedDocument) {
    return 1;
  }

  const inputWords = expandedWordTokens(normalizedInput);
  const documentWords = expandedWordTokens(normalizedDocument);
  const inputSurfaceWords = wordTokens(normalizedInput);
  const documentSurfaceWords = wordTokens(normalizedDocument);
  const inputBigrams = charNgrams(normalizedInput, 2);
  const documentBigrams = charNgrams(normalizedDocument, 2);
  const inputTrigrams = charNgrams(normalizedInput, 3);
  const documentTrigrams = charNgrams(normalizedDocument, 3);
  const containsScore =
    normalizedInput.includes(normalizedDocument) || normalizedDocument.includes(normalizedInput) ? 0.88 : 0;
  const wordOverlap = overlapCoefficient(inputWords, documentWords);
  const wordScore = wordOverlap * 0.96;
  const tokenScore = overlapCoefficient(inputTokens, documentTokens) * 0.82;
  const bigramScore = diceCoefficient(inputBigrams, documentBigrams) * 0.9;
  const trigramScore = diceCoefficient(inputTrigrams, documentTrigrams) * 0.96;
  const fuzzyWordScore = averageBestWordSimilarity(inputSurfaceWords, documentSurfaceWords) * 0.98;
  const blendedScore = wordOverlap >= 0.45 ? Math.max(wordScore, (wordScore * 0.55) + (bigramScore * 0.25) + (trigramScore * 0.2)) : 0;
  const directionMultiplier = hasCallDirectionConflict(normalizedInput, normalizedDocument) ? 0.35 : 1;
  const directionBoost = hasCallDirectionAlignment(normalizedInput, normalizedDocument) ? 0.08 : 0;

  return (
    Math.min(
      1,
      Math.max(containsScore, wordScore, tokenScore, bigramScore, trigramScore, fuzzyWordScore, blendedScore) + directionBoost,
    ) *
    directionMultiplier
  );
}

function getTopFeatures(inputVector: Map<string, number>, centroidVector: Map<string, number>) {
  return Array.from(inputVector.entries())
    .map(([token, value]) => ({ token, weight: value * (centroidVector.get(token) ?? 0) }))
    .filter((item) => item.weight > 0)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 5)
    .map((item) => item.token);
}

function applyImbalanceOversampling(documents: TrainingDocument[]) {
  const byDialog = new Map<string, TrainingDocument[]>();
  documents.forEach((document) => {
    const current = byDialog.get(document.dialog.id) ?? [];
    current.push(document);
    byDialog.set(document.dialog.id, current);
  });
  if (byDialog.size < 2) {
    return documents;
  }
  const maxCount = Math.max(...Array.from(byDialog.values()).map((items) => items.length));
  if (maxCount <= 1) {
    return documents;
  }
  const nextDocuments = [...documents];
  byDialog.forEach((items) => {
    for (let index = items.length; index < maxCount; index += 1) {
      nextDocuments.push(items[index % items.length]);
    }
  });
  return nextDocuments;
}

export function trainDeepLearningLite(
  versionDocument: VersionDocument,
  options: DeepLearningLiteTrainOptions = {},
): DeepLearningLiteModel {
  const trainingDocuments = versionDocument.dialogs
    .filter((dialog) => dialog.dialogType === 1)
    .flatMap((dialog) =>
      dialog.utterances
        .filter((utterance) => utterance.utteranceType === "T")
        .map((utterance) => normalizeText(utterance.text))
        .filter(Boolean)
        .map((text) => {
          const tokens = tokenizeForDeepLearningLite(text);
          return {
            dialog,
            text,
            tokens,
            termFrequency: termFrequency(tokens),
          } satisfies TrainingDocument;
        }),
    );
  const baseDocuments =
    trainingDocuments.length > 0
      ? trainingDocuments
      : versionDocument.dialogs
          .filter((dialog) => dialog.dialogType === 1)
          .flatMap((dialog) =>
            dialog.utterances
              .map((utterance) => normalizeText(utterance.text))
              .filter(Boolean)
              .map((text) => {
                const tokens = tokenizeForDeepLearningLite(text);
                return {
                  dialog,
                  text,
                  tokens,
                  termFrequency: termFrequency(tokens),
                } satisfies TrainingDocument;
              }),
          );
  const documents = options.imbalanceOversampling ? applyImbalanceOversampling(baseDocuments) : baseDocuments;

  const documentFrequency = new Map<string, number>();
  documents.forEach((document) => {
    new Set(document.tokens).forEach((token) => {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    });
  });

  const inverseDocumentFrequency = new Map<string, number>();
  documentFrequency.forEach((count, token) => {
    inverseDocumentFrequency.set(token, Math.log((documents.length + 1) / (count + 1)) + 1);
  });

  const vectorsByDialog = new Map<string, { dialog: VersionDialogAsset; vectors: Array<Map<string, number>> }>();
  documents.forEach((document) => {
    const current = vectorsByDialog.get(document.dialog.id) ?? { dialog: document.dialog, vectors: [] };
    current.vectors.push(buildVector(document.termFrequency, inverseDocumentFrequency));
    vectorsByDialog.set(document.dialog.id, current);
  });

  return {
    documents,
    inverseDocumentFrequency,
    dialogCentroids: Array.from(vectorsByDialog.values()).map((item) => ({
      dialog: item.dialog,
      vector: mergeCentroid(item.vectors),
      utteranceCount: item.vectors.length,
    })),
  };
}

export function classifyDeepLearningLite(model: DeepLearningLiteModel, utterance: string): DeepLearningLiteScore[] {
  const normalizedUtterance = normalizeText(utterance);
  const tokens = tokenizeForDeepLearningLite(normalizedUtterance);
  const inputVector = buildVector(termFrequency(tokens), model.inverseDocumentFrequency);

  return model.dialogCentroids
    .map((centroid) => {
      const dialogDocuments = model.documents.filter((document) => document.dialog.id === centroid.dialog.id);
      const documentScores = dialogDocuments
        .map((document) => ({
          document,
          score: calculateDocumentScore(normalizedUtterance, document.text, tokens, document.tokens),
        }))
        .sort((left, right) => right.score - left.score);
      const bestDocument = documentScores[0];
      const topDocumentScores = documentScores.slice(0, 3).map((item) => item.score);
      const supportedDocumentCount = documentScores.filter((item) => item.score >= 0.45).length;
      const topDocumentAverage =
        topDocumentScores.length > 0
          ? topDocumentScores.reduce((sum, score) => sum + score, 0) / topDocumentScores.length
          : 0;
      const clusterSupportScore =
        supportedDocumentCount >= 2 && bestDocument
          ? Math.min(0.96, bestDocument.score + Math.min(0.1, topDocumentAverage * 0.12))
          : 0;
      const intentCoverageScore = calculateIntentCoverageScore(normalizedUtterance, dialogDocuments);
      const exactBoost = model.documents.some(
        (document) => document.dialog.id === centroid.dialog.id && document.text === normalizedUtterance,
      )
        ? 0.15
        : 0;
      const centroidScore = Math.min(1, cosineSimilarity(inputVector, centroid.vector) + exactBoost);
      const directionMultiplier =
        bestDocument && hasCallDirectionConflict(normalizedUtterance, bestDocument.document.text) ? 0.35 : 1;
      const rawScore =
        Math.max(centroidScore, bestDocument?.score ?? 0, clusterSupportScore, intentCoverageScore) * directionMultiplier;
      const features = Array.from(
        new Set([
          ...(bestDocument
            ? documentFeatureMatches(normalizedUtterance, bestDocument.document.text, tokens, bestDocument.document.tokens)
            : []),
          ...getTopFeatures(inputVector, centroid.vector),
        ]),
      ).slice(0, 5);
      return {
        dialog: centroid.dialog,
        score: Math.round(rawScore * 10000) / 100,
        features,
      } satisfies DeepLearningLiteScore;
    })
    .sort((left, right) => right.score - left.score);
}
