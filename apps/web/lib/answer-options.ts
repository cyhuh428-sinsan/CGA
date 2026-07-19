export type AnswerMode = "fixed" | "semantic_rag" | "llm_rag" | "llm";

export type AnswerModeOption = {
  value: AnswerMode;
  label: string;
  disabled?: boolean;
  note: string;
};

export const DEFAULT_ANSWER_MODE: AnswerMode = "fixed";

export const ANSWER_MODE_OPTIONS: AnswerModeOption[] = [
  { value: "fixed", label: "정해진 답변", note: "1.0/1.5 지원" },
  { value: "semantic_rag", label: "Semantic Engine RAG 답변", note: "1.5 설정" },
  { value: "llm_rag", label: "LLM Engine RAG 답변", note: "1.5 설정" },
  { value: "llm", label: "LLM Engine 답변", note: "1.5 설정" },
];

export function isAnswerMode(value: string | null | undefined): value is AnswerMode {
  return ANSWER_MODE_OPTIONS.some((option) => option.value === value);
}

export function normalizeAnswerMode(value: string | null | undefined): AnswerMode {
  return isAnswerMode(value) ? value : DEFAULT_ANSWER_MODE;
}
