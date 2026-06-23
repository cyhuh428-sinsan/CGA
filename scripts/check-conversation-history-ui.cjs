const fs = require("fs");
const path = require("path");
const vm = require("vm");

const appPath = path.resolve(__dirname, "..", "apps", "studio", "app.js");
const source = fs.readFileSync(appPath, "utf8");

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`OK ${message}`);
}

function extractFunctionSource(name) {
  const signature = `function ${name}(`;
  const start = source.indexOf(signature);
  if (start === -1) fail(`could not find function '${name}' in studio app`);
  const bodyStart = source.indexOf("{", start);
  if (bodyStart === -1) fail(`could not find body for function '${name}'`);
  let depth = 0;
  let end = bodyStart;
  for (; end < source.length; end += 1) {
    const char = source[end];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }
  return source.slice(start, end);
}

function expectContains(fragment, message) {
  if (!source.includes(fragment)) fail(message);
}

expectContains('requestCgaJson("/api/v1/admin/conversations")', "conversation history UI is not wired to /api/v1/admin/conversations");
expectContains('data-history-channel-filter', "conversation history UI is missing channel filter control");
expectContains('data-history-start-date', "conversation history UI is missing start date filter control");
expectContains('data-history-end-date', "conversation history UI is missing end date filter control");
expectContains('data-history-filter-reset', "conversation history UI is missing filter reset control");
expectContains('currentConversationHistoryFilters.startDate = input.value || "";', "conversation history start date state update is missing");
expectContains('currentConversationHistoryFilters.endDate = input.value || "";', "conversation history end date state update is missing");
expectContains('renderConversationHistorySurface(surface);', "conversation history UI must rerender after filter changes");
expectContains('["발화일시", "사용자 발화", "의도/모듈명", "실행 결과", "채널"]', "conversation history UI columns mismatch");

const sandbox = {
  currentAdminResources: {
    channels: [
      { provider: "webchat", channel_name: "웹채널" },
      { provider: "kakao", channel_name: "Kakao" },
      { channel_name: "ARS" },
      { channel_name: "Simulator" }
    ]
  },
  currentConversationHistoryFilters: {
    channel: "all",
    startDate: "2026-06-21",
    endDate: "2026-06-21"
  },
  currentConversationHistoryState: {
    items: [
      {
        uttered_at: "2026-06-21T09:00:00.000Z",
        intent_or_module_name: "password_reset",
        result: "matched",
        channel_name: "Webchat",
        data_json: {
          session_started_at: "2026-06-21T09:00:00.000Z",
          session_user_utterances: ["비밀번호 재설정"],
          session_first_user_utterance: "비밀번호 재설정"
        }
      },
      {
        uttered_at: "2026-06-21T10:00:00.000Z",
        intent_or_module_name: "loan_info",
        result: "matched",
        channel_name: "Simulator",
        data_json: {
          session_started_at: "2026-06-21T10:00:00.000Z",
          session_user_utterances: ["대출 문의"],
          session_first_user_utterance: "대출 문의"
        }
      },
      {
        uttered_at: "2026-06-20T10:00:00.000Z",
        intent_or_module_name: "older",
        result: "matched",
        channel_name: "Webchat",
        data_json: {
          session_started_at: "2026-06-20T10:00:00.000Z",
          session_user_utterances: ["이전 문의"],
          session_first_user_utterance: "이전 문의"
        }
      }
    ]
  },
  normalizeDateText(value) {
    if (!value) return "-";
    const text = String(value).trim();
    if (!text) return "-";
    return text;
  }
};

const script = [
  extractFunctionSource("getConversationHistoryChannelOptions"),
  extractFunctionSource("normalizeConversationHistoryChannelName"),
  extractFunctionSource("normalizeConversationHistoryDateOnly"),
  extractFunctionSource("getConversationHistoryRows"),
  "globalThis.__historyFns = { getConversationHistoryChannelOptions, normalizeConversationHistoryChannelName, normalizeConversationHistoryDateOnly, getConversationHistoryRows };"
].join("\n\n");

vm.createContext(sandbox);
vm.runInContext(script, sandbox);
const fns = sandbox.__historyFns;

const channelOptions = fns.getConversationHistoryChannelOptions();
if (!Array.isArray(channelOptions) || channelOptions[0] !== "all") fail("conversation history channel options must start with all");
if (!channelOptions.includes("Simulator")) fail("conversation history channel options must include Simulator");
if (!channelOptions.includes("webchat")) fail("conversation history channel options must include webchat");
if (!channelOptions.includes("Kakao")) fail("conversation history channel options must preserve configured channels");
if (channelOptions.filter((item) => item === "Simulator").length !== 1) fail("conversation history channel options must deduplicate Simulator");

if (fns.normalizeConversationHistoryChannelName("Webchat") !== "webchat") fail("conversation history channel name must normalize Webchat to webchat");
if (fns.normalizeConversationHistoryChannelName("simulator") !== "Simulator") fail("conversation history channel name must normalize simulator to Simulator");
if (fns.normalizeConversationHistoryDateOnly("2026-06-21T12:30:00.000Z") !== "2026-06-21") fail("conversation history date normalization mismatch");

let rows = fns.getConversationHistoryRows();
if (!Array.isArray(rows) || rows.length !== 2) fail("conversation history rows should apply the default date filter");
if (!rows.some((row) => row.channel === "webchat" && row.utterance === "비밀번호 재설정")) fail("conversation history rows must map webchat utterance");
if (!rows.some((row) => row.channel === "Simulator" && row.target === "loan_info")) fail("conversation history rows must map simulator target");

sandbox.currentConversationHistoryFilters.channel = "webchat";
rows = fns.getConversationHistoryRows();
if (rows.length !== 1 || rows[0].channel !== "webchat") fail("conversation history rows must filter by channel");

sandbox.currentConversationHistoryFilters.channel = "all";
sandbox.currentConversationHistoryFilters.startDate = "2026-06-20";
sandbox.currentConversationHistoryFilters.endDate = "2026-06-20";
rows = fns.getConversationHistoryRows();
if (rows.length !== 1 || rows[0].utterance !== "이전 문의") fail("conversation history rows must filter by date range");

pass("conversation history UI wiring and filter logic passed");
