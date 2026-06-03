const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const requestPath = urlPath === "/" ? "/apps/studio/index.html" : urlPath;
  const safePath = path.normalize(requestPath).replace(/^[/\\]+/, "");
  const filePath = path.join(root, safePath);
  if (!filePath.startsWith(root)) return send(res, 403, "Forbidden");
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, "Not found");
    send(res, 200, data, types[path.extname(filePath)] || "application/octet-stream");
  });
});

server.listen(port, () => {
  console.log(`CGA Studio running at http://localhost:${port}`);
});
