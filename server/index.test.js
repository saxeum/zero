import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "./index.js";
import { reset } from "./store.js";

const root = mkdtempSync(join(tmpdir(), "zero-dist-"));
writeFileSync(join(root, "index.html"), '<!doctype html><div id="root"></div>');

let server;
let base;

before(async () => {
  reset();
  server = createServer(0, root);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
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
  assert.equal((await api.json()).length, 2);
});

test("unknown paths are not served from outside the static root", async () => {
  assert.equal((await fetch(`${base}/does-not-exist`)).status, 404);
  assert.equal((await fetch(`${base}/../package.json`)).status, 404);
});
