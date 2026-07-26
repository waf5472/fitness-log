import { test } from "node:test";
import assert from "node:assert/strict";
import { toGrams, parseQty, normalizeUnit } from "../src/lib/units.js";
import { matchFood } from "../src/lib/nutrition.js";

const close = (a, b, tol = 0.5) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} to be within ${tol} of ${b}`);

test("parseQty handles decimals, fractions, mixed numbers and vulgar glyphs", () => {
  assert.equal(parseQty(2), 2);
  assert.equal(parseQty("0.25"), 0.25);
  assert.equal(parseQty("1/4"), 0.25);
  assert.equal(parseQty("1 1/2"), 1.5);
  assert.equal(parseQty("½"), 0.5);
  assert.equal(parseQty("¾"), 0.75);
  assert.equal(parseQty(null), 1, "missing quantity defaults to one");
  assert.equal(parseQty("garbage"), 1);
});

test("normalizeUnit folds plurals and trailing periods", () => {
  assert.equal(normalizeUnit("slices"), "slice");
  assert.equal(normalizeUnit("tbsp."), "tbsp");
  assert.equal(normalizeUnit("CUPS"), "cups");
  assert.equal(normalizeUnit(undefined), "each");
});

test("mass units convert without touching the food table", () => {
  close(toGrams(6, "oz", null).grams, 170.1);
  close(toGrams(1, "lb", null).grams, 453.6);
  close(toGrams(250, "g", null).grams, 250);
});

test("a food's own units win over generic volume", () => {
  // The whole point: a cup is not 237 g of everything.
  const spinach = matchFood("spinach").food;
  close(toGrams(1, "cup", spinach).grams, 30);

  const oil = matchFood("olive oil").food;
  close(toGrams(1, "tbsp", oil).grams, 13.5);

  const rasp = matchFood("raspberries").food;
  close(toGrams(1, "cup", rasp).grams, 123);
});

test("volume falls back to density, and flags the guess when there is none", () => {
  const milk = matchFood("whole milk").food;
  // Milk has an explicit cup weight; use a unit it lacks to exercise density.
  const r = toGrams(500, "ml", milk);
  close(r.grams, 515);
  assert.equal(r.assumed, false);

  const unknown = toGrams(1, "cup", null);
  close(unknown.grams, 236.6);
  assert.equal(unknown.assumed, true, "no density known, so the result is flagged");
});

test("an unknown count unit resolves to null rather than a wrong number", () => {
  const r = toGrams(2, "handful", matchFood("almonds").food);
  assert.equal(r.grams, null);
});
