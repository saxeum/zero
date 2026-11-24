import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { app } from "./app.js";
import { reset } from "./store.js";

beforeEach(() => reset());

const post = (body) =>
  app.request("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

test("GET returns the stored items", async () => {
  const res = await app.request("/api/items");

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), [
    { id: "seed-1", text: "learn useEffect" },
    { id: "seed-2", text: "fetch from the server" },
  ]);
});

test("POST creates an item, trims it, and it is listed after", async () => {
  const res = await post(JSON.stringify({ text: "  buy milk  " }));

  assert.equal(res.status, 201);
  const created = await res.json();
  assert.equal(created.text, "buy milk");
  assert.equal(typeof created.id, "string");
  assert.ok(created.id.length > 0);

  const all = await (await app.request("/api/items")).json();
  assert.equal(all.length, 3);
  assert.deepEqual(all.at(-1), created);
});

test("POST rejects blank text", async () => {
  const res = await post(JSON.stringify({ text: "   " }));

  assert.equal(res.status, 400);
  assert.equal((await (await app.request("/api/items")).json()).length, 2);
});

test("POST rejects a missing text field", async () => {
  const res = await post(JSON.stringify({}));

  assert.equal(res.status, 400);
});

test("POST rejects invalid JSON with 400, not 500", async () => {
  const res = await post("not json");

  assert.equal(res.status, 400);
});

test("DELETE removes the item and returns 204", async () => {
  const res = await app.request("/api/items/seed-1", { method: "DELETE" });

  assert.equal(res.status, 204);
  const all = await (await app.request("/api/items")).json();
  assert.deepEqual(
    all.map((item) => item.id),
    ["seed-2"],
  );
});

test("DELETE on an unknown id returns 404", async () => {
  const res = await app.request("/api/items/does-not-exist", {
    method: "DELETE",
  });

  assert.equal(res.status, 404);
});

test("DELETE is not idempotent in status: the second call is 404", async () => {
  assert.equal((await app.request("/api/items/seed-1", { method: "DELETE" })).status, 204);
  assert.equal((await app.request("/api/items/seed-1", { method: "DELETE" })).status, 404);
});
