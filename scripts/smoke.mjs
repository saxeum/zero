#!/usr/bin/env node
// Smoke-tests a deployed Worker. Deliberately dependency-free: it is the only check
// that ever sees production, so it should not be the fragile one.
//
//   npm run smoke -- https://zero.foonix.net
//
// It creates one item and deletes it again, so it is safe to run on every deploy.
const base = process.argv[2]?.replace(/\/$/, "");

if (!base) {
  console.error("usage: npm run smoke -- <base-url>");
  process.exit(2);
}

const results = [];
const text = `smoke ${new Date().toISOString()}`;

const request = (path, init = {}) =>
  fetch(base + path, { ...init, signal: AbortSignal.timeout(10_000) });

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
  } catch (err) {
    results.push({ name, ok: false, detail: err instanceof Error ? err.message : String(err) });
  }
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

let createdId = null;

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
  // These come from public/_headers via the assets binding, which curl-level checks are
  // the only way to see: the Worker never handles this request.
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

await check("GET /api/items", async () => {
  const res = await request("/api/items");
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const items = await res.json();
  assert(Array.isArray(items), "expected an array");
  for (const item of items) {
    assert(
      typeof item?.id === "string" && typeof item?.text === "string",
      `item is off-shape: ${JSON.stringify(item)}`,
    );
  }
  return `200, ${items.length} items`;
});

await check("POST /api/items", async () => {
  const res = await request("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  assert(res.status === 201, `expected 201, got ${res.status}`);
  const item = await res.json();
  assert(item.text === text, `created item has text "${item.text}"`);
  assert(typeof item.id === "string" && item.id.length > 0, "no id on the created item");
  createdId = item.id;
  return `201, id=${item.id.slice(0, 8)}…`;
});

await check("GET /api/items shows the new item", async () => {
  assert(createdId !== null, "nothing was created");
  const items = await (await request("/api/items")).json();
  assert(
    items.some((item) => item.id === createdId),
    "the item is missing from the list",
  );
  return "present";
});

await check("POST /api/items rejects an unknown field", async () => {
  const res = await request("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "x", id: "chosen-by-client" }),
  });
  assert(res.status === 400, `expected 400, got ${res.status}`);
  return "400";
});

await check("DELETE /api/items/:id", async () => {
  assert(createdId !== null, "nothing to delete");
  const res = await request(`/api/items/${createdId}`, { method: "DELETE" });
  assert(res.status === 204, `expected 204, got ${res.status}`);
  return "204";
});

await check("DELETE is not idempotent in status", async () => {
  assert(createdId !== null, "nothing to delete");
  const res = await request(`/api/items/${createdId}`, { method: "DELETE" });
  assert(res.status === 404, `expected 404 on the second delete, got ${res.status}`);
  return "404";
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

if (createdId !== null) {
  // Best effort: a leaked row is noise, not a reason to hide the real failure.
  const res = await request(`/api/items/${createdId}`, { method: "DELETE" }).catch(() => null);
  if (res && res.status !== 204 && res.status !== 404) {
    console.error(`warning: could not clean up ${createdId} (${res.status})`);
  }
}

console.log(
  `\n${failures.length === 0 ? "smoke passed" : `smoke FAILED: ${failures.length} of ${results.length}`}`,
);
process.exit(failures.length === 0 ? 0 : 1);
