# zero

Live at **https://zero.foonix.net**.

The API now requires a session cookie, but the Google sign-in button is not built yet, so the
deployed page says so rather than showing an empty list. Signing in, and making items belong to
someone, is epic #33.

A todo list built from scratch, as a way of actually understanding React instead of learning its
tooling. No component library, no state manager, no ORM, no CSS framework.

The history is the point: it starts as three files with `React.createElement` and a 55-line
`node:http` server, and moves through Hono, JSX, Vite, TypeScript and real tests one decision at a
time. `TODO.md` is the ladder, including what was deliberately skipped and why.

## Stack

- Client: React 18 + TypeScript, built by Vite
- Runtime: a **Cloudflare Worker** — Hono, no Node APIs, no server process
- Contract: **`openapi.yaml` is the source of truth.** `npm run codegen` (orval) generates the
  TypeScript types and zod validators in `shared/generated/`, imported directly by both sides
- Persistence: **D1** (Cloudflare's SQLite), no ORM. The schema and seeds live in
  `migrations/`, applied with `wrangler d1 migrations apply`.

## Running it

```sh
npm ci          # `prepare` generates shared/generated/ and worker-configuration.d.ts
npm run build && npm start
```

Then <http://127.0.0.1:8787>. One Worker serves both the built client (via the assets binding)
and the API (via D1).

For development, two terminals:

```sh
npm run api   # :8787, wrangler dev — the worker, its bindings, and a local D1
npm run dev   # :5173, Vite with HMR, proxying /api to :8787
```

The first time, create and migrate the local database:

```sh
npx wrangler d1 migrations apply zero --local
```

## Scripts

| | |
|---|---|
| `npm run dev` | Vite dev server on :5173 |
| `npm run api` | `wrangler dev` on :8787 — worker + local D1 |
| `npm run build` | build the client into `dist/` |
| `npm start` | build, then `wrangler dev` on :8787 |
| `npm run check` | `tsc` for the client and, separately, for the server |
| `npm run gen` | regenerate `shared/generated/` and `worker-configuration.d.ts` |
| `npm run codegen` | `shared/generated/` only, from `openapi.yaml` |
| `npm test` | `vitest` **inside workerd**: 21 tests against a real local D1 |
| `npm run coverage` | tests plus Node's built-in coverage report |
| `npm run budget` | fail if the gzipped client exceeds 95 kB |
| `npm run knip` | dead code and unused exports |
| `npm run verify` | `check` → `check:codegen` → `build` → `budget` → `test` → `knip`, the gate CI runs |
| `npm run deploy` | build, then `wrangler deploy` |
| `npm run migrate` | apply `migrations/` to the remote D1 |
| `npm run smoke -- <url>` | end-to-end checks against a running Worker |
| `npm run types` | regenerate `worker-configuration.d.ts` from `wrangler.jsonc` |
| `npm run load` | `autocannon` against a local `wrangler dev` |

## Deploying

Pushing to `main` deploys. `.github/workflows/deploy.yml` runs `verify`, applies the D1
migrations, then `wrangler deploy` — so nothing reaches production unless the same six gates
passed locally.

Two things must exist in the repository, both created by a human:

| | | |
|---|---|---|
| secret | `CLOUDFLARE_API_TOKEN` | scoped to this account, Workers Scripts:Edit, D1:Edit, and the zone for the custom domain |
| variable | `CLOUDFLARE_ACCOUNT_ID` | `d6731c0c283d979c42e1a7b0aba0d4b6` |

The last job step is `npm run smoke -- https://zero.foonix.net`: it loads the page, round-trips
an item through the API, and checks that an unknown field is still rejected. It is the only gate
that ever sees production, it runs on every deploy, and it cleans up after itself.

Note what a red smoke test does *not* do: roll back. Production is already updated by the time it
runs, so red means "go and look".

Migrations run **before** the Worker, which is only safe while they are additive — an old Worker
tolerates a new column, a new Worker does not tolerate a missing one. Destructive changes take two
deploys: expand, then contract.

`npm run deploy` still works from a laptop, and until the secret exists it is the only way to ship.
That makes it the one documented exception to "nothing is applied outside the pipeline".

## Session

`POST /api/session` takes a **Google ID token** (from Google Identity Services), verifies it in the
Worker — RS256 against Google's JWKS, plus `iss`, `aud`, `exp` — and sets a signed session cookie
(`HttpOnly; Secure; SameSite=Lax`, 30 days). `GET /api/session` reports the current user, `DELETE`
clears it.

The session cookie is `base64url(payload).base64url(HMAC-SHA256)`, keyed by the `SESSION_SECRET`
Worker secret. Signed, not encrypted: it holds an email, which is not a secret. Verification is
constant-time (`crypto.subtle.verify`), and any tampering, wrong key or expiry is a plain **401** —
with no distinction between them, because the caller has no use for it.

`GOOGLE_CLIENT_ID` is public (it is in `wrangler.jsonc`) and every browser receives it. The
**client secret is not used at all**: this is a public client, the flow has no code exchange, and a
secret shipped to a browser is not a secret.

## Security headers

Two surfaces, two mechanisms, because they are served by two different things.

**The page and its bundle** never reach the Worker — the assets binding answers them — so their
policy is `public/_headers`:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; …
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
```

Every source is `'self'` because the build emits one external module script and one external
stylesheet, with no inline script, no inline style and no `eval`. That is what makes a strict policy
possible without nonces or hashes — and the CSP is what will complain loudly, in the browser console,
if that ever stops being true.

**The API** gets its headers from Hono's `secureHeaders()` in `server/app.ts`: `nosniff`,
`strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, plus the cross-origin isolation pair.
Deliberately *not* set there:

- **no CSP** — inert on JSON; `nosniff` is what stops a JSON body being rendered as a document.
- **no HSTS** — `includeSubDomains` is a promise for every host under `foonix.net`, which a toy app
  has no business making. That belongs to the zone.

`npm run smoke` asserts the CSP and `nosniff` are present on the deployed page, and the API tests
assert the two absences above, so neither decision can be reversed by accident.

## Layout

```
index.html            Vite entry
src/main.tsx          createRoot + StrictMode
src/App.tsx           layout: form, filter, list
src/useItems.ts       the data hook: fetch, add, remove, both error slots
wrangler.jsonc        Worker config: assets binding, D1 binding, custom domain
worker-configuration.d.ts  generated by `wrangler types` — not committed
migrations/           schema + seed rows, applied by wrangler
openapi.yaml          the API contract — edit this first, then regenerate
orval.config.ts       codegen config: zod client, strict objects
shared/generated/     generated types + zod validators — not committed, built by `npm ci`
shared/contract.test.ts  the response validators, exercised directly
scripts/bundle-budget.mjs  the gzipped-size tripwire
server/worker.ts      the Worker entry: `export default app`
server/app.ts         Hono routes; reads the D1 binding per request
server/store.ts       D1 queries behind an async Store interface
test-setup.ts         applies migrations and resets rows between tests
```

## API

`GET|POST|DELETE /api/session` and `GET|POST|DELETE /api/items[/{id}]`, described in
`openapi.yaml`, which is authoritative. `POST` rejects text over 1000 characters; `Item.text` is
deliberately uncapped so existing rows stay readable if the limit ever changes. Deliberately not repeated here: a second description of
the API is the drift this project spent a rung removing.

## Notes

`TODO.md` is the learning ladder and the reasoning behind it; `notes.md` records what the load test
does and does not measure.
