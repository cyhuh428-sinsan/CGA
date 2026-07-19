import { apiRequest, apiSameOriginRequest, resolveApiPublicUrl } from "@/lib/api";

export type AdminUserListItem = {
  id: string;
  kind: "user" | "signup_request";
  login_id: string;
  name: string;
  group_name: string;
  role_code: "curator" | "operation_manager" | "system_manager" | "it_admin";
  role_name: string;
  requested_at: string;
  signup_status: string;
  account_status: string;
  is_protected: boolean;
};

export type AdminUsersResponse = {
  items: AdminUserListItem[];
  total: number;
};

export type AdminUserFilter = {
  query?: string;
  groupId?: string;
  roleCode?: string;
  accountStatus?: string;
  signupStatus?: string;
};

export type AdminUserDetail = {
  id: string;
  kind: "user" | "signup_request";
  login_id: string;
  name: string;
  organization_name: string;
  group_name: string;
  group_id: string;
  role_code: "curator" | "operation_manager" | "system_manager" | "it_admin";
  role_name: string;
  requested_at: string;
  signup_status: string;
  account_status: string;
  comment: string | null;
  preferred_language: string;
  is_protected: boolean;
  available_groups: AdminGroupOption[];
  data_json: Record<string, unknown>;
};

export type AdminLoginHistoryItem = {
  id: string;
  login_id: string;
  name: string;
  group_name: string;
  role_name: string;
  ip_address: string | null;
  login_at: string;
  logout_at: string | null;
};

export type AdminLoginHistoryResponse = {
  items: AdminLoginHistoryItem[];
  total: number;
};

export type AdminLoginHistoryFilter = {
  query?: string;
  fromDate?: string;
  toDate?: string;
};

export type AdminAuditLogItem = {
  id: string;
  action_type: string;
  target_type: string;
  target_id: string | null;
  actor_login_id: string;
  ip_address: string | null;
  created_at: string;
  summary: string;
  data_json: Record<string, unknown>;
};

export type AdminAuditLogsResponse = {
  items: AdminAuditLogItem[];
  total: number;
};

export type AdminAuditLogFilter = {
  query?: string;
  actionType?: string;
  targetType?: string;
  fromDate?: string;
  toDate?: string;
};


export type AdminSystemLogItem = {
  id: string;
  time: string | null;
  level: string;
  logger: string;
  event: string | null;
  message: string;
  method: string | null;
  path: string | null;
  status_code: number | null;
  elapsed_ms: number | string | null;
  client: string | null;
  request_id: string | null;
  data: Record<string, unknown>;
  exception: string | null;
  raw: string;
};

export type AdminSystemLogsResponse = {
  items: AdminSystemLogItem[];
  total: number;
  log_file: string;
};

export type AdminSystemLogFilter = {
  file?: "app" | "error";
  query?: string;
  level?: string;
  event?: string;
  limit?: number;
};
export type AdminGroupListItem = {
  id: string;
  code: string;
  name: string;
  status: string;
  creator_name: string;
  updater_name: string;
  updated_at: string;
};

export type AdminGroupOption = {
  id: string;
  code: string;
  name: string;
};

export type AdminGroupDetail = {
  id: string;
  code: string;
  name: string;
  status: "active" | "inactive";
  status_label: string;
  creator_name: string;
  updater_name: string;
  created_at: string;
  updated_at: string;
  user_count: number;
  data_json: Record<string, unknown>;
};

export type AdminGroupsResponse = {
  items: AdminGroupListItem[];
  total: number;
};

export type AdminCommonVariableItem = {
  id: string;
  kind: "system" | "user";
  name: string;
  value: string;
  description: string | null;
  updated_at: string;
  updater_name: string;
  data_json: Record<string, unknown>;
};

export type AdminCommonVariablesResponse = {
  items: AdminCommonVariableItem[];
  total: number;
};

export type AdminCommonVariableFilter = {
  query?: string;
  kind?: string;
};

export type AdminCommonVariablePayload = {
  name: string;
  value: string;
  description?: string | null;
};

export type AdminChannelItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: "active" | "inactive";
  status_label: string;
  creator_name: string;
  updater_name: string;
  updated_at: string;
  data_json: Record<string, unknown>;
};

export type AdminChannelsResponse = {
  items: AdminChannelItem[];
  total: number;
};

export type AdminChannelFilter = {
  query?: string;
  status?: string;
};

export type AdminChannelPayload = {
  code: string;
  name: string;
  provider: string;
  renderer_type: string;
  endpoint_url?: string | null;
  auth_type: string;
  auth_config?: Record<string, unknown>;
  description?: string | null;
  status: "active" | "inactive";
};

export type ChannelHealthDetail = {
  channel: string;
  status: string;
  provider?: string;
  renderer?: string;
  webhook_endpoint?: string;
  auth_header?: string;
  supported_outputs?: string[];
  logging_events?: string[];
};

export type ChannelHealthResponse = {
  status: string;
  channels: string[];
  details: ChannelHealthDetail[];
};

export type AdminTemplateItem = {
  id: string;
  channel_code: string;
  channel_name: string;
  name: string;
  renderer_type: string;
  item_count: number;
  item_types: string;
  description: string | null;
  status: "active" | "inactive";
  status_label: string;
  creator_name: string;
  updater_name: string;
  updated_at: string;
  data_json: Record<string, unknown>;
};

export type AdminTemplatesResponse = {
  items: AdminTemplateItem[];
  total: number;
};

export type AdminTemplateFilter = {
  query?: string;
  channelCode?: string;
  status?: string;
  activeOnly?: boolean;
};

export type AdminTemplatePayload = {
  channel_code: string;
  name: string;
  renderer_type: string;
  item_types: string;
  description?: string | null;
  status: "active" | "inactive";
};


export type AdminDefaultMessageItem = {
  id: string;
  message_key: string;
  message_name: string;
  category: string;
  category_label: string;
  language: string;
  scope: "global" | "group";
  scope_label: string;
  message_text: string;
  default_message_text: string | null;
  is_modified: boolean;
  description: string | null;
  status: "active" | "inactive";
  status_label: string;
  updated_at: string;
  updater_name: string;
  data_json: Record<string, unknown>;
};

export type AdminDefaultMessagesResponse = {
  items: AdminDefaultMessageItem[];
  total: number;
};

export type AdminDefaultMessageFilter = {
  query?: string;
  category?: string;
  status?: string;
};

export type AdminDefaultMessagePayload = {
  message_name: string;
  category: string;
  language: string;
  scope: "global" | "group";
  message_text: string;
  description?: string | null;
  status: "active" | "inactive";
};
export type AdminOperationsDashboardSummary = {
  period_days: number;
  period_hours: number;
  period_label: string;
  total_bots: number;
  active_bots: number;
  total_versions: number;
  operating_bots: number;
  botstation_connected_bots: number;
  active_channels: number;
  channel_rooms: number;
  user_messages: number;
  bot_messages: number;
  api_calls: number;
  api_errors: number;
  intent_fallbacks: number;
  training_success: number;
  training_failed: number;
  queue_events: number;
  queue_queued: number;
  queue_processing: number;
  queue_completed: number;
  queue_failed: number;
  runtime_events: number;
  runtime_problem_events: number;
  system_errors: number;
  slow_api_requests: number;
  slow_db_requests: number;
  slow_api_threshold_ms: number;
  slow_db_threshold_ms: number;
  recent_error_count: number;
  active_edit_locks: number;
  expired_edit_locks: number;
  edit_lock_conflicts: number;
};

export type AdminOperationsDashboardVersionIntegritySummary = {
  version_storage_total_versions: number;
  version_storage_split_versions: number;
  version_storage_missing_versions: number;
  version_storage_mismatch_versions: number;
  version_storage_expected_dialog_rows: number;
  version_storage_actual_dialog_rows: number;
  version_storage_expected_graph_rows: number;
  version_storage_actual_graph_rows: number;
  version_read_snapshot_total_versions: number;
  version_read_snapshot_complete_versions: number;
  version_read_snapshot_missing_versions: number;
  version_read_snapshot_missing_asset_counts: number;
  version_read_snapshot_missing_scenario_validation: number;
  version_read_snapshot_missing_nlu_training: number;
  version_read_snapshot_missing_entities: number;
  version_read_snapshot_missing_dictionary: number;
  version_read_snapshot_missing_apis: number;
  version_read_snapshot_missing_system_config: number;
};

export type AdminOperationsDashboardErrorItem = {
  id: string;
  source: string;
  event: string;
  message: string;
  bot_name: string;
  occurred_at: string;
  data_json: Record<string, unknown>;
};

export type AdminOperationsDashboardRuntimeItem = {
  id: string;
  source: string;
  level: string;
  event: string;
  message: string;
  bot_name: string;
  dialog_name: string;
  node_title: string;
  occurred_at: string;
  data_json: Record<string, unknown>;
};

export type AdminOperationsDashboardSystemErrorItem = {
  id: string;
  source: string;
  level: string;
  event: string;
  message: string;
  logger: string;
  path: string | null;
  status_code: number | null;
  request_id: string | null;
  occurred_at: string;
  data_json: Record<string, unknown>;
};

export type AdminOperationsDashboardSlowRequestItem = {
  id: string;
  kind: "api" | "db";
  event: string;
  method: string;
  path: string;
  status_code: number | null;
  elapsed_ms: number | null;
  db_duration_ms: number;
  db_query_count: number;
  threshold_ms: number;
  request_id: string | null;
  occurred_at: string;
};

export type AdminOperationsDashboardSlowRequestSummaryItem = {
  id: string;
  kind: "api" | "db";
  method: string;
  path: string;
  count: number;
  max_elapsed_ms: number;
  avg_elapsed_ms: number;
  max_db_duration_ms: number;
  avg_db_duration_ms: number;
  latest_occurred_at: string;
};

export type AdminOperationsDashboardEditLockItem = {
  id: string;
  bot_id: string;
  bot_name: string;
  version_id: string;
  version_name: string;
  dialog_id: string;
  area: string;
  owner_login_id: string;
  owner_name: string | null;
  expires_at: string;
  last_seen_at: string;
};

export type AdminOperationsDashboardCacheStatus = {
  enabled: boolean;
  backend: string;
  available: boolean | null;
  redis_url_configured: boolean;
  package_installed: boolean;
  connection_state: string;
  hits: number;
  misses: number;
  fallbacks: number;
  read_errors: number;
  write_errors: number;
  purges: number;
  purge_errors: number;
  hit_rate: number;
  memory_used_bytes: number | null;
  memory_max_bytes: number | null;
  memory_usage_percent: number | null;
  last_error: string | null;
};

export type AdminNluAccelerationStatus = {
  configured?: string;
  state?: string;
  available: boolean | null;
  device?: string | null;
  execution_count?: number;
  last_execution_at?: string | null;
  last_operation?: string | null;
  error?: string;
};

export type AdminOperationsDashboardAlertItem = {
  level: "critical" | "warning" | "info";
  code: string;
  title: string;
  message: string;
  value: number | string;
};

export type AdminCachePurgeResponse = {
  domain: "version_sections" | "studio_read_models";
  status: "purged" | "skipped" | "failed";
  purged: number;
  pattern: string;
  reason: string | null;
  cache: AdminOperationsDashboardCacheStatus;
};

export type AdminVersionStorageBackfillResponse = {
  dry_run: boolean;
  requested_limit: number;
  selected_versions: number;
  processed_versions: number;
  failed_versions: Array<{ version_id: string; bot_id: string; message: string }>;
  expected_dialog_rows: number;
  expected_graph_rows: number;
  dialog_split: {
    total_versions: number;
    split_versions: number;
    missing_versions: number;
    mismatch_versions: number;
    dialog_mismatch_versions: number;
    graph_mismatch_versions: number;
    expected_dialog_rows: number;
    expected_graph_rows: number;
    actual_dialog_rows: number;
    actual_graph_rows: number;
  };
};

export type AdminVersionReadSnapshotBackfillResponse = {
  dry_run: boolean;
  requested_limit: number;
  selected_versions: number;
  processed_versions: number;
  failed_versions: Array<{ version_id: string; bot_id: string; message: string }>;
  purged_cache_keys: number;
  read_snapshot: {
    total_versions: number;
    complete_versions: number;
    missing_versions: number;
    missing_asset_counts: number;
    missing_scenario_validation: number;
    missing_nlu_training: number;
    missing_entities: number;
    missing_dictionary: number;
    missing_apis: number;
    missing_system_config: number;
  };
};

export type AdminVersionStorageIssueItem = {
  bot_id: string;
  bot_name: string;
  version_id: string;
  version_name: string;
  version_no: number;
  status: "missing" | "mismatch";
  expected_dialog_rows: number;
  actual_dialog_rows: number;
  expected_graph_rows: number;
  actual_graph_rows: number;
  missing_dialog_ids: string[];
  extra_dialog_ids: string[];
  missing_graph_ids: string[];
  extra_graph_ids: string[];
  updated_at: string | null;
};

export type AdminOperationsDashboardResponse = {
  summary: AdminOperationsDashboardSummary;
  alerts: AdminOperationsDashboardAlertItem[];
  recent_errors: AdminOperationsDashboardErrorItem[];
  recent_runtime_events: AdminOperationsDashboardRuntimeItem[];
  recent_system_errors: AdminOperationsDashboardSystemErrorItem[];
  recent_slow_requests: AdminOperationsDashboardSlowRequestItem[];
  recent_slow_request_summary: AdminOperationsDashboardSlowRequestSummaryItem[];
  active_edit_locks: AdminOperationsDashboardEditLockItem[];
  cache: AdminOperationsDashboardCacheStatus;
  nlu_acceleration: {
    ml: AdminNluAccelerationStatus;
    semantic: AdminNluAccelerationStatus;
  };
  generated_at: string;
};

export type AdminOperationsDashboardVersionIntegrityResponse = {
  summary: AdminOperationsDashboardVersionIntegritySummary;
  alerts: AdminOperationsDashboardAlertItem[];
  version_storage_issues: AdminVersionStorageIssueItem[];
  generated_at: string;
};

export type AdminApiReadinessStatus = {
  ok: boolean;
  status: number | null;
  app: string;
  database: string;
  message: string;
  elapsed_ms: number | null;
  checked_at: string;
};

export type AdminNluQualityDiagnosticItem = {
  id: string;
  row_type?: "T" | "V" | string;
  utterance: string;
  expected_name: string;
  predicted_name: string;
  status?: string;
  diagnosis_type?: string;
  expected_score?: number;
  top_score?: number;
  second_name?: string;
  second_score?: number;
  cutoff_score?: number;
  features?: string[];
  expected_features?: string[];
  reason?: string;
  recommendation?: string;
};

export type AdminNluQualityDiagnostics = {
  settings?: {
    score_cutoff?: number;
    similar_intent_score?: number;
    max_intent_results?: number;
    top_k?: number;
    index_name?: string;
    endpoint_url?: string;
  };
  summary?: {
    engine_type?: string;
    total_checked?: number;
    training_checked?: number;
    validation_checked?: number;
    problem_count?: number;
    exact_match_count?: number;
    accuracy?: number;
    status_counts?: Record<string, number>;
    diagnosis_counts?: Record<string, number>;
  };
  items?: AdminNluQualityDiagnosticItem[];
};

export type AdminTrainingHistoryItem = {
  id: string;
  group_name: string;
  bot_name: string;
  version_no: number;
  nlu_type?: string | null;
  nlu_model?: string | null;
  training_status: string;
  user_login_id: string;
  started_at: string;
  completed_at: string;
  data_json: Record<string, unknown> & {
    quality_diagnostics?: AdminNluQualityDiagnostics;
  };
};

export type AdminConversationHistoryItem = {
  id: string;
  group_name: string;
  channel_name: string;
  bot_name: string;
  version_no?: number | null;
  user_key: string;
  intent_or_module_name: string;
  uttered_at: string;
  result: string;
  data_json: Record<string, unknown>;
};

export type AdminConversationHistoryFilter = {
  query?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
  group?: string;
  bot?: string;
  channel?: string;
};

export type AdminQueueHistoryFilter = {
  query?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
  group?: string;
  bot?: string;
  channel?: string;
};

export type AdminApiCallHistoryItem = {
  id: string;
  method: string;
  filters: string;
  api_name: string;
  api_type: string;
  url: string;
  transfer_type: string;
  channel_name: string;
  group_name: string;
  bot_name: string;
  version_no: number;
  intent_name: string;
  response_code: string;
  user_key: string;
  called_at: string;
  data_json: Record<string, unknown>;
};

export type AdminQueueHistoryItem = {
  id: string;
  intent_name: string;
  sender_system: string;
  priority: string;
  parameter: string;
  channel_name: string;
  bot_name: string;
  receiver: string;
  receive_status: string;
  requested_at: string;
  status_changed_at: string;
  data_json: Record<string, unknown>;
};

export type AdminIntentFeedbackItem = {
  id: string;
  group_name: string;
  bot_name: string;
  version_no: number;
  channel_name: string;
  intent_name: string;
  average_score: number;
  feedback_count: number;
  data_json: Record<string, unknown>;
};

export type AdminHistoryResponse<T> = {
  items: T[];
  total: number;
  page?: number;
  page_size?: number;
  filter_options?: {
    groups?: string[];
    bots?: string[];
    channels?: string[];
  };
};

export function fetchAdminUsers(token: string, filters: AdminUserFilter = {}) {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.groupId) params.set("group_id", filters.groupId);
  if (filters.roleCode) params.set("role_code", filters.roleCode);
  if (filters.accountStatus) params.set("account_status", filters.accountStatus);
  if (filters.signupStatus) params.set("signup_status", filters.signupStatus);
  const search = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<AdminUsersResponse>(`/api/v1/admin/users${search}`, {}, token);
}

export function fetchAdminUserDetail(token: string, kind: "user" | "signup_request", id: string) {
  const path =
    kind === "user"
      ? `/api/v1/admin/users/${id}`
      : `/api/v1/admin/signup-requests/${id}`;
  return apiRequest<AdminUserDetail>(path, {}, token);
}

export function fetchLoginHistory(token: string, filters: AdminLoginHistoryFilter = {}) {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.fromDate) params.set("from_date", filters.fromDate);
  if (filters.toDate) params.set("to_date", filters.toDate);
  const search = params.toString() ? `?${params.toString()}` : "";
  return apiSameOriginRequest<AdminLoginHistoryResponse>(`/api/v1/admin/login-history${search}`, {}, token);
}

export function fetchAuditLogs(token: string, filters: AdminAuditLogFilter = {}) {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.actionType) params.set("action_type", filters.actionType);
  if (filters.targetType) params.set("target_type", filters.targetType);
  if (filters.fromDate) params.set("from_date", filters.fromDate);
  if (filters.toDate) params.set("to_date", filters.toDate);
  const search = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<AdminAuditLogsResponse>(`/api/v1/admin/audit-logs${search}`, {}, token);
}
export function fetchSystemLogs(token: string, filters: AdminSystemLogFilter = {}) {
  const params = new URLSearchParams();
  if (filters.file) params.set("file", filters.file);
  if (filters.query) params.set("query", filters.query);
  if (filters.level) params.set("level", filters.level);
  if (filters.event) params.set("event", filters.event);
  if (filters.limit) params.set("limit", String(filters.limit));
  const search = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<AdminSystemLogsResponse>(`/api/v1/admin/system-logs${search}`, {}, token);
}

export function fetchGroups(token: string, query = "") {
  const search = query ? `?query=${encodeURIComponent(query)}` : "";
  return apiRequest<AdminGroupsResponse>(`/api/v1/admin/groups${search}`, {}, token);
}

export function fetchGroupDetail(token: string, id: string) {
  return apiRequest<AdminGroupDetail>(`/api/v1/admin/groups/${id}`, {}, token);
}


export function fetchDefaultMessages(token: string, filters: AdminDefaultMessageFilter = {}) {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  const search = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<AdminDefaultMessagesResponse>(`/api/v1/admin/default-messages${search}`, {}, token);
}

export function updateDefaultMessage(token: string, id: string, payload: AdminDefaultMessagePayload) {
  return apiRequest<{ message: string }>(
    `/api/v1/admin/default-messages/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function restoreDefaultMessage(token: string, id: string) {
  return apiRequest<{ message: string }>(
    `/api/v1/admin/default-messages/${id}/restore`,
    { method: "POST" },
    token,
  );
}

export function fetchCommonVariables(token: string, filters: AdminCommonVariableFilter = {}) {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.kind) params.set("kind", filters.kind);
  const search = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<AdminCommonVariablesResponse>(`/api/v1/admin/common-variables${search}`, {}, token);
}

export function createCommonVariable(token: string, payload: AdminCommonVariablePayload) {
  return apiRequest<{ message: string; id: string }>(
    "/api/v1/admin/common-variables",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function updateCommonVariable(
  token: string,
  id: string,
  payload: Omit<AdminCommonVariablePayload, "name">,
) {
  return apiRequest<{ message: string }>(
    `/api/v1/admin/common-variables/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function importCommonVariables(token: string, items: AdminCommonVariablePayload[]) {
  return apiRequest<{ message: string; saved_count: number; skipped_count: number }>(
    "/api/v1/admin/common-variables/import",
    {
      method: "POST",
      body: JSON.stringify({ items }),
    },
    token,
  );
}

export function deleteCommonVariable(token: string, id: string) {
  return apiRequest<{ message: string }>(
    `/api/v1/admin/common-variables/${id}`,
    {
      method: "DELETE",
    },
    token,
  );
}

export function fetchChannels(token: string, filters: AdminChannelFilter = {}) {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.status) params.set("status", filters.status);
  const search = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<AdminChannelsResponse>(`/api/v1/admin/channels${search}`, {}, token);
}

export function createChannel(token: string, payload: AdminChannelPayload) {
  return apiRequest<{ message: string; id: string }>(
    "/api/v1/admin/channels",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function updateChannel(token: string, id: string, payload: Omit<AdminChannelPayload, "code">) {
  return apiRequest<{ message: string }>(
    `/api/v1/admin/channels/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function deleteChannel(token: string, id: string) {
  return apiRequest<{ message: string }>(
    `/api/v1/admin/channels/${id}`,
    {
      method: "DELETE",
    },
    token,
  );
}

export function testChannelConnection(token: string, id: string) {
  return apiRequest<{
    success: boolean;
    message: string;
    issues: string[];
    provider: string;
    renderer_type: string;
    endpoint_url?: string | null;
    checked_at: string;
  }>(
    `/api/v1/admin/channels/${id}/test`,
    { method: "POST" },
    token,
  );
}

export function fetchChannelHealth(token: string) {
  return apiRequest<ChannelHealthResponse>("/api/v1/channels/health", {}, token);
}

export function fetchTemplates(token: string, filters: AdminTemplateFilter = {}) {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.channelCode) params.set("channel_code", filters.channelCode);
  if (filters.status) params.set("status", filters.status);
  if (filters.activeOnly) params.set("active_only", "true");
  const search = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<AdminTemplatesResponse>(`/api/v1/admin/templates${search}`, {}, token);
}

export function createTemplate(token: string, payload: AdminTemplatePayload) {
  return apiRequest<{ message: string; id: string }>(
    "/api/v1/admin/templates",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function updateTemplate(token: string, id: string, payload: Omit<AdminTemplatePayload, "channel_code">) {
  return apiRequest<{ message: string }>(
    `/api/v1/admin/templates/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function deleteTemplate(token: string, id: string) {
  return apiRequest<{ message: string }>(
    `/api/v1/admin/templates/${id}`,
    {
      method: "DELETE",
    },
    token,
  );
}

function historySearch(query = "") {
  return query ? `?query=${encodeURIComponent(query)}` : "";
}

function conversationHistorySearch(filters: string | AdminConversationHistoryFilter = "") {
  if (typeof filters === "string") {
    return historySearch(filters);
  }
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.fromDate) params.set("start_date", filters.fromDate);
  if (filters.toDate) params.set("end_date", filters.toDate);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("page_size", String(filters.pageSize));
  if (filters.group) params.set("group_name", filters.group);
  if (filters.bot) params.set("bot_name", filters.bot);
  if (filters.channel) params.set("channel_name", filters.channel);
  const search = params.toString();
  return search ? `?${search}` : "";
}

function queueHistorySearch(filters: string | AdminQueueHistoryFilter = "") {
  if (typeof filters === "string") {
    return historySearch(filters);
  }
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.fromDate) params.set("start_date", filters.fromDate);
  if (filters.toDate) params.set("end_date", filters.toDate);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("page_size", String(filters.pageSize));
  if (filters.group) params.set("group_name", filters.group);
  if (filters.bot) params.set("bot_name", filters.bot);
  if (filters.channel) params.set("channel_name", filters.channel);
  const search = params.toString();
  return search ? `?${search}` : "";
}

export type AdminOperationsDashboardFilters = {
  days?: number;
  hours?: number;
  group_id?: string;
  bot_id?: string;
  channel_code?: string;
  refresh?: boolean;
};

export function fetchOperationsDashboard(token: string, filters: AdminOperationsDashboardFilters = {}) {
  const params = new URLSearchParams();
  if (filters.hours) {
    params.set("hours", String(filters.hours));
  } else {
    params.set("days", String(filters.days ?? 7));
  }
  if (filters.group_id) params.set("group_id", filters.group_id);
  if (filters.bot_id) params.set("bot_id", filters.bot_id);
  if (filters.channel_code) params.set("channel_code", filters.channel_code);
  if (filters.refresh) params.set("refresh", "true");
  return apiRequest<AdminOperationsDashboardResponse>(`/api/v1/admin/operations-dashboard?${params.toString()}`, {}, token);
}

export function fetchOperationsDashboardVersionIntegrity(
  token: string,
  filters: Pick<AdminOperationsDashboardFilters, "group_id" | "bot_id"> = {},
) {
  const params = new URLSearchParams();
  if (filters.group_id) params.set("group_id", filters.group_id);
  if (filters.bot_id) params.set("bot_id", filters.bot_id);
  const query = params.toString();
  return apiRequest<AdminOperationsDashboardVersionIntegrityResponse>(
    `/api/v1/admin/operations-dashboard/version-integrity${query ? `?${query}` : ""}`,
    {},
    token,
  );
}

export async function fetchApiReadiness(): Promise<AdminApiReadinessStatus> {
  const startedAt = performance.now();
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(resolveApiPublicUrl("/health/ready"), { cache: "no-store" });
    const elapsedMs = Math.round((performance.now() - startedAt) * 100) / 100;
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    const status = typeof payload?.status === "string" ? payload.status : response.ok ? "ok" : "unavailable";
    const database = typeof payload?.database === "string" ? payload.database : response.ok ? "ok" : "unknown";
    const message = typeof payload?.message === "string"
      ? payload.message
      : response.ok
        ? "API and database are ready."
        : "API readiness check failed.";
    return {
      ok: response.ok && status === "ok" && database === "ok",
      status: response.status,
      app: status,
      database,
      message,
      elapsed_ms: elapsedMs,
      checked_at: checkedAt,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      app: "unreachable",
      database: "unknown",
      message: error instanceof TypeError
        ? "API server is unreachable."
        : "API readiness check failed.",
      elapsed_ms: null,
      checked_at: checkedAt,
    };
  }
}

export function purgeAdminCache(token: string, domain: "version_sections" | "studio_read_models" = "version_sections") {
  return apiRequest<AdminCachePurgeResponse>(
    "/api/v1/admin/cache/purge",
    {
      method: "POST",
      body: JSON.stringify({ domain }),
    },
    token,
  );
}

export function backfillVersionStorage(
  token: string,
  payload: { dry_run?: boolean; limit?: number; group_id?: string; bot_id?: string },
) {
  return apiRequest<AdminVersionStorageBackfillResponse>(
    "/api/v1/admin/version-storage/backfill",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function backfillVersionReadSnapshots(
  token: string,
  payload: { dry_run?: boolean; limit?: number; group_id?: string; bot_id?: string },
) {
  return apiRequest<AdminVersionReadSnapshotBackfillResponse>(
    "/api/v1/admin/version-read-snapshots/backfill",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function fetchTrainingHistory(token: string, query = "") {
  return apiRequest<AdminHistoryResponse<AdminTrainingHistoryItem>>(
    `/api/v1/admin/training-history${historySearch(query)}`,
    {},
    token,
  );
}

export function fetchConversationHistory(token: string, filters: string | AdminConversationHistoryFilter = "") {
  return apiRequest<AdminHistoryResponse<AdminConversationHistoryItem>>(
    `/api/v1/admin/conversations${conversationHistorySearch(filters)}`,
    {},
    token,
  );
}

export function fetchApiCallHistory(token: string, query = "") {
  return apiRequest<AdminHistoryResponse<AdminApiCallHistoryItem>>(
    `/api/v1/admin/api-call-history${historySearch(query)}`,
    {},
    token,
  );
}

export function fetchQueueHistory(token: string, filters: string | AdminQueueHistoryFilter = "") {
  return apiRequest<AdminHistoryResponse<AdminQueueHistoryItem>>(
    `/api/v1/admin/queue-history${queueHistorySearch(filters)}`,
    {},
    token,
  );
}

export function processQueueEvents(token: string, channelType?: string, limit = 10) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (channelType) params.set("channel_type", channelType);
  return apiRequest<{ processed: number; items: unknown[] }>(
    `/api/v1/admin/queue/process?${params.toString()}`,
    { method: "POST" },
    token,
  );
}

export function fetchIntentFeedback(token: string, query = "") {
  return apiRequest<AdminHistoryResponse<AdminIntentFeedbackItem>>(
    `/api/v1/admin/intent-feedback${historySearch(query)}`,
    {},
    token,
  );
}
export type AdminLicenseCurrent = {
  id: string;
  license_id: string;
  product: string;
  customer_name: string;
  issued_at: string | null;
  expires_at: string | null;
  status: string;
  features: Record<string, unknown>;
  binding: Record<string, unknown>;
  updated_at: string;
};

export type AdminLicenseUsageItem = {
  key: string;
  label: string;
  limit: number | null;
  used: number;
  remaining: number | null;
  expires_at: string | null;
};

export type AdminLicenseStatusResponse = {
  installed: boolean;
  message: string;
  license: AdminLicenseCurrent | null;
  usage: AdminLicenseUsageItem[];
};

let pendingAdminLicenseRequest: {
  token: string;
  promise: Promise<AdminLicenseStatusResponse>;
} | null = null;

export function fetchAdminLicense(token: string) {
  if (pendingAdminLicenseRequest?.token === token) {
    return pendingAdminLicenseRequest.promise;
  }

  const promise = apiRequest<AdminLicenseStatusResponse>("/api/v1/admin/license", {}, token).finally(() => {
    if (pendingAdminLicenseRequest?.promise === promise) {
      pendingAdminLicenseRequest = null;
    }
  });
  pendingAdminLicenseRequest = { token, promise };
  return promise;
}

export function applyAdminLicense(token: string, licenseText: string) {
  return apiRequest<AdminLicenseStatusResponse>(
    "/api/v1/admin/license/apply",
    {
      method: "POST",
      body: JSON.stringify({ license_text: licenseText }),
    },
    token,
  );
}
