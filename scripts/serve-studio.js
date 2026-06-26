const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const DEFAULT_MESSAGE_LANGUAGES = ["ko", "en", "zh-CN", "ja", "vi", "de", "fr"];
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
const storageDriver = String(process.env.CGA_STORAGE_DRIVER || (process.env.CGA_DB_HOST ? "postgres" : "file")).trim().toLowerCase();
const postgresStorageEnabled = storageDriver === "postgres";
const postgresConfig = {
  host: String(process.env.CGA_DB_HOST || "").trim(),
  port: String(process.env.CGA_DB_PORT || "5432").trim(),
  database: String(process.env.CGA_DB_NAME || "").trim(),
  user: String(process.env.CGA_DB_USER || "").trim(),
  password: String(process.env.CGA_DB_PASSWORD || "")
};
const postgresStoreTable = "cga_state_store";
const STORAGE_COLLECTION_KEYS = {
  adminResources: "admin_resources",
  authCredentials: "auth_credentials",
  authSessions: "auth_sessions",
  assetTransferHistory: "asset_transfer_history",
  accessState: "access_state",
  apiAnswerRegistry: "api_answer_registry",
  workspaceBots: "workspace_bots",
  studioStateRegistry: "studio_state_registry",
  compositionRegistry: "composition_registry",
  detailAssetRegistry: "detail_asset_registry",
  operationsStateRegistry: "operations_state_registry",
  collaborationStateRegistry: "collaboration_state_registry",
  webchatRooms: "webchat_rooms"
};
let postgresStorageReady = false;
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

function quoteSqlLiteral(value) {
  return `'${String(value || "").replace(/'/g, "''")}'`;
}

function buildJsonbSqlExpression(payload) {
  const base64 = Buffer.from(JSON.stringify(payload ?? null), "utf8").toString("base64");
  return `convert_from(decode('${base64}', 'base64'), 'utf8')::jsonb`;
}

function runPsql(sql) {
  const result = spawnSync(
    "psql",
    [
      "-h", postgresConfig.host,
      "-p", postgresConfig.port,
      "-U", postgresConfig.user,
      "-d", postgresConfig.database,
      "-v", "ON_ERROR_STOP=1",
      "-t",
      "-A"
    ],
    {
      input: sql,
      encoding: "utf8",
      env: { ...process.env, PGPASSWORD: postgresConfig.password }
    }
  );
  if (result.error) {
    throw new Error(`psql execution failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "psql execution failed").trim());
  }
  return String(result.stdout || "").trim();
}

function ensurePostgresStorageReady() {
  if (!postgresStorageEnabled) return false;
  if (postgresStorageReady) return true;
  if (!postgresConfig.host || !postgresConfig.database || !postgresConfig.user) {
    throw new Error("CGA postgres storage is enabled, but CGA_DB_HOST/CGA_DB_NAME/CGA_DB_USER is missing.");
  }
  runPsql(`
    CREATE TABLE IF NOT EXISTS ${postgresStoreTable} (
      collection_key TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  postgresStorageReady = true;
  return true;
}

function readStoredCollection(collectionKey) {
  if (!postgresStorageEnabled) return undefined;
  ensurePostgresStorageReady();
  const output = runPsql(`
    SELECT payload::text
    FROM ${postgresStoreTable}
    WHERE collection_key = ${quoteSqlLiteral(collectionKey)}
    LIMIT 1;
  `);
  if (!output) return undefined;
  return JSON.parse(output);
}

function writeStoredCollection(collectionKey, payload) {
  if (!postgresStorageEnabled) return payload;
  ensurePostgresStorageReady();
  runPsql(`
    INSERT INTO ${postgresStoreTable} (collection_key, payload, updated_at)
    VALUES (
      ${quoteSqlLiteral(collectionKey)},
      ${buildJsonbSqlExpression(payload)},
      NOW()
    )
    ON CONFLICT (collection_key)
    DO UPDATE SET
      payload = EXCLUDED.payload,
      updated_at = NOW();
  `);
  return payload;
}

function loadStoredCollection({ collectionKey, filePath, fallback }) {
  if (!postgresStorageEnabled) return loadJsonFile(filePath, fallback);
  const stored = readStoredCollection(collectionKey);
  if (stored !== undefined) return stored;
  const fileBacked = loadJsonFile(filePath, undefined);
  if (fileBacked !== undefined) {
    writeStoredCollection(collectionKey, fileBacked);
    return fileBacked;
  }
  writeStoredCollection(collectionKey, fallback);
  return fallback;
}

function saveStoredCollection({ collectionKey, filePath, payload, mirrorToFile = true }) {
  if (postgresStorageEnabled) {
    writeStoredCollection(collectionKey, payload);
    if (mirrorToFile) writeJsonFile(filePath, payload);
    return payload;
  }
  writeJsonFile(filePath, payload);
  return payload;
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

function getDefaultMessageCategoryLabel(category) {
  return {
    intent: "의도",
    input: "입력",
    error: "오류",
    session: "세션",
    runtime: "런타임"
  }[category] || category || "";
}

function getDefaultMessageSeedText(definition, language = "ko") {
  if (!definition || typeof definition !== "object") return "";
  return definition.translations?.[language] || definition.message_text || "";
}

function createDefaultMessageDefinitions() {
  return [
    { message_key: "intent_fallback", message_name: "의도 미분류 메시지", category: "intent", message_text: "질문을 이해하지 못했습니다. 다시 말씀해주세요.", translations: { ko: "질문을 이해하지 못했습니다. 다시 말씀해주세요.", en: "I could not understand your question. Please say it again.", "zh-CN": "我没有理解您的问题。请再说一遍。", ja: "ご質問を理解できませんでした。もう一度入力してください。", vi: "Toi khong hieu cau hoi cua ban. Vui long noi lai.", de: "Ich konnte Ihre Frage nicht verstehen. Bitte sagen Sie sie noch einmal.", fr: "Je n'ai pas compris votre question. Veuillez la reformuler." }, description: "사용자 발화에서 의도를 찾지 못했을 때 출력합니다." },
    { message_key: "multi_intent_guide", message_name: "다중 의도 선택 안내", category: "intent", message_text: "아래 후보 중 원하는 의도를 선택해주세요.", translations: { ko: "아래 후보 중 원하는 의도를 선택해주세요.", en: "Please choose the intent you want from the options below.", "zh-CN": "请从下面的候选项中选择您想要的意图。", ja: "以下の候補から希望する意図を選択してください。", vi: "Vui long chon y dinh ban muon trong cac lua chon ben duoi.", de: "Bitte wahlen Sie die gewunschte Absicht aus den folgenden Optionen aus.", fr: "Veuillez choisir l'intention souhaitee parmi les options ci-dessous." }, description: "여러 의도가 후보로 잡혔을 때 출력합니다." },
    { message_key: "no_desired_intent", message_name: "원하는 의도 없음 메시지", category: "intent", message_text: "원하는 의도가 없습니다. 다시 말씀해주세요.", translations: { ko: "원하는 의도가 없습니다. 다시 말씀해주세요.", en: "The intent you want is not listed. Please say it again.", "zh-CN": "没有您想要的意图。请再说一遍。", ja: "ご希望の意図がありません。もう一度入力してください。", vi: "Khong co y dinh ban muon. Vui long noi lai.", de: "Die gewunschte Absicht ist nicht vorhanden. Bitte sagen Sie es noch einmal.", fr: "L'intention souhaitee n'est pas disponible. Veuillez reformuler." }, description: "사용자가 후보 의도 중 원하는 의도가 없다고 선택했을 때 출력합니다." },
    { message_key: "intent_receipt", message_name: "의도 접수 메시지", category: "intent", message_text: "{intentName} 의도로 접수되었습니다.", translations: { ko: "{intentName} 의도로 접수되었습니다.", en: "Your request has been received as the {intentName} intent.", "zh-CN": "已按 {intentName} 意图受理。", ja: "{intentName} 意図として受け付けました。", vi: "Yeu cau da duoc tiep nhan voi y dinh {intentName}.", de: "Ihre Anfrage wurde als Absicht {intentName} erfasst.", fr: "Votre demande a ete prise en compte comme intention {intentName}." }, description: "연결된 대화 흐름이 없고 의도만 인식되었을 때 출력합니다." },
    { message_key: "invalid_button", message_name: "버튼 오류 메시지", category: "input", message_text: "선택할 수 없는 항목입니다. 다시 선택해주세요.", translations: { ko: "선택할 수 없는 항목입니다. 다시 선택해주세요.", en: "This item cannot be selected. Please choose again.", "zh-CN": "该项目无法选择。请重新选择。", ja: "選択できない項目です。もう一度選択してください。", vi: "Muc nay khong the chon. Vui long chon lai.", de: "Dieser Eintrag kann nicht ausgewahlt werden. Bitte wahlen Sie erneut.", fr: "Cet element ne peut pas etre selectionne. Veuillez choisir a nouveau." }, description: "유효하지 않은 버튼이나 선택지가 입력되었을 때 출력합니다." },
    { message_key: "generic_select", message_name: "기본 선택 안내", category: "input", message_text: "선택하세요.", translations: { ko: "선택하세요.", en: "Please select.", "zh-CN": "请选择。", ja: "選択してください。", vi: "Vui long chon.", de: "Bitte auswahlen.", fr: "Veuillez selectionner." }, description: "버튼형 메시지에 안내 문구가 없을 때 출력합니다." },
    { message_key: "table_select", message_name: "테이블 선택 안내", category: "input", message_text: "아래 중 선택하세요.", translations: { ko: "아래 중 선택하세요.", en: "Please choose one of the options below.", "zh-CN": "请从下面选择。", ja: "以下から選択してください。", vi: "Vui long chon mot muc ben duoi.", de: "Bitte wahlen Sie eine der folgenden Optionen aus.", fr: "Veuillez choisir une option ci-dessous." }, description: "테이블형 메시지에 안내 문구가 없을 때 출력합니다." },
    { message_key: "runtime_flow_error", message_name: "대화 흐름 설정 오류 메시지", category: "error", message_text: "대화 흐름 설정 오류로 대화를 계속할 수 없습니다.", translations: { ko: "대화 흐름 설정 오류로 대화를 계속할 수 없습니다.", en: "The conversation cannot continue because of a dialog flow configuration error.", "zh-CN": "由于对话流程配置错误，无法继续对话。", ja: "対話フロー設定エラーのため、会話を続行できません。", vi: "Khong the tiep tuc hoi thoai do loi cau hinh luong hoi thoai.", de: "Das Gesprach kann aufgrund eines Konfigurationsfehlers im Dialogfluss nicht fortgesetzt werden.", fr: "La conversation ne peut pas continuer en raison d'une erreur de configuration du flux de dialogue." }, description: "Condition, 연결선, 실행 카드 등 대화 흐름 설정 오류가 발생했을 때 출력합니다." },
    { message_key: "runtime_module_not_found", message_name: "대화 모듈 연결 오류 메시지", category: "error", message_text: "연결할 대화 모듈을 찾지 못했습니다.", translations: { ko: "연결할 대화 모듈을 찾지 못했습니다.", en: "The dialog module to connect could not be found.", "zh-CN": "找不到要连接的对话模块。", ja: "接続する対話モジュールが見つかりません。", vi: "Khong tim thay mo-dun hoi thoai de ket noi.", de: "Das zu verbindende Dialogmodul wurde nicht gefunden.", fr: "Le module de dialogue a connecter est introuvable." }, description: "Jump 카드가 연결할 대화 모듈을 찾지 못했을 때 출력합니다." },
    { message_key: "runtime_flow_limit", message_name: "대화 흐름 실행 한도 초과 메시지", category: "error", message_text: "대화 흐름 실행 한도를 초과했습니다.", translations: { ko: "대화 흐름 실행 한도를 초과했습니다.", en: "The dialog flow execution limit has been exceeded.", "zh-CN": "已超过对话流程执行限制。", ja: "対話フローの実行上限を超えました。", vi: "Da vuot qua gioi han thuc thi luong hoi thoai.", de: "Das Ausfuhrungslimit fur den Dialogfluss wurde uberschritten.", fr: "La limite d'execution du flux de dialogue a ete depassee." }, description: "대화 흐름이 비정상적으로 반복되어 실행 한도를 초과했을 때 출력합니다." },
    { message_key: "system_error", message_name: "시스템 오류 메시지", category: "error", message_text: "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", translations: { ko: "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", en: "An error occurred while processing. Please try again later.", "zh-CN": "处理过程中发生错误。请稍后再试。", ja: "処理中にエラーが発生しました。しばらくしてからもう一度お試しください。", vi: "Da xay ra loi trong qua trinh xu ly. Vui long thu lai sau.", de: "Bei der Verarbeitung ist ein Fehler aufgetreten. Bitte versuchen Sie es spater erneut.", fr: "Une erreur s'est produite pendant le traitement. Veuillez reessayer plus tard." }, description: "API 또는 시스템 오류가 발생했을 때 출력합니다." },
    { message_key: "timeout", message_name: "타임아웃 메시지", category: "session", message_text: "응답 시간이 초과되었습니다. 처음부터 다시 진행해주세요.", translations: { ko: "응답 시간이 초과되었습니다. 처음부터 다시 진행해주세요.", en: "The response time has expired. Please start again from the beginning.", "zh-CN": "响应时间已超时。请从头重新开始。", ja: "応答時間がタイムアウトしました。最初からやり直してください。", vi: "Da het thoi gian phan hoi. Vui long bat dau lai tu dau.", de: "Die Antwortzeit wurde uberschritten. Bitte beginnen Sie erneut von vorne.", fr: "Le delai de reponse est depasse. Veuillez recommencer depuis le debut." }, description: "대화 타임아웃 발생 시 출력합니다." },
    { message_key: "session_end", message_name: "세션 종료 메시지", category: "session", message_text: "대화가 종료되었습니다.", translations: { ko: "대화가 종료되었습니다.", en: "The conversation has ended.", "zh-CN": "对话已结束。", ja: "会話が終了しました。", vi: "Cuoc hoi thoai da ket thuc.", de: "Das Gesprach wurde beendet.", fr: "La conversation est terminee." }, description: "세션 종료 시 출력합니다." },
    { message_key: "conversation_in_progress", message_name: "진행 중 대화 안내", category: "session", message_text: "진행 중인 대화가 있습니다. 현재 대화를 먼저 완료해주세요.", translations: { ko: "진행 중인 대화가 있습니다. 현재 대화를 먼저 완료해주세요.", en: "There is already a conversation in progress. Please finish the current conversation first.", "zh-CN": "已有正在进行中的对话。请先完成当前对话。", ja: "進行中の会話があります。先に現在の会話を完了してください。", vi: "Dang co cuoc hoi thoai dang dien ra. Vui long hoan tat cuoc hoi thoai hien tai truoc.", de: "Es gibt bereits ein laufendes Gesprach. Bitte schliessen Sie zuerst das aktuelle Gesprach ab.", fr: "Une conversation est deja en cours. Veuillez d'abord terminer la conversation actuelle." }, description: "이미 진행 중인 대화가 있을 때 출력합니다." },
    { message_key: "bot_connected", message_name: "봇 연결 안내 메시지", category: "runtime", message_text: "{botName}에 연결되었습니다.", translations: { ko: "{botName}에 연결되었습니다.", en: "You are connected to {botName}.", "zh-CN": "已连接到 {botName}。", ja: "{botName} に接続されました。", vi: "Da ket noi voi {botName}.", de: "Sie sind mit {botName} verbunden.", fr: "Vous etes connecte a {botName}." }, description: "WebChat 채팅방이 열릴 때 초기 안내로 출력합니다." },
    { message_key: "session_end_processing", message_name: "세션 종료 처리 메시지", category: "runtime", message_text: "상담 세션을 종료합니다.", translations: { ko: "상담 세션을 종료합니다.", en: "The chat session will be closed.", "zh-CN": "即将结束会话。", ja: "会話セッションを終了します。", vi: "Dang ket thuc phien tro chuyen.", de: "Die Chatsitzung wird beendet.", fr: "La session de discussion va etre fermee." }, description: "사용자 종료 요청으로 세션을 닫는 순간 출력합니다." }
  ];
}

function createDefaultMessageId(messageKey, language) {
  return `dm-${String(messageKey || "").replace(/[^a-z0-9_-]/gi, "-")}-${String(language || "ko").replace(/[^a-z0-9_-]/gi, "-")}`;
}

function buildDefaultMessageSeedItems(stamp) {
  return createDefaultMessageDefinitions().flatMap((item) => DEFAULT_MESSAGE_LANGUAGES.map((language) => ({
    id: createDefaultMessageId(item.message_key, language),
    message_key: item.message_key,
    message_name: item.message_name,
    category: item.category,
    category_label: getDefaultMessageCategoryLabel(item.category),
    language,
    scope: "global",
    scope_label: "전체",
    message_text: getDefaultMessageSeedText(item, language),
    default_message_text: getDefaultMessageSeedText(item, language),
    is_modified: false,
    description: item.description,
    status: "active",
    status_label: "사용",
    updated_at: stamp,
    updated_by: "SYSTEM",
    updater_name: "SYSTEM",
    protected: true,
    data_json: {}
  })));
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
  ].map(([id, name, description]) => ({
    id,
    kind: "system",
    name,
    value: "",
    description,
    updated_at: stamp,
    updated_by: "SYSTEM",
    updater_name: "SYSTEM",
    data_json: {}
  }));
  const defaultMessageStamp = "2026-06-11T07:02:10.000Z";
  const default_messages = buildDefaultMessageSeedItems(defaultMessageStamp);
  const channels = [
    ["ch-sm-chat", "SM_CHAT", "Simulator", "simulator", "simulator", "none"],
    ["ch-webchat", "WEBCHAT", "Webchat", "webchat", "webchat", "none"],
    ["ch-kakao", "KAKAO", "Kakao", "kakao", "kakao", "token"],
    ["ch-teams", "TEAMS", "MS Teams", "ms_teams", "adaptive_card", "oauth"]
  ].map(([id, channel_code, channel_name, provider, renderer_type, auth_type]) => ({ id, channel_code, channel_name, provider, renderer_type, auth_type, status: "Y", status_label: "사용", creator_name: "SYSTEM", updater_name: "SYSTEM", created_by: "SYSTEM", updated_at: stamp, updated_by: "SYSTEM" }));
  const botstation_links = [
    {
      id: "bs-support-webchat",
      bot_id: "supportbot-draft",
      bot_name: "SupportBot Draft",
      group_id: "g-support",
      group_name: "Support Bot Group",
      channel_code: "WEBCHAT",
      channel_name: "Webchat",
      operating_version: "v0.1",
      active_channels: 1,
      status: "active",
      status_label: "Active",
      issue_message: "정상 연결",
      updated_at: "2026-06-18T09:10:00.000Z",
      updated_by: "SYSTEM",
      updater_name: "SYSTEM",
      data_json: {}
    },
    {
      id: "bs-faq-kakao",
      bot_id: "faqbot-v1",
      bot_name: "FAQ Bot v1",
      group_id: "g-support",
      group_name: "Support Bot Group",
      channel_code: "KAKAO",
      channel_name: "Kakao",
      operating_version: "v1.0",
      active_channels: 1,
      status: "active",
      status_label: "Active",
      issue_message: "정상 연결",
      updated_at: "2026-06-17T13:25:00.000Z",
      updated_by: "SYSTEM",
      updater_name: "SYSTEM",
      data_json: {}
    },
    {
      id: "bs-ops-teams",
      bot_id: "ops-assistant",
      bot_name: "Ops Assistant",
      group_id: "g-ops",
      group_name: "Operations Group",
      channel_code: "TEAMS",
      channel_name: "MS Teams",
      operating_version: "v0.3",
      active_channels: 0,
      status: "inactive",
      status_label: "Inactive",
      issue_message: "채널 연결 정보 확인 필요",
      updated_at: "2026-06-16T08:40:00.000Z",
      updated_by: "system",
      updater_name: "system",
      data_json: {}
    }
  ];
  const licenses = [
    { id: "lic-user", category: "사용자", total: 120, used: 4, remaining: 116, expires_at: "2026-12-31", status: "정상" },
    { id: "lic-bot", category: "봇", total: 30, used: 13, remaining: 17, expires_at: "2026-12-31", status: "정상" },
    { id: "lic-api", category: "API", total: 50, used: 5, remaining: 45, expires_at: "2026-12-31", status: "정상" }
  ];
  return { version: 1, templates, common_variables, default_messages, channels, botstation_links, licenses };
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
  const normalizedCommonVariables = mergeDefaultCollection(next.common_variables, defaults.common_variables).map((item) => {
    const kind = item.kind || (item.category === "시스템" ? "system" : "user");
    return {
      ...item,
      kind,
      value: item.value ?? "",
      description: item.description || "",
      updated_by: item.updated_by || item.updater_name || "SYSTEM",
      updater_name: item.updater_name || item.updated_by || "SYSTEM",
      data_json: item.data_json && typeof item.data_json === "object" ? item.data_json : {}
    };
  });
  const defaultMessageDefinitions = new Map(createDefaultMessageDefinitions().map((item) => [item.message_key, item]));
  const defaultMessagesByComposite = new Map(buildDefaultMessageSeedItems("2026-06-11T07:02:10.000Z").map((item) => [`${item.message_key}:${item.language}`, item]));
  const existingDefaultMessages = Array.isArray(next.default_messages) ? next.default_messages : [];
  const normalizedDefaultMessageMap = new Map();
  defaultMessagesByComposite.forEach((seed, compositeKey) => {
    const existing = existingDefaultMessages.find((item) => {
      const messageKey = item.message_key || item.key;
      const language = item.language || "ko";
      return `${messageKey}:${language}` === compositeKey;
    });
    const selected = existing || seed;
    const definition = defaultMessageDefinitions.get(seed.message_key);
    const seedDefaultText = getDefaultMessageSeedText(definition, seed.language) || seed.default_message_text || "";
    const existingDefaultText = selected.default_message_text || "";
    const selectedMessageText = selected.message_text || selected.message || "";
    const messageText = !existing
      ? (selectedMessageText || seedDefaultText)
      : (selectedMessageText && selectedMessageText !== existingDefaultText ? selectedMessageText : seedDefaultText);
    const status = selected.status === "inactive" || selected.status === "N" ? "inactive" : "active";
    normalizedDefaultMessageMap.set(compositeKey, {
      ...seed,
      ...selected,
      id: selected.id || seed.id,
      message_key: seed.message_key,
      message_name: selected.message_name || selected.name || seed.message_name,
      category: selected.category || seed.category,
      category_label: getDefaultMessageCategoryLabel(selected.category || seed.category),
      language: selected.language || seed.language,
      scope: selected.scope === "group" ? "group" : "global",
      scope_label: selected.scope === "group" ? "그룹" : "전체",
      message_text: messageText,
      default_message_text: seedDefaultText,
      is_modified: messageText !== seedDefaultText,
      description: selected.description || seed.description || "",
      status,
      status_label: status === "active" ? "사용" : "미사용",
      updated_by: selected.updated_by || selected.updater_name || seed.updated_by || "SYSTEM",
      updater_name: selected.updater_name || selected.updated_by || seed.updater_name || "SYSTEM",
      protected: true,
      data_json: selected.data_json && typeof selected.data_json === "object" ? selected.data_json : {}
    });
  });
  return {
    version: 1,
    templates: mergeDefaultCollection(next.templates, defaults.templates),
    common_variables: normalizedCommonVariables,
    default_messages: [...normalizedDefaultMessageMap.values()],
    channels: mergeDefaultCollection(next.channels, defaults.channels),
    botstation_links: mergeDefaultCollection(next.botstation_links, defaults.botstation_links),
    licenses: mergeDefaultCollection(next.licenses, defaults.licenses, "id", { replaceSeedItems: true, keepExtraItems: false })
  };
}

function loadAdminResources() {
  const resources = normalizeAdminResources(loadStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.adminResources,
    filePath: adminResourcesFile,
    fallback: null
  }));
  saveStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.adminResources,
    filePath: adminResourcesFile,
    payload: resources
  });
  return resources;
}

function saveAdminResources(resources) {
  adminResources = normalizeAdminResources(resources);
  saveStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.adminResources,
    filePath: adminResourcesFile,
    payload: adminResources
  });
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
  const stored = loadStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.authCredentials,
    filePath: authCredentialsFile,
    fallback: null
  });
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
  saveStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.authCredentials,
    filePath: authCredentialsFile,
    payload: seeded
  });
  return seeded;
}

function saveAuthCredentials(credentials) {
  saveStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.authCredentials,
    filePath: authCredentialsFile,
    payload: credentials
  });
  return credentials;
}

function loadAuthSessions() {
  const stored = loadStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.authSessions,
    filePath: authSessionsFile,
    fallback: null
  });
  if (stored && typeof stored === "object" && stored.sessions && typeof stored.sessions === "object") return stored;
  return { version: 1, sessions: {} };
}

function saveAuthSessions(sessions) {
  saveStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.authSessions,
    filePath: authSessionsFile,
    payload: sessions
  });
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
  const history = loadStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.assetTransferHistory,
    filePath: assetTransferHistoryFile,
    fallback: []
  });
  return Array.isArray(history) ? history : [];
}

function recordAssetTransfer(entry) {
  assetTransferHistory = [...assetTransferHistory, entry];
  saveStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.assetTransferHistory,
    filePath: assetTransferHistoryFile,
    payload: assetTransferHistory
  });
}

async function loadAccessState() {
  if (accessState) return accessState;
  const accessStateModule = await import("../packages/public-core/src/access-state.js");
  const stored = loadStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.accessState,
    filePath: accessStateFile,
    fallback: null
  });
  const loaded = stored && typeof stored === "object" ? stored : accessStateModule.createSampleAccessState();
  const normalized = accessStateModule.normalizeAccessState(loaded);
  accessState = normalized;
  if (JSON.stringify(normalized) !== JSON.stringify(loaded)) {
    saveStoredCollection({
      collectionKey: STORAGE_COLLECTION_KEYS.accessState,
      filePath: accessStateFile,
      payload: normalized
    });
  }
  return accessState;
}

function saveAccessState(state) {
  accessState = state;
  saveStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.accessState,
    filePath: accessStateFile,
    payload: state
  });
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
  const registry = loadStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.apiAnswerRegistry,
    filePath: apiAnswerRegistryFile,
    fallback: []
  });
  return Array.isArray(registry) ? registry : [];
}

function saveApiAnswerRegistry(registry) {
  apiAnswerRegistry = registry;
  saveStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.apiAnswerRegistry,
    filePath: apiAnswerRegistryFile,
    payload: registry
  });
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
  const bots = loadStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.workspaceBots,
    filePath: workspaceBotsFile,
    fallback: null
  });
  return Array.isArray(bots) ? bots : createDefaultWorkspaceBots();
}

function saveWorkspaceBots(bots) {
  workspaceBots = bots;
  saveStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.workspaceBots,
    filePath: workspaceBotsFile,
    payload: bots
  });
  return bots;
}

function loadStudioStateRegistry() {
  const registry = loadStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.studioStateRegistry,
    filePath: studioStateRegistryFile,
    fallback: []
  });
  return Array.isArray(registry) ? registry : [];
}

function saveStudioStateRegistry(registry) {
  studioStateRegistry = registry;
  saveStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.studioStateRegistry,
    filePath: studioStateRegistryFile,
    payload: registry
  });
  return registry;
}

function extractImportedBotMeta(bodyText, { groupId, botId, botLocale }) {
  let parsed;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return null;
  }
  const packageBody = parsed?.package || parsed;
  const botVo = packageBody?.botVo;
  if (!botVo || typeof botVo !== "object") return null;
  return {
    id: botId,
    group_id: groupId,
    name: String(botVo.botName || botVo.name || "Imported Bot"),
    version: String(botVo.versionName || botVo.version || "v0.1"),
    locale: String(botVo.defaultLanguage || botVo.defaultLocale || botVo.locale || botLocale || "en"),
    description: String(botVo.description || "")
  };
}

function upsertWorkspaceBotFromImportedPackage(bodyText, { groupId, botId, botLocale }) {
  const importedBot = extractImportedBotMeta(bodyText, { groupId, botId, botLocale });
  if (!importedBot) return null;
  const existingIndex = workspaceBots.findIndex((item) => item.group_id === groupId && item.id === botId);
  const nextBot = {
    ...(existingIndex >= 0 ? workspaceBots[existingIndex] : {}),
    ...importedBot,
    status: existingIndex >= 0 ? (workspaceBots[existingIndex].status || "draft") : "draft",
    updated_at: new Date().toISOString().slice(0, 10)
  };
  saveWorkspaceBots(existingIndex >= 0
    ? workspaceBots.map((item, index) => (index === existingIndex ? nextBot : item))
    : [...workspaceBots, nextBot]);
  const existingStudioState = studioStateRegistry.find((item) => item.group_id === groupId && item.bot_id === botId);
  const nextStudioState = {
    ...(existingStudioState?.state || createDefaultStudioStateForBot(groupId, botId)),
    bot: {
      ...(existingStudioState?.state?.bot || createDefaultStudioStateForBot(groupId, botId).bot),
      id: botId,
      name: nextBot.name,
      description: importedBot.description,
      version: nextBot.version,
      defaultLocale: nextBot.locale
    }
  };
  saveStudioStateRegistry([
    ...studioStateRegistry.filter((item) => !(item.group_id === groupId && item.bot_id === botId)),
    {
      group_id: groupId,
      bot_id: botId,
      state: nextStudioState,
      updated_at: new Date().toISOString()
    }
  ]);
  return nextBot;
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
  const registry = loadStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.compositionRegistry,
    filePath: compositionRegistryFile,
    fallback: []
  });
  return Array.isArray(registry) ? registry : [];
}

function saveCompositionRegistry(registry) {
  compositionRegistry = registry;
  saveStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.compositionRegistry,
    filePath: compositionRegistryFile,
    payload: registry
  });
  return registry;
}

function loadDetailAssetRegistry() {
  const registry = loadStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.detailAssetRegistry,
    filePath: detailAssetRegistryFile,
    fallback: []
  });
  return Array.isArray(registry) ? registry : [];
}

function saveDetailAssetRegistry(registry) {
  detailAssetRegistry = registry;
  saveStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.detailAssetRegistry,
    filePath: detailAssetRegistryFile,
    payload: registry
  });
  return registry;
}

function loadOperationsStateRegistry() {
  const registry = loadStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.operationsStateRegistry,
    filePath: operationsStateRegistryFile,
    fallback: []
  });
  return Array.isArray(registry) ? registry : [];
}

function saveOperationsStateRegistry(registry) {
  operationsStateRegistry = registry;
  saveStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.operationsStateRegistry,
    filePath: operationsStateRegistryFile,
    payload: registry
  });
  return registry;
}

function loadCollaborationStateRegistry() {
  const registry = loadStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.collaborationStateRegistry,
    filePath: collaborationStateRegistryFile,
    fallback: []
  });
  return Array.isArray(registry) ? registry : [];
}

function saveCollaborationStateRegistry(registry) {
  collaborationStateRegistry = registry;
  saveStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.collaborationStateRegistry,
    filePath: collaborationStateRegistryFile,
    payload: registry
  });
  return registry;
}

function loadWebchatRooms() {
  const rooms = loadStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.webchatRooms,
    filePath: webchatRoomsFile,
    fallback: []
  });
  return Array.isArray(rooms) ? rooms.map(normalizeWebchatRoomRecord) : [];
}

function saveWebchatRooms(rooms) {
  webchatRooms = Array.isArray(rooms) ? rooms.map(normalizeWebchatRoomRecord) : [];
  saveStoredCollection({
    collectionKey: STORAGE_COLLECTION_KEYS.webchatRooms,
    filePath: webchatRoomsFile,
    payload: rooms
  });
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
    blocklists: [
      { name: "아", type: "0", pattern: "아", enabled: "Y" },
      { name: "일단", type: "0", pattern: "일단", enabled: "Y" }
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
  const restoreMatch = urlPath.match(/^\/api\/cga\/admin\/(default-messages)\/([^/]+)\/restore$/);
  if (restoreMatch) return { resource: restoreMatch[1], id: restoreMatch[2], action: "restore" };
  const itemMatch = urlPath.match(/^\/api\/cga\/admin\/(templates|common-variables|default-messages|channels|botstation-links)\/([^/]+)$/);
  if (itemMatch) return { resource: itemMatch[1], id: itemMatch[2] };
  return null;
}

function parseAidotAdminHistoryPath(urlPath) {
  if (urlPath === "/api/v1/admin/conversations") return { resource: "conversations" };
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
      blocklists: Array.isArray(body.blocklists) ? body.blocklists : [],
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
      if (parsed.resource === "default-messages") {
        sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
        return true;
      }
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
  const kind = String(query.get("kind") || "").trim().toLowerCase();
  const category = String(query.get("category") || "").trim().toLowerCase();
  const language = String(query.get("language") || "").trim().toLowerCase();
  return items.filter((item) => {
    const haystack = [
      item.name,
      item.message_name,
      item.key,
      item.message_key,
      item.category,
      item.category_label,
      item.kind,
      item.value,
      item.description,
      item.message,
      item.message_text,
      item.language,
      item.channel_code,
      item.channel_name,
      item.provider,
      item.renderer_type,
      item.station_name,
      item.endpoint_url
    ].filter(Boolean).join(" ").toLowerCase();
    const matchesKeyword = !keyword || haystack.includes(keyword);
    const matchesChannel = !channel || String(item.channel_name || item.channel_code || "").toLowerCase().includes(channel);
    const matchesStatus = !status || status === "all" || item.status === status || item.status_label === status || (status === "active" && item.status === "Y");
    const matchesKind = resource !== "common-variables" || !kind || String(item.kind || "").toLowerCase() === kind;
    const matchesCategory = resource !== "default-messages" || !category || String(item.category || "").toLowerCase() === category;
    const matchesLanguage = resource !== "default-messages" || !language || String(item.language || "").toLowerCase() === language;
    return matchesKeyword && matchesChannel && matchesStatus && matchesKind && matchesCategory && matchesLanguage;
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
      kind: existing?.kind || "user",
      name,
      value: body.value ?? existing?.value ?? "",
      description: body.description || existing?.description || "",
      updated_at: now,
      updated_by: body.updated_by || "admin",
      updater_name: body.updater_name || body.updated_by || "admin",
      data_json: existing?.data_json && typeof existing.data_json === "object" ? existing.data_json : {}
    };
  }
  if (resource === "default-messages") {
    const fallbackDefaultText = existing?.default_message_text
      || getDefaultMessageSeedText(
        createDefaultMessageDefinitions().find((item) => item.message_key === (existing?.message_key || body.message_key)),
        existing?.language || "ko"
      );
    const name = String(body.message_name ?? body.name ?? existing?.message_name ?? existing?.name ?? "").trim();
    const status = existing?.status === "inactive" ? "inactive" : "active";
    return {
      ...(existing || {}),
      ...body,
      id: existing?.id || body.id || createAdminId("dm"),
      message_name: existing?.message_name || existing?.name || name,
      message_key: existing?.message_key || existing?.key || name,
      category: existing?.category || "intent",
      category_label: getDefaultMessageCategoryLabel(existing?.category || "intent"),
      language: existing?.language || "ko",
      scope: existing?.scope || "global",
      scope_label: existing?.scope === "group" ? "그룹" : "전체",
      message_text: body.message_text ?? body.message ?? existing?.message_text ?? existing?.message ?? "",
      default_message_text: fallbackDefaultText,
      is_modified: Boolean((body.message_text ?? body.message ?? existing?.message_text ?? existing?.message ?? "") !== fallbackDefaultText),
      description: body.description ?? existing?.description ?? "",
      status,
      status_label: status === "active" ? "사용" : "미사용",
      updated_at: now,
      updated_by: body.updated_by || "admin",
      updater_name: body.updater_name || body.updated_by || "admin",
      protected: true,
      data_json: existing?.data_json && typeof existing.data_json === "object" ? existing.data_json : {}
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
      if (parsed.resource === "common-variables" && !String(body.value ?? "").trim()) {
        sendJson(res, 400, { error_code: "CGA_COMMON_VARIABLE_VALUE_REQUIRED", message_key: "errors.admin.resourceValueRequired" });
        return true;
      }
      if (parsed.resource === "common-variables") {
        const duplicated = collection.find((item) => item.name === name && item.kind === "system");
        if (duplicated) {
          sendJson(res, 400, { error_code: "CGA_COMMON_VARIABLE_SYSTEM_NAME_CONFLICT", message_key: "errors.admin.resourceSystemConflict" });
          return true;
        }
        const existingUserVariable = collection.find((item) => item.name === name && item.kind === "user");
        if (existingUserVariable) {
          const nextItems = collection.map((item) => item.id === existingUserVariable.id ? normalizeAdminResourcePayload(parsed.resource, body, item) : item);
          saveAdminResources({ ...adminResources, [collectionKey]: nextItems });
          sendJson(res, 200, nextItems.find((item) => item.id === existingUserVariable.id));
          return true;
        }
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
  if (parsed.resource === "default-messages" && parsed.action === "restore") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
      return true;
    }
    const definition = createDefaultMessageDefinitions().find((item) => item.message_key === target.message_key);
    const nextItems = collection.map((item) => {
      if (item.id !== parsed.id) return item;
      const defaultMessageText = getDefaultMessageSeedText(definition, item.language || "ko") || item.default_message_text || item.message_text || "";
      return normalizeAdminResourcePayload(parsed.resource, {
        message_text: defaultMessageText,
        description: definition?.description || item.description || ""
      }, {
        ...item,
        message_text: defaultMessageText,
        default_message_text: defaultMessageText
      });
    });
    saveAdminResources({ ...adminResources, [collectionKey]: nextItems });
    sendJson(res, 200, nextItems.find((item) => item.id === parsed.id));
    return true;
  }
  if (req.method === "PUT" || req.method === "PATCH") {
    if (parsed.resource === "common-variables" && target.kind === "system") {
      sendJson(res, 400, { error_code: "CGA_COMMON_VARIABLE_SYSTEM_READ_ONLY", message_key: "errors.admin.resourceReadOnly" });
      return true;
    }
    if (parsed.resource === "default-messages") {
      const body = await readJsonRequest(req);
      const nextItems = collection.map((item) => item.id === parsed.id ? normalizeAdminResourcePayload(parsed.resource, body, item) : item);
      saveAdminResources({ ...adminResources, [collectionKey]: nextItems });
      sendJson(res, 200, nextItems.find((item) => item.id === parsed.id));
      return true;
    }
    const body = await readJsonRequest(req);
    if (parsed.resource === "common-variables" && !String(body.value ?? target.value ?? "").trim()) {
      sendJson(res, 400, { error_code: "CGA_COMMON_VARIABLE_VALUE_REQUIRED", message_key: "errors.admin.resourceValueRequired" });
      return true;
    }
    const nextItems = collection.map((item) => item.id === parsed.id ? normalizeAdminResourcePayload(parsed.resource, body, item) : item);
    saveAdminResources({ ...adminResources, [collectionKey]: nextItems });
    sendJson(res, 200, nextItems.find((item) => item.id === parsed.id));
    return true;
  }
  if (req.method === "DELETE") {
    if (parsed.resource === "default-messages") {
      sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
      return true;
    }
    if (parsed.resource === "common-variables" && target.kind === "system") {
      sendJson(res, 400, { error_code: "CGA_COMMON_VARIABLE_SYSTEM_READ_ONLY", message_key: "errors.admin.resourceReadOnly" });
      return true;
    }
    saveAdminResources({ ...adminResources, [collectionKey]: collection.filter((item) => item.id !== parsed.id) });
    sendJson(res, 200, { deleted: true, id: parsed.id });
    return true;
  }
  sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
  return true;
}

async function handleAidotAdminHistoryApi(req, res, urlPath, query) {
  const parsed = parseAidotAdminHistoryPath(urlPath);
  if (!parsed) return false;
  if (req.method !== "GET") {
    sendJson(res, 405, { error_code: "CGA_METHOD_NOT_ALLOWED", message_key: "errors.http.methodNotAllowed" });
    return true;
  }
  if (parsed.resource === "conversations") {
    const items = listAdminConversationHistoryItems(query);
    sendJson(res, 200, { items, total: items.length });
    return true;
  }
  return false;
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
      { type: "text", text: getDefaultMessageText("bot_connected", bot.locale || "ko", { botName: bot.name }) }
    ]
  };
}

function getWebchatBots() {
  return workspaceBots
    .filter((bot) => bot.status !== "deleted")
    .map((bot) => ({ ...bot, slug: bot.slug || bot.id }));
}

function getWorkspaceBot(botId) {
  return workspaceBots.find((item) => item.id === botId) || null;
}

function interpolateDefaultMessage(text, values = {}) {
  let next = String(text || "");
  Object.entries(values).forEach(([key, value]) => {
    next = next.replaceAll(`{${key}}`, String(value ?? ""));
  });
  return next;
}

function getDefaultMessageText(messageKey, language = "ko", values = {}) {
  const messages = Array.isArray(adminResources.default_messages) ? adminResources.default_messages : [];
  const exact = messages.find((item) => item.message_key === messageKey && item.language === language);
  const fallbackKo = messages.find((item) => item.message_key === messageKey && item.language === "ko");
  const selected = exact || fallbackKo;
  const raw = selected?.message_text || createDefaultMessageDefinitions().find((item) => item.message_key === messageKey)?.message_text || "";
  return interpolateDefaultMessage(raw, values);
}

function getVersionNo(value) {
  const match = String(value || "").match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function createConversationHistoryItemFromRoom(room) {
  const bot = getWorkspaceBot(room.bot_id) || getWebchatBotBySlug(room.bot_slug) || {};
  const history = ensureRoomConversationHistory(room);
  const groupName = getBotGroupName(bot.group_id || room.group_id) || bot.group_id || room.group_id || "";
  const runtimeEvents = Array.isArray(history.runtime_events) ? [...history.runtime_events] : [];
  const latestProblemEvent = history.latest_error_message
    ? {
        level: "error",
        message: history.latest_error_message,
        source: "webchat-runtime"
      }
    : {};
  const runtimeDiagnostics = {
    dialog_ended: history.dialog_ended,
    session_ended: history.session_ended,
    completion_reason: history.completion_reason || "",
    latest_intent_name: history.latest_intent_name || "",
    compatibility_status: history.compatibilityStatus || "compatible"
  };
  const runtimeSummary = history.latest_error_message
    || history.completion_reason
    || history.latest_queue_status
    || room.status
    || "open";
  return {
    id: room.id,
    group_name: groupName,
    channel_name: "Webchat",
    bot_name: bot.name || room.bot_slug || room.bot_id || "",
    version_no: getVersionNo(room.bot_version_id || bot.version),
    user_key: history.participant_name || history.participant_id || "visitor",
    intent_or_module_name: history.latest_intent_name || "",
    uttered_at: history.started_at || room.created_at || room.updated_at || new Date().toISOString(),
    result: history.completion_reason || (history.session_ended ? "session_ended" : history.dialog_ended ? "dialog_ended" : room.status || "open"),
    data_json: {
      contract_version: history.contractVersion || room.contract_version || "v1.0",
      compatibility_status: history.compatibilityStatus || "compatible",
      pruned_features: Array.isArray(history.prunedFeatures) ? [...history.prunedFeatures] : [],
      session_started_at: history.started_at || "",
      session_ended_at: history.ended_at || "",
      session_end_reason: history.session_end_reason || "",
      session_message_count: Number(history.message_count || 0),
      session_user_message_count: Number(history.user_message_count || 0),
      session_user_utterances: Array.isArray(history.user_utterances) ? [...history.user_utterances] : [],
      session_user_raw_utterances: Array.isArray(history.user_raw_utterances) ? [...history.user_raw_utterances] : [],
      session_first_user_utterance: history.first_user_utterance || "",
      session_ended: history.session_ended === true,
      dialog_ended: history.dialog_ended === true,
      completion_reason: history.completion_reason || "",
      room_id: history.room_id || room.id || "",
      client_room_id: history.client_room_id || room.client_room_id || room.id || "",
      room_status: history.room_status || room.status || "open",
      queue_event_id: history.latest_queue_event_id || "",
      runtime_summary: runtimeSummary,
      runtime_diagnostics: runtimeDiagnostics,
      runtime_events: runtimeEvents,
      messages: Array.isArray(room.messages) ? room.messages.map((message) => serializeAdminConversationMessage(message)).filter(Boolean) : [],
      conversation_history: structuredClone(history),
      transcript: Array.isArray(history.transcript) ? [...history.transcript] : [],
      latest_problem_event: latestProblemEvent,
      problem_location: history.latest_error_message ? "runtime" : ""
    }
  };
}

function createConversationHistoryItemFromSimulator(entry) {
  const test = entry?.test || {};
  if (!test.last_run_at) return null;
  const bot = getWorkspaceBot(entry.bot_id) || {};
  const groupName = getBotGroupName(entry.group_id) || entry.group_id || "";
  const transcript = [
    {
      participant_kind: "user",
      participant_id: "simulator-user",
      participant_name: "Simulator User",
      text: String(test.last_user_message || ""),
      created_at: test.last_run_at,
      display_text: String(test.last_user_message || "")
    },
    {
      participant_kind: "bot",
      participant_id: entry.bot_id,
      participant_name: bot.name || entry.bot_id || "",
      text: String(test.last_bot_message || ""),
      created_at: test.last_run_at,
      display_text: String(test.last_bot_message || "")
    }
  ];
  const simulatorRoomId = `simulator:${entry.group_id}:${entry.bot_id}`;
  const runtimeEvents = createMatchedRuntimeEvents({
    userMessage: String(test.last_user_message || ""),
    botMessage: String(test.last_bot_message || ""),
    intentName: String(test.matched_intent || "matched"),
    similarity: Number(test.similarity || 0),
    queueEventId: `${simulatorRoomId}:${test.last_run_at}`,
    timestamp: test.last_run_at,
    sourceNodeId: "simulator-talk-1",
    nextNodeId: "simulator-end-1"
  });
  return {
    id: `${simulatorRoomId}:${test.last_run_at}`,
    group_name: groupName,
    channel_name: "Simulator",
    bot_name: bot.name || entry.bot_id || "",
    version_no: getVersionNo(bot.version),
    user_key: "Simulator User",
    intent_or_module_name: String(test.matched_intent || ""),
    uttered_at: test.last_run_at,
    result: String(test.method || "simulator"),
    data_json: {
      contract_version: "v1.0",
      compatibility_status: "compatible",
      pruned_features: [],
      session_started_at: test.last_run_at,
      session_ended_at: "",
      session_end_reason: "",
      session_message_count: 2,
      session_user_message_count: 1,
      session_user_utterances: [String(test.last_user_message || "")],
      session_user_raw_utterances: [String(test.last_user_message || "")],
      session_first_user_utterance: String(test.last_user_message || ""),
      session_ended: false,
      dialog_ended: true,
      completion_reason: "matched",
      room_id: simulatorRoomId,
      client_room_id: simulatorRoomId,
      queue_event_id: `${simulatorRoomId}:${test.last_run_at}`,
      runtime_summary: String(test.matched_intent || "matched"),
      runtime_diagnostics: {
        dialog_ended: true,
        session_ended: false,
        completion_reason: "matched",
        latest_intent_name: String(test.matched_intent || ""),
        similarity: Number(test.similarity || 0),
        latency_ms: Number(test.latency_ms || 0)
      },
      runtime_events: runtimeEvents,
      messages: transcript.map((message, index) => ({
        id: index === 0 ? `sim-user:${entry.bot_id}` : `sim-bot:${entry.bot_id}`,
        ...message,
        message_type: "text",
        payload_json: {}
      })),
      conversation_history: {
        contractVersion: "v1.0",
        sourceProductVersion: "aidot-1.1",
        compatibilityStatus: "compatible",
        prunedFeatures: [],
        session_id: simulatorRoomId,
        room_id: simulatorRoomId,
        client_room_id: simulatorRoomId,
        participant_id: "simulator-user",
        participant_name: "Simulator User",
        channel_type: "simulator",
        room_status: "closed",
        bot_id: entry.bot_id,
        bot_version_id: bot.version || "v0.1",
        started_at: test.last_run_at,
        first_user_utterance: String(test.last_user_message || ""),
        user_utterances: [String(test.last_user_message || "")],
        user_raw_utterances: [String(test.last_user_message || "")],
        transcript,
        user_message_count: 1,
        message_count: 2,
        last_message_at: test.last_run_at,
        last_user_message_at: test.last_run_at,
        latest_queue_event_id: `${simulatorRoomId}:${test.last_run_at}`,
        latest_intent_name: String(test.matched_intent || ""),
        latest_queue_status: "matched",
        latest_error_message: "",
        runtime_events: runtimeEvents,
        dialog_ended: true,
        session_ended: false,
        completion_reason: "matched",
        ended_at: "",
        session_end_reason: ""
      },
      transcript,
      latest_problem_event: {},
      problem_location: ""
    }
  };
}

function listAdminConversationHistoryItems(query) {
  const webchatItems = webchatRooms.map((room) => createConversationHistoryItemFromRoom(room));
  const simulatorItems = operationsStateRegistry.map((entry) => createConversationHistoryItemFromSimulator(entry)).filter(Boolean);
  const normalizedQuery = String(query.get("query") || query.get("q") || "").trim().toLowerCase();
  const allItems = [...webchatItems, ...simulatorItems]
    .sort((a, b) => String(b.uttered_at || "").localeCompare(String(a.uttered_at || "")));
  if (!normalizedQuery) return allItems;
  return allItems.filter((item) => {
    const haystack = [
      item.group_name,
      item.channel_name,
      item.bot_name,
      item.user_key,
      item.intent_or_module_name,
      item.result,
      item.data_json?.session_first_user_utterance,
      ...(Array.isArray(item.data_json?.session_user_utterances) ? item.data_json.session_user_utterances : [])
    ].join(" ").toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

function serializeWebchatRoom(room) {
  const bot = getWebchatBotBySlug(room.bot_slug) || workspaceBots.find((item) => item.id === room.bot_id) || workspaceBots[0];
  return {
    id: room.id,
    clientRoomId: room.client_room_id || room.id,
    channelType: "webchat",
    contractVersion: room.contract_version || "v1.0",
    supportedContractVersions: Array.isArray(room.supported_contract_versions) ? [...room.supported_contract_versions] : ["v1.0"],
    status: room.status || "open",
    bot: serializeWebchatBot(bot),
    createdAt: room.created_at,
    updatedAt: room.updated_at
  };
}

function createStoredChannelMessage({ participantKind, participantId, participantName, text, payload = null, messageType = "text", options = [] }) {
  const normalizedOptions = Array.isArray(options) ? options.map((item) => String(item || "").trim()).filter(Boolean) : [];
  return {
    id: crypto.randomUUID(),
    participantId,
    participantKind,
    participantName,
    messageType,
    text,
    options: normalizedOptions,
    payload: payload || undefined,
    payload_json: payload || undefined,
    createdAt: new Date().toISOString()
  };
}

function buildWebchatRichSampleMessage(bot, userText) {
  const normalized = String(userText || "").trim().toLowerCase();
  if (normalized !== "__cga_rich_options__") return null;
  const options = ["예금", "대출", "상담원 연결"];
  return createStoredChannelMessage({
    participantKind: "bot",
    participantId: bot.id,
    participantName: bot.name,
    text: "다음 중 선택하세요",
    messageType: "form",
    options,
    payload: {
      richForm: {
        type: "button-group",
        title: "다음 중 선택하세요"
      },
      options,
      sourceTalkNodeId: "sample-rich-options-node"
    }
  });
}

function buildWebchatSessionEndedSampleMessage(bot, userText) {
  const normalized = String(userText || "").trim().toLowerCase();
  if (normalized !== "__cga_session_end__") return null;
  return createStoredChannelMessage({
    participantKind: "bot",
    participantId: bot.id,
    participantName: bot.name,
    text: getDefaultMessageText("session_end_processing", bot.locale || "ko")
  });
}

function createDefaultConversationHistory(room = {}) {
  return {
    contractVersion: room.contract_version || "v1.0",
    sourceProductVersion: "aidot-1.1",
    compatibilityStatus: "compatible",
    prunedFeatures: [],
    session_id: room.id || "",
    room_id: room.id || "",
    client_room_id: room.client_room_id || room.id || "",
    participant_id: room.participant_id || "visitor",
    participant_name: room.participant_name || "사용자",
    channel_type: room.channel_type || "webchat",
    room_status: room.status || "open",
    bot_id: room.bot_id || "",
    bot_version_id: room.bot_version_id || "v0.1",
    started_at: room.created_at || new Date().toISOString(),
    first_user_utterance: "",
    user_utterances: [],
    user_raw_utterances: [],
    transcript: [],
    user_message_count: 0,
    message_count: 0,
    last_message_at: room.updated_at || room.created_at || new Date().toISOString(),
    last_user_message_at: "",
    latest_queue_event_id: "",
    latest_intent_name: "",
    latest_queue_status: "",
    latest_error_message: "",
    runtime_events: [],
    dialog_ended: false,
    session_ended: false,
    completion_reason: "",
    ended_at: "",
    session_end_reason: ""
  };
}

function ensureRoomConversationHistory(room) {
  if (!room || typeof room !== "object") return createDefaultConversationHistory();
  const next = room.conversationHistory && typeof room.conversationHistory === "object"
    ? { ...createDefaultConversationHistory(room), ...room.conversationHistory }
    : createDefaultConversationHistory(room);
  next.contractVersion = room.contract_version || next.contractVersion || "v1.0";
  next.sourceProductVersion = next.sourceProductVersion || "aidot-1.1";
  next.compatibilityStatus = next.compatibilityStatus || "compatible";
  next.prunedFeatures = Array.isArray(next.prunedFeatures) ? next.prunedFeatures : [];
  next.session_id = next.session_id || room.id || "";
  next.room_id = next.room_id || room.id || "";
  next.client_room_id = next.client_room_id || room.client_room_id || room.id || "";
  next.participant_id = next.participant_id || room.participant_id || "visitor";
  next.participant_name = next.participant_name || room.participant_name || "사용자";
  next.channel_type = next.channel_type || room.channel_type || "webchat";
  next.room_status = room.status || next.room_status || "open";
  next.bot_id = next.bot_id || room.bot_id || "";
  next.bot_version_id = next.bot_version_id || room.bot_version_id || "v0.1";
  next.started_at = next.started_at || room.created_at || new Date().toISOString();
  next.transcript = Array.isArray(next.transcript) ? next.transcript : [];
  next.user_utterances = Array.isArray(next.user_utterances) ? next.user_utterances : [];
  next.user_raw_utterances = Array.isArray(next.user_raw_utterances) ? next.user_raw_utterances : [];
  next.runtime_events = Array.isArray(next.runtime_events) ? next.runtime_events : [];
  return next;
}

function parseJsonLike(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function firstReadableString(value, visited = new Set()) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed && !trimmed.includes("webchatRichFormVersion")) {
      return trimmed;
    }
    return "";
  }
  if (Array.isArray(value)) {
    if (visited.has(value)) return "";
    visited.add(value);
    for (const item of value) {
      const found = firstReadableString(item, visited);
      if (found) return found;
    }
    return "";
  }
  if (!value || typeof value !== "object") return "";
  if (visited.has(value)) return "";
  visited.add(value);
  const record = value;
  for (const key of ["label", "text", "title", "name", "value", "buttonValue", "displayValue", "display_text"]) {
    const found = firstReadableString(record[key], visited);
    if (found) return found;
  }
  for (const entry of Object.values(record)) {
    const found = firstReadableString(entry, visited);
    if (found) return found;
  }
  return "";
}

function summarizeWebchatSelection(value) {
  const parsed = parseJsonLike(value);
  const root = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  if (!String(root.webchatRichFormVersion || "").trim()) {
    return typeof value === "string" ? value.trim() : "";
  }
  const response = root.response && typeof root.response === "object" && !Array.isArray(root.response) ? root.response : {};
  const directButtonValue = firstReadableString(response.buttonValue);
  if (directButtonValue) return `버튼 선택: ${directButtonValue}`;
  const responseEntry = Object.entries(response).find(([, entryValue]) => {
    if (typeof entryValue === "string") return entryValue.trim().length > 0;
    if (Array.isArray(entryValue)) return entryValue.length > 0;
    return Boolean(entryValue) && typeof entryValue === "object" && !Array.isArray(entryValue) && Object.keys(entryValue).length > 0;
  });
  if (!responseEntry) return "RichForm 응답";
  const [responseType, responseValue] = responseEntry;
  const responseRecord = responseValue && typeof responseValue === "object" && !Array.isArray(responseValue) ? responseValue : {};
  const candidates = [
    responseRecord.buttonValue,
    responseRecord.displayValue,
    responseRecord.display_text,
    responseRecord.text,
    responseRecord.label,
    responseRecord.title,
    responseRecord.value,
    responseValue
  ];
  const resolved = candidates.map((candidate) => firstReadableString(candidate)).find(Boolean) || responseType.toUpperCase();
  const normalizedType = responseType.toUpperCase();
  if (["INPUT", "TEXTAREA", "ADDRESS"].includes(normalizedType)) return `입력: ${resolved}`;
  if (["CHECK", "CHECKBOX", "RADIO", "RADIOBUTTON", "COMBO", "COMBOBOX", "SELECT"].includes(normalizedType)) return `선택: ${resolved}`;
  if (["TAB", "BUTTON", "TOGGLEBUTTON"].includes(normalizedType)) return `버튼 선택: ${resolved}`;
  return `${normalizedType}: ${resolved}`;
}

function summarizeConversationText(value) {
  if (typeof value !== "string") return firstReadableString(value);
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.includes("webchatRichFormVersion")) return summarizeWebchatSelection(trimmed);
  return trimmed;
}

function summarizeRichformPayload(payload) {
  const payloadRecord = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const richForm = payloadRecord.richForm || payloadRecord.richform || payloadRecord.response || payloadRecord.payload;
  const richFormRecord = richForm && typeof richForm === "object" && !Array.isArray(richForm) ? richForm : {};
  const title = firstReadableString(richFormRecord.title || richFormRecord.name || payloadRecord.title || payloadRecord.name);
  const text = firstReadableString(richFormRecord.text || richFormRecord.message || payloadRecord.text || payloadRecord.message);
  const rawOptions = Array.isArray(richFormRecord.options) && richFormRecord.options.length
    ? richFormRecord.options
    : (Array.isArray(payloadRecord.options) ? payloadRecord.options : []);
  const options = rawOptions.map((option) => firstReadableString(option)).filter(Boolean);
  const details = [title, text, options.slice(0, 3).join(", ")].filter(Boolean);
  return details.length ? details.join(" / ") : "RichForm 카드";
}

function conversationHistoryDisplayText(message) {
  const participantKind = String(message?.participantKind || "").toLowerCase();
  const messageType = String(message?.messageType || message?.message_type || "").toLowerCase();
  const rawText = String(message?.text || "").trim();
  const payloadJson = message?.payload_json && typeof message.payload_json === "object" && !Array.isArray(message.payload_json)
    ? message.payload_json
    : (message?.payload && typeof message.payload === "object" && !Array.isArray(message.payload) ? message.payload : {});
  if (participantKind === "user") {
    return summarizeConversationText(rawText || payloadJson);
  }
  const richSummary = summarizeRichformPayload(payloadJson);
  const hasRichPayload = Boolean(
    (payloadJson && typeof payloadJson === "object" && !Array.isArray(payloadJson))
    && (payloadJson.richForm || payloadJson.richform || payloadJson.response || payloadJson.payload || Array.isArray(payloadJson.options))
  );
  if ((messageType === "form" || messageType === "form-a-card" || hasRichPayload) && richSummary) {
    if (!rawText || rawText === "RichForm" || richSummary.startsWith(`${rawText} /`) || richSummary === rawText) {
      return richSummary;
    }
  }
  if (!rawText || rawText === "RichForm") {
    return richSummary;
  }
  return summarizeConversationText(rawText);
}

function serializeAdminConversationMessage(message) {
  if (!message || typeof message !== "object") return null;
  const participantKind = String(message.participant_kind || message.participantKind || "").trim().toLowerCase();
  const participantId = String(message.participant_id || message.participantId || "").trim();
  const participantName = String(message.participant_name || message.participantName || "").trim();
  const messageType = String(message.message_type || message.messageType || "text").trim();
  const text = String(message.text || "").trim();
  const createdAt = String(message.created_at || message.createdAt || "").trim();
  const payloadJson = message.payload_json && typeof message.payload_json === "object" && !Array.isArray(message.payload_json)
    ? structuredClone(message.payload_json)
    : (message.payload && typeof message.payload === "object" && !Array.isArray(message.payload)
      ? structuredClone(message.payload)
      : {});
  const displayText = String(message.display_text || "").trim()
    || conversationHistoryDisplayText({
      participantKind,
      text,
      payload_json: payloadJson,
      payload: payloadJson
    });
  return {
    id: String(message.id || ""),
    participant_id: participantId,
    participant_kind: participantKind,
    participant_name: participantName,
    message_type: messageType,
    text,
    payload_json: payloadJson,
    created_at: createdAt,
    display_text: displayText
  };
}

function appendConversationHistoryMessage(room, message) {
  const history = ensureRoomConversationHistory(room);
  const text = String(message?.text || "");
  const createdAt = message?.createdAt || new Date().toISOString();
  const payloadJson = message?.payload_json && typeof message.payload_json === "object" && !Array.isArray(message.payload_json)
    ? structuredClone(message.payload_json)
    : (message?.payload && typeof message.payload === "object" && !Array.isArray(message.payload)
      ? structuredClone(message.payload)
      : {});
  const displayText = conversationHistoryDisplayText({ ...message, payload_json: payloadJson });
  history.transcript = [
    ...history.transcript,
    {
      participant_kind: message?.participantKind || "",
      participant_id: message?.participantId || "",
      participant_name: message?.participantName || "",
      message_type: message?.messageType || "text",
      text,
      payload_json: payloadJson,
      created_at: createdAt
      ,
      display_text: displayText
    }
  ];
  history.message_count = Number(history.message_count || 0) + 1;
  history.last_message_at = createdAt;
  if (message?.participantKind === "user") {
    history.user_message_count = Number(history.user_message_count || 0) + 1;
    history.last_user_message_at = createdAt;
    const readableText = displayText || text;
    if (readableText) {
      history.user_utterances = [...history.user_utterances, readableText];
      if (!history.first_user_utterance) history.first_user_utterance = readableText;
    }
    if (text) {
      history.user_raw_utterances = [...history.user_raw_utterances, text];
    }
  }
  room.conversationHistory = history;
  return history;
}

function applyConversationHistoryRuntime(room, runtime = {}) {
  const history = ensureRoomConversationHistory(room);
  if (runtime.intentName) history.latest_intent_name = runtime.intentName;
  if (runtime.queueStatus) history.latest_queue_status = runtime.queueStatus;
  if (runtime.errorMessage) history.latest_error_message = runtime.errorMessage;
  if (runtime.queueEventId) history.latest_queue_event_id = runtime.queueEventId;
  if (Array.isArray(runtime.runtimeEvents)) {
    history.runtime_events = runtime.runtimeEvents.map((event) => structuredClone(event));
  }
  if (typeof runtime.dialogEnded === "boolean") history.dialog_ended = runtime.dialogEnded;
  if (typeof runtime.sessionEnded === "boolean") history.session_ended = runtime.sessionEnded;
  if (runtime.completionReason) history.completion_reason = runtime.completionReason;
  if (runtime.endedAt) history.ended_at = runtime.endedAt;
  if (runtime.sessionEndReason) history.session_end_reason = runtime.sessionEndReason;
  history.room_status = room.status || history.room_status || "open";
  room.conversationHistory = history;
  return history;
}

function normalizeWebchatRoomRecord(room) {
  if (!room || typeof room !== "object") return room;
  const normalized = {
    ...room,
    contract_version: room.contract_version || "v1.0",
    supported_contract_versions: Array.isArray(room.supported_contract_versions) && room.supported_contract_versions.length
      ? [...room.supported_contract_versions]
      : ["v1.0"],
    messages: Array.isArray(room.messages) ? room.messages : []
  };
  normalized.conversationHistory = ensureRoomConversationHistory(normalized);
  return normalized;
}

function createMatchedRuntimeEvents({
  userMessage,
  botMessage,
  intentName,
  similarity,
  queueEventId,
  timestamp,
  sourceNodeId = "talk-1",
  nextNodeId = "end-1",
  completionReason = "matched"
}) {
  const eventTime = timestamp || new Date().toISOString();
  return [
    {
      time: eventTime,
      level: "info",
      event: "channel.runtime.intent_matched",
      message: "의도가 매칭되었습니다.",
      data: {
        intentName,
        intentScore: similarity,
        updatedVariables: ["$userMessage", "$matchedIntent"],
        valuePreviews: {
          $userMessage: userMessage,
          $matchedIntent: intentName
        },
        queueEventId
      }
    },
    {
      time: eventTime,
      level: "info",
      event: "channel.runtime.talk_response_stored",
      message: "응답 메시지를 생성했습니다.",
      data: {
        updatedVariables: ["$botResponse"],
        valuePreviews: {
          $botResponse: botMessage
        },
        sourceNodeId,
        nextNodeId,
        queueEventId
      }
    },
    {
      time: eventTime,
      level: "info",
      event: "channel.runtime.completed",
      message: "채널 Queue 처리를 완료했습니다.",
      data: {
        queueEventId,
        completionReason
      }
    }
  ];
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
      const existingRoom = body.client_room_id
        ? webchatRooms.find((item) => item.client_room_id === body.client_room_id)
        : null;
      if (existingRoom) {
        existingRoom.conversationHistory = ensureRoomConversationHistory(existingRoom);
        if (
          existingRoom.status === "open"
          && existingRoom.bot_id === bot.id
          && existingRoom.bot_version_id === (bot.version || "v0.1")
        ) {
          existingRoom.updated_at = now;
          saveWebchatRooms([...webchatRooms]);
          sendAidotSuccess(req, res, {
            room: serializeWebchatRoom(existingRoom),
            messages: existingRoom.messages || [],
            initialMessages: []
          });
          return true;
        }
        existingRoom.status = "closed";
        existingRoom.updated_at = now;
        applyConversationHistoryRuntime(existingRoom, {
          dialogEnded: true,
          sessionEnded: true,
          completionReason: "active_version_changed",
          endedAt: now,
          sessionEndReason: "active_version_changed"
        });
      }
      const room = {
        id: crypto.randomUUID(),
        client_room_id: body.client_room_id || crypto.randomUUID(),
        channel_type: "webchat",
        contract_version: "v1.0",
        supported_contract_versions: ["v1.0"],
        bot_id: bot.id,
        bot_slug: bot.slug || bot.id,
        bot_version_id: bot.version || "v0.1",
        participant_id: body.participant_id || "visitor",
        participant_name: body.participant_name || "사용자",
        status: "open",
        messages: [],
        created_at: now,
        updated_at: now
      };
      room.conversationHistory = ensureRoomConversationHistory(room);
      const botMessage = createStoredChannelMessage({
        participantKind: "bot",
        participantId: bot.id,
        participantName: bot.name,
        text: getDefaultMessageText("bot_connected", bot.locale || "ko", { botName: bot.name })
      });
      room.messages = [botMessage];
      appendConversationHistoryMessage(room, botMessage);
      saveWebchatRooms([room, ...webchatRooms.filter((item) => item.id !== existingRoom?.id), ...(existingRoom ? [existingRoom] : [])]);
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
        applyConversationHistoryRuntime(room, {
          dialogEnded: true,
          sessionEnded: true,
          completionReason: "closed",
          endedAt: room.updated_at,
          sessionEndReason: "deleted"
        });
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
        contract_version: "v1.0",
        supported_contract_versions: ["v1.0"],
        bot_id: bot.id,
        bot_slug: bot.slug || bot.id,
        bot_version_id: bot.version || "v0.1",
        participant_id: body.participant_id || "visitor",
        participant_name: "사용자",
        status: "open",
        messages: [],
        created_at: now,
        updated_at: now
      };
      room.conversationHistory = ensureRoomConversationHistory(room);
      webchatRooms = [room, ...webchatRooms];
    }
    const userMessage = createStoredChannelMessage({
      participantKind: "user",
      participantId: body.participant_id || room.participant_id || "visitor",
      participantName: room.participant_name || "사용자",
      text: body.message || ""
    });
    const sessionEndedSampleMessage = buildWebchatSessionEndedSampleMessage(bot, body.message || "");
    const richSampleMessage = buildWebchatRichSampleMessage(bot, body.message || "");
    const { scenario, score } = selectWebchatIntent(bot, body.message || "");
    const answer = scenario?.answer || scenario?.dialogCards?.[0] || getDefaultMessageText("intent_fallback", bot.locale || "ko");
    const botMessage = sessionEndedSampleMessage || richSampleMessage || createStoredChannelMessage({
      participantKind: "bot",
      participantId: bot.id,
      participantName: bot.name,
      text: answer
    });
    const queueEventId = `${room.id}:${botMessage.createdAt}`;
    const isSessionEnded = Boolean(sessionEndedSampleMessage);
    const isRichSample = Boolean(richSampleMessage);
    const completionReason = isSessionEnded ? "session_ended" : "matched";
    const intentName = isSessionEnded
      ? "session_end"
      : (isRichSample ? "sample_rich_options" : (scenario?.displayName || scenario?.id || "matched"));
    const runtimeEvents = createMatchedRuntimeEvents({
      userMessage: String(body.message || ""),
      botMessage: botMessage.text || answer,
      intentName,
      similarity: score,
      queueEventId,
      timestamp: botMessage.createdAt,
      completionReason
    });
    room.messages = [...(room.messages || []), userMessage, botMessage];
    appendConversationHistoryMessage(room, userMessage);
    appendConversationHistoryMessage(room, botMessage);
    room.updated_at = botMessage.createdAt;
    if (isSessionEnded) room.status = "closed";
    applyConversationHistoryRuntime(room, {
      queueEventId,
      intentName,
      queueStatus: "matched",
      runtimeEvents,
      dialogEnded: true,
      sessionEnded: isSessionEnded,
      completionReason,
      endedAt: isSessionEnded ? botMessage.createdAt : "",
      sessionEndReason: isSessionEnded ? "user_requested_end" : ""
    });
    saveWebchatRooms([...webchatRooms.filter((item) => item.id !== room.id), room]);
    sendAidotSuccess(req, res, {
      botMessage,
      botMessages: [botMessage],
      intent: {
        id: isSessionEnded ? "session_end" : (isRichSample ? "sample_rich_options" : (scenario?.id || null)),
        name: intentName,
        score
      },
      runtime: {
        resolvedContractVersion: room.contract_version || "v1.0",
        dialogEnded: true,
        sessionEnded: isSessionEnded,
        completionReason,
        endedAt: isSessionEnded ? botMessage.createdAt : undefined
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

function parseContractVersionNumber(value) {
  const match = String(value || "").match(/v?(\d+)(?:\.(\d+))?/i);
  if (!match) return { major: 0, minor: 0 };
  return {
    major: Number(match[1] || 0),
    minor: Number(match[2] || 0)
  };
}

function isContractVersionHigher(sourceVersion, targetVersion) {
  const source = parseContractVersionNumber(sourceVersion);
  const target = parseContractVersionNumber(targetVersion);
  if (source.major !== target.major) return source.major > target.major;
  return source.minor > target.minor;
}

function deleteNestedProperty(target, pathParts) {
  if (!target || typeof target !== "object" || !Array.isArray(pathParts) || !pathParts.length) return false;
  if (pathParts.length === 1) {
    if (Object.prototype.hasOwnProperty.call(target, pathParts[0])) {
      delete target[pathParts[0]];
      return true;
    }
    return false;
  }
  const [head, ...rest] = pathParts;
  if (!target[head] || typeof target[head] !== "object") return false;
  return deleteNestedProperty(target[head], rest);
}

function sanitizeChannelsForContractV10(channels) {
  if (!channels || typeof channels !== "object") return { channels, prunedFeatures: [] };
  const allowedKeys = new Set(["web", "desktopMessenger", "kakaoKr"]);
  const next = { ...channels };
  const prunedFeatures = [];
  Object.keys(next).forEach((key) => {
    if (!allowedKeys.has(key)) {
      delete next[key];
      prunedFeatures.push(`system_config.channels.${key}`);
    }
  });
  if (Object.prototype.hasOwnProperty.call(next, "kakaoKr") && next.kakaoKr !== "disabled") {
    next.kakaoKr = "disabled";
    prunedFeatures.push("system_config.channels.kakaoKr");
  }
  return { channels: next, prunedFeatures };
}

function sanitizeImportedJsonForContractV10(scope, payload) {
  const next = structuredClone(payload);
  const prunedFeatures = [];
  const directPrunePaths = [
    ["external_channels"],
    ["kakao_channel"],
    ["kakao_channel_config"],
    ["channel_extensions"],
    ["extended_rich_ui"],
    ["rich_cards_v2"],
    ["advanced_analytics"]
  ];
  directPrunePaths.forEach((pathParts) => {
    if (deleteNestedProperty(next, pathParts)) {
      prunedFeatures.push(pathParts.join("."));
    }
  });
  if (scope === "version") {
    const systemConfig = next.system_config && typeof next.system_config === "object" ? next.system_config : null;
    if (systemConfig?.channels && typeof systemConfig.channels === "object") {
      const sanitized = sanitizeChannelsForContractV10(systemConfig.channels);
      systemConfig.channels = sanitized.channels;
      prunedFeatures.push(...sanitized.prunedFeatures);
    }
  }
  return {
    payload: next,
    prunedFeatures: [...new Set(prunedFeatures)]
  };
}

function hasObjectValue(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function hasNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function evaluateContractV10CoreCompatibility(scope, payload) {
  if (!payload || typeof payload !== "object") {
    return {
      blocked: true,
      reason: "Imported payload is empty after pruning and cannot be mapped to contract v1.0."
    };
  }

  if (scope === "version") {
    const hasSystemBot = hasObjectValue(payload.system_config?.bot) || hasObjectValue(payload.version?.bot);
    const hasDialogCore = hasNonEmptyArray(payload.dialogs) || hasNonEmptyArray(payload.dialog_flow_graphs);
    const hasRuntimeAssets = [
      payload.entities,
      payload.dictionary,
      payload.faq_dialogs,
      payload.apis,
      payload.floating_buttons,
      payload.rules,
      payload.small_talk,
      payload.blacklists
    ].some(hasNonEmptyArray);
    if (hasSystemBot || hasDialogCore || hasRuntimeAssets) return { blocked: false, reason: "" };
    return {
      blocked: true,
      reason: "After pruning, the version package no longer contains contract v1.0 core assets such as bot metadata, dialogs, or runtime assets."
    };
  }

  if (scope === "bot") {
    const hasBotCore = hasObjectValue(payload.botVo);
    const hasDialogCore = hasNonEmptyArray(payload.dialogList) || hasNonEmptyArray(payload.dialogFlowGraphList) || hasNonEmptyArray(payload.faqDialogList);
    const hasRuntimeAssets = [
      payload.floatingButtonVoList,
      payload.ruleVoList,
      payload.smallTalkVoList,
      payload.dictionaryVoList,
      payload.blacklistList,
      payload.entityTypeList
    ].some(hasNonEmptyArray);
    if (hasBotCore || hasDialogCore || hasRuntimeAssets) return { blocked: false, reason: "" };
    return {
      blocked: true,
      reason: "After pruning, the bot package no longer contains contract v1.0 core assets such as bot metadata, dialogs, or runtime assets."
    };
  }

  if (scope === "dialog") {
    const hasDialogId = hasNonEmptyString(payload.dialogId) || hasNonEmptyString(payload.displayName);
    const hasFlowGraph = hasObjectValue(payload.flowGraph) || hasNonEmptyArray(payload.flowGraph);
    if (hasDialogId || hasFlowGraph) return { blocked: false, reason: "" };
    return {
      blocked: true,
      reason: "After pruning, the dialog package no longer contains contract v1.0 dialog identity or flow graph data."
    };
  }

  return { blocked: false, reason: "" };
}

function sanitizeImportedAssetBodyForContract({ scope, fileFormat, bodyText, targetContractVersion }) {
  const normalizedTarget = String(targetContractVersion || "v1.0").trim() || "v1.0";
  if (fileFormat !== "json") {
    return {
      bodyText,
      sourceContractVersion: normalizedTarget,
      resolvedContractVersion: normalizedTarget,
      status: "accepted",
      pruningStatus: "none",
      prunedFeatures: [],
      warnings: [],
      errors: []
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return {
      bodyText,
      sourceContractVersion: normalizedTarget,
      resolvedContractVersion: normalizedTarget,
      status: "accepted",
      pruningStatus: "none",
      prunedFeatures: [],
      warnings: [],
      errors: []
    };
  }
  const sourceContractVersion = String(parsed?.contract_version || parsed?.manifest?.contract_version || normalizedTarget).trim() || normalizedTarget;
  const sanitized = sanitizeImportedJsonForContractV10(scope, parsed);
  const higherContract = isContractVersionHigher(sourceContractVersion, normalizedTarget);
  const prunedFeatures = [...new Set(sanitized.prunedFeatures)];
  const warnings = [];
  const errors = [];
  if (higherContract) {
    warnings.push(`Higher contract version detected: ${sourceContractVersion} -> importing as ${normalizedTarget}`);
  }
  if (prunedFeatures.length) {
    warnings.push(`Pruned unsupported features: ${prunedFeatures.join(", ")}`);
  }
  const shouldEvaluateCompatibility = higherContract || prunedFeatures.length > 0;
  const compatibility = shouldEvaluateCompatibility
    ? evaluateContractV10CoreCompatibility(scope, sanitized.payload)
    : { blocked: false, reason: "" };
  if (compatibility.blocked && compatibility.reason) {
    errors.push(compatibility.reason);
    warnings.push(`Upload blocked because contract v1.0 core meaning could not be preserved for scope "${scope}".`);
  }
  return {
    bodyText: JSON.stringify(sanitized.payload, null, 2),
    sourceContractVersion,
    resolvedContractVersion: normalizedTarget,
    status: compatibility.blocked ? "blocked" : "accepted",
    pruningStatus: compatibility.blocked ? "blocked" : (higherContract || prunedFeatures.length ? "pruned" : "none"),
    prunedFeatures,
    warnings,
    errors
  };
}

function getAssetTransferScopeExportFileName(scope, botId, fileFormat) {
  const safeBotId = sanitizePathSegment(botId, "bot");
  const safeDate = getTodayStamp();
  const baseMap = {
    bot: `Bot_${safeBotId}`,
    version: `Version_${safeBotId}_v0_1`,
    dialog: `FlowDesign_${safeBotId}`,
    api: `API_${safeBotId}`,
    intent_utterance: `LearningExpr_${safeBotId}`,
    entity: `Entity_${safeBotId}`,
    dictionary: `Dictionary_${safeBotId}`,
    blocklist: `Blocklist_${safeBotId}`,
    rule: `Rule_${safeBotId}`
  };
  const stem = baseMap[scope] || `${sanitizePathSegment(scope, "Asset")}_${safeBotId}`;
  return `${stem}_${safeDate}.${fileFormat}`;
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
  const contractVersion = "v1.0";
  const supportedContractVersions = [contractVersion];
  if (scope === "api") {
    const sampleMethods = [
      {
        id: `sample:${groupId}:${botId}:order_status_lookup:get`,
        name: "default",
        httpMethod: "GET",
        methodUrl: "https://api.example.com/orders/{order_id}",
        description: "",
        loggingEnabled: false,
        proxyEnabled: true,
        transferMode: "sync",
        parameters: [
          {
            id: "order_id",
            name: "order_id",
            location: "path",
            dataType: "string",
            defaultValue: "",
            required: true,
            visible: true,
            description: "조회할 주문 ID"
          }
        ],
        outputParameters: [
          {
            id: "status",
            name: "status",
            path: "status",
            dataType: "string",
            description: "주문 상태"
          }
        ],
        outputSample: ""
      }
    ];
    return {
      asset_format_version: 1,
      exported_at: new Date().toISOString(),
      apis: [
        {
          id: `sample:${groupId}:${botId}:order_status_lookup`,
          type: "api",
          apiKey: `sample:${groupId}:${botId}:order_status_lookup`,
          name: "order_status_lookup",
          baseUrl: "https://api.example.com/orders/{order_id}",
          description: "",
          category: "API",
          methods: sampleMethods,
          updatedAt: new Date().toISOString(),
          updatedBy: "cga"
        }
      ],
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
      asset_format_version: 1,
      contract_version: contractVersion,
      supported_contract_versions: [...supportedContractVersions],
      dialogs: [
        { dialogId: "password_reset", dialogType: 1, displayName: "password_reset", answer: "계정 설정에서 비밀번호를 재설정하세요." }
      ],
      dialog_flow_graphs: [
        {
          dialogId: "password_reset",
          dialogType: 1,
          flowGraph: [
            { objectType: "Start", objectId: "password_reset-start", dialogId: "password_reset", displayName: "password_reset Start", additionalInfo: null, position: { x: 80, y: 120 } },
            { objectType: "Message", objectId: "password_reset-message", dialogId: "password_reset", displayName: "password_reset", additionalInfo: { text: "계정 설정에서 비밀번호를 재설정하세요." }, position: { x: 320, y: 120 } },
            { objectType: "End", objectId: "password_reset-end", dialogId: "password_reset", displayName: "password_reset End", additionalInfo: null, position: { x: 560, y: 120 } }
          ]
        }
      ],
      entities: [],
      dictionary: [],
      faq_dialogs: [],
      apis: [],
      floating_buttons: [],
      rules: [],
      small_talk: [],
      blacklists: [],
      system_config: {
        bot: {
          botId,
          botName: "CGA Bot",
          defaultLocale: botLocale,
          version: "v0.1"
        },
        structuralChoices: {},
        counts: {},
        llm: {},
        channels: {}
      },
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
    faqDialogList: [
      { dialogId: "faq_password_reset", question: "비밀번호를 어떻게 재설정하나요?", answer: "계정 설정에서 비밀번호 재설정을 선택하세요.", enabled: "Y" }
    ],
    floatingButtonVoList: [
      { buttonId: "floating-help", label: "도움말", action: "open_help", enabled: "Y", sortOrder: 1 }
    ],
    ruleVoList: [],
    smallTalkVoList: [
      { trigger: "안녕", response: "안녕하세요. 무엇을 도와드릴까요?", enabled: "Y" }
    ],
    dictionaryVoList: [],
    blacklistList: [
      { blacklistName: "sample_blocklist", blacklistType: "0", expression: "forbidden", enabled: "Y" }
    ]
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
    const fileName = getAssetTransferScopeExportFileName(scope, botId, asset.fileFormat);
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
    const targetContractVersion = String(req.headers["x-cga-target-contract-version"] || "v1.0").trim() || "v1.0";
    const sanitizedImport = sanitizeImportedAssetBodyForContract({
      scope,
      fileFormat: asset.fileFormat,
      bodyText: body,
      targetContractVersion
    });
    const request = contract.createAssetImportRequest({
      groupId,
      botId,
      scope,
      botLocale,
      fileName: req.headers["x-cga-file-name"] || `uploaded.${asset.fileFormat}`,
      targetContractVersion
    });
    const transferId = `import-${Date.now()}`;
    let storedPath = "";
    if (sanitizedImport.status === "accepted") {
      storedPath = storeAssetBody({ groupId, botId, scope, fileFormat: asset.fileFormat, body: sanitizedImport.bodyText });
      if (scope === "bot") {
        upsertWorkspaceBotFromImportedPackage(sanitizedImport.bodyText, { groupId, botId, botLocale });
      }
    }
    recordAssetTransfer({
      transfer_id: transferId,
      group_id: groupId,
      bot_id: botId,
      scope,
      direction: "import",
      status: sanitizedImport.status,
      byte_length: Buffer.byteLength(sanitizedImport.bodyText, "utf8"),
      asset_path: storedPath,
      created_at: new Date().toISOString(),
      warnings: sanitizedImport.warnings,
      errors: sanitizedImport.errors
    });
    sendJson(res, 202, contract.createAssetTransferResponse({
      request,
      status: sanitizedImport.status === "blocked"
        ? contract.ASSET_TRANSFER_STATUS.BLOCKED
        : contract.ASSET_TRANSFER_STATUS.ACCEPTED,
      transferId,
      resolvedContractVersion: sanitizedImport.resolvedContractVersion,
      pruningStatus: sanitizedImport.pruningStatus === "blocked"
        ? contract.ASSET_TRANSFER_PRUNING_STATUS.BLOCKED
        : (sanitizedImport.pruningStatus === "pruned"
          ? contract.ASSET_TRANSFER_PRUNING_STATUS.PRUNED
          : contract.ASSET_TRANSFER_PRUNING_STATUS.NONE),
      prunedFeatures: sanitizedImport.prunedFeatures,
      warnings: sanitizedImport.warnings,
      errors: sanitizedImport.errors
    }));
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
    if (await handleAidotAdminHistoryApi(req, res, urlPath, query)) return;
    if (await handleAssetTransferApi(req, res, urlPath, query)) return;
  } catch (error) {
    sendJson(res, 500, {
      error_code: "CGA_API_REQUEST_FAILED",
      message_key: "errors.api.requestFailed",
      detail: error instanceof Error ? error.message : "Unknown error"
    });
    return;
  }
  const isWebchatPageRequest = /^\/webchat(\/[^/]+)?\/?$/.test(urlPath);
  const requestPath = urlPath === "/"
    ? "/apps/studio/index.html"
    : (isWebchatPageRequest ? "/apps/webchat/index.html" : urlPath);
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





