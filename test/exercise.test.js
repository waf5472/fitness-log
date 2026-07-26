import { test } from "node:test";
import assert from "node:assert/strict";
import { computeExercise, formatPace } from "../src/lib/exercise.js";

const close = (a, b, tol) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} to be within ${tol} of ${b}`);

test("a flat run uses the ACSM running equation", () => {
  // 5 mi in 40 min = 201 m/min. VO2 = 0.2*201 + 3.5 = 43.7 gross, 40.2 net.
  // net kcal = 40.2 * 72.6 kg * 40 min * 5 / 1000 = 583
  const r = computeExercise(
    { activity: "run", distance_mi: 5, duration_min: 40 },
    160,
  );
  assert.match(r.method, /running equation/);
  close(r.kcal, 583, 25);
  close(r.pace_min_per_mi, 8, 0.01);
  close(r.speed_mph, 7.5, 0.01);
  assert.equal(r.grade_pct, null);
});

test("elevation gain raises the burn on the same distance and time", () => {
  const flat = computeExercise({ activity: "hike", distance_mi: 6, duration_min: 130 }, 175);
  const climb = computeExercise(
    { activity: "hike", distance_mi: 6, duration_min: 130, elev_ft: 1400 },
    175,
  );
  assert.ok(climb.kcal > flat.kcal, "1400 ft of gain must cost something");
  assert.ok(climb.grade_pct > 0);
  assert.match(climb.method, /walking equation/);
});

test("net calories are always below gross by roughly one MET-hour", () => {
  const r = computeExercise({ activity: "run", distance_mi: 6, duration_min: 48 }, 180);
  assert.ok(r.kcal < r.kcal_gross);
  // The gap is resting metabolism for the session: 1 MET * kg * hours.
  const kg = 180 * 0.453592;
  close(r.kcal_gross - r.kcal, (3.5 * kg * 48 * 5) / 1000, 3);
});

test("activities without an equation use their MET value", () => {
  // Kayak, 5.0 MET, 90 min, 170 lb (77.1 kg).
  // net = (5.0-1) * 3.5 * 77.1 * 90 * 5 / 1000 = 486
  const r = computeExercise({ activity: "kayak", distance_mi: 4, duration_min: 90 }, 170);
  assert.match(r.method, /MET table/);
  close(r.kcal, 486, 20);
  close(r.speed_mph, 2.67, 0.01);
});

test("cycling picks a MET band from speed", () => {
  const slow = computeExercise({ activity: "bike", distance_mi: 8, duration_min: 60 }, 170);
  const fast = computeExercise({ activity: "bike", distance_mi: 18, duration_min: 60 }, 170);
  assert.ok(fast.kcal > slow.kcal * 2, "18 mph should cost far more than 8 mph");
});

test("heavier riders burn more for identical work", () => {
  const light = computeExercise({ activity: "run", distance_mi: 3, duration_min: 27 }, 130);
  const heavy = computeExercise({ activity: "run", distance_mi: 3, duration_min: 27 }, 220);
  assert.ok(heavy.kcal > light.kcal);
  close(heavy.kcal / light.kcal, 220 / 130, 0.05);
});

test("a missing duration returns zero and says why", () => {
  const r = computeExercise({ activity: "run", distance_mi: 5 }, 170);
  assert.equal(r.kcal, 0);
  assert.equal(r.method, "none");
  assert.ok(r.warnings.length > 0);
});

test("an unrecognized activity falls back to a generic MET", () => {
  const r = computeExercise({ activity: "underwater basket weaving", duration_min: 30 }, 170);
  assert.equal(r.activity, "other");
  assert.ok(r.kcal > 0);
});

test("formatPace renders minutes and seconds", () => {
  assert.equal(formatPace(8), "8:00/mi");
  assert.equal(formatPace(8.5), "8:30/mi");
  assert.equal(formatPace(7.99), "7:59/mi");
  assert.equal(formatPace(null), "—");
});
