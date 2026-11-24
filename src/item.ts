export type Item = { id: string; text: string };

/**
 * The compiler believes whatever `res.json()` says; this is the runtime half of
 * that contract. Anything off-shape throws, so it lands in the caller's error path
 * instead of becoming corrupt state.
 */
export function parseItem(value: unknown): Item {
  if (typeof value !== "object" || value === null) {
    throw new Error("item is not an object");
  }
  const { id, text } = value as Record<string, unknown>;
  if (typeof id !== "string" || typeof text !== "string") {
    throw new Error("item is missing a string id/text");
  }
  return { id, text };
}

export function parseItems(value: unknown): Item[] {
  if (!Array.isArray(value)) {
    throw new Error("items is not an array");
  }
  return value.map(parseItem);
}
