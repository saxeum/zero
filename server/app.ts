import { Hono } from "hono";
import { add, list, remove } from "./store.ts";
import { parseNewItem } from "../shared/item.ts";

export const app = new Hono();

app.get("/api/items", (c) => c.json(list(), 200, { "Cache-Control": "no-store" }));

app.post("/api/items", async (c) => {
  const body = await c.req.json().catch(() => undefined);

  let text: string;
  try {
    text = parseNewItem(body).text.trim();
  } catch {
    return c.text("invalid body\n", 400);
  }
  if (!text) return c.text("text required\n", 400);

  return c.json(add(text), 201);
});

app.delete("/api/items/:id", (c) => {
  const id = c.req.param("id");
  if (!remove(id)) return c.text("not found\n", 404);
  return c.body(null, 204);
});
