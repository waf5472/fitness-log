// Turn SQL candidates into the dealt hand. Pure functions, no I/O, so the
// whole matching policy is unit-testable and the same code can run against
// D1 rows or a fixture.
//
// Vocabulary:
//   have      set of canonical ids the user has (their input ∪ Spicerack)
//   required  a recipe's non-optional canonical ids
//   missing   required − have
//   coverage  |required ∩ have| / |required|

import { isHero } from "./canonicals.js";

const W = {
  coverage: 100, // 0..100
  missing: 18,   // per missing ingredient
  cuisine: 14,   // recipe cuisine is one the user asked for
  macro: 10,     // per macro tag the user asked for that the recipe carries
  yieldKnown: 3, // we can scale it
  jitter: 6,     // keeps Rerun from dealing the same hand
};

/** Deterministic PRNG so tests can pin the jitter. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {Array<{id, ingredients:Array<{canonical, optional}>, cuisine, macro_tags, yield_servings}>} candidates
 * @param {{have:Set<string>, cuisine?:string[], macro?:string[], maxMissing:number, exclude?:Set<string>, seed?:number}} q
 */
export function scoreCandidates(candidates, q) {
  const rand = mulberry32(q.seed ?? Date.now());
  const wantCuisine = new Set(q.cuisine || []);
  const wantMacro = new Set(q.macro || []);
  const exclude = q.exclude || new Set();
  const out = [];
  for (const r of candidates) {
    if (exclude.has(r.id)) continue;
    const required = r.ingredients.filter((i) => !i.optional).map((i) => i.canonical);
    if (!required.length) continue;
    const matched = required.filter((c) => q.have.has(c));
    const missing = required.filter((c) => !q.have.has(c));
    if (missing.length > q.maxMissing) continue;
    const coverage = matched.length / required.length;
    let score = coverage * W.coverage - missing.length * W.missing;
    if (wantCuisine.size && wantCuisine.has(r.cuisine)) score += W.cuisine;
    for (const m of r.macro_tags || []) if (wantMacro.has(m)) score += W.macro;
    if (r.yield_servings) score += W.yieldKnown;
    score += rand() * W.jitter;
    out.push({
      ...r,
      matched,
      missing,
      coverage,
      score,
      hero: required.find(isHero) || null,
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

/**
 * Greedy pick of `count` recipes that do not all lean on the same hero
 * ingredient: three dinners cannot all use the one pack of chicken. Falls back
 * to repeats only when nothing else is left.
 */
export function pickDiverse(scored, count) {
  const picked = [];
  const heroesUsed = new Set();
  for (const r of scored) {
    if (picked.length >= count) break;
    if (r.hero && heroesUsed.has(r.hero)) continue;
    picked.push(r);
    if (r.hero) heroesUsed.add(r.hero);
  }
  if (picked.length < count) {
    for (const r of scored) {
      if (picked.length >= count) break;
      if (!picked.includes(r)) picked.push(r);
    }
  }
  return picked;
}

/**
 * The whole policy in one call. Strict first; if that cannot fill the hand
 * and the caller allows, relax to `maxMissing` and flag the result so the UI
 * can say so instead of silently flipping the toggle.
 */
export function deal(candidates, q) {
  const strictMax = q.allowMissing ? q.maxMissing : 0;
  let scored = scoreCandidates(candidates, { ...q, maxMissing: strictMax });
  let hand = pickDiverse(scored, q.count);
  let degraded = false;
  if (hand.length < q.count && !q.allowMissing) {
    const relaxed = scoreCandidates(candidates, { ...q, maxMissing: q.maxMissing });
    const extra = pickDiverse(
      relaxed.filter((r) => !hand.some((h) => h.id === r.id)),
      q.count - hand.length,
    );
    if (extra.length) degraded = true;
    hand = [...hand, ...extra];
  }
  return { hand, degraded, poolSize: scored.length };
}
