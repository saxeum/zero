import type { Item } from "../shared/item.ts";

const seed: Item[] = [
  { id: "seed-1", text: "learn useEffect" },
  { id: "seed-2", text: "fetch from the server" },
];

let items: Item[] = [...seed];

export function list(): Item[] {
  return items;
}

export function add(text: string): Item {
  const item: Item = { id: crypto.randomUUID(), text };
  items.push(item);
  return item;
}

export function remove(id: string): boolean {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return false;
  items.splice(index, 1);
  return true;
}

export function reset(next: Item[] = seed): void {
  items = [...next];
}
