const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT || 8080);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/Enquiry/")) {
    if (!["GET", "POST", "PUT", "DELETE", "OPTIONS"].includes(req.method)) {
      res.writeHead(405).end("Method not allowed"); return;
    }
    try {
      const upstream = await fetch(`https://api.freeprojectapi.com${url.pathname}${url.search}`, {
        method: req.method,
        headers: { Accept: "application/json", ...(req.headers["content-type"] ? { "Content-Type": req.headers["content-type"] } : {}) },
        ...(req.method === "GET" || req.method === "OPTIONS" ? {} : { body: req }),
        duplex: req.method === "GET" || req.method === "OPTIONS" ? undefined : "half",
      });
      res.writeHead(upstream.status, { "Content-Type": upstream.headers.get("content-type") || "application/json" });
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      res.writeHead(502, { "Content-Type": "application/json" }).end(JSON.stringify({ message: "FreeProjectAPI is unavailable" }));
    }
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405).end("Method not allowed"); return; }
  let file;
  try { file = path.resolve(root, `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`); }
  catch { res.writeHead(400).end("Bad path"); return; }
  if (!file.startsWith(root + path.sep) && file !== path.join(root, "index.html")) { res.writeHead(403).end("Forbidden"); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end("Not found"); return; }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(req.method === "HEAD" ? undefined : data);
  });
}).listen(port, "127.0.0.1", () => console.log(`Enquiry Desk: http://localhost:${port}`));
