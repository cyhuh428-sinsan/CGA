export const sampleStudioState = {
  bot: {
    id: "supportbot-draft",
    name: "SupportBot Draft",
    description: "Customer support chatbot draft for web and messenger channels.",
    version: "v0.1",
    defaultLocale: "en",
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
    intents: 2,
    utterances: 10,
    documents: 1,
    pendingApprovals: 1
  },
  channels: {
    web: "connected",
    desktopMessenger: "not_configured",
    kakaoKr: "disabled"
  },
  commercialModules: {}
};
