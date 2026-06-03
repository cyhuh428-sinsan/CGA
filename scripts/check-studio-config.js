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

const contractFiles = [
  "packages/contracts/src/error-contract.js",
  "packages/contracts/src/module-contract.js",
  "packages/contracts/src/workflow-contract.js",
  "packages/contracts/src/access-contract.js",
  "packages/contracts/src/auth-api-contract.js",
  "packages/contracts/src/api-answer-contract.js",
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
  state = accessState.approveGroupJoinRequest(state, { requestId: "jr-new-support", reviewerId: "admin" });
  if (!state.memberships.some((membership) => membership.user_id === "u-new" && membership.group_id === "g-support" && membership.role === "builder")) fail("join approval transition did not create membership");
  state = accessState.removeMembershipAndDeleteEmptyGroups(state, { userId: "u-new", groupId: "g-u-new" });
  if (!state.groups.some((group) => group.id === "g-u-new" && group.status === "deleted")) fail("empty group was not deleted after removing last user");
  if (process.exitCode !== 1) pass("access transition rules work");
}

checkAccessTransitions().then(() => {
  if (process.exitCode === 1) process.exit(1);
});
