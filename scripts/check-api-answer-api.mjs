import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = String(14000 + Math.floor(Math.random() * 10000));
const baseUrl = `http://localhost:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), "cga-api-answer-"));
const server = spawn("node", ["scripts/serve-studio.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: port, CGA_DATA_DIR: dataDir },
  stdio: "pipe"
});
let serverStderr = "";

server.stderr?.on("data", (chunk) => {
  serverStderr += chunk.toString();
});

function fail(message) {
  const detail = serverStderr.trim();
  console.error(`FAIL ${detail ? `${message}\n${detail}` : message}`);
  server.kill();
  process.exit(1);
}

async function waitForServer() {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (server.exitCode != null) {
      fail(`api answer API test server exited early with code ${server.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  fail("api answer API test server did not start");
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
  const registryPath = "/api/cga/groups/g-support/bots/supportbot-draft/api-answers";

  const initial = await expectStatus(registryPath, { userId: "u-builder" }, 200, "initial registry read failed");
  if (!Array.isArray(initial.items) || initial.items.length !== 0) fail("initial registry should be empty");

  await expectStatus(registryPath, {
    method: "POST",
    userId: "u-operator",
    body: {
      name: "blocked_metric_lookup",
      endpoint_url: "https://api.example.com/blocked",
      response_path: "data.answer"
    }
  }, 403, "user without target group API answer scope should not create API answer");

  const missingField = await expectStatus(registryPath, {
    method: "POST",
    userId: "u-builder",
    body: {
      name: "missing_endpoint"
    }
  }, 400, "API answer missing endpoint should be rejected");
  if (missingField.error_code !== "CGA_API_ANSWER_REQUIRED_FIELD_MISSING") fail("missing API answer field error code mismatch");
  if (missingField.message_key !== "errors.apiAnswer.requiredField") fail("missing API answer field message key mismatch");

  const created = await expectStatus(registryPath, {
    method: "POST",
    userId: "u-builder",
    body: {
      name: "company_metric_lookup",
      endpoint_url: "https://api.example.com/financials/{company_id}",
      method: "GET",
      auth_type: "bearer",
      secret_ref: "secret:group/g-support/financials",
      response_path: "data.formatted_answer"
    }
  }, 201, "builder should create API answer");
  if (created.item?.managed_by !== "group") fail("created API answer is not group-managed");
  if (created.item?.group_id !== "g-support" || created.item?.bot_id !== "supportbot-draft") fail("created API answer scope mismatch");
  if (created.item?.response_mapping?.answer_text_path !== "data.formatted_answer") fail("created API answer response path mismatch");

  const afterCreate = await expectStatus(registryPath, { userId: "u-builder" }, 200, "registry read after create failed");
  if (!afterCreate.items?.some((item) => item.name === "company_metric_lookup")) fail("registry did not return created API answer");

  const registryFile = join(dataDir, "api-answer-registry.json");
  if (!existsSync(registryFile)) fail("api answer registry file was not created");
  const stored = JSON.parse(readFileSync(registryFile, "utf8"));
  if (!stored.some((item) => item.name === "company_metric_lookup" && item.secret_ref === "secret:group/g-support/financials")) fail("api answer registry file did not persist created API answer");

  console.log("OK group API answer endpoints passed");
}

main()
  .catch((error) => fail(error instanceof Error ? error.message : "api answer API check failed"))
  .finally(() => {
    server.kill();
    rmSync(dataDir, { recursive: true, force: true });
  });
