# zero

A todo list built from scratch, as a way of actually understanding React instead of learning its
tooling. No component library, no state manager, no ORM, no CSS framework.

The history is the point: it starts as three files with `React.createElement` and a 55-line
`node:http` server, and moves through Hono, JSX, Vite, TypeScript and real tests one decision at a
time. `TODO.md` is the ladder, including what was deliberately skipped and why.

## Stack

- Client: React 18 + TypeScript, built by Vite
- Server: Hono on `node:http` by way of `@hono/node-server`
- No database. An in-memory array in `server/store.js` — items vanish when the process restarts.

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
| `npm run check` | `tsc --noEmit` + `node --check` on the server files |
| `npm test` | `node --test` — API, client guards, entry point |
| `npm run coverage` | tests plus Node's built-in coverage report |
| `npm run knip` | dead code and unused exports |
| `npm run verify` | `check` + `test` + `knip`, the gate CI runs |
| `npm run load` | `autocannon` against `/api/items` |

## Layout

```
index.html            Vite entry
src/main.tsx          createRoot + StrictMode
src/App.tsx           layout: form, filter, list
src/useItems.ts       the data hook: fetch, add, remove, both error slots
src/item.ts           zod schema and the runtime check at the network boundary
server/app.js         Hono routes — importable, never listens
server/index.js       static serving and listen; runs only when executed
server/store.js       the in-memory list
```

## API

| | | |
|---|---|---|
| `GET /api/items` | 200 | the full list |
| `POST /api/items` | 201 / 400 | body `{ "text": "..." }`, blank or malformed rejected |
| `DELETE /api/items/:id` | 204 / 404 | 404 on a second delete |

## Notes

`TODO.md` is the learning ladder and the reasoning behind it; `notes.md` records what the load test
does and does not measure.
