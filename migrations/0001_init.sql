-- The schema, in one place, applied once by `wrangler d1 migrations apply`.
-- This replaces the "seed only when the table is created" trick: a migration runs
-- exactly once, on purpose, by a human.
CREATE TABLE items (
  id   TEXT PRIMARY KEY,
  text TEXT NOT NULL
);
