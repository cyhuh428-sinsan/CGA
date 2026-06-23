const { spawn } = require("child_process");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const aidotWebchatDir = path.resolve(rootDir, "Aidot", "apps", "webchat");

const studioPort = process.env.CGA_SMOKE_STUDIO_PORT || "4182";
const proxyPort = process.env.CGA_SMOKE_PROXY_PORT || "8320";
const webchatPort = process.env.CGA_SMOKE_WEBCHAT_PORT || "3330";
const targetOrigin = process.env.CGA_TARGET_ORIGIN || `http://127.0.0.1:${studioPort}`;

const children = [];

function startProcess(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd || rootDir,
    env: { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "pipe"],
    shell: false
  });
  children.push(child);

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });
  child.on("exit", (code, signal) => {
    process.stdout.write(`[${name}] exited code=${code ?? "null"} signal=${signal ?? "null"}\n`);
  });

  return child;
}

function shutdown(exitCode = 0) {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("Aidot full WebChat smoke environment starting...");
console.log(`- CGA Studio: http://127.0.0.1:${studioPort}`);
console.log(`- Aidot proxy: http://127.0.0.1:${proxyPort} -> ${targetOrigin}`);
console.log(`- Aidot full WebChat: http://127.0.0.1:${webchatPort}`);
console.log("");
console.log("종료하려면 이 창에서 Ctrl+C 를 누르세요.");
console.log("");

startProcess("studio", process.execPath, ["scripts/serve-studio.js"], {
  cwd: rootDir,
  env: {
    PORT: studioPort
  }
});

startProcess("proxy", process.execPath, ["scripts/proxy-aidot-webchat-to-cga.cjs"], {
  cwd: rootDir,
  env: {
    PORT: proxyPort,
    CGA_TARGET_ORIGIN: targetOrigin
  }
});

startProcess("aidot-webchat", "npm.cmd", ["run", "dev"], {
  cwd: aidotWebchatDir,
  env: {
    PORT: webchatPort
  }
});
