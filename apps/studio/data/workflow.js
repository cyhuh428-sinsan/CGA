export const workflowSteps = [
  {
    id: "create",
    number: "01",
    title: "Create Bot",
    subtitle: "Structure decisions / Setup",
    mapsTo: "Aidot: Bot create / Bot setup / Version / channel defaults",
    publicCore: ["Bot name", "Description", "Default language", "LLM usage", "Composition input", "Bot Server location", "Orchestrator mode", "Basic channel", "User / login / roles"],
    commercial: ["Organization limits", "Template recommendation"]
  },
  {
    id: "configure",
    number: "02",
    title: "Configure Bot",
    subtitle: "Configure / Review",
    mapsTo: "Aidot: Training utterances / PDF-RAG / Intent draft",
    publicCore: ["Utterance input", "PDF upload", "Basic intent draft", "Review board"],
    commercial: ["PDF Q&A quality", "Intent merge recommendation", "Handoff validation"]
  },
  {
    id: "detail",
    number: "03",
    title: "Detail Settings",
    subtitle: "Edit",
    mapsTo: "Aidot: Intent / Entity / Dictionary / Scenario / API cards",
    publicCore: ["Intent", "Answer", "Synonym", "Entity", "Dictionary", "Scenario", "External API answer source"],
    commercial: ["Scenario suggestion", "API mapping automation"]
  },
  {
    id: "build",
    number: "04",
    title: "Build",
    subtitle: "Train / readiness",
    mapsTo: "Aidot: NLU training / LLM NLU / RAG embedding / deploy readiness",
    publicCore: ["Training status", "Readiness checklist", "Webchat contract check"],
    commercial: ["Quality score", "Risk prediction", "Auto-fix suggestions"]
  },
  {
    id: "test",
    number: "05",
    title: "Test",
    subtitle: "Simulator",
    mapsTo: "Aidot: Simulator / intent result / runtime variables",
    publicCore: ["Simulator display", "Matched intent", "Runtime variables", "Response check"],
    commercial: ["Regression set generation", "Failure classification"]
  },
  {
    id: "operate",
    number: "06",
    title: "Operate",
    subtitle: "Deploy / Improve",
    mapsTo: "Aidot: Webchat / channel / operation version / analysis / retrain",
    publicCore: ["Channel status", "Basic volume", "Operation version", "Compatibility"],
    commercial: ["LLM cost", "Alerting", "Undefined intent analysis", "Operations report"]
  }
];

export const managementLinks = [
  {
    id: "access-management",
    code: "AD",
    titleKey: "management.access.title",
    subtitleKey: "management.access.subtitle",
    title: "User / Group Admin",
    subtitle: "Login · roles · approvals"
  },
  {
    id: "api-answer-source",
    code: "API",
    titleKey: "management.api.title",
    subtitleKey: "management.api.subtitle",
    title: "Group API Registry",
    subtitle: "External answer sources"
  },
  {
    id: "aidot-feature-coverage",
    code: "AF",
    titleKey: "management.coverage.title",
    subtitleKey: "management.coverage.subtitle",
    title: "Aidot Coverage",
    subtitle: "Preserved feature map"
  }
];

export const errorSamples = [
  { code: "CGA_BOT_NAME_REQUIRED", key: "errors.bot.nameRequired" },
  { code: "CGA_LLM_NOT_CONNECTED", key: "errors.llm.notConnected" },
  { code: "CGA_LLM_REQUIRED_FOR_PDF", key: "errors.llm.requiredForPdf" },
  { code: "CGA_COMMERCIAL_MODULE_REQUIRED", key: "errors.commercial.moduleRequired" }
];
