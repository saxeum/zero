import { env, SELF } from "cloudflare:test";

const PASSWORD = "password1234";

/**
 * Signs in through Better Auth's development-only password flow and returns a Cookie
 * header. Sign-up first, sign-in if the account already exists — tests share one D1.
 */
// `.dev.vars` overrides the bindings vitest.config declares, so the trusted origin is
// whatever the running Worker believes it is — locally http://localhost:8798, in CI
// http://zero.test. Hard-coding either one makes the suite pass in exactly one place.
export const origin = (env as unknown as { BETTER_AUTH_URL: string }).BETTER_AUTH_URL;

export async function signIn(email = "a@example.com"): Promise<string> {
  const body = JSON.stringify({ email, password: PASSWORD, name: email });

  for (const path of ["/api/auth/sign-up/email", "/api/auth/sign-in/email"]) {
    const res = await SELF.fetch(`http://zero.test${path}`, {
      method: "POST",
      // Better Auth rejects cookie-authenticated POSTs without an Origin: CSRF defence.
      headers: { "Content-Type": "application/json", Origin: origin },
      body,
    });
    if (!res.ok) continue;

    const cookies = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""];
    return cookies
      .filter(Boolean)
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
  }

  throw new Error("could not sign in — is emailAndPassword enabled for this environment?");
}
