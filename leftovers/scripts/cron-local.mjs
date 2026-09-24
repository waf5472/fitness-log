#!/usr/bin/env node
// Fire the Worker's scheduled() handler once against the local SQLite index,
// exactly as the Cloudflare cron would. Handy for watching one crawl tick.
//   npm run cron:local            # crawl one batch
//   npm run cron:local -- weekly  # refresh stale sitemaps
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import worker from "../worker/index.js";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
mkdirSync(join(ROOT, ".data"), { recursive: true });
const raw = new DatabaseSync(join(ROOT, ".data", "leftovers.sqlite"));
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
  async batch(stmts) { const out = []; for (const s of stmts) out.push(await s.run()); return out; },
};
const cron = process.argv[2] === "weekly" ? "17 3 * * 0" : "*/5 * * * *";
const tasks = [];
await worker.scheduled({ cron }, { DB, CRAWL_BATCH: process.env.CRAWL_BATCH || "10" }, { waitUntil: (p) => tasks.push(p) });
await Promise.all(tasks);
console.log("recipes:", raw.prepare("SELECT COUNT(*) AS n FROM recipes").get().n, "queued:", raw.prepare("SELECT COUNT(*) AS n FROM crawl_queue").get().n);
