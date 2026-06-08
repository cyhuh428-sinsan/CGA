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
  "workspace.noGroup",
  "workspace.noGroupSelected",
  "workspace.noBotSelected",
  "workspace.noBotInGroup",
  "workspace.createBotToStart",
  "workspace.botCount",
  "workspace.blockedCreate",
  "top.groupPrefix",
  "top.botPrefix",
  "top.versionPrefix",
  "summary.llmUsed",
  "summary.llmNotUsed",
  "summary.allowed",
  "summary.disabled",
  "transfer.jsonReplace",
  "transfer.txtMergeShort"
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
