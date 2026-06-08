const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const localeDir = path.join(root, "packages", "i18n", "locales");
const english = JSON.parse(fs.readFileSync(path.join(localeDir, "en.json"), "utf8"));
const criticalKeys = [
  "common.save", "common.preview", "common.deploy",
  "workflow.title", "workflow.create.title", "workflow.configure.title", "workflow.detail.title", "workflow.build.title", "workflow.test.title", "workflow.operate.title",
  "production.title", "production.workspace.title", "production.team.title", "production.api.title",
  "systemAdmin.title", "systemAdmin.access.title",
  "create.title", "create.locked", "field.botName", "field.defaultLanguage", "field.useLlm", "summary.structure", "summary.next",
  "workspace.title", "workspace.groupTitle", "workspace.botListTitle", "workspace.createBot", "workspace.nextTitle",
  "team.title", "team.myTasks", "team.reviewQueue", "team.blockedItems",
  "configure.title", "configure.notice", "configure.pathA", "configure.pathA.title", "configure.export", "configure.import", "configure.pathB", "configure.pathB.title", "configure.upload", "configure.generateQa",
  "review.preview", "review.answerRequired", "detail.title", "detail.intentAnswer", "detail.synonyms", "detail.entities", "detail.dictionary", "detail.scenario", "detail.apiTools",
  "build.title", "build.botInfo", "build.run", "test.title", "test.analysis", "test.simPlaceholder",
  "operate.title", "operate.channelStatus", "operate.volume", "operate.undefined", "operate.container", "operate.llmCost", "operate.compatibility",
  "access.title", "access.login", "access.roles", "access.scopes", "access.opsTitle", "access.authFlow", "access.groupUsers", "access.joinRequests", "access.adminRequests",
  "admin.loginTitle", "admin.loginButton", "admin.signupTitle", "admin.signupButton", "admin.groupTitle", "admin.groupCreate", "admin.joinRequest", "admin.approvalTitle",
  "apiAnswer.title", "apiAnswer.flowTitle", "apiAnswer.userQuestion", "apiAnswer.intent", "apiAnswer.externalSystem", "apiAnswer.finalAnswer", "apiAnswer.name", "apiAnswer.endpoint", "apiAnswer.auth", "apiAnswer.responsePath", "apiAnswer.safety", "apiAnswer.groupManaged", "apiAnswer.adminTitle", "apiAnswer.addApi",
  "collab.title", "collab.roles", "collab.assignments", "collab.review", "collab.locks", "collab.history", "collab.dashboard"
];
const criticalPrefixes = ["approval", "workingRule", "lock", "state", "commercial", "module", "contracts", "openCore"];
for (const key of Object.keys(english)) {
  if (criticalPrefixes.some((prefix) => key.startsWith(`${prefix}.`)) && !criticalKeys.includes(key)) criticalKeys.push(key);
}
const allowedSame = new Set(["summary.llm", "summary.pdfQa", "summary.botServer", "apiAnswer.endpoint", "apiAnswer.method", "apiAnswer.timeout", "apiAnswer.fallback"]);
const targets = ["de.json", "fr.json", "ja.json", "vi.json", "zh-CN.json"];
const failures = [];
for (const file of targets) {
  const data = JSON.parse(fs.readFileSync(path.join(localeDir, file), "utf8"));
  for (const key of criticalKeys) {
    if (!(key in data)) failures.push(`${file} missing critical key ${key}`);
    if (!allowedSame.has(key) && data[key] === english[key]) failures.push(`${file} critical key still equals English: ${key}`);
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("OK critical i18n keys are localized for primary non-English locales");
