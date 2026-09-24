// One Worker: serves the SPA, answers match queries against the D1 recipe
// index, stores the owner's Cookbook/Spicerack/swipes, and runs the crawler
// on a cron.
//
// Two classes of user, as in fitness-log:
//   Visitors  -> /api/match and /api/stats (read-only against the shared
//                index). Their Cookbook, Spicerack and swipe history live in
//                their own browser. Nothing they do writes to D1.
//   The owner -> /api/db/* and /api/admin/*, gated by Cloudflare Access (or
//                OWNER_TOKEN). Personal tables in D1, plus the crawler controls.

import { matchRecipes } from "./match.js";
import { SOURCES } from "./crawl/sources.js";
import { ensureSources, refreshSource, staleSources, crawlBatch, renormalize, upsertStatements } from "./crawl/run.js";
import { resolveUnresolved } from "./crawl/llm.js";
import { DEFAULT_SPICERACK, CANONICAL_BY_ID } from "../shared/canonicals.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    try {
      if (pathname === "/api/me") return handleMe(request, env);
      if (pathname === "/api/match") return handleMatch(request, env);
      if (pathname === "/api/stats") return handleStats(env);
      if (pathname.startsWith("/api/db/")) return handleDb(request, env, url);
      if (pathname.startsWith("/api/admin/")) return handleAdmin(request, env, url);
      if (pathname === "/project.json") {
        // Copied into dist/ by the build; served with CORS for the portfolio index.
        const res = await env.ASSETS.fetch(request);
        return new Response(res.body, { status: res.status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      }
    } catch (err) {
      return json({ error: err?.message || "Unexpected error" }, 500);
    }
    return env.ASSETS.fetch(request);
  },

  // Cron: every 5 minutes crawl a small batch; on the weekly trigger refresh
  // a few sitemaps (bounded, so a run never exceeds the subrequest budget).
  async scheduled(event, env, ctx) {
    if (!env.DB) return;
    ctx.waitUntil(
      (async () => {
        await ensureSources(env.DB);
        if (event.cron === "17 3 * * 0") {
          for (const id of await staleSources(env.DB, { olderThanDays: 6, limit: 4 })) await refreshSource(env.DB, env, id);
        } else {
          const batch = parseInt(env.CRAWL_BATCH || "10", 10);
          const { results } = await env.DB.prepare("SELECT COUNT(*) AS n FROM crawl_queue").all();
          if (!results[0]?.n) {
            // Empty queue: pull one stale sitemap instead of idling.
            const [id] = await staleSources(env.DB, { olderThanDays: 3, limit: 1 });
            if (id) await refreshSource(env.DB, env, id, { maxChildren: 3, maxUrls: 1500 });
            return;
          }
          await crawlBatch(env.DB, env, { batch });
        }
      })(),
    );
  },
};

// --- Auth (identical policy to fitness-log) --------------------------------
function ownerEmail(request, env) {
  const accessEmail = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (accessEmail) return accessEmail;
  if (env.OWNER_TOKEN) {
    const auth = request.headers.get("Authorization") || "";
    if (auth.startsWith("Bearer ") && timingSafeEqual(auth.slice(7), env.OWNER_TOKEN)) return env.OWNER_EMAIL || "owner";
  }
  if (env.DEV_OWNER_EMAIL) return env.DEV_OWNER_EMAIL; // wrangler dev only
  return null;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function handleMe(request, env) {
  const email = ownerEmail(request, env);
  return json({ authenticated: Boolean(email), email: email || null, storage: email ? "cloud" : "local", indexed: Boolean(env.DB) });
}

// --- Public: match + stats --------------------------------------------------
const MAX_LIST = 200;

async function handleMatch(request, env) {
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!env.DB) return json({ error: "The recipe index is not available (D1 is not bound)." }, 503);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad JSON" }, 400);
  }
  const ids = (xs) => (Array.isArray(xs) ? xs : []).filter((x) => typeof x === "string" && CANONICAL_BY_ID[x]).slice(0, MAX_LIST);
  const strs = (xs, n = 10) => (Array.isArray(xs) ? xs : []).filter((x) => typeof x === "string").slice(0, n);
  const q = {
    have: ids(body.have),
    spicerack: ids(body.spicerack),
    diet: strs(body.diet),
    cuisine: strs(body.cuisine),
    macro: strs(body.macro),
    allowMissing: Boolean(body.allowMissing),
    maxMissing: clampInt(body.maxMissing, 0, 6, 3),
    count: clampInt(body.count, 1, 6, 3),
    exclude: strs(body.exclude, 2000),
    seed: clampInt(body.seed, 0, 2 ** 31, Math.floor(Math.random() * 2 ** 31)),
  };
  if (!q.have.length) return json({ error: "Tell me at least one ingredient you have." }, 400);
  const result = await matchRecipes(env.DB, q);
  return json(result);
}

async function handleStats(env) {
  if (!env.DB) return json({ recipes: 0, sources: 0 });
  const [recipes, sources] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n FROM recipes WHERE dead_at IS NULL").first(),
    env.DB.prepare("SELECT COUNT(DISTINCT source_id) AS n FROM recipes WHERE dead_at IS NULL").first(),
  ]);
  return json({ recipes: recipes?.n || 0, sources: sources?.n || 0 }, 200, { "Cache-Control": "public, max-age=300" });
}

// --- Owner data --------------------------------------------------------------
async function handleDb(request, env, url) {
  const user = ownerEmail(request, env);
  if (!user) return json({ error: "Not authenticated." }, 401);
  if (!env.DB) return json({ error: "D1 database is not bound." }, 500);
  const route = url.pathname.replace("/api/db/", "");
  const method = request.method;
  const now = new Date().toISOString();

  if (route === "spicerack") {
    if (method === "GET") {
      const { results } = await env.DB.prepare("SELECT canonical FROM spicerack WHERE user = ?").bind(user).all();
      // Never-touched owner gets the defaults, same as a visitor.
      const seeded = await env.DB.prepare("SELECT 1 FROM prefs WHERE user = ?").bind(user).first();
      return json({ items: seeded ? results.map((r) => r.canonical) : DEFAULT_SPICERACK });
    }
    if (method === "PUT") {
      const { items } = await request.json();
      const clean = [...new Set((items || []).filter((x) => CANONICAL_BY_ID[x]))];
      const stmts = [env.DB.prepare("DELETE FROM spicerack WHERE user = ?").bind(user)];
      for (const c of clean) stmts.push(env.DB.prepare("INSERT INTO spicerack (user, canonical) VALUES (?, ?)").bind(user, c));
      stmts.push(env.DB.prepare("INSERT INTO prefs (user, payload, updated_at) VALUES (?, '{}', ?) ON CONFLICT (user) DO UPDATE SET updated_at = excluded.updated_at").bind(user, now));
      for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100));
      return json({ ok: true, count: clean.length });
    }
  }

  if (route === "cookbook") {
    if (method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM cookbook WHERE user = ? ORDER BY saved_at DESC").bind(user).all();
      return json({ items: results.map((r) => ({ ...safeParse(r.snapshot), recipe_id: r.recipe_id, saved_at: r.saved_at, cooked_count: r.cooked_count, notes: r.notes })) });
    }
    if (method === "POST") {
      const card = await request.json();
      if (!card?.id) return json({ error: "id is required" }, 400);
      await env.DB.batch([
        env.DB.prepare("INSERT INTO cookbook (user, recipe_id, saved_at, snapshot) VALUES (?, ?, ?, ?) ON CONFLICT (user, recipe_id) DO UPDATE SET snapshot = excluded.snapshot").bind(user, card.id, now, JSON.stringify(card)),
        env.DB.prepare("INSERT OR REPLACE INTO swipes (user, recipe_id, direction, at) VALUES (?, ?, 'right', ?)").bind(user, card.id, now),
      ]);
      return json({ ok: true });
    }
    if (method === "PATCH") {
      const { id, cooked_count, notes } = await request.json();
      await env.DB.prepare("UPDATE cookbook SET cooked_count = COALESCE(?, cooked_count), notes = COALESCE(?, notes) WHERE user = ? AND recipe_id = ?").bind(cooked_count ?? null, notes ?? null, user, id).run();
      return json({ ok: true });
    }
    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      await env.DB.batch([
        env.DB.prepare("DELETE FROM cookbook WHERE user = ? AND recipe_id = ?").bind(user, id),
        env.DB.prepare("DELETE FROM swipes WHERE user = ? AND recipe_id = ?").bind(user, id),
      ]);
      return json({ ok: true });
    }
  }

  if (route === "swipes") {
    if (method === "GET") {
      const { results } = await env.DB.prepare("SELECT recipe_id, direction FROM swipes WHERE user = ?").bind(user).all();
      return json({ left: results.filter((r) => r.direction === "left").map((r) => r.recipe_id), right: results.filter((r) => r.direction === "right").map((r) => r.recipe_id) });
    }
    if (method === "POST") {
      const { id, direction } = await request.json();
      if (!id || !["left", "right"].includes(direction)) return json({ error: "id and direction are required" }, 400);
      await env.DB.prepare("INSERT OR REPLACE INTO swipes (user, recipe_id, direction, at) VALUES (?, ?, ?, ?)").bind(user, id, direction, now).run();
      return json({ ok: true });
    }
    if (method === "DELETE") {
      // "Forget my left swipes" — the only way a permanent no becomes a maybe.
      await env.DB.prepare("DELETE FROM swipes WHERE user = ? AND direction = 'left'").bind(user).run();
      return json({ ok: true });
    }
  }

  if (route === "prefs") {
    if (method === "GET") {
      const row = await env.DB.prepare("SELECT payload FROM prefs WHERE user = ?").bind(user).first();
      return json({ prefs: row ? safeParse(row.payload) : null });
    }
    if (method === "PUT") {
      const p = await request.json();
      await env.DB.prepare("INSERT INTO prefs (user, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT (user) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at").bind(user, JSON.stringify(p || {}), now).run();
      return json({ ok: true });
    }
  }

  if (route === "export" && method === "GET") {
    const [cookbook, spicerack, swipes] = await Promise.all([
      env.DB.prepare("SELECT * FROM cookbook WHERE user = ?").bind(user).all(),
      env.DB.prepare("SELECT canonical FROM spicerack WHERE user = ?").bind(user).all(),
      env.DB.prepare("SELECT recipe_id, direction, at FROM swipes WHERE user = ?").bind(user).all(),
    ]);
    return new Response(
      JSON.stringify({ exported_at: now, version: 1, cookbook: cookbook.results.map((r) => ({ ...r, snapshot: safeParse(r.snapshot) })), spicerack: spicerack.results.map((r) => r.canonical), swipes: swipes.results }, null, 2),
      { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="leftovers-${now.slice(0, 10)}.json"` } },
    );
  }

  return json({ error: "not found" }, 404);
}

// --- Owner: crawler controls ------------------------------------------------
async function handleAdmin(request, env, url) {
  const user = ownerEmail(request, env);
  if (!user) return json({ error: "Not authenticated." }, 401);
  if (!env.DB) return json({ error: "D1 database is not bound." }, 500);
  const route = url.pathname.replace("/api/admin/", "");
  const method = request.method;
  const body = method === "GET" ? {} : await request.json().catch(() => ({}));

  if (route === "status" && method === "GET") {
    await ensureSources(env.DB);
    const [sources, queue, unresolved, totals] = await Promise.all([
      env.DB.prepare("SELECT s.*, (SELECT COUNT(*) FROM crawl_queue q WHERE q.source_id = s.id) AS queued FROM sources s ORDER BY recipe_count DESC, name").all(),
      env.DB.prepare("SELECT COUNT(*) AS n, SUM(attempts >= 3) AS failed FROM crawl_queue").first(),
      env.DB.prepare("SELECT phrase, count FROM unresolved ORDER BY count DESC LIMIT 40").all(),
      env.DB.prepare("SELECT COUNT(*) AS recipes, SUM(unresolved_count > 0) AS partial, SUM(dead_at IS NOT NULL) AS dead FROM recipes").first(),
    ]);
    return json({ sources: sources.results, queue, unresolved: unresolved.results, totals, catalog: SOURCES.map((s) => ({ id: s.id, name: s.name, cuisine: s.cuisine || null })) });
  }
  if (route === "sitemaps" && method === "POST") {
    await ensureSources(env.DB);
    const ids = Array.isArray(body.sources) && body.sources.length ? body.sources : await staleSources(env.DB, { olderThanDays: 0, limit: 2 });
    const reports = [];
    for (const id of ids.slice(0, 3)) reports.push(await refreshSource(env.DB, env, id, { maxChildren: body.maxChildren ?? 6, maxUrls: body.maxUrls ?? 3000 }));
    return json({ reports });
  }
  if (route === "crawl" && method === "POST") {
    return json(await crawlBatch(env.DB, env, { batch: clampInt(body.batch, 1, 25, 10) }));
  }
  if (route === "resolve" && method === "POST") {
    return json(await resolveUnresolved(env.DB, env, { limit: clampInt(body.limit, 5, 120, 60) }));
  }
  if (route === "renormalize" && method === "POST") {
    return json(await renormalize(env.DB, { limit: clampInt(body.limit, 10, 500, 200) }));
  }
  if (route === "synonym" && method === "PUT") {
    const phrase = String(body.phrase || "").trim().toLowerCase();
    const canonical = body.canonical == null ? null : String(body.canonical);
    if (!phrase) return json({ error: "phrase is required" }, 400);
    if (canonical && !CANONICAL_BY_ID[canonical]) return json({ error: "unknown canonical" }, 400);
    await env.DB.batch([
      env.DB.prepare("INSERT OR REPLACE INTO synonym_overrides (phrase, canonical, source, created_at) VALUES (?, ?, 'manual', ?)").bind(phrase, canonical, new Date().toISOString()),
      env.DB.prepare("DELETE FROM unresolved WHERE phrase = ?").bind(phrase),
    ]);
    return json({ ok: true });
  }
  // Bulk import from scripts/crawl.mjs: [{row, ingredients, unresolved}, ...]
  if (route === "import" && method === "POST") {
    const records = Array.isArray(body.records) ? body.records : [];
    let stored = 0;
    const counts = new Map();
    for (const rec of records.slice(0, 100)) {
      if (!rec?.row?.url || !rec.row.id || !Array.isArray(rec.ingredients)) continue;
      await env.DB.batch(upsertStatements(env.DB, { row: rec.row, ingredients: rec.ingredients, unresolved: rec.unresolved || [] }));
      counts.set(rec.row.source_id, (counts.get(rec.row.source_id) || 0) + 1);
      stored++;
    }
    await ensureSources(env.DB);
    if (counts.size) await env.DB.batch([...counts].map(([id, n]) => env.DB.prepare("UPDATE sources SET recipe_count = (SELECT COUNT(*) FROM recipes WHERE source_id = ? AND dead_at IS NULL) WHERE id = ?").bind(id, id)));
    return json({ ok: true, stored });
  }
  return json({ error: "not found" }, 404);
}

// --- helpers -----------------------------------------------------------------
function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...extra } });
}
function clampInt(v, lo, hi, dflt) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
}
function safeParse(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}
