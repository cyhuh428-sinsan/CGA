import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = String(4693 + Math.floor(Math.random() * 100));
const baseUrl = `http://localhost:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), "cga-composition-"));
const server = spawn("node", ["scripts/serve-studio.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: port, CGA_DATA_DIR: dataDir, CGA_AUTH_HEADER_FALLBACK: "enabled" },
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
  fail("composition API test server did not start");
}

async function requestJson(path, { method = "GET", userId = "u-builder", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-CGA-User-Id": userId
    },
    body: body == null ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  return { response, payload };
}

async function expectStatus(path, options, expectedStatus, message) {
  const result = await requestJson(path, options);
  if (result.response.status !== expectedStatus) fail(`${message}: expected ${expectedStatus}, got ${result.response.status}`);
  return result.payload;
}

async function main() {
  await waitForServer();
  const compositionPath = "/api/cga/groups/g-support/bots/supportbot-draft/composition";

  const initial = await expectStatus(compositionPath, { userId: "u-builder" }, 200, "initial composition read failed");
  if (!initial.utterances?.some((item) => item.includes("password"))) fail("default composition did not include sample utterances");

  await expectStatus(compositionPath, {
    method: "PUT",
    userId: "u-operator",
    body: {
      utterances: ["blocked"],
      requested_intent_count: 1,
      intent_candidates: []
    }
  }, 403, "user without bot.configure should not save composition");

  const saved = await expectStatus(compositionPath, {
    method: "PUT",
    userId: "u-builder",
    body: {
      input_mode: "utterances",
      utterances: ["How do I reset my password?", "Where can I change my email?"],
      requested_intent_count: 2,
      pdf: {
        file_name: "guide.pdf",
        byte_length: 1200,
        type: "application/pdf",
        data_url: "data:application/pdf;base64,JVBERi0="
      },
      intent_candidates: [
        { intent: "password_reset", utterance_count: 1, status: "answer_required" },
        { intent: "account_update", utterance_count: 1, status: "ready" }
      ]
    }
  }, 200, "builder should save composition");
  if (saved.composition?.group_id !== "g-support" || saved.composition?.bot_id !== "supportbot-draft") fail("saved composition scope mismatch");
  if (saved.composition?.intent_candidates?.length !== 2) fail("saved composition intent candidates mismatch");

  const afterSave = await expectStatus(compositionPath, { userId: "u-builder" }, 200, "composition read after save failed");
  if (afterSave.pdf?.file_name !== "guide.pdf") fail("composition did not persist PDF metadata");
  if (afterSave.requested_intent_count !== 2) fail("composition did not persist requested intent count");

  const compositionFile = join(dataDir, "composition-registry.json");
  if (!existsSync(compositionFile)) fail("composition registry file was not created");
  const stored = JSON.parse(readFileSync(compositionFile, "utf8"));
  if (!stored.some((item) => item.bot_id === "supportbot-draft" && item.pdf?.file_name === "guide.pdf")) fail("composition registry did not persist saved composition");

  console.log("OK composition endpoints passed");
}

main()
  .catch((error) => fail(error instanceof Error ? error.message : "composition API check failed"))
  .finally(() => {
    server.kill();
    rmSync(dataDir, { recursive: true, force: true });
  });
