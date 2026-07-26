import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bmr,
  baseTdee,
  dailyTargets,
  summarizeDay,
  hitCalorieGoal,
  loggingStreak,
  weeklyVolume,
  weightTrend,
  predictedVsActual,
  shiftDate,
  daysBetween,
  DEFAULT_PROFILE,
} from "../src/lib/goals.js";

const close = (a, b, tol) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} to be within ${tol} of ${b}`);

const profile = { ...DEFAULT_PROFILE, sex: "male", age: 35, height_in: 70, weight_lb: 175 };

test("Mifflin-St Jeor matches the published formula", () => {
  // 79.4 kg, 177.8 cm, 35 y, male: 10*79.4 + 6.25*177.8 - 5*35 + 5 = 1735
  close(bmr(profile), 1735, 5);
  close(bmr({ ...profile, sex: "female" }), 1569, 5);
});

test("the activity factor covers daily living, not workouts", () => {
  const base = baseTdee({ ...profile, activity_factor: 1.3 });
  close(base, 2256, 10);
  // A run must add on top of the base, never be folded into the multiplier.
  const t = dailyTargets({ ...profile, goal_rate_lb_wk: 0 }, 600);
  close(t.kcal, base + 600, 2);
});

test("goal rate converts at 3500 kcal per pound", () => {
  const cut = dailyTargets({ ...profile, goal_rate_lb_wk: -1 }, 0);
  const maintain = dailyTargets({ ...profile, goal_rate_lb_wk: 0 }, 0);
  close(maintain.kcal - cut.kcal, 500, 2);

  const bulk = dailyTargets({ ...profile, goal_rate_lb_wk: 0.5 }, 0);
  close(bulk.kcal - maintain.kcal, 250, 2);
});

test("macro targets are internally consistent", () => {
  const t = dailyTargets(profile, 0);
  assert.equal(t.protein_g, Math.round(0.8 * 175));
  const fromMacros = t.protein_g * 4 + t.carb_g * 4 + t.fat_g * 9;
  close(fromMacros, t.kcal, 12);
});

test("summarizeDay separates eaten, burned and net", () => {
  const s = summarizeDay([
    { kind: "meal", kcal: 600, protein_g: 40, carb_g: 50, fat_g: 20 },
    { kind: "meal", kcal: 500, protein_g: 30, carb_g: 60, fat_g: 15 },
    { kind: "exercise", kcal: 400, duration_min: 45, distance_mi: 5 },
    { kind: "weight", weight_lb: 174.2 },
  ]);
  assert.equal(s.eaten, 1100);
  assert.equal(s.burned, 400);
  assert.equal(s.net, 700);
  assert.equal(s.protein_g, 70);
  assert.equal(s.weight_lb, 174.2);
  assert.equal(s.mealCount, 2);
});

test("goal evaluation flips direction between cutting and bulking", () => {
  const targets = { kcal: 2000 };
  const under = { eaten: 1800, mealCount: 3 };
  const over = { eaten: 2300, mealCount: 3 };

  assert.equal(hitCalorieGoal(under, targets, { goal_rate_lb_wk: -1 }), true);
  assert.equal(hitCalorieGoal(over, targets, { goal_rate_lb_wk: -1 }), false);
  assert.equal(hitCalorieGoal(over, targets, { goal_rate_lb_wk: 1 }), true);
  assert.equal(hitCalorieGoal({ eaten: 2050, mealCount: 2 }, targets, { goal_rate_lb_wk: 0 }), true);
});

test("a day with nothing logged is not counted as a miss", () => {
  assert.equal(hitCalorieGoal({ eaten: 0, mealCount: 0 }, { kcal: 2000 }, profile), null);
});

test("streak counts back from today and stops at the first gap", () => {
  const today = "2026-07-26";
  const byDate = {
    "2026-07-26": [{}],
    "2026-07-25": [{}],
    "2026-07-24": [{}],
    // 07-23 missing
    "2026-07-22": [{}],
  };
  assert.equal(loggingStreak(byDate, today), 3);
  assert.equal(loggingStreak({}, today), 0);
});

test("weekly volume compares actuals against per-activity targets", () => {
  const entries = [
    { kind: "exercise", activity: "run", distance_mi: 6, duration_min: 50 },
    { kind: "exercise", activity: "run", distance_mi: 4, duration_min: 35 },
    { kind: "exercise", activity: "hike", elev_ft: 1200 },
  ];
  const rows = weeklyVolume(entries, {
    run: { distance_mi: 20 },
    hike: { elev_ft: 3000 },
  });

  const run = rows.find((r) => r.activity === "run" && r.metric === "distance_mi");
  assert.equal(run.actual, 10);
  close(run.pct, 0.5, 0.001);

  const hike = rows.find((r) => r.activity === "hike");
  assert.equal(hike.actual, 1200);
});

test("weight trend smooths noise without changing direction", () => {
  const pts = [
    { date: "2026-07-01", weight_lb: 180 },
    { date: "2026-07-02", weight_lb: 183 }, // water spike
    { date: "2026-07-03", weight_lb: 179 },
    { date: "2026-07-04", weight_lb: 178 },
  ];
  const out = weightTrend(pts, 0.3);
  assert.equal(out[0].trend_lb, 180);
  assert.ok(out[1].trend_lb < 183, "the spike is damped");
  assert.ok(out[3].trend_lb < out[0].trend_lb, "the downward trend survives");
});

test("predicted weight change is derived from logged deficits", () => {
  const days = [];
  for (let i = 0; i < 15; i++) {
    const date = shiftDate("2026-07-01", i);
    days.push({
      date,
      summary: {
        eaten: 1756, // ~500 under a 2256 maintenance
        burned: 0,
        mealCount: 3,
        weight_lb: i === 0 ? 175 : i === 14 ? 173 : null,
      },
    });
  }
  const r = predictedVsActual(days, { ...profile, activity_factor: 1.3 });
  assert.equal(r.days, 14);
  close(r.predicted_lb, -2, 0.35);
  assert.equal(r.actual_lb, -2);
});

test("predictedVsActual needs two weigh-ins", () => {
  assert.equal(predictedVsActual([], profile), null);
});

test("date helpers round-trip", () => {
  assert.equal(shiftDate("2026-07-26", -1), "2026-07-25");
  assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
  assert.equal(daysBetween("2026-07-01", "2026-07-15"), 14);
});
