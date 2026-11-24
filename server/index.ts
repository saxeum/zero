import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync } from "node:fs";
import type { ServerType } from "@hono/node-server";
import { createApp } from "./app.ts";
import { createStore } from "./store.ts";

export type Options = {
  port?: number;
  root?: string;
  dbPath?: string;
};

/**
 * Starts the HTTP server. `root` is the built client; when it doesn't exist the
 * server is API-only, which is what dev mode wants. `dbPath` is ":memory:" in tests.
 */
export function createServer({
  port = Number(process.env.PORT ?? 3000),
  root = "./dist",
  dbPath = process.env.ZERO_DB ?? "./data/items.db",
}: Options = {}): ServerType {
  const app = createApp(createStore(dbPath));

  if (existsSync(root)) app.use("/*", serveStatic({ root }));

  return serve({ fetch: app.fetch, port }, (info) => {
    console.log(`listening on http://localhost:${info.port}`);
  });
}

if (import.meta.main) createServer();
