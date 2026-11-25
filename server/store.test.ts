import { env } from "cloudflare:test";
import { beforeEach, describe, expect, test } from "vitest";
import { createStore } from "./store.ts";

// The store talks to a real D1 database, migrated by test-setup.ts. Isolation between
// tests is not provided by the plugin, so test-setup resets the rows before each test.
const store = () => createStore(env.DB);

const A = "user-a";
const B = "user-b";

// `items.owner` has a foreign key to `user`, so the fixture has to be believable: an
// inventoried owner is rejected by the database, which is the point of the constraint.
const ensureUser = (id: string) =>
  env.DB.prepare('INSERT OR IGNORE INTO "user" (id, name, email) VALUES (?, ?, ?)')
    .bind(id, id, `${id}@example.com`)
    .run();

beforeEach(async () => {
  await ensureUser(A);
  await ensureUser(B);
});

describe("list", () => {
  test("starts empty — the old seed rows are deleted by the ownership migration", async () => {
    expect(await store().list(A)).toEqual([]);
  });

  test("returns only the calling user's items, in insertion order", async () => {
    await store().add(A, "first");
    await store().add(B, "not mine");
    await store().add(A, "second");

    expect((await store().list(A)).map((item) => item.text)).toEqual(["first", "second"]);
    expect((await store().list(B)).map((item) => item.text)).toEqual(["not mine"]);
  });

  test("returns plain objects, not driver rows", async () => {
    await store().add(A, "one");
    const [first] = await store().list(A);

    expect(Object.getPrototypeOf(first)).toBe(Object.prototype);
  });
});

describe("add", () => {
  test("returns the stored item with a generated id", async () => {
    const item = await store().add(A, "buy milk");

    expect(item.text).toBe("buy milk");
    expect(item.id.length).toBeGreaterThan(0);
    expect((await store().list(A)).at(-1)).toEqual(item);
  });
});

describe("the owner constraints", () => {
  test("rejects an item whose owner does not exist", async () => {
    // D1 enforces foreign keys, so this is a real constraint: an item cannot outlive the
    // user it belongs to.
    await expect(store().add("no-such-user", "orphan")).rejects.toThrow(/FOREIGN KEY/i);
  });

  test("rejects an item with no owner at all", async () => {
    await expect(
      env.DB.prepare("INSERT INTO items (id, text) VALUES ('x', 'no owner')").run(),
    ).rejects.toThrow(/NOT NULL/i);
  });

  test("deleting the user deletes their items", async () => {
    await store().add(A, "goes with the user");

    await env.DB.prepare('DELETE FROM "user" WHERE id = ?').bind(A).run();

    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM items WHERE owner = ?")
      .bind(A)
      .first<{ n: number }>();
    expect(count?.n).toBe(0);
  });
});

describe("remove", () => {
  test("reports whether anything was deleted", async () => {
    const item = await store().add(A, "gone");

    expect(await store().remove(A, item.id)).toBe(true);
    expect(await store().remove(A, item.id)).toBe(false);
    expect(await store().list(A)).toEqual([]);
  });

  test("will not delete another user's item, and does not distinguish it from a missing one", async () => {
    const mine = await store().add(A, "mine");

    expect(await store().remove(B, mine.id)).toBe(false);
    expect((await store().list(A)).map((item) => item.id)).toEqual([mine.id]);
  });
});
