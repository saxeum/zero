import { Hono } from "hono";
import { createStore } from "./store.ts";
import { CreateItemBody } from "../shared/generated/api.ts";

export const app = new Hono<{ Bindings: Env }>();

app.get("/api/items", async (c) =>
  c.json(await createStore(c.env.DB).list(), 200, { "Cache-Control": "no-store" }),
);

app.post("/api/items", async (c) => {
  const body = await c.req.json().catch(() => undefined);

  let text: string;
  try {
    text = CreateItemBody.parse(body).text.trim();
  } catch {
    return c.text("invalid body\n", 400);
  }
  if (!text) return c.text("text required\n", 400);

  return c.json(await createStore(c.env.DB).add(text), 201);
});

app.delete("/api/items/:id", async (c) => {
  if (!(await createStore(c.env.DB).remove(c.req.param("id")))) {
    return c.text("not found\n", 404);
  }
  return c.body(null, 204);
});
