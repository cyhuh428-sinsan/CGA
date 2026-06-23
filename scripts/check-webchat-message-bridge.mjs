import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { normalizeBackendMessage } from "../apps/webchat/message-shape.js";

const port = String(4693 + Math.floor(Math.random() * 100));
const baseUrl = `http://localhost:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), "cga-webchat-bridge-"));
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
  fail("webchat bridge test server did not start");
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

  const room = await requestJson("/api/v1/channels/webchat/rooms", {
    method: "POST",
    body: {
      bot_slug: "supportbot-draft",
      client_room_id: "webchat-bridge-room",
      participant_id: "webchat-bridge",
      participant_name: "사용자"
    }
  });
  if (room.response.status !== 200) fail(`room create failed: ${room.response.status}`);
  const roomData = requireData(room.payload, "room response did not use Aidot data envelope");

  const richResponse = await requestJson(`/api/v1/channels/webchat/rooms/${roomData.room.id}/messages`, {
    method: "POST",
    body: {
      message: "__CGA_RICH_OPTIONS__",
      participant_id: "webchat-bridge"
    }
  });
  if (richResponse.response.status !== 200) fail(`rich bridge message failed: ${richResponse.response.status}`);
  const richData = requireData(richResponse.payload, "rich bridge response did not use Aidot data envelope");
  const richBotMessage = Array.isArray(richData.botMessages) && richData.botMessages.length
    ? richData.botMessages[0]
    : richData.botMessage;
  if (!richBotMessage) fail("rich bridge response did not return bot message");

  const normalized = normalizeBackendMessage(richBotMessage);
  assert.deepEqual(normalized, {
    participantKind: "bot",
    participantName: "SupportBot Draft",
    text: "다음 중 선택하세요",
    payloadSummary: "입력형 응답",
    options: ["예금", "대출", "상담원 연결"],
    sourceTalkNodeId: "sample-rich-options-node"
  });

  console.log("webchat message bridge check passed");
}

main()
  .catch((error) => fail(error instanceof Error ? error.message : "webchat message bridge check failed"))
  .finally(() => {
    server.kill();
    rmSync(dataDir, { recursive: true, force: true });
  });
