/// <reference types="node" />
import test from "node:test";
import assert from "node:assert/strict";
import { parseItem, parseItems } from "./item.ts";

test("parseItem accepts a well-formed item", () => {
  assert.deepEqual(parseItem({ id: "a", text: "milk", extra: 1 }), {
    id: "a",
    text: "milk",
  });
});

test("parseItem rejects a non-object", () => {
  for (const bad of [null, undefined, "x", 3, true]) {
    assert.throws(() => parseItem(bad));
  }
});

test("parseItem rejects missing or non-string fields", () => {
  assert.throws(() => parseItem({ id: "a" }));
  assert.throws(() => parseItem({ text: "milk" }));
  assert.throws(() => parseItem({ id: 1, text: "milk" }));
  assert.throws(() => parseItem({ id: "a", text: null }));
});

test("parseItems accepts an array of items", () => {
  assert.deepEqual(parseItems([{ id: "a", text: "milk" }]), [
    { id: "a", text: "milk" },
  ]);
  assert.deepEqual(parseItems([]), []);
});

test("parseItems rejects a non-array, and fails on a bad element", () => {
  assert.throws(() => parseItems({ 0: { id: "a", text: "b" } }));
  assert.throws(() => parseItems([{ id: "a", text: "b" }, { id: "c" }]));
});
