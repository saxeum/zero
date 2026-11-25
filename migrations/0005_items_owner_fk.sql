-- Ownership, contract half — and the foreign key that was missing.
--
-- 0004 added `owner` nullable and unfenced, because it had to be safe for the Worker that
-- was still running during the deploy window. That Worker is gone: every writer now sets
-- an owner, and no row has a NULL one. So the table is rebuilt with both properties the
-- original could not have:
--
--   * NOT NULL — SQLite cannot add a NOT NULL column without a default, and inventing one
--     is worse than a rebuild.
--   * REFERENCES user(id) ON DELETE CASCADE — SQLite cannot add a foreign key to an
--     existing table at all, for the same reason. D1 enforces it (PRAGMA foreign_keys = 1),
--     so this is a real constraint: an item cannot exist without its user, and deleting a
--     user deletes their items.
--
-- Rows with a NULL owner are dropped rather than guessed at. There are none; the WHERE
-- clause is what makes that a statement about the data rather than a hope.
CREATE TABLE items_new (
  id    TEXT PRIMARY KEY,
  text  TEXT NOT NULL,
  owner TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
);

INSERT INTO items_new (id, text, owner)
SELECT id, text, owner FROM items WHERE owner IS NOT NULL;

DROP TABLE items;
ALTER TABLE items_new RENAME TO items;
CREATE INDEX items_owner_idx ON items (owner);
