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
`server/` is `.ts`, run directly by Node (type stripping, no build, no `tsx`), and the generated
schemas in `shared/generated/` are imported directly by both sides. `POST` now rejects unknown and wrong-typed fields with 400
instead of silently dropping them, and there are tests for both.

Two things learned on the way: `node --check` cannot parse `.ts` (it doesn't strip types), so `tsc`
is the only syntax gate for the server; and `tsc` needs a *second* project for the server, because
the client's config has `lib: DOM` and no node types, and vice versa.

### 2. ~~Persistence~~ — done twice over
First `node:sqlite`, then replaced by D1 in Rung 9 when the runtime moved. The lessons kept: the
store is a *dependency*, isolation comes from construction, and the schema is applied once by a
migration rather than guarded by an "is it empty?" check.
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
- **[decision, not a task]** Every commit is authored `pi <pi@local>` and links to no GitHub
  account. Force-push on `main` is blocked, so rewriting the history now means deleting and
  recreating the repository. Two options: accept it forever, or recreate now while the repo is a
  day old.

## Rung 8 — Spec first

`openapi.yaml` is the contract; `npm run codegen` (orval) generates the types *and* the zod
validators; both sides import the output. `npm run verify` runs codegen and fails on any diff, so
the spec and the code cannot drift — which is the same problem the hand-written `Item` type and
its hand-written validator had, solved one level up.

- [x] Types and validators generated from the spec, not written twice
- [x] `check:codegen` in `verify`: regenerate, then `git diff --exit-code`
- [x] Strict objects enforced via `override.zod.strict`, because the generator drops
      `additionalProperties: false` silently — without it, unknown keys are *stripped* and the
      400 test passes for the wrong reason
- [x] Full `zod` on the client (+18 kB gzip), chosen deliberately over hand-writing a second
      schema. Note `orval` can emit `variant: "mini"` — one config word — if the bundle matters
      more than the API surface later
- [x] `npm run budget`: gzipped `dist/assets/*.js|css` against a 95 kB tripwire, in `verify`.
      That is how the `zod/mini` → `zod` regression (46 → 91.8 kB gzip) got in unnoticed — it is
      now a build failure, and raising the budget is a visible diff

## Rung 9 — Workers + D1 (done)

Live at **https://zero.foonix.net**. Public, deliberately: no accounts, anyone can add and delete.

Decisions taken up front: Workers only (no Node runtime kept alongside), tests inside workerd
against a real local D1, open access, custom domain, manual deploys, seeds from the migration.

### What actually changed

- **`node:sqlite` → D1.** D1 is async, so `Store` went async and every call site in `app.ts`
  awaits. D1 also returns *plain* objects here, unlike `node:sqlite`'s null-prototype rows.
- **The binding replaced the import.** `createStore(c.env.DB)` is built per request; a store is a
  thin wrapper over a binding, so there is nothing to cache.
- **The server process disappeared.** `server/worker.ts` is `export default app` — no `serve()`,
  no port, no `serveStatic`. Static files come from the `assets` binding in `wrangler.jsonc`.
- **`wrangler types` generates `worker-configuration.d.ts`** from `wrangler.jsonc`, so `Env`
  carries `DB` and `ASSETS` without a second declaration.
- **Tests moved into workerd.** `node --test` → `vitest` with `@cloudflare/vitest-plugin` (the
  successor to the deprecated `@cloudflare/vitest-pool-workers`). 21 tests, and `test-setup.ts`
  applies the migrations — the test database is built from the same SQL as production.

### Three things it cost, worth remembering

- **No per-test storage isolation in this plugin**, so `beforeEach` deletes every row and re-runs
  the seed migration's own SQL. The reset is explicit rather than automatic, but there is still no
  second copy of the seed data.
- **`env.DB.exec()` splits its input on newlines** and silently ignores fragments it cannot parse:
  a multi-line `INSERT` did nothing and reported nothing. `prepare().run()` is the honest tool, and
  the seed file keeps one statement per line.
- **`readD1Migrations` gives one entry per file**, comments included — not one per statement. A
  filter for entries starting with `--` threw away the entire seed.

Gone: `@hono/node-server`, `node:sqlite`, `data/items.db`, the spawned-entry-point test and the
static-serving tests (assets are the binding's job, verified against the live URL instead).

### Still to do after the deploy

- [x] **Deploy on merge.** `.github/workflows/deploy.yml` runs `verify` → `npm run migrate` →
      `npm run deploy` on every push to `main`, with a concurrency group so two merges cannot race
      into production, and a credential check that fails by name rather than with a wrangler auth
      error. Needs `CLOUDFLARE_API_TOKEN` (secret) and `CLOUDFLARE_ACCOUNT_ID` (variable), both
      human-created.
- [ ] **Migrations run before the Worker, so they must stay additive.** Documented in the workflow
      and the README; a destructive change needs two deploys (expand, then contract). Nothing
      enforces that yet — a reviewer does, which is why it is written down.
- [ ] No gate looks at the deployed Worker. The live URL was verified by hand — assets, D1, POST,
      DELETE, a browser round trip — and a smoke test against `zero.foonix.net` after deploy would
      catch a bad binding or a missing migration.
- [x] **Generated output is not committed.** `shared/generated/` and `worker-configuration.d.ts`
      are gitignored, and `prepare` rebuilds them on `npm ci` (verified: a clean `npm ci` in a
      throwaway package does run `prepare`). `npm run check` starts with `npm run gen`, so a
      missing file is regenerated rather than reported as a type error.
      The consequence: `check:codegen` is gone, because with no committed copy there is nothing to
      drift from — the spec is compiled on every install. `knip` needs `ignoreDependencies: ["zod"]`
      as a result: zod is only imported by generated code that knip cannot see.

## Review

A full read of the code with grades and evidence is in `docs/code-review.md` (reviewed object
`2532dd2`). The five things it recommends are tracked, not repeated here:

| | |
|---|---|
| #15 | cap item size — 1 MB items were accepted against production |
| #16 | security headers and a CSP |
| #17 | eslint with `react-hooks`, since no gate enforces hook rules |
| #18 | paginate `GET /api/items` |
| #19 | deploy from GitHub Actions with a scoped Cloudflare token |

## Gates

```sh
npm run verify
```

`npm run check` (tsc ×2) → `npm run check:codegen` → `npm run build` → `npm run budget` →
`npm test` (21, in workerd) → `npm run knip`. Stops at the first failure, ~5s warm.

CI runs `npm ci --dry-run`, then **`npm run verify` as a single step** — not the individual
commands. That is deliberate: when CI listed its own copy of the steps, it kept passing while
`verify` grew a `check:codegen`, so spec drift was invisible to the required check. One command in
both places makes that impossible. Plus `test -f dist/index.html`, which is about the artefact
rather than the code.

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
wrangler.jsonc          Worker config: assets binding, D1 binding, custom domain
migrations/             schema (0001) and seed rows (0002), applied by wrangler
worker-configuration.d.ts  generated by `npm run types` from wrangler.jsonc — committed
openapi.yaml            the API contract — source of truth
orval.config.ts         codegen config (zod client, strict objects)
shared/generated/       generated types + zod validators, committed, imported directly
shared/contract.test.ts the response validators, exercised directly
index.html              Vite entry, loads /src/main.tsx
src/main.tsx            createRoot + <StrictMode>
src/App.tsx             layout: form, filter, list
src/useItems.ts         the data hook: fetch, add, remove, both error slots
src/styles.css          plain CSS, no framework
server/worker.ts        the Worker entry point: `export default app`
server/app.ts           Hono routes; builds a store from `c.env.DB` per request
server/store.ts         D1 queries behind an async Store interface
server/*.test.ts        API and store tests, running inside workerd
test-setup.ts           applies migrations, resets rows between tests
vitest.config.ts        @cloudflare/vitest-plugin: tests run in workerd with a local D1
tsconfig.json           client: DOM libs
tsconfig.worker.json    worker: no DOM, worker-configuration.d.ts
scripts/bundle-budget.mjs  the gzipped-size tripwire
.github/workflows/ci.yml   the gate
```

`npm run dev` (:5173, HMR, proxies `/api`) beside `npm run api` (`wrangler dev`, :8787) for
development; `npm start` builds then runs the Worker locally; `npm run deploy` ships it.

## Reference

- Load test and what it does/doesn't measure: `notes.md` — it now targets a local `wrangler dev`
  on :8787, because the numbers in there were taken against the Node server and no longer describe
  this code.
- Codegen tooling, as of this writing: **orval 8 works**; `openapi-typescript` works (types only);
  `@hey-api/openapi-ts` 0.99 **crashes on TypeScript 7** (`ts.SyntaxKind` undefined). Re-check on
  every upgrade — the fashionable option is not the working one.
- Client bundle, gzipped: 89.1 kB (React 19 + full zod + app). Budget: 95 kB.
- `wrangler dev` serves `dist/` through the assets binding, so it needs `npm run build` first —
  `npm start` does both. A stale `dist/` is served happily, which is worth remembering when a
  change "doesn't appear".
- Development builds warn and double-invoke; production builds do neither. That is why `:5173`
  shows two `/api/items` requests and the deployed site shows one.
- The hand-rolled `node:http` server is in history: 87 lines versus 31 for the Hono version.
