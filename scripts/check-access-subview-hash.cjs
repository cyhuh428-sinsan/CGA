const fs = require("fs");
const path = require("path");

const appPath = path.resolve(__dirname, "..", "apps", "studio", "app.js");
const indexPath = path.resolve(__dirname, "..", "apps", "studio", "index.html");
const source = fs.readFileSync(appPath, "utf8");
const indexSource = fs.readFileSync(indexPath, "utf8");

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`OK ${message}`);
}

function expectContains(fragment, message) {
  if (!source.includes(fragment)) fail(message);
}

function expectIndexContains(fragment, message) {
  if (!indexSource.includes(fragment)) fail(message);
}

expectContains("function parseHashRoute(", "studio app is missing parseHashRoute helper");
expectContains("function buildScreenHash(", "studio app is missing buildScreenHash helper");
expectContains("params.get(\"subview\")", "hash parser must read subview query parameter");
expectContains("params.set(\"subview\", adminSubview)", "hash builder must write subview query parameter");
expectContains("href=\"${buildScreenHash(link.id, { adminSubview: link.subview || \"\" })}\"", "system admin subnav links must use deep-link hashes");
expectContains("setActiveScreen(nextScreenId, { adminSubview: nextRoute.adminSubview || link.dataset.adminSubview || \"\" })", "system admin navigation must preserve subview when navigating");
expectContains("setActiveScreen(route.screenId, { replaceHash: true, adminSubview: route.adminSubview || \"\" })", "hashchange handler must restore admin subview");
expectContains("if (hashId === \"access-management\" && hashRoute.adminSubview) {", "resolveActiveScreenId must adopt admin subview from hash");
expectContains("function hasExplicitHashRoute()", "studio app must detect explicit hash routes");
expectContains("postAuthDefaultScreenPending = !hasExplicitHashRoute();", "login flow must keep explicit hash routes");
expectContains("activeScreenId = hasExplicitHashRoute() ? parseHashRoute(window.location.hash).screenId || activeScreenId : DEFAULT_ACTIVE_SCREEN_ID;", "login flow must restore screen from explicit hash route");
expectContains("if (!hasExplicitHashRoute()) {", "default landing should only replace hash when no explicit hash route exists");
expectContains("if (hasExplicitHashRoute()) {", "post-login landing queue must skip explicit hash routes");
expectIndexContains("const parseHashScreenId = () => {", "studio index fallback script must parse hash screen id");
expectIndexContains("return raw.split(\"?\")[0] || \"\";", "studio index fallback script must ignore subview query in hash");
expectIndexContains("const hashId = parseHashScreenId();", "studio index fallback script must use normalized hash id");

pass("access-management subview deep-link contract passed");
