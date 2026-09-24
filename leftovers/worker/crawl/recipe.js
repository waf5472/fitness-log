// schema.org Recipe (as extracted) -> the row we store. This is the ONLY place
// that decides what we keep. Instructions are deliberately never read:
// ingredient lists are facts, recipe text is someone's writing.

import { normalizeIngredients, inferDietTags, inferMacroTags, claimedDietTags, resolveCuisine } from "../../shared/normalize.js";
import { parseYield } from "../../shared/scale.js";
import { recipeImage, isoMinutes, ingredientLines, keywordList } from "./jsonld.js";

const MIN_INGREDIENTS = 3;
const MAX_UNRESOLVED_RATIO = 0.5;

/**
 * @returns {{row: object, ingredients: Array<{canonical, optional}>, unresolved: string[]} | {skip: string}}
 */
export function buildRecipeRecord(recipe, { url, source, overrides = null }) {
  const lines = ingredientLines(recipe);
  if (lines.length < MIN_INGREDIENTS) return { skip: "too few ingredients" };
  const { ingredients, unresolved } = normalizeIngredients(lines, overrides);
  if (ingredients.length < MIN_INGREDIENTS) return { skip: "too few resolved ingredients" };
  if (unresolved.length / lines.length > MAX_UNRESOLVED_RATIO) return { skip: "mostly unresolved" };

  const ids = ingredients.filter((i) => !i.optional).map((i) => i.canonical);
  const claimed = claimedDietTags({ ...recipe, keywords: keywordList(recipe) });
  const diet = inferDietTags(ids, { claimed, unresolvedCount: unresolved.length });
  const macro = inferMacroTags(recipe.nutrition, ids);
  const y = parseYield(recipe.recipeYield);
  const title = String(recipe.name || "").replace(/\s+/g, " ").trim();
  if (!title) return { skip: "no title" };

  const nutrition = recipe.nutrition && typeof recipe.nutrition === "object"
    ? pick(recipe.nutrition, ["calories", "proteinContent", "carbohydrateContent", "fatContent", "fiberContent", "servingSize"])
    : null;

  return {
    row: {
      id: idForUrl(url),
      source_id: source?.id || null,
      url,
      title: title.slice(0, 200),
      image_url: recipeImage(recipe),
      yield_servings: y.servings,
      yield_text: y.raw,
      cuisine: resolveCuisine({ ...recipe, keywords: keywordList(recipe) }, source?.cuisine || null),
      total_minutes: isoMinutes(recipe.totalTime) ?? sum(isoMinutes(recipe.prepTime), isoMinutes(recipe.cookTime)),
      diet_tags: JSON.stringify(diet),
      macro_tags: JSON.stringify(macro.tags),
      macro_source: macro.source,
      nutrition_json: nutrition ? JSON.stringify(nutrition) : null,
      ingredient_count: ingredients.length,
      unresolved_count: unresolved.length,
      raw_ingredients: JSON.stringify(lines).slice(0, 8000),
      rating: num(recipe.aggregateRating?.ratingValue),
      rating_count: num(recipe.aggregateRating?.ratingCount ?? recipe.aggregateRating?.reviewCount),
      crawled_at: new Date().toISOString(),
    },
    ingredients,
    unresolved,
  };
}

/** Stable id from the URL so re-crawls upsert instead of duplicating. */
export function idForUrl(url) {
  // FNV-1a 52-bit, hex. Collisions across ~100k URLs are astronomically unlikely.
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  const s = String(url);
  for (let i = 0; i < s.length; i++) {
    h1 ^= s.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= s.charCodeAt(i) + i;
    h2 = Math.imul(h2, 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + (h2 & 0xfffff).toString(16).padStart(5, "0");
}

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] != null).map((k) => [k, o[k]]));
const num = (v) => (v == null || v === "" || isNaN(Number(v)) ? null : Number(v));
const sum = (a, b) => (a == null && b == null ? null : (a || 0) + (b || 0));
