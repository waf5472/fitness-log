#!/usr/bin/env node
// Bulk crawler for seeding the index from a laptop, where there is no
// subrequest budget and no 10 ms CPU cap. Same parsers as the Worker cron.
//
//   npm run crawl -- --source budgetbytes --limit 400 --out seed/budgetbytes.jsonl
//   npm run crawl -- --source all --limit 300 --push http://localhost:8787
//   npm run crawl -- --push https://leftovers.wesley-fletcher.com --token $OWNER_TOKEN --from seed/*.jsonl
//
// --out writes records as JSONL (one {row, ingredients, unresolved} per line).
// --push POSTs them to /api/admin/import in batches of 50. Both may be given.
// Politeness: robots.txt honoured, one request per second per host, honest UA.

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { SOURCES, SOURCE_BY_ID } from "../worker/crawl/sources.js";
import { parseSitemap, pickChildSitemaps } from "../worker/crawl/sitemap.js";
import { extractRecipe } from "../worker/crawl/jsonld.js";
import { buildRecipeRecord } from "../worker/crawl/recipe.js";
import { robotsAllows } from "../worker/crawl/robots.js";

const args = parseArgs(process.argv.slice(2));
const UA = "leftovers-crawler/0.1 (+https://leftovers.wesley-fletcher.com; polite, metadata only)";
const DELAY_MS = parseInt(args.delay || "1000", 10);
const limit = parseInt(args.limit || "200", 10);

const records = [];
if (args.from) {
  for (const f of String(args.from).split(",")) {
    for (const line of readFileSync(f, "utf8").split("\n")) if (line.trim()) records.push(JSON.parse(line));
  }
  console.log(`loaded ${records.length} records from ${args.from}`);
} else {
  const ids = !args.source || args.source === "all" ? SOURCES.map((s) => s.id) : String(args.source).split(",");
  for (const id of ids) {
    const source = SOURCE_BY_ID[id];
    if (!source) { console.error(`unknown source ${id}`); continue; }
    await crawlSource(source);
  }
}

if (args.push) await push(records, args.push, args.token || process.env.OWNER_TOKEN);
console.log(`done: ${records.length} records`);

// ---------------------------------------------------------------------------
async function crawlSource(source) {
  const origin = new URL(source.sitemap).origin;
  const robots = await get(`${origin}/robots.txt`).catch(() => ({ status: 0, text: "" }));
  const robotsTxt = robots.status === 200 ? robots.text : "";
  if (!robotsAllows(robotsTxt, new URL(source.sitemap).pathname)) {
    console.log(`[${source.id}] robots.txt disallows the sitemap; skipping`);
    return;
  }
  const top = await get(source.sitemap);
  if (top.status !== 200) { console.log(`[${source.id}] sitemap HTTP ${top.status}`); return; }
  let parsed = parseSitemap(top.text);
  let entries = [];
  if (parsed.kind === "index") {
    for (const child of pickChildSitemaps(parsed.entries)) {
      const r = await get(child).catch(() => ({ status: 0, text: "" }));
      if (r.status === 200) entries.push(...parseSitemap(r.text).entries);
      if (entries.filter((e) => source.match.test(e.loc)).length >= limit * 3) break;
    }
  } else entries = parsed.entries;
  const urls = entries.map((e) => e.loc).filter((u) => source.match.test(u));
  console.log(`[${source.id}] ${urls.length} recipe URLs in sitemap; crawling up to ${limit}`);
  let stored = 0, skipped = 0;
  const seen = new Set();
  for (const url of shuffle(urls)) {
    if (stored >= limit) break;
    if (seen.has(url)) continue;
    seen.add(url);
    const path = new URL(url).pathname;
    if (!robotsAllows(robotsTxt, path)) { skipped++; continue; }
    let res;
    try { res = await get(url); } catch (e) { skipped++; continue; }
    if (res.status !== 200) { skipped++; continue; }
    const recipe = extractRecipe(res.text);
    if (!recipe) { skipped++; continue; }
    const built = buildRecipeRecord(recipe, { url, source });
    if (built.skip) { skipped++; if (args.verbose) console.log(`  skip ${url}: ${built.skip}`); continue; }
    records.push(built);
    stored++;
    if (args.out) {
      mkdirSync(dirname(args.out), { recursive: true });
      appendFileSync(args.out, JSON.stringify(built) + "\n");
    }
    if (stored % 25 === 0) console.log(`[${source.id}] ${stored} stored, ${skipped} skipped`);
  }
  console.log(`[${source.id}] finished: ${stored} stored, ${skipped} skipped`);
}

const lastHit = new Map();
async function get(url) {
  const host = new URL(url).host;
  const wait = (lastHit.get(host) || 0) + DELAY_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(host, Date.now());
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xml;q=0.9,*/*;q=0.5", "Accept-Language": "en" }, redirect: "follow", signal: ctl.signal });
    return { status: res.status, text: res.ok ? await res.text() : "" };
  } finally {
    clearTimeout(t);
  }
}

async function push(recs, base, token) {
  const endpoint = base.replace(/\/$/, "") + "/api/admin/import";
  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  let stored = 0;
  for (let i = 0; i < recs.length; i += 50) {
    const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ records: recs.slice(i, i + 50) }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { console.error(`push failed at ${i}: HTTP ${res.status} ${data.error || ""}`); process.exit(1); }
    stored += data.stored || 0;
    process.stdout.write(`\rpushed ${stored}/${recs.length}`);
  }
  console.log();
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) { out[key] = next; i++; } else out[key] = true;
  }
  return out;
}
function shuffle(a) {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}
