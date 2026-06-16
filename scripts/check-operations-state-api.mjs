import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = String(4893 + Math.floor(Math.random() * 100));
const baseUrl = `http://localhost:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), "cga-operations-state-"));
const server = spawn("node", ["scripts/serve-studio.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: port, CGA_DATA_DIR: dataDir },
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
  fail("operations state API test server did not start");
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
  const operationsPath = "/api/cga/groups/g-support/bots/supportbot-draft/operations-state";

  const initial = await expectStatus(operationsPath, { userId: "u-builder" }, 200, "initial operations state read failed");
  if (initial.build?.status !== "ready") fail("default build status mismatch");
  if (initial.test?.matched_intent !== "password_reset") fail("default simulator result mismatch");
  if (initial.operate?.compatibility !== "preserved") fail("default operate compatibility mismatch");

  await expectStatus(`${operationsPath}/run-build`, {
    method: "POST",
    userId: "u-operator",
    body: { intent_count: 3 }
  }, 403, "operator outside support group should not run build");

  const built = await expectStatus(`${operationsPath}/run-build`, {
    method: "POST",
    userId: "u-builder",
    body: { intent_count: 7 }
  }, 200, "builder should run build");
  if (built.operations_state?.build?.status !== "built") fail("build action did not update status");
  if (built.operations_state?.build?.intent_count !== 7) fail("build action did not persist intent count");

  const tested = await expectStatus(`${operationsPath}/run-test`, {
    method: "POST",
    userId: "u-reviewer",
    body: { message: "Can you help with password reset?" }
  }, 200, "reviewer should run simulator test");
  if (tested.operations_state?.test?.matched_intent !== "password_reset") fail("test action did not classify password reset preview");

  const deployedByBuilder = await expectStatus(`${operationsPath}/deploy`, {
    method: "POST",
    userId: "u-builder"
  }, 200, "builder should deploy under latest role policy");
  if (deployedByBuilder.operations_state?.operate?.deployment_status !== "deployed") fail("builder deploy action did not update deployment status");

  const deployed = await expectStatus(`${operationsPath}/deploy`, {
    method: "POST",
    userId: "admin"
  }, 200, "admin should deploy support bot");
  if (deployed.operations_state?.operate?.deployment_status !== "deployed") fail("deploy action did not update deployment status");

  const afterActions = await expectStatus(operationsPath, { userId: "u-builder" }, 200, "operations state read after actions failed");
  if (afterActions.build?.status !== "built") fail("operations state did not persist build action");
  if (afterActions.operate?.deployment_status !== "deployed") fail("operations state did not persist deploy action");

  const operationsFile = join(dataDir, "operations-state-registry.json");
  if (!existsSync(operationsFile)) fail("operations state registry file was not created");
  const stored = JSON.parse(readFileSync(operationsFile, "utf8"));
  if (!stored.some((item) => item.bot_id === "supportbot-draft" && item.build?.status === "built" && item.operate?.deployment_status === "deployed")) {
    fail("operations state registry did not persist saved operations state");
  }

  console.log("OK operations state endpoints passed");
}

main()
  .catch((error) => fail(error instanceof Error ? error.message : "operations state API check failed"))
  .finally(() => {
    if (!serverKilled) {
      serverKilled = true;
      server.kill();
    }
    rmSync(dataDir, { recursive: true, force: true });
  });
