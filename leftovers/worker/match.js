// The match query. Two steps:
//   1. SQL narrows ~50k recipes to ~150 candidates that (a) use at least one
//      ingredient the user actually typed, (b) pass the diet filters, and
//      (c) are missing at most `maxMissing` non-optional ingredients once the
//      Spicerack is counted.
//   2. shared/rank.js scores, diversifies and deals from those in JS, where
//      the policy is unit-tested.
//
// D1 caps bound parameters at 100, so every list goes in as one JSON string
// and is expanded with json_each.

import { deal } from "../shared/rank.js";

const CANDIDATE_LIMIT = 160;

export async function matchRecipes(db, q) {
  const have = [...new Set([...(q.have || []), ...(q.spicerack || [])])];
  const typed = [...new Set(q.have || [])];
  if (!typed.length) return { recipes: [], degraded: false, poolSize: 0 };
  const diet = (q.diet || []).slice(0, 5);
  const exclude = [...new Set(q.exclude || [])];
  const maxMissing = q.allowMissing ? Math.min(q.maxMissing ?? 3, 6) : 0;
  // Always fetch with the relaxed threshold so deal() can degrade gracefully
  // without a second round trip; strictness is applied in JS.
  const fetchMissing = Math.max(maxMissing, q.maxMissing ?? 3);

  const dietSql = diet.map(() => "AND EXISTS (SELECT 1 FROM json_each(r.diet_tags) WHERE value = ?)").join(" ");
  const sql = `
    WITH have(c) AS (SELECT value FROM json_each(?)),
         typed(c) AS (SELECT value FROM json_each(?)),
         cand AS (SELECT DISTINCT recipe_id FROM recipe_ingredients WHERE canonical IN (SELECT c FROM typed))
    SELECT r.id, r.title, r.url, r.image_url, r.yield_servings, r.yield_text, r.cuisine,
           r.total_minutes, r.diet_tags, r.macro_tags, r.macro_source, r.source_id, r.rating,
           SUM(CASE WHEN ri.optional = 0 THEN 1 ELSE 0 END) AS required_n,
           SUM(CASE WHEN ri.optional = 0 AND ri.canonical IN (SELECT c FROM have) THEN 1 ELSE 0 END) AS matched_n
      FROM recipes r
      JOIN recipe_ingredients ri ON ri.recipe_id = r.id
     WHERE r.id IN (SELECT recipe_id FROM cand)
       AND r.dead_at IS NULL
       AND r.id NOT IN (SELECT value FROM json_each(?))
       ${dietSql}
     GROUP BY r.id
    HAVING required_n > 0 AND required_n - matched_n <= ?
     ORDER BY (matched_n * 1.0 / required_n) DESC, (required_n - matched_n) ASC, RANDOM()
     LIMIT ?`;
  const { results } = await db
    .prepare(sql)
    .bind(JSON.stringify(have), JSON.stringify(typed), JSON.stringify(exclude), ...diet, fetchMissing, CANDIDATE_LIMIT)
    .all();
  if (!results.length) return { recipes: [], degraded: false, poolSize: 0 };

  const ids = results.map((r) => r.id);
  const { results: ings } = await db
    .prepare("SELECT recipe_id, canonical, optional FROM recipe_ingredients WHERE recipe_id IN (SELECT value FROM json_each(?))")
    .bind(JSON.stringify(ids))
    .all();
  const byId = new Map(results.map((r) => [r.id, { ...r, diet_tags: safe(r.diet_tags), macro_tags: safe(r.macro_tags), ingredients: [] }]));
  for (const i of ings) byId.get(i.recipe_id)?.ingredients.push({ canonical: i.canonical, optional: !!i.optional });

  const { hand, degraded, poolSize } = deal([...byId.values()], {
    have: new Set(have),
    cuisine: q.cuisine || [],
    macro: q.macro || [],
    allowMissing: !!q.allowMissing,
    maxMissing: q.maxMissing ?? 3,
    count: Math.min(Math.max(q.count || 3, 1), 6),
    seed: q.seed,
  });
  return {
    recipes: hand.map((r) => ({
      id: r.id, title: r.title, url: r.url, image_url: r.image_url, source_id: r.source_id,
      yield_servings: r.yield_servings, yield_text: r.yield_text, total_minutes: r.total_minutes,
      cuisine: r.cuisine, diet_tags: r.diet_tags, macro_tags: r.macro_tags, macro_source: r.macro_source,
      rating: r.rating, ingredients: r.ingredients, matched: r.matched, missing: r.missing,
      coverage: Math.round(r.coverage * 100) / 100, hero: r.hero,
    })),
    degraded,
    poolSize,
  };
}

const safe = (s) => {
  try {
    return JSON.parse(s || "[]");
  } catch {
    return [];
  }
};
