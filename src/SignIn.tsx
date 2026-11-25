import { signIn } from "./auth-client";

/**
 * Google sign-in is a full-page redirect: the browser goes to Google, comes back to
 * /api/auth/callback/google, and lands on "/". No Google script is loaded here, which
 * is why the CSP needs no allowance for accounts.google.com.
 */
export function SignIn() {
  return (
    <div>
      <h1>items</h1>
      <p className="muted">Sign in to see your items.</p>
      <button onClick={() => signIn.social({ provider: "google", callbackURL: "/" })}>
        Continue with Google
      </button>
    </div>
  );
}
