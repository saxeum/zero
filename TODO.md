# React from scratch — the ladder

Started as three files with `React.createElement` and a hand-rolled `node:http` server, with the
rule "add tooling only when its absence hurts". That rule has now been spent: the app is Vite +
TypeScript + zod + a Hono API. The history is the record of *why* each one was taken.

What is left to do is at the bottom, under **Next**.

## Done

### Elements, state, props
- [x] A component is a function returning an element *description*; `render` turns it into DOM
- [x] `StrictMode` double-invokes component bodies in development only — two calls, one commit
- [x] Props are the first argument; a `null` config becomes `{}`; props are frozen in development
- [x] `useState`: the value is a snapshot per render, the setter schedules a render, `count++`
      does nothing, and two `setCount` calls in one handler collapse unless you pass an updater
- [x] A component returning `undefined` renders *nothing*, silently; an undeclared identifier
      throws. Silence and error are different failures, and both look like "blank page"

### Data down, events up
- [x] State lives in the closest common ancestor; a child is handed a function, never a setter
- [x] Callback props: `onAdd: () => setCount(p => p + 1)`, and the child calls `props.onAdd()`
- [x] A failed action keeps the user's draft text, because clearing lives on the success branch

### Lists, keys, immutable updates
- [x] Arrays in state: `[...prev, x]` and `filter`. `push` returns the same array, so `objectIs`
      bails out and nothing re-renders — mutation fails twice over
- [x] Identity through `{ id, text }`, `key: item.id`, and `crypto.randomUUID()` created once per
      item inside the setter, never in render
- [x] Controlled input: `value` from state, `onChange` writes back; without `value` the box ignores
      `setDraft("")`, which is what proves it's uncontrolled
- [ ] *Not exercised by hand:* breaking `key` with the array index. Know the theory (state follows
      position), never watched it happen. `TODO` keeps it honest rather than ticked

### Effects
- [x] `[]` = mount only, `[x]` = when `x` changes by identity, omitted = every render
- [x] Cleanup via `AbortController`; the discarded StrictMode mount shows up as a cancelled request
- [x] `finally` runs even on `return`, so it cannot be used to skip a stale path
- [x] Effects synchronise React with the outside world — they must never reconcile React state

### JSX, build, types
- [x] JSX is a transform: `e("div", null, x)` and `<div>{x}</div>` are the same call, and the
      compiled output of the old file is in git history (`98293d6`, `22a79c0`)
- [x] Vite replaced in-browser Babel; React moved from a CDN URL into `package.json`
- [x] TypeScript: `tsc --noEmit` as a gate; two `catch` blocks taught `unknown` → `instanceof Error`

### State design
- [x] Load failure guards the app; action failure is a banner with the list still live
- [x] Every action clears the previous error first, so the banner can't describe a stale failure
- [x] The filter is derived during render. `query` is state; what the list *shows* is not
- [x] `useItems()` extracted: a hook is a function that calls hooks. It groups, it does not share —
      two components calling it get two independent lists

### The boundary
- [x] `zod/mini` schema with `z.infer`, so type and validator cannot drift (`zod` full was +23 kB
      gzip, `zod/mini` +4.8 kB — measured, not guessed)
- [x] Bad payloads throw into the existing error path. Demonstrated by making the server return
      `{ id: 1 }`: the page renders `Failed to load: …` instead of corrupting state

### Tests and gates
- [x] 16 tests: API contract via `app.request()`, client guards, static mount, spawned entry point
- [x] Proven they can fail: `201`→`200`, loosened guard, `if (false)` static mount, `DECOY` export
- [x] `npm run coverage` (Node's built-in reporter), `npm run knip`, `npm run load`
- [x] CI on `saxeum/zero` with build, test, dead code, and lockfile check; green on every PR

## Next

### 1. ~~Server in TypeScript, sharing the schema, validating input~~ — done
`server/` is `.ts`, run directly by Node (type stripping, no build, no `tsx`), and `shared/item.ts`
holds the schemas both sides import. `POST` now rejects unknown and wrong-typed fields with 400
instead of silently dropping them, and there are tests for both.

Two things learned on the way: `node --check` cannot parse `.ts` (it doesn't strip types), so `tsc`
is the only syntax gate for the server; and `tsc` needs a *second* project for the server, because
the client's config has `lib: DOM` and no node types, and vice versa.

### 2. ~~Persistence — `node:sqlite`, no ORM~~ — done
`data/items.db`, one table, `DatabaseSync`, no dependency. `store.reset()` is gone: the store is
now a *dependency* (`createStore(file)` → `createApp(store)`), so each test builds its own
`:memory:` database in `beforeEach` and isolation comes from construction, not from a reset call.

Two details worth keeping:

- **Seed only when the table is created**, not when it is empty: asking "is it empty?" resurrects
  the seed rows the first time someone deletes every item and restarts.
- **`ORDER BY rowid`** — a `SELECT` without it has no order guarantee, and the tests assert one.

### 3. ~~Re-run the load test~~ — done, and it finally said something
In-memory: ~80,000 req/s. With SQLite doing a `SELECT` per request: **~50,300 req/s**, p50 1 ms,
p99 4 ms. A real query in the request path costs ~30,000 req/s; the earlier numbers were measuring
the socket loop. Numbers and conditions are in `notes.md`.

### 4. Housekeeping
- Five local branches are merged into `main` and can be pruned (`git branch -d`).
- `pi <pi@local>` is the author of every commit and links to no GitHub account. Fixing it means
  rewriting all SHAs, and force-push is blocked on `main` — so it now means recreating the repo.
  Decide once: accept it, or recreate early.
- This file and `README.md` are the two documents that go stale first. Correct them in the same PR
  as the change that falsifies them.

## Gates

```sh
npm run verify
```

`npm run check` (tsc + `node --check`) → `npm run build` → `npm test` (16) → `npm run knip`. Stops
at the first failure, ~2s warm. CI runs the same list plus `npm ci --dry-run`, on every push to
`main` and every PR, as the required check `test`.

Coverage: `npm run coverage`. Note it only sees modules the test process loaded — `index.ts` was
invisible until it became importable, and the spawned entry-point test contributes 0% because it
is a separate process.

Branch protection matches `saxeum/zuchat`: required check `test`, `enforce_admins`, no force push,
no deletion, plus a ruleset for deletion/non-fast-forward. **It does not block a direct push** —
that was tested and it went through. Only a `pull_request` ruleset rule does that; zuchat doesn't
have one either, so "no agent merges" is convention for both repos.

## Habit

Before touching code, answer two questions:

1. What caused this render? (Profiler commit, or the stack)
2. What does this component return for this state? (Components panel)

Every React bug in this repo so far was one of those two answered wrongly.

## Structure

```
index.html              Vite entry, loads /src/main.tsx
src/main.tsx            createRoot + <StrictMode>
src/App.tsx             layout: form, filter, list — 68 lines
src/useItems.ts         the data hook: fetch, add, remove, both error slots
shared/item.ts          zod schemas, runtime checks at both boundaries
src/styles.css          plain CSS, no framework
server/app.ts           Hono routes — importable, never listens
server/index.ts         static + listen; runs only when executed (`import.meta.main`)
server/store.ts         the in-memory list
server/*.test.ts        API contract, static mount, spawned entry point
tsconfig.server.json    separate tsc project: node types, no DOM
.github/workflows/ci.yml  the gate
```

`npm run dev` (:5173, HMR, proxies `/api`) beside `npm run api` (:3000) for development;
`npm start` builds and serves both from :3000. `npm run` with no arguments lists everything.

## Reference

- Load test and what it does/doesn't measure: `notes.md`.
- `server/index.ts` serves `dist/` only if it exists **at boot** — build before starting, or use
  `npm start`, which does both.
- Development builds warn and double-invoke; production builds do neither. That is why `:5173`
  shows two `/api/items` requests and `:3000` shows one.
- The hand-rolled `node:http` server is in history: 87 lines versus 31 for the Hono version.
