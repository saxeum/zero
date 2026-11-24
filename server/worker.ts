import { app } from "./app.ts";

// Workers takes the fetch handler directly: no serve(), no port, no static route.
// `dist/` is served by the assets binding in wrangler.jsonc before the worker runs.
export default app;
