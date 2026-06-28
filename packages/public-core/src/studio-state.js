export const LLM_CONNECTION_STATUS = Object.freeze({
  CONNECTED: "connected",
  NOT_CONNECTED: "not_connected",
  REQUIRED: "required"
});

export const STEP_STATUS = Object.freeze({
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  READY: "ready",
  BLOCKED: "blocked",
  COMPLETE: "complete"
});

export const CHANNEL_STATUS = Object.freeze({
  NOT_CONFIGURED: "not_configured",
  CONNECTED: "connected",
  FAILED: "failed",
  DISABLED: "disabled"
});

export const BOT_COMPOSITION_INPUT = Object.freeze({
  UTTERANCES: "utterances",
  PDF: "pdf",
  BOTH: "both"
});

export const BOT_SERVER_LOCATION = Object.freeze({
  ORCHESTRATOR_SERVER: "orchestrator_server",
  SEPARATE_SERVER: "separate_server",
  DECIDE_LATER: "decide_later"
});

export const ORCHESTRATOR_MODE = Object.freeze({
  CONNECT_EXISTING: "connect_existing",
  DEPLOY_NEW: "deploy_new",
  DECIDE_LATER: "decide_later"
});

export function createEmptyStudioState() {
  return {
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
      compositionInput: BOT_COMPOSITION_INPUT.UTTERANCES,
      allowPdf: false,
      botServerLocation: BOT_SERVER_LOCATION.DECIDE_LATER,
      orchestratorMode: ORCHESTRATOR_MODE.DECIDE_LATER
    },
    orchestrator: {
      mode: ORCHESTRATOR_MODE.DECIDE_LATER,
      endpoint: null
    },
    llm: {
      status: LLM_CONNECTION_STATUS.NOT_CONNECTED,
      provider: null,
      model: null
    },
    workflow: {
      create: STEP_STATUS.IN_PROGRESS,
      configure: STEP_STATUS.NOT_STARTED,
      detail: STEP_STATUS.NOT_STARTED,
      build: STEP_STATUS.NOT_STARTED,
      test: STEP_STATUS.NOT_STARTED,
      operate: STEP_STATUS.NOT_STARTED
    },
    counts: {
      intents: 0,
      utterances: 0,
      documents: 0,
      pendingApprovals: 0
    },
    channels: {
      web: CHANNEL_STATUS.NOT_CONFIGURED,
      desktopMessenger: CHANNEL_STATUS.NOT_CONFIGURED,
      kakaoKr: CHANNEL_STATUS.DISABLED
    },
    commercialModules: {}
  };
}

export function deriveReadiness(state) {
  const issues = [];
  if (!state?.bot?.name) issues.push({ code: "CGA_BOT_NAME_REQUIRED", key: "errors.bot.nameRequired" });
  if (state?.structuralChoices?.compositionInput !== BOT_COMPOSITION_INPUT.UTTERANCES && !state?.structuralChoices?.useLlm) {
    issues.push({ code: "CGA_LLM_REQUIRED_FOR_PDF", key: "errors.llm.requiredForPdf" });
  }
  if (state?.llm?.status !== LLM_CONNECTION_STATUS.CONNECTED && state?.counts?.documents > 0) {
    issues.push({ code: "CGA_LLM_REQUIRED_FOR_PDF", key: "errors.llm.requiredForPdf" });
  }
  return {
    ready: issues.length === 0,
    issues
  };
}

export function canGeneratePdfQa(state) {
  return Boolean(state?.structuralChoices?.allowPdf) &&
    state?.structuralChoices?.useLlm === true &&
    state?.llm?.status === LLM_CONNECTION_STATUS.CONNECTED;
}

export function isStructuralChoiceLocked(choiceKey) {
  return [
    "useLlm",
    "compositionInput",
    "allowPdf",
    "botServerLocation",
    "orchestratorMode"
  ].includes(choiceKey);
}

export function canUseKakaoChannel(state) {
  return state?.bot?.defaultLocale === "ko";
}


export const TRAINING_LOCKED_CREATE_FIELDS = Object.freeze([
  "structuralChoices.useLlm",
  "structuralChoices.compositionInput",
  "structuralChoices.allowPdf",
  "structuralChoices.botServerLocation",
  "structuralChoices.orchestratorMode",
  "bot.defaultLocale",
  "bot.selectedChannels"
]);

export const RUNTIME_ADJUSTABLE_FIELDS = Object.freeze([
  "llm.provider",
  "llm.model",
  "llm.baseUrl",
  "prompt.template",
  "runtime.costLimit",
  "runtime.timeout"
]);

export function isTrainingLockedCreateField(fieldPath) {
  return TRAINING_LOCKED_CREATE_FIELDS.includes(fieldPath);
}

export function canChangeAfterTraining(fieldPath) {
  return !isTrainingLockedCreateField(fieldPath);
}
