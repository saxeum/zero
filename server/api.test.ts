import { SELF } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";
import type { Item } from "../shared/generated/models.ts";
import { origin, signIn } from "./testing.ts";

// SELF.fetch goes through the real worker: routing, bindings, D1, Better Auth, the lot.
let cookie: string;

beforeAll(async () => {
  cookie = await signIn();
});

const auth = (extra: Record<string, string> = {}) => ({ Cookie: cookie, ...extra });

const get = (headers: Record<string, string> = auth()) =>
  SELF.fetch("http://zero.test/api/items", { headers });

const post = (body: string, headers: Record<string, string> = auth()) =>
  SELF.fetch("http://zero.test/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });

const del = (id: string, headers: Record<string, string> = auth()) =>
  SELF.fetch(`http://zero.test/api/items/${id}`, { method: "DELETE", headers });

const items = async (headers?: Record<string, string>): Promise<Item[]> =>
  (await (await get(headers)).json()) as Item[];

describe("auth", () => {
  test("the dev password flow returns a session", async () => {
    const res = await SELF.fetch("http://zero.test/api/auth/get-session", {
      headers: auth(),
    });

    expect(res.status).toBe(200);
    const session = (await res.json()) as { user: { email: string } } | null;
    expect(session?.user.email).toBe("a@example.com");
  });

  test("get-session without a cookie is empty, not an error", async () => {
    const res = await SELF.fetch("http://zero.test/api/auth/get-session");

    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  test("sign-out invalidates the session it was given", async () => {
    const fresh = await signIn();
    const out = await SELF.fetch("http://zero.test/api/auth/sign-out", {
      method: "POST",
      // No Origin and this is a 403 — Better Auth's CSRF check, not our code.
      headers: { Cookie: fresh, Origin: origin },
    });

    expect(out.ok).toBe(true);

    const after = await SELF.fetch("http://zero.test/api/items", { headers: { Cookie: fresh } });
    expect(after.status).toBe(401);
  });
});

describe("items require a session", () => {
  test("no cookie: GET, POST and DELETE are all 401", async () => {
    const none: Record<string, string> = {};

    expect((await get(none)).status).toBe(401);
    expect((await post(JSON.stringify({ text: "x" }), none)).status).toBe(401);
    expect((await del("seed-1", none)).status).toBe(401);
  });

  test("a cookie-authenticated POST without Origin is 403", async () => {
    // Worth pinning: it is the CSRF defence, and it comes from the library, not from us.
    const out = await SELF.fetch("http://zero.test/api/auth/sign-out", {
      method: "POST",
      headers: { Cookie: cookie },
    });

    expect(out.status).toBe(403);
  });

  test("a made-up session cookie is 401", async () => {
    const res = await get({ Cookie: "better-auth.session_token=not-a-real-token" });

    expect(res.status).toBe(401);
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
