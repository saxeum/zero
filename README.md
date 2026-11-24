# zero

A todo list built from scratch, as a way of actually understanding React instead of learning its
tooling. No component library, no state manager, no ORM, no CSS framework.

The history is the point: it starts as three files with `React.createElement` and a 55-line
`node:http` server, and moves through Hono, JSX, Vite, TypeScript and real tests one decision at a
time. `TODO.md` is the ladder, including what was deliberately skipped and why.

## Stack

- Client: React 18 + TypeScript, built by Vite
- Server: Hono on Node, written in TypeScript and run directly (Node strips types)
- Contract: **`openapi.yaml` is the source of truth.** `npm run codegen` (orval) generates the
  TypeScript types and zod validators in `shared/generated/`, imported directly by both sides —
  `npm run verify` fails if the spec and the generated output disagree
- Persistence: `node:sqlite` (built into Node, no ORM, no dependency). The database is
  `data/items.db`, seeded once on first creation. `ZERO_DB=:memory:` overrides the path.

## Running it

```sh
npm ci
npm run build && npm start
```

Then <http://localhost:3000>. One process serves both the built client and the API.

For development, two terminals:

```sh
npm run api   # :3000, the API
npm run dev   # :5173, Vite with HMR, proxying /api to :3000
```

## Scripts

| | |
|---|---|
| `npm run dev` | Vite dev server on :5173 |
| `npm run api` | API only on :3000 (dev) |
| `npm run build` | build the client into `dist/` |
| `npm start` | build, then serve client and API on :3000 |
| `npm run check` | `tsc` for the client and, separately, for the server |
| `npm run codegen` | regenerate `shared/generated/` from `openapi.yaml` |
| `npm run check:codegen` | regenerate, then fail if that changed anything |
| `npm test` | `node --test` — 26 tests: API, store, shared guards, entry point |
| `npm run coverage` | tests plus Node's built-in coverage report |
| `npm run budget` | fail if the gzipped client exceeds 95 kB |
| `npm run knip` | dead code and unused exports |
| `npm run verify` | `check` → `check:codegen` → `build` → `budget` → `test` → `knip`, the gate CI runs |
| `npm run load` | `autocannon` against `/api/items` |

## Layout

```
index.html            Vite entry
src/main.tsx          createRoot + StrictMode
src/App.tsx           layout: form, filter, list
src/useItems.ts       the data hook: fetch, add, remove, both error slots
openapi.yaml          the API contract — edit this first, then regenerate
orval.config.ts       codegen config: zod client, strict objects
shared/generated/     generated types + zod validators (committed, do not edit)
shared/contract.test.ts  the response validators, exercised directly
scripts/bundle-budget.mjs  the gzipped-size tripwire
server/app.ts         Hono routes — importable, never listens
server/index.ts       static serving and listen; runs only when executed
server/store.ts       SQLite via node:sqlite: createStore(file) → list/add/remove/close
```

## API

Three endpoints — `GET /api/items`, `POST /api/items`, `DELETE /api/items/{id}` — described in
`openapi.yaml`, which is authoritative. Deliberately not repeated here: a second description of
the API is the drift this project spent a rung removing.

## Notes

`TODO.md` is the learning ladder and the reasoning behind it; `notes.md` records what the load test
does and does not measure.
