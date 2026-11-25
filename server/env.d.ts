// Secrets are not in wrangler.jsonc, so `wrangler types` cannot know about them.
// Augmenting here keeps the knowledge in the worker project only — the client
// tsconfig does not include server/.
declare global {
  interface Env {
    SESSION_SECRET: string;
    GOOGLE_CLIENT_ID: string;
  }
}

export {};
