// Tag vocabulary shared by the crawler (which assigns tags), the API (which
// filters on them) and the UI (which shows them). One list, three consumers.

// Diet tags are HARD filters: pick "vegan" and nothing with an egg in it will
// be dealt. `weak: true` marks tags whose inference from an ingredient list is
// unreliable (gluten hides in soy sauce and stock cubes); the UI labels them.
export const DIET_TAGS = [
  { id: "vegan", label: "Vegan" },
  { id: "vegetarian", label: "Vegetarian" },
  { id: "pescatarian", label: "Pescatarian" },
  { id: "dairy-free", label: "Dairy-free" },
  { id: "gluten-free", label: "Gluten-free", weak: true },
];

// Cuisine and macro tags are SOFT boosts: they reorder, they never exclude.
export const CUISINE_TAGS = [
  { id: "italian", label: "Italian" },
  { id: "asian", label: "Asian" },
  { id: "mexican", label: "Mexican" },
  { id: "indian", label: "Indian" },
  { id: "mediterranean", label: "Mediterranean" },
  { id: "middle-eastern", label: "Middle Eastern" },
  { id: "american", label: "American" },
  { id: "french", label: "French" },
  { id: "latin", label: "Latin" },
];

export const MACRO_TAGS = [
  { id: "protein-heavy", label: "Protein heavy" },
  { id: "carb-heavy", label: "Carb heavy" },
  { id: "low-carb", label: "Low carb" },
];

// Free-text `recipeCuisine` values seen in the wild -> our ids. Matched as
// whole words against the lowercased string, first hit wins, so the more
// specific entries come first.
const CUISINE_PATTERNS = [
  ["middle-eastern", /\b(middle[- ]?eastern|lebanese|israeli|persian|iranian|moroccan|turkish|syrian|egyptian|arab(?:ic)?)\b/],
  ["mediterranean", /\b(mediterranean|greek|spanish|portuguese|cypriot)\b/],
  ["italian", /\b(italian|sicilian|tuscan|roman|neapolitan|venetian)\b/],
  ["mexican", /\b(mexican|tex[- ]?mex|oaxacan|yucatan)\b/],
  ["indian", /\b(indian|punjabi|south indian|bengali|goan|sri lankan|pakistani|nepalese)\b/],
  ["asian", /\b(asian|chinese|japanese|korean|thai|vietnamese|filipino|malaysian|indonesian|singaporean|cantonese|sichuan|szechuan|taiwanese|hong kong|burmese|cambodian|laotian)\b/],
  ["latin", /\b(latin|cuban|peruvian|brazilian|caribbean|colombian|argentin(?:e|ian)|chilean|puerto rican|dominican|venezuelan|jamaican|salvadoran)\b/],
  ["french", /\b(french|proven[cç]al|parisian)\b/],
  ["american", /\b(american|southern|cajun|creole|soul food|bbq|barbecue|tex-?mex|hawaiian|new england|midwestern|californian)\b/],
];

/** Map any recipeCuisine / keyword string to a cuisine id, or null. */
export function normalizeCuisine(text) {
  if (!text) return null;
  const s = String(text).toLowerCase();
  for (const [id, re] of CUISINE_PATTERNS) if (re.test(s)) return id;
  return null;
}

// schema.org RestrictedDiet values -> our diet ids. Only the ones we model.
export const SCHEMA_DIETS = {
  VeganDiet: "vegan",
  VegetarianDiet: "vegetarian",
  GlutenFreeDiet: "gluten-free",
  LowLactoseDiet: "dairy-free",
  LowCarbDiet: "low-carb",
};

export const ALL_TAG_IDS = new Set(
  [...DIET_TAGS, ...CUISINE_TAGS, ...MACRO_TAGS].map((t) => t.id),
);
