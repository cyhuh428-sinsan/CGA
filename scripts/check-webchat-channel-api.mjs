import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = String(4593 + Math.floor(Math.random() * 100));
const baseUrl = `http://localhost:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), "cga-webchat-"));
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
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  fail("webchat API test server did not start");
}

async function requestJson(path, { method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: body == null ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  return { response, payload };
}

function requireData(payload, message) {
  if (!payload || typeof payload !== "object" || !("data" in payload)) fail(message);
  return payload.data;
}

async function main() {
  await waitForServer();

  const connect = await requestJson("/api/v1/channels/webchat/connect", {
    method: "POST",
    body: { client_id: "webchat-check" }
  });
  if (connect.response.status !== 200) fail(`connect failed: ${connect.response.status}`);
  const connectData = requireData(connect.payload, "connect response did not use Aidot data envelope");
  if (connectData.channelType !== "webchat" || connectData.connected !== true) fail("connect response shape mismatch");
  if (!connectData.bots?.some((bot) => bot.slug === "supportbot-draft")) fail("connect response did not include supportbot-draft");

  const room = await requestJson("/api/v1/channels/webchat/rooms", {
    method: "POST",
    body: {
      bot_slug: "supportbot-draft",
      client_room_id: "webchat-check-room",
      participant_id: "webchat-check",
      participant_name: "사용자"
    }
  });
  if (room.response.status !== 200) fail(`room create failed: ${room.response.status}`);
  const roomData = requireData(room.payload, "room response did not use Aidot data envelope");
  if (!roomData.room?.id || roomData.room?.bot?.slug !== "supportbot-draft") fail("room response shape mismatch");
  if (roomData.room?.contractVersion !== "v1.0") fail("room response contract version mismatch");
  if (!Array.isArray(roomData.room?.supportedContractVersions) || !roomData.room.supportedContractVersions.includes("v1.0")) {
    fail("room response supported contract versions mismatch");
  }
  const roomReused = await requestJson("/api/v1/channels/webchat/rooms", {
    method: "POST",
    body: {
      bot_slug: "supportbot-draft",
      client_room_id: "webchat-check-room",
      participant_id: "webchat-check",
      participant_name: "사용자"
    }
  });
  if (roomReused.response.status !== 200) fail(`room reuse failed: ${roomReused.response.status}`);
  const roomReusedData = requireData(roomReused.payload, "room reuse response did not use Aidot data envelope");
  if (roomReusedData.room?.id !== roomData.room.id) fail("room create with same client_room_id should reuse existing open room");
  const roomList = await requestJson("/api/v1/channels/webchat/rooms?participant_id=webchat-check");
  if (roomList.response.status !== 200) fail(`room list failed: ${roomList.response.status}`);
  const roomListData = requireData(roomList.payload, "room list response did not use Aidot data envelope");
  if (!Array.isArray(roomListData.rooms) || !roomListData.rooms.some((item) => item.id === roomData.room.id)) {
    fail("room list response did not include created room");
  }
  const roomDetail = await requestJson(`/api/v1/channels/webchat/rooms/${roomData.room.id}`);
  if (roomDetail.response.status !== 200) fail(`room detail failed: ${roomDetail.response.status}`);
  const roomDetailData = requireData(roomDetail.payload, "room detail response did not use Aidot data envelope");
  if (roomDetailData.room?.id !== roomData.room.id) fail("room detail response room id mismatch");
  if (!Array.isArray(roomDetailData.messages) || roomDetailData.messages.length < 1) fail("room detail response messages mismatch");

  const message = await requestJson(`/api/v1/channels/webchat/rooms/${roomData.room.id}/messages`, {
    method: "POST",
    body: {
      message: "I need to reset my password",
      participant_id: "webchat-check"
    }
  });
  if (message.response.status !== 200) fail(`message send failed: ${message.response.status}`);
  const messageData = requireData(message.payload, "message response did not use Aidot data envelope");
  if (messageData.botMessage?.text !== "Open Account Settings and choose Reset Password.") fail("message response did not return expected Aidot-compatible bot answer");
  if (messageData.intent?.name !== "password_reset") fail("message response did not return matched intent");
  if (messageData.runtime?.resolvedContractVersion !== "v1.0") fail("message response resolved contract version mismatch");

  const richMessage = await requestJson(`/api/v1/channels/webchat/rooms/${roomData.room.id}/messages`, {
    method: "POST",
    body: {
      message: "__CGA_RICH_OPTIONS__",
      participant_id: "webchat-check"
    }
  });
  if (richMessage.response.status !== 200) fail(`rich message send failed: ${richMessage.response.status}`);
  const richMessageData = requireData(richMessage.payload, "rich message response did not use Aidot data envelope");
  if (richMessageData.botMessage?.messageType !== "form") fail("rich message response did not return form message type");
  if (!Array.isArray(richMessageData.botMessage?.options) || richMessageData.botMessage.options.length !== 3) {
    fail("rich message response did not expose options");
  }
  if (richMessageData.botMessage?.payload_json?.sourceTalkNodeId !== "sample-rich-options-node") {
    fail("rich message response did not expose sourceTalkNodeId");
  }
  if (richMessageData.intent?.name !== "sample_rich_options") {
    fail("rich message response intent should describe sample rich options");
  }

  const legacy = await requestJson("/api/v1/webchat/bots/supportbot-draft/rooms/webchat-legacy-room/messages", {
    method: "POST",
    body: {
      message: "I need to reset my password",
      participant_id: "webchat-check"
    }
  });
  if (legacy.response.status !== 200) fail(`legacy webchat message failed: ${legacy.response.status}`);
  const legacyData = requireData(legacy.payload, "legacy response did not use Aidot data envelope");
  if (legacyData.intent?.name !== "password_reset") {
    fail("legacy webchat response did not return matched intent");
  }
  if (legacyData.runtime?.resolvedContractVersion !== "v1.0") fail("legacy webchat resolved contract version mismatch");

  const richSelection = await requestJson(`/api/v1/channels/webchat/rooms/${roomData.room.id}/messages`, {
    method: "POST",
    body: {
      message: "{\"webchatRichFormVersion\":\"1.0\",\"response\":{\"input\":{\"value\":\"BUTTON\",\"title\":\"BUTTON\",\"validated\":true,\"key\":\"input\"},\"buttonValue\":\"BUTTON\"}}",
      participant_id: "webchat-check"
    }
  });
  if (richSelection.response.status !== 200) fail(`rich selection message failed: ${richSelection.response.status}`);

  const conversations = await requestJson("/api/v1/admin/conversations?query=BUTTON");
  if (conversations.response.status !== 200) fail(`admin conversations failed: ${conversations.response.status}`);
  const conversationPayload = conversations.payload;
  if (!Array.isArray(conversationPayload.items)) fail("admin conversations response did not return items");
  const webchatConversation = conversationPayload.items.find((item) => item.id === roomData.room.id);
  if (!webchatConversation) fail("admin conversations did not include created webchat room");
  if (webchatConversation.data_json?.session_first_user_utterance !== "I need to reset my password") {
    fail("admin conversations first user utterance should keep first plain text message");
  }
  const utterances = webchatConversation.data_json?.session_user_utterances;
  if (!Array.isArray(utterances) || !utterances.includes("버튼 선택: BUTTON")) {
    fail("admin conversations did not store readable rich selection utterance");
  }
  const transcript = webchatConversation.data_json?.conversation_history?.transcript;
  if (!Array.isArray(transcript) || !transcript.some((item) => item.display_text === "버튼 선택: BUTTON")) {
    fail("conversation history transcript did not store readable display_text for rich selection");
  }

  console.log("OK Aidot-compatible webchat channel endpoints passed");
}

main()
  .catch((error) => fail(error instanceof Error ? error.message : "webchat channel API check failed"))
  .finally(() => {
    server.kill();
    rmSync(dataDir, { recursive: true, force: true });
  });
