import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./app.ts";
import { createStore, type Store } from "./store.ts";
import type { Item } from "../shared/item.ts";

let app: ReturnType<typeof createApp>;
let store: Store;

// A fresh :memory: database per test — no reset endpoint, no shared state.
beforeEach(() => {
  store = createStore(":memory:");
  app = createApp(store);
});

after(() => store.close());

const post = (body: string) =>
  app.request("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

const getItems = async (): Promise<Item[]> =>
  (await (await app.request("/api/items")).json()) as Item[];

test("GET returns the seeded items in insertion order", async () => {
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
  const created = (await res.json()) as Item;
  assert.equal(created.text, "buy milk");
  assert.equal(typeof created.id, "string");
  assert.ok(created.id.length > 0);

  const all = await getItems();
  assert.equal(all.length, 3);
  assert.deepEqual(all.at(-1), created);
});

test("POST rejects blank text", async () => {
  const res = await post(JSON.stringify({ text: "   " }));

  assert.equal(res.status, 400);
  assert.equal((await getItems()).length, 2);
});

test("POST rejects a missing text field", async () => {
  assert.equal((await post(JSON.stringify({}))).status, 400);
});

test("POST rejects a non-string text field", async () => {
  assert.equal((await post(JSON.stringify({ text: 42 }))).status, 400);
});

test("POST rejects unknown fields instead of dropping them", async () => {
  const res = await post(JSON.stringify({ text: "milk", id: "chosen-by-client" }));

  assert.equal(res.status, 400);
  assert.equal((await getItems()).length, 2);
});

test("POST rejects invalid JSON with 400, not 500", async () => {
  assert.equal((await post("not json")).status, 400);
});

test("DELETE removes the item and returns 204", async () => {
  const res = await app.request("/api/items/seed-1", { method: "DELETE" });

  assert.equal(res.status, 204);
  assert.deepEqual(
    (await getItems()).map((item) => item.id),
    ["seed-2"],
  );
});

test("DELETE on an unknown id returns 404", async () => {
  assert.equal((await app.request("/api/items/nope", { method: "DELETE" })).status, 404);
});

test("DELETE is not idempotent in status: the second call is 404", async () => {
  assert.equal((await app.request("/api/items/seed-1", { method: "DELETE" })).status, 204);
  assert.equal((await app.request("/api/items/seed-1", { method: "DELETE" })).status, 404);
});
