import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreCandidates, pickDiverse, deal } from "../shared/rank.js";

const R = (id, ings, extra = {}) => ({
  id,
  title: id,
  ingredients: ings.map((c) => (typeof c === "string" ? { canonical: c, optional: false } : c)),
  cuisine: null,
  macro_tags: [],
  yield_servings: 4,
  ...extra,
});

const have = new Set(["chicken", "rice", "onion", "garlic", "olive-oil", "salt", "black-pepper", "soy-sauce"]);

test("strict mode drops anything with a missing ingredient", () => {
  const cands = [
    R("full", ["chicken", "rice", "onion", "garlic"]),
    R("one-missing", ["chicken", "rice", "lime"]),
  ];
  const s = scoreCandidates(cands, { have, maxMissing: 0, seed: 1 });
  assert.deepEqual(s.map((r) => r.id), ["full"]);
});

test("coverage beats missing count, and cuisine/macro only boost", () => {
  const cands = [
    R("a", ["chicken", "rice", "onion", "garlic", "lime"]),          // 4/5, 1 missing
    R("b", ["chicken", "rice"], { cuisine: "asian" }),                // 2/2, 0 missing
    R("c", ["chicken", "lime", "cilantro"], { cuisine: "asian" }),   // 1/3, 2 missing
  ];
  const s = scoreCandidates(cands, { have, maxMissing: 3, cuisine: ["asian"], seed: 7 });
  assert.equal(s[0].id, "b");
  assert.equal(s[1].id, "a");
  assert.equal(s[2].id, "c");
  assert.deepEqual(s[1].missing, ["lime"]);
  const noBoost = scoreCandidates(cands, { have, maxMissing: 3, seed: 7 });
  assert.ok(noBoost.find((r) => r.id === "b").score < s.find((r) => r.id === "b").score);
});

test("optional ingredients never count against a recipe", () => {
  const cands = [R("x", ["rice", { canonical: "saffron", optional: true }])];
  const s = scoreCandidates(cands, { have, maxMissing: 0, seed: 1 });
  assert.equal(s.length, 1);
  assert.equal(s[0].coverage, 1);
});

test("pickDiverse avoids dealing three recipes on the same hero", () => {
  const scored = [
    { id: "1", hero: "chicken", score: 90 },
    { id: "2", hero: "chicken", score: 89 },
    { id: "3", hero: "tofu", score: 80 },
    { id: "4", hero: null, score: 70 },
    { id: "5", hero: "chicken", score: 60 },
  ];
  assert.deepEqual(pickDiverse(scored, 3).map((r) => r.id), ["1", "3", "4"]);
  // Falls back to repeats when the pool is thin.
  assert.deepEqual(pickDiverse(scored.slice(0, 2), 2).map((r) => r.id), ["1", "2"]);
});

test("deal degrades visibly when strict cannot fill the hand", () => {
  const cands = [
    R("full", ["chicken", "rice"]),
    R("near", ["chicken", "rice", "lime"]),
    R("far", ["beef", "lime", "cilantro", "tortilla"]),
  ];
  const strict = deal(cands, { have, allowMissing: false, maxMissing: 3, count: 3, seed: 3 });
  assert.equal(strict.degraded, true);
  assert.deepEqual(strict.hand.map((r) => r.id), ["full", "near"]);
  const relaxed = deal(cands, { have, allowMissing: true, maxMissing: 3, count: 3, seed: 3 });
  assert.equal(relaxed.degraded, false);
  assert.deepEqual(relaxed.hand.map((r) => r.id), ["full", "near"]);
});

test("excluded ids (swiped left, already in cookbook) never come back", () => {
  const cands = [R("a", ["chicken"]), R("b", ["rice"])];
  const d = deal(cands, { have, allowMissing: false, maxMissing: 0, count: 3, exclude: new Set(["a"]), seed: 1 });
  assert.deepEqual(d.hand.map((r) => r.id), ["b"]);
});
