import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = String(4793 + Math.floor(Math.random() * 100));
const baseUrl = `http://localhost:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), "cga-detail-assets-"));
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
  fail("detail assets API test server did not start");
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
  const detailPath = "/api/cga/groups/g-support/bots/supportbot-draft/detail-assets";

  const initial = await expectStatus(detailPath, { userId: "u-builder" }, 200, "initial detail assets read failed");
  if (!initial.dictionary?.some((item) => item.word === "password")) fail("default detail assets did not include dictionary samples");
  if (!initial.blocklists?.some((item) => item.name === "아")) fail("default detail assets did not include blocklist samples");
  if (!initial.scenarios?.some((item) => item.id === "password_reset")) fail("default detail assets did not include scenario samples");

  await expectStatus(detailPath, {
    method: "PUT",
    userId: "u-operator",
    body: {
      dictionary: [{ word: "blocked", synonyms: [] }]
    }
  }, 403, "user without bot.configure should not save detail assets");

  const saved = await expectStatus(detailPath, {
    method: "PUT",
    userId: "u-builder",
    body: {
      intent_utterances: [
        { utterance: "Show my revenue", division: "revenue_lookup" }
      ],
      entities: [
        { name: "period", value: "month", rowType: "S", detail: "this month" }
      ],
      dictionary: [
        { word: "revenue", synonyms: ["sales", "turnover"] }
      ],
      rules: [
        { name: "Revenue API route", description: "Use group API answer", expression: "intent == revenue_lookup", target: "api.revenue", enabled: "Y" }
      ],
      blocklists: [
        { name: "ignore_revenue", type: "0", pattern: "revenue", enabled: "Y" }
      ],
      scenarios: [
        { id: "revenue_lookup", type: "intent", displayName: "revenue_lookup", answer: "Revenue comes from the financial API.", dialogCards: ["Revenue comes from the financial API."] }
      ]
    }
  }, 200, "builder should save detail assets");
  if (saved.detail_assets?.dictionary?.[0]?.word !== "revenue") fail("saved detail dictionary mismatch");
  if (saved.detail_assets?.rules?.[0]?.target !== "api.revenue") fail("saved detail rule mismatch");
  if (saved.detail_assets?.blocklists?.[0]?.name !== "ignore_revenue") fail("saved detail blocklist mismatch");
  if (saved.detail_assets?.scenarios?.[0]?.answer !== "Revenue comes from the financial API.") fail("saved detail scenario answer mismatch");

  const afterSave = await expectStatus(detailPath, { userId: "u-builder" }, 200, "detail assets read after save failed");
  if (afterSave.intent_utterances?.[0]?.division !== "revenue_lookup") fail("detail assets did not persist intent utterance");
  if (afterSave.entities?.[0]?.name !== "period") fail("detail assets did not persist entity");
  if (afterSave.blocklists?.[0]?.pattern !== "revenue") fail("detail assets did not persist blocklist");
  if (afterSave.scenarios?.[0]?.dialogCards?.[0] !== "Revenue comes from the financial API.") fail("detail assets did not persist dialog card");

  const detailFile = join(dataDir, "detail-asset-registry.json");
  if (!existsSync(detailFile)) fail("detail asset registry file was not created");
  const stored = JSON.parse(readFileSync(detailFile, "utf8"));
  if (!stored.some((item) => item.bot_id === "supportbot-draft" && item.dictionary?.[0]?.word === "revenue")) {
    fail("detail asset registry did not persist saved detail assets");
  }

  console.log("OK detail assets endpoints passed");
}

main()
  .catch((error) => fail(error instanceof Error ? error.message : "detail assets API check failed"))
  .finally(() => {
    server.kill();
    rmSync(dataDir, { recursive: true, force: true });
  });
