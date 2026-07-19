export type NluType = "ml" | "semantic_vector" | "semantic_external" | "llm";
export type NluModelKey =
  | "deep_learning_lite"
  | "ml_tfidf_linear"
  | "ml_keyword_baseline"
  | "semantic_engine_default"
  | "semantic_embedding_mini"
  | "semantic_embedding_large"
  | "semantic_ollama_bge_m3"
  | "semantic_ollama_all_minilm_l12_v2"
  | "semantic_ollama_nomic_embed_text"
  | "semantic_ollama_paraphrase_multilingual"
  | "semantic_ollama_yxchia_paraphrase_multilingual_minilm_l12_v2_q4"
  | "semantic_ollama_qwen3_embedding_4b"
  | "semantic_ollama_qwen3_embedding_8b"
  | "llm_engine_default"
  | "llm_intent_fast"
  | "llm_intent_reasoning";

export type NluTypeOption = {
  value: NluType;
  label: string;
  disabled?: boolean;
  note: string;
};

export type NluModelOption = {
  value: NluModelKey;
  label: string;
  type: NluType;
  disabled?: boolean;
  note: string;
  description?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
};

export const DEFAULT_NLU_TYPE: NluType = "ml";
export const DEFAULT_NLU_MODEL: NluModelKey = "deep_learning_lite";

export const NLU_TYPE_OPTIONS: NluTypeOption[] = [
  { value: "ml", label: "ML", note: "1.0/1.5 지원" },
  { value: "semantic_vector", label: "Semantic - Vector Worker", note: "Aidot 자체 Vector DB" },
  { value: "semantic_external", label: "Semantic - External Embedding", note: "외부 임베딩 + Local Vector DB" },
  { value: "llm", label: "LLM Engine", note: "1.5 설정" },
];

export const NLU_MODEL_OPTIONS_BY_TYPE: Record<NluType, NluModelOption[]> = {
  ml: [
    {
      value: "deep_learning_lite",
      label: "DeepLearning Lite",
      type: "ml",
      note: "1.0 지원",
    },
    {
      value: "ml_tfidf_linear",
      label: "TF-IDF Linear",
      type: "ml",
      note: "1.5 설정",
    },
    {
      value: "ml_keyword_baseline",
      label: "Keyword Baseline",
      type: "ml",
      note: "1.5 설정",
    },
  ],
  semantic_vector: [
    {
      value: "semantic_engine_default",
      label: "Aidot Vector Worker 기본 모델",
      type: "semantic_vector",
      note: "Local Vector DB",
    },
  ],
  semantic_external: [
    {
      value: "semantic_embedding_mini",
      label: "ko-sroberta",
      type: "semantic_external",
      note: "한국어 일반 문서",
      description: "짧은 FAQ, 안내문, 상담 답변처럼 일반적인 한국어 문서 검색에 적합합니다.",
      embeddingProvider: "sentence_transformers",
      embeddingModel: "jhgan/ko-sroberta-multitask",
    },
    {
      value: "semantic_embedding_large",
      label: "multilingual-e5",
      type: "semantic_external",
      note: "다국어/표·서식",
      description: "영문, 다국어, 표와 서식이 많은 문서 검색에 적합합니다.",
      embeddingProvider: "sentence_transformers",
      embeddingModel: "intfloat/multilingual-e5-large",
    },
    {
      value: "semantic_ollama_bge_m3",
      label: "bge-m3",
      type: "semantic_external",
      note: "긴 문서/약관",
      description: "보험약관, 매뉴얼, 긴 PDF처럼 장문 의미 검색이 중요한 문서에 적합합니다.",
      embeddingProvider: "ollama",
      embeddingModel: "bge-m3:latest",
    },
    {
      value: "semantic_ollama_all_minilm_l12_v2",
      label: "Ollama all-minilm-l12-v2",
      type: "semantic_external",
      note: "Ollama 임베딩",
    },
    {
      value: "semantic_ollama_nomic_embed_text",
      label: "Ollama nomic-embed-text",
      type: "semantic_external",
      note: "Ollama 임베딩",
    },
    {
      value: "semantic_ollama_paraphrase_multilingual",
      label: "Ollama paraphrase-multilingual",
      type: "semantic_external",
      note: "Ollama 임베딩",
    },
    {
      value: "semantic_ollama_yxchia_paraphrase_multilingual_minilm_l12_v2_q4",
      label: "Ollama paraphrase-multilingual MiniLM Q4",
      type: "semantic_external",
      note: "Ollama 임베딩",
    },
    {
      value: "semantic_ollama_qwen3_embedding_4b",
      label: "Ollama qwen3-embedding:4b",
      type: "semantic_external",
      note: "Ollama 임베딩",
    },
    {
      value: "semantic_ollama_qwen3_embedding_8b",
      label: "Ollama qwen3-embedding:8b",
      type: "semantic_external",
      note: "Ollama 임베딩",
    },
  ],
  llm: [
    {
      value: "llm_engine_default",
      label: "LLM Engine 기본 모델",
      type: "llm",
      note: "1.5 설정",
    },
    {
      value: "llm_intent_fast",
      label: "LLM Intent Fast",
      type: "llm",
      note: "1.5 설정",
    },
    {
      value: "llm_intent_reasoning",
      label: "LLM Intent Reasoning",
      type: "llm",
      note: "1.5 설정",
    },
  ],
};

export function defaultNluModelForType(type: NluType): NluModelKey {
  return NLU_MODEL_OPTIONS_BY_TYPE[type].find((option) => !option.disabled)?.value ?? DEFAULT_NLU_MODEL;
}

export function isNluType(value: string | null | undefined): value is NluType {
  return NLU_TYPE_OPTIONS.some((option) => option.value === value);
}

export function isSemanticNluType(value: string | null | undefined): boolean {
  return value === "semantic_vector" || value === "semantic_external" || value === "semantic";
}

export function isNluModel(value: string | null | undefined): value is NluModelKey {
  return Object.values(NLU_MODEL_OPTIONS_BY_TYPE).some((options) =>
    options.some((option) => option.value === value),
  );
}

export function normalizeNluType(value: string | null | undefined): NluType {
  if (value === "semantic") {
    return "semantic_vector";
  }
  return isNluType(value) ? value : DEFAULT_NLU_TYPE;
}

export function normalizeNluModel(type: NluType, value: string | null | undefined): NluModelKey {
  if (!isNluModel(value)) {
    return defaultNluModelForType(type);
  }

  const modelOptions = NLU_MODEL_OPTIONS_BY_TYPE[type];
  return modelOptions.some((option) => option.value === value) ? value : defaultNluModelForType(type);
}

export function getNluTypeLabel(value: string | null | undefined) {
  const normalizedType = normalizeNluType(value);
  return NLU_TYPE_OPTIONS.find((option) => option.value === normalizedType)?.label ?? "ML";
}

export function getNluModelLabel(type: string | null | undefined, value: string | null | undefined) {
  const normalizedType = normalizeNluType(type);
  const normalizedModel = normalizeNluModel(normalizedType, value);
  return NLU_MODEL_OPTIONS_BY_TYPE[normalizedType].find((option) => option.value === normalizedModel)?.label ?? normalizedModel;
}

export function getNluModelDescription(type: string | null | undefined, value: string | null | undefined) {
  const normalizedType = normalizeNluType(type);
  const normalizedModel = normalizeNluModel(normalizedType, value);
  return NLU_MODEL_OPTIONS_BY_TYPE[normalizedType].find((option) => option.value === normalizedModel)?.description ?? "";
}

export function getNluModelEmbedding(type: string | null | undefined, value: string | null | undefined) {
  const normalizedType = normalizeNluType(type);
  const normalizedModel = normalizeNluModel(normalizedType, value);
  const option = NLU_MODEL_OPTIONS_BY_TYPE[normalizedType].find((item) => item.value === normalizedModel);
  return {
    provider: option?.embeddingProvider,
    model: option?.embeddingModel,
  };
}
