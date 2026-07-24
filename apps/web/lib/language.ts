export type SupportedLanguage = "ko" | "en" | "zh-CN" | "ja" | "vi" | "fr" | "de";

export type SupportedLanguageOption = {
  code: SupportedLanguage;
  label: string;
  intlLocale: string;
};

export const DEFAULT_LANGUAGE: SupportedLanguage = "ko";
export const UI_LANGUAGE_STORAGE_KEY = "aidot.language";

export const SUPPORTED_LANGUAGES: readonly SupportedLanguageOption[] = [
  { code: "ko", label: "한국어", intlLocale: "ko-KR" },
  { code: "en", label: "English", intlLocale: "en-US" },
  { code: "zh-CN", label: "简体中文", intlLocale: "zh-CN" },
  { code: "ja", label: "日本語", intlLocale: "ja-JP" },
  { code: "vi", label: "Tiếng Việt", intlLocale: "vi-VN" },
  { code: "fr", label: "Français", intlLocale: "fr-FR" },
  { code: "de", label: "Deutsch", intlLocale: "de-DE" },
] as const;

const SUPPORTED_LANGUAGE_CODES = new Set<string>(SUPPORTED_LANGUAGES.map((item) => item.code));

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === "string" && SUPPORTED_LANGUAGE_CODES.has(value);
}

export function normalizeSupportedLanguage(value: unknown): SupportedLanguage {
  return isSupportedLanguage(value) ? value : DEFAULT_LANGUAGE;
}

export function getLanguageLabel(value: unknown): string {
  const language = normalizeSupportedLanguage(value);
  return SUPPORTED_LANGUAGES.find((item) => item.code === language)?.label ?? SUPPORTED_LANGUAGES[0].label;
}
