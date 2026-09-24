#!/usr/bin/env node
// Run the whole app with no Cloudflare account: the real Worker module, a D1
// shim over node:sqlite (file-backed, so the index survives restarts), and the
// Vite build served as static assets.
//
//   npm run build && npm run dev:local        # http://localhost:8788
//   DEV_OWNER_EMAIL=you@example.com npm run dev:local   # owner mode (Cookbook in SQLite, Crawler tab)
//
// Then seed it:  npm run crawl -- --source budgetbytes --limit 100 --push http://localhost:8788
// (owner mode must be on for the import endpoint; DEV_OWNER_EMAIL does that.)

import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import worker from "../worker/index.js";

const PORT = parseInt(process.env.PORT || "8788", 10);
const ROOT = resolve(new URL("..", import.meta.url).pathname);
const DIST = join(ROOT, "dist");
const DATA = join(ROOT, ".data");
mkdirSync(DATA, { recursive: true });

// --- D1 shim ------------------------------------------------------------------
const raw = new DatabaseSync(join(DATA, "leftovers.sqlite"));
raw.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
for (const f of readdirSync(join(ROOT, "migrations")).sort()) raw.exec(readFileSync(join(ROOT, "migrations", f), "utf8"));
const DB = {
  prepare(sql) {
    const make = (params) => ({
      bind: (...p) => make(p),
      async all() { return { results: raw.prepare(sql).all(...params) }; },
      async first() { return raw.prepare(sql).get(...params) ?? null; },
      async run() { const r = raw.prepare(sql).run(...params); return { meta: { changes: Number(r.changes) } }; },
    });
    return make([]);
  },
  async batch(stmts) {
    raw.exec("BEGIN");
    try { const out = []; for (const s of stmts) out.push(await s.run()); raw.exec("COMMIT"); return out; }
    catch (e) { raw.exec("ROLLBACK"); throw e; }
  },
};

// --- Static assets ------------------------------------------------------------
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const ASSETS = {
  async fetch(request) {
    const url = new URL(request.url);
    let file = join(DIST, decodeURIComponent(url.pathname));
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, "index.html"); // SPA fallback
    if (!existsSync(file)) return new Response("Run `npm run build` first.", { status: 503 });
    return new Response(readFileSync(file), { headers: { "Content-Type": MIME[extname(file)] || "application/octet-stream" } });
  },
};

const env = {
  DB, ASSETS,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  DEV_OWNER_EMAIL: process.env.DEV_OWNER_EMAIL,
  OWNER_TOKEN: process.env.OWNER_TOKEN,
  CRAWL_BATCH: process.env.CRAWL_BATCH || "10",
  CRAWL_USER_AGENT: "leftovers-crawler/0.1 (+https://leftovers.wesley-fletcher.com; local dev)",
};

createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
  let response;
  try { response = await worker.fetch(request, env, { waitUntil() {} }); }
  catch (e) { response = new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } }); }
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, () => {
  const n = raw.prepare("SELECT COUNT(*) AS n FROM recipes").get().n;
  console.log(`leftovers dev server  http://localhost:${PORT}  (${n} recipes indexed, ${env.DEV_OWNER_EMAIL ? "owner: " + env.DEV_OWNER_EMAIL : "visitor mode"})`);
});
