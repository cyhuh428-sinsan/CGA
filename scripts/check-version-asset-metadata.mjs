import assert from "node:assert/strict";

import {
  buildVersionAssetMetadataSnapshot,
  cloneVersionAssetMetadataState,
  createEmptyVersionAssetMetadataState,
  readVersionAssetMetadataSnapshot
} from "../apps/studio/data/version-asset-metadata.js";

const empty = createEmptyVersionAssetMetadataState();
assert.deepEqual(empty, {
  documentExtraFields: {},
  systemConfigExtraFields: {},
  legacyVersionExtraFields: {}
});

const sourceState = {
  documentExtraFields: {
    manifest: {
      created_by: "aidot",
      tags: ["ops", "history"]
    }
  },
  systemConfigExtraFields: {
    analytics: {
      mode: "legacy"
    }
  },
  legacyVersionExtraFields: {
    migration_notes: ["kept"]
  }
};

const clonedState = cloneVersionAssetMetadataState(sourceState);
assert.deepEqual(clonedState, sourceState);
assert.notStrictEqual(clonedState.documentExtraFields, sourceState.documentExtraFields);
assert.notStrictEqual(clonedState.systemConfigExtraFields, sourceState.systemConfigExtraFields);
assert.notStrictEqual(clonedState.legacyVersionExtraFields, sourceState.legacyVersionExtraFields);

clonedState.documentExtraFields.manifest.created_by = "cga";
assert.equal(sourceState.documentExtraFields.manifest.created_by, "aidot");

const snapshot = buildVersionAssetMetadataSnapshot(sourceState);
assert.deepEqual(snapshot, {
  document_extra_fields: {
    manifest: {
      created_by: "aidot",
      tags: ["ops", "history"]
    }
  },
  system_config_extra_fields: {
    analytics: {
      mode: "legacy"
    }
  },
  legacy_version_extra_fields: {
    migration_notes: ["kept"]
  }
});

const restoredState = readVersionAssetMetadataSnapshot(snapshot);
assert.deepEqual(restoredState, sourceState);
assert.notStrictEqual(restoredState.documentExtraFields, snapshot.document_extra_fields);
assert.notStrictEqual(restoredState.systemConfigExtraFields, snapshot.system_config_extra_fields);
assert.notStrictEqual(restoredState.legacyVersionExtraFields, snapshot.legacy_version_extra_fields);

restoredState.systemConfigExtraFields.analytics.mode = "rewritten";
assert.equal(snapshot.system_config_extra_fields.analytics.mode, "legacy");

const normalizedFromInvalidState = cloneVersionAssetMetadataState({
  documentExtraFields: [],
  systemConfigExtraFields: "bad",
  legacyVersionExtraFields: null
});
assert.deepEqual(normalizedFromInvalidState, empty);

const normalizedFromInvalidSnapshot = readVersionAssetMetadataSnapshot({
  document_extra_fields: [],
  system_config_extra_fields: "bad",
  legacy_version_extra_fields: null
});
assert.deepEqual(normalizedFromInvalidSnapshot, empty);

console.log("version asset metadata check passed");
