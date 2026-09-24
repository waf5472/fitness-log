// The crawl loop, shared by the Worker cron and the admin endpoints. Node's
// bulk script (scripts/crawl.mjs) reuses the parsers but not this file,
// because it talks to the API rather than to D1 directly.
//
// Politeness is not optional: robots.txt is honoured per fetch, we identify
// ourselves, we never fetch the same URL more than once a month, and a source
// that keeps erroring is left alone until someone looks at it.

import { SOURCES, SOURCE_BY_ID } from "./sources.js";
import { parseSitemap, pickChildSitemaps } from "./sitemap.js";
import { extractRecipe } from "./jsonld.js";
import { buildRecipeRecord } from "./recipe.js";
import { robotsAllows } from "./robots.js";

const FETCH_TIMEOUT_MS = 12000;
const MAX_ATTEMPTS = 3;

export function userAgent(env) {
  return env.CRAWL_USER_AGENT || "leftovers-crawler/0.1 (+https://leftovers.wesley-fletcher.com)";
}

async function fetchText(url, env, accept = "text/html") {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": userAgent(env), Accept: accept, "Accept-Language": "en" },
      redirect: "follow",
      signal: ctl.signal,
    });
    const text = res.ok ? await res.text() : "";
    return { status: res.status, text, finalUrl: res.url || url };
  } finally {
    clearTimeout(t);
  }
}

const robotsCache = new Map(); // origin -> text (per isolate; fine)
async function allowed(url, env) {
  const u = new URL(url);
  if (!robotsCache.has(u.origin)) {
    try {
      const r = await fetchText(`${u.origin}/robots.txt`, env, "text/plain");
      robotsCache.set(u.origin, r.status === 200 ? r.text : "");
    } catch {
      robotsCache.set(u.origin, "");
    }
  }
  return robotsAllows(robotsCache.get(u.origin), u.pathname + u.search);
}

/** Make sure every source has a row; cheap and idempotent. */
export async function ensureSources(db) {
  await db.batch(
    SOURCES.map((s) =>
      db.prepare("INSERT INTO sources (id, name) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET name = excluded.name").bind(s.id, s.name),
    ),
  );
}

/**
 * Read one source's sitemap(s) and queue recipe URLs we have not stored.
 * `maxChildren` bounds subrequests on the Worker; the Node script passes Infinity.
 */
export async function refreshSource(db, env, sourceId, { maxChildren = 8, maxUrls = 5000 } = {}) {
  const source = SOURCE_BY_ID[sourceId];
  if (!source) throw new Error(`unknown source ${sourceId}`);
  const now = new Date().toISOString();
  const report = { source: sourceId, sitemaps: 0, seen: 0, queued: 0, error: null };
  try {
    if (!(await allowed(source.sitemap, env))) {
      await db.prepare("UPDATE sources SET robots_ok = 0, last_error = ?, sitemap_at = ? WHERE id = ?").bind("robots.txt disallows", now, sourceId).run();
      report.error = "robots.txt disallows";
      return report;
    }
    const top = await fetchText(source.sitemap, env, "application/xml");
    if (top.status !== 200) throw new Error(`sitemap HTTP ${top.status}`);
    let parsed = parseSitemap(top.text);
    report.sitemaps = 1;
    let entries = [];
    if (parsed.kind === "index") {
      const children = pickChildSitemaps(parsed.entries).slice(0, maxChildren);
      for (const child of children) {
        try {
          const r = await fetchText(child, env, "application/xml");
          if (r.status !== 200) continue;
          report.sitemaps++;
          entries.push(...parseSitemap(r.text).entries);
        } catch {
          /* one bad child sitemap should not sink the source */
        }
        if (entries.length >= maxUrls) break;
      }
    } else {
      entries = parsed.entries;
    }
    const recipeUrls = entries.filter((e) => source.match.test(e.loc)).slice(0, maxUrls);
    report.seen = recipeUrls.length;
    // Queue anything not already stored. D1 caps bound params at 100, so go in
    // chunks and let the UNIQUE constraint do the de-duplication.
    for (let i = 0; i < recipeUrls.length; i += 50) {
      const chunk = recipeUrls.slice(i, i + 50);
      const res = await db.batch(
        chunk.map((e) =>
          db
            .prepare(
              `INSERT OR IGNORE INTO crawl_queue (url, source_id, lastmod, queued_at)
               SELECT ?1, ?2, ?3, ?4 WHERE NOT EXISTS (SELECT 1 FROM recipes WHERE url = ?1)`,
            )
            .bind(e.loc, sourceId, e.lastmod, now),
        ),
      );
      report.queued += res.reduce((n, r) => n + (r.meta?.changes || 0), 0);
    }
    await db.prepare("UPDATE sources SET sitemap_at = ?, last_error = NULL WHERE id = ?").bind(now, sourceId).run();
  } catch (err) {
    report.error = err?.message || String(err);
    await db.prepare("UPDATE sources SET error_count = error_count + 1, last_error = ? WHERE id = ?").bind(report.error, sourceId).run();
  }
  return report;
}

/** Sources due for a sitemap refresh, oldest first. */
export async function staleSources(db, { olderThanDays = 7, limit = 4 } = {}) {
  const cutoff = new Date(Date.now() - olderThanDays * 86400000).toISOString();
  const { results } = await db
    .prepare("SELECT id FROM sources WHERE robots_ok = 1 AND (sitemap_at IS NULL OR sitemap_at < ?) ORDER BY sitemap_at IS NOT NULL, sitemap_at LIMIT ?")
    .bind(cutoff, limit)
    .all();
  return results.map((r) => r.id);
}

export async function loadOverrides(db) {
  const { results } = await db.prepare("SELECT phrase, canonical FROM synonym_overrides").all();
  return new Map(results.map((r) => [r.phrase, r.canonical]));
}

/** Statements that upsert one built record. Callers wrap them in db.batch(). */
export function upsertStatements(db, record) {
  const { row, ingredients, unresolved } = record;
  const cols = Object.keys(row);
  const stmts = [
    db
      .prepare(
        `INSERT INTO recipes (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})
         ON CONFLICT (url) DO UPDATE SET ${cols.filter((c) => c !== "id" && c !== "url").map((c) => `${c} = excluded.${c}`).join(", ")}, dead_at = NULL`,
      )
      .bind(...cols.map((c) => row[c])),
    db.prepare("DELETE FROM recipe_ingredients WHERE recipe_id = ?").bind(row.id),
    ...ingredients.map((i) =>
      db.prepare("INSERT OR REPLACE INTO recipe_ingredients (recipe_id, canonical, optional) VALUES (?, ?, ?)").bind(row.id, i.canonical, i.optional ? 1 : 0),
    ),
    ...unresolved.slice(0, 20).map((p) =>
      db
        .prepare(
          `INSERT INTO unresolved (phrase, count, example_id, first_seen) VALUES (?, 1, ?, ?)
           ON CONFLICT (phrase) DO UPDATE SET count = count + 1`,
        )
        .bind(p, row.id, row.crawled_at),
    ),
    db.prepare("DELETE FROM crawl_queue WHERE url = ?").bind(row.url),
  ];
  return stmts;
}

/** Fetch and store up to `batch` queued URLs. Returns a small report. */
export async function crawlBatch(db, env, { batch = 10 } = {}) {
  const overrides = await loadOverrides(db);
  // RANDOM() spreads a batch across sources for free and keeps one slow host
  // from monopolising the queue. Sources with robots_ok = 0 never surface.
  const { results: queue } = await db
    .prepare(
      `SELECT q.url, q.source_id, q.attempts FROM crawl_queue q
         JOIN sources s ON s.id = q.source_id
        WHERE q.attempts < ? AND s.robots_ok = 1
        ORDER BY RANDOM() LIMIT ?`,
    )
    .bind(MAX_ATTEMPTS, batch)
    .all();
  const report = { attempted: queue.length, stored: 0, skipped: 0, dead: 0, errors: 0, details: [] };
  const counts = new Map();
  for (const item of queue) {
    const source = SOURCE_BY_ID[item.source_id];
    try {
      if (!(await allowed(item.url, env))) {
        await db.prepare("DELETE FROM crawl_queue WHERE url = ?").bind(item.url).run();
        report.skipped++;
        continue;
      }
      const res = await fetchText(item.url, env);
      if (res.status === 404 || res.status === 410) {
        await db.batch([
          db.prepare("DELETE FROM crawl_queue WHERE url = ?").bind(item.url),
          db.prepare("UPDATE recipes SET dead_at = ? WHERE url = ?").bind(new Date().toISOString(), item.url),
        ]);
        report.dead++;
        continue;
      }
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const recipe = extractRecipe(res.text);
      if (!recipe) {
        await db.prepare("DELETE FROM crawl_queue WHERE url = ?").bind(item.url).run();
        report.skipped++;
        report.details.push({ url: item.url, skip: "no Recipe JSON-LD" });
        continue;
      }
      const built = buildRecipeRecord(recipe, { url: item.url, source, overrides });
      if (built.skip) {
        await db.prepare("DELETE FROM crawl_queue WHERE url = ?").bind(item.url).run();
        report.skipped++;
        report.details.push({ url: item.url, skip: built.skip });
        continue;
      }
      await db.batch(upsertStatements(db, built));
      counts.set(item.source_id, (counts.get(item.source_id) || 0) + 1);
      report.stored++;
    } catch (err) {
      report.errors++;
      await db
        .prepare("UPDATE crawl_queue SET attempts = attempts + 1, last_error = ? WHERE url = ?")
        .bind(String(err?.message || err).slice(0, 200), item.url)
        .run();
    }
  }
  if (counts.size) {
    await db.batch(
      [...counts].map(([id, n]) => db.prepare("UPDATE sources SET recipe_count = recipe_count + ? WHERE id = ?").bind(n, id)),
    );
  }
  return report;
}

/**
 * Re-run normalization over stored raw lines, for recipes that had unresolved
 * ingredients, after the synonym table grew. No network.
 */
export async function renormalize(db, { limit = 200 } = {}) {
  const overrides = await loadOverrides(db);
  const { results } = await db
    .prepare("SELECT id, url, source_id, raw_ingredients, title, image_url, yield_text, cuisine, total_minutes, nutrition_json, rating, rating_count FROM recipes WHERE unresolved_count > 0 AND dead_at IS NULL ORDER BY unresolved_count DESC LIMIT ?")
    .bind(limit)
    .all();
  let improved = 0;
  for (const r of results) {
    const lines = safeParse(r.raw_ingredients) || [];
    const fake = {
      name: r.title, image: r.image_url, recipeYield: r.yield_text, recipeCuisine: r.cuisine,
      totalTime: r.total_minutes ? `PT${r.total_minutes}M` : null,
      nutrition: safeParse(r.nutrition_json), recipeIngredient: lines,
      aggregateRating: r.rating != null ? { ratingValue: r.rating, ratingCount: r.rating_count } : undefined,
    };
    const built = buildRecipeRecord(fake, { url: r.url, source: SOURCE_BY_ID[r.source_id], overrides });
    if (built.skip) continue;
    // Keep the original crawl time; this is a re-read, not a re-fetch.
    const { crawled_at, ...rest } = built.row;
    await db.batch(upsertStatements(db, { ...built, row: { ...rest, crawled_at: crawled_at } }));
    improved++;
  }
  return { checked: results.length, rewritten: improved };
}

const safeParse = (s) => {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};
