# Code review — 2026-11-24

Reviewed object: `2532dd2` (merge of the Cloudflare Workers + D1 port), live at
https://zero.foonix.net. 424 lines of hand-written TS/TSX across `src/ server/ shared/ scripts/`,
4 runtime dependencies, 21 tests, six gates in `npm run verify`.

Grades are for a toy-scale app with one maintainer, which is what this is.

| | grade | one line |
|---|---|---|
| Design | A− | spec upstream of code; store as a dependency; errors typed by consequence |
| Tech stack | B+ | lean and modern, but bleeding edge in four places at once |
| Maintainability | B | real gates and honest comments; no linter, no client tests |
| Extensibility | B− | clean to add an endpoint, but single-tenant and unpaginated by construction |
| Security | C | nothing malicious; no limits, no auth, no headers |
| Speed | A− | 110–165 ms TTFB, 89.1 kB gzip, edge-cached assets |
| Load | C+ | every read is unbounded and uncached |

## Design — A−

Three decisions carry it.

**The spec is upstream of the code.** `openapi.yaml` → orval → types and zod validators → imported
directly by both sides. Nothing states a shape twice, and the generated output is not committed, so
it cannot drift. That is stronger than the drift gate it replaced.

**The store is a dependency, not a singleton.** `createStore(c.env.DB)` per request, behind a
`Store` interface. Cheap to build, honest about where the data lives.

**Errors are typed by consequence**, not by source: `loadError` guards the whole app because there
is nothing else to show; `actionError` renders a banner with the list still live; every action
clears it first, so a banner can never describe a superseded failure. `add()` returns `boolean` so
`App` — which owns the input — decides whether to clear it. The hook cannot reach the form.

Nit: `App.tsx` computes `needle`/`visible` before the `loading` guard, so the filter runs over an
empty array on every load. No bug, wrong order.

## Tech stack — B+

Hono, React 19, Vite 8, TypeScript 7, zod 4, orval, vitest running inside workerd, D1, wrangler.
Four runtime dependencies is genuinely lean.

The cost is **bleeding edge everywhere at once**. In one session:
`@hey-api/openapi-ts` does not run on TS 7; `@cloudflare/vitest-pool-workers` is deprecated in
favour of `@cloudflare/vitest-plugin`; that plugin has no per-test storage isolation. All three
were discovered at implementation time, not from documentation. Each is a churn liability for a
single maintainer.

## Maintainability — B

Strong: 424 lines; a comment wherever a decision is non-obvious (the `exec` newline trap, the
null-prototype rows, why seeding keys off table creation); `verify` running six gates that have
each been seen to fail; CI calling `verify` rather than its own copy of the steps; `README`,
`TODO.md` and `notes.md` all current.

Weak, concretely:

- **No linter.** No ESLint or Biome, so `react-hooks/rules-of-hooks` is unenforced. A `useState`
  inside an `if` passes `tsc`, `knip` and `vitest`, and breaks at runtime — on a repo whose purpose
  is learning hooks, that is the odd missing gate.
- **No client tests.** The 21 tests cover the API, the store and the validators. Nothing renders
  React; every UI claim so far came from a throwaway CDP script.
- **`TODO.md` is 280 lines** and much of it narrative. Good archaeology, poor orientation.

## Extensibility — B−

Adding an endpoint is three steps: edit the spec, `npm run gen`, write the route. Migrations exist
and are ordered. But the model is single-tenant and unpaginated by construction: no user, no
ownership column, no `LIMIT`, no server-side filter or sort, no staging environment, no `PATCH`, no
soft delete.

## Security — C

Positives: no secrets in the tree or the history; parameterised SQL throughout; zod-validated bodies
with `additionalProperties: false`; Actions pinned to commit SHAs with Dependabot watching; `npm
audit` clean; validation on both directions of the wire.

Negatives, in order of severity:

**1. No limit on item size — verified against production.**

```
POST 1MB -> 201
GET /api/items -> 1000302 bytes
```

`z.string()` is unbounded, so anyone can push the table toward D1's row and storage limits, and
every later `GET` ships those bytes to every client. One `maxLength` in the spec fixes the write and
the amplification together. (The row was deleted after the test.)

**2. No rate limiting, no auth, no ownership.** A deliberate decision, stated in the README: the
delete button is a public API for anyone.

**3. No security headers.**

```
content-type: text/html
cache-control: public, max-age=0, must-revalidate
```

No CSP, no `x-content-type-options`, no `referrer-policy`, no HSTS — on a page that renders
user-supplied text.

## Speed — A−

```
connect 0.023–0.043s   ttfb 0.110–0.165s   payload 246 bytes
```

Client 89.1 kB gzip (React 19 + full zod + app); assets edge-cached (`cf-cache-status: HIT`); API
correctly `no-store`; one fetch on mount; no router, no webfonts.

Docked a minus because the API response is unbounded and `no-store` means every tab pays a full D1
round trip.

## Load — C+

Measured against `wrangler dev`: ~720 req/s at 137 ms average. **That is dev-mode miniflare
overhead, not edge capacity** — it is not a claim about production, and production was not
load-tested (public URL, and by request).

Structurally limiting: `GET /api/items` is unbounded and uncached, so cost per request grows with
table size forever; single D1, single region, no read replicas; writes are single-row inserts and
fine.

## If you fix five things

1. `maxLength` on `NewItem.text`, with a test that a huge body is rejected.
2. `secureHeaders()` + a CSP in `server/app.ts`.
3. ESLint with `react-hooks` inside `verify`.
4. Pagination on `GET /api/items`, with the response capped.
5. A smoke test against the deployed URL, so a bad deploy is not discovered by a human clicking.

Tracked as issues #15–#19 (deploy pipeline: #19, smoke test: #18).
