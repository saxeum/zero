import { beforeAll, describe, expect, test } from "vitest";
import { readSession, signSession, verifyIdToken, type Session } from "./auth.ts";
import { TEST_SECRET } from "./testing.ts";

// A real RS256 keypair, generated here. No Google, no network, and the verification code
// under test is the one that runs in production — only the source of the public key changes.
let privateKey: CryptoKey;
let publicJwk: JsonWebKey & { kid: string; alg: string; use: string };
const getKeys = async () => [publicJwk];

const b64url = (bytes: ArrayBuffer | Uint8Array | string): string => {
  const raw =
    typeof bytes === "string"
      ? new TextEncoder().encode(bytes)
      : bytes instanceof Uint8Array
        ? bytes
        : new Uint8Array(bytes);
  return btoa(String.fromCharCode(...raw))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

type Overrides = Partial<{ alg: string; kid: string | undefined; iss: string; aud: string }>;
type Claims = Partial<{ sub: string; email: string; exp: number; iss: string; aud: string }>;

const mint = async (claims: Claims = {}, header: Overrides = {}): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  const head = {
    alg: "RS256",
    kid: "test-key",
    typ: "JWT",
    ...(header.alg ? { alg: header.alg } : {}),
    ...(header.kid === undefined ? {} : { kid: header.kid }),
  };
  const body = {
    sub: "user-a",
    email: "a@example.com",
    iss: "https://accounts.google.com",
    aud: "test-client-id.apps.googleusercontent.com",
    iat: now,
    exp: now + 3600,
    ...claims,
    ...(header.iss ? { iss: header.iss } : {}),
    ...(header.aud ? { aud: header.aud } : {}),
  };

  const unsigned = `${b64url(JSON.stringify(head))}.${b64url(JSON.stringify(body))}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${b64url(signature)}`;
};

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;

  privateKey = pair.privateKey;
  const exported = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  publicJwk = { ...exported, kid: "test-key", alg: "RS256", use: "sig" };
});

const CLIENT_ID = "test-client-id.apps.googleusercontent.com";

describe("verifyIdToken", () => {
  test("accepts a token signed by the key, for this audience", async () => {
    const session = await verifyIdToken(await mint(), { clientId: CLIENT_ID, getKeys });

    expect(session.sub).toBe("user-a");
    expect(session.email).toBe("a@example.com");
  });

  test("rejects an expired token", async () => {
    const token = await mint({ exp: Math.floor(Date.now() / 1000) - 1 });

    await expect(verifyIdToken(token, { clientId: CLIENT_ID, getKeys })).rejects.toThrow(/expired/);
  });

  test("rejects the wrong audience", async () => {
    const token = await mint({ aud: "someone-else.apps.googleusercontent.com" });

    await expect(verifyIdToken(token, { clientId: CLIENT_ID, getKeys })).rejects.toThrow(
      /audience/,
    );
  });

  test("rejects the wrong issuer", async () => {
    const token = await mint({ iss: "https://evil.example" });

    await expect(verifyIdToken(token, { clientId: CLIENT_ID, getKeys })).rejects.toThrow(/issuer/);
  });

  test("rejects alg: none, even with a valid-looking payload", async () => {
    const token = await mint({}, { alg: "none" });

    await expect(verifyIdToken(token, { clientId: CLIENT_ID, getKeys })).rejects.toThrow(/alg/);
  });

  test("rejects a token whose payload was edited after signing", async () => {
    const [head, , sig] = (await mint()).split(".");
    const edited = b64url(JSON.stringify({ sub: "user-b", email: "b@example.com", exp: 9e9 }));

    await expect(verifyIdToken(`${head}.${edited}.${sig}`, { clientId: CLIENT_ID, getKeys }))
      .rejects.toThrow(/signature|issuer/);
  });

  test("rejects a token signed by a different key", async () => {
    const other = (await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;

    const unsigned = `${b64url(JSON.stringify({ alg: "RS256", kid: "test-key" }))}.${b64url(
      JSON.stringify({
        sub: "x",
        email: "x@example.com",
        iss: "https://accounts.google.com",
        aud: CLIENT_ID,
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    )}`;
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      other.privateKey,
      new TextEncoder().encode(unsigned),
    );

    await expect(
      verifyIdToken(`${unsigned}.${b64url(signature)}`, { clientId: CLIENT_ID, getKeys }),
    ).rejects.toThrow(/signature/);
  });

  test("rejects an unknown kid", async () => {
    const token = await mint({}, { kid: "not-a-key" });

    await expect(verifyIdToken(token, { clientId: CLIENT_ID, getKeys })).rejects.toThrow(
      /signing key/,
    );
  });

  test("rejects a token that is not a JWT", async () => {
    await expect(verifyIdToken("nope", { clientId: CLIENT_ID, getKeys })).rejects.toThrow(/JWT/);
  });
});

describe("session cookie", () => {
  const session: Session = { sub: "user-a", email: "a@example.com", exp: 9e9 };

  test("round-trips", async () => {
    const value = await signSession(session, TEST_SECRET);

    expect(await readSession(value, TEST_SECRET)).toEqual(session);
  });

  test("rejects a different secret", async () => {
    const value = await signSession(session, TEST_SECRET);

    expect(await readSession(value, "another-secret")).toBeNull();
  });

  test("rejects a tampered payload", async () => {
    const value = await signSession(session, TEST_SECRET);
    const [, signature] = value.split(".");
    const forgedPayload = btoa(JSON.stringify({ ...session, email: "b@example.com" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    expect(await readSession(`${forgedPayload}.${signature}`, TEST_SECRET)).toBeNull();
  });

  test("rejects an expired session", async () => {
    const value = await signSession({ ...session, exp: 1 }, TEST_SECRET);

    expect(await readSession(value, TEST_SECRET)).toBeNull();
  });

  test("rejects absent or malformed values", async () => {
    expect(await readSession(undefined, TEST_SECRET)).toBeNull();
    expect(await readSession("", TEST_SECRET)).toBeNull();
    expect(await readSession("only-one-part", TEST_SECRET)).toBeNull();
  });
});
