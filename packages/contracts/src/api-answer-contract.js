export const ANSWER_SOURCE_TYPE = Object.freeze({
  FIXED_TEXT: "fixed_text",
  EXTERNAL_API: "external_api",
  RAG: "rag",
  LLM: "llm"
});

export const API_ANSWER_METHOD = Object.freeze({
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  PATCH: "PATCH"
});

export const API_AUTH_TYPE = Object.freeze({
  NONE: "none",
  API_KEY: "api_key",
  BEARER: "bearer",
  BASIC: "basic",
  CUSTOM_HEADER: "custom_header"
});

export function createExternalApiAnswerDraft() {
  return {
    answer_source_type: ANSWER_SOURCE_TYPE.EXTERNAL_API,
    group_id: "",
    bot_id: "",
    managed_by: "group",
    name: "",
    endpoint_url: "",
    method: API_ANSWER_METHOD.GET,
    auth_type: API_AUTH_TYPE.NONE,
    secret_ref: "",
    request_mapping: {},
    response_mapping: {
      answer_text_path: ""
    },
    timeout_ms: 5000,
    fallback_answer: ""
  };
}

export function createGroupManagedApiAnswerDraft({ groupId, botId }) {
  return {
    ...createExternalApiAnswerDraft(),
    group_id: groupId,
    bot_id: botId,
    managed_by: "group",
    allowed_group_scopes: ["apiAnswer.manage", "bot.view"]
  };
}


export const API_DATA_FRESHNESS = Object.freeze({
  REAL_TIME: "real_time",
  SHORT_CACHE: "short_cache",
  DAILY_CACHE: "daily_cache",
  MANUAL_REFRESH: "manual_refresh"
});

export const EXTERNAL_API_ANSWER_EXAMPLES = Object.freeze([
  "company_revenue",
  "company_net_income",
  "order_status",
  "delivery_status",
  "account_balance",
  "reservation_status"
]);

export function createDynamicMetricApiAnswerDraft() {
  return {
    ...createGroupManagedApiAnswerDraft({ groupId: "", botId: "" }),
    name: "company_financial_metric_lookup",
    freshness: API_DATA_FRESHNESS.SHORT_CACHE,
    response_mapping: {
      answer_text_path: "data.formatted_answer",
      value_path: "data.value",
      unit_path: "data.unit",
      as_of_path: "data.as_of"
    },
    fallback_answer: "The latest value is not available right now."
  };
}
