// Local web server for the chat page:  npm start   (or  npm run demo  without an API key)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./agent/env.js";
import { createProvider } from "./agent/providers.js";
import { demoProvider } from "./agent/demo-provider.js";
import { chatEndpoint } from "./agent/chat-handler.js";

loadEnv(); // reads .env if it exists

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" };

function readBody(req, limit = 20_000) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > limit) { reject(Object.assign(new Error("body too big"), { status: 400 })); req.destroy(); }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export function createServer(provider) {
  return http.createServer(async (req, res) => {
    const send = (status, body, type = "application/json; charset=utf-8") => {
      res.writeHead(status, { "content-type": type, "x-content-type-options": "nosniff" });
      res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
    };
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/api/health") return send(200, { provider: provider.name, demo: provider.name === "demo" });

    if (url.pathname === "/api/chat") {
      if (req.method !== "POST") return send(405, { error: "POST only" });
      let body;
      try { body = JSON.parse(await readBody(req)); } catch { return send(400, { error: "bad request" }); }
      const out = await chatEndpoint(provider, req.socket.remoteAddress, body);
      return send(out.status, out.json);
    }

    // static files from /public
    const file = path.join(publicDir, url.pathname === "/" ? "index.html" : url.pathname);
    if (!file.startsWith(publicDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(404, "Not found", "text/plain");
    send(200, fs.readFileSync(file), TYPES[path.extname(file)] || "application/octet-stream");
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const demo = process.argv.includes("--demo");
  let provider;
  try {
    provider = demo ? demoProvider() : createProvider();
  } catch (e) {
    console.error(e.message + "\nNo key yet? Run: npm run demo");
    process.exit(1);
  }
  const port = Number(process.env.PORT) || 3000;
  createServer(provider).listen(port, () => console.log(`Open http://localhost:${port}  (${provider.name})`));
}
