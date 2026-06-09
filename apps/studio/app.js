import { workflowSteps, productionLinks, systemAdminLinks, referenceLinks, errorSamples } from "./data/workflow.js";
import { getVisibleLayout } from "./data/layout.js";
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
  loginAsUser,
  getEffectiveGroupScopes,
  requestGroupJoin,
  summarizeAccess,
  summarizeAccessOperations,
  summarizeAccessPolicy,
  summarizeAdminRequests,
  summarizeAuthWorkflow,
  summarizeGroupBotAccess,
  summarizeGroupUsers,
  summarizeJoinRequests
} from "/packages/public-core/src/access-state.js";

const AUTH_SESSION_STORAGE_KEY = "cga-studio-session-token";

const currentStudioState = structuredClone(sampleStudioState);
let currentCollaborationState = createSampleCollaborationState();
let currentAccessState = createSampleAccessState();
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
  { id: "password_reset", type: "intent", displayName: "password_reset" },
  { id: "account_update", type: "intent", displayName: "account_update" }
];
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

const dynamicMessages = {
  en: {
    "common.allowed": "Allowed",
    "common.blocked": "Blocked",
    "common.disabled": "Disabled",
    "common.enabled": "Enabled",
    "common.none": "None",
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
    "module.commercialCandidate": "Commercial Candidate"
  },
  ko: {
    "common.allowed": "허용",
    "common.blocked": "차단",
    "common.disabled": "비활성",
    "common.enabled": "활성",
    "common.none": "없음",
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
    "module.commercialCandidate": "상용 후보"
  },
  de: {
    "common.allowed": "Erlaubt",
    "common.blocked": "Blockiert",
    "common.disabled": "Deaktiviert",
    "common.enabled": "Aktiviert",
    "common.none": "Keine",
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
    "module.commercialCandidate": "Kommerzieller Kandidat"
  },
  ja: {
    "common.allowed": "許可",
    "common.blocked": "ブロック",
    "common.disabled": "無効",
    "common.enabled": "有効",
    "common.none": "なし",
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
    "module.commercialCandidate": "商用候補"
  },
  "zh-CN": {
    "common.allowed": "允许",
    "common.blocked": "阻止",
    "common.disabled": "禁用",
    "common.enabled": "启用",
    "common.none": "无",
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
    "module.commercialCandidate": "商业候选"
  },
  vi: {
    "common.allowed": "Được phép",
    "common.blocked": "Bị chặn",
    "common.disabled": "Tắt",
    "common.enabled": "Bật",
    "common.none": "Không có",
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
    "module.commercialCandidate": "Ứng viên thương mại"
  },
  fr: {
    "common.allowed": "Autorisé",
    "common.blocked": "Bloqué",
    "common.disabled": "Désactivé",
    "common.enabled": "Activé",
    "common.none": "Aucun",
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
    "module.commercialCandidate": "Candidat commercial"
  }
};

function getCurrentLocale() {
  return document.querySelector("[data-locale-select]")?.value || getCurrentAccessUser()?.locale || window.cgaStudioI18n?.getLocale?.() || document.documentElement.lang || "en";
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

async function refreshCompositionFromServer(groupId = currentWorkspaceGroupId, botId = currentWorkspaceBotId) {
  if (!groupId || !botId) return false;
  const payload = await requestCgaJson(getCompositionUrl(groupId, botId));
  return applyCompositionFromServer(payload);
}

async function refreshDetailAssetsFromServer(groupId = currentWorkspaceGroupId, botId = currentWorkspaceBotId) {
  if (!groupId || !botId) return false;
  const payload = await requestCgaJson(getDetailAssetsUrl(groupId, botId));
  return applyDetailAssetsFromServer(payload);
}

async function refreshOperationsStateFromServer(groupId = currentWorkspaceGroupId, botId = currentWorkspaceBotId) {
  if (!groupId || !botId) return false;
  const payload = await requestCgaJson(getOperationsStateUrl(groupId, botId));
  return applyOperationsStateFromServer(payload);
}

async function refreshCollaborationStateFromServer(groupId = currentWorkspaceGroupId, botId = currentWorkspaceBotId) {
  if (!groupId || !botId) return false;
  const payload = await requestCgaJson(getCollaborationStateUrl(groupId, botId));
  return applyCollaborationStateFromServer(payload);
}

async function saveCompositionToServer() {
  if (!currentWorkspaceGroupId || !currentWorkspaceBotId) return false;
  const payload = {
    ...currentCompositionState,
    group_id: currentWorkspaceGroupId,
    bot_id: currentWorkspaceBotId
  };
  await requestCgaJson(getCompositionUrl(), {
    method: "PUT",
    body: payload
  });
  return true;
}

async function runOperationsAction(action, body = {}) {
  if (!currentWorkspaceGroupId || !currentWorkspaceBotId) return false;
  try {
    const payload = await requestCgaJson(getOperationsStateUrl(currentWorkspaceGroupId, currentWorkspaceBotId, action), {
      method: "POST",
      body
    });
    clearGlobalMessage();
    applyOperationsStateFromServer(payload.operations_state);
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
  if (!currentWorkspaceGroupId || !currentWorkspaceBotId || !workItemId || !action) return false;
  try {
    const payload = await requestCgaJson(getCollaborationStateUrl(currentWorkspaceGroupId, currentWorkspaceBotId, workItemId, action), {
      method: "POST"
    });
    clearGlobalMessage();
    applyCollaborationStateFromServer(payload.collaboration_state);
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

async function saveDetailAssetsToServer() {
  if (!currentWorkspaceGroupId || !currentWorkspaceBotId) return false;
  await requestCgaJson(getDetailAssetsUrl(), {
    method: "PUT",
    body: {
      group_id: currentWorkspaceGroupId,
      bot_id: currentWorkspaceBotId,
      intent_utterances: currentIntentUtteranceAssets,
      entities: currentEntityAssets,
      dictionary: currentDictionaryAssets,
      rules: currentRuleAssets,
      scenarios: currentScenarioAssets
    }
  });
  return true;
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
  return applyStudioStateFromServer(payload.state);
}

async function saveStudioStateToServer() {
  if (!currentWorkspaceGroupId || !currentWorkspaceBotId) return false;
  await requestCgaJson(getStudioStateUrl(), {
    method: "PUT",
    body: {
      state: currentStudioState
    }
  });
  await refreshWorkspaceBotsFromServer(currentWorkspaceGroupId).catch(() => false);
  return true;
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

async function createWorkspaceBotOnServer(bot) {
  return requestCgaJson(getWorkspaceBotsUrl(bot.group_id), {
    method: "POST",
    body: {
      id: bot.id,
      name: bot.name,
      version: bot.version || "v0.1",
      status: bot.status || "draft",
      locale: bot.locale || "en"
    }
  });
}

function getApiAnswerRegistryUrl(groupId = currentApiGroupId, botId = currentApiBotId) {
  return `/api/cga/groups/${encodeURIComponent(groupId || "g-support")}/bots/${encodeURIComponent(botId || "supportbot-draft")}/api-answers`;
}

async function refreshApiRegistryFromServer() {
  if (!currentApiGroupId || !currentApiBotId) return false;
  const payload = await requestCgaJson(getApiAnswerRegistryUrl());
  if (!Array.isArray(payload.items)) return false;
  currentApiRegistry = [
    ...currentApiRegistry.filter((api) => !(api.group_id === currentApiGroupId && api.bot_id === currentApiBotId)),
    ...payload.items
  ];
  return true;
}

async function saveApiAnswerToServer(api) {
  return requestCgaJson(getApiAnswerRegistryUrl(api.group_id, api.bot_id), {
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
  currentTransferStatus = `Uploaded dialog JSON: ${currentScenarioAssets.length} node(s) replaced`;
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
  currentTransferStatus = `Uploaded API JSON: ${apiList.length} item(s) replaced`;
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
  currentTransferStatus = `Imported bot package: ${importedBot.name}`;
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
  currentTransferStatus = `Uploaded version package: ${currentStudioState.bot.version || "v0.1"}`;
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
  const locale = getCurrentLocale();
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
  if (channel) channel.textContent = operate.channel_status === "web_ok" ? t("operate.webOk", "Web OK") : operate.channel_status || "-";
  if (channelDetail) channelDetail.textContent = operate.channel_detail === "desktop_kakao_pending" ? t("operate.kakaoPending", "Desktop and Kakao KR pending") : operate.channel_detail || "-";
  if (volume) volume.textContent = Number(operate.conversation_volume ?? 0).toLocaleString();
  if (volumeStatus) volumeStatus.textContent = operate.volume_status === "normal" ? t("operate.normal", "Normal range") : operate.volume_status || "-";
  if (undefinedIntents) undefinedIntents.textContent = `${Number(operate.undefined_intents ?? 0)} ${t("common.pendingUnit", "pending")}`;
  if (containerHealth) containerHealth.textContent = operate.container_health === "healthy" ? t("operate.healthy", "Healthy") : operate.container_health || "-";
  if (cost) cost.textContent = operate.llm_cost_status === "below_threshold" ? t("operate.below", "Below threshold") : operate.llm_cost_status || "-";
  if (compatibility) compatibility.textContent = operate.compatibility === "preserved" ? t("operate.preserved", "Preserved") : operate.compatibility || "-";
}

function renderAllStatePanels() {
  renderGlobalMessage();
  renderCreateSummary();
  renderTopContext();
  bindCreateControls();
  bindConfigureComposition();
  bindOperationsActions();
  renderCreateSummary();
  renderTopContext();
  renderConfigureComposition();
  renderErrorSamples();
  renderStateSummary();
  renderReadinessIssues();
  renderOperationsPanels();
  document.dispatchEvent(new CustomEvent("cga:content-rendered"));
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

function applyScreenLayout() {
  const workspace = document.querySelector(".workspace");
  if (!workspace) return;
  const sectionsById = new Map(
    Array.from(workspace.querySelectorAll("[data-screen-id]")).map((section) => [section.dataset.screenId, section])
  );
  getVisibleLayout().forEach((item) => {
    const section = sectionsById.get(item.id);
    if (!section) return;
    section.dataset.layoutGroup = item.group;
    section.dataset.layoutMode = item.mode;
    section.hidden = false;
    workspace.appendChild(section);
  });
  sectionsById.forEach((section, id) => {
    if (!getVisibleLayout().some((item) => item.id === id)) {
      section.hidden = true;
    }
  });
}

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

function renderWorkspaceHome() {
  const groupSelect = document.querySelector("[data-workspace-group]");
  const summary = document.querySelector("[data-workspace-summary]");
  const botList = document.querySelector("[data-workspace-bots]");
  const createButton = document.querySelector("[data-workspace-create]");
  const transfer = document.querySelector("[data-workspace-transfer]");
  const currentBotName = document.querySelector("[data-current-bot-name]");
  const currentGroupName = document.querySelector("[data-current-group-name]");
  if (!groupSelect || !summary || !botList) return;
  const groups = getActiveGroupsForCurrentUser();
  if (!groups.some((group) => group.id === currentWorkspaceGroupId)) {
    currentWorkspaceGroupId = groups[0]?.id || currentWorkspaceGroupId;
  }
  const group = getCurrentWorkspaceGroup();
  const bots = currentWorkspaceBots.filter((bot) => bot.group_id === currentWorkspaceGroupId);
  const currentBot = getCurrentWorkspaceBot();
  const canCreateBot = canCreateBotInCurrentWorkspace();
  groupSelect.innerHTML = groups.map((item) => `<option value="${item.id}" ${item.id === currentWorkspaceGroupId ? "selected" : ""}>${item.name}</option>`).join("");
  summary.innerHTML = `
    <div><strong>${group?.name || t("workspace.noGroup", "No group")}</strong><span>${bots.length}${t("workspace.botCount", " bot(s)")} · ${currentAccessState.currentUserId} · ${canCreateBot ? "bot.create" : t("workspace.blockedCreate", "blocked: bot.create")}</span></div>
  `;
  if (createButton) createButton.disabled = !canCreateBot;
  botList.innerHTML = bots.map((bot) => `
    <button type="button" class="bot-list-row ${bot.id === currentWorkspaceBotId ? "selected" : ""}" data-open-bot="${bot.id}">
      <strong>${bot.name}</strong>
      <span>${bot.status} · ${bot.locale} · ${bot.updated_at}</span>
    </button>
  `).join("") || `<div class="empty-list"><strong>${t("workspace.noBotInGroup", "No bot in this group")}</strong><span>${t("workspace.createBotToStart", "Create a bot to start the workflow.")}</span></div>`;
  if (transfer) {
    const currentVersion = currentStudioState.bot.version || currentBot?.version || "v0.1";
    transfer.innerHTML = `
      <div class="workspace-list-head">
        <h4 data-i18n="transfer.botPackageTitle">Bot Version / Package</h4>
        <button type="button" ${canCreateBot ? "" : "disabled"} data-i18n="transfer.copyBot">Copy Bot</button>
      </div>
      <p data-i18n="transfer.botPackageBody">Manage the current bot by version, and exchange Aidot-compatible bot packages with Aidot or CGA.</p>
      <p class="compat-note" data-i18n="transfer.aidotLocaleBoundary">Aidot upload compatibility uses a single selected bot language. CGA multilingual packages require a CGA-only import path or an Aidot compatibility update.</p>
      <p class="transfer-status">${currentTransferStatus || `<span data-i18n="transfer.readyStatus">Ready for Aidot-compatible package exchange.</span>`}</p>
      <div class="version-strip">
        <span><b data-i18n="transfer.currentVersion">Current version</b>${currentVersion}</span>
        <span><b data-i18n="transfer.compatibility">Compatibility</b>Aidot / CGA</span>
        <span><b data-i18n="transfer.botPackageFormat">Bot package</b>${t("transfer.jsonReplace", "JSON · replace")}</span>
        <span><b data-i18n="transfer.assetPackageFormat">Text assets</b>${t("transfer.txtMergeShort", "TXT · merge")}</span>
      </div>
      <div class="button-row">
        <button type="button" data-download-bot-package data-i18n="transfer.downloadBot">Download Bot</button>
        <button type="button" class="ghost-btn" data-upload-bot-package data-i18n="transfer.uploadBot">Upload Bot</button>
        <button type="button" class="ghost-btn" data-download-version-package data-i18n="transfer.downloadVersion">Download Version</button>
        <button type="button" class="ghost-btn" data-upload-version-package data-i18n="transfer.uploadVersion">Upload Version</button>
      </div>
      <div class="transfer-history-panel">
        <h5 data-i18n="transfer.historyTitle">Server Transfer History</h5>
        <div class="transfer-history-list" data-transfer-history>
          <div><strong data-i18n="transfer.historyLoadingTitle">Loading history</strong><span data-i18n="transfer.historyLoadingBody">Reading server records...</span></div>
        </div>
      </div>
    `;
  }
  if (currentBotName) currentBotName.textContent = currentBot?.name || t("workspace.noBotSelected", "No bot selected");
  if (currentGroupName) currentGroupName.textContent = group?.name || t("workspace.noGroupSelected", "No group selected");
  renderTopContext();
  bindWorkspaceActions();
  refreshTransferHistory();
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
        currentTransferStatus = `Downloaded from server asset API: ${serverFileName}`;
        renderWorkspaceHome();
        document.dispatchEvent(new CustomEvent("cga:content-rendered"));
        return;
      }
      if (button.dataset.assetDownload === "dictionary") {
        const fileName = `Dictionary_${botName}_${getTodayStamp()}.txt`;
        downloadTextFile(fileName, buildDictionaryTxt(currentDictionaryAssets));
        currentTransferStatus = `Downloaded dictionary TXT: ${fileName}`;
      }
      if (button.dataset.assetDownload === "intentUtterance") {
        const fileName = `IntentUtterance_${botName}_${getTodayStamp()}.txt`;
        downloadTextFile(fileName, buildIntentUtteranceTxt(currentIntentUtteranceAssets));
        currentTransferStatus = `Downloaded intent utterance TXT: ${fileName}`;
      }
      if (button.dataset.assetDownload === "entity") {
        const fileName = `Entity_${botName}_${getTodayStamp()}.txt`;
        downloadTextFile(fileName, buildEntityTxt(currentEntityAssets));
        currentTransferStatus = `Downloaded entity TXT: ${fileName}`;
      }
      if (button.dataset.assetDownload === "rule") {
        const fileName = `Rule_${botName}_${getTodayStamp()}.txt`;
        downloadTextFile(fileName, buildRuleTxt(currentRuleAssets));
        currentTransferStatus = `Downloaded rule TXT: ${fileName}`;
      }
      if (button.dataset.assetDownload === "intentDialog") {
        const fileName = `Dialog_${botName}_${getTodayStamp()}.json`;
        downloadJsonFile(fileName, buildAidotDialogPackage("intent"));
        currentTransferStatus = `Downloaded intent dialog JSON: ${fileName}`;
      }
      if (button.dataset.assetDownload === "scenario") {
        const fileName = `Scenario_${botName}_${getTodayStamp()}.json`;
        downloadJsonFile(fileName, buildAidotDialogPackage("scenario"));
        currentTransferStatus = `Downloaded scenario JSON: ${fileName}`;
      }
      if (button.dataset.assetDownload === "apiMapping") {
        const fileName = `API_${botName}_${getTodayStamp()}.json`;
        downloadJsonFile(fileName, buildApiMappingPackage());
        currentTransferStatus = `Downloaded API JSON: ${fileName}`;
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
          currentTransferStatus = `Uploaded dictionary TXT: ${incoming.length} row(s) merged${synced ? " / server saved" : " / local only"}`;
        });
      }
      if (button.dataset.assetUpload === "intentUtterance") {
        requestTextUpload(async (text, file) => {
          const incoming = parseIntentUtteranceTxt(text);
          currentIntentUtteranceAssets = mergeIntentUtteranceAssets(currentIntentUtteranceAssets, incoming);
          const synced = await uploadAssetToServer("intentUtterance", text, file?.name);
          if (synced) await saveDetailAssetsToServer().catch(() => false);
          currentTransferStatus = `Uploaded intent utterance TXT: ${incoming.length} row(s) merged${synced ? " / server saved" : " / local only"}`;
        });
      }
      if (button.dataset.assetUpload === "entity") {
        requestTextUpload(async (text, file) => {
          const incoming = parseEntityTxt(text);
          currentEntityAssets = mergeEntityAssets(currentEntityAssets, incoming);
          const synced = await uploadAssetToServer("entity", text, file?.name);
          if (synced) await saveDetailAssetsToServer().catch(() => false);
          currentTransferStatus = `Uploaded entity TXT: ${incoming.length} row(s) merged${synced ? " / server saved" : " / local only"}`;
        });
      }
      if (button.dataset.assetUpload === "rule") {
        requestTextUpload(async (text, file) => {
          const incoming = parseRuleTxt(text);
          currentRuleAssets = mergeRuleAssets(currentRuleAssets, incoming);
          const synced = await uploadAssetToServer("rule", text, file?.name);
          if (synced) await saveDetailAssetsToServer().catch(() => false);
          currentTransferStatus = `Uploaded rule TXT: ${incoming.length} row(s) merged${synced ? " / server saved" : " / local only"}`;
        });
      }
      if (button.dataset.assetUpload === "intentDialog" || button.dataset.assetUpload === "scenario") {
        requestJsonUpload(async (json, file) => {
          applyAidotDialogPackage(json);
          const synced = await uploadAssetToServer(button.dataset.assetUpload, JSON.stringify(json, null, 2), file?.name);
          if (synced) await saveDetailAssetsToServer().catch(() => false);
          currentTransferStatus = `${currentTransferStatus}${synced ? " / server saved" : " / local only"}`;
        });
      }
      if (button.dataset.assetUpload === "apiMapping") {
        requestJsonUpload(async (json, file) => {
          applyApiMappingPackage(json);
          const synced = await uploadAssetToServer("apiMapping", JSON.stringify(json, null, 2), file?.name);
          currentTransferStatus = `${currentTransferStatus}${synced ? " / server saved" : " / local only"}`;
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
  if (currentUserBadge) {
    const roles = current.memberships.map((item) => item.role).join(", ") || t("common.noRole", "no role");
    currentUserBadge.textContent = `${current.user?.name || "User"} · ${current.user?.locale || "en"} · ${roles}`;
  }
  if (currentGroupBadge) currentGroupBadge.textContent = `${t("top.groupPrefix", "Group")}: ${group?.name || t("common.none", "None")}`;
  if (currentBotBadge) currentBotBadge.textContent = `${t("top.botPrefix", "Bot")}: ${currentStudioState.bot.name || bot?.name || t("common.none", "None")}`;
  if (currentVersionBadge) currentVersionBadge.textContent = `${t("top.versionPrefix", "Version")}: ${currentStudioState.bot.version || "v0.1"}`;
}

function bindWorkspaceActions() {
  const groupSelect = document.querySelector("[data-workspace-group]");
  const createButton = document.querySelector("[data-workspace-create]");
  const downloadBot = document.querySelector("[data-download-bot-package]");
  const uploadBot = document.querySelector("[data-upload-bot-package]");
  const downloadVersion = document.querySelector("[data-download-version-package]");
  const uploadVersion = document.querySelector("[data-upload-version-package]");
  if (groupSelect && groupSelect.dataset.bound !== "true") {
    groupSelect.dataset.bound = "true";
    groupSelect.addEventListener("change", async () => {
      currentWorkspaceGroupId = groupSelect.value;
      try {
        await refreshWorkspaceBotsFromServer(currentWorkspaceGroupId);
        await refreshStudioStateFromServer(currentWorkspaceGroupId, currentWorkspaceBotId);
        await refreshCompositionFromServer(currentWorkspaceGroupId, currentWorkspaceBotId);
        await refreshDetailAssetsFromServer(currentWorkspaceGroupId, currentWorkspaceBotId);
        await refreshOperationsStateFromServer(currentWorkspaceGroupId, currentWorkspaceBotId);
        await refreshCollaborationStateFromServer(currentWorkspaceGroupId, currentWorkspaceBotId);
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
  if (downloadBot && downloadBot.dataset.bound !== "true") {
    downloadBot.dataset.bound = "true";
    downloadBot.addEventListener("click", async () => {
      const bot = getCurrentWorkspaceBot();
      const serverFileName = await downloadAssetFromServer("botPackage");
      if (serverFileName) {
        currentTransferStatus = `Downloaded bot package from server asset API: ${serverFileName}`;
        renderWorkspaceHome();
        document.dispatchEvent(new CustomEvent("cga:content-rendered"));
        return;
      }
      const fileName = `Bot_${getSafeFileName(currentStudioState.bot.name || bot?.name, "CGA_Bot")}_${getTodayStamp()}.json`;
      downloadJsonFile(fileName, buildAidotBotPackage());
      currentTransferStatus = `Downloaded bot package: ${fileName}`;
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
        currentTransferStatus = `${currentTransferStatus}${synced ? " / server saved" : " / local only"}`;
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
        currentTransferStatus = `Downloaded version package from server asset API: ${serverFileName}`;
        renderWorkspaceHome();
        document.dispatchEvent(new CustomEvent("cga:content-rendered"));
        return;
      }
      const fileName = `Version_${getSafeFileName(currentStudioState.bot.name || bot?.name, "CGA_Bot")}_${getSafeFileName(version, "v0_1")}_${getTodayStamp()}.json`;
      downloadJsonFile(fileName, buildCgaVersionPackage());
      currentTransferStatus = `Downloaded version package: ${fileName}`;
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
        currentTransferStatus = `${currentTransferStatus}${synced ? " / server saved" : " / local only"}`;
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
      await refreshStudioStateFromServer(currentWorkspaceGroupId, currentWorkspaceBotId).catch(() => false);
      await refreshCompositionFromServer(currentWorkspaceGroupId, currentWorkspaceBotId).catch(() => false);
      await refreshDetailAssetsFromServer(currentWorkspaceGroupId, currentWorkspaceBotId).catch(() => false);
      await refreshOperationsStateFromServer(currentWorkspaceGroupId, currentWorkspaceBotId).catch(() => false);
      await refreshCollaborationStateFromServer(currentWorkspaceGroupId, currentWorkspaceBotId).catch(() => false);
      renderWorkspaceHome();
      renderAllStatePanels();
      document.dispatchEvent(new CustomEvent("cga:content-rendered"));
    });
  });
}

function renderAccessPanels() {
  const currentUserBadge = document.querySelector("[data-current-user-badge]");
  const accessOperations = document.querySelector("[data-access-operations]");
  const loginUser = document.querySelector("[data-login-user]");
  const loginIdInput = document.querySelector("[data-login-id]");
  const currentSession = document.querySelector("[data-current-session]");
  const authMessage = document.querySelector("[data-auth-message]");
  const joinGroup = document.querySelector("[data-join-group]");
  const joinRole = document.querySelector("[data-join-role]");
  const adminQueue = document.querySelector("[data-admin-action-queue]");
  const authFlow = document.querySelector("[data-auth-flow]");
  const groupUsers = document.querySelector("[data-group-users]");
  const joinRequests = document.querySelector("[data-join-requests]");
  const adminRequests = document.querySelector("[data-admin-requests]");
  const groupAccess = document.querySelector("[data-group-access]");
  const screenAccess = document.querySelector("[data-screen-access]");
  const authPolicy = document.querySelector("[data-auth-policy]");
  const adminPolicy = document.querySelector("[data-admin-policy]");
  if (!accessOperations || !loginUser || !currentSession || !joinGroup || !joinRole || !adminQueue || !authFlow || !groupUsers || !joinRequests || !adminRequests || !groupAccess || !screenAccess || !authPolicy || !adminPolicy) return;
  const current = summarizeAccess(currentAccessState);
  const operations = summarizeAccessOperations(currentAccessState);
  const policy = summarizeAccessPolicy(currentAccessState);
  renderTopContext();
  loginUser.innerHTML = currentAccessState.users
    .filter((user) => user.status === "active")
    .map((user) => `<option value="${user.id}" ${user.id === currentAccessState.currentUserId ? "selected" : ""}>${user.name} · ${user.id} · ${user.locale}</option>`)
    .join("");
  if (loginIdInput && !loginIdInput.value) {
    loginIdInput.value = currentAccessState.currentUserId || loginUser.value || "";
  }
  currentSession.innerHTML = `
    <strong>${current.user?.name || "User"}</strong>
    <span>${current.user?.id || ""} · ${current.user?.locale || "en"} · ${current.memberships.map((item) => `${item.group_id}/${item.role}`).join(", ")}</span>
  `;
  if (authMessage) {
    authMessage.classList.toggle("auth-message", Boolean(currentAuthMessage));
    renderMessageNode(authMessage, currentAuthMessage, "Authentication");
  }
  joinGroup.innerHTML = currentAccessState.groups
    .filter((group) => group.status === "active")
    .map((group) => `<option value="${group.id}">${group.name}</option>`)
    .join("");
  joinRole.innerHTML = ["viewer", "builder", "reviewer", "operator", "group_admin"]
    .map((role) => `<option value="${role}">${role}</option>`)
    .join("");
  adminQueue.innerHTML = [
    ...summarizeJoinRequests(currentAccessState).filter((request) => request.status === "pending").map((request) => {
      const canApprove = canApproveGroupJoinRequest(currentAccessState, { requestId: request.id, reviewerId: currentAccessState.currentUserId });
      return `
      <div class="${canApprove ? "" : "blocked-action"}">
        <strong>${request.user?.name || request.user_id} -> ${request.group?.name || request.group_id}</strong>
        <span>${request.requested_role} · ${t("admin.groupJoin", "group join")} · ${canApprove ? t("admin.groupAdminApproval", "group admin approval") : t("admin.requiresGroupAdmin", "requires group admin")}</span>
        <button type="button" data-approve-join="${request.id}" ${canApprove ? "" : "disabled"}>${t("admin.approve", "Approve")}</button>
      </div>
    `;
    }),
    ...summarizeAdminRequests(currentAccessState).filter((request) => request.status === "pending").map((request) => {
      const canApprove = canApproveAdminPermissionRequest(currentAccessState, { requestId: request.id, reviewerId: currentAccessState.currentUserId });
      return `
      <div class="${canApprove ? "" : "blocked-action"}">
        <strong>${request.user?.name || request.user_id} -> ${request.group?.name || request.group_id}</strong>
        <span>${request.requested_role} · ${t("admin.adminPermission", "admin permission")} · ${canApprove ? t("admin.systemAdminApproval", "system admin approval") : t("admin.requiresSystemAdmin", "requires system admin")}</span>
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
  authFlow.innerHTML = summarizeAuthWorkflow(currentAccessState).map((step, index) => `
    <div>
      <strong>${String(index + 1).padStart(2, "0")} · ${step.label}</strong>
      <span>${step.detail}</span>
    </div>
  `).join("");
  groupUsers.innerHTML = summarizeGroupUsers(currentAccessState).map((entry) => `
    <div>
      <strong>${entry.group.name}</strong>
      <span>${entry.users.map(({ user, membership }) => `${user?.name || membership.user_id} / ${membership.role} / ${user?.locale || "en"}`).join(", ") || t("admin.noActiveUser", "No active user")}</span>
    </div>
  `).join("");
  joinRequests.innerHTML = summarizeJoinRequests(currentAccessState).map((request) => `
    <div>
      <strong>${request.user?.name || request.user_id} -> ${request.group?.name || request.group_id}</strong>
      <span>${request.requested_role} · ${request.status}</span>
    </div>
  `).join("");
  adminRequests.innerHTML = summarizeAdminRequests(currentAccessState).map((request) => `
    <div>
      <strong>${request.user?.name || request.user_id} -> ${request.group?.name || request.group_id}</strong>
      <span>${request.requested_role} · ${request.status} · reviewer: admin</span>
    </div>
  `).join("");
  groupAccess.innerHTML = summarizeGroupBotAccess(currentAccessState).map((access) => `
    <div><strong>${access.group?.name || "Group"}</strong><span>${access.botId}</span></div>
    <div>${access.scopes.join(", ")}</div>
  `).join("");
  screenAccess.innerHTML = `
    <div class="current-user"><strong>${current.user?.name || "User"}</strong><span>${current.memberships.map((item) => item.group_id + " / " + item.role).join(", ")}</span></div>
    ${current.screens.map((screen) => `
      <div class="${screen.allowed ? "allowed" : "denied"}">
        <strong>${screen.screenId}</strong>
        <span>${screen.allowed ? t("common.allowed", "Allowed") : t("common.blocked", "Blocked")} · ${screen.scope}</span>
      </div>
    `).join("")}
  `;
  authPolicy.innerHTML = `
    <p><strong data-i18n="access.signupGroup">Signup creates own group</strong><span>${policy.signupCreatesOwnGroup ? t("common.enabled", "Enabled") : t("common.disabled", "Disabled")}</span></p>
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
  document.querySelectorAll(".management-nav a, [data-workflow-nav] a").forEach((link) => {
    const id = link.getAttribute("href")?.replace("#", "");
    const access = screenAccess.get(id);
    const allowed = access ? access.allowed : true;
    link.classList.toggle("access-blocked", !allowed);
    link.classList.toggle("access-allowed", allowed);
    link.setAttribute("aria-disabled", allowed ? "false" : "true");
    link.dataset.accessLabel = allowed ? t("common.allowed", "Allowed") : `${t("common.blocked", "Blocked")} · ${access?.scope || t("common.noScope", "no scope")}`;
  });
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
    apiOwnerMeta.textContent = `group_id: ${currentApiGroupId} · bot_id: ${currentApiBotId || "none"} · ${canManageApi ? "scope: apiAnswer.manage" : "blocked: apiAnswer.manage"}`;
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
  renderApiRegistry();
  document.dispatchEvent(new CustomEvent("cga:content-rendered"));
}

function bindAdminActionButtons() {
  document.querySelectorAll("[data-approve-join]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      await runAccessServerAction(
        () => requestCgaJson(`/api/cga/groups/join-requests/${encodeURIComponent(button.dataset.approveJoin)}/approve`, { method: "POST" }),
        () => {
          currentAccessState = approveGroupJoinRequest(currentAccessState, { requestId: button.dataset.approveJoin, reviewerId: currentAccessState.currentUserId });
        }
      );
    });
  });
  document.querySelectorAll("[data-approve-admin]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      await runAccessServerAction(
        () => requestCgaJson(`/api/cga/admin/permission-requests/${encodeURIComponent(button.dataset.approveAdmin)}/approve`, { method: "POST" }),
        () => {
          currentAccessState = approveAdminPermissionRequest(currentAccessState, { requestId: button.dataset.approveAdmin, reviewerId: currentAccessState.currentUserId });
        }
      );
    });
  });
}

function bindAdminWorkbench() {
  const loginSubmit = document.querySelector("[data-login-submit]");
  const loginUser = document.querySelector("[data-login-user]");
  const logoutSubmit = document.querySelector("[data-logout-submit]");
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
  if (loginSubmit && loginSubmit.dataset.bound !== "true") {
    loginSubmit.dataset.bound = "true";
    loginSubmit.addEventListener("click", async () => {
      const selectedUserId = document.querySelector("[data-login-user]")?.value;
      const userId = document.querySelector("[data-login-id]")?.value?.trim() || selectedUserId;
      const password = document.querySelector("[data-login-password]")?.value || "";
      if (!userId || !password) return;
      try {
        const session = await requestCgaJson("/api/cga/auth/login", { method: "POST", body: { user_id: userId, password } });
        rememberAuthSession(session);
        clearAuthMessage();
        currentAccessState = { ...currentAccessState, currentUserId: session.user?.id || userId };
        await refreshAccessStateFromServer();
        rerenderAdminAndAccess();
      } catch (error) {
        if (error.status) {
          setAuthMessage("error", "admin.loginFailedTitle", getCgaErrorMessage(error, t("errors.auth.loginFailed", "Login failed.")));
          rerenderAdminAndAccess();
          return;
        }
        currentAccessState = loginAsUser(currentAccessState, { userId });
        rerenderAdminAndAccess();
      }
    });
  }
  if (logoutSubmit && logoutSubmit.dataset.bound !== "true") {
    logoutSubmit.dataset.bound = "true";
    logoutSubmit.addEventListener("click", async () => {
      try {
        await requestCgaJson("/api/cga/auth/logout", { method: "POST" });
      } catch {
      }
      clearAuthSession();
      setAuthMessage("info", "admin.logoutTitle", "admin.logoutSuccess");
      currentAccessState = loginAsUser(currentAccessState, { userId: "admin" });
      rerenderAdminAndAccess();
    });
  }
  if (signupSubmit && signupSubmit.dataset.bound !== "true") {
    signupSubmit.dataset.bound = "true";
    signupSubmit.addEventListener("click", async () => {
      const id = document.querySelector("[data-signup-id]")?.value?.trim();
      const name = document.querySelector("[data-signup-name]")?.value?.trim();
      const password = document.querySelector("[data-signup-password]")?.value || "";
      if (!id || !name || !password) return;
      const locale = document.querySelector("[data-signup-locale]")?.value || "en";
      const groupName = document.querySelector("[data-signup-group]")?.value?.trim() || `${name} Group`;
      try {
        const session = await requestCgaJson("/api/cga/auth/signup", {
          method: "POST",
          body: {
            user_id: id,
            name,
            password,
            locale,
            group_name: groupName
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
        currentAccessState = applySignup(currentAccessState, { userId: id, name, locale, groupName });
        rerenderAdminAndAccess();
      }
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
  document.querySelectorAll(".management-nav a, [data-workflow-nav] a").forEach((link) => {
    if (link.dataset.guardBound === "true") return;
    link.dataset.guardBound = "true";
    link.addEventListener("click", (event) => {
      if (link.classList.contains("access-blocked")) {
        event.preventDefault();
      }
    });
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
  nav.innerHTML = workflowSteps.map((step, index) => `
    <a href="#${step.id}" class="${index === 1 ? "active" : ""}">
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
    <a href="#${link.id}">
      <span>${link.code}</span>
      <strong data-i18n="${link.titleKey}">${link.title}</strong>
      <small data-i18n="${link.subtitleKey}">${link.subtitle}</small>
    </a>
  `).join("");
}

function renderNavigationRails() {
  renderLinkRail("[data-production-nav]", productionLinks);
  renderLinkRail("[data-system-admin-nav]", systemAdminLinks);
  renderLinkRail("[data-reference-nav]", referenceLinks);
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

function bootApp() {
  applyScreenLayout();
  renderNavigationRails();
  renderWorkflowRail();
  bindAccessNavigationGuard();
  renderBoundaryMatrix();
  renderErrorSamples();
  bindCreateControls();
  bindConfigureComposition();
  renderCreateSummary();
  renderConfigureComposition();
  renderStateSummary();
  renderReadinessIssues();
  renderCommercialAvailability();
  renderCollaborationSummary();
  renderWorkspaceHome();
  renderTeamDashboard();
  renderAccessPanels();
  renderApiRegistry();
  bindAdminWorkbench();
  renderLockPolicy();
  bindAssetTransferActions();
  bindOperationsActions();
  syncStudioLocaleToCurrentUser();
  document.dispatchEvent(new CustomEvent("cga:content-rendered"));
  refreshAccessStateFromServer()
    .then(async (loaded) => {
      if (loaded) {
        await refreshWorkspaceBotsFromServer(currentWorkspaceGroupId).catch(() => false);
        await refreshStudioStateFromServer(currentWorkspaceGroupId, currentWorkspaceBotId).catch(() => false);
        await refreshCompositionFromServer(currentWorkspaceGroupId, currentWorkspaceBotId).catch(() => false);
        await refreshDetailAssetsFromServer(currentWorkspaceGroupId, currentWorkspaceBotId).catch(() => false);
        await refreshOperationsStateFromServer(currentWorkspaceGroupId, currentWorkspaceBotId).catch(() => false);
        await refreshCollaborationStateFromServer(currentWorkspaceGroupId, currentWorkspaceBotId).catch(() => false);
        renderAllStatePanels();
        rerenderAdminAndAccess();
      }
    })
    .catch(() => {});
}

document.addEventListener("DOMContentLoaded", bootApp);
document.addEventListener("cga:i18n-ready", syncStudioLocaleToCurrentUser);
document.addEventListener("cga:content-rendered", syncStudioLocaleToCurrentUser);
document.addEventListener("change", (event) => {
  if (event.target?.matches?.("[data-locale-select]")) {
    window.setTimeout(() => {
      renderAllStatePanels();
      rerenderAdminAndAccess();
      applyDynamicLocaleOverrides(event.target.value);
    }, 0);
  }
});
