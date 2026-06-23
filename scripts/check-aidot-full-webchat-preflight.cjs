const { spawn } = require("child_process");
const { existsSync } = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const aidotWebchatDir = path.resolve(rootDir, "Aidot", "apps", "webchat");
const aidotNextBin = path.resolve(rootDir, "Aidot", "node_modules", "next", "dist", "bin", "next");

const studioPort = String(46000 + Math.floor(Math.random() * 1000));
const proxyPort = String(47000 + Math.floor(Math.random() * 1000));
const webchatPort = String(48000 + Math.floor(Math.random() * 1000));
const targetOrigin = `http://127.0.0.1:${studioPort}`;

const children = [];
let shuttingDown = false;

function fail(message) {
  console.error(`FAIL ${message}`);
  shutdown(1);
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  setTimeout(() => process.exit(exitCode), 200);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function startProcess(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd || rootDir,
    env: { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "pipe"],
    shell: false
  });
  children.push(child);

  child.stdout.on("data", (chunk) => {
    const text = String(chunk);
    if (process.env.CGA_SMOKE_DEBUG === "1") process.stdout.write(`[${name}] ${text}`);
  });
  child.stderr.on("data", (chunk) => {
    const text = String(chunk);
    if (process.env.CGA_SMOKE_DEBUG === "1") process.stderr.write(`[${name}] ${text}`);
  });
  child.on("exit", (code) => {
    if (!shuttingDown && code && code !== 0) {
      fail(`${name} exited unexpectedly with code ${code}`);
    }
  });

  return child;
}

async function waitFor(url, predicate, timeoutMs, label, options = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, options);
      const text = await response.text();
      if (predicate(response, text)) return;
      lastError = `unexpected response ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  fail(`${label} did not become ready: ${lastError}`);
}

async function requestJson(url, options = {}, label = url) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

async function requestText(url, options = {}, label = url) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const body = await response.text();
  return { response, body };
}

async function canReuseExistingAidotWebchat() {
  for (const origin of ["http://localhost:3330", "http://127.0.0.1:3330"]) {
    try {
      const response = await fetch(`${origin}/`);
      if (!response.ok) continue;
      const text = await response.text();
      if (/Aidot Webchat/i.test(text)) return true;
    } catch {
      continue;
    }
  }
  return false;
}

async function main() {
  if (!existsSync(aidotNextBin)) {
    fail(`Aidot next runtime is missing: ${aidotNextBin}`);
  }

  const studioChild = startProcess("studio", process.execPath, ["scripts/serve-studio.js"], {
    cwd: rootDir,
    env: { PORT: studioPort }
  });

  const proxyChild = startProcess("proxy", process.execPath, ["scripts/proxy-aidot-webchat-to-cga.cjs"], {
    cwd: rootDir,
    env: {
      PORT: proxyPort,
      CGA_TARGET_ORIGIN: targetOrigin
    }
  });

  const reuseExistingWebchat = await canReuseExistingAidotWebchat();
  const webchatOrigin = reuseExistingWebchat ? "http://localhost:3330" : `http://127.0.0.1:${webchatPort}`;
  if (!reuseExistingWebchat) {
    startProcess("aidot-webchat", process.execPath, [aidotNextBin, "dev", "--webpack", "--port", webchatPort], {
      cwd: aidotWebchatDir
    });
  }

  await waitFor(`http://127.0.0.1:${studioPort}/`, (response) => response.ok, 15000, "CGA studio");
  await new Promise((resolve) => setTimeout(resolve, 1000));
  if (studioChild.exitCode != null && studioChild.exitCode !== 0) {
    fail(`CGA studio exited unexpectedly with code ${studioChild.exitCode}`);
  }
  if (proxyChild.exitCode != null && proxyChild.exitCode !== 0) {
    fail(`Aidot proxy exited unexpectedly with code ${proxyChild.exitCode}`);
  }

  await waitFor(
    `${webchatOrigin}/`,
    (response, text) => response.ok && /Aidot Webchat/i.test(text),
    30000,
    "Aidot full webchat"
  );

  await waitFor(
    `http://127.0.0.1:${proxyPort}/api/am/supportbot-draft/session/start`,
    (response) => response.status === 204,
    15000,
    "Aidot proxy AM preflight",
    {
      method: "OPTIONS",
      headers: {
        Origin: webchatOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"
      }
    }
  );

  const proxyAmOptions = await requestText(`http://127.0.0.1:${proxyPort}/api/am/supportbot-draft/session/start`, {
    method: "OPTIONS",
    headers: {
      Origin: webchatOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type"
    }
  }, "Aidot proxy AM OPTIONS");
  if (proxyAmOptions.response.status !== 204) {
    fail(`Aidot proxy AM preflight returned ${proxyAmOptions.response.status} instead of 204`);
  }
  if (proxyAmOptions.response.headers.get("access-control-allow-origin") !== webchatOrigin) {
    fail("Aidot proxy AM preflight did not expose the expected CORS origin");
  }

  const connectResult = await requestJson(`${targetOrigin}/api/v1/channels/webchat/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ client_id: "aidot-full-webchat-preflight" })
  }, "CGA webchat connect");
  if (!connectResult.response.ok) {
    fail(`CGA webchat connect failed with status ${connectResult.response.status}`);
  }
  if (!connectResult.payload?.data?.connected) {
    fail("CGA webchat connect did not report connected=true");
  }
  if (!Array.isArray(connectResult.payload?.data?.bots) || connectResult.payload.data.bots.length < 1) {
    fail("CGA webchat connect did not return any bots");
  }

  console.log("OK Aidot full webchat preflight passed");
  console.log(`OK studio=${targetOrigin}`);
  console.log(`OK proxy=http://127.0.0.1:${proxyPort}`);
  console.log(`OK webchat=${webchatOrigin}`);
  shutdown(0);
}

main().catch((error) => fail(error instanceof Error ? error.message : "Aidot full webchat preflight failed"));
