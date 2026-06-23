const http = require("http");

const listenPort = Number(process.env.PORT || 8320);
const targetOrigin = process.env.CGA_TARGET_ORIGIN || "http://127.0.0.1:4182";

function buildCorsHeaders(req) {
  const origin = String(req.headers.origin || "*");
  const requestedHeaders = String(req.headers["access-control-request-headers"] || "").trim();
  return {
    "access-control-allow-origin": origin || "*",
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers": requestedHeaders || "Content-Type, X-Aidot-Webchat-Key",
    "access-control-expose-headers": "Content-Type",
    vary: "Origin"
  };
}

function copyHeaders(headers) {
  const next = new Headers();
  for (const [key, value] of Object.entries(headers || {})) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) next.append(key, item);
      continue;
    }
    next.set(key, String(value));
  }
  next.delete("host");
  next.delete("content-length");
  next.delete("connection");
  return next;
}

async function forward(req, res) {
  const targetUrl = new URL(req.url || "/", targetOrigin);
  const method = req.method || "GET";
  const chunks = [];
  const corsHeaders = buildCorsHeaders(req);

  if (method === "OPTIONS") {
    res.writeHead(204, {
      ...corsHeaders,
      "content-length": "0"
    });
    res.end();
    return;
  }

  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", async () => {
    try {
      const bodyBuffer = chunks.length ? Buffer.concat(chunks) : null;
      const response = await fetch(targetUrl, {
        method,
        headers: copyHeaders(req.headers),
        body: bodyBuffer && method !== "GET" && method !== "HEAD" ? bodyBuffer : undefined,
        redirect: "manual"
      });
      const responseBody = Buffer.from(await response.arrayBuffer());
      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === "content-length") return;
        responseHeaders[key] = value;
      });
      Object.assign(responseHeaders, corsHeaders);
      responseHeaders["content-length"] = String(responseBody.length);
      res.writeHead(response.status, responseHeaders);
      res.end(responseBody);
    } catch (error) {
      const payload = JSON.stringify({
        detail: error instanceof Error ? error.message : "Proxy forwarding failed"
      });
      res.writeHead(502, {
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(payload)
      });
      res.end(payload);
    }
  });
}

const server = http.createServer((req, res) => {
  void forward(req, res);
});

server.listen(listenPort, "127.0.0.1", () => {
  console.log(`Aidot webchat proxy listening on http://127.0.0.1:${listenPort} -> ${targetOrigin}`);
});
