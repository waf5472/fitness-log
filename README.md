# Fitness Log

Type a sentence about what you ate or how you trained. An LLM turns it into
structured fields; deterministic code turns those fields into numbers.

```
"hiked 6.2mi in 2h10m, 1400ft gain"
  → LLM      {activity: "hike", distance_mi: 6.2, duration_min: 130, elev_ft: 1400}
  → code     ACSM walking equation at 4.1% grade × 175 lb → 712 kcal net
```

```
"parfait with 6oz raspberries, 1 cup Greek yogurt, 1 tsp chia seeds"
  → LLM      three ingredients with quantities and units
  → code     170g + 245g + 4g against a USDA-derived table → 252 kcal, 27g protein
```

## Why the split matters

The model never computes a calorie. That is the whole design.

Asking an LLM "how many calories is this parfait" gives you a plausible number
that changes between runs and can't be audited. Asking it "what did they eat and
how much" gives you a parse — and parsing is the thing language models are
reliably good at. Every number downstream comes from a committed food table and
published metabolic equations, so the same input always produces the same
output and you can see which food row produced which figure.

The parse lands in an **editable preview card** before anything is saved. A bad
extraction is a two-second fix, not a corrupted record you find a month later.
Ingredients the food table doesn't recognize fall back to a model estimate and
are visibly tagged as estimates rather than silently mixed in with exact values.

## Storage: one app, two very different users

This is a portfolio piece that is also the author's real daily log. Those have
opposite requirements — a public demo must cost nothing and resist abuse, while
a personal log must durably hold years of records — so they get different
backends behind the same interface.

| | Visitor | Owner |
|---|---|---|
| Storage | `localStorage` | Cloudflare D1 (SQLite) |
| Seeded with | 90 days of sample data | your actual history |
| Server writes | none | authenticated |
| Trend rollups | computed in JS | `GROUP BY` in SQL |

`src/lib/store.js` exposes one interface with two implementations; nothing above
it knows which is active.

**Why D1 and not KV.** KV is a cache: values cap at 25 MB, writes to one key
throttle to about 1/sec, and there is no query language. A log that appends
several rows a day and then asks "sum the last 90 days by date" is a relational
workload. D1 gives real tables, an index on `(user, date)`, and server-side
aggregation. At roughly 2,200 rows/year it will not approach the free tier's
5 GB or 100k daily row-writes this decade. KV is still used here — for per-IP
rate-limit counters, which is exactly what a TTL'd key-value store is for.

Export and import are first-class (Profile → Your data) so the corpus is never
trapped in this app or this platform.

## Setup

```bash
npm install
```

### 1. Create the database and the rate-limit namespace

```bash
npx wrangler d1 create fitness-log-db      # paste database_id into wrangler.toml
npx wrangler kv namespace create RATE_KV   # paste id into wrangler.toml
npm run db:remote                          # apply migrations/0001_init.sql
npm run db:local                           # same, against the local dev database
```

### 2. Provide the Anthropic key

The key lives only in the Worker's environment and never reaches the browser.

```bash
npm run secrets:push    # Doppler → wrangler secret
```

Or set it directly with `npx wrangler secret put ANTHROPIC_API_KEY`. For local
runs, `npm run preview` generates a gitignored `.dev.vars` from Doppler and
deletes it on exit.

### 3. Gate the owner routes

The app is public; only `/api/db/*` is protected. In the Cloudflare dashboard:
**Zero Trust → Access → Applications → Add**, path `fitness-log.wesley-fletcher.com/api/db`,
policy allowing your email. Access verifies the JWT at the edge and injects
`Cf-Access-Authenticated-User-Email`, which the Worker trusts on that path.

Prefer not to configure Access? Set an `OWNER_TOKEN` secret instead and send
`Authorization: Bearer <token>`. Both paths go through `ownerEmail()` in
`worker/index.js`; it default-denies when neither is present.

### 4. Run it

```bash
npm run dev      # UI only, always in local/visitor mode (no Worker behind it)
npm run preview  # full stack: Vite build + Worker + D1 + secrets
npm run deploy   # ship it
npm test         # 51 unit tests, no network required
```

Set `DEV_OWNER_EMAIL` in `.dev.vars` to exercise owner mode locally, since
there is no Access in front of `wrangler dev`.

## How the numbers are produced

**Food** — `src/lib/foods.js` holds per-100g macros for 136 common whole foods,
USDA-derived. Matching is exact-then-fuzzy on names and aliases, with
preparation words ("diced", "grilled") stripped.

**Units** — `src/lib/units.js` resolves quantity to grams in a deliberate order:
mass units first and never overridable, then the food's own conventional
weights, then volume × density. This is why a cup of spinach is 30 g, a cup of
raspberries is 123 g, and a cup of olive oil is 216 g. An unresolvable unit
returns `null` and is flagged rather than quietly becoming a wrong number.

**Exercise** — `src/lib/exercise.js` uses the ACSM metabolic equations wherever
distance and time are present, which is what lets elevation gain enter as a real
grade term rather than a fudge factor. Everything else uses 2011 Compendium MET
values; cycling picks a MET band from speed, since the ergometer equation needs
power output that outdoor riding doesn't give you.

**Net, not gross** — reported exercise calories subtract the resting metabolism
you'd have burned anyway. `goals.js` already counts resting burn in your daily
target, so adding gross expenditure would double-count an hour of BMR every
time you go for a run. Same reason the activity-factor picker offers only
non-exercise multipliers (1.2–1.5): the familiar "moderately active × 1.55"
already includes workouts.

**Targets** — Mifflin-St Jeor BMR × activity factor, plus that day's logged
exercise, plus the goal adjustment at 3500 kcal per pound per week.

The Trends tab compares the weight change your log *predicts* against what the
scale actually did. A persistent gap is the useful signal — it usually means
intake is being under-recorded, not that your metabolism is unusual.

## The model call

One call per entry. Structured outputs (`output_config.format`) guarantee
schema-valid JSON, so there is no brittle text parsing and the failure modes are
about *content* — a missed ingredient, a botched unit conversion — rather than
malformed output.

The model is set in `worker/models.js`:

```js
export const MODEL = "claude-haiku-4-5";
```

Extraction is small, well specified, and schema-constrained, so it starts at the
cheapest tier. Change that one line to move up.

`effort` lives in the same table rather than in a constant, because it is **not
universally supported** — Opus 5 and Sonnet 5 accept it, Haiku 4.5 rejects it
with a 400. `modelRequestOptions()` omits the key entirely for models that
refuse it, and `test/models.test.js` asserts that, so swapping the model can't
quietly break every parse in production.

### Choosing a model with `npm run eval`

Don't guess — measure. `eval/cases.js` holds 18 labelled entries covering the
things that actually go wrong: unit conversions (`2h10m` → 130, `10k` → 6.21 mi,
2000 yd → 1.14 mi), fractions (`1/4 cup` → 0.25, "half an avocado" → 0.5),
splitting one sentence into several records, meal-slot inference, refusing to
invent a quantity for "some almonds", and the discipline rule below.

```bash
npm run eval                       # all three candidates, ~$0.15 total
npm run eval -- claude-haiku-4-5   # just one
npm run eval -- --verbose          # show every failure with the raw output
npm run eval -- --runs 3           # repeat, to see run-to-run variance
```

It reports pass rate, latency, cost per parse, and projected annual cost at six
entries a day, issuing the exact same request the Worker does.

**The failure that matters most is `est_kcal` discipline.** A model that
helpfully computes calories for ordinary foods routes around the food table
entirely, and results stop being reproducible — which is the whole point of the
design. Two cases test it directly from both sides: ordinary foods must leave
`est_kcal` null, and branded items ("Clif bar", "Starbucks latte") must set it.
Weigh that column more heavily than the total.

`test/parse-schema.test.js` separately validates the schema against the
structured-output constraints at test time rather than discovering a 400 in
production, and asserts that the activity list in the prompt still matches the
activities `exercise.js` implements — otherwise the two drift and unmatched
activities silently collapse to a generic MET value.

Anonymous callers get 40 parses per IP per day; the owner is not limited. It is
the only endpoint that costs money, so it is the only one that needs a throttle.

## Accuracy

Estimates, not measurements. Food entries assume the raw/uncooked form unless
noted, portion weights are conventional rather than yours specifically, and
metabolic equations carry meaningful individual variation. Good enough to steer
by over weeks; not a clinical instrument.

## Layout

```
worker/index.js         Worker: SPA, /api/parse, /api/db/*, /project.json
worker/models.js        model choice + per-model request shape
worker/parse-schema.js  the model contract — JSON schema + system prompt
migrations/             D1 schema
src/lib/foods.js        136-food nutrition table
src/lib/units.js        quantity → grams
src/lib/nutrition.js    food matching, ingredient resolution, meal totals
src/lib/exercise.js     ACSM equations + MET table
src/lib/goals.js        BMR/TDEE, targets, streaks, weight trend
src/lib/store.js        local vs cloud storage, demo seed
src/components/         Log, Trends, Saved, Profile, ParsePreview, Charts
test/                   51 unit tests
eval/                   labelled extraction cases + model scorer
```
