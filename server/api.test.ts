import { SELF } from "cloudflare:test";
import { describe, expect, test } from "vitest";
import type { Item } from "../shared/generated/models.ts";

// SELF.fetch goes through the real worker: routing, bindings, D1, the lot.
const get = () => SELF.fetch("http://zero.test/api/items");
const post = (body: string) =>
  SELF.fetch("http://zero.test/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
const del = (id: string) => SELF.fetch(`http://zero.test/api/items/${id}`, { method: "DELETE" });

const items = async (): Promise<Item[]> => (await (await get()).json()) as Item[];

describe("security headers", () => {
  test("API responses carry nosniff, a referrer policy and no framing", async () => {
    const res = await get();

    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });

  test("no CSP and no HSTS from the Worker", async () => {
    // The page's CSP lives in public/_headers, since assets never reach the Worker.
    // HSTS is left to the zone: includeSubDomains is a promise for every host under
    // the domain, and this Worker does not get to make it.
    const res = await get();

    expect(res.headers.get("content-security-policy")).toBeNull();
    expect(res.headers.get("strict-transport-security")).toBeNull();
  });
});

describe("GET /api/items", () => {
  test("returns the seeded items in insertion order", async () => {
    const res = await get();

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual([
      { id: "seed-1", text: "learn useEffect" },
      { id: "seed-2", text: "fetch from the server" },
    ]);
  });
});

describe("POST /api/items", () => {
  test("creates an item, trims it, and lists it afterwards", async () => {
    const res = await post(JSON.stringify({ text: "  buy milk  " }));

    expect(res.status).toBe(201);
    const created = (await res.json()) as Item;
    expect(created.text).toBe("buy milk");
    expect(created.id.length).toBeGreaterThan(0);

    const all = await items();
    expect(all).toHaveLength(3);
    expect(all.at(-1)).toEqual(created);
  });

  test("rejects blank text", async () => {
    expect((await post(JSON.stringify({ text: "   " }))).status).toBe(400);
    expect(await items()).toHaveLength(2);
  });

  test("rejects a missing text field", async () => {
    expect((await post(JSON.stringify({}))).status).toBe(400);
  });

  test("rejects a non-string text field", async () => {
    expect((await post(JSON.stringify({ text: 42 }))).status).toBe(400);
  });

  test("rejects unknown fields instead of dropping them", async () => {
    const res = await post(JSON.stringify({ text: "milk", id: "chosen-by-client" }));

    expect(res.status).toBe(400);
    expect(await items()).toHaveLength(2);
  });

  test("rejects invalid JSON with 400, not 500", async () => {
    expect((await post("not json")).status).toBe(400);
  });

  test("rejects text longer than the 1000-character cap", async () => {
    // The cap exists to bound the body and the stored row: before it, a 1 MB item was
    // accepted and every later GET shipped those bytes to every client.
    const res = await post(JSON.stringify({ text: "x".repeat(1001) }));

    expect(res.status).toBe(400);
    expect(await items()).toHaveLength(2);
  });

  test("accepts text of exactly 1000 characters", async () => {
    const res = await post(JSON.stringify({ text: "x".repeat(1000) }));

    expect(res.status).toBe(201);
  });
});

describe("DELETE /api/items/:id", () => {
  test("removes the item and returns 204", async () => {
    expect((await del("seed-1")).status).toBe(204);
    expect((await items()).map((item) => item.id)).toEqual(["seed-2"]);
  });

  test("returns 404 for an unknown id", async () => {
    expect((await del("nope")).status).toBe(404);
  });

  test("is not idempotent in status: the second call is 404", async () => {
    expect((await del("seed-1")).status).toBe(204);
    expect((await del("seed-1")).status).toBe(404);
  });
});
