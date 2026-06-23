import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = String(4893 + Math.floor(Math.random() * 100));
const baseUrl = `http://localhost:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), "cga-am-session-"));
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
  fail("am/session API test server did not start");
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

  const legacyBootstrap = await requestJson("/api/v1/webchat/bootstrap");
  if (legacyBootstrap.response.status !== 200) fail(`legacy bootstrap failed: ${legacyBootstrap.response.status}`);
  const bootstrapData = requireData(legacyBootstrap.payload, "legacy bootstrap response did not use Aidot data envelope");
  if (!Array.isArray(bootstrapData.bots) || !bootstrapData.bots.some((bot) => bot.slug === "supportbot-draft")) {
    fail("legacy bootstrap did not include supportbot-draft bot");
  }
  if (!Array.isArray(bootstrapData.participants) || !bootstrapData.participants.some((participant) => participant.kind === "user")) {
    fail("legacy bootstrap did not include user participant");
  }
  if (!bootstrapData.participants.some((participant) => participant.kind === "bot" && participant.botSlug === "supportbot-draft")) {
    fail("legacy bootstrap did not include bot participant metadata");
  }

  const legacyRoomId = "am-legacy-room";
  const participantId = "am-session-user";
  const legacyMessage = await requestJson(`/api/v1/webchat/bots/supportbot-draft/rooms/${legacyRoomId}/messages`, {
    method: "POST",
    body: {
      message: "I need to reset my password",
      participant_id: participantId
    }
  });
  if (legacyMessage.response.status !== 200) fail(`legacy session message failed: ${legacyMessage.response.status}`);
  const legacyMessageData = requireData(legacyMessage.payload, "legacy session message response did not use Aidot data envelope");
  if (legacyMessageData.intent?.name !== "password_reset") fail("legacy session intent mismatch");
  if (legacyMessageData.runtime?.resolvedContractVersion !== "v1.0") fail("legacy session contract version mismatch");
  if (legacyMessageData.runtime?.sessionEnded !== false) fail("legacy session should remain open after matched response");

  const roomDetail = await requestJson(`/api/v1/channels/webchat/rooms/${legacyRoomId}`);
  if (roomDetail.response.status !== 200) fail(`legacy-backed room detail failed: ${roomDetail.response.status}`);
  const roomDetailData = requireData(roomDetail.payload, "legacy-backed room detail did not use Aidot data envelope");
  if (roomDetailData.room?.id !== legacyRoomId) fail("legacy-backed room detail id mismatch");
  if (roomDetailData.room?.status !== "open") fail("legacy-backed room should be open after matched response");
  if (roomDetailData.room?.contractVersion !== "v1.0") fail("legacy-backed room detail contract version mismatch");
  if (!Array.isArray(roomDetailData.messages) || roomDetailData.messages.length < 2) fail("legacy-backed room detail messages mismatch");

  const roomList = await requestJson(`/api/v1/channels/webchat/rooms?participant_id=${encodeURIComponent(participantId)}`);
  if (roomList.response.status !== 200) fail(`legacy-backed room list failed: ${roomList.response.status}`);
  const roomListData = requireData(roomList.payload, "legacy-backed room list did not use Aidot data envelope");
  if (!Array.isArray(roomListData.rooms) || !roomListData.rooms.some((room) => room.id === legacyRoomId)) {
    fail("legacy-backed room list did not include implicit room");
  }

  const legacySessionEnded = await requestJson(`/api/v1/webchat/bots/supportbot-draft/rooms/${legacyRoomId}/messages`, {
    method: "POST",
    body: {
      message: "__CGA_SESSION_END__",
      participant_id: participantId
    }
  });
  if (legacySessionEnded.response.status !== 200) fail(`legacy session end message failed: ${legacySessionEnded.response.status}`);
  const legacySessionEndedData = requireData(legacySessionEnded.payload, "legacy session end response did not use Aidot data envelope");
  if (legacySessionEndedData.intent?.name !== "session_end") fail("legacy session end intent mismatch");
  if (legacySessionEndedData.runtime?.sessionEnded !== true) fail("legacy session end runtime flag mismatch");
  if (legacySessionEndedData.runtime?.completionReason !== "session_ended") fail("legacy session end completion reason mismatch");

  const closedRoomDetail = await requestJson(`/api/v1/channels/webchat/rooms/${legacyRoomId}`);
  if (closedRoomDetail.response.status !== 200) fail(`closed legacy-backed room detail failed: ${closedRoomDetail.response.status}`);
  const closedRoomDetailData = requireData(closedRoomDetail.payload, "closed legacy-backed room detail did not use Aidot data envelope");
  if (closedRoomDetailData.room?.status !== "closed") fail("legacy-backed room should be closed after session end");

  const conversations = await requestJson("/api/v1/admin/conversations?query=__CGA_SESSION_END__");
  if (conversations.response.status !== 200) fail(`legacy admin conversations failed: ${conversations.response.status}`);
  if (!Array.isArray(conversations.payload?.items)) fail("legacy admin conversations did not return items array");
  const legacyConversation = conversations.payload.items.find((item) => item.id === legacyRoomId);
  if (!legacyConversation) fail("legacy admin conversations did not include implicit room");
  if (legacyConversation.data_json?.client_room_id !== legacyRoomId) fail("legacy admin conversation client_room_id mismatch");
  if (legacyConversation.data_json?.session_ended !== true) fail("legacy admin conversation session_ended mismatch");
  if (legacyConversation.data_json?.room_status !== "closed") fail("legacy admin conversation room_status mismatch");
  if (legacyConversation.data_json?.completion_reason !== "session_ended") fail("legacy admin conversation completion_reason mismatch");
  if (legacyConversation.data_json?.session_end_reason !== "user_requested_end") fail("legacy admin conversation session_end_reason mismatch");
  if (!Array.isArray(legacyConversation.data_json?.session_user_raw_utterances) || !legacyConversation.data_json.session_user_raw_utterances.includes("__CGA_SESSION_END__")) {
    fail("legacy admin conversation raw utterances should preserve session end trigger");
  }

  console.log("OK legacy AM/session core flow passed");
}

main()
  .catch((error) => fail(error instanceof Error ? error.message : "am/session API check failed"))
  .finally(() => {
    server.kill();
    rmSync(dataDir, { recursive: true, force: true });
  });
