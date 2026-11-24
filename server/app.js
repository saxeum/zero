import { Hono } from "hono";
import { add, list, remove } from "./store.js";

export const app = new Hono();

app.get("/api/items", (c) =>
  c.json(list(), 200, { "Cache-Control": "no-store" }),
);

app.post("/api/items", async (c) => {
  const body = await c.req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return c.text("text required\n", 400);

  return c.json(add(text), 201);
});

app.delete("/api/items/:id", (c) => {
  const id = c.req.param("id");
  if (!remove(id)) return c.text("not found\n", 404);
  return c.body(null, 204);
});
