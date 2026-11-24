import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync } from "node:fs";
import { app } from "./app.js";

// Production only: the built client. In dev, Vite serves it and proxies /api here.
if (existsSync("./dist")) app.use("/*", serveStatic({ root: "./dist" }));

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`listening on http://localhost:${info.port}`);
});
