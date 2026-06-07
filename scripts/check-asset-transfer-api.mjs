import { spawn } from "node:child_process";

const port = String(4193 + Math.floor(Math.random() * 100));
const baseUrl = `http://localhost:${port}`;
const server = spawn("node", ["scripts/serve-studio.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: port },
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
  const manifest = await fetch(`${prefix}/assets/dictionary/manifest`).then((response) => response.json());
  if (manifest.manifest?.scope !== "dictionary") fail("manifest scope mismatch");
  if (manifest.request?.expected_file_format !== "txt") fail("manifest expected file format mismatch");
  if (!manifest.required_scopes?.importScopes?.includes("bot.configure")) fail("manifest import scope mismatch");

  const exported = await fetch(`${prefix}/assets/dictionary/export`);
  const exportedText = await exported.text();
  if (!exported.ok || !exportedText.includes("대표어")) fail("dictionary export did not return Aidot TXT");

  const imported = await fetch(`${prefix}/assets/dictionary/import`, {
    method: "POST",
    headers: { "X-CGA-File-Name": "Dictionary_test.txt" },
    body: "대표어,유의어1\r\npassword,login password"
  }).then((response) => response.json());
  if (imported.status !== "accepted") fail("dictionary import was not accepted");
  if (imported.request?.upload_mode !== "merge") fail("dictionary import upload mode mismatch");

  const history = await fetch(`${prefix}/asset-transfers`).then((response) => response.json());
  if (!Array.isArray(history.items) || history.items.length < 2) fail("asset transfer history did not record export/import");
  console.log("OK asset transfer API endpoints passed");
}

main()
  .catch((error) => fail(error instanceof Error ? error.message : "asset transfer API check failed"))
  .finally(() => server.kill());
