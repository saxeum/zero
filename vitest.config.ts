import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  // The same migration files the deployed database is built from.
  const migrations = await readD1Migrations("./migrations");

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            // Test-only credentials: the suite never talks to Google, and these must
            // never match production.
            SESSION_SECRET: "test-session-secret",
            GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test-setup.ts"],
    },
  };
});
