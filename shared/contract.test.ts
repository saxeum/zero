/// <reference types="node" />
import test from "node:test";
import assert from "node:assert/strict";
import { CreateItemResponse, ListItemsResponse } from "./generated/api.ts";

test("CreateItemResponse accepts a well-formed item", () => {
  assert.deepEqual(CreateItemResponse.parse({ id: "a", text: "milk" }), { id: "a", text: "milk" });
});

test("CreateItemResponse rejects a non-object", () => {
  for (const bad of [null, undefined, "x", 3, true]) {
    assert.throws(() => CreateItemResponse.parse(bad));
  }
});

test("CreateItemResponse rejects missing or non-string fields", () => {
  assert.throws(() => CreateItemResponse.parse({ id: "a" }));
  assert.throws(() => CreateItemResponse.parse({ text: "milk" }));
  assert.throws(() => CreateItemResponse.parse({ id: 1, text: "milk" }));
  assert.throws(() => CreateItemResponse.parse({ id: "a", text: null }));
});

test("CreateItemResponse rejects unknown fields", () => {
  assert.throws(() => CreateItemResponse.parse({ id: "a", text: "milk", extra: 1 }));
});

test("ListItemsResponse accepts an array of items", () => {
  assert.deepEqual(ListItemsResponse.parse([{ id: "a", text: "milk" }]), [{ id: "a", text: "milk" }]);
  assert.deepEqual(ListItemsResponse.parse([]), []);
});

test("ListItemsResponse rejects a non-array, and fails on a bad element", () => {
  assert.throws(() => ListItemsResponse.parse({ 0: { id: "a", text: "b" } }));
  assert.throws(() => ListItemsResponse.parse([{ id: "a", text: "b" }, { id: "c" }]));
});
