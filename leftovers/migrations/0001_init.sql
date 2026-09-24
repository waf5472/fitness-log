-- Two halves, one database.
--
--   The INDEX (sources, recipes, recipe_ingredients, crawl_queue, unresolved)
--   is shared and read by every visitor. It holds recipe METADATA only: a
--   title, a picture, a normalized ingredient list, tags, and the link to the
--   page that owns the recipe. Never instructions.
--
--   The OWNER's personal tables (spicerack, cookbook, swipes) are keyed by
--   `user`, the Cloudflare Access email. Visitors never reach these; theirs
--   live in localStorage.

CREATE TABLE IF NOT EXISTS sources (
  id             TEXT PRIMARY KEY,           -- matches worker/crawl/sources.js
  name           TEXT NOT NULL,
  robots_ok      INTEGER NOT NULL DEFAULT 1, -- 0 = robots.txt said no; never fetch
  sitemap_at     TEXT,                       -- last sitemap refresh
  recipe_count   INTEGER NOT NULL DEFAULT 0,
  error_count    INTEGER NOT NULL DEFAULT 0,
  last_error     TEXT
);

CREATE TABLE IF NOT EXISTS recipes (
  id               TEXT PRIMARY KEY,         -- hash of url
  source_id        TEXT,
  url              TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  image_url        TEXT,
  yield_servings   INTEGER,
  yield_text       TEXT,
  cuisine          TEXT,                     -- one of shared/tags.js CUISINE_TAGS or NULL
  total_minutes    INTEGER,
  diet_tags        TEXT NOT NULL DEFAULT '[]',   -- JSON array
  macro_tags       TEXT NOT NULL DEFAULT '[]',   -- JSON array
  macro_source     TEXT,                     -- 'nutrition' | 'inferred'
  nutrition_json   TEXT,
  ingredient_count INTEGER NOT NULL,
  unresolved_count INTEGER NOT NULL DEFAULT 0,
  raw_ingredients  TEXT,                     -- JSON array of the original lines, for re-normalizing
  rating           REAL,
  rating_count     INTEGER,
  crawled_at       TEXT NOT NULL,
  dead_at          TEXT                      -- set when the page 404s; hidden from results
);

CREATE INDEX IF NOT EXISTS idx_recipes_source ON recipes (source_id);
CREATE INDEX IF NOT EXISTS idx_recipes_cuisine ON recipes (cuisine);

-- One row per (recipe, canonical ingredient). The match query is a GROUP BY
-- over this table filtered by the user's ingredient set, so the leading
-- column of the index is the ingredient.
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  recipe_id  TEXT NOT NULL,
  canonical  TEXT NOT NULL,
  optional   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (recipe_id, canonical)
);

CREATE INDEX IF NOT EXISTS idx_ri_canonical ON recipe_ingredients (canonical, recipe_id);

-- URLs discovered from sitemaps and not yet fetched (or due for a re-fetch).
CREATE TABLE IF NOT EXISTS crawl_queue (
  url        TEXT PRIMARY KEY,
  source_id  TEXT NOT NULL,
  lastmod    TEXT,
  queued_at  TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_queue_source ON crawl_queue (source_id, attempts, queued_at);

-- Ingredient phrases the parser could not map. The admin page shows these by
-- frequency; the LLM pass drains them into `synonym_overrides`.
CREATE TABLE IF NOT EXISTS unresolved (
  phrase     TEXT PRIMARY KEY,
  count      INTEGER NOT NULL DEFAULT 1,
  example_id TEXT,                           -- a recipe that used it
  first_seen TEXT NOT NULL
);

-- Learned synonyms: phrase -> canonical (or NULL = ignore, e.g. "water").
-- Applied before the built-in dictionary at crawl time.
CREATE TABLE IF NOT EXISTS synonym_overrides (
  phrase     TEXT PRIMARY KEY,
  canonical  TEXT,
  source     TEXT NOT NULL,                  -- 'llm' | 'manual'
  created_at TEXT NOT NULL
);

-- --- Owner tables ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS spicerack (
  user       TEXT NOT NULL,
  canonical  TEXT NOT NULL,
  PRIMARY KEY (user, canonical)
);

CREATE TABLE IF NOT EXISTS cookbook (
  user         TEXT NOT NULL,
  recipe_id    TEXT NOT NULL,
  saved_at     TEXT NOT NULL,
  cooked_count INTEGER NOT NULL DEFAULT 0,
  notes        TEXT,
  snapshot     TEXT NOT NULL,                -- JSON of the card as dealt (title, url, image, ingredients)
  PRIMARY KEY (user, recipe_id)
);

CREATE TABLE IF NOT EXISTS swipes (
  user       TEXT NOT NULL,
  recipe_id  TEXT NOT NULL,
  direction  TEXT NOT NULL CHECK (direction IN ('left', 'right')),
  at         TEXT NOT NULL,
  PRIMARY KEY (user, recipe_id)
);

CREATE TABLE IF NOT EXISTS prefs (
  user       TEXT PRIMARY KEY,
  payload    TEXT NOT NULL,                  -- JSON: last query, defaults
  updated_at TEXT NOT NULL
);
