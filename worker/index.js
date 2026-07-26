// One Worker: serves the SPA, proxies the LLM (the key stays server-side), and
// owns the D1 database.
//
// Two classes of user, deliberately:
//
//   Visitors  -> /api/parse only. Their log lives in their own browser's
//                localStorage and never reaches this Worker. Costs nothing to
//                host, cannot be abused into filling a database, and still
//                gives the full experience for a portfolio visit.
//   The owner -> /api/db/*, gated by Cloudflare Access. Years of real entries
//                in D1, where range queries and aggregation are cheap.
//
// KV appears here only for per-IP rate-limit counters, which is what KV is
// actually good at: small values with a TTL. The log itself would be a bad fit
// (read-modify-write on a growing blob, ~1 write/sec per key, no queries).

import Anthropic from "@anthropic-ai/sdk";
import { PARSE_SCHEMA, SYSTEM_PROMPT } from "./parse-schema.js";
import project from "../project.json";

import { MODEL, modelRequestOptions } from "./models.js";

const MAX_INPUT_CHARS = 2000;
const MAX_PARSES_PER_DAY = 40; // per IP, for anonymous visitors

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      if (pathname === "/api/me") return handleMe(request, env);
      if (pathname === "/api/parse") return handleParse(request, env);
      if (pathname.startsWith("/api/db/")) return handleDb(request, env, url);

      if (pathname === "/project.json") {
        return new Response(JSON.stringify(project), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    } catch (err) {
      return json({ error: err?.message || "Unexpected error" }, 500);
    }

    return env.ASSETS.fetch(request);
  },
};

// --- Auth -------------------------------------------------------------------
// Cloudflare Access sits in front of /api/db/* only, so the app itself stays
// public. Access verifies the JWT at the edge and injects the email header;
// by the time a request reaches this Worker on that path it is already trusted.
//
// OWNER_TOKEN is the escape hatch for anyone who would rather not configure
// Access — set it as a Worker secret and send `Authorization: Bearer <token>`.
function ownerEmail(request, env) {
  const accessEmail = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (accessEmail) return accessEmail;

  if (env.OWNER_TOKEN) {
    const auth = request.headers.get("Authorization") || "";
    if (auth.startsWith("Bearer ") && timingSafeEqual(auth.slice(7), env.OWNER_TOKEN)) {
      return env.OWNER_EMAIL || "owner";
    }
  }

  // `wrangler dev` has no Access in front of it. This is only ever set locally.
  if (env.DEV_OWNER_EMAIL) return env.DEV_OWNER_EMAIL;

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
  return json({
    authenticated: Boolean(email),
    email: email || null,
    storage: email ? "cloud" : "local",
  });
}

// --- LLM proxy --------------------------------------------------------------
async function handleParse(request, env) {
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "ANTHROPIC_API_KEY is not configured on the Worker" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad JSON" }, 400);
  }

  const text = String(body?.text || "").trim();
  if (!text) return json({ error: "text is required" }, 400);
  if (text.length > MAX_INPUT_CHARS) {
    return json({ error: `Entry is too long (max ${MAX_INPUT_CHARS} characters).` }, 400);
  }

  // The owner is not rate limited; anonymous visitors are. This endpoint is the
  // only one that costs money, so it is the only one that needs a throttle.
  if (!ownerEmail(request, env) && env.RATE_KV) {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const day = new Date().toISOString().slice(0, 10);
    const key = `rl:${ip}:${day}`;
    const used = parseInt((await env.RATE_KV.get(key)) || "0", 10);
    if (used >= MAX_PARSES_PER_DAY) {
      return json({ error: "Daily parse limit reached — try again tomorrow." }, 429);
    }
    await env.RATE_KV.put(key, String(used + 1), { expirationTtl: 172800 });
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const { max_tokens, ...outputOptions } = modelRequestOptions();

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens,
      system: SYSTEM_PROMPT,
      output_config: {
        ...outputOptions,
        format: { type: "json_schema", schema: PARSE_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: `Today is ${body?.today || new Date().toISOString().slice(0, 10)}.\n\nEntry:\n${text}`,
        },
      ],
    });
  } catch (err) {
    return json({ error: `Model request failed: ${err?.message || "unknown"}` }, 502);
  }

  // Safety classifiers can decline with a normal 200 — check before reading content.
  if (response.stop_reason === "refusal") {
    return json({ error: "That entry could not be processed." }, 422);
  }
  if (response.stop_reason === "max_tokens") {
    return json({ error: "The entry was too complex to parse. Try splitting it up." }, 422);
  }

  const block = response.content.find((b) => b.type === "text");
  if (!block) return json({ error: "Empty response from the model." }, 502);

  let parsed;
  try {
    parsed = JSON.parse(block.text);
  } catch {
    return json({ error: "Model returned malformed JSON." }, 502);
  }

  return json({
    ...parsed,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  });
}

// --- Owner data (D1) --------------------------------------------------------
async function handleDb(request, env, url) {
  const user = ownerEmail(request, env);
  if (!user) return json({ error: "Not authenticated." }, 401);
  if (!env.DB) return json({ error: "D1 database is not bound." }, 500);

  const route = url.pathname.replace("/api/db/", "");
  const method = request.method;

  // --- entries ---
  if (route === "entries") {
    if (method === "GET") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      // The composite index on (user, date) makes this a range scan, which is
      // the entire reason this lives in SQL rather than a JSON blob.
      const stmt =
        from && to
          ? env.DB.prepare(
              "SELECT * FROM entries WHERE user = ? AND date >= ? AND date <= ? ORDER BY date, created_at",
            ).bind(user, from, to)
          : env.DB.prepare(
              "SELECT * FROM entries WHERE user = ? ORDER BY date DESC, created_at DESC LIMIT 500",
            ).bind(user);
      const { results } = await stmt.all();
      return json({ entries: results.map(rowToEntry) });
    }

    if (method === "POST") {
      const entry = await request.json();
      await insertEntry(env.DB, user, entry);
      return json({ ok: true, id: entry.id });
    }

    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "id is required" }, 400);
      await env.DB.prepare("DELETE FROM entries WHERE user = ? AND id = ?").bind(user, id).run();
      return json({ ok: true });
    }
  }

  // Daily rollups computed in SQL. Pulling 90 days of rows to the browser just
  // to sum them would work today and stop working in a few years.
  if (route === "summary" && method === "GET") {
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) return json({ error: "from and to are required" }, 400);

    const { results } = await env.DB.prepare(
      `SELECT date,
              SUM(CASE WHEN kind = 'meal'     THEN kcal      ELSE 0 END) AS eaten,
              SUM(CASE WHEN kind = 'exercise' THEN kcal      ELSE 0 END) AS burned,
              SUM(CASE WHEN kind = 'meal'     THEN protein_g ELSE 0 END) AS protein_g,
              SUM(CASE WHEN kind = 'meal'     THEN carb_g    ELSE 0 END) AS carb_g,
              SUM(CASE WHEN kind = 'meal'     THEN fat_g     ELSE 0 END) AS fat_g,
              SUM(COALESCE(duration_min, 0))                             AS duration_min,
              SUM(COALESCE(distance_mi, 0))                              AS distance_mi,
              SUM(COALESCE(elev_ft, 0))                                  AS elev_ft,
              MAX(CASE WHEN kind = 'weight'   THEN weight_lb ELSE NULL END) AS weight_lb,
              SUM(CASE WHEN kind = 'meal'     THEN 1 ELSE 0 END)          AS mealCount,
              SUM(CASE WHEN kind = 'exercise' THEN 1 ELSE 0 END)          AS exerciseCount
         FROM entries
        WHERE user = ? AND date >= ? AND date <= ?
        GROUP BY date
        ORDER BY date`,
    )
      .bind(user, from, to)
      .all();

    return json({ days: results });
  }

  // --- templates ---
  if (route === "templates") {
    if (method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM templates WHERE user = ? ORDER BY name",
      )
        .bind(user)
        .all();
      return json({
        templates: results.map((r) => ({ ...r, payload: safeParse(r.payload) })),
      });
    }

    if (method === "POST") {
      const t = await request.json();
      await env.DB.prepare(
        `INSERT INTO templates (id, user, kind, name, payload, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (user, kind, name) DO UPDATE SET payload = excluded.payload`,
      )
        .bind(
          t.id || crypto.randomUUID(),
          user,
          t.kind,
          t.name,
          JSON.stringify(t.payload),
          new Date().toISOString(),
        )
        .run();
      return json({ ok: true });
    }

    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      await env.DB.prepare("DELETE FROM templates WHERE user = ? AND id = ?").bind(user, id).run();
      return json({ ok: true });
    }
  }

  // --- profile ---
  if (route === "profile") {
    if (method === "GET") {
      const row = await env.DB.prepare("SELECT * FROM profile WHERE user = ?").bind(user).first();
      return json({ profile: row ? { ...row, targets: safeParse(row.targets) } : null });
    }

    if (method === "PUT") {
      const p = await request.json();
      await env.DB.prepare(
        `INSERT INTO profile (user, sex, age, height_in, weight_lb, activity_factor,
                              goal_rate_lb_wk, protein_g_per_lb, fat_pct, targets, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user) DO UPDATE SET
           sex = excluded.sex, age = excluded.age, height_in = excluded.height_in,
           weight_lb = excluded.weight_lb, activity_factor = excluded.activity_factor,
           goal_rate_lb_wk = excluded.goal_rate_lb_wk,
           protein_g_per_lb = excluded.protein_g_per_lb, fat_pct = excluded.fat_pct,
           targets = excluded.targets, updated_at = excluded.updated_at`,
      )
        .bind(
          user, p.sex, p.age, p.height_in, p.weight_lb, p.activity_factor,
          p.goal_rate_lb_wk, p.protein_g_per_lb, p.fat_pct,
          JSON.stringify(p.targets || {}), new Date().toISOString(),
        )
        .run();
      return json({ ok: true });
    }
  }

  // --- export / import ---
  // Your corpus should never be hostage to this app or to Cloudflare.
  if (route === "export" && method === "GET") {
    const [entries, templates, profile] = await Promise.all([
      env.DB.prepare("SELECT * FROM entries WHERE user = ? ORDER BY date").bind(user).all(),
      env.DB.prepare("SELECT * FROM templates WHERE user = ?").bind(user).all(),
      env.DB.prepare("SELECT * FROM profile WHERE user = ?").bind(user).first(),
    ]);
    return new Response(
      JSON.stringify(
        {
          exported_at: new Date().toISOString(),
          version: 1,
          entries: entries.results.map(rowToEntry),
          templates: templates.results.map((r) => ({ ...r, payload: safeParse(r.payload) })),
          profile: profile ? { ...profile, targets: safeParse(profile.targets) } : null,
        },
        null,
        2,
      ),
      {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="fitness-log-${new Date()
            .toISOString()
            .slice(0, 10)}.json"`,
        },
      },
    );
  }

  if (route === "import" && method === "POST") {
    const payload = await request.json();
    const entries = Array.isArray(payload?.entries) ? payload.entries : [];
    // D1 batches run in a single transaction, so a malformed file cannot leave
    // the log half-imported.
    const stmts = entries.map((e) => insertStatement(env.DB, user, e));
    for (let i = 0; i < stmts.length; i += 100) {
      await env.DB.batch(stmts.slice(i, i + 100));
    }
    return json({ ok: true, imported: entries.length });
  }

  return json({ error: "not found" }, 404);
}

function insertStatement(db, user, entry) {
  return db
    .prepare(
      `INSERT INTO entries (id, user, date, kind, name, kcal, protein_g, carb_g, fat_g, slot,
                            activity, distance_mi, duration_min, elev_ft, weight_lb,
                            raw_text, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         date = excluded.date, name = excluded.name, kcal = excluded.kcal,
         protein_g = excluded.protein_g, carb_g = excluded.carb_g, fat_g = excluded.fat_g,
         slot = excluded.slot, activity = excluded.activity,
         distance_mi = excluded.distance_mi, duration_min = excluded.duration_min,
         elev_ft = excluded.elev_ft, weight_lb = excluded.weight_lb,
         detail = excluded.detail`,
    )
    .bind(
      entry.id || crypto.randomUUID(),
      user,
      entry.date,
      entry.kind,
      entry.name || "",
      nz(entry.kcal), nz(entry.protein_g), nz(entry.carb_g), nz(entry.fat_g),
      entry.slot ?? null,
      entry.activity ?? null,
      nz(entry.distance_mi), nz(entry.duration_min), nz(entry.elev_ft), nz(entry.weight_lb),
      entry.raw_text ?? null,
      JSON.stringify(entry.detail ?? entry.ingredients ?? null),
      entry.created_at || new Date().toISOString(),
    );
}

async function insertEntry(db, user, entry) {
  await insertStatement(db, user, entry).run();
}

function rowToEntry(row) {
  const detail = safeParse(row.detail);
  return {
    ...row,
    detail,
    ingredients: Array.isArray(detail) ? detail : (detail?.ingredients ?? null),
  };
}

function safeParse(s) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function nz(v) {
  return Number.isFinite(Number(v)) ? Number(v) : null;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
