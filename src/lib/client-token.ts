import { SignJWT, jwtVerify } from "jose";
import { serverEnv } from "@/lib/env";

/**
 * Short lived token handed to Base44 and the generated PWA.
 *
 * It is signed with the Supabase JWT secret so PostgREST accepts it directly,
 * which means the client_id claim lands in request.jwt.claims and
 * public.current_client_id() resolves it. The check happens at the RLS layer,
 * not only in route code.
 */

const TTL_SECONDS = 60 * 30;

export type ClientTokenClaims = {
  sub: string;
  client_id: string;
  role: "authenticated";
  aud: "authenticated";
};

function secret(): Uint8Array {
  return new TextEncoder().encode(serverEnv().SUPABASE_JWT_SECRET);
}

export async function mintClientToken(params: {
  userId: string;
  clientId: string;
}): Promise<{ token: string; expiresIn: number }> {
  const token = await new SignJWT({
    client_id: params.clientId,
    role: "authenticated",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(params.userId)
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secret());

  return { token, expiresIn: TTL_SECONDS };
}

export async function verifyClientToken(token: string): Promise<ClientTokenClaims> {
  const { payload } = await jwtVerify(token, secret(), {
    audience: "authenticated",
  });
  if (typeof payload.sub !== "string" || typeof payload.client_id !== "string") {
    throw new Error("Token is missing the client claims.");
  }
  return payload as unknown as ClientTokenClaims;
}
