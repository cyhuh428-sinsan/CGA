const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const port = 49173;
const dataDir = path.join(root, ".cga-data-admin-check");

function request(method, pathName, body) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      path: pathName,
      method,
      headers: payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}
    }, (res) => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        const elapsed = Date.now() - started;
        let json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch {}
        if (elapsed > 5000) reject(new Error(`${method} ${pathName} took ${elapsed}ms`));
        else if (res.statusCode >= 400) reject(new Error(`${method} ${pathName} failed ${res.statusCode}: ${raw}`));
        else resolve({ status: res.statusCode, elapsed, json });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function waitReady() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try { return await request("GET", "/api/cga/admin/resources"); } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  throw new Error("server not ready");
}

async function main() {
  fs.rmSync(dataDir, { recursive: true, force: true });
  const child = spawn(process.execPath, [path.join(root, "scripts", "serve-studio.js")], {
    cwd: root,
    env: { ...process.env, PORT: String(port), CGA_DATA_DIR: dataDir },
    stdio: ["ignore", "pipe", "pipe"]
  });
  try {
    const ready = await waitReady();
    const resources = ready.json;
    if (!Array.isArray(resources.templates) || resources.templates.length < 10) throw new Error("templates seed missing");
    if (!Array.isArray(resources.common_variables) || resources.common_variables.length < 8) throw new Error("common variables seed missing");
    if (!Array.isArray(resources.default_messages) || resources.default_messages.length < 5) throw new Error("default messages seed missing");
    if (!Array.isArray(resources.channels) || resources.channels.length < 4) throw new Error("channels seed missing");

    const list = await request("GET", "/api/cga/admin/templates");
    if (!list.json || list.json.total < 10) throw new Error("template list not returned");

    const cases = [
      {
        path: "/api/cga/admin/templates",
        create: { name: "검증 템플릿", channel_name: "Simulator", item_types: "text", renderer_type: "text" },
        update: { name: "검증 템플릿 수정", status: "N" }
      },
      {
        path: "/api/cga/admin/common-variables",
        create: { name: "_verify_variable", category: "사용자", value: "1", description: "검증 변수" },
        update: { value: "2", description: "검증 변수 수정" }
      },
      {
        path: "/api/cga/admin/default-messages",
        create: { category: "System", name: "검증 메시지", key: "verify_message", message: "검증입니다.", status: "Y" },
        update: { message: "검증 수정입니다.", status: "N" }
      },
      {
        path: "/api/cga/admin/channels",
        create: { channel_code: "VERIFY", channel_name: "Verify", provider: "webchat", renderer_type: "text", auth_type: "none", status: "Y" },
        update: { channel_name: "Verify Updated", status: "N" }
      }
    ];

    const timings = { resources: ready.elapsed, list: list.elapsed };
    for (const item of cases) {
      const before = await request("GET", item.path);
      const created = await request("POST", item.path, item.create);
      const id = created.json.id;
      const patched = await request("PATCH", `${item.path}/${id}`, item.update);
      await request("DELETE", `${item.path}/${id}`);
      const after = await request("GET", item.path);
      if (!id || !patched.json || after.json.total !== before.json.total) throw new Error(`${item.path} CRUD failed`);
      timings[item.path] = created.elapsed;
    }

    console.log(JSON.stringify({
      ok: true,
      timings_ms: timings,
      counts: { templates: resources.templates.length, common_variables: resources.common_variables.length, default_messages: resources.default_messages.length, channels: resources.channels.length }
    }, null, 2));
  } finally {
    child.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
