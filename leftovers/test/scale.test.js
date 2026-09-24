import { test } from "node:test";
import assert from "node:assert/strict";
import { parseYield, scaleFactor, describeScale } from "../shared/scale.js";

test("parseYield handles the shapes recipe sites actually emit", () => {
  assert.equal(parseYield("4").servings, 4);
  assert.equal(parseYield("4 servings").servings, 4);
  assert.equal(parseYield("Serves 4-6").servings, 4);
  assert.equal(parseYield("6 to 8 servings").servings, 6);
  assert.equal(parseYield(["4", "4 servings"]).servings, 4);
  assert.equal(parseYield("four").servings, 4);
  const cookies = parseYield("24 cookies");
  assert.equal(cookies.servings, null);
  assert.equal(cookies.count, 24);
  assert.equal(cookies.unit, "cookies");
  assert.equal(parseYield(["24 cookies", "12 servings"]).servings, 12);
  assert.equal(parseYield("1 9-inch pie").servings, null);
  assert.equal(parseYield(null).servings, null);
  assert.equal(parseYield("").servings, null);
});

test("scaleFactor rounds to quarters and never goes below a quarter", () => {
  assert.equal(scaleFactor(4, 4), 1);
  assert.equal(scaleFactor(4, 6), 1.5);
  assert.equal(scaleFactor(6, 4), 0.75);
  assert.equal(scaleFactor(12, 1), 0.25);
  assert.equal(scaleFactor(null, 4), null);
  assert.equal(describeScale(4, 12), "makes 4 · ×3 for 12");
  assert.equal(describeScale(null, 4), "yield unknown");
});
