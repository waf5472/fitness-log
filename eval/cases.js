// Labelled extraction cases. Each `check` returns a list of failures, so a case
// can fail on several axes at once and you see all of them.
//
// The assertions are deliberately loose about anything cosmetic — entry names,
// exact wording — and strict about the things the calculator depends on:
// quantities, units, unit conversions, entry splitting, and the rule that
// ordinary foods must NOT carry a model-computed calorie count.

const near = (a, b, tol) => a != null && Math.abs(a - b) <= tol;

const ing = (entry, pattern) =>
  (entry?.ingredients || []).find((i) => new RegExp(pattern, "i").test(i.name || ""));

export const CASES = [
  {
    id: "parfait",
    text: "parfait with 6oz raspberries, 1 cup Greek yogurt, 1 tsp chia seeds",
    check(r) {
      const f = [];
      if (r.entries.length !== 1) f.push(`expected 1 entry, got ${r.entries.length}`);
      const e = r.entries[0];
      if (e?.kind !== "meal") f.push(`kind=${e?.kind}`);
      if ((e?.ingredients || []).length !== 3) f.push(`ingredients=${e?.ingredients?.length}`);

      const rasp = ing(e, "raspberr");
      if (!near(rasp?.qty, 6, 0.01) || !/oz|ounce/i.test(rasp?.unit || "")) {
        f.push(`raspberries: ${rasp?.qty} ${rasp?.unit}`);
      }
      const yog = ing(e, "yogurt|yoghurt");
      if (!near(yog?.qty, 1, 0.01) || !/cup/i.test(yog?.unit || "")) {
        f.push(`yogurt: ${yog?.qty} ${yog?.unit}`);
      }
      const chia = ing(e, "chia");
      if (!near(chia?.qty, 1, 0.01) || !/tsp|teaspoon/i.test(chia?.unit || "")) {
        f.push(`chia: ${chia?.qty} ${chia?.unit}`);
      }
      // The core discipline: these are all table foods.
      for (const i of e?.ingredients || []) {
        if (i.est_kcal != null) f.push(`est_kcal set on ordinary food "${i.name}"`);
      }
      return f;
    },
  },

  {
    id: "stir-fry",
    text: "stir fry with 1 chicken breast, 1 bell pepper, 1 onion, 1/4 cup kung pao sauce, 1 tsp oil",
    check(r) {
      const f = [];
      const e = r.entries[0];
      if (e?.kind !== "meal") f.push(`kind=${e?.kind}`);
      if ((e?.ingredients || []).length !== 5) f.push(`ingredients=${e?.ingredients?.length}`);
      const sauce = ing(e, "kung");
      if (!near(sauce?.qty, 0.25, 0.001)) f.push(`kung pao qty=${sauce?.qty} (want 0.25)`);
      if (!/cup/i.test(sauce?.unit || "")) f.push(`kung pao unit=${sauce?.unit}`);
      const chicken = ing(e, "chicken");
      if (!near(chicken?.qty, 1, 0.01)) f.push(`chicken qty=${chicken?.qty}`);
      return f;
    },
  },

  {
    id: "hike-elevation",
    text: "hiked 6.2mi in 2h10m, 1400ft gain",
    check(r) {
      const f = [];
      const e = r.entries[0];
      if (e?.kind !== "exercise") f.push(`kind=${e?.kind}`);
      if (e?.activity !== "hike") f.push(`activity=${e?.activity}`);
      if (!near(e?.distance_mi, 6.2, 0.01)) f.push(`distance=${e?.distance_mi}`);
      if (!near(e?.duration_min, 130, 0.5)) f.push(`duration=${e?.duration_min} (want 130)`);
      if (!near(e?.elev_ft, 1400, 1)) f.push(`elev=${e?.elev_ft}`);
      return f;
    },
  },

  {
    id: "10k-conversion",
    text: "ran a 10k this morning in 52 minutes",
    check(r) {
      const f = [];
      const e = r.entries[0];
      if (e?.activity !== "run") f.push(`activity=${e?.activity}`);
      if (!near(e?.distance_mi, 6.21, 0.1)) f.push(`distance=${e?.distance_mi} (want ~6.21 mi)`);
      if (!near(e?.duration_min, 52, 0.5)) f.push(`duration=${e?.duration_min}`);
      return f;
    },
  },

  {
    id: "multi-entry",
    text: "ran 3 miles then had a bagel with cream cheese",
    check(r) {
      const f = [];
      if (r.entries.length !== 2) f.push(`expected 2 entries, got ${r.entries.length}`);
      if (!r.entries.some((e) => e.kind === "exercise" && e.activity === "run")) f.push("no run entry");
      if (!r.entries.some((e) => e.kind === "meal")) f.push("no meal entry");
      return f;
    },
  },

  {
    id: "spoken-duration",
    text: "kayaked 4 miles in an hour and 15",
    check(r) {
      const f = [];
      const e = r.entries[0];
      if (e?.activity !== "kayak") f.push(`activity=${e?.activity}`);
      if (!near(e?.duration_min, 75, 0.5)) f.push(`duration=${e?.duration_min} (want 75)`);
      if (!near(e?.distance_mi, 4, 0.01)) f.push(`distance=${e?.distance_mi}`);
      return f;
    },
  },

  {
    id: "weigh-in",
    text: "weighed in at 176.2 this morning",
    check(r) {
      const f = [];
      const e = r.entries[0];
      if (e?.kind !== "weight") f.push(`kind=${e?.kind}`);
      if (!near(e?.weight_lb, 176.2, 0.01)) f.push(`weight=${e?.weight_lb}`);
      return f;
    },
  },

  {
    id: "yesterday-offset",
    text: "yesterday I swam 2000 yards in 40 minutes",
    check(r) {
      const f = [];
      const e = r.entries[0];
      if (e?.date_offset !== -1) f.push(`date_offset=${e?.date_offset} (want -1)`);
      if (e?.activity !== "swim") f.push(`activity=${e?.activity}`);
      if (!near(e?.duration_min, 40, 0.5)) f.push(`duration=${e?.duration_min}`);
      // 2000 yd = 1.136 mi
      if (!near(e?.distance_mi, 1.14, 0.06)) f.push(`distance=${e?.distance_mi} (want ~1.14 mi)`);
      return f;
    },
  },

  {
    id: "branded-item",
    text: "had a Clif bar and a Starbucks grande latte",
    check(r) {
      const f = [];
      const all = r.entries.flatMap((e) => e.ingredients || []);
      if (all.length === 0) return ["no ingredients extracted"];
      // These are exactly the case where an estimate IS wanted.
      const estimated = all.filter((i) => i.est_kcal != null);
      if (estimated.length === 0) {
        f.push("branded items should carry est_kcal, none did");
      }
      return f;
    },
  },

  {
    id: "no-estimate-on-table-foods",
    text: "two eggs, a banana, and a slice of whole wheat toast",
    check(r) {
      const f = [];
      const all = r.entries.flatMap((e) => e.ingredients || []);
      for (const i of all) {
        if (i.est_kcal != null) f.push(`est_kcal set on ordinary food "${i.name}"`);
      }
      const eggs = all.find((i) => /egg/i.test(i.name));
      if (!near(eggs?.qty, 2, 0.01)) f.push(`eggs qty=${eggs?.qty}`);
      return f;
    },
  },

  {
    id: "fraction-half",
    text: "half an avocado on toast with 1/2 tbsp olive oil",
    check(r) {
      const f = [];
      const all = r.entries.flatMap((e) => e.ingredients || []);
      const av = all.find((i) => /avocado/i.test(i.name));
      if (!near(av?.qty, 0.5, 0.01)) f.push(`avocado qty=${av?.qty} (want 0.5)`);
      const oil = all.find((i) => /oil/i.test(i.name));
      if (!near(oil?.qty, 0.5, 0.01)) f.push(`oil qty=${oil?.qty} (want 0.5)`);
      return f;
    },
  },

  {
    id: "strength-no-distance",
    text: "lifted for 45 minutes, upper body",
    check(r) {
      const f = [];
      const e = r.entries[0];
      if (e?.activity !== "strength") f.push(`activity=${e?.activity}`);
      if (!near(e?.duration_min, 45, 0.5)) f.push(`duration=${e?.duration_min}`);
      if (e?.distance_mi != null) f.push(`invented distance=${e?.distance_mi}`);
      return f;
    },
  },

  {
    id: "slot-inference",
    text: "for breakfast I had a cup of oatmeal with a tablespoon of peanut butter",
    check(r) {
      const f = [];
      const e = r.entries[0];
      if (e?.slot !== "breakfast") f.push(`slot=${e?.slot}`);
      const oats = ing(e, "oat");
      if (!near(oats?.qty, 1, 0.01) || !/cup/i.test(oats?.unit || "")) {
        f.push(`oats: ${oats?.qty} ${oats?.unit}`);
      }
      const pb = ing(e, "peanut");
      if (!/tbsp|tablespoon/i.test(pb?.unit || "")) f.push(`pb unit=${pb?.unit}`);
      return f;
    },
  },

  {
    id: "mixed-units",
    text: "dinner was 8oz salmon, 1 cup brown rice, and 2 cups broccoli",
    check(r) {
      const f = [];
      const e = r.entries[0];
      if (e?.slot !== "dinner") f.push(`slot=${e?.slot}`);
      const salmon = ing(e, "salmon");
      if (!near(salmon?.qty, 8, 0.01) || !/oz|ounce/i.test(salmon?.unit || "")) {
        f.push(`salmon: ${salmon?.qty} ${salmon?.unit}`);
      }
      const broc = ing(e, "broccoli");
      if (!near(broc?.qty, 2, 0.01)) f.push(`broccoli qty=${broc?.qty}`);
      return f;
    },
  },

  {
    id: "vague-quantity",
    text: "snacked on some almonds",
    check(r) {
      const f = [];
      const all = r.entries.flatMap((e) => e.ingredients || []);
      const al = all.find((i) => /almond/i.test(i.name));
      if (!al) return ["no almonds extracted"];
      // The rule is "don't invent a number". A large confident weight is the
      // failure mode worth catching.
      if (al.qty > 4) f.push(`invented a large quantity: ${al.qty} ${al.unit}`);
      return f;
    },
  },

  {
    id: "pace-format",
    text: "easy run, 5 miles at 8:30 pace",
    check(r) {
      const f = [];
      const e = r.entries[0];
      if (e?.activity !== "run") f.push(`activity=${e?.activity}`);
      if (!near(e?.distance_mi, 5, 0.01)) f.push(`distance=${e?.distance_mi}`);
      // 5 mi x 8.5 min = 42.5 min. Deriving this is a nice-to-have, so the
      // tolerance is wide; leaving it null is the acceptable alternative.
      if (e?.duration_min != null && !near(e.duration_min, 42.5, 2)) {
        f.push(`duration=${e.duration_min} (want ~42.5 or null)`);
      }
      return f;
    },
  },

  {
    id: "bike-with-elevation",
    text: "road ride 24 miles, 1h48m, 2100 feet of climbing",
    check(r) {
      const f = [];
      const e = r.entries[0];
      if (e?.activity !== "bike") f.push(`activity=${e?.activity}`);
      if (!near(e?.distance_mi, 24, 0.01)) f.push(`distance=${e?.distance_mi}`);
      if (!near(e?.duration_min, 108, 0.5)) f.push(`duration=${e?.duration_min} (want 108)`);
      if (!near(e?.elev_ft, 2100, 1)) f.push(`elev=${e?.elev_ft}`);
      return f;
    },
  },

  {
    id: "three-entries",
    text: "weighed 174.8, ran 4 miles in 34 min, then eggs and coffee",
    check(r) {
      const f = [];
      if (r.entries.length !== 3) f.push(`expected 3 entries, got ${r.entries.length}`);
      if (!r.entries.some((e) => e.kind === "weight")) f.push("no weight entry");
      if (!r.entries.some((e) => e.kind === "exercise")) f.push("no exercise entry");
      if (!r.entries.some((e) => e.kind === "meal")) f.push("no meal entry");
      return f;
    },
  },
];
