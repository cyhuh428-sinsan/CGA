import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = String(4493 + Math.floor(Math.random() * 100));
const baseUrl = `http://localhost:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), "cga-workspace-bots-"));
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
  fail("workspace bots API test server did not start");
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
  const supportBotsPath = "/api/cga/groups/g-support/bots";

  const initial = await expectStatus(supportBotsPath, { userId: "u-builder" }, 200, "initial group bot list failed");
  if (!initial.items?.some((bot) => bot.id === "supportbot-draft")) fail("initial group bot list did not include supportbot-draft");

  await expectStatus(supportBotsPath, {
    method: "POST",
    userId: "u-operator",
    body: {
      id: "blocked-bot",
      name: "Blocked Bot",
      locale: "en"
    }
  }, 403, "user without target group bot.create should not create bot");

  const created = await expectStatus(supportBotsPath, {
    method: "POST",
    userId: "u-builder",
    body: {
      id: "api-created-bot",
      name: "API Created Bot",
      version: "v0.1",
      status: "draft",
      locale: "ja"
    }
  }, 201, "builder should create group bot");
  if (created.bot?.group_id !== "g-support" || created.bot?.id !== "api-created-bot") fail("created bot scope mismatch");
  if (created.bot?.locale !== "ja") fail("created bot locale mismatch");

  const afterCreate = await expectStatus(supportBotsPath, { userId: "u-builder" }, 200, "group bot list after create failed");
  if (!afterCreate.items?.some((bot) => bot.id === "api-created-bot" && bot.name === "API Created Bot")) fail("group bot list did not return created bot");

  const botsFile = join(dataDir, "workspace-bots.json");
  if (!existsSync(botsFile)) fail("workspace bots file was not created");
  const stored = JSON.parse(readFileSync(botsFile, "utf8"));
  if (!stored.some((bot) => bot.id === "api-created-bot" && bot.group_id === "g-support")) fail("workspace bots file did not persist created bot");

  console.log("OK workspace bot endpoints passed");
}

main()
  .catch((error) => fail(error instanceof Error ? error.message : "workspace bots API check failed"))
  .finally(() => {
    server.kill();
    rmSync(dataDir, { recursive: true, force: true });
  });
