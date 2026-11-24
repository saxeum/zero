import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";
import { createStore } from "./store.ts";

// The store talks to a real D1 database, migrated by test-setup.ts. Isolated storage
// means each test sees the seed rows and its own writes, then rolls back.
const store = () => createStore(env.DB);

describe("list", () => {
  test("returns the seeded items in insertion order", async () => {
    expect(await store().list()).toEqual([
      { id: "seed-1", text: "learn useEffect" },
      { id: "seed-2", text: "fetch from the server" },
    ]);
  });

  test("returns plain objects, not driver rows", async () => {
    const [first] = await store().list();
    expect(Object.getPrototypeOf(first)).toBe(Object.prototype);
  });
});

describe("add", () => {
  test("returns the stored item with a generated id", async () => {
    const item = await store().add("buy milk");

    expect(item.text).toBe("buy milk");
    expect(item.id.length).toBeGreaterThan(0);
    expect((await store().list()).at(-1)).toEqual(item);
  });

  test("appends after the existing rows", async () => {
    await store().add("first");
    await store().add("second");

    expect((await store().list()).map((item) => item.text)).toEqual([
      "learn useEffect",
      "fetch from the server",
      "first",
      "second",
    ]);
  });
});

describe("remove", () => {
  test("reports whether anything was deleted", async () => {
    expect(await store().remove("seed-1")).toBe(true);
    expect(await store().remove("seed-1")).toBe(false);
    expect((await store().list()).map((item) => item.id)).toEqual(["seed-2"]);
  });
});
