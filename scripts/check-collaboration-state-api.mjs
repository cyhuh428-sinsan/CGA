import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = String(14000 + Math.floor(Math.random() * 10000));
const baseUrl = `http://localhost:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), "cga-collaboration-state-"));
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
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  fail("collaboration state API test server did not start");
}

async function requestJson(path, { method = "GET", userId = "u-builder" } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-CGA-User-Id": userId
    }
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
  const collaborationPath = "/api/cga/groups/g-support/bots/supportbot-draft/collaboration-state";

  const initial = await expectStatus(collaborationPath, { userId: "u-builder" }, 200, "initial collaboration state read failed");
  if (!initial.workItems?.some((item) => item.id === "wi-intent-password")) fail("default collaboration state missing intent work item");
  if (!initial.workItems?.some((item) => item.status === "review")) fail("default collaboration state missing review queue");

  await expectStatus(`${collaborationPath}/work-items/wi-intent-password/lock`, {
    method: "POST",
    userId: "u-operator"
  }, 403, "operator outside support group should not lock support work item");

  const locked = await expectStatus(`${collaborationPath}/work-items/wi-intent-password/lock`, {
    method: "POST",
    userId: "u-builder"
  }, 200, "builder should lock assigned work item");
  const lockedItem = locked.collaboration_state?.workItems?.find((item) => item.id === "wi-intent-password");
  if (lockedItem?.lock?.user_id !== "u-builder") fail("lock action did not persist lock owner");

  const unlocked = await expectStatus(`${collaborationPath}/work-items/wi-intent-password/unlock`, {
    method: "POST",
    userId: "u-builder"
  }, 200, "builder should unlock own work item");
  const unlockedItem = unlocked.collaboration_state?.workItems?.find((item) => item.id === "wi-intent-password");
  if (unlockedItem?.lock != null) fail("unlock action did not clear lock");

  const approved = await expectStatus(`${collaborationPath}/work-items/wi-answer-password/approve`, {
    method: "POST",
    userId: "u-reviewer"
  }, 200, "reviewer should approve review item");
  const approvedItem = approved.collaboration_state?.workItems?.find((item) => item.id === "wi-answer-password");
  if (approvedItem?.status !== "approved") fail("approve action did not set approved status");
  if (!approvedItem?.reviewers?.some((item) => item.user_id === "u-reviewer" && item.decision === "approve")) fail("approve action did not record reviewer decision");

  const afterActions = await expectStatus(collaborationPath, { userId: "u-builder" }, 200, "collaboration state read after actions failed");
  if (!afterActions.workItems?.some((item) => item.id === "wi-answer-password" && item.status === "approved")) {
    fail("collaboration state did not persist approved work item");
  }

  const collaborationFile = join(dataDir, "collaboration-state-registry.json");
  if (!existsSync(collaborationFile)) fail("collaboration state registry file was not created");
  const stored = JSON.parse(readFileSync(collaborationFile, "utf8"));
  if (!stored.some((item) => item.bot_id === "supportbot-draft" && item.workItems?.some((workItem) => workItem.status === "approved"))) {
    fail("collaboration state registry did not persist saved collaboration state");
  }

  console.log("OK collaboration state endpoints passed");
}

main()
  .catch((error) => fail(error instanceof Error ? error.message : "collaboration state API check failed"))
  .finally(() => {
    if (!serverKilled) {
      serverKilled = true;
      server.kill();
    }
    rmSync(dataDir, { recursive: true, force: true });
  });
