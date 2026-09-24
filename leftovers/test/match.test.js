// Runs the real match SQL against an in-process SQLite (node:sqlite) behind a
// tiny D1-shaped shim, so the query is tested for what it returns rather than
// for whether it parses. Skips cleanly on Node builds without node:sqlite.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let DatabaseSync;
try {
  ({ DatabaseSync } = await import("node:sqlite"));
} catch {
  DatabaseSync = null;
}

function d1(db) {
  const wrap = (sql) => ({
    bind: (...params) => wrap2(sql, params),
    all: () => wrap2(sql, []).all(),
    first: () => wrap2(sql, []).first(),
    run: () => wrap2(sql, []).run(),
  });
  const wrap2 = (sql, params) => ({
    sql, params,
    async all() { return { results: db.prepare(sql).all(...params) }; },
    async first() { return db.prepare(sql).get(...params) ?? null; },
    async run() { const r = db.prepare(sql).run(...params); return { meta: { changes: r.changes } }; },
  });
  return {
    prepare: wrap,
    async batch(stmts) { return Promise.all(stmts.map((s) => s.run())); },
  };
}

const { matchRecipes } = await import("../worker/match.js");
const { upsertStatements } = await import("../worker/crawl/run.js");
const { buildRecipeRecord } = await import("../worker/crawl/recipe.js");

const mk = (url, name, lines, extra = {}) =>
  buildRecipeRecord({ name, recipeIngredient: lines, recipeYield: "4", ...extra }, { url, source: null });

test("match query: strict vs relaxed, diet filter, exclusions, typed-ingredient anchor", { skip: !DatabaseSync && "node:sqlite unavailable" }, async () => {
  const raw = new DatabaseSync(":memory:");
  raw.exec(readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8"));
  const db = d1(raw);

  const recipes = [
    mk("https://a/1", "Garlic Chicken Rice", ["1 lb chicken thighs", "2 cups rice", "3 cloves garlic", "2 tbsp olive oil", "salt"]),
    mk("https://a/2", "Chicken Lime Tacos", ["1 lb chicken breast", "8 corn tortillas", "juice of 2 limes", "1 bunch cilantro", "salt"]),
    mk("https://a/3", "Tofu Fried Rice", ["1 block firm tofu", "2 cups cooked rice", "2 eggs", "2 tbsp soy sauce", "2 green onions"], { keywords: "vegetarian" }),
    mk("https://a/4", "Beef Stew", ["2 lb beef chuck", "4 carrots", "2 potatoes", "4 cups beef broth", "1 onion"]),
    mk("https://a/5", "Chickpea Curry", ["2 cans chickpeas", "1 can coconut milk", "1 onion", "2 tbsp curry powder", "1 cup rice"], { keywords: "vegan" }),
  ];
  for (const r of recipes) {
    assert.ok(!r.skip, r.skip);
    await db.batch(upsertStatements(db, r));
  }
  const spicerack = ["salt", "olive-oil", "garlic", "soy-sauce", "onion", "curry-powder", "broth"];

  // Strict: chicken + rice + egg. Only Garlic Chicken Rice is fully covered.
  const strict = await matchRecipes(db, { have: ["chicken", "rice", "egg"], spicerack, allowMissing: false, maxMissing: 3, count: 3, seed: 1 });
  assert.equal(strict.recipes[0].title, "Garlic Chicken Rice");
  assert.deepEqual(strict.recipes[0].missing, []);
  assert.equal(strict.degraded, true, "hand could not be filled strictly, so it degrades visibly");
  assert.ok(strict.recipes.length >= 2);

  // Relaxed: tofu fried rice needs tofu + green onion (2 missing) and is dealt.
  const relaxed = await matchRecipes(db, { have: ["chicken", "rice", "egg"], spicerack, allowMissing: true, maxMissing: 3, count: 3, seed: 1 });
  assert.equal(relaxed.degraded, false);
  const titles = relaxed.recipes.map((r) => r.title);
  assert.ok(titles.includes("Garlic Chicken Rice"));
  assert.ok(titles.includes("Tofu Fried Rice"));
  assert.ok(!titles.includes("Beef Stew"), "beef stew shares no typed ingredient and must not be anchored in");
  // Diversity: two chicken recipes must not both be dealt while a tofu one fits.
  const heroes = relaxed.recipes.map((r) => r.hero);
  assert.equal(new Set(heroes).size, heroes.length, `heroes should be distinct: ${heroes}`);

  // Diet filter is a hard filter.
  const vegan = await matchRecipes(db, { have: ["rice", "chickpea"], spicerack, diet: ["vegan"], allowMissing: true, maxMissing: 3, count: 3, seed: 1 });
  assert.deepEqual(vegan.recipes.map((r) => r.title), ["Chickpea Curry"]);
  assert.deepEqual(vegan.recipes[0].missing, ["coconut-milk"]);

  // Exclusions (left swipes / cookbook) are honoured.
  const excluded = await matchRecipes(db, { have: ["chicken", "rice"], spicerack, allowMissing: true, maxMissing: 3, count: 3, seed: 1, exclude: [strict.recipes[0].id] });
  assert.ok(!excluded.recipes.some((r) => r.id === strict.recipes[0].id));

  // No typed ingredients -> nothing, never "everything".
  const none = await matchRecipes(db, { have: [], spicerack, allowMissing: true, maxMissing: 3, count: 3 });
  assert.deepEqual(none.recipes, []);
});
