import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = String(4593 + Math.floor(Math.random() * 100));
const baseUrl = `http://localhost:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), "cga-studio-state-"));
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
  fail("studio state API test server did not start");
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
  const statePath = "/api/cga/groups/g-support/bots/supportbot-draft/studio-state";

  const initial = await expectStatus(statePath, { userId: "u-builder" }, 200, "initial studio state read failed");
  if (initial.state?.bot?.id !== "supportbot-draft") fail("initial studio state bot id mismatch");

  await expectStatus(statePath, {
    method: "PUT",
    userId: "u-operator",
    body: {
      state: {
        bot: { name: "Blocked Bot", version: "v9", defaultLocale: "en" },
        structuralChoices: { useLlm: true }
      }
    }
  }, 403, "user without bot.configure should not save studio state");

  const saved = await expectStatus(statePath, {
    method: "PUT",
    userId: "u-builder",
    body: {
      state: {
        bot: {
          id: "ignored-client-id",
          name: "SupportBot Server State",
          description: "Saved from Create Bot",
          version: "v0.2",
          defaultLocale: "ja",
          selectedChannels: ["web"]
        },
        structuralChoices: {
          useLlm: true,
          compositionInput: "pdf",
          allowPdf: true,
          botServerLocation: "separate_server",
          orchestratorMode: "connect_existing"
        },
        counts: { intents: 0, utterances: 0, documents: 1, pendingApprovals: 0 },
        llm: { status: "connected", provider: null, model: null },
        channels: { web: "not_configured", desktopMessenger: "not_configured", kakaoKr: "disabled" }
      }
    }
  }, 200, "builder should save studio state");
  if (saved.state?.bot?.id !== "supportbot-draft") fail("server must keep canonical bot id");
  if (saved.state?.structuralChoices?.compositionInput !== "pdf") fail("saved structural choices mismatch");

  const afterSave = await expectStatus(statePath, { userId: "u-builder" }, 200, "studio state read after save failed");
  if (afterSave.state?.bot?.name !== "SupportBot Server State") fail("studio state did not persist bot name");
  if (afterSave.state?.bot?.defaultLocale !== "ja") fail("studio state did not persist locale");

  const stateFile = join(dataDir, "studio-state-registry.json");
  if (!existsSync(stateFile)) fail("studio state registry file was not created");
  const storedStates = JSON.parse(readFileSync(stateFile, "utf8"));
  if (!storedStates.some((item) => item.bot_id === "supportbot-draft" && item.state?.bot?.version === "v0.2")) fail("studio state registry did not persist saved version");

  const botsFile = join(dataDir, "workspace-bots.json");
  if (!existsSync(botsFile)) fail("workspace bots file was not updated");
  const storedBots = JSON.parse(readFileSync(botsFile, "utf8"));
  if (!storedBots.some((bot) => bot.id === "supportbot-draft" && bot.name === "SupportBot Server State" && bot.locale === "ja")) fail("workspace bot metadata was not updated from studio state");

  console.log("OK studio state endpoints passed");
}

main()
  .catch((error) => fail(error instanceof Error ? error.message : "studio state API check failed"))
  .finally(() => {
    server.kill();
    rmSync(dataDir, { recursive: true, force: true });
  });
