// Body stats -> daily targets, and logged days -> progress against them.
//
// The calorie budget is built as:
//     BMR (Mifflin-St Jeor) x activity factor   <- resting + daily living
//   + net exercise calories logged that day     <- from exercise.js
//   + goal adjustment (3500 kcal per lb/week)   <- negative when cutting
//
// The activity factor here deliberately covers only non-exercise movement. The
// familiar 1.55 / 1.725 "moderately active" multipliers already bake workouts
// in, so pairing one with logged exercise would count every session twice.

export const ACTIVITY_FACTORS = [
  { value: 1.2, label: "Desk job, little walking" },
  { value: 1.3, label: "On your feet part of the day" },
  { value: 1.4, label: "Mostly standing or walking" },
  { value: 1.5, label: "Physical job" },
];

export const DEFAULT_PROFILE = {
  sex: "male",
  age: 35,
  height_in: 70,
  weight_lb: 175,
  activity_factor: 1.3,
  goal_rate_lb_wk: -0.5,
  protein_g_per_lb: 0.8,
  fat_pct: 0.3,
  targets: {
    run: { distance_mi: 15, duration_min: 150 },
    hike: { elev_ft: 3000 },
  },
};

const KCAL_PER_LB_FAT = 3500;

/** Mifflin-St Jeor resting metabolic rate, kcal/day. */
export function bmr({ sex, age, height_in, weight_lb }) {
  const kg = (weight_lb || 0) * 0.453592;
  const cm = (height_in || 0) * 2.54;
  const base = 10 * kg + 6.25 * cm - 5 * (age || 0);
  if (sex === "female") return Math.round(base - 161);
  if (sex === "other") return Math.round(base - 78); // midpoint of the two constants
  return Math.round(base + 5);
}

/** Resting + daily living, before any exercise is added. */
export function baseTdee(profile) {
  return Math.round(bmr(profile) * (profile.activity_factor || 1.2));
}

/**
 * Targets for a single day.
 * @param {object} profile
 * @param {number} exerciseKcal  net calories logged for that day
 */
export function dailyTargets(profile, exerciseKcal = 0) {
  const base = baseTdee(profile);
  const adjustment = ((profile.goal_rate_lb_wk || 0) * KCAL_PER_LB_FAT) / 7;
  const kcal = Math.round(base + exerciseKcal + adjustment);

  const protein_g = Math.round((profile.protein_g_per_lb || 0.8) * (profile.weight_lb || 0));
  const proteinKcal = protein_g * 4;
  const fatKcal = Math.max(kcal - proteinKcal, 0) * (profile.fat_pct ?? 0.3);
  const fat_g = Math.round(fatKcal / 9);
  const carb_g = Math.max(Math.round((kcal - proteinKcal - fatKcal) / 4), 0);

  return {
    kcal,
    base_tdee: base,
    exercise_kcal: Math.round(exerciseKcal),
    adjustment: Math.round(adjustment),
    protein_g,
    fat_g,
    carb_g,
  };
}

/** Roll a day's entries into eaten / burned / net and per-macro sums. */
export function summarizeDay(entries) {
  const meals = entries.filter((e) => e.kind === "meal");
  const exercises = entries.filter((e) => e.kind === "exercise");
  const weights = entries.filter((e) => e.kind === "weight");

  const eaten = sum(meals, "kcal");
  const burned = sum(exercises, "kcal");

  return {
    eaten: Math.round(eaten),
    burned: Math.round(burned),
    net: Math.round(eaten - burned),
    protein_g: round(sum(meals, "protein_g"), 1),
    carb_g: round(sum(meals, "carb_g"), 1),
    fat_g: round(sum(meals, "fat_g"), 1),
    fiber_g: round(sum(meals, "fiber_g"), 1),
    duration_min: round(sum(exercises, "duration_min"), 0),
    distance_mi: round(sum(exercises, "distance_mi"), 2),
    elev_ft: round(sum(exercises, "elev_ft"), 0),
    weight_lb: weights.length ? weights[weights.length - 1].weight_lb : null,
    mealCount: meals.length,
    exerciseCount: exercises.length,
  };
}

/**
 * Did this day hit its calorie goal? Cutting means at or under target; bulking
 * means at or over; maintaining allows a band either side.
 */
export function hitCalorieGoal(summary, targets, profile) {
  if (summary.mealCount === 0) return null; // nothing logged, not a miss
  const rate = profile.goal_rate_lb_wk || 0;
  if (rate < 0) return summary.eaten <= targets.kcal;
  if (rate > 0) return summary.eaten >= targets.kcal;
  return Math.abs(summary.eaten - targets.kcal) <= 150;
}

/** Consecutive days ending today with something logged. */
export function loggingStreak(entriesByDate, today = todayISO()) {
  let streak = 0;
  const cursor = new Date(`${today}T12:00:00`);
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if ((entriesByDate[key] || []).length === 0) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Weekly exercise volume vs targets.
 * @param {Array} entries  exercise entries from the last 7 days
 * @param {object} targets profile.targets, keyed by activity
 */
export function weeklyVolume(entries, targets = {}) {
  const out = [];
  for (const [activity, goals] of Object.entries(targets || {})) {
    const mine = entries.filter((e) => e.kind === "exercise" && e.activity === activity);
    for (const [metric, target] of Object.entries(goals || {})) {
      if (!target) continue;
      const actual = sum(mine, metric);
      out.push({
        activity,
        metric,
        actual: round(actual, metric === "distance_mi" ? 2 : 0),
        target,
        pct: target > 0 ? Math.min(actual / target, 2) : 0,
      });
    }
  }
  return out;
}

/**
 * Exponentially-weighted weight trend. Daily scale weight is mostly water; the
 * smoothed line is what you actually want to steer by.
 * @param {Array<{date: string, weight_lb: number}>} points  ascending by date
 * @param {number} alpha  smoothing factor; 0.1 ~= a 2-week trend
 */
export function weightTrend(points, alpha = 0.1) {
  let ema = null;
  return points.map((p) => {
    ema = ema == null ? p.weight_lb : alpha * p.weight_lb + (1 - alpha) * ema;
    return { date: p.date, weight_lb: p.weight_lb, trend_lb: round(ema, 2) };
  });
}

/**
 * Compare the weight change the log predicts against what the scale says.
 * A persistent gap usually means the calorie estimates are off, not physics.
 */
export function predictedVsActual(days, profile) {
  const withWeight = days.filter((d) => d.summary.weight_lb != null);
  if (withWeight.length < 2) return null;

  const first = withWeight[0];
  const last = withWeight[withWeight.length - 1];
  const spanDays = daysBetween(first.date, last.date);
  if (spanDays < 1) return null;

  const inSpan = days.filter((d) => d.date >= first.date && d.date <= last.date);
  const logged = inSpan.filter((d) => d.summary.mealCount > 0);
  if (logged.length === 0) return null;

  const avgDailyDelta =
    logged.reduce((acc, d) => {
      const t = dailyTargets(profile, d.summary.burned);
      // Deficit relative to maintenance, i.e. excluding the goal adjustment.
      return acc + (d.summary.eaten - (t.base_tdee + t.exercise_kcal));
    }, 0) / logged.length;

  const predictedLb = (avgDailyDelta * spanDays) / KCAL_PER_LB_FAT;
  const actualLb = last.summary.weight_lb - first.summary.weight_lb;

  return {
    days: spanDays,
    daysLogged: logged.length,
    predicted_lb: round(predictedLb, 2),
    actual_lb: round(actualLb, 2),
    predicted_rate_lb_wk: round((predictedLb / spanDays) * 7, 2),
    actual_rate_lb_wk: round((actualLb / spanDays) * 7, 2),
  };
}

export function todayISO(d = new Date()) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  return Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
}

export function shiftDate(iso, delta) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function sum(rows, key) {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

function round(n, places = 0) {
  const f = 10 ** places;
  return Math.round((n || 0) * f) / f;
}
