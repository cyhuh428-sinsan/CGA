import { workflowSteps, managementLinks, operationLinks, queryLinks, systemAdminSections, errorSamples } from "./data/workflow.js?v=20260618-10";
import { getVisibleLayout } from "./data/layout.js?v=20260618-10";
import { sampleStudioState } from "./data/sample-state.js";
import { deriveReadiness, canGeneratePdfQa, canUseKakaoChannel, TRAINING_LOCKED_CREATE_FIELDS, RUNTIME_ADJUSTABLE_FIELDS } from "/packages/public-core/src/studio-state.js";
import { createDefaultModuleRegistry, DEFAULT_COMMERCIAL_FEATURE_CHECKS, getFeatureAvailability } from "/packages/public-core/src/module-registry.js";
import { createGroupManagedApiAnswerDraft } from "/packages/contracts/src/api-answer-contract.js";
import { createAidotPackageManifest } from "/packages/contracts/src/aidot-package-contract.js";
import { createSampleCollaborationState, lockWorkItem, releaseWorkItemLock, submitReviewDecision, summarizeCollaboration, summarizeTeamDashboard } from "/packages/public-core/src/collaboration-state.js";
import {
  approveAdminPermissionRequest,
  approveGroupJoinRequest,
  applySignup,
  canApproveAdminPermissionRequest,
  canApproveGroupJoinRequest,
  canCreateManagedGroup,
  createManagedGroup,
  createSampleAccessState,
  isSystemAdmin,
  loginAsUser,
  normalizeAccessState,
  getEffectiveGroupScopes,
  requestGroupJoin,
  summarizeAccess,
  summarizeAccessOperations,
  summarizeAccessPolicy,
  summarizeAdminRequests,
  summarizeAuthWorkflow,
  summarizeGroupBotAccess,
  summarizeGroupUsers,
  summarizeJoinRequests,
  updateGroupMembershipRole
} from "/packages/public-core/src/access-state.js";

const AUTH_SESSION_STORAGE_KEY = "cga-studio-session-token-v2";
const LAST_SCREEN_STORAGE_KEY = "cga-studio-last-screen";
const WORKSPACE_SNAPSHOT_STORAGE_PREFIX = "cga-studio-workspace-snapshot";
const WORKSPACE_RECENT_BOTS_STORAGE_KEY = "cga-studio-recent-bots-v1";
const BOT_VERSION_REGISTRY_STORAGE_KEY = "cga-studio-bot-version-registry-v1";
const WORKSPACE_SNAPSHOT_VERSION = 1;
const WORKSPACE_SNAPSHOT_TTL_MS = 60000;
const LOGIN_ID_STORAGE_KEY = "cga-studio-login-id";

const currentStudioState = structuredClone(sampleStudioState);
let currentCollaborationState = createSampleCollaborationState();
let currentAccessState = normalizeAccessState(createSampleAccessState());
let botVersionRegistry = {};
let currentWorkspaceRecentBots = [];
let currentAdminResources = {
  templates: [],
  common_variables: [],
  default_messages: [],
  channels: [],
  botstation_links: [],
  licenses: [],
  login_history: []
};
let currentWorkspaceGroupId = "g-support";
let currentWorkspaceBotId = "supportbot-draft";
let currentWorkspaceBots = [
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
let currentApiRegistry = [
  {
    group_id: "g-support",
    bot_id: "supportbot-draft",
    name: "order_status_lookup",
    endpoint_url: "https://api.example.com/orders/{order_id}",
    method: "GET",
    auth_type: "bearer",
    secret_ref: "secret:group/g-support/order-status",
    response_path: "data.answer"
  }
];
let currentApiGroupId = "g-support";
let currentApiBotId = "supportbot-draft";
let currentTransferStatus = "";
let currentTransferHistory = [];
let currentAuthMessage = null;
let currentGlobalMessage = null;
let studioStateSaveTimer = null;
let compositionSaveTimer = null;
const saveQueues = new Map();
let workspaceDataRefreshSerial = 0;
let apiRegistryRefreshKey = "";
let apiRegistryRefreshPromise = null;
const apiRegistryLoadedAtByKey = new Map();
const API_REGISTRY_CACHE_TTL_MS = 15000;
const MANAGED_GROUP_ROLES = ["group_admin", "builder", "reviewer", "operator", "viewer"];
let currentSystemAdminSubview = "users";
let currentAdminResourceModal = null;
let selectedAccessUserId = "admin";
let selectedAccessGroupId = "g-admin";
let userListPage = 1;
let userListPageSize = 10;
let accessUserModalOpen = false;
let groupListPage = 1;
let groupListPageSize = 10;
let accessGroupModalOpen = false;
let accessGroupCreateMode = false;
const adminTablePageByKey = {};
const adminTablePageSizeByKey = {};
const teamDashboardPageByKey = {
  mine: 1,
  review: 1,
  blocked: 1
};
let teamDashboardPageSize = 10;
let currentIntentSearch = "";
let currentIntentFilter = "all";
let currentDetailTab = "intent";
let currentBuildAidotView = "list";
let currentConfigureSubview = "ai-model";
let selectedBotManagementId = "supportbot-draft";
let selectedBotManagementVersionId = "";
let currentCompositionState = {
  group_id: "g-support",
  bot_id: "supportbot-draft",
  input_mode: "pdf",
  document_title: "",
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
  ]
};
let currentDictionaryAssets = [
  { word: "password", synonyms: ["login password", "account password"] },
  { word: "plan", synonyms: ["subscription", "membership"] }
];
let currentEntityAssets = [
  { name: "email", value: "email", rowType: "P", detail: "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b" },
  { name: "channel", value: "web", rowType: "S", detail: "webchat" }
];
let currentIntentUtteranceAssets = [
  { utterance: "I need to reset my password", division: "password_reset" },
  { utterance: "How do I update my account?", division: "account_update" },
  { utterance: "I have a billing question", division: "billing_question" }
];
let currentRuleAssets = [
  { name: "Business hours", description: "Route after-hours questions", expression: "time.after(18:00)", target: "support_after_hours", enabled: "Y" },
  { name: "Billing priority", description: "Route billing requests", expression: "intent == billing_question", target: "billing_question", enabled: "Y" }
];
let currentScenarioAssets = [
  { id: "password_reset", type: "intent", displayName: "password_reset", answer: "Open Account Settings and choose Reset Password.", dialogCards: ["Open Account Settings and choose Reset Password."] },
  { id: "account_update", type: "intent", displayName: "account_update", answer: "Open Profile Settings and update your account information.", dialogCards: ["Open Profile Settings and update your account information."] }
];
let currentSelectedIntentId = "password_reset";
let currentSelectedCompositionCandidates = new Set();
let currentBuildSelectedUtterances = new Set();
let currentOperationsState = {
  group_id: "g-support",
  bot_id: "supportbot-draft",
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
const DEFAULT_ACTIVE_SCREEN_ID = "workspace-home";
let activeScreenId = "";
let screenLayoutApplying = false;
let postAuthDefaultScreenPending = false;

const HELP_TOPICS = {
  access: {
    title: "사용자 / 그룹 관리 안내",
    body: `
      <section>
        <h4>관리 기준</h4>
        <p>사용자는 그룹 안에서 역할을 받고, 그 역할에 따라 메뉴와 화면 접근 권한이 결정됩니다.</p>
      </section>
      <section>
        <h4>가입 / 승인</h4>
        <p>신규 사용자는 개인 그룹을 자동 생성하지 않습니다. 가입 후 viewer 역할로 가입 신청이 생성되고, 관리자가 그룹과 역할을 확정합니다.</p>
      </section>
      <section>
        <h4>언어</h4>
        <p>CGA 화면과 오류 메시지는 사용자 언어를 따르고, 봇 오류 메시지는 봇 언어를 따릅니다.</p>
      </section>
    `
  }
};

const dynamicMessages = {
  en: {
    "common.allowed": "Allowed",
    "common.blocked": "Blocked",
    "common.disabled": "Disabled",
    "common.enabled": "Enabled",
    "common.none": "None",
    "common.user": "User",
    "common.group": "Group",
    "common.noRole": "no role",
    "common.intentUnit": "intents",
    "common.pendingUnit": "pending",
    "common.serverSaved": "server saved",
    "common.localOnly": "local only",
    "common.yes": "Yes",
    "common.no": "No",
    "common.open": "Open",
    "common.noScope": "no scope",
    "workspace.noGroup": "No group",
    "workspace.noGroupSelected": "No group selected",
    "workspace.noBotSelected": "No bot selected",
    "workspace.noBotInGroup": "No bot in this group",
    "workspace.createBotToStart": "Create a bot to start the workflow.",
    "workspace.botCount": "bot(s)",
    "workspace.blockedCreate": "blocked: bot.create",
    "workspace.createAllowed": "Can create bots",
    "workspace.createBlocked": "Blocked: bot.create",
    "top.groupPrefix": "Group",
    "top.botPrefix": "Bot",
    "top.versionPrefix": "Version",
    "summary.llmUsed": "LLM composition",
    "summary.llmNotUsed": "LLM off",
    "summary.allowed": "Allowed",
    "summary.disabled": "Disabled",
    "transfer.jsonReplace": "JSON · replace",
    "transfer.txtMergeShort": "TXT · merge",
    "admin.groupJoin": "group join",
    "admin.groupAdminApproval": "group admin approval",
    "admin.requiresGroupAdmin": "requires group admin",
    "admin.adminPermission": "admin permission",
    "admin.systemAdminApproval": "system admin approval",
    "admin.requiresSystemAdmin": "requires system admin",
    "admin.noPendingApproval": "No pending approval",
    "admin.queueEmpty": "Queue is empty",
    "admin.noActiveUser": "No active user",
    "admin.systemAdminRequired": "System admin required",
    "admin.approve": "Approve",
    "apiAnswer.noApiAnswer": "No API answer",
    "apiAnswer.registerForBot": "Register a group API answer for the selected bot.",
    "team.available": "Available",
    "team.noAssignedTask": "No assigned task",
    "team.noReviewWaiting": "No review waiting",
    "team.noBlockedItem": "No blocked item",
    "team.currentUser": "Current user",
    "team.unassigned": "unassigned",
    "team.lockedBy": "locked by",
    "team.lock": "Lock",
    "team.unlock": "Unlock",
    "team.requestChanges": "Request changes",
    "team.moveToTodo": "Move to todo",
    "state.bot": "Bot",
    "state.locale": "Locale",
    "state.intents": "Intents",
    "state.documents": "Documents",
    "state.readiness": "Readiness",
    "state.notNamed": "Not named",
    "state.ready": "Ready",
    "state.pdfAvailable": "Available",
    "state.pdfBlockedLlm": "Blocked: LLM required",
    "state.kakaoAvailableKo": "Available for Korean locale",
    "state.kakaoDisabledNonKo": "Disabled outside Korean locale",
    "state.noBlockingIssue": "No blocking issue.",
    "review.utteranceUnit": "utterances",
    "review.noIntentCandidate": "No intent candidate",
    "review.manualResultRequired": "Manual handoff or PDF Q&A result required",
    "module.screen": "Screen",
    "module.publicCore": "Public Core",
    "module.commercialCandidate": "Commercial Candidate",
    "test.dialogCard": "Dialog card",
    "test.entities": "Entities",
    "test.runtimeVariables": "Runtime variables",
    "test.apiAnswer": "API answer",
    "test.trainingSample": "Training sample",
    "test.processingLog": "Processing log",
    "test.answerSource": "Answer source",
    "test.noEntity": "No detected entity",
    "test.noApi": "No API answer",
    "test.aidotCompatible": "Aidot-compatible simulator view"
  },
  ko: {
    "common.allowed": "허용",
    "common.blocked": "차단",
    "common.disabled": "비활성",
    "common.enabled": "활성",
    "common.none": "없음",
    "common.user": "사용자",
    "common.group": "그룹",
    "common.noRole": "역할 없음",
    "common.intentUnit": "개 의도",
    "common.pendingUnit": "건 대기",
    "common.serverSaved": "서버 저장",
    "common.localOnly": "로컬만 반영",
    "common.yes": "예",
    "common.no": "아니오",
    "common.open": "열림",
    "common.noScope": "scope 없음",
    "workspace.noGroup": "그룹 없음",
    "workspace.noGroupSelected": "선택된 그룹 없음",
    "workspace.noBotSelected": "선택된 봇 없음",
    "workspace.noBotInGroup": "이 그룹에 봇이 없습니다",
    "workspace.createBotToStart": "봇을 생성하면 제작 흐름을 시작할 수 있습니다.",
    "workspace.botCount": "개 봇",
    "workspace.blockedCreate": "차단: bot.create",
    "workspace.createAllowed": "봇 생성 가능",
    "workspace.createBlocked": "차단: bot.create",
    "top.groupPrefix": "그룹",
    "top.botPrefix": "봇",
    "top.versionPrefix": "버전",
    "summary.llmUsed": "구성에 사용",
    "summary.llmNotUsed": "사용 안 함",
    "summary.allowed": "허용",
    "summary.disabled": "비활성",
    "transfer.jsonReplace": "JSON · 교체",
    "transfer.txtMergeShort": "TXT · 병합",
    "admin.groupJoin": "그룹 가입",
    "admin.groupAdminApproval": "그룹 관리자 승인",
    "admin.requiresGroupAdmin": "그룹 관리자 필요",
    "admin.adminPermission": "관리자 권한",
    "admin.systemAdminApproval": "시스템 admin 승인",
    "admin.requiresSystemAdmin": "시스템 admin 필요",
    "admin.noPendingApproval": "대기 중인 승인 없음",
    "admin.queueEmpty": "대기열이 비어 있습니다",
    "admin.noActiveUser": "활성 사용자 없음",
    "admin.systemAdminRequired": "시스템 admin 필요",
    "admin.approve": "승인",
    "apiAnswer.noApiAnswer": "API 답변 없음",
    "apiAnswer.registerForBot": "선택한 봇에 그룹 API 답변을 등록하세요.",
    "team.available": "사용 가능",
    "team.noAssignedTask": "배정된 작업 없음",
    "team.noReviewWaiting": "검수 대기 없음",
    "team.noBlockedItem": "차단 항목 없음",
    "team.currentUser": "현재 사용자",
    "team.unassigned": "미배정",
    "team.lockedBy": "잠금 사용자",
    "team.lock": "잠금",
    "team.unlock": "잠금 해제",
    "team.requestChanges": "수정 요청",
    "team.moveToTodo": "할 일로 이동",
    "state.bot": "봇",
    "state.locale": "Locale",
    "state.intents": "의도",
    "state.documents": "문서",
    "state.readiness": "준비 상태",
    "state.notNamed": "이름 없음",
    "state.ready": "준비 완료",
    "state.pdfAvailable": "사용 가능",
    "state.pdfBlockedLlm": "차단: LLM 필요",
    "state.kakaoAvailableKo": "한국어 봇에서 사용 가능",
    "state.kakaoDisabledNonKo": "한국어 외 비활성",
    "state.noBlockingIssue": "차단 이슈 없음",
    "review.utteranceUnit": "개 학습문장",
    "review.noIntentCandidate": "의도 후보 없음",
    "review.manualResultRequired": "수동 Handoff 또는 PDF Q&A 결과가 필요합니다",
    "module.screen": "화면",
    "module.publicCore": "Public Core",
    "module.commercialCandidate": "상용 후보",
    "test.dialogCard": "대화카드",
    "test.entities": "개체",
    "test.runtimeVariables": "런타임 변수",
    "test.apiAnswer": "API 답변",
    "test.trainingSample": "학습문장",
    "test.processingLog": "처리 로그",
    "test.answerSource": "답변 출처",
    "test.noEntity": "감지된 개체 없음",
    "test.noApi": "API 답변 없음",
    "test.aidotCompatible": "Aidot 호환 시뮬레이터 보기"
  },
  de: {
    "common.allowed": "Erlaubt",
    "common.blocked": "Blockiert",
    "common.disabled": "Deaktiviert",
    "common.enabled": "Aktiviert",
    "common.none": "Keine",
    "common.user": "Benutzer",
    "common.group": "Gruppe",
    "common.noRole": "keine Rolle",
    "common.intentUnit": "Intents",
    "common.pendingUnit": "ausstehend",
    "common.serverSaved": "auf Server gespeichert",
    "common.localOnly": "nur lokal",
    "common.yes": "Ja",
    "common.no": "Nein",
    "common.open": "Offen",
    "common.noScope": "kein Scope",
    "workspace.noGroup": "Keine Gruppe",
    "workspace.noGroupSelected": "Keine Gruppe ausgewählt",
    "workspace.noBotSelected": "Kein Bot ausgewählt",
    "workspace.noBotInGroup": "Kein Bot in dieser Gruppe",
    "workspace.createBotToStart": "Erstellen Sie einen Bot, um den Workflow zu starten.",
    "workspace.botCount": " Bot(s)",
    "workspace.blockedCreate": "blockiert: bot.create",
    "workspace.createAllowed": "Bots können erstellt werden",
    "workspace.createBlocked": "Blockiert: bot.create",
    "top.groupPrefix": "Gruppe",
    "top.botPrefix": "Bot",
    "top.versionPrefix": "Version",
    "summary.llmUsed": "Für Konfiguration verwendet",
    "summary.llmNotUsed": "Nicht verwendet",
    "summary.allowed": "Erlaubt",
    "summary.disabled": "Deaktiviert",
    "transfer.jsonReplace": "JSON · ersetzen",
    "transfer.txtMergeShort": "TXT · zusammenführen",
    "admin.groupJoin": "Gruppenbeitritt",
    "admin.groupAdminApproval": "Freigabe durch Gruppenadmin",
    "admin.requiresGroupAdmin": "Gruppenadmin erforderlich",
    "admin.adminPermission": "Admin-Berechtigung",
    "admin.systemAdminApproval": "Freigabe durch Systemadmin",
    "admin.requiresSystemAdmin": "Systemadmin erforderlich",
    "admin.noPendingApproval": "Keine ausstehende Freigabe",
    "admin.queueEmpty": "Warteschlange ist leer",
    "admin.noActiveUser": "Keine aktiven Benutzer",
    "admin.systemAdminRequired": "Systemadmin erforderlich",
    "admin.approve": "Freigeben",
    "apiAnswer.noApiAnswer": "Keine API-Antwort",
    "apiAnswer.registerForBot": "Registrieren Sie eine Gruppen-API-Antwort für den ausgewählten Bot.",
    "team.available": "Verfügbar",
    "team.noAssignedTask": "Keine zugewiesene Aufgabe",
    "team.noReviewWaiting": "Kein Review wartet",
    "team.noBlockedItem": "Kein blockiertes Element",
    "team.currentUser": "Aktueller Benutzer",
    "team.unassigned": "nicht zugewiesen",
    "team.lockedBy": "gesperrt von",
    "team.lock": "Sperren",
    "team.unlock": "Entsperren",
    "team.requestChanges": "Änderungen anfordern",
    "team.moveToTodo": "Zu Todo verschieben",
    "state.bot": "Bot",
    "state.locale": "Sprache",
    "state.intents": "Intents",
    "state.documents": "Dokumente",
    "state.readiness": "Bereitschaft",
    "state.notNamed": "Nicht benannt",
    "state.ready": "Bereit",
    "state.pdfAvailable": "Verfügbar",
    "state.pdfBlockedLlm": "Blockiert: LLM erforderlich",
    "state.kakaoAvailableKo": "Für koreanische Sprache verfügbar",
    "state.kakaoDisabledNonKo": "Außerhalb Koreanisch deaktiviert",
    "state.noBlockingIssue": "Kein blockierendes Problem.",
    "review.utteranceUnit": "Trainingssätze",
    "review.noIntentCandidate": "Kein Intent-Kandidat",
    "review.manualResultRequired": "Manuelles Handoff oder PDF-Q&A-Ergebnis erforderlich",
    "module.screen": "Bildschirm",
    "module.publicCore": "Public Core",
    "module.commercialCandidate": "Kommerzieller Kandidat",
    "test.dialogCard": "Dialogkarte",
    "test.entities": "Entitäten",
    "test.runtimeVariables": "Laufzeitvariablen",
    "test.apiAnswer": "API-Antwort",
    "test.trainingSample": "Trainingsbeispiel",
    "test.processingLog": "Verarbeitungslog",
    "test.answerSource": "Antwortquelle",
    "test.noEntity": "Keine Entität erkannt",
    "test.noApi": "Keine API-Antwort",
    "test.aidotCompatible": "Aidot-kompatible Simulatoransicht"
  },
  ja: {
    "common.allowed": "許可",
    "common.blocked": "ブロック",
    "common.disabled": "無効",
    "common.enabled": "有効",
    "common.none": "なし",
    "common.user": "ユーザー",
    "common.group": "グループ",
    "common.noRole": "役割なし",
    "common.intentUnit": "件の意図",
    "common.pendingUnit": "件保留",
    "common.serverSaved": "サーバー保存済み",
    "common.localOnly": "ローカルのみ",
    "common.yes": "はい",
    "common.no": "いいえ",
    "common.open": "開放",
    "common.noScope": "scopeなし",
    "workspace.noGroup": "グループなし",
    "workspace.noGroupSelected": "グループ未選択",
    "workspace.noBotSelected": "ボット未選択",
    "workspace.noBotInGroup": "このグループにボットはありません",
    "workspace.createBotToStart": "ボットを作成するとワークフローを開始できます。",
    "workspace.botCount": "個のボット",
    "workspace.blockedCreate": "ブロック: bot.create",
    "workspace.createAllowed": "ボットを作成できます",
    "workspace.createBlocked": "ブロック: bot.create",
    "top.groupPrefix": "グループ",
    "top.botPrefix": "ボット",
    "top.versionPrefix": "バージョン",
    "summary.llmUsed": "構成に使用",
    "summary.llmNotUsed": "未使用",
    "summary.allowed": "許可",
    "summary.disabled": "無効",
    "transfer.jsonReplace": "JSON · 置換",
    "transfer.txtMergeShort": "TXT · マージ",
    "admin.groupJoin": "グループ参加",
    "admin.groupAdminApproval": "グループ管理者承認",
    "admin.requiresGroupAdmin": "グループ管理者が必要",
    "admin.adminPermission": "管理者権限",
    "admin.systemAdminApproval": "システムadmin承認",
    "admin.requiresSystemAdmin": "システムadminが必要",
    "admin.noPendingApproval": "保留中の承認なし",
    "admin.queueEmpty": "キューは空です",
    "admin.noActiveUser": "有効なユーザーなし",
    "admin.systemAdminRequired": "システムadminが必要",
    "admin.approve": "承認",
    "apiAnswer.noApiAnswer": "API回答なし",
    "apiAnswer.registerForBot": "選択したボットにグループAPI回答を登録してください。",
    "team.available": "利用可能",
    "team.noAssignedTask": "割り当てタスクなし",
    "team.noReviewWaiting": "レビュー待ちなし",
    "team.noBlockedItem": "ブロック項目なし",
    "team.currentUser": "現在のユーザー",
    "team.unassigned": "未割り当て",
    "team.lockedBy": "ロック中",
    "team.lock": "ロック",
    "team.unlock": "ロック解除",
    "team.requestChanges": "変更依頼",
    "team.moveToTodo": "Todoへ移動",
    "state.bot": "ボット",
    "state.locale": "Locale",
    "state.intents": "意図",
    "state.documents": "文書",
    "state.readiness": "準備状態",
    "state.notNamed": "名前なし",
    "state.ready": "準備完了",
    "state.pdfAvailable": "利用可能",
    "state.pdfBlockedLlm": "ブロック: LLMが必要",
    "state.kakaoAvailableKo": "韓国語ロケールで利用可能",
    "state.kakaoDisabledNonKo": "韓国語以外では無効",
    "state.noBlockingIssue": "ブロック中の問題なし。",
    "review.utteranceUnit": "件の学習文",
    "review.noIntentCandidate": "意図候補なし",
    "review.manualResultRequired": "手動HandoffまたはPDF Q&A結果が必要です",
    "module.screen": "画面",
    "module.publicCore": "Public Core",
    "module.commercialCandidate": "商用候補",
    "test.dialogCard": "対話カード",
    "test.entities": "エンティティ",
    "test.runtimeVariables": "ランタイム変数",
    "test.apiAnswer": "API回答",
    "test.trainingSample": "学習文",
    "test.processingLog": "処理ログ",
    "test.answerSource": "回答元",
    "test.noEntity": "検出されたエンティティなし",
    "test.noApi": "API回答なし",
    "test.aidotCompatible": "Aidot互換シミュレーター表示"
  },
  "zh-CN": {
    "common.allowed": "允许",
    "common.blocked": "阻止",
    "common.disabled": "禁用",
    "common.enabled": "启用",
    "common.none": "无",
    "common.user": "用户",
    "common.group": "组",
    "common.noRole": "无角色",
    "common.intentUnit": "个意图",
    "common.pendingUnit": "个待处理",
    "common.serverSaved": "已保存到服务器",
    "common.localOnly": "仅本地",
    "common.yes": "是",
    "common.no": "否",
    "common.open": "开放",
    "common.noScope": "无scope",
    "workspace.noGroup": "无组",
    "workspace.noGroupSelected": "未选择组",
    "workspace.noBotSelected": "未选择机器人",
    "workspace.noBotInGroup": "此组中没有机器人",
    "workspace.createBotToStart": "创建机器人即可开始流程。",
    "workspace.botCount": "个机器人",
    "workspace.blockedCreate": "阻止: bot.create",
    "workspace.createAllowed": "可创建机器人",
    "workspace.createBlocked": "已阻止：bot.create",
    "top.groupPrefix": "组",
    "top.botPrefix": "机器人",
    "top.versionPrefix": "版本",
    "summary.llmUsed": "用于配置",
    "summary.llmNotUsed": "未使用",
    "summary.allowed": "允许",
    "summary.disabled": "禁用",
    "transfer.jsonReplace": "JSON · 替换",
    "transfer.txtMergeShort": "TXT · 合并",
    "admin.groupJoin": "组加入",
    "admin.groupAdminApproval": "组管理员审批",
    "admin.requiresGroupAdmin": "需要组管理员",
    "admin.adminPermission": "管理员权限",
    "admin.systemAdminApproval": "系统admin审批",
    "admin.requiresSystemAdmin": "需要系统admin",
    "admin.noPendingApproval": "没有待审批项",
    "admin.queueEmpty": "队列为空",
    "admin.noActiveUser": "没有活跃用户",
    "admin.systemAdminRequired": "需要系统admin",
    "admin.approve": "审批",
    "apiAnswer.noApiAnswer": "没有API回答",
    "apiAnswer.registerForBot": "请为所选机器人注册组API回答。",
    "team.available": "可用",
    "team.noAssignedTask": "没有分配任务",
    "team.noReviewWaiting": "没有审核等待",
    "team.noBlockedItem": "没有阻塞项",
    "team.currentUser": "当前用户",
    "team.unassigned": "未分配",
    "team.lockedBy": "锁定者",
    "team.lock": "锁定",
    "team.unlock": "解锁",
    "team.requestChanges": "请求修改",
    "team.moveToTodo": "移到Todo",
    "state.bot": "机器人",
    "state.locale": "Locale",
    "state.intents": "意图",
    "state.documents": "文档",
    "state.readiness": "就绪状态",
    "state.notNamed": "未命名",
    "state.ready": "就绪",
    "state.pdfAvailable": "可用",
    "state.pdfBlockedLlm": "阻止：需要LLM",
    "state.kakaoAvailableKo": "韩语locale可用",
    "state.kakaoDisabledNonKo": "非韩语locale禁用",
    "state.noBlockingIssue": "没有阻塞问题。",
    "review.utteranceUnit": "条训练语句",
    "review.noIntentCandidate": "没有意图候选",
    "review.manualResultRequired": "需要手动Handoff或PDF Q&A结果",
    "module.screen": "屏幕",
    "module.publicCore": "Public Core",
    "module.commercialCandidate": "商业候选",
    "test.dialogCard": "对话卡片",
    "test.entities": "实体",
    "test.runtimeVariables": "运行时变量",
    "test.apiAnswer": "API 答案",
    "test.trainingSample": "训练语句",
    "test.processingLog": "处理日志",
    "test.answerSource": "答案来源",
    "test.noEntity": "未检测到实体",
    "test.noApi": "无 API 答案",
    "test.aidotCompatible": "Aidot 兼容模拟器视图"
  },
  vi: {
    "common.allowed": "Được phép",
    "common.blocked": "Bị chặn",
    "common.disabled": "Tắt",
    "common.enabled": "Bật",
    "common.none": "Không có",
    "common.user": "Người dùng",
    "common.group": "Nhóm",
    "common.noRole": "không có vai trò",
    "common.intentUnit": "ý định",
    "common.pendingUnit": "đang chờ",
    "common.serverSaved": "đã lưu máy chủ",
    "common.localOnly": "chỉ cục bộ",
    "common.yes": "Có",
    "common.no": "Không",
    "common.open": "Mở",
    "common.noScope": "không có scope",
    "workspace.noGroup": "Không có nhóm",
    "workspace.noGroupSelected": "Chưa chọn nhóm",
    "workspace.noBotSelected": "Chưa chọn bot",
    "workspace.noBotInGroup": "Không có bot trong nhóm này",
    "workspace.createBotToStart": "Tạo bot để bắt đầu quy trình.",
    "workspace.botCount": "bot",
    "workspace.blockedCreate": "bị chặn: bot.create",
    "workspace.createAllowed": "Có thể tạo bot",
    "workspace.createBlocked": "Bị chặn: bot.create",
    "top.groupPrefix": "Nhóm",
    "top.botPrefix": "Bot",
    "top.versionPrefix": "Phiên bản",
    "summary.llmUsed": "Dùng để cấu hình",
    "summary.llmNotUsed": "Không dùng",
    "summary.allowed": "Được phép",
    "summary.disabled": "Tắt",
    "transfer.jsonReplace": "JSON · thay thế",
    "transfer.txtMergeShort": "TXT · gộp",
    "admin.groupJoin": "vào nhóm",
    "admin.groupAdminApproval": "group admin phê duyệt",
    "admin.requiresGroupAdmin": "cần group admin",
    "admin.adminPermission": "quyền admin",
    "admin.systemAdminApproval": "system admin phê duyệt",
    "admin.requiresSystemAdmin": "cần system admin",
    "admin.noPendingApproval": "Không có phê duyệt đang chờ",
    "admin.queueEmpty": "Hàng đợi trống",
    "admin.noActiveUser": "Không có người dùng hoạt động",
    "admin.systemAdminRequired": "Cần system admin",
    "admin.approve": "Phê duyệt",
    "apiAnswer.noApiAnswer": "Không có trả lời API",
    "apiAnswer.registerForBot": "Đăng ký trả lời API nhóm cho bot đã chọn.",
    "team.available": "Khả dụng",
    "team.noAssignedTask": "Không có việc được giao",
    "team.noReviewWaiting": "Không có review đang chờ",
    "team.noBlockedItem": "Không có mục bị chặn",
    "team.currentUser": "Người dùng hiện tại",
    "team.unassigned": "chưa gán",
    "team.lockedBy": "đã khóa bởi",
    "team.lock": "Khóa",
    "team.unlock": "Mở khóa",
    "team.requestChanges": "Yêu cầu sửa",
    "team.moveToTodo": "Chuyển về Todo",
    "state.bot": "Bot",
    "state.locale": "Locale",
    "state.intents": "Ý định",
    "state.documents": "Tài liệu",
    "state.readiness": "Sẵn sàng",
    "state.notNamed": "Chưa đặt tên",
    "state.ready": "Sẵn sàng",
    "state.pdfAvailable": "Khả dụng",
    "state.pdfBlockedLlm": "Bị chặn: cần LLM",
    "state.kakaoAvailableKo": "Khả dụng cho locale Hàn",
    "state.kakaoDisabledNonKo": "Tắt ngoài locale Hàn",
    "state.noBlockingIssue": "Không có vấn đề chặn.",
    "review.utteranceUnit": "câu huấn luyện",
    "review.noIntentCandidate": "Không có ý định ứng viên",
    "review.manualResultRequired": "Cần kết quả Handoff thủ công hoặc PDF Q&A",
    "module.screen": "Màn hình",
    "module.publicCore": "Public Core",
    "module.commercialCandidate": "Ứng viên thương mại",
    "test.dialogCard": "Thẻ hội thoại",
    "test.entities": "Thực thể",
    "test.runtimeVariables": "Biến runtime",
    "test.apiAnswer": "Câu trả lời API",
    "test.trainingSample": "Mẫu huấn luyện",
    "test.processingLog": "Nhật ký xử lý",
    "test.answerSource": "Nguồn trả lời",
    "test.noEntity": "Không phát hiện thực thể",
    "test.noApi": "Không có câu trả lời API",
    "test.aidotCompatible": "Chế độ mô phỏng tương thích Aidot"
  },
  fr: {
    "common.allowed": "Autorisé",
    "common.blocked": "Bloqué",
    "common.disabled": "Désactivé",
    "common.enabled": "Activé",
    "common.none": "Aucun",
    "common.user": "Utilisateur",
    "common.group": "Groupe",
    "common.noRole": "aucun rôle",
    "common.intentUnit": "intentions",
    "common.pendingUnit": "en attente",
    "common.serverSaved": "enregistré serveur",
    "common.localOnly": "local uniquement",
    "common.yes": "Oui",
    "common.no": "Non",
    "common.open": "Ouvert",
    "common.noScope": "aucun scope",
    "workspace.noGroup": "Aucun groupe",
    "workspace.noGroupSelected": "Aucun groupe sélectionné",
    "workspace.noBotSelected": "Aucun bot sélectionné",
    "workspace.noBotInGroup": "Aucun bot dans ce groupe",
    "workspace.createBotToStart": "Créez un bot pour démarrer le flux.",
    "workspace.botCount": "bot(s)",
    "workspace.blockedCreate": "bloqué : bot.create",
    "workspace.createAllowed": "Peut créer des bots",
    "workspace.createBlocked": "Bloqué : bot.create",
    "top.groupPrefix": "Groupe",
    "top.botPrefix": "Bot",
    "top.versionPrefix": "Version",
    "summary.llmUsed": "Utilisé pour la configuration",
    "summary.llmNotUsed": "Non utilisé",
    "summary.allowed": "Autorisé",
    "summary.disabled": "Désactivé",
    "transfer.jsonReplace": "JSON · remplacer",
    "transfer.txtMergeShort": "TXT · fusionner",
    "admin.groupJoin": "adhésion au groupe",
    "admin.groupAdminApproval": "approbation admin de groupe",
    "admin.requiresGroupAdmin": "admin de groupe requis",
    "admin.adminPermission": "permission admin",
    "admin.systemAdminApproval": "approbation admin système",
    "admin.requiresSystemAdmin": "admin système requis",
    "admin.noPendingApproval": "Aucune approbation en attente",
    "admin.queueEmpty": "La file est vide",
    "admin.noActiveUser": "Aucun utilisateur actif",
    "admin.systemAdminRequired": "Admin système requis",
    "admin.approve": "Approuver",
    "apiAnswer.noApiAnswer": "Aucune réponse API",
    "apiAnswer.registerForBot": "Enregistrez une réponse API de groupe pour le bot sélectionné.",
    "team.available": "Disponible",
    "team.noAssignedTask": "Aucune tâche assignée",
    "team.noReviewWaiting": "Aucune revue en attente",
    "team.noBlockedItem": "Aucun élément bloqué",
    "team.currentUser": "Utilisateur courant",
    "team.unassigned": "non assigné",
    "team.lockedBy": "verrouillé par",
    "team.lock": "Verrouiller",
    "team.unlock": "Déverrouiller",
    "team.requestChanges": "Demander des changements",
    "team.moveToTodo": "Déplacer vers Todo",
    "state.bot": "Bot",
    "state.locale": "Locale",
    "state.intents": "Intentions",
    "state.documents": "Documents",
    "state.readiness": "État de préparation",
    "state.notNamed": "Sans nom",
    "state.ready": "Prêt",
    "state.pdfAvailable": "Disponible",
    "state.pdfBlockedLlm": "Bloqué : LLM requis",
    "state.kakaoAvailableKo": "Disponible pour la locale coréenne",
    "state.kakaoDisabledNonKo": "Désactivé hors locale coréenne",
    "state.noBlockingIssue": "Aucun problème bloquant.",
    "review.utteranceUnit": "énoncés",
    "review.noIntentCandidate": "Aucun candidat d’intention",
    "review.manualResultRequired": "Résultat Handoff manuel ou PDF Q&A requis",
    "module.screen": "Écran",
    "module.publicCore": "Public Core",
    "module.commercialCandidate": "Candidat commercial",
    "test.dialogCard": "Carte de dialogue",
    "test.entities": "Entités",
    "test.runtimeVariables": "Variables d'exécution",
    "test.apiAnswer": "Réponse API",
    "test.trainingSample": "Exemple d'entraînement",
    "test.processingLog": "Journal de traitement",
    "test.answerSource": "Source de réponse",
    "test.noEntity": "Aucune entité détectée",
    "test.noApi": "Aucune réponse API",
    "test.aidotCompatible": "Vue simulateur compatible Aidot"
  }
};

function getCurrentLocale() {
  return window.cgaStudioI18n?.getLocale?.() || document.querySelector("[data-locale-select]")?.value || localStorage.getItem("cga.studio.locale") || getCurrentAccessUser()?.locale || document.documentElement.lang || "en";
}

function t(key, fallback = key) {
  const locale = getCurrentLocale();
  return dynamicMessages[locale]?.[key] ||
    window.cgaStudioI18n?.resolveMessage?.(locale, key, fallback) ||
    dynamicMessages.en[key] ||
    fallback;
}

function getCgaErrorMessage(error, fallback = "Request failed.") {
  const payload = error?.payload || error || {};
  const key = payload.message_key || payload.key;
  return key ? t(key, payload.fallback_message || payload.error_code || fallback) : fallback;
}

function setAuthMessage(kind, titleKey, bodyKeyOrText) {
  currentAuthMessage = { kind, titleKey, bodyKeyOrText };
}

function clearAuthMessage() {
  currentAuthMessage = null;
}

function setGlobalMessage(kind, titleKey, bodyKeyOrText) {
  currentGlobalMessage = { kind, titleKey, bodyKeyOrText };
}

function clearGlobalMessage() {
  currentGlobalMessage = null;
}

function renderMessageNode(node, message, fallbackTitle = "Message") {
  if (!node) return;
  node.hidden = !message;
  const body = message?.bodyKeyOrText || "";
  node.innerHTML = message ? `
    <strong>${t(message.titleKey, fallbackTitle)}</strong>
    <span>${body.includes(".") ? t(body, body) : body}</span>
  ` : "";
}

function showApiErrorMessage(error, titleKey = "message.actionFailedTitle") {
  setGlobalMessage("error", titleKey, getCgaErrorMessage(error, t("message.actionFailedBody", "The action could not be completed.")));
}

function renderGlobalMessage() {
  renderMessageNode(document.querySelector("[data-global-message]"), currentGlobalMessage, "Message");
}

function applyDynamicLocaleOverrides(locale = getCurrentLocale()) {
  const messages = dynamicMessages[locale];
  if (!messages) return;
  document.documentElement.lang = locale;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (messages[key]) node.textContent = messages[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.getAttribute("data-i18n-placeholder");
    if (messages[key]) node.setAttribute("placeholder", messages[key]);
  });
  const select = document.querySelector("[data-locale-select]");
  if (select && select.value !== locale) select.value = locale;
}

function getActiveGroupsForCurrentUser() {
  if (isSystemAdmin(currentAccessState, currentAccessState.currentUserId)) {
    return currentAccessState.groups.filter((group) => group.status === "active");
  }
  const memberships = currentAccessState.memberships.filter((membership) => membership.user_id === currentAccessState.currentUserId && membership.status === "active");
  return currentAccessState.groups.filter((group) => group.status === "active" && memberships.some((membership) => membership.group_id === group.id));
}

function getAccessibleBotListForGroup(groupId) {
  return currentWorkspaceBots.filter((bot) => (
    String(bot.group_id || bot.groupId || "") === String(groupId)
    && bot.status !== "deleted"
  ));
}

function getCurrentWorkspaceGroup() {
  return currentAccessState.groups.find((group) => group.id === currentWorkspaceGroupId) || getActiveGroupsForCurrentUser()[0] || null;
}

function getCurrentWorkspaceBot() {
  return currentWorkspaceBots.find((bot) => bot.id === currentWorkspaceBotId) || currentWorkspaceBots.find((bot) => bot.group_id === currentWorkspaceGroupId) || null;
}

function syncWorkspaceSelection() {
  const groups = getActiveGroupsForCurrentUser();
  if (!groups.length) return { groups, bots: [] };

  const currentGroupStillVisible = groups.some((group) => group.id === currentWorkspaceGroupId);
  const currentGroupBots = currentGroupStillVisible ? getAccessibleBotListForGroup(currentWorkspaceGroupId) : [];
  const botMatchedGroup = currentWorkspaceBots.find((bot) => bot.id === currentWorkspaceBotId)?.group_id;
  const preferredGroupId = [
    botMatchedGroup,
    currentStudioState.bot.id ? currentWorkspaceBots.find((bot) => bot.id === currentStudioState.bot.id)?.group_id : "",
    groups.find((group) => getAccessibleBotListForGroup(group.id).length > 0)?.id,
    groups[0]?.id
  ].find((groupId) => groupId && groups.some((group) => group.id === groupId));

  if (!currentGroupStillVisible || (!currentGroupBots.length && preferredGroupId && preferredGroupId !== currentWorkspaceGroupId)) {
    currentWorkspaceGroupId = preferredGroupId || groups[0].id;
  }

  const bots = getAccessibleBotListForGroup(currentWorkspaceGroupId);
  const selectedBot = bots.find((bot) => bot.id === currentWorkspaceBotId)
    || bots.find((bot) => bot.id === currentStudioState.bot.id)
    || bots[0]
    || null;

  if (selectedBot) {
    currentWorkspaceBotId = selectedBot.id;
    selectedBotManagementId = selectedBot.id;
    if (currentStudioState.bot.id !== selectedBot.id || currentStudioState.bot.name !== selectedBot.name || currentStudioState.bot.version !== selectedBot.version) {
      applyCurrentBotToStudioState(selectedBot);
    }
  } else {
    currentWorkspaceBotId = "";
    if (!bots.length) selectedBotManagementId = "";
  }

  return { groups, bots };
}

function getWorkspaceMetaStorageKey(base) {
  const userId = currentAccessState.currentUserId || "anonymous";
  return `${base}:${userId}`;
}

function loadWorkspaceRecentBots() {
  try {
    const raw = localStorage.getItem(getWorkspaceMetaStorageKey(WORKSPACE_RECENT_BOTS_STORAGE_KEY));
    const parsed = raw ? JSON.parse(raw) : [];
    currentWorkspaceRecentBots = Array.isArray(parsed) ? parsed.filter((item) => item && item.groupId && item.botId).slice(0, 20) : [];
  } catch {
    currentWorkspaceRecentBots = [];
  }
}

function saveWorkspaceRecentBots() {
  try {
    localStorage.setItem(
      getWorkspaceMetaStorageKey(WORKSPACE_RECENT_BOTS_STORAGE_KEY),
      JSON.stringify(currentWorkspaceRecentBots)
    );
  } catch {
    // ignore
  }
}

function trackRecentWorkspaceBot(bot) {
  if (!bot?.id || !bot?.group_id) return;
  const key = `${bot.group_id}::${bot.id}`;
  const item = {
    key,
    groupId: bot.group_id,
    botId: bot.id,
    name: bot.name || bot.id,
    locale: bot.locale || "en",
    version: bot.version || "v0.1",
    touchedAt: Date.now()
  };
  const filtered = currentWorkspaceRecentBots.filter((entry) => entry.key !== key);
  currentWorkspaceRecentBots = [item, ...filtered].slice(0, 12);
  saveWorkspaceRecentBots();
}

function getRecentWorkspaceBotsByGroup(groupId) {
  if (!groupId) return [];
  return currentWorkspaceRecentBots.filter((item) => item.groupId === groupId).slice(0, 12);
}

function getBotsForGroup(groupId) {
  return currentWorkspaceBots.filter((bot) => bot.group_id === groupId);
}

function getBotVersionRegistry() {
  try {
    const raw = localStorage.getItem(getWorkspaceMetaStorageKey(BOT_VERSION_REGISTRY_STORAGE_KEY));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveBotVersionRegistry() {
  try {
    localStorage.setItem(getWorkspaceMetaStorageKey(BOT_VERSION_REGISTRY_STORAGE_KEY), JSON.stringify(botVersionRegistry));
  } catch {
    // ignore
  }
}

function getBotVersionListKey(groupId, botId) {
  return `${groupId || ""}::${botId || ""}`;
}

function normalizeBotVersionVersion(input, fallback = "v0.1") {
  const value = String(input || fallback).trim();
  return /^v?\d+(\.\d+)?$/.test(value) ? (value.startsWith("v") ? value : `v${value}`) : fallback;
}

function ensureBotVersionRegistryFor(bot) {
  if (!bot?.id || !bot?.group_id) return;
  if (!botVersionRegistry) botVersionRegistry = {};
  const key = getBotVersionListKey(bot.group_id, bot.id);
  if (!Array.isArray(botVersionRegistry[key])) {
    const now = bot.updated_at || new Date().toISOString().slice(0, 10);
    botVersionRegistry[key] = [
      {
        id: normalizeBotVersionVersion(bot.version || "v0.1"),
        status: bot.status || "draft",
        createdAt: now,
        updatedAt: now,
        operator: "system",
        note: "초기 버전",
        isActive: true
      }
    ];
    saveBotVersionRegistry();
  }
}

function getBotVersions(bot) {
  if (!bot?.id || !bot?.group_id) return [];
  ensureBotVersionRegistryFor(bot);
  const key = getBotVersionListKey(bot.group_id, bot.id);
  return [...(botVersionRegistry[key] || [])].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

function buildNextBotVersionId(bot, versions) {
  const normalized = normalizeBotVersionVersion(bot?.version || "v0.1");
  const base = normalized.match(/^v(\d+)(?:\.(\d+))?$/);
  const baseMajor = Number(base?.[1] || 0);
  const baseMinor = Number(base?.[2] || 0);
  const existingVersions = [...(versions || [])].map((entry) => {
    const match = String(entry?.id || "").match(/^v?(\d+)(?:\.(\d+))?$/);
    return match ? { major: Number(match[1]), minor: Number(match[2] || 0), raw: match[0] } : null;
  }).filter(Boolean);
  const sameMajor = existingVersions.filter((entry) => entry.major === baseMajor);
  const maxMinor = sameMajor.length ? Math.max(...sameMajor.map((entry) => entry.minor)) : baseMinor;
  const candidate = `v${baseMajor}.${maxMinor + 1}`;
  if (versions?.some((entry) => entry.id === candidate)) {
    return `v${baseMajor}.${maxMinor + 2}`;
  }
  return candidate;
}

function addWorkspaceBotVersion(bot, sourceVersionId = null) {
  if (!bot?.id || !bot?.group_id) return null;
  const versions = getBotVersions(bot);
  const sourceVersion = sourceVersionId
    ? versions.find((item) => item.id === sourceVersionId) || versions[0]
    : versions[0] || null;
  const nextId = buildNextBotVersionId(bot, versions);
  const now = new Date().toISOString();
  const next = {
    id: normalizeBotVersionVersion(nextId),
    status: sourceVersion?.status || bot.status || "draft",
    createdAt: now,
    updatedAt: now,
    operator: currentAccessState.currentUserId || "system",
    note: `버전 추가 (${sourceVersion?.id || bot.version || "v0.1"})`,
    isActive: false
  };
  const nextVersions = [next, ...versions.map((item) => ({ ...item, isActive: item.id === bot.version }))];
  updateBotVersionRegistry(bot, nextVersions);
  return next;
}

function duplicateWorkspaceBotVersion(bot, versionId) {
  if (!bot?.id || !bot?.group_id || !versionId) return null;
  const versions = getBotVersions(bot);
  const source = versions.find((item) => item.id === versionId);
  if (!source) return null;
  const now = new Date().toISOString();
  const existingNames = new Set(versions.map((item) => item.id));
  let suffix = 1;
  let nextId = `${normalizeBotVersionVersion(source.id)}-copy`;
  while (existingNames.has(nextId)) {
    nextId = `${normalizeBotVersionVersion(source.id)}-copy-${suffix++}`;
  }
  const next = {
    id: nextId,
    status: source.status || "draft",
    createdAt: now,
    updatedAt: now,
    operator: currentAccessState.currentUserId || "system",
    note: `${source.id} 복사본`,
    isActive: false
  };
  const nextVersions = [next, ...versions.map((item) => ({ ...item, isActive: item.isActive || false }))];
  updateBotVersionRegistry(bot, nextVersions);
  return next;
}

function removeWorkspaceBotVersion(bot, versionId) {
  if (!bot?.id || !bot?.group_id || !versionId) return [];
  const versions = getBotVersions(bot).filter((item) => item.id !== versionId);
  const normalized = versions.length ? versions.map((item) => ({
    ...item,
    isActive: item.id === bot.version
  })) : [];
  if (!normalized.some((item) => item.isActive) && normalized.length) {
    normalized[0].isActive = true;
    bot.version = normalized[0].id;
  }
  updateBotVersionRegistry(bot, normalized);
  if (normalized.length === 0) {
    updateBotVersionRegistry(bot, []);
  }
  return normalized;
}

function removeWorkspaceBotVersionRegistry(bot) {
  if (!bot?.id || !bot?.group_id) return;
  const key = getBotVersionListKey(bot.group_id, bot.id);
  if (!(key in botVersionRegistry)) return;
  delete botVersionRegistry[key];
  saveBotVersionRegistry();
}

function updateBotVersionRegistry(bot, nextVersions) {
  if (!bot?.id || !bot?.group_id) return;
  const key = getBotVersionListKey(bot.group_id, bot.id);
  botVersionRegistry[key] = nextVersions;
  saveBotVersionRegistry();
}

function setActiveBotVersion(bot, versionId) {
  if (!bot?.id || !versionId) return;
  const versions = getBotVersions(bot).map((version) => ({
    ...version,
    isActive: version.id === versionId
  }));
  if (!versions.some((version) => version.isActive)) return;
  updateBotVersionRegistry(bot, versions);
  bot.version = versionId;
}

function canManageApiAnswerForCurrentSelection() {
  return getEffectiveGroupScopes(currentAccessState, currentAccessState.currentUserId, currentApiGroupId, currentApiBotId).includes("apiAnswer.manage");
}

function canCreateBotInCurrentWorkspace() {
  return getEffectiveGroupScopes(currentAccessState, currentAccessState.currentUserId, currentWorkspaceGroupId, currentWorkspaceBotId).includes("bot.create");
}

function canManageBotInCurrentWorkspace() {
  return getEffectiveGroupScopes(currentAccessState, currentAccessState.currentUserId, currentWorkspaceGroupId, currentWorkspaceBotId).includes("bot.configure");
}

function canOperateCurrentBot() {
  return getEffectiveGroupScopes(currentAccessState, currentAccessState.currentUserId, currentWorkspaceGroupId, currentWorkspaceBotId).includes("bot.operate");
}

function canAnalyzeCurrentBot() {
  return getEffectiveGroupScopes(currentAccessState, currentAccessState.currentUserId, currentWorkspaceGroupId, currentWorkspaceBotId).includes("bot.analyze");
}

function applyCurrentBotToStudioState(bot) {
  if (!bot) return;
  currentWorkspaceBotId = bot.id;
  currentWorkspaceGroupId = bot.group_id;
  currentApiGroupId = bot.group_id;
  currentApiBotId = bot.id;
  currentStudioState.bot.id = bot.id;
  currentStudioState.bot.name = bot.name;
  currentStudioState.bot.defaultLocale = bot.locale;
  currentStudioState.bot.version = bot.version || currentStudioState.bot.version || "v0.1";
  trackRecentWorkspaceBot(bot);
  ensureBotVersionRegistryFor(bot);
}

function getWorkspaceSnapshotKey(groupId = currentWorkspaceGroupId, botId = currentWorkspaceBotId) {
  return [
    WORKSPACE_SNAPSHOT_STORAGE_PREFIX,
    currentAccessState.currentUserId || "anonymous",
    groupId || "no-group",
    botId || "no-bot"
  ].join(":");
}

function cloneForSnapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

function saveWorkspaceSnapshot() {
  if (!currentWorkspaceGroupId || !currentWorkspaceBotId) return false;
  try {
    localStorage.setItem(getWorkspaceSnapshotKey(), JSON.stringify({
      version: WORKSPACE_SNAPSHOT_VERSION,
      saved_at: Date.now(),
      group_id: currentWorkspaceGroupId,
      bot_id: currentWorkspaceBotId,
      workspace_bots: cloneForSnapshot(currentWorkspaceBots.filter((bot) => bot.group_id === currentWorkspaceGroupId)),
      studio_state: cloneForSnapshot(currentStudioState),
      composition_state: cloneForSnapshot(currentCompositionState),
      detail_assets: {
        intent_utterances: cloneForSnapshot(currentIntentUtteranceAssets),
        entities: cloneForSnapshot(currentEntityAssets),
        dictionary: cloneForSnapshot(currentDictionaryAssets),
        rules: cloneForSnapshot(currentRuleAssets),
        scenarios: cloneForSnapshot(currentScenarioAssets)
      },
      operations_state: cloneForSnapshot(currentOperationsState),
      collaboration_state: cloneForSnapshot(currentCollaborationState)
    }));
    return true;
  } catch {
    return false;
  }
}

function applyWorkspaceSnapshot(snapshot) {
  if (!snapshot || snapshot.version !== WORKSPACE_SNAPSHOT_VERSION) return false;
  if (snapshot.group_id !== currentWorkspaceGroupId || snapshot.bot_id !== currentWorkspaceBotId) return false;
  if (Array.isArray(snapshot.workspace_bots)) {
    currentWorkspaceBots = [
      ...currentWorkspaceBots.filter((bot) => bot.group_id !== currentWorkspaceGroupId),
      ...snapshot.workspace_bots
    ];
  }
  if (snapshot.studio_state) applyStudioStateFromServer(snapshot.studio_state);
  if (snapshot.composition_state) applyCompositionFromServer(snapshot.composition_state);
  if (snapshot.detail_assets) applyDetailAssetsFromServer(snapshot.detail_assets);
  if (snapshot.operations_state) applyOperationsStateFromServer(snapshot.operations_state);
  if (snapshot.collaboration_state) applyCollaborationStateFromServer(snapshot.collaboration_state);
  return true;
}

function loadWorkspaceMetaState() {
  botVersionRegistry = getBotVersionRegistry();
  loadWorkspaceRecentBots();
}

function applyCachedWorkspaceSnapshot({ maxAgeMs = WORKSPACE_SNAPSHOT_TTL_MS } = {}) {
  if (!currentWorkspaceGroupId || !currentWorkspaceBotId) return false;
  try {
    const raw = localStorage.getItem(getWorkspaceSnapshotKey());
    if (!raw) return false;
    const snapshot = JSON.parse(raw);
    if (Date.now() - Number(snapshot.saved_at || 0) > maxAgeMs) return false;
    return applyWorkspaceSnapshot(snapshot);
  } catch {
    return false;
  }
}

function getSafeFileName(value, fallback) {
  const normalized = String(value || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, "_");
  return normalized || fallback;
}

function getTodayStamp() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
}

function downloadJsonFile(fileName, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function downloadTextFile(fileName, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function downloadBlobFile(fileName, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function getAssetTransferScope(assetKey) {
  return {
    botPackage: "bot",
    versionPackage: "version",
    intentDialog: "dialog",
    scenario: "dialog",
    apiMapping: "api",
    intentUtterance: "intent_utterance",
    entity: "entity",
    dictionary: "dictionary",
    rule: "rule"
  }[assetKey] || assetKey;
}

function getAssetTransferFileFormat(assetKey) {
  return ["botPackage", "versionPackage", "intentDialog", "scenario", "apiMapping"].includes(assetKey) ? "json" : "txt";
}

function formatMessage(key, values = {}, fallback = key) {
  let message = t(key, fallback);
  for (const [name, value] of Object.entries(values)) {
    message = message.replaceAll(`{${name}}`, String(value));
  }
  return message;
}

function getTransferAssetLabel(assetKey) {
  return t(`transfer.asset.${assetKey}`, assetKey);
}

function getTransferSyncLabel(synced) {
  return synced ? t("common.serverSaved", "server saved") : t("common.localOnly", "local only");
}

function formatTransferDownloaded(assetKey, fileName, source = "local") {
  return formatMessage(
    source === "server" ? "transfer.status.downloadedServer" : "transfer.status.downloaded",
    { asset: getTransferAssetLabel(assetKey), file: fileName },
    source === "server" ? "Downloaded {asset} from server asset API: {file}" : "Downloaded {asset}: {file}"
  );
}

function formatTransferUploaded(assetKey, count, synced) {
  return formatMessage(
    "transfer.status.uploadedRows",
    { asset: getTransferAssetLabel(assetKey), count, sync: getTransferSyncLabel(synced) },
    "Uploaded {asset}: {count} row(s) merged / {sync}"
  );
}

function appendTransferSyncStatus(synced) {
  const base = currentTransferStatus || t("transfer.status.updated", "Updated package");
  return `${base} / ${getTransferSyncLabel(synced)}`;
}

function getAssetTransferUrl(assetKey, action) {
  const groupId = encodeURIComponent(currentWorkspaceGroupId || "g-support");
  const botId = encodeURIComponent(currentWorkspaceBotId || "supportbot-draft");
  const scope = encodeURIComponent(getAssetTransferScope(assetKey));
  const botLocale = encodeURIComponent(currentStudioState.bot.defaultLocale || "en");
  return `/api/cga/groups/${groupId}/bots/${botId}/assets/${scope}/${action}?bot_locale=${botLocale}`;
}

function getFileNameFromContentDisposition(value) {
  const match = String(value || "").match(/filename="([^"]+)"/);
  return match?.[1] || "";
}

function getCgaAuthHeaders() {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "X-CGA-User-Id": currentAccessState.currentUserId || "admin"
  };
  const token = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (token) headers["X-CGA-Session-Token"] = token;
  return headers;
}

function rememberAuthSession(session) {
  if (session?.session_token) localStorage.setItem(AUTH_SESSION_STORAGE_KEY, session.session_token);
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

function hasAuthSession() {
  return Boolean(localStorage.getItem(AUTH_SESSION_STORAGE_KEY));
}

function getEntryAuthMode() {
  return document.querySelector(".login-form-card")?.dataset.entryMode || "login";
}

function setEntryAuthMode(mode) {
  const nextMode = mode === "signup" ? "signup" : "login";
  const card = document.querySelector(".login-form-card");
  const signupPanel = document.querySelector("[data-entry-signup-panel]");
  if (card) card.dataset.entryMode = nextMode;
  document.querySelectorAll("[data-entry-login-panel]").forEach((loginPanel) => {
    loginPanel.hidden = nextMode !== "login";
  });
  if (signupPanel) signupPanel.hidden = nextMode !== "signup";
  document.querySelectorAll("[data-entry-auth-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.entryAuthTab === nextMode);
  });
}

function renderEntryAuthMessage() {
  renderMessageNode(document.querySelector("[data-entry-auth-message]"), currentAuthMessage, t("admin.authentication", "Authentication"));
}

function applyAuthGate() {
  const authenticated = hasAuthSession();
  const shell = document.querySelector(".app-shell");
  const topbar = document.querySelector(".topbar");
  const workflow = document.querySelector(".workflow");
  const loginEntry = document.querySelector("[data-login-entry]");
  if (shell) shell.classList.toggle("unauthenticated", !authenticated);
  if (topbar) topbar.hidden = !authenticated;
  if (workflow) workflow.hidden = !authenticated;
  if (loginEntry) loginEntry.hidden = authenticated;
  getWorkspaceScreenSections().forEach((section) => {
    if (!authenticated) section.hidden = true;
  });
  if (authenticated) {
    document.querySelectorAll("aside [data-screen-id]").forEach((item) => {
      item.hidden = false;
    });
  }
  return authenticated;
}

async function createCgaResponseError(response, fallbackMessage) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = { fallback_message: fallbackMessage || `CGA request failed: ${response.status}` };
  }
  const error = new Error(payload?.error_code || payload?.message_key || fallbackMessage || `CGA request failed: ${response.status}`);
  error.status = response.status;
  error.payload = payload;
  return error;
}

async function requestCgaJson(path, { method = "GET", body } = {}) {
  const response = await fetch(path, {
    method,
    headers: getCgaAuthHeaders(),
    body: body == null ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload?.error_code || payload?.message_key || `CGA request failed: ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    if (payload?.error_code === "CGA_SESSION_EXPIRED") {
      clearAuthSession();
      setAuthMessage("error", "admin.sessionExpiredTitle", payload.message_key || "errors.auth.sessionExpired");
      rerenderAdminAndAccess();
    }
    throw error;
  }
  return payload;
}

function applyAccessStatePayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (!Array.isArray(payload.users) || !Array.isArray(payload.groups) || !Array.isArray(payload.memberships)) return false;
  currentAccessState = {
    ...currentAccessState,
    botId: payload.bot_id || currentAccessState.botId,
    currentUserId: payload.current_user_id || currentAccessState.currentUserId,
    users: payload.users,
    groups: payload.groups,
    memberships: payload.memberships,
    groupBotAccess: Array.isArray(payload.group_bot_access) ? payload.group_bot_access : currentAccessState.groupBotAccess,
    userOverrides: Array.isArray(payload.user_overrides) ? payload.user_overrides : currentAccessState.userOverrides,
    joinRequests: Array.isArray(payload.join_requests) ? payload.join_requests : currentAccessState.joinRequests,
    adminRequests: Array.isArray(payload.admin_requests) ? payload.admin_requests : currentAccessState.adminRequests,
    loginHistory: Array.isArray(payload.login_history) ? payload.login_history : (currentAccessState.loginHistory || []),
    policy: payload.policy || currentAccessState.policy
  };
  return true;
}

async function refreshAccessStateFromServer() {
  const payload = await requestCgaJson("/api/cga/groups");
  return applyAccessStatePayload(payload);
}

async function runAccessServerAction(action, fallback) {
  try {
    await action();
    await refreshAccessStateFromServer();
    clearGlobalMessage();
    rerenderAdminAndAccess();
    return true;
  } catch (error) {
    if (error.status) {
      showApiErrorMessage(error, "message.actionForbiddenTitle");
      rerenderAdminAndAccess();
      return false;
    }
    if (fallback) {
      fallback(error);
      rerenderAdminAndAccess();
      return false;
    }
    throw error;
  }
}

async function downloadAssetFromServer(assetKey) {
  try {
    const response = await fetch(getAssetTransferUrl(assetKey, "export"), {
      headers: getCgaAuthHeaders()
    });
    if (!response.ok) throw await createCgaResponseError(response, "Asset download failed.");
    const fileName = getFileNameFromContentDisposition(response.headers.get("Content-Disposition")) ||
      `CGA_${getAssetTransferScope(assetKey)}_${getSafeFileName(currentWorkspaceBotId, "bot")}_${getTodayStamp()}.${getAssetTransferFileFormat(assetKey)}`;
    downloadBlobFile(fileName, await response.blob());
    return fileName;
  } catch (error) {
    if (error.status) showApiErrorMessage(error);
    return "";
  }
}

async function uploadAssetToServer(assetKey, body, fileName) {
  try {
    const response = await fetch(getAssetTransferUrl(assetKey, "import"), {
      method: "POST",
      headers: {
        ...getCgaAuthHeaders(),
        "Content-Type": getAssetTransferFileFormat(assetKey) === "json" ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
        "X-CGA-File-Name": fileName || `uploaded.${getAssetTransferFileFormat(assetKey)}`
      },
      body
    });
    if (!response.ok) throw await createCgaResponseError(response, "Asset upload failed.");
    return response.ok;
  } catch (error) {
    if (error.status) showApiErrorMessage(error);
    return false;
  }
}

function getAssetTransferHistoryUrl() {
  const groupId = encodeURIComponent(currentWorkspaceGroupId || "g-support");
  const botId = encodeURIComponent(currentWorkspaceBotId || "supportbot-draft");
  return `/api/cga/groups/${groupId}/bots/${botId}/asset-transfers`;
}

function getWorkspaceBotsUrl(groupId = currentWorkspaceGroupId) {
  return `/api/cga/groups/${encodeURIComponent(groupId || "g-support")}/bots`;
}

function getStudioStateUrl(groupId = currentWorkspaceGroupId, botId = currentWorkspaceBotId) {
  return `/api/cga/groups/${encodeURIComponent(groupId || "g-support")}/bots/${encodeURIComponent(botId || "supportbot-draft")}/studio-state`;
}

function getCompositionUrl(groupId = currentWorkspaceGroupId, botId = currentWorkspaceBotId) {
  return `/api/cga/groups/${encodeURIComponent(groupId || "g-support")}/bots/${encodeURIComponent(botId || "supportbot-draft")}/composition`;
}

function getDetailAssetsUrl(groupId = currentWorkspaceGroupId, botId = currentWorkspaceBotId) {
  return `/api/cga/groups/${encodeURIComponent(groupId || "g-support")}/bots/${encodeURIComponent(botId || "supportbot-draft")}/detail-assets`;
}

function getOperationsStateUrl(groupId = currentWorkspaceGroupId, botId = currentWorkspaceBotId, action = "") {
  const base = `/api/cga/groups/${encodeURIComponent(groupId || "g-support")}/bots/${encodeURIComponent(botId || "supportbot-draft")}/operations-state`;
  return action ? `${base}/${action}` : base;
}

function getCollaborationStateUrl(groupId = currentWorkspaceGroupId, botId = currentWorkspaceBotId, workItemId = "", action = "") {
  const base = `/api/cga/groups/${encodeURIComponent(groupId || "g-support")}/bots/${encodeURIComponent(botId || "supportbot-draft")}/collaboration-state`;
  return workItemId && action ? `${base}/work-items/${encodeURIComponent(workItemId)}/${encodeURIComponent(action)}` : base;
}

function applyCompositionFromServer(composition) {
  if (!composition || typeof composition !== "object") return false;
  currentCompositionState = {
    ...currentCompositionState,
    ...composition,
    group_id: currentWorkspaceGroupId,
    bot_id: currentWorkspaceBotId,
    utterances: Array.isArray(composition.utterances) ? composition.utterances : currentCompositionState.utterances,
    intent_candidates: Array.isArray(composition.intent_candidates) ? composition.intent_candidates : currentCompositionState.intent_candidates
  };
  currentStudioState.counts.utterances = currentCompositionState.utterances.length;
  currentStudioState.counts.intents = currentCompositionState.intent_candidates.length;
  currentStudioState.counts.documents = currentCompositionState.pdf ? 1 : currentStudioState.counts.documents;
  return true;
}

function applyDetailAssetsFromServer(detailAssets) {
  if (!detailAssets || typeof detailAssets !== "object") return false;
  if (Array.isArray(detailAssets.intent_utterances)) currentIntentUtteranceAssets = detailAssets.intent_utterances;
  if (Array.isArray(detailAssets.entities)) currentEntityAssets = detailAssets.entities;
  if (Array.isArray(detailAssets.dictionary)) currentDictionaryAssets = detailAssets.dictionary;
  if (Array.isArray(detailAssets.rules)) currentRuleAssets = detailAssets.rules;
  if (Array.isArray(detailAssets.scenarios)) currentScenarioAssets = detailAssets.scenarios;
  const intentCount = new Set(currentIntentUtteranceAssets.map((item) => item.division).filter(Boolean)).size;
  currentStudioState.counts.utterances = currentIntentUtteranceAssets.length || currentStudioState.counts.utterances;
  currentStudioState.counts.intents = intentCount || currentStudioState.counts.intents;
  return true;
}

function applyOperationsStateFromServer(operationsState) {
  if (!operationsState || typeof operationsState !== "object") return false;
  currentOperationsState = {
    ...currentOperationsState,
    ...operationsState,
    group_id: currentWorkspaceGroupId,
    bot_id: currentWorkspaceBotId,
    build: { ...currentOperationsState.build, ...(operationsState.build || {}) },
    test: { ...currentOperationsState.test, ...(operationsState.test || {}) },
    operate: { ...currentOperationsState.operate, ...(operationsState.operate || {}) }
  };
  return true;
}

function applyCollaborationStateFromServer(collaborationState) {
  if (!collaborationState || typeof collaborationState !== "object") return false;
  if (!Array.isArray(collaborationState.workItems)) return false;
  currentCollaborationState = {
    ...currentCollaborationState,
    ...collaborationState
  };
  return true;
}

async function runQueuedSave(queueKey, saveAction) {
  const currentQueue = saveQueues.get(queueKey) || { running: false, pending: false, promise: null, saveAction: null };
  currentQueue.pending = true;
  currentQueue.saveAction = saveAction;
  if (currentQueue.running && currentQueue.promise) {
    saveQueues.set(queueKey, currentQueue);
    return currentQueue.promise;
  }
  currentQueue.running = true;
  currentQueue.promise = (async () => {
    let lastResult = false;
    try {
      while (currentQueue.pending) {
        currentQueue.pending = false;
        lastResult = await currentQueue.saveAction();
      }
      return lastResult;
    } finally {
      currentQueue.running = false;
      currentQueue.promise = null;
      if (!currentQueue.pending) {
        saveQueues.delete(queueKey);
      }
    }
  })();
  saveQueues.set(queueKey, currentQueue);
  return currentQueue.promise;
}

async function refreshCompositionFromServer(groupId = currentWorkspaceGroupId, botId = currentWorkspaceBotId) {
  if (!groupId || !botId) return false;
  const payload = await requestCgaJson(getCompositionUrl(groupId, botId));
  if (groupId !== currentWorkspaceGroupId || botId !== currentWorkspaceBotId) return false;
  return applyCompositionFromServer(payload);
}

async function refreshDetailAssetsFromServer(groupId = currentWorkspaceGroupId, botId = currentWorkspaceBotId) {
  if (!groupId || !botId) return false;
  const payload = await requestCgaJson(getDetailAssetsUrl(groupId, botId));
  if (groupId !== currentWorkspaceGroupId || botId !== currentWorkspaceBotId) return false;
  return applyDetailAssetsFromServer(payload);
}

async function refreshOperationsStateFromServer(groupId = currentWorkspaceGroupId, botId = currentWorkspaceBotId) {
  if (!groupId || !botId) return false;
  const payload = await requestCgaJson(getOperationsStateUrl(groupId, botId));
  if (groupId !== currentWorkspaceGroupId || botId !== currentWorkspaceBotId) return false;
  return applyOperationsStateFromServer(payload);
}

async function refreshCollaborationStateFromServer(groupId = currentWorkspaceGroupId, botId = currentWorkspaceBotId) {
  if (!groupId || !botId) return false;
  const payload = await requestCgaJson(getCollaborationStateUrl(groupId, botId));
  if (groupId !== currentWorkspaceGroupId || botId !== currentWorkspaceBotId) return false;
  return applyCollaborationStateFromServer(payload);
}

async function persistCompositionToServer(groupId, botId, payload) {
  if (!groupId || !botId) return false;
  await requestCgaJson(getCompositionUrl(groupId, botId), {
    method: "PUT",
    body: payload
  });
  if (groupId === currentWorkspaceGroupId && botId === currentWorkspaceBotId) saveWorkspaceSnapshot();
  return true;
}

async function saveCompositionToServer() {
  const groupId = currentWorkspaceGroupId;
  const botId = currentWorkspaceBotId;
  const payload = {
    ...cloneForSnapshot(currentCompositionState),
    group_id: groupId,
    bot_id: botId
  };
  return runQueuedSave(`composition:${groupId}:${botId}`, () => persistCompositionToServer(groupId, botId, payload));
}

async function runOperationsAction(action, body = {}) {
  const groupId = currentWorkspaceGroupId;
  const botId = currentWorkspaceBotId;
  if (!groupId || !botId) return false;
  try {
    const payload = await requestCgaJson(getOperationsStateUrl(groupId, botId, action), {
      method: "POST",
      body
    });
    clearGlobalMessage();
    if (groupId !== currentWorkspaceGroupId || botId !== currentWorkspaceBotId) return false;
    applyOperationsStateFromServer(payload.operations_state);
    saveWorkspaceSnapshot();
    return true;
  } catch (error) {
    if (error.status) {
      showApiErrorMessage(error, "message.actionForbiddenTitle");
      renderGlobalMessage();
      return null;
    }
    return false;
  }
}

async function runCollaborationAction(workItemId, action) {
  const groupId = currentWorkspaceGroupId;
  const botId = currentWorkspaceBotId;
  if (!groupId || !botId || !workItemId || !action) return false;
  try {
    const payload = await requestCgaJson(getCollaborationStateUrl(groupId, botId, workItemId, action), {
      method: "POST"
    });
    clearGlobalMessage();
    if (groupId !== currentWorkspaceGroupId || botId !== currentWorkspaceBotId) return false;
    applyCollaborationStateFromServer(payload.collaboration_state);
    saveWorkspaceSnapshot();
    return true;
  } catch (error) {
    if (error.status) {
      showApiErrorMessage(error, "message.actionForbiddenTitle");
      renderGlobalMessage();
      return null;
    }
    return false;
  }
}

async function persistDetailAssetsToServer(groupId, botId, payload) {
  if (!groupId || !botId) return false;
  await requestCgaJson(getDetailAssetsUrl(groupId, botId), {
    method: "PUT",
    body: payload
  });
  if (groupId === currentWorkspaceGroupId && botId === currentWorkspaceBotId) saveWorkspaceSnapshot();
  return true;
}

async function saveDetailAssetsToServer() {
  const groupId = currentWorkspaceGroupId;
  const botId = currentWorkspaceBotId;
  const payload = {
    group_id: groupId,
    bot_id: botId,
    intent_utterances: cloneForSnapshot(currentIntentUtteranceAssets),
    entities: cloneForSnapshot(currentEntityAssets),
    dictionary: cloneForSnapshot(currentDictionaryAssets),
    rules: cloneForSnapshot(currentRuleAssets),
    scenarios: cloneForSnapshot(currentScenarioAssets)
  };
  return runQueuedSave(`detail-assets:${groupId}:${botId}`, () => persistDetailAssetsToServer(groupId, botId, payload));
}

function scheduleCompositionSave() {
  window.clearTimeout(compositionSaveTimer);
  compositionSaveTimer = window.setTimeout(() => {
    saveCompositionToServer().catch(() => {});
  }, 500);
}

function applyStudioStateFromServer(state) {
  if (!state || typeof state !== "object") return false;
  if (state.bot) currentStudioState.bot = { ...currentStudioState.bot, ...state.bot, id: currentWorkspaceBotId };
  if (state.structuralChoices) currentStudioState.structuralChoices = { ...currentStudioState.structuralChoices, ...state.structuralChoices };
  if (state.orchestrator) currentStudioState.orchestrator = { ...currentStudioState.orchestrator, ...state.orchestrator };
  if (state.llm) currentStudioState.llm = { ...currentStudioState.llm, ...state.llm };
  if (state.workflow) currentStudioState.workflow = { ...currentStudioState.workflow, ...state.workflow };
  if (state.counts) currentStudioState.counts = { ...currentStudioState.counts, ...state.counts };
  if (state.channels) currentStudioState.channels = { ...currentStudioState.channels, ...state.channels };
  if (state.commercialModules) currentStudioState.commercialModules = { ...currentStudioState.commercialModules, ...state.commercialModules };
  return true;
}

async function refreshStudioStateFromServer(groupId = currentWorkspaceGroupId, botId = currentWorkspaceBotId) {
  if (!groupId || !botId) return false;
  const payload = await requestCgaJson(getStudioStateUrl(groupId, botId));
  if (groupId !== currentWorkspaceGroupId || botId !== currentWorkspaceBotId) return false;
  return applyStudioStateFromServer(payload.state);
}

async function persistStudioStateToServer(groupId, botId, payload) {
  if (!groupId || !botId) return false;
  await requestCgaJson(getStudioStateUrl(groupId, botId), {
    method: "PUT",
    body: payload
  });
  if (groupId === currentWorkspaceGroupId && botId === currentWorkspaceBotId) {
    await refreshWorkspaceBotsFromServer(groupId).catch(() => false);
    saveWorkspaceSnapshot();
  }
  return true;
}

async function saveStudioStateToServer() {
  const groupId = currentWorkspaceGroupId;
  const botId = currentWorkspaceBotId;
  const payload = {
    state: cloneForSnapshot(currentStudioState)
  };
  return runQueuedSave(`studio-state:${groupId}:${botId}`, () => persistStudioStateToServer(groupId, botId, payload));
}

function scheduleStudioStateSave() {
  window.clearTimeout(studioStateSaveTimer);
  studioStateSaveTimer = window.setTimeout(() => {
    saveStudioStateToServer()
      .then(() => renderWorkspaceHome())
      .catch(() => {});
  }, 500);
}

async function refreshWorkspaceBotsFromServer(groupId = currentWorkspaceGroupId) {
  if (!groupId) return false;
  const payload = await requestCgaJson(getWorkspaceBotsUrl(groupId));
  if (!Array.isArray(payload.items)) return false;
  currentWorkspaceBots = [
    ...currentWorkspaceBots.filter((bot) => bot.group_id !== groupId),
    ...payload.items
  ];
  if (!payload.items.some((bot) => bot.id === currentWorkspaceBotId)) {
    const nextBot = payload.items[0] || null;
    if (nextBot) applyCurrentBotToStudioState(nextBot);
  }
  return true;
}


async function refreshAdminResourcesFromServer() {
  try {
    const payload = await requestCgaJson("/api/cga/admin/resources");
    currentAdminResources = {
      templates: Array.isArray(payload.templates) ? payload.templates : [],
      common_variables: Array.isArray(payload.common_variables) ? payload.common_variables : [],
      default_messages: Array.isArray(payload.default_messages) ? payload.default_messages : [],
      channels: Array.isArray(payload.channels) ? payload.channels : [],
      botstation_links: Array.isArray(payload.botstation_links) ? payload.botstation_links : [],
      licenses: Array.isArray(payload.licenses) ? payload.licenses : [],
      login_history: Array.isArray(payload.login_history) ? payload.login_history : []
    };
    return true;
  } catch {
    return false;
  }
}

async function refreshWorkspaceDataFromServer({ includeBots = false } = {}) {
  const refreshSerial = ++workspaceDataRefreshSerial;
  if (includeBots) {
    await refreshWorkspaceBotsFromServer(currentWorkspaceGroupId).catch(() => false);
    if (refreshSerial !== workspaceDataRefreshSerial) return false;
    if (applyCachedWorkspaceSnapshot()) {
      renderWorkspaceHome();
      renderAllStatePanels();
      document.dispatchEvent(new CustomEvent("cga:content-rendered"));
    }
  }
  const groupId = currentWorkspaceGroupId;
  const botId = currentWorkspaceBotId;
  if (!groupId || !botId) return false;
  const results = await Promise.allSettled([
    refreshStudioStateFromServer(groupId, botId),
    refreshCompositionFromServer(groupId, botId),
    refreshDetailAssetsFromServer(groupId, botId),
    refreshOperationsStateFromServer(groupId, botId),
    refreshCollaborationStateFromServer(groupId, botId)
  ]);
  if (refreshSerial !== workspaceDataRefreshSerial) return false;
  const refreshed = results.some((result) => result.status === "fulfilled" && result.value);
  if (refreshed) saveWorkspaceSnapshot();
  return refreshed;
}

async function createWorkspaceBotOnServer(bot) {
  const payload = await requestCgaJson(getWorkspaceBotsUrl(bot.group_id), {
    method: "POST",
    body: {
      id: bot.id,
      name: bot.name,
      version: bot.version || "v0.1",
      status: bot.status || "draft",
      locale: bot.locale || "en"
    }
  });
  return payload?.bot || payload;
}

async function updateWorkspaceBotVersionOnServer(bot, versionId) {
  const payload = await requestCgaJson(getWorkspaceBotsUrl(bot.group_id) + `/${encodeURIComponent(bot.id)}`, {
    method: "PUT",
    body: {
      name: bot.name || "",
      version: versionId,
      status: bot.status || "draft",
      locale: bot.locale || "en",
      updated_by: currentAccessState.currentUserId || ""
    }
  });
  return payload;
}

async function deleteWorkspaceBotOnServer(groupId, botId) {
  const result = await requestCgaJson(getWorkspaceBotsUrl(groupId) + `/${encodeURIComponent(botId)}`, {
    method: "DELETE"
  });
  return result;
}

async function copyWorkspaceBotOnServer(sourceBot, nextBotId, nextBotName) {
  const payload = await createWorkspaceBotOnServer({
    id: nextBotId,
    group_id: sourceBot.group_id,
    name: nextBotName,
    version: sourceBot.version || "v0.1",
    status: "draft",
    locale: sourceBot.locale || currentStudioState.bot.defaultLocale || "en"
  });
  return payload;
}

function getApiAnswerRegistryUrl(groupId = currentApiGroupId, botId = currentApiBotId) {
  return `/api/cga/groups/${encodeURIComponent(groupId || "g-support")}/bots/${encodeURIComponent(botId || "supportbot-draft")}/api-answers`;
}

async function refreshApiRegistryFromServer() {
  if (!currentApiGroupId || !currentApiBotId) return false;
  const groupId = currentApiGroupId;
  const botId = currentApiBotId;
  const key = `${groupId}:${botId}`;
  const loadedAt = apiRegistryLoadedAtByKey.get(key) || 0;
  if (Date.now() - loadedAt < API_REGISTRY_CACHE_TTL_MS) return true;
  if (apiRegistryRefreshPromise && apiRegistryRefreshKey === key) return apiRegistryRefreshPromise;
  apiRegistryRefreshKey = key;
  apiRegistryRefreshPromise = requestCgaJson(getApiAnswerRegistryUrl(groupId, botId))
    .then((payload) => {
      if (!Array.isArray(payload.items)) return false;
      currentApiRegistry = [
        ...currentApiRegistry.filter((api) => !(api.group_id === groupId && api.bot_id === botId)),
        ...payload.items
      ];
      apiRegistryLoadedAtByKey.set(key, Date.now());
      return true;
    })
    .finally(() => {
      if (apiRegistryRefreshKey === key) {
        apiRegistryRefreshPromise = null;
      }
    });
  return apiRegistryRefreshPromise;
}

async function saveApiAnswerToServer(api) {
  const cacheKey = `${api.group_id}:${api.bot_id}`;
  const result = await requestCgaJson(getApiAnswerRegistryUrl(api.group_id, api.bot_id), {
    method: "POST",
    body: {
      name: api.name,
      endpoint_url: api.endpoint_url,
      method: api.method || "GET",
      auth_type: api.auth_type || "none",
      secret_ref: api.secret_ref || "",
      response_path: api.response_path || api.response_mapping?.answer_text_path || "data.answer"
    }
  });
  apiRegistryLoadedAtByKey.delete(cacheKey);
  if (apiRegistryRefreshKey === cacheKey) {
    apiRegistryRefreshPromise = null;
  }
  return result;
}

function renderTransferHistoryItems(container, items) {
  currentTransferHistory = Array.isArray(items) ? [...items] : [];
  const recent = [...currentTransferHistory].reverse().slice(0, 5);
  container.innerHTML = recent.length
    ? recent.map((item) => `
      <div class="transfer-history-item">
        <strong>${item.scope || "asset"} · ${item.direction || "transfer"}</strong>
        <span>${item.source || item.asset_path || "server"}</span>
        <span>${item.created_at || ""}</span>
      </div>
    `).join("")
    : `<div><strong data-i18n="transfer.historyEmptyTitle">No transfer history</strong><span data-i18n="transfer.historyEmptyBody">Download or upload a package to create a server record.</span></div>`;
  const note = document.querySelector("[data-transfer-note]");
  if (note && !currentTransferStatus) {
    note.textContent = getLatestTransferSummary() || "최근 패키지 전송 이력이 없습니다.";
  }
}

function getLatestTransferSummary() {
  const latest = [...currentTransferHistory]
    .filter((item) => item?.created_at)
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))[0];
  if (!latest) return "";
  return `${latest.scope || "asset"} ${latest.direction || "transfer"} · ${latest.source || latest.asset_path || "server"} · ${latest.created_at}`;
}

async function refreshTransferHistory() {
  const container = document.querySelector("[data-transfer-history]");
  if (!container) return;
  container.innerHTML = `<div><strong data-i18n="transfer.historyLoadingTitle">Loading history</strong><span data-i18n="transfer.historyTitle">Server Transfer History</span></div>`;
  try {
    const response = await fetch(getAssetTransferHistoryUrl());
    if (!response.ok) throw new Error("History request failed");
    const payload = await response.json();
    renderTransferHistoryItems(container, Array.isArray(payload.items) ? payload.items : []);
  } catch {
    container.innerHTML = `<div><strong data-i18n="transfer.historyUnavailableTitle">History unavailable</strong><span data-i18n="transfer.historyUnavailableBody">Server transfer history could not be loaded.</span></div>`;
  }
}

function escapeTxtCell(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseDelimitedLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function splitTextRows(text) {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildDictionaryTxt(items) {
  const maxSynonymCount = Math.max(1, ...items.map((item) => item.synonyms.length));
  const header = ["대표어", ...Array.from({ length: maxSynonymCount }, (_, index) => `유의어${index + 1}`)];
  const rows = items.map((item) => [
    item.word,
    ...Array.from({ length: maxSynonymCount }, (_, index) => item.synonyms[index] || "")
  ]);
  return [header, ...rows].map((row) => row.map(escapeTxtCell).join(",")).join("\r\n");
}

function parseDictionaryTxt(text) {
  const lines = splitTextRows(text);
  if (!lines.length) return [];
  const first = parseDelimitedLine(lines[0]);
  const hasHeader = ["대표어", "단어"].includes(first[0]);
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const buckets = new Map();
  for (const line of dataLines) {
    const [word = "", ...synonyms] = parseDelimitedLine(line);
    const normalizedWord = word.trim();
    if (!normalizedWord) continue;
    if (!buckets.has(normalizedWord)) buckets.set(normalizedWord, new Set());
    synonyms.map((item) => item.trim()).filter(Boolean).forEach((item) => buckets.get(normalizedWord).add(item));
  }
  return [...buckets.entries()].map(([word, synonyms]) => ({ word, synonyms: [...synonyms] }));
}

function buildEntityTxt(items) {
  const header = ["개체명", "개체값", "유형(S/P)", "상세"];
  const rows = items.map((item) => [item.name, item.value, item.rowType, item.detail]);
  return [header, ...rows].map((row) => row.map(escapeTxtCell).join(",")).join("\r\n");
}

function parseEntityTxt(text) {
  const lines = splitTextRows(text);
  if (!lines.length) return [];
  const first = parseDelimitedLine(lines[0]);
  const hasHeader = first[0] === "개체명";
  const dataLines = hasHeader ? lines.slice(1) : lines;
  return dataLines
    .map((line) => {
      const [name = "", value = "", rowType = "S", detail = ""] = parseDelimitedLine(line);
      return {
        name: name.trim(),
        value: value.trim(),
        rowType: rowType.trim().toUpperCase() === "P" ? "P" : "S",
        detail: detail.trim()
      };
    })
    .filter((item) => item.name && item.value);
}

function buildIntentUtteranceTxt(items) {
  return items.map((item) => [item.utterance, item.division].map(escapeTxtCell).join(",")).join("\r\n");
}

function parseIntentUtteranceTxt(text) {
  return splitTextRows(text)
    .map((line) => {
      const [utterance = "", division = ""] = parseDelimitedLine(line);
      return { utterance: utterance.trim(), division: division.trim() };
    })
    .filter((item) => item.utterance && item.division);
}

function buildRuleTxt(items) {
  const header = ["룰 이름", "룰 설명", "룰 표현식", "연결 의도/모듈", "사용여부(Y/N)"];
  const rows = items.map((item) => [item.name, item.description, item.expression, item.target, item.enabled]);
  return [header, ...rows].map((row) => row.map(escapeTxtCell).join(",")).join("\r\n");
}

function parseRuleTxt(text) {
  const lines = splitTextRows(text);
  if (!lines.length) return [];
  const first = parseDelimitedLine(lines[0]);
  const hasHeader = first[0] === "룰 이름";
  const dataLines = hasHeader ? lines.slice(1) : lines;
  return dataLines
    .map((line) => {
      const [name = "", description = "", expression = "", target = "", enabled = "Y"] = parseDelimitedLine(line);
      return {
        name: name.trim(),
        description: description.trim(),
        expression: expression.trim(),
        target: target.trim(),
        enabled: enabled.trim().toUpperCase() === "N" ? "N" : "Y"
      };
    })
    .filter((item) => item.name && item.expression);
}

function mergeDictionaryAssets(existing, incoming) {
  const buckets = new Map(existing.map((item) => [item.word, new Set(item.synonyms)]));
  for (const item of incoming) {
    if (!buckets.has(item.word)) buckets.set(item.word, new Set());
    item.synonyms.forEach((synonym) => buckets.get(item.word).add(synonym));
  }
  return [...buckets.entries()].map(([word, synonyms]) => ({ word, synonyms: [...synonyms] }));
}

function mergeEntityAssets(existing, incoming) {
  const keyOf = (item) => `${item.name}\u0001${item.value}\u0001${item.rowType}`;
  const rows = new Map(existing.map((item) => [keyOf(item), item]));
  incoming.forEach((item) => rows.set(keyOf(item), item));
  return [...rows.values()];
}

function mergeIntentUtteranceAssets(existing, incoming) {
  const keyOf = (item) => `${item.utterance}\u0001${item.division}`;
  const rows = new Map(existing.map((item) => [keyOf(item), item]));
  incoming.forEach((item) => rows.set(keyOf(item), item));
  return [...rows.values()];
}

function mergeRuleAssets(existing, incoming) {
  const rows = new Map(existing.map((item) => [item.name, item]));
  incoming.forEach((item) => rows.set(item.name, item));
  return [...rows.values()];
}

function buildAidotDialogPackage(kind = "intent") {
  const bot = getCurrentWorkspaceBot();
  const dialogType = kind === "scenario" ? 0 : 1;
  return {
    flowGraph: {
      botId: bot?.id || currentWorkspaceBotId,
      locale: currentStudioState.bot.defaultLocale || bot?.locale || "en",
      nodes: currentScenarioAssets.map((item) => ({
        id: item.id,
        label: item.displayName,
        type: item.type
      }))
    },
    licenseInfo: null,
    AIDOTAssistantVersion: "CGA-AIDOT-COMPATIBLE-1",
    dialogType,
    messageDigest: ""
  };
}

function applyAidotDialogPackage(packageJson) {
  if (!packageJson || typeof packageJson !== "object" || !("flowGraph" in packageJson)) {
    throw new Error("Invalid Aidot dialog package: flowGraph is required.");
  }
  const nodes = Array.isArray(packageJson.flowGraph?.nodes) ? packageJson.flowGraph.nodes : [];
  currentScenarioAssets = nodes.map((node) => ({
    id: String(node.id || node.dialogId || `dialog-${Date.now()}`),
    type: String(node.type || (packageJson.dialogType === 0 ? "module" : "intent")),
    displayName: String(node.label || node.displayName || node.id || "Imported dialog")
  }));
  currentTransferStatus = formatMessage(
    "transfer.status.uploadedItems",
    { asset: getTransferAssetLabel("intentDialog"), count: currentScenarioAssets.length },
    "Uploaded {asset}: {count} item(s) replaced"
  );
}

function buildApiMappingPackage() {
  const entries = currentApiRegistry.filter((api) => api.group_id === currentApiGroupId && api.bot_id === currentApiBotId);
  return {
    manifest: createAidotPackageManifest({
      scope: "api",
      botId: currentApiBotId || currentWorkspaceBotId,
      botLocale: currentStudioState.bot.defaultLocale || "en"
    }),
    apiList: entries.map((api) => ({
      name: api.name,
      endpoint_url: api.endpoint_url,
      method: api.method || "GET",
      auth_type: api.auth_type || "none",
      secret_ref: api.secret_ref || "",
      response_path: api.response_path || "data.answer"
    }))
  };
}

function applyApiMappingPackage(packageJson) {
  const apiList = Array.isArray(packageJson?.apiList) ? packageJson.apiList : Array.isArray(packageJson) ? packageJson : [];
  if (!apiList.length) {
    throw new Error("Invalid API package: apiList is required.");
  }
  currentApiRegistry = [
    ...currentApiRegistry.filter((api) => !(api.group_id === currentApiGroupId && api.bot_id === currentApiBotId)),
    ...apiList.map((api) => ({
      group_id: currentApiGroupId,
      bot_id: currentApiBotId,
      name: String(api.name || "imported_api"),
      endpoint_url: String(api.endpoint_url || api.url || ""),
      method: String(api.method || "GET"),
      auth_type: String(api.auth_type || "none"),
      secret_ref: String(api.secret_ref || ""),
      response_path: String(api.response_path || "data.answer")
    })).filter((api) => api.endpoint_url)
  ];
  currentTransferStatus = formatMessage(
    "transfer.status.uploadedItems",
    { asset: getTransferAssetLabel("apiMapping"), count: apiList.length },
    "Uploaded {asset}: {count} item(s) replaced"
  );
}

function buildAidotBotPackage() {
  const bot = getCurrentWorkspaceBot();
  return {
    AIDOTAssistantVersion: "CGA-AIDOT-COMPATIBLE-1",
    messageDigest: "",
    botVo: {
      botId: bot?.id || currentWorkspaceBotId,
      botName: currentStudioState.bot.name || bot?.name || "CGA Bot",
      description: currentStudioState.bot.description || "",
      defaultLanguage: currentStudioState.bot.defaultLocale || bot?.locale || "en",
      versionName: currentStudioState.bot.version || bot?.version || "v0.1"
    },
    licenseVo: null,
    botSystemConfigVoList: [
      { configKey: "bot.defaultLocale", configValue: currentStudioState.bot.defaultLocale || "en" },
      { configKey: "bot.version", configValue: currentStudioState.bot.version || "v0.1" },
      { configKey: "cga.compatibility", configValue: "aidot_single_language" }
    ],
    dialogList: [
      { dialogId: "password_reset", dialogType: 1, displayName: "password_reset" },
      { dialogId: "account_update", dialogType: 1, displayName: "account_update" },
      { dialogId: "billing_question", dialogType: 1, displayName: "billing_question" }
    ],
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

function buildCgaVersionPackage() {
  const bot = getCurrentWorkspaceBot();
  return {
    manifest: createAidotPackageManifest({
      scope: "version",
      botId: bot?.id || currentWorkspaceBotId,
      versionId: currentStudioState.bot.version || bot?.version || "v0.1",
      botLocale: currentStudioState.bot.defaultLocale || bot?.locale || "en"
    }),
    version: {
      bot: structuredClone(currentStudioState.bot),
      structuralChoices: structuredClone(currentStudioState.structuralChoices),
      counts: structuredClone(currentStudioState.counts),
      llm: structuredClone(currentStudioState.llm),
      channels: structuredClone(currentStudioState.channels)
    }
  };
}

function applyAidotBotPackage(packageJson) {
  const packageBody = packageJson?.package || packageJson;
  const botVo = packageBody?.botVo;
  if (!botVo || typeof botVo !== "object") {
    throw new Error("Invalid Aidot bot package: botVo is required.");
  }
  const nextId = getSafeFileName(botVo.botId || `bot-${Date.now()}`, `bot-${Date.now()}`);
  const nextName = String(botVo.botName || botVo.name || "Imported Bot");
  const nextLocale = String(botVo.defaultLanguage || botVo.locale || currentStudioState.bot.defaultLocale || "en");
  const nextVersion = String(botVo.versionName || botVo.version || "v0.1");
  const importedBot = {
    id: currentWorkspaceBots.some((bot) => bot.id === nextId) ? `${nextId}-${Date.now()}` : nextId,
    group_id: currentWorkspaceGroupId,
    name: nextName,
    version: nextVersion,
    status: "draft",
    locale: nextLocale,
    updated_at: "imported"
  };
  currentWorkspaceBots = [...currentWorkspaceBots, importedBot];
  currentWorkspaceBotId = importedBot.id;
  currentApiGroupId = currentWorkspaceGroupId;
  currentApiBotId = importedBot.id;
  currentStudioState.bot.name = importedBot.name;
  currentStudioState.bot.description = String(botVo.description || "");
  currentStudioState.bot.defaultLocale = importedBot.locale;
  currentStudioState.bot.version = importedBot.version;
  currentTransferStatus = formatMessage(
    "transfer.status.imported",
    { asset: getTransferAssetLabel("botPackage"), name: importedBot.name },
    "Imported {asset}: {name}"
  );
  ensureBotVersionRegistryFor(importedBot);
  trackRecentWorkspaceBot(importedBot);
}

function applyCgaVersionPackage(packageJson) {
  const packageBody = packageJson?.package || packageJson;
  const version = packageBody?.version;
  if (!version?.bot) {
    throw new Error("Invalid CGA version package: version.bot is required.");
  }
  currentStudioState.bot = { ...currentStudioState.bot, ...version.bot };
  if (version.structuralChoices) currentStudioState.structuralChoices = { ...currentStudioState.structuralChoices, ...version.structuralChoices };
  if (version.counts) currentStudioState.counts = { ...currentStudioState.counts, ...version.counts };
  if (version.llm) currentStudioState.llm = { ...currentStudioState.llm, ...version.llm };
  if (version.channels) currentStudioState.channels = { ...currentStudioState.channels, ...version.channels };
  const currentBot = getCurrentWorkspaceBot();
  if (currentBot) {
    currentBot.version = currentStudioState.bot.version || currentBot.version;
    currentBot.updated_at = new Date().toISOString().slice(0, 10);
    const versions = getBotVersions(currentBot).map((item) => ({
      ...item,
      isActive: item.id === currentStudioState.bot.version
    }));
    if (!versions.some((item) => item.id === currentStudioState.bot.version)) {
      versions.unshift({
        id: normalizeBotVersionVersion(currentStudioState.bot.version, currentBot.version),
        status: currentBot.status || "draft",
        createdAt: currentBot.updated_at,
        updatedAt: currentBot.updated_at,
        operator: currentAccessState.currentUserId || "system",
        note: "패키지 업로드로 갱신",
        isActive: true
      });
    }
    updateBotVersionRegistry(currentBot, versions);
  }
  currentWorkspaceBots = currentWorkspaceBots.map((bot) =>
    bot.id === currentWorkspaceBotId
      ? {
          ...bot,
          name: currentStudioState.bot.name,
          version: currentStudioState.bot.version || bot.version,
          locale: currentStudioState.bot.defaultLocale || bot.locale,
          updated_at: "uploaded"
        }
      : bot
  );
  currentTransferStatus = formatMessage(
    "transfer.status.imported",
    { asset: getTransferAssetLabel("versionPackage"), name: currentStudioState.bot.version || "v0.1" },
    "Imported {asset}: {name}"
  );
}

async function readJsonFile(file) {
  const text = await file.text();
  return JSON.parse(text);
}

async function readTextFile(file) {
  return file.text();
}

function requestJsonUpload(onJson) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      await onJson(await readJsonFile(file), file);
      renderAllStatePanels();
      renderWorkspaceHome();
    } catch (error) {
      currentTransferStatus = error instanceof Error ? error.message : "Upload failed.";
      renderWorkspaceHome();
    }
  });
  input.click();
}

function requestTextUpload(onText) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".txt,text/plain";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      await onText(await readTextFile(file), file);
      renderWorkspaceHome();
    } catch (error) {
      currentTransferStatus = error instanceof Error ? error.message : "Text upload failed.";
      renderWorkspaceHome();
    }
  });
  input.click();
}

function getCurrentAccessUser() {
  return currentAccessState.users.find((user) => user.id === currentAccessState.currentUserId) || null;
}

function syncStudioLocaleToCurrentUser() {
  const locale = window.cgaStudioI18n?.getLocale?.() || localStorage.getItem("cga.studio.locale") || getCurrentLocale();
  if (window.cgaStudioI18n?.setLocale) {
    window.cgaStudioI18n.setLocale(locale);
    applyDynamicLocaleOverrides(locale);
    scheduleActiveScreenVisibility();
    return;
  }
  const select = document.querySelector("[data-locale-select]");
  if (select) select.value = locale;
  localStorage.setItem("cga.studio.locale", locale);
  applyDynamicLocaleOverrides(locale);
  scheduleActiveScreenVisibility();
}



function getByPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function setByPath(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((current, key) => {
    current[key] = current[key] || {};
    return current[key];
  }, object);
  target[last] = value;
}

function coerceFieldValue(field, value) {
  if (field === "structuralChoices.useLlm") return value === "true";
  return value;
}

function syncCreateControlsFromState() {
  document.querySelectorAll("[data-structural-field]").forEach((control) => {
    const field = control.dataset.structuralField;
    const value = getByPath(currentStudioState, field);
    if (typeof value === "boolean") control.value = String(value);
    else if (value != null) control.value = value;
  });
}

function applyStructuralSideEffects(field) {
  const choices = currentStudioState.structuralChoices;
  choices.allowPdf = choices.compositionInput === "pdf" || choices.compositionInput === "both";
  currentStudioState.counts.documents = choices.allowPdf ? 1 : 0;
  currentStudioState.llm.status = choices.useLlm ? "connected" : "not_connected";
  currentStudioState.channels.kakaoKr = currentStudioState.bot.defaultLocale === "ko" ? "not_configured" : "disabled";
}

function renderCreateSummary() {
  const container = document.querySelector("[data-create-summary]");
  if (!container) return;
  const choices = currentStudioState.structuralChoices;
  container.innerHTML = `
    <p><b data-i18n="summary.language">Language</b><span>${currentStudioState.bot.defaultLocale}</span></p>
    <p><b data-i18n="summary.input">Input</b><span>${choices.compositionInput}</span></p>
    <p><b data-i18n="summary.llm">LLM</b><span class="${choices.useLlm ? "" : "warn"}">${choices.useLlm ? t("summary.llmUsed", "LLM composition") : t("summary.llmNotUsed", "LLM off")}</span></p>
    <p><b data-i18n="summary.pdfQa">PDF Q&A</b><span class="${choices.allowPdf ? "" : "warn"}">${choices.allowPdf ? t("summary.allowed", "Allowed") : t("summary.disabled", "Disabled")}</span></p>
    <p><b data-i18n="summary.orchestrator">Orchestrator</b><span>${choices.orchestratorMode}</span></p>
    <p><b data-i18n="summary.botServer">Bot Server</b><span>${choices.botServerLocation}</span></p>
  `;
}

function getSimulatorIntentRow(test) {
  const intentId = test.matched_intent || currentSelectedIntentId;
  return getAidotIntentRows().find((row) => row.id === intentId) || getAidotIntentRows()[0] || null;
}

function renderSimulatorDetailPanels(test) {
  const aidotResult = document.querySelector("[data-test-aidot-result]");
  const runtime = document.querySelector("[data-test-runtime]");
  if (!aidotResult || !runtime) return;
  const selectedIntent = getSimulatorIntentRow(test);
  const matchedApi = currentApiRegistry.find((item) => item.group_id === currentWorkspaceGroupId && item.bot_id === currentWorkspaceBotId);
  const entityLabel = currentEntityAssets.length
    ? currentEntityAssets.slice(0, 3).map((item) => item.name || item.value).join(", ")
    : t("test.noEntity", "No detected entity");
  const utteranceLabel = selectedIntent?.utterances?.[0]?.utterance || test.last_user_message || "-";
  const answerLabel = selectedIntent?.answer || selectedIntent?.dialogCards?.[0] || test.last_bot_message || "-";
  aidotResult.innerHTML = `
    <article><strong>${t("test.aidotCompatible", "Aidot-compatible simulator view")}</strong><span>${test.matched_intent || "-"}</span></article>
    <article><strong>${t("test.dialogCard", "Dialog card")}</strong><span>${selectedIntent?.dialogCardCount ?? 0}</span></article>
    <article><strong>${t("test.trainingSample", "Training sample")}</strong><span>${utteranceLabel}</span></article>
    <article><strong>${t("test.answerSource", "Answer source")}</strong><span>${matchedApi ? t("test.apiAnswer", "API answer") : answerLabel}</span></article>
  `;
  runtime.innerHTML = `
    <article><strong>${t("test.entities", "Entities")}</strong><span>${entityLabel}</span></article>
    <article><strong>${t("test.runtimeVariables", "Runtime variables")}</strong><span>locale=${currentStudioState.bot.defaultLocale} · group=${currentWorkspaceGroupId}</span></article>
    <article class="${matchedApi ? "" : "warn"}"><strong>${t("test.apiAnswer", "API answer")}</strong><span>${matchedApi?.name || t("test.noApi", "No API answer")}</span></article>
    <article><strong>${t("test.processingLog", "Processing log")}</strong><span>${test.method || "-"} · ${Number(test.latency_ms ?? 0)}ms</span></article>
  `;
}

function renderOperationsPanels() {
  const build = currentOperationsState.build || {};
  const test = currentOperationsState.test || {};
  const operate = currentOperationsState.operate || {};
  const botInfo = document.querySelector("[data-build-bot-info]");
  const intentCount = document.querySelector("[data-build-intent-count]");
  const llmStatus = document.querySelector("[data-build-llm-status]");
  const webchatStatus = document.querySelector("[data-build-webchat-status]");
  const testUser = document.querySelector("[data-test-user-message]");
  const testBot = document.querySelector("[data-test-bot-message]");
  const testIntent = document.querySelector("[data-test-intent]");
  const testMethod = document.querySelector("[data-test-method]");
  const testSimilarity = document.querySelector("[data-test-similarity]");
  const testLatency = document.querySelector("[data-test-latency]");
  const channel = document.querySelector("[data-operate-channel]");
  const channelDetail = document.querySelector("[data-operate-channel-detail]");
  const volume = document.querySelector("[data-operate-volume]");
  const volumeStatus = document.querySelector("[data-operate-volume-status]");
  const undefinedIntents = document.querySelector("[data-operate-undefined]");
  const containerHealth = document.querySelector("[data-operate-container]");
  const cost = document.querySelector("[data-operate-cost]");
  const compatibility = document.querySelector("[data-operate-compatibility]");

  if (botInfo) botInfo.textContent = build.bot_info === "complete" ? t("build.complete", "Complete") : build.bot_info || "-";
  if (intentCount) intentCount.textContent = `${build.intent_count ?? currentStudioState.counts.intents ?? 0} ${t("common.intentUnit", "intents")}`;
  if (llmStatus) llmStatus.textContent = build.llm_status === "needed_for_pdf" ? t("build.pdfNeeded", "Needed for PDF path") : build.llm_status || "-";
  if (webchatStatus) webchatStatus.textContent = build.webchat_contract === "unchanged" ? t("build.unchanged", "Unchanged") : build.webchat_contract || "-";
  if (testUser) testUser.textContent = test.last_user_message || "";
  if (testBot) testBot.textContent = test.last_bot_message || "";
  if (testIntent) testIntent.textContent = test.matched_intent || "-";
  if (testMethod) testMethod.textContent = test.method || "-";
  if (testSimilarity) testSimilarity.textContent = Number(test.similarity ?? 0).toFixed(2);
  if (testLatency) testLatency.textContent = `${Number(test.latency_ms ?? 0)}ms`;
  renderSimulatorDetailPanels(test);
  if (channel) channel.textContent = operate.channel_status === "web_ok" ? t("operate.webOk", "Web OK") : operate.channel_status || "-";
  if (channelDetail) channelDetail.textContent = operate.channel_detail === "desktop_kakao_pending" ? t("operate.kakaoPending", "Desktop and Kakao KR pending") : operate.channel_detail || "-";
  if (volume) volume.textContent = Number(operate.conversation_volume ?? 0).toLocaleString();
  if (volumeStatus) volumeStatus.textContent = operate.volume_status === "normal" ? t("operate.normal", "Normal range") : operate.volume_status || "-";
  if (undefinedIntents) undefinedIntents.textContent = `${Number(operate.undefined_intents ?? 0)} ${t("common.pendingUnit", "pending")}`;
  if (containerHealth) containerHealth.textContent = operate.container_health === "healthy" ? t("operate.healthy", "Healthy") : operate.container_health || "-";
  if (cost) cost.textContent = operate.llm_cost_status === "below_threshold" ? t("operate.below", "Below threshold") : operate.llm_cost_status || "-";
  if (compatibility) compatibility.textContent = operate.compatibility === "preserved" ? t("operate.preserved", "Preserved") : operate.compatibility || "-";
  renderBuildAidotScreen();
}

function getCurrentIntentRowsForWorkflow() {
  return getAidotIntentRows().map((row, index) => ({
    ...row,
    rowId: row.rowId || String(100001 + index),
    updatedAt: row.updatedAt && row.updatedAt !== "2026-05-30 12:44" ? row.updatedAt : "-",
    updatedBy: row.updatedBy || currentAccessState.currentUserId || "SYSTEM"
  }));
}

function normalizeDateText(value) {
  if (!value) return "-";
  const text = String(value).trim();
  if (!text) return "-";
  return text;
}

function renderWorkflowPager(total, tableKey, currentPage, totalPages) {
  return `
    <div class="workflow-pager" aria-label="pagination">
      <button type="button" data-workflow-page-first="${escapeCell(tableKey)}" ${total && currentPage > 1 ? "" : "disabled"}>◀</button>
      <button type="button" data-workflow-page-prev="${escapeCell(tableKey)}" ${total && currentPage > 1 ? "" : "disabled"}>‹</button>
      <strong>${currentPage}</strong>
      <button type="button" data-workflow-page-next="${escapeCell(tableKey)}" ${total && currentPage < totalPages ? "" : "disabled"}>›</button>
      <button type="button" data-workflow-page-last="${escapeCell(tableKey)}" data-workflow-total-pages="${totalPages}" ${total && currentPage < totalPages ? "" : "disabled"}>▶</button>
    </div>
  `;
}

function getWorkflowPagedRows(tableKey, rows) {
  const pageSize = adminTablePageSizeByKey[tableKey] || 10;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(Math.max(1, adminTablePageByKey[tableKey] || 1), totalPages);
  adminTablePageByKey[tableKey] = currentPage;
  const start = (currentPage - 1) * pageSize;
  return { pageSize, totalPages, currentPage, rows: rows.slice(start, start + pageSize) };
}

function renderWorkflowPageSize(tableKey, pageSize) {
  return `<select data-workflow-page-size="${escapeCell(tableKey)}" aria-label="페이지 크기">${[10, 25, 50, 100].map((size) => `<option value="${size}" ${size === pageSize ? "selected" : ""}>${size}개씩 보기</option>`).join("")}</select>`;
}

function renderWorkflowTablePage(section, tableKey, rows, columns, rowRenderer, options = {}) {
  const page = getWorkflowPagedRows(tableKey, rows);
  section.innerHTML = `
    <div class="workflow-lookup" data-workflow-table-key="${escapeText(tableKey)}">
      <div class="workflow-lookup__search">
        <label><span>⌕</span><input data-workflow-query="${escapeText(tableKey)}" placeholder="${escapeText(options.placeholder || "검색어를 입력하세요.")}" /></label>
        ${options.filters || ""}
        <button type="button" class="admin-page__filter admin-page__filter--text" data-workflow-reset="${escapeText(tableKey)}">초기화</button>
        <div class="workflow-lookup__actions">${options.actions || `<button type="button" class="admin-page__primary" data-workflow-search="${escapeText(tableKey)}">조회</button>`}</div>
      </div>
      <div class="workflow-lookup__toolbar">
        <strong>전체 ${rows.length}건</strong>
        ${renderWorkflowPageSize(tableKey, page.pageSize)}
        ${options.download ? `<button type="button" class="admin-page__ghost">다운로드</button>` : ""}
      </div>
      <div class="workflow-grid" style="--workflow-grid-template:${options.template || columns.map(() => "1fr").join(" ")}">
        <div class="workflow-grid__row workflow-grid__row--header">${columns.map((column) => `<span>${escapeText(column)} ↕</span>`).join("")}</div>
        ${page.rows.map(rowRenderer).join("")}
      </div>
      ${renderWorkflowPager(rows.length, tableKey, page.currentPage, page.totalPages)}
    </div>
  `;
  bindWorkflowTableControls(section, tableKey);
}

function bindWorkflowTableControls(section, tableKey) {
  section.querySelectorAll("[data-workflow-page-size]").forEach((select) => {
    select.addEventListener("change", () => {
      adminTablePageSizeByKey[tableKey] = Number(select.value) || 10;
      adminTablePageByKey[tableKey] = 1;
      renderWorkflowScreens();
    });
  });
  section.querySelectorAll("[data-workflow-page-first]").forEach((button) => button.addEventListener("click", () => { adminTablePageByKey[tableKey] = 1; renderWorkflowScreens(); }));
  section.querySelectorAll("[data-workflow-page-prev]").forEach((button) => button.addEventListener("click", () => { adminTablePageByKey[tableKey] = Math.max(1, (adminTablePageByKey[tableKey] || 1) - 1); renderWorkflowScreens(); }));
  section.querySelectorAll("[data-workflow-page-next]").forEach((button) => button.addEventListener("click", () => { adminTablePageByKey[tableKey] = (adminTablePageByKey[tableKey] || 1) + 1; renderWorkflowScreens(); }));
  section.querySelectorAll("[data-workflow-page-last]").forEach((button) => button.addEventListener("click", () => { adminTablePageByKey[tableKey] = Number(button.dataset.workflowTotalPages) || 1; renderWorkflowScreens(); }));
}

function getWorkspaceScreenSections(workspace = document.querySelector(".workspace")) {
  if (!workspace) return [];
  return Array.from(workspace.children).filter(
    (section) => section instanceof HTMLElement && section.hasAttribute("data-screen-id")
  );
}

function renderWorkflowScreenShell(sectionId, code, title, subtitle, bodyHtml) {
  const section = getWorkspaceScreenSections().find((item) => item.dataset.screenId === sectionId);
  if (!section) return null;
  section.innerHTML = `
    <div class="screen-heading aidot-screen-heading">
      <span>${escapeText(code)}</span>
      <div><h3>${escapeText(title)}</h3>${subtitle ? `<p>${escapeText(subtitle)}</p>` : ""}</div>
    </div>
    ${bodyHtml || ""}
  `;
  return section;
}


function renderTestAidotScreen() {
  const test = currentOperationsState.test || {};
  const rows = Array.isArray(test.trace) ? test.trace.slice(0, 3) : [];
  const runtimeStatus = test.runtime || "운영 중단";
  const vars = test.variables || { locale: currentStudioState.bot?.defaultLocale || "en" };
  const traceValue = rows.length ? rows.join(" / ") : "trace 없음";
  renderWorkflowScreenShell(
    "test",
    "05",
    "봇 테스트",
    "Aidot 시뮬레이터 기준으로 테스트 결과를 확인합니다.",
    `<div class="aidot-simulator-shell">
      <div class="aidot-simulator-window">
        <div class="aidot-simulator-window__header">
          <div class="aidot-simulator-window__title">
            <div class="bot-avatar-large"></div>
            <div>
              <strong>Aidot 봇</strong>
              <span>v1 / Simulator</span>
            </div>
          </div>
        </div>
        <div class="aidot-simulator-window__body">
          <div class="aidot-simulator-canvas">
            <div class="aidot-simulator-time">${escapeText(test.created_at || "2026-05-05 02:55:35")}</div>
          </div>
          <div class="aidot-simulator-compose">
            <div class="aidot-simulator-input-row">
              <input type="text" data-test-input placeholder="질문을 입력하세요" value="${escapeText(test.last_user_message || "")}" />
              <button type="button" data-test-send>➤</button>
            </div>
            <button type="button" class="aidot-simulator-analysis-button" data-test-analysis-toggle>분석 데이터 보기</button>
          </div>
        </div>
      </div>
      <aside class="aidot-simulator-analysis">
        <header><strong>분석 데이터</strong><span>Runtime / Variables / Trace</span></header>
        <section>
          <h4>Runtime</h4>
          <div class="simulator-runtime-grid">
            <article><strong>요청</strong><span>${escapeText(test.method || "LLM")}</span></article>
            <article class="${runtimeStatus.includes("중단") ? "warn" : ""}"><strong>상태</strong><span>${escapeText(runtimeStatus)}</span></article>
            <article><strong>의도</strong><span>${escapeText(test.matched_intent || "-")}</span></article>
            <article><strong>유사도</strong><span>${Number(test.similarity ?? 0).toFixed(2)}</span></article>
          </div>
        </section>
        <section>
          <h4>Variables</h4>
          <dl>
            <div><dt>locale</dt><dd>${escapeText(vars.locale || "-")}</dd></div>
            <div><dt>lastUser</dt><dd>${escapeText(test.last_user || "-")}</dd></div>
            <div><dt>botMessage</dt><dd>${escapeText(test.last_bot_message ? "있음" : "없음")}</dd></div>
          </dl>
        </section>
        <section>
          <h4>Trace</h4>
          <dl>
            <div><dt>trace</dt><dd>${escapeText(traceValue)}</dd></div>
          </dl>
        </section>
        <section class="aidot-simulator-analysis__light">
          <h4>의도 인식</h4>
          <p><strong>의도: ${escapeText(test.matched_intent || "intent_check")}</strong> ${escapeText(test.recognizer || "ML")}</p>
          <p>의도 신뢰도: ${Number(test.similarity ?? 0).toFixed(2)}</p>
          <p class="${test.warning ? "warn" : ""}">경고: ${escapeText(test.warning || "주의사항 없음")}</p>
        </section>
      </aside>
    </div>`
  );
}

function renderEvaluateAidotScreen() {
  const section = document.querySelector('[data-screen-id="evaluate"]');
  if (!section) return;
  const intents = getCurrentIntentRowsForWorkflow();
  const intentCount = Math.max(13, intents.length || 13);
  const utteranceCount = Math.max(228, intents.reduce((sum, row) => sum + Number(row.utteranceCount || 0), 0));
  const balanceItems = ["콜백 예약", "상담사 전환 요청", "통화 독려", "통화 불가", "소요시간 문의", "발신자 확인", "해지 요청", "인콜 진행 예정", "통화 거부", "상품 설명 요청"];
  const matrixItems = [13, 21, 26, 22, 36, 11, 17, 15, 10, 8, 20, 14];
  section.innerHTML = `
    <section class="aidot-feature-page aidot-feature-page--evaluate">
      <div class="evaluation-dashboard evaluation-dashboard--real">
      <div class="evaluation-dashboard__header">
        <h1>Overview › 의도 상세</h1>
      </div>
      <div class="evaluation-dashboard__grid evaluation-dashboard__grid--nlu">
        <section class="evaluation-card">
          <div class="evaluation-card__title-row">
            <h2>봇 평가 <span class="evaluation-info-icon">i</span></h2>
          </div>
          <div class="evaluation-card__empty evaluation-card__empty--circle">
            <strong>봇 평가를 위해<br />평가 데이터를 업로드하세요.</strong>
          </div>
        </section>
        <section class="evaluation-card">
          <div class="evaluation-card__title-row">
            <h2>학습모델 평가 <span class="evaluation-info-icon">i</span></h2>
          </div>
          <div class="evaluation-score">
            <div class="evaluation-score__ring"><strong>65.4%</strong><span>Random</span></div>
            <div class="evaluation-score__gap"><strong>0.87%</strong><span>차이</span></div>
            <div class="evaluation-score__ring"><strong>64.5%</strong><span>Fixed</span></div>
          </div>
        </section>
        <section class="evaluation-card evaluation-card--wide">
          <div class="evaluation-card__title-row">
            <h2>평가 이력</h2>
          </div>
          <div class="evaluation-history">
            <svg class="evaluation-history__line" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline class="evaluation-history__line-random" points="4,24 12,10 20,28 28,8 36,44 44,26 52,39" />
              <polyline class="evaluation-history__line-fixed" points="4,34 12,28 20,26 28,30 36,50 44,42 52,47" />
            </svg>
            <span class="evaluation-history__point" style="left:4%;top:24%"></span>
            <span class="evaluation-history__point" style="left:12%;top:10%"></span>
            <span class="evaluation-history__point" style="left:20%;top:28%"></span>
            <span class="evaluation-history__point" style="left:28%;top:8%"></span>
            <span class="evaluation-history__point" style="left:36%;top:44%"></span>
            <span class="evaluation-history__point" style="left:44%;top:26%"></span>
            <span class="evaluation-history__point" style="left:52%;top:39%"></span>
            <div class="evaluation-history__x-axis">${["05.04", "05.04", "05.04", "05.04", "05.04", "05.04", "05.05"].map((label) => `<span>${label}</span>`).join("")}</div>
          </div>
          <div class="evaluation-history__summary">
            <span>의도 <strong>${intentCount}개</strong></span>
            <span>학습문장 <strong>${utteranceCount}개</strong></span>
          </div>
        </section>
        <section class="evaluation-card evaluation-card--feature">
          <div class="evaluation-card__title-row">
            <h2>학습문장 / Feature Balance <span class="evaluation-info-icon">i</span></h2>
          </div>
          <div class="evaluation-balance">
            <div class="evaluation-balance__y-axis">${[110,100,90,80,70,60,50,40,30,20,10,0].map((value) => `<span>${value}</span>`).join("")}</div>
            ${balanceItems.map((label, index) => {
              const a = [75, 19, 55, 46, 34, 32, 30, 26, 48, 25][index];
              const b = [75, 21, 71, 64, 31, 34, 38, 38, 51, 43][index];
              return `<div class="evaluation-balance__item"><i style="height:${a}%"></i><b style="height:${b}%"></b><em>${escapeText(label)}</em></div>`;
            }).join("")}
            <div class="evaluation-balance__legend"><span><i></i>학습문장</span><span><b></b>Feature</span></div>
          </div>
        </section>
        <section class="evaluation-card evaluation-card--matrix">
          <div class="evaluation-card__title-row">
            <h2>Confusion Matrix <span class="evaluation-info-icon">i</span></h2>
          </div>
          <div class="evaluation-matrix-wrap">
            <div class="evaluation-matrix evaluation-matrix--real">
              ${matrixItems.map((value, index) => `<span class="${index % 2 === 0 ? "is-dark" : "is-dark"}" style="grid-column:${index + 1};grid-row:${index + 1}">${value}</span>`).join("")}
            </div>
            <div class="evaluation-matrix__scale">${[100,90,80,70,60,50,40,30,20].map((value) => `<span>${value}</span>`).join("")}</div>
          </div>
        </section>
      </div>
      </div>
    </section>
  `;
}

function renderOperateAidotScreen() {
  const sourceRows = Array.isArray(currentOperationsState.operate?.retrainingCandidates)
    ? currentOperationsState.operate.retrainingCandidates
    : Array.isArray(currentOperationsState.operate?.retrain_rows)
      ? currentOperationsState.operate.retrain_rows
      : [];
  const rows = (sourceRows.length ? sourceRows : []).map((row) => ({
    utterance: normalizeDateText(row.utterance || row.message),
    intent: normalizeDateText(row.intent || row.target || row.intentName || row.module),
    channel: normalizeDateText(row.channel || row.channelName || row.source || "webchat"),
    result: normalizeDateText(row.result || row.classificationResult || row.statusMessage),
    method: normalizeDateText(row.method || row.classificationMethod || "M/L"),
    status: normalizeDateText(row.status || row.retrainStatus || "미학습"),
    createdAt: normalizeDateText(row.createdAt || row.occurredAt || row.updatedAt)
  }));
  const section = document.querySelector('[data-screen-id="operate"]');
  if (!section) return;
  const rowHtml = rows.map((row) => `
    <div class="data-grid__row">
      <div class="data-grid__cell"><input type="checkbox" /></div>
      <div class="data-grid__cell">${escapeText(row.utterance || "")}</div>
      <div class="data-grid__cell">${escapeText(row.intent || "")}</div>
      <div class="data-grid__cell">${escapeText(row.channel || "")}</div>
      <div class="data-grid__cell">${escapeText(row.result || "")}</div>
      <div class="data-grid__cell">${escapeText(row.method || "")}</div>
      <div class="data-grid__cell">${escapeText(row.status || "")}</div>
      <div class="data-grid__cell">${escapeText(row.createdAt || "")}</div>
    </div>
  `).join("");
  section.innerHTML = `
    <section class="aidot-feature-page aidot-feature-page--operate">
      <div class="retraining-page">
      <section class="retraining-filter">
        <input placeholder="의도명/지식명 또는 사용자 발화를 검색하세요." />
        <select aria-label="채널"><option>전체</option><option>webchat</option><option>Simulator</option></select>
        <select aria-label="실행결과"><option>전체</option><option>정상분류</option><option>의도 추출 오류</option><option>유사의도발생</option></select>
        <select aria-label="분류방식"><option>전체</option><option>M/L</option><option>Rule</option><option>Small Talk</option><option>Exact Matching</option><option>대화 Queue</option></select>
        <select aria-label="학습상태"><option>전체</option><option>미학습</option><option>보류</option><option>재학습제외</option><option>재학습완료</option></select>
        <input type="date" value="2026-03-17" aria-label="발생기간 시작" />
        <input type="date" value="2026-06-17" aria-label="발생기간 종료" />
      </section>
      <section class="retraining-actions">
        <strong>전체 ${rows.length}</strong>
        <span>0개 선택</span>
      </section>
      <div class="data-grid data-grid--studio retraining-grid" style="--data-grid-template:44px minmax(220px, 1.4fr) 180px 110px 130px 120px 120px 150px">
        <div class="data-grid__row data-grid__row--header">
          <div class="data-grid__cell"></div>
          <div class="data-grid__cell">사용자 발화 ↕</div>
          <div class="data-grid__cell">의도명/지식명 ↕</div>
          <div class="data-grid__cell">채널 ↕</div>
          <div class="data-grid__cell">실행결과 ↕</div>
          <div class="data-grid__cell">분류방식 ↕</div>
          <div class="data-grid__cell">학습상태 ↕</div>
          <div class="data-grid__cell">발생시간 ↕</div>
        </div>
        ${rowHtml}
      </div>
      </div>
    </section>
  `;
}

function renderAnalysisAidotScreen() {
  const operate = currentOperationsState.operate || {};
  const history = [
    ...Array.from({ length: 5 }).map((_, index) => {
      const fallbackDate = operate.lastConversationAt || (index < 2 ? "2026-06-17 01:22" : "2026-06-12 12:12");
      return [
        fallbackDate,
        normalizeDateText(operate.lastUtterance || (index === 0 ? "{\"webchatRichFormVersion\":\"1.0\",\"response\":\"...\"}" : "-")),
        normalizeDateText(operate.lastIntent || "-"),
        normalizeDateText(index === 0 ? "대화종료" : (operate.lastRuntimeResult || "completed"))
      ];
    })
  ];
  const section = document.querySelector('[data-screen-id="analysis"]');
  if (!section) return;
  section.innerHTML = `
    <section class="aidot-feature-page aidot-feature-page--analysis">
      <div class="analysis-page">
      <div class="analysis-page__filters">
        <select aria-label="채널 선택"><option>webchat</option></select>
        <strong>2026-06</strong>
      </div>
      <div class="analysis-page__summary">
        <h2>누적 대화량 <span class="analysis-info-icon">i</span></h2>
        <div class="analysis-page__legend">
          <span>제외/무시 0% (0건)</span>
          <span>스몰토크 0% (0건)</span>
          <span>Exacting Matching 0% (0건)</span>
          <span>룰 58% (11건)</span>
          <span>ML 0% (0건)</span>
          <span>시멘틱 0% (0건)</span>
          <span>LLM 0% (0건)</span>
          <span>미응답 42% (8건)</span>
        </div>
      </div>
      <div class="analysis-dashboard analysis-dashboard--manual">
        <section class="analysis-panel analysis-panel--ring">
          <h3>기간내 대화량 <span class="analysis-info-icon">i</span></h3>
          <div class="analysis-ring">
            <div class="analysis-ring__circle"><strong>100%</strong><span>응답률</span><small>19 / 19</small></div>
            <div class="analysis-ring__breakdown">
              <div class="analysis-ring__breakdown-head"><span></span><span>비율</span><span>건</span></div>
              <div class="analysis-ring__breakdown-row analysis-ring__breakdown-row--group"><strong>응답</strong><span>100%</span><span>19</span></div>
              ${["제외/무시", "스몰토크", "Exacting Matching", "룰", "ML", "시멘틱", "LLM"].map((label, index) => `<div class="analysis-ring__breakdown-row"><strong>${label}</strong><span>${index === 3 ? "57.9%" : "0%"}</span><span>${index === 3 ? "11" : "0"}</span></div>`).join("")}
              <div class="analysis-ring__breakdown-row analysis-ring__breakdown-row--group"><strong>미응답</strong><span>0%</span><span>0</span></div>
            </div>
          </div>
        </section>
        <section class="analysis-panel">
          <h3>기간별 대화량 <span class="analysis-info-icon">i</span></h3>
          <div class="analysis-period-legend"><span class="is-user">사용자 발화</span><span class="is-inquiry">문의</span><span class="is-answer">응답</span><span class="is-user-count">사용자수</span></div>
          <div class="analysis-period-chart">
            <div class="analysis-chart analysis-chart--manual">
              ${["01일","02일","03일","04일","05일","06일","07일"].map((day) => `<span class="analysis-chart__day"><span class="is-user" style="height:4%"></span><span class="is-inquiry" style="height:4%"></span><span class="is-answer" style="height:4%"></span><i>0</i><em>${day}</em></span>`).join("")}
            </div>
          </div>
          <div class="analysis-period-chart__pages"><span class="analysis-page-dot"></span><span class="analysis-page-dot is-active"></span><span class="analysis-page-dot"></span></div>
        </section>
        <section class="analysis-panel">
          <h3>가장 많은 문의 Top 5 <span class="analysis-info-icon">i</span></h3>
          <div class="data-grid data-grid--studio" style="--data-grid-template:64px 1fr 120px 90px 90px">
            <div class="data-grid__row data-grid__row--header"><div class="data-grid__cell">순위 ↕</div><div class="data-grid__cell">의도/모듈명 ↕</div><div class="data-grid__cell">분류방식 ↕</div><div class="data-grid__cell">건수 ↕</div><div class="data-grid__cell">응답률 ↕</div></div>
            <div class="data-grid__row"><div class="data-grid__cell">1</div><div class="data-grid__cell">-</div><div class="data-grid__cell">미응답</div><div class="data-grid__cell">${Number(operate.undefined_intents ?? 15)}</div><div class="data-grid__cell">100%</div></div>
            <div class="data-grid__row"><div class="data-grid__cell">2</div><div class="data-grid__cell">Rich Form</div><div class="data-grid__cell">룰</div><div class="data-grid__cell">4</div><div class="data-grid__cell">100%</div></div>
          </div>
        </section>
        <section class="analysis-panel">
          <h3>선택일자 대화 이력 <span class="analysis-info-icon">i</span></h3>
          <div class="data-grid data-grid--studio" style="--data-grid-template:150px 1fr 180px 120px">
            <div class="data-grid__row data-grid__row--header"><div class="data-grid__cell">발화일시 ↕</div><div class="data-grid__cell">사용자 발화 ↕</div><div class="data-grid__cell">의도/모듈명 ⓘ ↕</div><div class="data-grid__cell">실행 결과 ↕</div></div>
            ${history.slice(0, 2).map((row) => `<div class="data-grid__row"><div class="data-grid__cell">${escapeText(row[0])}</div><div class="data-grid__cell">${escapeText(row[1])}</div><div class="data-grid__cell">${escapeText(row[2])}</div><div class="data-grid__cell">${escapeText(row[3])}</div></div>`).join("")}
          </div>
        </section>
      </div>
      </div>
    </section>
  `;
}

function renderDetailAidotScreen() {
  const inputMode = currentCompositionState.input_mode === "text" ? "text" : "pdf";
  const currentUtterances = (currentCompositionState.utterances || []).join("\n");
  const targetIntentCount = currentCompositionState.requested_intent_count || 50;
  const documentTitle = currentCompositionState.document_title || "";
  const fileName = currentCompositionState.pdf?.file_name || "";
  renderWorkflowScreenShell(
    "detail",
    "03",
    "봇 구성",
    "봇 구성은 학습문장을 기반으로 의도 후보를 생성합니다.",
    `<div class="aidot-rag-config">
      <section class="aidot-rag-left">
        <header>
          <strong>RAG 답변 문서 구성</strong>
          <span>구성용 엔진 : Semantic · Vector Worker · Aidot Vector Worker 기본 모델</span>
        </header>
        <div class="rag-form-grid">
          <label>구성 엔진<select><option value="Semantic - Vector Worker">Semantic - Vector Worker</option></select></label>
          <label>구성 모델<select><option value="Aidot Vector Worker 기본 모델">Aidot Vector Worker 기본 모델</option></select></label>
        </div>
        <div class="rag-info-line">자동 구성은 현재 버전의 최신 사전 기준을 사용합니다.</div>
        <div class="rag-source-mode">
          <label><input type="radio" name="config-input-mode" value="text" data-config-input-mode ${inputMode === "text" ? "checked" : ""} /> 텍스트</label>
          <label><input type="radio" name="config-input-mode" value="pdf" data-config-input-mode ${inputMode === "pdf" ? "checked" : ""} /> PDF</label>
        </div>
        ${inputMode === "text" ? `
          <label class="rag-source-field">답변 텍스트
            <textarea data-config-utterances aria-label="답변 텍스트 입력" placeholder="의도 : 계약 해지 요청&#10;답변 : 고객님, 해지 요청 확인했습니다.">${escapeText(currentUtterances)}</textarea>
          </label>
        ` : `
          <label class="rag-source-field">PDF 파일
            <div class="rag-pdf-upload-row">
              <button type="button" data-config-pdf-select>파일 선택</button>
              <input value="${escapeText(fileName)}" data-config-pdf-name readonly />
            </div>
          </label>
          <label class="rag-source-field">문서 제목
            <input value="${escapeText(documentTitle)}" data-config-doc-title placeholder="임베딩 후 문서에서 인식됩니다." />
          </label>
          <div class="rag-info-line rag-info-line--inline">
            <span>선택한 구성 모델 기준으로 답변 문서를 임베딩합니다.</span>
            <strong>Aidot Vector Worker 기본 모델</strong>
          </div>
        `}
        <div class="rag-target-row">
          <label>목표 의도 수<input type="number" min="1" value="${escapeText(targetIntentCount)}" data-config-intent-count /></label>
          <button type="button" class="ghost-btn" data-config-generate-qa>${inputMode === "pdf" ? "RAG 문서 구성" : "자동 구성"}</button>
        </div>
        <div class="rag-info-line">분류 수 기준 ML은 무조건 수를 강제하지 않고, 유사도가 충분한 후보만 병합합니다.</div>
      </section>
      <section class="aidot-rag-right">
        <header><strong>의도 후보</strong><div><button type="button" data-config-merge-selected>선택 병합</button><button type="button" class="primary-action-small" data-config-apply-current>현재 버전 덮어쓰기</button></div></header>
        <div data-config-preview class="rag-candidate-box">답변 텍스트 또는 PDF를 입력하고 RAG 문서 구성을 실행하세요.</div>
      </section>
    </div>`
  );

}
function renderWorkflowScreens() {
  try {
    renderWorkspaceHome();
    renderBotManagement();
    renderTeamDashboard();
    renderConfigureAidotScreen();
    renderDetailAidotScreen();
    renderBuildAidotScreen();
    renderTestAidotScreen();
    renderEvaluateAidotScreen();
    renderOperateAidotScreen();
    renderAnalysisAidotScreen();
  } catch (error) {
    console.error("CGA workflow render failed", error);
  } finally {
    enforceActiveScreenVisibility();
  }
}

function renderAllStatePanels() {
  renderGlobalMessage();
  renderNavigationRails();
  renderWorkflowRail();
  renderCreateSummary();
  renderTopContext();
  bindCreateControls();
  bindConfigureComposition();
  bindOperationsActions();
  renderCreateSummary();
  renderTopContext();
  renderConfigureComposition();
  renderAidotIntentManager();
  renderDetailTabs();
  renderErrorSamples();
  renderStateSummary();
  renderReadinessIssues();
  renderOperationsPanels();
  renderWorkflowScreens();
  bindAccessNavigationGuard();
  enforceActiveScreenVisibility();
  document.dispatchEvent(new CustomEvent("cga:content-rendered"));
}

function getAidotIntentRows() {
  const intentIds = new Set([
    ...currentScenarioAssets.map((item) => item.id || item.displayName).filter(Boolean),
    ...currentIntentUtteranceAssets.map((item) => item.division).filter(Boolean),
    ...(currentCompositionState.intent_candidates || []).map((item) => item.intent).filter(Boolean)
  ]);
  return [...intentIds].map((intentId, index) => {
    const scenario = currentScenarioAssets.find((item) => item.id === intentId || item.displayName === intentId) || {};
    const utterances = currentIntentUtteranceAssets.filter((item) => item.division === intentId);
    return {
      id: intentId,
      rowId: String(100001 + index),
      type: scenario.type || "intent",
      displayName: scenario.displayName || intentId,
      answer: scenario.answer || "",
      dialogCards: Array.isArray(scenario.dialogCards) ? scenario.dialogCards : [],
      utteranceCount: utterances.length,
      dialogCardCount: Math.max(Array.isArray(scenario.dialogCards) ? scenario.dialogCards.length : 0, scenario.type === "module" ? 0 : 1),
      tagCount: 0,
      updatedAt: scenario.updated_at || "2026-05-30 12:44",
      updatedBy: "cyhuh",
      utterances
    };
  });
}

function escapeText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderDetailAssetRows(items, columns) {
  if (!items.length) {
    return `<div class="aidot-intent-empty">${t("common.none", "None")}</div>`;
  }
  return `
    <div class="detail-asset-table">
      <div class="detail-asset-row head">${columns.map((column) => `<span>${escapeText(column.label)}</span>`).join("")}</div>
      ${items.map((item) => `
        <div class="detail-asset-row">
          ${columns.map((column) => {
            const value = column.value(item);
            const text = Array.isArray(value) ? value.join(", ") : value;
            return column.strong ? `<strong>${escapeText(text)}</strong>` : `<span>${escapeText(text)}</span>`;
          }).join("")}
        </div>
      `).join("")}
    </div>
  `;
}

function renderDetailTabs() {
  const intentPanel = document.querySelector("[data-detail-intent-panel]");
  const detailPanel = document.querySelector("[data-detail-tab-panel]");
  const buttons = document.querySelectorAll("[data-detail-tab]");
  if (!intentPanel || !detailPanel || !buttons.length) return;
  buttons.forEach((button) => {
    button.classList.toggle("active-tab", button.dataset.detailTab === currentDetailTab);
    if (button.dataset.bound !== "true") {
      button.dataset.bound = "true";
      button.addEventListener("click", () => {
        currentDetailTab = button.dataset.detailTab || "intent";
        if (currentDetailTab === "intent") renderAidotIntentManager();
        renderDetailTabs();
      });
    }
  });
  intentPanel.hidden = currentDetailTab !== "intent";
  detailPanel.hidden = currentDetailTab === "intent";
  if (currentDetailTab === "intent") return;

  const tabRenderers = {
    synonyms: () => renderDetailAssetRows(currentDictionaryAssets, [
      { label: t("detail.synonyms", "Synonyms"), value: (item) => item.word, strong: true },
      { label: t("detail.dictionary", "Dictionary"), value: (item) => item.synonyms || [] },
      { label: t("common.enabled", "Enabled"), value: () => "Y" }
    ]),
    entities: () => renderDetailAssetRows(currentEntityAssets, [
      { label: t("detail.entities", "Entities"), value: (item) => item.name, strong: true },
      { label: "Value", value: (item) => item.value || item.detail || "" },
      { label: "Type", value: (item) => item.rowType || "S" }
    ]),
    dictionary: () => renderDetailAssetRows(currentDictionaryAssets, [
      { label: t("detail.dictionary", "Dictionary"), value: (item) => item.word, strong: true },
      { label: t("detail.synonyms", "Synonyms"), value: (item) => item.synonyms || [] },
      { label: t("detail.updatedBy", "Updated by"), value: () => currentAccessState.currentUserId }
    ]),
    scenario: () => renderDetailAssetRows(getAidotIntentRows(), [
      { label: t("detail.scenario", "Scenario"), value: (item) => item.id, strong: true },
      { label: t("detail.answer", "Answer"), value: (item) => item.answer || item.dialogCards?.[0] || "" },
      { label: t("detail.dialogCards", "Dialog cards"), value: (item) => item.dialogCardCount }
    ]),
    api: () => renderDetailAssetRows(currentApiRegistry.filter((item) => item.group_id === currentWorkspaceGroupId && item.bot_id === currentWorkspaceBotId), [
      { label: t("detail.apiTools", "API Tools"), value: (item) => item.name, strong: true },
      { label: "Endpoint", value: (item) => item.endpoint_url },
      { label: "Response", value: (item) => item.response_path || item.response_mapping?.answer_text_path || "data.answer" }
    ])
  };
  detailPanel.innerHTML = tabRenderers[currentDetailTab]?.() || "";
}

function renderAidotIntentManager() {
  const summary = document.querySelector("[data-aidot-intent-summary]");
  const table = document.querySelector("[data-aidot-intent-table]");
  const editor = document.querySelector("[data-aidot-intent-editor]");
  const side = document.querySelector("[data-aidot-intent-side]");
  const search = document.querySelector("[data-aidot-intent-search]");
  const filter = document.querySelector("[data-aidot-intent-filter]");
  const addIntent = document.querySelector("[data-aidot-intent-add]");
  if (!summary || !table || !editor || !side) return;
  const rows = getAidotIntentRows();
  const filteredRows = rows.filter((row) => {
    const matchesType = currentIntentFilter === "all" || row.type === currentIntentFilter;
    const searchText = `${row.id} ${row.displayName} ${row.utterances.map((item) => item.utterance).join(" ")}`.toLowerCase();
    const matchesSearch = !currentIntentSearch || searchText.includes(currentIntentSearch.toLowerCase());
    return matchesType && matchesSearch;
  });
  if (!rows.some((row) => row.id === currentSelectedIntentId)) currentSelectedIntentId = rows[0]?.id || "";
  const selected = rows.find((row) => row.id === currentSelectedIntentId) || rows[0] || null;
  if (search && document.activeElement !== search) search.value = currentIntentSearch;
  if (filter) filter.value = currentIntentFilter;
  summary.innerHTML = `
    <div><strong>${t("detail.intentTotal", "Total intents")}</strong><span>${rows.length}</span></div>
    <div><strong>${t("detail.utterances", "Representative Utterances")}</strong><span>${currentIntentUtteranceAssets.length}</span></div>
    <div><strong>${t("detail.dialogCards", "Dialog cards")}</strong><span>${rows.reduce((sum, row) => sum + row.dialogCardCount, 0)}</span></div>
    <div><strong>${t("detail.dictionary", "Dictionary")}</strong><span>${currentDictionaryAssets.length}</span></div>
    <div><strong>${t("detail.entities", "Entities")}</strong><span>${currentEntityAssets.length}</span></div>
    <div><strong>${t("coverage.ruleTitle", "Rule")}</strong><span>${currentRuleAssets.length}</span></div>
  `;
  table.innerHTML = `
    <div class="aidot-intent-head">
      <span>ID</span><span>${t("detail.intentModule", "Intent / Module")}</span><span>${t("detail.displayName", "Display name")}</span><span>${t("detail.utteranceCount", "Utterances")}</span><span>${t("detail.dialogCards", "Dialog cards")}</span><span>T/R/F</span><span>${t("detail.updatedAt", "Updated at")}</span><span>${t("detail.updatedBy", "Updated by")}</span>
    </div>
    ${filteredRows.map((row) => `
      <button type="button" class="aidot-intent-row ${row.id === currentSelectedIntentId ? "selected" : ""}" data-select-intent="${row.id}">
        <span>${row.rowId}</span><strong>${row.id}</strong><span>${row.displayName}</span><span>${row.utteranceCount}</span><span>${row.dialogCardCount}</span><span class="option-dots"><b>T</b><b>R</b><b>F</b></span><span>${row.updatedAt}</span><span>${row.updatedBy}</span>
      </button>
    `).join("") || `<div class="aidot-intent-empty">${t("review.noIntentCandidate", "No intent candidate")}</div>`}
  `;
  if (!selected) {
    editor.innerHTML = `<strong>${t("review.noIntentCandidate", "No intent candidate")}</strong>`;
    side.innerHTML = "";
    return;
  }
  editor.innerHTML = `
    <label>${t("detail.intentModule", "Intent / Module")}<input data-intent-edit-name value="${selected.id}" /></label>
    <label>${t("detail.displayName", "Display name")}<input data-intent-edit-display value="${selected.displayName}" /></label>
    <label>${t("detail.answer", "Answer")}<textarea data-intent-edit-answer>${selected.answer || `${t("detail.simpleAnswer", "Simple answer")}: ${selected.displayName}`}</textarea></label>
    <label>${t("detail.dialogCards", "Dialog cards")}<textarea data-intent-edit-dialog>${selected.dialogCards?.join("\n") || selected.answer || ""}</textarea></label>
    <label>${t("detail.utterances", "Representative Utterances")}<textarea data-intent-edit-utterances>${selected.utterances.map((item) => item.utterance).join("\n")}</textarea></label>
  `;
  side.innerHTML = `
    <h4>${t("detail.advancedStatus", "Advanced status")}</h4>
    <p><b>${t("detail.synonyms", "Synonyms")}</b><span>${currentDictionaryAssets.length}</span></p>
    <p><b>${t("detail.entities", "Entities")}</b><span>${currentEntityAssets.length}</span></p>
    <p><b>${t("detail.scenario", "Scenario")}</b><span>${selected.dialogCardCount}</span></p>
    <p><b>${t("detail.apiTools", "API Tools")}</b><span>${currentApiRegistry.filter((item) => item.group_id === currentWorkspaceGroupId && item.bot_id === currentWorkspaceBotId).length}</span></p>
  `;
  table.querySelectorAll("[data-select-intent]").forEach((button) => {
    button.addEventListener("click", () => {
      currentSelectedIntentId = button.dataset.selectIntent;
      renderAidotIntentManager();
    });
  });
  if (search && search.dataset.bound !== "true") {
    search.dataset.bound = "true";
    search.addEventListener("input", () => {
      currentIntentSearch = search.value.trim();
      renderAidotIntentManager();
    });
  }
  if (filter && filter.dataset.bound !== "true") {
    filter.dataset.bound = "true";
    filter.addEventListener("change", () => {
      currentIntentFilter = filter.value || "all";
      renderAidotIntentManager();
    });
  }
  if (addIntent && addIntent.dataset.bound !== "true") {
    addIntent.dataset.bound = "true";
    addIntent.addEventListener("click", () => {
      const latestRows = getAidotIntentRows();
      let nextNumber = latestRows.length + 1;
      let id = `new_intent_${nextNumber}`;
      const usedIds = new Set(latestRows.map((row) => row.id));
      while (usedIds.has(id)) {
        nextNumber += 1;
        id = `new_intent_${nextNumber}`;
      }
      currentScenarioAssets = [...currentScenarioAssets, { id, type: "intent", displayName: id, answer: "", dialogCards: [] }];
      currentIntentUtteranceAssets = [...currentIntentUtteranceAssets, { utterance: `sample utterance ${nextNumber}`, division: id }];
      currentSelectedIntentId = id;
      currentIntentSearch = "";
      currentIntentFilter = "all";
      currentStudioState.counts.intents = getAidotIntentRows().length;
      currentStudioState.counts.utterances = currentIntentUtteranceAssets.length;
      saveDetailAssetsToServer().catch(() => false);
      renderAidotIntentManager();
      renderStateSummary();
      renderOperationsPanels();
    });
  }
  const nameInput = editor.querySelector("[data-intent-edit-name]");
  const displayInput = editor.querySelector("[data-intent-edit-display]");
  const answerInput = editor.querySelector("[data-intent-edit-answer]");
  const dialogInput = editor.querySelector("[data-intent-edit-dialog]");
  const utteranceInput = editor.querySelector("[data-intent-edit-utterances]");
  const saveSelectedIntent = () => {
    const nextId = nameInput.value.trim() || selected.id;
    const nextDisplay = displayInput.value.trim() || nextId;
    const nextAnswer = answerInput.value.trim();
    const nextDialogCards = dialogInput.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    currentScenarioAssets = [
      ...currentScenarioAssets.filter((item) => item.id !== selected.id && item.displayName !== selected.id),
      { id: nextId, type: "intent", displayName: nextDisplay, answer: nextAnswer, dialogCards: nextDialogCards }
    ];
    const otherUtterances = currentIntentUtteranceAssets.filter((item) => item.division !== selected.id);
    const nextUtterances = utteranceInput.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).map((utterance) => ({ utterance, division: nextId }));
    currentIntentUtteranceAssets = [...otherUtterances, ...nextUtterances];
    currentSelectedIntentId = nextId;
    currentStudioState.counts.intents = getAidotIntentRows().length;
    currentStudioState.counts.utterances = currentIntentUtteranceAssets.length;
    saveDetailAssetsToServer().catch(() => false);
    renderStateSummary();
    renderOperationsPanels();
  };
  [nameInput, displayInput, answerInput, dialogInput, utteranceInput].forEach((input) => input.addEventListener("change", () => {
    saveSelectedIntent();
    renderAidotIntentManager();
  }));
}

function normalizeIntentCandidate(item, index = 0) {
  const intent = item.intent || item.name || item.id || `intent_${index + 1}`;
  const utterances = Array.isArray(item.utterances) ? item.utterances : [];
  return {
    intent,
    utterance_count: Number(item.utterance_count || item.utteranceCount || utterances.length || 0),
    status: item.status || "answer_required",
    utterances
  };
}

function sanitizeIntentToken(value, fallback = "intent") {
  const text = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u3131-\u318e\uac00-\ud7a3]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return text || fallback;
}

function deriveIntentNameFromUtterance(text, index = 0) {
  const source = String(text || "").trim();
  const explicitMatch = source.match(/(?:의도|intent)\s*[:：]\s*([^\n/]+)/i);
  if (explicitMatch?.[1]) {
    return sanitizeIntentToken(explicitMatch[1], `intent_${index + 1}`);
  }
  const normalized = source.toLowerCase();
  if (/(password|비밀번호|로그인)/.test(normalized)) return "password_reset";
  if (/(email|메일|account|계정|profile|프로필|정보변경|update)/.test(normalized)) return "account_update";
  if (/(cancel|해지|subscription|plan|요금제)/.test(normalized)) return "cancel_subscription";
  if (/(order|주문|delivery|배송|tracking)/.test(normalized)) return "order_status";
  if (/(bill|billing|payment|refund|결제|환불|요금)/.test(normalized)) return "billing_question";
  if (/(greeting|hello|hi|안녕|반가워)/.test(normalized)) return "greeting";
  return `general_inquiry_${index + 1}`;
}

function buildCompositionIntentCandidates() {
  if (currentCompositionState.input_mode === "pdf") {
    const base = sanitizeIntentToken(
      currentCompositionState.document_title || currentCompositionState.pdf?.file_name || currentWorkspaceBotId || "document",
      "document"
    );
    return [
      { intent: `${base}_overview`, utterance_count: 0, status: "ready", utterances: [] },
      { intent: `${base}_policy`, utterance_count: 0, status: "ready", utterances: [] },
      { intent: `${base}_procedure`, utterance_count: 0, status: "ready", utterances: [] }
    ];
  }

  const buckets = new Map();
  (currentCompositionState.utterances || []).forEach((utterance, index) => {
    const intent = deriveIntentNameFromUtterance(utterance, index);
    const existing = buckets.get(intent) || [];
    existing.push(utterance);
    buckets.set(intent, existing);
  });

  return [...buckets.entries()].slice(0, Math.max(1, currentCompositionState.requested_intent_count || 1)).map(([intent, utterances]) => ({
    intent,
    utterance_count: utterances.length,
    status: utterances.length ? "ready" : "answer_required",
    utterances
  }));
}

function syncCandidatesToCurrentVersion(candidates) {
  const nextCandidates = Array.isArray(candidates) && candidates.length
    ? candidates
    : (currentCompositionState.intent_candidates || []).filter((item) => currentSelectedCompositionCandidates.has(item.intent));
  if (!nextCandidates.length) return false;

  nextCandidates.forEach((candidate) => {
    const intentId = candidate.intent;
    const existingScenarioIndex = currentScenarioAssets.findIndex((item) => item.id === intentId || item.displayName === intentId);
    const nextScenario = {
      id: intentId,
      type: "intent",
      displayName: intentId,
      answer: existingScenarioIndex >= 0 ? currentScenarioAssets[existingScenarioIndex].answer : "",
      dialogCards: existingScenarioIndex >= 0 ? currentScenarioAssets[existingScenarioIndex].dialogCards : [],
      updated_at: new Date().toISOString().slice(0, 16).replace("T", " ")
    };
    if (existingScenarioIndex >= 0) currentScenarioAssets.splice(existingScenarioIndex, 1, nextScenario);
    else currentScenarioAssets.push(nextScenario);

    if (Array.isArray(candidate.utterances) && candidate.utterances.length) {
      currentIntentUtteranceAssets = [
        ...currentIntentUtteranceAssets.filter((item) => item.division !== intentId),
        ...candidate.utterances.map((utterance) => ({ utterance, division: intentId }))
      ];
    }
  });

  currentSelectedIntentId = nextCandidates[0]?.intent || currentSelectedIntentId;
  currentStudioState.counts.intents = getAidotIntentRows().length;
  currentStudioState.counts.utterances = currentIntentUtteranceAssets.length;
  currentOperationsState.build.intent_count = currentStudioState.counts.intents;
  return true;
}

function addWorkflowIntentFromBuild() {
  const latestRows = getAidotIntentRows();
  let nextNumber = latestRows.length + 1;
  let id = `new_intent_${nextNumber}`;
  const usedIds = new Set(latestRows.map((row) => row.id));
  while (usedIds.has(id)) {
    nextNumber += 1;
    id = `new_intent_${nextNumber}`;
  }
  currentScenarioAssets = [...currentScenarioAssets, { id, type: "intent", displayName: id, answer: "", dialogCards: [] }];
  currentIntentUtteranceAssets = [...currentIntentUtteranceAssets, { utterance: `sample utterance ${nextNumber}`, division: id }];
  currentSelectedIntentId = id;
  currentBuildAidotView = "start";
  currentBuildSelectedUtterances = new Set();
  currentStudioState.counts.intents = getAidotIntentRows().length;
  currentStudioState.counts.utterances = currentIntentUtteranceAssets.length;
}

async function saveCurrentBuildIntent(intentId, patch = {}) {
  if (!intentId) return false;
  const currentScenario = currentScenarioAssets.find((item) => item.id === intentId || item.displayName === intentId) || {
    id: intentId,
    type: "intent",
    displayName: intentId,
    answer: "",
    dialogCards: []
  };
  const nextScenario = {
    ...currentScenario,
    ...patch,
    id: intentId,
    displayName: patch.displayName || currentScenario.displayName || intentId
  };
  currentScenarioAssets = [
    ...currentScenarioAssets.filter((item) => item.id !== intentId && item.displayName !== intentId),
    nextScenario
  ];
  currentStudioState.counts.intents = getAidotIntentRows().length;
  currentStudioState.counts.utterances = currentIntentUtteranceAssets.length;
  await saveDetailAssetsToServer().catch(() => false);
  renderAllStatePanels();
  return true;
}

function buildManualHandoffPackage() {
  return {
    type: "cga.manual_llm_handoff",
    group_id: currentWorkspaceGroupId,
    bot_id: currentWorkspaceBotId,
    bot_locale: currentStudioState.bot.defaultLocale || "en",
    requested_intent_count: currentCompositionState.requested_intent_count,
    utterances: currentCompositionState.utterances,
    instruction: "Classify these training utterances into intent candidates and return intent_candidates."
  };
}

function extractIntentCandidatesFromResult(json) {
  const source = json.intent_candidates || json.intents || json.result?.intent_candidates || [];
  return Array.isArray(source) ? source.map(normalizeIntentCandidate) : [];
}

function renderConfigureComposition() {
  const utterances = document.querySelector("[data-config-utterances]");
  const intentCount = document.querySelector("[data-config-intent-count]");
  const pdfSelect = document.querySelector("[data-config-pdf-select]");
  const pdfName = document.querySelector("[data-config-pdf-name]");
  const docTitle = document.querySelector("[data-config-doc-title]");
  const generateQa = document.querySelector("[data-config-generate-qa]");
  const preview = document.querySelector("[data-config-preview]");
  if (utterances && document.activeElement !== utterances) utterances.value = currentCompositionState.utterances.join("\n");
  if (intentCount && document.activeElement !== intentCount) intentCount.value = String(currentCompositionState.requested_intent_count || 1);
  if (pdfSelect) {
    pdfSelect.textContent = "파일 선택";
  }
  if (pdfName && document.activeElement !== pdfName) pdfName.value = currentCompositionState.pdf?.file_name || "";
  if (docTitle && document.activeElement !== docTitle) docTitle.value = currentCompositionState.document_title || "";
  if (generateQa) {
    generateQa.disabled = currentCompositionState.input_mode === "pdf" && (!canGeneratePdfQa(currentStudioState) || !currentCompositionState.pdf);
  }
  if (preview) {
    const candidates = currentCompositionState.intent_candidates || [];
    if (!currentSelectedCompositionCandidates.size && candidates.length) {
      currentSelectedCompositionCandidates = new Set(candidates.map((item) => item.intent));
    }
    const getIntentStatusLabel = (status) => ({
      answer_required: t("review.answerRequired", "Answer draft required"),
      ready: t("review.ready", "Ready")
    })[status] || status || t("review.answerRequired", "Answer draft required");
    preview.innerHTML = candidates.map((item) => `
      <div class="intent-row">
        <label class="intent-row__check"><input type="checkbox" data-config-candidate-select="${escapeText(item.intent)}" ${currentSelectedCompositionCandidates.has(item.intent) ? "checked" : ""} /></label>
        <strong>${item.intent}</strong>
        <span>${item.utterance_count || 0} ${t("review.utteranceUnit", "utterances")}</span>
        <span>${getIntentStatusLabel(item.status)}</span>
        <button type="button" data-i18n="review.review" data-config-review-intent="${escapeText(item.intent)}">Review</button>
      </div>
    `).join("") || `<div class="intent-row"><label class="intent-row__check"><input type="checkbox" disabled /></label><strong>${t("review.noIntentCandidate", "No intent candidate")}</strong><span>0 ${t("review.utteranceUnit", "utterances")}</span><span>${currentCompositionState.input_mode === "pdf" ? "답변 텍스트 또는 PDF를 입력하고 RAG 문서 구성을 실행하세요." : t("review.manualResultRequired", "Manual handoff or PDF Q&A result required")}</span><button type="button" disabled data-i18n="review.review">Review</button></div>`;
    preview.querySelectorAll("[data-config-review-intent]").forEach((button) => {
      button.addEventListener("click", () => {
        currentSelectedIntentId = button.dataset.configReviewIntent || currentSelectedIntentId;
        currentBuildAidotView = "start";
        setActiveScreen("build");
      });
    });
    preview.querySelectorAll("[data-config-candidate-select]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const intent = checkbox.dataset.configCandidateSelect;
        if (!intent) return;
        if (checkbox.checked) currentSelectedCompositionCandidates.add(intent);
        else currentSelectedCompositionCandidates.delete(intent);
      });
    });
  }
}

function requestPdfFile(handler) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/pdf,.pdf";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", async () => {
      await handler(file, String(reader.result || ""));
      renderAllStatePanels();
    });
    reader.readAsDataURL(file);
  });
  input.click();
}

function bindConfigureComposition() {
  document.querySelectorAll("[data-config-input-mode]").forEach((radio) => {
    if (radio.dataset.bound === "true") return;
    radio.dataset.bound = "true";
    radio.addEventListener("change", () => {
      currentCompositionState.input_mode = radio.value === "text" ? "text" : "pdf";
      scheduleCompositionSave();
      renderWorkflowScreens();
      bindConfigureComposition();
      renderConfigureComposition();
      enforceActiveScreenVisibility();
    });
  });
  const utterances = document.querySelector("[data-config-utterances]");
  const intentCount = document.querySelector("[data-config-intent-count]");
  const docTitle = document.querySelector("[data-config-doc-title]");
  const exportHandoff = document.querySelector("[data-config-export-handoff]");
  const importResult = document.querySelector("[data-config-import-result]");
  const pdfSelect = document.querySelector("[data-config-pdf-select]");
  const savePdf = document.querySelector("[data-config-save-pdf]");
  const generateQa = document.querySelector("[data-config-generate-qa]");
  const mergeSelected = document.querySelector("[data-config-merge-selected]");
  const applyCurrent = document.querySelector("[data-config-apply-current]");
  if (utterances && utterances.dataset.bound !== "true") {
    utterances.dataset.bound = "true";
    utterances.addEventListener("input", () => {
      currentCompositionState.utterances = utterances.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      currentStudioState.counts.utterances = currentCompositionState.utterances.length;
      scheduleCompositionSave();
      renderStateSummary();
    });
  }
  if (intentCount && intentCount.dataset.bound !== "true") {
    intentCount.dataset.bound = "true";
    intentCount.addEventListener("input", () => {
      currentCompositionState.requested_intent_count = Math.max(1, Number(intentCount.value || 1));
      scheduleCompositionSave();
    });
  }
  if (docTitle && docTitle.dataset.bound !== "true") {
    docTitle.dataset.bound = "true";
    docTitle.addEventListener("input", () => {
      currentCompositionState.document_title = docTitle.value;
      scheduleCompositionSave();
    });
  }
  if (exportHandoff && exportHandoff.dataset.bound !== "true") {
    exportHandoff.dataset.bound = "true";
    exportHandoff.addEventListener("click", async () => {
      await saveCompositionToServer().catch(() => false);
      const fileName = `CGA_Handoff_${getSafeFileName(currentStudioState.bot.name, "CGA_Bot")}_${getTodayStamp()}.json`;
      downloadJsonFile(fileName, buildManualHandoffPackage());
    });
  }
  if (importResult && importResult.dataset.bound !== "true") {
    importResult.dataset.bound = "true";
    importResult.addEventListener("click", () => {
      requestJsonUpload(async (json) => {
        const candidates = extractIntentCandidatesFromResult(json);
        if (candidates.length) {
          currentCompositionState.intent_candidates = candidates;
          currentStudioState.counts.intents = candidates.length;
          await saveCompositionToServer().catch(() => false);
          renderAllStatePanels();
        }
      });
    });
  }
  if (pdfSelect && pdfSelect.dataset.bound !== "true") {
    pdfSelect.dataset.bound = "true";
    pdfSelect.addEventListener("click", () => {
      requestPdfFile(async (file, dataUrl) => {
        currentCompositionState.pdf = {
          file_name: file.name,
          byte_length: file.size,
          type: file.type || "application/pdf",
          data_url: dataUrl
        };
        currentStudioState.counts.documents = 1;
        await saveCompositionToServer().catch(() => false);
      });
    });
  }
  if (savePdf && savePdf.dataset.bound !== "true") {
    savePdf.dataset.bound = "true";
    savePdf.addEventListener("click", async () => {
      if (!currentCompositionState.pdf) {
        requestPdfFile(async (file, dataUrl) => {
          currentCompositionState.pdf = {
            file_name: file.name,
            byte_length: file.size,
            type: file.type || "application/pdf",
            data_url: dataUrl
          };
          currentStudioState.counts.documents = 1;
          await saveCompositionToServer().catch(() => false);
        });
        return;
      }
      await saveCompositionToServer().catch(() => false);
      renderAllStatePanels();
    });
  }
  if (generateQa && generateQa.dataset.bound !== "true") {
    generateQa.dataset.bound = "true";
    generateQa.addEventListener("click", async () => {
      const candidates = buildCompositionIntentCandidates().map(normalizeIntentCandidate);
      currentCompositionState.intent_candidates = candidates;
      currentSelectedCompositionCandidates = new Set(candidates.map((item) => item.intent));
      currentStudioState.counts.intents = candidates.length;
      await saveCompositionToServer().catch(() => false);
      renderAllStatePanels();
    });
  }
  if (mergeSelected && mergeSelected.dataset.bound !== "true") {
    mergeSelected.dataset.bound = "true";
    mergeSelected.addEventListener("click", async () => {
      const applied = syncCandidatesToCurrentVersion();
      if (!applied) return;
      await saveDetailAssetsToServer().catch(() => false);
      renderAllStatePanels();
      setActiveScreen("build");
    });
  }
  if (applyCurrent && applyCurrent.dataset.bound !== "true") {
    applyCurrent.dataset.bound = "true";
    applyCurrent.addEventListener("click", async () => {
      const applied = syncCandidatesToCurrentVersion(currentCompositionState.intent_candidates || []);
      if (!applied) return;
      await saveDetailAssetsToServer().catch(() => false);
      renderAllStatePanels();
      setActiveScreen("build");
    });
  }
}

function bindCreateControls() {
  syncCreateControlsFromState();
  document.querySelectorAll("[data-structural-field]").forEach((control) => {
    if (control.dataset.createBound === "true") return;
    control.dataset.createBound = "true";
    control.addEventListener("input", () => {
      const field = control.dataset.structuralField;
      setByPath(currentStudioState, field, coerceFieldValue(field, control.value));
      applyStructuralSideEffects(field);
      renderAllStatePanels();
      scheduleStudioStateSave();
    });
    control.addEventListener("change", async () => {
      const field = control.dataset.structuralField;
      setByPath(currentStudioState, field, coerceFieldValue(field, control.value));
      applyStructuralSideEffects(field);
      renderAllStatePanels();
      await saveStudioStateToServer().catch(() => false);
      renderWorkspaceHome();
    });
  });
}

function getVisibleExistingScreenIds(workspace = document.querySelector(".workspace")) {
  const existingIds = new Set(
    getWorkspaceScreenSections(workspace)
      .map((section) => section.dataset.screenId)
      .filter(Boolean)
  );
  return getVisibleLayout()
    .map((item) => item.id)
    .filter((id) => existingIds.has(id));
}

function getSelectableScreenIds(workspace = document.querySelector(".workspace")) {
  if (!workspace) return [];
  const visibleExistingIds = getVisibleExistingScreenIds(workspace);
  if (visibleExistingIds.length) return visibleExistingIds;
  return getWorkspaceScreenSections(workspace)
    .map((section) => section.dataset.screenId)
    .filter(Boolean);
}

function setScreenSectionVisible(section, visible) {
  section.classList.toggle("selected", visible);
  section.setAttribute("aria-hidden", visible ? "false" : "true");
  if (visible) {
    section.hidden = false;
    section.style.display = "block";
  } else {
    section.hidden = true;
    section.style.display = "none";
  }
}

function resolveActiveScreenId() {
  const workspace = document.querySelector(".workspace");
  if (!workspace) return "";
  const selectableIds = getSelectableScreenIds(workspace);
  if (postAuthDefaultScreenPending && selectableIds.includes(DEFAULT_ACTIVE_SCREEN_ID)) {
    return DEFAULT_ACTIVE_SCREEN_ID;
  }
  const hashId = window.location.hash.replace("#", "");
  const candidates = [hashId, activeScreenId, DEFAULT_ACTIVE_SCREEN_ID, selectableIds[0]].filter(Boolean);
  return candidates.find((id) => selectableIds.includes(id)) || selectableIds[0] || "";
}

function enforceActiveScreenVisibility() {
  const workspace = document.querySelector(".workspace");
  if (!workspace) return;
  const sections = getWorkspaceScreenSections(workspace);
  if (!hasAuthSession()) {
    sections.forEach((section) => setScreenSectionVisible(section, false));
    return;
  }
  const nextActiveScreenId = resolveActiveScreenId();
  activeScreenId = nextActiveScreenId;
  sections.forEach((section) => {
    const selected = Boolean(nextActiveScreenId) && section.dataset.screenId === nextActiveScreenId;
    setScreenSectionVisible(section, selected);
  });
}
function scheduleActiveScreenVisibility() {
  enforceActiveScreenVisibility();
  window.requestAnimationFrame?.(() => enforceActiveScreenVisibility());
  window.setTimeout(() => enforceActiveScreenVisibility(), 0);
  window.setTimeout(() => enforceActiveScreenVisibility(), 100);
}
function applyScreenLayout() {
  if (screenLayoutApplying) return;
  const workspace = document.querySelector(".workspace");
  if (!workspace) return;
  if (!applyAuthGate()) return;
  screenLayoutApplying = true;
  try {
    const visibleLayout = getVisibleLayout();
    const visibleIds = visibleLayout.map((item) => item.id);
    const sectionsById = new Map(
      getWorkspaceScreenSections(workspace).map((section) => [section.dataset.screenId, section])
    );
    sectionsById.forEach((section) => setScreenSectionVisible(section, false));
    const visibleExistingIds = visibleIds.filter((id) => sectionsById.has(id));
    if (!visibleExistingIds.includes(activeScreenId)) {
      activeScreenId = resolveActiveScreenId();
    }
    visibleLayout.forEach((item) => {
      const section = sectionsById.get(item.id);
      if (!section) return;
      section.dataset.layoutGroup = item.group;
      section.dataset.layoutMode = item.mode;
      workspace.appendChild(section);
    });
    enforceActiveScreenVisibility();
    updateNavigationActiveState();
    if (activeScreenId === "access-management") {
      renderAccessPanels();
    }
    if (activeScreenId === "bot-management" && typeof renderBotManagement === "function") {
      renderBotManagement();
      refreshWorkspaceBotsFromServer(currentWorkspaceGroupId)
        .then(() => { renderBotManagement(); enforceActiveScreenVisibility(); })
        .catch(() => { renderBotManagement(); enforceActiveScreenVisibility(); });
    }
    if (["workspace-home", "detail", "build", "test", "evaluate", "operate", "analysis"].includes(activeScreenId)) {
      renderWorkflowScreens();
    }
    syncTopActionsForScreen();
  } catch (error) {
    console.error("CGA screen layout failed", error);
  } finally {
    screenLayoutApplying = false;
    postAuthDefaultScreenPending = false;
    enforceActiveScreenVisibility();
    updateNavigationActiveState();
    syncTopActionsForScreen();
  }
}
function updateNavigationActiveState() {
  document.querySelectorAll(".management-nav a, .server-sub-nav a, .system-admin-subnav a, [data-workflow-nav] a").forEach((link) => {
    const linkScreenId = link.getAttribute("href")?.replace("#", "");
    const adminSubviewMatches = !link.dataset.adminSubview || link.dataset.adminSubview === currentSystemAdminSubview;
    const configSubviewMatches = !link.dataset.configSubview || (linkScreenId === "configure" && link.dataset.configSubview === currentConfigureSubview);
    link.classList.toggle("active", linkScreenId === activeScreenId && adminSubviewMatches && configSubviewMatches);
  });
}

function renderStateSummary() {
  const container = document.querySelector("[data-state-summary]");
  if (!container) return;
  const readiness = deriveReadiness(currentStudioState)
  const pdfStatus = canGeneratePdfQa(currentStudioState) ? t("state.pdfAvailable", "Available") : t("state.pdfBlockedLlm", "Blocked: LLM required");
  const kakaoStatus = canUseKakaoChannel(currentStudioState) ? t("state.kakaoAvailableKo", "Available for Korean locale") : t("state.kakaoDisabledNonKo", "Disabled outside Korean locale");
  container.innerHTML = `
    <div class="state-metric"><strong>${t("state.bot", "Bot")}</strong><span>${currentStudioState.bot.name || t("state.notNamed", "Not named")}</span></div>
    <div class="state-metric"><strong>${t("state.locale", "Locale")}</strong><span>${currentStudioState.bot.defaultLocale}</span></div>
    <div class="state-metric"><strong>${t("state.intents", "Intents")}</strong><span>${currentStudioState.counts.intents}</span></div>
    <div class="state-metric"><strong>${t("state.documents", "Documents")}</strong><span>${currentStudioState.counts.documents}</span></div>
    <div class="state-metric ${readiness.ready ? "ok" : "blocked"}"><strong>${t("state.readiness", "Readiness")}</strong><span>${readiness.ready ? t("state.ready", "Ready") : t("common.blocked", "Blocked")}</span></div>
    <div class="state-metric blocked"><strong>PDF Q&A</strong><span>${pdfStatus}</span></div>
    <div class="state-metric"><strong>Kakao KR</strong><span>${kakaoStatus}</span></div>
  `;
}

function renderReadinessIssues() {
  const container = document.querySelector("[data-readiness-issues]");
  if (!container) return;
  const readiness = deriveReadiness(currentStudioState)
  if (readiness.ready) {
    container.innerHTML = `<p class="issue-ok">${t("state.noBlockingIssue", "No blocking issue.")}</p>`;
    return;
  }
  container.innerHTML = readiness.issues.map((issue) => `
    <p><b>${issue.code}</b><span data-error-key="${issue.key}">${issue.code}</span></p>
  `).join("");
}

function renderWorkflowRail() {
  const nav = document.querySelector("[data-workflow-nav]");
  if (!nav) return;
  const configureSubviews = [
    { id: "ai-model", label: "AI 모델 설정" },
    { id: "defaults", label: "기본값 설정" },
    { id: "message", label: "메시지 설정" },
    { id: "messenger", label: "메신저 편의 기능" },
    { id: "ignore", label: "제외/무시 목록 설정" },
    { id: "rule", label: "룰 설정" },
    { id: "smalltalk", label: "스몰토크" },
    { id: "botstation", label: "봇스테이션" }
  ];
  nav.innerHTML = workflowSteps.map((step) => {
    if (step.id !== "configure") {
      return `
        <a href="#${step.id}" class="${step.id === activeScreenId ? "active" : ""}">
          <span>${step.number}</span>
          <strong data-i18n="workflow.${step.id}.title">${step.title}</strong>
          <small data-i18n="workflow.${step.id}.subtitle">${step.subtitle}</small>
        </a>
      `;
    }
    return `
      <details class="workflow-step-group" ${activeScreenId === "configure" ? "open" : ""}>
        <summary class="workflow-step-group__summary ${step.id === activeScreenId ? "active" : ""}">
          <span>${step.number}</span>
          <strong data-i18n="workflow.${step.id}.title">${step.title}</strong>
          <small data-i18n="workflow.${step.id}.subtitle">${step.subtitle}</small>
        </summary>
        <div class="workflow-step-subnav">
          <details class="subnav-group" ${["ai-model", "defaults", "message", "messenger"].includes(currentConfigureSubview) ? "open" : ""}>
            <summary>설정</summary>
            <div class="subnav-group__links">
              ${configureSubviews.slice(0, 4).map((item) => `<a href="#configure" data-config-subview="${item.id}" class="${currentConfigureSubview === item.id ? "active" : ""}"><span>${item.label}</span></a>`).join("")}
            </div>
          </details>
          <details class="subnav-group" ${["ignore", "rule", "smalltalk"].includes(currentConfigureSubview) ? "open" : ""}>
            <summary>기본 대화</summary>
            <div class="subnav-group__links">
              ${configureSubviews.slice(4, 7).map((item) => `<a href="#configure" data-config-subview="${item.id}" class="${currentConfigureSubview === item.id ? "active" : ""}"><span>${item.label}</span></a>`).join("")}
            </div>
          </details>
          <details class="subnav-group" ${currentConfigureSubview === "botstation" ? "open" : ""}>
            <summary>연계</summary>
            <div class="subnav-group__links">
              ${configureSubviews.slice(7).map((item) => `<a href="#configure" data-config-subview="${item.id}" class="${currentConfigureSubview === item.id ? "active" : ""}"><span>${item.label}</span></a>`).join("")}
            </div>
          </details>
        </div>
      </details>
    `;
  }).join("");
  nav.querySelectorAll("[data-config-subview]").forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    currentConfigureSubview = link.dataset.configSubview || "ai-model";
    if (activeScreenId !== "configure") {
      setActiveScreen("configure");
      return;
    }
    renderWorkflowRail();
    renderConfigureAidotScreen();
    updateNavigationActiveState();
    enforceActiveScreenVisibility();
  }));
}

function renderLinkRail(selector, links) {
  const nav = document.querySelector(selector);
  if (!nav) return;
  nav.innerHTML = links.map((link) => `
    <a href="#${link.id}" class="${link.id === activeScreenId ? "active" : ""}">
      <span>${link.code}</span>
      <strong data-i18n="${link.titleKey}">${link.title}</strong>
      <small data-i18n="${link.subtitleKey}">${link.subtitle}</small>
    </a>
  `).join("");
}

function renderSystemAdminSubnav() {
  const container = document.querySelector("[data-system-admin-subnav]");
  if (!container) return;
  container.innerHTML = systemAdminSections.map((section) => `
    <details class="subnav-group" ${section.links.some((link) => link.id === activeScreenId && (!link.subview || link.subview === currentSystemAdminSubview)) ? "open" : ""}>
      <summary>${section.title}</summary>
      <div class="subnav-group__links">
        ${section.links.map((link) => `
          <a href="#${link.id}" class="${link.id === activeScreenId && (!link.subview || link.subview === currentSystemAdminSubview) ? "active" : ""}" ${link.subview ? `data-admin-subview="${link.subview}"` : ""}>
            <span>${link.label}</span>
          </a>
        `).join("")}
      </div>
    </details>
  `).join("");
}

function renderNavigationRails() {
  renderLinkRail("[data-query-nav]", queryLinks);
  renderLinkRail("[data-management-nav]", managementLinks);
  renderLinkRail("[data-operation-nav]", operationLinks);
  renderSystemAdminSubnav();
}

function renderBoundaryMatrix() {
  const table = document.querySelector("[data-boundary-table]");
  if (!table) return;
  table.innerHTML = `
    <div class="boundary-head">${t("module.screen", "Screen")}</div>
    <div class="boundary-head">${t("module.publicCore", "Public Core")}</div>
    <div class="boundary-head">${t("module.commercialCandidate", "Commercial Candidate")}</div>
    ${workflowSteps.map((step) => `
      <div>${step.number} ${step.title}</div>
      <div>${step.publicCore.join(", ")}</div>
      <div>${step.commercial.join(", ")}</div>
    `).join("")}
  `;
}

function renderErrorSamples() {
  const container = document.querySelector("[data-error-samples]");
  if (!container) return;
  const cgaErrors = errorSamples.filter((sample) => sample.localeSource === "user.locale");
  const botErrors = errorSamples.filter((sample) => sample.localeSource === "bot.defaultLocale");
  const botLocale = currentStudioState.bot.defaultLocale || "en";
  const resolveBotMessage = (sample) => window.cgaStudioI18n?.resolveMessage(botLocale, sample.key, sample.code) || sample.code;
  container.innerHTML = `
    <div class="error-sample-group">
      <strong><span data-i18n="i18n.cgaErrorGroup">CGA Error</span> · user.locale</strong>
      ${cgaErrors.map((sample) => `
        <p>
          <b>${sample.code}</b>
          <span data-error-key="${sample.key}">${sample.code}</span>
        </p>
      `).join("")}
    </div>
    <div class="error-sample-group">
      <strong><span data-i18n="i18n.botErrorGroup">Bot Error</span> · ${botLocale}</strong>
      ${botErrors.map((sample) => `
        <p>
          <b>${sample.code}</b>
          <span data-bot-error-key="${sample.key}">${resolveBotMessage(sample)}</span>
        </p>
      `).join("")}
    </div>
  `;
}

function openHelpTopic(topicId) {
  const topic = HELP_TOPICS[topicId];
  const modal = document.querySelector("[data-help-modal]");
  const title = document.querySelector("[data-help-title]");
  const body = document.querySelector("[data-help-body]");
  if (!topic || !modal || !title || !body) return;
  title.textContent = topic.title;
  body.innerHTML = topic.body;
  modal.hidden = false;
}

function closeHelpModal() {
  const modal = document.querySelector("[data-help-modal]");
  if (modal) modal.hidden = true;
}

function bindHelpModal() {
  document.querySelectorAll("[data-help-topic]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => openHelpTopic(button.dataset.helpTopic));
  });
  document.querySelectorAll("[data-help-close]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", closeHelpModal);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeHelpModal();
  });
}


// Final workflow overrides. Keep these after legacy screen helpers so the bot production
// workflow always uses the Aidot-compatible screen order and compact lookup layout.
function htmlList(items) {
  return items.map((item) => `<li>${item}</li>`).join("");
}

function labelFieldPath(fieldPath) {
  const labels = {
    "structuralChoices.useLlm": "LLM usage for bot composition",
    "structuralChoices.compositionInput": "Composition input type",
    "structuralChoices.allowPdf": "PDF Q&A allowance",
    "structuralChoices.botServerLocation": "Bot Server location",
    "structuralChoices.orchestratorMode": "Orchestrator mode",
    "bot.defaultLocale": "Default language",
    "bot.selectedChannels": "Base channels",
    "llm.provider": "LLM provider",
    "llm.model": "LLM model",
    "llm.baseUrl": "LLM base URL",
    "prompt.template": "Prompt template details",
    "runtime.costLimit": "Cost limit",
    "runtime.timeout": "Runtime timeout"
  };
  return labels[fieldPath] || fieldPath;
}

function renderLockPolicy() {
  const locked = document.querySelector("[data-locked-fields]");
  const runtime = document.querySelector("[data-runtime-fields]");
  if (locked) {
    locked.innerHTML = TRAINING_LOCKED_CREATE_FIELDS.map((field) => `
      <div class="policy-row locked"><strong>${labelFieldPath(field)}</strong><span>${field}</span></div>
    `).join("");
  }
  if (runtime) {
    runtime.innerHTML = RUNTIME_ADJUSTABLE_FIELDS.map((field) => `
      <div class="policy-row runtime"><strong>${labelFieldPath(field)}</strong><span>${field}</span></div>
    `).join("");
  }
}

function renderCommercialAvailability() {
  const container = document.querySelector("[data-commercial-availability]");
  if (!container) return;
  const registry = createDefaultModuleRegistry();
  const locale = window.cgaStudioI18n?.getLocale?.() || "en";
  const moduleAvailable = window.cgaStudioI18n?.resolveMessage?.(locale, "detail.available", "On") || "On";
  const moduleRequired = window.cgaStudioI18n?.resolveMessage?.(locale, "openCore.required", "Module required") || "Module required";
  container.innerHTML = DEFAULT_COMMERCIAL_FEATURE_CHECKS.map((featureId) => {
    const availability = getFeatureAvailability(registry, featureId);
    return `
      <div class="feature-row ${availability.available ? "available" : "missing"}">
        <strong>${featureId}</strong>
        <span>${availability.available ? moduleAvailable : moduleRequired}</span>
      </div>
    `;
  }).join("");
}

function renderCollaborationSummary() {
  const container = document.querySelector("[data-collab-summary]");
  if (!container) return;
  const summary = summarizeCollaboration(currentCollaborationState);
  container.innerHTML = `
    <div class="state-metric ok"><strong data-i18n="collab.mode">Default mode</strong><span>${summary.mode}</span></div>
    <div class="state-metric ok"><strong data-i18n="collab.targetDays">Build target</strong><span>${summary.targetDays}</span></div>
    <div class="state-metric"><strong data-i18n="collab.totalWork">Work items</strong><span>${summary.total}</span></div>
    <div class="state-metric"><strong data-i18n="collab.reviewQueue">Review queue</strong><span>${summary.review}</span></div>
    <div class="state-metric ${summary.blocked ? "blocked" : "ok"}"><strong data-i18n="collab.blockedItems">Blocked items</strong><span>${summary.blocked}</span></div>
    <div class="state-metric ok"><strong data-i18n="collab.teamReady">Team-ready</strong><span>${summary.collaborationAvailable ? t("team.available", "Available") : t("common.disabled", "Disabled")}</span></div>
  `;
}

function renderTeamDashboard() {
  const section = document.querySelector('[data-screen-id="team-dashboard"]');
  if (!section) return;
  const dashboard = summarizeTeamDashboard(currentCollaborationState, { currentUserId: currentAccessState.currentUserId });
  const fallbackGroupLabel = getCurrentWorkspaceGroup()?.name || currentWorkspaceGroupId || t("team.unassigned", "미지정");
  const fallbackBotLabel = getCurrentWorkspaceBot()?.name || currentWorkspaceBotId || t("team.unassigned", "미지정");
  const getWorkGroupLabel = (item) => item.group_name || item.group_id || fallbackGroupLabel;
  const getWorkBotLabel = (item) => item.bot_name || item.bot_id || fallbackBotLabel;
  const getWorkStatusLabel = (status) => ({
    todo: "할 일",
    in_progress: "진행 중",
    review: "검토 대기",
    approved: "승인 완료",
    blocked: "차단"
  }[status] || status || "-");
  const getRoleLabel = (role) => ({
    system_admin: "시스템 관리자",
    group_admin: "그룹 관리자",
    builder: "빌더",
    reviewer: "검토자",
    operator: "운영자",
    viewer: "조회자"
  }[role] || role || t("team.unassigned", "미지정"));
  const usersByRole = (currentAccessState?.users || []).reduce((acc, user) => {
    const role = user.role || "viewer";
    const userId = user.id;
    if (!userId) return acc;
    acc[role] = acc[role] || [];
    acc[role].push(userId);
    return acc;
  }, {});
  const tasksByRole = Object.entries(usersByRole).reduce((acc, [role, userIds]) => {
    acc[role] = dashboard.workItems.filter((item) => userIds.includes(item.assignee_id)).length;
    return acc;
  }, {});
  const totalWork = dashboard.byStatus.reduce((sum, entry) => sum + Number(entry.count || 0), 0);
  const lockedItems = dashboard.workItems.filter((item) => item.lock?.user_id);
  const reviewCount = dashboard.reviewQueue.length;
  const recentUpdates = dashboard.workItems
    .slice()
    .sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")))
    .slice(0, 5);
  const bottleneckItems = dashboard.workItems
    .filter((item) => item.status === "blocked" || item.status === "review" || item.lock?.user_id)
    .slice(0, 5);
  const assigneeLoad = dashboard.workItems.reduce((acc, item) => {
    const key = item.assignee?.name || item.assignee_id || t("team.unassigned", "미지정");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const tasksByGroup = dashboard.workItems.reduce((acc, item) => {
    const key = getWorkGroupLabel(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const tasksByBot = dashboard.workItems.reduce((acc, item) => {
    const key = getWorkBotLabel(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const renderItems = (items, emptyText, mode) => items.map((item) => {
    const lockOwnerId = item.lock?.user_id || "";
    const isMine = item.assignee_id === currentAccessState.currentUserId;
    const canUnlock = lockOwnerId === currentAccessState.currentUserId;
    return `
    <div class="team-task-row ${item.status}">
      <strong>${item.title}</strong>
      <span>${item.type} · ${getWorkStatusLabel(item.status)} · ${getWorkGroupLabel(item)} / ${getWorkBotLabel(item)}</span>
      <span>담당자: ${item.assignee?.name || item.assignee_id || t("team.unassigned", "미지정")}</span>
      <span>잠금: ${lockOwnerId || t("team.unassigned", "없음")}</span>
      <span>최근수정: ${formatAidotAdminDate(item.updated_at)}</span>
      <div class="team-task-actions">
        ${mode === "mine" && !lockOwnerId && isMine ? `<button type="button" data-lock-work="${item.id}">${t("team.lock", "Lock")}</button>` : ""}
        ${mode === "mine" && canUnlock ? `<button type="button" data-unlock-work="${item.id}">${t("team.unlock", "Unlock")}</button>` : ""}
        ${mode === "review" ? `<button type="button" data-approve-work="${item.id}">${t("admin.approve", "Approve")}</button><button type="button" data-request-change="${item.id}">${t("team.requestChanges", "Request changes")}</button>` : ""}
        ${mode === "blocked" ? `<button type="button" data-request-change="${item.id}">${t("team.moveToTodo", "Move to todo")}</button>` : ""}
      </div>
    </div>
  `;
  }).join("") || `<div class="team-task-empty"><strong>${escapeText(emptyText)}</strong><span>${t("team.currentUser", "Current user")}: ${dashboard.currentUser?.name || currentAccessState.currentUserId}</span></div>`;
  renderWorkflowScreenShell(
    "team-dashboard",
    "TM",
    "팀 대시보드",
    "봇 제작 협업 현황을 그룹/봇 단위 진행률과 승인 흐름 기준으로 정리합니다.",
    `<div class="cga-command-page team-command-page">
      <section class="command-summary">
        <article><strong>내 작업</strong><span>${dashboard.myTasks.length}건</span></article>
        <article><strong>검토 대기</strong><span>${dashboard.reviewQueue.length}건</span></article>
        <article><strong>승인 필요</strong><span>${reviewCount}건</span></article>
        <article><strong>잠금 상태</strong><span>${lockedItems.length}건</span></article>
        <article><strong>전체 작업</strong><span>${totalWork}건</span></article>
      </section>
      <section class="team-command-grid team-command-grid--lists">
        <article class="command-panel">
          <header><div><strong>내 작업</strong><span>담당자를 기준으로 현재 나에게 배정된 항목입니다.</span></div></header>
          <div class="team-task-list">${renderItems(dashboard.myTasks, t("team.noAssignedTask", "No assigned task"), "mine")}</div>
        </article>
        <article class="command-panel">
          <header><div><strong>검토 대기</strong><span>승인 검토가 필요한 항목입니다.</span></div></header>
          <div class="team-task-list">${renderItems(dashboard.reviewQueue, t("team.noReviewWaiting", "No review waiting"), "review")}</div>
        </article>
        <article class="command-panel">
          <header><div><strong>차단 항목</strong><span>작업 진행이 멈춘 항목입니다.</span></div></header>
          <div class="team-task-list">${renderItems(dashboard.blockedItems, t("team.noBlockedItem", "No blocked item"), "blocked")}</div>
        </article>
      </section>
      <section class="team-command-grid team-command-grid--metrics">
        <article class="command-panel command-panel--wide">
          <header><div><strong>그룹별 진행률</strong><span>그룹 기준 진행 건수</span></div></header>
          <div class="team-status-strip">
            ${Object.entries(tasksByGroup).map(([group, count]) => `
              <div class="team-status-card">
                <strong>${escapeText(group)}</strong>
                <span>${count}건</span>
              </div>
            `).join("")}
          </div>
        </article>
        <article class="command-panel command-panel--wide">
          <header><div><strong>봇별 진행률</strong><span>봇 단위 진행 건수</span></div></header>
          <div class="team-status-strip">
            ${Object.entries(tasksByBot).map(([bot, count]) => `
              <div class="team-status-card">
                <strong>${escapeText(bot)}</strong>
                <span>${count}건</span>
              </div>
            `).join("")}
          </div>
        </article>
      </section>
      <section class="command-panel command-panel--status">
        <header><div><strong>권한별 할 일</strong><span>역할 기준 누적 항목 수입니다.</span></div></header>
        <div class="team-status-strip">
          ${Object.entries(tasksByRole).map(([role, count]) => `
            <div class="team-status-card">
              <strong>${escapeText(getRoleLabel(role))}</strong>
              <span>${count}건</span>
            </div>
          `).join("") || `<div class="team-status-card"><strong>${t("team.unassigned", "미지정")}</strong><span>0건</span></div>`}
        </div>
      </section>
      <section class="command-panel command-panel--status">
        <header><div><strong>작업 상태</strong><span>전체 작업 흐름 상태입니다.</span></div></header>
        <div class="team-status-strip">
          ${dashboard.byStatus.map((entry) => `
            <div class="team-status-card ${entry.status}">
              <strong>${escapeText(getWorkStatusLabel(entry.status))}</strong>
              <span>${entry.count}</span>
            </div>
          `).join("")}
        </div>
      </section>
      <section class="team-command-grid team-command-grid--metrics team-command-grid--insights">
        <article class="command-panel">
          <header><div><strong>최근 수정 이력</strong><span>최근 수정 순서로 작업 항목을 확인합니다.</span></div></header>
          <div class="team-task-list">
            ${recentUpdates.map((item) => `
              <div class="team-task-row">
                <strong>${item.title}</strong>
                <span>${getWorkGroupLabel(item)} / ${getWorkBotLabel(item)}</span>
                <span>담당자: ${item.assignee?.name || item.assignee_id || t("team.unassigned", "미지정")}</span>
                <span>최근수정: ${formatAidotAdminDate(item.updated_at)}</span>
              </div>
            `).join("") || `<div class="team-task-empty"><strong>최근 수정 이력이 없습니다.</strong></div>`}
          </div>
        </article>
        <article class="command-panel">
          <header><div><strong>병목 항목</strong><span>잠금, 검토 지연, 차단 항목을 우선 모읍니다.</span></div></header>
          <div class="team-task-list">
            ${bottleneckItems.map((item) => `
              <div class="team-task-row ${item.status}">
                <strong>${item.title}</strong>
                <span>${getWorkStatusLabel(item.status)} · ${getWorkGroupLabel(item)} / ${getWorkBotLabel(item)}</span>
                <span>잠금: ${item.lock?.user_id || t("team.unassigned", "없음")}</span>
                <span>담당자: ${item.assignee?.name || item.assignee_id || t("team.unassigned", "미지정")}</span>
              </div>
            `).join("") || `<div class="team-task-empty"><strong>현재 병목 항목이 없습니다.</strong></div>`}
          </div>
        </article>
      </section>
      <section class="command-panel command-panel--status">
        <header><div><strong>담당자별 작업량</strong><span>현재 협업 배분 상태입니다.</span></div></header>
        <div class="team-status-strip">
          ${Object.entries(assigneeLoad).map(([assignee, count]) => `
            <div class="team-status-card">
              <strong>${escapeText(assignee)}</strong>
              <span>${count}건</span>
            </div>
          `).join("") || `<div class="team-status-card"><strong>${t("team.unassigned", "미지정")}</strong><span>0건</span></div>`}
        </div>
      </section>
    </div>`
  );
  bindTeamDashboardActions();
}

async function syncTeamDashboardAfterAction() {
  if (currentWorkspaceGroupId && currentWorkspaceBotId) {
    await refreshCollaborationStateFromServer(currentWorkspaceGroupId, currentWorkspaceBotId);
  }
  renderTeamDashboard();
  renderCollaborationSummary();
  refreshWorkspaceManagementSurfaces();
}
function bindTeamDashboardActions() {
  document.querySelectorAll("[data-lock-work]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const synced = await runCollaborationAction(button.dataset.lockWork, "lock").catch(() => false);
      if (synced === false) currentCollaborationState = lockWorkItem(currentCollaborationState, { workItemId: button.dataset.lockWork, userId: currentAccessState.currentUserId });
      await syncTeamDashboardAfterAction();
    });
  });
  document.querySelectorAll("[data-unlock-work]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const synced = await runCollaborationAction(button.dataset.unlockWork, "unlock").catch(() => false);
      if (synced === false) currentCollaborationState = releaseWorkItemLock(currentCollaborationState, { workItemId: button.dataset.unlockWork, userId: currentAccessState.currentUserId });
      await syncTeamDashboardAfterAction();
    });
  });
  document.querySelectorAll("[data-approve-work]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const synced = await runCollaborationAction(button.dataset.approveWork, "approve").catch(() => false);
      if (synced === false) currentCollaborationState = submitReviewDecision(currentCollaborationState, { workItemId: button.dataset.approveWork, reviewerId: currentAccessState.currentUserId, decision: "approve" });
      await syncTeamDashboardAfterAction();
    });
  });
  document.querySelectorAll("[data-request-change]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const synced = await runCollaborationAction(button.dataset.requestChange, "request-changes").catch(() => false);
      if (synced === false) currentCollaborationState = submitReviewDecision(currentCollaborationState, { workItemId: button.dataset.requestChange, reviewerId: currentAccessState.currentUserId, decision: "request_changes" });
      await syncTeamDashboardAfterAction();
    });
  });
}

function bindAssetTransferActions() {
  document.querySelectorAll("[data-asset-download]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const bot = getCurrentWorkspaceBot();
      const botName = getSafeFileName(currentStudioState.bot.name || bot?.name, "CGA_Bot");
      const serverFileName = await downloadAssetFromServer(button.dataset.assetDownload);
      if (serverFileName) {
        currentTransferStatus = formatTransferDownloaded(button.dataset.assetDownload, serverFileName, "server");
        renderWorkspaceHome();
        document.dispatchEvent(new CustomEvent("cga:content-rendered"));
        return;
      }
      if (button.dataset.assetDownload === "dictionary") {
        const fileName = `Dictionary_${botName}_${getTodayStamp()}.txt`;
        downloadTextFile(fileName, buildDictionaryTxt(currentDictionaryAssets));
        currentTransferStatus = formatTransferDownloaded("dictionary", fileName);
      }
      if (button.dataset.assetDownload === "intentUtterance") {
        const fileName = `IntentUtterance_${botName}_${getTodayStamp()}.txt`;
        downloadTextFile(fileName, buildIntentUtteranceTxt(currentIntentUtteranceAssets));
        currentTransferStatus = formatTransferDownloaded("intentUtterance", fileName);
      }
      if (button.dataset.assetDownload === "entity") {
        const fileName = `Entity_${botName}_${getTodayStamp()}.txt`;
        downloadTextFile(fileName, buildEntityTxt(currentEntityAssets));
        currentTransferStatus = formatTransferDownloaded("entity", fileName);
      }
      if (button.dataset.assetDownload === "rule") {
        const fileName = `Rule_${botName}_${getTodayStamp()}.txt`;
        downloadTextFile(fileName, buildRuleTxt(currentRuleAssets));
        currentTransferStatus = formatTransferDownloaded("rule", fileName);
      }
      if (button.dataset.assetDownload === "intentDialog") {
        const fileName = `Dialog_${botName}_${getTodayStamp()}.json`;
        downloadJsonFile(fileName, buildAidotDialogPackage("intent"));
        currentTransferStatus = formatTransferDownloaded("intentDialog", fileName);
      }
      if (button.dataset.assetDownload === "scenario") {
        const fileName = `Scenario_${botName}_${getTodayStamp()}.json`;
        downloadJsonFile(fileName, buildAidotDialogPackage("scenario"));
        currentTransferStatus = formatTransferDownloaded("scenario", fileName);
      }
      if (button.dataset.assetDownload === "apiMapping") {
        const fileName = `API_${botName}_${getTodayStamp()}.json`;
        downloadJsonFile(fileName, buildApiMappingPackage());
        currentTransferStatus = formatTransferDownloaded("apiMapping", fileName);
      }
      renderWorkspaceHome();
      document.dispatchEvent(new CustomEvent("cga:content-rendered"));
    });
  });
  document.querySelectorAll("[data-asset-upload]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      if (button.dataset.assetUpload === "dictionary") {
        requestTextUpload(async (text, file) => {
          const incoming = parseDictionaryTxt(text);
          currentDictionaryAssets = mergeDictionaryAssets(currentDictionaryAssets, incoming);
          const synced = await uploadAssetToServer("dictionary", text, file?.name);
          if (synced) await saveDetailAssetsToServer().catch(() => false);
          currentTransferStatus = formatTransferUploaded("dictionary", incoming.length, synced);
        });
      }
      if (button.dataset.assetUpload === "intentUtterance") {
        requestTextUpload(async (text, file) => {
          const incoming = parseIntentUtteranceTxt(text);
          currentIntentUtteranceAssets = mergeIntentUtteranceAssets(currentIntentUtteranceAssets, incoming);
          const synced = await uploadAssetToServer("intentUtterance", text, file?.name);
          if (synced) await saveDetailAssetsToServer().catch(() => false);
          currentTransferStatus = formatTransferUploaded("intentUtterance", incoming.length, synced);
        });
      }
      if (button.dataset.assetUpload === "entity") {
        requestTextUpload(async (text, file) => {
          const incoming = parseEntityTxt(text);
          currentEntityAssets = mergeEntityAssets(currentEntityAssets, incoming);
          const synced = await uploadAssetToServer("entity", text, file?.name);
          if (synced) await saveDetailAssetsToServer().catch(() => false);
          currentTransferStatus = formatTransferUploaded("entity", incoming.length, synced);
        });
      }
      if (button.dataset.assetUpload === "rule") {
        requestTextUpload(async (text, file) => {
          const incoming = parseRuleTxt(text);
          currentRuleAssets = mergeRuleAssets(currentRuleAssets, incoming);
          const synced = await uploadAssetToServer("rule", text, file?.name);
          if (synced) await saveDetailAssetsToServer().catch(() => false);
          currentTransferStatus = formatTransferUploaded("rule", incoming.length, synced);
        });
      }
      if (button.dataset.assetUpload === "intentDialog" || button.dataset.assetUpload === "scenario") {
        requestJsonUpload(async (json, file) => {
          applyAidotDialogPackage(json);
          const synced = await uploadAssetToServer(button.dataset.assetUpload, JSON.stringify(json, null, 2), file?.name);
          if (synced) await saveDetailAssetsToServer().catch(() => false);
          currentTransferStatus = appendTransferSyncStatus(synced);
        });
      }
      if (button.dataset.assetUpload === "apiMapping") {
        requestJsonUpload(async (json, file) => {
          applyApiMappingPackage(json);
          const synced = await uploadAssetToServer("apiMapping", JSON.stringify(json, null, 2), file?.name);
          currentTransferStatus = appendTransferSyncStatus(synced);
          renderApiRegistry();
        });
      }
    });
  });
}

function bindOperationsActions() {
  const runBuild = document.querySelector("[data-build-run]");
  const refreshBuild = document.querySelector("[data-build-refresh]");
  const testInput = document.querySelector("[data-test-input]");
  const testSend = document.querySelector("[data-test-send]");
  const analysisToggle = document.querySelector("[data-test-analysis-toggle]");
  const deploy = document.querySelector("[data-deploy-action]");
  const topSave = document.querySelector("[data-top-save]");
  const runTest = async () => {
    const message = testInput?.value?.trim();
    if (!message) return;
    await runOperationsAction("run-test", { message }).catch(() => false);
    if (testInput) testInput.value = "";
    renderAllStatePanels();
  };

  if (runBuild && runBuild.dataset.bound !== "true") {
    runBuild.dataset.bound = "true";
    runBuild.addEventListener("click", async () => {
      await runOperationsAction("run-build", {
        intent_count: currentStudioState.counts.intents || currentIntentUtteranceAssets.length || currentOperationsState.build.intent_count
      }).catch(() => false);
      renderAllStatePanels();
    });
  }

  if (refreshBuild && refreshBuild.dataset.bound !== "true") {
    refreshBuild.dataset.bound = "true";
    refreshBuild.addEventListener("click", async () => {
      await refreshOperationsStateFromServer(currentWorkspaceGroupId, currentWorkspaceBotId).catch(() => false);
      renderAllStatePanels();
    });
  }

  if (testInput && testInput.dataset.bound !== "true") {
    testInput.dataset.bound = "true";
    testInput.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      await runTest();
    });
  }

  if (testSend && testSend.dataset.bound !== "true") {
    testSend.dataset.bound = "true";
    testSend.addEventListener("click", async () => {
      await runTest();
    });
  }

  if (analysisToggle && analysisToggle.dataset.bound !== "true") {
    analysisToggle.dataset.bound = "true";
    analysisToggle.addEventListener("click", () => {
      document.querySelector(".aidot-simulator-analysis")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  if (deploy && deploy.dataset.bound !== "true") {
    deploy.dataset.bound = "true";
    deploy.addEventListener("click", async () => {
      await runOperationsAction("deploy").catch(() => false);
      renderAllStatePanels();
    });
  }

  if (topSave && topSave.dataset.bound !== "true") {
    topSave.dataset.bound = "true";
    topSave.addEventListener("click", async () => {
      await runQueuedSave("top-save", saveCurrentWorkspaceState);
    });
  }
}

function renderTopContext() {
  syncWorkspaceSelection();
  const current = summarizeAccess(currentAccessState);
  const group = getCurrentWorkspaceGroup();
  const bot = getCurrentWorkspaceBot();
  const currentUserBadge = document.querySelector("[data-current-user-badge]");
  const currentGroupBadge = document.querySelector("[data-current-group-badge]");
  const currentBotBadge = document.querySelector("[data-current-bot-badge]");
  const currentVersionBadge = document.querySelector("[data-current-version-badge]");
  const topAuthStatus = document.querySelector("[data-top-auth-status]");
  if (currentUserBadge) {
    const roles = current.memberships.map((item) => item.role).join(", ") || t("common.noRole", "no role");
    currentUserBadge.classList.add("login-state");
    currentUserBadge.textContent = `${t("admin.authentication", "Authentication")}: ${current.user?.name || t("common.user", "User")} · ${roles}`;
  }
  if (topAuthStatus) {
    topAuthStatus.classList.toggle("error", currentAuthMessage?.kind === "error");
    if (currentAuthMessage) {
      const body = currentAuthMessage.bodyKeyOrText || "";
      topAuthStatus.textContent = `${t(currentAuthMessage.titleKey, t("admin.authentication", "Authentication"))}: ${body.includes(".") ? t(body, body) : body}`;
    } else {
      topAuthStatus.textContent = `${current.user?.id || ""}`;
    }
  }
  if (currentGroupBadge) currentGroupBadge.textContent = `${t("top.groupPrefix", "Group")}: ${group?.name || t("common.none", "None")}`;
  if (currentBotBadge) currentBotBadge.textContent = `${t("top.botPrefix", "Bot")}: ${currentStudioState.bot.name || bot?.name || t("common.none", "None")}`;
  if (currentVersionBadge) currentVersionBadge.textContent = `${t("top.versionPrefix", "Version")}: ${currentStudioState.bot.version || "v0.1"}`;
}

function bindWorkspaceActions() {
  const groupSelect = document.querySelector("[data-workspace-group]");
  const createButton = document.querySelector("[data-workspace-create]");
  const createVersionAdd = document.querySelector("[data-create-version-add]");
  const createBotCopy = document.querySelector("[data-create-bot-copy]");
  const createVersionManage = document.querySelector("[data-create-version-manage]");
  const createVersionUpload = document.querySelector("[data-create-version-upload]");
  const downloadBot = document.querySelector("[data-download-bot-package]");
  const uploadBot = document.querySelector("[data-upload-bot-package]");
  const downloadVersion = document.querySelector("[data-download-version-package]");
  const uploadVersion = document.querySelector("[data-upload-version-package]");
  const botVersionAdd = document.querySelector("[data-bot-version-add]");
  const botVersionUpload = document.querySelector("[data-version-upload]");
  const botVersionDownload = document.querySelector("[data-version-download]");
  const deleteBot = document.querySelector("[data-delete-workspace-bot]");
  const deleteVersionButtons = document.querySelectorAll("[data-bot-version-delete]");
  const copyVersionButtons = document.querySelectorAll("[data-bot-version-copy]");
  const activateVersionButtons = document.querySelectorAll("[data-bot-version-activate]");
  if (groupSelect && groupSelect.dataset.bound !== "true") {
    groupSelect.dataset.bound = "true";
    groupSelect.addEventListener("change", async () => {
      currentWorkspaceGroupId = groupSelect.value;
      try {
        await refreshWorkspaceDataFromServer({ includeBots: true });
      } catch {
        const bot = currentWorkspaceBots.find((item) => item.group_id === currentWorkspaceGroupId) || null;
        if (bot) applyCurrentBotToStudioState(bot);
      }
      renderWorkspaceHome();
      renderAllStatePanels();
      rerenderAdminAndAccess();
    });
  }
  if (createButton && createButton.dataset.bound !== "true") {
    createButton.dataset.bound = "true";
    createButton.addEventListener("click", async () => {
      if (!canCreateBotInCurrentWorkspace()) return;
      const nextNumber = currentWorkspaceBots.length + 1;
      const id = `bot-${Date.now()}`;
      const bot = {
        id,
        group_id: currentWorkspaceGroupId,
        name: `New Bot ${nextNumber}`,
        status: "draft",
        locale: currentStudioState.bot.defaultLocale,
        version: "v0.1",
        updated_at: "2026-06-04"
      };
      try {
        const created = await createWorkspaceBotOnServer(bot);
        currentWorkspaceBots = [...currentWorkspaceBots.filter((item) => item.id !== created.bot?.id), created.bot || bot];
        applyCurrentBotToStudioState(created.bot || bot);
        await saveStudioStateToServer();
        await saveCompositionToServer();
        await saveDetailAssetsToServer();
        await refreshOperationsStateFromServer(currentWorkspaceGroupId, currentWorkspaceBotId).catch(() => false);
        await refreshCollaborationStateFromServer(currentWorkspaceGroupId, currentWorkspaceBotId).catch(() => false);
      } catch (error) {
        if (error.status) {
          showApiErrorMessage(error, "message.actionForbiddenTitle");
        } else {
        currentWorkspaceBots = [...currentWorkspaceBots, bot];
        applyCurrentBotToStudioState(bot);
        }
      }
      renderWorkspaceHome();
      renderAllStatePanels();
      document.dispatchEvent(new CustomEvent("cga:content-rendered"));
    });
  }
  if (createVersionAdd && createVersionAdd.dataset.bound !== "true") {
    createVersionAdd.dataset.bound = "true";
    createVersionAdd.addEventListener("click", () => {
      const versionInput = document.querySelector('[data-structural-field="bot.version"]');
      const current = String(versionInput?.value || currentStudioState.bot.version || "v0.1");
      const match = current.match(/^v?(\d+)(?:\.(\d+))?$/i);
      const next = match ? `v${match[1]}.${Number(match[2] || 0) + 1}` : `${current}-copy`;
      if (versionInput) {
        versionInput.value = next;
        versionInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      currentStudioState.bot.version = next;
      renderTopContext();
      renderCreateSummary();
    });
  }
  if (createBotCopy && createBotCopy.dataset.bound !== "true") {
    createBotCopy.dataset.bound = "true";
    createBotCopy.addEventListener("click", async () => {
      const sourceBot = getCurrentWorkspaceBot();
      if (!sourceBot) return;
      const nextBotId = `${sourceBot.id}-copy-${Date.now()}`;
      const nextBotName = `${sourceBot.name || "Bot"} Copy`;
      const duplicateBot = {
        ...sourceBot,
        id: nextBotId,
        name: nextBotName,
        status: "draft",
        updated_at: new Date().toISOString().slice(0, 10)
      };
      try {
        const created = await copyWorkspaceBotOnServer(sourceBot, nextBotId, nextBotName);
        const copied = created?.bot || duplicateBot;
        currentWorkspaceBots = [...currentWorkspaceBots.filter((item) => item.id !== copied.id), copied];
        applyCurrentBotToStudioState(copied);
        selectedBotManagementId = copied.id;
        ensureBotVersionRegistryFor(copied);
        currentTransferStatus = "봇 복사가 완료되었습니다.";
      } catch (error) {
        currentWorkspaceBots = [...currentWorkspaceBots.filter((item) => item.id !== duplicateBot.id), duplicateBot];
        applyCurrentBotToStudioState(duplicateBot);
        selectedBotManagementId = duplicateBot.id;
        currentTransferStatus = error?.status ? "봇 복사 API 실패: 로컬 임시 반영" : "봇 복사 실패";
      }
      renderBotManagement();
      renderWorkspaceHome();
      renderAllStatePanels();
    });
  }
  if (createVersionManage && createVersionManage.dataset.bound !== "true") {
    createVersionManage.dataset.bound = "true";
    createVersionManage.addEventListener("click", () => setActiveScreen("bot-management"));
  }
  if (createVersionUpload && createVersionUpload.dataset.bound !== "true") {
    createVersionUpload.dataset.bound = "true";
    createVersionUpload.addEventListener("click", () => {
      setActiveScreen("bot-management");
      window.setTimeout(() => document.querySelector("[data-upload-version-package]")?.click(), 0);
    });
  }
  if (botVersionAdd && botVersionAdd.dataset.bound !== "true") {
    botVersionAdd.dataset.bound = "true";
    botVersionAdd.addEventListener("click", async () => {
      const selectedBot = getCurrentWorkspaceBot();
      if (!selectedBot || !canManageBotInCurrentWorkspace()) return;
      const added = addWorkspaceBotVersion(selectedBot);
      if (!added) return;
      selectedBot.version = added.id;
      currentStudioState.bot.version = added.id;
      currentTransferStatus = `버전 ${added.id}가 추가되었습니다.`;
      const synced = await updateWorkspaceBotVersionOnServer(selectedBot, added.id).catch(() => false);
      if (synced) {
        await saveStudioStateToServer().catch(() => false);
        await saveCompositionToServer().catch(() => false);
      }
      currentTransferStatus = appendTransferSyncStatus(synced);
      refreshWorkspaceManagementSurfaces();
    });
  }
  if (botVersionDownload && botVersionDownload.dataset.bound !== "true") {
    botVersionDownload.dataset.bound = "true";
    botVersionDownload.addEventListener("click", async () => {
      const bot = getCurrentWorkspaceBot();
      const version = bot?.version || "v0.1";
      const serverFileName = await downloadAssetFromServer("versionPackage");
      const fileName = `Version_${getSafeFileName(currentStudioState.bot.name || bot?.name, "CGA_Bot")}_${getSafeFileName(version, "v0_1")}_${getTodayStamp()}.json`;
      if (serverFileName) {
        currentTransferStatus = formatTransferDownloaded("versionPackage", serverFileName, "server");
        refreshWorkspaceManagementSurfaces();
        return;
      }
      downloadJsonFile(fileName, buildCgaVersionPackage());
      currentTransferStatus = formatTransferDownloaded("versionPackage", fileName);
      refreshWorkspaceManagementSurfaces();
    });
  }
  if (botVersionUpload && botVersionUpload.dataset.bound !== "true") {
    botVersionUpload.dataset.bound = "true";
    botVersionUpload.addEventListener("click", () => {
      requestJsonUpload(async (json, file) => {
        applyCgaVersionPackage(json);
        const synced = await uploadAssetToServer("versionPackage", JSON.stringify(json, null, 2), file?.name);
        if (synced) {
          await saveStudioStateToServer().catch(() => false);
          await saveDetailAssetsToServer().catch(() => false);
          const activeBot = getCurrentWorkspaceBot();
          if (activeBot?.id) {
            await updateWorkspaceBotVersionOnServer(activeBot, activeBot.version || currentStudioState.bot.version).catch(() => false);
          }
        }
        currentTransferStatus = appendTransferSyncStatus(synced);
        refreshWorkspaceManagementSurfaces();
      });
    });
  }
  if (deleteBot && deleteBot.dataset.bound !== "true") {
    deleteBot.dataset.bound = "true";
    deleteBot.addEventListener("click", async () => {
      const selectedBot = getCurrentWorkspaceBot();
      if (!selectedBot || !canManageBotInCurrentWorkspace()) return;
      if (!confirm(`"${selectedBot.name}"을(를) 삭제하시겠습니까?`)) return;
      const deleted = await deleteWorkspaceBotOnServer(selectedBot.group_id, selectedBot.id).catch(() => ({ ok: false, status: "fallback" }));
      if (!deleted || deleted?.ok === false) {
        removeWorkspaceBotVersionRegistry(selectedBot);
        currentWorkspaceBots = currentWorkspaceBots.filter((bot) => bot.id !== selectedBot.id);
      }
      const nextBot = currentWorkspaceBots.find((bot) => String(bot.group_id || bot.groupId || "") === String(currentWorkspaceGroupId) && bot.status !== "deleted");
      if (nextBot) {
        selectedBotManagementId = nextBot.id;
        applyCurrentBotToStudioState(nextBot);
      } else {
        selectedBotManagementId = "";
        currentWorkspaceBotId = "";
      }
      currentTransferStatus = "봇 삭제가 반영되었습니다.";
      refreshWorkspaceManagementSurfaces();
    });
  }
  copyVersionButtons.forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const selectedBot = getCurrentWorkspaceBot();
      const versionId = button.dataset.botVersionCopy;
      if (!selectedBot || !versionId || !canManageBotInCurrentWorkspace()) return;
      const copied = duplicateWorkspaceBotVersion(selectedBot, versionId);
      if (!copied) return;
      currentTransferStatus = `버전 ${copied.id} 복사본이 생성되었습니다.`;
      const synced = await updateWorkspaceBotVersionOnServer(selectedBot, copied.id).catch(() => false);
      currentTransferStatus = appendTransferSyncStatus(synced);
      refreshWorkspaceManagementSurfaces();
    });
  });
  deleteVersionButtons.forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const selectedBot = getCurrentWorkspaceBot();
      const versionId = button.dataset.botVersionDelete;
      if (!selectedBot || !versionId || !canManageBotInCurrentWorkspace()) return;
      if (!confirm(`버전 ${versionId}를 삭제하시겠습니까?`)) return;
      const next = removeWorkspaceBotVersion(selectedBot, versionId);
      if (!next.length) {
        removeWorkspaceBotVersionRegistry(selectedBot);
      }
      if (selectedBot.version === versionId && next[0]?.id) {
        selectedBot.version = next[0].id;
        currentStudioState.bot.version = next[0].id;
      }
      currentTransferStatus = appendTransferSyncStatus(await updateWorkspaceBotVersionOnServer(selectedBot, selectedBot.version).catch(() => false));
      refreshWorkspaceManagementSurfaces();
    });
  });
  activateVersionButtons.forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const selectedBot = getCurrentWorkspaceBot();
      const versionId = button.dataset.botVersionActivate;
      if (!selectedBot || !versionId || !canManageBotInCurrentWorkspace()) return;
      setActiveBotVersion(selectedBot, versionId);
      const synced = await updateWorkspaceBotVersionOnServer(selectedBot, versionId).catch(() => false);
      if (synced) {
        await saveStudioStateToServer().catch(() => false);
      }
      selectedBot.version = versionId;
      currentStudioState.bot.version = versionId;
      currentTransferStatus = appendTransferSyncStatus(synced);
      refreshWorkspaceManagementSurfaces();
    });
  });
  if (downloadBot && downloadBot.dataset.bound !== "true") {
    downloadBot.dataset.bound = "true";
    downloadBot.addEventListener("click", async () => {
      const bot = getCurrentWorkspaceBot();
      const serverFileName = await downloadAssetFromServer("botPackage");
      if (serverFileName) {
        currentTransferStatus = formatTransferDownloaded("botPackage", serverFileName, "server");
        refreshWorkspaceManagementSurfaces();
        return;
      }
      const fileName = `Bot_${getSafeFileName(currentStudioState.bot.name || bot?.name, "CGA_Bot")}_${getTodayStamp()}.json`;
      downloadJsonFile(fileName, buildAidotBotPackage());
      currentTransferStatus = formatTransferDownloaded("botPackage", fileName);
      refreshWorkspaceManagementSurfaces();
    });
  }
  if (uploadBot && uploadBot.dataset.bound !== "true") {
    uploadBot.dataset.bound = "true";
    uploadBot.addEventListener("click", () => {
      requestJsonUpload(async (json, file) => {
        applyAidotBotPackage(json);
        const synced = await uploadAssetToServer("botPackage", JSON.stringify(json, null, 2), file?.name);
        if (synced) {
          await saveStudioStateToServer().catch(() => false);
          await saveDetailAssetsToServer().catch(() => false);
        }
        currentTransferStatus = appendTransferSyncStatus(synced);
        refreshWorkspaceManagementSurfaces();
      });
    });
  }
  if (downloadVersion && downloadVersion.dataset.bound !== "true") {
    downloadVersion.dataset.bound = "true";
    downloadVersion.addEventListener("click", async () => {
      const bot = getCurrentWorkspaceBot();
      const version = currentStudioState.bot.version || bot?.version || "v0.1";
      const serverFileName = await downloadAssetFromServer("versionPackage");
      if (serverFileName) {
        currentTransferStatus = formatTransferDownloaded("versionPackage", serverFileName, "server");
        refreshWorkspaceManagementSurfaces();
        return;
      }
      const fileName = `Version_${getSafeFileName(currentStudioState.bot.name || bot?.name, "CGA_Bot")}_${getSafeFileName(version, "v0_1")}_${getTodayStamp()}.json`;
      downloadJsonFile(fileName, buildCgaVersionPackage());
      currentTransferStatus = formatTransferDownloaded("versionPackage", fileName);
      refreshWorkspaceManagementSurfaces();
    });
  }
  if (uploadVersion && uploadVersion.dataset.bound !== "true") {
    uploadVersion.dataset.bound = "true";
    uploadVersion.addEventListener("click", () => {
      requestJsonUpload(async (json, file) => {
        applyCgaVersionPackage(json);
        const synced = await uploadAssetToServer("versionPackage", JSON.stringify(json, null, 2), file?.name);
        if (synced) {
          await saveStudioStateToServer().catch(() => false);
          await saveDetailAssetsToServer().catch(() => false);
        }
        currentTransferStatus = appendTransferSyncStatus(synced);
        refreshWorkspaceManagementSurfaces();
      });
    });
  }
  document.querySelectorAll("[data-open-bot]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const bot = currentWorkspaceBots.find((item) => item.id === button.dataset.openBot);
      if (!bot) return;
      applyCurrentBotToStudioState(bot);
      if (applyCachedWorkspaceSnapshot()) {
        renderWorkspaceHome();
        renderAllStatePanels();
        document.dispatchEvent(new CustomEvent("cga:content-rendered"));
      }
      await refreshWorkspaceDataFromServer().catch(() => false);
      renderWorkspaceHome();
      renderAllStatePanels();
      document.dispatchEvent(new CustomEvent("cga:content-rendered"));
    });
  });
}

function renderAccessBadge(label, value) {
  return `<span class="access-badge"><b>${label}</b>${value}</span>`;
}

function renderStatusBadge(status) {
  const normalized = String(status || "pending");
  return `<span class="status-badge status-${normalized}">${t(`status.${normalized}`, normalized)}</span>`;
}

function formatMemberships(memberships) {
  return memberships.map((item) => `${item.group_id}/${item.role}`).join(", ") || t("common.none", "None");
}

function getAuthFlowLabel(stepId, fallback) {
  return t(`authFlow.${stepId}.label`, fallback);
}

function getAuthFlowDetail(step, state) {
  if (step.id === "signup") {
    return state.policy.signupCreatesOwnGroup
      ? t("authFlow.signup.detailWithGroup", "Creates user and viewer join request")
      : t("authFlow.signup.detailUserOnly", "Creates user and viewer join request");
  }
  if (step.id === "join-request") {
    const count = state.joinRequests.filter((request) => request.status === "pending").length;
    return t("authFlow.join-request.detail", "{count} pending group request(s)").replace("{count}", count);
  }
  return t(`authFlow.${step.id}.detail`, step.detail);
}

function getSystemAdminSubviewLabel(subview) {
  return systemAdminSections
    .flatMap((section) => section.links)
    .find((link) => link.subview === subview)?.label || t("access.title", "Users, Login, and Access");
}


const AIDOT_ADMIN_SURFACE_TITLES = {
  users: "사용자 관리",
  "login-history": "로그인 이력",
  groups: "그룹 관리",
  roles: "사용자 관리",
  dashboard: "운영 대시보드",
  "system-logs": "운영/시스템 로그 조회",
  "bot-status": "봇 현황 조회",
  "training-history": "학습 이력 조회",
  "conversation-history": "대화 이력 조회",
  "api-call-history": "API 호출 이력 조회",
  "queue-history": "Queue 이력 조회",
  "intent-feedback": "의도별 피드백 조회",
  "common-variables": "공통 변수 관리하기",
  "default-messages": "기본 메시지 관리",
  channels: "채널 관리",
  "botstation-links": "봇스테이션 연계 현황",
  templates: "템플릿 목록",
  license: "라이선스 조회"
};

function escapeCell(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function formatAidotAdminDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeCell(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}. ${m}. ${d}. ${hh}:${mm}:${ss}`;
}

function formatLoginHistoryDate(value) {
  return formatAidotAdminDate(value);
}

function formatAidotSignupStatus(record) {
  if (!record) return "-";
  if (record.rowStatus === "pending" || record.request?.status === "pending") return "가입 대기";
  if (record.rowStatus === "rejected" || record.request?.status === "rejected") return "승인 반려";
  return "계정 승인";
}

function formatAidotAccountStatus(status) {
  const labels = {
    active: "활성",
    inactive: "비활성",
    locked: "잠김",
    password_reset: "비밀번호 초기화",
    pending: "대기"
  };
  return labels[status] || status || "-";
}

function renderPager(total) {
  return `
    <div class="admin-page__pagination" aria-label="pagination">
      <button type="button" ${total ? "" : "disabled"}>◀</button>
      <button type="button" ${total ? "" : "disabled"}>‹</button>
      <strong class="is-active">1</strong>
      <button type="button" ${total ? "" : "disabled"}>›</button>
      <button type="button" ${total ? "" : "disabled"}>▶</button>
    </div>
  `;
}

function renderDataGrid(columns, rows, template) {
  return `
    <div class="admin-page__grid-scroll">
      <div class="data-grid data-grid--admin" style="--data-grid-template:${template}">
        <div class="data-grid__row data-grid__row--header">
          ${columns.map((column) => `<span class="data-grid__cell">${column} ↕</span>`).join("")}
        </div>
        ${rows.join("")}
      </div>
    </div>
  `;
}

function renderAidotInteractiveTable(surface, config) {
  const rows = Array.isArray(config.rows) ? config.rows : [];
  surface.innerHTML = `
    <section class="admin-page ${config.className || ""}" data-admin-resource="${config.resource || ""}">
      <h2>${config.title}</h2>
      <div class="admin-page__search-row ${config.searchClass || ""}">
        <label class="admin-page__search"><span>⌕</span><input data-admin-query-input value="" placeholder="${config.placeholder || "검색어를 입력하세요."}" /></label>
        ${config.filters || ""}
        <button type="button" class="admin-page__filter admin-page__filter--text">초기화</button>
        <div class="admin-page__search-actions">${config.topRight || `<button type="button" class="admin-page__primary">조회</button>`}</div>
      </div>
      <div class="admin-page__toolbar">
        <div class="admin-page__toolbar-left"><strong>전체 ${rows.length}건</strong><select><option>10개씩 보기</option><option>25개씩 보기</option><option>50개씩 보기</option><option>100개씩 보기</option></select>${config.download === false ? "" : `<button type="button" class="admin-page__ghost">다운로드</button>`}</div>
      </div>
      ${renderDataGrid(config.columns, rows, config.template)}
      ${renderPager(rows.length)}
    </section>
  `;
}

function renderTemplateListSurface(surface) {
  const resource = "templates";
  const rows = currentAdminResources.templates.map((template, index) => `
    <div class="data-grid__row" data-admin-row data-admin-resource="${resource}" data-admin-id="${escapeCell(template.id)}">
      <span class="data-grid__cell">${index + 1}</span>
      <span class="data-grid__cell">${escapeCell(template.channel_name || template.channel_code)}</span>
      <a class="data-grid__cell table-link" href="#">${escapeCell(template.name)}</a>
      <span class="data-grid__cell">${escapeCell(template.item_count)}</span>
      <span class="data-grid__cell">${escapeCell(template.item_types)}</span>
      <span class="data-grid__cell">${escapeCell(template.renderer_type)}</span>
      <span class="data-grid__cell">${escapeCell(template.status_label || (template.status === "N" ? "미사용" : "사용"))}</span>
      <span class="data-grid__cell">${formatAidotAdminDate(template.updated_at)}</span>
    </div>
  `);
  renderAidotInteractiveTable(surface, {
    resource,
    title: "템플릿 목록",
    placeholder: "템플릿 이름을 검색하세요.",
    searchClass: "admin-template-list__search-row",
    filters: `<input class="admin-page__filter" data-admin-channel-filter placeholder="채널" /><select class="admin-page__filter" data-admin-status-filter><option value="all">전체 사용여부</option><option value="Y">사용</option><option value="N">미사용</option></select>`,
    topRight: `<button type="button" class="admin-page__primary" data-admin-query="${resource}">조회</button><button type="button" class="admin-page__primary" data-admin-create="${resource}">+ 템플릿 등록</button>`,
    columns: ["순서", "채널", "템플릿 이름", "아이템 개수", "아이템 타입", "렌더러 타입", "사용여부", "최종수정일시"],
    template: "80px 150px 220px 120px 1fr 160px 120px 180px",
    rows
  });
}

function renderLoginHistorySurface(surface) {
  const rows = (currentAdminResources.login_history || currentAccessState.loginHistory || []).map((entry) => `
    <div class="data-grid__row">
      <span class="data-grid__cell">${escapeCell(entry.user_id)}</span>
      <span class="data-grid__cell">${escapeCell(entry.user_name)}</span>
      <span class="data-grid__cell">${escapeCell(entry.group_name)}</span>
      <span class="data-grid__cell">${escapeCell(entry.role)}</span>
      <span class="data-grid__cell">${escapeCell(entry.ip_address)}</span>
      <span class="data-grid__cell">${formatLoginHistoryDate(entry.login_at)}</span>
      <span class="data-grid__cell">${formatLoginHistoryDate(entry.logout_at)}</span>
    </div>
  `);
  renderAidotInteractiveTable(surface, {
    title: "로그인 이력",
    placeholder: "사용자 계정 또는 사용자 이름을 검색하세요.",
    searchClass: "admin-login-history__search-row",
    filters: `<span class="admin-page__date-label">시작일</span><input class="admin-page__filter" type="date" /><span class="admin-page__date-label">종료일</span><input class="admin-page__filter" type="date" />`,
    download: false,
    columns: ["사용자 계정", "사용자 이름", "그룹", "역할", "접속한 IP", "로그인 시간", "로그아웃 시간"],
    template: "200px 160px 180px 160px 190px 190px 190px",
    rows
  });
}

function renderCommonVariableSurface(surface) {
  const resource = "common-variables";
  const rows = currentAdminResources.common_variables.map((item) => `
    <div class="data-grid__row" data-admin-row data-admin-resource="${resource}" data-admin-id="${escapeCell(item.id)}"><a class="data-grid__cell table-link" href="#">${escapeCell(item.name)}</a><span class="data-grid__cell">${escapeCell(item.category)}</span><span class="data-grid__cell">${escapeCell(item.value)}</span><span class="data-grid__cell">${escapeCell(item.description)}</span><span class="data-grid__cell">${formatAidotAdminDate(item.updated_at)}</span><span class="data-grid__cell">${escapeCell(item.updated_by)}</span></div>
  `);
  renderAidotInteractiveTable(surface, { resource, title: "공통 변수 관리하기", placeholder: "변수명을 검색하세요.", topRight: `<button type="button" class="admin-page__primary" data-admin-query="${resource}">조회</button><button type="button" class="admin-page__primary" data-admin-create="${resource}">+ 변수 등록</button>`, columns: ["변수명", "구분", "변수값", "설명", "최종수정일시", "최종수정자"], template: "180px 120px 180px 1fr 180px 140px", rows });
}

function renderDefaultMessageSurface(surface) {
  const resource = "default-messages";
  const rows = currentAdminResources.default_messages.map((item) => `
    <div class="data-grid__row" data-admin-row data-admin-resource="${resource}" data-admin-id="${escapeCell(item.id)}"><span class="data-grid__cell">${escapeCell(item.category)}</span><a class="data-grid__cell table-link" href="#">${escapeCell(item.name)}</a><span class="data-grid__cell">${escapeCell(item.key)}</span><span class="data-grid__cell">${escapeCell(item.message)}</span><span class="data-grid__cell">${escapeCell(item.status_label)}</span><span class="data-grid__cell">${formatAidotAdminDate(item.updated_at)}</span></div>
  `);
  renderAidotInteractiveTable(surface, { resource, title: "기본 메시지 관리", placeholder: "메시지 이름을 검색하세요.", topRight: `<button type="button" class="admin-page__primary" data-admin-query="${resource}">조회</button><button type="button" class="admin-page__primary" data-admin-create="${resource}">+ 메시지 등록</button>`, columns: ["카테고리", "메시지 이름", "메시지 키", "메시지", "사용여부", "최종수정일시"], template: "140px 180px 190px 1fr 120px 180px", rows });
}

function renderChannelSurface(surface) {
  const resource = "channels";
  const rows = currentAdminResources.channels.map((item) => `
    <div class="data-grid__row" data-admin-row data-admin-resource="${resource}" data-admin-id="${escapeCell(item.id)}"><a class="data-grid__cell table-link" href="#">${escapeCell(item.channel_code)}</a><span class="data-grid__cell">${escapeCell(item.channel_name)}</span><span class="data-grid__cell">${escapeCell(item.provider)}</span><span class="data-grid__cell">${escapeCell(item.renderer_type)}</span><span class="data-grid__cell">${escapeCell(item.auth_type)}</span><span class="data-grid__cell">${escapeCell(item.status_label)}</span><span class="data-grid__cell">${formatAidotAdminDate(item.updated_at)}</span></div>
  `);
  renderAidotInteractiveTable(surface, { resource, title: "채널 관리", placeholder: "채널 이름을 검색하세요.", topRight: `<button type="button" class="admin-page__primary" data-admin-query="${resource}">조회</button><button type="button" class="admin-page__primary" data-admin-create="${resource}">+ 채널 등록</button>`, columns: ["채널 코드", "채널명", "제공자", "렌더러 타입", "인증 방식", "사용여부", "최종수정일시"], template: "150px 170px 160px 180px 130px 120px 180px", rows });
}

function renderLicenseSurface(surface) {
  const rows = currentAdminResources.licenses.map((item) => `
    <div class="data-grid__row"><span class="data-grid__cell">${escapeCell(item.category)}</span><span class="data-grid__cell">${escapeCell(item.total)}</span><span class="data-grid__cell">${escapeCell(item.used)}</span><span class="data-grid__cell">${escapeCell(item.remaining)}</span><span class="data-grid__cell">${escapeCell(item.expires_at)}</span></div>
  `);
  renderAidotInteractiveTable(surface, { title: "라이선스 조회", placeholder: "라이선스 이름을 검색하세요.", topRight: `<button type="button" class="admin-page__primary">라이선스 업로드</button>`, columns: ["구분", "전체 수", "사용중", "잔여", "만료일"], template: "220px 220px 220px 220px 220px", rows });
}

function renderSimpleHistorySurface(surface, key) {
  const title = AIDOT_ADMIN_SURFACE_TITLES[key] || "";
  const columns = key === "botstation-links" ? ["봇스테이션", "연계 상태", "최종수정일시"] : ["순서", "구분", "내용", "상태", "최종수정일시"];
  renderAidotInteractiveTable(surface, { title, placeholder: "검색어를 입력하세요.", download: false, columns, template: key === "botstation-links" ? "220px 180px 180px" : "80px 180px 1fr 120px 180px", rows: [] });
}
const ADMIN_RESOURCE_UI = {
  templates: {
    collectionKey: "templates",
    endpoint: "/api/cga/admin/templates",
    title: "템플릿",
    label: (item) => item?.name || "",
    fields: [
      ["name", "템플릿 이름", "text"],
      ["channel_name", "채널", "text"],
      ["item_count", "아이템 개수", "number"],
      ["item_types", "아이템 타입", "text"],
      ["renderer_type", "렌더러 타입", "text"],
      ["status", "사용여부", "status"]
    ]
  },
  "common-variables": {
    collectionKey: "common_variables",
    endpoint: "/api/cga/admin/common-variables",
    title: "공통 변수",
    label: (item) => item?.name || "",
    fields: [["name", "변수명", "text"], ["category", "구분", "text"], ["value", "변수값", "text"], ["description", "설명", "textarea"]]
  },
  "default-messages": {
    collectionKey: "default_messages",
    endpoint: "/api/cga/admin/default-messages",
    title: "기본 메시지",
    label: (item) => item?.name || "",
    fields: [["category", "카테고리", "text"], ["name", "메시지 이름", "text"], ["key", "메시지 키", "text"], ["message", "메시지", "textarea"], ["status", "사용여부", "status"]]
  },
  channels: {
    collectionKey: "channels",
    endpoint: "/api/cga/admin/channels",
    title: "채널",
    label: (item) => item?.channel_name || item?.channel_code || "",
    fields: [["channel_code", "채널 코드", "text"], ["channel_name", "채널명", "text"], ["provider", "제공자", "text"], ["renderer_type", "렌더러 타입", "text"], ["auth_type", "인증 방식", "text"], ["status", "사용여부", "status"]]
  },
  "botstation-links": {
    collectionKey: "botstation_links",
    endpoint: "/api/cga/admin/botstation-links",
    title: "봇스테이션 연계",
    label: (item) => item?.station_name || "",
    fields: [["station_name", "봇스테이션", "text"], ["endpoint_url", "연계 URL", "text"], ["status", "사용여부", "status"]]
  }
};

function getAdminResourceUi(resource) {
  return ADMIN_RESOURCE_UI[resource] || null;
}

function getAdminResourceItems(resource) {
  const config = getAdminResourceUi(resource);
  return config ? (currentAdminResources[config.collectionKey] || []) : [];
}

function getAdminResourceItem(resource, id) {
  return getAdminResourceItems(resource).find((item) => item.id === id) || null;
}

function renderAdminResourceField([name, label, type], value = "") {
  if (type === "status") {
    return `<label><span>${label}</span><select data-admin-field="${name}"><option value="Y" ${value !== "N" ? "selected" : ""}>사용</option><option value="N" ${value === "N" ? "selected" : ""}>미사용</option></select></label>`;
  }
  if (type === "textarea") {
    return `<label><span>${label}</span><textarea data-admin-field="${name}">${escapeCell(value)}</textarea></label>`;
  }
  return `<label><span>${label}</span><input type="${type || "text"}" data-admin-field="${name}" value="${escapeCell(value)}" /></label>`;
}

function collectAdminResourceForm() {
  const modal = document.querySelector("[data-admin-resource-modal]");
  const body = {};
  modal?.querySelectorAll("[data-admin-field]").forEach((field) => {
    body[field.dataset.adminField] = field.value;
  });
  if (body.status) body.status_label = body.status === "N" ? "미사용" : "사용";
  return body;
}

function closeAdminResourceModal() {
  currentAdminResourceModal = null;
  const modal = document.querySelector("[data-admin-resource-modal]");
  if (modal) modal.hidden = true;
}

function renderAdminResourceModal() {
  const modal = document.querySelector("[data-admin-resource-modal]");
  if (!modal || !currentAdminResourceModal) return;
  const { resource, id, mode } = currentAdminResourceModal;
  const config = getAdminResourceUi(resource);
  if (!config) return;
  const item = mode === "create" ? {} : getAdminResourceItem(resource, id);
  const title = modal.querySelector("[data-admin-resource-modal-title]");
  const detail = modal.querySelector("[data-admin-resource-detail]");
  const edit = modal.querySelector("[data-admin-resource-edit]");
  if (title) title.textContent = `${config.title} ${mode === "create" ? "등록" : "상세"}`;
  if (detail) {
    detail.innerHTML = `
      <h4>기본 정보</h4>
      <dl class="admin-resource-detail-list">
        <div><dt>ID</dt><dd>${escapeCell(item?.id || "신규")}</dd></div>
        <div><dt>이름</dt><dd>${escapeCell(config.label(item))}</dd></div>
        <div><dt>사용여부</dt><dd>${escapeCell(item?.status_label || (item?.status === "N" ? "미사용" : item?.status ? "사용" : ""))}</dd></div>
        <div><dt>최종수정일시</dt><dd>${formatAidotAdminDate(item?.updated_at)}</dd></div>
      </dl>
    `;
  }
  if (edit) {
    edit.innerHTML = `
      <h4>${config.title} 수정</h4>
      <div class="admin-resource-form">
        ${config.fields.map((field) => renderAdminResourceField(field, item?.[field[0]] ?? "")).join("")}
        <div class="admin-resource-actions">
          <button type="button" class="admin-page__primary" data-admin-resource-save>저장</button>
          ${mode === "create" ? "" : `<button type="button" class="admin-page__ghost" data-admin-resource-delete>삭제</button>`}
        </div>
      </div>
    `;
  }
  bindAdminResourceModalControls();
  modal.hidden = false;
}

async function saveAdminResourceFromModal() {
  if (!currentAdminResourceModal) return;
  const { resource, id, mode } = currentAdminResourceModal;
  const config = getAdminResourceUi(resource);
  if (!config) return;
  const body = collectAdminResourceForm();
  const url = mode === "create" ? config.endpoint : `${config.endpoint}/${encodeURIComponent(id)}`;
  await requestCgaJson(url, { method: mode === "create" ? "POST" : "PATCH", body });
  await refreshAdminResourcesFromServer();
  closeAdminResourceModal();
  renderAccessPanels();
}

async function deleteAdminResourceFromModal() {
  if (!currentAdminResourceModal || currentAdminResourceModal.mode === "create") return;
  const { resource, id } = currentAdminResourceModal;
  const config = getAdminResourceUi(resource);
  if (!config) return;
  await requestCgaJson(`${config.endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
  await refreshAdminResourcesFromServer();
  closeAdminResourceModal();
  renderAccessPanels();
}

function bindAdminResourceModalControls() {
  document.querySelectorAll("[data-admin-resource-modal-close]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", closeAdminResourceModal);
  });
  document.querySelector("[data-admin-resource-save]")?.addEventListener("click", () => {
    saveAdminResourceFromModal().catch((error) => setGlobalMessage("error", "저장 실패", error.message || "저장에 실패했습니다."));
  });
  document.querySelector("[data-admin-resource-delete]")?.addEventListener("click", () => {
    deleteAdminResourceFromModal().catch((error) => setGlobalMessage("error", "삭제 실패", error.message || "삭제에 실패했습니다."));
  });
}

function openAdminResourceModal(resource, id = "", mode = "edit") {
  currentAdminResourceModal = { resource, id, mode };
  renderAdminResourceModal();
}

async function queryAdminResource(surface, resource) {
  const config = getAdminResourceUi(resource);
  if (!config) return;
  const q = surface.querySelector("[data-admin-query-input]")?.value || "";
  const channel = surface.querySelector("[data-admin-channel-filter]")?.value || "";
  const status = surface.querySelector("[data-admin-status-filter]")?.value || "";
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (channel) params.set("channel", channel);
  if (status && status !== "all") params.set("status", status);
  const started = performance.now();
  const result = await requestCgaJson(`${config.endpoint}${params.toString() ? `?${params}` : ""}`);
  const elapsed = performance.now() - started;
  if (elapsed > 5000) setGlobalMessage("error", "조회 지연", `${config.title} 조회가 ${Math.round(elapsed)}ms 걸렸습니다. 보완이 필요합니다.`);
  currentAdminResources = { ...currentAdminResources, [config.collectionKey]: result.items || [] };
  renderAccessPanels();
}

function bindAdminSurfaceControls(surface) {
  surface.querySelectorAll("[data-admin-row]").forEach((row) => {
    if (row.dataset.bound === "true") return;
    row.dataset.bound = "true";
    row.addEventListener("click", (event) => {
      event.preventDefault();
      openAdminResourceModal(row.dataset.adminResource, row.dataset.adminId, "edit");
    });
  });
  surface.querySelectorAll("[data-admin-create]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => openAdminResourceModal(button.dataset.adminCreate, "", "create"));
  });
  surface.querySelectorAll("[data-admin-query]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => queryAdminResource(surface, button.dataset.adminQuery).catch((error) => setGlobalMessage("error", "조회 실패", error.message || "조회에 실패했습니다.")));
  });
}

function renderAdminSurface(surface, key) {
  const normalizedKey = {
    "template-list": "templates",
    "license-status": "license",
    "common-variable": "common-variables",
    "default-message": "default-messages",
    "channel-management": "channels",
    "botstation-link": "botstation-links"
  }[key] || key;
  if (normalizedKey === "login-history") renderLoginHistorySurface(surface);
  else if (normalizedKey === "templates") renderTemplateListSurface(surface);
  else if (normalizedKey === "common-variables") renderCommonVariableSurface(surface);
  else if (normalizedKey === "default-messages") renderDefaultMessageSurface(surface);
  else if (normalizedKey === "channels") renderChannelSurface(surface);
  else if (normalizedKey === "license") renderLicenseSurface(surface);
  else renderSimpleHistorySurface(surface, normalizedKey);
  bindAdminSurfaceControls(surface);
}

function renderAccessPanels() {
  const headingTitle = document.querySelector("[data-access-heading-title]");
  const headingBody = document.querySelector("[data-access-heading-body]");
  const currentUserBadge = document.querySelector("[data-current-user-badge]");
  const entryLoginUser = document.querySelector("[data-entry-login-user]");
  const accessOperations = document.querySelector("[data-access-operations]");
  const loginUser = document.querySelector("[data-login-user]");
  const loginIdInput = document.querySelector("[data-login-id]");
  const currentSession = document.querySelector("[data-current-session]");
  const authMessage = document.querySelector("[data-auth-message]");
  const joinGroup = document.querySelector("[data-join-group]");
  const joinRole = document.querySelector("[data-join-role]");
  const adminQueue = document.querySelector("[data-admin-action-queue]");
  const groupUsers = document.querySelector("[data-group-users]");
  const userSearch = document.querySelector("[data-user-search]");
  const userGroupFilter = document.querySelector("[data-user-group-filter]");
  const userRoleFilter = document.querySelector("[data-user-role-filter]");
  const userStatusFilter = document.querySelector("[data-user-status-filter]");
  const userSignupFilter = document.querySelector("[data-user-signup-filter]");
  const userDetail = document.querySelector("[data-user-detail]");
  const userEdit = document.querySelector("[data-user-edit]");
  const userModal = document.querySelector("[data-user-modal]");
  const groupSearch = document.querySelector("[data-group-search]");
  const groupStatusFilter = document.querySelector("[data-group-status-filter]");
  const groupDetail = document.querySelector("[data-group-detail]");
  const groupEdit = document.querySelector("[data-group-edit]");
  const groupModal = document.querySelector("[data-group-modal]");
  const loginHistory = document.querySelector("[data-login-history]");
  const joinRequests = document.querySelector("[data-join-requests]");
  const adminRequests = document.querySelector("[data-admin-requests]");
  const groupAccess = document.querySelector("[data-group-access]");
  const screenAccess = document.querySelector("[data-screen-access]");
  const authPolicy = document.querySelector("[data-auth-policy]");
  const adminPolicy = document.querySelector("[data-admin-policy]");
  if (!accessOperations || !loginUser || !currentSession || !joinGroup || !joinRole || !adminQueue || !groupUsers || !joinRequests || !adminRequests || !groupAccess || !screenAccess || !authPolicy || !adminPolicy) return;
  document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.adminPanel !== currentSystemAdminSubview;
  });
  const subviewLabel = getSystemAdminSubviewLabel(currentSystemAdminSubview);
  if (headingTitle) headingTitle.textContent = subviewLabel;
  if (headingBody) headingBody.textContent = "";
  document.querySelectorAll("[data-admin-surface]").forEach((surface) => renderAdminSurface(surface, surface.dataset.adminSurface));
  const current = summarizeAccess(currentAccessState);
  const operations = summarizeAccessOperations(currentAccessState);
  const policy = summarizeAccessPolicy(currentAccessState);
  renderTopContext();
  const activeUsers = currentAccessState.users.filter((user) => user.status === "active");
  loginUser.innerHTML = activeUsers
    .filter((user) => user.status === "active")
    .map((user) => `<option value="${user.id}" ${user.id === currentAccessState.currentUserId ? "selected" : ""}>${user.name} · ${user.id}</option>`)
    .join("");
  if (entryLoginUser) entryLoginUser.innerHTML = loginUser.innerHTML;
  if (loginIdInput && !loginIdInput.value) {
    loginIdInput.value = currentAccessState.currentUserId || loginUser.value || "";
  }
  const currentRoles = [...new Set(current.memberships.map((item) => item.role))].join(", ") || t("common.noRole", "no role");
  currentSession.innerHTML = `
    <div class="session-header">
      <strong>${current.user?.name || t("common.user", "User")}</strong>
      ${renderStatusBadge(current.user?.status || "active")}
    </div>
    <span>${current.user?.id || ""} · ${current.user?.locale || "en"} · ${formatMemberships(current.memberships)}</span>
    <div class="access-badge-row">
      ${renderAccessBadge(t("access.roleSummary", "Roles"), currentRoles)}
      ${renderAccessBadge(t("access.groupCount", "Groups"), current.memberships.length)}
      ${renderAccessBadge(t("access.scopeCount", "Scopes"), current.scopes.length)}
    </div>
  `;
  if (authMessage) {
    authMessage.classList.toggle("auth-message", Boolean(currentAuthMessage));
    renderMessageNode(authMessage, currentAuthMessage, t("admin.authentication", "Authentication"));
  }
  if (loginHistory) {
    const loginRows = Array.isArray(currentAccessState.loginHistory) ? currentAccessState.loginHistory : [];
    const visibleRows = loginRows.slice(0, 100);
    loginHistory.innerHTML = `
      <header class="aidot-admin-toolbar aidot-admin-toolbar--history">
        <div class="aidot-admin-actions aidot-admin-actions--right">
          <input type="date" aria-label="시작일" />
          <input type="date" aria-label="종료일" />
          <button type="button" class="ghost-btn">초기화</button>
          <button type="button" class="primary-action-small">조회</button>
        </div>
      </header>
      <div class="management-list-meta">
        <strong>전체 ${loginRows.length}건</strong>
        <select aria-label="페이지 크기"><option>10개씩 보기</option><option>25개씩 보기</option><option>50개씩 보기</option><option>100개씩 보기</option></select>
      </div>
      <div class="management-table management-table--login-history management-table--paged">
        <div class="management-table-row head">
          <span>사용자 계정</span>
          <span>사용자 이름</span>
          <span>그룹</span>
          <span>역할</span>
          <span>접속한 IP</span>
          <span>로그인 시간</span>
          <span>로그아웃 시간</span>
        </div>
        ${visibleRows.map((record) => `
          <div class="management-table-row">
            <strong>${escapeCell(record.user_id)}</strong>
            <span>${escapeCell(record.user_name)}</span>
            <span>${escapeCell(record.group_name || record.group_id)}</span>
            <span>${escapeCell(record.role)}</span>
            <span>${escapeCell(record.ip_address)}</span>
            <span>${formatLoginHistoryDate(record.login_at)}</span>
            <span>${formatLoginHistoryDate(record.logout_at)}</span>
          </div>
        `).join("")}
      </div>
      ${renderPager(loginRows.length)}
    `;
  }
  renderEntryAuthMessage();
  joinGroup.innerHTML = currentAccessState.groups
    .filter((group) => group.status === "active")
    .map((group) => `<option value="${group.id}">${group.name}</option>`)
    .join("");
  joinRole.innerHTML = MANAGED_GROUP_ROLES
    .map((role) => `<option value="${role}">${role}</option>`)
    .join("");
  const activeGroups = currentAccessState.groups.filter((group) => group.status === "active");
  const groupOptions = activeGroups.map((group) => `<option value="${group.id}">${group.name}</option>`).join("");
  const roleOptions = MANAGED_GROUP_ROLES.map((role) => `<option value="${role}">${role}</option>`).join("");
  adminQueue.innerHTML = [
    ...summarizeJoinRequests(currentAccessState).filter((request) => request.status === "pending").map((request) => {
      const canApprove = canApproveGroupJoinRequest(currentAccessState, { requestId: request.id, reviewerId: currentAccessState.currentUserId });
      return `
      <div class="${canApprove ? "" : "blocked-action"}">
        <strong>${request.user?.name || request.user_id} -> ${request.group?.name || request.group_id}</strong>
        <span>${t("admin.groupJoin", "group join")} · ${canApprove ? t("admin.groupAdminApproval", "group admin approval") : t("admin.requiresGroupAdmin", "requires group admin")}</span>
        <div class="approval-controls">
          <select data-approval-group="${request.id}" ${canApprove ? "" : "disabled"}>${activeGroups.map((group) => `<option value="${group.id}" ${group.id === request.group_id ? "selected" : ""}>${group.name}</option>`).join("")}</select>
          <select data-approval-role="${request.id}" ${canApprove ? "" : "disabled"}>${MANAGED_GROUP_ROLES.map((role) => `<option value="${role}" ${role === request.requested_role ? "selected" : ""}>${role}</option>`).join("")}</select>
        </div>
        <button type="button" data-approve-join="${request.id}" ${canApprove ? "" : "disabled"}>${t("admin.approve", "Approve")}</button>
      </div>
    `;
    }),
    ...summarizeAdminRequests(currentAccessState).filter((request) => request.status === "pending").map((request) => {
      const canApprove = canApproveAdminPermissionRequest(currentAccessState, { requestId: request.id, reviewerId: currentAccessState.currentUserId });
      return `
      <div class="${canApprove ? "" : "blocked-action"}">
        <strong>${request.user?.name || request.user_id} -> ${request.group?.name || request.group_id}</strong>
        <span>${t("admin.adminPermission", "admin permission")} · ${canApprove ? t("admin.systemAdminApproval", "system admin approval") : t("admin.requiresSystemAdmin", "requires system admin")}</span>
        <div class="approval-controls">
          <select data-admin-approval-group="${request.id}" ${canApprove ? "" : "disabled"}>${activeGroups.map((group) => `<option value="${group.id}" ${group.id === request.group_id ? "selected" : ""}>${group.name}</option>`).join("")}</select>
          <select data-admin-approval-role="${request.id}" ${canApprove ? "" : "disabled"}>${MANAGED_GROUP_ROLES.map((role) => `<option value="${role}" ${role === request.requested_role ? "selected" : ""}>${role}</option>`).join("")}</select>
        </div>
        <button type="button" data-approve-admin="${request.id}" ${canApprove ? "" : "disabled"}>${t("admin.approve", "Approve")}</button>
      </div>
    `;
    })
  ].join("") || `<div><strong>${t("admin.noPendingApproval", "No pending approval")}</strong><span>${t("admin.queueEmpty", "Queue is empty")}</span></div>`;
  accessOperations.innerHTML = `
    <div><strong data-i18n="access.activeUsers">Active users</strong><span>${operations.activeUsers}</span></div>
    <div><strong data-i18n="access.activeGroups">Active groups</strong><span>${operations.activeGroups}</span></div>
    <div><strong data-i18n="access.activeMemberships">Active memberships</strong><span>${operations.activeMemberships}</span></div>
    <div><strong data-i18n="access.waitingApprovals">Waiting approvals</strong><span>${operations.pendingJoinRequests + operations.pendingAdminRequests}</span></div>
    <div><strong data-i18n="access.protectedAdmin">Protected admin</strong><span>${operations.protectedAdmin ? t("common.yes", "Yes") : t("common.no", "No")}</span></div>
    <div><strong data-i18n="access.userLanguages">User languages</strong><span>${operations.multilingualUsers}</span></div>
  `;
  const canViewAllUserGroups = isSystemAdmin(currentAccessState, currentAccessState.currentUserId)
    || currentAccessState.memberships.some((membership) => (
      membership.user_id === currentAccessState.currentUserId
      && membership.status === "active"
      && membership.role === "group_admin"
    ));
  const visibleGroupIds = new Set(
    canViewAllUserGroups
      ? currentAccessState.groups.filter((group) => group.status === "active").map((group) => group.id)
      : currentAccessState.memberships
          .filter((membership) => membership.user_id === currentAccessState.currentUserId && membership.status === "active")
          .map((membership) => membership.group_id)
  );
  const activeUserRecords = summarizeGroupUsers(currentAccessState)
    .filter((entry) => visibleGroupIds.has(entry.group.id))
    .flatMap((entry) => entry.users.map(({ user, membership }) => ({
      user,
      group: entry.group,
      membership,
      role: membership.role,
      rowStatus: user?.status || "active",
      request: null
    })));
  const pendingUserRecords = summarizeJoinRequests(currentAccessState)
    .filter((request) => request.status === "pending" && visibleGroupIds.has(request.group_id))
    .map((request) => ({
      user: request.user,
      group: request.group,
      membership: null,
      role: request.requested_role,
      rowStatus: request.status,
      request
    }));
  const userRecords = [...activeUserRecords, ...pendingUserRecords];
  const userSearchText = (userSearch?.value || "").trim().toLowerCase();
  const selectedGroupFilter = userGroupFilter?.value || "all";
  const selectedRoleFilter = userRoleFilter?.value || "all";
  const selectedStatusFilter = userStatusFilter?.value || "all";
  const selectedSignupFilter = userSignupFilter?.value || "all";
  if (userGroupFilter) {
    userGroupFilter.innerHTML = `<option value="all">전체 그룹</option>${activeGroups
      .filter((group) => visibleGroupIds.has(group.id))
      .map((group) => `<option value="${group.id}" ${group.id === selectedGroupFilter ? "selected" : ""}>${group.name}</option>`)
      .join("")}`;
  }
  if (userRoleFilter) {
    userRoleFilter.innerHTML = `<option value="all">전체 역할</option>${["system_admin", ...MANAGED_GROUP_ROLES]
      .map((role) => `<option value="${role}" ${role === selectedRoleFilter ? "selected" : ""}>${role}</option>`)
      .join("")}`;
  }
  if (userStatusFilter) {
    userStatusFilter.innerHTML = [
      ["all", "전체 계정상태"],
      ["active", "활성"],
      ["locked", "잠김"],
      ["password_reset", "비밀번호 초기화"],
      ["inactive", "비활성"]
    ].map(([status, label]) => `<option value="${status}" ${status === selectedStatusFilter ? "selected" : ""}>${label}</option>`).join("");
  }
  if (userSignupFilter) {
    userSignupFilter.innerHTML = [
      ["all", "전체 가입상태"],
      ["approved", "계정 승인"],
      ["pending", "승인 요청"],
      ["rejected", "승인 반려"]
    ].map(([status, label]) => `<option value="${status}" ${status === selectedSignupFilter ? "selected" : ""}>${label}</option>`).join("");
  }
  const filteredUserRecords = userRecords.filter((record) => {
    const text = `${record.user?.id || record.request?.user_id || ""} ${record.user?.name || ""} ${record.group?.name || ""}`.toLowerCase();
    return (!userSearchText || text.includes(userSearchText))
      && (selectedGroupFilter === "all" || record.group?.id === selectedGroupFilter)
      && (selectedRoleFilter === "all" || record.role === selectedRoleFilter)
      && (selectedStatusFilter === "all" || (record.user?.status || "active") === selectedStatusFilter)
      && (selectedSignupFilter === "all" || (selectedSignupFilter === "approved" ? record.rowStatus !== "pending" : record.rowStatus === selectedSignupFilter));
  });
  const totalUserRows = filteredUserRecords.length;
  const totalUserPages = Math.max(1, Math.ceil(totalUserRows / userListPageSize));
  userListPage = Math.min(Math.max(1, userListPage), totalUserPages);
  const userPageStart = (userListPage - 1) * userListPageSize;
  const pagedUserRecords = filteredUserRecords.slice(userPageStart, userPageStart + userListPageSize);
  if (!filteredUserRecords.some((record) => (record.user?.id || record.request?.user_id) === selectedAccessUserId)) {
    selectedAccessUserId = filteredUserRecords[0]?.user?.id || filteredUserRecords[0]?.request?.user_id || selectedAccessUserId;
  }
  const activeUserRows = pagedUserRecords.map((record) => {
    const userId = record.user?.id || record.request?.user_id || "";
    const userName = record.user?.name || userId;
    const requestDate = formatAidotAdminDate(record.request?.created_at || record.request?.requested_at);
    return `
      <button type="button" class="management-table-row ${userId === selectedAccessUserId ? "selected-row" : ""} ${record.rowStatus === "pending" ? "pending-row" : ""}" data-select-user="${userId}">
        <span><input type="checkbox" tabindex="-1" /></span>
        <strong>${userId}</strong>
        <span>${userName}</span>
        <span>${record.group?.name || record.request?.group_id || ""}</span>
        <span>${record.role}</span>
        <span>${requestDate}</span>
        <span>${formatAidotSignupStatus(record)}</span>
        <span><span class="status-badge status-${record.user?.status || "active"}">${formatAidotAccountStatus(record.user?.status || "active")}</span></span>
      </button>
    `;
  });
  groupUsers.innerHTML = `
    <div class="management-list-meta">
      <strong>전체 ${totalUserRows}건</strong>
      <select data-user-page-size aria-label="페이지 크기">
        ${[10, 25, 50, 100].map((size) => `<option value="${size}" ${size === userListPageSize ? "selected" : ""}>${size}개씩 보기</option>`).join("")}
      </select>
    </div>
    <div class="management-table management-table--users management-table--paged">
      <div class="management-table-row head">
        <span></span>
        <span>사용자 계정</span>
        <span>사용자 이름</span>
        <span>그룹</span>
        <span>역할</span>
        <span>신청일시</span>
        <span>가입상태</span>
        <span>계정상태</span>
      </div>
      ${activeUserRows.join("")}
    </div>
    <div class="management-pagination">
      <button type="button" data-user-page-first ${userListPage <= 1 ? "disabled" : ""}>◀</button>
      <button type="button" data-user-page-prev ${userListPage <= 1 ? "disabled" : ""}>‹</button>
      <strong>${userListPage}</strong>
      <button type="button" data-user-page-next ${userListPage >= totalUserPages ? "disabled" : ""}>›</button>
      <button type="button" data-user-page-last="${totalUserPages}" ${userListPage >= totalUserPages ? "disabled" : ""}>▶</button>
    </div>
  `;
  const selectedUserRecord = userRecords.find((record) => (record.user?.id || record.request?.user_id) === selectedAccessUserId) || userRecords[0];
  if (userModal) userModal.hidden = !accessUserModalOpen;
  if (userDetail) {
    userDetail.innerHTML = selectedUserRecord ? `
      <h4>기본 정보</h4>
      <dl class="detail-definition">
        <dt>사용자 계정</dt><dd>${selectedUserRecord.user?.id || selectedUserRecord.request?.user_id || ""}</dd>
        <dt>사용자 이름</dt><dd>${selectedUserRecord.user?.name || "-"}</dd>
        <dt>서버</dt><dd>기본 서버</dd>
        <dt>그룹</dt><dd>${selectedUserRecord.group?.name || "-"}</dd>
        <dt>신청일시</dt><dd>${formatAidotAdminDate(selectedUserRecord.request?.created_at || selectedUserRecord.request?.requested_at || selectedUserRecord.request?.id)}</dd>
        <dt>가입상태</dt><dd>${formatAidotSignupStatus(selectedUserRecord)}</dd>
        <dt>계정상태</dt><dd>${formatAidotAccountStatus(selectedUserRecord.user?.status || "active")}</dd>
        <dt>언어</dt><dd>${selectedUserRecord.user?.locale || "en"}</dd>
      </dl>
    ` : `<h4>기본 정보</h4><p>${t("common.none", "None")}</p>`;
  }
  if (userEdit) {
    const userId = selectedUserRecord?.user?.id || selectedUserRecord?.request?.user_id || "";
    const groupId = selectedUserRecord?.group?.id || "";
    const isPendingUser = selectedUserRecord?.rowStatus === "pending" && selectedUserRecord?.request?.id;
    const editable = Boolean((selectedUserRecord?.membership || isPendingUser) && selectedUserRecord.role !== "system_admin");
    userEdit.innerHTML = `
      <h4>${isPendingUser ? "사용자 승인" : "사용자 정보 수정"}</h4>
      <label><span>사용자 이름</span><input value="${selectedUserRecord?.user?.name || ""}" /></label>
      <label><span>역할</span><select data-inline-role-user="${userId}" data-inline-role-group="${groupId}" ${editable ? "" : "disabled"}>${MANAGED_GROUP_ROLES.map((role) => `<option value="${role}" ${role === selectedUserRecord?.role ? "selected" : ""}>${role}</option>`).join("")}</select></label>
      <label><span>그룹</span><select data-inline-group-user="${userId}" ${editable ? "" : "disabled"}>${activeGroups.map((group) => `<option value="${group.id}" ${group.id === groupId ? "selected" : ""}>${group.name}</option>`).join("")}</select></label>
      <label><span>계정 상태</span><select data-inline-account-status="${userId}" ${selectedUserRecord?.user ? "" : "disabled"}>
        <option value="active" ${(selectedUserRecord?.user?.status || "active") === "active" ? "selected" : ""}>활성</option>
        <option value="inactive" ${selectedUserRecord?.user?.status === "inactive" ? "selected" : ""}>비활성</option>
        <option value="locked" ${selectedUserRecord?.user?.status === "locked" ? "selected" : ""}>잠김</option>
        <option value="password_reset" ${selectedUserRecord?.user?.status === "password_reset" ? "selected" : ""}>비밀번호 초기화</option>
      </select></label>
      <button type="button" data-inline-role-save="${userId}" data-inline-role-group-save="${groupId}" data-inline-request-save="${selectedUserRecord?.request?.id || ""}" ${editable ? "" : "disabled"}>${isPendingUser ? "승인" : t("common.save", "Save")}</button>
      ${isPendingUser ? "" : `<button type="button" disabled>삭제</button>`}
    `;
  }
  joinRequests.innerHTML = summarizeJoinRequests(currentAccessState).map((request) => `
    <div>
      <strong>${request.user?.name || request.user_id} -> ${request.group?.name || request.group_id}</strong>
      <span>${request.requested_role} · ${renderStatusBadge(request.status)}</span>
    </div>
  `).join("");
  adminRequests.innerHTML = summarizeAdminRequests(currentAccessState).map((request) => `
    <div>
      <strong>${request.user?.name || request.user_id} -> ${request.group?.name || request.group_id}</strong>
      <span>${request.requested_role} · ${renderStatusBadge(request.status)} · ${t("admin.reviewer", "reviewer")}: admin</span>
    </div>
  `).join("");
  const groupSearchText = (groupSearch?.value || "").trim().toLowerCase();
  const selectedGroupStatusFilter = groupStatusFilter?.value || "active";
  if (groupStatusFilter) {
    groupStatusFilter.innerHTML = ["all", "active", "deleting", "deleted"]
      .map((status) => `<option value="${status}" ${status === selectedGroupStatusFilter ? "selected" : ""}>${status === "all" ? "전체 사용여부" : status}</option>`)
      .join("");
  }
  const visibleGroups = currentAccessState.groups
    .filter((group) => visibleGroupIds.has(group.id))
    .filter((group) => {
      const status = group.status || "active";
      const text = `${group.id} ${group.name}`.toLowerCase();
      return (!groupSearchText || text.includes(groupSearchText))
        && (selectedGroupStatusFilter === "all" || status === selectedGroupStatusFilter);
    });
  const totalGroupRows = visibleGroups.length;
  const totalGroupPages = Math.max(1, Math.ceil(totalGroupRows / groupListPageSize));
  groupListPage = Math.min(Math.max(1, groupListPage), totalGroupPages);
  const groupPageStart = (groupListPage - 1) * groupListPageSize;
  const pagedGroups = visibleGroups.slice(groupPageStart, groupPageStart + groupListPageSize);
  if (!visibleGroups.some((group) => group.id === selectedAccessGroupId)) {
    selectedAccessGroupId = visibleGroups[0]?.id || selectedAccessGroupId;
  }
  groupAccess.innerHTML = `
    <div class="management-list-meta">
      <strong>전체 ${totalGroupRows}건</strong>
      <select data-group-page-size aria-label="페이지 크기">
        ${[10, 25, 50, 100].map((size) => `<option value="${size}" ${size === groupListPageSize ? "selected" : ""}>${size}개씩 보기</option>`).join("")}
      </select>
    </div>
    <div class="management-table management-table--groups management-table--paged">
      <div class="management-table-row head">
        <span>그룹 아이디</span>
        <span>그룹 이름</span>
        <span>사용여부</span>
        <span>생성자</span>
        <span>최종수정자</span>
      </div>
      ${pagedGroups.map((group) => {
    const members = currentAccessState.memberships.filter((membership) => membership.group_id === group.id && membership.status === "active");
    return `
      <button type="button" class="management-table-row ${group.id === selectedAccessGroupId ? "selected-row" : ""}" data-select-group="${group.id}">
        <strong>${group.id}</strong>
        <span>${group.name}<small>사용자 ${members.length}</small></span>
        <span>${renderStatusBadge(group.status || "active")}</span>
        <span>SYSTEM</span>
        <span>SYSTEM</span>
      </button>
    `;
  }).join("")}
    </div>
    <div class="management-pagination">
      <button type="button" data-group-page-first ${groupListPage <= 1 ? "disabled" : ""}>◀</button>
      <button type="button" data-group-page-prev ${groupListPage <= 1 ? "disabled" : ""}>‹</button>
      <strong>${groupListPage}</strong>
      <button type="button" data-group-page-next ${groupListPage >= totalGroupPages ? "disabled" : ""}>›</button>
      <button type="button" data-group-page-last="${totalGroupPages}" ${groupListPage >= totalGroupPages ? "disabled" : ""}>▶</button>
    </div>
  `;
  const selectedGroupRecord = currentAccessState.groups.find((group) => group.id === selectedAccessGroupId) || visibleGroups[0];
  if (groupModal) groupModal.hidden = !accessGroupModalOpen;
  if (groupDetail) {
    const members = selectedGroupRecord
      ? currentAccessState.memberships.filter((membership) => membership.group_id === selectedGroupRecord.id && membership.status === "active")
      : [];
    groupDetail.innerHTML = selectedGroupRecord ? `
      <h4>기본 정보</h4>
      <dl class="detail-definition detail-definition--two">
        <dt>그룹 아이디</dt><dd>${selectedGroupRecord.id}</dd>
        <dt>${t("access.userCount", "Users")}</dt><dd>${members.length}</dd>
        <dt>그룹 이름</dt><dd>${selectedGroupRecord.name}</dd>
        <dt>사용 여부</dt><dd>${selectedGroupRecord.status || "active"}</dd>
        <dt>생성자</dt><dd>SYSTEM</dd>
        <dt>최종수정자</dt><dd>SYSTEM</dd>
      </dl>
    ` : `<h4>기본 정보</h4><p>${t("common.none", "None")}</p>`;
  }
  if (groupEdit) {
    groupEdit.innerHTML = selectedGroupRecord ? `
      <h4>그룹 수정</h4>
      <label><span>그룹 이름</span><input value="${selectedGroupRecord.name}" disabled /></label>
      <label><span>사용 여부</span><select disabled><option selected>${selectedGroupRecord.status || "active"}</option></select></label>
      <button type="button" disabled>${t("common.save", "Save")}</button>
      <button type="button" disabled>삭제</button>
      <p class="edit-note">그룹 수정 저장은 Aidot admin API 연결 후 활성화합니다.</p>
    ` : "";
  }
  bindAccessManagementControls();
  screenAccess.innerHTML = `
    <div class="current-user"><strong>${current.user?.name || t("common.user", "User")}</strong><span>${formatMemberships(current.memberships)}</span></div>
    ${current.screens.map((screen) => `
      <div class="${screen.allowed ? "allowed" : "denied"}">
        <strong>${screen.screenId}</strong>
        <span>${screen.allowed ? t("common.allowed", "Allowed") : t("common.blocked", "Blocked")} · ${screen.scope}</span>
      </div>
    `).join("")}
  `;
  authPolicy.innerHTML = `
    <p><strong data-i18n="access.signupGroup">Personal group auto creation</strong><span>${policy.signupCreatesOwnGroup ? t("common.enabled", "Enabled") : t("common.disabled", "Disabled")}</span></p>
    <p><strong data-i18n="access.userLocale">User language setting</strong><span>${current.user?.locale || "en"}</span></p>
    <p><strong data-i18n="access.errorLocale">Error message language</strong><span>${policy.errorLocaleSource}</span></p>
    <p><strong data-i18n="access.pendingJoin">Pending group join requests</strong><span>${policy.pendingJoinRequests}</span></p>
    <p><strong data-i18n="access.pendingAdmin">Pending admin requests</strong><span>${policy.pendingAdminRequests}</span></p>
    <p><strong data-i18n="access.emptyGroups">Empty groups auto-delete</strong><span>${policy.emptyGroupAutoDelete ? t("common.enabled", "Enabled") : t("common.disabled", "Disabled")}</span></p>
    <p><strong data-i18n="access.emptyGroupIds">Groups without users</strong><span>${policy.groupsWithoutUsers.join(", ") || t("common.none", "None")}</span></p>
  `;
  adminPolicy.innerHTML = `
    <p><strong data-i18n="access.systemAdmin">Base system admin</strong><span>${policy.systemAdmin?.id || "admin"}</span></p>
    <p><strong data-i18n="access.adminDeletable">Admin deletable</strong><span>${policy.systemAdmin?.deletable ? t("common.yes", "Yes") : t("common.no", "No")}</span></p>
    <p><strong data-i18n="access.groupCreateAdmin">Group creation approval</strong><span>${policy.groupCreationRequiresSystemAdmin ? t("admin.systemAdminRequired", "System admin required") : t("common.open", "Open")}</span></p>
    <p><strong data-i18n="access.currentGroupCreate">Current user can create group</strong><span>${canCreateManagedGroup(currentAccessState, currentAccessState.currentUserId) ? t("common.yes", "Yes") : t("common.no", "No")}</span></p>
    <p><strong data-i18n="access.groupsWithoutAdmin">Groups without group admin</strong><span>${policy.groupsWithoutAdmin.join(", ") || t("common.none", "None")}</span></p>
  `;
  bindAdminActionButtons();
  applyAccessToNavigation(current);
}

function applyAccessToNavigation(current = summarizeAccess(currentAccessState)) {
  const screenAccess = new Map(current.screens.map((screen) => [screen.screenId, screen]));
  const links = [...document.querySelectorAll(".management-nav a, .server-sub-nav a, .system-admin-subnav a, [data-workflow-nav] a")];
  links.forEach((link) => {
    const id = link.getAttribute("href")?.replace("#", "");
    const access = screenAccess.get(id);
    const allowed = access ? access.allowed : true;
    link.classList.toggle("access-blocked", !allowed);
    link.classList.toggle("access-allowed", allowed);
    link.setAttribute("aria-disabled", allowed ? "false" : "true");
    link.hidden = access ? !allowed : false;
    link.dataset.accessLabel = "";
  });
  const activeLink = links.find((link) => link.getAttribute("href") === `#${activeScreenId}`);
  let activeScreenChanged = false;
  if (activeLink?.hidden) {
    const firstAllowed = links.find((link) => !link.hidden);
    const firstAllowedId = firstAllowed?.getAttribute("href")?.replace("#", "");
    if (firstAllowedId) {
      activeScreenId = firstAllowedId;
      activeScreenChanged = true;
    }
  }
  updateNavigationActiveState();
  if (activeScreenChanged) applyScreenLayout();
}

function renderApiRegistry() {
  const apiGroup = document.querySelector("[data-api-group]");
  const apiBot = document.querySelector("[data-api-bot]");
  const apiSection = document.querySelector('[data-screen-id="api-answer-source"]');
  const apiRegistry = document.querySelector("[data-api-registry]");
  const apiOwnerMeta = document.querySelector("[data-api-owner-meta]");
  const apiAdd = document.querySelector("[data-api-add]");
  if (!apiSection && (!apiGroup || !apiBot || !apiRegistry)) return;
  const groups = getActiveGroupsForCurrentUser();
  if (!groups.some((group) => group.id === currentApiGroupId)) {
    currentApiGroupId = groups[0]?.id || currentWorkspaceGroupId;
  }
  const bots = getBotsForGroup(currentApiGroupId);
  if (!bots.some((bot) => bot.id === currentApiBotId)) {
    currentApiBotId = bots[0]?.id || currentWorkspaceBotId;
  }
  const canManageApi = canManageApiAnswerForCurrentSelection();
  if (apiGroup) {
    apiGroup.innerHTML = groups
      .map((group) => `<option value="${group.id}" ${group.id === currentApiGroupId ? "selected" : ""}>${group.name}</option>`)
      .join("");
  }
  if (apiBot) {
    apiBot.innerHTML = bots
      .map((bot) => `<option value="${bot.id}" ${bot.id === currentApiBotId ? "selected" : ""}>${bot.name}</option>`)
      .join("");
  }
  if (apiOwnerMeta) {
    apiOwnerMeta.textContent = `group_id: ${currentApiGroupId} · bot_id: ${currentApiBotId || t("common.none", "None")}`;
    apiOwnerMeta.dataset.manageAllowedLabel = t("apiAnswer.manageAllowed", "Can manage API answers");
    apiOwnerMeta.dataset.manageBlockedLabel = t("apiAnswer.manageBlocked", "Blocked: apiAnswer.manage");
  }
  if (apiAdd) {
    apiAdd.disabled = !canManageApi || !currentApiBotId;
  }
  const aidotApiRows = [
    ["JSONPlaceholder 게시글", "https://api.jsonplaceholder.dev", 1, 0, "2026-05-03 09:46", "aidot_1"],
    ["JSONPlaceholder 게시글", "https://api.jsonplaceholder.dev", 1, 0, "2026-05-03 09:46", "aidot_1"],
    ["httpbin 요청 확인", "https://httpbin.org", 1, 1, "2026-05-03 09:22", "aidot_1"],
    ["httpbin 요청 확인", "https://httpbin.org", 1, 1, "2026-05-03 09:22", "aidot_1"],
    ["REST Countries 국가 조회", "https://restcountries.com", 1, 0, "2026-05-03 08:27", "aidot_1"],
    ["REST Countries 국가 조회", "https://restcountries.com", 1, 0, "2026-05-03 08:27", "aidot_1"],
    ["JSONPlaceholder 사용자", "https://api.jsonplaceholder.dev", 1, 0, "2026-05-03 08:05", "aidot_1"],
    ["JSONPlaceholder 사용자", "https://api.jsonplaceholder.dev", 1, 0, "2026-05-03 08:05", "aidot_1"],
    ["JSONPlaceholder 할 일", "https://api.jsonplaceholder.dev", 1, 0, "2026-05-03 07:59", "aidot_1"],
    ["JSONPlaceholder 할 일", "https://api.jsonplaceholder.dev", 1, 0, "2026-05-03 07:59", "aidot_1"]
  ].map(([name, endpoint_url, methodCount, usageCount, updatedAt, updatedBy]) => ({
    group_id: currentApiGroupId,
    bot_id: currentApiBotId,
    name,
    endpoint_url,
    methodCount,
    usageCount,
    updatedAt,
    updatedBy
  }));
  const filteredApis = currentApiRegistry.filter((api) => api.group_id === currentApiGroupId && api.bot_id === currentApiBotId);
  const visibleApis = filteredApis.length >= 10 ? filteredApis : aidotApiRows;
  const tableColumns = "44px 120px 260px minmax(280px, 1fr) 110px 130px 160px 140px";
  const renderApiRows = (rows) => {
    if (!rows.length) {
      return "";
    }
    return rows
      .map((api) => {
        const methodCount = api.methodCount || (Array.isArray(api.methods) ? api.methods.length : 1);
        const usageCount = api.usageCount ?? api.usage_count ?? 0;
        return `
          <div class="data-grid__row">
            <div class="data-grid__cell"><input type="checkbox" aria-label="${escapeText(api.name || "")} 선택" /></div>
            <div class="data-grid__cell">API</div>
            <div class="data-grid__cell"><a href="#">${escapeText(api.name || "-")}</a></div>
            <div class="data-grid__cell">${escapeText(api.base_url || api.endpoint_url || "-")}</div>
            <div class="data-grid__cell">${methodCount}</div>
            <div class="data-grid__cell">${usageCount}</div>
            <div class="data-grid__cell">${normalizeDateText(api.updated_at || api.updatedAt || api.updated_at_text || "2026-05-03 09:46")}</div>
            <div class="data-grid__cell">${escapeText(api.updated_by || api.updatedBy || "aidot_1")}</div>
          </div>
        `;
      })
      .join("");
  };
  const renderApiPage = (rows) => `
    <section class="manual-main api-store-page group-api-page">
      <header class="studio-table-page__title-row">
        <h1>API</h1>
      </header>
      <div class="studio-table-page__search-row">
        <label class="studio-table-page__search">
          <span aria-hidden="true">⌕</span>
          <input type="text" placeholder="API 이름, 상세설명, 목적지 Base URL을 검색하세요." />
        </label>
        <button type="button" class="studio-table-page__filter" aria-label="필터">▾</button>
        <div class="studio-table-page__search-actions">
          <button type="button" class="studio-table-page__primary" data-api-add>+ API 등록</button>
          <button type="button" class="studio-table-page__ghost studio-table-page__more" aria-label="더보기">⋮</button>
        </div>
      </div>
      <div class="studio-table-page__toolbar">
        <div class="studio-table-page__toolbar-left">
          <strong>전체 ${rows.length}건</strong>
          <label class="manual-main__mini-select manual-main__mini-select--select">
            ${renderWorkflowPageSize("api-answer-source", adminTablePageSizeByKey["api-answer-source"] || 10)}
          </label>
          <button type="button" class="studio-table-page__ghost">삭제</button>
        </div>
      </div>
      <div class="data-grid data-grid--studio" style="--data-grid-template:${tableColumns}">
        <div class="data-grid__row data-grid__row--header">
          <div class="data-grid__cell"><input type="checkbox" aria-label="전체 선택" /></div>
          <div class="data-grid__cell">구분 ↕</div>
          <div class="data-grid__cell">API 이름 ↕</div>
          <div class="data-grid__cell">목적지 Base URL ↕</div>
          <div class="data-grid__cell">메서드 수 ↕</div>
          <div class="data-grid__cell">사용중인 의도 ↕</div>
          <div class="data-grid__cell">최종수정일시 ↕</div>
          <div class="data-grid__cell">최종수정자 ↕</div>
        </div>
        ${renderApiRows(rows)}
      </div>
      <div class="studio-table-page__pagination">
        <button type="button" disabled>◀</button>
        <button type="button" disabled>‹</button>
        <button type="button" class="is-active">1</button>
        <button type="button" disabled>›</button>
        <button type="button" disabled>▶</button>
      </div>
      <input data-api-name value="JSONPlaceholder 게시글" hidden />
      <input data-api-endpoint value="https://api.jsonplaceholder.dev" hidden />
      <input data-api-response-path value="data.answer" hidden />
      <select data-api-group hidden>${groups.map((group) => `<option value="${group.id}" ${group.id === currentApiGroupId ? "selected" : ""}>${group.name}</option>`).join("")}</select>
      <select data-api-bot hidden>${bots.map((bot) => `<option value="${bot.id}" ${bot.id === currentApiBotId ? "selected" : ""}>${bot.name}</option>`).join("")}</select>
      <span data-api-owner-meta hidden></span>
      <div data-api-registry hidden></div>
    </section>
  `;
  if (apiSection) {
    apiSection.innerHTML = renderApiPage(visibleApis);
    bindWorkflowTableControls(apiSection, "api-answer-source");
    bindAccessManagementControls();
  } else if (apiRegistry) {
    apiRegistry.innerHTML = renderApiRows(visibleApis);
    bindWorkflowTableControls(apiRegistry, "api-answer-source");
    bindAccessManagementControls();
  }
  refreshApiRegistryFromServer()
    .then((loaded) => {
      if (loaded) {
        const nextItems = currentApiRegistry.filter((api) => api.group_id === currentApiGroupId && api.bot_id === currentApiBotId);
        const nextVisibleItems = nextItems.length >= 10 ? nextItems : aidotApiRows;
        if (apiSection) {
          apiSection.innerHTML = renderApiPage(nextVisibleItems);
          bindWorkflowTableControls(apiSection, "api-answer-source");
          bindAccessManagementControls();
        } else if (apiRegistry) {
          apiRegistry.innerHTML = renderApiRows(nextVisibleItems);
          bindWorkflowTableControls(apiRegistry, "api-answer-source");
          bindAccessManagementControls();
        }
        document.dispatchEvent(new CustomEvent("cga:content-rendered"));
      }
    })
    .catch(() => {});
}

function rerenderAdminAndAccess() {
  renderGlobalMessage();
  syncStudioLocaleToCurrentUser();
  renderWorkspaceHome();
  renderCollaborationSummary();
  renderTeamDashboard();
  renderAccessPanels();
  refreshAdminResourcesFromServer().then(() => renderAccessPanels()).catch(() => {});
  renderApiRegistry();
  document.dispatchEvent(new CustomEvent("cga:content-rendered"));
}

function bindAccessManagementControls() {
  document.querySelectorAll("[data-select-user]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      selectedAccessUserId = button.dataset.selectUser;
      accessUserModalOpen = true;
      renderAccessPanels();
    });
  });
  document.querySelectorAll("[data-user-modal-close]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      accessUserModalOpen = false;
      renderAccessPanels();
    });
  });
  document.querySelectorAll("[data-user-modal]").forEach((modal) => {
    if (modal.dataset.bound === "true") return;
    modal.dataset.bound = "true";
    modal.addEventListener("click", (event) => {
      if (event.target !== modal) return;
      accessUserModalOpen = false;
      renderAccessPanels();
    });
  });
  document.querySelectorAll("[data-user-page-size]").forEach((select) => {
    if (select.dataset.bound === "true") return;
    select.dataset.bound = "true";
    select.addEventListener("change", () => {
      userListPageSize = Number(select.value) || 10;
      userListPage = 1;
      renderAccessPanels();
    });
  });
  document.querySelectorAll("[data-user-page-first]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      userListPage = 1;
      renderAccessPanels();
    });
  });
  document.querySelectorAll("[data-user-page-prev]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      userListPage = Math.max(1, userListPage - 1);
      renderAccessPanels();
    });
  });
  document.querySelectorAll("[data-user-page-next]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      userListPage += 1;
      renderAccessPanels();
    });
  });
  document.querySelectorAll("[data-user-page-last]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      userListPage = Number(button.dataset.userPageLast) || 1;
      renderAccessPanels();
    });
  });
  document.querySelectorAll("[data-select-group]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      selectedAccessGroupId = button.dataset.selectGroup;
      accessGroupModalOpen = true;
      renderAccessPanels();
    });
  });
  document.querySelectorAll("[data-group-modal-close]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      accessGroupModalOpen = false;
      renderAccessPanels();
    });
  });
  document.querySelectorAll("[data-group-modal]").forEach((modal) => {
    if (modal.dataset.bound === "true") return;
    modal.dataset.bound = "true";
    modal.addEventListener("click", (event) => {
      if (event.target !== modal) return;
      accessGroupModalOpen = false;
      renderAccessPanels();
    });
  });
  document.querySelectorAll("[data-group-page-size]").forEach((select) => {
    if (select.dataset.bound === "true") return;
    select.dataset.bound = "true";
    select.addEventListener("change", () => {
      groupListPageSize = Number(select.value) || 10;
      groupListPage = 1;
      renderAccessPanels();
    });
  });
  document.querySelectorAll("[data-group-page-first]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      groupListPage = 1;
      renderAccessPanels();
    });
  });
  document.querySelectorAll("[data-group-page-prev]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      groupListPage = Math.max(1, groupListPage - 1);
      renderAccessPanels();
    });
  });
  document.querySelectorAll("[data-group-page-next]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      groupListPage += 1;
      renderAccessPanels();
    });
  });
  document.querySelectorAll("[data-group-page-last]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      groupListPage = Number(button.dataset.groupPageLast) || 1;
      renderAccessPanels();
    });
  });
  document.querySelectorAll("[data-user-search-reset]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const search = document.querySelector("[data-user-search]");
      const groupFilter = document.querySelector("[data-user-group-filter]");
      const roleFilter = document.querySelector("[data-user-role-filter]");
      const statusFilter = document.querySelector("[data-user-status-filter]");
      const signupFilter = document.querySelector("[data-user-signup-filter]");
      if (search) search.value = "";
      if (groupFilter) groupFilter.value = "all";
      if (roleFilter) roleFilter.value = "all";
      if (statusFilter) statusFilter.value = "all";
      if (signupFilter) signupFilter.value = "all";
      userListPage = 1;
      renderAccessPanels();
    });
  });
  document.querySelectorAll("[data-group-search-reset]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const search = document.querySelector("[data-group-search]");
      const statusFilter = document.querySelector("[data-group-status-filter]");
      if (search) search.value = "";
      if (statusFilter) statusFilter.value = "active";
      groupListPage = 1;
      renderAccessPanels();
    });
  });
  [
    "[data-user-search]",
    "[data-user-group-filter]",
    "[data-user-role-filter]",
    "[data-user-status-filter]",
    "[data-user-signup-filter]",
    "[data-group-search]",
    "[data-group-status-filter]"
  ].forEach((selector) => {
    const control = document.querySelector(selector);
    if (!control || control.dataset.bound === "true") return;
    control.dataset.bound = "true";
    control.addEventListener("change", () => {
      if (selector.startsWith("[data-user-")) userListPage = 1;
      if (selector.startsWith("[data-group-")) groupListPage = 1;
      renderAccessPanels();
    });
    control.addEventListener("input", () => {
      if (control.tagName === "INPUT") {
        if (selector.startsWith("[data-user-")) userListPage = 1;
        if (selector.startsWith("[data-group-")) groupListPage = 1;
        renderAccessPanels();
      }
    });
  });
  document.querySelectorAll("[data-inline-role-save]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const userId = button.dataset.inlineRoleSave;
      const groupId = button.dataset.inlineRoleGroupSave;
      const requestId = button.dataset.inlineRequestSave || "";
      const targetGroupId = document.querySelector(`[data-inline-group-user="${userId}"]`)?.value || groupId;
      const role = document.querySelector(`[data-inline-role-user="${userId}"][data-inline-role-group="${groupId}"]`)?.value;
      if (!userId || !targetGroupId || !role) return;
      await runAccessServerAction(
        () => requestCgaJson(requestId ? `/api/cga/groups/join-requests/${encodeURIComponent(requestId)}/approve` : `/api/cga/groups/${encodeURIComponent(targetGroupId)}/members/${encodeURIComponent(userId)}/role`, {
          method: requestId ? "POST" : "PATCH",
          body: requestId ? { group_id: targetGroupId, requested_role: role } : { role }
        }),
        () => {
          currentAccessState = requestId
            ? approveGroupJoinRequest(currentAccessState, { requestId, reviewerId: currentAccessState.currentUserId, groupId: targetGroupId, requestedRole: role })
            : updateGroupMembershipRole(currentAccessState, { actorId: currentAccessState.currentUserId, userId, groupId: targetGroupId, role });
          accessUserModalOpen = false;
        }
      );
    });
  });
}

function bindAdminActionButtons() {
  document.querySelectorAll("[data-approve-join]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const groupId = document.querySelector(`[data-approval-group="${button.dataset.approveJoin}"]`)?.value;
      const requestedRole = document.querySelector(`[data-approval-role="${button.dataset.approveJoin}"]`)?.value;
      await runAccessServerAction(
        () => requestCgaJson(`/api/cga/groups/join-requests/${encodeURIComponent(button.dataset.approveJoin)}/approve`, {
          method: "POST",
          body: {
            group_id: groupId,
            requested_role: requestedRole
          }
        }),
        () => {
          currentAccessState = approveGroupJoinRequest(currentAccessState, {
            requestId: button.dataset.approveJoin,
            reviewerId: currentAccessState.currentUserId,
            groupId,
            requestedRole
          });
        }
      );
    });
  });
  document.querySelectorAll("[data-approve-admin]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const groupId = document.querySelector(`[data-admin-approval-group="${button.dataset.approveAdmin}"]`)?.value;
      const requestedRole = document.querySelector(`[data-admin-approval-role="${button.dataset.approveAdmin}"]`)?.value;
      await runAccessServerAction(
        () => requestCgaJson(`/api/cga/admin/permission-requests/${encodeURIComponent(button.dataset.approveAdmin)}/approve`, {
          method: "POST",
          body: {
            group_id: groupId,
            requested_role: requestedRole
          }
        }),
        () => {
          currentAccessState = approveAdminPermissionRequest(currentAccessState, {
            requestId: button.dataset.approveAdmin,
            reviewerId: currentAccessState.currentUserId,
            groupId,
            requestedRole
          });
        }
      );
    });
  });
}

function bindAdminWorkbench() {
  const loginSubmit = document.querySelector("[data-login-submit]");
  const entryLoginSubmit = document.querySelector("[data-entry-login-submit]");
  const entrySignupSubmit = document.querySelector("[data-entry-signup-submit]");
  const loginUser = document.querySelector("[data-login-user]");
  const entryLoginId = document.querySelector("[data-entry-login-id]");
  const entryRememberId = document.querySelector("[data-entry-remember-id]");
  const entryLocale = document.querySelector("[data-entry-locale]");
  const entrySignupLocale = document.querySelector("[data-entry-signup-locale]");
  const logoutSubmit = document.querySelector("[data-logout-submit]");
  const topLogoutSubmit = document.querySelector("[data-top-logout-submit]");
  const signupSubmit = document.querySelector("[data-signup-submit]");
  const groupCreate = document.querySelector("[data-group-create]");
  const joinSubmit = document.querySelector("[data-join-submit]");
  const apiGroup = document.querySelector("[data-api-group]");
  const apiBot = document.querySelector("[data-api-bot]");
  const apiAdd = document.querySelector("[data-api-add]");
  if (loginUser && loginUser.dataset.bound !== "true") {
    loginUser.dataset.bound = "true";
    loginUser.addEventListener("change", () => {
      const loginId = document.querySelector("[data-login-id]");
      if (loginId) loginId.value = loginUser.value || "";
    });
  }
  if (entryLoginId && !entryLoginId.value) entryLoginId.value = localStorage.getItem(LOGIN_ID_STORAGE_KEY) || "";
  if (entryLocale) entryLocale.value = getCurrentLocale();
  if (entrySignupLocale) entrySignupLocale.value = getCurrentLocale();
  document.querySelectorAll("[data-entry-auth-tab]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => setEntryAuthMode(button.dataset.entryAuthTab));
  });
  const openSignup = document.querySelector("[data-entry-open-signup]");
  if (openSignup && openSignup.dataset.bound !== "true") {
    openSignup.dataset.bound = "true";
    openSignup.addEventListener("click", () => setEntryAuthMode("signup"));
  }
  const openLogin = document.querySelector("[data-entry-open-login]");
  if (openLogin && openLogin.dataset.bound !== "true") {
    openLogin.dataset.bound = "true";
    openLogin.addEventListener("click", () => setEntryAuthMode("login"));
  }
  if (entryLocale && entryLocale.dataset.bound !== "true") {
    entryLocale.dataset.bound = "true";
    entryLocale.addEventListener("change", () => {
      document.querySelector("[data-locale-select]").value = entryLocale.value;
      window.cgaStudioI18n?.setLocale?.(entryLocale.value);
      applyDynamicLocaleOverrides(entryLocale.value);
    });
  }
  if (entrySignupLocale && entrySignupLocale.dataset.bound !== "true") {
    entrySignupLocale.dataset.bound = "true";
    entrySignupLocale.addEventListener("change", () => {
      document.querySelector("[data-locale-select]").value = entrySignupLocale.value;
      window.cgaStudioI18n?.setLocale?.(entrySignupLocale.value);
      applyDynamicLocaleOverrides(entrySignupLocale.value);
    });
  }
  const runLogin = async ({ userId, password }) => {
    if (!userId || !password) {
      setAuthMessage("error", "admin.loginFailedTitle", "errors.auth.loginFailed");
      rerenderAdminAndAccess();
      applyScreenLayout();
      return;
    }
    try {
      const session = await requestCgaJson("/api/cga/auth/login", { method: "POST", body: { user_id: userId, password } });
      rememberAuthSession(session);
      if (entryRememberId?.checked) localStorage.setItem(LOGIN_ID_STORAGE_KEY, userId);
      if (entryRememberId && !entryRememberId.checked) localStorage.removeItem(LOGIN_ID_STORAGE_KEY);
      clearAuthMessage();
      currentAccessState = { ...currentAccessState, currentUserId: session.user?.id || userId };
      await refreshAccessStateFromServer();
      postAuthDefaultScreenPending = true;
      activeScreenId = DEFAULT_ACTIVE_SCREEN_ID;
      history.replaceState(null, "", `#${DEFAULT_ACTIVE_SCREEN_ID}`);
      applyScreenLayout();
      rerenderAdminAndAccess();
      queuePostLoginLandingScreen();
    } catch (error) {
      if (error.status) {
        setAuthMessage("error", "admin.loginFailedTitle", getCgaErrorMessage(error, t("errors.auth.loginFailed", "Login failed.")));
        rerenderAdminAndAccess();
        return;
      }
      currentAccessState = loginAsUser(currentAccessState, { userId });
      postAuthDefaultScreenPending = true;
      activeScreenId = DEFAULT_ACTIVE_SCREEN_ID;
      history.replaceState(null, "", `#${DEFAULT_ACTIVE_SCREEN_ID}`);
      applyScreenLayout();
      rerenderAdminAndAccess();
      queuePostLoginLandingScreen();
    }
  };
  if (loginSubmit && loginSubmit.dataset.bound !== "true") {
    loginSubmit.dataset.bound = "true";
    loginSubmit.addEventListener("click", async () => {
      const selectedUserId = document.querySelector("[data-login-user]")?.value;
      const userId = document.querySelector("[data-login-id]")?.value?.trim() || selectedUserId;
      const password = document.querySelector("[data-login-password]")?.value || "";
      await runLogin({ userId, password });
    });
  }
  if (entryLoginSubmit && entryLoginSubmit.dataset.bound !== "true") {
    entryLoginSubmit.dataset.bound = "true";
    entryLoginSubmit.addEventListener("click", async () => {
      const userId = document.querySelector("[data-entry-login-id]")?.value?.trim();
      const password = document.querySelector("[data-entry-login-password]")?.value || "";
      await runLogin({ userId, password });
    });
  }
  const entryLoginPassword = document.querySelector("[data-entry-login-password]");
  if (entryLoginPassword && entryLoginPassword.dataset.bound !== "true") {
    entryLoginPassword.dataset.bound = "true";
    entryLoginPassword.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter") return;
      const userId = document.querySelector("[data-entry-login-id]")?.value?.trim();
      const password = document.querySelector("[data-entry-login-password]")?.value || "";
      await runLogin({ userId, password });
    });
  }
  const runLogout = async () => {
    try {
      await requestCgaJson("/api/cga/auth/logout", { method: "POST" });
    } catch {
    }
    clearAuthSession();
    setAuthMessage("info", "admin.logoutTitle", "admin.logoutSuccess");
    currentAccessState = loginAsUser(currentAccessState, { userId: "admin" });
    postAuthDefaultScreenPending = false;
    activeScreenId = "";
    history.replaceState(null, "", "#");
    applyScreenLayout();
    rerenderAdminAndAccess();
  };
  if (logoutSubmit && logoutSubmit.dataset.bound !== "true") {
    logoutSubmit.dataset.bound = "true";
    logoutSubmit.addEventListener("click", runLogout);
  }
  if (topLogoutSubmit && topLogoutSubmit.dataset.bound !== "true") {
    topLogoutSubmit.dataset.bound = "true";
    topLogoutSubmit.addEventListener("click", runLogout);
  }
  if (signupSubmit && signupSubmit.dataset.bound !== "true") {
    signupSubmit.dataset.bound = "true";
    signupSubmit.addEventListener("click", async () => {
      const id = document.querySelector("[data-signup-id]")?.value?.trim();
      const name = document.querySelector("[data-signup-name]")?.value?.trim();
      const password = document.querySelector("[data-signup-password]")?.value || "";
      if (!id || !name || !password) return;
      const locale = document.querySelector("[data-signup-locale]")?.value || "en";
      const groupId = currentAccessState.policy?.signupDefaultGroupId || "g-support";
      try {
        const session = await requestCgaJson("/api/cga/auth/signup", {
          method: "POST",
          body: {
            user_id: id,
            name,
            password,
            locale,
            group_id: groupId,
            requested_role: "viewer"
          }
        });
        rememberAuthSession(session);
        clearAuthMessage();
        currentAccessState = { ...currentAccessState, currentUserId: session.user?.id || id };
        await refreshAccessStateFromServer();
        rerenderAdminAndAccess();
      } catch (error) {
        if (error.status) {
          setAuthMessage("error", "admin.signupFailedTitle", getCgaErrorMessage(error, t("errors.auth.signupRequired", "Signup failed.")));
          rerenderAdminAndAccess();
          return;
        }
        currentAccessState = applySignup(currentAccessState, { userId: id, name, locale, groupId, requestedRole: "viewer" });
        rerenderAdminAndAccess();
      }
    });
  }
  const runSignup = async ({ id, name, password, locale, groupId }) => {
    if (!id || !name || !password) {
      setAuthMessage("error", "admin.signupFailedTitle", "errors.auth.signupRequired");
      renderEntryAuthMessage();
      return;
    }
    try {
      const session = await requestCgaJson("/api/cga/auth/signup", {
        method: "POST",
        body: {
          user_id: id,
          name,
          password,
          locale,
          group_id: groupId || currentAccessState.policy?.signupDefaultGroupId || "g-support",
          requested_role: "viewer"
        }
      });
      rememberAuthSession(session);
      clearAuthMessage();
      currentAccessState = { ...currentAccessState, currentUserId: session.user?.id || id };
      await refreshAccessStateFromServer();
      applyScreenLayout();
      rerenderAdminAndAccess();
    } catch (error) {
      if (error.status) {
        setAuthMessage("error", "admin.signupFailedTitle", getCgaErrorMessage(error, t("errors.auth.signupRequired", "Signup failed.")));
        renderEntryAuthMessage();
        rerenderAdminAndAccess();
        return;
      }
      currentAccessState = applySignup(currentAccessState, {
        userId: id,
        name,
        locale,
        groupId: groupId || currentAccessState.policy?.signupDefaultGroupId || "g-support",
        requestedRole: "viewer"
      });
      applyScreenLayout();
      rerenderAdminAndAccess();
    }
  };
  if (entrySignupSubmit && entrySignupSubmit.dataset.bound !== "true") {
    entrySignupSubmit.dataset.bound = "true";
    entrySignupSubmit.addEventListener("click", async () => {
      await runSignup({
        id: document.querySelector("[data-entry-signup-id]")?.value?.trim(),
        name: document.querySelector("[data-entry-signup-name]")?.value?.trim(),
        password: document.querySelector("[data-entry-signup-password]")?.value || "",
        locale: document.querySelector("[data-entry-signup-locale]")?.value || getCurrentLocale(),
        groupId: document.querySelector("[data-entry-signup-group]")?.value || currentAccessState.policy?.signupDefaultGroupId || "g-support"
      });
    });
  }
  if (groupCreate && groupCreate.dataset.bound !== "true") {
    groupCreate.dataset.bound = "true";
    groupCreate.addEventListener("click", async () => {
      const id = document.querySelector("[data-group-id]")?.value?.trim();
      const name = document.querySelector("[data-group-name]")?.value?.trim();
      if (!id || !name) return;
      await runAccessServerAction(
        () => requestCgaJson("/api/cga/groups", { method: "POST", body: { group_id: id, name } }),
        () => {
          currentAccessState = createManagedGroup(currentAccessState, { id, name, actorId: currentAccessState.currentUserId });
        }
      );
    });
  }
  if (joinSubmit && joinSubmit.dataset.bound !== "true") {
    joinSubmit.dataset.bound = "true";
    joinSubmit.addEventListener("click", async () => {
      const id = `jr-${Date.now()}`;
      const groupId = document.querySelector("[data-join-group]")?.value;
      const requestedRole = document.querySelector("[data-join-role]")?.value || "viewer";
      await runAccessServerAction(
        () => requestCgaJson("/api/cga/groups/join-requests", {
          method: "POST",
          body: {
            id,
            group_id: groupId,
            requested_role: requestedRole
          }
        }),
        () => {
          currentAccessState = requestGroupJoin(currentAccessState, {
            id,
            userId: currentAccessState.currentUserId,
            groupId,
            requestedRole
          });
        }
      );
    });
  }
  if (apiAdd && apiAdd.dataset.bound !== "true") {
    apiAdd.dataset.bound = "true";
    apiAdd.addEventListener("click", async () => {
      if (!canManageApiAnswerForCurrentSelection()) return;
      const name = document.querySelector("[data-api-name]")?.value?.trim();
      const endpoint = document.querySelector("[data-api-endpoint]")?.value?.trim();
      if (!name || !endpoint) return;
      const draft = createGroupManagedApiAnswerDraft({ groupId: currentApiGroupId, botId: currentApiBotId });
      const api = {
        ...draft,
        name,
        endpoint_url: endpoint,
        method: "GET",
        auth_type: "none",
        response_path: document.querySelector("[data-api-response-path]")?.value?.trim() || "data.answer"
      };
      try {
        await saveApiAnswerToServer(api);
        await refreshApiRegistryFromServer();
      } catch (error) {
        if (error.status) {
          showApiErrorMessage(error, "message.actionForbiddenTitle");
        } else {
        currentApiRegistry = [...currentApiRegistry, api];
        }
      }
      rerenderAdminAndAccess();
    });
  }
  if (apiGroup && apiGroup.dataset.bound !== "true") {
    apiGroup.dataset.bound = "true";
    apiGroup.addEventListener("change", () => {
      currentApiGroupId = apiGroup.value;
      currentApiBotId = getBotsForGroup(currentApiGroupId)[0]?.id || "";
      renderApiRegistry();
    });
  }
  if (apiBot && apiBot.dataset.bound !== "true") {
    apiBot.dataset.bound = "true";
    apiBot.addEventListener("change", () => {
      currentApiBotId = apiBot.value;
      renderApiRegistry();
    });
  }
}

function bindAccessNavigationGuard() {
  document.querySelectorAll(".management-nav a, .server-sub-nav a, .system-admin-subnav a, [data-workflow-nav] a").forEach((link) => {
    if (link.dataset.guardBound === "true") return;
    link.dataset.guardBound = "true";
    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (link.classList.contains("access-blocked")) {
        return;
      }
      if (link.dataset.adminSubview) {
        currentSystemAdminSubview = link.dataset.adminSubview;
      }
      const nextScreenId = link.getAttribute("href")?.replace("#", "");
      if (!nextScreenId) return;
      setActiveScreen(nextScreenId);
    });
  });
}

function setActiveScreen(screenId, { replaceHash = false } = {}) {
  const visibleIds = getVisibleLayout().map((item) => item.id);
  if (!visibleIds.includes(screenId)) return;
  activeScreenId = screenId;
  localStorage.setItem(LAST_SCREEN_STORAGE_KEY, activeScreenId);
  if (replaceHash) {
    history.replaceState(null, "", `#${screenId}`);
  } else {
    history.pushState(null, "", `#${screenId}`);
  }
  applyScreenLayout();
}

function refreshWorkspaceManagementSurfaces({ rerenderAdmin = false } = {}) {
  renderWorkspaceHome();
  renderBotManagement();
  renderAllStatePanels();
  renderTopContext();
  renderGlobalMessage();
  if (rerenderAdmin) rerenderAdminAndAccess();
  document.dispatchEvent(new CustomEvent("cga:content-rendered"));
}

function syncTopActionsForScreen() {
  const topSave = document.querySelector("[data-top-save]");
  const topPreview = document.querySelector("[data-top-preview]");
  const topDeploy = document.querySelector("[data-deploy-action]");
  const deployScreens = new Set(["operate"]);
  if (topSave) {
    topSave.hidden = false;
    topSave.disabled = false;
  }
  if (topPreview) {
    topPreview.hidden = true;
    topPreview.disabled = true;
  }
  if (topDeploy) {
    const allowDeploy = deployScreens.has(activeScreenId);
    topDeploy.hidden = !allowDeploy;
    topDeploy.disabled = !allowDeploy;
  }
}

function queuePostLoginLandingScreen() {
  const applyLanding = () => {
    activeScreenId = DEFAULT_ACTIVE_SCREEN_ID;
    setActiveScreen(DEFAULT_ACTIVE_SCREEN_ID, { replaceHash: true });
  };
  applyLanding();
  window.setTimeout(applyLanding, 50);
  window.setTimeout(applyLanding, 250);
}

async function saveCurrentWorkspaceState() {
  let synced = false;
  try {
    const studioSaved = await saveStudioStateToServer().catch(() => false);
    const compositionSaved = await saveCompositionToServer().catch(() => false);
    const detailSaved = await saveDetailAssetsToServer().catch(() => false);
    synced = Boolean(studioSaved || compositionSaved || detailSaved);
    saveWorkspaceSnapshot();
    setGlobalMessage("success", "저장 완료", synced ? "현재 작업 내용을 서버에 저장했습니다." : "현재 작업 내용을 로컬에 저장했습니다.");
  } catch (error) {
    saveWorkspaceSnapshot();
    setGlobalMessage("error", "저장 실패", error?.message || "현재 작업 내용을 저장하지 못했습니다.");
  }
  renderTopContext();
  renderCreateSummary();
  renderWorkspaceHome();
  renderBotManagement();
  renderGlobalMessage();
}

async function syncSelectedBotServerState(groupId = currentWorkspaceGroupId, botId = currentWorkspaceBotId) {
  if (!groupId || !botId) return;
  await refreshOperationsStateFromServer(groupId, botId).catch(() => false);
  await refreshCollaborationStateFromServer(groupId, botId).catch(() => false);
  await refreshApiRegistryFromServer().catch(() => false);
}

function renderWorkspaceHome() {
  const section = document.querySelector('[data-screen-id="workspace-home"]');
  if (!section) return;
  const { groups, bots: syncedBots } = syncWorkspaceSelection();
  const groupOptions = groups.map((group) => `<option value="${escapeText(group.id)}" ${group.id === currentWorkspaceGroupId ? "selected" : ""}>${escapeText(group.name)}</option>`).join("");
  const accessibleBots = syncedBots;
  const currentGroup = getCurrentWorkspaceGroup();
  const currentBot = getCurrentWorkspaceBot();
  const recentBots = getRecentWorkspaceBotsByGroup(currentWorkspaceGroupId);
  const currentBotLabel = currentBot ? `${currentBot.name} (${currentBot.id})` : "없음";
  const shell = renderWorkflowScreenShell(
    "workspace-home",
    "BOT",
    "봇 작업공간",
    "그룹을 선택하고 작업할 봇을 고른 뒤 작업 흐름을 시작합니다.",
    `<div class="cga-command-page workspace-command-page">
      <section class="command-summary">
        <article>
          <strong>그룹 선택</strong>
          <select data-workspace-group>${groupOptions}</select>
        </article>
        <article>
          <strong>그룹 내 접근 봇</strong>
          <span>${accessibleBots.length}개</span>
        </article>
        <article>
          <strong>현재 작업 봇</strong>
          <span>${escapeText(currentBotLabel)}</span>
        </article>
        <article>
          <strong>최근 작업</strong>
          <span>${recentBots.length}개</span>
        </article>
      </section>
      <section class="workspace-command-grid workspace-command-grid--workspace">
        <article class="command-panel command-panel--wide">
          <header>
            <div><strong>그룹 봇 목록</strong><span>${escapeText(currentGroup?.name || currentWorkspaceGroupId)} 안에서 작업할 봇을 선택합니다.</span></div>
            <button type="button" data-workspace-create ${canCreateBotInCurrentWorkspace() ? "" : "disabled"}>+ 봇 생성</button>
          </header>
          <div class="command-table" style="--command-cols:1.2fr 1.2fr .8fr .7fr .9fr .9fr .8fr">
            <div class="command-row command-row--head"><span>봇 ID</span><span>봇 이름</span><span>버전</span><span>상태</span><span>언어</span><span>마지막수정</span><span>작업</span></div>
            ${accessibleBots.map((bot) => `
              <button type="button" class="command-row command-row--button ${bot.id === currentWorkspaceBotId ? "selected" : ""} ${bot.id === currentWorkspaceBotId ? "command-row--highlighted" : ""}" data-open-bot="${escapeText(bot.id)}">
                <span>${escapeText(bot.id)}</span>
                <strong>${escapeText(bot.name)}</strong>
                <span>${escapeText(bot.version || "-")}</span>
                <span>${escapeText(bot.status || "-")}</span>
                <span>${escapeText(bot.locale || "-")}</span>
                <span>${escapeText(bot.updated_at || bot.created_at || "-")}</span>
                <span>${bot.id === currentWorkspaceBotId ? "작업중" : "열기"}</span>
              </button>
            `).join("") || `<div class="command-empty">이 그룹에 작업 가능한 봇이 없습니다. 새 봇을 생성해서 작업을 시작하세요.</div>`}
          </div>
          <div class="workspace-command-footer">
            <div class="workspace-command-footer__meta">
              <span>선택 그룹</span>
              <strong>${escapeText(currentGroup?.name || currentWorkspaceGroupId || "-")}</strong>
              <span>작업 가능 봇</span>
              <strong>${accessibleBots.length}개</strong>
            </div>
            <button type="button" data-workspace-open-current ${currentBot ? "" : "disabled"}>작업 봇 열기</button>
          </div>
        </article>
        <aside class="command-panel">
          <header><div><strong>현재 작업 대상</strong><span>선택된 봇 기준으로 Aidot 호환 제작 흐름이 시작됩니다.</span></div></header>
          <dl class="command-definition">
            <div><dt>그룹</dt><dd>${escapeText(currentGroup?.name || currentWorkspaceGroupId)}</dd></div>
            <div><dt>봇</dt><dd>${escapeText(currentBot?.name || "-")}</dd></div>
            <div><dt>버전</dt><dd>${escapeText(currentBot?.version || currentStudioState.bot.version || "-")}</dd></div>
            <div><dt>상태</dt><dd>${escapeText(currentBot?.status || "-")}</dd></div>
            <div><dt>언어</dt><dd>${escapeText(currentBot?.locale || currentStudioState.bot.defaultLocale || "-")}</dd></div>
            <div><dt>마지막 작업</dt><dd>${escapeText(currentBot?.updated_at || "없음")}</dd></div>
          </dl>
          <div class="command-action-stack">
            <button type="button" data-jump-screen="configure">봇 설정 열기</button>
            <button type="button" data-jump-screen="detail">봇 구성 열기</button>
            <button type="button" data-jump-screen="bot-management">봇 관리 열기</button>
          </div>
          <div class="workspace-recent-list">
            <strong>최근 작업 봇</strong>
            <div class="command-table" style="--command-cols:1.5fr 1fr .9fr .8fr 1.1fr">
              <div class="command-row command-row--head"><span>봇</span><span>ID</span><span>버전</span><span>상태</span><span>작업시각</span></div>
              ${recentBots.length ? recentBots.map((item) => `
                <button type="button" class="command-row command-row--button" data-open-recent-bot="${escapeText(item.botId)}">
                  <span>${escapeText(item.name)}</span>
                  <span>${escapeText(item.botId)}</span>
                  <span>${escapeText(item.version || "-")}</span>
                  <span>${item.botId === currentWorkspaceBotId ? "현재봇" : "열기"}</span>
                  <span>${escapeText(new Date(item.touchedAt || 0).toLocaleString())}</span>
                </button>
              `).join("") : `<div class="command-empty">최근 작업 목록 없음</div>`}
            </div>
          </div>
        </aside>
      </section>
    </div>`
  );
  if (!shell) return;
  shell.querySelector("[data-workspace-group]")?.addEventListener("change", (event) => {
    currentWorkspaceGroupId = event.target.value;
    renderWorkspaceHome();
    renderTopContext();
  });
  shell.querySelectorAll("[data-open-bot]").forEach((button) => button.addEventListener("click", async () => {
    const bot = getAccessibleBotListForGroup(currentWorkspaceGroupId).find((item) => item.id === button.dataset.openBot);
    if (!bot) return;
    currentWorkspaceBotId = bot.id;
    selectedBotManagementId = bot.id;
    applyCurrentBotToStudioState(bot);
    await syncSelectedBotServerState(currentWorkspaceGroupId, bot.id);
    refreshWorkspaceManagementSurfaces({ rerenderAdmin: true });
  }));
  shell.querySelectorAll("[data-open-recent-bot]").forEach((button) => button.addEventListener("click", async () => {
    const bot = accessibleBots.find((item) => item.id === button.dataset.openRecentBot);
    if (!bot) return;
    currentWorkspaceBotId = bot.id;
    selectedBotManagementId = bot.id;
    applyCurrentBotToStudioState(bot);
    await syncSelectedBotServerState(currentWorkspaceGroupId, bot.id);
    refreshWorkspaceManagementSurfaces({ rerenderAdmin: true });
  }));
  shell.querySelectorAll("[data-workspace-open-current]").forEach((button) => button.addEventListener("click", async () => {
    const bot = getCurrentWorkspaceBot();
    if (!bot) return;
    applyCurrentBotToStudioState(bot);
    await syncSelectedBotServerState(currentWorkspaceGroupId, bot.id);
    renderTopContext();
    setActiveScreen("configure");
  }));
  shell.querySelectorAll("[data-workspace-create]").forEach((button) => button.addEventListener("click", () => {
    setActiveScreen("create");
  }));
  shell.querySelectorAll("[data-jump-screen]").forEach((button) => {
    button.addEventListener("click", () => setActiveScreen(button.dataset.jumpScreen));
  });
}
function renderBotManagement() {
  const section = document.querySelector('[data-screen-id="bot-management"]');
  if (!section) return;
  syncWorkspaceSelection();
  const group = getCurrentWorkspaceGroup();
  const bots = currentWorkspaceBots.filter((bot) => String(bot.group_id || bot.groupId || "") === String(currentWorkspaceGroupId) && bot.status !== "deleted");
  const selected = bots.find((bot) => bot.id === selectedBotManagementId) || getCurrentWorkspaceBot() || bots[0] || {};
  if (!selectedBotManagementId && selected?.id) selectedBotManagementId = selected.id;
  if (!selectedBotManagementId && bots[0]?.id) selectedBotManagementId = bots[0].id;
  const selectedBot = bots.find((bot) => bot.id === selectedBotManagementId) || selected;
  const webchatUrl = `http://127.0.0.1:4173/webchat/${encodeURIComponent(selectedBot?.id || currentWorkspaceBotId || "bot")}`;
  const versions = getBotVersions(selectedBot);
  const activeVersion = versions.find((version) => version.isActive) || versions.find((version) => version.id === (selectedBot?.version || "")) || versions[0];
  const sortedVersions = versions.slice().sort((left, right) => {
    const leftTime = String(left?.updatedAt || "").toLowerCase();
    const rightTime = String(right?.updatedAt || "").toLowerCase();
    return rightTime.localeCompare(leftTime);
  });
  const canManage = canManageBotInCurrentWorkspace();
  const canDelete = canManage && bots.length > 1;
  const versionHeaderCols = "1fr .8fr 1.6fr .7fr 1.1fr .9fr .8fr";
  const transferNote = currentTransferStatus || getLatestTransferSummary() || "최근 패키지 전송 이력이 없습니다.";
  renderWorkflowScreenShell(
    "bot-management",
    "BM",
    "봇 관리",
    "봇 단위 자산/버전/운영 상태를 Aidot 호환 기준으로 관리합니다.",
    `<div class="cga-command-page bot-management-command-page">
      <section class="command-summary">
        <article><strong>그룹</strong><span>${escapeText(group?.name || currentWorkspaceGroupId || "-")}</span></article>
        <article><strong>봇 수</strong><span>${bots.length}개</span></article>
        <article><strong>선택 봇</strong><span>${escapeText(selectedBot?.name || selected?.name || "-")}</span></article>
        <article><strong>버전 항목</strong><span>${versions.length}개</span></article>
        <article><strong>운영 버전</strong><span>${escapeText(activeVersion?.id || selectedBot?.version || currentStudioState.bot.version || "v0.1")}</span></article>
      </section>
      <section class="bot-management-grid bot-management-grid--compact">
        <article class="command-panel">
          <header><div><strong>봇 목록 조회</strong><span>그룹 내 봇 목록과 기본 상태입니다.</span></div></header>
          <div class="bot-card-list">
            ${bots.map((bot) => `
              <button type="button" class="bot-select-card ${bot.id === (selectedBot?.id || selectedBotManagementId) ? "selected" : ""}" data-manage-bot="${escapeText(bot.id)}">
                <strong>${escapeText(bot.name)}</strong>
                <span>${escapeText(bot.id)} · ${escapeText(bot.version || "-")} · ${escapeText(bot.status || "-")}</span>
                <span>locale: ${escapeText(bot.locale || currentStudioState.bot.defaultLocale || "-")}</span>
              </button>
            `).join("") || `<div class="command-empty">관리할 봇이 없습니다.</div>`}
          </div>
          <div class="command-action-stack">
            <button type="button" data-create-bot-copy ${canManage ? "" : "disabled"}>봇 복사</button>
            <button type="button" data-delete-workspace-bot ${canDelete ? "" : "disabled"}>봇 삭제</button>
          </div>
        </article>
        <article class="command-panel command-panel--wide command-panel--wide-sticky">
          <header><div><strong>봇 자산 / 버전</strong><span>버전 목록, 복사, 삭제, 운영 버전 설정을 수행합니다.</span></div></header>
          <div class="command-table" style="--command-cols:${versionHeaderCols}">
            <div class="command-row command-row--head">
              <span>버전</span>
              <span>상태</span>
              <span>비고</span>
              <span>운영</span>
              <span>변경자</span>
              <span>최종수정</span>
              <span>작업</span>
            </div>
            ${sortedVersions.map((entry) => `
              <div class="command-row command-row--bot-version">
                <strong>${escapeText(entry.id)}</strong>
                <span>${escapeText(entry.status || "-")}</span>
                <span>${escapeText(entry.note || "-")}</span>
                <span>${entry.isActive ? "운영" : ""}${entry.id === activeVersion?.id ? "현재" : ""}</span>
                <span>${escapeText(entry.operator || "-")}</span>
                <span>${escapeText(entry.updatedAt || "-")}</span>
                <span class="team-task-actions">
                  <button type="button" data-bot-version-activate="${escapeText(entry.id)}" ${!canManage || entry.isActive ? "disabled" : ""}>운영 설정</button>
                  <button type="button" data-bot-version-copy="${escapeText(entry.id)}" ${canManage ? "" : "disabled"}>복사</button>
                  <button type="button" data-bot-version-delete="${escapeText(entry.id)}" ${canManage && sortedVersions.length > 1 ? "" : "disabled"}>삭제</button>
                </span>
              </div>
            `).join("") || `<div class="command-empty">버전 이력이 없습니다.</div>`}
          </div>
          <div class="command-action-stack">
            <button type="button" data-bot-version-add ${canManage ? "" : "disabled"}>버전 추가</button>
            <button type="button" data-version-download>버전 패키지 다운로드</button>
            <button type="button" data-version-upload>버전 패키지 업로드</button>
          </div>
        </article>
        <article class="command-panel command-panel--status-block command-panel--bot-detail">
          <header><div><strong>봇 상세 정보 및 호환 운영</strong><span>봇 단위 import/export와 WebChat 접속을 관리합니다.</span></div></header>
          <dl class="command-definition">
            <div><dt>봇 ID</dt><dd>${escapeText(selectedBot?.id || "-")}</dd></div>
            <div><dt>봇 이름</dt><dd>${escapeText(selectedBot?.name || "-")}</dd></div>
            <div><dt>운영버전</dt><dd>${escapeText(activeVersion?.id || selectedBot?.version || "-")}</dd></div>
            <div><dt>상태</dt><dd>${escapeText(selectedBot?.status || "-")}</dd></div>
            <div><dt>언어</dt><dd>${escapeText(selectedBot?.locale || currentStudioState.bot.defaultLocale || "-")}</dd></div>
            <div><dt>WebChat</dt><dd><a href="${escapeText(webchatUrl)}" target="_blank" rel="noreferrer" class="command-link">${escapeText(webchatUrl)}</a></dd></div>
            <div><dt>버전 목록</dt><dd>${versions.length}개</dd></div>
            <div><dt>업데이트</dt><dd>${escapeText(selectedBot?.updated_at || "없음")}</dd></div>
          </dl>
          <div class="command-action-stack">
            <button type="button" data-open-webchat><strong>WebChat 열기</strong><span>현재 봇 채널 연결</span></button>
            <button type="button" data-download-bot-package><strong>봇 다운로드</strong><span>Aidot 패키지</span></button>
            <button type="button" data-upload-bot-package><strong>봇 업로드</strong><span>Aidot 패키지 반영</span></button>
          </div>
          <div class="command-note" data-transfer-note>${escapeText(transferNote)}</div>
          <div class="command-history" data-transfer-history>
            <div><strong>전송 이력 불러오는 중</strong><span>최근 5건 패키지 전송 이력을 표시합니다.</span></div>
          </div>
        </article>
      </section>
    </div>`
  );
  section.querySelectorAll("[data-manage-bot]").forEach((button) => button.addEventListener("click", async () => {
    const bot = bots.find((item) => item.id === button.dataset.manageBot);
    if (bot) {
      applyCurrentBotToStudioState(bot);
    }
    selectedBotManagementId = button.dataset.manageBot;
    await syncSelectedBotServerState(currentWorkspaceGroupId, selectedBotManagementId);
    refreshWorkspaceManagementSurfaces({ rerenderAdmin: true });
  }));
  section.querySelectorAll("[data-jump-screen]").forEach((button) => button.addEventListener("click", () => setActiveScreen(button.dataset.jumpScreen)));
  section.querySelectorAll("[data-open-webchat]").forEach((button) => button.addEventListener("click", () => {
    const popup = window.open(webchatUrl, "_blank", "noopener,noreferrer");
    if (!popup) window.location.assign(webchatUrl);
  }));
  bindWorkspaceActions();
  refreshTransferHistory();
}
function renderConfigureAidotScreen() {
  const container = document.querySelector("[data-configure-aidot-screen]");
  if (!container) return;

  const renderAiModel = () => `
    <div class="aidot-settings-screen">
      <section class="aidot-settings-main aidot-settings-main--full">
        <div class="aidot-field-grid">
          <label>봇 이름 *<input value="테스트봇 - 시멘틱 RAG" /></label>
          <label>유형<input value="텍스트형" readonly /></label>
          <label>봇 ID<input value="828971ea-ec13-4f1b-944a-60f39936d9c3" readonly /></label>
          <label>최근 수정<input value="2026. 06. 02 19:01" readonly /></label>
        </div>
        <div class="aidot-field-grid five">
          <label>언어 *<input value="한국어" readonly /></label>
          <label>NLU 방식<input value="Semantic - Vector Worker" readonly /></label>
          <label>NLU 모델 *<input value="Aidot Vector Worker 기본 모델" readonly /></label>
          <label>답변 방식<input value="Semantic Engine RAG 답변" readonly /></label>
          <div class="profile-dots"><span></span><b></b><span></span></div>
        </div>
        <section class="aidot-setting-block">
          <header><strong>Intent Vector DB 연결</strong><span>Aidot Vector Worker 기본 연결을 사용합니다. 의도 벡터는 Local Vector DB에 저장됩니다.</span></header>
          <div class="rag-form-grid"><label>사용 여부<select><option>사용</option></select></label><label>Index 이름<input value="aidot-intent" /></label></div>
        </section>
        <section class="aidot-setting-block">
          <header><strong>Answer Vector DB 연결</strong><span>Aidot Vector Worker 기본 연결을 사용합니다. 답변 검색용 지식은 Answer Vector DB에 저장합니다.</span></header>
          <div class="rag-form-grid"><label>사용 여부<select><option>사용</option></select></label><label>Index 이름<input value="aidot-answer" /></label></div>
        </section>
        <section class="aidot-setting-block">
          <header><strong>구성 자동분류 가중치</strong><span>구성 화면의 의도 후보 분류에서 사전, 개체, 단어, 글자 조각, 조사/어미 반영 비율을 조정합니다.</span></header>
          <div class="aidot-weight-grid">
            <label>사전 대표어<input value="1.2" /></label><label>개체<input value="1.2" /></label><label>명사/동사<input value="1" /></label><label>글자 조각<input value="0.2" /></label><label>조사/어미<input value="0.05" /></label><label>대표어 일치 최소점수<input value="0.82" /></label>
          </div>
        </section>
        <label>소개<textarea>봇을 설명할 수 있는 소개 문장을 입력하세요.</textarea></label>
      </section>
    </div>
  `;

  const renderDefaults = () => `
    <div class="aidot-settings-screen">
      <section class="aidot-settings-main aidot-settings-main--full">
        <section class="aidot-setting-block">
          <header><strong>기본값 설정</strong><span>M/L, QA, 세션/대화 제어, 모듈 연결, 고급 설정을 분리해 관리합니다.</span></header>
          <div class="aidot-field-grid five">
            <label>봇 ID<input value="supportbot-draft" readonly /></label>
            <label>의도파악 Cut-off Score<input value="0.80" /></label>
            <label>유사의도 Score<input value="0.70" /></label>
            <label>의도파악결과 최대개수<input value="3" /></label>
            <label>답변 우선순위<select><option>M/L → QA</option><option>QA → M/L</option></select></label>
          </div>
        </section>
        <section class="aidot-setting-block">
          <header><strong>QA 설정</strong><span>FAQ Search, Extractive QA Search 기준 점수와 결과 개수를 설정합니다.</span></header>
          <div class="aidot-field-grid five">
            <label>FAQ Cut-off Score<input value="0.75" /></label>
            <label>Extractive QA Cut-off Score<input value="0.72" /></label>
            <label>검색결과 최대개수<input value="5" /></label>
            <label>FAQ 의도파악결과 최대개수<input value="3" /></label>
            <label>Extractive QA 의도파악결과 최대개수<input value="3" /></label>
          </div>
        </section>
        <section class="aidot-setting-block">
          <header><strong>세션 / 대화 제어</strong><span>타임아웃, 개체 반복, 의도파악 시도 횟수와 실패 시 모듈 연결을 정의합니다.</span></header>
          <div class="aidot-field-grid five">
            <label>타임아웃 사용<select><option>사용</option><option>미사용</option></select></label>
            <label>타임아웃 시간(초)<input value="300" /></label>
            <label>Push Message 타임아웃 적용<select><option>사용</option><option>미사용</option></select></label>
            <label>개체 질문 최대 반복 횟수<input value="2" /></label>
            <label>의도파악 시도 횟수<input value="3" /></label>
          </div>
          <div class="rag-form-grid">
            <label>의도파악 시도 횟수 초과시 실행할 모듈<input value="intent_overflow" readonly /></label>
            <label>모듈대화 목록<button type="button">모듈 목록</button></label>
          </div>
        </section>
        <section class="aidot-setting-block">
          <header><strong>모듈 연결 / 고급 설정</strong><span>전처리, 세션 종료 전, 다중 의도 버튼 모듈과 Validation Set, Oversampling, 버튼 선택 옵션을 설정합니다.</span></header>
          <div class="rag-form-grid">
            <label>전처리 모듈<input value="preprocess_start" readonly /></label>
            <label>Session End 전 실행할 모듈<input value="session_end_cleanup" readonly /></label>
            <label>다중 의도 버튼 추가 모듈<input value="multi_intent_helper" readonly /></label>
            <label>버튼 선택 옵션<select><option>Contains</option><option>Exact</option></select></label>
          </div>
          <div class="aidot-field-grid">
            <label>Validation Set 상태 설정<select><option>Random</option><option>Fixed</option></select></label>
            <label>Imbalance Oversampling 설정<select><option>사용</option><option>미사용</option></select></label>
            <label>TTS URL<input value="https://tts.example.com/voice" /></label>
            <label>사용자 응답 사이 최대 카드 수<input value="5" /></label>
          </div>
        </section>
      </section>
    </div>
  `;

  const renderMessages = () => `
    <div class="aidot-settings-screen">
      <section class="aidot-settings-main aidot-settings-main--full">
        <section class="aidot-setting-block">
          <header><strong>메시지 설정</strong><span>상황별 시스템 메시지 레지스트리를 관리합니다. 직접 입력 또는 모듈 연결 방식으로 저장합니다.</span></header>
          <div class="configure-message-list">
            ${[
              "첫 인사말",
              "사용자의 의도를 이해하지 못했을 경우 답변",
              "의도별 대화 종료시 안내 메시지",
              "버튼에 없는 값을 입력했을 경우 제공되는 메시지",
              "파악된 의도가 여러 개일 경우 안내 메시지",
              "'원하는 의도 없음' 버튼 표시명",
              "'원하는 의도 없음' 선택 시 메시지",
              "봇 동작 오류시 안내 메시지",
              "타임아웃 경과시 안내 메시지",
              "Session End 안내 메시지",
              "대화가 진행 중인 경우 안내 메시지",
              "의도 전환시도가 최대횟수를 초과했을 때 안내 메시지",
              "의도 전환 의사 질문 메시지 (의도명 전)",
              "의도 전환 의사 질문 메시지 (의도명 후)",
              "의도 복귀 실행 메시지"
            ].map((title, index) => `
              <div class="configure-message-item">
                <div class="configure-message-item__head"><strong>${title}</strong><label><input type="checkbox" ${index < 11 ? "checked" : ""} /> 사용</label></div>
                <textarea rows="2">${title} 예시 메시지</textarea>
              </div>
            `).join("")}
          </div>
        </section>
      </section>
    </div>
  `;

  const renderMessenger = () => `
    <div class="aidot-settings-screen">
      <section class="aidot-settings-main aidot-settings-main--full">
        <section class="aidot-setting-block">
          <header><strong>메신저 편의 기능</strong><span>플로팅 버튼과 추천 의도 순서를 관리합니다.</span></header>
          <div class="detail-asset-table">
            <div class="detail-asset-row head"><span>버튼명</span><span>연결 유형</span><span>값</span></div>
            <div class="detail-asset-row"><strong>상담원 연결</strong><span>Key</span><span>handoff_agent</span></div>
            <div class="detail-asset-row"><strong>최근 주문</strong><span>Command</span><span>/orders/latest</span></div>
          </div>
        </section>
        <section class="aidot-setting-block">
          <header><strong>추천 의도</strong><span>실제 의도 목록 기준으로 추천 의도와 노출 순서를 설정합니다.</span></header>
          <div class="detail-asset-table">
            <div class="detail-asset-row head"><span>순서</span><span>의도명</span><span>사용 여부</span></div>
            <div class="detail-asset-row"><strong>1</strong><span>password_reset</span><span>사용</span></div>
            <div class="detail-asset-row"><strong>2</strong><span>billing_question</span><span>사용</span></div>
          </div>
        </section>
      </section>
    </div>
  `;

  const renderBlocklist = () => `
    <div class="aidot-settings-screen">
      <section class="aidot-settings-main aidot-settings-main--full">
        <section class="aidot-setting-block">
          <header><strong>제외/무시 목록 설정</strong><span>목록과 테스트 문장을 기준으로 제외/무시 항목을 관리합니다.</span></header>
          <div class="detail-asset-table">
            <div class="detail-asset-row head"><span>이름</span><span>유형</span><span>패턴</span></div>
            <div class="detail-asset-row"><strong>욕설 차단</strong><span>word</span><span>욕설 패턴</span></div>
            <div class="detail-asset-row"><strong>광고 URL 차단</strong><span>regex</span><span>/https?:\\/\\//i</span></div>
          </div>
          <div class="rag-form-grid">
            <label>테스트 문장<textarea rows="2">광고 링크를 보내도 되나요?</textarea></label>
            <label>매칭 결과<textarea rows="2" readonly>광고 URL 차단</textarea></label>
          </div>
        </section>
      </section>
    </div>
  `;

  const renderRules = () => `
    <div class="aidot-settings-screen">
      <section class="aidot-settings-main aidot-settings-main--full">
        <section class="aidot-setting-block">
          <header><strong>룰 설정</strong><span>룰 표현식과 대상 의도/모듈을 연결하고 테스트 문장으로 검증합니다.</span></header>
          <div class="detail-asset-table">
            <div class="detail-asset-row head"><span>룰명</span><span>설명</span><span>표현식</span></div>
            <div class="detail-asset-row"><strong>업무시간 외</strong><span>운영시간 이후 라우팅</span><span>time.after(18:00)</span></div>
            <div class="detail-asset-row"><strong>결제 우선</strong><span>결제 문의 우선 라우팅</span><span>intent == billing_question</span></div>
          </div>
          <div class="rag-form-grid">
            <label>대상<select><option>의도 · billing_question</option><option>모듈 · support_after_hours</option></select></label>
            <label>정규식 테스트<textarea rows="2">결제 관련 문의입니다.</textarea></label>
          </div>
        </section>
      </section>
    </div>
  `;

  const renderSmalltalk = () => `
    <div class="aidot-settings-screen">
      <section class="aidot-settings-main aidot-settings-main--full">
        <section class="aidot-setting-block">
          <header><strong>스몰토크</strong><span>스몰토크 사용 여부, 우선순위, 다중 사용자 메시지/봇 메시지를 관리합니다.</span></header>
          <div class="detail-asset-table">
            <div class="detail-asset-row head"><span>스몰토크 이름</span><span>우선순위</span><span>사용자/봇 메시지 수</span></div>
            <div class="detail-asset-row"><strong>인사</strong><span>High</span><span>3 / 2</span></div>
            <div class="detail-asset-row"><strong>감사</strong><span>Medium</span><span>2 / 2</span></div>
          </div>
          <div class="rag-form-grid">
            <label>사용자 메시지<textarea rows="4">안녕하세요\n반가워요\n좋은 아침이에요</textarea></label>
            <label>봇 메시지<textarea rows="4">안녕하세요. 무엇을 도와드릴까요?\n반갑습니다. 문의를 말씀해주세요.</textarea></label>
          </div>
        </section>
      </section>
    </div>
  `;

  const renderBotstation = () => `
    <div class="aidot-settings-screen">
      <section class="aidot-settings-main aidot-settings-main--full">
        <section class="aidot-setting-block">
          <header><strong>봇스테이션</strong><span>운영버전 기준으로 채널과 봇을 연계합니다.</span></header>
          <div class="aidot-field-grid">
            <label>연결 상태<input value="연결됨" readonly /></label>
            <label>연결 일시<input value="2026-05-04 13:12" readonly /></label>
            <label>사용 여부<select><option>사용</option><option>미사용</option></select></label>
            <label>운영버전 여부<input value="운영버전" readonly /></label>
          </div>
          <div class="detail-asset-table">
            <div class="detail-asset-row head"><span>채널명</span><span>봇 식별자</span><span>사용</span></div>
            <div class="detail-asset-row"><strong>Webchat</strong><span>supportbot-draft</span><span>사용</span></div>
            <div class="detail-asset-row"><strong>Kakao</strong><span>supportbot-draft</span><span>미사용</span></div>
          </div>
        </section>
      </section>
    </div>
  `;

  const viewMap = {
    "ai-model": renderAiModel,
    defaults: renderDefaults,
    message: renderMessages,
    messenger: renderMessenger,
    ignore: renderBlocklist,
    rule: renderRules,
    smalltalk: renderSmalltalk,
    botstation: renderBotstation,
  };

  const render = viewMap[currentConfigureSubview] || renderAiModel;
  container.innerHTML = render();
}

function renderBuildAidotScreen() {
  renderWorkflowScreenShell(
    "build",
    "04",
    "봇 제작",
    "Aidot 의도 화면 기준으로 의도/모듈을 제작하고 대화 설계로 연결합니다.",
    `<div data-build-aidot-screen></div>`
  );
  const container = document.querySelector("[data-build-aidot-screen]");
  if (!container) return;
  const rows = getCurrentIntentRowsForWorkflow();
  if (!rows.some((row) => row.id === currentSelectedIntentId)) currentSelectedIntentId = rows[0]?.id || "";
  const selected = rows.find((row) => row.id === currentSelectedIntentId) || rows[0] || {};
  const page = getWorkflowPagedRows("build-intents", rows);
  const renderHeader = () => `
    <div class="aidot-build-meta">
      <strong>Semantic - Vector Worker · Aidot Vector Worker 기본 모델 / 답변: Semantic Engine RAG 답변</strong>
      <div class="train-row"><button type="button" data-build-run>학습하기</button><span>${currentOperationsState.build?.last_run_at ? `학습성공 ${escapeText(currentOperationsState.build.last_run_at)} ${escapeText(currentAccessState.currentUserId)}` : "학습 전"}</span></div>
      <div class="aidot-build-meta__notice">운영버전은 제작 작업을 할 수 없습니다. 비운영 버전을 선택하거나 복사본 버전에서 작업해주세요.</div>
    </div>
  `;
  const renderList = () => `
    ${renderHeader()}
    <div class="aidot-intent-main-toolbar"><div class="aidot-list-actions"><button type="button" data-build-add-intent>+ 의도/모듈 추가</button></div></div>
    <div class="aidot-list-control"><strong>전체 ${rows.length}건</strong>${renderWorkflowPageSize("build-intents", page.pageSize)}</div>
    <div class="aidot-main-table"><div class="aidot-main-table-head"><span>ID</span><span>구분</span><span>의도/모듈명</span><span>표시명</span><span>학습문장</span><span>대화카드</span><span>태그</span><span>최종수정일시</span><span>최종수정자</span></div>${page.rows.map((row) => `<div class="aidot-main-table-row"><span>${escapeText(row.rowId)}</span><span>의도</span><button type="button" class="aidot-main-table-link" data-build-intent-open="${escapeText(row.id)}">${escapeText(row.id)}</button><span>${escapeText(row.displayName)}</span><span>${row.utteranceCount || 0}</span><span>${row.dialogCardCount || 0}</span><span>${row.tagCount || 0}</span><span>${escapeText(row.updatedAt)}</span><span>${escapeText(row.updatedBy)}</span></div>`).join("")}</div>
    ${renderWorkflowPager(rows.length, "build-intents", page.currentPage, page.totalPages)}
  `;
  const utterances = selected.utterances?.length ? selected.utterances : currentIntentUtteranceAssets.filter((item) => item.division === selected.id);
  const renderStart = () => `
    <div class="aidot-dialog-head"><strong><button type="button" class="aidot-dialog-breadcrumb" data-return-build-list>의도 (${escapeText(selected.id || "")})</button> &gt; <button type="button" class="aidot-dialog-breadcrumb aidot-dialog-breadcrumb--active" data-open-dialog-start>대화 시작</button></strong><div><button type="button" data-return-build-list>목록으로</button><button type="button" data-build-save-start>저장하기</button><button type="button" data-open-dialog-design data-build-save-and-design>저장 후 대화설계</button></div></div>
    <div class="aidot-dialog-start"><section><div class="aidot-section-title"><strong>학습문장 ${utterances.length}</strong><button type="button" data-build-delete-utterance>삭제</button></div><div class="aidot-add-row"><span>구분</span><span>학습문장</span><button type="button" data-build-add-utterance>추가</button></div><p class="muted-line">Validation Set 상태: Random</p><div class="aidot-utterance-table"><div><strong>구분</strong><strong>학습문장</strong></div>${utterances.map((item, index) => `<div><span><input type="checkbox" data-build-utterance-check="${escapeText(item.utterance)}__${index}" ${currentBuildSelectedUtterances.has(`${item.utterance}__${index}`) ? "checked" : ""} /></span><span class="round-token">T</span><span>${escapeText(item.utterance)}</span></div>`).join("")}</div></section></div>
  `;
  const renderDesign = () => `
    <div class="aidot-dialog-head"><strong><button type="button" class="aidot-dialog-breadcrumb" data-return-build-list>의도 (${escapeText(selected.id || "")})</button> &gt; <button type="button" class="aidot-dialog-breadcrumb" data-open-dialog-start>대화 시작</button> &gt; <button type="button" class="aidot-dialog-breadcrumb aidot-dialog-breadcrumb--active" data-open-dialog-design>대화 설계</button></strong><div><button type="button" data-return-build-list>목록으로</button><button type="button" data-build-save-design>저장</button></div></div>
    <div class="dialog-design-layout"><aside class="dialog-property"><label>카드 이름<input value="답변" data-build-design-card-name /></label><section><strong>기본 메시지</strong><textarea data-build-design-answer>{{$_rag_answer_text}}&#10;{{$_rag_answers}}</textarea></section></aside></div>
  `;
  container.innerHTML = currentBuildAidotView === "design" ? renderDesign() : currentBuildAidotView === "start" ? renderStart() : renderList();
  bindWorkflowTableControls(container, "build-intents");
  container.querySelector("[data-build-add-intent]")?.addEventListener("click", async () => {
    addWorkflowIntentFromBuild();
    await saveDetailAssetsToServer().catch(() => false);
    renderAllStatePanels();
    renderBuildAidotScreen();
  });
  container.querySelectorAll("[data-build-intent-open]").forEach((button) => button.addEventListener("click", () => { currentSelectedIntentId = button.dataset.buildIntentOpen; currentBuildAidotView = "start"; renderBuildAidotScreen(); }));
  container.querySelectorAll("[data-open-dialog-start]").forEach((button) => button.addEventListener("click", () => { currentBuildAidotView = "start"; renderBuildAidotScreen(); }));
  container.querySelector("[data-open-dialog-design]")?.addEventListener("click", () => { currentBuildAidotView = "design"; renderBuildAidotScreen(); });
  container.querySelectorAll("[data-return-build-list]").forEach((button) => button.addEventListener("click", () => { currentBuildAidotView = "list"; renderBuildAidotScreen(); }));
  container.querySelectorAll("[data-build-utterance-check]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const key = checkbox.dataset.buildUtteranceCheck;
      if (!key) return;
      if (checkbox.checked) currentBuildSelectedUtterances.add(key);
      else currentBuildSelectedUtterances.delete(key);
    });
  });
  container.querySelector("[data-build-add-utterance]")?.addEventListener("click", async () => {
    const nextIndex = currentIntentUtteranceAssets.filter((item) => item.division === selected.id).length + 1;
    currentIntentUtteranceAssets = [...currentIntentUtteranceAssets, { utterance: `sample utterance ${nextIndex}`, division: selected.id }];
    currentStudioState.counts.utterances = currentIntentUtteranceAssets.length;
    await saveDetailAssetsToServer().catch(() => false);
    renderAllStatePanels();
    renderBuildAidotScreen();
  });
  container.querySelector("[data-build-delete-utterance]")?.addEventListener("click", async () => {
    if (!currentBuildSelectedUtterances.size) return;
    const scoped = currentIntentUtteranceAssets.filter((item) => item.division === selected.id);
    const removeKeys = new Set([...currentBuildSelectedUtterances]);
    currentIntentUtteranceAssets = [
      ...currentIntentUtteranceAssets.filter((item) => item.division !== selected.id),
      ...scoped.filter((item, index) => !removeKeys.has(`${item.utterance}__${index}`))
    ];
    currentBuildSelectedUtterances = new Set();
    currentStudioState.counts.utterances = currentIntentUtteranceAssets.length;
    await saveDetailAssetsToServer().catch(() => false);
    renderAllStatePanels();
    renderBuildAidotScreen();
  });
  container.querySelector("[data-build-save-start]")?.addEventListener("click", async () => {
    await saveCurrentBuildIntent(selected.id);
    renderBuildAidotScreen();
  });
  container.querySelector("[data-build-save-and-design]")?.addEventListener("click", async () => {
    await saveCurrentBuildIntent(selected.id);
    currentBuildAidotView = "design";
    renderBuildAidotScreen();
  });
  container.querySelector("[data-build-save-design]")?.addEventListener("click", async () => {
    const cardName = container.querySelector("[data-build-design-card-name]")?.value?.trim() || selected.displayName || selected.id;
    const answer = container.querySelector("[data-build-design-answer]")?.value?.trim() || "";
    await saveCurrentBuildIntent(selected.id, {
      displayName: cardName,
      answer,
      dialogCards: answer ? answer.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) : []
    });
    renderBuildAidotScreen();
  });
}

function bootApp() {
  applyScreenLayout();
  renderNavigationRails();
  renderWorkflowRail();
  bindAccessNavigationGuard();
  bindHelpModal();
  renderBoundaryMatrix();
  renderErrorSamples();
  bindCreateControls();
  bindConfigureComposition();
  renderCreateSummary();
  renderConfigureComposition();
  renderAidotIntentManager();
  renderDetailTabs();
  renderStateSummary();
  renderReadinessIssues();
  renderCommercialAvailability();
  renderCollaborationSummary();
  renderWorkspaceHome();
  renderTeamDashboard();
  renderAccessPanels();
  refreshAdminResourcesFromServer().then(() => renderAccessPanels()).catch(() => {});
  renderApiRegistry();
  bindAdminWorkbench();
  renderLockPolicy();
  bindAssetTransferActions();
  bindOperationsActions();
  syncStudioLocaleToCurrentUser();
  enforceActiveScreenVisibility();
  document.dispatchEvent(new CustomEvent("cga:content-rendered"));
  refreshAccessStateFromServer()
    .then(async (loaded) => {
      if (loaded) {
        await refreshWorkspaceDataFromServer({ includeBots: true }).catch(() => false);
        await refreshAdminResourcesFromServer().catch(() => false);
        renderAllStatePanels();
        rerenderAdminAndAccess();
        enforceActiveScreenVisibility();
      }
    })
    .catch(() => {});
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootApp, { once: true });
} else {
  bootApp();
}
window.addEventListener("cga:entry-login-success", async () => {
  clearAuthMessage();
  const loaded = await refreshAccessStateFromServer().catch(() => false);
  if (loaded) {
    await refreshWorkspaceDataFromServer({ includeBots: true }).catch(() => false);
    await refreshAdminResourcesFromServer().catch(() => false);
  }
  applyScreenLayout();
  renderAllStatePanels();
  rerenderAdminAndAccess();
  enforceActiveScreenVisibility();
});
window.addEventListener("hashchange", () => {
  const hashId = window.location.hash.replace("#", "");
  if (hashId) setActiveScreen(hashId, { replaceHash: true });
});
document.addEventListener("cga:i18n-ready", syncStudioLocaleToCurrentUser);
document.addEventListener("cga:content-rendered", syncStudioLocaleToCurrentUser);
document.addEventListener("change", (event) => {
  if (event.target?.matches?.("[data-locale-select]")) {
    window.setTimeout(() => {
      applyDynamicLocaleOverrides(event.target.value);
      renderTopContext();
      renderNavigationRails();
      renderWorkflowRail();
      renderAllStatePanels();
      rerenderAdminAndAccess();
    }, 0);
  }
});











