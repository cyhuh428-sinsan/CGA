import { MODULE_IDS, MODULE_STATUS, COMMERCIAL_FEATURES, createModuleStatus, canUseFeature } from "../../contracts/src/module-contract.js";

export function createDefaultModuleRegistry() {
  return {
    [MODULE_IDS.ADVANCED_BUILDER]: createModuleStatus({
      moduleId: MODULE_IDS.ADVANCED_BUILDER,
      status: MODULE_STATUS.NOT_INSTALLED,
      enabledFeatures: []
    }),
    [MODULE_IDS.OPERATIONS_MONITOR]: createModuleStatus({
      moduleId: MODULE_IDS.OPERATIONS_MONITOR,
      status: MODULE_STATUS.NOT_INSTALLED,
      enabledFeatures: []
    }),
    [MODULE_IDS.ENTITLEMENT]: createModuleStatus({
      moduleId: MODULE_IDS.ENTITLEMENT,
      status: MODULE_STATUS.NOT_INSTALLED,
      enabledFeatures: []
    })
  };
}

export function getModuleStatus(registry, moduleId) {
  return registry?.[moduleId] || createModuleStatus({
    moduleId,
    status: MODULE_STATUS.NOT_INSTALLED,
    enabledFeatures: []
  });
}

export function getFeatureAvailability(registry, featureId) {
  const entries = Object.values(registry || {});
  const owner = entries.find((entry) => canUseFeature(entry, featureId));
  if (owner) {
    return {
      available: true,
      feature_id: featureId,
      module_id: owner.module_id,
      status: owner.status
    };
  }
  return {
    available: false,
    feature_id: featureId,
    module_id: inferModuleForFeature(featureId),
    status: MODULE_STATUS.NOT_INSTALLED
  };
}

export function inferModuleForFeature(featureId) {
  if (featureId?.startsWith("advancedBuilder.")) return MODULE_IDS.ADVANCED_BUILDER;
  if (featureId?.startsWith("operationsMonitor.")) return MODULE_IDS.OPERATIONS_MONITOR;
  if (featureId?.startsWith("entitlement.")) return MODULE_IDS.ENTITLEMENT;
  return null;
}

export const DEFAULT_COMMERCIAL_FEATURE_CHECKS = Object.freeze([
  COMMERCIAL_FEATURES.PDF_QA_QUALITY,
  COMMERCIAL_FEATURES.INTENT_MERGE_RECOMMENDATION,
  COMMERCIAL_FEATURES.HANDOFF_RESULT_VALIDATION,
  COMMERCIAL_FEATURES.LLM_COST_TRACKING,
  COMMERCIAL_FEATURES.CHANNEL_ALERTING,
  COMMERCIAL_FEATURES.UNDEFINED_INTENT_ANALYSIS,
  COMMERCIAL_FEATURES.LICENSE_VALIDATION
]);
