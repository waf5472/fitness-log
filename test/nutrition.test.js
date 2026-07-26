import { test } from "node:test";
import assert from "node:assert/strict";
import { matchFood, resolveIngredient, computeMeal } from "../src/lib/nutrition.js";

const close = (a, b, tol) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} to be within ${tol} of ${b}`);

test("exact names and aliases match", () => {
  assert.equal(matchFood("raspberries").confidence, "exact");
  assert.equal(matchFood("greek yogurt").food.id, "greek_yogurt");
  assert.equal(matchFood("evoo").food.id, "olive_oil", "alias resolves");
  assert.equal(matchFood("garbanzo beans").food.id, "chickpeas");
});

test("preparation words do not block a match", () => {
  assert.equal(matchFood("diced yellow onion").food.id, "onion");
  assert.equal(matchFood("grilled chicken breast").food.id, "chicken_breast");
  assert.equal(matchFood("fresh baby spinach").food.id, "spinach");
});

test("nonsense matches nothing rather than something", () => {
  assert.equal(matchFood("zzzzqqq"), null);
  assert.equal(matchFood(""), null);
});

test("resolveIngredient computes macros from the table", () => {
  // 6 oz raspberries = 170.1 g; table says 52 kcal / 100 g.
  const r = resolveIngredient({ name: "raspberries", qty: 6, unit: "oz" });
  close(r.grams, 170.1, 0.5);
  close(r.kcal, 88, 1);
  assert.equal(r.source, "table");
});

test("resolveIngredient falls back to the model estimate for unknown foods", () => {
  const r = resolveIngredient({
    name: "grandma's mystery casserole",
    qty: 1,
    unit: "cup",
    est_grams: 240,
    est_kcal: 350,
    est_protein_g: 18,
    est_carb_g: 30,
    est_fat_g: 17,
  });
  assert.equal(r.source, "estimated");
  assert.equal(r.kcal, 350);
  assert.ok(r.warnings.length > 0, "an estimate must announce itself");
});

test("an unknown food with no estimate scores zero, not NaN", () => {
  const r = resolveIngredient({ name: "zzzzqqq", qty: 1, unit: "cup" });
  assert.equal(r.kcal, 0);
  assert.equal(r.source, "unknown");
  assert.ok(Number.isFinite(r.protein_g));
});

test("the parfait from the spec adds up", () => {
  const meal = computeMeal({
    name: "Parfait",
    slot: "breakfast",
    ingredients: [
      { name: "raspberries", qty: 6, unit: "oz" },
      { name: "greek yogurt", qty: 1, unit: "cup" },
      { name: "chia seeds", qty: 1, unit: "tsp" },
    ],
  });

  // 170g raspberries (88) + 245g nonfat greek yogurt (145) + 4g chia (19)
  close(meal.kcal, 252, 8);
  close(meal.protein_g, 27.5, 2);
  assert.equal(meal.confidence, "exact");
  assert.equal(meal.ingredients.length, 3);
});

test("the stir fry from the spec adds up", () => {
  const meal = computeMeal({
    name: "Stir fry",
    slot: "dinner",
    ingredients: [
      { name: "chicken breast", qty: 1, unit: "each" },
      { name: "bell pepper", qty: 1, unit: "each" },
      { name: "onion", qty: 1, unit: "each" },
      { name: "kung pao sauce", qty: 0.25, unit: "cup" },
      { name: "olive oil", qty: 1, unit: "tsp" },
    ],
  });

  // 174g chicken (209) + 119g pepper (31) + 110g onion (44)
  // + 68g sauce (102) + 4.5g oil (40)
  close(meal.kcal, 426, 20);
  close(meal.protein_g, 41, 3);
  assert.ok(meal.kcal > 0 && meal.fat_g > 0);
});

test("totals equal the sum of their parts", () => {
  const meal = computeMeal({
    name: "Test",
    ingredients: [
      { name: "almonds", qty: 1, unit: "oz" },
      { name: "banana", qty: 1, unit: "each" },
    ],
  });
  const manual = meal.ingredients.reduce((a, i) => a + i.kcal, 0);
  close(meal.kcal, manual, 1);
});
