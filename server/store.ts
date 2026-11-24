import type { Item } from "../shared/generated/models.ts";

export type Store = {
  list(): Promise<Item[]>;
  add(text: string): Promise<Item>;
  remove(id: string): Promise<boolean>;
};

/**
 * D1 is asynchronous, unlike node:sqlite, so every method is awaited. The store is
 * cheap and stateless: it is a thin wrapper over a binding, built per request.
 */
export function createStore(db: D1Database): Store {
  return {
    async list() {
      const { results } = await db
        .prepare("SELECT id, text FROM items ORDER BY rowid")
        .all<Item>();

      // D1 returns plain objects, but mapping keeps the shape the caller promised.
      return results.map((row) => ({ id: row.id, text: row.text }));
    },

    async add(text) {
      const item: Item = { id: crypto.randomUUID(), text };

      await db
        .prepare("INSERT INTO items (id, text) VALUES (?, ?)")
        .bind(item.id, item.text)
        .run();

      return item;
    },

    async remove(id) {
      const result = await db.prepare("DELETE FROM items WHERE id = ?").bind(id).run();
      return (result.meta.changes ?? 0) > 0;
    },
  };
}
