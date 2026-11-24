# zero

Live at **https://zero.foonix.net** — public, no accounts, anyone with the URL can add or
delete items.

A todo list built from scratch, as a way of actually understanding React instead of learning its
tooling. No component library, no state manager, no ORM, no CSS framework.

The history is the point: it starts as three files with `React.createElement` and a 55-line
`node:http` server, and moves through Hono, JSX, Vite, TypeScript and real tests one decision at a
time. `TODO.md` is the ladder, including what was deliberately skipped and why.

## Stack

- Client: React 18 + TypeScript, built by Vite
- Runtime: a **Cloudflare Worker** — Hono, no Node APIs, no server process
- Contract: **`openapi.yaml` is the source of truth.** `npm run codegen` (orval) generates the
  TypeScript types and zod validators in `shared/generated/`, imported directly by both sides —
  `npm run verify` fails if the spec and the generated output disagree
- Persistence: **D1** (Cloudflare's SQLite), no ORM. The schema and seeds live in
  `migrations/`, applied with `wrangler d1 migrations apply`.

## Running it

```sh
npm ci
npm run types    # generate worker-configuration.d.ts from wrangler.jsonc
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
| `npm run codegen` | regenerate `shared/generated/` from `openapi.yaml` |
| `npm run check:codegen` | regenerate, then fail if that changed anything |
| `npm test` | `vitest` **inside workerd**: 21 tests against a real local D1 |
| `npm run coverage` | tests plus Node's built-in coverage report |
| `npm run budget` | fail if the gzipped client exceeds 95 kB |
| `npm run knip` | dead code and unused exports |
| `npm run verify` | `check` → `check:codegen` → `build` → `budget` → `test` → `knip`, the gate CI runs |
| `npm run deploy` | build, then `wrangler deploy` |
| `npm run types` | regenerate `worker-configuration.d.ts` from `wrangler.jsonc` |
| `npm run load` | `autocannon` against a local `wrangler dev` |

## Layout

```
index.html            Vite entry
src/main.tsx          createRoot + StrictMode
src/App.tsx           layout: form, filter, list
src/useItems.ts       the data hook: fetch, add, remove, both error slots
wrangler.jsonc        Worker config: assets binding, D1 binding, custom domain
migrations/           schema + seed rows, applied by wrangler
openapi.yaml          the API contract — edit this first, then regenerate
orval.config.ts       codegen config: zod client, strict objects
shared/generated/     generated types + zod validators (committed, do not edit)
shared/contract.test.ts  the response validators, exercised directly
scripts/bundle-budget.mjs  the gzipped-size tripwire
server/worker.ts      the Worker entry: `export default app`
server/app.ts         Hono routes; reads the D1 binding per request
server/store.ts       D1 queries behind an async Store interface
test-setup.ts         applies migrations and resets rows between tests
```

## API

Three endpoints — `GET /api/items`, `POST /api/items`, `DELETE /api/items/{id}` — described in
`openapi.yaml`, which is authoritative. Deliberately not repeated here: a second description of
the API is the drift this project spent a rung removing.

## Notes

`TODO.md` is the learning ladder and the reasoning behind it; `notes.md` records what the load test
does and does not measure.
