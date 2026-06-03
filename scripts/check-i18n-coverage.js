const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "apps", "studio", "index.html");
const appPath = path.join(root, "apps", "studio", "app.js");
const html = fs.readFileSync(htmlPath, "utf8");
const app = fs.readFileSync(appPath, "utf8");

const allowedText = new Set([
  "CGA", "CGA Studio", "SupportBot Draft", "v0.1", "Web", "Kakao KR", "PDF", "Q&A", "LLM", "API", "URL",
  "AF", "CO", "AC", "LK", "ST", "i18n", "CM", "MB", "CT", "OC",
  "en", "ko", "zh-CN", "ja", "vi", "de", "fr", "English", "한국어", "简体中文", "日本語", "Tiếng Việt", "Deutsch", "Français",
  "password_reset", "account_update", "billing_question", "0.94", "14ms", "1,284", "12 intents", "10", "2", "1", "200",
  "Customer support chatbot draft for web and messenger channels.",
  "Desktop Messenger", "PDF → Q&A intent candidates", "PDF → Q&amp;A intent candidates", "Generate Q&A Intents", "Generate Q&amp;A Intents", "4 utterances",
  "To reset your password, open Account Settings and choose Reset Password.",
  "How do I reset my password?\\nI forgot my login password.",
  "group_id: g-support", "bot_id: supportbot-draft", "scope: apiAnswer.manage",
  "GET", "POST", "Bearer", "API Key", "None", "5000ms", "LLM intent classification",
  "Similarity", "Latency", "Default: English · Supported: KO / ZH-CN / JA / VI / DE / FR",
  "CGA_LLM_REQUIRED_FOR_PDF", "6 visible steps → Aidot internal functions",
  "CGA Orchestrator Core", "CGA Studio Basic UI", "Basic bot build flow", "Webchat/API compatibility",
  "/api/cga/auth/* · /api/cga/groups/*",
  "PDF Q&A generation quality", "PDF Q&amp;A generation quality", "Intent merge recommendation", "Answer quality checks", "Handoff result validation",
  "LLM cost tracking", "Channel alerting", "Undefined intent analysis", "Operations report",
  "License key validation", "Bot / channel limits", "Feature activation", "Expiration checks"
]);

function stripTags(source) {
  return source
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<!--([\s\S]*?)-->/g, "");
}

function hasI18nNearTag(tagText) {
  return /data-i18n=|data-error-key=|data-locale-select|value=|href=|src=|class=|id=|aria-|role=|type=/.test(tagText);
}

const issues = [];
const tagRegex = /<([a-zA-Z0-9-]+)([^>]*)>([^<>{}][^<>]*?[A-Za-z][^<>]*?)<\/[a-zA-Z0-9-]+>/g;
const stripped = stripTags(html);
for (const match of stripped.matchAll(tagRegex)) {
  const tag = match[1].toLowerCase();
  const attrs = match[2] || "";
  const text = match[3].replace(/\s+/g, " ").trim();
  if (!text || allowedText.has(text)) continue;
  if (["option", "code", "strong", "span", "b"].includes(tag) && allowedText.has(text)) continue;
  if (!hasI18nNearTag(attrs)) {
    issues.push(`HTML text missing i18n: <${tag}> ${text}`);
  }
}

const literalRegex = /`([^`]*[A-Za-z][^`]*)`|"([^"\n]*[A-Za-z][^"\n]*)"|'([^'\n]*[A-Za-z][^'\n]*)'/g;
for (const match of app.matchAll(literalRegex)) {
  const text = (match[1] || match[2] || match[3] || "").trim();
  if (!text || allowedText.has(text)) continue;
  if (/^[.#\[\]a-zA-Z0-9_:\-/ ]+$/.test(text) && !text.includes(" ")) continue;
  if (text.includes("<") || text.includes("${") || text.includes("data-i18n") || text.includes("data-error-key")) continue;
  if (text.startsWith("workflow.") || text.startsWith("summary.") || text.startsWith("errors.")) continue;
  if (["Available", "Ready", "Blocked", "Allowed", "Disabled", "Not used", "Used for composition", "Commercial Module Required"].includes(text)) {
    issues.push(`APP literal should use i18n key: ${text}`);
  }
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exit(1);
}
console.log("OK i18n coverage guard passed");
