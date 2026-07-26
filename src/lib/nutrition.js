// Ingredient -> macros. The LLM never computes a calorie here; it only says
// what was eaten and how much. This module decides the number, preferring the
// committed food table and falling back to the model's estimate only when the
// table has no match — every ingredient carries the source that produced it so
// the UI can show which numbers are exact and which are guesses.

import { FOODS } from "./foods.js";
import { toGrams, parseQty } from "./units.js";

export { FOODS };

// Words that describe preparation rather than identity. Dropping them lets
// "diced yellow onion" find "onion" without polluting the exact-match path.
const MODIFIERS = new Set([
  "fresh", "raw", "cooked", "chopped", "diced", "sliced", "minced", "grated",
  "shredded", "organic", "large", "small", "medium", "whole", "of", "a", "an",
  "the", "plain", "unsweetened", "roasted", "grilled", "baked", "steamed",
  "frozen", "canned", "dried", "ground", "crushed", "peeled", "halved",
]);

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singular(word) {
  if (word.length > 3 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 3 && word.endsWith("es") && !word.endsWith("ses")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function tokenize(s, { dropModifiers = true } = {}) {
  return normalize(s)
    .split(" ")
    .filter(Boolean)
    .map(singular)
    .filter((t) => (dropModifiers ? !MODIFIERS.has(t) : true));
}

// Every searchable string for a food, normalized once at module load.
const INDEX = FOODS.map((food) => ({
  food,
  keys: [food.id.replace(/_/g, " "), food.name, ...(food.aliases || [])].map(normalize),
  tokenSets: [food.name, ...(food.aliases || [])].map((k) => new Set(tokenize(k))),
}));

/**
 * Find the best food-table entry for a free-text ingredient name.
 * @returns {{food: object, confidence: "exact"|"fuzzy", score: number}|null}
 */
export function matchFood(query) {
  const norm = normalize(query);
  if (!norm) return null;

  // Exact hit on a name or alias — the common case, and always preferred.
  for (const entry of INDEX) {
    if (entry.keys.includes(norm)) {
      return { food: entry.food, confidence: "exact", score: 1 };
    }
  }

  const qTokens = tokenize(query);
  if (qTokens.length === 0) return null;
  const qSet = new Set(qTokens);

  let best = null;
  for (const entry of INDEX) {
    for (const candSet of entry.tokenSets) {
      if (candSet.size === 0) continue;
      let shared = 0;
      for (const t of candSet) if (qSet.has(t)) shared++;
      if (shared === 0) continue;

      // Reward covering the candidate fully ("chicken breast" inside "grilled
      // chicken breast") more than covering the query, so a two-word food beats
      // a one-word food that happens to share a token.
      const candCoverage = shared / candSet.size;
      const queryCoverage = shared / qSet.size;
      const score = candCoverage * 0.7 + queryCoverage * 0.3;

      if (!best || score > best.score) {
        best = { food: entry.food, confidence: "fuzzy", score };
      }
    }
  }

  // Below this, matches are noise ("butter" pulling in "peanut butter").
  return best && best.score >= 0.5 ? best : null;
}

/** Free-text search for the manual ingredient picker in the UI. */
export function searchFoods(query, limit = 8) {
  const norm = normalize(query);
  if (!norm) return [];
  return FOODS.filter((f) =>
    [f.name, ...(f.aliases || [])].some((k) => normalize(k).includes(norm)),
  ).slice(0, limit);
}

const MACRO_KEYS = ["kcal", "protein_g", "carb_g", "fat_g", "fiber_g"];

function macrosFromTable(food, grams) {
  const per = food.per100g;
  const factor = grams / 100;
  return {
    kcal: per.kcal * factor,
    protein_g: per.protein * factor,
    carb_g: per.carb * factor,
    fat_g: per.fat * factor,
    fiber_g: (per.fiber || 0) * factor,
  };
}

/**
 * Resolve one parsed ingredient into grams + macros.
 *
 * @param {object} ing  {name, qty, unit, est_grams?, est_kcal?, est_protein_g?, est_carb_g?, est_fat_g?}
 * @returns {object} the input plus grams, macros, source, basis, and warnings
 */
export function resolveIngredient(ing) {
  const qty = parseQty(ing.qty);
  const match = matchFood(ing.name);
  const food = match?.food || null;
  const warnings = [];

  let { grams, basis, assumed } = toGrams(qty, ing.unit, food);

  // The table knew the food but not the unit (e.g. "2 handfuls of almonds").
  // The model's gram estimate is better than nothing.
  if (grams == null) {
    if (Number.isFinite(ing.est_grams) && ing.est_grams > 0) {
      grams = ing.est_grams;
      basis = "weight estimated by model";
      warnings.push(`Weight of "${ing.qty} ${ing.unit}" was estimated.`);
    } else {
      grams = 0;
      basis = "unresolvable";
      warnings.push(`Could not determine a weight for "${ing.name}".`);
    }
  } else if (assumed) {
    warnings.push(`Assumed water density converting ${ing.unit} of "${ing.name}".`);
  }

  let macros;
  let source;
  if (food) {
    macros = macrosFromTable(food, grams);
    source = match.confidence === "exact" ? "table" : "table-fuzzy";
    if (match.confidence === "fuzzy") {
      warnings.push(`Matched "${ing.name}" to "${food.name}".`);
    }
  } else if (Number.isFinite(ing.est_kcal)) {
    // Model estimates are given for the whole stated quantity, not per 100 g.
    macros = {
      kcal: ing.est_kcal || 0,
      protein_g: ing.est_protein_g || 0,
      carb_g: ing.est_carb_g || 0,
      fat_g: ing.est_fat_g || 0,
      fiber_g: ing.est_fiber_g || 0,
    };
    source = "estimated";
    warnings.push(`"${ing.name}" is not in the food table — macros estimated.`);
  } else {
    macros = { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0, fiber_g: 0 };
    source = "unknown";
    warnings.push(`No nutrition data for "${ing.name}".`);
  }

  return {
    name: ing.name,
    qty,
    unit: ing.unit || "each",
    grams: round(grams, 1),
    matchedFood: food?.name || null,
    source,
    basis,
    warnings,
    ...roundMacros(macros),
  };
}

/** Sum resolved ingredients into a meal record. */
export function computeMeal({ name, slot, ingredients }) {
  const resolved = (ingredients || []).map(resolveIngredient);
  const totals = resolved.reduce(
    (acc, ing) => {
      for (const k of MACRO_KEYS) acc[k] += ing[k] || 0;
      return acc;
    },
    { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0, fiber_g: 0 },
  );

  return {
    kind: "meal",
    name: name || "Meal",
    slot: slot || null,
    ingredients: resolved,
    ...roundMacros(totals),
    // Surfaced as a single badge in the UI rather than a wall of warnings.
    confidence: resolved.some((i) => i.source === "estimated" || i.source === "unknown")
      ? "estimated"
      : resolved.some((i) => i.source === "table-fuzzy")
        ? "approximate"
        : "exact",
    warnings: resolved.flatMap((i) => i.warnings),
  };
}

function round(n, places = 0) {
  const f = 10 ** places;
  return Math.round((n || 0) * f) / f;
}

function roundMacros(m) {
  return {
    kcal: round(m.kcal),
    protein_g: round(m.protein_g, 1),
    carb_g: round(m.carb_g, 1),
    fat_g: round(m.fat_g, 1),
    fiber_g: round(m.fiber_g, 1),
  };
}
