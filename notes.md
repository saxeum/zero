# Benchmarks

## API load test

Start the server first (`npm run api`), then:

```sh
npm run load
```

which is:

```sh
autocannon -c 100 -d 10 http://127.0.0.1:8787/api/items
```

It targets `/api/items`, not `/` — the API is the thing that changes; `/` is a
static file and mostly measures the page cache.

## Recording a number

A number without its conditions is a rumour. Write the whole line:

```
<meta> | <req/s avg> | <p99 latency> | branch <sha> | which runtime (wrangler dev or the
old Node server), warm (3rd run), <machine/cpu count>
```

The numbers below were taken against the **Node server that no longer exists** (`@hono/node-server`,
`node:sqlite`, `dist/` served from :3000). They are kept as history, not as a baseline: the app now
runs in workerd, where `wrangler dev` numbers are dominated by miniflare overhead and say nothing
about production. Nobody has measured the deployed Worker, and load-testing a public URL on purpose
needs a conversation first.

Historical, Node server, `npm run load` (100 connections, 10s), second run, warm:

| when | req/s (avg) | p50 | p99 |
|---|---|---|---|
| in-memory array, no request validation | ~80,000 | 1 ms | 3 ms |
| + zod validation of POST bodies | (not measured separately) | | |
| + SQLite: `SELECT` per request via `node:sqlite` | **~50,300** | 1 ms | 4 ms |

The SQLite row is the first one that means anything: a real query inside the request path costs
about 30,000 req/s, taking latency from 1 ms to 1.3 ms average. That is the shape of the trade —
the earlier numbers were measuring the socket loop.

## What this can and cannot tell you

This API is a `JSON.stringify` over an in-memory array: no database, no disk, no
network. So the measurement is mostly "how fast can Node serialise 2 objects and
write a socket", and it will stay in the same ballpark no matter how the code is
organised. It cannot tell you about:

- anything behind I/O (a database, a file, an upstream call)
- the client — 100 concurrent API readers say nothing about React
- memory: autocannon reports throughput, not leaks

What it *can* catch: a gross regression. If a route starts reading a file per
request, or doing synchronous work per request, or the connection count collapses,
this is the cheap instrument that notices. Re-run it after a change that adds work
to the request path and compare.
