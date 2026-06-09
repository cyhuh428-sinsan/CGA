const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "apps", "studio", "app.js"), "utf8");
const supportedLocales = ["en", "ko", "de", "fr", "ja", "vi", "zh-CN"];
const requiredDynamicKeys = [
  "common.allowed",
  "common.blocked",
  "common.disabled",
  "common.enabled",
  "common.none",
  "common.noRole",
  "common.intentUnit",
  "common.pendingUnit",
  "common.serverSaved",
  "common.localOnly",
  "common.yes",
  "common.no",
  "common.open",
  "common.noScope",
  "workspace.noGroup",
  "workspace.noGroupSelected",
  "workspace.noBotSelected",
  "workspace.noBotInGroup",
  "workspace.createBotToStart",
  "workspace.botCount",
  "workspace.blockedCreate",
  "workspace.createAllowed",
  "workspace.createBlocked",
  "top.groupPrefix",
  "top.botPrefix",
  "top.versionPrefix",
  "summary.llmUsed",
  "summary.llmNotUsed",
  "summary.allowed",
  "summary.disabled",
  "transfer.jsonReplace",
  "transfer.txtMergeShort",
  "admin.groupJoin",
  "admin.groupAdminApproval",
  "admin.requiresGroupAdmin",
  "admin.adminPermission",
  "admin.systemAdminApproval",
  "admin.requiresSystemAdmin",
  "admin.noPendingApproval",
  "admin.queueEmpty",
  "admin.noActiveUser",
  "admin.systemAdminRequired",
  "admin.approve",
  "apiAnswer.noApiAnswer",
  "apiAnswer.registerForBot",
  "team.available",
  "team.noAssignedTask",
  "team.noReviewWaiting",
  "team.noBlockedItem",
  "team.currentUser",
  "team.unassigned",
  "team.lockedBy",
  "team.lock",
  "team.unlock",
  "team.requestChanges",
  "team.moveToTodo",
  "state.bot",
  "state.locale",
  "state.intents",
  "state.documents",
  "state.readiness",
  "state.notNamed",
  "state.ready",
  "state.pdfAvailable",
  "state.pdfBlockedLlm",
  "state.kakaoAvailableKo",
  "state.kakaoDisabledNonKo",
  "state.noBlockingIssue",
  "review.utteranceUnit",
  "review.noIntentCandidate",
  "review.manualResultRequired",
  "module.screen",
  "module.publicCore",
  "module.commercialCandidate"
];

const failures = [];

for (const locale of supportedLocales) {
  const localePattern = locale.includes("-")
    ? new RegExp(`"${locale}"\\s*:\\s*{([\\s\\S]*?)\\n\\s*}`)
    : new RegExp(`\\b${locale}\\s*:\\s*{([\\s\\S]*?)\\n\\s*}`);
  const match = appSource.match(localePattern);
  if (!match) {
    failures.push(`dynamicMessages missing locale '${locale}'`);
    continue;
  }
  for (const key of requiredDynamicKeys) {
    if (!match[1].includes(`"${key}"`)) failures.push(`dynamicMessages.${locale} missing '${key}'`);
  }
}

if (!appSource.includes('document.querySelector("[data-locale-select]")?.value')) {
  failures.push("getCurrentLocale must prioritize the visible language selector");
}
if (!appSource.includes('document.addEventListener("cga:content-rendered", syncStudioLocaleToCurrentUser)')) {
  failures.push("Studio must reapply locale after dynamic content render");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("OK Studio dynamic i18n covers all supported locales");
