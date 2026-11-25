// Secrets are not in wrangler.jsonc, so `wrangler types` cannot know about them.
// Augmenting here keeps the knowledge in the worker project only — the client
// tsconfig does not include server/.
declare global {
  interface Env {
    /**
     * Set to "development" in .dev.vars only. Absent in production, which is what
     * disables password sign-in — the safe default, and the reason it is not a
     * wrangler.jsonc var (which would narrow the type to a literal).
     */
    ENVIRONMENT?: string;
    BETTER_AUTH_SECRET: string;
    /** Comma-separated extra origins; set in .dev.vars only, for the Vite dev server. */
    BETTER_AUTH_TRUSTED_ORIGINS?: string;
    GOOGLE_CLIENT_SECRET: string;
  }
}

export {};
