import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/auth-schema.ts";

/**
 * Better Auth bound to the request's D1 database. Built per request, because Workers
 * bindings are not available at module scope.
 *
 * The Google provider does a server-side code exchange, so unlike a browser-side ID-token
 * flow it *does* need the client secret. That secret is a Worker secret, never shipped.
 */
export function createAuth(env: Env) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(drizzle(env.DB, { schema }), {
      provider: "sqlite",
      schema,
    }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    // Development only, so tests and local work can sign in without a browser round
    // trip through Google. Production and preview are reachable by anyone, so they must
    // not offer password sign-up.
    emailAndPassword: { enabled: env.ENVIRONMENT === "development" },
    trustedOrigins: [env.BETTER_AUTH_URL],
  });
}

