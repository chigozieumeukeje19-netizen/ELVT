import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-for-tests";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key-for-tests";
  process.env.SUPABASE_JWT_SECRET = "a-test-secret-that-is-long-enough-for-hs256";
  process.env.PORTAL_API_KEY = "portal-key-for-tests";
});

describe("client token", () => {
  it("round trips the client_id claim", async () => {
    const { mintClientToken, verifyClientToken } = await import("@/lib/client-token");

    const userId = "11111111-1111-1111-1111-111111111111";
    const clientId = "22222222-2222-2222-2222-222222222222";

    const { token, expiresIn } = await mintClientToken({ userId, clientId });
    const claims = await verifyClientToken(token);

    expect(claims.sub).toBe(userId);
    expect(claims.client_id).toBe(clientId);
    // PostgREST only accepts the token if the role claim is authenticated.
    expect(claims.role).toBe("authenticated");
    expect(expiresIn).toBeGreaterThan(0);
  });

  it("is short lived", async () => {
    const { mintClientToken } = await import("@/lib/client-token");
    const { expiresIn } = await mintClientToken({
      userId: "11111111-1111-1111-1111-111111111111",
      clientId: "22222222-2222-2222-2222-222222222222",
    });
    // Base44 holds this in a session. An hour would be too long.
    expect(expiresIn).toBeLessThanOrEqual(60 * 60);
  });

  it("rejects a token signed with a different secret", async () => {
    const { SignJWT } = await import("jose");
    const { verifyClientToken } = await import("@/lib/client-token");

    const forged = await new SignJWT({ client_id: "x", role: "authenticated" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject("11111111-1111-1111-1111-111111111111")
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime("30m")
      .sign(new TextEncoder().encode("the-wrong-secret-entirely-padded-out"));

    await expect(verifyClientToken(forged)).rejects.toThrow();
  });
});

describe("AI provider flag", () => {
  it("is off unless a provider is named", async () => {
    const { aiEnabled } = await import("@/lib/env");
    const previous = process.env.AI_PROVIDER;

    delete process.env.AI_PROVIDER;
    expect(aiEnabled()).toBe(false);

    process.env.AI_PROVIDER = "off";
    expect(aiEnabled()).toBe(false);

    process.env.AI_PROVIDER = "anthropic";
    expect(aiEnabled()).toBe(true);

    process.env.AI_PROVIDER = previous;
  });
});
