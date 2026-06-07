import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = String(4193 + Math.floor(Math.random() * 100));
const baseUrl = `http://localhost:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), "cga-asset-api-"));
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
  fail("asset transfer API test server did not start");
}

async function main() {
  await waitForServer();
  const prefix = `${baseUrl}/api/cga/groups/g-support/bots/supportbot-draft`;

  async function fetchJson(path, options) {
    const response = await fetch(`${prefix}${path}`, options);
    const body = await response.json();
    if (!response.ok) fail(`${path} returned ${response.status}`);
    return body;
  }

  async function fetchText(path) {
    const response = await fetch(`${prefix}${path}`);
    const body = await response.text();
    if (!response.ok) fail(`${path} returned ${response.status}`);
    return body;
  }

  const manifest = await fetch(`${prefix}/assets/dictionary/manifest`).then((response) => response.json());
  if (manifest.manifest?.scope !== "dictionary") fail("manifest scope mismatch");
  if (manifest.request?.expected_file_format !== "txt") fail("manifest expected file format mismatch");
  if (!manifest.required_scopes?.importScopes?.includes("bot.configure")) fail("manifest import scope mismatch");

  const exportedText = await fetchText("/assets/dictionary/export");
  if (!exportedText.includes("대표어")) fail("dictionary export did not return Aidot TXT");

  const imported = await fetchJson("/assets/dictionary/import", {
    method: "POST",
    headers: { "X-CGA-File-Name": "Dictionary_test.txt" },
    body: "대표어,유의어1\r\npassword,login password"
  });
  if (imported.status !== "accepted") fail("dictionary import was not accepted");
  if (imported.request?.upload_mode !== "merge") fail("dictionary import upload mode mismatch");

  const reExportedText = await fetchText("/assets/dictionary/export");
  if (!reExportedText.includes("password,login password")) fail("dictionary export did not return stored import body");

  const botManifest = await fetchJson("/assets/bot/manifest");
  if (botManifest.manifest?.scope !== "bot") fail("bot manifest scope mismatch");
  if (botManifest.request?.expected_file_format !== "json") fail("bot manifest expected file format mismatch");
  if (!botManifest.required_scopes?.importScopes?.includes("bot.create")) fail("bot manifest import scope mismatch");

  const botExported = await fetchJson("/assets/bot/export");
  if (!botExported.package?.botVo) fail("bot export did not return Aidot bot package");

  const botImported = await fetchJson("/assets/bot/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CGA-File-Name": "AIDOT_Bot_Uploaded.json"
    },
    body: JSON.stringify({
      botVo: {
        bot_id: "uploaded-bot",
        name: "Uploaded Bot"
      }
    })
  });
  if (botImported.status !== "accepted") fail("bot import was not accepted");
  if (botImported.request?.upload_mode !== "replace") fail("bot import upload mode mismatch");

  const botReExported = await fetchJson("/assets/bot/export");
  if (botReExported.botVo?.name !== "Uploaded Bot") fail("bot export did not return stored import body");

  const versionManifest = await fetchJson("/assets/version/manifest");
  if (versionManifest.manifest?.scope !== "version") fail("version manifest scope mismatch");
  if (versionManifest.request?.expected_file_format !== "json") fail("version manifest expected file format mismatch");
  if (!versionManifest.required_scopes?.importScopes?.includes("bot.configure")) fail("version manifest import scope mismatch");

  const versionExported = await fetchJson("/assets/version/export");
  if (!versionExported.package?.version?.bot) fail("version export did not return CGA version package");

  const versionImported = await fetchJson("/assets/version/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CGA-File-Name": "CGA_Version_Uploaded.json"
    },
    body: JSON.stringify({
      version: {
        name: "v-uploaded",
        bot: {
          name: "Uploaded Version Bot"
        }
      }
    })
  });
  if (versionImported.status !== "accepted") fail("version import was not accepted");
  if (versionImported.request?.upload_mode !== "replace") fail("version import upload mode mismatch");

  const versionReExported = await fetchJson("/assets/version/export");
  if (versionReExported.version?.name !== "v-uploaded") fail("version export did not return stored import body");

  const history = await fetchJson("/asset-transfers");
  if (!Array.isArray(history.items) || history.items.length < 9) fail("asset transfer history did not record all export/import/re-export checks");
  if (!history.items.some((item) => item.direction === "import" && item.asset_path?.includes("dictionary.txt"))) fail("asset transfer history did not record stored asset path");
  if (!history.items.some((item) => item.scope === "bot" && item.direction === "import" && item.asset_path?.includes("bot.json"))) fail("asset transfer history did not record bot stored asset path");
  if (!history.items.some((item) => item.scope === "version" && item.direction === "import" && item.asset_path?.includes("version.json"))) fail("asset transfer history did not record version stored asset path");
  const historyFile = join(dataDir, "asset-transfer-history.json");
  if (!existsSync(historyFile)) fail("asset transfer history file was not created");
  const storedHistory = JSON.parse(readFileSync(historyFile, "utf8"));
  if (!Array.isArray(storedHistory) || storedHistory.length < 9) fail("asset transfer history file did not persist all transfer checks");
  console.log("OK asset transfer API endpoints passed");
}

main()
  .catch((error) => fail(error instanceof Error ? error.message : "asset transfer API check failed"))
  .finally(() => {
    server.kill();
    rmSync(dataDir, { recursive: true, force: true });
  });
