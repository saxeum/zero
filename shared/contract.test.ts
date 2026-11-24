import { describe, expect, test } from "vitest";
import { CreateItemResponse, ListItemsResponse } from "./generated/api.ts";

// The response half of the boundary. The request half is covered through HTTP in
// server/api.test.ts, which exercises CreateItemBody via POST.

describe("CreateItemResponse", () => {
  test("accepts a well-formed item", () => {
    expect(CreateItemResponse.parse({ id: "a", text: "milk" })).toEqual({ id: "a", text: "milk" });
  });

  test("rejects a non-object", () => {
    for (const bad of [null, undefined, "x", 3, true]) {
      expect(() => CreateItemResponse.parse(bad)).toThrow();
    }
  });

  test("rejects missing or non-string fields", () => {
    expect(() => CreateItemResponse.parse({ id: "a" })).toThrow();
    expect(() => CreateItemResponse.parse({ text: "milk" })).toThrow();
    expect(() => CreateItemResponse.parse({ id: 1, text: "milk" })).toThrow();
    expect(() => CreateItemResponse.parse({ id: "a", text: null })).toThrow();
  });

  test("rejects unknown fields", () => {
    expect(() => CreateItemResponse.parse({ id: "a", text: "milk", extra: 1 })).toThrow();
  });
});

describe("ListItemsResponse", () => {
  test("accepts an array of items", () => {
    expect(ListItemsResponse.parse([{ id: "a", text: "milk" }])).toEqual([{ id: "a", text: "milk" }]);
    expect(ListItemsResponse.parse([])).toEqual([]);
  });

  test("rejects a non-array, and fails on a bad element", () => {
    expect(() => ListItemsResponse.parse({ 0: { id: "a", text: "b" } })).toThrow();
    expect(() => ListItemsResponse.parse([{ id: "a", text: "b" }, { id: "c" }])).toThrow();
  });
});
