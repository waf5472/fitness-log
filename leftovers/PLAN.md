# Leftovers — product and build plan

> Status: DECISIONS LOCKED 2026-09-24, Phases 0–4 implemented in this repo.
> See README.md for how it runs; this file is the why.

## 1. Product in one paragraph

A mobile-first web app. The user types what food they have, picks dietary and
cuisine tags, and sets meals × servings. Leftovers returns exactly three
recipes that can be made from those ingredients plus the user's Spicerack
(assumed pantry staples). Swipe right saves a recipe to the Cookbook, swipe
left dismisses it. Rerun deals a fresh three. A toggle controls whether
recipes may require ingredients the user does not have.

## 2. Assumptions and constraints

| # | Assumption | Why it matters |
|---|-----------|----------------|
| A1 | Same stack as fitness-log: Vite + React + Tailwind front end, Cloudflare Worker API, D1 (SQLite) storage, Doppler for secrets, `<name>.wesley-fletcher.com` custom domain. | Zero new infra to learn, free tier covers MVP, portfolio consistency. |
| A2 | "Scrub websites" means we build and own a recipe **index**, not live-scrape at request time. | Live scraping is too slow (>5 s), brittle, and gets IP-blocked. An index makes the query a SQL problem. |
| A3 | We store only **metadata**: title, source URL, image URL, normalized ingredient list, yield, cuisine, diet tags, optional nutrition. We do **not** store or display instructions. The recipe card links out to the source. | Ingredient lists are not copyrightable in the US; instructions are creative text and are. Link-out also keeps us inside most sites' ToS and gives sources their traffic. |
| A4 | Every target site publishes `schema.org/Recipe` JSON-LD (all major WordPress recipe plugins do). | One parser covers 25+ sites. No per-site HTML scraping. |
| A5 | Users have accounts (Cookbook and Spicerack must persist across devices). | Needs auth. Cheapest path: magic-link email via Cloudflare Worker + Resend free tier, or Clerk free tier. |
| A6 | Budget: free tiers only for MVP. LLM calls allowed at **crawl time** (batch, cached), not per user query. | Ingredient normalization is the hard problem; an LLM at index time costs cents per thousand recipes and nothing at runtime. |

## 3. Core matching logic (the actual product)

```
have        = user_ingredients ∪ spicerack
required(r) = normalized ingredients of recipe r
missing(r)  = required(r) − have
coverage(r) = |required(r) ∩ have| / |required(r)|

Toggle OFF ("Requires additional ingredients" = no):
    candidates = { r : missing(r) = ∅ }
Toggle ON:
    candidates = { r : |missing(r)| ≤ 3 }      # threshold, tune later
    card shows "You'd need: X, Y"

Filter:  hard-exclude on diet tags (vegan, pescatarian, ...)
Boost:   cuisine tags, macro tags (protein-heavy, carb-heavy)
Rank:    coverage desc, then |missing| asc, then source-quality prior,
         then random jitter (so Rerun is non-deterministic)
Deal:    top 3 not in (seen_this_session ∪ swiped_left_ever)
```

Ingredient normalization pipeline (crawl time):
1. Parse raw line with `ingredient-parser` (JS) → `{qty, unit, name, prep}`.
2. Map `name` to a canonical id via a synonym table (~1,500 entries: `scallion`→`green onion`, `capsicum`→`bell pepper`, `AP flour`→`flour`).
3. Unresolved names go to a nightly Claude Haiku batch: "map to canonical or NEW". New canonicals are reviewed once in an admin page, then added to the table.
4. Macro tags derived from JSON-LD `nutrition` when present; otherwise heuristic on canonical ingredients (meat/legume/dairy weight → protein-heavy; pasta/rice/potato/bread → carb-heavy). Flag as `inferred`.
5. Diet tags: `suitableForDiet` from JSON-LD when present; else infer from canonical ingredients against allergen/animal lists. Vegan/vegetarian/pescatarian inference is reliable; "gluten-free" inference is not and should be labelled as such.

## 4. Data model (D1)

```
users(id, email, created_at)
sources(id, domain, name, sitemap_url, robots_ok, last_crawl, priority)
recipes(id, source_id, url UNIQUE, title, image_url, yield_servings,
        cuisine, total_minutes, nutrition_json, diet_tags, macro_tags,
        ingredient_hash, crawled_at, dead_link_at)
canonical_ingredients(id, name, category, is_staple_default)
ingredient_synonyms(raw_name, canonical_id)
recipe_ingredients(recipe_id, canonical_id, qty, unit, optional)
spicerack(user_id, canonical_id)                 -- user's assumed-on-hand
cookbook(user_id, recipe_id, saved_at, cooked_count, notes)
swipes(user_id, recipe_id, direction, at)        -- left = suppress
sessions(user_id, query_json, dealt_ids, created_at)
```

Query scale: 50k recipes × ~10 ingredients = 500k rows in `recipe_ingredients`.
Trivial for D1 with an index on `(canonical_id, recipe_id)`.
Coverage computed with one GROUP BY over the user's ingredient set.

## 5. Harvesting

### 5a. Free structured sources (APIs and datasets)

Verify current free-tier limits before committing; they change often.

| Source | Type | Free tier / license | Use |
|--------|------|---------------------|-----|
| Edamam Recipe Search API | API | Developer plan, ~10k calls/mo | Fallback search when index returns <3 |
| Spoonacular | API | 150 points/day | Ingredient parsing + `findByIngredients` for validation |
| TheMealDB | API | Free, small corpus (~300) | Seed data for dev, no key needed |
| Tasty (BuzzFeed) via RapidAPI | API | ~500 req/mo | Video-first recipes, good images |
| Wikibooks Cookbook | Dataset | CC BY-SA, ~3k recipes | Only source where we may legally show instructions in-app |
| Food.com recipes (Kaggle) | Dataset | ~180k recipes + reviews | Bulk seed for the index; ratings give a quality prior |
| Epicurious (Kaggle) | Dataset | ~20k recipes with nutrition | Macro-tag training/validation |
| RecipeNLG | Dataset | 2.2M recipes, research use | Synonym table bootstrap only (license blocks product use) |
| USDA FoodData Central | API | Free, unlimited with key | Compute protein/carb per serving when JSON-LD nutrition is absent |
| OpenRecipes (Fictive Kin, GitHub) | Dataset | Open, stale (~2017) | Historical JSON-LD examples for parser tests |
| Common Crawl | Dataset | Free, huge | v2 only: extract JSON-LD Recipe objects at scale |

### 5b. 25+ crawlable recipe sites (all emit schema.org/Recipe JSON-LD, all have sitemaps)

General: AllRecipes, BBC Good Food, Serious Eats, Simply Recipes, Food52,
Bon Appétit, Epicurious, Food Network, Delish, Taste of Home, The Kitchn,
Tasty, Jamie Oliver, RecipeTin Eats.

Budget / weeknight: Budget Bytes, Damn Delicious, Gimme Some Oven,
Pinch of Yum, Skinnytaste, Cafe Delites.

Vegan / vegetarian: Minimalist Baker, Oh She Glows, Nora Cooks,
Cookie and Kate, Love and Lemons, Downshiftology.

Cuisine specialists: Just One Cookbook (Japanese), The Woks of Life (Chinese),
Maangchi (Korean), Rasa Malaysia (SE Asian), Hot Thai Kitchen (Thai),
Giallo Zafferano (Italian), Smitten Kitchen, Half Baked Harvest.

Baking: King Arthur Baking, Sally's Baking Addiction.

Excluded on purpose: NYT Cooking (paywall), Yummly (defunct), Pinterest
(aggregator, no JSON-LD of its own).

Tooling: the Python `recipe-scrapers` library already has per-site adapters
for 500+ domains and a `scrape_html` fallback that reads JSON-LD. For a
Cloudflare-native crawler, a Worker Cron + `cheerio` + JSON-LD extraction
covers the same ground with no Python runtime.

Crawler rules: honour `robots.txt`, 1 req/s per domain, `If-Modified-Since`,
identify with a real User-Agent and contact email, re-crawl each URL every
30 days, mark 404/410 as dead. Never store `recipeInstructions`.

## 6. UX surface

- **Home / Query**: ingredient chip input with autocomplete from
  `canonical_ingredients`; tag pills (multi-select, grouped Diet / Cuisine /
  Macro); stepper for meals and servings; toggle "May need extra ingredients";
  big "Find 3 meals" button.
- **Deck**: 3 cards, swipe (touch + arrow keys + buttons for a11y). Card:
  image, title, source, time, coverage bar, "Uses: …", "You'd need: …",
  scaled yield ("makes 4, you need 6 → 1.5×"). Right = Cookbook, left =
  dismiss. **Rerun** button under the deck.
- **Cookbook**: saved list, filter by tag, "cooked it" counter, notes,
  link out.
- **Spicerack**: checklist of staples grouped by category, pre-seeded with
  ~40 defaults (flour, oil, salt, dried herbs, smoked paprika, soy sauce…),
  user adds/removes. Everything here counts as on-hand in every query.
- **Settings**: default tags, default servings, account.

Swipe lib: `react-tinder-card` or hand-rolled with `framer-motion` drag.
Keep the deck finite (3 cards) so no infinite-scroll dark pattern.

## 7. Milestones

| Phase | Deliverable | Effort |
|-------|-------------|--------|
| 0 | Repo, Worker skeleton, D1 schema, auth, deploy to `leftovers.wesley-fletcher.com` | 1 weekend |
| 1 | Crawler for 5 sites → ~5k recipes; normalization v1 (parser + synonym table) | 1 week |
| 2 | Query API + matching SQL; Spicerack; toggle semantics | 3 days |
| 3 | Deck UI with swipe, Rerun, Cookbook | 1 week |
| 4 | Expand to 25 sites, LLM synonym batch, macro/diet inference, quality prior | 1 week |
| 5 | Polish: PWA install, offline Cookbook, share card, analytics on swipe ratios | ongoing |

## 8. Risk critique

1. **Ingredient normalization is the whole product.** If "chicken thighs" and
   "boneless skinless chicken" don't collapse to `chicken`, coverage scores
   are garbage and the toggle-OFF mode returns nothing. Budget the most time
   here. Mitigation: start with a curated 300-ingredient canonical set and
   grow from real query logs, not from the corpus.
2. **Toggle-OFF sparsity.** With a strict zero-missing rule and a short
   ingredient list, results will often be empty. Need a graceful degrade:
   "Nothing exact. Closest three need 1 ingredient each" with the toggle
   auto-suggested, not silently flipped.
3. **Legal/ToS.** Sitemap crawling + metadata only + link-out is the
   defensible posture, but some sites' ToS forbid any automated access.
   Keep a per-source `robots_ok` flag and a takedown path. Do not scrape
   behind logins or paywalls.
4. **Site churn.** Recipe blogs redesign, move to new plugins, add
   Cloudflare bot challenges. Expect 10–20% of sources to break per year.
   Crawler must be per-source isolated so one failure doesn't stall the run.
5. **Macro tags are weak.** "Protein heavy" from ingredient heuristics is a
   guess. Label as inferred until nutrition data exists; do not hard-filter
   on it.
6. **Servings math.** `recipeYield` is free text ("4–6", "one 9-inch pie",
   "24 cookies"). Parse what you can, display "yield unknown" otherwise,
   never silently scale.
7. **Scope creep magnets**: photo-of-fridge input, grocery list export,
   meal-plan calendar, nutrition tracking. All out of MVP. The fitness-log
   integration (calories from cooked recipes) is a real v2 hook; note it,
   don't build it.
8. **Cold start.** Three cards feel thin if the corpus is small. Do not ship
   the deck until the index has ≥5k recipes across all diet tags.

## 9. Final recommendation

Build it as a Cloudflare Worker + D1 sibling of fitness-log. Own the recipe
index via sitemap + JSON-LD crawl of the 25 sites above, seeded with the
Food.com Kaggle dump for volume. Store metadata only and link out. Spend the
first real week on ingredient normalization and the matching query before
touching the swipe UI. Use Edamam as a fallback only when the index returns
fewer than three candidates. Ship Phase 3 as the public MVP.

## 10. Decisions (answered 2026-09-24)

| # | Question | Decision | Where it lives |
|---|----------|----------|----------------|
| 1 | Corpus posture | Own crawl of sitemaps + JSON-LD, metadata only, link out. | `worker/crawl/*`, `migrations/0001_init.sql` |
| 2 | Toggle semantics | **Off** = strict: every non-optional ingredient is in your list or Spicerack. **On** = up to 3 missing, listed on the card. Off degrades visibly (banner) instead of silently flipping. Default on, because off is sparse until the index is large. | `shared/rank.js` `deal()`, `QueryForm` |
| 3 | Tag logic | Diet = hard filter (SQL). Cuisine/macro = score boost. Multiple cuisines are OR. | `worker/match.js`, `shared/rank.js` |
| 4 | Meals × servings | 3 meals × 4 = three *different* recipes each scaled to 4 (12 plates). Dealt recipes avoid sharing a hero protein. | `pickDiverse()`, `shared/scale.js` |
| 5 | Rerun / left swipe | Rerun replaces only undecided cards. Left swipe is permanent (`swipes` table / localStorage), with a one-click "forget them". | `App.jsx` `onRerun`, `store.js` |
| 6 | Accounts | Same as fitness-log: owner via Cloudflare Access / OWNER_TOKEN → D1; visitors → localStorage. | `worker/index.js` `ownerEmail()` |
| 7 | Input fidelity | Presence only. Free text is parsed client-side with the crawler's normalizer. | `IngredientInput.jsx` |
| 8 | LLM budget | Haiku 4.5 for unresolved-phrase mapping at admin/cron time; upgrade path is `worker/models.js`. No per-query LLM. | `worker/crawl/llm.js` |

## 11. What is not built yet

- Cron on the Workers **free** plan is CPU-capped (10 ms/invocation). `CRAWL_BATCH=10` may need to drop to 3–5, or the plan goes to $5/mo. Bulk seeding is designed to run from a laptop for this reason.
- No image proxy: cards hot-link source images with `referrerPolicy="no-referrer"`. Some CDNs will 403; the card hides the image and carries on. A Cloudflare Images / cache-through proxy is the v2 fix.
- Macro tags without nutrition data are heuristics and are labelled `*`.
- Gluten-free is only ever *confirmed*, never inferred.
- Servings scaling shows a factor; it does not rewrite quantities (we do not store them).
- No fitness-log hook yet (cooked recipe → calorie entry). Noted, not built.
