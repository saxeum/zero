import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { createStore } from "./store.ts";
import { CreateItemBody } from "../shared/generated/api.ts";

export const app = new Hono<{ Bindings: Env }>();

// Only the API gets these: the page and its bundle are served by the assets binding
// before this Worker runs, and their policy lives in public/_headers. A CSP on a JSON
// response would be inert — nosniff is what stops it being rendered as a document.
// HSTS is left to the zone: includeSubDomains is a domain-wide promise that a toy app
// has no business making on behalf of the other hosts under foonix.net.
app.use(
  "*",
  secureHeaders({
    // No CSP option at all: Hono only emits one when given options, and a JSON
    // response does not need a policy — it needs to not be rendered as a document.
    strictTransportSecurity: false,
    xFrameOptions: "DENY",
    referrerPolicy: "strict-origin-when-cross-origin",
  }),
);

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
