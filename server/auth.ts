// Verifying Google ID tokens, and our own session cookie.
//
// The Google half is deliberately injectable: `getKeys` is a parameter so tests can
// supply a key they control and exercise the real verification code — signature,
// audience, issuer, expiry — instead of mocking verification away.

const GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

export type Session = { sub: string; email: string; exp: number };

/** A JWK as Google publishes it: the standard members plus a key id. */
type SigningKey = JsonWebKey & { kid?: string };

export type VerifyOptions = {
  clientId: string;
  /** Injected in tests; production uses the cached Google JWKS. */
  getKeys?: () => Promise<SigningKey[]>;
  now?: () => number;
};

const decoder = new TextDecoder();

const base64UrlToBytes = (value: string): Uint8Array => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const utf8ToBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

let cachedKeys: { keys: JsonWebKey[]; expires: number } | null = null;

/** Google rotates its signing keys; the cache is the isolate's, and short-lived. */
async function fetchGoogleKeys(): Promise<SigningKey[]> {
  const now = Date.now();
  if (cachedKeys && cachedKeys.expires > now) return cachedKeys.keys;

  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`JWKS fetch failed: HTTP ${res.status}`);

  const body = (await res.json()) as { keys?: SigningKey[] };
  if (!Array.isArray(body.keys)) throw new Error("JWKS response has no keys");

  const maxAge = Number((res.headers.get("cache-control") ?? "").match(/max-age=(\d+)/)?.[1]);
  cachedKeys = {
    keys: body.keys,
    expires: now + (Number.isFinite(maxAge) && maxAge > 0 ? maxAge * 1000 : 3600_000),
  };
  return cachedKeys.keys;
}

/**
 * Throws on anything wrong. The distinction between "expired" and "wrong audience"
 * matters to a developer reading logs, not to the caller, which returns 401 either way.
 */
export async function verifyIdToken(
  token: string,
  { clientId, getKeys = fetchGoogleKeys, now = Date.now }: VerifyOptions,
): Promise<Session> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("token is not a JWT");
  const [rawHeader, rawPayload, rawSignature] = parts;

  const header = JSON.parse(decoder.decode(base64UrlToBytes(rawHeader))) as {
    alg?: string;
    kid?: string;
  };
  // Never trust `alg` from the token beyond an allow-list: `none` is the whole point
  // of this check, and `HS256` would let an attacker sign with our public modulus.
  if (header.alg !== "RS256") throw new Error(`unsupported alg: ${header.alg}`);
  if (!header.kid) throw new Error("token has no kid");

  const claims = JSON.parse(decoder.decode(base64UrlToBytes(rawPayload))) as {
    iss?: string;
    aud?: string;
    sub?: string;
    email?: string;
    exp?: number;
    iat?: number;
  };

  if (!claims.iss || !GOOGLE_ISSUERS.includes(claims.iss)) throw new Error("wrong issuer");
  if (claims.aud !== clientId) throw new Error("wrong audience");
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= now()) throw new Error("expired");
  if (!claims.sub) throw new Error("token has no subject");
  if (!claims.email) throw new Error("token has no email");

  const jwk = (await getKeys()).find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("no matching signing key");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(rawSignature),
    new TextEncoder().encode(`${rawHeader}.${rawPayload}`),
  );
  if (!valid) throw new Error("bad signature");

  return { sub: claims.sub, email: claims.email, exp: claims.exp };
}

// ---- session cookie -------------------------------------------------------------

const importHmacKey = (secret: string) =>
  crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

/** `base64url(payload).base64url(hmac)` — signed, not encrypted: it is not a secret. */
export async function signSession(session: Session, secret: string): Promise<string> {
  const payload = utf8ToBase64Url(new TextEncoder().encode(JSON.stringify(session)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await importHmacKey(secret),
    new TextEncoder().encode(payload),
  );
  return `${payload}.${utf8ToBase64Url(new Uint8Array(signature))}`;
}

/** Returns null for anything unsigned, tampered with, malformed or expired. */
export async function readSession(
  value: string | undefined,
  secret: string,
  now = Date.now,
): Promise<Session | null> {
  if (!value) return null;

  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const valid = await crypto.subtle.verify(
    "HMAC",
    await importHmacKey(secret),
    base64UrlToBytes(signature),
    new TextEncoder().encode(payload),
  );
  if (!valid) return null;

  try {
    const session = JSON.parse(decoder.decode(base64UrlToBytes(payload))) as Session;
    if (typeof session.exp !== "number" || session.exp * 1000 <= now()) return null;
    return session;
  } catch {
    return null;
  }
}
