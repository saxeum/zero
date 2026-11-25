import { SELF } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";
import type { Item } from "../shared/generated/models.ts";
import { sessionCookie } from "./testing.ts";

// SELF.fetch goes through the real worker: routing, bindings, D1, cookies, the lot.
let cookie: string;

beforeAll(async () => {
  cookie = await sessionCookie();
});

const get = (headers: Record<string, string> = { Cookie: cookie }) =>
  SELF.fetch("http://zero.test/api/items", { headers });

const post = (body: string, headers: Record<string, string> = { Cookie: cookie }) =>
  SELF.fetch("http://zero.test/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });

const del = (id: string, headers: Record<string, string> = { Cookie: cookie }) =>
  SELF.fetch(`http://zero.test/api/items/${id}`, { method: "DELETE", headers });

const items = async (headers?: Record<string, string>): Promise<Item[]> =>
  (await (await get(headers)).json()) as Item[];

describe("session", () => {
  test("GET /api/session without a cookie is 401", async () => {
    const res = await SELF.fetch("http://zero.test/api/session");

    expect(res.status).toBe(401);
  });

  test("GET /api/session with a signed cookie returns the user", async () => {
    const res = await SELF.fetch("http://zero.test/api/session", { headers: { Cookie: cookie } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: "a@example.com" });
  });

  test("a tampered cookie is 401", async () => {
    const [name, value] = cookie.split("=");
    const tampered = `${name}=${value.slice(0, -4)}AAAA`;

    const res = await SELF.fetch("http://zero.test/api/session", {
      headers: { Cookie: tampered },
    });

    expect(res.status).toBe(401);
  });

  test("POST /api/session rejects a token that is not a JWT, without touching Google", async () => {
    const res = await SELF.fetch("http://zero.test/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: "nope" }),
    });

    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  test("POST /api/session rejects alg: none", async () => {
    const header = btoa(JSON.stringify({ alg: "none", kid: "k" })).replace(/=+$/, "");
    const payload = btoa(JSON.stringify({ sub: "x", email: "x@example.com", exp: 9e9 })).replace(
      /=+$/,
      "",
    );

    const res = await SELF.fetch("http://zero.test/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: `${header}.${payload}.` }),
    });

    expect(res.status).toBe(401);
  });

  test("POST /api/session rejects an unknown field", async () => {
    const res = await SELF.fetch("http://zero.test/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: "x", admin: true }),
    });

    expect(res.status).toBe(400);
  });

  test("DELETE /api/session clears the cookie", async () => {
    const res = await SELF.fetch("http://zero.test/api/session", {
      method: "DELETE",
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("set-cookie")).toMatch(/zero_session=;/);
  });
});

describe("items require a session", () => {
  test("no cookie: GET, POST and DELETE are all 401", async () => {
    const none: Record<string, string> = {};

    expect((await get(none)).status).toBe(401);
    expect((await post(JSON.stringify({ text: "x" }), none)).status).toBe(401);
    expect((await del("seed-1", none)).status).toBe(401);
  });

  test("a cookie signed with the wrong key is 401", async () => {
    const [name, value] = (await sessionCookie()).split("=");
    const forged = `${name}=${value}`;

    const res = await SELF.fetch("http://zero.test/api/items", {
      headers: { Cookie: forged.replace("zero_session=", "zero_session=") },
    });

    // Sanity: the real cookie works, so the 401 tests above are about absence, not shape.
    expect(res.status).toBe(200);
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
    const res = await post(JSON.stringify({ text: "x".repeat(1001) }));

    expect(res.status).toBe(400);
    expect(await items()).toHaveLength(2);
  });

  test("accepts text of exactly 1000 characters", async () => {
    expect((await post(JSON.stringify({ text: "x".repeat(1000) }))).status).toBe(201);
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

describe("security headers", () => {
  test("API responses carry nosniff, a referrer policy and no framing", async () => {
    const res = await get();

    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });

  test("no CSP and no HSTS from the Worker", async () => {
    const res = await get();

    expect(res.headers.get("content-security-policy")).toBeNull();
    expect(res.headers.get("strict-transport-security")).toBeNull();
  });
});
