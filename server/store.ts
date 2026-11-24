import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Item } from "../shared/item.ts";

const seed: Item[] = [
  { id: "seed-1", text: "learn useEffect" },
  { id: "seed-2", text: "fetch from the server" },
];

export type Store = {
  list(): Item[];
  add(text: string): Item;
  remove(id: string): boolean;
  close(): void;
};

/**
 * `file` is a path or ":memory:". The store owns the SQLite handle, so callers get
 * data, not a connection.
 */
export function createStore(file: string): Store {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });

  const db = new DatabaseSync(file);
  const existed = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'items'")
    .get();

  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id   TEXT PRIMARY KEY,
      text TEXT NOT NULL
    )
  `);

  // Seed only when the table is created. Deleting every item must stay deleted
  // across a restart, so "is the table empty?" is the wrong question.
  if (!existed) {
    const insert = db.prepare("INSERT INTO items (id, text) VALUES (?, ?)");
    for (const item of seed) insert.run(item.id, item.text);
  }

  const selectAll = db.prepare("SELECT id, text FROM items ORDER BY rowid");
  const insertOne = db.prepare("INSERT INTO items (id, text) VALUES (?, ?)");
  const deleteOne = db.prepare("DELETE FROM items WHERE id = ?");

  return {
    list: () => selectAll.all() as Item[],

    add(text) {
      const item: Item = { id: crypto.randomUUID(), text };
      insertOne.run(item.id, item.text);
      return item;
    },

    remove(id) {
      const result = deleteOne.run(id);
      return Number(result.changes) > 0;
    },

    close() {
      db.close();
    },
  };
}
