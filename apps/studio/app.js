import { workflowSteps, managementLinks, operationLinks, queryLinks, systemAdminSections, errorSamples } from "./data/workflow.js?v=20260611-5";
import { getVisibleLayout } from "./data/layout.js?v=20260611-5";
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
const WORKSPACE_SNAPSHOT_VERSION = 1;
const WORKSPACE_SNAPSHOT_TTL_MS = 60000;
const LOGIN_ID_STORAGE_KEY = "cga-studio-login-id";

const currentStudioState = structuredClone(sampleStudioState);
let currentCollaborationState = createSampleCollaborationState();
let currentAccessState = normalizeAccessState(createSampleAccessState());
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
let currentIntentSearch = "";
let currentIntentFilter = "all";
let currentDetailTab = "intent";
let currentBuildAidotView = "list";
let currentCompositionState = {
  group_id: "g-support",
  bot_id: "supportbot-draft",
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
const DEFAULT_ACTIVE_SCREEN_ID = "detail";
let activeScreenId = "";
let screenLayoutApplying = false;

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
  return document.querySelector("[data-locale-select]")?.value || window.cgaStudioI18n?.getLocale?.() || localStorage.getItem("cga.studio.locale") || getCurrentAccessUser()?.locale || document.documentElement.lang || "en";
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
  const memberships = currentAccessState.memberships.filter((membership) => membership.user_id === currentAccessState.currentUserId && membership.status === "active");
  return currentAccessState.groups.filter((group) => group.status === "active" && memberships.some((membership) => membership.group_id === group.id));
}

function getCurrentWorkspaceGroup() {
  return currentAccessState.groups.find((group) => group.id === currentWorkspaceGroupId) || getActiveGroupsForCurrentUser()[0] || null;
}

function getCurrentWorkspaceBot() {
  return currentWorkspaceBots.find((bot) => bot.id === currentWorkspaceBotId) || currentWorkspaceBots.find((bot) => bot.group_id === currentWorkspaceGroupId) || null;
}

function getBotsForGroup(groupId) {
  return currentWorkspaceBots.filter((bot) => bot.group_id === groupId);
}

function canManageApiAnswerForCurrentSelection() {
  return getEffectiveGroupScopes(currentAccessState, currentAccessState.currentUserId, currentApiGroupId, currentApiBotId).includes("apiAnswer.manage");
}

function canCreateBotInCurrentWorkspace() {
  return getEffectiveGroupScopes(currentAccessState, currentAccessState.currentUserId, currentWorkspaceGroupId, currentWorkspaceBotId).includes("bot.create");
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
  const recent = [...items].reverse().slice(0, 5);
  container.innerHTML = recent.length
    ? recent.map((item) => `
      <div>
        <strong>${item.scope || "asset"} · ${item.direction || "transfer"}</strong>
        <span>${item.source || item.asset_path || "server"} · ${item.created_at || ""}</span>
      </div>
    `).join("")
    : `<div><strong data-i18n="transfer.historyEmptyTitle">No transfer history</strong><span data-i18n="transfer.historyEmptyBody">Download or upload a package to create a server record.</span></div>`;
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
    return;
  }
  const select = document.querySelector("[data-locale-select]");
  if (select) select.value = locale;
  localStorage.setItem("cga.studio.locale", locale);
  applyDynamicLocaleOverrides(locale);
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
  const rows = [["매칭 의도", test.matched_intent || "-"], ["처리 방식", test.method || "-"], ["Similarity", Number(test.similarity ?? 0).toFixed(2)], ["Latency", `${Number(test.latency_ms ?? 0)}ms`]];
  renderWorkflowScreenShell("test", "05", "봇 테스트", "Aidot 시뮬레이터 기준으로 테스트 결과를 확인합니다.", `<div class="aidot-simulator-screen"><div class="aidot-simulator-chat"><p class="user-msg">${escapeText(test.last_user_message || "")}</p><p class="bot-msg">${escapeText(test.last_bot_message || "")}</p><input placeholder="테스트 메시지를 입력하세요" /></div><aside class="aidot-simulator-side"><h4>대화 분석</h4>${rows.map(([label, value]) => `<p><b>${escapeText(label)}</b><span>${escapeText(value)}</span></p>`).join("")}</aside></div>`);
}

function renderEvaluateAidotScreen() {
  const rows = getCurrentIntentRowsForWorkflow().map((row) => ({
    ...row,
    status: row.utteranceCount > 0 && row.dialogCardCount > 0 ? "준비 완료" : "점검 필요"
  }));
  const page = getWorkflowPagedRows("evaluate", rows);
  const selected = page.rows[0] || rows[0] || {};
  const section = renderWorkflowScreenShell("evaluate", "06", "봇 평가", "운영으로 넘기기 전에 Aidot 평가 화면 기준으로 품질을 확인합니다.", `
    <div class="aidot-evaluate-screen">
      <div class="aidot-evaluate-list workflow-lookup" data-workflow-table-key="evaluate">
        <div class="workflow-lookup__search">
          <label><span>⌕</span><input data-workflow-query="evaluate" placeholder="의도/평가상태를 검색하세요." /></label>
          <button type="button" class="admin-page__filter admin-page__filter--text" data-workflow-reset="evaluate">초기화</button>
          <div class="workflow-lookup__actions"><button type="button" class="admin-page__primary" data-workflow-search="evaluate">조회</button></div>
        </div>
        <div class="workflow-lookup__toolbar">
          <strong>전체 ${rows.length}건</strong>
          ${renderWorkflowPageSize("evaluate", page.pageSize)}
        </div>
        <div class="workflow-grid aidot-evaluate-grid" style="--workflow-grid-template:.7fr 1.5fr .8fr .8fr 1fr 1fr .8fr">
          <div class="workflow-grid__row workflow-grid__row--header"><span>ID ↕</span><span>의도/모듈명 ↕</span><span>학습문장 ↕</span><span>대화카드 ↕</span><span>평가상태 ↕</span><span>최종수정일시 ↕</span><span>최종수정자 ↕</span></div>
          ${page.rows.map((row, index) => `<button type="button" class="workflow-grid__row ${index === 0 ? "selected" : ""}" data-evaluate-intent="${escapeText(row.id)}"><span>${escapeText(row.rowId)}</span><strong>${escapeText(row.id)}</strong><span>${row.utteranceCount || 0}</span><span>${row.dialogCardCount || 0}</span><span>${escapeText(row.status)}</span><span>${escapeText(row.updatedAt)}</span><span>${escapeText(row.updatedBy)}</span></button>`).join("")}
        </div>
        ${renderWorkflowPager(rows.length, "evaluate", page.currentPage, page.totalPages)}
      </div>
      <div class="aidot-evaluation-detail">
        <div class="aidot-evaluation-detail__head"><strong>Overview › 의도 상세</strong><button type="button" class="admin-page__ghost">평가정보 내보내기</button></div>
        <div class="aidot-evaluation-summary">
          <section><h4>Vector DB 상태</h4><p><span>연결</span><b>정상</b></p><p><span>Index</span><b>aidot-intent</b></p><p><span>검색 API</span><b>http://localhost:8350/intent/search</b></p><p><span>임베딩 모델</span><b>Aidot Vector Worker 기본 모델</b></p></section>
          <section class="aidot-score-panel"><h4>Top-K 검색 정확도</h4><div><b class="score-ring">91.7%<span>Top-1</span></b><strong>61.2%<span>평균 Score</span></strong><b class="score-ring">89.6%<span>Top-3</span></b></div></section>
          <section><h4>9:1 Split 평가</h4><div class="split-grid"><p><span>Random</span><b>70.8%</b></p><p><span>Fixed</span><b>91.7%</b></p><p><span>차이</span><b>20.83%</b></p><p><span>평가 문장</span><b>48</b></p><p><span>학습문장</span><b>228</b></p><p><span>최근 이력</span><b>11</b></p></div></section>
        </div>
        <div class="aidot-evaluation-tables">
          <section><h4>오류문장</h4><div class="aidot-mini-table"><div><b>문장</b><b>정답 의도</b><b>예측 의도 / Score</b></div>${[
            ["무슨 일로 하는 거에요", "통화 독려", "용어 설명 / 25.00%"],
            ["다음에 전화해", "콜백 예약", "인콜 진행 예정 / 92.00%"],
            ["이런 지옥 왜 합니까", "통화 독려", "통화 거부 / 29.49%"],
            ["안됩니다", "콜백 예약", "발화속도 조절 / 33.33%"],
            ["내가 혼자 할테니까 전화 안줘도 됩니다", "인콜 진행 예정", "콜백 예약 / 33.33%"]
          ].map((item) => `<div><span>${escapeText(item[0])}</span><span>${escapeText(item[1])}</span><strong>${escapeText(item[2])}</strong></div>`).join("")}</div></section>
          <section><h4>낮은 Score 문장</h4><div class="aidot-mini-table"><div><b>문장</b><b>의도</b><b>Score</b></div>${[
            ["해약한다고요", "해지 요청", "25.72%"],
            ["중국에 있어요", "통화 불가", "42.16%"],
            ["무슨 일로 하는 거에요", "통화 독려", "25.00%"],
            ["안합니다", "통화 거부", "35.36%"],
            ["나중에 하면 안되나", "콜백 예약", "33.33%"]
          ].map((item) => `<div><span>${escapeText(item[0])}</span><span>${escapeText(item[1])}</span><strong>${escapeText(item[2])}</strong></div>`).join("")}</div></section>
        </div>
        <div class="aidot-conflict-row"><strong>유사 의도 충돌</strong><span>통화 독려 <b>용어 설명 1건</b></span><span>콜백 예약 <b>인콜 진행 예정 1건</b></span><span>통화 거부 <b>발화속도 조절 1건</b></span><span>인콜 진행 예정 <b>콜백 예약 1건</b></span></div>
      </div>
    </div>
  `);
  if (!section) return;
  bindWorkflowTableControls(section, "evaluate");
  section.querySelectorAll("[data-evaluate-intent]").forEach((button) => button.addEventListener("click", () => {
    section.querySelectorAll("[data-evaluate-intent]").forEach((row) => row.classList.remove("selected"));
    button.classList.add("selected");
  }));
}

function renderOperateAidotScreen() {
  const rows = [];
  const page = getWorkflowPagedRows("operate", rows);
  const botName = currentStudioState.bot.name || getCurrentWorkspaceBot()?.name || "테스트봇";
  const section = renderWorkflowScreenShell("operate", "RT", "재학습", "Aidot 재학습 화면 기준으로 개선 대상을 확인합니다.", `
    <div class="aidot-retrain-screen">
      <div class="aidot-bot-main-head aidot-bot-main-head--compact"><div class="aidot-bot-title"><div class="bot-avatar-large"></div><div><div class="aidot-title-row"><h2>${escapeText(botName)}</h2><select><option>Ver. 1 · 운영</option></select><span class="test-badge">테스트형</span><span class="star-mark">★</span><button type="button" class="icon-button">⋮</button></div><strong>Semantic - Vector Worker · Aidot Vector Worker 기본 모델 / 답변: 정해진 답변</strong><div class="train-row"><button type="button" data-build-run>학습하기</button><span>학습성공 2026-05-12 02:12 cyhuh</span></div></div></div><div class="aidot-count-tabs"><button><span>☞ 의도</span><b>17</b></button><button><span>☷ 구성</span><b>-</b></button><button><span>⊙ 개체</span><b>6</b></button><button><span>▣ 사전</span><b>7</b></button><button><span>⌁ 평가</span><b>-</b></button><button class="active"><span>↔ 재학습</span><b>0</b></button><button><span>⌁ 분석</span><b>-</b></button></div></div>
      <div class="aidot-retrain-filter"><input placeholder="의도명/지식명 또는 사용자 발화를 검색하세요." /><select><option>전체</option></select><select><option>전체</option></select><select><option>전체</option></select><select><option>전체</option></select><input type="date" value="2026-03-12" /><input type="date" value="2026-06-12" /><button type="button" class="admin-page__ghost">초기화</button><button type="button" class="admin-page__primary">확인</button></div>
      <div class="aidot-retrain-actions"><strong>전체 ${rows.length}</strong><button type="button">대화이력 동기화</button><button type="button" class="admin-page__primary">재학습</button><button type="button" disabled>의도 생성</button><button type="button" disabled>보류</button><button type="button" disabled>재학습 제외</button><button type="button" disabled>삭제</button><b>0개 선택</b></div>
      <div class="workflow-grid aidot-retrain-grid" style="--workflow-grid-template:2fr 1.4fr .8fr .8fr .8fr .9fr"><div class="workflow-grid__row workflow-grid__row--header"><span>사용자 발화 ↕</span><span>의도명/지식명 ↕</span><span>채널 ↕</span><span>실행결과 ↕</span><span>분류방식 ↕</span><span>학습상태 ↕</span><span>발생시간 ↕</span></div>${page.rows.map((row) => `<div class="workflow-grid__row"><span>${escapeText(row.utterance || "")}</span><span>${escapeText(row.intent || "")}</span><span>${escapeText(row.channel || "")}</span><span>${escapeText(row.result || "")}</span><span>${escapeText(row.method || "")}</span><span>${escapeText(row.status || "")}</span><span>${escapeText(row.createdAt || "")}</span></div>`).join("")}</div>
    </div>
  `);
  if (!section) return;
}

function renderAnalysisAidotScreen() {
  const operate = currentOperationsState.operate || {};
  const botName = currentStudioState.bot.name || getCurrentWorkspaceBot()?.name || "테스트봇";
  const history = [
    ["2026-06-12 13:55", "-", "-", "completed"],
    ["2026-06-12 12:12", "-", "-", "completed"],
    ["2026-06-12 12:12", "-", "-", "completed"],
    ["2026-06-12 06:12", "-", "-", "completed"],
    ["2026-06-12 06:12", "-", "-", "completed"]
  ];
  const section = renderWorkflowScreenShell("analysis", "AN", "분석", "Aidot 분석 화면 기준으로 운영 지표를 조회합니다.", `
    <div class="aidot-analysis-screen">
      <div class="aidot-bot-main-head aidot-bot-main-head--compact"><div class="aidot-bot-title"><div class="bot-avatar-large"></div><div><div class="aidot-title-row"><h2>${escapeText(botName)}</h2><select><option>Ver. 1 · 운영</option></select><span class="test-badge">테스트형</span><span class="star-mark">★</span><button type="button" class="icon-button">⋮</button></div><strong>Semantic - Vector Worker · Aidot Vector Worker 기본 모델 / 답변: 정해진 답변</strong><div class="train-row"><button type="button" data-build-run>학습하기</button><span>학습성공 2026-05-12 02:12 cyhuh</span></div></div></div><div class="aidot-count-tabs"><button><span>☞ 의도</span><b>17</b></button><button><span>☷ 구성</span><b>-</b></button><button><span>⊙ 개체</span><b>6</b></button><button><span>▣ 사전</span><b>7</b></button><button><span>⌁ 평가</span><b>-</b></button><button><span>↔ 재학습</span><b>0</b></button><button class="active"><span>⌁ 분석</span><b>-</b></button></div></div>
      <div class="aidot-analysis-filter"><select><option>webchat</option></select><button type="button">‹</button><strong>2026-06</strong><button type="button">›</button></div>
      <div class="aidot-analysis-legend"><strong>누적 대화량</strong><span class="dot teal"></span>M/L 7% (22건)<span class="dot green"></span>Rule 0% (0건)<span class="dot orange"></span>Small Talk 0% (0건)<span class="dot blue"></span>Exact Matching 0% (0건)<span class="dot red"></span>미응답 93% (277건)</div>
      <div class="aidot-analysis-grid">
        <section><h4>기간내 대화량</h4><div class="donut-panel"><div class="donut-ring"><b>100%</b><span>응답률</span><em>6 / 6</em></div><div class="donut-legend"><p><b>응답</b></p><p><span class="dot teal"></span>M/L <b>100% 6</b></p><p><span class="dot green"></span>Rule <b>0% 0</b></p><p><span class="dot orange"></span>Small Talk <b>0% 0</b></p><p><span class="dot blue"></span>Exact Matching <b>0% 0</b></p><p><span class="dot red"></span>대화 Queue <b>0% 0</b></p><p><b>미응답</b><span>0% 0</span></p></div></div></section>
        <section><h4>기간별 대화량</h4><div class="line-chart-mock"><div class="chart-legend"><span>사용자 발화</span><span>문의</span><span>응답</span><span>사용자수</span></div><div class="chart-grid"><span>01일</span><span>02일</span><span>03일</span><span>04일</span><span>05일</span><span>06일</span><span>07일</span></div><button type="button" class="admin-page__ghost">선택일자 대화 전체보기</button></div></section>
        <section><h4>가장 많은 문의 Top 5</h4><div class="aidot-mini-table"><div><b>순위 ↕</b><b>의도/모듈명 ↕</b><b>분류방식 ↕</b><b>건수 ↕</b><b>응답률 ↕</b></div><div><span>1</span><span>-</span><span>미응답</span><span>${Number(operate.undefined_intents ?? 6)}</span><span>100%</span></div></div></section>
        <section><h4>선택일자 대화 이력</h4><div class="aidot-mini-table"><div><b>발화일시 ↕</b><b>사용자 발화 ↕</b><b>의도/모듈명 ↕</b><b>실행 결과 ↕</b></div>${history.map((row) => `<div><span>${escapeText(row[0])}</span><span>${escapeText(row[1])}</span><span>${escapeText(row[2])}</span><span>${escapeText(row[3])}</span></div>`).join("")}</div></section>
      </div>
    </div>
  `);
  if (!section) return;
}

function renderDetailAidotScreen() {
  const rows = getCurrentIntentRowsForWorkflow();
  const body = document.createElement("div");

  renderWorkflowTablePage(
    body,
    "detail",
    rows,
    ["", "ID", "구분", "의도/모듈명", "표시명", "학습문장", "대화카드", "태그", "기타옵션", "최종수정일시", "최종수정자", ""],
    (row) => `
      <div class="workflow-grid__row workflow-grid__row--body">
        <span><input type="checkbox" aria-label="${escapeText(row.name || row.intentName || row.rowId || "intent")} 선택" /></span>
        <span>${escapeCell(row.rowId || row.id || "-")}</span>
        <span>${escapeCell(row.type || "의도")}</span>
        <span><button type="button" class="link-button" data-open-dialog-start="${escapeText(row.rowId || row.id || "")}">${escapeText(row.name || row.intentName || row.intent || "-")}</button></span>
        <span>${escapeCell(row.displayName || row.name || row.intentName || "-")}</span>
        <span>${escapeCell(row.utteranceCount ?? row.trainingCount ?? row.examples ?? 0)}</span>
        <span>${escapeCell(row.dialogCardCount ?? row.cardCount ?? 0)}</span>
        <span>${escapeCell(row.tagCount ?? 0)}</span>
        <span class="workflow-grid__option-badges"><i>T</i><i>R</i><i>F</i></span>
        <span>${escapeCell(row.updatedAt || "-")}</span>
        <span>${escapeCell(row.updatedBy || "-")}</span>
        <span>⋮</span>
      </div>`,
    {
      placeholder: "의도/모듈명, 학습문장, 대화카드, 의도아이디, 태그를 검색하세요.",
      filters: `<select data-workflow-filter="detail"><option>전체</option><option>의도</option><option>모듈</option></select>`,
      actions: `<button type="button" class="admin-page__primary" data-workflow-search="detail">조회</button><button type="button" class="admin-page__primary" data-open-intent-create>+ 의도/모듈 추가</button>`,
      template: "40px 84px 72px 1.25fr 1.25fr 92px 92px 72px 100px 150px 120px 36px"
    }
  );

  renderWorkflowScreenShell(
    "detail",
    "04",
    "봇 제작",
    "Aidot 의도 화면 기준으로 의도/모듈을 제작하고 대화 설계로 연결합니다.",
    body.innerHTML
  );
}
function renderWorkflowScreens() {
  try {
    renderWorkspaceHome();
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
    status: item.status || "answer_required"
  };
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
  const generateQa = document.querySelector("[data-config-generate-qa]");
  const preview = document.querySelector("[data-config-preview]");
  if (utterances && document.activeElement !== utterances) utterances.value = currentCompositionState.utterances.join("\n");
  if (intentCount && document.activeElement !== intentCount) intentCount.value = String(currentCompositionState.requested_intent_count || 1);
  if (pdfSelect) {
    pdfSelect.textContent = currentCompositionState.pdf?.file_name || window.cgaStudioI18n?.resolveMessage?.(window.cgaStudioI18n.getLocale?.() || "en", "configure.upload", "Drop PDF here or choose file") || "Drop PDF here or choose file";
  }
  if (generateQa) {
    generateQa.disabled = !canGeneratePdfQa(currentStudioState) || !currentCompositionState.pdf;
  }
  if (preview) {
    const candidates = currentCompositionState.intent_candidates || [];
    const getIntentStatusLabel = (status) => ({
      answer_required: t("review.answerRequired", "Answer draft required"),
      ready: t("review.ready", "Ready")
    })[status] || status || t("review.answerRequired", "Answer draft required");
    preview.innerHTML = candidates.map((item) => `
      <div class="intent-row">
        <strong>${item.intent}</strong>
        <span>${item.utterance_count || 0} ${t("review.utteranceUnit", "utterances")}</span>
        <span>${getIntentStatusLabel(item.status)}</span>
        <button type="button" data-i18n="review.review">Review</button>
      </div>
    `).join("") || `<div class="intent-row"><strong>${t("review.noIntentCandidate", "No intent candidate")}</strong><span>0 ${t("review.utteranceUnit", "utterances")}</span><span>${t("review.manualResultRequired", "Manual handoff or PDF Q&A result required")}</span><button type="button" disabled data-i18n="review.review">Review</button></div>`;
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
  const utterances = document.querySelector("[data-config-utterances]");
  const intentCount = document.querySelector("[data-config-intent-count]");
  const exportHandoff = document.querySelector("[data-config-export-handoff]");
  const importResult = document.querySelector("[data-config-import-result]");
  const pdfSelect = document.querySelector("[data-config-pdf-select]");
  const savePdf = document.querySelector("[data-config-save-pdf]");
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
  } catch (error) {
    console.error("CGA screen layout failed", error);
  } finally {
    screenLayoutApplying = false;
    enforceActiveScreenVisibility();
    updateNavigationActiveState();
  }
}
function updateNavigationActiveState() {
  document.querySelectorAll(".management-nav a, .server-sub-nav a, .system-admin-subnav a, [data-workflow-nav] a").forEach((link) => {
    const linkScreenId = link.getAttribute("href")?.replace("#", "");
    const subviewMatches = !link.dataset.adminSubview || link.dataset.adminSubview === currentSystemAdminSubview;
    link.classList.toggle("active", linkScreenId === activeScreenId && subviewMatches);
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
  nav.innerHTML = workflowSteps.map((step) => `
    <a href="#${step.id}" class="${step.id === activeScreenId ? "active" : ""}">
      <span>${step.number}</span>
      <strong data-i18n="workflow.${step.id}.title">${step.title}</strong>
      <small data-i18n="workflow.${step.id}.subtitle">${step.subtitle}</small>
    </a>
  `).join("");
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
    <div class="subnav-section">
      <strong>${section.title}</strong>
      ${section.links.map((link) => `
        <a href="#${link.id}" class="${link.id === activeScreenId && (!link.subview || link.subview === currentSystemAdminSubview) ? "active" : ""}" ${link.subview ? `data-admin-subview="${link.subview}"` : ""}>
          <span>${link.label}</span>
        </a>
      `).join("")}
    </div>
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
  const myTasks = document.querySelector("[data-team-my-tasks]");
  const reviewQueue = document.querySelector("[data-team-review-queue]");
  const blockedItems = document.querySelector("[data-team-blocked-items]");
  const statusStrip = document.querySelector("[data-team-status-strip]");
  if (!myTasks || !reviewQueue || !blockedItems || !statusStrip) return;
  const dashboard = summarizeTeamDashboard(currentCollaborationState, { currentUserId: currentAccessState.currentUserId });
  const renderItems = (items, emptyText, mode) => items.map((item) => {
    const lockOwner = item.lock?.user_id;
    const isMine = item.assignee_id === currentAccessState.currentUserId;
    const canUnlock = lockOwner === currentAccessState.currentUserId;
    return `
    <div class="team-task-row ${item.status}">
      <strong>${item.title}</strong>
      <span>${item.type} · ${item.status} · ${item.assignee?.name || item.assignee_id || t("team.unassigned", "unassigned")}${lockOwner ? ` · ${t("team.lockedBy", "locked by")} ${lockOwner}` : ""}</span>
      <div class="team-task-actions">
        ${mode === "mine" && !lockOwner && isMine ? `<button type="button" data-lock-work="${item.id}">${t("team.lock", "Lock")}</button>` : ""}
        ${mode === "mine" && canUnlock ? `<button type="button" data-unlock-work="${item.id}">${t("team.unlock", "Unlock")}</button>` : ""}
        ${mode === "review" ? `<button type="button" data-approve-work="${item.id}">${t("admin.approve", "Approve")}</button><button type="button" data-request-change="${item.id}">${t("team.requestChanges", "Request changes")}</button>` : ""}
        ${mode === "blocked" ? `<button type="button" data-request-change="${item.id}">${t("team.moveToTodo", "Move to todo")}</button>` : ""}
      </div>
    </div>
  `;
  }).join("") || `<div class="team-task-empty"><strong>${emptyText}</strong><span>${t("team.currentUser", "Current user")}: ${dashboard.currentUser?.name || currentAccessState.currentUserId}</span></div>`;
  myTasks.innerHTML = renderItems(dashboard.myTasks, t("team.noAssignedTask", "No assigned task"), "mine");
  reviewQueue.innerHTML = renderItems(dashboard.reviewQueue, t("team.noReviewWaiting", "No review waiting"), "review");
  blockedItems.innerHTML = renderItems(dashboard.blockedItems, t("team.noBlockedItem", "No blocked item"), "blocked");
  statusStrip.innerHTML = dashboard.byStatus.map((entry) => `
    <div class="team-status-card ${entry.status}">
      <strong>${entry.status}</strong>
      <span>${entry.count}</span>
    </div>
  `).join("");
  bindTeamDashboardActions();
}

function bindTeamDashboardActions() {
  document.querySelectorAll("[data-lock-work]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const synced = await runCollaborationAction(button.dataset.lockWork, "lock").catch(() => false);
      if (synced === false) currentCollaborationState = lockWorkItem(currentCollaborationState, { workItemId: button.dataset.lockWork, userId: currentAccessState.currentUserId });
      renderTeamDashboard();
      renderCollaborationSummary();
      renderGlobalMessage();
    });
  });
  document.querySelectorAll("[data-unlock-work]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const synced = await runCollaborationAction(button.dataset.unlockWork, "unlock").catch(() => false);
      if (synced === false) currentCollaborationState = releaseWorkItemLock(currentCollaborationState, { workItemId: button.dataset.unlockWork, userId: currentAccessState.currentUserId });
      renderTeamDashboard();
      renderCollaborationSummary();
      renderGlobalMessage();
    });
  });
  document.querySelectorAll("[data-approve-work]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const synced = await runCollaborationAction(button.dataset.approveWork, "approve").catch(() => false);
      if (synced === false) currentCollaborationState = submitReviewDecision(currentCollaborationState, { workItemId: button.dataset.approveWork, reviewerId: currentAccessState.currentUserId, decision: "approve" });
      renderTeamDashboard();
      renderCollaborationSummary();
      renderGlobalMessage();
    });
  });
  document.querySelectorAll("[data-request-change]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const synced = await runCollaborationAction(button.dataset.requestChange, "request-changes").catch(() => false);
      if (synced === false) currentCollaborationState = submitReviewDecision(currentCollaborationState, { workItemId: button.dataset.requestChange, reviewerId: currentAccessState.currentUserId, decision: "request_changes" });
      renderTeamDashboard();
      renderCollaborationSummary();
      renderGlobalMessage();
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
  const deploy = document.querySelector("[data-deploy-action]");

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
      const message = testInput.value.trim();
      if (!message) return;
      await runOperationsAction("run-test", { message }).catch(() => false);
      testInput.value = "";
      renderAllStatePanels();
    });
  }

  if (deploy && deploy.dataset.bound !== "true") {
    deploy.dataset.bound = "true";
    deploy.addEventListener("click", async () => {
      await runOperationsAction("deploy").catch(() => false);
      renderAllStatePanels();
    });
  }
}

function renderTopContext() {
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
    createBotCopy.addEventListener("click", () => setActiveScreen("bot-management"));
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
  if (downloadBot && downloadBot.dataset.bound !== "true") {
    downloadBot.dataset.bound = "true";
    downloadBot.addEventListener("click", async () => {
      const bot = getCurrentWorkspaceBot();
      const serverFileName = await downloadAssetFromServer("botPackage");
      if (serverFileName) {
        currentTransferStatus = formatTransferDownloaded("botPackage", serverFileName, "server");
        renderWorkspaceHome();
        document.dispatchEvent(new CustomEvent("cga:content-rendered"));
        return;
      }
      const fileName = `Bot_${getSafeFileName(currentStudioState.bot.name || bot?.name, "CGA_Bot")}_${getTodayStamp()}.json`;
      downloadJsonFile(fileName, buildAidotBotPackage());
      currentTransferStatus = formatTransferDownloaded("botPackage", fileName);
      renderWorkspaceHome();
      document.dispatchEvent(new CustomEvent("cga:content-rendered"));
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
        renderWorkspaceHome();
        document.dispatchEvent(new CustomEvent("cga:content-rendered"));
        return;
      }
      const fileName = `Version_${getSafeFileName(currentStudioState.bot.name || bot?.name, "CGA_Bot")}_${getSafeFileName(version, "v0_1")}_${getTodayStamp()}.json`;
      downloadJsonFile(fileName, buildCgaVersionPackage());
      currentTransferStatus = formatTransferDownloaded("versionPackage", fileName);
      renderWorkspaceHome();
      document.dispatchEvent(new CustomEvent("cga:content-rendered"));
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
  const apiRegistry = document.querySelector("[data-api-registry]");
  const apiOwnerMeta = document.querySelector("[data-api-owner-meta]");
  const apiAdd = document.querySelector("[data-api-add]");
  if (!apiGroup || !apiBot || !apiRegistry) return;
  const groups = getActiveGroupsForCurrentUser();
  if (!groups.some((group) => group.id === currentApiGroupId)) {
    currentApiGroupId = groups[0]?.id || currentWorkspaceGroupId;
  }
  const bots = getBotsForGroup(currentApiGroupId);
  if (!bots.some((bot) => bot.id === currentApiBotId)) {
    currentApiBotId = bots[0]?.id || currentWorkspaceBotId;
  }
  const canManageApi = canManageApiAnswerForCurrentSelection();
  apiGroup.innerHTML = groups
    .map((group) => `<option value="${group.id}" ${group.id === currentApiGroupId ? "selected" : ""}>${group.name}</option>`)
    .join("");
  apiBot.innerHTML = bots
    .map((bot) => `<option value="${bot.id}" ${bot.id === currentApiBotId ? "selected" : ""}>${bot.name}</option>`)
    .join("");
  if (apiOwnerMeta) {
    apiOwnerMeta.textContent = `group_id: ${currentApiGroupId} · bot_id: ${currentApiBotId || t("common.none", "None")}`;
    apiOwnerMeta.dataset.manageAllowedLabel = t("apiAnswer.manageAllowed", "Can manage API answers");
    apiOwnerMeta.dataset.manageBlockedLabel = t("apiAnswer.manageBlocked", "Blocked: apiAnswer.manage");
  }
  if (apiAdd) {
    apiAdd.disabled = !canManageApi || !currentApiBotId;
  }
  const filteredApis = currentApiRegistry.filter((api) => api.group_id === currentApiGroupId && api.bot_id === currentApiBotId);
  apiRegistry.innerHTML = filteredApis.map((api) => `
    <div>
      <strong>${api.name}</strong>
      <span>${api.group_id} · ${api.bot_id} · ${api.method || "GET"} · ${api.endpoint_url} · ${api.response_path}</span>
    </div>
  `).join("") || `<div><strong>${t("apiAnswer.noApiAnswer", "No API answer")}</strong><span>${t("apiAnswer.registerForBot", "Register a group API answer for the selected bot.")}</span></div>`;
  refreshApiRegistryFromServer()
    .then((loaded) => {
      if (loaded) {
        const nextItems = currentApiRegistry.filter((api) => api.group_id === currentApiGroupId && api.bot_id === currentApiBotId);
        apiRegistry.innerHTML = nextItems.map((api) => `
          <div>
            <strong>${api.name}</strong>
            <span>${api.group_id} · ${api.bot_id} · ${api.method || "GET"} · ${api.endpoint_url} · ${api.response_path || api.response_mapping?.answer_text_path || "data.answer"}</span>
          </div>
        `).join("") || `<div><strong>${t("apiAnswer.noApiAnswer", "No API answer")}</strong><span>${t("apiAnswer.registerForBot", "Register a group API answer for the selected bot.")}</span></div>`;
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
      applyScreenLayout();
      rerenderAdminAndAccess();
    } catch (error) {
      if (error.status) {
        setAuthMessage("error", "admin.loginFailedTitle", getCgaErrorMessage(error, t("errors.auth.loginFailed", "Login failed.")));
        rerenderAdminAndAccess();
        return;
      }
      currentAccessState = loginAsUser(currentAccessState, { userId });
      applyScreenLayout();
      rerenderAdminAndAccess();
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

function renderWorkspaceHome() {
  const section = document.querySelector('[data-screen-id="workspace-home"]');
  if (!section) return;
  const groups = getActiveGroupsForCurrentUser();
  if (!groups.some((group) => group.id === currentWorkspaceGroupId)) currentWorkspaceGroupId = groups[0]?.id || currentWorkspaceGroupId;
  const groupOptions = groups.map((group) => `<option value="${escapeText(group.id)}" ${group.id === currentWorkspaceGroupId ? "selected" : ""}>${escapeText(group.name)}</option>`).join("");
  const rows = currentWorkspaceBots.filter((bot) => String(bot.group_id || bot.groupId || "") === String(currentWorkspaceGroupId) && bot.status !== "deleted");
  const shell = renderWorkflowScreenShell("workspace-home", "BOT", "봇 작업공간", "그룹을 선택하고 해당 그룹의 봇을 엽니다.", `<div data-workspace-list-surface></div>`);
  const surface = shell?.querySelector("[data-workspace-list-surface]");
  if (!surface) return;
  renderWorkflowTablePage(surface, "workspace-home", rows, ["봇 ID", "봇 이름", "버전", "상태", "언어", "최종수정일시", "최종수정자"], (bot) => `
    <button type="button" class="workflow-grid__row ${bot.id === currentWorkspaceBotId ? "selected" : ""}" data-open-bot="${escapeText(bot.id)}">
      <strong>${escapeText(bot.id)}</strong><span>${escapeText(bot.name)}</span><span>${escapeText(bot.version || "-")}</span><span>${escapeText(bot.status || "-")}</span><span>${escapeText(bot.locale || "-")}</span><span>${escapeText(bot.updated_at || bot.created_at || "-")}</span><span>${escapeText(bot.updated_by || "SYSTEM")}</span>
    </button>
  `, {
    placeholder: "봇 ID 또는 봇 이름을 검색하세요.",
    template: "1.15fr 1.5fr .7fr .7fr .6fr 1fr .8fr",
    filters: `<select data-workspace-group>${groupOptions}</select>`,
    actions: `<button type="button" class="admin-page__primary" data-workspace-create ${canCreateBotInCurrentWorkspace() ? "" : "disabled"}>+ 봇 생성</button>`
  });
  surface.querySelector("[data-workspace-group]")?.addEventListener("change", (event) => {
    currentWorkspaceGroupId = event.target.value;
    renderWorkspaceHome();
    renderTopContext();
  });
  surface.querySelectorAll("[data-open-bot]").forEach((button) => button.addEventListener("click", () => {
    currentWorkspaceBotId = button.dataset.openBot;
    selectedBotManagementId = currentWorkspaceBotId;
    const bot = getCurrentWorkspaceBot();
    if (bot) {
      currentStudioState.bot.name = bot.name || currentStudioState.bot.name;
      currentStudioState.bot.version = bot.version || currentStudioState.bot.version;
      currentStudioState.bot.defaultLocale = bot.locale || currentStudioState.bot.defaultLocale;
    }
    renderWorkspaceHome();
    renderTopContext();
  }));
  surface.querySelector("[data-workspace-create]")?.addEventListener("click", () => {
    activeScreenId = "create";
    window.location.hash = "create";
    applyScreenLayout();
  });
}

function renderBuildAidotScreen() {
  const container = document.querySelector("[data-build-aidot-screen]");
  if (!container) return;
  const rows = getCurrentIntentRowsForWorkflow();
  if (!rows.some((row) => row.id === currentSelectedIntentId)) currentSelectedIntentId = rows[0]?.id || "";
  const selected = rows.find((row) => row.id === currentSelectedIntentId) || rows[0] || {};
  const page = getWorkflowPagedRows("build-intents", rows);
  const botName = currentStudioState.bot.name || getCurrentWorkspaceBot()?.name || "테스트봇";
  const renderHeader = () => `
    <div class="aidot-bot-main-head">
      <div class="aidot-bot-title">
        <div class="bot-avatar-large"></div>
        <div>
          <div class="aidot-title-row"><h2>${escapeText(botName)} - 시멘틱 RAG</h2><select><option>${escapeText(currentStudioState.bot.version || "Ver. 1")} · 테스트형</option><option>${escapeText(currentStudioState.bot.version || "Ver. 1")} · 운영</option></select><span class="test-badge">테스트형</span><span class="star-mark">★</span><button type="button" class="icon-button">⋮</button></div>
          <strong>Semantic - Vector Worker · Aidot Vector Worker 기본 모델 / 답변: Semantic Engine RAG 답변</strong>
          <div class="train-row"><button type="button" data-build-run>학습하기</button><span>${currentOperationsState.build?.last_run_at ? `학습성공 ${escapeText(currentOperationsState.build.last_run_at)} ${escapeText(currentAccessState.currentUserId)}` : "학습 전"}</span></div>
        </div>
      </div>
      <div class="aidot-count-tabs"><button class="active"><span>☞ 의도</span><b>${rows.length}</b></button><button><span>☷ 구성</span><b>-</b></button><button><span>⊙ 개체</span><b>${currentEntityAssets.length}</b></button><button><span>▣ 사전</span><b>${currentDictionaryAssets.length}</b></button><button><span>⌁ 평가</span><b>-</b></button><button><span>↔ 재학습</span><b>0</b></button><button><span>⌁ 분석</span><b>-</b></button></div>
    </div>`;
  const renderList = () => `
    ${renderHeader()}
    <div class="aidot-intent-main-toolbar"><div class="aidot-search-line"><input placeholder="의도/모듈명, 학습문장, 대화카드, 의도아이디, 태그를 검색해주세요." /><select><option>전체</option></select></div><div class="aidot-list-actions"><button type="button" data-aidot-intent-add>+ 의도/모듈 추가</button><button type="button" class="icon-button">⋮</button></div></div>
    <div class="aidot-list-control"><strong>전체 ${rows.length}건</strong>${renderWorkflowPageSize("build-intents", page.pageSize)}<button type="button" disabled>삭제</button></div>
    <div class="aidot-main-table"><div class="aidot-main-table-head"><span><input type="checkbox" /></span><span>ID ⇅</span><span>오...</span><span>구분 ⇅</span><span>의도/모듈명 ⇅</span><span>표시명 ⇅</span><span>학습문장 ⇅</span><span>대화카드 ⇅</span><span>태그 ⇅</span><span>기타옵션</span><span>최종수정일시 ⇅</span><span>최종수정자 ⇅</span><span></span></div>${page.rows.map((row) => `<button type="button" class="aidot-main-table-row" data-build-intent-open="${escapeText(row.id)}"><span><input type="checkbox" /></span><span>${escapeText(row.rowId)}</span><span></span><span>의도</span><strong>${escapeText(row.id)}</strong><span>${escapeText(row.displayName)}</span><span>${row.utteranceCount || 0}</span><span>${row.dialogCardCount || 0}</span><span>${row.tagCount || 0}</span><span class="option-dots"><b>T</b><b>R</b><b>F</b></span><span>${escapeText(row.updatedAt)}</span><span>${escapeText(row.updatedBy)}</span><span>⋮</span></button>`).join("")}</div>
    ${renderWorkflowPager(rows.length, "build-intents", page.currentPage, page.totalPages)}
  `;
  const utterances = selected.utterances?.length ? selected.utterances : currentIntentUtteranceAssets.filter((item) => item.division === selected.id);
  const renderStart = () => `
    <div class="aidot-dialog-head"><strong>의도 (${escapeText(selected.id || "")}) &gt; 대화 시작</strong><button type="button" class="help-icon">?</button><span>&gt; 대화 설계</span><div><button type="button" data-return-build-list>목록으로</button><button type="button">저장하기</button><button type="button" data-open-dialog-design>저장 후 대화설계</button></div></div>
    <div class="aidot-dialog-start"><section><div class="aidot-section-title"><strong>학습문장 ${utterances.length}</strong><input placeholder="학습문장을 검색하세요." /><button type="button">학습 문장 추천</button><button type="button">삭제</button><button type="button" class="icon-button">⋮</button></div><div class="aidot-add-row"><span>구분</span><span>학습문장</span><button type="button">추가</button></div><p class="muted-line">Validation Set 상태: Random</p><div class="aidot-utterance-table"><div><span><input type="checkbox" /></span><strong>구분</strong><strong>학습문장</strong></div>${utterances.map((item) => `<div><span><input type="checkbox" /></span><span class="round-token">T</span><span>${escapeText(item.utterance)}</span></div>`).join("")}</div></section><section><div class="aidot-section-title"><strong>추출할 개체 0</strong><button type="button">선택 개체 추가</button><button type="button">삭제</button></div><input placeholder="대화에서 사용할 개체를 검색하여 파라미터로 등록하세요." /><div class="aidot-empty-face">··</div><p class="empty-help">아직 추출할 개체가 선택되지 않았습니다.<br />개체를 검색한 뒤 선택해서 변수로 등록해주세요.</p></section></div>
  `;
  const renderDesign = () => `
    <div class="aidot-dialog-head"><strong>의도 (${escapeText(selected.id || "")}) &gt; 대화 시작 &gt; 대화 설계</strong><button type="button" class="help-icon">?</button><div><button type="button" data-return-build-list>목록으로</button><input placeholder="봇 메시지를 검색하세요." /><button type="button">저장</button><button type="button" class="icon-button">⋮</button></div></div>
    <div class="dialog-design-layout"><div class="dialog-canvas"><div class="canvas-tools"><button>의도 카드 2개</button><button>링크 2개</button><button>필수 변수 기본 반복 3회</button></div><div class="node-row"><div class="flow-node start">▶<strong>대화 시작</strong><span>대화 시작</span></div><i></i><div class="flow-node talk">“ ”<strong>답변</strong><span>Talk</span></div><i></i><div class="flow-node end">■<strong>End</strong><span>End</span></div></div><div class="zoom-row"><button>-</button><strong>100%</strong><button>+</button></div></div><aside class="dialog-property"><div class="card-tabs"><button class="active">대화 테스트</button><button>속성</button><button>변수</button></div><label>카드 이름<input value="답변" /></label><section><strong>기본 메시지</strong><textarea>{{$_rag_answer_text}}&#10;{{$_rag_answers}}</textarea><button type="button">+ 메시지 추가</button></section><section><strong>템플릿 메시지</strong><button type="button">템플릿 메시지 설정</button></section><section><strong>사용자 응답 처리</strong><p><label><input type="radio" checked /> 사용 안함</label> <label><input type="radio" /> 단일 선택</label> <label><input type="radio" /> 응답 전달</label></p></section></aside></div>
  `;
  container.innerHTML = currentBuildAidotView === "design" ? renderDesign() : currentBuildAidotView === "start" ? renderStart() : renderList();
  bindWorkflowTableControls(container, "build-intents");
  container.querySelectorAll("[data-build-intent-open]").forEach((button) => button.addEventListener("click", () => { currentSelectedIntentId = button.dataset.buildIntentOpen; currentBuildAidotView = "start"; renderBuildAidotScreen(); }));
  container.querySelector("[data-open-dialog-design]")?.addEventListener("click", () => { currentBuildAidotView = "design"; renderBuildAidotScreen(); });
  container.querySelectorAll("[data-return-build-list]").forEach((button) => button.addEventListener("click", () => { currentBuildAidotView = "list"; renderBuildAidotScreen(); }));
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
document.addEventListener("cga:content-rendered", () => {
  syncStudioLocaleToCurrentUser();
  scheduleActiveScreenVisibility();
});
document.addEventListener("change", (event) => {
  if (event.target?.matches?.("[data-locale-select]")) {
    window.setTimeout(() => {
      renderAllStatePanels();
      rerenderAdminAndAccess();
      applyDynamicLocaleOverrides(event.target.value);
    }, 0);
  }
});










