#!/usr/bin/env node
// Smoke-tests a deployed Worker. Deliberately dependency-free: it is the only check
// that ever sees production, so it should not be the fragile one.
//
//   npm run smoke -- https://zero.foonix.net
//
// Since the API requires a session, this cannot exercise the write path — that is
// covered by the vitest suite against a real local D1. What it can prove from outside
// is that the page boots, the assets carry their headers, and the API refuses
// anonymous callers.
const base = process.argv[2]?.replace(/\/$/, "");

if (!base) {
  console.error("usage: npm run smoke -- <base-url>");
  process.exit(2);
}

const results = [];

const request = (path, init = {}) =>
  fetch(base + path, { ...init, signal: AbortSignal.timeout(10_000) });

async function check(name, fn) {
  try {
    results.push({ name, ok: true, detail: await fn() });
  } catch (err) {
    results.push({ name, ok: false, detail: err instanceof Error ? err.message : String(err) });
  }
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

console.log(`smoke: ${base}\n`);

await check("GET /", async () => {
  const res = await request("/");
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  assert(type.includes("text/html"), `expected text/html, got "${type}"`);
  const html = await res.text();
  assert(html.includes('id="root"'), "no #root in the page — wrong asset or a broken build");
  return `200 ${type}`;
});

await check("GET / has a CSP and nosniff", async () => {
  // From public/_headers via the assets binding: the Worker never handles this request,
  // so a header check at the edge is the only way to see it.
  const res = await request("/");
  const csp = res.headers.get("content-security-policy") ?? "";
  assert(csp.includes("default-src 'self'"), `no usable CSP on the page: "${csp}"`);
  assert(
    csp.includes("frame-ancestors 'none'"),
    "CSP does not forbid framing — clickjacking is open",
  );
  assert(res.headers.get("x-content-type-options") === "nosniff", "no nosniff on the page");
  return "CSP + nosniff";
});

await check("GET /api/items without a session is 401", async () => {
  const res = await request("/api/items");
  assert(res.status === 401, `expected 401, got ${res.status}`);
  return "401";
});

await check("GET /api/session without a session is 401", async () => {
  const res = await request("/api/session");
  assert(res.status === 401, `expected 401, got ${res.status}`);
  return "401";
});

await check("POST /api/items without a session is 401", async () => {
  const res = await request("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "smoke should not create this" }),
  });
  assert(res.status === 401, `expected 401, got ${res.status}`);
  return "401";
});

await check("DELETE /api/items/:id without a session is 401", async () => {
  const res = await request("/api/items/anything", { method: "DELETE" });
  assert(res.status === 401, `expected 401, got ${res.status}`);
  return "401";
});

await check("a forged session cookie is 401", async () => {
  const res = await request("/api/items", {
    headers: { Cookie: "zero_session=b64.payload.forged-signature" },
  });
  assert(res.status === 401, `expected 401, got ${res.status}`);
  return "401";
});

await check("GET /nope", async () => {
  const res = await request("/nope");
  assert(res.status === 404, `expected 404, got ${res.status}`);
  return "404";
});

for (const { name, ok, detail } of results) {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name} — ${detail}`);
}

const failures = results.filter((result) => !result.ok);
console.log(
  `\n${failures.length === 0 ? "smoke passed" : `smoke FAILED: ${failures.length} of ${results.length}`}`,
);
process.exit(failures.length === 0 ? 0 : 1);
