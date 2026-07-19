export type LlmProvider =
  | "gemini"
  | "chatgpt"
  | "claude"
  | "groq"
  | "cerebras"
  | "mistral"
  | "ollama"
  | "openrouter";

export type LlmModelKey =
  | "gemini-1.5-flash"
  | "gemini-1.5-pro"
  | "gpt-4o-mini"
  | "gpt-4o"
  | "claude-3-5-haiku"
  | "claude-3-5-sonnet"
  | "llama-3.3-70b-versatile"
  | "mixtral-8x7b"
  | "llama3.1-8b"
  | "qwen-3-32b"
  | "mistral-small"
  | "mistral-medium"
  | "mistral-large"
  | "ollama-local"
  | "llama3.1-local"
  | "openrouter-auto"
  | "openrouter-gpt-4o-mini";

export type LlmProviderOption = {
  value: LlmProvider;
  label: string;
  note: string;
};

export type LlmModelOption = {
  value: LlmModelKey;
  label: string;
  provider: LlmProvider;
  note: string;
};

export const DEFAULT_LLM_PROVIDER: LlmProvider = "chatgpt";
export const DEFAULT_LLM_MODEL: LlmModelKey = "gpt-4o-mini";

export const LLM_PROVIDER_OPTIONS: LlmProviderOption[] = [
  { value: "gemini", label: "Gemini", note: "Google" },
  { value: "chatgpt", label: "ChatGPT", note: "OpenAI" },
  { value: "claude", label: "Claude", note: "Anthropic" },
  { value: "groq", label: "Groq", note: "GroqCloud" },
  { value: "cerebras", label: "Cerebras", note: "Cerebras Inference" },
  { value: "mistral", label: "Mistral", note: "Mistral AI" },
  { value: "ollama", label: "Ollama", note: "localhost/localPC" },
  { value: "openrouter", label: "OpenRouter", note: "Router" },
];

export const LLM_MODEL_OPTIONS_BY_PROVIDER: Record<LlmProvider, LlmModelOption[]> = {
  gemini: [
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash", provider: "gemini", note: "빠른 응답" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro", provider: "gemini", note: "고품질 응답" },
  ],
  chatgpt: [
    { value: "gpt-4o-mini", label: "GPT-4o mini", provider: "chatgpt", note: "기본" },
    { value: "gpt-4o", label: "GPT-4o", provider: "chatgpt", note: "고품질" },
  ],
  claude: [
    { value: "claude-3-5-haiku", label: "Claude 3.5 Haiku", provider: "claude", note: "빠른 응답" },
    { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet", provider: "claude", note: "고품질" },
  ],
  groq: [
    { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile", provider: "groq", note: "기본" },
    { value: "mixtral-8x7b", label: "Mixtral 8x7B", provider: "groq", note: "대체" },
  ],
  cerebras: [
    { value: "llama3.1-8b", label: "Llama 3.1 8B", provider: "cerebras", note: "빠른 응답" },
    { value: "qwen-3-32b", label: "Qwen 3 32B", provider: "cerebras", note: "고품질" },
  ],
  mistral: [
    { value: "mistral-small", label: "Mistral Small", provider: "mistral", note: "기본" },
    { value: "mistral-medium", label: "Mistral Medium", provider: "mistral", note: "균형" },
    { value: "mistral-large", label: "Mistral Large", provider: "mistral", note: "고품질" },
  ],
  ollama: [
    { value: "ollama-local", label: "Ollama Local", provider: "ollama", note: "localhost/localPC" },
    { value: "llama3.1-local", label: "Llama 3.1 Local", provider: "ollama", note: "localPC" },
  ],
  openrouter: [
    { value: "openrouter-auto", label: "OpenRouter Auto", provider: "openrouter", note: "자동 선택" },
    { value: "openrouter-gpt-4o-mini", label: "OpenRouter GPT-4o mini", provider: "openrouter", note: "OpenAI 경유" },
  ],
};

export function defaultLlmModelForProvider(provider: LlmProvider): LlmModelKey {
  return LLM_MODEL_OPTIONS_BY_PROVIDER[provider][0]?.value ?? DEFAULT_LLM_MODEL;
}

export function isLlmProvider(value: string | null | undefined): value is LlmProvider {
  return LLM_PROVIDER_OPTIONS.some((option) => option.value === value);
}

export function isLlmModel(value: string | null | undefined): value is LlmModelKey {
  return Object.values(LLM_MODEL_OPTIONS_BY_PROVIDER).some((options) =>
    options.some((option) => option.value === value),
  );
}

export function normalizeLlmProvider(value: string | null | undefined): LlmProvider {
  return isLlmProvider(value) ? value : DEFAULT_LLM_PROVIDER;
}

export function normalizeLlmModel(provider: LlmProvider, value: string | null | undefined): LlmModelKey {
  if (!isLlmModel(value)) {
    return defaultLlmModelForProvider(provider);
  }
  return LLM_MODEL_OPTIONS_BY_PROVIDER[provider].some((option) => option.value === value)
    ? value
    : defaultLlmModelForProvider(provider);
}
