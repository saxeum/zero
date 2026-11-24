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

export function remove(id) {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return false;
  items.splice(index, 1);
  return true;
}
