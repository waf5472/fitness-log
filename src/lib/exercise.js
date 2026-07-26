// Exercise -> calories. Two methods, picked by what the entry actually contains:
//
//   1. ACSM metabolic equations for anything with distance + time (run, walk,
//      hike). These take grade directly, so elevation gain is a real input
//      rather than a fudge factor.
//   2. Compendium MET values for everything else (kayak, row, lift, yoga).
//
// Both report NET calories — gross expenditure minus what you would have burned
// resting for the same minutes. That matters because goals.js already counts
// resting metabolism in your daily target; adding gross exercise on top would
// double-count an hour of BMR every time you go for a run.

const KCAL_PER_L_O2 = 5.0;
const RESTING_VO2 = 3.5; // mL O2 / kg / min, the definition of 1 MET
const M_PER_MILE = 1609.344;
const M_PER_FOOT = 0.3048;
const KG_PER_LB = 0.453592;

// MET values from the 2011 Compendium of Physical Activities.
export const ACTIVITIES = {
  run: { label: "Run", equation: "run", met: 9.8, tracks: ["distance", "duration", "elevation"] },
  walk: { label: "Walk", equation: "walk", met: 3.5, tracks: ["distance", "duration", "elevation"] },
  hike: { label: "Hike", equation: "walk", met: 6.0, tracks: ["distance", "duration", "elevation"] },
  bike: { label: "Bike", equation: "bike", met: 8.0, tracks: ["distance", "duration", "elevation"] },
  kayak: { label: "Kayak", met: 5.0, tracks: ["distance", "duration"] },
  canoe: { label: "Canoe", met: 5.0, tracks: ["distance", "duration"] },
  paddleboard: { label: "Paddleboard", met: 6.0, tracks: ["distance", "duration"] },
  swim: { label: "Swim", met: 7.0, tracks: ["distance", "duration"] },
  row: { label: "Row", met: 7.0, tracks: ["distance", "duration"] },
  elliptical: { label: "Elliptical", met: 5.0, tracks: ["duration"] },
  stairs: { label: "Stair climber", met: 9.0, tracks: ["duration", "elevation"] },
  strength: { label: "Strength training", met: 5.0, tracks: ["duration"] },
  yoga: { label: "Yoga", met: 3.0, tracks: ["duration"] },
  pilates: { label: "Pilates", met: 3.0, tracks: ["duration"] },
  hiit: { label: "HIIT", met: 8.0, tracks: ["duration"] },
  jump_rope: { label: "Jump rope", met: 12.3, tracks: ["duration"] },
  climbing: { label: "Climbing", met: 8.0, tracks: ["duration"] },
  ski: { label: "Skiing", met: 7.0, tracks: ["duration", "distance", "elevation"] },
  snowboard: { label: "Snowboarding", met: 5.3, tracks: ["duration"] },
  skate: { label: "Skating", met: 7.0, tracks: ["duration", "distance"] },
  soccer: { label: "Soccer", met: 7.0, tracks: ["duration"] },
  basketball: { label: "Basketball", met: 6.5, tracks: ["duration"] },
  tennis: { label: "Tennis", met: 7.3, tracks: ["duration"] },
  golf: { label: "Golf", met: 4.8, tracks: ["duration", "distance"] },
  surf: { label: "Surfing", met: 3.0, tracks: ["duration"] },
  other: { label: "Other", met: 5.0, tracks: ["duration", "distance", "elevation"] },
};

// Cycling economy depends on speed far more than the other modes, and the ACSM
// ergometer equation needs power output we do not have outdoors. Speed bands
// from the Compendium are the practical substitute.
function bikeMet(mph) {
  if (mph < 10) return 4.0;
  if (mph < 12) return 6.8;
  if (mph < 14) return 8.0;
  if (mph < 16) return 10.0;
  if (mph < 20) return 12.0;
  return 15.8;
}

/** ACSM running equation. speed in m/min, grade as a fraction. -> mL/kg/min */
function runVO2(speedMPerMin, grade) {
  return 0.2 * speedMPerMin + 0.9 * speedMPerMin * grade + RESTING_VO2;
}

/** ACSM walking equation. Valid roughly 50-100 m/min; used for walk and hike. */
function walkVO2(speedMPerMin, grade) {
  return 0.1 * speedMPerMin + 1.8 * speedMPerMin * grade + RESTING_VO2;
}

/**
 * @param {object} entry
 *   activity      key of ACTIVITIES
 *   distance_mi   optional
 *   duration_min  required for any calorie estimate
 *   elev_ft       optional, total gain
 * @param {number} weightLb  body weight
 */
export function computeExercise(entry, weightLb) {
  const activity = entry.activity && ACTIVITIES[entry.activity] ? entry.activity : "other";
  const spec = ACTIVITIES[activity];
  const kg = (weightLb || 160) * KG_PER_LB;

  const duration = num(entry.duration_min);
  const distance = num(entry.distance_mi);
  const elev = num(entry.elev_ft);
  const warnings = [];

  if (!duration || duration <= 0) {
    return {
      kind: "exercise",
      activity,
      label: spec.label,
      name: entry.name || spec.label,
      distance_mi: distance || null,
      duration_min: null,
      elev_ft: elev || null,
      kcal: 0,
      kcal_gross: 0,
      met: null,
      pace_min_per_mi: null,
      speed_mph: null,
      grade_pct: null,
      method: "none",
      warnings: ["Duration is required to estimate calories."],
    };
  }

  const speedMph = distance ? distance / (duration / 60) : null;
  // Total gain over total distance: the standard approximation for a route
  // whose ups and downs are not separately recorded. It slightly overstates a
  // there-and-back, since the descent is credited as flat rather than negative.
  const grade = distance && elev ? (elev * M_PER_FOOT) / (distance * M_PER_MILE) : 0;

  let vo2Gross;
  let method;

  if (spec.equation === "run" && distance) {
    vo2Gross = runVO2((distance * M_PER_MILE) / duration, grade);
    method = "ACSM running equation";
  } else if (spec.equation === "walk" && distance) {
    const speedMPerMin = (distance * M_PER_MILE) / duration;
    vo2Gross = walkVO2(speedMPerMin, grade);
    method = "ACSM walking equation";
    if (speedMPerMin > 107) {
      warnings.push("Pace is above the walking equation's validated range; treat as approximate.");
    }
  } else if (spec.equation === "bike" && speedMph) {
    vo2Gross = bikeMet(speedMph) * RESTING_VO2;
    method = `MET table (cycling at ${speedMph.toFixed(1)} mph)`;
  } else {
    vo2Gross = spec.met * RESTING_VO2;
    method = `MET table (${spec.met} MET)`;
    if (spec.equation && !distance) {
      warnings.push("No distance given, so a flat MET value was used instead of the ACSM equation.");
    }
  }

  const vo2Net = Math.max(vo2Gross - RESTING_VO2, 0);
  const kcalGross = (vo2Gross * kg * duration * KCAL_PER_L_O2) / 1000;
  const kcalNet = (vo2Net * kg * duration * KCAL_PER_L_O2) / 1000;

  return {
    kind: "exercise",
    activity,
    label: spec.label,
    name: entry.name || spec.label,
    distance_mi: distance || null,
    duration_min: duration,
    elev_ft: elev || null,
    kcal: Math.round(kcalNet),
    kcal_gross: Math.round(kcalGross),
    met: round(vo2Gross / RESTING_VO2, 1),
    pace_min_per_mi: distance ? round(duration / distance, 2) : null,
    speed_mph: speedMph ? round(speedMph, 2) : null,
    grade_pct: grade ? round(grade * 100, 1) : null,
    method,
    warnings,
  };
}

/** "8:34/mi" from a decimal minutes-per-mile pace. */
export function formatPace(minPerMi) {
  if (!minPerMi || !Number.isFinite(minPerMi)) return "—";
  const m = Math.floor(minPerMi);
  const s = Math.round((minPerMi - m) * 60);
  return s === 60 ? `${m + 1}:00/mi` : `${m}:${String(s).padStart(2, "0")}/mi`;
}

function num(v) {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function round(n, places = 0) {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}
