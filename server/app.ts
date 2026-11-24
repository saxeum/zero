import { Hono } from "hono";
import type { Store } from "./store.ts";
import { parseNewItem } from "../shared/item.ts";

export function createApp(store: Store) {
  const app = new Hono();

  app.get("/api/items", (c) => c.json(store.list(), 200, { "Cache-Control": "no-store" }));

  app.post("/api/items", async (c) => {
    const body = await c.req.json().catch(() => undefined);

    let text: string;
    try {
      text = parseNewItem(body).text.trim();
    } catch {
      return c.text("invalid body\n", 400);
    }
    if (!text) return c.text("text required\n", 400);

    return c.json(store.add(text), 201);
  });

  app.delete("/api/items/:id", (c) => {
    if (!store.remove(c.req.param("id"))) return c.text("not found\n", 404);
    return c.body(null, 204);
  });

  return app;
}
