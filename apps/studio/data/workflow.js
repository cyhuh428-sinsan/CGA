export const workflowSteps = [
  {
    id: "create",
    number: "01",
    title: "Bot Creation",
    subtitle: "Create bot",
    mapsTo: "Aidot: locked bot setup fields after bot creation",
    publicCore: ["Bot name", "Description", "Default language", "Bot type", "Initial version", "Initial channel target"],
    commercial: ["Organization limits", "Template recommendation"]
  },
  {
    id: "configure",
    number: "02",
    title: "Bot Settings",
    subtitle: "Base settings",
    mapsTo: "Aidot: editable bot setup fields after bot creation",
    publicCore: ["LLM provider", "LLM model", "LLM base URL", "Answer mode", "Channel defaults", "Runtime-safe settings"],
    commercial: ["PDF Q&A quality", "Intent merge recommendation", "Handoff validation"]
  },
  {
    id: "detail",
    number: "03",
    title: "Bot Composition",
    subtitle: "LLM composition",
    mapsTo: "Aidot: Configure screen / training utterances / PDF-RAG / intent draft",
    publicCore: ["Training utterance input", "Manual LLM handoff", "PDF Q&A generation when LLM is connected", "Intent draft", "Review board"],
    commercial: ["Scenario suggestion", "API mapping automation"]
  },
  {
    id: "build",
    number: "04",
    title: "Bot Production",
    subtitle: "Make bot",
    mapsTo: "Aidot: Intent / utterance / entity / dictionary / dialog design",
    publicCore: ["Intent", "Utterance", "Answer", "Entity", "Dictionary", "Dialog start", "Dialog design", "API cards"],
    commercial: ["Quality score", "Risk prediction", "Auto-fix suggestions"]
  },
  {
    id: "test",
    number: "05",
    title: "Bot Test",
    subtitle: "Simulator",
    mapsTo: "Aidot: Simulator / intent result / runtime variables",
    publicCore: ["Simulator display", "Matched intent", "Runtime variables", "Response check"],
    commercial: ["Regression set generation", "Failure classification"]
  },
  {
    id: "evaluate",
    number: "06",
    title: "Bot Evaluation",
    subtitle: "Evaluate",
    mapsTo: "Aidot: Evaluation / quality check / readiness result",
    publicCore: ["Evaluation result", "Quality status", "Regression readiness"],
    commercial: ["Quality score", "Failure classification", "Improvement recommendation"]
  }
];

export const queryLinks = [
  {
    id: "bot-management",
    code: "BM",
    titleKey: "production.botManagement.title",
    subtitleKey: "production.botManagement.subtitle",
    title: "Bot Management",
    subtitle: "Versions · packages · copy"
  },
  {
    id: "workspace-home",
    code: "BOT",
    titleKey: "production.workspace.title",
    subtitleKey: "production.workspace.subtitle",
    title: "Bot Workspace",
    subtitle: "Groups · bots · work"
  },
  {
    id: "team-dashboard",
    code: "TM",
    titleKey: "production.team.title",
    subtitleKey: "production.team.subtitle",
    title: "Operations Dashboard",
    subtitle: "Operations · status · alerts"
  },
  {
    id: "api-answer-source",
    code: "API",
    titleKey: "production.api.title",
    subtitleKey: "production.api.subtitle",
    title: "Group API Registry",
    subtitle: "External answer sources"
  }
];

export const managementLinks = [];

export const systemAdminSections = [
  {
    title: "사용자 관리",
    links: [
      { id: "access-management", subview: "users", label: "사용자 관리" },
      { id: "access-management", subview: "login-history", label: "로그인 이력" },
      { id: "access-management", subview: "groups", label: "그룹 관리" }
    ]
  },
  {
    title: "현황 조회",
    links: [
      { id: "access-management", subview: "system-log", label: "운영/시스템 로그 조회" },
      { id: "access-management", subview: "bot-status", label: "봇 현황 조회" },
      { id: "access-management", subview: "training-history", label: "학습 이력 조회" },
      { id: "access-management", subview: "conversation-history", label: "대화 이력 조회" },
      { id: "access-management", subview: "api-call-history", label: "API 호출 이력 조회" },
      { id: "access-management", subview: "queue-history", label: "Queue 이력 조회" },
      { id: "access-management", subview: "intent-feedback", label: "의도별 피드백 조회" }
    ]
  },
  {
    title: "대화 관리",
    links: [
      { id: "access-management", subview: "common-variable", label: "공통 변수 관리하기" },
      { id: "access-management", subview: "default-message", label: "기본 메시지 관리" }
    ]
  },
  {
    title: "시스템 연계",
    links: [
      { id: "access-management", subview: "channel-management", label: "채널 관리" },
      { id: "access-management", subview: "botstation-link", label: "봇스테이션 연계 현황" }
    ]
  },
  {
    title: "기타 관리",
    links: [
      { id: "access-management", subview: "template-list", label: "템플릿 목록" },
      { id: "access-management", subview: "license-status", label: "라이선스 조회" }
    ]
  }
];

export const operationLinks = [
  {
    id: "operate",
    code: "RT",
    titleKey: "operation.retrain.title",
    subtitleKey: "operation.retrain.subtitle",
    title: "Retraining",
    subtitle: "Improve bot"
  },
  {
    id: "analysis",
    code: "AN",
    titleKey: "operation.analysis.title",
    subtitleKey: "operation.analysis.subtitle",
    title: "Analysis",
    subtitle: "Review usage"
  }
];


export const errorSamples = [
  { code: "CGA_BOT_NAME_REQUIRED", key: "errors.bot.nameRequired", localeSource: "user.locale" },
  { code: "CGA_LLM_NOT_CONNECTED", key: "errors.llm.notConnected", localeSource: "user.locale" },
  { code: "CGA_LLM_REQUIRED_FOR_PDF", key: "errors.llm.requiredForPdf", localeSource: "user.locale" },
  { code: "CGA_COMMERCIAL_MODULE_REQUIRED", key: "errors.commercial.moduleRequired", localeSource: "user.locale" },
  { code: "BOT_ANSWER_NOT_FOUND", key: "botErrors.answer.notFound", localeSource: "bot.defaultLocale" },
  { code: "BOT_API_LOOKUP_FAILED", key: "botErrors.api.lookupFailed", localeSource: "bot.defaultLocale" },
  { code: "BOT_FALLBACK_REQUIRED", key: "botErrors.fallback.required", localeSource: "bot.defaultLocale" }
];
