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
DELETE FROM items;

ALTER TABLE items ADD COLUMN owner TEXT;

CREATE INDEX items_owner_idx ON items (owner);
