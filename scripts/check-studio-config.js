const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const studio = path.join(root, "apps", "studio");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`OK ${message}`);
}

function extractScreenIds(html) {
  return [...html.matchAll(/data-screen-id="([^"]+)"/g)].map((match) => match[1]);
}

function extractLayoutIds(layoutSource) {
  return [...layoutSource.matchAll(/id:\s*"([^"]+)"/g)].map((match) => match[1]);
}

function extractLocaleKeys(source) {
  const keys = new Set();
  for (const match of source.matchAll(/data-i18n="([^"]+)"/g)) keys.add(match[1]);
  for (const match of source.matchAll(/data-error-key="([^"]+)"/g)) keys.add(match[1]);
  return keys;
}

function loadLocales() {
  const localeDir = path.join(root, "packages", "i18n", "locales");
  return fs.readdirSync(localeDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => ({ name, data: JSON.parse(read(path.join(localeDir, name))) }));
}

const html = read(path.join(studio, "index.html"));
const layoutSource = read(path.join(studio, "data", "layout.js"));
const workflowSource = read(path.join(studio, "data", "workflow.js"));
const studioAppSource = read(path.join(studio, "app.js"));
const errorCatalog = JSON.parse(read(path.join(root, "packages", "i18n", "error-catalog.json")));
const locales = loadLocales();

const screenIds = new Set(extractScreenIds(html));
const layoutIds = new Set(extractLayoutIds(layoutSource));

for (const id of layoutIds) {
  if (!screenIds.has(id)) fail(`layout id '${id}' has no matching data-screen-id section`);
}
for (const id of screenIds) {
  if (!layoutIds.has(id)) fail(`screen section '${id}' is missing from layout.js`);
}
if (process.exitCode !== 1) pass("layout ids match screen sections");

const workflowIds = [...workflowSource.matchAll(/id:\s*"([^"]+)"/g)].map((match) => match[1]);
for (const id of ["create", "configure", "detail", "build", "test", "operate"]) {
  if (!workflowIds.includes(id)) fail(`workflow step '${id}' is missing`);
}
if (process.exitCode !== 1) pass("required workflow steps exist");

const htmlLocaleKeys = extractLocaleKeys(html);
const appSource = read(path.join(studio, "i18n.js"));
for (const match of appSource.matchAll(/'([^']+)'\s*:/g)) {
  if (match[1].includes(".") && !match[1].includes("http")) htmlLocaleKeys.add(match[1]);
}
for (const locale of locales) {
  for (const key of htmlLocaleKeys) {
    if (!(key in locale.data) && locale.name === "en.json") fail(`English locale missing key '${key}'`);
  }
}
if (process.exitCode !== 1) pass("English locale contains required static keys or i18n.js fallback data");

const catalogKeys = errorCatalog.errors.map((item) => item.key);
for (const locale of locales) {
  for (const key of catalogKeys) {
    if (!(key in locale.data)) fail(`${locale.name} missing error key '${key}'`);
  }
}
if (process.exitCode !== 1) pass("all locales contain catalog error keys");

if (!appSource.includes("window.cgaStudioI18n")) fail("studio i18n API is not exposed for user locale sync");
if (!studioAppSource.includes("syncStudioLocaleToCurrentUser")) fail("studio app does not sync UI locale from current user");
if (!studioAppSource.includes("getCurrentAccessUser()?.locale")) fail("studio app locale sync is not based on user.locale");
if (process.exitCode !== 1) pass("studio UI locale sync is wired to current user locale");

const contractFiles = [
  "packages/contracts/src/error-contract.js",
  "packages/contracts/src/module-contract.js",
  "packages/contracts/src/workflow-contract.js",
  "packages/contracts/src/access-contract.js",
  "packages/contracts/src/auth-api-contract.js",
  "packages/contracts/src/api-answer-contract.js",
  "packages/contracts/src/aidot-package-contract.js",
  "packages/contracts/src/asset-transfer-api-contract.js",
  "packages/contracts/src/collaboration-contract.js"
];
for (const file of contractFiles) {
  if (!fs.existsSync(path.join(root, file))) fail(`missing contract file '${file}'`);
}
if (process.exitCode !== 1) pass("contract files exist");

async function checkAccessTransitions() {
  const accessState = await import("../packages/public-core/src/access-state.js");
  let state = accessState.createSampleAccessState();
  state = accessState.applySignup(state, { userId: "u-new", name: "New User", locale: "vi", groupName: "New User Group" });
  if (!state.users.some((user) => user.id === "u-new" && user.locale === "vi")) fail("signup transition did not create user with locale");
  if (!state.groups.some((group) => group.id === "g-u-new")) fail("signup transition did not create user group");
  if (!state.memberships.some((membership) => membership.user_id === "u-new" && membership.group_id === "g-u-new" && membership.role === "group_admin")) fail("signup transition did not assign group admin");
  state = accessState.requestGroupJoin(state, { id: "jr-new-support", userId: "u-new", groupId: "g-support", requestedRole: "builder" });
  const beforeUnauthorizedJoin = state.memberships.length;
  state = accessState.approveGroupJoinRequest(state, { requestId: "jr-new-support", reviewerId: "u-builder" });
  if (state.memberships.length !== beforeUnauthorizedJoin) fail("builder should not approve group join request");
  state = accessState.approveGroupJoinRequest(state, { requestId: "jr-new-support", reviewerId: "u-group-admin" });
  if (!state.memberships.some((membership) => membership.user_id === "u-new" && membership.group_id === "g-support" && membership.role === "builder")) fail("join approval transition did not create membership");
  const supportScopes = accessState.getEffectiveGroupScopes(state, "u-new", "g-support", "supportbot-draft");
  const ownGroupScopes = accessState.getEffectiveGroupScopes(state, "u-new", "g-u-new", "supportbot-draft");
  const pendingOpsScopes = accessState.getEffectiveGroupScopes(state, "u-builder", "g-ops", "supportbot-draft");
  const operatorScopes = accessState.getEffectiveGroupScopes(state, "u-operator", "g-ops", "supportbot-draft");
  if (!supportScopes.includes("bot.create")) fail("group-scoped builder should have bot.create in approved group");
  if (!ownGroupScopes.includes("bot.create")) fail("signup owner group admin should have bot.create in own group");
  if (pendingOpsScopes.includes("bot.create")) fail("pending group join should not grant bot.create in target group");
  if (pendingOpsScopes.includes("bot.operate")) fail("pending group join should not grant group access scopes in target group");
  if (operatorScopes.includes("bot.create")) fail("operator should not get bot.create in operations group");
  const beforeUnauthorizedGroupCreate = state.groups.length;
  state = accessState.createManagedGroup(state, { id: "g-nope", name: "Nope", actorId: "u-builder" });
  if (state.groups.length !== beforeUnauthorizedGroupCreate) fail("builder should not create managed group when system admin approval is required");
  state = accessState.createManagedGroup(state, { id: "g-admin-created", name: "Admin Created", actorId: "admin" });
  if (!state.groups.some((group) => group.id === "g-admin-created")) fail("system admin should create managed group");
  const beforeUnauthorizedAdmin = state.memberships.find((membership) => membership.user_id === "u-reviewer" && membership.group_id === "g-support")?.role;
  state = accessState.approveAdminPermissionRequest(state, { requestId: "ar-reviewer-admin", reviewerId: "u-group-admin" });
  if (state.memberships.find((membership) => membership.user_id === "u-reviewer" && membership.group_id === "g-support")?.role !== beforeUnauthorizedAdmin) fail("group admin should not approve admin permission request");
  state = accessState.approveAdminPermissionRequest(state, { requestId: "ar-reviewer-admin", reviewerId: "admin" });
  if (!state.memberships.some((membership) => membership.user_id === "u-reviewer" && membership.group_id === "g-support" && membership.role === "group_admin")) fail("system admin should approve admin permission request");
  state = accessState.removeMembershipAndDeleteEmptyGroups(state, { userId: "u-new", groupId: "g-u-new" });
  if (!state.groups.some((group) => group.id === "g-u-new" && group.status === "deleted")) fail("empty group was not deleted after removing last user");
  if (process.exitCode !== 1) pass("access transition rules work");
}

async function checkAidotPackageContract() {
  const contract = await import("../packages/contracts/src/aidot-package-contract.js");
  const scopes = new Set(contract.AIDOT_COMPATIBLE_PACKAGE_ASSETS.map((item) => item.scope));
  for (const scope of [
    "bot",
    "version",
    "dialog",
    "api",
    "intent_utterance",
    "entity",
    "dictionary",
    "blocklist",
    "rule"
  ]) {
    if (!scopes.has(scope)) fail(`Aidot package contract missing scope '${scope}'`);
  }
  for (const scope of ["bot", "version", "dialog", "api"]) {
    const asset = contract.getAidotCompatibleAsset(scope);
    if (asset?.fileFormat !== "json") fail(`Aidot package scope '${scope}' must use json`);
    if (asset?.uploadMode !== "replace") fail(`Aidot package scope '${scope}' must replace on upload`);
  }
  for (const scope of ["intent_utterance", "entity", "dictionary", "blocklist", "rule"]) {
    const asset = contract.getAidotCompatibleAsset(scope);
    if (asset?.fileFormat !== "txt") fail(`Aidot package scope '${scope}' must use txt`);
    if (asset?.uploadMode !== "merge") fail(`Aidot package scope '${scope}' must merge on upload`);
  }
  const botAsset = contract.getAidotCompatibleAsset("bot");
  if (!botAsset?.requiredTopLevelKeys?.includes("AIDOTAssistantVersion")) fail("Aidot bot package must keep AIDOTAssistantVersion");
  if (!botAsset?.requiredTopLevelKeys?.includes("dialogList")) fail("Aidot bot package must keep dialogList");
  const dialogAsset = contract.getAidotCompatibleAsset("dialog");
  if (!dialogAsset?.requiredTopLevelKeys?.includes("flowGraph")) fail("Aidot dialog package must keep flowGraph");
  if (contract.AIDOT_DIALOG_TYPE.MODULE !== 0 || contract.AIDOT_DIALOG_TYPE.INTENT !== 1) fail("Aidot dialogType contract must keep module=0 and intent=1");
  const dictionaryAsset = contract.getAidotCompatibleAsset("dictionary");
  if (!dictionaryAsset?.legacyHeaders?.includes("동의어")) fail("Aidot dictionary contract must accept legacy 단어/동의어 header");
  if (process.exitCode !== 1) pass("Aidot-compatible package contract is complete");
}

async function checkAssetTransferApiContract() {
  const packageContract = await import("../packages/contracts/src/aidot-package-contract.js");
  const transferContract = await import("../packages/contracts/src/asset-transfer-api-contract.js");
  for (const route of Object.values(transferContract.ASSET_TRANSFER_API_ROUTES)) {
    if (!route.startsWith("/api/cga/")) fail(`asset transfer route must stay in /api/cga namespace: ${route}`);
  }
  for (const asset of packageContract.AIDOT_COMPATIBLE_PACKAGE_ASSETS) {
    const requirement = transferContract.getAssetTransferScopeRequirement(asset.scope);
    if (!requirement) fail(`asset transfer requirement missing scope '${asset.scope}'`);
    if (!requirement?.exportScopes?.length) fail(`asset transfer export scope missing for '${asset.scope}'`);
    if (!requirement?.importScopes?.length) fail(`asset transfer import scope missing for '${asset.scope}'`);
    const exportRequest = transferContract.createAssetExportRequest({
      groupId: "g-support",
      botId: "supportbot-draft",
      scope: asset.scope,
      botLocale: "ko"
    });
    if (exportRequest.expected_file_format !== asset.fileFormat) fail(`asset transfer export format mismatch for '${asset.scope}'`);
    if (exportRequest.upload_mode !== asset.uploadMode) fail(`asset transfer upload mode mismatch for '${asset.scope}'`);
    const response = transferContract.createAssetTransferResponse({ request: exportRequest });
    if (response.manifest.scope !== asset.scope) fail(`asset transfer response manifest scope mismatch for '${asset.scope}'`);
    if (response.manifest.bot_id !== "supportbot-draft") fail(`asset transfer response manifest bot id mismatch for '${asset.scope}'`);
  }
  if (process.exitCode !== 1) pass("Aidot asset transfer API contract is complete");
}

Promise.all([checkAccessTransitions(), checkAidotPackageContract(), checkAssetTransferApiContract()]).then(() => {
  if (process.exitCode === 1) process.exit(1);
});
