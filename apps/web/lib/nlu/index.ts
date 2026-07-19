import { type StudioBotDataJson } from "@/lib/bot-settings";
import {
  DEFAULT_NLU_MODEL,
  DEFAULT_NLU_TYPE,
  normalizeNluModel,
  normalizeNluType,
  type NluModelKey,
  type NluType,
} from "@/lib/nlu-options";
import { type VersionDocument } from "@/lib/version-document";
import {
  classifyDeepLearningLite,
  tokenizeForDeepLearningLite,
  trainDeepLearningLite,
  type DeepLearningLiteModel,
  type DeepLearningLiteScore,
} from "@/lib/nlu/deep-learning-lite";

export type IntentClassificationModel = {
  type: NluType;
  model: NluModelKey;
  deepLearningLite: DeepLearningLiteModel;
};

export type IntentClassificationScore = DeepLearningLiteScore;
export { tokenizeForDeepLearningLite };

export type IntentClassifierTrainOptions = {
  imbalanceOversampling?: boolean;
};

function inferNluTypeFromModel(value: string | null | undefined): NluType | null {
  const normalizedValue = String(value ?? "").toLowerCase();
  if (!normalizedValue) {
    return null;
  }
  if (normalizedValue.includes("llm")) {
    return "llm";
  }
  if (normalizedValue.includes("semantic_ollama") || normalizedValue.includes("semantic_embedding")) {
    return "semantic_external";
  }
  if (normalizedValue.includes("semantic") || normalizedValue.includes("vector")) {
    return "semantic_vector";
  }
  if (normalizedValue.includes("deep_learning") || normalizedValue.includes("ml_")) {
    return "ml";
  }
  return null;
}

export function getNluType(dataJson?: StudioBotDataJson): NluType {
  if (dataJson?.nlu_type) {
    return normalizeNluType(dataJson.nlu_type);
  }
  return inferNluTypeFromModel(dataJson?.nlu_model ?? dataJson?.nlu_engine) ?? DEFAULT_NLU_TYPE;
}

export function getNluModel(dataJson?: StudioBotDataJson): NluModelKey {
  return normalizeNluModel(getNluType(dataJson), dataJson?.nlu_model ?? dataJson?.nlu_engine ?? DEFAULT_NLU_MODEL);
}

export function trainIntentClassifier(
  versionDocument: VersionDocument,
  dataJson?: StudioBotDataJson,
  options: IntentClassifierTrainOptions = {},
): IntentClassificationModel {
  return {
    type: getNluType(dataJson),
    model: getNluModel(dataJson),
    deepLearningLite: trainDeepLearningLite(versionDocument, {
      imbalanceOversampling: options.imbalanceOversampling,
    }),
  };
}

export function classifyIntent(model: IntentClassificationModel, utterance: string): IntentClassificationScore[] {
  if (model.type === "ml" && model.model === "deep_learning_lite") {
    return classifyDeepLearningLite(model.deepLearningLite, utterance);
  }

  return [];
}
