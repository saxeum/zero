import type { Item } from "../shared/generated/models.ts";

export type Store = {
  list(owner: string): Promise<Item[]>;
  add(owner: string, text: string): Promise<Item>;
  remove(owner: string, id: string): Promise<boolean>;
};

/**
 * D1 is asynchronous, unlike node:sqlite, so every method is awaited. The store is
 * cheap and stateless: it is a thin wrapper over a binding, built per request.
 *
 * Every method takes the owner, and every query filters on it. There is deliberately no
 * "find by id" that ignores ownership — the delete is scoped, so another user's id is
 * indistinguishable from one that does not exist.
 */
export function createStore(db: D1Database): Store {
  return {
    async list(owner) {
      const { results } = await db
        .prepare("SELECT id, text FROM items WHERE owner = ? ORDER BY rowid")
        .bind(owner)
        .all<Item>();

      // D1 returns plain objects, but mapping keeps the shape the caller promised.
      return results.map((row) => ({ id: row.id, text: row.text }));
    },

    async add(owner, text) {
      const item: Item = { id: crypto.randomUUID(), text };

      await db
        .prepare("INSERT INTO items (id, text, owner) VALUES (?, ?, ?)")
        .bind(item.id, item.text, owner)
        .run();

      return item;
    },

    async remove(owner, id) {
      const result = await db
        .prepare("DELETE FROM items WHERE id = ? AND owner = ?")
        .bind(id, owner)
        .run();

      return (result.meta.changes ?? 0) > 0;
    },
  };
}
