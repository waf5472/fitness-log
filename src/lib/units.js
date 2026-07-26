// Quantity -> grams. This is the fiddliest part of the whole app: "1 cup" means
// 237 mL of milk (244 g), 30 g of spinach, and 216 g of olive oil. Resolution
// order matters and is deliberately: mass first (never overridable), then the
// food's own conventional units, then volume x density, then give up.

const MASS_TO_G = {
  g: 1,
  gram: 1,
  grams: 1,
  gm: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  mg: 0.001,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
};

const VOLUME_TO_ML = {
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  cc: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
  litre: 1000,
  tsp: 4.92892,
  teaspoon: 4.92892,
  teaspoons: 4.92892,
  tbsp: 14.7868,
  tablespoon: 14.7868,
  tablespoons: 14.7868,
  "fl oz": 29.5735,
  "fluid ounce": 29.5735,
  "fluid ounces": 29.5735,
  floz: 29.5735,
  cup: 236.588,
  cups: 236.588,
  pint: 473.176,
  pints: 473.176,
  quart: 946.353,
  quarts: 946.353,
  gallon: 3785.41,
  gallons: 3785.41,
};

// Singular form for count units, so "3 slices" and "1 slice" hit the same key.
const UNIT_ALIASES = {
  slices: "slice",
  cloves: "clove",
  stalks: "stalk",
  heads: "head",
  cans: "can",
  containers: "container",
  scoops: "scoop",
  breasts: "breast",
  thighs: "thigh",
  fillets: "fillet",
  filets: "fillet",
  filet: "fillet",
  links: "link",
  patties: "patty",
  bars: "bar",
  squares: "square",
  pieces: "piece",
  handfuls: "handful",
  spears: "spear",
  ears: "ear",
  sticks: "stick",
  bottles: "bottle",
  glasses: "glass",
  shots: "shot",
  wholes: "whole",
  slice_of: "slice",
  piece: "each",
  whole: "each",
  serving: "each",
  servings: "each",
};

export function normalizeUnit(unit) {
  if (!unit) return "each";
  const u = String(unit).trim().toLowerCase().replace(/\.$/, "");
  return UNIT_ALIASES[u] || u;
}

// Accepts 0.25, "1/4", "1 1/2", "½". The LLM is asked for a number, but users
// paste odd things and a bad fraction should not become NaN calories.
export function parseQty(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value == null) return 1;

  const VULGAR = { "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅛": 0.125 };
  let s = String(value).trim();
  for (const [glyph, n] of Object.entries(VULGAR)) {
    s = s.replace(glyph, ` ${n} `);
  }

  // "1 1/2" -> 1.5
  const mixed = s.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);

  const frac = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);

  const plain = parseFloat(s);
  return Number.isFinite(plain) ? plain : 1;
}

export function isMassUnit(unit) {
  return normalizeUnit(unit) in MASS_TO_G;
}

export function isVolumeUnit(unit) {
  return normalizeUnit(unit) in VOLUME_TO_ML;
}

/**
 * Convert a quantity of a food to grams.
 *
 * @param {number|string} qty
 * @param {string} unit
 * @param {object|null} food  entry from foods.json, or null if unmatched
 * @returns {{grams: number|null, basis: string, assumed: boolean}}
 *   `basis` explains which rule fired, so the UI can show its work.
 *   `assumed` is true when we guessed a density and the number may be off.
 */
export function toGrams(qty, unit, food) {
  const n = parseQty(qty);
  const u = normalizeUnit(unit);

  // 1. Mass is mass. A food never gets to redefine what a gram is.
  if (u in MASS_TO_G) {
    return { grams: n * MASS_TO_G[u], basis: `${u} -> mass`, assumed: false };
  }

  // 2. The food's own conventional weights: "1 cup spinach" is 30 g, not 237.
  if (food?.units && u in food.units) {
    return { grams: n * food.units[u], basis: `${u} of ${food.name}`, assumed: false };
  }

  // 3. Generic volume, scaled by the food's density.
  if (u in VOLUME_TO_ML) {
    const ml = n * VOLUME_TO_ML[u];
    if (food?.g_per_ml) {
      return { grams: ml * food.g_per_ml, basis: `${u} -> mL x density`, assumed: false };
    }
    // Water density is the least-bad guess, and we say so.
    return { grams: ml * 1.0, basis: `${u} -> mL, density assumed 1.0`, assumed: true };
  }

  // 4. A count unit we have no weight for ("2 handfuls of something unknown").
  return { grams: null, basis: `no weight known for "${u}"`, assumed: true };
}

export const _internal = { MASS_TO_G, VOLUME_TO_ML, UNIT_ALIASES };
