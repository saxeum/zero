-- Cosmetic, and deliberately so: same table, same constraint, spelled the way the
-- Cloudflare D1 schema explorer renders.
--
-- 0005 declared the foreign key inline (`owner TEXT REFERENCES user(id)`), which SQLite
-- accepts and enforces exactly like the table-level form — PRAGMA foreign_key_list returns
-- the same row either way. But the dashboard's relationship view only recognises the
-- table-level `FOREIGN KEY (...) REFERENCES ...` clause, which is the form drizzle-kit
-- emits for Better Auth's tables, so `items -> user` was the only edge missing from the
-- diagram.
--
-- No data changes: every row has an owner, and the WHERE clause says so rather than
-- assuming it.
CREATE TABLE items_new (
  id    TEXT PRIMARY KEY,
  text  TEXT NOT NULL,
  owner TEXT NOT NULL,
  FOREIGN KEY (owner) REFERENCES user(id) ON DELETE CASCADE
);

INSERT INTO items_new (id, text, owner)
SELECT id, text, owner FROM items WHERE owner IS NOT NULL;

DROP TABLE items;
ALTER TABLE items_new RENAME TO items;
CREATE INDEX items_owner_idx ON items (owner);
