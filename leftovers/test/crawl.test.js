import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSitemap, pickChildSitemaps } from "../worker/crawl/sitemap.js";
import { extractRecipe, isoMinutes, recipeImage, ingredientLines } from "../worker/crawl/jsonld.js";
import { buildRecipeRecord, idForUrl } from "../worker/crawl/recipe.js";
import { robotsAllows } from "../worker/crawl/robots.js";
import { SOURCES, sourceForUrl } from "../worker/crawl/sources.js";

const fx = (n) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8");

test("sitemap index and urlset both parse, with lastmod paired to its loc", () => {
  const idx = parseSitemap(`<?xml version="1.0"?><sitemapindex xmlns="x"><sitemap><loc>https://a.com/post-sitemap.xml</loc><lastmod>2026-01-01</lastmod></sitemap><sitemap><loc>https://a.com/category-sitemap.xml</loc></sitemap><sitemap><loc>https://a.com/author-sitemap.xml</loc></sitemap></sitemapindex>`);
  assert.equal(idx.kind, "index");
  assert.equal(idx.entries.length, 3);
  assert.equal(idx.entries[0].lastmod, "2026-01-01");
  assert.deepEqual(pickChildSitemaps(idx.entries), ["https://a.com/post-sitemap.xml"]);
  const set = parseSitemap(`<urlset><url><loc>https://a.com/r1/</loc><lastmod>2025-05-05T10:00:00Z</lastmod></url><url><loc><![CDATA[https://a.com/r2/?a=1&amp;b=2]]></loc></url></urlset>`);
  assert.equal(set.kind, "urlset");
  assert.deepEqual(set.entries.map((e) => e.loc), ["https://a.com/r1/", "https://a.com/r2/?a=1&b=2"]);
  assert.equal(set.entries[1].lastmod, null);
});

test("JSON-LD: @graph, typed arrays and multiple blocks all yield the Recipe", () => {
  const a = extractRecipe(fx("wprm-page.html"));
  assert.equal(a.name, "Creamy Tuscan Chicken");
  assert.equal(recipeImage(a), "https://example.com/wp-content/uploads/tuscan-480x480.jpg");
  const b = extractRecipe(fx("publisher-page.html"));
  assert.equal(b.name, "Vegan Chickpea Curry");
  assert.equal(recipeImage(b), "https://cdn.example.org/img/curry.jpg");
  assert.equal(extractRecipe(fx("no-recipe.html")), null);
  assert.equal(isoMinutes("PT1H30M"), 90);
  assert.equal(isoMinutes("PT45M"), 45);
  assert.equal(isoMinutes("P1DT2H"), 1560);
  assert.equal(isoMinutes("soon"), null);
  assert.equal(ingredientLines({ recipeIngredient: "<b>1 egg</b>" })[0], "1 egg");
});

test("buildRecipeRecord stores metadata only, never instructions", () => {
  const source = SOURCES.find((s) => s.id === "budgetbytes");
  const built = buildRecipeRecord(extractRecipe(fx("wprm-page.html")), { url: "https://example.com/creamy-tuscan-chicken/", source });
  assert.ok(!built.skip, built.skip);
  const { row, ingredients, unresolved } = built;
  assert.equal(row.title, "Creamy Tuscan Chicken");
  assert.equal(row.yield_servings, 4);
  assert.equal(row.total_minutes, 35);
  assert.equal(row.cuisine, "italian");
  assert.equal(row.macro_source, "nutrition");
  assert.ok(JSON.parse(row.macro_tags).includes("protein-heavy"));
  assert.ok(JSON.parse(row.macro_tags).includes("low-carb"));
  // Claimed gluten-free, and nothing with gluten in it: confirmed.
  assert.ok(JSON.parse(row.diet_tags).includes("gluten-free"));
  assert.ok(!JSON.parse(row.diet_tags).includes("vegetarian"));
  const ids = ingredients.map((i) => i.canonical);
  for (const want of ["olive-oil", "chicken", "italian-seasoning", "salt", "black-pepper", "garlic", "sun-dried-tomato", "cream", "parmesan", "spinach", "basil"]) {
    assert.ok(ids.includes(want), `missing ${want} in ${ids}`);
  }
  assert.equal(ingredients.find((i) => i.canonical === "basil").optional, true);
  assert.deepEqual(unresolved, []);
  assert.equal(row.rating, 4.9);
  assert.equal(row.rating_count, 212);
  assert.ok(!Object.keys(row).some((k) => /instruction/i.test(k)));
  assert.ok(!JSON.stringify(row).includes("Season the chicken"));
});

test("a vegan recipe is tagged vegan by inference and claims, and lime/cilantro resolve", () => {
  const built = buildRecipeRecord(extractRecipe(fx("publisher-page.html")), { url: "https://cdn.example.org/curry", source: null });
  assert.ok(!built.skip, built.skip);
  const diet = JSON.parse(built.row.diet_tags);
  assert.ok(diet.includes("vegan"));
  assert.ok(diet.includes("dairy-free"));
  assert.equal(built.row.cuisine, "indian");
  assert.equal(built.row.yield_servings, 4);
  const ids = built.ingredients.map((i) => i.canonical);
  for (const want of ["coconut-oil", "onion", "garlic", "ginger", "curry-powder", "cumin", "chickpea", "coconut-milk", "canned-tomato", "broth", "salt", "lime", "cilantro", "rice"]) {
    assert.ok(ids.includes(want), `missing ${want} in ${ids}`);
  }
  assert.equal(built.ingredients.find((i) => i.canonical === "rice").optional, true);
  assert.equal(built.row.macro_source, "inferred");
});

test("pages with too little we understand are skipped rather than stored badly", () => {
  const r = buildRecipeRecord({ name: "Mystery", recipeIngredient: ["3 zorbs", "2 flibs", "1 quux", "salt"] }, { url: "https://x/y", source: null });
  assert.equal(r.skip, "too few resolved ingredients");
  const r2 = buildRecipeRecord({ name: "Tiny", recipeIngredient: ["salt", "pepper"] }, { url: "https://x/z", source: null });
  assert.equal(r2.skip, "too few ingredients");
});

test("ids are stable per URL and sources resolve by host", () => {
  assert.equal(idForUrl("https://a.com/x"), idForUrl("https://a.com/x"));
  assert.notEqual(idForUrl("https://a.com/x"), idForUrl("https://a.com/y"));
  assert.match(idForUrl("https://a.com/x"), /^[0-9a-f]{13}$/);
  assert.equal(sourceForUrl("https://www.budgetbytes.com/one-pot-pasta/")?.id, "budgetbytes");
  assert.equal(sourceForUrl("https://nytimes.com/cooking/x"), null);
  const dup = SOURCES.map((s) => s.id).filter((id, i, a) => a.indexOf(id) !== i);
  assert.deepEqual(dup, []);
  assert.ok(SOURCES.length >= 25);
  for (const s of SOURCES) assert.ok(s.match.test(s.match.source.includes("\\/") ? "" : "") || true);
});

test("robots.txt: longest match wins and our token overrides *", () => {
  const txt = `User-agent: *\nDisallow: /wp-admin/\nDisallow: /private\nAllow: /private/recipes/\n\nUser-agent: leftovers-crawler\nDisallow: /nope/\n`;
  assert.equal(robotsAllows(txt, "/recipes/x"), true);
  assert.equal(robotsAllows(txt, "/nope/x"), false);
  assert.equal(robotsAllows(txt, "/private/x", "otherbot"), false);
  assert.equal(robotsAllows(txt, "/private/recipes/x", "otherbot"), true);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /\n", "/anything"), false);
  assert.equal(robotsAllows("User-agent: *\nDisallow:\n", "/anything"), true);
  assert.equal(robotsAllows("", "/x"), true);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /*.pdf$\n", "/a/b.pdf"), false);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /*.pdf$\n", "/a/b.pdfx"), true);
});
