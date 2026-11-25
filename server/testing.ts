import { signSession, type Session } from "./auth.ts";

// Must match SESSION_SECRET in vitest.config.ts. Tests that need "a signed-in user"
// mint a cookie directly rather than pretending to be Google — the verifier itself is
// covered in auth.test.ts against a key the test controls.
export const TEST_SECRET = "test-session-secret";

export const sessionCookie = async (overrides: Partial<Session> = {}): Promise<string> => {
  const session: Session = {
    sub: "user-a",
    email: "a@example.com",
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
  return `zero_session=${await signSession(session, TEST_SECRET)}`;
};
