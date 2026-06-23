import { normalizeBackendMessage } from "./message-shape.js";

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
  participantId: `webchat-${Math.random().toString(16).slice(2, 10)}`,
  sending: false
};

function setConnectionStatus(text) {
  if (connectionStatusEl) connectionStatusEl.textContent = text;
}

function setRuntimeNote(text) {
  if (runtimeNoteEl) runtimeNoteEl.textContent = text;
}

function appendMessage(participantKind, participantName, text, options = {}) {
  if (!messageListEl) return;
  const item = document.createElement("article");
  item.className = `webchat-message webchat-message--${participantKind === "user" ? "user" : "bot"}`;
  const meta = document.createElement("span");
  meta.className = "webchat-message__meta";
  meta.textContent = participantKind === "user" ? "사용자" : (participantName || "봇");
  const body = document.createElement("div");
  body.className = "webchat-message__body";
  body.textContent = text || "";
  item.append(meta, body);
  if (options.payloadSummary) {
    const payloadNote = document.createElement("div");
    payloadNote.className = "webchat-message__payload";
    payloadNote.textContent = options.payloadSummary;
    item.appendChild(payloadNote);
  }
  if (Array.isArray(options.actions) && options.actions.length) {
    const actions = document.createElement("div");
    actions.className = "webchat-message__actions";
    options.actions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "webchat-message__action";
      button.textContent = action.label;
      button.disabled = Boolean(options.disabled);
      button.addEventListener("click", async () => {
        if (!action.label || !state.roomId || state.sending) return;
        try {
          await sendMessage(action.label, action.sourceTalkNodeId || "");
        } catch (error) {
          setRuntimeNote(error instanceof Error ? error.message : "메시지 전송 중 오류가 발생했습니다.");
        }
      });
      actions.appendChild(button);
    });
    item.appendChild(actions);
  }
  messageListEl.appendChild(item);
  messageListEl.scrollTop = messageListEl.scrollHeight;
}

function resolveInitialMessages(payload = {}) {
  if (Array.isArray(payload.messages) && payload.messages.length) return payload.messages;
  if (Array.isArray(payload.botMessages) && payload.botMessages.length) return payload.botMessages;
  if (Array.isArray(payload.initialMessages) && payload.initialMessages.length) return payload.initialMessages;
  if (payload.botMessage) return [payload.botMessage];
  return [];
}

function hydrateMessages(messages = []) {
  if (!messageListEl) return;
  messageListEl.innerHTML = "";
  messages.forEach((message) => {
    const normalized = normalizeBackendMessage(message);
    appendMessage(normalized.participantKind, normalized.participantName, normalized.text, {
      payloadSummary: normalized.payloadSummary,
      actions: normalized.options.map((label) => ({ label, sourceTalkNodeId: normalized.sourceTalkNodeId })),
      disabled: !state.roomId || state.sending
    });
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

async function listChannelBots() {
  const data = await requestJson("/api/v1/channels/webchat/bots");
  return Array.isArray(data.bots) ? data.bots : [];
}

async function connectChannel() {
  return await requestJson("/api/v1/channels/webchat/connect", {
    method: "POST",
    body: JSON.stringify({
      client_id: state.participantId
    })
  });
}

async function listRooms() {
  const data = await requestJson(`/api/v1/channels/webchat/rooms?participant_id=${encodeURIComponent(state.participantId)}`);
  return Array.isArray(data.rooms) ? data.rooms : [];
}

async function loadRoomDetail(roomId) {
  return await requestJson(`/api/v1/channels/webchat/rooms/${encodeURIComponent(roomId)}`);
}

async function resolveConnectedBots() {
  try {
    const connectData = await connectChannel();
    if (Array.isArray(connectData.bots) && connectData.bots.length) {
      return connectData.bots;
    }
  } catch (error) {
    if (!(error instanceof Error)) throw error;
  }
  try {
    return await listChannelBots();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
  }
  return await loadBootstrap();
}

async function openOrCreateRoom() {
  const rooms = await listRooms();
  const existingRoom = rooms.find((room) => {
    const bot = room.bot || {};
    return String(bot.slug || bot.id || "") === state.botSlug && String(room.status || "open") === "open";
  });
  if (existingRoom?.id) {
    try {
      const detail = await loadRoomDetail(existingRoom.id);
      const room = detail.room || existingRoom;
      if (String(room.status || "").toLowerCase() === "closed") {
        state.roomId = "";
      } else {
        state.roomId = room.id || "";
        hydrateMessages(resolveInitialMessages({ ...detail, messages: detail.messages || room.messages || [] }));
        return;
      }
    } catch {
      state.roomId = "";
    }
  }
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
  hydrateMessages(resolveInitialMessages({ ...data, messages: data.messages || room.messages || [] }));
}

async function sendMessage(text, sourceTalkNodeId = "") {
  state.sending = true;
  try {
    const data = await requestJson(`/api/v1/channels/webchat/rooms/${encodeURIComponent(state.roomId)}/messages`, {
      method: "POST",
      body: JSON.stringify({
        message: text,
        participant_id: state.participantId,
        source_talk_node_id: sourceTalkNodeId || undefined
      })
    });
    appendMessage("user", "사용자", text);
    resolveInitialMessages(data)
      .map((message) => normalizeBackendMessage(message))
      .forEach((message) => appendMessage(message.participantKind, message.participantName, message.text, {
        payloadSummary: message.payloadSummary,
        actions: message.options.map((label) => ({ label, sourceTalkNodeId: message.sourceTalkNodeId })),
        disabled: false
      }));
    const intentName = data.intent?.name || data.intent?.id || "-";
    const sessionEnded = data.runtime?.sessionEnded === true;
    const completionReason = String(data.runtime?.completionReason || "").trim();
    if (sessionEnded) {
      state.roomId = "";
      setConnectionStatus("세션 종료");
      setRuntimeNote(`매칭 의도: ${intentName}${completionReason ? ` / 종료 사유: ${completionReason}` : ""}`);
      appendMessage("system", "시스템", "세션이 종료되었습니다. 새 채팅방을 다시 생성해주세요.");
      return;
    }
    setRuntimeNote(`매칭 의도: ${intentName}`);
  } finally {
    state.sending = false;
  }
}

async function initialize() {
  try {
    state.botSlug = getBotSlugFromPath();
    if (!state.botSlug) throw new Error("봇 slug가 없습니다.");
    setConnectionStatus("연결 중");
    setRuntimeNote("WebChat 부트스트랩을 확인하는 중입니다.");
    const bots = await resolveConnectedBots();
    state.bot = bots.find((bot) => bot.slug === state.botSlug || bot.id === state.botSlug) || null;
    if (!state.bot) throw new Error("대상 봇을 찾지 못했습니다.");
    if (botNameEl) botNameEl.textContent = state.bot.name || state.bot.slug || "CGA WebChat";
    if (botMetaEl) botMetaEl.textContent = `${state.bot.groupName || "-"} / ${state.bot.activeVersionName || "-"}`;
    await openOrCreateRoom();
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
  if (!text) return;
  if (!state.roomId) {
    try {
      setConnectionStatus("재연결 중");
      setRuntimeNote("새 WebChat 세션을 준비하는 중입니다.");
      await openOrCreateRoom();
      if (!state.roomId) return;
      setConnectionStatus("연결됨");
    } catch (error) {
      setConnectionStatus("연결 실패");
      setRuntimeNote(error instanceof Error ? error.message : "새 세션 생성 중 오류가 발생했습니다.");
      return;
    }
  }
  messageInputEl.value = "";
  messageInputEl.focus();
  try {
    await sendMessage(text);
  } catch (error) {
    setRuntimeNote(error instanceof Error ? error.message : "메시지 전송 중 오류가 발생했습니다.");
  }
});

initialize();
