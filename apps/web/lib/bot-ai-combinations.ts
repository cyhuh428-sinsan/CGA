import { ANSWER_MODE_OPTIONS, type AnswerMode } from "@/lib/answer-options";
import {
  NLU_MODEL_OPTIONS_BY_TYPE,
  NLU_TYPE_OPTIONS,
  type NluModelKey,
  type NluType,
} from "@/lib/nlu-options";

export type BotAiCombinationStatus = "implemented" | "configured" | "unsupported";

export type BotAiCombination = {
  id: string;
  nluType: NluType;
  nluModel: NluModelKey;
  answerMode: AnswerMode;
  nluLabel: string;
  nluModelLabel: string;
  answerLabel: string;
  status: BotAiCombinationStatus;
  statusLabel: string;
  note: string;
};

export type BotAiCombinationRow = {
  nluType: NluType;
  nluLabel: string;
  nluModelLabel: string;
  combinations: BotAiCombination[];
};

export function botAiCombinationStatus(nluType: NluType, nluModel: NluModelKey, answerMode: AnswerMode) {
  if (nluType === "ml" && answerMode !== "fixed") {
    return "unsupported";
  }
  if ((nluType === "semantic_vector" || nluType === "semantic_external") && (answerMode === "llm_rag" || answerMode === "llm")) {
    return "unsupported";
  }
  if (nluType === "llm" && answerMode === "semantic_rag") {
    return "unsupported";
  }
  if (nluType === "llm" && (answerMode === "llm" || answerMode === "llm_rag")) {
    return "implemented";
  }
  return nluType === "ml" && nluModel === "deep_learning_lite" && answerMode === "fixed"
    ? "implemented"
    : "configured";
}

function botAiCombinationStatusLabel(status: BotAiCombinationStatus) {
  if (status === "implemented") {
    return "실행/학습 가능";
  }
  if (status === "unsupported") {
    return "사용 못함";
  }
  return "설정 저장만 가능";
}

function botAiCombinationNote(status: BotAiCombinationStatus) {
  if (status === "implemented") {
    return "현재 1.0 런타임과 학습 엔진에 연결된 조합입니다.";
  }
  if (status === "unsupported") {
    return "논리적으로 사용할 수 없는 조합입니다. 다른 답변 엔진을 선택해주세요.";
  }
  return "학습 전까지 모델을 변경할 수 있고, 학습 완료 후 해당 엔진 기준으로 고정됩니다.";
}

export function buildBotAiCombinations(): BotAiCombination[] {
  return NLU_TYPE_OPTIONS.flatMap((nluTypeOption) => {
    const nluModelOption = NLU_MODEL_OPTIONS_BY_TYPE[nluTypeOption.value][0];
    return ANSWER_MODE_OPTIONS.map((answerOption) => {
      const status = botAiCombinationStatus(nluTypeOption.value, nluModelOption.value, answerOption.value);
      return {
        id: `${nluTypeOption.value}:${nluModelOption.value}:${answerOption.value}`,
        nluType: nluTypeOption.value,
        nluModel: nluModelOption.value,
        answerMode: answerOption.value,
        nluLabel: nluTypeOption.label,
        nluModelLabel: nluModelOption.label,
        answerLabel: answerOption.label,
        status,
        statusLabel: botAiCombinationStatusLabel(status),
        note: botAiCombinationNote(status),
      } satisfies BotAiCombination;
    });
  });
}

export function buildBotAiCombinationRows(): BotAiCombinationRow[] {
  const combinations = buildBotAiCombinations();
  return NLU_TYPE_OPTIONS.map((nluTypeOption) => {
    const modelOption = NLU_MODEL_OPTIONS_BY_TYPE[nluTypeOption.value][0];
    return {
      nluType: nluTypeOption.value,
      nluLabel: nluTypeOption.label,
      nluModelLabel: modelOption.label,
      combinations: combinations.filter((item) => item.nluType === nluTypeOption.value),
    };
  });
}

export function selectedBotAiCombination(
  nluType: NluType,
  nluModel: NluModelKey,
  answerMode: AnswerMode,
) {
  const base = buildBotAiCombinations().find(
    (item) => item.nluType === nluType && item.answerMode === answerMode,
  );
  const modelOption = NLU_MODEL_OPTIONS_BY_TYPE[nluType].find((item) => item.value === nluModel);
  if (!base || !modelOption) {
    return undefined;
  }
  const status = botAiCombinationStatus(nluType, nluModel, answerMode);
  return {
    ...base,
    id: `${nluType}:${nluModel}:${answerMode}`,
    nluModel,
    nluModelLabel: modelOption.label,
    status,
    statusLabel: botAiCombinationStatusLabel(status),
    note: botAiCombinationNote(status),
  } satisfies BotAiCombination;
}
