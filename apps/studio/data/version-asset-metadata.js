function clonePlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return JSON.parse(JSON.stringify(value));
}

export function createEmptyVersionAssetMetadataState() {
  return {
    documentExtraFields: {},
    systemConfigExtraFields: {},
    legacyVersionExtraFields: {}
  };
}

export function cloneVersionAssetMetadataState(state) {
  const base = createEmptyVersionAssetMetadataState();
  const source = state && typeof state === "object" ? state : base;
  return {
    documentExtraFields: clonePlainObject(source.documentExtraFields),
    systemConfigExtraFields: clonePlainObject(source.systemConfigExtraFields),
    legacyVersionExtraFields: clonePlainObject(source.legacyVersionExtraFields)
  };
}

export function buildVersionAssetMetadataSnapshot(state) {
  const normalized = cloneVersionAssetMetadataState(state);
  return {
    document_extra_fields: normalized.documentExtraFields,
    system_config_extra_fields: normalized.systemConfigExtraFields,
    legacy_version_extra_fields: normalized.legacyVersionExtraFields
  };
}

export function readVersionAssetMetadataSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return createEmptyVersionAssetMetadataState();
  }
  return {
    documentExtraFields: clonePlainObject(snapshot.document_extra_fields),
    systemConfigExtraFields: clonePlainObject(snapshot.system_config_extra_fields),
    legacyVersionExtraFields: clonePlainObject(snapshot.legacy_version_extra_fields)
  };
}
