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

  const legacy = await requestJson("/api/v1/webchat/bots/supportbot-draft/rooms/webchat-legacy-room/messages", {
    method: "POST",
    body: {
      message: "I need to reset my password",
      participant_id: "webchat-check"
    }
  });
  if (legacy.response.status !== 200) fail(`legacy webchat message failed: ${legacy.response.status}`);
  if (requireData(legacy.payload, "legacy response did not use Aidot data envelope").intent?.name !== "password_reset") {
    fail("legacy webchat response did not return matched intent");
  }

  console.log("OK Aidot-compatible webchat channel endpoints passed");
}

main()
  .catch((error) => fail(error instanceof Error ? error.message : "webchat channel API check failed"))
  .finally(() => {
    server.kill();
    rmSync(dataDir, { recursive: true, force: true });
  });
