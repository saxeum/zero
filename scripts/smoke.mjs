#!/usr/bin/env node
// Smoke-tests a deployed Worker. Deliberately dependency-free: it is the only check
// that ever sees production, so it should not be the fragile one.
//
//   npm run smoke -- https://zero.foonix.net
//
// Sign-in is a Google redirect, which cannot be automated here, so this proves the
// page boots with its headers and that the API refuses anonymous callers. The write
// path is covered by the vitest suite against a real local D1.
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
  // so checking at the edge is the only way to see it.
  const res = await request("/");
  const csp = res.headers.get("content-security-policy") ?? "";
  assert(csp.includes("default-src 'self'"), `no usable CSP on the page: "${csp}"`);
  assert(csp.includes("frame-ancestors 'none'"), "CSP does not forbid framing");
  assert(res.headers.get("x-content-type-options") === "nosniff", "no nosniff on the page");
  return "CSP + nosniff";
});

await check("GET /api/auth/get-session is 200 with no session", async () => {
  // Better Auth's own endpoint: signed out is an empty 200, not an error.
  const res = await request("/api/auth/get-session");
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const body = await res.text();
  assert(body === "null" || body === "", `expected an empty session, got "${body.slice(0, 40)}"`);
  return "200, empty";
});

await check("GET /api/items without a session is 401", async () => {
  const res = await request("/api/items");
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

await check("a cookie-authenticated POST without Origin is refused", async () => {
  // Better Auth's CSRF check. A forged cookie plus no Origin must not be accepted.
  const res = await request("/api/auth/sign-out", {
    method: "POST",
    headers: { Cookie: "better-auth.session_token=forged.token" },
  });
  assert(res.status === 403 || res.status === 401, `expected 403/401, got ${res.status}`);
  return String(res.status);
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
