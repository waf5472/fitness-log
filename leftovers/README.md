# Leftovers

Type what is in your fridge, pick a few tags, and get three recipes you can
cook tonight. Swipe right to keep one in your **Cookbook**, left to never see
it again, **Rerun** to swap the ones you have not decided on. The
**Spicerack** holds the staples every recipe may assume you have.

```
have:   chicken thighs, half a bag of spinach, leftover rice
tags:   Asian (boost) · protein heavy (boost)
need:   3 meals × 4 servings
  → 3 recipes, each with "you have 6 of 7 — you'd need: lime", scaled ×1 / ×2 / ×0.75
```

## How it finds recipes

There is no live search. Leftovers owns a small **index** built by crawling
the sitemaps of ~35 cooking sites and reading the `schema.org/Recipe` JSON-LD
every one of them already publishes. From each page it keeps:

- title, image URL, source, link
- the ingredient list, **normalized** to ~245 canonical ingredients
  (`"2 boneless, skinless chicken thighs, trimmed"` → `chicken`)
- yield, total time, cuisine, diet tags, macro tags, rating

It never stores or shows instructions. Ingredient lists are facts; the recipe
is the author's writing, so every card links out to the page that owns it.

A query is then one SQL `GROUP BY` over `recipe_ingredients`:

```
have        = what you typed ∪ your Spicerack
required(r) = a recipe's non-optional canonical ingredients
missing(r)  = required(r) − have

"May require additional ingredients" OFF  → only recipes with missing = ∅
                                      ON  → missing ≤ 3, and the card lists them
Diet tags are hard filters. Cuisine and macro tags only re-order.
Three dealt recipes never all lean on the same protein.
```

`shared/rank.js` holds the whole policy as pure functions with tests. If the
results feel wrong, that file is where the argument is.

## Why normalization is the product

If "chicken breast" and "boneless skinless chicken thighs" do not collapse to
the same thing, coverage scores are noise and the strict toggle returns
nothing. So the dictionary in `shared/canonicals.js` is deliberately narrow
(feta is not cheddar; canned tomatoes are not tomatoes) and the parser in
`shared/normalize.js` is deterministic and unit-tested against the phrasing
real sites use. The same code runs in the browser on what you type, so your
"eggs, spinach and some rice" lands on exactly the ids the recipes were
indexed under.

Phrases the dictionary misses are queued as *unresolved*. The owner's Crawler
tab can hand a batch to Claude Haiku, which maps them to canonical ids (or
"not an ingredient"); every answer is written down as a synonym override and
never asked again. Recipes with unresolved lines are re-parsed after the
dictionary grows.

## Storage: one app, two users

| | Visitor | Owner |
|---|---|---|
| Recipe index | shared, read-only | shared, plus crawler controls |
| Cookbook, Spicerack, swipes | `localStorage` | Cloudflare D1, per email |
| Auth | none | Cloudflare Access (or `OWNER_TOKEN`) |

`src/lib/store.js` is one interface with two implementations; nothing above
it knows which is active.

## Run it

```bash
npm install
npm test                       # parser, ranker, crawler, and the match SQL against real SQLite
npm run build
npm run dev:local              # http://localhost:8788 — no Cloudflare account needed
```

The index starts empty. Seed it from your machine (polite: robots.txt honoured,
1 request/second/host, honest User-Agent):

```bash
DEV_OWNER_EMAIL=you@example.com npm run dev:local        # owner mode enables /api/admin/import
npm run crawl -- --source budgetbytes,cookieandkate --limit 150 --push http://localhost:8788
npm run crawl -- --source all --limit 300 --out seed/all.jsonl   # save a seed file for later
```

`npm run dev` (Vite, HMR) proxies `/api` to whichever API is on :8787, so run
`npm run dev:api` (wrangler) or `PORT=8787 npm run dev:local` alongside it.

## Deploy (Cloudflare)

```bash
npx wrangler d1 create leftovers-db      # paste database_id into wrangler.toml
npm run db:remote
npm run secrets:push                     # ANTHROPIC_API_KEY from Doppler (only the LLM resolver needs it)
npx wrangler secret put OWNER_TOKEN      # or put Cloudflare Access in front of /api/db/* and /api/admin/*
npm run deploy
npm run crawl -- --from seed/all.jsonl --push https://leftovers.wesley-fletcher.com --token $OWNER_TOKEN
```

The Worker cron then keeps the index fresh: every 5 minutes it fetches a
small batch from the queue (`CRAWL_BATCH`, default 10; the free plan's CPU and
subrequest caps are why it is small), and on Sundays it re-reads a few
sitemaps. Bulk seeding is meant to happen from a laptop with the script above.

## Layout

```
shared/        canonicals.js (dictionary) · normalize.js (parser + tag inference)
               rank.js (scoring, diversity, degrade) · scale.js (yield) · tags.js
worker/        index.js (routes, auth, cron) · match.js (the SQL)
worker/crawl/  sources.js · sitemap.js · jsonld.js · recipe.js · robots.js · run.js · llm.js
src/           React UI: QueryForm, Deck (swipe), Cookbook, Spicerack, Admin
scripts/       crawl.mjs (bulk seeder) · dev-server.mjs (SQLite-backed local run) · cron-local.mjs
migrations/    D1 schema
test/          node:test suites, fixtures of real JSON-LD shapes
```

## Sources

Allrecipes, BBC Good Food, Serious Eats, Simply Recipes, Food52, Bon Appétit,
Epicurious, Food Network, Delish, Taste of Home, The Kitchn, Tasty, Jamie
Oliver, RecipeTin Eats, Budget Bytes, Damn Delicious, Gimme Some Oven, Pinch
of Yum, Skinnytaste, Cafe Delites, Minimalist Baker, Oh She Glows, Nora Cooks,
Cookie and Kate, Love and Lemons, Downshiftology, Just One Cookbook, The Woks
of Life, Maangchi, Rasa Malaysia, Hot Thai Kitchen, Giallo Zafferano, Smitten
Kitchen, Half Baked Harvest, King Arthur Baking, Sally's Baking Addiction.

Per-source sitemap patterns live in `worker/crawl/sources.js`; a site that
changes its URL scheme shows up as "0 recipe URLs in sitemap" in the Crawler
tab, not as a crash. Takedown: set `robots_ok = 0` on the source row and its
recipes stop being dealt on the next crawl.
