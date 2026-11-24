import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "./store.ts";

const SEED = [
  { id: "seed-1", text: "learn useEffect" },
  { id: "seed-2", text: "fetch from the server" },
];

const tempDirs: string[] = [];

/** A path inside a throwaway directory, so the file can be closed and reopened. */
const tempDb = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "zero-store-"));
  tempDirs.push(dir);
  return join(dir, "items.db");
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("a new database is seeded", () => {
  const store = createStore(":memory:");

  assert.deepEqual(store.list(), SEED);
  // Not the driver's null-prototype rows: callers must get plain objects.
  assert.equal(Object.getPrototypeOf(store.list()[0]), Object.prototype);
  store.close();
});

test("list preserves insertion order", () => {
  const store = createStore(":memory:");

  store.add("first");
  store.add("second");

  assert.deepEqual(
    store.list().map((item) => item.text),
    ["learn useEffect", "fetch from the server", "first", "second"],
  );
  store.close();
});

test("add returns the stored item with a generated id", () => {
  const store = createStore(":memory:");

  const item = store.add("buy milk");

  assert.equal(item.text, "buy milk");
  assert.ok(item.id.length > 0);
  assert.deepEqual(store.list().at(-1), item);
  store.close();
});

test("remove reports whether anything was deleted", () => {
  const store = createStore(":memory:");

  assert.equal(store.remove("seed-1"), true);
  assert.equal(store.remove("seed-1"), false);
  assert.deepEqual(
    store.list().map((item) => item.id),
    ["seed-2"],
  );
  store.close();
});

test("an existing database is never reseeded, even when emptied", () => {
  const file = tempDb();

  const first = createStore(file);
  for (const item of first.list()) first.remove(item.id);
  assert.deepEqual(first.list(), []);
  first.close();

  const reopened = createStore(file);
  assert.deepEqual(reopened.list(), []);
  reopened.close();
});

test("data written to a file survives a reopen", () => {
  const file = tempDb();

  const first = createStore(file);
  const item = first.add("persisted");
  first.close();

  const reopened = createStore(file);
  assert.deepEqual(reopened.list().at(-1), item);
  reopened.close();
});

test("creating a database creates its directory", () => {
  const store = createStore(join(tempDb(), "nested", "items.db"));

  assert.equal(store.list().length, 2);
  store.close();
});
