import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync } from "node:fs";
import type { ServerType } from "@hono/node-server";
import { app } from "./app.ts";

let staticMounted = false;

/**
 * Starts the HTTP server. `root` is the directory of built client assets; when it
 * doesn't exist the server is API-only, which is what dev mode wants.
 */
export function createServer(
  port = Number(process.env.PORT ?? 3000),
  root = "./dist",
): ServerType {
  if (!staticMounted && existsSync(root)) {
    app.use("/*", serveStatic({ root }));
    staticMounted = true;
  }
  return serve({ fetch: app.fetch, port }, (info) => {
    console.log(`listening on http://localhost:${info.port}`);
  });
}

if (import.meta.main) createServer();
