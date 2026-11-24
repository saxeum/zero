/// <reference types="@cloudflare/vitest-plugin/types" />
import type { D1Migration } from "@cloudflare/vitest-plugin";
import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach } from "vitest";

// The migrations are injected as a binding by vitest.config.ts, so they are not part of
// the deployed Env. One cast at this boundary, rather than declaring them globally.
type TestEnv = Env & { TEST_MIGRATIONS: D1Migration[] };
const testEnv = () => env as unknown as TestEnv;

// readD1Migrations gives one entry per FILE, comments included — not one per statement.
const seedSql = () => {
  const seed = testEnv().TEST_MIGRATIONS.find((migration) => migration.name.includes("seed"));
  if (!seed) throw new Error("no seed migration found — did migrations/0002_seed.sql move?");
  return seed.queries.join("\n").replace(/;\s*$/, "");
};

// The schema and the seed rows come from migrations/ — the same files the deployed
// database is built from. Nothing about the test database is written twice.
beforeAll(async () => {
  await applyD1Migrations(testEnv().DB, testEnv().TEST_MIGRATIONS);
});

// This plugin version has no per-test storage isolation, so reset explicitly: delete
// everything, then re-run the seed migration's own SQL. prepare() copes with the
// leading comments; exec() would split the text on newlines and fail.
beforeEach(async () => {
  await testEnv().DB.prepare("DELETE FROM items").run();
  await testEnv().DB.prepare(seedSql()).run();
});
