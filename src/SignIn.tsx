import { signIn } from "./auth-client";

/**
 * Google sign-in is a full-page redirect: the browser goes to Google, comes back to
 * /api/auth/callback/google, and lands on "/". No Google script is loaded here, which
 * is why the CSP needs no allowance for accounts.google.com.
 */
export function SignIn() {
  return (
    <main className="signin">
      <h1>Todos</h1>
      <p>A private list, kept per Google account. Nothing is shared with anyone else.</p>
      <button onClick={() => signIn.social({ provider: "google", callbackURL: "/" })}>
        Continue with Google
      </button>
    </main>
  );
}
