import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";

const app = new Hono();

const items = [
  { id: "seed-1", text: "learn useEffect" },
  { id: "seed-2", text: "fetch from the server" },
];

app.get("/api/items", (c) =>
  c.json(items, 200, { "Cache-Control": "no-store" }),
);

app.post("/api/items", async (c) => {
  const body = await c.req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return c.text("text required\n", 400);

  const item = { id: crypto.randomUUID(), text };
  items.push(item);
  return c.json(item, 201);
});

app.get("/", serveStatic({ path: "./index.html" }));
app.get("/app.js", serveStatic({ path: "./app.js" }));

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`listening on http://localhost:${info.port}`);
});
