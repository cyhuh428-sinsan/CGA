const botNameEl = document.querySelector("[data-bot-name]");
const botMetaEl = document.querySelector("[data-bot-meta]");
const connectionStatusEl = document.querySelector("[data-connection-status]");
const messageListEl = document.querySelector("[data-message-list]");
const messageFormEl = document.querySelector("[data-message-form]");
const messageInputEl = document.querySelector("[data-message-input]");
const runtimeNoteEl = document.querySelector("[data-runtime-note]");

const state = {
  botSlug: "",
  bot: null,
  roomId: "",
  participantId: `webchat-${Math.random().toString(16).slice(2, 10)}`
};

function setConnectionStatus(text) {
  if (connectionStatusEl) connectionStatusEl.textContent = text;
}

function setRuntimeNote(text) {
  if (runtimeNoteEl) runtimeNoteEl.textContent = text;
}

function appendMessage(participantKind, participantName, text) {
  if (!messageListEl) return;
  const item = document.createElement("article");
  item.className = `webchat-message webchat-message--${participantKind === "user" ? "user" : "bot"}`;
  const meta = document.createElement("span");
  meta.className = "webchat-message__meta";
  meta.textContent = participantKind === "user" ? "사용자" : (participantName || "봇");
  const body = document.createElement("div");
  body.textContent = text || "";
  item.append(meta, body);
  messageListEl.appendChild(item);
  messageListEl.scrollTop = messageListEl.scrollHeight;
}

function hydrateMessages(messages = []) {
  if (!messageListEl) return;
  messageListEl.innerHTML = "";
  messages.forEach((message) => {
    appendMessage(message.participantKind, message.participantName, message.text);
  });
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `HTTP ${response.status}`);
  }
  return data?.data ?? data;
}

function getBotSlugFromPath() {
  const match = window.location.pathname.match(/^\/webchat\/([^/]+)\/?$/);
  return decodeURIComponent(match?.[1] || "");
}

async function loadBootstrap() {
  const data = await requestJson("/api/v1/webchat/bootstrap");
  return Array.isArray(data.bots) ? data.bots : [];
}

async function openRoom() {
  const data = await requestJson("/api/v1/channels/webchat/rooms", {
    method: "POST",
    body: JSON.stringify({
      bot_slug: state.botSlug,
      client_room_id: `${state.botSlug}-${Date.now()}`,
      participant_id: state.participantId,
      participant_name: "사용자"
    })
  });
  const room = data.room || {};
  state.roomId = room.id || "";
  hydrateMessages(data.messages || room.messages || []);
}

async function sendMessage(text) {
  const data = await requestJson(`/api/v1/channels/webchat/rooms/${encodeURIComponent(state.roomId)}/messages`, {
    method: "POST",
    body: JSON.stringify({
      message: text,
      participant_id: state.participantId
    })
  });
  appendMessage("user", "사용자", text);
  const botMessages = Array.isArray(data.botMessages) ? data.botMessages : (data.botMessage ? [data.botMessage] : []);
  botMessages.forEach((message) => appendMessage("bot", message.participantName, message.text));
  const intentName = data.intent?.name || data.intent?.id || "-";
  setRuntimeNote(`매칭 의도: ${intentName}`);
}

async function initialize() {
  try {
    state.botSlug = getBotSlugFromPath();
    if (!state.botSlug) throw new Error("봇 slug가 없습니다.");
    setConnectionStatus("연결 중");
    setRuntimeNote("WebChat 부트스트랩을 확인하는 중입니다.");
    const bots = await loadBootstrap();
    state.bot = bots.find((bot) => bot.slug === state.botSlug || bot.id === state.botSlug) || null;
    if (!state.bot) throw new Error("대상 봇을 찾지 못했습니다.");
    if (botNameEl) botNameEl.textContent = state.bot.name || state.bot.slug || "CGA WebChat";
    if (botMetaEl) botMetaEl.textContent = `${state.bot.groupName || "-"} / ${state.bot.activeVersionName || "-"}`;
    await openRoom();
    setConnectionStatus("연결됨");
    setRuntimeNote("Aidot 호환 WebChat 채널에 연결되었습니다.");
  } catch (error) {
    setConnectionStatus("연결 실패");
    setRuntimeNote(error instanceof Error ? error.message : "WebChat 연결 중 오류가 발생했습니다.");
  }
}

messageFormEl?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = messageInputEl?.value?.trim() || "";
  if (!text || !state.roomId) return;
  messageInputEl.value = "";
  messageInputEl.focus();
  try {
    await sendMessage(text);
  } catch (error) {
    setRuntimeNote(error instanceof Error ? error.message : "메시지 전송 중 오류가 발생했습니다.");
  }
});

initialize();
