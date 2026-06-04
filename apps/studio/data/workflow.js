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

export const productionLinks = [
  {
    id: "workspace-home",
    code: "BOT",
    titleKey: "production.workspace.title",
    subtitleKey: "production.workspace.subtitle",
    title: "Bot Workspace",
    subtitle: "Groups · bots · entry"
  },
  {
    id: "team-dashboard",
    code: "TM",
    titleKey: "production.team.title",
    subtitleKey: "production.team.subtitle",
    title: "Team Dashboard",
    subtitle: "Tasks · reviews · blocks"
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

export const systemAdminLinks = [
  {
    id: "access-management",
    code: "AD",
    titleKey: "systemAdmin.access.title",
    subtitleKey: "systemAdmin.access.subtitle",
    title: "User / Group Admin",
    subtitle: "Login · roles · approvals"
  }
];

export const referenceLinks = [
  {
    id: "aidot-feature-coverage",
    code: "AF",
    titleKey: "reference.coverage.title",
    subtitleKey: "reference.coverage.subtitle",
    title: "Aidot Coverage",
    subtitle: "Preserved feature map"
  },
  {
    id: "hero",
    code: "TMP",
    titleKey: "reference.temporary.title",
    subtitleKey: "reference.temporary.subtitle",
    title: "Temporary Notes",
    subtitle: "Removed before final UI"
  }
];

export const errorSamples = [
  { code: "CGA_BOT_NAME_REQUIRED", key: "errors.bot.nameRequired" },
  { code: "CGA_LLM_NOT_CONNECTED", key: "errors.llm.notConnected" },
  { code: "CGA_LLM_REQUIRED_FOR_PDF", key: "errors.llm.requiredForPdf" },
  { code: "CGA_COMMERCIAL_MODULE_REQUIRED", key: "errors.commercial.moduleRequired" }
];
