const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const dataDir = path.resolve(process.env.CGA_DATA_DIR || path.join(root, ".cga-data"));
const assetTransferHistoryFile = path.join(dataDir, "asset-transfer-history.json");
const accessStateFile = path.join(dataDir, "access-state.json");
const authCredentialsFile = path.join(dataDir, "auth-credentials.json");
const authSessionsFile = path.join(dataDir, "auth-sessions.json");
const apiAnswerRegistryFile = path.join(dataDir, "api-answer-registry.json");
const workspaceBotsFile = path.join(dataDir, "workspace-bots.json");
const studioStateRegistryFile = path.join(dataDir, "studio-state-registry.json");
const compositionRegistryFile = path.join(dataDir, "composition-registry.json");
const detailAssetRegistryFile = path.join(dataDir, "detail-asset-registry.json");
const operationsStateRegistryFile = path.join(dataDir, "operations-state-registry.json");
const collaborationStateRegistryFile = path.join(dataDir, "collaboration-state-registry.json");
const webchatRoomsFile = path.join(dataDir, "webchat-rooms.json");
const adminResourcesFile = path.join(dataDir, "admin-resources.json");
let assetTransferHistory = loadAssetTransferHistory();
let accessState = null;
let apiAnswerRegistry = loadApiAnswerRegistry();
let workspaceBots = loadWorkspaceBots();
let studioStateRegistry = loadStudioStateRegistry();
let compositionRegistry = loadCompositionRegistry();
let detailAssetRegistry = loadDetailAssetRegistry();
let operationsStateRegistry = loadOperationsStateRegistry();
let collaborationStateRegistry = loadCollaborationStateRegistry();
let webchatRooms = loadWebchatRooms();
let adminResources = loadAdminResources();
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

function loadJsonFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath, payload) {
  ensureDataDir();
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), "utf8");
  fs.renameSync(tmpPath, filePath);
}


function createAdminId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

function createDefaultAdminResources() {
  const stamp = "2026-05-04T17:55:35.000Z";
  const templates = [
    ["tpl-basic-text", 1, "Simulator", "Simulator", "기본 메시지", 1, "text", "text", "2026-05-04T17:55:35.000Z"],
    ["tpl-html", 2, "Simulator", "Simulator", "Html", 1, "html", "html", "2026-05-04T17:55:35.000Z"],
    ["tpl-card", 3, "Simulator", "Simulator", "Card", 3, "title, imageUrl, description", "card", "2026-05-04T17:55:35.000Z"],
    ["tpl-table", 4, "Simulator", "Simulator", "Table", 1, "table", "table", "2026-05-04T17:55:35.000Z"],
    ["tpl-button", 5, "Simulator", "Simulator", "Button", 1, "button", "button", "2026-05-04T17:55:35.000Z"],
    ["tpl-link-button", 6, "Simulator", "Simulator", "Link Button", 2, "label, url", "link-button", "2026-05-04T17:55:35.000Z"],
    ["tpl-form-rich", 7, "Simulator", "Simulator", "Form(Rich)", 1, "formMessage", "form", "2026-05-04T17:55:35.000Z"],
    ["tpl-carousel", 8, "Simulator", "Simulator", "Carousel", 1, "carousel", "carousel", "2026-05-04T17:55:35.000Z"],
    ["tpl-dtmf", 9, "Simulator", "Simulator", "DTMF", 3, "shortText, stepper, stepper", "dtmf", "2026-05-04T17:55:35.000Z"],
    ["tpl-form-acard", 10, "Simulator", "Simulator", "Form(A Card)", 1, "adaptiveCard", "form-a-card", "2026-05-04T17:55:35.000Z"],
    ["tpl-webchat-basic-text", 11, "Webchat", "Webchat", "기본메시지", 1, "text", "text", "2026-05-05T23:38:00.000Z"],
    ["tpl-webchat-html", 12, "Webchat", "Webchat", "Html", 1, "html", "html", "2026-05-05T23:41:06.000Z"],
    ["tpl-webchat-card", 13, "Webchat", "Webchat", "Card", 3, "title, imageUrl, description", "card", "2026-05-05T23:40:57.000Z"],
    ["tpl-webchat-table", 14, "Webchat", "Webchat", "Table", 1, "table", "table", "2026-05-05T23:41:32.000Z"],
    ["tpl-webchat-button", 15, "Webchat", "Webchat", "Button", 1, "button", "button", "2026-05-05T23:42:15.000Z"],
    ["tpl-webchat-link-button", 16, "Webchat", "Webchat", "Link Button", 2, "label, url", "link-button", "2026-05-05T23:43:12.000Z"],
    ["tpl-webchat-form-rich", 17, "Webchat", "Webchat", "Form(Rich)", 1, "formMessage", "form", "2026-05-05T23:44:21.000Z"],
    ["tpl-webchat-carousel", 18, "Webchat", "Webchat", "Carousel", 1, "carousel", "carousel", "2026-05-05T23:45:06.000Z"],
    ["tpl-webchat-dtmf", 19, "Webchat", "Webchat", "DTMF", 3, "shortText, stepper, stepper", "dtmf", "2026-05-05T23:45:52.000Z"],
    ["tpl-webchat-form-acard", 20, "Webchat", "Webchat", "Form(A Card)", 1, "adaptiveCard", "form-a-card", "2026-05-05T23:46:28.000Z"]
  ].map(([id, order, channel_code, channel_name, name, item_count, item_types, renderer_type, updated_at]) => ({
    id, order, channel_code, channel_name, name,
    item_count, item_types, renderer_type, status: "Y", status_label: "사용",
    updated_at, updated_by: "SYSTEM", protected: true
  }));
  const common_variables = [
    ["cv-bot-hub-id", "_bot_hub_id", "봇 허브 소속일 때의 허브 ID"],
    ["cv-bot-hub-name", "_bot_hub_name", "봇 허브 소속일 때의 허브 이름"],
    ["cv-bot-id", "_bot_id", "현재 Bot ID"],
    ["cv-bot-name", "_bot_name", "현재 Bot 이름"],
    ["cv-channel-id", "_channel_id", "메신저 채널 ID"],
    ["cv-date-time", "_date_time", "현재 날짜시각"],
    ["cv-dialog-id", "_dialog_id", "현재 Dialog ID"],
    ["cv-dialog-start-time", "_dialog_start_time", "현재 대화 시작시간"],
    ["cv-id", "_id", "현재 대화 컨텍스트 ID"],
    ["cv-msg", "_msg", "마지막 사용자 발화 메시지"],
    ["cv-session-id", "_session_id", "Session ID"],
    ["cv-today", "_today", "오늘 날짜"],
    ["cv-user-id", "_user_id", "메신저에서 제공하는 사용자 ID"],
    ["cv-user-name", "_user_name", "메신저에서 제공하는 사용자 이름"],
    ["cv-semantic-answers", "_semantic_answers", "Semantic RAG 답변 후보 목록"],
    ["cv-semantic-answer-text", "_semantic_answer_text", "Semantic RAG 최상위 답변 본문"],
    ["cv-semantic-answer-score", "_semantic_answer_score", "Semantic RAG 최상위 답변 Score"],
    ["cv-semantic-answer-intent-id", "_semantic_answer_intent_id", "Semantic RAG 답변 의도 ID"],
    ["cv-semantic-answer-intent-name", "_semantic_answer_intent_name", "Semantic RAG 답변 의도명"],
    ["cv-semantic-answer-source-type", "_semantic_answer_source_type", "Semantic RAG 답변 출처 유형"],
    ["cv-semantic-answer-source-title", "_semantic_answer_source_title", "Semantic RAG 답변 출처 제목"],
    ["cv-semantic-answer-page", "_semantic_answer_page", "Semantic RAG PDF 페이지"],
    ["cv-rag-answers", "_rag_answers", "Semantic RAG 답변 후보 목록(호환)"],
    ["cv-rag-answer-text", "_rag_answer_text", "Semantic RAG 최상위 답변 본문(호환)"],
    ["cv-rag-answer-score", "_rag_answer_score", "Semantic RAG 최상위 답변 Score(호환)"],
    ["cv-rag-answer-intent-id", "_rag_answer_intent_id", "Semantic RAG 답변 의도 ID(호환)"],
    ["cv-rag-answer-intent-name", "_rag_answer_intent_name", "Semantic RAG 답변 의도명(호환)"],
    ["cv-rag-answer-source-type", "_rag_answer_source_type", "Semantic RAG 답변 출처 유형(호환)"],
    ["cv-rag-answer-source-title", "_rag_answer_source_title", "Semantic RAG 답변 출처 제목(호환)"],
    ["cv-rag-answer-page", "_rag_answer_page", "Semantic RAG PDF 페이지(호환)"],
    ["cv-llm-answers", "_llm_answers", "LLM RAG 답변 후보 목록"],
    ["cv-llm-answer-text", "_llm_answer_text", "LLM RAG 최상위 답변 본문"],
    ["cv-llm-answer-score", "_llm_answer_score", "LLM RAG 최상위 답변 Score"],
    ["cv-llm-answer-intent-id", "_llm_answer_intent_id", "LLM RAG 답변 의도 ID"],
    ["cv-llm-answer-intent-name", "_llm_answer_intent_name", "LLM RAG 답변 의도명"],
    ["cv-llm-answer-source-type", "_llm_answer_source_type", "LLM RAG 답변 출처 유형"],
    ["cv-llm-answer-source-title", "_llm_answer_source_title", "LLM RAG 답변 출처 제목"],
    ["cv-llm-answer-page", "_llm_answer_page", "LLM RAG PDF 페이지"]
  ].map(([id, name, description]) => ({ id, name, category: "시스템", value: "", description, updated_at: stamp, updated_by: "SYSTEM" }));
  const defaultMessageStamp = "2026-06-11T07:02:10.000Z";
  const default_messages = [
    ["dm-dialog-config-error", "오류", "대화 흐름 설정 오류 메시지", "dialog_flow_config_error", "대화 흐름 설정 오류로 대화를 계속할 수 없습니다.", "SYSTEM"],
    ["dm-dialog-limit-exceeded", "오류", "대화 흐름 실행 한도 초과 메시지", "dialog_flow_limit_exceeded", "대화 흐름 실행 한도를 초과했습니다.", "SYSTEM"],
    ["dm-dialog-module-link-error", "오류", "대화 모듈 연결 오류 메시지", "dialog_module_link_error", "연결할 대화 모듈을 찾지 못했습니다.", "SYSTEM"],
    ["dm-system-error", "오류", "시스템 오류 메시지", "system_error", "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요. 부탁합니다", "cyhuh"],
    ["dm-default-select-guide", "입력", "기본 선택 안내", "default_select_guide", "선택하세요.", "SYSTEM"],
    ["dm-invalid-button", "입력", "버튼 오류 메시지", "invalid_button", "선택할 수 없는 항목입니다. 다시 선택해주세요.", "SYSTEM"],
    ["dm-table-select-guide", "입력", "테이블 선택 안내", "table_select_guide", "아래 중 선택하세요.", "SYSTEM"],
    ["dm-intent-fallback", "의도", "의도 미분류 메시지", "intent_fallback", "질문을 이해하지 못했습니다. 다시 말씀해주세요.", "SYSTEM"],
    ["dm-intent-received", "의도", "의도 접수 메시지", "intent_received", "{intentName} 의도로 접수되었습니다.", "SYSTEM"],
    ["dm-multi-intent", "의도", "다중 의도 선택 안내", "multi_intent_guide", "아래 후보 중 원하는 의도를 선택해주세요.", "SYSTEM"],
    ["dm-no-desired-intent", "의도", "원하는 의도 없음 메시지", "no_desired_intent", "원하는 의도가 없습니다. 다시 말씀해주세요.", "SYSTEM"],
    ["dm-active-dialog-guide", "세션", "진행 중 대화 안내", "active_dialog_guide", "진행 중인 대화가 있습니다. 현재 대화를 먼저 완료해주세요.", "SYSTEM"],
    ["dm-session-end", "세션", "세션 종료 메시지", "session_end", "대화가 종료되었습니다.", "SYSTEM"],
    ["dm-timeout", "세션", "타임아웃 메시지", "timeout", "응답 시간이 초과되었습니다. 처음부터 다시 진행해주세요.", "SYSTEM"]
  ].map(([id, category, name, key, message, updated_by]) => ({
    id, category, name, key, language: "ko", scope: "전체", message, status: "Y", status_label: "사용",
    updated_at: defaultMessageStamp, updated_by
  }));
  const channels = [
    ["ch-sm-chat", "SM_CHAT", "Simulator", "simulator", "simulator", "none"],
    ["ch-webchat", "WEBCHAT", "Webchat", "webchat", "webchat", "none"],
    ["ch-kakao", "KAKAO", "Kakao", "kakao", "kakao", "token"],
    ["ch-teams", "TEAMS", "MS Teams", "ms_teams", "adaptive_card", "oauth"]
  ].map(([id, channel_code, channel_name, provider, renderer_type, auth_type]) => ({ id, channel_code, channel_name, provider, renderer_type, auth_type, status: "Y", status_label: "사용", updated_at: stamp, updated_by: "SYSTEM" }));
  const licenses = [
    { id: "lic-user", category: "사용자", total: 120, used: 4, remaining: 116, expires_at: "2026-12-31", status: "정상" },
    { id: "lic-bot", category: "봇", total: 30, used: 13, remaining: 17, expires_at: "2026-12-31", status: "정상" },
    { id: "lic-api", category: "API", total: 50, used: 5, remaining: 45, expires_at: "2026-12-31", status: "정상" }
  ];
  return { version: 1, templates, common_variables, default_messages, channels, botstation_links: [], licenses };
}

function mergeDefaultCollection(existing, defaults, key = "id", options = {}) {
  if (!Array.isArray(existing) || !existing.length) return defaults;
  const existingByKey = new Map(existing.filter((item) => item && item[key]).map((item) => [item[key], item]));
  const defaultKeys = new Set(defaults.map((item) => item[key]));
  const replaceSeedItems = Boolean(options.replaceSeedItems);
  const keepExtraItems = options.keepExtraItems !== false;
  const dropExtraKeys = new Set(options.dropExtraKeys || []);
  return [
    ...defaults.map((item) => {
      const existingItem = existingByKey.get(item[key]);
      if (!existingItem) return item;
      const looksLikeSeed = existingItem.protected || existingItem.updated_by === "SYSTEM" || !existingItem.updated_by;
      return replaceSeedItems && looksLikeSeed ? item : { ...item, ...existingItem };
    }),
    ...(keepExtraItems ? existing.filter((item) => item && item[key] && !defaultKeys.has(item[key]) && !dropExtraKeys.has(item[key])) : [])
  ];
}

function normalizeAdminResources(resources) {
  const defaults = createDefaultAdminResources();
  const next = resources && typeof resources === "object" ? resources : {};
  return {
    version: 1,
    templates: mergeDefaultCollection(next.templates, defaults.templates),
    common_variables: mergeDefaultCollection(next.common_variables, defaults.common_variables),
    default_messages: mergeDefaultCollection(next.default_messages, defaults.default_messages, "id", { replaceSeedItems: true, dropExtraKeys: ["dm-no-desired", "dm-runtime-flow"] }),
    channels: mergeDefaultCollection(next.channels, defaults.channels),
    botstation_links: Array.isArray(next.botstation_links) ? next.botstation_links : defaults.botstation_links,
    licenses: mergeDefaultCollection(next.licenses, defaults.licenses, "id", { replaceSeedItems: true, keepExtraItems: false })
  };
}

function loadAdminResources() {
  const resources = normalizeAdminResources(loadJsonFile(adminResourcesFile, null));
  writeJsonFile(adminResourcesFile, resources);
  return resources;
}

function saveAdminResources(resources) {
  adminResources = normalizeAdminResources(resources);
  writeJsonFile(adminResourcesFile, adminResources);
  return adminResources;
}

const PASSWORD_ITERATIONS = 120000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_DIGEST = "sha256";
const SESSION_COOKIE = "cga_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const HEADER_AUTH_FALLBACK_DISABLED = "disabled";

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return {
    algorithm: "pbkdf2-sha256",
    iterations: PASSWORD_ITERATIONS,
    digest: PASSWORD_DIGEST,
    salt,
    hash: crypto.pbkdf2Sync(String(password), salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST).toString("hex")
  };
}

function verifyPassword(password, credential) {
  if (!credential?.hash || !credential?.salt) return false;
  const expected = Buffer.from(credential.hash, "hex");
  const actual = crypto.pbkdf2Sync(
    String(password),
    credential.salt,
    credential.iterations || PASSWORD_ITERATIONS,
    expected.length,
    credential.digest || PASSWORD_DIGEST
  );
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function createSeedCredentials(state) {
  return {
    version: 1,
    note: "Seed users use their user id as the initial development password.",
    users: Object.fromEntries((state.users || []).map((user) => [user.id, hashPassword(user.id)]))
  };
}

function loadAuthCredentials(state) {
  const stored = loadJsonFile(authCredentialsFile, null);
  if (stored && typeof stored === "object" && stored.users && typeof stored.users === "object") {
    const missingUsers = (state.users || []).filter((user) => user.status !== "deleted" && !stored.users[user.id]);
    if (!missingUsers.length) return stored;
    return saveAuthCredentials({
      ...stored,
      users: {
        ...stored.users,
        ...Object.fromEntries(missingUsers.map((user) => [user.id, hashPassword(user.id)]))
      }
    });
  }
  const seeded = createSeedCredentials(state);
  writeJsonFile(authCredentialsFile, seeded);
  return seeded;
}

function saveAuthCredentials(credentials) {
  writeJsonFile(authCredentialsFile, credentials);
  return credentials;
}

function loadAuthSessions() {
  const stored = loadJsonFile(authSessionsFile, null);
  if (stored && typeof stored === "object" && stored.sessions && typeof stored.sessions === "object") return stored;
  return { version: 1, sessions: {} };
}

function saveAuthSessions(sessions) {
  writeJsonFile(authSessionsFile, sessions);
  return sessions;
}

function createSessionCookie(token, maxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000)) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function createExpiredSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function parseCookies(headerValue = "") {
  return Object.fromEntries(String(headerValue).split(";").map((part) => {
    const [name, ...rest] = part.trim().split("=");
    return [name, rest.join("=")];
  }).filter(([name]) => name));
}

function getSessionToken(req) {
  const auth = String(req.headers.authorization || "");
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  if (req.headers["x-cga-session-token"]) return String(req.headers["x-cga-session-token"]);
  return parseCookies(req.headers.cookie || "")[SESSION_COOKIE] || "";
}

function hasSessionToken(req) {
  return Boolean(getSessionToken(req));
}

function isHeaderAuthFallbackEnabled() {
  return process.env.CGA_AUTH_HEADER_FALLBACK !== HEADER_AUTH_FALLBACK_DISABLED;
}

function createAuthSession(userId) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const token = crypto.randomBytes(32).toString("hex");
  const sessions = loadAuthSessions();
  saveAuthSessions({
    ...sessions,
    sessions: {
      ...sessions.sessions,
      [token]: {
        user_id: userId,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString()
      }
    }
  });
  return { token, expiresAt: expiresAt.toISOString() };
}

function resolveSessionUserId(req, state) {
  const token = getSessionToken(req);
  if (!token) return "";
  const sessions = loadAuthSessions();
  const session = sessions.sessions?.[token];
  const activeUser = state.users?.some((user) => user.id === session?.user_id && user.status !== "deleted");
  if (!session || !activeUser || new Date(session.expires_at).getTime() <= Date.now()) {
    if (session) {
      const { [token]: _expired, ...remaining } = sessions.sessions;
      saveAuthSessions({ ...sessions, sessions: remaining });
    }
    return "";
  }
  return session.user_id;
}

function deleteAuthSession(req) {
  const token = getSessionToken(req);
  if (!token) return false;
  const sessions = loadAuthSessions();
  if (!sessions.sessions?.[token]) return false;
  const { [token]: _deleted, ...remaining } = sessions.sessions;
  saveAuthSessions({ ...sessions, sessions: remaining });
  return true;
}

function getRequestIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const raw = forwarded || req.socket?.remoteAddress || "";
  if (raw === "::1") return "127.0.0.1";
  if (raw.startsWith("::ffff:")) return raw.slice(7);
  return raw || "-";
}

function createLoginHistoryEntry(req, state, userId, sessionToken) {
  const membership = (state.memberships || []).find((item) => item.user_id === userId && item.status === "active") || null;
  const group = membership ? (state.groups || []).find((item) => item.id === membership.group_id) : null;
  const user = (state.users || []).find((item) => item.id === userId) || null;
  const now = new Date().toISOString();
  return {
    id: `lh-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    session_token: sessionToken,
    user_id: userId,
    user_name: user?.name || userId,
    group_id: membership?.group_id || "",
    group_name: group?.name || "",
    role: membership?.role || "",
    ip_address: getRequestIp(req),
    user_agent: String(req.headers["user-agent"] || ""),
    login_at: now,
    logout_at: null,
    status: "active"
  };
}

function appendLoginHistory(state, entry) {
  const history = Array.isArray(state.loginHistory) ? state.loginHistory : [];
  return { ...state, loginHistory: [entry, ...history].slice(0, 5000) };
}

function markLoginHistoryLoggedOut(state, sessionToken) {
  if (!sessionToken || !Array.isArray(state.loginHistory)) return state;
  const logoutAt = new Date().toISOString();
  let changed = false;
  const loginHistory = state.loginHistory.map((entry) => {
    if (entry.session_token !== sessionToken || entry.logout_at) return entry;
    changed = true;
    return { ...entry, logout_at: logoutAt, status: "logged_out" };
  });
  return changed ? { ...state, loginHistory } : state;
}
function loadAssetTransferHistory() {
  const history = loadJsonFile(assetTransferHistoryFile, []);
  return Array.isArray(history) ? history : [];
}

function recordAssetTransfer(entry) {
  assetTransferHistory = [...assetTransferHistory, entry];
  writeJsonFile(assetTransferHistoryFile, assetTransferHistory);
}

async function loadAccessState() {
  if (accessState) return accessState;
  const accessStateModule = await import("../packages/public-core/src/access-state.js");
  const stored = loadJsonFile(accessStateFile, null);
  const loaded = stored && typeof stored === "object" ? stored : accessStateModule.createSampleAccessState();
  const normalized = accessStateModule.normalizeAccessState(loaded);
  accessState = normalized;
  if (JSON.stringify(normalized) !== JSON.stringify(loaded)) writeJsonFile(accessStateFile, normalized);
  return accessState;
}

function saveAccessState(state) {
  accessState = state;
  writeJsonFile(accessStateFile, state);
  return state;
}

function getActorId(req, state) {
  const sessionUserId = resolveSessionUserId(req, state);
  if (sessionUserId) return sessionUserId;
  if (hasSessionToken(req)) return "";
  if (!isHeaderAuthFallbackEnabled()) return "";
  return req.headers["x-cga-user-id"] || state.currentUserId || "admin";
}

function loadApiAnswerRegistry() {
  const registry = loadJsonFile(apiAnswerRegistryFile, []);
  return Array.isArray(registry) ? registry : [];
}

function saveApiAnswerRegistry(registry) {
  apiAnswerRegistry = registry;
  writeJsonFile(apiAnswerRegistryFile, registry);
  return registry;
}

function createDefaultWorkspaceBots() {
  return [
    {
      id: "supportbot-draft",
      group_id: "g-support",
      name: "SupportBot Draft",
      version: "v0.1",
      status: "draft",
      locale: "ko",
      updated_at: "2026-06-04"
    },
    {
      id: "faqbot-v1",
      group_id: "g-support",
      name: "FAQ Bot v1",
      version: "v1.0",
      status: "ready",
      locale: "en",
      updated_at: "2026-06-03"
    },
    {
      id: "ops-assistant",
      group_id: "g-ops",
      name: "Ops Assistant",
      version: "v0.3",
      status: "operating",
      locale: "en",
      updated_at: "2026-06-02"
    }
  ];
}

function loadWorkspaceBots() {
  const bots = loadJsonFile(workspaceBotsFile, null);
  return Array.isArray(bots) ? bots : createDefaultWorkspaceBots();
}

function saveWorkspaceBots(bots) {
  workspaceBots = bots;
  writeJsonFile(workspaceBotsFile, bots);
  return bots;
}

function loadStudioStateRegistry() {
  const registry = loadJsonFile(studioStateRegistryFile, []);
  return Array.isArray(registry) ? registry : [];
}

function saveStudioStateRegistry(registry) {
  studioStateRegistry = registry;
  writeJsonFile(studioStateRegistryFile, registry);
  return registry;
}

function createDefaultStudioStateForBot(groupId, botId) {
  const bot = workspaceBots.find((item) => item.group_id === groupId && item.id === botId) || {};
  return {
    bot: {
      id: botId,
      name: bot.name || "New Bot",
      description: "",
      version: bot.version || "v0.1",
      defaultLocale: bot.locale || "en",
      selectedChannels: ["web"]
    },
    structuralChoices: {
      useLlm: false,
      compositionInput: "utterances",
      allowPdf: false,
      botServerLocation: "decide_later",
      orchestratorMode: "decide_later"
    },
    orchestrator: {
      mode: "decide_later",
      endpoint: null
    },
    llm: {
      status: "not_connected",
      provider: null,
      model: null
    },
    workflow: {
      create: "in_progress",
      configure: "not_started",
      detail: "not_started",
      build: "not_started",
      test: "not_started",
      operate: "not_started"
    },
    counts: {
      intents: 0,
      utterances: 0,
      documents: 0,
      pendingApprovals: 0
    },
    channels: {
      web: "not_configured",
      desktopMessenger: "not_configured",
      kakaoKr: (bot.locale || "en") === "ko" ? "not_configured" : "disabled"
    },
    commercialModules: {}
  };
}

function loadCompositionRegistry() {
  const registry = loadJsonFile(compositionRegistryFile, []);
  return Array.isArray(registry) ? registry : [];
}

function saveCompositionRegistry(registry) {
  compositionRegistry = registry;
  writeJsonFile(compositionRegistryFile, registry);
  return registry;
}

function loadDetailAssetRegistry() {
  const registry = loadJsonFile(detailAssetRegistryFile, []);
  return Array.isArray(registry) ? registry : [];
}

function saveDetailAssetRegistry(registry) {
  detailAssetRegistry = registry;
  writeJsonFile(detailAssetRegistryFile, registry);
  return registry;
}

function loadOperationsStateRegistry() {
  const registry = loadJsonFile(operationsStateRegistryFile, []);
  return Array.isArray(registry) ? registry : [];
}

function saveOperationsStateRegistry(registry) {
  operationsStateRegistry = registry;
  writeJsonFile(operationsStateRegistryFile, registry);
  return registry;
}

function loadCollaborationStateRegistry() {
  const registry = loadJsonFile(collaborationStateRegistryFile, []);
  return Array.isArray(registry) ? registry : [];
}

function saveCollaborationStateRegistry(registry) {
  collaborationStateRegistry = registry;
  writeJsonFile(collaborationStateRegistryFile, registry);
  return registry;
}

function loadWebchatRooms() {
  const rooms = loadJsonFile(webchatRoomsFile, []);
  return Array.isArray(rooms) ? rooms : [];
}

function saveWebchatRooms(rooms) {
  webchatRooms = rooms;
  writeJsonFile(webchatRoomsFile, rooms);
  return rooms;
}

function createDefaultCompositionForBot(groupId, botId) {
  return {
    group_id: groupId,
    bot_id: botId,
    input_mode: "utterances",
    utterances: [
      "How do I reset my password?",
      "I forgot my login password.",
      "Where can I change my email?",
      "How do I cancel my plan?"
    ],
    requested_intent_count: 2,
    pdf: null,
    intent_candidates: [
      { intent: "password_reset", utterance_count: 6, status: "answer_required" },
      { intent: "account_update", utterance_count: 4, status: "ready" }
    ],
    updated_at: null
  };
}

function createDefaultDetailAssetsForBot(groupId, botId) {
  return {
    group_id: groupId,
    bot_id: botId,
    intent_utterances: [
      { utterance: "I need to reset my password", division: "password_reset" },
      { utterance: "How do I update my account?", division: "account_update" },
      { utterance: "I have a billing question", division: "billing_question" }
    ],
    entities: [
      { name: "email", value: "email", rowType: "P", detail: "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b" },
      { name: "channel", value: "web", rowType: "S", detail: "webchat" }
    ],
    dictionary: [
      { word: "password", synonyms: ["login password", "account password"] },
      { word: "plan", synonyms: ["subscription", "membership"] }
    ],
    rules: [
      { name: "Business hours", description: "Route after-hours questions", expression: "time.after(18:00)", target: "support_after_hours", enabled: "Y" },
      { name: "Billing priority", description: "Route billing requests", expression: "intent == billing_question", target: "billing_question", enabled: "Y" }
    ],
    scenarios: [
      { id: "password_reset", type: "intent", displayName: "password_reset", answer: "Open Account Settings and choose Reset Password.", dialogCards: ["Open Account Settings and choose Reset Password."] },
      { id: "account_update", type: "intent", displayName: "account_update", answer: "Open Profile Settings and update your account information.", dialogCards: ["Open Profile Settings and update your account information."] }
    ],
    updated_at: null
  };
}

function createDefaultOperationsStateForBot(groupId, botId) {
  return {
    group_id: groupId,
    bot_id: botId,
    build: {
      status: "ready",
      bot_info: "complete",
      intent_count: 12,
      llm_status: "needed_for_pdf",
      webchat_contract: "unchanged",
      last_run_at: null
    },
    test: {
      last_user_message: "I forgot my password.",
      last_bot_message: "Open Account Settings and choose Reset Password.",
      matched_intent: "password_reset",
      method: "LLM intent classification",
      similarity: 0.94,
      latency_ms: 14,
      last_run_at: null
    },
    operate: {
      deployment_status: "draft",
      channel_status: "web_ok",
      channel_detail: "desktop_kakao_pending",
      conversation_volume: 1284,
      volume_status: "normal",
      undefined_intents: 1,
      container_health: "healthy",
      llm_cost_status: "below_threshold",
      compatibility: "preserved",
      last_deployed_at: null
    },
    updated_at: null
  };
}

async function createDefaultCollaborationStateForBot(groupId, botId) {
  const collaborationStateModule = await import("../packages/public-core/src/collaboration-state.js");
  return {
    ...collaborationStateModule.createSampleCollaborationState(),
    group_id: groupId,
    bot_id: botId,
    updated_at: null
  };
}

function sanitizePathSegment(value, fallback) {
  const text = String(value || fallback)
    .trim()
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/_+/g, "_");
  return text || fallback;
}

function getAssetBodyFilePath({ groupId, botId, scope, fileFormat }) {
  return path.join(
    dataDir,
    "assets",
    sanitizePathSegment(groupId, "group"),
    sanitizePathSegment(botId, "bot"),
    `${sanitizePathSegment(scope, "asset")}.${fileFormat}`
  );
}

function storeAssetBody({ groupId, botId, scope, fileFormat, body }) {
  const filePath = getAssetBodyFilePath({ groupId, botId, scope, fileFormat });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body, "utf8");
  return path.relative(dataDir, filePath).replace(/\\/g, "/");
}

function readStoredAssetBody({ groupId, botId, scope, fileFormat }) {
  const filePath = getAssetBodyFilePath({ groupId, botId, scope, fileFormat });
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(payload, null, 2));
}

function getWebchatCorsHeaders(req) {
  const origin = String(req.headers.origin || "");
  const allowedOrigins = new Set([
    "http://localhost:3330",
    "http://127.0.0.1:3330",
    ...(process.env.CGA_WEBCHAT_ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean)
  ]);
  if (!allowedOrigins.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Aidot-Webchat-Key",
    "Vary": "Origin"
  };
}

function sendAidotSuccess(req, res, data) {
  sendJson(res, 200, {
    data,
    meta: {
      path: (req.url || "/").split("?")[0],
      timestamp: new Date().toISOString()
    }
  }, getWebchatCorsHeaders(req));
}

function sendDownload(res, fileName, body, type) {
  res.writeHead(200, {
    "Content-Type": type,
    "Content-Disposition": `attachment; filename="${fileName}"`
  });
  res.end(body);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJsonRequest(req) {
  const body = await readRequestBody(req);
  if (!body.trim()) return {};
  return JSON.parse(body);
}

function parseAssetTransferPath(urlPath) {
  const match = urlPath.match(/^\/api\/cga\/groups\/([^/]+)\/bots\/([^/]+)\/(?:(?:assets\/([^/]+)\/(export|import|manifest))|asset-transfers)$/);
  if (!match) return null;
  return {
    groupId: match[1],
    botId: match[2],
    scope: match[3] || null,
    action: match[4] || "history"
  };
}

function parseWebchatChannelPath(urlPath) {
  if (urlPath === "/api/v1/channels/webchat/connect") return { action: "connect" };
  if (urlPath === "/api/v1/channels/webchat/bots") return { action: "bots" };
  if (urlPath === "/api/v1/channels/webchat/rooms") return { action: "rooms" };
  const roomDetail = urlPath.match(/^\/api\/v1\/channels\/webchat\/rooms\/([^/]+)$/);
  if (roomDetail) return { action: "roomDetail", roomId: roomDetail[1] };
  const roomMessage = urlPath.match(/^\/api\/v1\/channels\/webchat\/rooms\/([^/]+)\/messages$/);
  if (roomMessage) return { action: "roomMessage", roomId: roomMessage[1] };
  const legacyRoomMessage = urlPath.match(/^\/api\/v1\/webchat\/bots\/([^/]+)\/rooms\/([^/]+)\/messages$/);
  if (legacyRoomMessage) return { action: "legacyRoomMessage", botSlug: legacyRoomMessage[1], roomId: legacyRoomMessage[2] };
  if (urlPath === "/api/v1/webchat/bootstrap") return { action: "legacyBootstrap" };
  return null;
}


function parseAdminResourcePath(urlPath) {
  if (urlPath === "/api/cga/admin/resources") return { resource: "all" };
  const collectionMatch = urlPath.match(/^\/api\/cga\/admin\/(templates|common-variables|default-messages|channels|botstation-links)$/);
  if (collectionMatch) return { resource: collectionMatch[1] };
  const itemMatch = urlPath.match(/^\/api\/cga\/admin\/(templates|common-variables|default-messages|channels|botstation-links)\/([^/]+)$/);
  if (itemMatch) return { resource: itemMatch[1], id: itemMatch[2] };
  return null;
}

function parseAuthApiPath(urlPath) {
  if (urlPath === "/api/cga/auth/signup") return { action: "signup" };
  if (urlPath === "/api/cga/auth/login") return { action: "login" };
  if (urlPath === "/api/cga/auth/logout") return { action: "logout" };
  if (urlPath === "/api/cga/auth/me") return { action: "me" };
  if (urlPath === "/api/cga/groups") return { action: "groups" };
  const membershipRole = urlPath.match(/^\/api\/cga\/groups\/([^/]+)\/members\/([^/]+)\/role$/);
  if (membershipRole) return { action: "membershipRole", groupId: membershipRole[1], userId: membershipRole[2] };
  if (urlPath === "/api/cga/groups/join-requests") return { action: "joinRequests" };
  const joinApprove = urlPath.match(/^\/api\/cga\/groups\/join-requests\/([^/]+)\/approve$/);
  if (joinApprove) return { action: "approveJoinRequest", requestId: joinApprove[1] };
  if (urlPath === "/api/cga/admin/permission-requests") return { action: "adminPermissionRequests" };
  const adminApprove = urlPath.match(/^\/api\/cga\/admin\/permission-requests\/([^/]+)\/approve$/);
  if (adminApprove) return { action: "approveAdminPermissionRequest", requestId: adminApprove[1] };
  return null;
}

function parseApiAnswerPath(urlPath) {
  const match = urlPath.match(/^\/api\/cga\/groups\/([^/]+)\/bots\/([^/]+)\/api-answers$/);
  if (!match) return null;
  return {
    groupId: match[1],
    botId: match[2]
  };
}

function parseWorkspaceBotPath(urlPath) {
  const itemMatch = urlPath.match(/^\/api\/cga\/groups\/([^/]+)\/bots\/([^/]+)$/);
  if (itemMatch) {
    return {
      groupId: itemMatch[1],
      botId: itemMatch[2]
    };
  }
  const match = urlPath.match(/^\/api\/cga\/groups\/([^/]+)\/bots$/);
  if (!match) return null;
  return {
    groupId: match[1],
    botId: null
  };
}

function parseStudioStatePath(urlPath) {
  const match = urlPath.match(/^\/api\/cga\/groups\/([^/]+)\/bots\/([^/]+)\/studio-state$/);
  if (!match) return null;
  return {
    groupId: match[1],
    botId: match[2]
  };
}

function parseCompositionPath(urlPath) {
  const match = urlPath.match(/^\/api\/cga\/groups\/([^/]+)\/bots\/([^/]+)\/composition$/);
  if (!match) return null;
  return {
    groupId: match[1],
    botId: match[2]
  };
}

function parseDetailAssetPath(urlPath) {
  const match = urlPath.match(/^\/api\/cga\/groups\/([^/]+)\/bots\/([^/]+)\/detail-assets$/);
  if (!match) return null;
  return {
    groupId: match[1],
    botId: match[2]
  };
}

function parseOperationsStatePath(urlPath) {
  const match = urlPath.match(/^\/api\/cga\/groups\/([^/]+)\/bots\/([^/]+)\/operations-state(?:\/([^/]+))?$/);
  if (!match) return null;
  return {
    groupId: match[1],
    botId: match[2],
    action: match[3] || null
  };
}

function parseCollaborationStatePath(urlPath) {
  const match = urlPath.match(/^\/api\/cga\/groups\/([^/]+)\/bots\/([^/]+)\/collaboration-state(?:\/work-items\/([^/]+)\/([^/]+))?$/);
  if (!match) return null;
  return {
    groupId: match[1],
    botId: match[2],
    workItemId: match[3] || null,
    action: match[4] || null
  };
}

async function canCreateWorkspaceBot(req, groupId, botId = "supportbot-draft") {
  const accessStateModule = await import("../packages/public-core/src/access-state.js");
  const state = await loadAccessState();
  const actorId = getActorId(req, state);
  return accessStateModule.getEffectiveGroupScopes(state, actorId, groupId, botId).includes("bot.create");
}

async function canConfigureWorkspaceBot(req, groupId, botId) {
  const accessStateModule = await import("../packages/public-core/src/access-state.js");
  const state = await loadAccessState();
  const actorId = getActorId(req, state);
  return accessStateModule.getEffectiveGroupScopes(state, actorId, groupId, botId).includes("bot.configure");
}

async function hasBotScope(req, groupId, botId, scope) {
  const accessStateModule = await import("../packages/public-core/src/access-state.js");
  const state = await loadAccessState();
  const actorId = getActorId(req, state);
  return accessStateModule.getEffectiveGroupScopes(state, actorId, groupId, botId).includes(scope);
}

async function handleWorkspaceBotApi(req, res, urlPath) {
  const parsed = parseWorkspaceBotPath(urlPath);
  if (!parsed) return false;
  const { groupId } = parsed;

  if (req.method === "GET") {
    if (parsed.botId) {
      const bot = workspaceBots.find((item) => item.group_id === groupId && item.id === parsed.botId && item.status !== "deleted");
      if (!bot) {
        sendJson(res, 404, { error_code: "CGA_BOT_NOT_FOUND", message_key: "errors.bot.notFound" });
        return true;
      }
      sendJson(res, 200, bot);
      return true;
    }
    sendJson(res, 200, {
      group_id: groupId,
      items: workspaceBots.filter((bot) => bot.group_id === groupId && bot.status !== "deleted")
    });
    return true;
  }

  if (parsed.botId && req.method === "PUT") {
    if (!(await canConfigureWorkspaceBot(req, groupId, parsed.botId))) {
      sendJson(res, 403, { error_code: "CGA_BOT_CONFIGURE_FORBIDDEN", message_key: "errors.bot.configureForbidden" });
      return true;
    }
    const body = await readJsonRequest(req);
    const index = workspaceBots.findIndex((bot) => bot.group_id === groupId && bot.id === parsed.botId && bot.status !== "deleted");
    if (index === -1) {
      sendJson(res, 404, { error_code: "CGA_BOT_NOT_FOUND", message_key: "errors.bot.notFound" });
      return true;
    }
    const updated = {
      ...workspaceBots[index],
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : workspaceBots[index].name,
      version: typeof body.version === "string" && body.version.trim() ? body.version.trim() : workspaceBots[index].version,
      status: typeof body.status === "string" && body.status.trim() ? body.status.trim() : workspaceBots[index].status,
      locale: typeof body.locale === "string" && body.locale.trim() ? body.locale.trim() : workspaceBots[index].locale,
      updated_at: new Date().toISOString().slice(0, 10),
      updated_by: typeof body.updated_by === "string" && body.updated_by.trim() ? body.updated_by.trim() : getActorId(req, await loadAccessState())
    };
    saveWorkspaceBots(workspaceBots.map((bot, botIndex) => botIndex === index ? updated : bot));
    sendJson(res, 200, updated);
    return true;
  }

  if (parsed.botId && req.method === "DELETE") {
    if (!(await canConfigureWorkspaceBot(req, groupId, parsed.botId))) {
      sendJson(res, 403, { error_code: "CGA_BOT_CONFIGURE_FORBIDDEN", message_key: "errors.bot.configureForbidden" });
      return true;
    }
    const index = workspaceBots.findIndex((bot) => bot.group_id === groupId && bot.id === parsed.botId && bot.status !== "deleted");
    if (index === -1) {
      sendJson(res, 404, { error_code: "CGA_BOT_NOT_FOUND", message_key: "errors.bot.notFound" });
      return true;
    }
    const updated = {
      ...workspaceBots[index],
      status: "deleted",
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString().slice(0, 10),
      updated_by: getActorId(req, await loadAccessState())
    };
    saveWorkspaceBots(workspaceBots.map((bot, botIndex) => botIndex === index ? updated : bot));
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST") {
    const body = await readJsonRequest(req);
    const id = sanitizePathSegment(body.id || `bot-${Date.now()}`, "bot");
    if (!(await canCreateWorkspaceBot(req, groupId, id))) {
      sendJson(res, 403, { error_code: "CGA_BOT_CREATE_FORBIDDEN", message_key: "errors.bot.createForbidden" });
      return true;
    }
    if (workspaceBots.some((bot) => bot.group_id === groupId && bot.id === id)) {
      sendJson(res, 409, { error_code: "CGA_BOT_ALREADY_EXISTS", message_key: "errors.bot.exists" });
      return true;
    }
    const bot = {
      id,
      group_id: groupId,
      name: body.name || "New Bot",
      version: body.version || "v0.1",
      status: body.status || "draft",
      locale: body.locale || "en",
      updated_at: new Date().toISOString().slice(0, 10)
    };
    saveWorkspaceBots([...workspaceBots, bot]);
    sendJson(res, 201, { status: "created", bot });
    return true;
  }

  sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
  return true;
}

async function handleStudioStateApi(req, res, urlPath) {
  const parsed = parseStudioStatePath(urlPath);
  if (!parsed) return false;
  const { groupId, botId } = parsed;

  if (req.method === "GET") {
    const saved = studioStateRegistry.find((item) => item.group_id === groupId && item.bot_id === botId);
    sendJson(res, 200, {
      group_id: groupId,
      bot_id: botId,
      state: saved?.state || createDefaultStudioStateForBot(groupId, botId),
      updated_at: saved?.updated_at || null
    });
    return true;
  }

  if (req.method === "PUT") {
    if (!(await canConfigureWorkspaceBot(req, groupId, botId))) {
      sendJson(res, 403, { error_code: "CGA_BOT_CONFIGURE_FORBIDDEN", message_key: "errors.bot.configureForbidden" });
      return true;
    }
    const body = await readJsonRequest(req);
    const state = body.state && typeof body.state === "object" ? body.state : body;
    const botState = state.bot || {};
    const updatedAt = new Date().toISOString();
    const entry = {
      group_id: groupId,
      bot_id: botId,
      state: {
        ...state,
        bot: {
          ...botState,
          id: botId
        }
      },
      updated_at: updatedAt
    };
    saveStudioStateRegistry([
      ...studioStateRegistry.filter((item) => !(item.group_id === groupId && item.bot_id === botId)),
      entry
    ]);
    saveWorkspaceBots(workspaceBots.map((bot) => {
      if (bot.group_id !== groupId || bot.id !== botId) return bot;
      return {
        ...bot,
        name: botState.name || bot.name,
        version: botState.version || bot.version,
        locale: botState.defaultLocale || bot.locale,
        updated_at: updatedAt.slice(0, 10)
      };
    }));
    sendJson(res, 200, { status: "saved", group_id: groupId, bot_id: botId, state: entry.state, updated_at: updatedAt });
    return true;
  }

  sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
  return true;
}

async function handleCompositionApi(req, res, urlPath) {
  const parsed = parseCompositionPath(urlPath);
  if (!parsed) return false;
  const { groupId, botId } = parsed;

  if (req.method === "GET") {
    const saved = compositionRegistry.find((item) => item.group_id === groupId && item.bot_id === botId);
    sendJson(res, 200, saved || createDefaultCompositionForBot(groupId, botId));
    return true;
  }

  if (req.method === "PUT") {
    if (!(await canConfigureWorkspaceBot(req, groupId, botId))) {
      sendJson(res, 403, { error_code: "CGA_BOT_CONFIGURE_FORBIDDEN", message_key: "errors.bot.configureForbidden" });
      return true;
    }
    const body = await readJsonRequest(req);
    const next = {
      ...createDefaultCompositionForBot(groupId, botId),
      ...body,
      group_id: groupId,
      bot_id: botId,
      utterances: Array.isArray(body.utterances) ? body.utterances.map((item) => String(item)).filter(Boolean) : [],
      requested_intent_count: Number(body.requested_intent_count || body.requestedIntentCount || 0),
      intent_candidates: Array.isArray(body.intent_candidates) ? body.intent_candidates : [],
      updated_at: new Date().toISOString()
    };
    saveCompositionRegistry([
      ...compositionRegistry.filter((item) => !(item.group_id === groupId && item.bot_id === botId)),
      next
    ]);
    sendJson(res, 200, { status: "saved", composition: next });
    return true;
  }

  sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
  return true;
}

async function handleDetailAssetApi(req, res, urlPath) {
  const parsed = parseDetailAssetPath(urlPath);
  if (!parsed) return false;
  const { groupId, botId } = parsed;

  if (req.method === "GET") {
    const saved = detailAssetRegistry.find((item) => item.group_id === groupId && item.bot_id === botId);
    sendJson(res, 200, saved || createDefaultDetailAssetsForBot(groupId, botId));
    return true;
  }

  if (req.method === "PUT") {
    if (!(await canConfigureWorkspaceBot(req, groupId, botId))) {
      sendJson(res, 403, { error_code: "CGA_DETAIL_ASSET_CONFIGURE_FORBIDDEN", message_key: "errors.bot.configureForbidden" });
      return true;
    }
    const body = await readJsonRequest(req);
    const next = {
      ...createDefaultDetailAssetsForBot(groupId, botId),
      ...body,
      group_id: groupId,
      bot_id: botId,
      intent_utterances: Array.isArray(body.intent_utterances) ? body.intent_utterances : [],
      entities: Array.isArray(body.entities) ? body.entities : [],
      dictionary: Array.isArray(body.dictionary) ? body.dictionary : [],
      rules: Array.isArray(body.rules) ? body.rules : [],
      scenarios: Array.isArray(body.scenarios) ? body.scenarios : [],
      updated_at: new Date().toISOString()
    };
    saveDetailAssetRegistry([
      ...detailAssetRegistry.filter((item) => !(item.group_id === groupId && item.bot_id === botId)),
      next
    ]);
    sendJson(res, 200, { status: "saved", detail_assets: next });
    return true;
  }

  sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
  return true;
}

async function handleOperationsStateApi(req, res, urlPath) {
  const parsed = parseOperationsStatePath(urlPath);
  if (!parsed) return false;
  const { groupId, botId, action } = parsed;
  const accessContract = await import("../packages/contracts/src/access-contract.js");
  const saved = operationsStateRegistry.find((item) => item.group_id === groupId && item.bot_id === botId);
  const baseState = saved || createDefaultOperationsStateForBot(groupId, botId);

  if (!action && req.method === "GET") {
    sendJson(res, 200, baseState);
    return true;
  }

  if (!action && req.method === "PUT") {
    if (!(await hasBotScope(req, groupId, botId, accessContract.ACCESS_SCOPES.BOT_OPERATE))) {
      sendJson(res, 403, { error_code: "CGA_OPERATIONS_STATE_FORBIDDEN", message_key: "errors.bot.operateForbidden" });
      return true;
    }
    const body = await readJsonRequest(req);
    const next = {
      ...baseState,
      ...body,
      group_id: groupId,
      bot_id: botId,
      updated_at: new Date().toISOString()
    };
    saveOperationsStateRegistry([
      ...operationsStateRegistry.filter((item) => !(item.group_id === groupId && item.bot_id === botId)),
      next
    ]);
    sendJson(res, 200, { status: "saved", operations_state: next });
    return true;
  }

  if (req.method === "POST" && action) {
    const now = new Date().toISOString();
    const body = await readJsonRequest(req);
    let requiredScope = accessContract.ACCESS_SCOPES.BOT_OPERATE;
    let next = { ...baseState, updated_at: now };

    if (action === "run-build") {
      requiredScope = accessContract.ACCESS_SCOPES.BOT_CONFIGURE;
      next = {
        ...next,
        build: {
          ...baseState.build,
          status: "built",
          intent_count: Number(body.intent_count || baseState.build.intent_count || 0),
          last_run_at: now
        }
      };
    } else if (action === "run-test") {
      requiredScope = accessContract.ACCESS_SCOPES.BOT_REVIEW;
      const message = String(body.message || baseState.test.last_user_message || "I forgot my password.");
      next = {
        ...next,
        test: {
          ...baseState.test,
          last_user_message: message,
          last_bot_message: message.toLowerCase().includes("password")
            ? "Open Account Settings and choose Reset Password."
            : "This simulator preview uses the Aidot-compatible runtime contract.",
          matched_intent: message.toLowerCase().includes("password") ? "password_reset" : "fallback_preview",
          method: "Aidot-compatible simulator preview",
          similarity: message.toLowerCase().includes("password") ? 0.94 : 0.62,
          latency_ms: 14,
          last_run_at: now
        }
      };
    } else if (action === "deploy") {
      requiredScope = accessContract.ACCESS_SCOPES.BOT_DEPLOY;
      next = {
        ...next,
        operate: {
          ...baseState.operate,
          deployment_status: "deployed",
          channel_status: "web_ok",
          compatibility: "preserved",
          last_deployed_at: now
        }
      };
    } else if (action === "refresh-operate") {
      requiredScope = accessContract.ACCESS_SCOPES.BOT_OPERATE;
      next = {
        ...next,
        operate: {
          ...baseState.operate,
          conversation_volume: Number(baseState.operate.conversation_volume || 0) + 1,
          volume_status: "normal",
          container_health: "healthy",
          llm_cost_status: "below_threshold"
        }
      };
    } else {
      sendJson(res, 404, { error_code: "CGA_OPERATIONS_ACTION_NOT_FOUND", message_key: "errors.operations.actionNotFound", action });
      return true;
    }

    if (!(await hasBotScope(req, groupId, botId, requiredScope))) {
      sendJson(res, 403, { error_code: "CGA_OPERATIONS_ACTION_FORBIDDEN", message_key: "errors.operations.actionForbidden", required_scope: requiredScope });
      return true;
    }

    saveOperationsStateRegistry([
      ...operationsStateRegistry.filter((item) => !(item.group_id === groupId && item.bot_id === botId)),
      next
    ]);
    sendJson(res, 200, { status: "saved", action, operations_state: next });
    return true;
  }

  sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
  return true;
}

async function handleCollaborationStateApi(req, res, urlPath) {
  const parsed = parseCollaborationStatePath(urlPath);
  if (!parsed) return false;
  const { groupId, botId, workItemId, action } = parsed;
  const accessContract = await import("../packages/contracts/src/access-contract.js");
  const collaborationStateModule = await import("../packages/public-core/src/collaboration-state.js");
  const saved = collaborationStateRegistry.find((item) => item.group_id === groupId && item.bot_id === botId);
  const baseState = saved || await createDefaultCollaborationStateForBot(groupId, botId);

  if (!action && req.method === "GET") {
    if (!(await hasBotScope(req, groupId, botId, accessContract.ACCESS_SCOPES.BOT_VIEW))) {
      sendJson(res, 403, { error_code: "CGA_COLLABORATION_VIEW_FORBIDDEN", message_key: "errors.bot.viewForbidden" });
      return true;
    }
    sendJson(res, 200, baseState);
    return true;
  }

  if (req.method === "POST" && workItemId && action) {
    const actorId = getActorId(req, await loadAccessState());
    const now = new Date().toISOString();
    let requiredScope = accessContract.ACCESS_SCOPES.BOT_CONFIGURE;
    let next = baseState;

    if (action === "lock") {
      next = collaborationStateModule.lockWorkItem(baseState, {
        workItemId,
        userId: actorId,
        lockedAt: now,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      });
    } else if (action === "unlock") {
      next = collaborationStateModule.releaseWorkItemLock(baseState, { workItemId, userId: actorId, releasedAt: now });
    } else if (action === "approve") {
      requiredScope = accessContract.ACCESS_SCOPES.BOT_REVIEW;
      next = collaborationStateModule.submitReviewDecision(baseState, {
        workItemId,
        reviewerId: actorId,
        decision: "approve",
        decidedAt: now
      });
    } else if (action === "request-changes" || action === "move-to-todo") {
      requiredScope = accessContract.ACCESS_SCOPES.BOT_REVIEW;
      next = collaborationStateModule.submitReviewDecision(baseState, {
        workItemId,
        reviewerId: actorId,
        decision: "request_changes",
        decidedAt: now
      });
    } else {
      sendJson(res, 404, { error_code: "CGA_COLLABORATION_ACTION_NOT_FOUND", message_key: "errors.collaboration.actionNotFound", action });
      return true;
    }

    if (!(await hasBotScope(req, groupId, botId, requiredScope))) {
      sendJson(res, 403, { error_code: "CGA_COLLABORATION_ACTION_FORBIDDEN", message_key: "errors.collaboration.actionForbidden", required_scope: requiredScope });
      return true;
    }

    const scopedNext = { ...next, group_id: groupId, bot_id: botId, updated_at: now };
    saveCollaborationStateRegistry([
      ...collaborationStateRegistry.filter((item) => !(item.group_id === groupId && item.bot_id === botId)),
      scopedNext
    ]);
    sendJson(res, 200, { status: "saved", action, collaboration_state: scopedNext });
    return true;
  }

  sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
  return true;
}

async function canManageApiAnswer(req, groupId, botId) {
  const accessStateModule = await import("../packages/public-core/src/access-state.js");
  const state = await loadAccessState();
  const actorId = getActorId(req, state);
  return accessStateModule.getEffectiveGroupScopes(state, actorId, groupId, botId).includes("apiAnswer.manage");
}

async function handleApiAnswerApi(req, res, urlPath) {
  const parsed = parseApiAnswerPath(urlPath);
  if (!parsed) return false;
  const { groupId, botId } = parsed;
  const items = apiAnswerRegistry.filter((item) => item.group_id === groupId && item.bot_id === botId);

  if (req.method === "GET") {
    sendJson(res, 200, { group_id: groupId, bot_id: botId, items });
    return true;
  }

  if (req.method === "POST") {
    if (!(await canManageApiAnswer(req, groupId, botId))) {
      sendJson(res, 403, { error_code: "CGA_API_ANSWER_MANAGE_FORBIDDEN", message_key: "errors.apiAnswer.manageForbidden" });
      return true;
    }
    const contract = await import("../packages/contracts/src/api-answer-contract.js");
    const body = await readJsonRequest(req);
    const draft = contract.createGroupManagedApiAnswerDraft({ groupId, botId });
    const entry = {
      ...draft,
      id: body.id || `api-${Date.now()}`,
      name: body.name || "",
      endpoint_url: body.endpoint_url || body.endpoint || "",
      method: body.method || "GET",
      auth_type: body.auth_type || "none",
      secret_ref: body.secret_ref || "",
      response_path: body.response_path || body.response_mapping?.answer_text_path || "data.answer",
      response_mapping: {
        ...draft.response_mapping,
        ...(body.response_mapping || {}),
        answer_text_path: body.response_path || body.response_mapping?.answer_text_path || "data.answer"
      },
      updated_at: new Date().toISOString()
    };
    if (!entry.name || !entry.endpoint_url) {
      sendJson(res, 400, { error_code: "CGA_API_ANSWER_REQUIRED_FIELD_MISSING", message_key: "errors.apiAnswer.requiredField" });
      return true;
    }
    const next = [
      ...apiAnswerRegistry.filter((item) => !(item.group_id === groupId && item.bot_id === botId && item.name === entry.name)),
      entry
    ];
    saveApiAnswerRegistry(next);
    sendJson(res, 201, { status: "created", item: entry });
    return true;
  }

  sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
  return true;
}

async function createAccessSessionResponse(state, userId = state.currentUserId, session = null) {
  const authContract = await import("../packages/contracts/src/auth-api-contract.js");
  const user = state.users.find((item) => item.id === userId) || null;
  const memberships = state.memberships.filter((item) => item.user_id === userId && item.status === "active");
  const groups = state.groups.filter((group) => memberships.some((membership) => membership.group_id === group.id));
  return authContract.createAuthSessionResponse({
    user,
    memberships,
    groups,
    locale: user?.locale,
    sessionToken: session?.token || null,
    expiresAt: session?.expiresAt || null
  });
}

async function handleAuthApi(req, res, urlPath) {
  const parsed = parseAuthApiPath(urlPath);
  if (!parsed) return false;
  const accessStateModule = await import("../packages/public-core/src/access-state.js");
  const accessContract = await import("../packages/contracts/src/access-contract.js");
  const state = await loadAccessState();
  const sessionWasProvided = hasSessionToken(req);
  const sessionUserId = resolveSessionUserId(req, state);
  if (sessionWasProvided && !sessionUserId && !["login", "signup", "logout"].includes(parsed.action)) {
    sendJson(res, 401, { error_code: "CGA_SESSION_EXPIRED", message_key: "errors.auth.sessionExpired" }, { "Set-Cookie": createExpiredSessionCookie() });
    return true;
  }
  if (!sessionUserId && !isHeaderAuthFallbackEnabled() && !["login", "signup", "logout"].includes(parsed.action)) {
    sendJson(res, 401, { error_code: "CGA_AUTH_REQUIRED", message_key: "errors.auth.required" });
    return true;
  }
  const actorId = sessionUserId || (isHeaderAuthFallbackEnabled() ? (req.headers["x-cga-user-id"] || state.currentUserId || "admin") : "");

  if (parsed.action === "me") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
      return true;
    }
    sendJson(res, 200, await createAccessSessionResponse(state, actorId));
    return true;
  }

  if (parsed.action === "groups") {
    if (req.method === "GET") {
      sendJson(res, 200, {
        current_user_id: actorId,
        users: state.users,
        groups: state.groups,
        memberships: state.memberships.filter((item) => item.status === "active"),
        group_bot_access: state.groupBotAccess,
        user_overrides: state.userOverrides,
        join_requests: state.joinRequests,
        admin_requests: state.adminRequests,
        login_history: Array.isArray(state.loginHistory) ? state.loginHistory : [],
        policy: state.policy,
        bot_id: state.botId
      });
      return true;
    }
    if (req.method === "POST") {
      const body = await readJsonRequest(req);
      if (!(body.group_id || body.id) || !body.name) {
        sendJson(res, 400, { error_code: "CGA_GROUP_REQUIRED_FIELD_MISSING", message_key: "errors.auth.groupRequired" });
        return true;
      }
      const next = accessStateModule.createManagedGroup(state, {
        id: body.group_id || body.id,
        name: body.name,
        actorId
      });
      if (next === state) {
        sendJson(res, 403, { error_code: "CGA_GROUP_CREATE_FORBIDDEN", message_key: "errors.auth.groupCreateForbidden" });
        return true;
      }
      saveAccessState(next);
      sendJson(res, 201, { status: "created", group: next.groups.find((group) => group.id === (body.group_id || body.id)) });
      return true;
    }
    sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
    return true;
  }

  if (parsed.action === "membershipRole") {
    if (req.method !== "PATCH") {
      sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
      return true;
    }
    const body = await readJsonRequest(req);
    const next = accessStateModule.updateGroupMembershipRole(state, {
      actorId,
      userId: parsed.userId,
      groupId: parsed.groupId,
      role: body.role || body.requested_role
    });
    if (next === state) {
      sendJson(res, 403, { error_code: "CGA_MEMBERSHIP_ROLE_UPDATE_FORBIDDEN", message_key: "errors.auth.roleUpdateForbidden" });
      return true;
    }
    saveAccessState(next);
    sendJson(res, 200, {
      status: "updated",
      membership: next.memberships.find((item) => item.user_id === parsed.userId && item.group_id === parsed.groupId && item.status === "active")
    });
    return true;
  }

  if (parsed.action === "signup") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
      return true;
    }
    const body = await readJsonRequest(req);
    if (!body.user_id || !body.name || !body.password) {
      sendJson(res, 400, { error_code: "CGA_SIGNUP_REQUIRED_FIELD_MISSING", message_key: "errors.auth.signupRequired" });
      return true;
    }
    if (state.users.some((user) => user.id === body.user_id)) {
      sendJson(res, 409, { error_code: "CGA_USER_ALREADY_EXISTS", message_key: "errors.auth.userExists" });
      return true;
    }
    const credentials = loadAuthCredentials(state);
    const next = saveAccessState(accessStateModule.applySignup(state, {
      userId: body.user_id,
      name: body.name,
      locale: body.locale || "en",
      groupId: body.group_id || body.groupId || state.policy?.signupDefaultGroupId,
      requestedRole: body.requested_role || body.requestedRole || accessContract.USER_ROLES.VIEWER
    }));
    saveAuthCredentials({
      ...credentials,
      users: {
        ...credentials.users,
        [body.user_id]: hashPassword(body.password)
      }
    });
    const session = createAuthSession(body.user_id);
    sendJson(res, 201, await createAccessSessionResponse(next, body.user_id, session), { "Set-Cookie": createSessionCookie(session.token) });
    return true;
  }

  if (parsed.action === "login") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
      return true;
    }
    const body = await readJsonRequest(req);
    const userId = body.user_id || body.userId;
    const password = body.password || "";
    const credentials = loadAuthCredentials(state);
    const userExists = state.users.some((user) => user.id === userId && user.status !== "deleted");
    const passwordOk = verifyPassword(password, credentials.users?.[userId]);
    if (!userId || !password || !userExists || !passwordOk) {
      sendJson(res, 401, { error_code: "CGA_LOGIN_FAILED", message_key: "errors.auth.loginFailed" });
      return true;
    }
    const session = createAuthSession(userId);
    const loggedInState = accessStateModule.loginAsUser(state, { userId });
    const next = saveAccessState(appendLoginHistory(
      loggedInState,
      createLoginHistoryEntry(req, loggedInState, userId, session.token)
    ));
    sendJson(res, 200, await createAccessSessionResponse(next, userId, session), { "Set-Cookie": createSessionCookie(session.token) });
    return true;
  }

  if (parsed.action === "logout") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
      return true;
    }
    const sessionToken = getSessionToken(req);
    if (sessionToken) {
      saveAccessState(markLoginHistoryLoggedOut(state, sessionToken));
    }
    deleteAuthSession(req);
    sendJson(res, 200, { status: "logged_out" }, { "Set-Cookie": createExpiredSessionCookie() });
    return true;
  }

  if (parsed.action === "joinRequests") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
      return true;
    }
    const body = await readJsonRequest(req);
    const id = body.id || `jr-${Date.now()}`;
    const next = saveAccessState(accessStateModule.requestGroupJoin(state, {
      id,
      userId: body.user_id || actorId,
      groupId: body.group_id,
      requestedRole: body.requested_role || accessContract.USER_ROLES.VIEWER
    }));
    sendJson(res, 202, { status: "pending", request: next.joinRequests.find((item) => item.id === id) });
    return true;
  }

  if (parsed.action === "approveJoinRequest") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
      return true;
    }
    const body = await readJsonRequest(req);
    const next = accessStateModule.approveGroupJoinRequest(state, {
      requestId: parsed.requestId,
      reviewerId: actorId,
      groupId: body.group_id,
      requestedRole: body.requested_role
    });
    if (next === state) {
      sendJson(res, 403, { error_code: "CGA_GROUP_JOIN_APPROVAL_FORBIDDEN", message_key: "errors.auth.joinApprovalForbidden" });
      return true;
    }
    saveAccessState(next);
    sendJson(res, 200, { status: "approved", request: next.joinRequests.find((item) => item.id === parsed.requestId) });
    return true;
  }

  if (parsed.action === "adminPermissionRequests") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
      return true;
    }
    const body = await readJsonRequest(req);
    const id = body.id || `ar-${Date.now()}`;
    const request = accessContract.createAdminPermissionRequest({
      id,
      userId: body.user_id || actorId,
      groupId: body.group_id,
      requestedRole: body.requested_role || accessContract.USER_ROLES.GROUP_ADMIN
    });
    const next = saveAccessState({ ...state, adminRequests: [...state.adminRequests, request] });
    sendJson(res, 202, { status: "pending", request: next.adminRequests.find((item) => item.id === id) });
    return true;
  }

  if (parsed.action === "approveAdminPermissionRequest") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
      return true;
    }
    const body = await readJsonRequest(req);
    const next = accessStateModule.approveAdminPermissionRequest(state, {
      requestId: parsed.requestId,
      reviewerId: actorId,
      groupId: body.group_id,
      requestedRole: body.requested_role
    });
    if (next === state) {
      sendJson(res, 403, { error_code: "CGA_ADMIN_APPROVAL_FORBIDDEN", message_key: "errors.auth.adminApprovalForbidden" });
      return true;
    }
    saveAccessState(next);
    sendJson(res, 200, { status: "approved", request: next.adminRequests.find((item) => item.id === parsed.requestId) });
    return true;
  }

  return false;
}


function getAdminCollectionKey(resource) {
  return {
    templates: "templates",
    "common-variables": "common_variables",
    "default-messages": "default_messages",
    channels: "channels",
    "botstation-links": "botstation_links"
  }[resource] || "";
}

function getAdminResourcePrefix(resource) {
  return {
    templates: "tpl",
    "common-variables": "cv",
    "default-messages": "dm",
    channels: "ch",
    "botstation-links": "bs"
  }[resource] || "adm";
}

function getAdminResourceNameField(resource) {
  return {
    templates: "name",
    "common-variables": "name",
    "default-messages": "name",
    channels: "channel_name",
    "botstation-links": "station_name"
  }[resource] || "name";
}

function getAdminResourceRequiredError(resource) {
  return {
    templates: "CGA_TEMPLATE_NAME_REQUIRED",
    "common-variables": "CGA_COMMON_VARIABLE_NAME_REQUIRED",
    "default-messages": "CGA_DEFAULT_MESSAGE_NAME_REQUIRED",
    channels: "CGA_CHANNEL_NAME_REQUIRED",
    "botstation-links": "CGA_BOTSTATION_NAME_REQUIRED"
  }[resource] || "CGA_ADMIN_RESOURCE_NAME_REQUIRED";
}

function getAdminResourceNotFoundError(resource) {
  return {
    templates: "CGA_TEMPLATE_NOT_FOUND",
    "common-variables": "CGA_COMMON_VARIABLE_NOT_FOUND",
    "default-messages": "CGA_DEFAULT_MESSAGE_NOT_FOUND",
    channels: "CGA_CHANNEL_NOT_FOUND",
    "botstation-links": "CGA_BOTSTATION_NOT_FOUND"
  }[resource] || "CGA_ADMIN_RESOURCE_NOT_FOUND";
}

function filterAdminResourceItems(resource, query) {
  const collectionKey = getAdminCollectionKey(resource);
  const items = Array.isArray(adminResources[collectionKey]) ? adminResources[collectionKey] : [];
  const keyword = String(query.get("q") || query.get("keyword") || "").trim().toLowerCase();
  const channel = String(query.get("channel") || "").trim().toLowerCase();
  const status = String(query.get("status") || "").trim();
  return items.filter((item) => {
    const haystack = [
      item.name,
      item.key,
      item.category,
      item.description,
      item.message,
      item.channel_code,
      item.channel_name,
      item.provider,
      item.renderer_type,
      item.station_name,
      item.endpoint_url
    ].filter(Boolean).join(" ").toLowerCase();
    const matchesKeyword = !keyword || haystack.includes(keyword);
    const matchesChannel = !channel || String(item.channel_name || item.channel_code || "").toLowerCase().includes(channel);
    const matchesStatus = !status || status === "all" || item.status === status || item.status_label === status;
    return matchesKeyword && matchesChannel && matchesStatus;
  });
}

function normalizeAdminResourcePayload(resource, body, existing = null) {
  const now = new Date().toISOString();
  if (resource === "templates") {
    const name = String(body.name ?? existing?.name ?? "").trim();
    return {
      ...(existing || {}),
      ...body,
      id: existing?.id || body.id || createAdminId("tpl"),
      order: Number(body.order ?? existing?.order ?? ((adminResources.templates || []).length + 1)),
      channel_code: body.channel_code || body.channel_name || existing?.channel_code || "Simulator",
      channel_name: body.channel_name || body.channel_code || existing?.channel_name || "Simulator",
      name,
      item_count: Number(body.item_count ?? existing?.item_count ?? 1),
      item_types: body.item_types || existing?.item_types || "text",
      renderer_type: body.renderer_type || existing?.renderer_type || "text",
      status: body.status || existing?.status || "Y",
      status_label: body.status_label || (body.status === "N" ? "미사용" : "사용"),
      created_at: existing?.created_at || body.created_at || now,
      updated_at: now,
      created_by: existing?.created_by || body.created_by || "admin",
      updated_by: body.updated_by || "admin",
      protected: Boolean(existing?.protected)
    };
  }
  if (resource === "common-variables") {
    const name = String(body.name ?? existing?.name ?? "").trim();
    return {
      ...(existing || {}),
      ...body,
      id: existing?.id || body.id || createAdminId("cv"),
      name,
      category: body.category || existing?.category || "사용자",
      value: body.value ?? existing?.value ?? "",
      description: body.description || existing?.description || "",
      updated_at: now,
      updated_by: body.updated_by || "admin"
    };
  }
  if (resource === "default-messages") {
    const name = String(body.name ?? existing?.name ?? "").trim();
    return {
      ...(existing || {}),
      ...body,
      id: existing?.id || body.id || createAdminId("dm"),
      category: body.category || existing?.category || "System",
      name,
      key: body.key || existing?.key || name,
      message: body.message || existing?.message || "",
      status: body.status || existing?.status || "Y",
      status_label: body.status_label || (body.status === "N" ? "미사용" : "사용"),
      updated_at: now,
      updated_by: body.updated_by || "admin"
    };
  }
  if (resource === "channels") {
    const channelName = String(body.channel_name ?? body.name ?? existing?.channel_name ?? "").trim();
    const channelCode = String(body.channel_code ?? existing?.channel_code ?? channelName).trim();
    return {
      ...(existing || {}),
      ...body,
      id: existing?.id || body.id || createAdminId("ch"),
      channel_code: channelCode,
      channel_name: channelName,
      provider: body.provider || existing?.provider || "webchat",
      renderer_type: body.renderer_type || existing?.renderer_type || "text",
      auth_type: body.auth_type || existing?.auth_type || "none",
      status: body.status || existing?.status || "Y",
      status_label: body.status_label || (body.status === "N" ? "미사용" : "사용"),
      updated_at: now,
      updated_by: body.updated_by || "admin"
    };
  }
  const stationName = String(body.station_name ?? body.name ?? existing?.station_name ?? "").trim();
  return {
    ...(existing || {}),
    ...body,
    id: existing?.id || body.id || createAdminId(getAdminResourcePrefix(resource)),
    station_name: stationName,
    endpoint_url: body.endpoint_url || existing?.endpoint_url || "",
    status: body.status || existing?.status || "Y",
    status_label: body.status_label || (body.status === "N" ? "미사용" : "사용"),
    updated_at: now,
    updated_by: body.updated_by || "admin"
  };
}

function buildLicenseUsage(state) {
  const users = (state.users || []).filter((user) => user.status !== "deleted").length;
  const bots = workspaceBots.filter((bot) => bot.status !== "deleted").length;
  const apis = apiAnswerRegistry.filter((api) => api.status !== "deleted").length;
  return [
    { id: "lic-bot", category: "봇", total: "무제한", used: bots, remaining: "-", expires_at: "-", status: "정상" },
    { id: "lic-user", category: "사용자", total: "무제한", used: users, remaining: "-", expires_at: "-", status: "정상" },
    { id: "lic-api", category: "API", total: "무제한", used: apis, remaining: "-", expires_at: "-", status: "정상" }
  ];
}

async function handleAdminResourceApi(req, res, urlPath, query) {
  const parsed = parseAdminResourcePath(urlPath);
  if (!parsed) return false;
  const state = await loadAccessState();

  if (parsed.resource === "all") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
      return true;
    }
    sendJson(res, 200, {
      ...adminResources,
      licenses: Array.isArray(adminResources.licenses) && adminResources.licenses.length ? adminResources.licenses : buildLicenseUsage(state),
      login_history: Array.isArray(state.loginHistory) ? state.loginHistory : []
    });
    return true;
  }

  const collectionKey = getAdminCollectionKey(parsed.resource);
  if (!collectionKey) return false;
  const collection = Array.isArray(adminResources[collectionKey]) ? adminResources[collectionKey] : [];

  if (!parsed.id) {
    if (req.method === "GET") {
      const items = filterAdminResourceItems(parsed.resource, query);
      sendJson(res, 200, { items, total: items.length });
      return true;
    }
    if (req.method === "POST") {
      const body = await readJsonRequest(req);
      const nameField = getAdminResourceNameField(parsed.resource);
      const name = String(body[nameField] ?? body.name ?? "").trim();
      if (!name) {
        sendJson(res, 400, { error_code: getAdminResourceRequiredError(parsed.resource), message_key: "errors.admin.resourceNameRequired" });
        return true;
      }
      const item = normalizeAdminResourcePayload(parsed.resource, body);
      saveAdminResources({ ...adminResources, [collectionKey]: [item, ...collection] });
      sendJson(res, 201, item);
      return true;
    }
    sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
    return true;
  }

  const target = collection.find((item) => item.id === parsed.id);
  if (!target) {
    sendJson(res, 404, { error_code: getAdminResourceNotFoundError(parsed.resource), message_key: "errors.admin.resourceNotFound" });
    return true;
  }
  if (req.method === "PUT" || req.method === "PATCH") {
    const body = await readJsonRequest(req);
    const nextItems = collection.map((item) => item.id === parsed.id ? normalizeAdminResourcePayload(parsed.resource, body, item) : item);
    saveAdminResources({ ...adminResources, [collectionKey]: nextItems });
    sendJson(res, 200, nextItems.find((item) => item.id === parsed.id));
    return true;
  }
  if (req.method === "DELETE") {
    saveAdminResources({ ...adminResources, [collectionKey]: collection.filter((item) => item.id !== parsed.id) });
    sendJson(res, 200, { deleted: true, id: parsed.id });
    return true;
  }
  sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
  return true;
}

function getWebchatBotBySlug(botSlug) {
  return workspaceBots.find((bot) => bot.id === botSlug || bot.slug === botSlug || sanitizePathSegment(bot.name, bot.id) === botSlug) || null;
}

function getBotGroupName(groupId) {
  if (!accessState?.groups) return null;
  return accessState.groups.find((group) => group.id === groupId)?.name || null;
}

function serializeWebchatBot(bot) {
  return {
    id: bot.id,
    name: bot.name,
    slug: bot.slug || bot.id,
    groupId: bot.group_id,
    groupName: getBotGroupName(bot.group_id),
    activeVersionId: `${bot.id}:${bot.version || "v0.1"}`,
    activeVersionName: bot.version || "v0.1",
    activeVersionNo: Number(String(bot.version || "v0.1").match(/\d+/)?.[0] || 1),
    activatedAt: bot.updated_at || null,
    initialMessages: [
      { type: "text", text: `${bot.name}에 연결되었습니다.` }
    ]
  };
}

function getWebchatBots() {
  return workspaceBots
    .filter((bot) => bot.status !== "deleted")
    .map((bot) => ({ ...bot, slug: bot.slug || bot.id }));
}

function serializeWebchatRoom(room) {
  const bot = getWebchatBotBySlug(room.bot_slug) || workspaceBots.find((item) => item.id === room.bot_id) || workspaceBots[0];
  return {
    id: room.id,
    clientRoomId: room.client_room_id || room.id,
    channelType: "webchat",
    status: room.status || "open",
    bot: serializeWebchatBot(bot),
    createdAt: room.created_at,
    updatedAt: room.updated_at
  };
}

function createStoredChannelMessage({ participantKind, participantId, participantName, text, payload = null }) {
  return {
    id: crypto.randomUUID(),
    participantId,
    participantKind,
    participantName,
    messageType: "text",
    text,
    payload: payload || undefined,
    createdAt: new Date().toISOString()
  };
}

function getDetailAssetsForWebchatBot(bot) {
  return detailAssetRegistry.find((item) => item.group_id === bot.group_id && item.bot_id === bot.id) || createDefaultDetailAssetsForBot(bot.group_id, bot.id);
}

function selectWebchatIntent(bot, message) {
  const assets = getDetailAssetsForWebchatBot(bot);
  const text = String(message || "").toLowerCase();
  const scenarios = Array.isArray(assets.scenarios) ? assets.scenarios : [];
  const utterances = Array.isArray(assets.intent_utterances) ? assets.intent_utterances : [];
  const matchedUtterance = utterances.find((item) => {
    const utterance = String(item.utterance || "").toLowerCase();
    return utterance && (text.includes(utterance) || utterance.includes(text));
  });
  const scenarioId = matchedUtterance?.division || scenarios[0]?.id || null;
  const scenario = scenarios.find((item) => item.id === scenarioId) || scenarios[0] || null;
  const score = matchedUtterance ? 100 : scenario ? 94 : 0;
  return { scenario, score };
}

async function handleWebchatChannelApi(req, res, urlPath, query) {
  const parsed = parseWebchatChannelPath(urlPath);
  if (!parsed) return false;
  const state = await loadAccessState();
  const bots = getWebchatBots();

  if (req.method === "OPTIONS") {
    sendAidotSuccess(req, res, parsed.action === "rooms" ? { channelType: "webchat", room: null } : { channelType: "webchat", connected: true });
    return true;
  }

  if (parsed.action === "connect") {
    if (req.method !== "POST") {
      sendJson(res, 405, { detail: "Method Not Allowed" });
      return true;
    }
    const body = await readJsonRequest(req);
    sendAidotSuccess(req, res, {
      channelType: "webchat",
      connected: true,
      clientId: body.client_id || "webchat-client",
      bots: bots.map(serializeWebchatBot)
    });
    return true;
  }

  if (parsed.action === "bots" || parsed.action === "legacyBootstrap") {
    if (req.method !== "GET") {
      sendJson(res, 405, { detail: "Method Not Allowed" });
      return true;
    }
    const data = {
      channelType: "webchat",
      bots: bots.map(serializeWebchatBot),
      participants: [
        { id: "visitor", kind: "user", name: "사용자" },
        ...bots.map((bot) => ({ id: bot.id, kind: "bot", name: bot.name, botSlug: bot.slug || bot.id }))
      ]
    };
    sendAidotSuccess(req, res, parsed.action === "legacyBootstrap" ? { bots: data.bots, participants: data.participants } : data);
    return true;
  }

  if (parsed.action === "rooms") {
    if (req.method === "GET") {
      const participantId = query.get("participant_id") || "";
      const rooms = participantId ? webchatRooms.filter((room) => room.participant_id === participantId) : webchatRooms;
      sendAidotSuccess(req, res, { channelType: "webchat", rooms: rooms.map(serializeWebchatRoom) });
      return true;
    }
    if (req.method === "POST") {
      const body = await readJsonRequest(req);
      const bot = getWebchatBotBySlug(body.bot_slug) || bots[0];
      if (!bot) {
        sendJson(res, 404, { detail: "webchat 봇을 찾을 수 없습니다." });
        return true;
      }
      const now = new Date().toISOString();
      const room = {
        id: crypto.randomUUID(),
        client_room_id: body.client_room_id || crypto.randomUUID(),
        channel_type: "webchat",
        bot_id: bot.id,
        bot_slug: bot.slug || bot.id,
        participant_id: body.participant_id || "visitor",
        participant_name: body.participant_name || "사용자",
        status: "open",
        messages: [],
        created_at: now,
        updated_at: now
      };
      const botMessage = createStoredChannelMessage({
        participantKind: "bot",
        participantId: bot.id,
        participantName: bot.name,
        text: `${bot.name}에 연결되었습니다.`
      });
      room.messages = [botMessage];
      saveWebchatRooms([room, ...webchatRooms]);
      sendAidotSuccess(req, res, { room: serializeWebchatRoom(room), messages: room.messages, initialMessages: [] });
      return true;
    }
  }

  if (parsed.action === "roomDetail") {
    if (req.method === "DELETE") {
      const room = webchatRooms.find((item) => item.id === parsed.roomId);
      if (room) {
        room.status = "closed";
        room.updated_at = new Date().toISOString();
        saveWebchatRooms([...webchatRooms]);
      }
      sendAidotSuccess(req, res, { roomId: parsed.roomId, deleted: true });
      return true;
    }
    if (req.method !== "GET") {
      sendJson(res, 405, { detail: "Method Not Allowed" });
      return true;
    }
    const room = webchatRooms.find((item) => item.id === parsed.roomId);
    if (!room) {
      sendJson(res, 404, { detail: "채팅방을 찾을 수 없습니다." });
      return true;
    }
    sendAidotSuccess(req, res, { room: serializeWebchatRoom(room), messages: room.messages || [] });
    return true;
  }

  if (parsed.action === "roomMessage" || parsed.action === "legacyRoomMessage") {
    if (req.method !== "POST") {
      sendJson(res, 405, { detail: "Method Not Allowed" });
      return true;
    }
    const body = await readJsonRequest(req);
    let room = webchatRooms.find((item) => item.id === parsed.roomId);
    const bot = parsed.botSlug ? getWebchatBotBySlug(parsed.botSlug) : room ? getWebchatBotBySlug(room.bot_slug) : bots[0];
    if (!bot) {
      sendJson(res, 404, { detail: "webchat 봇을 찾을 수 없습니다." });
      return true;
    }
    if (!room) {
      const now = new Date().toISOString();
      room = {
        id: parsed.roomId,
        client_room_id: parsed.roomId,
        channel_type: "webchat",
        bot_id: bot.id,
        bot_slug: bot.slug || bot.id,
        participant_id: body.participant_id || "visitor",
        participant_name: "사용자",
        status: "open",
        messages: [],
        created_at: now,
        updated_at: now
      };
      webchatRooms = [room, ...webchatRooms];
    }
    const userMessage = createStoredChannelMessage({
      participantKind: "user",
      participantId: body.participant_id || room.participant_id || "visitor",
      participantName: room.participant_name || "사용자",
      text: body.message || ""
    });
    const { scenario, score } = selectWebchatIntent(bot, body.message || "");
    const answer = scenario?.answer || scenario?.dialogCards?.[0] || "질문을 이해하지 못했습니다. 다시 말씀해주세요.";
    const botMessage = createStoredChannelMessage({
      participantKind: "bot",
      participantId: bot.id,
      participantName: bot.name,
      text: answer
    });
    room.messages = [...(room.messages || []), userMessage, botMessage];
    room.updated_at = botMessage.createdAt;
    saveWebchatRooms([...webchatRooms.filter((item) => item.id !== room.id), room]);
    sendAidotSuccess(req, res, {
      botMessage,
      botMessages: [botMessage],
      intent: {
        id: scenario?.id || null,
        name: scenario?.displayName || scenario?.id || null,
        score
      },
      runtime: {
        dialogEnded: true,
        sessionEnded: false,
        completionReason: "matched"
      }
    });
    return true;
  }

  return false;
}

function getTodayStamp() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
}

function buildSampleTextAsset(scope) {
  const samples = {
    intent_utterance: "I need to reset my password,password_reset\r\nHow do I update my account?,account_update",
    entity: "개체명,개체값,유형(S/P),상세\r\nemail,email,P,\\\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\\\.[A-Za-z]{2,}\\\\b",
    dictionary: "대표어,유의어1,유의어2\r\npassword,login password,account password",
    blocklist: "Blocklist 이름,유형,제외 단어/정규 표현식,사용여부\r\nsample_blocklist,word,forbidden,Y",
    rule: "룰 이름,룰 설명,룰 표현식,연결 의도/모듈,사용여부(Y/N)\r\nBusiness hours,Route after-hours questions,time.after(18:00),support_after_hours,Y"
  };
  return samples[scope] || "";
}

function buildSampleJsonAsset(scope, groupId, botId, botLocale) {
  if (scope === "api") {
    return {
      apiList: [
        {
          name: "order_status_lookup",
          endpoint_url: "https://api.example.com/orders/{order_id}",
          method: "GET",
          auth_type: "bearer",
          secret_ref: "secret:group/" + groupId + "/order-status",
          response_path: "data.answer"
        }
      ]
    };
  }
  if (scope === "dialog") {
    return {
      flowGraph: {
        botId,
        locale: botLocale,
        nodes: [
          { id: "password_reset", label: "password_reset", type: "intent" }
        ]
      },
      licenseInfo: null,
      AIDOTAssistantVersion: "CGA-AIDOT-COMPATIBLE-1",
      dialogType: 1,
      messageDigest: ""
    };
  }
  if (scope === "version") {
    return {
      version: {
        bot: {
          name: "CGA Bot",
          defaultLocale: botLocale,
          version: "v0.1"
        },
        structuralChoices: {},
        counts: {},
        llm: {},
        channels: {}
      }
    };
  }
  return {
    AIDOTAssistantVersion: "CGA-AIDOT-COMPATIBLE-1",
    messageDigest: "",
    botVo: {
      botId,
      botName: "CGA Bot",
      defaultLanguage: botLocale,
      groupId
    },
    licenseVo: null,
    botSystemConfigVoList: [],
    dialogList: [],
    dialogFlowGraphList: [],
    entityTypeList: [],
    faqDialogList: [],
    floatingButtonVoList: [],
    ruleVoList: [],
    smallTalkVoList: [],
    dictionaryVoList: [],
    blacklistList: []
  };
}

async function handleAssetTransferApi(req, res, urlPath, query) {
  const parsed = parseAssetTransferPath(urlPath);
  if (!parsed) return false;
  const contract = await import("../packages/contracts/src/asset-transfer-api-contract.js");
  const packageContract = await import("../packages/contracts/src/aidot-package-contract.js");
  const { groupId, botId, scope, action } = parsed;
  const botLocale = query.get("bot_locale") || "en";

  if (action === "history") {
    const items = assetTransferHistory.filter((item) => item.group_id === groupId && item.bot_id === botId);
    sendJson(res, 200, { group_id: groupId, bot_id: botId, items });
    return true;
  }

  const asset = packageContract.getAidotCompatibleAsset(scope);
  if (!asset) {
    sendJson(res, 404, { error_code: "CGA_ASSET_SCOPE_NOT_FOUND", message_key: "errors.asset.scopeNotFound", scope });
    return true;
  }

  if (action === "manifest") {
    const request = contract.createAssetExportRequest({ groupId, botId, scope, botLocale });
    const response = contract.createAssetTransferResponse({ request, transferId: `manifest-${Date.now()}` });
    sendJson(res, 200, {
      ...response,
      required_scopes: contract.getAssetTransferScopeRequirement(scope)
    });
    return true;
  }

  if (action === "export") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
      return true;
    }
    const request = contract.createAssetExportRequest({ groupId, botId, scope, botLocale });
    const transferId = `export-${Date.now()}`;
    const storedBody = readStoredAssetBody({ groupId, botId, scope, fileFormat: asset.fileFormat });
    recordAssetTransfer({
      transfer_id: transferId,
      group_id: groupId,
      bot_id: botId,
      scope,
      direction: "export",
      source: storedBody == null ? "sample" : "stored",
      created_at: new Date().toISOString()
    });
    const fileName = `CGA_${scope}_${botId}_${getTodayStamp()}.${asset.fileFormat}`;
    if (asset.fileFormat === "txt") {
      sendDownload(res, fileName, storedBody ?? buildSampleTextAsset(scope), "text/plain; charset=utf-8");
      return true;
    }
    if (storedBody != null) {
      sendDownload(res, fileName, storedBody, "application/json; charset=utf-8");
      return true;
    }
    const payload = {
      manifest: contract.createAssetTransferResponse({ request, transferId }).manifest,
      package: buildSampleJsonAsset(scope, groupId, botId, botLocale)
    };
    sendDownload(res, fileName, JSON.stringify(payload, null, 2), "application/json; charset=utf-8");
    return true;
  }

  if (action === "import") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
      return true;
    }
    const body = await readRequestBody(req);
    const request = contract.createAssetImportRequest({
      groupId,
      botId,
      scope,
      botLocale,
      fileName: req.headers["x-cga-file-name"] || `uploaded.${asset.fileFormat}`
    });
    const transferId = `import-${Date.now()}`;
    const storedPath = storeAssetBody({ groupId, botId, scope, fileFormat: asset.fileFormat, body });
    recordAssetTransfer({
      transfer_id: transferId,
      group_id: groupId,
      bot_id: botId,
      scope,
      direction: "import",
      byte_length: Buffer.byteLength(body, "utf8"),
      asset_path: storedPath,
      created_at: new Date().toISOString()
    });
    sendJson(res, 202, contract.createAssetTransferResponse({ request, status: contract.ASSET_TRANSFER_STATUS.ACCEPTED, transferId }));
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const query = new URL(req.url || "/", "http://localhost").searchParams;
  try {
    if (await handleWebchatChannelApi(req, res, urlPath, query)) return;
    if (await handleAuthApi(req, res, urlPath)) return;
    if (await handleStudioStateApi(req, res, urlPath)) return;
    if (await handleCompositionApi(req, res, urlPath)) return;
    if (await handleDetailAssetApi(req, res, urlPath)) return;
    if (await handleOperationsStateApi(req, res, urlPath)) return;
    if (await handleCollaborationStateApi(req, res, urlPath)) return;
    if (await handleWorkspaceBotApi(req, res, urlPath)) return;
    if (await handleApiAnswerApi(req, res, urlPath)) return;
    if (await handleAdminResourceApi(req, res, urlPath, query)) return;
    if (await handleAssetTransferApi(req, res, urlPath, query)) return;
  } catch (error) {
    sendJson(res, 500, {
      error_code: "CGA_API_REQUEST_FAILED",
      message_key: "errors.api.requestFailed",
      detail: error instanceof Error ? error.message : "Unknown error"
    });
    return;
  }
  const requestPath = urlPath === "/" ? "/apps/studio/index.html" : urlPath;
  const safePath = path.normalize(requestPath).replace(/^[/\\]+/, "");
  const filePath = path.join(root, safePath);
  if (!filePath.startsWith(root)) return send(res, 403, "Forbidden");
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, "Not found");
    send(res, 200, data, types[path.extname(filePath)] || "application/octet-stream");
  });
});

server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    console.log(`CGA Studio is already running at http://${host}:${port}`);
    process.exit(0);
  }
  console.error(error);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`CGA Studio running at http://${host}:${port}`);
});





