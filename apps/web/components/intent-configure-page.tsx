"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { flushSync } from "react-dom";

import { useI18n } from "@/components/language-provider";
import { StudioPageLoading } from "@/components/studio-page-loading";
import { useStudioWorkspace } from "@/components/studio-workspace-provider";
import { type SummaryStatItem } from "@/components/summary-stat-grid";
import { saveLastBotScreen, type AuthSession } from "@/lib/auth";
import { getBotVersionSettings, normalizeConfigurationScoring, type ConfigurationScoringConfig } from "@/lib/bot-settings";
import { INTENT_CONFIGURE_INPUT_CATALOGS, formatIntentConfigureInputText, getIntentConfigureCriteriaLabel } from "@/lib/i18n/intent-configure-input";
import { applyUpdatedVersionToBot, getNextDialogNo, getVersionDialogs, withEnsuredDialogFlowGraph, withUpdatedDialogs } from "@/lib/dialog-assets";
import {
  NLU_MODEL_OPTIONS_BY_TYPE,
  defaultNluModelForType,
  getNluModelDescription,
  getNluModelEmbedding,
  getNluModelLabel,
  getNluTypeLabel,
  isSemanticNluType,
  normalizeNluModel,
  type NluModelKey,
  type NluType,
} from "@/lib/nlu-options";
import {
  DEFAULT_LLM_PROVIDER,
  LLM_MODEL_OPTIONS_BY_PROVIDER,
  LLM_PROVIDER_OPTIONS,
  normalizeLlmModel,
  normalizeLlmProvider,
  type LlmModelKey,
  type LlmProvider,
} from "@/lib/llm-options";
import {
  configureStudioBotVersionLlmIntents,
  configureStudioBotVersionMlIntents,
  configureStudioBotVersionRagAnswerPdf,
  configureStudioBotVersionRagAnswers,
  configureStudioBotVersionSemanticIntents,
  fetchStudioBotVersionConfigure,
  tokenizeStudioBotVersionMlIntents,
  updateStudioBot,
  updateStudioBotVersionConfigure,
  updateStudioBotVersionDictionary,
  type RagAnswerEmbeddingResult,
  type StudioBotApiItem,
  type StudioBotVersionApiItem,
} from "@/lib/studio-bots-api";
import {
  createEmptyVersionDialog,
  createEmptyVersionDictionary,
  isUserVersionDictionaryAsset,
  isUserVersionEntityAsset,
  normalizeVersionDocument,
  normalizeVersionDialogs,
  normalizeVersionDictionary,
  normalizeVersionEntities,
  type VersionDialogAsset,
  type VersionDialogUtterance,
  type VersionDictionaryAsset,
  type VersionDocument,
  type VersionEntityAsset,
} from "@/lib/version-document";

type IntentCluster = {
  id: string;
  name: string;
  answer: string;
  utterances: string[];
  seed: string;
};

type ConfigureNluType = NluType;
type TargetCountPolicy = "minimize" | "near" | "exact";
type RagAnswerSourceType = "text" | "pdf";

type ConfigureLexicon = {
  dictionary: VersionDictionaryAsset[];
  entities: VersionEntityAsset[];
  replacements: { pattern: RegExp; replacement: string }[];
  canonicalReplacements: { pattern: RegExp; replacement: string }[];
};

type ConfigureTokenContext = {
  morphTokensByText?: Map<string, string[]>;
  inverseDocumentFrequency?: Map<string, number>;
  commonTokens?: Set<string>;
};

type DictionaryRegistrationSuggestion = {
  id: string;
  word: string;
  synonyms: string[];
  matchedTerms: string[];
};

type RecommendedNluCriteria = {
  intentCount: number;
  cutOffScore: number;
  similarIntentScore: number;
  label: string;
};

type LocalClassifyProgress = {
  stage: string;
  completed: number;
  total: number;
  label?: string;
};

type LocalClassifyProgressHandler = (progress: LocalClassifyProgress) => void;

type MlConfigureTestCandidate = {
  clusterId: string;
  clusterName: string;
  score: number;
  matchedUtterance: string;
  utteranceCount: number;
};

type MlConfigureTestResult = {
  utterance: string;
  tokens: string[];
  candidates: MlConfigureTestCandidate[];
};

function buildVersionAssetHref(
  botId: string,
  versionId: string,
  section: "intents" | "configure" | "entities" | "dictionary" | "evaluation" | "retraining" | "analysis",
) {
  return `/studio/bots/${botId}/versions/${versionId}/${section}`;
}

function resolveSelectedVersion(versions: StudioBotVersionApiItem[], versionHint: string) {
  const normalizedHint = versionHint.trim().toLowerCase();
  const versionNoMatch = /^v(\d+)$/.exec(normalizedHint);
  return (
    versions.find((version) => version.id === versionHint || version.name === versionHint) ??
    (versionNoMatch
      ? versions.find((version) => version.version_no === Number(versionNoMatch[1]))
      : undefined) ??
    null
  );
}

function recommendNluCriteria(intentCount: number): RecommendedNluCriteria {
  const normalizedCount = Math.max(1, Math.round(intentCount));
  if (normalizedCount <= 10) {
    return { intentCount: normalizedCount, cutOffScore: 0.7, similarIntentScore: 0.8, label: "소규모 의도" };
  }
  if (normalizedCount <= 30) {
    return { intentCount: normalizedCount, cutOffScore: 0.75, similarIntentScore: 0.85, label: "일반 의도" };
  }
  if (normalizedCount <= 70) {
    return { intentCount: normalizedCount, cutOffScore: 0.8, similarIntentScore: 0.88, label: "중대형 의도" };
  }
  return { intentCount: normalizedCount, cutOffScore: 0.85, similarIntentScore: 0.9, label: "대규모 의도" };
}

function recommendConfigureScoring(nluType: ConfigureNluType): ConfigurationScoringConfig {
  if (nluType === "ml") {
    return normalizeConfigurationScoring({
      dictionaryWeight: 1,
      entityWeight: 0,
      wordWeight: 1,
      gramWeight: ML_CONFIGURE_GRAM_WEIGHT,
      particleEndingWeight: 0.05,
      keyMatchScore: 0.82,
    });
  }
  return normalizeConfigurationScoring();
}

function formatCriteriaScore(value: number) {
  return value.toFixed(2);
}

function formatElapsedSeconds(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  if (minutes <= 0) {
    return `${remainingSeconds}초`;
  }
  return `${minutes}분 ${String(remainingSeconds).padStart(2, "0")}초`;
}

function buildClassifyProgressText(message: string, elapsedSeconds: number, progress?: LocalClassifyProgress | null) {
  const elapsedText = `경과 ${formatElapsedSeconds(elapsedSeconds)}`;
  if (progress && progress.total > 0) {
    const completed = Math.min(progress.completed, progress.total);
    const percent = Math.min(99, Math.floor((completed / progress.total) * 100));
    const label = progress.label ? `${progress.label} ` : "";
    return `${message} ${label}${progress.stage} ${completed}/${progress.total} (${percent}%) · ${elapsedText}`;
  }
  return `${message} · ${elapsedText} · 남은 시간은 처리량에 따라 달라집니다.`;
}

function ragConfigureStepFloorPercent(step: string) {
  if (step.includes("PDF")) return 12;
  if (step.includes("전송")) return 24;
  if (step.includes("임베딩")) return 42;
  if (step.includes("의도")) return 72;
  if (step.includes("완료")) return 100;
  return 16;
}

function ragConfigureStepCapPercent(step: string) {
  if (step.includes("완료")) return 100;
  if (step.includes("의도")) return 94;
  if (step.includes("임베딩")) return 86;
  if (step.includes("전송")) return 42;
  if (step.includes("PDF")) return 34;
  return 70;
}

function formatRagConfigureResult(result?: RagAnswerEmbeddingResult | null) {
  if (!result) {
    return "";
  }
  const count = typeof result.document_count === "number" ? result.document_count : 0;
  const model = result.embedding_model ? ` / 엔진 ${result.embedding_model}` : "";
  const title = result.document_title ? ` / 문서 ${result.document_title}` : "";
  return `답변 문서 임베딩 완료 / 조각 ${count}${model}${title}`;
}

function isRagAnswerMode(aiConfig: Record<string, unknown>) {
  const answerMode = typeof aiConfig.answer_mode === "string" ? aiConfig.answer_mode : "";
  return answerMode === "semantic_rag" || answerMode === "llm_rag";
}

function isUserDictionaryEntry(entry: VersionDictionaryAsset) {
  return isUserVersionDictionaryAsset(entry);
}

function isUserEntityEntry(entry: VersionEntityAsset) {
  return isUserVersionEntityAsset(entry);
}

function countUserDictionaryEntries(entries: VersionDictionaryAsset[]) {
  return entries.filter(isUserDictionaryEntry).length;
}

function countUserEntityEntries(entries: VersionEntityAsset[]) {
  return entries.filter(isUserEntityEntry).length;
}

function getVersionAiConfig(version: StudioBotVersionApiItem | null | undefined, bot: StudioBotApiItem | null) {
  const systemConfig = version?.version_json?.system_config;
  const aiConfig =
    systemConfig && typeof systemConfig === "object" && "ai_config" in systemConfig
      ? systemConfig.ai_config
      : null;

  if (aiConfig && typeof aiConfig === "object" && !Array.isArray(aiConfig)) {
    return {
      ...(bot?.data_json ?? {}),
      ...(aiConfig as Record<string, unknown>),
    };
  }

  return bot?.data_json ?? {};
}

function isOperatingVersion(version?: StudioBotVersionApiItem | null) {
  return version?.is_active === true;
}

function getDialogIdFromGraph(graph: Record<string, unknown>) {
  const dialogId = graph.dialogId;
  return typeof dialogId === "string" ? dialogId : "";
}

function buildSummaryCards(
  botId: string,
  versionId: string,
  bot?: StudioBotApiItem | null,
  dialogCount = 0,
  assetCounts?: { dictionary?: number; entities?: number },
): SummaryStatItem[] {
  const counts = bot?.active_version?.asset_counts;
  const entityCount = assetCounts?.entities ?? counts?.entities ?? 0;
  const dictionaryCount = assetCounts?.dictionary ?? counts?.dictionary ?? 0;
  return [
    { label: "의도", value: String(counts?.dialogs ?? dialogCount ?? (counts?.intents ?? 0)), href: buildVersionAssetHref(botId, versionId, "intents") },
    { label: "구성", value: "-", active: true, href: buildVersionAssetHref(botId, versionId, "configure") },
    { label: "개체", value: String(entityCount), href: buildVersionAssetHref(botId, versionId, "entities") },
    { label: "사전", value: String(dictionaryCount), href: buildVersionAssetHref(botId, versionId, "dictionary") },
    { label: "평가", value: "-", href: buildVersionAssetHref(botId, versionId, "evaluation") },
    { label: "재학습", value: String(counts?.retraining_records ?? 0), href: buildVersionAssetHref(botId, versionId, "retraining") },
    { label: "분석", value: "-", href: buildVersionAssetHref(botId, versionId, "analysis") },
  ];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeTokenText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeDomainText(value: string) {
  return normalizeTokenText(value).replace(/[^0-9a-zA-Z가-힣_]+/g, "");
}

function canonicalizeWithLexicon(value: string, lexicon?: ConfigureLexicon) {
  let normalized = normalizeTokenText(value);
  lexicon?.canonicalReplacements.forEach(({ pattern, replacement }) => {
    normalized = normalized.replace(pattern, ` ${replacement} `);
  });
  return normalized.replace(/\s+/g, " ").trim();
}

function normalizeDomainTextWithLexicon(value: string, lexicon?: ConfigureLexicon) {
  return canonicalizeWithLexicon(value, lexicon).replace(/[^0-9a-zA-Z가-힣_]+/g, "");
}

function normalizeForConfigure(value: string, lexicon?: ConfigureLexicon) {
  let normalized = canonicalizeWithLexicon(value, lexicon);
  lexicon?.replacements.forEach(({ pattern, replacement }) => {
    normalized = normalized.replace(pattern, ` ${replacement} `);
  });
  return normalized.replace(/\s+/g, " ").trim();
}

function dictionaryTokenForNormalized(value: string, lexicon?: ConfigureLexicon) {
  const normalized = normalizeDomainTextWithLexicon(value, lexicon);
  if (!normalized || !lexicon) return "";
  const entry = lexicon.dictionary.find((item) => normalizeDomainTextWithLexicon(item.word, lexicon) === normalized);
  return entry ? `dict_${normalized}` : "";
}

function tokenize(value: string, lexicon?: ConfigureLexicon, tokenContext?: ConfigureTokenContext) {
  const normalized = normalizeForConfigure(value, lexicon);
  const wordTokens = normalized.split(/[^0-9a-zA-Z가-힣_]+/).filter(Boolean);
  const compact = normalized.replace(/[^0-9a-zA-Z가-힣_]+/g, "");
  const charTokens: string[] = [];
  for (let index = 0; index < compact.length - 1; index += 1) {
    charTokens.push(`gram:${compact.slice(index, index + 2)}`);
  }
  const morphTokens = tokenContext?.morphTokensByText?.get(value)
    ?.map((token) => {
      if (
        token.startsWith("intent_question_") ||
        token.startsWith("intent_function_") ||
        token.startsWith("intent_concept_") ||
        token.startsWith("gram:")
      ) {
        return token;
      }
      if (token.startsWith("morph:")) {
        const normalized = normalizeDomainTextWithLexicon(token.slice("morph:".length), lexicon);
        if (!normalized) return "";
        return dictionaryTokenForNormalized(normalized, lexicon) || `morph:${normalized}`;
      }
      const normalized = normalizeDomainTextWithLexicon(token, lexicon);
      if (!normalized) return "";
      return dictionaryTokenForNormalized(normalized, lexicon) || `morph:${normalized}`;
    })
    .filter(Boolean) ?? [];
  const surfaceTokens = morphTokens.length > 0 ? [] : wordTokens;
  return new Set([
    ...surfaceTokens,
    ...surfaceTokens.map(normalizeKoreanPredicateToken).filter(Boolean),
    ...morphTokens,
    ...getLocalIntentFeatureTokens(value, lexicon),
    ...charTokens,
  ]);
}

function getLocalIntentFeatureTokens(value: string, lexicon?: ConfigureLexicon) {
  const compact = normalizeDomainTextWithLexicon(value, lexicon);
  if (!compact) return [];
  const questionAxis = detectLocalQuestionAxis(value, lexicon);
  const questionIntentTokens = questionAxis === "statement" || questionAxis === "yesno"
    ? []
    : [`intent_question_intent_${normalizeLocalQuestionAxis(questionAxis)}`];
  return [
    ...questionIntentTokens,
    ...LOCAL_QUESTION_FEATURE_PATTERNS
    .filter(({ patterns }) => patterns.some((pattern) => compact.includes(pattern)))
    .map(({ axis }) => `intent_question_${axis}`),
    ...LOCAL_FUNCTION_FEATURE_PATTERNS
    .filter(({ patterns }) => patterns.some((pattern) => compact.includes(pattern)))
    .map(({ axis }) => `intent_function_${axis}`),
  ];
}

function normalizeKoreanPredicateToken(token: string) {
  if (
    !/[가-힣]/.test(token) ||
    token.startsWith("morph:") ||
    token.startsWith("dict_") ||
    token.startsWith("entity_")
  ) {
    return token;
  }
  return token
    .replace(/(했어요|한다고요|한다구요|합니다|했네요|했는데요|했는데|했어|하고요|하고|할게요|할게|할래요|할래|하려고요|하려고|인가요|이에요|예요|입니다|다고요|다구요|나요|어요|아요|요)$/u, "")
    .replace(/(은|는|이|가|을|를|에|에서|에게|으로|로|와|과|도|만|부터|까지|처럼)$/u, "");
}

const LOW_SIGNAL_CONFIGURE_TOKENS = new Set([
  "그냥",
  "그거",
  "그게",
  "그건",
  "너무",
  "다시",
  "말",
  "말이",
  "말해",
  "말해주세요",
  "뭐",
  "뭐예요",
  "뭔가요",
  "좀",
  "주세요",
  "지금",
  "하고",
  "해주세요",
  "해줘",
]);

const DICTIONARY_REGISTRATION_SUGGESTION_SETS: Array<Omit<DictionaryRegistrationSuggestion, "matchedTerms">> = [
];

const LOCAL_QUESTION_FEATURE_PATTERNS: Array<{ axis: string; patterns: string[] }> = [
  { axis: "who", patterns: ["누구", "누가", "누군"] },
  { axis: "what", patterns: ["무엇", "무슨", "어떤", "뭐", "뭔"] },
  { axis: "when", patterns: ["언제", "몇시", "어느때"] },
  { axis: "where", patterns: ["어디", "어느곳"] },
  { axis: "why", patterns: ["왜", "어째서"] },
  { axis: "how", patterns: ["어떻게", "어떡", "어찌", "방법", "방식"] },
  { axis: "duration", patterns: ["얼마나", "얼마동안", "몇분", "몇시간", "오래"] },
];

const LOCAL_FUNCTION_FEATURE_PATTERNS: Array<{ axis: string; patterns: string[] }> = [
  { axis: "follow_up", patterns: ["다음", "나중", "다시", "후", "시간", "이후", "이따", "내일", "모레"] },
  { axis: "refusal", patterns: ["거부", "거절", "싫", "하지마", "하지말", "말라", "말라고", "그만", "안한다고", "안한다구", "안할래"] },
];

function isWeakConfigureToken(token: string) {
  if (
    token.startsWith("gram:") ||
    token.startsWith("sem:") ||
    token.startsWith("dict_") ||
    token.startsWith("entity_")
  ) {
    return false;
  }
  const normalized = normalizeKoreanPredicateToken(token);
  return LOW_SIGNAL_CONFIGURE_TOKENS.has(token) || LOW_SIGNAL_CONFIGURE_TOKENS.has(normalized) || /^\d+$/.test(normalized) || normalized.length <= 1;
}

function getConfigureKeyTokens(tokens: Set<string>) {
  return [...tokens].filter(
    (token) =>
      token.startsWith("dict_"),
  );
}

const LOCAL_MORPH_IDF_MIN_WEIGHT = 0.2;
const LOCAL_MORPH_IDF_MAX_WEIGHT = 1.8;
const LOCAL_COMMON_TOKEN_MIN_DOCUMENT_COUNT = 40;
const LOCAL_COMMON_TOKEN_MIN_RATIO = 0.08;
const LOCAL_COMMON_TOKEN_SMALL_SET_RATIO = 0.2;
const ML_CONFIGURE_GRAM_WEIGHT = 0;
const ML_GENERIC_PREDICATE_TOKENS = new Set(["morph:하다", "morph:되다", "morph:있다"]);
const ML_NEGATIVE_ONLY_TOKENS = new Set(["morph:안되다", "morph:못하다", "morph:없다", "morph:않다", "morph:말다", "morph:불가", "morph:거부"]);
const ML_NEGATIVE_REFUSAL_TOKENS = new Set(["morph:거부", "morph:말다", "morph:않다"]);
const ML_NEGATIVE_INABILITY_TOKENS = new Set(["morph:안되다", "morph:못하다", "morph:없다", "morph:불가"]);
const ML_LOW_DISCRIMINATIVE_TOKENS = new Set([
  "morph:가능하다",
  "morph:가능",
  "morph:되다",
  "morph:있다",
  "morph:없다",
  "morph:않다",
  "morph:못하다",
  "morph:말다",
  "morph:필요",
  "morph:지금",
  "morph:주다",
  "morph:혹시",
  "morph:어디",
  "morph:얼마",
  "morph:누구",
  "morph:무슨",
  "morph:무엇",
  "morph:뭐",
  "morph:왜",
  "morph:언제",
  "morph:어떻다",
  "morph:도와주다",
]);
const ML_FOLLOW_UP_AXIS_TOKENS = new Set([
  "morph:후속",
  "morph:다음",
  "morph:나중",
  "morph:다시",
  "morph:후",
  "morph:시간",
  "morph:이후",
  "morph:이따",
  "morph:내일",
  "morph:모레",
  "morph:오늘",
  "morph:오전",
  "morph:오후",
]);
const ML_MEANING_AXIS_TOKENS = new Set([
  "intent_question_what",
  "intent_question_intent_meaning",
  "morph:말",
  "morph:뜻",
  "morph:의미",
]);
const ML_QUESTION_INTENT_AXIS_TOKENS = new Set(["intent_question_intent_meaning", "intent_question_intent_content"]);
const ML_STRONG_QUESTION_INTENT_AXIS_TOKENS = new Set(["intent_question_intent_duration", "intent_question_intent_source"]);
const ML_STRONG_FUNCTION_AXIS_TOKENS = new Set([
  "intent_function_unknown",
  "intent_function_absence",
  "intent_function_call_self_action",
  "intent_function_call_inbound_request",
  "intent_function_call_partner_contact",
]);
const ML_WEAK_FUNCTION_AXIS_TOKENS = new Set([
  "intent_function_request",
  "intent_function_permission",
  "intent_function_follow_up",
  "intent_function_self_action",
  "intent_function_completed",
  "intent_function_reason_clause",
]);
const ML_GENERIC_EXPLANATION_TOKENS = new Set([
  "morph:설명",
  "morph:설명하다",
  "morph:안내",
  "morph:안내하다",
  "morph:알리다",
  "morph:듣다",
]);
const ML_CALL_ACTION_TOKENS = new Set(["morph:전화", "morph:통화", "morph:연락", "morph:전화하다", "morph:통화하다", "morph:연락하다"]);
const ML_GENERIC_REQUEST_SHARED_TOKENS = new Set([
  "morph:링크",
  "morph:보내다",
  "morph:부탁",
  "morph:부탁하다",
  "morph:부탁드리다",
  "morph:드리다",
  "morph:확인",
  "morph:확인하다",
  "morph:문의",
  "morph:문의하다",
  "morph:절차",
  "morph:페이지",
  "morph:방법",
  "morph:모르다",
  "morph:처음",
  "morph:오늘",
  "morph:안녕",
  "morph:안녕하다",
]);
const ML_SPEECH_SPEED_AXIS_TOKENS = new Set([
  "intent_concept_속도",
  "morph:속도",
  "morph:발화",
  "morph:빠르다",
  "morph:느리다",
  "morph:천천히",
  "morph:빨리",
]);
const ML_AVAILABILITY_BUSY_AXIS_TOKENS = new Set(["morph:바쁘다"]);

function clampLocalMorphIdf(value: number) {
  return Math.min(LOCAL_MORPH_IDF_MAX_WEIGHT, Math.max(LOCAL_MORPH_IDF_MIN_WEIGHT, value));
}

function isAutoCommonConfigureToken(token: string) {
  return token.startsWith("morph:");
}

function commonTokenRatioThreshold(documentCount: number) {
  return documentCount >= LOCAL_COMMON_TOKEN_MIN_DOCUMENT_COUNT
    ? LOCAL_COMMON_TOKEN_MIN_RATIO
    : LOCAL_COMMON_TOKEN_SMALL_SET_RATIO;
}

function tokenWeight(
  token: string,
  scoring: ConfigurationScoringConfig,
  tokenContext?: ConfigureTokenContext,
  nluType?: ConfigureNluType,
) {
  if (token.startsWith("intent_question_intent_")) {
    if (isMlConfigureNluType(nluType)) {
      return Math.max(scoring.wordWeight * 3, 3);
    }
    return Math.max(scoring.wordWeight * 2, scoring.dictionaryWeight * 0.5);
  }
  if (token.startsWith("intent_question_")) {
    if (isMlConfigureNluType(nluType)) {
      return Math.max(scoring.wordWeight * 1.8, 1.8);
    }
    return Math.max(scoring.wordWeight * 2, scoring.dictionaryWeight * 0.5);
  }
  if (token.startsWith("intent_function_")) {
    if (isMlConfigureNluType(nluType) && ML_WEAK_FUNCTION_AXIS_TOKENS.has(token)) {
      return Math.max(scoring.wordWeight * 0.65, 0.65);
    }
    return isMlConfigureNluType(nluType) ? Math.max(scoring.wordWeight * 1.5, 1.5) : scoring.wordWeight;
  }
  if (token.startsWith("intent_concept_")) {
    return isMlConfigureNluType(nluType) ? Math.max(scoring.wordWeight * 2.4, 2.4) : scoring.wordWeight;
  }
  if (token.startsWith("morph:")) {
    if (tokenContext?.commonTokens?.has(token)) {
      return 0;
    }
    return scoring.wordWeight * clampLocalMorphIdf(tokenContext?.inverseDocumentFrequency?.get(token) ?? 1);
  }
  if (token.startsWith("dict_")) return scoring.dictionaryWeight;
  if (token.startsWith("entity_")) return scoring.entityWeight;
  if (token.startsWith("gram:")) {
    if (isMlConfigureNluType(nluType)) return ML_CONFIGURE_GRAM_WEIGHT;
    return scoring.gramWeight;
  }
  if (isWeakConfigureToken(token)) return Math.min(scoring.particleEndingWeight, 0.05);
  if (/^(은|는|이|가|을|를|에|에서|에게|으로|로|와|과|도|만|요|습니다|합니다)$/.test(token)) return scoring.particleEndingWeight;
  return scoring.wordWeight;
}

type SimilarityOptions = {
  applyKeyMatchFloor?: boolean;
};

function getMlConfigureActionAxis(tokens: Set<string>) {
  if ([...tokens].some((token) => token === "intent_function_negative" || token.startsWith("intent_function_prohibit_"))) {
    return "negative";
  }
  return "general";
}

function isMlConfigureMeaningfulToken(token: string) {
  return Boolean(token) && !token.startsWith("gram:");
}

function isMlConfigureStrongSharedEvidenceToken(token: string) {
  if (!isMlConfigureMeaningfulToken(token)) return false;
  if (ML_GENERIC_PREDICATE_TOKENS.has(token)) return false;
  if (token === "morph:지금") return false;
  if (ML_LOW_DISCRIMINATIVE_TOKENS.has(token) || ML_NEGATIVE_ONLY_TOKENS.has(token)) return false;
  if (ML_GENERIC_EXPLANATION_TOKENS.has(token) || ML_GENERIC_REQUEST_SHARED_TOKENS.has(token)) return false;
  if (ML_CALL_ACTION_TOKENS.has(token)) return false;
  if (token === "intent_question_intent_meaning" || token === "intent_question_intent_content") return true;
  if (ML_STRONG_QUESTION_INTENT_AXIS_TOKENS.has(token) || ML_STRONG_FUNCTION_AXIS_TOKENS.has(token)) return true;
  if (token.startsWith("intent_question_") || token.startsWith("intent_function_")) return false;
  return true;
}

function isMlConfigureSubsetOf(tokens: Set<string>, allowed: Set<string>) {
  return tokens.size > 0 && [...tokens].every((token) => allowed.has(token));
}

function hasMlConfigureUnsharedActionToken(tokens: Set<string>, shared: Set<string>) {
  return [...tokens].some((token) => {
    if (shared.has(token)) return false;
    if (
      token.startsWith("intent_question_") ||
      token.startsWith("intent_function_") ||
      token.startsWith("intent_concept_") ||
      token.startsWith("gram:")
    ) {
      return false;
    }
    if (ML_GENERIC_PREDICATE_TOKENS.has(token) || ML_LOW_DISCRIMINATIVE_TOKENS.has(token)) {
      return false;
    }
    return token.startsWith("morph:") && token.endsWith("하다") && token.length > "morph:하다".length;
  });
}

function isMlConfigureDiscriminativeContentToken(token: string) {
  if (!isMlConfigureMeaningfulToken(token)) return false;
  if (
    token.startsWith("intent_question_") ||
    token.startsWith("intent_function_") ||
    token.startsWith("intent_concept_") ||
    token.startsWith("gram:")
  ) {
    return false;
  }
  if (ML_GENERIC_PREDICATE_TOKENS.has(token)) return false;
  if (ML_LOW_DISCRIMINATIVE_TOKENS.has(token) || ML_NEGATIVE_ONLY_TOKENS.has(token)) return false;
  if (ML_GENERIC_EXPLANATION_TOKENS.has(token) || ML_CALL_ACTION_TOKENS.has(token) || ML_GENERIC_REQUEST_SHARED_TOKENS.has(token)) {
    return false;
  }
  return true;
}

function hasMlConfigureUnsharedContentToken(tokens: Set<string>, shared: Set<string>) {
  return [...tokens].some((token) => !shared.has(token) && isMlConfigureDiscriminativeContentToken(token));
}

function hasMlConfigureContentToken(tokens: Set<string>) {
  return [...tokens].some(isMlConfigureDiscriminativeContentToken);
}

function isMlConfigureActionLikeSharedToken(token: string, shared: Set<string>) {
  if (token.startsWith("morph:") && token.endsWith("다") && token.length > "morph:다".length) return true;
  return shared.has(`${token}하다`);
}

function hasMlConfigureToken(tokens: Set<string>, token: string) {
  return tokens.has(token);
}

function hasMlConfigureTokenPrefix(tokens: Set<string>, prefix: string) {
  return [...tokens].some((token) => token.startsWith(prefix));
}

function hasAnyMlConfigureToken(tokens: Set<string>, candidates: Set<string>) {
  return [...tokens].some((token) => candidates.has(token));
}

function capMlConfigureSimilarity(leftTokens: Set<string>, rightTokens: Set<string>, score: number) {
  const leftMeaningful = new Set([...leftTokens].filter(isMlConfigureMeaningfulToken));
  const rightMeaningful = new Set([...rightTokens].filter(isMlConfigureMeaningfulToken));
  const shared = new Set([...leftMeaningful].filter((token) => rightMeaningful.has(token)));
  const strongShared = new Set([...shared].filter(isMlConfigureStrongSharedEvidenceToken));

  if (strongShared.size === 0) return Math.min(score, 0.28);
  if (strongShared.size === 1 && (leftMeaningful.size > shared.size || rightMeaningful.size > shared.size)) {
    const sharedToken = [...strongShared][0];
    if (sharedToken.startsWith("morph:") && sharedToken.endsWith("하다") && sharedToken.length > "morph:하다".length) {
      return Math.min(score, 0.52);
    }
    if (!ML_QUESTION_INTENT_AXIS_TOKENS.has(sharedToken)) {
      return Math.min(score, 0.52);
    }
  }
  if (shared.size === 1 && (leftMeaningful.size > 1 || rightMeaningful.size > 1)) {
    const sharedToken = [...shared][0];
    if (sharedToken.startsWith("morph:") && sharedToken.endsWith("다") && !sharedToken.endsWith("하다")) {
      return Math.min(score, 0.34);
    }
    if (sharedToken.startsWith("morph:") && sharedToken.endsWith("하다") && sharedToken.length > "morph:하다".length) {
      return Math.min(score, 0.58);
    }
    return Math.min(score, 0.42);
  }

  const weakAxisTokens = new Set([...ML_LOW_DISCRIMINATIVE_TOKENS, ...ML_FOLLOW_UP_AXIS_TOKENS]);
  if (isMlConfigureSubsetOf(strongShared, ML_FOLLOW_UP_AXIS_TOKENS) && (leftMeaningful.size > shared.size || rightMeaningful.size > shared.size)) {
    return Math.min(score, 0.42);
  }
  if (isMlConfigureSubsetOf(strongShared, ML_LOW_DISCRIMINATIVE_TOKENS) && (leftMeaningful.size > shared.size || rightMeaningful.size > shared.size)) {
    return Math.min(score, 0.44);
  }
  if (isMlConfigureSubsetOf(strongShared, ML_NEGATIVE_ONLY_TOKENS) && (leftMeaningful.size > shared.size || rightMeaningful.size > shared.size)) {
    return Math.min(score, 0.44);
  }
  if (
    isMlConfigureSubsetOf(strongShared, weakAxisTokens) &&
    (hasMlConfigureUnsharedActionToken(leftMeaningful, shared) || hasMlConfigureUnsharedActionToken(rightMeaningful, shared))
  ) {
    return Math.min(score, 0.5);
  }
  if (
    hasMlConfigureUnsharedContentToken(leftMeaningful, shared) &&
    hasMlConfigureUnsharedContentToken(rightMeaningful, shared) &&
    ![...shared].some(isMlConfigureDiscriminativeContentToken)
  ) {
    score = Math.min(score, 0.5);
  }
  if (
    ![...shared].some(isMlConfigureDiscriminativeContentToken) &&
    hasMlConfigureContentToken(leftMeaningful) !== hasMlConfigureContentToken(rightMeaningful)
  ) {
    score = Math.min(score, 0.46);
  }
  const sharedContent = new Set([...shared].filter(isMlConfigureDiscriminativeContentToken));
  if (
    sharedContent.size > 0 &&
    [...sharedContent].every((token) => isMlConfigureActionLikeSharedToken(token, sharedContent)) &&
    hasMlConfigureUnsharedContentToken(leftMeaningful, shared) &&
    hasMlConfigureUnsharedContentToken(rightMeaningful, shared)
  ) {
    score = Math.min(score, 0.56);
  }
  if (isMlConfigureSubsetOf(strongShared, ML_QUESTION_INTENT_AXIS_TOKENS) && (leftMeaningful.size > shared.size || rightMeaningful.size > shared.size)) {
    if (hasMlConfigureToken(leftMeaningful, "intent_function_completed") !== hasMlConfigureToken(rightMeaningful, "intent_function_completed")) {
      return Math.min(score, 0.38);
    }
    if (hasMlConfigureToken(leftMeaningful, "intent_function_request") !== hasMlConfigureToken(rightMeaningful, "intent_function_request")) {
      return Math.min(score, 0.46);
    }
    return Math.min(score, 0.54);
  }
  if (isMlConfigureSubsetOf(strongShared, ML_MEANING_AXIS_TOKENS) && (leftMeaningful.size > shared.size || rightMeaningful.size > shared.size)) {
    return Math.min(score, 0.56);
  }

  if (hasMlConfigureToken(leftMeaningful, "intent_question_intent_meaning") !== hasMlConfigureToken(rightMeaningful, "intent_question_intent_meaning")) {
    score = Math.min(score, 0.42);
  }
  const leftQuestionIntents = new Set([...leftMeaningful].filter((token) => token.startsWith("intent_question_intent_")));
  const rightQuestionIntents = new Set([...rightMeaningful].filter((token) => token.startsWith("intent_question_intent_")));
  if (
    leftQuestionIntents.size > 0 &&
    rightQuestionIntents.size > 0 &&
    ![...leftQuestionIntents].some((token) => rightQuestionIntents.has(token))
  ) {
    score = Math.min(score, 0.42);
  }
  if (hasMlConfigureToken(leftMeaningful, "intent_function_negative") !== hasMlConfigureToken(rightMeaningful, "intent_function_negative")) {
    score = Math.min(score, 0.52);
  }
  if (
    hasMlConfigureToken(leftMeaningful, "intent_function_refusal") !== hasMlConfigureToken(rightMeaningful, "intent_function_refusal") &&
    (hasMlConfigureToken(leftMeaningful, "intent_function_inability") || hasMlConfigureToken(rightMeaningful, "intent_function_inability"))
  ) {
    score = Math.min(score, 0.48);
  }

  const leftNegativeTokens = new Set([...leftMeaningful].filter((token) => ML_NEGATIVE_ONLY_TOKENS.has(token)));
  const rightNegativeTokens = new Set([...rightMeaningful].filter((token) => ML_NEGATIVE_ONLY_TOKENS.has(token)));
  if (
    leftMeaningful.has("intent_function_negative") &&
    rightMeaningful.has("intent_function_negative") &&
    (([...leftNegativeTokens].some((token) => ML_NEGATIVE_REFUSAL_TOKENS.has(token)) &&
      [...rightNegativeTokens].some((token) => ML_NEGATIVE_INABILITY_TOKENS.has(token))) ||
      ([...leftNegativeTokens].some((token) => ML_NEGATIVE_INABILITY_TOKENS.has(token)) &&
        [...rightNegativeTokens].some((token) => ML_NEGATIVE_REFUSAL_TOKENS.has(token))))
  ) {
    score = Math.min(score, 0.48);
  }
  if (
    leftMeaningful.has("intent_function_negative") &&
    rightMeaningful.has("intent_function_negative") &&
    leftNegativeTokens.size > 0 &&
    rightNegativeTokens.size > 0 &&
    ![...leftNegativeTokens].some((token) => rightNegativeTokens.has(token))
  ) {
    score = Math.min(score, 0.56);
  }

  if (hasMlConfigureTokenPrefix(leftMeaningful, "intent_function_prohibit_") !== hasMlConfigureTokenPrefix(rightMeaningful, "intent_function_prohibit_")) {
    score = Math.min(score, 0.46);
  }
  if (hasMlConfigureToken(leftMeaningful, "intent_function_request") !== hasMlConfigureToken(rightMeaningful, "intent_function_request")) {
    score = Math.min(
      score,
      leftMeaningful.has("intent_function_completed") || rightMeaningful.has("intent_function_completed") ? 0.38 : 0.58,
    );
  }
  if (hasMlConfigureToken(leftMeaningful, "intent_function_completed") !== hasMlConfigureToken(rightMeaningful, "intent_function_completed")) {
    score = Math.min(
      score,
      leftMeaningful.has("intent_function_request") || rightMeaningful.has("intent_function_request") ? 0.38 : 0.48,
    );
  }
  if (hasMlConfigureToken(leftMeaningful, "intent_function_self_action") !== hasMlConfigureToken(rightMeaningful, "intent_function_self_action")) {
    score = Math.min(score, 0.46);
  }
  if (hasMlConfigureToken(leftMeaningful, "intent_function_call_self_action") !== hasMlConfigureToken(rightMeaningful, "intent_function_call_self_action")) {
    score = Math.min(score, 0.42);
  }
  if (hasMlConfigureToken(leftMeaningful, "intent_function_call_inbound_request") !== hasMlConfigureToken(rightMeaningful, "intent_function_call_inbound_request")) {
    score = Math.min(score, 0.42);
  }
  if (hasMlConfigureToken(leftMeaningful, "intent_function_call_partner_contact") !== hasMlConfigureToken(rightMeaningful, "intent_function_call_partner_contact")) {
    score = Math.min(score, 0.42);
  }
  if (
    (hasMlConfigureToken(leftMeaningful, "intent_function_call_self_action") &&
      hasMlConfigureToken(rightMeaningful, "intent_function_call_inbound_request")) ||
    (hasMlConfigureToken(leftMeaningful, "intent_function_call_inbound_request") &&
      hasMlConfigureToken(rightMeaningful, "intent_function_call_self_action")) ||
    (hasMlConfigureToken(leftMeaningful, "intent_function_call_self_action") &&
      hasMlConfigureToken(rightMeaningful, "intent_function_call_partner_contact")) ||
    (hasMlConfigureToken(leftMeaningful, "intent_function_call_partner_contact") &&
      hasMlConfigureToken(rightMeaningful, "intent_function_call_self_action"))
  ) {
    score = Math.min(score, 0.34);
  }
  const leftSpeechSpeed = hasAnyMlConfigureToken(leftMeaningful, ML_SPEECH_SPEED_AXIS_TOKENS);
  const rightSpeechSpeed = hasAnyMlConfigureToken(rightMeaningful, ML_SPEECH_SPEED_AXIS_TOKENS);
  const leftBusyOrUnavailable =
    hasAnyMlConfigureToken(leftMeaningful, ML_AVAILABILITY_BUSY_AXIS_TOKENS) || hasMlConfigureToken(leftMeaningful, "intent_function_inability");
  const rightBusyOrUnavailable =
    hasAnyMlConfigureToken(rightMeaningful, ML_AVAILABILITY_BUSY_AXIS_TOKENS) || hasMlConfigureToken(rightMeaningful, "intent_function_inability");
  if (leftSpeechSpeed !== rightSpeechSpeed && (leftBusyOrUnavailable || rightBusyOrUnavailable)) {
    score = Math.min(score, 0.34);
  }
  if (hasMlConfigureToken(leftMeaningful, "intent_function_conditional") !== hasMlConfigureToken(rightMeaningful, "intent_function_conditional")) {
    score = Math.min(score, 0.52);
  }
  if (hasMlConfigureToken(leftMeaningful, "intent_function_permission") !== hasMlConfigureToken(rightMeaningful, "intent_function_permission")) {
    score = Math.min(score, 0.52);
  }
  if (hasMlConfigureToken(leftMeaningful, "intent_function_reason_clause") !== hasMlConfigureToken(rightMeaningful, "intent_function_reason_clause")) {
    score = Math.min(score, 0.52);
  }
  return score;
}

function similarity(
  left: string,
  right: string,
  lexicon: ConfigureLexicon | undefined,
  scoring: ConfigurationScoringConfig,
  tokenContext: ConfigureTokenContext | undefined,
  options: SimilarityOptions = {},
  nluType?: ConfigureNluType,
) {
  const leftTokens = tokenize(left, lexicon, tokenContext);
  const rightTokens = tokenize(right, lexicon, tokenContext);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let overlap = 0;
  let leftWeight = 0;
  leftTokens.forEach((token) => {
    const weight = tokenWeight(token, scoring, tokenContext, nluType);
    leftWeight += weight * weight;
    if (rightTokens.has(token)) overlap += weight * weight;
  });
  let rightWeight = 0;
  rightTokens.forEach((token) => {
    const weight = tokenWeight(token, scoring, tokenContext, nluType);
    rightWeight += weight * weight;
  });
  const baseScore = overlap / (Math.sqrt(leftWeight) * Math.sqrt(rightWeight) || 1);
  const leftKeys = getConfigureKeyTokens(leftTokens);
  let score = baseScore;
  if (options.applyKeyMatchFloor !== false && leftKeys.some((token) => rightTokens.has(token))) {
    score = Math.max(score, scoring.keyMatchScore);
  }
  if (isMlConfigureNluType(nluType)) {
    return capMlConfigureSimilarity(leftTokens, rightTokens, score);
  }
  return score;
}

function semanticTokens(value: string, lexicon: ConfigureLexicon | undefined) {
  const normalized = [...tokenize(value, lexicon)]
    .map((token) => (token.startsWith("gram:") ? token : normalizeKoreanPredicateToken(token)))
    .filter(Boolean);
  const compact = normalized
    .filter((token) => !token.startsWith("gram:"))
    .join("")
    .replace(/[^0-9a-zA-Z가-힣_]+/g, "");
  const grams = new Set(normalized);
  for (let size = 2; size <= 3; size += 1) {
    for (let index = 0; index <= compact.length - size; index += 1) {
      grams.add(`sem:${compact.slice(index, index + size)}`);
    }
  }
  return grams;
}

function semanticTokenWeight(token: string, scoring: ConfigurationScoringConfig) {
  if (token.startsWith("intent_question_")) return Math.max(scoring.wordWeight * 2, scoring.dictionaryWeight * 0.5);
  if (token.startsWith("dict_")) return scoring.dictionaryWeight;
  if (token.startsWith("entity_")) return scoring.entityWeight;
  if (token.startsWith("sem:")) return Math.max(0.03, scoring.gramWeight * 0.35);
  if (token.startsWith("gram:")) return Math.max(0.02, scoring.gramWeight * 0.25);
  if (isWeakConfigureToken(token)) return Math.min(scoring.particleEndingWeight, 0.05);
  return scoring.wordWeight;
}

function semanticSimilarity(
  left: string,
  right: string,
  lexicon: ConfigureLexicon | undefined,
  scoring: ConfigurationScoringConfig,
  options: SimilarityOptions = {},
) {
  const leftTokens = semanticTokens(left, lexicon);
  const rightTokens = semanticTokens(right, lexicon);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const leftKeys = getConfigureKeyTokens(leftTokens);
  let overlap = 0;
  let leftWeight = 0;
  leftTokens.forEach((token) => {
    const weight = semanticTokenWeight(token, scoring);
    leftWeight += weight;
    if (rightTokens.has(token)) overlap += weight;
  });
  let rightWeight = 0;
  rightTokens.forEach((token) => {
    rightWeight += semanticTokenWeight(token, scoring);
  });
  const baseScore = overlap / Math.sqrt(leftWeight * rightWeight);
  if (options.applyKeyMatchFloor !== false && leftKeys.some((token) => rightTokens.has(token))) {
    return Math.max(baseScore, scoring.keyMatchScore);
  }
  return baseScore;
}

function getClusterSimilarity(
  left: string,
  right: string,
  lexicon: ConfigureLexicon | undefined,
  scoring: ConfigurationScoringConfig,
  nluType: ConfigureNluType,
  tokenContext: ConfigureTokenContext | undefined,
  options: SimilarityOptions = {},
) {
  if (isSemanticNluType(nluType)) {
    return semanticSimilarity(left, right, lexicon, scoring, options);
  }
  return similarity(left, right, lexicon, scoring, tokenContext, options, nluType);
}

function getClusterRepresentativeSimilarity(
  utterance: string,
  cluster: IntentCluster,
  lexicon: ConfigureLexicon | undefined,
  scoring: ConfigurationScoringConfig,
  nluType: ConfigureNluType,
  tokenContext: ConfigureTokenContext | undefined,
  options: SimilarityOptions = {},
) {
  const representatives = [...new Set([cluster.seed, ...cluster.utterances.slice(-8)])].filter(Boolean);
  if (representatives.length === 0) return 0;
  const scores = representatives
    .map((representative) => getClusterSimilarity(utterance, representative, lexicon, scoring, nluType, tokenContext, options));
  if (scores.length === 0) return 0;
  return Math.max(...scores);
}

function buildLexicon(document: VersionDocument): ConfigureLexicon {
  const dictionary = normalizeVersionDictionary(document.dictionary).filter((entry) => entry.intentEnabled !== false);
  const entities = normalizeVersionEntities(document.entities).filter((entity) => entity.intentEnabled !== false);
  const replacementMap = new Map<string, string>();
  const canonicalMap = new Map<string, string>();

  dictionary.forEach((entry) => {
    const word = normalizeTokenText(entry.word);
    if (!word) return;
    const wordToken = `dict_${word.replace(/[^0-9a-zA-Z가-힣_]+/g, "_")}`;
    replacementMap.set(word, wordToken);
    canonicalMap.set(word, word);
    entry.synonyms.forEach((synonym) => {
      const normalizedSynonym = normalizeTokenText(synonym);
      if (normalizedSynonym) {
        replacementMap.set(normalizedSynonym, wordToken);
        canonicalMap.set(normalizedSynonym, word);
      }
    });
  });

  const replacements = [...replacementMap.entries()]
    .sort((left, right) => right[0].length - left[0].length)
    .map(([source, replacement]) => ({
      pattern: new RegExp(escapeRegExp(source), "gi"),
      replacement,
    }));

  const canonicalReplacements = [...canonicalMap.entries()]
    .filter(([source, replacement]) => source && replacement && source !== replacement)
    .sort((left, right) => right[0].length - left[0].length)
    .map(([source, replacement]) => ({
      pattern: new RegExp(escapeRegExp(source), "gi"),
      replacement,
    }));

  return { dictionary, entities, replacements, canonicalReplacements };
}

function hasDictionarySuggestionCoverage(entry: VersionDictionaryAsset, suggestion: Omit<DictionaryRegistrationSuggestion, "matchedTerms">) {
  const entrySynonyms = new Set(entry.synonyms.map(normalizeDomainText).filter(Boolean));
  return suggestion.synonyms.every((synonym) => entrySynonyms.has(normalizeDomainText(synonym)));
}

function findDictionaryEntryForSuggestion(dictionary: VersionDictionaryAsset[], word: string) {
  const normalizedWord = normalizeDomainText(word);
  return dictionary.find((entry) => normalizeDomainText(entry.word) === normalizedWord);
}

function collectDictionaryRegistrationSuggestions(
  utterances: string[],
  dictionary: VersionDictionaryAsset[],
  includeAll = false,
): DictionaryRegistrationSuggestion[] {
  const utteranceCompacts = utterances.map(normalizeDomainText).filter(Boolean);
  if (!includeAll && utteranceCompacts.length === 0) return [];

  return DICTIONARY_REGISTRATION_SUGGESTION_SETS.map((suggestion) => {
    const terms = [suggestion.word, ...suggestion.synonyms];
    const matchedTerms = terms.filter((term) => {
      const normalized = normalizeDomainText(term);
      return normalized && utteranceCompacts.some((utterance) => utterance.includes(normalized));
    });
    if (!includeAll && matchedTerms.length === 0) return null;

    const existing = findDictionaryEntryForSuggestion(dictionary, suggestion.word);
    if (existing && hasDictionarySuggestionCoverage(existing, suggestion)) {
      return null;
    }

    return {
      ...suggestion,
      matchedTerms: [...new Set(matchedTerms)],
    };
  }).filter((item): item is DictionaryRegistrationSuggestion => item !== null);
}

function buildConfigureTokenContext(items: Array<{ text: string; tokens: string[] }>): ConfigureTokenContext {
  const morphTokensByText = new Map<string, string[]>();
  const documentFrequency = new Map<string, number>();
  items.forEach((item) => {
    const mappedTokens = item.tokens.map((token) => {
      if (token.startsWith("question_intent:")) {
        const axis = normalizeDomainText(token.slice("question_intent:".length));
        return axis ? `intent_question_intent_${axis}` : "";
      }
      if (token.startsWith("question:")) {
        const axis = normalizeDomainText(token.slice("question:".length));
        return axis ? `intent_question_${axis}` : "";
      }
      if (token.startsWith("function:")) {
        const axis = normalizeDomainText(token.slice("function:".length));
        return axis ? `intent_function_${axis}` : "";
      }
      if (token.startsWith("prohibit:")) {
        const axis = normalizeDomainText(token.slice("prohibit:".length));
        return axis ? `intent_function_prohibit_${axis}` : "";
      }
      if (token.startsWith("concept:")) {
        const axis = normalizeDomainText(token.slice("concept:".length));
        return axis ? `intent_concept_${axis}` : "";
      }
      if (token.startsWith("domain:")) return "";
      if (token.startsWith("gram:")) {
        const gram = normalizeDomainText(token.slice("gram:".length));
        return gram ? `gram:${gram}` : "";
      }
      const normalized = normalizeDomainText(token);
      return normalized ? `morph:${normalized}` : "";
    }).filter(Boolean);
    const tokens = [...new Set(
      hasLocalSpeechSpeedContext(item.text, new Set(mappedTokens))
        ? mappedTokens
        : mappedTokens.filter((token) => !ML_SPEECH_SPEED_AXIS_TOKENS.has(token)),
    )];
    morphTokensByText.set(item.text, tokens);
    tokens.forEach((token) => {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    });
  });
  const documentCount = Math.max(1, items.length);
  const inverseDocumentFrequency = new Map<string, number>();
  const commonTokens = new Set<string>();
  const commonRatioThreshold = commonTokenRatioThreshold(documentCount);
  documentFrequency.forEach((count, token) => {
    inverseDocumentFrequency.set(token, Math.log((documentCount + 1) / (count + 1)) + 1);
    if (isAutoCommonConfigureToken(token) && count / documentCount >= commonRatioThreshold) {
      commonTokens.add(token);
    }
  });
  return { morphTokensByText, inverseDocumentFrequency, commonTokens };
}

async function fetchMlConfigureTokenContext(
  token: string,
  botId: string,
  versionId: string,
  utterances: string[],
) {
  const response = await tokenizeStudioBotVersionMlIntents(token, botId, versionId, [...new Set(utterances)]);
  return buildConfigureTokenContext(response.items);
}

function mergeSelectedDictionarySuggestions(
  document: VersionDocument,
  suggestions: DictionaryRegistrationSuggestion[],
  updatedBy: string,
) {
  const dictionary = normalizeVersionDictionary(document.dictionary);
  if (suggestions.length === 0) {
    return { document, dictionary, addedCount: 0, updatedCount: 0 };
  }

  const now = new Date().toISOString();
  const nextDictionary = [...dictionary];
  let addedCount = 0;
  let updatedCount = 0;

  suggestions.forEach((suggestion) => {
    const existingIndex = nextDictionary.findIndex((entry) => normalizeDomainText(entry.word) === normalizeDomainText(suggestion.word));
    if (existingIndex >= 0) {
      const existing = nextDictionary[existingIndex];
      const existingSynonyms = new Set(existing.synonyms.map(normalizeDomainText).filter(Boolean));
      const mergedSynonyms = [
        ...existing.synonyms,
        ...suggestion.synonyms.filter((synonym) => {
          const normalized = normalizeDomainText(synonym);
          return normalized && normalized !== normalizeDomainText(existing.word) && !existingSynonyms.has(normalized);
        }),
      ];
      nextDictionary[existingIndex] = {
        ...existing,
        synonyms: mergedSynonyms,
        intentEnabled: true,
        domainCandidate: false,
        domainEnabled: false,
        updatedAt: now,
        updatedBy,
      };
      updatedCount += 1;
      return;
    }

    nextDictionary.unshift({
      ...createEmptyVersionDictionary(),
      id: crypto.randomUUID(),
      word: suggestion.word,
      synonyms: suggestion.synonyms,
      intentEnabled: true,
      qaEnabled: false,
      domainCandidate: false,
      domainEnabled: false,
      updatedAt: now,
      updatedBy,
    });
    addedCount += 1;
  });

  return {
    document: {
      ...document,
      dictionary: nextDictionary,
    },
    dictionary: nextDictionary,
    addedCount,
    updatedCount,
  };
}

function buildUtterance(text: string): VersionDialogUtterance {
  return {
    id: crypto.randomUUID(),
    text,
    utteranceType: "T",
  };
}

function parseUtterances(input: string) {
  return [...new Set(input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
}

function getDialogUtteranceTexts(dialog: VersionDialogAsset) {
  return (dialog.utterances ?? []).map((utterance) => utterance.text.trim()).filter(Boolean);
}

function formatMlSeedIntentTextFromDialogs(dialogs: VersionDialogAsset[]) {
  return dialogs
    .filter((dialog) => dialog.dialogType === 1)
    .map((dialog) => {
      const name = (dialog.name || dialog.displayName || "").trim();
      const utterances = getDialogUtteranceTexts(dialog).slice(0, 3);
      return name && utterances.length > 0 ? `${name} : ${utterances.join(", ")}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function splitMlSeedRepresentativeUtterances(text: string) {
  return [
    ...new Set(
      text
        .split(/[,，]/)
        .map((utterance) => utterance.trim())
        .filter(Boolean),
    ),
  ].slice(0, 20);
}

function parseMlSeedIntentText(input: string) {
  const seedIntents: Array<{ name: string; representative_utterances: string[] }> = [];
  const invalidLines: string[] = [];

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const colonMatch = /^(.+?)\s*[:：]\s*(.+)$/.exec(line);
    const parenMatch = colonMatch ? null : /^(.+?)\s*[（(]\s*(.+?)\s*[）)]\s*$/.exec(line);
    const match = colonMatch ?? parenMatch;
    if (!match) {
      invalidLines.push(line);
      continue;
    }

    const name = match[1]?.trim() ?? "";
    const representativeUtterances = splitMlSeedRepresentativeUtterances(match[2] ?? "");
    if (!name || representativeUtterances.length === 0) {
      invalidLines.push(line);
      continue;
    }

    seedIntents.push({ name, representative_utterances: representativeUtterances });
  }

  return { seedIntents, invalidLines };
}

function waitForBrowserPaint(frameCount = 2) {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise<void>((resolve) => {
    let remaining = Math.max(1, frameCount);
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) {
        window.setTimeout(resolve, 0);
        return;
      }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  });
}

function yieldToBrowser() {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

let lastLocalClassifyYieldAt = 0;
let lastLocalClassifyPaintAt = 0;

function resetLocalClassifyYieldSchedule() {
  lastLocalClassifyYieldAt = 0;
  lastLocalClassifyPaintAt = 0;
}

async function yieldToBrowserDuringLocalClassify(_step: number) {
  if (typeof window === "undefined") return;
  const now = window.performance.now();
  if (now - lastLocalClassifyYieldAt < 24) {
    return;
  }
  lastLocalClassifyYieldAt = now;

  if (now - lastLocalClassifyPaintAt >= 120) {
    lastLocalClassifyPaintAt = now;
    await waitForBrowserPaint(1);
    return;
  }
  await yieldToBrowser();
}

async function buildSimilarityMatrix(
  utterances: string[],
  lexicon: ConfigureLexicon | undefined,
  scoring: ConfigurationScoringConfig,
  nluType: ConfigureNluType,
  tokenContext: ConfigureTokenContext | undefined,
  onProgress?: LocalClassifyProgressHandler,
): Promise<number[][]> {
  const matrix = utterances.map(() => utterances.map(() => 0));
  let comparedPairs = 0;
  const totalPairs = Math.max(1, Math.floor((utterances.length * (utterances.length - 1)) / 2));
  for (let leftIndex = 0; leftIndex < utterances.length; leftIndex += 1) {
    const left = utterances[leftIndex];
    matrix[leftIndex][leftIndex] = 1;
    for (let rightIndex = leftIndex + 1; rightIndex < utterances.length; rightIndex += 1) {
      const score = getClusterSimilarity(left, utterances[rightIndex], lexicon, scoring, nluType, tokenContext, {
        applyKeyMatchFloor: false,
      });
      matrix[leftIndex][rightIndex] = score;
      matrix[rightIndex][leftIndex] = score;
      comparedPairs += 1;
      if (comparedPairs % 32 === 0) {
        if (comparedPairs % 256 === 0) {
          onProgress?.({
            stage: "유사도 계산",
            completed: comparedPairs,
            total: totalPairs,
            label: "3/4단계",
          });
        }
        await yieldToBrowserDuringLocalClassify(comparedPairs);
      }
    }
  }
  onProgress?.({
    stage: "유사도 계산",
    completed: totalPairs,
    total: totalPairs,
    label: "3/4단계",
  });
  return matrix;
}

function getClusterMergeScore(left: number[], right: number[], matrix: number[][], nluType?: ConfigureNluType) {
  let sum = 0;
  let min = 1;
  let count = 0;
  left.forEach((leftIndex) => {
    right.forEach((rightIndex) => {
      const score = matrix[leftIndex][rightIndex] ?? 0;
      sum += score;
      min = Math.min(min, score);
      count += 1;
    });
  });
  if (count <= 0) return 0;
  const average = sum / count;
  if (isMlConfigureNluType(nluType)) {
    return min;
  }
  return average * 0.7 + min * 0.3;
}

async function findBestLocalClusterMerge(
  clusterIndexes: number[][],
  utterances: string[],
  matrix: number[][],
  lexicon: ConfigureLexicon | undefined,
  maxSize: number,
  strictSignatures: boolean,
  tokenContext?: ConfigureTokenContext,
  nluType?: ConfigureNluType,
): Promise<{ left: number; right: number; score: number }> {
  let bestLeft = -1;
  let bestRight = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  let comparedPairs = 0;
  const metadata = clusterIndexes.map((indexes) => buildLocalClusterMergeMetadata(indexes, utterances, lexicon, tokenContext));
  for (let leftIndex = 0; leftIndex < clusterIndexes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < clusterIndexes.length; rightIndex += 1) {
      comparedPairs += 1;
      if (comparedPairs % 64 === 0) {
        await yieldToBrowserDuringLocalClassify(comparedPairs);
      }
      const combinedSize = clusterIndexes[leftIndex].length + clusterIndexes[rightIndex].length;
      if (combinedSize > maxSize) {
        continue;
      }
      const hasHardConflict = hasHardLocalClusterMetadataConflict(metadata[leftIndex], metadata[rightIndex], nluType);
      if (hasHardConflict) {
        continue;
      }
      if (!isMlConfigureNluType(nluType) && !canMergeLocalClusterMetadata(metadata[leftIndex], metadata[rightIndex], nluType)) {
        continue;
      }
      const sizePenalty = combinedSize / Math.max(1, maxSize) * 0.04;
      const signaturePenalty = isMlConfigureNluType(nluType)
        ? getLocalClusterSignaturePenalty(metadata[leftIndex].dominantSignature, metadata[rightIndex].dominantSignature, nluType) * 0.18
        : strictSignatures
          ? 0
          : getLocalClusterSignaturePenalty(metadata[leftIndex].dominantSignature, metadata[rightIndex].dominantSignature, nluType);
      const score = getClusterMergeScore(clusterIndexes[leftIndex], clusterIndexes[rightIndex], matrix, nluType) - sizePenalty - signaturePenalty;
      if (score > bestScore) {
        bestScore = score;
        bestLeft = leftIndex;
        bestRight = rightIndex;
      }
    }
  }
  return { left: bestLeft, right: bestRight, score: bestScore };
}

function selectClusterSeed(indexes: number[], utterances: string[], matrix: number[][]) {
  let bestIndex = indexes[0] ?? 0;
  let bestScore = -1;
  indexes.forEach((candidate) => {
    const score = indexes.reduce((sum, other) => sum + (matrix[candidate][other] ?? 0), 0) / Math.max(1, indexes.length);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = candidate;
    }
  });
  return utterances[bestIndex] ?? "";
}

type LocalQuestionAxis =
  | "reason"
  | "complaint_reason"
  | "method"
  | "procedure"
  | "possibility"
  | "status_result"
  | "time_point"
  | "duration"
  | "caller_identity"
  | "person_in_charge"
  | "person_target"
  | "source_org"
  | "destination_channel"
  | "place"
  | "meaning"
  | "content"
  | "identity"
  | "type_choice"
  | "yesno"
  | "statement";
type LocalActionAxis =
  | "general"
  | "request"
  | "self_action"
  | "call_self_action"
  | "call_inbound_request"
  | "call_partner_contact"
  | "speech_speed"
  | "availability_unavailable"
  | "inability"
  | "refusal"
  | "negative"
  | "permission"
  | "completed"
  | "absence"
  | "unknown";

type LocalIntentSignature = {
  domainKey: string;
  actionAxis: LocalActionAxis;
  questionAxis: LocalQuestionAxis;
};

function detectLocalQuestionAxis(value: string, lexicon?: ConfigureLexicon): LocalQuestionAxis {
  const text = normalizeDomainTextWithLexicon(value, lexicon);
  const hasQuestionForm = /(\?|나요|인가요|습니까|까|니|죠|요|어디시|어디서전화|어디에서전화|어디세요)$/.test(text) ||
    /(왜|뭐|무슨|어떻게|얼마나|누구|되나요|있나요|없나요|입니까|뭔데|뭔가요|뭐야)/.test(text);
  if (/(왜자꾸|왜계속|왜이렇게|자꾸왜|계속왜)/.test(text)) return "complaint_reason";
  if (/(왜|어째서|이유|원인|까닭|때문|뭣때문|무엇때문|무슨일|무슨용건|어떤일)/.test(text)) return "reason";
  if (/(얼마나|몇분|몇시간|몇일|몇개월|몇년|오래|잠깐|금방|바로|소요|걸리|걸려|걸립|시간얼마|시간이얼마)/.test(text)) return "duration";
  if (/(언제|몇시|날짜|기간|오전|오후|이따|나중|다음|이후|뒤에|후에|내일|모레|오늘)/.test(text)) return "time_point";
  if (/(절차|순서|단계|진행과정|프로세스)/.test(text)) return "procedure";
  if (/(어떻게됐|어떻게됬|어찌됐|어찌됬|상태|결과|처리됐|처리됬|진행됐|진행됬)/.test(text)) return "status_result";
  if (/(어떻게|방법|방식|수단|처리|진행|어떡|어케|어찌|해야해|해야하|하면돼|하면되)/.test(text)) return "method";
  if (/(가능|할수|되나|되나요|되요|돼요|할까요|있나요|없나요)/.test(text)) return "possibility";
  if (/(누구세요|누구시|너누구|누구데|누군데)/.test(text)) return "caller_identity";
  if (/(누구|누가|누군)/.test(text)) return "person_target";
  if (/(어디시|어디서전화|어디에서전화|어디세요|어디소속|소속|출처)/.test(text)) return "source_org";
  if (hasQuestionForm && /(어디로|어디에|어디다가|어디서확인|어디서보|보내|전송|확인경로)/.test(text)) return "destination_channel";
  if (hasQuestionForm && /(어디|위치|장소|곳|어느곳)/.test(text)) return "place";
  if (/(뜻|의미|용어|무슨말|무슨뜻|뭔뜻|뭐뜻|뭔데|뭔가요|뭐야|뭐죠|뭐예요|뭐에요|뭡니까|무엇입니까|무엇인가|무엇일까|뭐라는|뭘말하)/.test(text)) return "meaning";
  if (/(내용|설명|안내|상세|자세히|무슨내용|어떤내용)/.test(text)) return "content";
  if (/(이게뭐|뭔가요|정체)/.test(text)) return "identity";
  if (/(어떤|무슨|종류|선택|타입)/.test(text)) return "type_choice";
  if (/(인가요|나요|습니까|까|니|돼요|되나요|할까요|있나요|없나요|\?)$/.test(text)) return "yesno";
  return "statement";
}

function buildLocalIntentSignature(
  value: string,
  lexicon: ConfigureLexicon | undefined,
  tokenContext?: ConfigureTokenContext,
): LocalIntentSignature {
  const questionAxis = detectLocalQuestionAxis(value, lexicon);
  const actionAxis = detectLocalActionAxis(value, tokenContext);
  return {
    domainKey: "none",
    actionAxis,
    questionAxis,
  };
}

function detectLocalActionAxis(value: string, tokenContext?: ConfigureTokenContext): LocalActionAxis {
  const tokens = new Set(tokenContext?.morphTokensByText?.get(value) ?? []);
  if (hasLocalSpeechSpeedContext(value, tokens)) return "speech_speed";
  if (tokens.has("intent_function_call_partner_contact")) return "call_partner_contact";
  if (tokens.has("intent_function_call_self_action")) return "call_self_action";
  if (tokens.has("intent_function_call_inbound_request")) return "call_inbound_request";
  if (tokens.has("intent_function_refusal") || hasMlConfigureTokenPrefix(tokens, "intent_function_prohibit_")) return "refusal";
  if (hasAnyMlConfigureToken(tokens, ML_AVAILABILITY_BUSY_AXIS_TOKENS)) return "availability_unavailable";
  if (tokens.has("intent_function_inability")) return "inability";
  if (tokens.has("intent_function_request")) return "request";
  if (tokens.has("intent_function_self_action")) return "self_action";
  if (tokens.has("intent_function_permission")) return "permission";
  if (tokens.has("intent_function_completed")) return "completed";
  if (tokens.has("intent_function_absence")) return "absence";
  if (tokens.has("intent_function_unknown")) return "unknown";
  if (tokens.has("intent_function_negative")) return "negative";

  const text = normalizeDomainTextWithLexicon(value);
  if (/(전화|통화|연락).*(주세|주시면|주실|주세요|주시)/.test(text)) return "call_inbound_request";
  if (/(랑|이랑|하고|와|과).*(전화|통화|연락).*(할게|하겠|하고싶|하고싶)/.test(text)) return "call_partner_contact";
  if (/(제가|내가|저가).*(전화|통화|연락).*(할게|걸게|드릴게|하겠)/.test(text)) return "call_self_action";
  if (/(전화|통화|연락).*(못|불가|안되|안돼|안됩)/.test(text)) return "inability";
  if (/(거부|거절|싫|하지마|말라|그만)/.test(text)) return "refusal";
  return "general";
}

function hasLocalSpeechSpeedContext(value: string, tokens: Set<string>) {
  if (!hasAnyMlConfigureToken(tokens, ML_SPEECH_SPEED_AXIS_TOKENS)) return false;
  const text = normalizeDomainTextWithLexicon(value);
  const hasSpeechContext =
    /(말|발화|읽|설명|안내|목소리|음성|속도)/.test(text) ||
    tokens.has("morph:말") ||
    tokens.has("morph:발화") ||
    tokens.has("morph:설명") ||
    tokens.has("morph:설명하다") ||
    tokens.has("morph:알리다");
  if (hasSpeechContext) return true;
  const hasOtherAction = [...tokens].some((token) => {
    if (!token.startsWith("morph:")) return false;
    if (ML_SPEECH_SPEED_AXIS_TOKENS.has(token)) return false;
    if (ML_GENERIC_PREDICATE_TOKENS.has(token) || ML_LOW_DISCRIMINATIVE_TOKENS.has(token)) return false;
    return token.endsWith("하다") && token.length > "morph:하다".length;
  });
  return !hasOtherAction;
}

function getLocalIntentDomainKey(
  domainHits: string[],
  questionAxis: LocalQuestionAxis,
) {
  if (questionAxis === "meaning" || questionAxis === "content") {
    return "none";
  }
  return domainHits.length > 0 ? domainHits.join("+") : "none";
}

function localIntentSignatureKey(signature: LocalIntentSignature) {
  return `${signature.domainKey}|${signature.actionAxis}|${signature.questionAxis}`;
}

function parseLocalDomainKey(domainKey: string) {
  return domainKey === "none" ? [] : domainKey.split("+").filter(Boolean);
}

function areLocalDomainKeysCompatible(left: string, right: string) {
  if (left === right) return true;
  if (left === "none" || right === "none") return true;
  const rightValues = new Set(parseLocalDomainKey(right));
  return parseLocalDomainKey(left).some((value) => rightValues.has(value));
}

const FLEXIBLE_LOCAL_QUESTION_AXES: LocalQuestionAxis[] = ["statement", "yesno"];
const WHAT_LOCAL_QUESTION_AXES: LocalQuestionAxis[] = ["meaning", "content", "identity", "type_choice"];
const TERM_MEANING_LOCAL_QUESTION_AXES: LocalQuestionAxis[] = ["meaning", "identity", "type_choice"];

function isWhatLocalQuestionAxis(axis: LocalQuestionAxis) {
  return WHAT_LOCAL_QUESTION_AXES.includes(axis);
}

function normalizeLocalQuestionAxis(questionAxis: LocalQuestionAxis) {
  if (questionAxis === "content") {
    return "content";
  }
  if (isWhatLocalQuestionAxis(questionAxis)) {
    return "meaning";
  }
  return questionAxis;
}

function isConcreteLocalQuestionAxis(axis: LocalQuestionAxis) {
  return !FLEXIBLE_LOCAL_QUESTION_AXES.includes(axis);
}

function areLocalQuestionAxesCompatible(left: LocalQuestionAxis, right: LocalQuestionAxis) {
  if (left === right) return true;
  if (isWhatLocalQuestionAxis(left) && isWhatLocalQuestionAxis(right)) return true;
  if (isConcreteLocalQuestionAxis(left) || isConcreteLocalQuestionAxis(right)) return false;
  return true;
}

function areMlLocalQuestionAxesCompatible(left: LocalQuestionAxis, right: LocalQuestionAxis) {
  if (left === right) return true;
  if (TERM_MEANING_LOCAL_QUESTION_AXES.includes(left) && TERM_MEANING_LOCAL_QUESTION_AXES.includes(right)) return true;
  if (FLEXIBLE_LOCAL_QUESTION_AXES.includes(left) && FLEXIBLE_LOCAL_QUESTION_AXES.includes(right)) return true;
  return false;
}

function areLocalActionAxesCompatible(left: LocalActionAxis, right: LocalActionAxis) {
  if (left === right) return true;
  if (left === "general" || right === "general") return true;
  if (
    (left === "call_self_action" && right === "call_inbound_request") ||
    (left === "call_inbound_request" && right === "call_self_action") ||
    (left === "call_self_action" && right === "call_partner_contact") ||
    (left === "call_partner_contact" && right === "call_self_action")
  ) {
    return false;
  }
  if (
    (left === "speech_speed" && ["availability_unavailable", "inability", "refusal", "negative"].includes(right)) ||
    (right === "speech_speed" && ["availability_unavailable", "inability", "refusal", "negative"].includes(left))
  ) {
    return false;
  }
  if (
    (left === "call_partner_contact" && ["request", "call_inbound_request"].includes(right)) ||
    (right === "call_partner_contact" && ["request", "call_inbound_request"].includes(left))
  ) {
    return true;
  }
  if (
    (left === "refusal" && right === "inability") ||
    (left === "inability" && right === "refusal")
  ) {
    return false;
  }
  if (
    (left === "request" && ["inability", "refusal", "negative", "completed"].includes(right)) ||
    (right === "request" && ["inability", "refusal", "negative", "completed"].includes(left))
  ) {
    return false;
  }
  return false;
}

function isMlConfigureNluType(nluType?: ConfigureNluType) {
  return nluType === "ml";
}

function getDominantLocalIntentSignature(
  indexes: number[],
  utterances: string[],
  lexicon: ConfigureLexicon | undefined,
  tokenContext?: ConfigureTokenContext,
) {
  const counts = new Map<string, { signature: LocalIntentSignature; count: number }>();
  indexes.forEach((index) => {
    const signature = buildLocalIntentSignature(utterances[index] ?? "", lexicon, tokenContext);
    const key = localIntentSignatureKey(signature);
    const previous = counts.get(key);
    counts.set(key, { signature, count: (previous?.count ?? 0) + 1 });
  });
  return [...counts.values()].sort((left, right) => right.count - left.count)[0]?.signature ?? {
    domainKey: "none",
    actionAxis: "general",
    questionAxis: "statement",
  };
}

function getUniqueLocalIntentSignatures(
  indexes: number[],
  utterances: string[],
  lexicon: ConfigureLexicon | undefined,
  tokenContext?: ConfigureTokenContext,
) {
  const signatures = new Map<string, LocalIntentSignature>();
  indexes.forEach((index) => {
    const signature = buildLocalIntentSignature(utterances[index] ?? "", lexicon, tokenContext);
    signatures.set(localIntentSignatureKey(signature), signature);
  });
  return [...signatures.values()];
}

function hasHardLocalIntentSignatureConflict(left: LocalIntentSignature, right: LocalIntentSignature, nluType?: ConfigureNluType) {
  if (isMlConfigureNluType(nluType)) {
    return hasHardMlLocalActionAxisConflict(left.actionAxis, right.actionAxis) ||
      !areMlLocalQuestionAxesCompatible(left.questionAxis, right.questionAxis);
  }
  if (!areLocalDomainKeysCompatible(left.domainKey, right.domainKey)) {
    return true;
  }
  if (!areLocalActionAxesCompatible(left.actionAxis, right.actionAxis)) {
    return true;
  }
  if (!areLocalQuestionAxesCompatible(left.questionAxis, right.questionAxis)) {
    return true;
  }
  return false;
}

function hasHardMlLocalActionAxisConflict(left: LocalActionAxis, right: LocalActionAxis) {
  if (left === right || left === "general" || right === "general") return false;
  if (
    (left === "call_self_action" && right === "call_inbound_request") ||
    (left === "call_inbound_request" && right === "call_self_action") ||
    (left === "call_self_action" && right === "call_partner_contact") ||
    (left === "call_partner_contact" && right === "call_self_action")
  ) {
    return true;
  }
  if (
    (left === "speech_speed" && ["availability_unavailable", "inability", "refusal", "negative"].includes(right)) ||
    (right === "speech_speed" && ["availability_unavailable", "inability", "refusal", "negative"].includes(left))
  ) {
    return true;
  }
  if (
    (left === "refusal" && right === "inability") ||
    (left === "inability" && right === "refusal")
  ) {
    return true;
  }
  return false;
}

function getLocalClusterSignaturePenalty(
  leftSignature: LocalIntentSignature,
  rightSignature: LocalIntentSignature,
  nluType?: ConfigureNluType,
) {
  if (isMlConfigureNluType(nluType)) {
    let penalty = 0;
    if (!areLocalActionAxesCompatible(leftSignature.actionAxis, rightSignature.actionAxis)) {
      penalty += 1;
    }
    if (!areMlLocalQuestionAxesCompatible(leftSignature.questionAxis, rightSignature.questionAxis)) {
      penalty += 1;
    }
    return penalty;
  }
  let penalty = 0;
  if (!areLocalDomainKeysCompatible(leftSignature.domainKey, rightSignature.domainKey)) {
    penalty += 0.2;
  }
  if (!areLocalActionAxesCompatible(leftSignature.actionAxis, rightSignature.actionAxis)) {
    penalty += 0;
  }
  if (!areLocalQuestionAxesCompatible(leftSignature.questionAxis, rightSignature.questionAxis)) {
    penalty += 0.24;
  }
  return penalty;
}

type LocalClusterMergeMetadata = {
  dominantSignature: LocalIntentSignature;
  uniqueSignatures: LocalIntentSignature[];
};

function buildLocalClusterMergeMetadata(
  indexes: number[],
  utterances: string[],
  lexicon: ConfigureLexicon | undefined,
  tokenContext?: ConfigureTokenContext,
): LocalClusterMergeMetadata {
  return {
    dominantSignature: getDominantLocalIntentSignature(indexes, utterances, lexicon, tokenContext),
    uniqueSignatures: getUniqueLocalIntentSignatures(indexes, utterances, lexicon, tokenContext),
  };
}

function hasHardLocalClusterMetadataConflict(
  left: LocalClusterMergeMetadata,
  right: LocalClusterMergeMetadata,
  nluType?: ConfigureNluType,
) {
  return left.uniqueSignatures.some((leftSignature) =>
    right.uniqueSignatures.some((rightSignature) => hasHardLocalIntentSignatureConflict(leftSignature, rightSignature, nluType)),
  );
}

function canMergeLocalClusterMetadata(
  left: LocalClusterMergeMetadata,
  right: LocalClusterMergeMetadata,
  nluType?: ConfigureNluType,
) {
  const leftSignature = left.dominantSignature;
  const rightSignature = right.dominantSignature;
  if (!areLocalDomainKeysCompatible(leftSignature.domainKey, rightSignature.domainKey)) {
    return false;
  }
  if (!areLocalActionAxesCompatible(leftSignature.actionAxis, rightSignature.actionAxis)) {
    return false;
  }
  if (!areLocalQuestionAxesCompatible(leftSignature.questionAxis, rightSignature.questionAxis)) {
    return false;
  }
  return true;
}

function getMaxLocalClusterSize(totalUtterances: number, targetCount: number) {
  return Math.max(8, Math.ceil(totalUtterances / Math.max(1, targetCount)) * 2);
}

function getRelaxedMaxLocalClusterSize(totalUtterances: number, targetCount: number) {
  const averageSize = Math.ceil(totalUtterances / Math.max(1, targetCount));
  return Math.max(getMaxLocalClusterSize(totalUtterances, targetCount), averageSize * 3, 16);
}

function getForcedTargetMaxLocalClusterSize(totalUtterances: number, targetCount: number) {
  const averageSize = Math.ceil(totalUtterances / Math.max(1, targetCount));
  return Math.max(4, averageSize + Math.ceil(Math.sqrt(averageSize)));
}

function getNearTargetClusterLimit(targetCount: number) {
  return Math.max(targetCount + 4, Math.ceil(targetCount * 1.25));
}

function getNearTargetMaxLocalClusterSize(totalUtterances: number, targetCount: number) {
  const averageSize = Math.ceil(totalUtterances / Math.max(1, targetCount));
  return Math.max(getMaxLocalClusterSize(totalUtterances, targetCount), averageSize * 3, 24);
}

function getEffectiveLocalTargetCount(
  targetCount: number,
  utteranceCount: number,
) {
  const normalizedTarget = Math.max(1, Math.min(targetCount, utteranceCount));
  return normalizedTarget;
}

const LOCAL_RELAXED_INITIAL_MERGE_MIN_SCORE = 0.18;
const LOCAL_MINIMIZE_INITIAL_MERGE_MIN_SCORE = 0.2;
const LOCAL_NEAR_INITIAL_MERGE_MIN_SCORE = 0.12;
const LOCAL_EXACT_INITIAL_MERGE_MIN_SCORE = 0.08;
const LOCAL_STRICT_TARGET_MERGE_MIN_SCORE = 0.1;
const LOCAL_RELAXED_TARGET_MERGE_MIN_SCORE = 0.2;
const LOCAL_NEAR_TARGET_MERGE_MIN_SCORE = 0.16;
const LOCAL_EXACT_TARGET_MERGE_MIN_SCORE = 0.08;
const LOCAL_ML_NEAR_TARGET_MERGE_MIN_SCORE = 0.04;
const LOCAL_ML_FORCED_TARGET_MERGE_MIN_SCORE = 0.04;

function clampSimilarityScore(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function getMlCountAwareMergeMinimumScore(totalUtterances: number, targetCount: number) {
  const ratio = clampSimilarityScore(targetCount / Math.max(1, totalUtterances));
  return clampSimilarityScore(0.04 + ratio * 0.42, 0.04, 0.32);
}

function getMlInitialMergeMinimumScore(
  totalUtterances: number,
  targetCount: number,
  targetCountPolicy: TargetCountPolicy,
  usedRelaxedMerge: boolean,
) {
  const base = getMlCountAwareMergeMinimumScore(totalUtterances, targetCount);
  const policyFactor = targetCountPolicy === "exact" ? 0.72 : targetCountPolicy === "minimize" ? 0.86 : 1;
  const relaxedFactor = usedRelaxedMerge ? 0.82 : 1;
  return clampSimilarityScore(base * policyFactor * relaxedFactor, 0.02, 0.32);
}

function getMlTargetMergeMinimumScore(
  totalUtterances: number,
  targetCount: number,
  targetCountPolicy: TargetCountPolicy,
) {
  const base = getMlCountAwareMergeMinimumScore(totalUtterances, targetCount);
  if (targetCountPolicy === "exact") return clampSimilarityScore(base * 0.35, 0.01, 0.16);
  if (targetCountPolicy === "minimize") return clampSimilarityScore(base * 0.45, 0.015, 0.18);
  return clampSimilarityScore(base * 0.78, 0.03, 0.24);
}

function getInitialMergeMinimumScore(
  targetCountPolicy: TargetCountPolicy,
  usedRelaxedMerge: boolean,
  totalUtterances: number,
  targetCount: number,
  nluType: ConfigureNluType,
) {
  if (isMlConfigureNluType(nluType)) {
    return getMlInitialMergeMinimumScore(totalUtterances, targetCount, targetCountPolicy, usedRelaxedMerge);
  }
  if (targetCountPolicy === "exact") return LOCAL_EXACT_INITIAL_MERGE_MIN_SCORE;
  if (targetCountPolicy === "minimize") return LOCAL_MINIMIZE_INITIAL_MERGE_MIN_SCORE;
  return usedRelaxedMerge ? LOCAL_RELAXED_INITIAL_MERGE_MIN_SCORE : LOCAL_NEAR_INITIAL_MERGE_MIN_SCORE;
}

async function mergeLocalClusterIndexesTowardTarget(
  clusterIndexes: number[][],
  utterances: string[],
  matrix: number[][],
  lexicon: ConfigureLexicon | undefined,
  targetCount: number,
  maxSize: number,
  strictSignatures: boolean,
  minimumScore = 0,
  tokenContext?: ConfigureTokenContext,
  nluType?: ConfigureNluType,
  onProgress?: LocalClassifyProgressHandler,
) {
  let mergeCount = 0;
  const totalMerges = Math.max(1, clusterIndexes.length - targetCount);
  while (clusterIndexes.length > targetCount) {
    const best = await findBestLocalClusterMerge(
      clusterIndexes,
      utterances,
      matrix,
      lexicon,
      maxSize,
      strictSignatures,
      tokenContext,
      nluType,
    );
    if (best.left < 0 || best.right < 0 || best.score < minimumScore) break;
    clusterIndexes[best.left] = [...clusterIndexes[best.left], ...clusterIndexes[best.right]];
    clusterIndexes.splice(best.right, 1);
    mergeCount += 1;
    onProgress?.({
      stage: "그룹 병합",
      completed: mergeCount,
      total: totalMerges,
      label: "3/4단계",
    });
    await yieldToBrowserDuringLocalClassify(mergeCount);
  }
}

function splitOversizedClusterIndexes(
  clusterIndexes: number[][],
  utterances: string[],
  lexicon: ConfigureLexicon | undefined,
  targetCount: number,
  tokenContext?: ConfigureTokenContext,
  nluType?: ConfigureNluType,
) {
  const maxSize = getMaxLocalClusterSize(utterances.length, targetCount);
  const nextClusters: number[][] = [];
  clusterIndexes.forEach((indexes) => {
    if (isMlConfigureNluType(nluType)) {
      for (let index = 0; index < indexes.length; index += maxSize) {
        nextClusters.push(indexes.slice(index, index + maxSize));
      }
      return;
    }
    const signatureGroups = new Map<string, number[]>();
    indexes.forEach((index) => {
      const signature = buildLocalIntentSignature(utterances[index] ?? "", lexicon, tokenContext);
      const key = localIntentSignatureKey(signature);
      signatureGroups.set(key, [...(signatureGroups.get(key) ?? []), index]);
    });
    const groups = [...signatureGroups.values()];
    if (groups.length <= 1 && indexes.length <= maxSize) {
      nextClusters.push(indexes);
      return;
    }
    groups.forEach((group) => {
      for (let index = 0; index < group.length; index += maxSize) {
        nextClusters.push(group.slice(index, index + maxSize));
      }
    });
  });
  return nextClusters;
}

function createIntentClustersFromIndexes(
  clusterIndexes: number[][],
  utterances: string[],
  matrix: number[][],
) {
  return clusterIndexes
    .map((indexes, index) => {
      const orderedIndexes = [...indexes].sort((left, right) => left - right);
      const seed = selectClusterSeed(orderedIndexes, utterances, matrix);
      return {
        id: crypto.randomUUID(),
        name: `의도 ${index + 1}`,
        answer: "",
        utterances: orderedIndexes.map((utteranceIndex) => utterances[utteranceIndex]),
        seed,
      };
    })
    .filter((cluster) => cluster.utterances.length > 0);
}

async function createClustersForUtterances(
  utterances: string[],
  targetCount: number,
  lexicon: ConfigureLexicon | undefined,
  scoring: ConfigurationScoringConfig,
  nluType: ConfigureNluType,
  targetCountPolicy: TargetCountPolicy,
  tokenContext?: ConfigureTokenContext,
  onProgress?: LocalClassifyProgressHandler,
): Promise<IntentCluster[]> {
  const count = getEffectiveLocalTargetCount(targetCount, utterances.length);
  const matrix = await buildSimilarityMatrix(utterances, lexicon, scoring, nluType, tokenContext, onProgress);
  const clusterIndexes = utterances.map((_, index) => [index]);
  const maxSize = getMaxLocalClusterSize(utterances.length, count);
  const relaxedMaxSize = getRelaxedMaxLocalClusterSize(utterances.length, count);
  const forcedMaxSize = getForcedTargetMaxLocalClusterSize(utterances.length, count);
  let mergeCount = 0;
  const initialMergeTotal = Math.max(1, utterances.length - count);

  while (clusterIndexes.length > count) {
    let usedRelaxedMerge = false;
    let best = await findBestLocalClusterMerge(clusterIndexes, utterances, matrix, lexicon, maxSize, true, tokenContext, nluType);
    if (best.left < 0 || best.right < 0) {
      if (targetCountPolicy === "minimize") {
        break;
      }
      usedRelaxedMerge = true;
      best = await findBestLocalClusterMerge(clusterIndexes, utterances, matrix, lexicon, maxSize, false, tokenContext, nluType);
    }
    if (
      best.left < 0 ||
      best.right < 0 ||
      best.score < getInitialMergeMinimumScore(targetCountPolicy, usedRelaxedMerge, utterances.length, count, nluType)
    ) {
      break;
    }
    clusterIndexes[best.left] = [...clusterIndexes[best.left], ...clusterIndexes[best.right]];
    clusterIndexes.splice(best.right, 1);
    mergeCount += 1;
    onProgress?.({
      stage: "초기 그룹 병합",
      completed: mergeCount,
      total: initialMergeTotal,
      label: "3/4단계",
    });
    await yieldToBrowserDuringLocalClassify(mergeCount);
  }

  const normalizedClusterIndexes = splitOversizedClusterIndexes(clusterIndexes, utterances, lexicon, count, tokenContext, nluType);
  if (isMlConfigureNluType(nluType) && targetCountPolicy === "minimize" && normalizedClusterIndexes.length > count) {
    await mergeLocalClusterIndexesTowardTarget(
      normalizedClusterIndexes,
      utterances,
      matrix,
      lexicon,
      count,
      forcedMaxSize,
      false,
      getMlTargetMergeMinimumScore(utterances.length, count, targetCountPolicy),
      tokenContext,
      nluType,
      onProgress,
    );
  }
  if (isMlConfigureNluType(nluType) && targetCountPolicy === "near") {
    await mergeLocalClusterIndexesTowardTarget(
      normalizedClusterIndexes,
      utterances,
      matrix,
      lexicon,
      count,
      relaxedMaxSize,
      false,
      getMlTargetMergeMinimumScore(utterances.length, count, targetCountPolicy),
      tokenContext,
      nluType,
      onProgress,
    );
    return createIntentClustersFromIndexes(normalizedClusterIndexes, utterances, matrix);
  }
  if (targetCountPolicy !== "minimize") {
    const useMlExactTargetMerge = isMlConfigureNluType(nluType) && targetCountPolicy === "exact";
    const exactTargetMergeMinScore = useMlExactTargetMerge
      ? getMlTargetMergeMinimumScore(utterances.length, count, targetCountPolicy)
      : LOCAL_EXACT_TARGET_MERGE_MIN_SCORE;
    const strictTargetMergeMinScore = isMlConfigureNluType(nluType)
      ? getMlTargetMergeMinimumScore(utterances.length, count, targetCountPolicy)
      : LOCAL_STRICT_TARGET_MERGE_MIN_SCORE;
    const relaxedTargetMergeMinScore = isMlConfigureNluType(nluType)
      ? getMlTargetMergeMinimumScore(utterances.length, count, targetCountPolicy)
      : LOCAL_RELAXED_TARGET_MERGE_MIN_SCORE;
    await mergeLocalClusterIndexesTowardTarget(
      normalizedClusterIndexes,
      utterances,
      matrix,
      lexicon,
      count,
      maxSize,
      true,
      strictTargetMergeMinScore,
      tokenContext,
      nluType,
      onProgress,
    );
    if (normalizedClusterIndexes.length > count) {
      await mergeLocalClusterIndexesTowardTarget(
        normalizedClusterIndexes,
        utterances,
        matrix,
        lexicon,
        count,
        relaxedMaxSize,
        false,
        relaxedTargetMergeMinScore,
        tokenContext,
        nluType,
        onProgress,
      );
    }
    if (targetCountPolicy === "near") {
      const nearLimit = getNearTargetClusterLimit(count);
      if (normalizedClusterIndexes.length > nearLimit) {
        await mergeLocalClusterIndexesTowardTarget(
          normalizedClusterIndexes,
          utterances,
          matrix,
          lexicon,
          nearLimit,
          getNearTargetMaxLocalClusterSize(utterances.length, count),
          false,
          LOCAL_NEAR_TARGET_MERGE_MIN_SCORE,
          tokenContext,
          nluType,
          onProgress,
        );
      }
    }
    if (targetCountPolicy === "exact" && normalizedClusterIndexes.length > count) {
      await mergeLocalClusterIndexesTowardTarget(
        normalizedClusterIndexes,
        utterances,
        matrix,
        lexicon,
        count,
        forcedMaxSize,
        false,
        exactTargetMergeMinScore,
        tokenContext,
        nluType,
        onProgress,
      );
    }
  }

  return createIntentClustersFromIndexes(normalizedClusterIndexes, utterances, matrix);
}

async function createClusters(
  utterances: string[],
  targetCount: number,
  lexicon: ConfigureLexicon | undefined,
  scoring: ConfigurationScoringConfig,
  nluType: ConfigureNluType,
  targetCountPolicy: TargetCountPolicy,
  tokenContext?: ConfigureTokenContext,
  onProgress?: LocalClassifyProgressHandler,
): Promise<IntentCluster[]> {
  return createClustersForUtterances(utterances, targetCount, lexicon, scoring, nluType, targetCountPolicy, tokenContext, onProgress);
}

function makeDefaultAnswer(name: string) {
  return `${name}에 대해 안내드리겠습니다.`;
}

function formatTalkVariableAnswer(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (/^\{\{\s*\$[^{}]+\s*\}\}$/u.test(trimmed)) {
    return trimmed;
  }
  if (/^\$[\p{ID_Start}_][$_‌‍\p{ID_Continue}]*$/u.test(trimmed)) {
    return `{{${trimmed}}}`;
  }
  return trimmed;
}

function getLlmModelLabel(provider: LlmProvider, model: LlmModelKey) {
  return LLM_MODEL_OPTIONS_BY_PROVIDER[provider].find((option) => option.value === model)?.label ?? model;
}

function buildFlowGraph(dialog: VersionDialogAsset, answer: string, now: string, updatedBy: string) {
  const startNodeId = `flow-start-${dialog.id}`;
  const talkNodeId = crypto.randomUUID();
  const endNodeId = crypto.randomUUID();
  return {
    id: `flow-${dialog.id}`,
    dialogId: dialog.id,
    dialogNo: dialog.dialogNo,
    dialogType: dialog.dialogType,
    name: dialog.name,
    nodes: [
      {
        id: startNodeId,
        kind: "start",
        title: "대화 시작",
        position: { x: 120, y: 120 },
        config: {
          previewUtterance: dialog.utterances[0]?.text ?? "",
        },
      },
      {
        id: talkNodeId,
        kind: "talk",
        title: "답변",
        position: { x: 360, y: 120 },
        config: {
          messageType: "text",
          basicMessages: [answer],
          messages: [answer],
          responseType: "none",
          responseVariableName: "",
          responseLocal: false,
          responseEntityBindingIds: [],
          responseEntityExtractions: [],
          intentTransitionLocked: false,
        },
      },
      {
        id: endNodeId,
        kind: "end",
        title: "End",
        position: { x: 640, y: 120 },
        config: { sessionEnd: false },
      },
    ],
    links: [
      {
        id: crypto.randomUUID(),
        sourceNodeId: startNodeId,
        sourcePort: "next",
        targetNodeId: talkNodeId,
        kind: "default",
        waypoints: [],
      },
      {
        id: crypto.randomUUID(),
        sourceNodeId: talkNodeId,
        sourcePort: "next",
        targetNodeId: endNodeId,
        kind: "default",
        waypoints: [],
      },
    ],
    updatedAt: now,
    updatedBy,
  };
}

export function IntentConfigurePage() {
  const workspace = useStudioWorkspace();
  const { language: uiLanguage } = useI18n();
  const inputCopy = INTENT_CONFIGURE_INPUT_CATALOGS[uiLanguage];
  const router = useRouter();
  const params = useParams<{ botId: string; versionId: string }>();
  const botId = decodeURIComponent(params.botId);
  const versionName = decodeURIComponent(params.versionId);
  const sectionFetchKeyRef = useRef<string | null>(null);
  const [authSession, setAuthSession] = useState<AuthSession | null>(workspace.session);
  const [bot, setBot] = useState<StudioBotApiItem | null>(workspace.bot);
  const [versions, setVersions] = useState<StudioBotVersionApiItem[]>(workspace.versions);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [criteriaSaving, setCriteriaSaving] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [classifyProgressMessage, setClassifyProgressMessage] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [utteranceInput, setUtteranceInput] = useState("");
  const [targetCount, setTargetCount] = useState(50);
  const [targetCountPolicy, setTargetCountPolicy] = useState<TargetCountPolicy>("near");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mlSeedIntentOpen, setMlSeedIntentOpen] = useState(false);
  const [configurationScoring, setConfigurationScoring] = useState<ConfigurationScoringConfig>(normalizeConfigurationScoring());
  const [clusters, setClusters] = useState<IntentCluster[]>([]);
  const [selectedClusterIds, setSelectedClusterIds] = useState<string[]>([]);
  const [mlSeedIntentText, setMlSeedIntentText] = useState("");
  const configureNluType: NluType = "llm";
  const [configureNluModel, setConfigureNluModel] = useState<NluModelKey>(defaultNluModelForType("llm"));
  const [configureLlmProvider, setConfigureLlmProvider] = useState<LlmProvider>(DEFAULT_LLM_PROVIDER);
  const [configureLlmModel, setConfigureLlmModel] = useState<LlmModelKey>(normalizeLlmModel(DEFAULT_LLM_PROVIDER, undefined));
  const [dictionarySuggestions, setDictionarySuggestions] = useState<DictionaryRegistrationSuggestion[]>([]);
  const [selectedDictionarySuggestionIds, setSelectedDictionarySuggestionIds] = useState<string[]>([]);
  const [mlTestUtterance, setMlTestUtterance] = useState("");
  const [mlTesting, setMlTesting] = useState(false);
  const [mlTestResult, setMlTestResult] = useState<MlConfigureTestResult | null>(null);
  const [ragSourceType, setRagSourceType] = useState<RagAnswerSourceType>("text");
  const [ragAnswerText, setRagAnswerText] = useState("");
  const [ragDocumentTitle, setRagDocumentTitle] = useState("");
  const [ragFile, setRagFile] = useState<File | null>(null);
  const [ragConfiguring, setRagConfiguring] = useState(false);
  const [ragConfigureStep, setRagConfigureStep] = useState("");
  const [ragConfigureProgress, setRagConfigureProgress] = useState(0);
  const [ragEmbeddingResult, setRagEmbeddingResult] = useState<RagAnswerEmbeddingResult | null>(null);

  const effectiveVersion = bot?.active_version ?? null;
  const dialogs = useMemo(() => getVersionDialogs(effectiveVersion), [effectiveVersion]);
  const effectiveBotId = bot?.id ?? botId;
  const effectiveVersionName = effectiveVersion?.version_no ? `v${effectiveVersion.version_no}` : versionName;
  const versionDocument = useMemo(() => normalizeVersionDocument(effectiveVersion?.version_json), [effectiveVersion]);
  const versionAssetCounts = effectiveVersion?.asset_counts;
  const userDictionaryCount = useMemo(
    () =>
      Array.isArray(effectiveVersion?.version_json?.dictionary)
        ? countUserDictionaryEntries(normalizeVersionDictionary(versionDocument.dictionary))
        : (versionAssetCounts?.dictionary ?? 0),
    [effectiveVersion?.version_json?.dictionary, versionAssetCounts?.dictionary, versionDocument.dictionary],
  );
  const userEntityCount = useMemo(
    () =>
      Array.isArray(effectiveVersion?.version_json?.entities)
        ? countUserEntityEntries(normalizeVersionEntities(versionDocument.entities))
        : (versionAssetCounts?.entities ?? 0),
    [effectiveVersion?.version_json?.entities, versionAssetCounts?.entities, versionDocument.entities],
  );
  const summaryCards = useMemo(
    () =>
      buildSummaryCards(effectiveBotId, effectiveVersionName, bot, dialogs.length, {
        dictionary: userDictionaryCount,
        entities: userEntityCount,
      }),
    [bot, dialogs.length, effectiveBotId, effectiveVersionName, userDictionaryCount, userEntityCount],
  );
  const aiConfig = useMemo(() => getVersionAiConfig(effectiveVersion, bot), [bot, effectiveVersion]);
  const nluType = configureNluType as ConfigureNluType;
  const nluModel = configureNluModel;
  const ragAnswerMode = isRagAnswerMode(aiConfig);
  const nluModelEmbedding = getNluModelEmbedding(configureNluType, configureNluModel);
  const ragEmbedding = aiConfig.answer_mode === "llm_rag"
    ? { provider: `llm:${configureLlmProvider}`, model: configureLlmModel }
    : nluModelEmbedding;
  const ragEmbeddingDescription = aiConfig.answer_mode === "llm_rag"
    ? inputCopy.llmRagEmbeddingDescription
    : getNluModelDescription(configureNluType, configureNluModel);
  const ragEmbeddingLabel = aiConfig.answer_mode === "llm_rag"
    ? `${LLM_PROVIDER_OPTIONS.find((option) => option.value === configureLlmProvider)?.label ?? configureLlmProvider} ${getLlmModelLabel(configureLlmProvider, configureLlmModel)}`
    : ragEmbedding.model || getNluModelLabel(configureNluType, configureNluModel);
  const canUseConfigureSettings = nluType !== "llm";
  const configureLexicon = useMemo(() => buildLexicon(versionDocument), [versionDocument]);
  const operatingVersion = isOperatingVersion(effectiveVersion);
  const versionSettings = useMemo(() => getBotVersionSettings(bot ?? {}), [bot]);
  const criteriaIntentCount = clusters.length > 0 ? clusters.length : targetCount;
  const recommendedCriteria = useMemo(() => recommendNluCriteria(criteriaIntentCount), [criteriaIntentCount]);
  const recommendedConfigureScoring = useMemo(() => recommendConfigureScoring(nluType), [nluType]);
  const mlSeedIntentParseResult = useMemo(() => parseMlSeedIntentText(mlSeedIntentText), [mlSeedIntentText]);
  const mlSeedIntentCount = mlSeedIntentParseResult.seedIntents.length;
  const baseDictionarySuggestions = useMemo(
    () => collectDictionaryRegistrationSuggestions([], normalizeVersionDictionary(versionDocument.dictionary), true),
    [versionDocument.dictionary],
  );
  const visibleDictionarySuggestions = dictionarySuggestions.length > 0 ? dictionarySuggestions : baseDictionarySuggestions;

  useEffect(() => {
    setAuthSession(workspace.session);
    setVersions(workspace.versions);
    setBot(workspace.bot);
    setConfigurationScoring(normalizeConfigurationScoring(workspace.bot.data_json?.configuration_scoring));
    setLoading(false);
    setErrorMessage("");
    saveLastBotScreen(`/studio/bots/${workspace.bot.id ?? botId}/versions/${versionName}/configure`);
  }, [botId, versionName, workspace.bot, workspace.session, workspace.versions]);

  useEffect(() => {
    if (!authSession || !bot?.id || !bot.active_version?.id) {
      return;
    }

    const version = bot.active_version;
    const loadedDocument = version.version_json;
    const hasSectionDocument = Boolean(
      loadedDocument &&
      Array.isArray(loadedDocument.dialogs) &&
      Array.isArray(loadedDocument.dialog_flow_graphs) &&
      Array.isArray(loadedDocument.dictionary) &&
      Array.isArray(loadedDocument.entities) &&
      loadedDocument.system_config,
    );
    const fetchKey = `${bot.id}:${version.id}`;
    if (sectionFetchKeyRef.current === fetchKey && hasSectionDocument) {
      return;
    }

    sectionFetchKeyRef.current = fetchKey;
    let ignore = false;
    setLoading(true);
    setErrorMessage("");

    fetchStudioBotVersionConfigure(authSession.access_token, bot.id, version.id)
      .then((response) => {
        if (ignore) {
          return;
        }

        const currentDocument = normalizeVersionDocument(bot.active_version?.version_json);
        const nextDocument = {
          ...currentDocument,
          dialogs: normalizeVersionDialogs(response.dialogs),
          dialog_flow_graphs: response.dialog_flow_graphs,
          dictionary: normalizeVersionDictionary(response.dictionary),
          entities: normalizeVersionEntities(response.entities),
          system_config: response.system_config,
        };
        const nextVersion = {
          ...response.version,
          version_json: nextDocument,
        };
        setBot((current) => (
          current && current.id === bot.id
            ? {
                ...current,
                active_version: nextVersion,
                active_version_id: nextVersion.id,
                updated_at: nextVersion.updated_at ?? current.updated_at,
              }
            : current
        ));
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : "구성 정보를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [authSession, bot]);

  useEffect(() => {
    setDictionarySuggestions([]);
    setSelectedDictionarySuggestionIds([]);
    setSelectedClusterIds([]);
    setMlTestResult(null);
  }, [effectiveVersion?.id]);

  useEffect(() => {
    setConfigureNluModel(normalizeNluModel("llm", typeof aiConfig.nlu_model === "string" ? aiConfig.nlu_model : undefined));
  }, [effectiveVersion?.id, aiConfig.nlu_model]);

  useEffect(() => {
    const nextProvider = normalizeLlmProvider(typeof aiConfig.llm_provider === "string" ? aiConfig.llm_provider : undefined);
    setConfigureLlmProvider(nextProvider);
    setConfigureLlmModel(normalizeLlmModel(nextProvider, typeof aiConfig.llm_model === "string" ? aiConfig.llm_model : undefined));
  }, [effectiveVersion?.id, aiConfig.llm_model, aiConfig.llm_provider]);

  useEffect(() => {
    if (!canUseConfigureSettings) {
      setSettingsOpen(false);
    }
  }, [canUseConfigureSettings]);

  useEffect(() => {
    if (!ragConfiguring || !ragConfigureStep) {
      setRagConfigureProgress(0);
      return;
    }

    setRagConfigureProgress((current) => Math.max(current, ragConfigureStepFloorPercent(ragConfigureStep)));
    const intervalId = window.setInterval(() => {
      setRagConfigureProgress((current) => {
        const cap = ragConfigureStepCapPercent(ragConfigureStep);
        if (current >= cap) {
          return current;
        }
        const remaining = cap - current;
        return Math.min(cap, current + Math.max(0.5, Math.min(3.2, remaining * 0.08)));
      });
    }, 900);
    return () => window.clearInterval(intervalId);
  }, [ragConfiguring, ragConfigureStep]);

  function handleConfigureNluModelChange(value: string) {
    setConfigureNluModel(normalizeNluModel(configureNluType, value));
  }

  function handleConfigureLlmProviderChange(value: string) {
    const nextProvider = normalizeLlmProvider(value);
    setConfigureLlmProvider(nextProvider);
    setConfigureLlmModel(normalizeLlmModel(nextProvider, undefined));
  }

  function handleConfigureLlmModelChange(value: string) {
    setConfigureLlmModel(normalizeLlmModel(configureLlmProvider, value));
  }

  async function handleMlConfigureTest() {
    const utterance = mlTestUtterance.trim();
    if (!utterance) {
      setErrorMessage("테스트할 사용자 발화를 입력해주세요.");
      return;
    }
    if (!authSession || !bot || !effectiveVersion) {
      router.replace("/login");
      return;
    }
    if (!isMlConfigureNluType(nluType)) {
      setErrorMessage("ML 구성 엔진에서만 구성 테스트를 사용할 수 있습니다.");
      return;
    }
    if (clusters.length === 0) {
      setErrorMessage("먼저 자동 구성을 실행한 뒤 테스트해주세요.");
      return;
    }

    setMlTesting(true);
    setErrorMessage("");
    try {
      const clusterUtterances = clusters.flatMap((cluster) => cluster.utterances);
      const tokenContext = await fetchMlConfigureTokenContext(
        authSession.access_token,
        bot.id,
        effectiveVersion.id,
        [utterance, ...clusterUtterances],
      );
      const inputTokens = [...tokenize(utterance, configureLexicon, tokenContext)]
        .filter((token) => !token.startsWith("gram:"))
        .sort();
      const candidates = clusters
        .map((cluster) => {
          const scoredUtterances = cluster.utterances
            .map((candidateUtterance) => ({
              utterance: candidateUtterance,
              score: getClusterSimilarity(
                utterance,
                candidateUtterance,
                configureLexicon,
                configurationScoring,
                nluType,
                tokenContext,
              ),
            }))
            .sort((left, right) => right.score - left.score);
          const best = scoredUtterances[0] ?? { utterance: "", score: 0 };
          return {
            clusterId: cluster.id,
            clusterName: cluster.name,
            score: best.score,
            matchedUtterance: best.utterance,
            utteranceCount: cluster.utterances.length,
          };
        })
        .sort((left, right) => right.score - left.score)
        .slice(0, 5);
      setMlTestResult({ utterance, tokens: inputTokens, candidates });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ML 구성 테스트를 실행하지 못했습니다.");
    } finally {
      setMlTesting(false);
    }
  }

  function loadMlSeedIntentsFromCurrentVersion() {
    const seedIntentText = formatMlSeedIntentTextFromDialogs(dialogs);
    if (!seedIntentText.trim()) {
      setErrorMessage("현재 버전에 불러올 의도 학습문장이 없습니다.");
      return;
    }
    const parsed = parseMlSeedIntentText(seedIntentText);
    setMlSeedIntentText(seedIntentText);
    setErrorMessage("");
    setMessage(`현재 버전 의도 ${parsed.seedIntents.length}개를 ML 기준 의도로 불러왔습니다.`);
  }

  function applyMlSeedIntentText() {
    const parsed = parseMlSeedIntentText(mlSeedIntentText);
    if (parsed.invalidLines.length > 0) {
      setErrorMessage(`ML 기준 의도 형식을 확인해주세요: ${parsed.invalidLines.slice(0, 3).join(" / ")}`);
      return;
    }
    setMlSeedIntentOpen(false);
    setErrorMessage("");
    setMessage(
      parsed.seedIntents.length > 0
        ? `ML 기준 의도 ${parsed.seedIntents.length}개를 적용했습니다.`
        : "ML 기준 의도를 비웠습니다. 자동 구성은 세밀한 후보 중심으로 실행됩니다.",
    );
  }

  function handleRagFileChange(event: ChangeEvent<HTMLInputElement>) {
    setRagFile(event.target.files?.[0] ?? null);
    setRagEmbeddingResult(null);
  }

  function handleRagSourceTypeChange(nextSourceType: RagAnswerSourceType) {
    setRagSourceType(nextSourceType);
    setRagEmbeddingResult(null);
  }

  async function handleRagConfigure() {
    if (!authSession || !bot || !effectiveVersion) {
      router.replace("/login");
      return;
    }
    if (isOperatingVersion(effectiveVersion)) {
      setErrorMessage("운영버전에서는 구성 작업을 실행할 수 없습니다. 비운영 버전에서 작업해주세요.");
      return;
    }
    if (!ragAnswerMode) {
      setErrorMessage("RAG 답변 방식에서만 답변 문서 구성을 실행할 수 있습니다.");
      return;
    }
    const text = ragAnswerText.trim();
    const title = ragDocumentTitle.trim();
    if (ragSourceType === "text" && !text) {
      setErrorMessage("임베딩할 답변 텍스트를 입력해주세요.");
      return;
    }
    if (ragSourceType === "pdf" && !ragFile) {
      setErrorMessage("임베딩할 PDF 파일을 선택해주세요.");
      return;
    }

    flushSync(() => {
      setRagConfiguring(true);
      setRagConfigureStep(ragSourceType === "pdf" ? "PDF 답변 문서를 서버로 전송하는 중입니다." : "답변 텍스트를 서버로 전송하는 중입니다.");
      setRagConfigureProgress(0);
      setErrorMessage("");
      setMessage("답변 문서 임베딩과 의도 후보 생성을 실행 중입니다.");
    });
    await waitForBrowserPaint(3);

    try {
      setRagConfigureStep("Answer Vector DB에 답변 문서를 임베딩하는 중입니다.");
      const response = ragSourceType === "pdf"
        ? await configureStudioBotVersionRagAnswerPdf(authSession.access_token, bot.id, effectiveVersion.id, {
            file: ragFile as File,
            title: title || undefined,
            embedding_provider: ragEmbedding.provider,
            embedding_model: ragEmbedding.model,
            target_count: targetCount,
            target_count_policy: targetCountPolicy,
          })
        : await configureStudioBotVersionRagAnswers(authSession.access_token, bot.id, effectiveVersion.id, {
            answer_training: {
              source_type: "text",
              title: title || "RAG 답변 문서",
              text,
              embedding_provider: ragEmbedding.provider,
              embedding_model: ragEmbedding.model,
            },
            target_count: targetCount,
            target_count_policy: targetCountPolicy,
          });
      setRagConfigureStep("임베딩 결과로 의도 후보를 생성하는 중입니다.");
      const nextClusters = response.groups.map((cluster, index) => ({
        id: cluster.id || crypto.randomUUID(),
        name: cluster.name || `RAG 의도 ${index + 1}`,
        answer: formatTalkVariableAnswer(cluster.answer || "$_rag_answer_text"),
        utterances: cluster.utterances,
        seed: cluster.utterances[0] ?? "",
      }));
      const result = response.answer_training ?? null;
      setRagEmbeddingResult(result);
      if (result?.document_title) {
        setRagDocumentTitle(result.document_title);
      }
      setClusters(nextClusters);
      setSelectedClusterIds([]);
      setDictionarySuggestions([]);
      setSelectedDictionarySuggestionIds([]);
      setRagConfigureProgress(100);
      setRagConfigureStep("답변 문서 구성 생성이 완료되었습니다.");
      setMessage(
        `${nextClusters.length}개 RAG 의도 후보를 생성했습니다. ${formatRagConfigureResult(result)} 저장 전 의도명과 학습문장을 확인해주세요.`,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "답변 문서 구성을 실행하지 못했습니다.");
    } finally {
      setRagConfiguring(false);
      setRagConfigureStep("");
    }
  }

  async function handleClassify() {
    const utterances = parseUtterances(utteranceInput);
    if (utterances.length === 0) {
      setErrorMessage("분류할 학습문장을 입력해주세요.");
      return;
    }
    if (!authSession || !bot || !effectiveVersion) {
      router.replace("/login");
      return;
    }
    if (isOperatingVersion(effectiveVersion)) {
      setErrorMessage("운영버전에서는 구성 작업을 실행할 수 없습니다. 비운영 버전에서 작업해주세요.");
      return;
    }
    const parsedMlSeedIntents = isMlConfigureNluType(nluType) ? parseMlSeedIntentText(mlSeedIntentText) : { seedIntents: [], invalidLines: [] };
    const mlSeedIntentPayload = parsedMlSeedIntents.seedIntents;
    if (isMlConfigureNluType(nluType) && parsedMlSeedIntents.invalidLines.length > 0) {
      setErrorMessage(`ML 기준 의도 형식을 확인해주세요: ${parsedMlSeedIntents.invalidLines.slice(0, 3).join(" / ")}`);
      return;
    }

    flushSync(() => {
      setClassifying(true);
      setClassifyProgressMessage("자동 구성을 준비 중입니다. 완료될 때까지 화면을 닫지 말고 기다려주세요.");
      setErrorMessage("");
      setMessage("자동 구성을 실행 중입니다. 문장 수에 따라 시간이 걸릴 수 있습니다.");
    });
    await waitForBrowserPaint(3);
    try {
      const configureResponse = await fetchStudioBotVersionConfigure(authSession.access_token, bot.id, effectiveVersion.id);
      let latestDocument: VersionDocument = {
        ...normalizeVersionDocument(effectiveVersion.version_json),
        dialogs: normalizeVersionDialogs(configureResponse.dialogs),
        dialog_flow_graphs: configureResponse.dialog_flow_graphs,
        dictionary: normalizeVersionDictionary(configureResponse.dictionary),
        entities: normalizeVersionEntities(configureResponse.entities),
        system_config: configureResponse.system_config,
      };
      let selectedVersion = {
        ...configureResponse.version,
        version_json: latestDocument,
      };
      let selectedBot = {
        ...bot,
        active_version: selectedVersion,
        active_version_id: selectedVersion.id,
        updated_at: selectedVersion.updated_at ?? bot.updated_at,
      };
      const latestDictionary = normalizeVersionDictionary(latestDocument.dictionary);
      const nextDictionarySuggestions = nluType === "ml"
        ? collectDictionaryRegistrationSuggestions(utterances, latestDictionary)
        : [];
      setDictionarySuggestions(nextDictionarySuggestions);
      setSelectedDictionarySuggestionIds([]);
      const latestLexicon = buildLexicon(latestDocument);
      const dictionaryTerms = latestLexicon.dictionary.map((entry) => ({
        name: entry.word,
        values: entry.synonyms,
        domainCandidate: entry.domainCandidate,
        domainEnabled: entry.domainEnabled,
      }));
      let engineLabel = "로컬 구성 엔진";
      let nextClusters: IntentCluster[] = [];
      if (nluType === "llm") {
        const response = await configureStudioBotVersionLlmIntents(authSession.access_token, bot.id, effectiveVersion.id, {
          utterances,
          target_count: targetCount,
          target_count_policy: targetCountPolicy,
          dictionary_terms: dictionaryTerms,
          entity_terms: [],
          llm_provider: configureLlmProvider,
          llm_model: configureLlmModel,
          llm_base_url: typeof aiConfig.llm_base_url === "string" ? aiConfig.llm_base_url : undefined,
        });
        engineLabel = "LLM Engine";
        nextClusters = response.groups.map((cluster, index) => ({
          id: cluster.id || crypto.randomUUID(),
          name: cluster.name || `의도 ${index + 1}`,
          answer: cluster.answer || makeDefaultAnswer(cluster.name || `의도 ${index + 1}`),
          utterances: cluster.utterances,
          seed: cluster.utterances[0] ?? "",
        }));
      } else if (isSemanticNluType(nluType) && nluType !== "semantic_external") {
        const response = await configureStudioBotVersionSemanticIntents(authSession.access_token, bot.id, effectiveVersion.id, {
          utterances,
          target_count: targetCount,
          target_count_policy: targetCountPolicy,
          dictionary_terms: dictionaryTerms,
          entity_terms: [],
          scoring: configurationScoring,
        });
        engineLabel = "Semantic Vector Worker";
        nextClusters = response.groups.map((cluster, index) => ({
          id: cluster.id || crypto.randomUUID(),
          name: cluster.name || `의도 ${index + 1}`,
          answer: cluster.answer || makeDefaultAnswer(cluster.name || `의도 ${index + 1}`),
          utterances: cluster.utterances,
          seed: cluster.utterances[0] ?? "",
        }));
      } else {
        flushSync(() => {
          setClassifyProgressMessage("ML 학습 엔진 기준으로 자동 구성 중입니다. 완료될 때까지 화면을 닫지 말고 기다려주세요.");
          setMessage("ML 학습 엔진 기준으로 자동 구성 중입니다. 완료될 때까지 화면을 닫지 말고 기다려주세요.");
        });
        await waitForBrowserPaint(3);
        const response = await configureStudioBotVersionMlIntents(authSession.access_token, bot.id, effectiveVersion.id, {
          utterances,
          target_count: targetCount,
          target_count_policy: targetCountPolicy,
          seed_intents: mlSeedIntentPayload,
        });
        engineLabel = "ML DeepLearning Lite";
        nextClusters = response.groups.map((cluster, index) => ({
          id: cluster.id || crypto.randomUUID(),
          name: cluster.name || `의도 ${index + 1}`,
          answer: cluster.answer || makeDefaultAnswer(cluster.name || `의도 ${index + 1}`),
          utterances: cluster.utterances,
          seed: cluster.utterances[0] ?? "",
        }));
      }
      setBot(selectedBot);
      setClusters(nextClusters);
      const mlSeedIntentMessage = isMlConfigureNluType(nluType) && mlSeedIntentPayload.length > 0
        ? ` 기준 의도 ${mlSeedIntentPayload.length}개로 확신 배정하고, 애매한 문장은 검토 후보로 남겼습니다.`
        : "";
      setMessage(
        `${nextClusters.length}개 그룹으로 분류했습니다.${mlSeedIntentMessage} ${engineLabel} 기준으로 사전 ${countUserDictionaryEntries(latestLexicon.dictionary)}건을 반영했습니다.${
          nextDictionarySuggestions.length > 0 ? ` 사전 등록 제안 ${nextDictionarySuggestions.length}건을 확인해주세요.` : ""
        }`,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "최신 사전/개체 기준으로 자동 구성을 실행하지 못했습니다.");
    } finally {
      setClassifying(false);
      setClassifyProgressMessage("");
    }
  }

  function updateCluster(id: string, patch: Partial<IntentCluster>) {
    setClusters((current) => current.map((cluster) => (cluster.id === id ? { ...cluster, ...patch } : cluster)));
  }

  function toggleSelectedCluster(id: string, checked: boolean) {
    setSelectedClusterIds((current) => {
      if (checked) return current.includes(id) ? current : [...current, id];
      return current.filter((value) => value !== id);
    });
  }

  function mergeSelectedClusters() {
    if (selectedClusterIds.length < 2) {
      setErrorMessage("병합할 의도 후보를 2개 이상 선택해주세요.");
      return;
    }
    setClusters((current) => {
      const selectedSet = new Set(selectedClusterIds);
      const selected = current.filter((cluster) => selectedSet.has(cluster.id));
      if (selected.length < 2) return current;
      const primary = selected[0];
      const mergedUtterances = [...new Set(selected.flatMap((cluster) => cluster.utterances))];
      const mergedCluster: IntentCluster = {
        ...primary,
        utterances: mergedUtterances,
        seed: primary.seed || mergedUtterances[0] || "",
        answer: primary.answer || makeDefaultAnswer(primary.name),
      };
      return [mergedCluster, ...current.filter((cluster) => !selectedSet.has(cluster.id))];
    });
    setSelectedClusterIds([]);
    setMlTestResult(null);
    setMessage("선택한 의도 후보를 병합했습니다.");
    setErrorMessage("");
  }

  function toggleSelectedDictionarySuggestion(id: string, checked: boolean) {
    setSelectedDictionarySuggestionIds((current) => {
      if (checked) {
        return current.includes(id) ? current : [...current, id];
      }
      return current.filter((item) => item !== id);
    });
  }

  function updateScoring(key: keyof ConfigurationScoringConfig, value: number) {
    setConfigurationScoring((current) => normalizeConfigurationScoring({ ...current, [key]: value }));
  }

  function applyRecommendedConfigureScoring() {
    setConfigurationScoring(recommendedConfigureScoring);
    setMessage(`${getNluTypeLabel(nluType)} 자동분류 추천 가중치를 적용했습니다. 저장하려면 봇 설정에 저장을 눌러주세요.`);
  }

  async function registerSelectedConfigureSuggestions() {
    if (!authSession || !bot || !effectiveVersion) {
      router.replace("/login");
      return;
    }
    if (isOperatingVersion(effectiveVersion)) {
      setErrorMessage("운영버전에는 사전 제안을 등록할 수 없습니다. 비운영 버전에서 작업해주세요.");
      return;
    }

    const selectedDictionarySuggestions = visibleDictionarySuggestions.filter((suggestion) =>
      selectedDictionarySuggestionIds.includes(suggestion.id),
    );
    if (selectedDictionarySuggestions.length === 0) {
      setErrorMessage("사전에 등록할 제안을 선택해주세요.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setMessage("");
    try {
      let nextDocument = normalizeVersionDocument(effectiveVersion.version_json);
      let dictionarySuggestionAddedCount = 0;
      let dictionarySuggestionUpdatedCount = 0;
      if (selectedDictionarySuggestions.length > 0) {
        const suggestionMerge = mergeSelectedDictionarySuggestions(
          nextDocument,
          selectedDictionarySuggestions,
          authSession.user.login_id,
        );
        dictionarySuggestionAddedCount = suggestionMerge.addedCount;
        dictionarySuggestionUpdatedCount = suggestionMerge.updatedCount;
        nextDocument = suggestionMerge.document;
      }

      const dictionaryResponse = await updateStudioBotVersionDictionary(
        authSession.access_token,
        bot.id,
        effectiveVersion.id,
        normalizeVersionDictionary(nextDocument.dictionary),
      );
      const updatedDocument = {
        ...nextDocument,
        dictionary: normalizeVersionDictionary(dictionaryResponse.items),
      };
      const updatedVersion = {
        ...dictionaryResponse.version,
        version_json: updatedDocument,
      };
      setBot((current) => (current ? applyUpdatedVersionToBot(current, updatedVersion) : current));
      setDictionarySuggestions((current) => current.filter((suggestion) => !selectedDictionarySuggestionIds.includes(suggestion.id)));
      setSelectedDictionarySuggestionIds([]);
      setMessage(
        `사전 등록 제안 ${
          dictionarySuggestionAddedCount + dictionarySuggestionUpdatedCount
        }건을 반영했습니다.`,
      );
      void workspace.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "사전 제안을 등록하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function saveScoringToBotSettings() {
    if (!authSession || !bot) {
      router.replace("/login");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setMessage("");
    try {
      const updated = await updateStudioBot(
        authSession.access_token,
        bot.id,
        {
          configuration_scoring: configurationScoring,
        },
        { responseMode: "summary" },
      );
      setBot((current) => (current ? { ...current, data_json: updated.data_json, updated_at: updated.updated_at } : updated));
      setMessage("구성 자동분류 가중치를 봇 설정에 저장했습니다.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "구성 자동분류 가중치를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function applyRecommendedCriteria() {
    if (!authSession || !bot || !effectiveVersion) {
      router.replace("/login");
      return;
    }
    if (isOperatingVersion(effectiveVersion)) {
      setErrorMessage("운영버전에는 추천 기준값을 적용할 수 없습니다. 비운영 버전에서 작업해주세요.");
      return;
    }

    setCriteriaSaving(true);
    setErrorMessage("");
    setMessage("");
    try {
      const updated = await updateStudioBot(
        authSession.access_token,
        bot.id,
        {
          settings_scope: effectiveVersion.id,
          settings_json: {
            conversationDefaults: {
              ...versionSettings.conversationDefaults,
              ml: {
                ...versionSettings.conversationDefaults.ml,
                cutOffScore: recommendedCriteria.cutOffScore,
                similarIntentScore: recommendedCriteria.similarIntentScore,
              },
            },
          },
        },
        { responseMode: "summary" },
      );
      setBot((current) => (current ? { ...current, data_json: updated.data_json, updated_at: updated.updated_at } : updated));
      setMessage(
        `${recommendedCriteria.intentCount}개 의도 기준 추천값을 현재 버전에 적용했습니다. Cut-off ${formatCriteriaScore(recommendedCriteria.cutOffScore)} / 유사의도 ${formatCriteriaScore(recommendedCriteria.similarIntentScore)}`,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "추천 NLU 판정 기준을 적용하지 못했습니다.");
    } finally {
      setCriteriaSaving(false);
    }
  }

  async function handleSave() {
    if (!authSession || !bot || !effectiveVersion) {
      router.replace("/login");
      return;
    }
    if (isOperatingVersion(effectiveVersion)) {
      setErrorMessage("운영버전에는 구성 결과를 저장할 수 없습니다. 비운영 버전에서 작업해주세요.");
      return;
    }
    if (clusters.length === 0) {
      setErrorMessage("먼저 학습문장을 분류해주세요.");
      return;
    }
    const invalid = clusters.find((cluster) => !cluster.name.trim() || !cluster.answer.trim() || cluster.utterances.length === 0);
    if (invalid) {
      setErrorMessage("모든 그룹에 의도명, 답변, 학습문장이 필요합니다.");
      return;
    }

    const clusterNames = clusters.map((cluster) => normalizeTokenText(cluster.name));
    const duplicatedName = clusterNames.find((name, index) => name && clusterNames.indexOf(name) !== index);
    if (duplicatedName) {
      setErrorMessage("의도 후보 안에 중복된 의도명이 있습니다.");
      return;
    }

    const now = new Date().toISOString();
    const moduleDialogs = dialogs.filter((dialog) => dialog.dialogType === 0);
    const existingIntentIds = new Set(dialogs.filter((dialog) => dialog.dialogType === 1).map((dialog) => dialog.id));
    let nextDialogNo = getNextDialogNo(moduleDialogs);
    const newDialogs = clusters.map((cluster) => {
      const name = cluster.name.trim();
      const answer = formatTalkVariableAnswer(cluster.answer);
      const dialog: VersionDialogAsset = {
        ...createEmptyVersionDialog(1),
        dialogNo: nextDialogNo,
        name,
        displayName: name,
        dialogKey: crypto.randomUUID(),
        cardCount: 2,
        hasFallbackResponse: true,
        utterances: cluster.utterances.map(buildUtterance),
        response: answer,
        answer,
        updatedAt: now,
        updatedBy: authSession.user.login_id,
      };
      nextDialogNo += 1;
      return dialog;
    });

    let nextDocument: VersionDocument = withUpdatedDialogs(
      normalizeVersionDocument(effectiveVersion.version_json),
      [...moduleDialogs, ...newDialogs],
    );
    nextDocument = {
      ...nextDocument,
      dialog_flow_graphs: nextDocument.dialog_flow_graphs.filter((graph) => {
        if (!graph || typeof graph !== "object" || Array.isArray(graph)) return true;
        return !existingIntentIds.has(getDialogIdFromGraph(graph));
      }),
    };
    newDialogs.forEach((dialog) => {
      nextDocument = withEnsuredDialogFlowGraph(nextDocument, dialog);
      nextDocument = {
        ...nextDocument,
        dialog_flow_graphs: nextDocument.dialog_flow_graphs.map((graph) =>
          String(graph.dialogId ?? "") === dialog.id
            ? buildFlowGraph(dialog, String(dialog.answer ?? dialog.response ?? ""), now, authSession.user.login_id)
            : graph,
        ),
      };
    });

    setSaving(true);
    setErrorMessage("");
    setMessage("");
    try {
      const response = await updateStudioBotVersionConfigure(
        authSession.access_token,
        bot.id,
        effectiveVersion.id,
        {
          dialogs: nextDocument.dialogs,
          dialog_flow_graphs: nextDocument.dialog_flow_graphs,
        },
      );
      const updatedDocument = {
        ...nextDocument,
        dialogs: normalizeVersionDialogs(response.dialogs),
        dialog_flow_graphs: response.dialog_flow_graphs,
        dictionary:
          nluType === "ml" && normalizeVersionDictionary(response.dictionary).length === 0
            ? normalizeVersionDictionary(nextDocument.dictionary)
            : normalizeVersionDictionary(response.dictionary),
        entities: normalizeVersionEntities(response.entities),
        system_config: response.system_config,
      };
      const updatedVersion = {
        ...response.version,
        version_json: updatedDocument,
      };
      setBot((current) => (current ? applyUpdatedVersionToBot(current, updatedVersion) : current));
      setMessage(
        `${newDialogs.length}개 의도와 ${newDialogs.reduce((sum, dialog) => sum + dialog.utterances.length, 0)}개 학습문장으로 현재 버전을 덮어썼습니다.`,
      );
      setClusters([]);
      setDictionarySuggestions([]);
      setSelectedDictionarySuggestionIds([]);
      setUtteranceInput("");
      void workspace.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "의도 구성을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (!loading && !authSession) return null;

  if (!bot || !effectiveVersion) {
    return <StudioPageLoading title={inputCopy.loadingTitle} />;
  }

  return (
    <section className="manual-main manual-main--intent-configure">

      {message ? <p className="manual-main__status manual-main__status--success">{message}</p> : null}
      {errorMessage ? <p className="manual-main__status manual-main__status--error">{errorMessage}</p> : null}
      {operatingVersion ? (
        <p className="manual-main__status manual-main__status--error">
          {inputCopy.operatingVersionWarning}
        </p>
      ) : null}

      <div className="intent-configure">
        <section className="intent-configure__panel intent-configure__panel--input">
          <div className="intent-configure__panel-header">
            <strong>{ragAnswerMode ? inputCopy.ragPanelTitle : inputCopy.utterancePanelTitle}</strong>
            <span>{formatIntentConfigureInputText(inputCopy.engineSummary, { type: getNluTypeLabel(nluType), model: getNluModelLabel(nluType, nluModel) })}</span>
          </div>
          <div className="intent-configure__engine-row">
            <label>
              <span>{inputCopy.configureEngine}</span>
              <select value="llm" disabled>
                <option value="llm">LLM Engine</option>
              </select>
            </label>
            <label>
              <span>{inputCopy.configureModel}</span>
              <select
                value={configureNluModel}
                disabled={operatingVersion}
                onChange={(event) => handleConfigureNluModelChange(event.target.value)}
              >
                {NLU_MODEL_OPTIONS_BY_TYPE[configureNluType].map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {configureNluType === "llm" ? (
              <>
                <label>
                  <span>LLM Provider</span>
                  <select
                    value={configureLlmProvider}
                    disabled={operatingVersion}
                    onChange={(event) => handleConfigureLlmProviderChange(event.target.value)}
                  >
                    {LLM_PROVIDER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>LLM Model</span>
                  <select
                    value={configureLlmModel}
                    disabled={operatingVersion}
                    onChange={(event) => handleConfigureLlmModelChange(event.target.value)}
                  >
                    {LLM_MODEL_OPTIONS_BY_PROVIDER[configureLlmProvider].map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
          </div>
          <div className="intent-configure__lexicon-status">
            {canUseConfigureSettings && visibleDictionarySuggestions.length > 0 ? (
              <button type="button" className="secondary-action" onClick={() => setSettingsOpen(true)}>
                {inputCopy.dictionaryProposal}
                {visibleDictionarySuggestions.length > 0
                  ? formatIntentConfigureInputText(inputCopy.dictionaryProposalCount, { count: visibleDictionarySuggestions.length })
                  : ""}
              </button>
            ) : (
              <span>{inputCopy.latestDictionaryNote}</span>
            )}
          </div>
          {ragAnswerMode ? (
            <div className="intent-configure__rag-source">
              <div className="intent-configure__rag-types">
                <label>
                  <input
                    type="radio"
                    name="rag-answer-source-type"
                    checked={ragSourceType === "text"}
                    disabled={operatingVersion || ragConfiguring}
                    onChange={() => handleRagSourceTypeChange("text")}
                  />
                  {inputCopy.text}
                </label>
                <label>
                  <input
                    type="radio"
                    name="rag-answer-source-type"
                    checked={ragSourceType === "pdf"}
                    disabled={operatingVersion || ragConfiguring}
                    onChange={() => handleRagSourceTypeChange("pdf")}
                  />
                  PDF
                </label>
              </div>
              {ragSourceType === "text" ? (
                <label className="intent-configure__rag-field">
                  <span>{inputCopy.answerText}</span>
                  <textarea
                    value={ragAnswerText}
                    onChange={(event) => {
                      setRagAnswerText(event.target.value);
                      setRagEmbeddingResult(null);
                    }}
                    disabled={operatingVersion || ragConfiguring}
                    placeholder={inputCopy.answerTextPlaceholder}
                  />
                </label>
              ) : (
                <label className="intent-configure__rag-field">
                  <span>{inputCopy.pdfFile}</span>
                  <input type="file" accept="application/pdf,.pdf" disabled={operatingVersion || ragConfiguring} onChange={handleRagFileChange} />
                </label>
              )}
              <label className="intent-configure__rag-field">
                <span>{inputCopy.documentTitle}</span>
                <input
                  value={ragDocumentTitle}
                  onChange={(event) => setRagDocumentTitle(event.target.value)}
                  disabled={operatingVersion || ragConfiguring}
                  placeholder={ragSourceType === "pdf" ? inputCopy.pdfTitlePlaceholder : inputCopy.textTitlePlaceholder}
                />
              </label>
              <div className="intent-configure__rag-engine">
                <span>{ragEmbeddingDescription || inputCopy.embeddingFallback}</span>
                <strong>{ragEmbeddingLabel}</strong>
              </div>
              {ragConfigureStep || ragEmbeddingResult ? (
                <div className="intent-configure__rag-progress" aria-live="polite">
                  <div className="intent-configure__rag-progress-meta">
                    <span>{ragConfigureStep || formatRagConfigureResult(ragEmbeddingResult)}</span>
                    <strong>{Math.round(ragConfigureProgress || (ragEmbeddingResult ? 100 : 0))}%</strong>
                  </div>
                  <div className="intent-configure__rag-progress-track">
                    <span style={{ width: `${Math.round(ragConfigureProgress || (ragEmbeddingResult ? 100 : 0))}%` }} />
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <textarea
              value={utteranceInput}
              onChange={(event) => setUtteranceInput(event.target.value)}
              disabled={operatingVersion}
              placeholder={inputCopy.utterancePlaceholder}
            />
          )}
          <div className="intent-configure__controls">
            <label>
              <span>{inputCopy.targetIntentCount}</span>
              <input
                type="number"
                min={1}
                max={200}
                value={targetCount}
                disabled={operatingVersion}
                onChange={(event) => setTargetCount(Number(event.target.value) || 1)}
              />
            </label>
            <button
              type="button"
              className="manual-main__action-button"
              onClick={ragAnswerMode ? handleRagConfigure : handleClassify}
              disabled={loading || saving || classifying || ragConfiguring || operatingVersion}
            >
              {ragAnswerMode
                ? (ragConfiguring ? inputCopy.configuring : inputCopy.ragConfigure)
                : (classifying ? inputCopy.configuring : inputCopy.autoConfigure)}
            </button>
          </div>
          <div className="intent-configure__policy">
            <span>{inputCopy.countPolicy}</span>
            {isMlConfigureNluType(nluType) ? <small>{inputCopy.mlPolicyHint}</small> : null}
            <div className="intent-configure__policy-options" role="radiogroup" aria-label={inputCopy.countPolicy}>
              {[
                ["minimize", formatIntentConfigureInputText(inputCopy.minimizePolicy, { count: targetCount })],
                ["near", formatIntentConfigureInputText(inputCopy.nearPolicy, { count: targetCount })],
                ["exact", formatIntentConfigureInputText(inputCopy.exactPolicy, { count: targetCount })],
              ].map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="target-count-policy"
                    value={value}
                    checked={targetCountPolicy === value}
                    disabled={operatingVersion}
                    onChange={() => setTargetCountPolicy(value as TargetCountPolicy)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
          {isMlConfigureNluType(nluType) ? (
            <div className="intent-configure__settings-entry">
              <button type="button" className="secondary-action" onClick={() => setMlSeedIntentOpen(true)} disabled={operatingVersion}>
                {inputCopy.seedIntentEntry}
              </button>
              <span>
                {mlSeedIntentCount > 0
                  ? formatIntentConfigureInputText(inputCopy.seedIntentCount, { count: mlSeedIntentCount })
                  : inputCopy.seedIntentNone}
              </span>
            </div>
          ) : null}
          {canUseConfigureSettings ? (
            <div className="intent-configure__settings-entry">
              <button type="button" className="secondary-action" onClick={() => setSettingsOpen(true)}>
                {inputCopy.settingsTitle}
              </button>
              <span>{formatIntentConfigureInputText(inputCopy.settingsSummary, { label: getIntentConfigureCriteriaLabel(inputCopy, recommendedCriteria.label), count: recommendedCriteria.intentCount })}</span>
            </div>
          ) : null}
          {isMlConfigureNluType(nluType) ? (
            <div className="intent-configure__ml-test">
              <div className="intent-configure__ml-test-header">
                <strong>{inputCopy.mlTestTitle}</strong>
                <span>{inputCopy.mlTestDescription}</span>
              </div>
              <div className="intent-configure__ml-test-row">
                <input
                  value={mlTestUtterance}
                  disabled={operatingVersion || mlTesting}
                  onChange={(event) => setMlTestUtterance(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleMlConfigureTest();
                    }
                  }}
                  placeholder={inputCopy.mlTestPlaceholder}
                />
                <button
                  type="button"
                  className="secondary-action"
                  onClick={handleMlConfigureTest}
                  disabled={operatingVersion || mlTesting || clusters.length === 0}
                >
                  {mlTesting ? inputCopy.testing : inputCopy.test}
                </button>
              </div>
              {mlTestResult ? (
                <div className="intent-configure__ml-test-result">
                  <div className="intent-configure__ml-test-tokens">
                    {mlTestResult.tokens.length > 0 ? mlTestResult.tokens.map((token) => <span key={token}>{token}</span>) : <span>{inputCopy.noTokens}</span>}
                  </div>
                  <div className="intent-configure__ml-test-candidates">
                    {mlTestResult.candidates.map((candidate, index) => (
                      <div key={candidate.clusterId}>
                        <strong>{index + 1}. {candidate.clusterName}</strong>
                        <span>{candidate.score.toFixed(3)} · {formatIntentConfigureInputText(inputCopy.sentenceCount, { count: candidate.utteranceCount })}</span>
                        <small>{candidate.matchedUtterance}</small>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="intent-configure__panel intent-configure__panel--result">
          <div className="intent-configure__panel-header">
            <div className="intent-configure__panel-title">
              <strong>{inputCopy.intentCandidates}</strong>
              {selectedClusterIds.length > 0 ? <span>{formatIntentConfigureInputText(inputCopy.selectedCount, { count: selectedClusterIds.length })}</span> : null}
            </div>
            <div className="intent-configure__panel-actions">
              <button
                type="button"
                className="secondary-action"
                onClick={mergeSelectedClusters}
                disabled={operatingVersion || selectedClusterIds.length < 2}
              >
                {inputCopy.mergeSelected}
              </button>
              <button type="button" className="manual-main__action-button" onClick={handleSave} disabled={saving || clusters.length === 0 || operatingVersion}>
                {inputCopy.overwriteVersion}
              </button>
            </div>
          </div>
          <div className="intent-configure__clusters">
            {clusters.length > 0 ? clusters.map((cluster, index) => (
              <article key={cluster.id} className="intent-configure__cluster">
                <div className="intent-configure__cluster-header">
                  <label className="intent-configure__cluster-select">
                    <input
                      type="checkbox"
                      checked={selectedClusterIds.includes(cluster.id)}
                      disabled={operatingVersion}
                      onChange={(event) => toggleSelectedCluster(cluster.id, event.target.checked)}
                    />
                    <strong>{formatIntentConfigureInputText(inputCopy.group, { index: index + 1 })}</strong>
                  </label>
                  <span>{formatIntentConfigureInputText(inputCopy.sentenceCount, { count: cluster.utterances.length })}</span>
                </div>
                <label>
                  <span>{inputCopy.intentName}</span>
                  <input value={cluster.name} onChange={(event) => updateCluster(cluster.id, { name: event.target.value })} />
                </label>
                <label>
                  <span>{inputCopy.answer}</span>
                  <textarea value={cluster.answer} onChange={(event) => updateCluster(cluster.id, { answer: event.target.value })} />
                </label>
                <div className="intent-configure__utterances">
                  {cluster.utterances.map((utterance) => <span key={utterance}>{utterance}</span>)}
                </div>
              </article>
            )) : (
              <div className="intent-configure__empty">
                {classifying
                  ? classifyProgressMessage || inputCopy.emptyAutoConfiguring
                  : ragConfiguring
                    ? ragConfigureStep || inputCopy.emptyRagConfiguring
                    : ragAnswerMode
                      ? inputCopy.emptyRagPrompt
                      : inputCopy.emptyUtterancePrompt}
              </div>
            )}
          </div>
        </section>
      </div>

      {mlSeedIntentOpen && isMlConfigureNluType(nluType) ? (
        <div className="intent-configure-settings-modal__backdrop" role="presentation" onMouseDown={() => setMlSeedIntentOpen(false)}>
          <section
            className="intent-configure-settings-modal intent-configure-seed-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="intent-configure-seed-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="intent-configure-settings-modal__header">
              <h2 id="intent-configure-seed-title">{inputCopy.seedIntentEntry}</h2>
              <button type="button" aria-label={inputCopy.close} onClick={() => setMlSeedIntentOpen(false)}>
                ×
              </button>
            </header>
            <div className="intent-configure-settings-modal__body">
              <div className="intent-configure__seed-modal-panel">
                <div className="intent-configure__criteria-header">
                  <div className="intent-configure__criteria-title">
                    <strong>{inputCopy.seedBulkTitle}</strong>
                    <span>{inputCopy.seedBulkDescription}</span>
                  </div>
                  <button type="button" className="secondary-action" onClick={loadMlSeedIntentsFromCurrentVersion} disabled={operatingVersion}>
                    {inputCopy.loadCurrentIntents}
                  </button>
                </div>
                <textarea
                  className="intent-configure__seed-bulk-textarea"
                  value={mlSeedIntentText}
                  disabled={operatingVersion}
                  onChange={(event) => setMlSeedIntentText(event.target.value)}
                  placeholder={inputCopy.seedPlaceholder}
                />
                <div className="intent-configure__seed-format">
                  <span>{inputCopy.inputFormat}</span>
                  <code>{inputCopy.seedFormatColon}</code>
                  <code>{inputCopy.seedFormatParentheses}</code>
                </div>
                <div className="intent-configure__seed-modal-footer">
                  <span>
                    {mlSeedIntentText.trim()
                      ? formatIntentConfigureInputText(inputCopy.recognizedSeedCount, { count: mlSeedIntentCount })
                      : inputCopy.seedEmptyHint}
                  </span>
                  <div>
                    <button type="button" className="secondary-action" onClick={() => setMlSeedIntentOpen(false)}>
                      {inputCopy.cancel}
                    </button>
                    <button type="button" className="primary-action" onClick={applyMlSeedIntentText} disabled={operatingVersion}>
                      {inputCopy.apply}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {settingsOpen && canUseConfigureSettings ? (
        <div className="intent-configure-settings-modal__backdrop" role="presentation" onMouseDown={() => setSettingsOpen(false)}>
          <section
            className="intent-configure-settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="intent-configure-settings-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="intent-configure-settings-modal__header">
              <h2 id="intent-configure-settings-title">{inputCopy.settingsTitle}</h2>
              <button type="button" aria-label={inputCopy.close} onClick={() => setSettingsOpen(false)}>
                ×
              </button>
            </header>
            <div className="intent-configure-settings-modal__body">
              {visibleDictionarySuggestions.length > 0 ? (
                <div className="intent-configure__criteria">
                  <div className="intent-configure__criteria-header">
                    <div className="intent-configure__criteria-title">
                      <strong>{inputCopy.dictionaryProposal}</strong>
                      <span>{inputCopy.dictionaryApplyDescription}</span>
                    </div>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={registerSelectedConfigureSuggestions}
                      disabled={
                        saving ||
                        operatingVersion ||
                        selectedDictionarySuggestionIds.length === 0
                      }
                    >
                      {inputCopy.registerDictionary}
                    </button>
                  </div>
                  {visibleDictionarySuggestions.length > 0 ? (
                    <div className="intent-configure__domain-candidates">
                      <div className="intent-configure__domain-candidates-header">
                        <strong>{inputCopy.dictionarySuggestionsTitle}</strong>
                        <span>{inputCopy.dictionarySuggestionsDescription}</span>
                      </div>
                      <div className="intent-configure__domain-candidates-list">
                        {visibleDictionarySuggestions.map((suggestion) => (
                          <label key={suggestion.id}>
                            <input
                              type="checkbox"
                              checked={selectedDictionarySuggestionIds.includes(suggestion.id)}
                              disabled={operatingVersion}
                              onChange={(event) => toggleSelectedDictionarySuggestion(suggestion.id, event.target.checked)}
                            />
                            <span>
                              {suggestion.word}
                              <small>{formatIntentConfigureInputText(inputCopy.synonyms, { items: suggestion.synonyms.join(", ") })}</small>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="intent-configure__criteria">
                <div className="intent-configure__criteria-header">
                  <strong>{inputCopy.recommendedNluCriteria}</strong>
                  <span>{formatIntentConfigureInputText(inputCopy.settingsSummary, { label: getIntentConfigureCriteriaLabel(inputCopy, recommendedCriteria.label), count: recommendedCriteria.intentCount })}</span>
                </div>
                <div className="intent-configure__criteria-grid">
                  <span>{inputCopy.currentCutoff}</span>
                  <strong>{formatCriteriaScore(versionSettings.conversationDefaults.ml.cutOffScore)}</strong>
                  <span>{inputCopy.recommendedCutoff}</span>
                  <strong>{formatCriteriaScore(recommendedCriteria.cutOffScore)}</strong>
                  <span>{inputCopy.currentSimilarIntent}</span>
                  <strong>{formatCriteriaScore(versionSettings.conversationDefaults.ml.similarIntentScore)}</strong>
                  <span>{inputCopy.recommendedSimilarIntent}</span>
                  <strong>{formatCriteriaScore(recommendedCriteria.similarIntentScore)}</strong>
                </div>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={applyRecommendedCriteria}
                  disabled={saving || criteriaSaving || operatingVersion}
                >
                  {criteriaSaving ? inputCopy.applying : inputCopy.applyRecommended}
                </button>
              </div>
              <div className="intent-configure__scoring">
                  <div className="intent-configure__scoring-header">
                    <strong>{inputCopy.autoClassificationWeights}</strong>
                    <div>
                      <button type="button" className="secondary-action" onClick={applyRecommendedConfigureScoring} disabled={saving || operatingVersion}>
                        {inputCopy.applyEngineRecommended}
                      </button>
                      <button type="button" className="secondary-action" onClick={saveScoringToBotSettings} disabled={saving}>
                        {inputCopy.saveBotSettings}
                      </button>
                    </div>
                  </div>
                  <div className="intent-configure__criteria-grid">
                    <span>{inputCopy.recommendedDictionary}</span>
                    <strong>{formatCriteriaScore(recommendedConfigureScoring.dictionaryWeight)}</strong>
                    <span>{inputCopy.recommendedEntity}</span>
                    <strong>{formatCriteriaScore(recommendedConfigureScoring.entityWeight)}</strong>
                    <span>{inputCopy.recommendedGram}</span>
                    <strong>{formatCriteriaScore(recommendedConfigureScoring.gramWeight)}</strong>
                    <span>{inputCopy.recommendedKey}</span>
                    <strong>{formatCriteriaScore(recommendedConfigureScoring.keyMatchScore)}</strong>
                  </div>
                  {[
                    ["dictionaryWeight", inputCopy.dictionaryWeight],
                    ["entityWeight", inputCopy.entityWeight],
                    ["wordWeight", inputCopy.wordWeight],
                    ["gramWeight", inputCopy.gramWeight],
                    ["particleEndingWeight", inputCopy.particleEndingWeight],
                    ["keyMatchScore", inputCopy.keyMatchScore],
                  ].map(([key, label]) => (
                    <label key={key}>
                      <span>{label}</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        max={key === "keyMatchScore" ? 1 : 20}
                        value={configurationScoring[key as keyof ConfigurationScoringConfig]}
                        onChange={(event) => updateScoring(key as keyof ConfigurationScoringConfig, Number(event.target.value))}
                      />
                    </label>
                  ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
