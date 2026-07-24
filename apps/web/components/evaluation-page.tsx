"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/language-provider";
import { SimulatorFloatingLauncher } from "@/components/simulator-page";
import { StudioPageLoading } from "@/components/studio-page-loading";
import { useStudioWorkspace } from "@/components/studio-workspace-provider";
import { type SummaryStatItem } from "@/components/summary-stat-grid";
import { getBotVersionSettings, type BotVersionSettings } from "@/lib/bot-settings";
import { applyUpdatedVersionToBot, getVersionDialogs, withUpdatedDialogs } from "@/lib/dialog-assets";
import { saveLastBotScreen, type AuthSession } from "@/lib/auth";
import { EVALUATION_CATALOGS, tEvaluation } from "@/lib/i18n/evaluation";
import {
  LLM_MODEL_OPTIONS_BY_PROVIDER,
  LLM_PROVIDER_OPTIONS,
  normalizeLlmModel,
  normalizeLlmProvider,
} from "@/lib/llm-options";
import { classifyIntent, tokenizeForDeepLearningLite, trainIntentClassifier } from "@/lib/nlu";
import {
  NLU_MODEL_OPTIONS_BY_TYPE,
  NLU_TYPE_OPTIONS,
  normalizeNluModel,
  normalizeNluType,
} from "@/lib/nlu-options";
import {
  fetchStudioBotVersionConfigure,
  getScenarioTrainingDisabledReason,
  refreshStudioBotSelectedVersion,
  type StudioBotApiItem,
  type StudioBotVersionApiItem,
  updateStudioBotVersionRetraining,
} from "@/lib/studio-bots-api";
import {
  normalizeVersionDialogs,
  normalizeVersionDictionary,
  normalizeVersionDocument,
  normalizeVersionEntities,
  type VersionDialogAsset,
  type VersionDocument,
} from "@/lib/version-document";

type EvaluationPageClientProps = {
  botId: string;
  versionId: string;
};

type EvaluationRow = {
  id: string;
  utterance: string;
  expectedDialogId: string;
  expectedName: string;
  predictedDialogId: string;
  predictedName: string;
  decisionMethod?: string;
  score: number;
  features: string[];
  correct: boolean;
  scores?: EvaluationScore[];
};

type EvaluationScore = {
  dialogId: string;
  dialogName: string;
  score: number;
  features: string[];
};

type EvaluationScoreSummary = {
  scoreInRowCount: number;
  scoreOutRowCount: number;
  scoreInCandidateCount: number;
  scoreOutCandidateCount: number;
  topScoreIn: Array<{ name: string; count: number; averageScore: number }>;
  topScoreOut: Array<{ name: string; count: number; averageScore: number }>;
};

type IntentMetric = {
  dialog: VersionDialogAsset;
  utteranceCount: number;
  featureCount: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
};

type UploadEvaluation = {
  fileName: string;
  rows: EvaluationRow[];
  evaluatedAt?: string;
};

type DetailPanel = "bot" | "model" | "intent" | "utterance" | "hub" | null;
type IntentDetailTab = "training" | "feature" | "test";

type StoredNluEvaluation = {
  trained_at: string;
  engine_type?: string;
  nlu_type?: string;
  nlu_model?: string;
  random_accuracy: number | null;
  fixed_accuracy: number | null;
  gap: number | null;
  intent_count: number;
  training_utterance_count: number;
  validation_utterance_count: number;
  random_train_count: number;
  random_test_count: number;
};

function getVersionAiConfig(version?: StudioBotVersionApiItem | null, bot?: StudioBotApiItem | null) {
  const versionJson = version?.version_json;
  const systemConfig = versionJson && typeof versionJson === "object" ? versionJson.system_config : null;
  const aiConfig = systemConfig && typeof systemConfig === "object" ? systemConfig.ai_config : null;
  if (aiConfig && typeof aiConfig === "object" && !Array.isArray(aiConfig)) {
    return {
      ...(bot?.data_json ?? {}),
      ...(aiConfig as Record<string, unknown>),
    };
  }
  return bot?.data_json ?? {};
}

type StoredEvaluationSnapshot = {
  training_rows: Array<{
    id: string;
    utterance: string;
    expected_dialog_id: string;
    expected_name: string;
    predicted_dialog_id: string;
    predicted_name: string;
    score: number;
    features: string[];
    correct: boolean;
    scores?: Array<{
      dialog_id: string;
      dialog_name: string;
      score: number;
      features: string[];
    }>;
  }>;
};

type StoredTrainingState = {
  engine_type?: string;
  nlu_type?: string;
  nlu_model?: string;
};

type FeatureChartItem = {
  label: string;
  score: number;
  featureWeight: number;
  rarity: number;
};

function getNluTypeLabel(value: string | null | undefined) {
  const type = normalizeNluType(value);
  return NLU_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? "ML";
}

function getNluModelLabel(typeValue: string | null | undefined, modelValue: string | null | undefined) {
  const type = normalizeNluType(typeValue);
  const model = normalizeNluModel(type, modelValue);
  return NLU_MODEL_OPTIONS_BY_TYPE[type].find((option) => option.value === model)?.label ?? model;
}

function getLlmProviderLabel(value: string | null | undefined) {
  const provider = normalizeLlmProvider(value);
  return LLM_PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ?? provider;
}

function getLlmModelLabel(providerValue: string | null | undefined, modelValue: string | null | undefined) {
  const provider = normalizeLlmProvider(providerValue);
  const model = normalizeLlmModel(provider, modelValue);
  return LLM_MODEL_OPTIONS_BY_PROVIDER[provider].find((option) => option.value === model)?.label ?? model;
}

function averageRowScore(rows: EvaluationRow[]) {
  if (rows.length === 0) {
    return null;
  }
  return rows.reduce((sum, row) => sum + row.score, 0) / rows.length / 100;
}

function calculateTopKAccuracy(rows: EvaluationRow[], k: number) {
  const comparableRows = rows.filter((row) => row.scores && row.scores.length > 0);
  if (comparableRows.length === 0) {
    return null;
  }
  const correct = comparableRows.filter((row) =>
    row.scores?.slice(0, k).some((score) => score.dialogId === row.expectedDialogId),
  ).length;
  return correct / comparableRows.length;
}

function buildSemanticCollisionPairs(rows: EvaluationRow[]) {
  const pairs = new Map<string, { expectedName: string; predictedName: string; count: number }>();
  rows.forEach((row) => {
    if (row.correct || !row.predictedName || row.predictedName === "-") {
      return;
    }
    const key = `${row.expectedName}::${row.predictedName}`;
    const current = pairs.get(key) ?? {
      expectedName: row.expectedName,
      predictedName: row.predictedName,
      count: 0,
    };
    current.count += 1;
    pairs.set(key, current);
  });
  return Array.from(pairs.values()).sort((left, right) => right.count - left.count).slice(0, 6);
}

function getVectorConnectionStatus(bot: StudioBotApiItem | null) {
  const intent = bot?.data_json?.vector_connections?.intent;
  const enabled = intent?.enabled === true;
  const endpointUrl = intent?.endpoint_url?.trim() || "";
  const indexName = intent?.index_name?.trim() || (endpointUrl ? "aidot-intent" : "");
  const hasEndpoint = Boolean(endpointUrl);
  const hasIndex = Boolean(indexName);
  return {
    enabled,
    ready: enabled && hasEndpoint && hasIndex,
    endpointUrl: endpointUrl || "-",
    indexName: indexName || "-",
  };
}

function buildVersionAssetHref(
  botId: string,
  versionId: string,
  section: "intents" | "configure" | "qa" | "entities" | "dictionary" | "evaluation" | "retraining" | "analysis",
) {
  return `/studio/bots/${botId}/versions/${versionId}/${section}`;
}

function buildSummaryCards(
  botId: string,
  versionId: string,
  bot: StudioBotApiItem | null,
  version: StudioBotVersionApiItem | null,
  dialogCount: number,
): SummaryStatItem[] {
  const counts = version?.asset_counts ?? bot?.active_version?.asset_counts;
  const document = normalizeVersionDocument(version?.version_json);
  const retrainingRecords = document.system_config?.retraining_records;
  const retrainingCount =
    retrainingRecords && typeof retrainingRecords === "object" && !Array.isArray(retrainingRecords)
      ? Object.keys(retrainingRecords).length
      : 0;
  return [
    {
      label: "의도",
      value: String(counts?.dialogs ?? dialogCount ?? (counts?.intents ?? 0)),
      href: buildVersionAssetHref(botId, versionId, "intents"),
    },
    {
      label: "구성",
      value: "-",
      href: buildVersionAssetHref(botId, versionId, "configure"),
    },
    {
      label: "개체",
      value: String(counts?.entities ?? 0),
      href: buildVersionAssetHref(botId, versionId, "entities"),
    },
    {
      label: "사전",
      value: String(counts?.dictionary ?? 0),
      href: buildVersionAssetHref(botId, versionId, "dictionary"),
    },
    {
      label: "평가",
      value: "-",
      active: true,
      href: buildVersionAssetHref(botId, versionId, "evaluation"),
    },
    {
      label: "재학습",
      value: String(retrainingCount),
      href: buildVersionAssetHref(botId, versionId, "retraining"),
    },
    {
      label: "분석",
      value: "-",
      href: buildVersionAssetHref(botId, versionId, "analysis"),
    },
  ];
}

function getStoredEvaluation(document: VersionDocument) {
  const systemConfig = document.system_config;
  const source = systemConfig && typeof systemConfig === "object" && !Array.isArray(systemConfig)
    ? systemConfig as Record<string, unknown>
    : {};
  const store = source.nlu_evaluation && typeof source.nlu_evaluation === "object" && !Array.isArray(source.nlu_evaluation)
    ? source.nlu_evaluation as Record<string, unknown>
    : {};
  const latest = store.latest && typeof store.latest === "object" && !Array.isArray(store.latest)
    ? store.latest as StoredNluEvaluation
    : null;
  const history = Array.isArray(store.history)
    ? store.history.filter((item): item is StoredNluEvaluation => Boolean(item && typeof item === "object" && !Array.isArray(item))).slice(0, 20)
    : [];
  const snapshot = store.snapshot && typeof store.snapshot === "object" && !Array.isArray(store.snapshot)
    ? store.snapshot as StoredEvaluationSnapshot
    : null;
  return { latest, history, snapshot };
}

function isEvaluationScore(value: unknown): value is EvaluationScore {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const item = value as Partial<EvaluationScore>;
  return typeof item.dialogId === "string"
    && typeof item.dialogName === "string"
    && typeof item.score === "number"
    && Array.isArray(item.features);
}

function isEvaluationRow(value: unknown): value is EvaluationRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const item = value as Partial<EvaluationRow>;
  return typeof item.id === "string"
    && typeof item.utterance === "string"
    && typeof item.expectedDialogId === "string"
    && typeof item.expectedName === "string"
    && typeof item.predictedDialogId === "string"
    && typeof item.predictedName === "string"
    && typeof item.score === "number"
    && Array.isArray(item.features)
    && typeof item.correct === "boolean";
}

function normalizeStoredEvaluationScore(value: unknown): EvaluationScore | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const item = value as Record<string, unknown>;
  const dialogId = item.dialogId ?? item.dialog_id;
  const dialogName = item.dialogName ?? item.dialog_name;
  if (typeof dialogId !== "string" || typeof dialogName !== "string" || typeof item.score !== "number") {
    return null;
  }
  return {
    dialogId,
    dialogName,
    score: item.score,
    features: Array.isArray(item.features)
      ? item.features.filter((feature): feature is string => typeof feature === "string")
      : [],
  };
}

function normalizeStoredEvaluationRow(value: unknown): EvaluationRow | null {
  if (isEvaluationRow(value)) {
    return {
      ...value,
      features: value.features.filter((feature): feature is string => typeof feature === "string"),
      scores: Array.isArray(value.scores)
        ? value.scores.map(normalizeStoredEvaluationScore).filter((score): score is EvaluationScore => Boolean(score))
        : [],
    };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const item = value as Record<string, unknown>;
  const expectedDialogId = item.expectedDialogId ?? item.expected_dialog_id;
  const expectedName = item.expectedName ?? item.expected_name;
  const predictedDialogId = item.predictedDialogId ?? item.predicted_dialog_id;
  const predictedName = item.predictedName ?? item.predicted_name;
  if (
    typeof item.id !== "string"
    || typeof item.utterance !== "string"
    || typeof expectedDialogId !== "string"
    || typeof expectedName !== "string"
    || typeof predictedDialogId !== "string"
    || typeof predictedName !== "string"
    || typeof item.score !== "number"
    || typeof item.correct !== "boolean"
  ) {
    return null;
  }
  return {
    id: item.id,
    utterance: item.utterance,
    expectedDialogId,
    expectedName,
    predictedDialogId,
    predictedName,
    decisionMethod: typeof item.decisionMethod === "string"
      ? item.decisionMethod
      : typeof item.decision_method === "string"
        ? item.decision_method
        : undefined,
    score: item.score,
    features: Array.isArray(item.features)
      ? item.features.filter((feature): feature is string => typeof feature === "string")
      : [],
    correct: item.correct,
    scores: Array.isArray(item.scores)
      ? item.scores.map(normalizeStoredEvaluationScore).filter((score): score is EvaluationScore => Boolean(score))
      : [],
  };
}

function getStoredBotEvaluation(
  document: VersionDocument,
  versionSystemConfig?: VersionDocument["system_config"] | null,
): UploadEvaluation | null {
  const documentSystemConfig = document.system_config && typeof document.system_config === "object" && !Array.isArray(document.system_config)
    ? document.system_config as Record<string, unknown>
    : {};
  const topLevelSystemConfig = versionSystemConfig && typeof versionSystemConfig === "object" && !Array.isArray(versionSystemConfig)
    ? versionSystemConfig as Record<string, unknown>
    : {};
  const source = {
    ...documentSystemConfig,
    ...topLevelSystemConfig,
  };
  const store = source.last_bot_evaluation && typeof source.last_bot_evaluation === "object" && !Array.isArray(source.last_bot_evaluation)
    ? source.last_bot_evaluation as Record<string, unknown>
    : null;
  const fileName = store?.fileName ?? store?.file_name;
  const evaluatedAt = store?.evaluatedAt ?? store?.evaluated_at;
  if (!store || typeof fileName !== "string" || !Array.isArray(store.rows)) {
    return null;
  }
  const rows = store.rows
    .map(normalizeStoredEvaluationRow)
    .filter((row): row is EvaluationRow => Boolean(row));
  if (rows.length === 0) {
    return null;
  }
  return {
    fileName,
    evaluatedAt: typeof evaluatedAt === "string" ? evaluatedAt : undefined,
    rows,
  };
}
function getStoredTrainingState(document: VersionDocument) {
  const systemConfig = document.system_config;
  const source = systemConfig && typeof systemConfig === "object" && !Array.isArray(systemConfig)
    ? systemConfig as Record<string, unknown>
    : {};
  return source.nlu_training && typeof source.nlu_training === "object" && !Array.isArray(source.nlu_training)
    ? source.nlu_training as StoredTrainingState
    : null;
}

function buildHistoryPoints(
  history: StoredNluEvaluation[],
  key: "random_accuracy" | "fixed_accuracy",
) {
  return history.slice().reverse().flatMap((item, index, rows) => {
    const value = item[key];
    if (value == null) {
      return [];
    }
    const maxHistorySlots = 20;
    const x = 4 + (index * 92) / (maxHistorySlots - 1);
    const y = Math.max(8, 100 - safeScore(value * 100));
    return [{ x, y, item }];
  });
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function formatPercent(value: number | null) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  return `${(value * 100).toFixed(1)}%`;
}

function formatScorePercent(value: number) {
  return `${safeScore(value).toFixed(2)}%`;
}

function normalizeScoreSetting(value: number) {
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

function safeScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function escapeCsvCell(value: string | number | boolean) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadTextFile(fileName: string, text: string) {
  const blob = new Blob([`\uFEFF${text}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuote && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuote = !inQuote;
      continue;
    }

    if (char === "," && !inQuote) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsvText(text: string) {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let line = "";
  let inQuote = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const nextChar = normalized[index + 1];

    if (char === '"' && inQuote && nextChar === '"') {
      line += '""';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuote = !inQuote;
    }

    if (char === "\n" && !inQuote) {
      if (line.trim()) {
        rows.push(splitCsvLine(line));
      }
      line = "";
      continue;
    }

    line += char;
  }

  if (line.trim()) {
    rows.push(splitCsvLine(line));
  }

  return rows;
}

function normalizeHeader(value: string) {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

function getCsvCell(cells: string[], headerMap: Map<string, number>, keys: string[], fallbackIndex: number) {
  for (const key of keys) {
    const index = headerMap.get(normalizeHeader(key));
    if (index != null) {
      return cells[index]?.trim() ?? "";
    }
  }
  return cells[fallbackIndex]?.trim() ?? "";
}

function normalizeEvaluationName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeRuntimeText(value: unknown) {
  return typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase() : "";
}

function createRuntimeRegex(pattern: string) {
  const rawPattern = pattern.trim();
  const literalMatch = rawPattern.match(/^\/(.+)\/([dgimsuvy]*)$/);
  const source = literalMatch ? literalMatch[1] : rawPattern;
  const flags = literalMatch ? literalMatch[2] : "i";
  return new RegExp(source, flags);
}

function findExpectedIntent(intents: VersionDialogAsset[], expectedName: string) {
  const normalized = normalizeEvaluationName(expectedName);
  return intents.find((intent) =>
    [intent.name, intent.displayName, intent.dialogKey]
      .filter(Boolean)
      .some((name) => normalizeEvaluationName(String(name)) === normalized),
  );
}

function parseUploadRows(text: string) {
  const rows = parseCsvText(text);
  if (rows.length === 0) {
    return [];
  }

  const firstRow = rows[0].map(normalizeHeader);
  const hasHeader = firstRow.some((cell) => ["학습문장", "문장", "utterance", "의도명", "intentname"].includes(cell));
  const headerMap = new Map<string, number>();
  if (hasHeader) {
    rows[0].forEach((header, index) => {
      headerMap.set(normalizeHeader(header), index);
    });
  }

  return (hasHeader ? rows.slice(1) : rows)
    .map((cells) => ({
      utterance: getCsvCell(cells, headerMap, ["학습문장", "문장", "사용자 발화", "사용자발화", "발화", "질문", "테스트 문장", "테스트문장", "Utterance", "utterance"], 0),
      expectedName: getCsvCell(cells, headerMap, ["정답 의도", "정답의도", "의도명", "의도", "Intent Name", "intentName", "expectedName", "Expected Intent", "name"], 1),
    }))
    .filter((row) => row.utterance && row.expectedName);
}

function buildEvaluationCsv(rows: EvaluationRow[]) {
  const header = [
    "문장",
    "정답 의도",
    "예측 의도",
    "점수",
    "후보 의도1",
    "점수",
    "후보 의도2",
    "점수",
    "후보 의도3",
    "점수",
    "Feature",
    "결과",
  ];
  const body = rows.map((row) => {
    const scores = (row.scores && row.scores.length > 0
      ? row.scores
      : row.predictedName && row.predictedName !== "-"
        ? [{ dialogId: row.predictedDialogId, dialogName: row.predictedName, score: row.score, features: row.features }]
        : []
    );
    const candidateCells = scores.slice(1, 4).flatMap((score) => [
      score.dialogName,
      `${safeScore(score.score).toFixed(2)}%`,
    ]);
    while (candidateCells.length < 6) {
      candidateCells.push("");
    }
    const scoreText = row.decisionMethod && row.decisionMethod !== "ML"
      ? row.decisionMethod
      : `${safeScore(row.score).toFixed(2)}%`;
    return [
      row.utterance,
      row.expectedName,
      row.predictedName,
      scoreText,
      ...candidateCells,
      "",
      row.correct ? "성공" : "실패",
    ];
  });
  return [header, ...body].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function buildTrainingCsv(intents: VersionDialogAsset[]) {
  const rows = [["의도명", "학습문장"]];
  intents.forEach((intent) => {
    if (intent.utterances.length === 0) {
      rows.push([intent.name, ""]);
      return;
    }
    intent.utterances.forEach((utterance) => rows.push([intent.name, utterance.text]));
  });
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function buildEvaluationUploadTemplateCsv() {
  const rows = [
    ["문장", "정답 의도"],
    ["사람이랑 통화할래요", "상담사 전환 요청"],
    ["나중에 전화해", "콜백 예약"],
  ];
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function buildTrainingSnapshotCsv(document: VersionDocument) {
  const rows = [["구분", "이름", "유형", "값", "부가정보"]];

  document.dialogs
    .filter((dialog) => dialog.dialogType === 1)
    .forEach((dialog) => {
      dialog.utterances.forEach((utterance) => {
        rows.push(["의도", dialog.name, utterance.utteranceType, utterance.text, dialog.displayName || dialog.dialogKey]);
      });
    });

  document.dictionary.forEach((entry) => {
    const source = entry && typeof entry === "object" && !Array.isArray(entry) ? entry as Record<string, unknown> : {};
    const word = typeof source.word === "string" ? source.word : "";
    const synonyms = Array.isArray(source.synonyms)
      ? source.synonyms.map((item) => (typeof item === "string" ? item : "")).filter(Boolean).join("|")
      : "";
    rows.push(["사전", word, "동의어", synonyms, ""]);
  });

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function buildIntentDetailCsv(rows: EvaluationRow[]) {
  return buildEvaluationCsv(rows);
}

function buildRowsFromTraining(document: VersionDocument, aiConfig?: Record<string, unknown>) {
  const model = trainIntentClassifier(document, aiConfig);
  return document.dialogs
    .filter((dialog) => dialog.dialogType === 1)
    .flatMap((dialog) =>
      dialog.utterances
        .map((utterance) => utterance.text.trim())
        .filter(Boolean)
        .map((text) => {
          const scores = classifyIntent(model, text);
          const top = scores[0];
          const scoreRows = scores.slice(0, 10).map((score) => ({
            dialogId: score.dialog.id,
            dialogName: score.dialog.name,
            score: score.score,
            features: score.features,
          }));
          return {
            id: `${dialog.id}-${text}`,
            utterance: text,
            expectedDialogId: dialog.id,
            expectedName: dialog.name,
            predictedDialogId: top?.dialog.id ?? "",
            predictedName: top?.dialog.name ?? "-",
            decisionMethod: "ML",
            score: top?.score ?? 0,
            features: top?.features ?? [],
            correct: top?.dialog.id === dialog.id,
            scores: scoreRows,
          } satisfies EvaluationRow;
        }),
    );
}

function buildRowsFromSnapshot(snapshot: StoredEvaluationSnapshot | null): EvaluationRow[] {
  if (!snapshot || !Array.isArray(snapshot.training_rows)) {
    return [];
  }
  return snapshot.training_rows.map((row) => ({
    id: row.id,
    utterance: row.utterance,
    expectedDialogId: row.expected_dialog_id,
    expectedName: row.expected_name,
    predictedDialogId: row.predicted_dialog_id,
    predictedName: row.predicted_name,
    decisionMethod: "ML",
    score: row.score,
    features: Array.isArray(row.features) ? row.features : [],
    correct: Boolean(row.correct),
    scores: Array.isArray(row.scores)
      ? row.scores.map((score) => ({
          dialogId: score.dialog_id,
          dialogName: score.dialog_name,
          score: score.score,
          features: Array.isArray(score.features) ? score.features : [],
        }))
      : [],
  }));
}

function smalltalkTextValues(value: unknown, fallback = "") {
  const rawValues = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const values = rawValues
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
  const fallbackText = fallback.trim();
  if (values.length === 0 && fallbackText) {
    values.push(fallbackText);
  }
  return Array.from(new Set(values));
}

function findOperationalPreNluMatch(
  document: VersionDocument,
  versionSettings: BotVersionSettings,
  intents: VersionDialogAsset[],
  utterance: string,
) {
  const normalizedUtterance = normalizeRuntimeText(utterance);
  const blocklist = versionSettings.blocklists.find((item) => {
    if (!item.enabled || !item.pattern.trim()) {
      return false;
    }
    if (item.type === "regex") {
      try {
        return createRuntimeRegex(item.pattern).test(utterance);
      } catch {
        return false;
      }
    }
    return normalizedUtterance.includes(normalizeRuntimeText(item.pattern));
  });
  if (blocklist) {
    return { dialog: null, method: "제외/무시", name: blocklist.name, score: 100, features: [blocklist.pattern] };
  }

  if (versionSettings.smalltalk.enabled) {
    const smalltalk = versionSettings.smalltalk.items.find((item) => {
      if (!item.enabled) {
        return false;
      }
      return smalltalkTextValues(item.userMessages, item.utterance)
        .some((message) => normalizeRuntimeText(message) === normalizedUtterance);
    });
    if (smalltalk) {
      return { dialog: null, method: "스몰토크", name: smalltalk.title, score: 100, features: ["Small Talk"] };
    }
  }

  if (versionSettings.conversationDefaults.exactingMatching.enabled !== false) {
    const exactDialog = document.dialogs.find((dialog) =>
      dialog.dialogType === 1 &&
      dialog.utterances.some((item) => normalizeRuntimeText(item.text) === normalizedUtterance),
    ) ?? null;
    if (exactDialog) {
      return { dialog: exactDialog, method: "Exacting Matching", name: exactDialog.name, score: 100, features: ["Exacting Matching"] };
    }
  }

  const rule = versionSettings.rules.find((item) => {
    const expression = item.expression.trim();
    if (!item.enabled || !expression || !item.target.trim()) {
      return false;
    }
    try {
      return createRuntimeRegex(expression).test(utterance);
    } catch {
      return normalizedUtterance.includes(normalizeRuntimeText(expression));
    }
  });
  if (rule) {
    const dialog = intents.find(
      (item) =>
        item.id === rule.target ||
        item.name === rule.target ||
        item.displayName === rule.target ||
        item.dialogKey === rule.target,
    ) ?? null;
    if (dialog) {
      return { dialog, method: "룰", name: dialog.name, score: 100, features: [rule.expression] };
    }
  }

  return null;
}

function buildRowsFromUpload(
  document: VersionDocument,
  aiConfig: Record<string, unknown>,
  versionSettings: BotVersionSettings,
  rows: Array<{ utterance: string; expectedName: string }>,
) {
  const intents = document.dialogs.filter((dialog) => dialog.dialogType === 1);
  const model = trainIntentClassifier(document, aiConfig);
  return rows.map((row, index) => {
    const firstExpected = findExpectedIntent(intents, row.expectedName);
    const swappedExpected = findExpectedIntent(intents, row.utterance);
    const shouldSwap = !firstExpected && Boolean(swappedExpected);
    const utterance = shouldSwap ? row.expectedName : row.utterance;
    const expectedName = shouldSwap ? row.utterance : row.expectedName;
    const expected = shouldSwap ? swappedExpected : firstExpected;
    const preNluMatch = findOperationalPreNluMatch(document, versionSettings, intents, utterance);
    if (preNluMatch) {
      return {
        id: `upload-${index}`,
        utterance,
        expectedDialogId: expected?.id ?? "",
        expectedName,
        predictedDialogId: preNluMatch.dialog?.id ?? "",
        predictedName: preNluMatch.dialog?.name ?? preNluMatch.name,
        decisionMethod: preNluMatch.method,
        score: preNluMatch.score,
        features: preNluMatch.features,
        correct: Boolean(expected && preNluMatch.dialog?.id === expected.id),
        scores: preNluMatch.dialog
          ? [{
              dialogId: preNluMatch.dialog.id,
              dialogName: preNluMatch.dialog.name,
              score: preNluMatch.score,
              features: preNluMatch.features,
            }]
          : [],
      } satisfies EvaluationRow;
    }
    const scores = classifyIntent(model, utterance);
    const top = scores[0];
    const scoreRows = scores.slice(0, 10).map((score) => ({
      dialogId: score.dialog.id,
      dialogName: score.dialog.name,
      score: score.score,
      features: score.features,
    }));
    return {
      id: `upload-${index}`,
      utterance,
      expectedDialogId: expected?.id ?? "",
      expectedName,
      predictedDialogId: top?.dialog.id ?? "",
      predictedName: top?.dialog.name ?? "-",
      decisionMethod: "ML",
      score: top?.score ?? 0,
      features: top?.features ?? [],
      correct: Boolean(expected && top?.dialog.id === expected.id),
      scores: scoreRows,
    } satisfies EvaluationRow;
  });
}

function calculateAccuracy(rows: EvaluationRow[]) {
  if (rows.length === 0) {
    return null;
  }
  return rows.filter((row) => row.correct).length / rows.length;
}

function summarizeEvaluationScores(rows: EvaluationRow[], cutoffScore: number): EvaluationScoreSummary {
  const scoreIn = new Map<string, { totalScore: number; count: number }>();
  const scoreOut = new Map<string, { totalScore: number; count: number }>();
  let scoreInRowCount = 0;
  let scoreOutRowCount = 0;
  let scoreInCandidateCount = 0;
  let scoreOutCandidateCount = 0;

  rows.forEach((row) => {
    const scores = row.scores && row.scores.length > 0
      ? row.scores
      : row.predictedName && row.predictedName !== "-"
        ? [{ dialogId: row.predictedDialogId, dialogName: row.predictedName, score: row.score, features: row.features }]
        : [];
    let hasScoreIn = false;
    let hasScoreOut = false;

    scores.forEach((score) => {
      const isScoreIn = score.score >= cutoffScore;
      const target = isScoreIn ? scoreIn : scoreOut;
      const current = target.get(score.dialogName) ?? { totalScore: 0, count: 0 };
      current.totalScore += score.score;
      current.count += 1;
      target.set(score.dialogName, current);

      if (isScoreIn) {
        hasScoreIn = true;
        scoreInCandidateCount += 1;
      } else {
        hasScoreOut = true;
        scoreOutCandidateCount += 1;
      }
    });

    if (hasScoreIn) {
      scoreInRowCount += 1;
    }
    if (hasScoreOut) {
      scoreOutRowCount += 1;
    }
  });

  const toRows = (source: Map<string, { totalScore: number; count: number }>) =>
    Array.from(source.entries())
      .map(([name, value]) => ({
        name,
        count: value.count,
        averageScore: value.totalScore / value.count,
      }))
      .sort((left, right) => right.count - left.count || right.averageScore - left.averageScore || left.name.localeCompare(right.name, "ko"))
      .slice(0, 5);

  return {
    scoreInRowCount,
    scoreOutRowCount,
    scoreInCandidateCount,
    scoreOutCandidateCount,
    topScoreIn: toRows(scoreIn),
    topScoreOut: toRows(scoreOut),
  };
}

function buildIntentMetrics(intents: VersionDialogAsset[], rows: EvaluationRow[]) {
  return intents.map((dialog) => {
    const expectedRows = rows.filter((row) => row.expectedDialogId === dialog.id);
    const tp = rows.filter((row) => row.expectedDialogId === dialog.id && row.predictedDialogId === dialog.id).length;
    const fp = rows.filter((row) => row.expectedDialogId !== dialog.id && row.predictedDialogId === dialog.id).length;
    const fn = rows.filter((row) => row.expectedDialogId === dialog.id && row.predictedDialogId !== dialog.id).length;
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    const features = new Set(dialog.utterances.flatMap((utterance) => tokenizeForDeepLearningLite(utterance.text)));

    return {
      dialog,
      utteranceCount: dialog.utterances.length,
      featureCount: features.size,
      accuracy: expectedRows.length === 0 ? 0 : expectedRows.filter((row) => row.correct).length / expectedRows.length,
      precision,
      recall,
      f1,
    } satisfies IntentMetric;
  });
}

function averageMetric(metrics: IntentMetric[], key: "precision" | "recall" | "f1") {
  if (metrics.length === 0) {
    return null;
  }
  return metrics.reduce((sum, item) => sum + item[key], 0) / metrics.length;
}

function buildFeatureChartItems(
  scores: EvaluationScore[],
  utterance: string,
): FeatureChartItem[] {
  const tokens = tokenizeForDeepLearningLite(utterance);
  return scores.slice(0, 10).map((score, index) => {
    const matchedFeatureCount = score.features.length;
    const featureWeight = Math.min(100, Math.round((matchedFeatureCount / Math.max(tokens.length, 1)) * 10000) / 100);
    const rarity = Math.min(100, Math.round(((matchedFeatureCount + 1) / (index + 2)) * 1600) / 100);
    return {
      label: score.dialogName,
      score: Math.max(0, Math.min(100, score.score)),
      featureWeight,
      rarity,
    };
  });
}

function buildFeatureChartItemsFromRow(row: EvaluationRow | null): FeatureChartItem[] {
  if (!row) {
    return [];
  }
  const baseScore = safeScore(row.score);
  const tokens = tokenizeForDeepLearningLite(row.utterance);
  return row.features.slice(0, 10).map((feature, index) => ({
    label: feature,
    score: Math.max(0, baseScore - index * 4),
    featureWeight: Math.min(100, Math.round(((row.features.length - index) / Math.max(row.features.length, 1)) * 10000) / 100),
    rarity: Math.min(100, Math.round(((index + 1) / Math.max(tokens.length, 1)) * 10000) / 100),
  }));
}

function FeatureDetailChart({ items, emptyText }: { items: FeatureChartItem[]; emptyText: string }) {
  const { language: uiLanguage } = useI18n();
  const copy = EVALUATION_CATALOGS[uiLanguage];
  if (items.length === 0) {
    return <div className="evaluation-feature-detail__empty">{emptyText}</div>;
  }

  return (
    <div className="evaluation-feature-detail">
      <div className="evaluation-feature-detail__plot">
        <div className="evaluation-feature-detail__y-axis" aria-hidden="true">
          {[100, 80, 60, 40, 20, 0].map((value) => <span key={value}>{value}</span>)}
        </div>
        <svg className="evaluation-feature-detail__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={items.map((item, index) => `${(index * 100) / Math.max(items.length - 1, 1)},${100 - item.score}`).join(" ")} className="is-score" />
          <polyline points={items.map((item, index) => `${(index * 100) / Math.max(items.length - 1, 1)},${100 - item.featureWeight}`).join(" ")} className="is-weight" />
          <polyline points={items.map((item, index) => `${(index * 100) / Math.max(items.length - 1, 1)},${100 - item.rarity}`).join(" ")} className="is-rarity" />
        </svg>
      </div>
      <div className="evaluation-feature-detail__labels">
        {items.map((item) => <span key={item.label}>{item.label}</span>)}
      </div>
      <div className="evaluation-feature-detail__legend" aria-hidden="true">
        <span><i className="is-score" />{tEvaluation(copy, "의도 Score")}</span>
        <span><i className="is-weight" />Feature</span>
        <span><i className="is-rarity" />{tEvaluation(copy, "희소성")}</span>
      </div>
    </div>
  );
}

function MatrixPreviewCanvas({
  intents,
  matrixCounts,
}: {
  intents: VersionDialogAsset[];
  matrixCounts: Map<string, number>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { language: uiLanguage } = useI18n();
  const copy = EVALUATION_CATALOGS[uiLanguage];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const size = 420;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = "#f6f8fb";
    context.fillRect(0, 0, size, size);

    const countValues = Array.from(matrixCounts.values());
    const maxCount = Math.max(...countValues, 1);
    const cellSize = size / Math.max(intents.length, 1);
    intents.forEach((expected, rowIndex) => {
      intents.forEach((predicted, columnIndex) => {
        const count = matrixCounts.get(`${expected.id}::${predicted.id}`) ?? 0;
        const ratioValue = count / maxCount;
        if (expected.id === predicted.id || count > 0) {
          const alpha = expected.id === predicted.id ? Math.max(0.28, ratioValue) : Math.max(0.12, ratioValue * 0.58);
          context.fillStyle = `rgba(47, 54, 86, ${alpha})`;
          context.fillRect(columnIndex * cellSize, rowIndex * cellSize, Math.max(cellSize - 0.5, 0.5), Math.max(cellSize - 0.5, 0.5));
        }
      });
    });
  }, [intents, matrixCounts]);

  return (
    <div className="evaluation-matrix-preview">
      <canvas ref={canvasRef} aria-label={tEvaluation(copy, "Confusion Matrix 정적 미리보기")} />
      <p>{tEvaluation(copy, "의도가 100개 이상이면 전체 Matrix 이미지만 제공합니다.")}</p>
    </div>
  );
}

function EvaluationInfoTip({ text }: { text: string }) {
  return (
    <span
      className="evaluation-info-icon"
      tabIndex={0}
      aria-label={text}
      data-help={text}
    >
      i
    </span>
  );
}

function SemanticEvaluationGrid({
  bot,
  nluType,
  nluModel,
  latest,
  history,
  rows,
}: {
  bot: StudioBotApiItem | null;
  nluType: string;
  nluModel: string | null | undefined;
  latest: StoredNluEvaluation | null;
  history: StoredNluEvaluation[];
  rows: EvaluationRow[];
}) {
  const { language: uiLanguage } = useI18n();
  const copy = EVALUATION_CATALOGS[uiLanguage];
  const vectorStatus = getVectorConnectionStatus(bot);
  const top1Accuracy = latest?.fixed_accuracy ?? calculateAccuracy(rows);
  const top3Accuracy = calculateTopKAccuracy(rows, 3);
  const averageScore = averageRowScore(rows);
  const lowScoreRows = rows.filter((row) => row.score < 70).slice(0, 10);
  const misclassifiedRows = rows.filter((row) => !row.correct).slice(0, 10);
  const collisions = buildSemanticCollisionPairs(rows);

  return (
    <div className="evaluation-dashboard__grid evaluation-dashboard__grid--nlu">
      <section className="evaluation-card">
        <div className="evaluation-card__title-row">
          <h2>{tEvaluation(copy, "Vector DB 상태")}</h2>
        </div>
        <dl className="evaluation-kpi-list evaluation-kpi-list--status">
          <div><dt>{tEvaluation(copy, "연결")}</dt><dd>{vectorStatus.ready ? tEvaluation(copy, "정상") : tEvaluation(copy, "설정 필요")}</dd></div>
          <div><dt>Index</dt><dd title={vectorStatus.indexName}>{vectorStatus.indexName}</dd></div>
          <div><dt>{tEvaluation(copy, "검색 API")}</dt><dd title={vectorStatus.endpointUrl}>{vectorStatus.endpointUrl}</dd></div>
          <div><dt>{tEvaluation(copy, "임베딩 모델")}</dt><dd>{getNluModelLabel(nluType, nluModel)}</dd></div>
        </dl>
      </section>

      <section className="evaluation-card">
        <div className="evaluation-card__title-row">
          <h2>{tEvaluation(copy, "Top-K 검색 정확도")}</h2>
        </div>
        <div className="evaluation-score">
          <div className="evaluation-score__ring">
            <strong>{formatPercent(top1Accuracy)}</strong>
            <span>Top-1</span>
          </div>
          <div className="evaluation-score__gap">
            <strong>{formatPercent(averageScore)}</strong>
            <span>{tEvaluation(copy, "평균 Score")}</span>
          </div>
          <div className="evaluation-score__ring">
            <strong>{formatPercent(top3Accuracy)}</strong>
            <span>Top-3</span>
          </div>
        </div>
      </section>

      <section className="evaluation-card">
        <div className="evaluation-card__title-row">
          <h2>{tEvaluation(copy, "9:1 Split 평가")}</h2>
        </div>
        <dl className="evaluation-kpi-list evaluation-kpi-list--compact">
          <div><dt>Random</dt><dd>{formatPercent(latest?.random_accuracy ?? null)}</dd></div>
          <div><dt>Fixed</dt><dd>{formatPercent(latest?.fixed_accuracy ?? null)}</dd></div>
          <div><dt>{tEvaluation(copy, "차이")}</dt><dd>{latest?.gap != null ? `${(latest.gap * 100).toFixed(2)}%` : "-"}</dd></div>
          <div><dt>{tEvaluation(copy, "평가 문장")}</dt><dd>{rows.length}</dd></div>
          <div><dt>{tEvaluation(copy, "학습문장")}</dt><dd>{latest?.training_utterance_count ?? "-"}</dd></div>
          <div><dt>{tEvaluation(copy, "최근 이력")}</dt><dd>{history.length}</dd></div>
        </dl>
      </section>

      <div className="evaluation-semantic-issue-row">
        <section className="evaluation-card evaluation-card--wide evaluation-card--semantic-errors">
          <div className="evaluation-card__title-row">
            <h2>{tEvaluation(copy, "오분류 문장")}</h2>
          </div>
          <div className="evaluation-result-table">
            <div className="evaluation-result-table__header">
              <span>{tEvaluation(copy, "문장")}</span>
              <span>{tEvaluation(copy, "정답 의도")}</span>
              <span>{tEvaluation(copy, "예측 의도 / Score")}</span>
            </div>
            {misclassifiedRows.length > 0 ? misclassifiedRows.map((row) => (
              <div key={row.id} className="evaluation-result-table__row">
                <span>{row.utterance}</span>
                <span>{row.expectedName}</span>
                <span className="is-failure">{row.predictedName} / {formatScorePercent(row.score)}</span>
              </div>
            )) : (
              <div className="evaluation-card__empty">{tEvaluation(copy, "오분류 문장이 없습니다.")}</div>
            )}
          </div>
        </section>

        <section className="evaluation-card evaluation-card--semantic-low-score">
          <div className="evaluation-card__title-row">
            <h2>{tEvaluation(copy, "낮은 Score 문장")}</h2>
          </div>
          <div className="evaluation-result-table">
            <div className="evaluation-result-table__header">
              <span>{tEvaluation(copy, "문장")}</span>
              <span>{tEvaluation(copy, "의도")}</span>
              <span>Score</span>
            </div>
            {lowScoreRows.length > 0 ? lowScoreRows.map((row) => (
              <div key={row.id} className="evaluation-result-table__row">
                <span>{row.utterance}</span>
                <span>{row.expectedName}</span>
                <span>{formatScorePercent(row.score)}</span>
              </div>
            )) : (
              <div className="evaluation-card__empty">{tEvaluation(copy, "낮은 Score 문장이 없습니다.")}</div>
            )}
          </div>
        </section>
      </div>

      <section className="evaluation-card evaluation-card--semantic-collisions">
        <div className="evaluation-card__title-row">
          <h2>{tEvaluation(copy, "유사 의도 충돌")}</h2>
        </div>
        <dl className="evaluation-kpi-list evaluation-kpi-list--compact evaluation-kpi-list--semantic-collisions">
          {collisions.length > 0 ? collisions.map((item) => (
            <div key={`${item.expectedName}-${item.predictedName}`}>
              <dt>{item.expectedName}</dt>
              <dd>{item.predictedName} {item.count} {tEvaluation(copy, "건수")}</dd>
            </div>
          )) : (
            <div><dt>{tEvaluation(copy, "충돌")}</dt><dd>{tEvaluation(copy, "없음")}</dd></div>
          )}
        </dl>
      </section>
    </div>
  );
}

function CommonNluDiagnostics({ rows }: { rows: EvaluationRow[] }) {
  const { language: uiLanguage } = useI18n();
  const copy = EVALUATION_CATALOGS[uiLanguage];
  const lowScoreRows = rows.filter((row) => row.score < 70).slice(0, 10);
  const misclassifiedRows = rows.filter((row) => !row.correct).slice(0, 10);
  const collisions = buildSemanticCollisionPairs(rows);

  return (
    <div className="evaluation-dashboard__grid evaluation-dashboard__grid--nlu">
      <div className="evaluation-semantic-issue-row">
        <section className="evaluation-card evaluation-card--wide evaluation-card--semantic-errors">
          <div className="evaluation-card__title-row"><h2>{tEvaluation(copy, "오분류 문장")}</h2></div>
          <div className="evaluation-result-table">
            <div className="evaluation-result-table__header"><span>{tEvaluation(copy, "문장")}</span><span>{tEvaluation(copy, "정답 의도")}</span><span>{tEvaluation(copy, "예측 의도 / Score")}</span></div>
            {misclassifiedRows.length > 0 ? misclassifiedRows.map((row) => (
              <div key={row.id} className="evaluation-result-table__row"><span>{row.utterance}</span><span>{row.expectedName}</span><span className="is-failure">{row.predictedName} / {formatScorePercent(row.score)}</span></div>
            )) : <div className="evaluation-card__empty">{tEvaluation(copy, "오분류 문장이 없습니다.")}</div>}
          </div>
        </section>
        <section className="evaluation-card evaluation-card--semantic-low-score">
          <div className="evaluation-card__title-row"><h2>{tEvaluation(copy, "낮은 Score 문장")}</h2></div>
          <div className="evaluation-result-table">
            <div className="evaluation-result-table__header"><span>{tEvaluation(copy, "문장")}</span><span>{tEvaluation(copy, "의도")}</span><span>Score</span></div>
            {lowScoreRows.length > 0 ? lowScoreRows.map((row) => (
              <div key={row.id} className="evaluation-result-table__row"><span>{row.utterance}</span><span>{row.expectedName}</span><span>{formatScorePercent(row.score)}</span></div>
            )) : <div className="evaluation-card__empty">{tEvaluation(copy, "낮은 Score 문장이 없습니다.")}</div>}
          </div>
        </section>
      </div>
      <section className="evaluation-card evaluation-card--semantic-collisions">
        <div className="evaluation-card__title-row"><h2>{tEvaluation(copy, "유사 의도 충돌")}</h2></div>
        <dl className="evaluation-kpi-list evaluation-kpi-list--compact evaluation-kpi-list--semantic-collisions">
          {collisions.length > 0 ? collisions.map((item) => (
            <div key={`${item.expectedName}-${item.predictedName}`}><dt>{item.expectedName}</dt><dd>{item.predictedName} {item.count} {tEvaluation(copy, "건수")}</dd></div>
          )) : <div><dt>{tEvaluation(copy, "충돌")}</dt><dd>{tEvaluation(copy, "없음")}</dd></div>}
        </dl>
      </section>
    </div>
  );
}
function LlmEvaluationGrid({
  aiConfig,
  latest,
  rows,
}: {
  aiConfig: Record<string, unknown>;
  latest: StoredNluEvaluation | null;
  rows: EvaluationRow[];
}) {
  const { language: uiLanguage } = useI18n();
  const copy = EVALUATION_CATALOGS[uiLanguage];
  const llmProvider = typeof aiConfig.llm_provider === "string" ? aiConfig.llm_provider : undefined;
  const llmModel = typeof aiConfig.llm_model === "string" ? aiConfig.llm_model : undefined;
  const nluType = typeof aiConfig.nlu_type === "string" ? aiConfig.nlu_type : undefined;
  const nluModel = typeof aiConfig.nlu_model === "string" ? aiConfig.nlu_model : undefined;
  const providerLabel = getLlmProviderLabel(llmProvider);
  const modelLabel = getLlmModelLabel(llmProvider, llmModel);
  const wrongRows = rows.filter((row) => !row.correct).slice(0, 10);

  return (
    <div className="evaluation-dashboard__grid evaluation-dashboard__grid--nlu">
      <section className="evaluation-card">
        <div className="evaluation-card__title-row">
          <h2>{tEvaluation(copy, "Provider / 모델 상태")}</h2>
        </div>
        <dl className="evaluation-kpi-list evaluation-kpi-list--status">
          <div><dt>Provider</dt><dd>{providerLabel}</dd></div>
          <div><dt>{tEvaluation(copy, "모델")}</dt><dd>{modelLabel}</dd></div>
          <div><dt>{tEvaluation(copy, "NLU 모델")}</dt><dd>{getNluModelLabel(nluType, nluModel)}</dd></div>
          <div><dt>{tEvaluation(copy, "상태")}</dt><dd>{tEvaluation(copy, "평가 화면 준비")}</dd></div>
        </dl>
      </section>

      <section className="evaluation-card">
        <div className="evaluation-card__title-row">
          <h2>{tEvaluation(copy, "LLM 분류 정확도")}</h2>
        </div>
        <div className="evaluation-score">
          <div className="evaluation-score__ring">
            <strong>{formatPercent(latest?.random_accuracy ?? null)}</strong>
            <span>Random</span>
          </div>
          <div className="evaluation-score__gap">
            <strong>{formatPercent(latest?.fixed_accuracy ?? null)}</strong>
            <span>Fixed</span>
          </div>
          <div className="evaluation-score__ring">
            <strong>{rows.length}</strong>
            <span>{tEvaluation(copy, "평가 문장")}</span>
          </div>
        </div>
      </section>

      <section className="evaluation-card">
        <div className="evaluation-card__title-row">
          <h2>{tEvaluation(copy, "지연시간 / 실패율 / 비용")}</h2>
        </div>
        <dl className="evaluation-kpi-list evaluation-kpi-list--compact">
          <div><dt>{tEvaluation(copy, "평균 지연시간")}</dt><dd>-</dd></div>
          <div><dt>{tEvaluation(copy, "실패율")}</dt><dd>-</dd></div>
          <div><dt>Token</dt><dd>-</dd></div>
          <div><dt>{tEvaluation(copy, "예상 비용")}</dt><dd>-</dd></div>
        </dl>
        <p className="evaluation-card__note">{tEvaluation(copy, "LLM 호출 기반 평가 저장이 붙으면 이 영역에 운영 비용과 실패율을 표시합니다.")}</p>
      </section>

      <section className="evaluation-card evaluation-card--wide">
        <div className="evaluation-card__title-row">
          <h2>{tEvaluation(copy, "오분류 케이스 / 선택 근거")}</h2>
        </div>
        <div className="evaluation-result-table">
          <div className="evaluation-result-table__header">
            <span>{tEvaluation(copy, "문장")}</span>
            <span>{tEvaluation(copy, "정답 의도")}</span>
            <span>{tEvaluation(copy, "LLM 예측 / 근거")}</span>
          </div>
          {wrongRows.length > 0 ? wrongRows.map((row) => (
            <div key={row.id} className="evaluation-result-table__row">
              <span>{row.utterance}</span>
              <span>{row.expectedName}</span>
              <span className="is-failure">{row.predictedName} / {tEvaluation(copy, "저장된 근거 없음")}</span>
            </div>
          )) : (
            <div className="evaluation-card__empty">
              {tEvaluation(copy, "저장된 LLM 평가 결과가 없습니다. 현재 학습은 의도/학습문장 스냅샷만 확정하며, 오분류 근거는 별도 LLM 평가 실행 후 표시됩니다.")}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function EvaluationPageClient({ botId: routeBotId, versionId }: EvaluationPageClientProps) {
  const workspace = useStudioWorkspace();
  const { language: uiLanguage } = useI18n();
  const copy = EVALUATION_CATALOGS[uiLanguage];
  const router = useRouter();
  const pathname = usePathname();
  const botId = useMemo(() => decodeURIComponent(routeBotId), [routeBotId]);
  const versionName = useMemo(() => decodeURIComponent(versionId), [versionId]);
  const sectionFetchKeyRef = useRef<string | null>(null);
  const [authSession, setAuthSession] = useState<AuthSession | null>(workspace.session);
  const [bot, setBot] = useState<StudioBotApiItem | null>(workspace.bot);
  const [versions, setVersions] = useState<StudioBotVersionApiItem[]>(workspace.versions);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadEvaluation, setUploadEvaluation] = useState<UploadEvaluation | null>(null);
  const [hubEvaluation, setHubEvaluation] = useState<UploadEvaluation | null>(null);
  const [intentQuery, setIntentQuery] = useState("");
  const [sortMode, setSortMode] = useState<"worst" | "best">("worst");
  const [selectedIntentId, setSelectedIntentId] = useState("");
  const [testUtterance, setTestUtterance] = useState("");
  const [utteranceDrafts, setUtteranceDrafts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingEvaluation, setSavingEvaluation] = useState(false);
  const [detailPanel, setDetailPanel] = useState<DetailPanel>(null);
  const [intentDetailTab, setIntentDetailTab] = useState<IntentDetailTab>("training");
  const [selectedTrainingRowId, setSelectedTrainingRowId] = useState("");
  const [showIntentEvaluationInfo, setShowIntentEvaluationInfo] = useState(false);
  const [selectedTrainingFeatureNames, setSelectedTrainingFeatureNames] = useState<string[]>([]);
  const [selectedTestFeatureNames, setSelectedTestFeatureNames] = useState<string[]>([]);
  const [featureBalanceMode, setFeatureBalanceMode] = useState<"abnormal" | "total">("abnormal");
  const [matrixScale, setMatrixScale] = useState(1);

  useEffect(() => {
    setAuthSession(workspace.session);
    setVersions(workspace.versions);
    setBot(workspace.bot);
    setLoading(false);
    setErrorMessage("");
  }, [workspace.bot, workspace.session, workspace.versions]);

  useEffect(() => {
    if (!authSession || !bot?.id || !bot.active_version?.id) {
      return;
    }

    const version = bot.active_version;
    const loadedDocument = version.version_json;
    const hasSectionDocument = Boolean(
      loadedDocument &&
      Array.isArray(loadedDocument.dialogs) &&
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

    fetchStudioBotVersionConfigure(authSession.access_token, bot.id, version.id, false)
      .then((response) => {
        if (ignore) {
          return;
        }

        const currentDocument = normalizeVersionDocument(bot.active_version?.version_json);
        const nextVersion = {
          ...response.version,
          version_json: {
            ...currentDocument,
            dialogs: normalizeVersionDialogs(response.dialogs),
            dialog_flow_graphs: response.dialog_flow_graphs,
            dictionary: normalizeVersionDictionary(response.dictionary),
            entities: normalizeVersionEntities(response.entities),
            system_config: response.system_config,
          },
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
          setErrorMessage(error instanceof Error ? error.message : copy.loadFailed);
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
    if (pathname && bot && !errorMessage) {
      saveLastBotScreen(pathname);
    }
  }, [pathname, bot, errorMessage]);
  const effectiveVersion =
    bot?.active_version ?? versions.find((version) => version.name === versionName || version.id === versionName) ?? null;
  const effectiveVersionName = effectiveVersion?.name ?? versionName;
  const effectiveVersionSystemConfig = useMemo(() => {
    const listedVersion = effectiveVersion
      ? versions.find((version) => version.id === effectiveVersion.id)
      : null;
    const listedConfig = listedVersion?.system_config && typeof listedVersion.system_config === "object" && !Array.isArray(listedVersion.system_config)
      ? listedVersion.system_config
      : {};
    const activeConfig = effectiveVersion?.system_config && typeof effectiveVersion.system_config === "object" && !Array.isArray(effectiveVersion.system_config)
      ? effectiveVersion.system_config
      : {};
    return {
      ...listedConfig,
      ...activeConfig,
    };
  }, [effectiveVersion, versions]);
  const trainingDisabledReason = getScenarioTrainingDisabledReason(effectiveVersion);

  async function refreshCurrentVersionState() {
    if (!authSession || !effectiveVersion) {
      return;
    }

    try {
      const refreshed = await refreshStudioBotSelectedVersion(
        authSession.access_token,
        effectiveBotId,
        effectiveVersionName,
        effectiveVersion.id,
      );
      setVersions(refreshed.versions);
      setBot(refreshed.bot);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : copy.refreshFailed);
    }
  }
  const document = useMemo(
    () => normalizeVersionDocument(effectiveVersion?.version_json),
    [effectiveVersion?.version_json],
  );
  const storedEvaluation = useMemo(() => getStoredEvaluation(document), [document]);
  const storedBotEvaluation = useMemo(
    () => getStoredBotEvaluation(document, effectiveVersionSystemConfig),
    [document, effectiveVersionSystemConfig],
  );
  const storedTrainingState = useMemo(() => getStoredTrainingState(document), [document]);
  const randomHistoryPoints = useMemo(
    () => buildHistoryPoints(storedEvaluation.history, "random_accuracy"),
    [storedEvaluation.history],
  );
  const fixedHistoryPoints = useMemo(
    () => buildHistoryPoints(storedEvaluation.history, "fixed_accuracy"),
    [storedEvaluation.history],
  );
  const dialogs = useMemo(() => getVersionDialogs(effectiveVersion), [effectiveVersion]);
  const intents = useMemo(() => dialogs.filter((dialog) => dialog.dialogType === 1), [dialogs]);
  const aiConfig = useMemo(() => getVersionAiConfig(effectiveVersion, bot), [bot, effectiveVersion]);
  const nluType = normalizeNluType(
    storedEvaluation.latest?.nlu_type ??
    storedEvaluation.latest?.engine_type ??
    storedTrainingState?.nlu_type ??
    storedTrainingState?.engine_type ??
    aiConfig.nlu_type,
  );
  const nluModel =
    storedEvaluation.latest?.nlu_model ??
    storedTrainingState?.nlu_model ??
    aiConfig.nlu_model;
  const storedTrainingRows = useMemo(() => buildRowsFromSnapshot(storedEvaluation.snapshot), [storedEvaluation.snapshot]);
  const trainingRows = useMemo(
    () => {
      if (storedTrainingRows.length > 0) {
        return storedTrainingRows;
      }
      if (nluType === "llm") {
        return [];
      }
      return buildRowsFromTraining(document, aiConfig);
    },
    [aiConfig, document, nluType, storedTrainingRows],
  );
  const matrixCounts = useMemo(() => {
    const counts = new Map<string, number>();
    trainingRows.forEach((row) => {
      const key = `${row.expectedDialogId}::${row.predictedDialogId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [trainingRows]);
  const matrixMode = intents.length >= 300 ? "disabled" : intents.length >= 100 ? "preview" : "interactive";  const effectiveBotId = bot?.id ?? botId;
  const intentMetrics = useMemo(() => buildIntentMetrics(intents, trainingRows), [intents, trainingRows]);
  const summaryCards = useMemo(
    () => buildSummaryCards(effectiveBotId, effectiveVersionName, bot, effectiveVersion, intents.length),
    [bot, effectiveBotId, effectiveVersion, effectiveVersionName, intents.length],
  );
  const versionSettings = useMemo(() => getBotVersionSettings(bot ?? {}), [bot]);
  const scoreCutoff = useMemo(
    () => normalizeScoreSetting(versionSettings.conversationDefaults.ml.cutOffScore),
    [versionSettings.conversationDefaults.ml.cutOffScore],
  );
  const isMlEvaluation = nluType === "ml";
  const randomAccuracy = storedEvaluation.latest?.random_accuracy ?? null;
  const fixedAccuracy = storedEvaluation.latest?.fixed_accuracy ?? null;
  const evaluationGap = storedEvaluation.latest?.gap ?? null;
  const nluEvaluationLabel = `${getNluTypeLabel(nluType)} / ${getNluModelLabel(nluType, nluModel)}`;
  const displayedBotEvaluation = uploadEvaluation ?? storedBotEvaluation;
  const botEvaluationAccuracy = calculateAccuracy(displayedBotEvaluation?.rows ?? []);
  const selectedMetric = useMemo(() => {
    const normalizedQuery = intentQuery.trim().toLowerCase();
    const filtered = intentMetrics.filter((metric) => {
      if (!normalizedQuery) {
        return true;
      }
      return [metric.dialog.name, metric.dialog.displayName, metric.dialog.dialogKey]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });

    return [...filtered].sort((left, right) =>
      sortMode === "worst" ? left.accuracy - right.accuracy : right.accuracy - left.accuracy,
    );
  }, [intentMetrics, intentQuery, sortMode]);

  const selectedIntent = useMemo(() => {
    return intents.find((intent) => intent.id === selectedIntentId) ?? selectedMetric[0]?.dialog ?? intents[0] ?? null;
  }, [intents, selectedIntentId, selectedMetric]);

  const selectedRows = useMemo(() => {
    if (!selectedIntent) {
      return [];
    }
    return trainingRows.filter((row) => row.expectedDialogId === selectedIntent.id);
  }, [selectedIntent, trainingRows]);

  const selectedIntentMetric = useMemo(
    () => intentMetrics.find((metric) => metric.dialog.id === selectedIntent?.id) ?? null,
    [intentMetrics, selectedIntent?.id],
  );

  const selectedClassificationGroups = useMemo(() => {
    const groups = new Map<string, { dialogId: string; dialogName: string; count: number; rows: EvaluationRow[] }>();
    selectedRows.forEach((row) => {
      const key = row.predictedDialogId || row.predictedName;
      const current = groups.get(key) ?? {
        dialogId: row.predictedDialogId,
        dialogName: row.predictedName,
        count: 0,
        rows: [],
      };
      current.count += 1;
      current.rows.push(row);
      groups.set(key, current);
    });
    return Array.from(groups.values()).sort((left, right) => {
      const leftCorrect = left.dialogId === selectedIntent?.id ? 0 : 1;
      const rightCorrect = right.dialogId === selectedIntent?.id ? 0 : 1;
      return leftCorrect - rightCorrect || right.count - left.count || left.dialogName.localeCompare(right.dialogName);
    });
  }, [selectedIntent?.id, selectedRows]);

  const selectedTrainingRow = useMemo(
    () => selectedRows.find((row) => row.id === selectedTrainingRowId) ?? selectedRows[0] ?? null,
    [selectedRows, selectedTrainingRowId],
  );

  const testScores = useMemo<EvaluationScore[]>(() => {
    if (!testUtterance.trim()) {
      return [];
    }
    return classifyIntent(trainIntentClassifier(document, aiConfig), testUtterance.trim()).slice(0, 10).map((score) => ({
      dialogId: score.dialog.id,
      dialogName: score.dialog.name,
      score: score.score,
      features: score.features,
    }));
  }, [aiConfig, document, testUtterance]);

  const trainingScores = useMemo(() => {
    if (!selectedTrainingRow) {
      return [];
    }
    if (selectedTrainingRow.scores && selectedTrainingRow.scores.length > 0) {
      return selectedTrainingRow.scores.slice(0, 10);
    }
    return [{
      dialogId: selectedTrainingRow.predictedDialogId,
      dialogName: selectedTrainingRow.predictedName,
      score: selectedTrainingRow.score,
      features: selectedTrainingRow.features,
    }];
  }, [selectedTrainingRow]);

  const trainingFeatureChartItems = useMemo(
    () => buildFeatureChartItemsFromRow(selectedTrainingRow)
      .filter((item) => selectedTrainingFeatureNames.length === 0 || selectedTrainingFeatureNames.includes(item.label)),
    [selectedTrainingFeatureNames, selectedTrainingRow],
  );
  const testFeatureChartItems = useMemo(
    () => buildFeatureChartItems(testScores, testUtterance)
      .filter((item) => selectedTestFeatureNames.length === 0 || selectedTestFeatureNames.includes(item.label)),
    [selectedTestFeatureNames, testScores, testUtterance],
  );

  useEffect(() => {
    if (selectedIntent && selectedIntent.id !== selectedIntentId) {
      setSelectedIntentId(selectedIntent.id);
    }
  }, [selectedIntent, selectedIntentId]);

  useEffect(() => {
    setUtteranceDrafts(selectedIntent?.utterances.map((utterance) => utterance.text) ?? []);
  }, [selectedIntent?.id]);

  useEffect(() => {
    setSelectedTrainingRowId(selectedRows[0]?.id ?? "");
  }, [selectedIntent?.id, selectedRows]);

  useEffect(() => {
    setSelectedTrainingFeatureNames(selectedTrainingRow?.features.slice(0, 10) ?? []);
  }, [selectedTrainingRow?.id]);

  useEffect(() => {
    setSelectedTestFeatureNames(testScores.map((score) => score.dialogName));
  }, [testScores]);

  async function handleUploadEvaluation(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setMessage("");
    setErrorMessage("");
    setSavingEvaluation(true);

    try {
      const text = await file.text();
      const rows = parseUploadRows(text);
      if (rows.length === 0) {
        setErrorMessage(copy.invalidEvaluationData);
        return;
      }
      if (!authSession || !bot || !effectiveVersion) {
        setErrorMessage(copy.missingVersion);
        return;
      }
      const nextEvaluation: UploadEvaluation = {
        fileName: file.name,
        rows: buildRowsFromUpload(document, aiConfig, versionSettings, rows),
        evaluatedAt: new Date().toISOString(),
      };
      const nextDocument = normalizeVersionDocument(effectiveVersion.version_json);
      const nextSystemConfig = {
        ...(nextDocument.system_config ?? {}),
        last_bot_evaluation: nextEvaluation,
      };
      nextDocument.system_config = nextSystemConfig;
      const response = await updateStudioBotVersionRetraining(authSession.access_token, bot.id, effectiveVersion.id, {
        dialogs: nextDocument.dialogs,
        system_config: nextSystemConfig,
      });
      const updatedSystemConfig = response.version.system_config && typeof response.version.system_config === "object" && !Array.isArray(response.version.system_config)
        ? response.version.system_config
        : {};
      const nextVersion = {
        ...effectiveVersion,
        ...response.version,
        system_config: {
          ...updatedSystemConfig,
          ...nextSystemConfig,
        },
        version_json: {
          ...nextDocument,
          dialogs: normalizeVersionDialogs(response.dialogs),
          system_config: response.system_config,
        },
      };
      setUploadEvaluation(nextEvaluation);
      setVersions((current) => current.map((version) => (version.id === nextVersion.id ? nextVersion : version)));
      setBot((current) => current && current.id === bot.id
        ? {
          ...current,
          active_version: nextVersion,
          active_version_id: nextVersion.id,
          updated_at: nextVersion.updated_at ?? current.updated_at,
        }
        : current);
      setMessage(copy.uploadSaved);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : copy.readFailed);
    } finally {
      setSavingEvaluation(false);
    }
  }

  async function handleUploadHubEvaluation(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setMessage("");
    setErrorMessage("");

    try {
      const text = await file.text();
      const rows = parseUploadRows(text);
      if (rows.length === 0) {
        setErrorMessage(copy.invalidHubData);
        return;
      }
      setHubEvaluation({
        fileName: file.name,
        rows: buildRowsFromUpload(document, aiConfig, versionSettings, rows),
      });
      setMessage(copy.hubEvaluated);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : copy.hubReadFailed);
    }
  }

  async function handleSaveUtterances() {
    if (!authSession || !bot || !effectiveVersion || !selectedIntent) {
      return;
    }

    const nextTexts = utteranceDrafts.map((item) => item.trim()).filter(Boolean);
    const nextDocument = withUpdatedDialogs(
      normalizeVersionDocument(effectiveVersion.version_json),
      dialogs.map((dialog) => {
        if (dialog.id !== selectedIntent.id) {
          return dialog;
        }
        return {
          ...dialog,
          utterances: nextTexts.map((text, index) => ({
            id: dialog.utterances[index]?.id ?? crypto.randomUUID(),
            text,
            utteranceType: "T",
          })),
          updatedAt: new Date().toISOString(),
          updatedBy: authSession.user.name,
        };
      }),
    );

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const response = await updateStudioBotVersionRetraining(authSession.access_token, bot.id, effectiveVersion.id, {
        dialogs: nextDocument.dialogs,
        system_config: nextDocument.system_config,
      });
      const updatedVersion = {
        ...response.version,
        version_json: {
          ...nextDocument,
          dialogs: normalizeVersionDialogs(response.dialogs),
          system_config: response.system_config,
        },
      };
      setBot(applyUpdatedVersionToBot(bot, updatedVersion));
      setMessage(copy.conversationSaved);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : copy.utteranceSaveFailed);
    } finally {
      setSaving(false);
    }
  }

  function handleReplaceUtterance(index: number, value: string) {
    setUtteranceDrafts((current) => current.map((item, currentIndex) => (currentIndex === index ? value : item)));
  }

  function handleDeleteUtterance(index: number) {
    setUtteranceDrafts((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  const macroPrecision = averageMetric(intentMetrics, "precision");
  const macroRecall = averageMetric(intentMetrics, "recall");
  const macroF1 = averageMetric(intentMetrics, "f1");
  const hubAccuracy = calculateAccuracy(hubEvaluation?.rows ?? []);
  const isNaturalHub = bot?.data_json?.bot_kind === "hub";
  const featureBalanceMetrics = useMemo(() => {
    if (featureBalanceMode === "total") {
      return intentMetrics;
    }
    if (intentMetrics.length === 0) {
      return [];
    }
    const utteranceAverage = intentMetrics.reduce((sum, item) => sum + item.utteranceCount, 0) / intentMetrics.length;
    const featureAverage = intentMetrics.reduce((sum, item) => sum + item.featureCount, 0) / intentMetrics.length;
    return [...intentMetrics]
      .map((item) => ({
        item,
        distance: Math.abs(item.utteranceCount - utteranceAverage) + Math.abs(item.featureCount - featureAverage),
      }))
      .sort((left, right) => right.distance - left.distance)
      .slice(0, 10)
      .map((entry) => entry.item);
  }, [featureBalanceMode, intentMetrics]);
  const maxUtteranceCount = Math.max(...intentMetrics.map((metric) => metric.utteranceCount), 1);
  const maxFeatureCount = Math.max(...intentMetrics.map((metric) => metric.featureCount), 1);
  const averageUtteranceCount = featureBalanceMetrics.length > 0
    ? featureBalanceMetrics.reduce((sum, item) => sum + item.utteranceCount, 0) / featureBalanceMetrics.length
    : 0;
  const averageFeatureCount = featureBalanceMetrics.length > 0
    ? featureBalanceMetrics.reduce((sum, item) => sum + item.featureCount, 0) / featureBalanceMetrics.length
    : 0;
  const featureBalancePlotHeight = 250;

  if (!loading && !authSession) {
    return null;
  }

  if (!bot || !effectiveVersion) {
    return <StudioPageLoading title={copy.loading} />;
  }

  return (
    <section className="evaluation-dashboard evaluation-dashboard--real">

      <header className="evaluation-dashboard__header">
        <div>
          <h1>Overview <span>›</span> {tEvaluation(copy, "의도 상세")}</h1>
        </div>
        <div className="evaluation-dashboard__actions">
          <button
            type="button"
            className="studio-table-page__ghost"
            onClick={() => downloadTextFile("training-evaluation.csv", buildEvaluationCsv(trainingRows))}
            disabled={trainingRows.length === 0}
          >
            {tEvaluation(copy, "평가정보 내보내기")}
          </button>
        </div>
      </header>

      {message ? <div className="evaluation-dashboard__message">{message}</div> : null}
      {errorMessage ? <div className="evaluation-dashboard__error">{errorMessage}</div> : null}

      <div className="evaluation-dashboard__grid">
        <section className="evaluation-card" id="bot-evaluation">
          <div className="evaluation-card__title-row">
            <h2>
              {copy.botEvaluation}
              <EvaluationInfoTip text={tEvaluation(copy, "별도 평가 데이터를 업로드해 사용자 발화의 최종 분류 결과를 검증합니다.")} />
            </h2>
            <button
              type="button"
              className="studio-table-page__ghost"
              onClick={() => setDetailPanel("bot")}
            >
              {tEvaluation(copy, "평가정보 더보기")}
            </button>
          </div>
          <div className={`evaluation-card__empty evaluation-card__empty--circle${displayedBotEvaluation ? " is-saved" : ""}`}>
            {displayedBotEvaluation ? (
              <>
                  <strong>{formatPercent(botEvaluationAccuracy)}</strong>
                  <span>{displayedBotEvaluation.rows.length} {tEvaluation(copy, "평가 데이터 일괄 업로드")}</span>
              </>
            ) : (
              <span>{tEvaluation(copy, "봇 평가를 위해 평가 데이터를 업로드하세요.")}</span>
            )}
          </div>
          <div className="evaluation-card__bottom-actions">
            <button type="button" className="studio-table-page__ghost" onClick={() => setDetailPanel("bot")}>
              {tEvaluation(copy, "평가 데이터 업로드")}
            </button>
            <button
              type="button"
              className="manual-main__menu-button manual-main__menu-button--toolbar"
              aria-label={`${copy.botEvaluation} ${tEvaluation(copy, "평가정보 더보기")}`}
              onClick={() => setDetailPanel("bot")}
            >
              ⋮
            </button>
          </div>
        </section>

        <section className="evaluation-card" id="model-evaluation">
          <div className="evaluation-card__title-row">
            <h2>
              {tEvaluation(copy, "학습모델 평가")}
              <EvaluationInfoTip text={`${tEvaluation(copy, "현재 NLU 평가 기준은")} ${nluEvaluationLabel}. ${tEvaluation(copy, "학습문장을 학습용과 검증용으로 분리해 일반화 성능을 비교합니다.")}`} />
            </h2>
            <button type="button" className="studio-table-page__ghost" onClick={() => setDetailPanel("model")}>
              {tEvaluation(copy, "평가정보 더보기")}
            </button>
          </div>
          <div className="evaluation-score">
            <div className="evaluation-score__ring">
              <strong>{formatPercent(randomAccuracy)}</strong>
              <span>Random</span>
            </div>
            <div className="evaluation-score__gap">
              <strong>
                  {evaluationGap != null
                  ? `${(evaluationGap * 100).toFixed(2)}%`
                  : "-"}
              </strong>
              <span>{tEvaluation(copy, "차이")}</span>
            </div>
            <div className="evaluation-score__ring">
              <strong>{formatPercent(fixedAccuracy)}</strong>
              <span>Fixed</span>
            </div>
          </div>
        </section>

        <section className="evaluation-card">
          <div className="evaluation-card__title-row">
            <h2>{tEvaluation(copy, "평가 이력")}</h2>
            <button type="button" className="studio-table-page__ghost" onClick={() => setDetailPanel("model")}>
              {tEvaluation(copy, "평가정보 더보기")}
            </button>
          </div>
          <div className="evaluation-history">
            {randomHistoryPoints.length > 0 || fixedHistoryPoints.length > 0 ? (
              <>
                <div className="evaluation-history__y-axis" aria-hidden="true">
                  {[100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0].map((value) => (
                    <span key={value}>{value}</span>
                  ))}
                </div>
                <svg className="evaluation-history__line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polyline
                    className="evaluation-history__line-fixed"
                    points={fixedHistoryPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                  />
                  <polyline
                    className="evaluation-history__line-random"
                    points={randomHistoryPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                  />
                </svg>
                {fixedHistoryPoints.map((point, index) => (
                  <div
                    key={`fixed-${point.item.trained_at}-${index}`}
                    className="evaluation-history__point evaluation-history__point--fixed"
                    style={{
                      left: `${point.x}%`,
                      top: `${point.y}%`,
                    }}
                  />
                ))}
                {randomHistoryPoints.map((point, index) => (
                  <div
                    key={`random-${point.item.trained_at}-${index}`}
                    className="evaluation-history__point evaluation-history__point--random"
                    style={{
                      left: `${point.x}%`,
                      top: `${point.y}%`,
                    }}
                  />
                ))}
                <div className="evaluation-history__x-axis" aria-hidden="true">
                  {storedEvaluation.history.slice().reverse().map((item, index) => (
                    <span key={`${item.trained_at}-${index}`}>{formatHistoryDate(item.trained_at)}</span>
                  ))}
                </div>
              </>
            ) : (
              <div className="evaluation-history__empty">{tEvaluation(copy, "학습 이력이 없습니다.")}</div>
            )}
          </div>
          <div className="evaluation-history__summary">
            <span>{tEvaluation(copy, "의도")} <strong>{storedEvaluation.latest?.intent_count ?? intents.length}</strong></span>
            <span>{tEvaluation(copy, "학습문장")} <strong>{storedEvaluation.latest?.training_utterance_count ?? trainingRows.length}</strong></span>
            <span>
              <button
                type="button"
                className="evaluation-history__download"
                onClick={() => downloadTextFile("training-snapshot.csv", buildTrainingSnapshotCsv(document))}
              >
                {tEvaluation(copy, "학습 데이터 다운로드")}
              </button>
            </span>
          </div>
        </section>

        <section className="evaluation-card evaluation-card--wide evaluation-card--feature">
          <div className="evaluation-card__title-row">
            <h2>
              {tEvaluation(copy, "학습문장 / Feature Balance")}
              <EvaluationInfoTip text={tEvaluation(copy, "의도별 학습문장 수와 분류에 영향을 주는 Feature 수를 비교합니다.")} />
            </h2>
            <div className="evaluation-feature-toggle" role="group" aria-label={tEvaluation(copy, "Feature Balance 보기")}>
              <button
                type="button"
                className={featureBalanceMode === "abnormal" ? "is-active" : ""}
                onClick={() => setFeatureBalanceMode("abnormal")}
              >
                Abnormal
              </button>
              <button
                type="button"
                className={featureBalanceMode === "total" ? "is-active" : ""}
                onClick={() => setFeatureBalanceMode("total")}
              >
                Total
              </button>
            </div>
          </div>
          <div className="evaluation-balance evaluation-balance--summary">
            <div className="evaluation-balance__y-axis" aria-hidden="true">
              {[110, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0].map((value) => (
                <span key={value}>{value}</span>
              ))}
            </div>
            <div
              className="evaluation-balance__average-line evaluation-balance__average-line--utterance"
              style={{ bottom: `calc(84px + ${(averageUtteranceCount / maxUtteranceCount) * featureBalancePlotHeight}px)` }}
              aria-hidden="true"
            >
              <span>Avr.<br />{averageUtteranceCount.toFixed(2)}</span>
            </div>
            <div
              className="evaluation-balance__average-line evaluation-balance__average-line--feature"
              style={{ bottom: `calc(84px + ${(averageFeatureCount / maxFeatureCount) * featureBalancePlotHeight}px)` }}
              aria-hidden="true"
            >
              <span>Avr.<br />{averageFeatureCount.toFixed(2)}</span>
            </div>
            {featureBalanceMetrics.slice(0, featureBalanceMode === "abnormal" ? 10 : 8).map((metric) => (
              <div key={metric.dialog.id} className="evaluation-balance__item">
                <span>{metric.dialog.name}</span>
                <div>
                  <i style={{ height: `${(metric.utteranceCount / maxUtteranceCount) * 100}%` }} />
                  <b style={{ height: `${(metric.featureCount / maxFeatureCount) * 100}%` }} />
                </div>
                <em>{metric.utteranceCount} / {metric.featureCount}</em>
              </div>
            ))}
            <div className="evaluation-balance__legend" aria-hidden="true">
              <span><i />{tEvaluation(copy, "학습문장")}</span>
              <span><b />Feature</span>
            </div>
          </div>
        </section>

        <section className="evaluation-card evaluation-card--matrix">
          <div className="evaluation-card__title-row">
            <h2>
              Confusion Matrix
              <EvaluationInfoTip text={tEvaluation(copy, "정답 의도와 실제 예측 의도의 분포를 비교합니다.")} />
            </h2>
            <button type="button" className="studio-table-page__ghost" onClick={() => setDetailPanel("intent")}>
              {tEvaluation(copy, "상세 보기")}
            </button>
          </div>
          <div className="evaluation-matrix-wrap">
            <span className="evaluation-matrix__y-label">{tEvaluation(copy, "예측 의도(Y)")}</span>
            {matrixMode === "disabled" ? (
              <div className="evaluation-matrix-unavailable">
                {tEvaluation(copy, "의도 수가 300개 이상이면 Confusion Matrix 기능을 제공하지 않습니다.")}
              </div>
            ) : matrixMode === "preview" ? (
              <MatrixPreviewCanvas intents={intents} matrixCounts={matrixCounts} />
            ) : (
              <>
                <div className="evaluation-matrix-controls" aria-label={tEvaluation(copy, "Confusion Matrix 확대 축소")}>
                  <button type="button" onClick={() => setMatrixScale((current) => Math.max(1, Math.round((current - 0.25) * 100) / 100))}>-</button>
                  <span>{Math.round(matrixScale * 100)}%</span>
                  <button type="button" onClick={() => setMatrixScale((current) => Math.min(3, Math.round((current + 0.25) * 100) / 100))}>+</button>
                  <button type="button" onClick={() => setMatrixScale(1)}>{tEvaluation(copy, "초기화")}</button>
                </div>
                <div className="evaluation-matrix-scroll">
                  <div
                    className="evaluation-matrix evaluation-matrix--real"
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(intents.length, 1)}, 1fr)`,
                      transform: `scale(${matrixScale})`,
                    }}
                  >
                    {intents.flatMap((expected) =>
                      intents.map((predicted) => {
                        const count = matrixCounts.get(`${expected.id}::${predicted.id}`) ?? 0;
                        return (
                          <span
                            key={`${expected.id}-${predicted.id}`}
                            className={expected.id === predicted.id ? "is-dark" : ""}
                            aria-label={`${expected.name} → ${predicted.name}: ${count}`}
                            style={{ opacity: count > 0 ? 1 : 0.22 }}
                          >
                            {count || ""}
                          </span>
                        );
                      }),
                    )}
                  </div>
                </div>
                <div className="evaluation-matrix__scale" aria-hidden="true">
                  {[100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0].map((value) => (
                    <span key={value}>{value}</span>
                  ))}
                </div>
                <span className="evaluation-matrix__x-label">{tEvaluation(copy, "정답 의도(X)")}</span>
              </>
            )}
          </div>
        </section>
      </div>

      <CommonNluDiagnostics rows={trainingRows} />
      {isMlEvaluation && detailPanel ? (
        <div className="evaluation-detail-drawer" role="dialog" aria-modal="true">
          <div className={`evaluation-detail-drawer__panel${detailPanel === "bot" ? " evaluation-detail-drawer__panel--compact" : ""}`}>
            <header className="evaluation-detail-drawer__header">
              <strong>
                {detailPanel === "bot"
                  ? copy.botEvaluation
                  : detailPanel === "model"
                    ? tEvaluation(copy, "평가 확인")
                    : detailPanel === "intent"
                      ? tEvaluation(copy, "의도 상세 확인하기")
                      : detailPanel === "utterance"
                        ? tEvaluation(copy, "학습문장 조정하기")
                        : tEvaluation(copy, "봇 허브 의도 이해도 평가하기")}
              </strong>
              <button type="button" onClick={() => setDetailPanel(null)} aria-label={tEvaluation(copy, "닫기")}>×</button>
            </header>

            <div className="evaluation-detail-drawer__body">
              {detailPanel === "bot" ? (
                <>
                  <div className="evaluation-upload">
                    <label className="studio-table-page__primary">
                      {savingEvaluation ? tEvaluation(copy, "저장 중...") : tEvaluation(copy, "평가 데이터 업로드")}
                      <input type="file" accept=".csv,text/csv" onChange={handleUploadEvaluation} disabled={savingEvaluation} />
                    </label>
                    <button
                      type="button"
                      className="studio-table-page__ghost"
                      onClick={() => downloadTextFile("bot-evaluation-template.csv", buildEvaluationUploadTemplateCsv())}
                    >
                      {tEvaluation(copy, "업로드 양식")}
                    </button>
                    <button
                      type="button"
                      className="studio-table-page__ghost"
                      onClick={() => displayedBotEvaluation && downloadTextFile("bot-evaluation-result.csv", buildEvaluationCsv(displayedBotEvaluation.rows))}
                      disabled={!displayedBotEvaluation}
                    >
                      {tEvaluation(copy, "평가 결과 다운로드")}
                    </button>
                  </div>
                  <div className="evaluation-upload-format">
                    <strong>{tEvaluation(copy, "업로드 파일 형식")}</strong>
                    <p>{tEvaluation(copy, "CSV 업로드 형식은 호환 헤더를 사용합니다.")}</p>
                    <code>문장,정답 의도</code>
                    <code>사람이랑 통화할래요,상담사 전환 요청</code>
                    <code>결과: 문장,정답 의도,예측 의도,점수,후보 의도1,점수,후보 의도2,점수,후보 의도3,점수,Feature,결과</code>
                  </div>
                  <dl className="evaluation-kpi-list">
                    <div><dt>{tEvaluation(copy, "파일")}</dt><dd>{displayedBotEvaluation?.fileName ?? "-"}</dd></div>
                    <div><dt>{tEvaluation(copy, "건수")}</dt><dd>{displayedBotEvaluation?.rows.length ?? 0}</dd></div>
                      <div><dt>Accuracy</dt><dd>{formatPercent(botEvaluationAccuracy)}</dd></div>
                  </dl>
                </>
              ) : null}

              {detailPanel === "model" ? (
                <>
                    <dl className="evaluation-kpi-list evaluation-kpi-list--compact">
                      <div><dt>Random</dt><dd>{formatPercent(randomAccuracy)}</dd></div>
                      <div><dt>Fixed</dt><dd>{formatPercent(fixedAccuracy)}</dd></div>
                      <div><dt>{tEvaluation(copy, "차이")}</dt><dd>{evaluationGap != null ? `${(evaluationGap * 100).toFixed(2)}%` : "-"}</dd></div>
                      <div><dt>Precision</dt><dd>{formatPercent(macroPrecision)}</dd></div>
                      <div><dt>Recall</dt><dd>{formatPercent(macroRecall)}</dd></div>
                      <div><dt>F1</dt><dd>{formatPercent(macroF1)}</dd></div>
                      <div><dt>{tEvaluation(copy, "의도")}</dt><dd>{storedEvaluation.latest?.intent_count ?? intents.length}</dd></div>
                      <div><dt>{tEvaluation(copy, "T 문장")}</dt><dd>{storedEvaluation.latest?.training_utterance_count ?? trainingRows.length}</dd></div>
                      <div><dt>{tEvaluation(copy, "V 문장")}</dt><dd>{storedEvaluation.latest?.validation_utterance_count ?? 0}</dd></div>
                    </dl>
                  <p className="evaluation-card__note">{tEvaluation(copy, "저장된 평가 이력 저장소가 아직 없어 현재 버전 기준 평가 결과만 표시합니다.")}</p>
                </>
              ) : null}

              {detailPanel === "intent" ? (
                <>
                  <div className="evaluation-card__title-row">
                    <div className="evaluation-filter-row">
                      <input value={intentQuery} onChange={(event) => setIntentQuery(event.target.value)} placeholder={tEvaluation(copy, "의도명을 검색하세요.")} />
                      <select value={sortMode} onChange={(event) => setSortMode(event.target.value as "worst" | "best")}>
                        <option value="worst">Worst</option>
                        <option value="best">Best</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      className="studio-table-page__ghost"
                      onClick={() => downloadTextFile("intent-detail.csv", buildIntentDetailCsv(selectedRows))}
                      disabled={selectedRows.length === 0}
                    >
                      {tEvaluation(copy, "의도별 상세 데이터 다운로드")}
                    </button>
                  </div>
                  <div className="evaluation-detail">
                    <aside className="evaluation-intent-list">
                      {selectedMetric.map((metric) => (
                        <button
                          type="button"
                          key={metric.dialog.id}
                          className={metric.dialog.id === selectedIntent?.id ? "is-active" : ""}
                          onClick={() => setSelectedIntentId(metric.dialog.id)}
                        >
                          <span>{metric.dialog.name}</span>
                          <strong>{formatPercent(metric.accuracy)}</strong>
                        </button>
                      ))}
                    </aside>
                    <div className="evaluation-intent-detail">
                      <div className="evaluation-detail-tabs" role="tablist" aria-label={tEvaluation(copy, "의도 상세 보기")}>
                        <button
                          type="button"
                          className={intentDetailTab === "training" ? "is-active" : ""}
                          onClick={() => setIntentDetailTab("training")}
                        >
                          {tEvaluation(copy, "학습문장")}
                        </button>
                        <button
                          type="button"
                          className={intentDetailTab === "feature" ? "is-active" : ""}
                          onClick={() => setIntentDetailTab("feature")}
                        >
                          {tEvaluation(copy, "학습문장 분류 결과")}
                        </button>
                        <button
                          type="button"
                          className={intentDetailTab === "test" ? "is-active" : ""}
                          onClick={() => setIntentDetailTab("test")}
                        >
                          {tEvaluation(copy, "테스트")}
                        </button>
                      </div>

                      {intentDetailTab === "training" ? (
                        <>
                          <div className="evaluation-result-table">
                            <div className="evaluation-result-table__header">
                              <span>{tEvaluation(copy, "학습문장")}</span>
                              <span>{tEvaluation(copy, "분류 결과")}</span>
                              <span>Feature</span>
                            </div>
                            {selectedRows.map((row) => (
                              <button
                                type="button"
                                key={row.id}
                                className={`evaluation-result-table__row${row.id === selectedTrainingRow?.id ? " is-active" : ""}`}
                                onClick={() => setSelectedTrainingRowId(row.id)}
                              >
                                <span>{row.utterance}</span>
                                <span className={row.correct ? "is-success" : "is-failure"}>{row.predictedName}</span>
                                <span>{row.features.join(", ") || "-"}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      ) : intentDetailTab === "feature" ? (
                        <>
                          <div className="evaluation-classification-strip" aria-label={tEvaluation(copy, "의도 분류 결과")}>
                            {selectedClassificationGroups.map((group) => {
                              const isCorrectGroup = group.dialogId === selectedIntent?.id;
                              const firstRow = group.rows[0];
                              return (
                                <button
                                  type="button"
                                  key={`${group.dialogId}-${group.dialogName}`}
                                  className={`evaluation-classification-pill${isCorrectGroup ? " is-correct" : " is-wrong"}`}
                                  onClick={() => setSelectedTrainingRowId(firstRow?.id ?? "")}
                                >
                                  {group.dialogName} <strong>{group.count}</strong>
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              className="evaluation-inline-more"
                              onClick={() => setShowIntentEvaluationInfo((current) => !current)}
                            >
                              {tEvaluation(copy, "평가정보 더보기")}
                            </button>
                          </div>
                          {showIntentEvaluationInfo && selectedIntentMetric ? (
                            <dl className="evaluation-intent-kpis">
                              <div><dt>Accuracy</dt><dd>{formatPercent(selectedIntentMetric.accuracy)}</dd></div>
                              <div><dt>Precision</dt><dd>{formatPercent(selectedIntentMetric.precision)}</dd></div>
                              <div><dt>Recall</dt><dd>{formatPercent(selectedIntentMetric.recall)}</dd></div>
                              <div><dt>F1</dt><dd>{formatPercent(selectedIntentMetric.f1)}</dd></div>
                            </dl>
                          ) : null}
                          <div className="evaluation-selection-row">
                            <span>{tEvaluation(copy, "학습문장 선택")}</span>
                            <select
                              value={selectedTrainingRow?.id ?? ""}
                              onChange={(event) => setSelectedTrainingRowId(event.target.value)}
                            >
                              {selectedRows.map((row) => (
                                <option key={row.id} value={row.id}>{row.utterance}</option>
                              ))}
                            </select>
                          </div>
                          <div className="evaluation-score-strip" aria-label={tEvaluation(copy, "정답 의도와 의도분류 Top 10")}>
                            {trainingScores.map((score, index) => {
                              const isExpected = score.dialogId === selectedTrainingRow?.expectedDialogId;
                              const isTopCorrect = index === 0 && isExpected;
                              const isTopWrong = index === 0 && !isExpected;
                              const passedCutoff = score.score >= scoreCutoff;
                              return (
                                <span
                                  key={`${score.dialogId}-${index}`}
                                  className={`evaluation-score-pill${isTopCorrect ? " is-correct" : ""}${isTopWrong ? " is-wrong" : ""}`}
                                >
                                  {passedCutoff ? "✓ " : ""}{score.dialogName} {formatScorePercent(score.score)}
                                </span>
                              );
                            })}
                          </div>
                          <div className="evaluation-chart-caption">
                            <span>{tEvaluation(copy, "빈도수와 희소성")}</span>
                            <span>{selectedTrainingRow?.score != null && selectedTrainingRow.score >= scoreCutoff ? "✓ " : ""}{tEvaluation(copy, "Cut-Off Score 통과")} <em>({tEvaluation(copy, "단위 : Weight(빈도*희소성)")})</em></span>
                          </div>
                          <FeatureDetailChart items={trainingFeatureChartItems} emptyText={tEvaluation(copy, "선택한 학습문장의 Feature 정보가 없습니다.")} />
                          <div className="evaluation-feature-buttons" aria-label="Feature">
                            {selectedTrainingRow?.features.slice(0, 10).map((feature) => {
                              const active = selectedTrainingFeatureNames.includes(feature);
                              return (
                                <button
                                  type="button"
                                  key={feature}
                                  className={active ? "is-active" : ""}
                                  onClick={() => setSelectedTrainingFeatureNames((current) =>
                                    current.includes(feature)
                                      ? current.filter((item) => item !== feature)
                                      : [...current, feature],
                                  )}
                                >
                                  {feature}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="evaluation-test-box">
                          <input value={testUtterance} onChange={(event) => setTestUtterance(event.target.value)} placeholder={tEvaluation(copy, "테스트 문장을 입력하세요.")} />
                          <div className="evaluation-test-box__scores">
                            {testScores.map((score, index) => {
                              const passedCutoff = score.score >= scoreCutoff;
                              return (
                                <span
                                  key={score.dialogId}
                                  className={index === 0 ? "is-top" : ""}
                                >
                                  {passedCutoff ? "✓ " : ""}{score.dialogName} {formatScorePercent(score.score)}
                                </span>
                              );
                            })}
                          </div>
                          <div className="evaluation-chart-caption">
                            <span>{tEvaluation(copy, "테스트 내용의 빈도수와 희소성")}</span>
                            <span>{testScores[0]?.score != null && testScores[0].score >= scoreCutoff ? "✓ " : ""}{tEvaluation(copy, "Cut-Off Score 통과")} <em>({tEvaluation(copy, "단위 : Weight(빈도*희소성)")})</em></span>
                          </div>
                          <FeatureDetailChart items={testFeatureChartItems} emptyText={tEvaluation(copy, "테스트 문장을 입력하면 의도별 Score와 Feature 정보가 표시됩니다.")} />
                          <div className="evaluation-feature-buttons" aria-label="Feature">
                            {testScores.map((score) => {
                              const active = selectedTestFeatureNames.includes(score.dialogName);
                              return (
                                <button
                                  type="button"
                                  key={score.dialogId}
                                  className={active ? "is-active" : ""}
                                  onClick={() => setSelectedTestFeatureNames((current) =>
                                    current.includes(score.dialogName)
                                      ? current.filter((item) => item !== score.dialogName)
                                      : [...current, score.dialogName],
                                  )}
                                >
                                  {score.dialogName}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : null}

              {detailPanel === "utterance" ? (
                <>
                  <p className="evaluation-card__note">{selectedIntent?.name ?? tEvaluation(copy, "의도")} {tEvaluation(copy, "학습문장 조정하기")}</p>
                  <div className="evaluation-utterance-editor">
                    {utteranceDrafts.map((utterance, index) => (
                      <div key={`${selectedIntent?.id}-${index}`}>
                        <input value={utterance} onChange={(event) => handleReplaceUtterance(index, event.target.value)} />
                        <button type="button" onClick={() => handleDeleteUtterance(index)}>{tEvaluation(copy, "삭제")}</button>
                      </div>
                    ))}
                    <button type="button" className="studio-table-page__ghost" onClick={() => setUtteranceDrafts((current) => [...current, ""])}>
                      {tEvaluation(copy, "추가")}
                    </button>
                    <button type="button" className="studio-table-page__primary" onClick={handleSaveUtterances} disabled={saving || !selectedIntent}>
                      {tEvaluation(copy, "저장")}
                    </button>
                  </div>
                </>
              ) : null}

              {detailPanel === "hub" ? (
                <>
                  <div className="evaluation-upload">
                    <label className={`studio-table-page__primary${isNaturalHub ? "" : " is-disabled"}`}>
                      {tEvaluation(copy, "파일 선택")}
                      <input type="file" accept=".csv,text/csv" onChange={handleUploadHubEvaluation} disabled={!isNaturalHub} />
                    </label>
                    <button
                      type="button"
                      className="studio-table-page__ghost"
                      onClick={() => hubEvaluation && downloadTextFile("bot-hub-understanding-evaluation.csv", buildEvaluationCsv(hubEvaluation.rows))}
                      disabled={!hubEvaluation}
                    >
                      {tEvaluation(copy, "결과 다운로드")}
                    </button>
                  </div>
                  <p className="evaluation-card__note">
                    {isNaturalHub
                      ? tEvaluation(copy, "UTF-8 CSV 파일을 업로드하면 현재 버전 NLU 모델 기준으로 의도 이해도를 평가합니다.")
                      : tEvaluation(copy, "봇 허브 의도 이해도 평가는 자연어형 봇 허브에서만 사용할 수 있습니다.")}
                  </p>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <SimulatorFloatingLauncher />
    </section>
  );
}
