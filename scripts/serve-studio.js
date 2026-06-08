const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4173);
const dataDir = path.resolve(process.env.CGA_DATA_DIR || path.join(root, ".cga-data"));
const assetTransferHistoryFile = path.join(dataDir, "asset-transfer-history.json");
const accessStateFile = path.join(dataDir, "access-state.json");
const apiAnswerRegistryFile = path.join(dataDir, "api-answer-registry.json");
const workspaceBotsFile = path.join(dataDir, "workspace-bots.json");
let assetTransferHistory = loadAssetTransferHistory();
let accessState = null;
let apiAnswerRegistry = loadApiAnswerRegistry();
let workspaceBots = loadWorkspaceBots();
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

async function canCreateWorkspaceBot(req, groupId, botId = "supportbot-draft") {
  const accessStateModule = await import("../packages/public-core/src/access-state.js");
  const state = await loadAccessState();
  const actorId = getActorId(req, state);
  return accessStateModule.getEffectiveGroupScopes(state, actorId, groupId, botId).includes("bot.create");
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
    if (!body.user_id || !body.name) {
      sendJson(res, 400, { error_code: "CGA_SIGNUP_REQUIRED_FIELD_MISSING", message_key: "errors.auth.signupRequired" });
      return true;
    }
    if (state.users.some((user) => user.id === body.user_id)) {
      sendJson(res, 409, { error_code: "CGA_USER_ALREADY_EXISTS", message_key: "errors.auth.userExists" });
      return true;
    }
    const next = saveAccessState(accessStateModule.applySignup(state, {
      userId: body.user_id,
      name: body.name,
      locale: body.locale || "en",
      groupName: body.group_name || body.groupName || `${body.name} Group`
    }));
    sendJson(res, 201, await createAccessSessionResponse(next, body.user_id));
    return true;
  }

  if (parsed.action === "login") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
      return true;
    }
    const body = await readJsonRequest(req);
    const next = accessStateModule.loginAsUser(state, { userId: body.user_id || body.userId });
    if (next === state && state.currentUserId !== (body.user_id || body.userId)) {
      sendJson(res, 401, { error_code: "CGA_LOGIN_FAILED", message_key: "errors.auth.loginFailed" });
      return true;
    }
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
