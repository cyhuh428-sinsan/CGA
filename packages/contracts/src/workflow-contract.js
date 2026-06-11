export const VISIBLE_WORKFLOW_STEPS = Object.freeze([
  { id: "create", number: "01", label: "Create Bot", internalSteps: ["Create", "Setup"] },
  { id: "configure", number: "02", label: "Configure Bot", internalSteps: ["Configure", "Review"] },
  { id: "detail", number: "03", label: "Detail Settings", internalSteps: ["Edit"] },
  { id: "build", number: "04", label: "Bot Production", internalSteps: ["Train", "Deploy readiness"] },
  { id: "test", number: "05", label: "Test", internalSteps: ["Test"] },
  { id: "evaluate", number: "06", label: "Evaluate", internalSteps: ["Evaluation", "Quality Check"] }
]);

export const AIDOT_COMPATIBILITY_CONTRACT = Object.freeze({
  webchatApi: "unchanged",
  channelApi: "unchanged",
  runtimeVariables: "unchanged",
  simulatorFlow: "unchanged",
  cgaCompositionEngine: "llm_only_visible_flow"
});
