const items = [
  { id: "seed-1", text: "learn useEffect" },
  { id: "seed-2", text: "fetch from the server" },
];

export function list() {
  return items;
}

export function add(text) {
  const item = { id: crypto.randomUUID(), text };
  items.push(item);
  return item;
}
