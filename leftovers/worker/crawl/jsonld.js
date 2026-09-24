// HTML -> the schema.org/Recipe object on the page, if any.
//
// Every recipe plugin that matters (WP Recipe Maker, Tasty Recipes, Mediavine
// Create, the big publishers' CMSes) emits JSON-LD in a <script
// type="application/ld+json"> block. Shapes vary: a bare Recipe, an array of
// things, or a @graph containing WebPage + Article + Recipe. Some sites emit
// two blocks. We find every block, walk every node, and return the first
// Recipe. No HTML parser: a regex for the script tags is enough because the
// payload inside is JSON, not HTML.

const SCRIPT_RE = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

export function extractRecipe(html) {
  const text = String(html || "");
  SCRIPT_RE.lastIndex = 0;
  let m;
  while ((m = SCRIPT_RE.exec(text))) {
    let data;
    try {
      data = JSON.parse(cleanJson(m[1]));
    } catch {
      continue; // malformed block; the next one may be fine
    }
    const recipe = findRecipe(data);
    if (recipe) return recipe;
  }
  return null;
}

// Publishers occasionally leave CDATA wrappers or HTML comments inside the tag.
function cleanJson(s) {
  return s.replace(/^\s*<!--/, "").replace(/-->\s*$/, "").replace(/^\s*\/\/<!\[CDATA\[/, "").replace(/\/\/\]\]>\s*$/, "").trim();
}

function isRecipe(node) {
  if (!node || typeof node !== "object") return false;
  const t = node["@type"];
  const types = Array.isArray(t) ? t : [t];
  return types.some((x) => typeof x === "string" && /(^|\/)Recipe$/.test(x));
}

function findRecipe(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 6) return null;
  if (isRecipe(node)) return node;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (node["@graph"]) return findRecipe(node["@graph"], depth + 1);
  if (node.mainEntity) return findRecipe(node.mainEntity, depth + 1);
  if (node.mainEntityOfPage && typeof node.mainEntityOfPage === "object") {
    const r = findRecipe(node.mainEntityOfPage, depth + 1);
    if (r) return r;
  }
  return null;
}

/** Best-effort image URL from the many shapes `image` takes. */
export function recipeImage(recipe) {
  const img = recipe?.image;
  if (!img) return null;
  const first = Array.isArray(img) ? img[0] : img;
  if (typeof first === "string") return first;
  if (first && typeof first === "object") return first.url || first.contentUrl || null;
  return null;
}

/** ISO 8601 duration ("PT1H30M") -> minutes, or null. */
export function isoMinutes(d) {
  if (!d || typeof d !== "string") return null;
  const m = d.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!m) return null;
  const [, days, h, min] = m;
  const total = (parseInt(days || 0, 10) * 24 + parseInt(h || 0, 10)) * 60 + parseInt(min || 0, 10);
  return total || null;
}

/** recipeIngredient can be a string, an array, or (rarely) HTML-ridden. */
export function ingredientLines(recipe) {
  const raw = recipe?.recipeIngredient ?? recipe?.ingredients ?? [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr
    .map((x) => (typeof x === "string" ? x : x?.name || x?.text || ""))
    .map((s) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Flatten `keywords` (string, comma string, or array) to an array. */
export function keywordList(recipe) {
  const k = recipe?.keywords;
  if (!k) return [];
  if (Array.isArray(k)) return k.map(String);
  return String(k).split(",").map((s) => s.trim()).filter(Boolean);
}
