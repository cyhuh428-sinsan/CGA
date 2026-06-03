export const MODULE_IDS = Object.freeze({
  ADVANCED_BUILDER: "advanced-builder",
  OPERATIONS_MONITOR: "operations-monitor",
  ENTITLEMENT: "entitlement"
});

export const MODULE_STATUS = Object.freeze({
  AVAILABLE: "available",
  NOT_INSTALLED: "not_installed",
  NOT_ENTITLED: "not_entitled",
  DISABLED: "disabled"
});

export const COMMERCIAL_FEATURES = Object.freeze({
  PDF_QA_QUALITY: "advancedBuilder.pdfQaQuality",
  INTENT_MERGE_RECOMMENDATION: "advancedBuilder.intentMergeRecommendation",
  HANDOFF_RESULT_VALIDATION: "advancedBuilder.handoffResultValidation",
  LLM_COST_TRACKING: "operationsMonitor.llmCostTracking",
  CHANNEL_ALERTING: "operationsMonitor.channelAlerting",
  UNDEFINED_INTENT_ANALYSIS: "operationsMonitor.undefinedIntentAnalysis",
  LICENSE_VALIDATION: "entitlement.licenseValidation"
});

export function createModuleStatus({ moduleId, status, enabledFeatures = [] }) {
  return {
    module_id: moduleId,
    status,
    enabled_features: enabledFeatures
  };
}

export function canUseFeature(moduleStatus, featureId) {
  return moduleStatus?.status === MODULE_STATUS.AVAILABLE &&
    Array.isArray(moduleStatus.enabled_features) &&
    moduleStatus.enabled_features.includes(featureId);
}
