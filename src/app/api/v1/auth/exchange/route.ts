import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { mintClientToken } from "@/lib/client-token";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/exchange
 *
 * Base44 signs the client in with its own auth, then a backend function calls
 * this with the portal API key and the client's email. We look up
 * clients.base44_user_id or the email and hand back a short lived JWT scoped to
 * that one client_id.
 *
 * Base44 stores nothing but the token. The client_id it carries is enforced by
 * RLS, so a token for one client cannot read another even if the calling code
 * asks for it.
 */

const bodySchema = z
  .object({
    email: z.string().email().optional(),
    base44_user_id: z.string().min(1).optional(),
  })
  .refine((v) => v.email || v.base44_user_id, {
    message: "Provide email or base44_user_id.",
  });

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

/** Constant time compare so the key cannot be probed a character at a time. */
function keyMatches(presented: string, expected: string): boolean {
  if (presented.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < presented.length; i += 1) {
    diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(request: NextRequest) {
  let env;
  try {
    env = serverEnv();
  } catch {
    return NextResponse.json(
      { error: "The portal is not configured." },
      { status: 500 },
    );
  }

  const presented =
    request.headers.get("x-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  if (!presented || !keyMatches(presented, env.PORTAL_API_KEY)) {
    return unauthorized();
  }

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide email or base44_user_id." },
      { status: 400 },
    );
  }

  const admin = supabaseAdmin();
  const query = admin
    .from("clients")
    .select("id, profile_id, status, slug")
    .limit(1);

  const { data: rows, error } = parsed.data.base44_user_id
    ? await query.eq("base44_user_id", parsed.data.base44_user_id)
    : await query.eq(
        "profile_id",
        (
          await admin
            .from("profiles")
            .select("id")
            .ilike("email", parsed.data.email!)
            .maybeSingle()
        ).data?.id ?? "00000000-0000-0000-0000-000000000000",
      );

  if (error) {
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }

  const client = rows?.[0];

  // A client who does not exist and a client who is archived get the same
  // answer, so the endpoint cannot be used to enumerate the roster.
  if (!client || !client.profile_id || client.status === "archived") {
    return unauthorized();
  }

  const { token, expiresIn } = await mintClientToken({
    userId: client.profile_id,
    clientId: client.id,
  });

  return NextResponse.json({
    token,
    token_type: "Bearer",
    expires_in: expiresIn,
    client_id: client.id,
    slug: client.slug,
  });
}
