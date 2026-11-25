import { Hono } from "hono";
import type { Context } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createStore } from "./store.ts";
import { readSession, signSession, verifyIdToken, type Session } from "./auth.ts";
import { CreateItemBody, CreateSessionBody } from "../shared/generated/api.ts";

const COOKIE = "zero_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

type Variables = { session: Session };

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

const sessionFrom = (c: Context<{ Bindings: Env; Variables: Variables }>) =>
  readSession(getCookie(c, COOKIE), c.env.SESSION_SECRET);

/**
 * Guards the item routes. `/api/items/*` covers both `/api/items` and
 * `/api/items/:id` — verified by removing each half and watching the 401 tests fail,
 * so one middleware is enough.
 */
app.use("/api/items/*", async (c, next) => {
  const session = await sessionFrom(c);
  if (!session) return c.text("unauthorized\n", 401);
  c.set("session", session);
  await next();
});

app.get("/api/session", async (c) => {
  const session = await sessionFrom(c);
  if (!session) return c.text("unauthorized\n", 401);
  return c.json({ email: session.email });
});

app.post("/api/session", async (c) => {
  const body = await c.req.json().catch(() => undefined);

  let credential: string;
  try {
    credential = CreateSessionBody.parse(body).credential;
  } catch {
    return c.text("invalid body\n", 400);
  }

  let session: Session;
  try {
    session = await verifyIdToken(credential, { clientId: c.env.GOOGLE_CLIENT_ID });
  } catch (err) {
    // Logged, not returned: the reason is for us, the caller gets one answer.
    console.warn("session rejected:", err instanceof Error ? err.message : err);
    return c.text("invalid credential\n", 401);
  }

  setCookie(c, COOKIE, await signSession(session, c.env.SESSION_SECRET), {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });

  return c.json({ email: session.email });
});

app.delete("/api/session", (c) => {
  deleteCookie(c, COOKIE, { path: "/", secure: true, sameSite: "Lax" });
  return c.body(null, 204);
});

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
