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
- [ ] Compare against the hand-written file — the transform is visible in reverse

## Skip until absence hurts

`useReducer`, context, `useMemo` / `useCallback`, refs beyond debugging, portals, error
boundaries, Suspense. Each solves a problem not yet present.

## Habit

Before touching code, answer two questions:

1. What caused this render? (Profiler commit, or the stack)
2. What does this component return for this state? (Components panel)

Nearly every React bug is one of those two answered wrongly.

## Reference

- Load-test one-liner in `notes.md` (autocannon).
- `server.js` is a static file server and knows nothing about React; it reads from disk per
  request and sets no cache headers.
- Development builds warn and double-invoke; production builds do neither. Swap the two CDN
  URLs to see the difference.
