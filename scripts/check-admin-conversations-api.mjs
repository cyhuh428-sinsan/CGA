import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = String(45000 + Math.floor(Math.random() * 2000));
const baseUrl = `http://localhost:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), "cga-admin-conversations-"));
const server = spawn("node", ["scripts/serve-studio.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: port, CGA_DATA_DIR: dataDir, CGA_AUTH_HEADER_FALLBACK: "enabled" },
  stdio: "pipe"
});
let serverKilled = false;

function fail(message) {
  console.error(`FAIL ${message}`);
  if (!serverKilled) {
    serverKilled = true;
    server.kill();
  }
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
  fail("admin conversations API test server did not start");
}

async function requestJson(path, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  return { response, payload };
}

function requireItem(items, predicate, message) {
  const item = Array.isArray(items) ? items.find(predicate) : null;
  if (!item) fail(message);
  return item;
}

async function main() {
  await waitForServer();

  const roomCreate = await requestJson("/api/v1/channels/webchat/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: {
      bot_slug: "supportbot-draft",
      client_room_id: "conversation-history-check",
      participant_id: "history-check-user",
      participant_name: "운영 사용자"
    }
  });
  if (roomCreate.response.status !== 200) fail(`webchat room create failed: ${roomCreate.response.status}`);
  const room = roomCreate.payload?.data?.room;
  if (!room?.id) fail("webchat room create did not return room id");

  const roomMessage = await requestJson(`/api/v1/channels/webchat/rooms/${room.id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: {
      message: "I need to reset my password",
      participant_id: "history-check-user"
    }
  });
  if (roomMessage.response.status !== 200) fail(`webchat message failed: ${roomMessage.response.status}`);

  const richMessage = await requestJson(`/api/v1/channels/webchat/rooms/${room.id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: {
      message: "__CGA_RICH_OPTIONS__",
      participant_id: "history-check-user"
    }
  });
  if (richMessage.response.status !== 200) fail(`webchat rich message failed: ${richMessage.response.status}`);

  const simulatorRun = await requestJson("/api/cga/groups/g-support/bots/supportbot-draft/operations-state/run-test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-CGA-User-Id": "u-reviewer"
    },
    body: {
      message: "I forgot my password."
    }
  });
  if (simulatorRun.response.status !== 200) fail(`simulator run-test failed: ${simulatorRun.response.status}`);

  const conversations = await requestJson("/api/v1/admin/conversations");
  if (conversations.response.status !== 200) fail(`admin conversations failed: ${conversations.response.status}`);
  if (!Array.isArray(conversations.payload?.items)) fail("admin conversations did not return items array");
  if (typeof conversations.payload?.total !== "number") fail("admin conversations did not return total");

  const webchatItem = requireItem(
    conversations.payload.items,
    (item) => item.channel_name === "Webchat" && item.user_key === "운영 사용자",
    "admin conversations did not include webchat session row"
  );
  if (webchatItem.data_json?.contract_version !== "v1.0") fail("webchat conversation contract version mismatch");
  if (webchatItem.data_json?.compatibility_status !== "compatible") fail("webchat conversation compatibility status mismatch");
  if (!Array.isArray(webchatItem.data_json?.conversation_history?.transcript) || webchatItem.data_json.conversation_history.transcript.length < 2) {
    fail("webchat conversation transcript was not preserved");
  }
  if (webchatItem.intent_or_module_name !== "sample_rich_options") fail("webchat conversation latest intent mismatch");
  if (webchatItem.data_json?.runtime_summary !== "matched") fail("webchat conversation runtime summary mismatch");
  if (webchatItem.data_json?.completion_reason !== "matched") fail("webchat conversation completion reason mismatch");
  if (webchatItem.data_json?.dialog_ended !== true) fail("webchat conversation dialog ended mismatch");
  if (webchatItem.data_json?.session_ended !== false) fail("webchat conversation session ended mismatch");
  if (webchatItem.data_json?.session_first_user_utterance !== "I need to reset my password") {
    fail("webchat conversation first user utterance mismatch");
  }
  if (webchatItem.data_json?.room_id !== room.id) fail("webchat conversation room id mismatch");
  if (webchatItem.data_json?.client_room_id !== "conversation-history-check") fail("webchat conversation client room id mismatch");
  if (!Array.isArray(webchatItem.data_json?.runtime_events) || webchatItem.data_json.runtime_events.length < 2) {
    fail("webchat conversation runtime events mismatch");
  }
  if (!Array.isArray(webchatItem.data_json.runtime_events?.[0]?.data?.updatedVariables) || !webchatItem.data_json.runtime_events[0].data.updatedVariables.includes("$userMessage")) {
    fail("webchat conversation runtime updatedVariables mismatch");
  }
  if (webchatItem.data_json.runtime_events?.[0]?.data?.valuePreviews?.$matchedIntent !== "sample_rich_options") {
    fail("webchat conversation latest runtime valuePreviews mismatch");
  }
  if (!Array.isArray(webchatItem.data_json?.messages) || webchatItem.data_json.messages[0]?.participant_kind !== "bot") {
    fail("webchat conversation messages participant_kind mismatch");
  }
  if (!webchatItem.data_json.messages.some((message) => message.display_text === "Open Account Settings and choose Reset Password.")) {
    fail("webchat conversation should preserve earlier password reset answer");
  }
  if (!String(webchatItem.data_json.messages[1]?.display_text || "").trim()) {
    fail("webchat conversation messages display_text mismatch");
  }
  const richBotMessage = webchatItem.data_json.messages.find((message) => message.message_type === "form");
  if (!richBotMessage) fail("webchat conversation rich form message was not preserved");
  if (richBotMessage.display_text !== "다음 중 선택하세요 / 예금, 대출, 상담원 연결") {
    fail("webchat conversation rich form display_text mismatch");
  }
  if (!Array.isArray(richBotMessage.payload_json?.options) || richBotMessage.payload_json.options.length !== 3) {
    fail("webchat conversation rich form options mismatch");
  }
  if (richBotMessage.payload_json?.sourceTalkNodeId !== "sample-rich-options-node") {
    fail("webchat conversation rich form sourceTalkNodeId mismatch");
  }
  const richTranscriptMessage = webchatItem.data_json?.conversation_history?.transcript?.find((message) => message.message_type === "form");
  if (!richTranscriptMessage) fail("webchat conversation transcript rich form message was not preserved");
  if (richTranscriptMessage.display_text !== "다음 중 선택하세요 / 예금, 대출, 상담원 연결") {
    fail("webchat conversation transcript rich form display_text mismatch");
  }
  if (!Array.isArray(richTranscriptMessage.payload_json?.options) || richTranscriptMessage.payload_json.options.length !== 3) {
    fail("webchat conversation transcript rich form options mismatch");
  }
  if (richTranscriptMessage.payload_json?.sourceTalkNodeId !== "sample-rich-options-node") {
    fail("webchat conversation transcript rich form sourceTalkNodeId mismatch");
  }

  const simulatorItem = requireItem(
    conversations.payload.items,
    (item) => item.channel_name === "Simulator" && item.intent_or_module_name === "password_reset",
    "admin conversations did not include simulator session row"
  );
  if (simulatorItem.data_json?.contract_version !== "v1.0") fail("simulator conversation contract version mismatch");
  if (!Array.isArray(simulatorItem.data_json?.session_user_utterances) || !simulatorItem.data_json.session_user_utterances.includes("I forgot my password.")) {
    fail("simulator conversation user utterances mismatch");
  }
  if (simulatorItem.data_json?.runtime_summary !== "password_reset") fail("simulator conversation runtime summary mismatch");
  if (simulatorItem.data_json?.completion_reason !== "matched") fail("simulator conversation completion reason mismatch");
  if (simulatorItem.data_json?.dialog_ended !== true) fail("simulator conversation dialog ended mismatch");
  if (simulatorItem.data_json?.session_ended !== false) fail("simulator conversation session ended mismatch");
  if (!String(simulatorItem.data_json?.room_id || "").startsWith("simulator:")) fail("simulator conversation room id mismatch");
  if (!Array.isArray(simulatorItem.data_json?.runtime_events) || simulatorItem.data_json.runtime_events.length < 2) {
    fail("simulator conversation runtime events mismatch");
  }
  if (simulatorItem.data_json.runtime_events?.[0]?.data?.valuePreviews?.$matchedIntent !== "password_reset") {
    fail("simulator conversation runtime valuePreviews mismatch");
  }
  if (!Array.isArray(simulatorItem.data_json?.messages) || simulatorItem.data_json.messages[0]?.participant_kind !== "user") {
    fail("simulator conversation messages participant_kind mismatch");
  }
  if (simulatorItem.data_json.messages[1]?.display_text !== "Open Account Settings and choose Reset Password.") {
    fail("simulator conversation messages display_text mismatch");
  }

  const filtered = await requestJson("/api/v1/admin/conversations?query=%EC%9A%B4%EC%98%81%20%EC%82%AC%EC%9A%A9%EC%9E%90");
  if (filtered.response.status !== 200) fail(`filtered admin conversations failed: ${filtered.response.status}`);
  if (!Array.isArray(filtered.payload?.items) || filtered.payload.items.length < 1) fail("filtered admin conversations returned empty result");
  if (filtered.payload.items.some((item) => item.channel_name === "Simulator")) {
    fail("filtered admin conversations should not include unmatched simulator row");
  }

  console.log("OK admin conversations API passed");
}

main()
  .catch((error) => fail(error instanceof Error ? error.message : "admin conversations API check failed"))
  .finally(() => {
    if (!serverKilled) {
      serverKilled = true;
      server.kill();
    }
    rmSync(dataDir, { recursive: true, force: true });
  });
