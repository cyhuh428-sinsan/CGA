const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4173);
const dataDir = path.resolve(process.env.CGA_DATA_DIR || path.join(root, ".cga-data"));
const assetTransferHistoryFile = path.join(dataDir, "asset-transfer-history.json");
const accessStateFile = path.join(dataDir, "access-state.json");
const authCredentialsFile = path.join(dataDir, "auth-credentials.json");
const apiAnswerRegistryFile = path.join(dataDir, "api-answer-registry.json");
const workspaceBotsFile = path.join(dataDir, "workspace-bots.json");
const studioStateRegistryFile = path.join(dataDir, "studio-state-registry.json");
const compositionRegistryFile = path.join(dataDir, "composition-registry.json");
const detailAssetRegistryFile = path.join(dataDir, "detail-asset-registry.json");
const operationsStateRegistryFile = path.join(dataDir, "operations-state-registry.json");
const collaborationStateRegistryFile = path.join(dataDir, "collaboration-state-registry.json");
let assetTransferHistory = loadAssetTransferHistory();
let accessState = null;
let apiAnswerRegistry = loadApiAnswerRegistry();
let workspaceBots = loadWorkspaceBots();
let studioStateRegistry = loadStudioStateRegistry();
let compositionRegistry = loadCompositionRegistry();
let detailAssetRegistry = loadDetailAssetRegistry();
let operationsStateRegistry = loadOperationsStateRegistry();
let collaborationStateRegistry = loadCollaborationStateRegistry();
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
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
}

const PASSWORD_ITERATIONS = 120000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_DIGEST = "sha256";

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
  accessState = stored && typeof stored === "object" ? stored : accessStateModule.createSampleAccessState();
  return accessState;
}

function saveAccessState(state) {
  accessState = state;
  writeJsonFile(accessStateFile, state);
  return state;
}

function getActorId(req, state) {
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
      { id: "password_reset", type: "intent", displayName: "password_reset" },
      { id: "account_update", type: "intent", displayName: "account_update" }
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

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload, null, 2), "application/json; charset=utf-8");
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

function parseAuthApiPath(urlPath) {
  if (urlPath === "/api/cga/auth/signup") return { action: "signup" };
  if (urlPath === "/api/cga/auth/login") return { action: "login" };
  if (urlPath === "/api/cga/auth/me") return { action: "me" };
  if (urlPath === "/api/cga/groups") return { action: "groups" };
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
  const match = urlPath.match(/^\/api\/cga\/groups\/([^/]+)\/bots$/);
  if (!match) return null;
  return {
    groupId: match[1]
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
    sendJson(res, 200, {
      group_id: groupId,
      items: workspaceBots.filter((bot) => bot.group_id === groupId)
    });
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

async function createAccessSessionResponse(state, userId = state.currentUserId) {
  const authContract = await import("../packages/contracts/src/auth-api-contract.js");
  const user = state.users.find((item) => item.id === userId) || null;
  const memberships = state.memberships.filter((item) => item.user_id === userId && item.status === "active");
  const groups = state.groups.filter((group) => memberships.some((membership) => membership.group_id === group.id));
  return authContract.createAuthSessionResponse({ user, memberships, groups, locale: user?.locale });
}

async function handleAuthApi(req, res, urlPath) {
  const parsed = parseAuthApiPath(urlPath);
  if (!parsed) return false;
  const accessStateModule = await import("../packages/public-core/src/access-state.js");
  const accessContract = await import("../packages/contracts/src/access-contract.js");
  const state = await loadAccessState();
  const actorId = getActorId(req, state);

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
        policy: state.policy,
        bot_id: state.botId
      });
      return true;
    }
    if (req.method === "POST") {
      const body = await readJsonRequest(req);
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
      groupName: body.group_name || body.groupName || `${body.name} Group`
    }));
    saveAuthCredentials({
      ...credentials,
      users: {
        ...credentials.users,
        [body.user_id]: hashPassword(body.password)
      }
    });
    sendJson(res, 201, await createAccessSessionResponse(next, body.user_id));
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
    const next = accessStateModule.loginAsUser(state, { userId });
    saveAccessState(next);
    sendJson(res, 200, await createAccessSessionResponse(next));
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
    const next = accessStateModule.approveGroupJoinRequest(state, { requestId: parsed.requestId, reviewerId: actorId });
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
    const next = accessStateModule.approveAdminPermissionRequest(state, { requestId: parsed.requestId, reviewerId: actorId });
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
    if (await handleAuthApi(req, res, urlPath)) return;
    if (await handleStudioStateApi(req, res, urlPath)) return;
    if (await handleCompositionApi(req, res, urlPath)) return;
    if (await handleDetailAssetApi(req, res, urlPath)) return;
    if (await handleOperationsStateApi(req, res, urlPath)) return;
    if (await handleCollaborationStateApi(req, res, urlPath)) return;
    if (await handleWorkspaceBotApi(req, res, urlPath)) return;
    if (await handleApiAnswerApi(req, res, urlPath)) return;
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

server.listen(port, () => {
  console.log(`CGA Studio running at http://localhost:${port}`);
});
