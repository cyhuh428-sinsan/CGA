import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = String(43000 + Math.floor(Math.random() * 2000));
const baseUrl = `http://localhost:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), "cga-aidot-latest-webchat-"));
const server = spawn("node", ["scripts/serve-studio.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: port, CGA_DATA_DIR: dataDir },
  stdio: "pipe"
});

function fail(message) {
  console.error(`FAIL ${message}`);
  server.kill();
  process.exit(1);
}

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  fail("Aidot latest webchat flow test server did not start");
}

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: body == null ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function requireData(payload, message) {
  if (!payload || typeof payload !== "object" || !("data" in payload)) fail(message);
  return payload.data;
}

function makeApiError(response, payload, fallbackMessage) {
  const error = new Error(payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string"
    ? payload.detail
    : fallbackMessage);
  error.status = response.status;
  return error;
}

function isFallbackNeeded(error) {
  const status = error?.status;
  if (typeof status === "number") return status === 404 || status === 405;
  const message = error instanceof Error ? error.message : "";
  return /지원하지 않는|not found|Not Found|does not exist/i.test(message);
}

function isAmCompatibilityFallbackNeeded(error) {
  if (isFallbackNeeded(error)) return true;
  const status = error?.status;
  return typeof status === "number" && status >= 500 && status < 600;
}

async function callAidotHttpApi(path, { method = "GET", body } = {}, legacy = false) {
  const prefix = legacy ? "/api" : "/api/v1";
  const { response, payload } = await request(`${prefix}${path}`, { method, body });
  if (!response.ok) throw makeApiError(response, payload, `HTTP ${response.status}`);
  return requireData(payload, `Aidot API response missing data envelope for ${path}`);
}

async function callAidotBackend(path, options = {}) {
  try {
    return await callAidotHttpApi(path, options, false);
  } catch (error) {
    if (!isFallbackNeeded(error)) throw error;
    return await callAidotHttpApi(path, options, true);
  }
}

async function callAidotAmApi(botId, route, options = {}) {
  const path = `/am/${encodeURIComponent(botId)}${route.startsWith("/") ? route : `/${route}`}`;
  try {
    return await callAidotHttpApi(path, options, true);
  } catch (error) {
    if (!isFallbackNeeded(error)) throw error;
    return await callAidotHttpApi(path, options, false);
  }
}

async function createRoomViaLatestAidotFallback(botSlug, roomPayload) {
  try {
    return {
      payload: await callAidotAmApi(botSlug, "/session/start", { method: "POST", body: roomPayload }),
      route: "am:/session/start"
    };
  } catch (error) {
    if (!isAmCompatibilityFallbackNeeded(error)) throw error;
    try {
      return {
        payload: await callAidotAmApi(botSlug, "/rooms", { method: "POST", body: roomPayload }),
        route: "am:/rooms"
      };
    } catch (roomError) {
      if (!isAmCompatibilityFallbackNeeded(roomError)) throw roomError;
      return {
        payload: await callAidotBackend("/channels/webchat/rooms", {
          method: "POST",
          body: { ...roomPayload, bot_slug: botSlug }
        }),
        route: "channels:/rooms"
      };
    }
  }
}

async function sendMessageViaLatestAidotFallback(botSlug, roomId, body) {
  try {
    return {
      payload: await callAidotAmApi(botSlug, "/chat", { method: "POST", body }),
      route: "am:/chat"
    };
  } catch (error) {
    if (!isAmCompatibilityFallbackNeeded(error)) throw error;
    return {
      payload: await callAidotBackend(`/channels/webchat/rooms/${encodeURIComponent(roomId)}/messages`, {
        method: "POST",
        body: {
          message: body.message,
          participant_id: body.participant_id,
          source_talk_node_id: body.source_talk_node_id
        }
      }),
      route: "channels:/rooms/:id/messages"
    };
  }
}

async function endSessionViaLatestAidotFallback(botSlug, room, participantId) {
  try {
    return {
      payload: await callAidotAmApi(botSlug, "/session/end", {
        method: "POST",
        body: {
          room_id: room.sessionId || room.id,
          session_id: room.sessionId || room.id,
          participant_id: participantId
        }
      }),
      route: "am:/session/end"
    };
  } catch (error) {
    if (!isFallbackNeeded(error)) throw error;
    return {
      payload: await callAidotBackend(`/channels/webchat/rooms/${encodeURIComponent(room.id)}`, { method: "DELETE" }),
      route: "channels:DELETE /rooms/:id"
    };
  }
}

async function main() {
  await waitForServer();

  const clientId = "aidot-latest-flow-user";
  const roomPayload = {
    client_room_id: "aidot-latest-flow-room",
    participant_id: clientId,
    participant_name: "Aidot 최신 흐름 사용자"
  };

  const connectData = await callAidotBackend("/channels/webchat/connect", {
    method: "POST",
    body: { client_id: clientId }
  });
  if (connectData.connected !== true) fail("connect should report connected=true");
  if (!Array.isArray(connectData.bots) || !connectData.bots.some((bot) => bot.slug === "supportbot-draft")) {
    fail("connect should include supportbot-draft");
  }

  const roomListBefore = await callAidotBackend(`/channels/webchat/rooms?participant_id=${encodeURIComponent(clientId)}`);
  if (!Array.isArray(roomListBefore.rooms)) fail("room list before create should return rooms array");

  const roomCreate = await createRoomViaLatestAidotFallback("supportbot-draft", roomPayload);
  if (roomCreate.route !== "channels:/rooms") {
    fail(`expected CGA to reach channel room fallback for latest Aidot create flow, got ${roomCreate.route}`);
  }
  if (!roomCreate.payload.room?.id) fail("room create did not return room id");
  const roomId = roomCreate.payload.room.id;

  const roomDetail = await callAidotBackend(`/channels/webchat/rooms/${encodeURIComponent(roomId)}`);
  if (roomDetail.room?.id !== roomId) fail("room detail mismatch after latest Aidot create flow");
  if (roomDetail.room?.status !== "open") fail("room should be open after latest Aidot create flow");

  const messageResponse = await sendMessageViaLatestAidotFallback("supportbot-draft", roomId, {
    room_id: roomId,
    session_id: roomId,
    participant_id: clientId,
    message: "I need to reset my password"
  });
  if (messageResponse.route !== "channels:/rooms/:id/messages") {
    fail(`expected CGA to reach channel message fallback for latest Aidot chat flow, got ${messageResponse.route}`);
  }
  if (messageResponse.payload.intent?.name !== "password_reset") fail("latest Aidot chat fallback intent mismatch");
  if (messageResponse.payload.runtime?.sessionEnded !== false) fail("latest Aidot chat should not end session");

  const richResponse = await sendMessageViaLatestAidotFallback("supportbot-draft", roomId, {
    room_id: roomId,
    session_id: roomId,
    participant_id: clientId,
    message: "__CGA_RICH_OPTIONS__"
  });
  if (richResponse.payload.botMessage?.messageType !== "form") fail("latest Aidot rich fallback should return form message");
  if (richResponse.payload.botMessage?.payload_json?.sourceTalkNodeId !== "sample-rich-options-node") {
    fail("latest Aidot rich fallback should preserve sourceTalkNodeId");
  }

  const activeConversations = await request("/api/v1/admin/conversations?query=Aidot%20%EC%B5%9C%EC%8B%A0%20%ED%9D%90%EB%A6%84%20%EC%82%AC%EC%9A%A9%EC%9E%90");
  if (activeConversations.response.status !== 200) fail(`admin conversations(active) failed: ${activeConversations.response.status}`);
  if (!Array.isArray(activeConversations.payload?.items)) fail("admin conversations(active) should return items array");
  const activeConversation = activeConversations.payload.items.find((item) => item.id === roomId);
  if (!activeConversation) fail("admin conversations should include active latest-flow room before session end");
  if (activeConversation.data_json?.session_ended !== false) fail("active latest-flow conversation session_ended mismatch");
  if (activeConversation.data_json?.room_status !== "open") fail("active latest-flow conversation room_status mismatch");
  if (!Array.isArray(activeConversation.data_json?.conversation_history?.transcript) || activeConversation.data_json.conversation_history.transcript.length < 2) {
    fail("active latest-flow conversation transcript should be visible during conversation");
  }
  if (!Array.isArray(activeConversation.data_json?.messages) || activeConversation.data_json.messages.length < 2) {
    fail("active latest-flow conversation messages should be visible during conversation");
  }

  const endResponse = await endSessionViaLatestAidotFallback("supportbot-draft", { id: roomId, sessionId: roomId }, clientId);
  if (endResponse.route !== "channels:DELETE /rooms/:id") {
    fail(`expected CGA to reach DELETE fallback for latest Aidot session end flow, got ${endResponse.route}`);
  }
  if (endResponse.payload.deleted !== true) fail("DELETE fallback should report deleted=true");
  if (endResponse.payload.roomId !== roomId) fail("DELETE fallback should return the deleted room id");

  const closedRoom = await callAidotBackend(`/channels/webchat/rooms/${encodeURIComponent(roomId)}`);
  if (closedRoom.room?.status !== "closed") fail("room detail should stay closed after delete fallback");

  const reopened = await createRoomViaLatestAidotFallback("supportbot-draft", roomPayload);
  if (!reopened.payload.room?.id) fail("reopened room did not return room id");
  if (reopened.payload.room.id === roomId) fail("same client_room_id should create a new room after close");
  if (reopened.payload.room.status !== "open") fail("reopened room should be open");

  const conversations = await request("/api/v1/admin/conversations?query=Aidot%20%EC%B5%9C%EC%8B%A0%20%ED%9D%90%EB%A6%84%20%EC%82%AC%EC%9A%A9%EC%9E%90");
  if (conversations.response.status !== 200) fail(`admin conversations failed: ${conversations.response.status}`);
  if (!Array.isArray(conversations.payload?.items)) fail("admin conversations should return items array");
  const closedConversation = conversations.payload.items.find((item) => item.id === roomId);
  if (!closedConversation) fail("admin conversations should include closed latest-flow room");
  if (closedConversation.data_json?.session_ended !== true) fail("latest-flow conversation session_ended mismatch");
  if (closedConversation.data_json?.room_status !== "closed") fail("latest-flow conversation room_status mismatch");

  console.log("OK latest Aidot webchat fallback flow passed");
}

main()
  .catch((error) => fail(error instanceof Error ? error.message : "latest Aidot webchat flow check failed"))
  .finally(() => {
    server.kill();
    rmSync(dataDir, { recursive: true, force: true });
  });
