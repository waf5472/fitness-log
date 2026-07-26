-- Owner-mode storage. Visitors never reach these tables; their data lives in
-- browser localStorage. Every row is scoped by `user` (the Cloudflare Access
-- email) so the schema already supports more than one owner if it ever needs to.

-- One row per logged meal / exercise / weigh-in. A single wide table with
-- nullable columns beats three narrow ones here: the trend queries all want
-- "everything that happened on these dates" in one scan, and the whole corpus
-- is a few thousand rows a year.
CREATE TABLE IF NOT EXISTS entries (
  id           TEXT PRIMARY KEY,
  user         TEXT NOT NULL,
  date         TEXT NOT NULL,            -- YYYY-MM-DD, local to the user
  kind         TEXT NOT NULL CHECK (kind IN ('meal', 'exercise', 'weight')),
  name         TEXT NOT NULL,

  -- meal columns
  kcal         REAL,
  protein_g    REAL,
  carb_g       REAL,
  fat_g        REAL,
  slot         TEXT,                     -- breakfast | lunch | dinner | snack

  -- exercise columns
  activity     TEXT,
  distance_mi  REAL,
  duration_min REAL,
  elev_ft      REAL,

  -- weigh-in column
  weight_lb    REAL,

  raw_text     TEXT,                     -- exactly what was typed, for re-parsing
  detail       TEXT,                     -- JSON: resolved ingredients or exercise params
  created_at   TEXT NOT NULL
);

-- Every read path is "this user, this date range" — one composite index serves
-- the day view and all three trend windows.
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries (user, date);

-- Re-loggable favorites: a parsed meal or exercise saved under a short name.
CREATE TABLE IF NOT EXISTS templates (
  id         TEXT PRIMARY KEY,
  user       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('meal', 'exercise')),
  name       TEXT NOT NULL,
  payload    TEXT NOT NULL,              -- JSON: the parsed record, minus the date
  created_at TEXT NOT NULL,
  UNIQUE (user, kind, name)
);

CREATE INDEX IF NOT EXISTS idx_templates_user ON templates (user);

-- Body stats and goals. One row per user; `targets` holds the weekly exercise
-- volume goals as JSON because they are a per-activity bag, not a fixed schema.
CREATE TABLE IF NOT EXISTS profile (
  user              TEXT PRIMARY KEY,
  sex               TEXT,
  age               INTEGER,
  height_in         REAL,
  weight_lb         REAL,
  activity_factor   REAL,
  goal_rate_lb_wk   REAL,                -- negative = deficit, positive = surplus
  protein_g_per_lb  REAL,
  fat_pct           REAL,                -- share of non-protein calories
  targets           TEXT,                -- JSON: {"run": {"distance_mi": 20}, ...}
  updated_at        TEXT NOT NULL
);
