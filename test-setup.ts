/// <reference types="@cloudflare/vitest-plugin/types" />
import type { D1Migration } from "@cloudflare/vitest-plugin";
import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach } from "vitest";

// The migrations are injected as a binding by vitest.config.ts, so they are not part of
// the deployed Env. One cast at this boundary, rather than declaring them globally.
type TestEnv = Env & { TEST_MIGRATIONS: D1Migration[] };
const testEnv = () => env as unknown as TestEnv;

// The schema and the deployed database are built from the same migration files.
beforeAll(async () => {
  await applyD1Migrations(testEnv().DB, testEnv().TEST_MIGRATIONS);
});

// This plugin version has no per-test storage isolation, so reset explicitly. Items are
// emptied rather than reseeded: the seed rows have no owner, and every query filters on
// one, so they are invisible to every user by design.
beforeEach(async () => {
  await testEnv().DB.prepare("DELETE FROM items").run();
});
