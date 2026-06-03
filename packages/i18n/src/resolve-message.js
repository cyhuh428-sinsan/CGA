export const DEFAULT_LOCALE = "en";

export function resolveMessage(resources, locale, key, fallbackMessage, fallbackLocale = DEFAULT_LOCALE) {
  const localeMessages = resources?.[locale] || {};
  const fallbackMessages = resources?.[fallbackLocale] || {};
  return localeMessages[key] || fallbackMessages[key] || fallbackMessage || key;
}

export function resolveErrorMessage(resources, locale, error, fallbackLocale = DEFAULT_LOCALE) {
  const key = error?.message_key || error?.key;
  const fallback = error?.fallback_message || error?.error_code || error?.code;
  if (!key) return fallback || "Unknown error";
  return resolveMessage(resources, locale, key, fallback, fallbackLocale);
}

export function resolveCgaErrorMessage(resources, userLocale, error, fallbackLocale = DEFAULT_LOCALE) {
  return resolveErrorMessage(resources, userLocale, error, fallbackLocale);
}

export function resolveBotErrorMessage(resources, botLocale, error, fallbackLocale = DEFAULT_LOCALE) {
  return resolveErrorMessage(resources, botLocale, error, fallbackLocale);
}
