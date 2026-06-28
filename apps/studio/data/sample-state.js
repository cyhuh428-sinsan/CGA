export const sampleStudioState = {
  bot: {
    id: null,
    name: "",
    description: "",
    version: "v0.1",
    defaultLocale: "ko",
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
    kakaoKr: "disabled"
  },
  commercialModules: {}
};
