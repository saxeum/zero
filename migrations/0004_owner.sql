-- Ownership, expand half.
--
-- Items become per-user. The existing rows are dropped rather than adopted: they were
-- seeds and test noise, and an owner cannot be invented for them.
--
-- `owner` is added NULLABLE on purpose. Migrations run before the Worker deploys, so for
-- a few seconds the previous Worker is still inserting without this column — NOT NULL
-- here would turn that window into a burst of 500s. Every query filters on `owner`, so a
-- row written in that window (owner IS NULL) is invisible to everyone.
--
-- Tightening to NOT NULL is a separate migration, once this Worker is the deployed one.
--
-- The column carries a real foreign key: D1 enforces them (PRAGMA foreign_keys = 1, and an
-- orphan insert fails with SQLITE_CONSTRAINT_FOREIGNKEY), so this is not decoration. Deleting
-- a user deletes their items. SQLite allows ADD COLUMN with REFERENCES only when the column
-- defaults to NULL, which is exactly the expand shape we want.
DELETE FROM items;

ALTER TABLE items ADD COLUMN owner TEXT REFERENCES user(id) ON DELETE CASCADE;

CREATE INDEX items_owner_idx ON items (owner);
