# Benchmarks

## API load test

Start the server first (`npm run api`), then:

```sh
npm run load
```

which is:

```sh
autocannon -c 100 -d 10 http://localhost:3000/api/items
```

It targets `/api/items`, not `/` — the API is the thing that changes; `/` is a
static file and mostly measures the page cache.

## Recording a number

A number without its conditions is a rumour. Write the whole line:

```
<meta> | <req/s avg> | <p99 latency> | branch <sha> | dev build, dist served from :3000,
warm (3rd run), <machine/cpu count>
```

Baseline on this machine, `main` @ 5cf699b, 4-second run: **~76,600 req/s**,
p50 1 ms, p99 3 ms, max 74 ms.

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
