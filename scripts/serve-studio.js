const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4173);
const dataDir = path.resolve(process.env.CGA_DATA_DIR || path.join(root, ".cga-data"));
const assetTransferHistoryFile = path.join(dataDir, "asset-transfer-history.json");
let assetTransferHistory = loadAssetTransferHistory();
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
    recordAssetTransfer({ transfer_id: transferId, group_id: groupId, bot_id: botId, scope, direction: "export", created_at: new Date().toISOString() });
    const fileName = `CGA_${scope}_${botId}_${getTodayStamp()}.${asset.fileFormat}`;
    if (asset.fileFormat === "txt") {
      sendDownload(res, fileName, buildSampleTextAsset(scope), "text/plain; charset=utf-8");
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
    recordAssetTransfer({
      transfer_id: transferId,
      group_id: groupId,
      bot_id: botId,
      scope,
      direction: "import",
      byte_length: Buffer.byteLength(body, "utf8"),
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
    if (await handleAssetTransferApi(req, res, urlPath, query)) return;
  } catch (error) {
    sendJson(res, 500, {
      error_code: "CGA_ASSET_TRANSFER_FAILED",
      message_key: "errors.asset.transferFailed",
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
