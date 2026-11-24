# React from scratch — learning ladder

Constraint: no build step, no JSX, no npm dependencies. `createElement` + CDN UMD builds.
Only add tooling when a rung makes its absence hurt.

## Done

- [x] Elements, `createRoot(...).render()` — component is a function returning an element tree
- [x] `StrictMode` — dev-only double invocation of component bodies; two calls, one commit
- [x] Props — first argument; `null` config becomes `{}`; frozen in dev
- [x] `useState` — snapshot semantics, setter schedules a render, `count++` does not work
- [x] Debugging — Scope panel, conditional breakpoints, DevTools Components/Profiler/Elements pane
- [x] Component returning `undefined` renders *nothing* silently (missing `return`); undeclared
      identifier throws instead — silence and error are different failures

## Rung 1 — Data down, events up

State lives in the closest common ancestor of the components that need it. A child cannot
change the parent's state; it is handed a function.

Exercise: one parent owning a count, two children. Left child displays it. Right child renders a
button and calls the function it was given. Parent owns `useState`; neither child does.

- [ ] Parent owns the state, children are stateless
- [ ] Pass a wrapper callback (`() => setCount(c => c + 1)`), not the raw setter
- [ ] Can explain what breaks if a child owned the count instead

## Rung 2 — Lists, keys, immutable updates

Arrays in state; why `items.push(x)` shows nothing; keys.

Exercise: todo list. Array in state. Add via `[...prev, item]`, remove via `filter`. Text input
controlled by state: `value` from state, `onChange` writes back.

- [ ] Immutable add/remove only — no mutation
- [ ] Deliberately break it with the array index as `key` (reorder / delete from the middle),
      then fix it with a stable id. If it cannot be broken, keys are not understood yet
- [ ] `onClick={() => remove(item.id)}` vs `onClick={remove(item.id)}` — know why the second
      runs during render
- [ ] Controlled input: the DOM shows state, it does not hold it

## Rung 3 — Effects, then fetch

Render stays pure; side effects go in `useEffect`, with a dependency array and a cleanup.

Exercise, part one: `document.title` synced to the count. No async, no cleanup.

Exercise, part two (the real client/server step): add `GET /api/items` to `server.js` — it is a
route table, ~10 lines — and load the list with `fetch` in an effect, with loading and error
states.

- [ ] `[]` = mount only, `[id]` = re-run when id changes — and why each is what you wanted
- [ ] Effect cleanup: abort or ignore the stale response
- [ ] StrictMode fires the effect twice on mount; the answer is a cleanup, not deleting
      StrictMode. Explain why the double-fire is a warning, not a bug to suppress
- [ ] Client and server are now genuinely two programs with a contract (JSON shape)

## Rung 4 — JSX and a build step (last, on purpose)

Ergonomics only. `e("div", { onClick: f }, "hi")` and `<div onClick={f}>hi</div>` are the same
call.

- [ ] Only worth it once the `e(...)` nesting actually hurts
- [ ] Note what it costs: a dependency tree, a dev server, a build step
- [ ] Compare against the hand-written version in git history — the transform is visible in
      reverse

## Rung 5 — State design, and where errors live

Two sources of truth is one bug; one error state for two kinds of failure is another.

- [x] Load failure guards the app; action failure is a banner with the list still live
- [x] Every action clears the previous error first, so the banner can't describe a stale failure
- [x] The filter is derived during render — `query` is state, the filtered list is not
- [x] No effect anywhere to keep two values in sync
- [x] A failed add keeps the draft text, so the work isn't lost
- [ ] Notice when this needs `useReducer` (several fields always changing together)

## Rung 6 — Custom hooks, then tests

- [x] `useItems()` returning `{ items, loading, loadError, actionError, add, remove }` — a hook is a
      function that calls hooks, nothing more. `add()` returns a boolean so the component decides
      whether to clear its own input; the hook never touches `draft`
- [x] `node:test` against the Hono app via `app.request("/api/items")` — no browser, no new deps
- [x] Cover the gates that already exist: 201, 400 on blank text, 400 on bad JSON, 204, 404 on a
      second delete — 8 tests, `npm test`; proved they fail by changing 201 to 200
- [x] `npm run coverage` — node's built-in reporter, 100% of `app.js` + `store.js`
- [x] `server/index.js` now covered in-process: `createServer(0, root)` on an ephemeral port, plus a
      spawned-process test for the `import.meta.main` entry point. Coverage does **not** cross that
      process boundary — the spawned child's lines are executed but invisible to the report
- [ ] Branch: "no `dist`" (API-only dev mode) is still untested; needs a *separate* process, since
      the static mount is a module-level flag
- [ ] `useReducer` when several `useState`s always change together; not yet

## Rung 7 — The boundary

The compiler believes `res.json()`. Types stop at the network edge; validation doesn't.

- [x] `parseItem` / `parseItems` check the shape at runtime and throw, so bad data lands in the
      existing error path instead of becoming state — shown by making the server return `{id: 1}`
- [x] Client-side guards are unit-tested with `node --test`; Node 26 strips types, so a `.ts` file
      runs with no build and no browser
- [ ] The server still validates nothing but `text` on POST — extra or wrong-typed fields are
      silently dropped by the handler, not rejected
- [ ] zod would replace ~20 hand-written lines. Hand-rolled first, so the trade is visible
- [ ] Re-run `npm run load` after a validation change: this is the first change that puts real
      work on the request path, so the benchmark finally has something to measure

## Skip until absence hurts

`useReducer`, context, `useMemo` / `useCallback`, refs beyond debugging, portals, error
boundaries, Suspense. Each solves a problem not yet present.

## Habit

Before touching code, answer two questions:

1. What caused this render? (Profiler commit, or the stack)
2. What does this component return for this state? (Components panel)

Nearly every React bug is one of those two answered wrongly.

## Structure

```
index.html          Vite entry, loads /src/main.tsx
src/main.tsx        createRoot + <StrictMode>
src/App.tsx         the component
server/index.js     Hono app: /api/items, plus dist/ in prod
server/store.js     the in-memory list (mutated on the server, which is correct there)
vite.config.ts      react plugin + /api proxy to :3000
```

`npm run dev` is the client on :5173, `npm run api` is the API on :3000, `npm start` builds
and serves both from :3000. `npm run` with no arguments lists the scripts.

## Reference

- Learn the loop, not the framework: `npm run` lists the scripts, `npm run check` before you
  trust a change, `npm start` to serve the real thing.
- Load-test one-liner in `notes.md` (autocannon).
- `server/index.js` serves `dist/` as the public root when it exists, and nothing else; in dev,
  Vite serves the client on :5173 and proxies `/api` to :3000.
- The hand-rolled `node:http` server is in git history (`main`, commit `98293d6`), 87 lines versus
  31 for the Hono version.
- Development builds warn and double-invoke; production builds do neither. Swap the two CDN
  URLs to see the difference.
