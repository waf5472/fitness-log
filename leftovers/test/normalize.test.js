import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseIngredient, parseIngredientAll, normalizeIngredients,
  inferDietTags, inferMacroTags, claimedDietTags, resolveCuisine,
} from "../shared/normalize.js";

const canon = (s) => parseIngredient(s).canonical;

test("quantities, units and prep are stripped before lookup", () => {
  assert.equal(canon("2 boneless, skinless chicken thighs (about 1 lb), trimmed"), "chicken");
  assert.equal(canon("1 (14 oz) can coconut milk, full-fat"), "coconut-milk");
  assert.equal(canon("3 cloves garlic, minced"), "garlic");
  assert.equal(canon("½ cup extra-virgin olive oil, divided"), "olive-oil");
  assert.equal(canon("1 ½ lbs Yukon Gold potatoes, cut into 1-inch chunks"), "potato");
  assert.equal(canon("2 Tbsp. low-sodium soy sauce or tamari"), "soy-sauce");
  assert.equal(canon("Juice of 1 lemon"), "lemon");
  assert.equal(canon("1 x 400g tin chopped tomatoes"), "canned-tomato");
});

test("longest synonym wins over its substrings", () => {
  assert.equal(canon("4 cups chicken broth"), "broth");
  assert.equal(canon("1 cup coconut milk"), "coconut-milk");
  assert.equal(canon("2 tbsp peanut butter"), "peanut-butter");
  assert.equal(canon("1 tsp smoked paprika"), "smoked-paprika");
  assert.equal(canon("1 tsp paprika"), "paprika");
  assert.equal(canon("1/2 cup sun-dried tomatoes in oil, drained"), "sun-dried-tomato");
  assert.equal(canon("1 cup cherry tomatoes"), "tomato");
  assert.equal(canon("2 green onions, sliced"), "green-onion");
  assert.equal(canon("1 red onion"), "onion");
});

test("identity words survive: flakes are not bell peppers, scotch fillet is beef", () => {
  assert.equal(canon("1/4 tsp crushed red pepper flakes"), "red-pepper-flakes");
  assert.equal(canon("red pepper flakes"), "red-pepper-flakes");
  assert.equal(canon("1 red pepper, sliced"), "bell-pepper");
  assert.equal(canon("2 roasted red peppers from a jar"), "bell-pepper");
  assert.equal(canon("600g scotch fillet steak, sliced"), "beef");
  assert.equal(canon("1 scotch bonnet, deseeded"), "chili-pepper");
  assert.equal(canon("2 salmon fillets, skin on"), "salmon");
  assert.equal(canon("4 fillets of cod"), "cod");
  assert.equal(canon("2 tbsp mayo"), "mayonnaise");
  assert.equal(canon("1 cup frozen peas and carrots"), "peas");
  assert.equal(canon("1 tsp hot sauce"), "hot-sauce");
  assert.equal(canon("1 can chopped tomatoes"), "canned-tomato");
  assert.equal(canon("1 egg, beaten with 1 tbsp milk"), "egg");
  assert.equal(canon("juice from 2 limes"), "lime");
  assert.equal(canon("1 tbsp butter or olive oil"), "butter");
});

test("plurals and regional spellings resolve", () => {
  assert.equal(canon("3 courgettes"), "zucchini");
  assert.equal(canon("2 aubergines"), "eggplant");
  assert.equal(canon("1 bunch coriander, chopped"), "cilantro");
  assert.equal(canon("2 capsicums"), "bell-pepper");
  assert.equal(canon("handful of rocket"), "lettuce");
  assert.equal(canon("6 cups baby spinach leaves"), "spinach");
});

test("salt and pepper splits into both", () => {
  const all = parseIngredientAll("Kosher salt and freshly ground black pepper").map((p) => p.canonical);
  assert.deepEqual(all, ["salt", "black-pepper"]);
});

test("optional and garnish lines are flagged, unknowns come back null", () => {
  const p = parseIngredient("Chopped parsley, for garnish (optional)");
  assert.equal(p.canonical, "parsley");
  assert.equal(p.optional, true);
  const u = parseIngredient("2 tbsp xanthium seed dust");
  assert.equal(u.canonical, null);
  assert.equal(u.phrase, "xanthium seed dust");
});

test("normalizeIngredients dedupes and keeps the unresolved list", () => {
  const r = normalizeIngredients([
    "2 tbsp olive oil",
    "1 tbsp olive oil, for drizzling",
    "1 onion, diced",
    "1 lb ground beef",
    "2 tbsp dragonfruit powder",
    "Salt and pepper to taste",
  ]);
  const ids = r.ingredients.map((i) => i.canonical);
  assert.deepEqual(ids, ["olive-oil", "onion", "beef", "salt", "black-pepper"]);
  assert.equal(r.ingredients.find((i) => i.canonical === "olive-oil").optional, false);
  assert.deepEqual(r.unresolved, ["dragonfruit powder"]);
});

test("diet inference: honey breaks vegan, fish sauce breaks vegetarian", () => {
  assert.ok(!inferDietTags(["tofu", "rice", "honey"], { claimed: ["vegan"] }).includes("vegan"));
  assert.ok(inferDietTags(["tofu", "rice", "maple-syrup"], { claimed: ["vegan"] }).includes("vegan"));
  const pad = inferDietTags(["noodles", "egg", "fish-sauce", "peanut"], { claimed: ["vegetarian"] });
  assert.ok(!pad.includes("vegetarian"));
  assert.ok(pad.includes("pescatarian"));
  // Unresolved lines block inference-only tags but not claimed-and-consistent ones.
  const partial = inferDietTags(["rice", "onion"], { unresolvedCount: 2 });
  assert.deepEqual(partial, []);
  const claimedGF = inferDietTags(["rice", "chicken"], { claimed: ["gluten-free"] });
  assert.ok(claimedGF.includes("gluten-free"));
  assert.ok(!inferDietTags(["pasta"], { claimed: ["gluten-free"] }).includes("gluten-free"));
});

test("macro tags prefer nutrition data and fall back to inference", () => {
  const n = inferMacroTags({ proteinContent: "38 g", carbohydrateContent: "12 g", fatContent: "20 g", calories: "380 calories" }, []);
  assert.equal(n.source, "nutrition");
  assert.ok(n.tags.includes("protein-heavy"));
  assert.ok(n.tags.includes("low-carb"));
  const i = inferMacroTags(null, ["pasta", "canned-tomato", "garlic", "olive-oil"]);
  assert.equal(i.source, "inferred");
  assert.deepEqual(i.tags, ["carb-heavy"]);
});

test("claimed tags and cuisine come from schema fields and keywords", () => {
  const r = {
    suitableForDiet: ["https://schema.org/VeganDiet", "GlutenFreeDiet"],
    keywords: "weeknight, dairy free, thai curry",
    recipeCuisine: ["Thai"],
  };
  assert.deepEqual(claimedDietTags(r).sort(), ["dairy-free", "gluten-free", "vegan"]);
  assert.equal(resolveCuisine(r), "asian");
  assert.equal(resolveCuisine({ keywords: "easy pasta" }, "italian"), "italian");
  assert.equal(resolveCuisine({ recipeCuisine: "Tex-Mex" }), "mexican");
});
