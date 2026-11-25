import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { createMiddleware } from "hono/factory";
import { createStore } from "./store.ts";
import { createAuth } from "./auth.ts";
import { CreateItemBody } from "../shared/generated/api.ts";

type Variables = {
  user: { id: string; email: string };
  userId: string;
};

export const app = new Hono<{ Bindings: Env; Variables: Variables }>();

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

// Better Auth owns its own routes: sign-in, the Google callback, sign-out, get-session.
// They are library-shaped, so they are deliberately not in openapi.yaml.
app.all("/api/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

/** Requires a valid session cookie, and puts the user on the context. */
const requireSession = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.text("unauthorized\n", 401);

    c.set("user", session.user);
    c.set("userId", session.user.id);
    await next();
  },
);

// One guard covers /api/items and /api/items/:id — the wildcard matches the bare path.
app.use("/api/items/*", requireSession);

app.get("/api/items", async (c) =>
  c.json(await createStore(c.env.DB).list(c.get("userId")), 200, { "Cache-Control": "no-store" }),
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

  return c.json(await createStore(c.env.DB).add(c.get("userId"), text), 201);
});

app.delete("/api/items/:id", async (c) => {
  // Scoped to the owner, so someone else's id answers 404 exactly like a missing one:
  // a 403 would confirm the row exists.
  if (!(await createStore(c.env.DB).remove(c.get("userId"), c.req.param("id")))) {
    return c.text("not found\n", 404);
  }
  return c.body(null, 204);
});
