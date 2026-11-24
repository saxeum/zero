import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import type { ServerType } from "@hono/node-server";
import { createServer } from "./index.ts";
import { reset } from "./store.ts";

const root = mkdtempSync(join(tmpdir(), "zero-dist-"));
writeFileSync(join(root, "index.html"), '<!doctype html><div id="root"></div>');

let server: ServerType;
let base: string;

before(async () => {
  reset();
  server = createServer(0, root);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  base = `http://127.0.0.1:${address.port}`;
});

after(() => {
  server.close();
  rmSync(root, { recursive: true, force: true });
});

test("one process serves the built client and the API", async () => {
  const index = await fetch(`${base}/`);

  assert.equal(index.status, 200);
  assert.match(await index.text(), /id="root"/);

  const api = await fetch(`${base}/api/items`);

  assert.equal(api.status, 200);
  assert.equal(((await api.json()) as unknown[]).length, 2);
});

test("unknown paths are not served from outside the static root", async () => {
  assert.equal((await fetch(`${base}/does-not-exist`)).status, 404);
  assert.equal((await fetch(`${base}/../package.json`)).status, 404);
});
