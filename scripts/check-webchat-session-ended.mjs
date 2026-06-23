import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = String(4793 + Math.floor(Math.random() * 100));
const baseUrl = `http://localhost:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), "cga-webchat-ended-"));
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
  fail("webchat session ended test server did not start");
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

  const roomCreate = await requestJson("/api/v1/channels/webchat/rooms", {
    method: "POST",
    body: {
      bot_slug: "supportbot-draft",
      client_room_id: "webchat-session-ended-room",
      participant_id: "webchat-session-ended-user",
      participant_name: "종료 테스트 사용자"
    }
  });
  if (roomCreate.response.status !== 200) fail(`room create failed: ${roomCreate.response.status}`);
  const roomData = requireData(roomCreate.payload, "room create response did not use Aidot data envelope");
  if (!roomData.room?.id) fail("room create did not return room id");

  const endedResponse = await requestJson(`/api/v1/channels/webchat/rooms/${roomData.room.id}/messages`, {
    method: "POST",
    body: {
      message: "__CGA_SESSION_END__",
      participant_id: "webchat-session-ended-user"
    }
  });
  if (endedResponse.response.status !== 200) fail(`session ended message failed: ${endedResponse.response.status}`);
  const endedData = requireData(endedResponse.payload, "session ended response did not use Aidot data envelope");
  if (endedData.botMessage?.text !== "상담 세션을 종료합니다.") fail("session ended bot message text mismatch");
  if (endedData.intent?.name !== "session_end") fail("session ended intent mismatch");
  if (endedData.runtime?.sessionEnded !== true) fail("session ended runtime flag mismatch");
  if (endedData.runtime?.completionReason !== "session_ended") fail("session ended completion reason mismatch");
  if (!endedData.runtime?.endedAt) fail("session ended timestamp mismatch");

  const roomDetail = await requestJson(`/api/v1/channels/webchat/rooms/${roomData.room.id}`);
  if (roomDetail.response.status !== 200) fail(`room detail failed: ${roomDetail.response.status}`);
  const roomDetailData = requireData(roomDetail.payload, "room detail response did not use Aidot data envelope");
  if (roomDetailData.room?.status !== "closed") fail("room detail should report closed after session ended");

  const conversations = await requestJson("/api/v1/admin/conversations?query=%EC%A2%85%EB%A3%8C%20%ED%85%8C%EC%8A%A4%ED%8A%B8%20%EC%82%AC%EC%9A%A9%EC%9E%90");
  if (conversations.response.status !== 200) fail(`admin conversations failed: ${conversations.response.status}`);
  if (!Array.isArray(conversations.payload?.items)) fail("admin conversations did not return items array");
  const conversation = conversations.payload.items.find((item) => item.id === roomData.room.id);
  if (!conversation) fail("admin conversations did not include session ended room");
  if (conversation.data_json?.session_ended !== true) fail("conversation session_ended mismatch");
  if (conversation.data_json?.dialog_ended !== true) fail("conversation dialog_ended mismatch");
  if (conversation.data_json?.completion_reason !== "session_ended") fail("conversation completion_reason mismatch");
  if (conversation.data_json?.session_end_reason !== "user_requested_end") fail("conversation session_end_reason mismatch");
  if (conversation.data_json?.room_status !== "closed") fail("conversation room_status mismatch");
  if (conversation.data_json?.runtime_summary !== "session_ended") fail("conversation runtime_summary mismatch");
  if (!Array.isArray(conversation.data_json?.session_user_utterances) || !conversation.data_json.session_user_utterances.includes("__CGA_SESSION_END__")) {
    fail("conversation user utterances should preserve session end trigger");
  }

  const reopened = await requestJson("/api/v1/channels/webchat/rooms", {
    method: "POST",
    body: {
      bot_slug: "supportbot-draft",
      client_room_id: "webchat-session-ended-room",
      participant_id: "webchat-session-ended-user",
      participant_name: "종료 테스트 사용자"
    }
  });
  if (reopened.response.status !== 200) fail(`room reopen failed: ${reopened.response.status}`);
  const reopenedData = requireData(reopened.payload, "room reopen response did not use Aidot data envelope");
  if (!reopenedData.room?.id) fail("room reopen did not return room id");
  if (reopenedData.room.id === roomData.room.id) fail("room reopen should create a new room after session ended");
  if (reopenedData.room?.status !== "open") fail("reopened room should be open");

  console.log("OK webchat session ended flow passed");
}

main()
  .catch((error) => fail(error instanceof Error ? error.message : "webchat session ended check failed"))
  .finally(() => {
    server.kill();
    rmSync(dataDir, { recursive: true, force: true });
  });
