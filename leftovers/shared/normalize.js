// Free-text ingredient line -> canonical ingredient id.
//
//   "2 boneless, skinless chicken thighs (about 1 lb), trimmed"  ->  chicken
//   "1 (14 oz) can coconut milk, full-fat"                       ->  coconut-milk
//   "Kosher salt and freshly ground black pepper"                ->  salt, black-pepper
//
// Three stages: clean the line down to a noun phrase, look the phrase up in
// the synonym index (longest match wins), and if nothing matches return null
// so the crawler can queue it for the LLM pass. Nothing here is clever on
// purpose — a deterministic parser you can unit-test beats a smart one you
// cannot.

import { CANONICALS, isAnimal, isMeat, isSeafood, isDairy, hasGluten } from "./canonicals.js";
import { SCHEMA_DIETS, normalizeCuisine } from "./tags.js";

// --- Synonym index ----------------------------------------------------------

function plurals(word) {
  const out = new Set([word]);
  if (/[^s]$/.test(word)) out.add(word + "s");
  if (/(ch|sh|x|s|z|o)$/.test(word)) out.add(word + "es");
  if (/[^aeiou]y$/.test(word)) out.add(word.slice(0, -1) + "ies");
  if (/f$/.test(word)) out.add(word.slice(0, -1) + "ves");
  if (/fe$/.test(word)) out.add(word.slice(0, -2) + "ves");
  return out;
}

// Bare words that are a canonical's own id but far too generic to match on
// their own inside a longer line ("juice from 2 limes" is about limes).
const NEVER_ALONE = new Set(["juice", "seeds", "spirits", "msg", "candy", "cookies", "warm spices", "frosting", "relish", "soda"]);

// phrase -> id. Phrases are stored without "of" so lookups can strip it too.
const EXACT = new Map();
const register = (phrase, id) => {
  const p = phrase.replace(/\bof\b/g, " ").replace(/\s+/g, " ").trim();
  if (p && !EXACT.has(p)) EXACT.set(p, id);
};
for (const c of CANONICALS) {
  for (const syn of c.synonyms) {
    const base = syn.toLowerCase().trim();
    if (NEVER_ALONE.has(base)) continue;
    const parts = base.split(" ");
    const last = parts.pop();
    for (const p of plurals(last)) register([...parts, p].join(" "), c.id);
  }
}
// Bucket by first word, longest first, so substring search is cheap.
const BY_FIRST_WORD = new Map();
for (const p of [...EXACT.keys()].sort((a, b) => b.length - a.length || a.localeCompare(b))) {
  const w = p.split(" ")[0];
  if (!BY_FIRST_WORD.has(w)) BY_FIRST_WORD.set(w, []);
  BY_FIRST_WORD.get(w).push(p);
}

// --- Cleaning ---------------------------------------------------------------

const UNICODE_FRACTIONS = { "½": " 1/2", "⅓": " 1/3", "⅔": " 2/3", "¼": " 1/4", "¾": " 3/4", "⅛": " 1/8", "⅜": " 3/8", "⅝": " 5/8", "⅞": " 7/8", "⅕": " 1/5", "⅙": " 1/6" };

const UNITS = "cups?|c\\.|tablespoons?|tbsps?|tbs|tbl|teaspoons?|tsps?|t\\.|ounces?|oz\\.?|fl\\.? ?oz\\.?|pounds?|lbs?\\.?|grams?|g\\.?|gr|kilograms?|kgs?|milliliters?|millilitres?|mls?|liters?|litres?|l\\.|quarts?|qts?|pints?|pts?|gallons?|gal|cloves?|cans?|tins?|jars?|packages?|pkgs?|packets?|boxes?|bags?|bunch(?:es)?|pinch(?:es)?|dash(?:es)?|slices?|sticks?|heads?|sprigs?|handfuls?|pieces?|pcs?|stalks?|ribs?|ears?|links?|strips?|cubes?|knobs?|drops?|splash(?:es)?|scoops?|squares?|sheets?|leaves|leaf|wedges?|balls?|inch(?:es)?|in\\.|cm|mm|servings?|portions?|sachets?|envelopes?|containers?|cartons?|bottles?|blocks?|loa(?:f|ves)|dozen|pkt";

// Words that never change WHAT an ingredient is, only how much, how good, or
// how it is cut. Identity-changing words (smoked, canned, ground, crushed,
// dried, hot, sweet) are deliberately absent: those are handled by synonyms.
const NOISE = /\b(x-?large|extra[- ]large|jumbo|large|medium|small|mini|big|thick|thin|heaping|heaped|scant|generous|level|rounded|about|approximately|approx\.?|roughly|around|ripe|very ripe|overripe|fresh|freshly|thawed|cooked|uncooked|raw|leftover|halved|quartered|packed|lightly packed|firmly packed|loosely packed|sifted|divided|plus more|plus extra|more for|as needed|to taste|or more|or less|or so|of your choice|of choice|your favorite|your favourite|favorite|favourite|good quality|good-quality|high quality|high-quality|best quality|store-bought|storebought|store bought|homemade|home-made|premade|pre-made|organic|free-range|free range|grass-fed|grass fed|pasture-raised|wild-caught|wild caught|farm-raised|unsalted|salted|low-sodium|low sodium|reduced-sodium|reduced sodium|no-salt-added|no salt added|full-fat|full fat|low-fat|low fat|lowfat|nonfat|non-fat|fat-free|fat free|reduced-fat|reduced fat|lite|natural|pure|real|regular|plain|ordinary|any|some|a few|a couple|a couple of|a bit of|a little|a handful of|a pinch of|a dash of|a splash of|a drizzle of|drizzle of|a knob of|knob of|a squeeze of|squeeze of|juice of|juice from|zest of|zest from|juice and zest of|zest and juice of|seeds removed|stems removed|stemmed|seeded|deseeded|de-seeded|pitted|peeled|unpeeled|skin on|skin-on|skinless|boneless|bone-in|bone in|skin removed|bones removed|trimmed|untrimmed|cleaned|washed|rinsed|drained|rinsed and drained|drained and rinsed|well drained|undrained|patted dry|room temperature|at room temperature|room temp|chilled|softened|melted|coarsely|finely|thinly|thickly|julienned|shredded|grated|zested|juiced|squeezed|smashed|mashed|minced|diced|chopped|sliced|cubed|cut|torn|ripped|broken|separated|beaten|whisked|lightly beaten|well beaten|optional|if desired|if needed|if using|if you like|if available|for serving|for garnish|to serve|to garnish|for topping|for the topping|for drizzling|for brushing|for greasing|for dusting|for frying|for the pan|for cooking|for sprinkling|for finishing|for decoration|to finish|to decorate|to top|see note|see notes|etc)\b/g;

// Ambiguous words whose meaning flips on context. Checked on the raw line.
const DISAMBIGUATE = [
  { word: /\bcoriander\b/, when: /\b(fresh|chopped|leaves|bunch|handful|stems?|roots?|sprigs?|torn|leaf|cilantro)\b/, then: "cilantro" },
];

function stripQuantities(s) {
  s = s.replace(/\b\d+(?:[.,]\d+)?\s*(?:-|–|to|or)\s*\d+(?:[.,]\d+)?\b/g, " ");
  s = s.replace(/\b\d+\s+\d+\/\d+\b/g, " ");
  s = s.replace(/\b\d+\/\d+\b/g, " ");
  s = s.replace(/\b\d+(?:[.,]\d+)?\s*x\b/g, " ");
  s = s.replace(/\b\d+(?:[.,]\d+)?\b/g, " ");
  s = s.replace(new RegExp(`\\b(?:${UNITS})\\b\\.?`, "g"), " ");
  return s;
}

const squash = (s) =>
  s.replace(/\bof\b/g, " ").replace(/[^a-z0-9&'\- ]/g, " ").replace(/\s+/g, " ").trim()
    .replace(/^(?:a|an|the|some|few)\s+/, "").replace(/\s+(?:a|an|the)$/, "");

/**
 * Two cleaned forms of a line. `loose` keeps identity words so synonyms like
 * "chopped tomatoes" or "hot sauce" can match; `tight` strips noise so a
 * bare "lemon" is left from "juice of 1 large lemon".
 */
function cleanLine(raw) {
  let s = String(raw || "").toLowerCase();
  for (const [k, v] of Object.entries(UNICODE_FRACTIONS)) s = s.split(k).join(v);
  s = s.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
  s = s.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ");
  s = s.replace(/[*•▢□◻︎✓]/g, " ");
  const optional = /\boptional\b|\bfor (?:garnish|serving|topping)\b|\bto (?:serve|garnish)\b|\bif desired\b/.test(s);
  const forced = DISAMBIGUATE.find((d) => d.word.test(s) && d.when.test(s))?.then || null;
  const loose = squash(stripQuantities(s));
  const tight = squash(loose.replace(NOISE, " "));
  return { loose, tight, optional, forced };
}

// --- Lookup -----------------------------------------------------------------

// Earliest match in the phrase wins; at a given position, the longest synonym
// wins. Earliest, because the ingredient noun comes first and qualifiers
// ("beaten with 1 tbsp milk") come after.
function findIn(phrase) {
  if (!phrase) return null;
  if (EXACT.has(phrase)) return EXACT.get(phrase);
  const words = phrase.split(" ");
  for (let i = 0; i < words.length; i++) {
    const bucket = BY_FIRST_WORD.get(words[i]);
    if (!bucket) continue;
    for (const p of bucket) {
      const pl = p.split(" ").length;
      if (words.slice(i, i + pl).join(" ") === p) return EXACT.get(p);
    }
  }
  return null;
}

function lookup(clean) {
  return clean.forced || findIn(clean.loose) || findIn(clean.tight);
}

/**
 * Parse one ingredient line.
 * @returns {{raw:string, phrase:string, canonical:string|null, optional:boolean}}
 */
export function parseIngredient(raw) {
  const clean = cleanLine(raw);
  let canonical = lookup(clean);
  if (!canonical && /\b(?:and|&|or)\b/.test(clean.tight)) {
    for (const part of clean.tight.split(/\s+(?:and|&|or)\s+/)) {
      canonical = findIn(part.trim());
      if (canonical) break;
    }
  }
  return { raw: String(raw || ""), phrase: clean.tight, canonical, optional: clean.optional };
}

/**
 * Like parseIngredient but returns every canonical in an "X and Y" line, so
 * "salt and freshly ground black pepper" yields both.
 */
export function parseIngredientAll(raw) {
  const clean = cleanLine(raw);
  const one = (canonical) => [{ raw, phrase: clean.tight, canonical, optional: clean.optional }];
  const parts = clean.loose.split(/\s+(?:and|&)\s+/);
  if (parts.length >= 2) {
    const found = [...new Set(parts.map((p) => findIn(squash(p)) || findIn(squash(p.replace(NOISE, " ")))).filter(Boolean))];
    if (found.length >= 2) return found.map((canonical) => one(canonical)[0]);
  }
  return one(lookup(clean));
}

/**
 * Whole recipe: list of raw lines -> {ingredients:[...], unresolved:[...]}
 * with duplicates collapsed (a recipe that lists "olive oil" twice needs it once).
 * `overrides` is a Map of cleaned phrase -> canonical id (or null to ignore),
 * learned after the fact; it is consulted only when the dictionary misses.
 */
export function normalizeIngredients(lines, overrides = null) {
  const seen = new Map(); // canonical -> optional (optional only if every mention is)
  const unresolved = [];
  for (const line of lines || []) {
    for (const p of parseIngredientAll(line)) {
      if (!p.canonical && overrides && overrides.has(p.phrase)) {
        // Learned mapping (LLM or manual). null means "ignore this phrase".
        const mapped = overrides.get(p.phrase);
        if (!mapped) continue;
        p.canonical = mapped;
      }
      if (!p.canonical) {
        if (p.phrase) unresolved.push(p.phrase);
        continue;
      }
      seen.set(p.canonical, seen.has(p.canonical) ? seen.get(p.canonical) && p.optional : p.optional);
    }
  }
  return {
    ingredients: [...seen.entries()].map(([canonical, optional]) => ({ canonical, optional })),
    unresolved: [...new Set(unresolved)],
  };
}

// --- Tag inference ----------------------------------------------------------

/**
 * Diet tags from the canonical list, cross-checked with what the page claims.
 * Inference only ever REMOVES a claimed tag (a "vegan" recipe with honey in it
 * is not vegan) or adds one the page did not bother to claim. Gluten-free is
 * never added by inference alone — too much hides in sauces — only confirmed.
 */
export function inferDietTags(canonicalIds, { claimed = [], unresolvedCount = 0 } = {}) {
  const ids = canonicalIds.filter(Boolean);
  const anyAnimal = ids.some(isAnimal);
  const anyMeat = ids.some(isMeat);
  const anySea = ids.some(isSeafood);
  const anyDairy = ids.some(isDairy);
  const anyGluten = ids.some(hasGluten);
  const tags = new Set();
  // Only trust ingredient-based inference when we understood the whole list.
  const complete = unresolvedCount === 0;
  if (complete && !anyAnimal) tags.add("vegan");
  if (complete && !anyMeat && !anySea) tags.add("vegetarian");
  if (complete && !anyMeat) tags.add("pescatarian");
  if (complete && !anyDairy) tags.add("dairy-free");
  for (const t of claimed) {
    if (t === "vegan" && !anyAnimal) tags.add("vegan");
    if (t === "vegetarian" && !anyMeat && !anySea) tags.add("vegetarian");
    if (t === "pescatarian" && !anyMeat) tags.add("pescatarian");
    if (t === "dairy-free" && !anyDairy) tags.add("dairy-free");
    if (t === "gluten-free" && !anyGluten) tags.add("gluten-free");
  }
  // Vegan implies the rest.
  if (tags.has("vegan")) { tags.add("vegetarian"); tags.add("pescatarian"); tags.add("dairy-free"); }
  if (tags.has("vegetarian")) tags.add("pescatarian");
  return [...tags];
}

const num = (v) => {
  if (v == null) return null;
  const m = String(v).match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

/**
 * Macro tags. From schema.org NutritionInformation per serving when present;
 * otherwise a coarse guess from ingredient categories, flagged as inferred.
 */
export function inferMacroTags(nutrition, canonicalIds) {
  const protein = num(nutrition?.proteinContent);
  const carbs = num(nutrition?.carbohydrateContent);
  const fat = num(nutrition?.fatContent);
  const kcal = num(nutrition?.calories);
  const tags = [];
  if (protein != null && carbs != null) {
    const pk = protein * 4, ck = carbs * 4, fk = (fat ?? 0) * 9;
    const total = kcal || pk + ck + fk || 1;
    if (protein >= 25 || pk / total >= 0.3) tags.push("protein-heavy");
    if (carbs >= 60 || ck / total >= 0.55) tags.push("carb-heavy");
    if (carbs <= 15 && ck / total < 0.2) tags.push("low-carb");
    return { tags, source: "nutrition" };
  }
  const ids = canonicalIds.filter(Boolean);
  const heroes = ids.filter((id) => isMeat(id) || isSeafood(id) || ["tofu", "egg", "lentil", "chickpea", "black-bean", "white-bean", "kidney-bean", "pinto-bean", "edamame", "protein-powder", "yogurt", "ricotta"].includes(id)).length;
  const starches = ids.filter((id) => ["rice", "pasta", "noodles", "bread", "potato", "sweet-potato", "tortilla", "flour", "quinoa", "oats", "couscous", "bulgur", "cornmeal", "pizza-dough", "gluten-free-pasta", "plantain"].includes(id)).length;
  if (heroes >= 1 && starches === 0) tags.push("protein-heavy", "low-carb");
  else if (heroes >= 2) tags.push("protein-heavy");
  if (starches >= 2 || (starches === 1 && heroes === 0)) tags.push("carb-heavy");
  return { tags: [...new Set(tags)], source: "inferred" };
}

/** Claimed diet tags from schema.org fields + keywords/categories. */
export function claimedDietTags(recipe) {
  const out = new Set();
  const diets = [].concat(recipe?.suitableForDiet || []);
  for (const d of diets) {
    const key = String(d).replace(/^https?:\/\/schema\.org\//, "");
    if (SCHEMA_DIETS[key]) out.add(SCHEMA_DIETS[key]);
  }
  const text = [recipe?.keywords, recipe?.recipeCategory, recipe?.name]
    .flat()
    .filter(Boolean)
    .map(String)
    .join(" ")
    .toLowerCase();
  if (/\bvegan\b/.test(text)) out.add("vegan");
  if (/\bvegetarian\b/.test(text)) out.add("vegetarian");
  if (/\bpescatarian\b/.test(text)) out.add("pescatarian");
  if (/\bgluten[- ]free\b/.test(text)) out.add("gluten-free");
  if (/\bdairy[- ]free\b/.test(text)) out.add("dairy-free");
  return [...out];
}

/** Cuisine from recipeCuisine, then keywords, then the source's default. */
export function resolveCuisine(recipe, sourceDefault = null) {
  const direct = [].concat(recipe?.recipeCuisine || []).map(normalizeCuisine).find(Boolean);
  if (direct) return direct;
  const fromKeywords = [recipe?.keywords, recipe?.recipeCategory]
    .flat()
    .filter(Boolean)
    .map(normalizeCuisine)
    .find(Boolean);
  return fromKeywords || sourceDefault || null;
}
