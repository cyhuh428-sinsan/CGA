const fs = require("fs");
const path = require("path");

const htmlPath = path.resolve(__dirname, "..", "apps", "webchat", "index.html");
const appPath = path.resolve(__dirname, "..", "apps", "webchat", "app.js");
const html = fs.readFileSync(htmlPath, "utf8");
const source = fs.readFileSync(appPath, "utf8");

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

function expectHtmlContains(fragment, message) {
  if (!html.includes(fragment)) fail(message);
}

expectHtmlContains('data-bot-name', "webchat UI is missing bot name binding");
expectHtmlContains('data-bot-meta', "webchat UI is missing bot meta binding");
expectHtmlContains('data-connection-status', "webchat UI is missing connection status binding");
expectHtmlContains('data-message-list', "webchat UI is missing message list binding");
expectHtmlContains('data-message-form', "webchat UI is missing message form binding");
expectHtmlContains('data-message-input', "webchat UI is missing message input binding");
expectHtmlContains('data-runtime-note', "webchat UI is missing runtime note binding");

expectContains('window.location.pathname.match(/^\\/webchat\\/([^/]+)\\/?$/)', "webchat path parser must resolve bot slug from /webchat/:slug");
expectContains('requestJson("/api/v1/channels/webchat/connect"', "webchat UI must connect through /api/v1/channels/webchat/connect");
expectContains('requestJson("/api/v1/channels/webchat/bots")', "webchat UI must support /api/v1/channels/webchat/bots fallback");
expectContains('requestJson("/api/v1/webchat/bootstrap")', "webchat UI must keep legacy bootstrap fallback");
expectContains('requestJson(`/api/v1/channels/webchat/rooms?participant_id=${encodeURIComponent(state.participantId)}`)', "webchat UI must list rooms before creating one");
expectContains('requestJson(`/api/v1/channels/webchat/rooms/${encodeURIComponent(roomId)}`)', "webchat UI must load room detail for room reuse");
expectContains('requestJson("/api/v1/channels/webchat/rooms", {', "webchat UI must create rooms through channel API");
expectContains('if (Array.isArray(payload.messages) && payload.messages.length) return payload.messages;', "webchat message priority must prefer messages");
expectContains('if (Array.isArray(payload.botMessages) && payload.botMessages.length) return payload.botMessages;', "webchat message priority must prefer botMessages after messages");
expectContains('if (Array.isArray(payload.initialMessages) && payload.initialMessages.length) return payload.initialMessages;', "webchat message priority must prefer initialMessages after botMessages");
expectContains('if (payload.botMessage) return [payload.botMessage];', "webchat message priority must fallback to a single botMessage");
expectContains('source_talk_node_id: sourceTalkNodeId || undefined', "webchat UI must forward sourceTalkNodeId");
expectContains('const sessionEnded = data.runtime?.sessionEnded === true;', "webchat UI must handle sessionEnded responses");
expectContains('appendMessage("system", "시스템", "세션이 종료되었습니다. 새 채팅방을 다시 생성해주세요.");', "webchat UI must show a session ended system message");
expectContains('if (!state.roomId) {', "webchat UI submit flow must recreate a room when none is open");
expectContains('await openOrCreateRoom();', "webchat UI submit flow must open or create a new room before resending");
expectContains('setConnectionStatus("재연결 중");', "webchat UI must expose reconnecting state while reopening a session");
expectContains('setConnectionStatus("연결됨");', "webchat UI must restore connected state after reopening a session");

pass("webchat UI wiring and message flow contract passed");
