export const ERROR_DOMAINS = Object.freeze({
  CGA: "cga",
  BOT: "bot",
  LLM: "llm",
  HANDOFF: "handoff",
  CHANNEL: "channel",
  SIMULATOR: "simulator",
  COMMERCIAL: "commercial",
  ENTITLEMENT: "entitlement"
});

export const ERROR_AUDIENCES = Object.freeze({
  CGA_USER: "cga_user",
  BOT_USER: "bot_user"
});

export const ERROR_LOCALE_SOURCES = Object.freeze({
  USER_LOCALE: "user.locale",
  BOT_LOCALE: "bot.defaultLocale"
});

export const ERROR_CODES = Object.freeze({
  BOT_NAME_REQUIRED: "CGA_BOT_NAME_REQUIRED",
  LLM_NOT_CONNECTED: "CGA_LLM_NOT_CONNECTED",
  LLM_REQUIRED_FOR_PDF: "CGA_LLM_REQUIRED_FOR_PDF",
  HANDOFF_RESULT_INVALID: "CGA_HANDOFF_RESULT_INVALID",
  CHANNEL_CONNECTION_FAILED: "CGA_CHANNEL_CONNECTION_FAILED",
  SIMULATOR_TIMEOUT: "CGA_SIMULATOR_TIMEOUT",
  COMMERCIAL_MODULE_REQUIRED: "CGA_COMMERCIAL_MODULE_REQUIRED",
  ENTITLEMENT_NOT_CONNECTED: "CGA_ENTITLEMENT_NOT_CONNECTED",
  BOT_ANSWER_NOT_FOUND: "BOT_ANSWER_NOT_FOUND",
  BOT_API_LOOKUP_FAILED: "BOT_API_LOOKUP_FAILED",
  BOT_FALLBACK_REQUIRED: "BOT_FALLBACK_REQUIRED"
});

export function createErrorResponse({ code, key, fallbackMessage, details = {}, audience = ERROR_AUDIENCES.CGA_USER, localeSource = ERROR_LOCALE_SOURCES.USER_LOCALE }) {
  return {
    error_code: code,
    message_key: key,
    fallback_message: fallbackMessage,
    audience,
    locale_source: localeSource,
    details
  };
}

export function createCgaErrorResponse({ code, key, fallbackMessage, details = {} }) {
  return createErrorResponse({
    code,
    key,
    fallbackMessage,
    details,
    audience: ERROR_AUDIENCES.CGA_USER,
    localeSource: ERROR_LOCALE_SOURCES.USER_LOCALE
  });
}

export function createBotErrorResponse({ code, key, fallbackMessage, details = {} }) {
  return createErrorResponse({
    code,
    key,
    fallbackMessage,
    details,
    audience: ERROR_AUDIENCES.BOT_USER,
    localeSource: ERROR_LOCALE_SOURCES.BOT_LOCALE
  });
}

export function isCgaErrorResponse(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof value.error_code === "string" &&
    typeof value.message_key === "string"
  );
}
