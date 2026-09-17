import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/magic-link
 *
 * For the portal served client page. The response is deliberately the same
 * whether or not the email belongs to a client, so the endpoint cannot be used
 * to find out who is on the roster.
 */

const bodySchema = z.object({
  email: z.string().email(),
  next: z.string().startsWith("/").optional(),
});

export async function POST(request: NextRequest) {
  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const next = parsed.data.next ?? "/client/today";
  const supabase = await supabaseServer();

  await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${next}` },
  });

  return NextResponse.json({ ok: true });
}
