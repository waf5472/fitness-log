// `recipeYield` is free text. "4", "4 servings", "Serves 4-6", "12 cookies",
// "1 9-inch pie", ["4", "4 servings"]. We pull out a serving count when one is
// plausibly there and say null otherwise — a wrong scale factor is worse than
// no scale factor.

const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, twelve: 12, sixteen: 16, twenty: 20, dozen: 12,
};

// Units that count pieces, not servings. "24 cookies" is not 24 servings, but
// we still surface the number so the card can say "makes 24".
const PIECE_WORDS = /\b(cookies?|muffins?|bars?|rolls?|biscuits?|pancakes?|waffles?|tacos?|slices?|pieces?|cups?|loa(?:f|ves)|pies?|cakes?|balls?|patties|burgers?|dumplings?|meatballs?|scones?|crepes?|tortillas?|buns?|pastries|squares?|wedges?|quarts?|pints?|liters?|litres?|ml|oz|ounces?|inch(?:es)?)\b/;

/**
 * @returns {{servings: number|null, count: number|null, unit: string|null, raw: string|null}}
 *   servings: best guess at people fed; count/unit: piece yield when present.
 */
export function parseYield(value) {
  if (value == null) return { servings: null, count: null, unit: null, raw: null };
  const candidates = Array.isArray(value) ? value : [value];
  let best = { servings: null, count: null, unit: null, raw: null };

  for (const c of candidates) {
    const raw = String(typeof c === "object" && c !== null ? c.value ?? c.text ?? "" : c).trim();
    if (!raw) continue;
    const s = raw.toLowerCase().replace(/[–—]/g, "-");

    // Ranges: "4-6", "4 to 6", "4 or 6". Take the lower bound; recipes describe
    // the generous end and the user is scaling anyway.
    const range = s.match(/(\d+)\s*(?:-|to|or)\s*(\d+)/);
    const num = range
      ? parseInt(range[1], 10)
      : (() => {
          const m = s.match(/\d+(?:\.\d+)?/);
          if (m) return parseFloat(m[0]);
          for (const [w, n] of Object.entries(WORD_NUMBERS)) {
            if (new RegExp(`\\b${w}\\b`).test(s)) return n;
          }
          return null;
        })();
    if (!num || num <= 0 || num > 200) continue;

    const piece = s.match(PIECE_WORDS);
    if (piece && !/serv|portion|people|person|feeds/.test(s)) {
      // A piece count. Prefer any candidate that says "servings" outright.
      if (best.servings == null) {
        best = { servings: null, count: Math.round(num), unit: piece[1], raw };
      }
      continue;
    }
    // "4 servings", "serves 4", plain "4": all serving counts.
    return { ...best, servings: Math.round(num), raw: best.raw || raw };
  }
  return best;
}

/**
 * How much to multiply the recipe by to feed `needed`. Rounded to a quarter so
 * the UI can say "×1.5" instead of "×1.4285".
 */
export function scaleFactor(recipeServings, needed) {
  if (!recipeServings || !needed) return null;
  const f = needed / recipeServings;
  return Math.max(0.25, Math.round(f * 4) / 4);
}

export function describeScale(recipeServings, needed) {
  if (!recipeServings) return "yield unknown";
  const f = scaleFactor(recipeServings, needed);
  if (f === 1) return `makes ${recipeServings}`;
  return `makes ${recipeServings} · ×${f} for ${needed}`;
}
