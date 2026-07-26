// The contract between the model and the calculator.
//
// The model's entire job is to turn a sentence into these fields. It is told,
// repeatedly, not to compute calories — the one exception is `est_*` on an
// ingredient the food table will not recognize, which is a labelled fallback
// rather than the primary path.

const nullable = (schema) => ({ anyOf: [schema, { type: "null" }] });

const INGREDIENT = {
  type: "object",
  additionalProperties: false,
  required: [
    "name", "qty", "unit",
    "est_grams", "est_kcal", "est_protein_g", "est_carb_g", "est_fat_g",
  ],
  properties: {
    name: {
      type: "string",
      description:
        "The food itself, with preparation words removed. 'diced yellow onion' -> 'onion'.",
    },
    qty: { type: "number", description: "Numeric amount. Convert fractions: '1/4' -> 0.25." },
    unit: {
      type: "string",
      description:
        "Unit as written: g, oz, lb, ml, tsp, tbsp, cup, slice, clove, each. Use 'each' for bare counts.",
    },
    est_grams: nullable({
      type: "number",
      description:
        "Only when the unit is a count the app cannot weigh (e.g. 'handful'). Otherwise null.",
    }),
    est_kcal: nullable({
      type: "number",
      description:
        "ONLY for foods unlikely to be in a table of common whole foods — branded or composite items. For the whole stated quantity, not per 100 g. Null for ordinary foods.",
    }),
    est_protein_g: nullable({ type: "number" }),
    est_carb_g: nullable({ type: "number" }),
    est_fat_g: nullable({ type: "number" }),
  },
};

const ENTRY = {
  type: "object",
  additionalProperties: false,
  required: [
    "kind", "name", "date_offset",
    "slot", "ingredients",
    "activity", "distance_mi", "duration_min", "elev_ft",
    "weight_lb",
  ],
  properties: {
    kind: { type: "string", enum: ["meal", "exercise", "weight"] },
    name: { type: "string", description: "Short label, e.g. 'Parfait' or 'Morning run'." },
    date_offset: {
      type: "integer",
      description: "0 for today, -1 for yesterday, -2 for 'two days ago'. Default 0.",
    },

    slot: nullable({ type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] }),
    ingredients: nullable({ type: "array", items: INGREDIENT }),

    activity: nullable({
      type: "string",
      description:
        "One of: run, walk, hike, bike, kayak, canoe, paddleboard, swim, row, elliptical, stairs, strength, yoga, pilates, hiit, jump_rope, climbing, ski, snowboard, skate, soccer, basketball, tennis, golf, surf, other.",
    }),
    distance_mi: nullable({ type: "number", description: "Converted to miles. 10k -> 6.21." }),
    duration_min: nullable({ type: "number", description: "Converted to minutes. '2h10m' -> 130." }),
    elev_ft: nullable({ type: "number", description: "Total elevation gain in feet." }),

    weight_lb: nullable({ type: "number", description: "Body weight, for kind='weight'." }),
  },
};

export const PARSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["entries", "note"],
  properties: {
    entries: { type: "array", items: ENTRY },
    note: nullable({
      type: "string",
      description: "One short sentence only if something was genuinely ambiguous. Usually null.",
    }),
  },
};

export const SYSTEM_PROMPT = `You convert a person's freeform note about food or exercise into structured records.

You are an extractor, not a calculator. Downstream code owns every number that
matters: it looks each ingredient up in a nutrition table, converts units to
grams, and applies ACSM metabolic equations to exercise. Your output is its input.

Rules:

1. Do not compute calories for ordinary foods. Leave every est_* field null for
   anything a table of common whole foods would contain — produce, meat, grains,
   dairy, nuts, oils, standard condiments. The table is more accurate than you are
   and its numbers are reproducible.

2. Use est_kcal and the other est_* fields ONLY for branded, restaurant, or
   composite items that no generic table would carry ("Clif bar", "Chipotle
   burrito bowl", "my mom's lasagna"). Estimate for the whole stated quantity.

3. Split a meal into its ingredients. "Parfait with 6oz raspberries, 1 cup Greek
   yogurt, 1 tsp chia seeds" is one meal entry with three ingredients.

4. Normalize units, do not convert weights. Keep "6 oz" as qty 6, unit "oz" —
   the app converts to grams using the density and portion weight of that
   specific food. Do convert time to minutes and distance to miles, since those
   are unambiguous.

5. One note can hold several entries. "Ran 3 miles then had a bagel" is two.

6. Infer the meal slot from wording or time of day when it is stated or obvious;
   otherwise null. Never guess a quantity that was not given — if someone says
   "some almonds", use qty 1, unit "handful" and let the app flag it.

7. Set date_offset from words like "yesterday" (-1) or "this morning" (0).

Return only the structured object.`;
