import { createAuthClient } from "better-auth/react";

// Same-origin in production and in dev (Vite proxies /api), so the absolute URL is
// derived rather than configured — one less thing to get wrong per environment.
const authClient = createAuthClient({
  baseURL: new URL("/api/auth", window.location.origin).toString(),
});

export const { useSession, signIn, signOut } = authClient;
