import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Where a magic link lands. Exchanges the code for a session, then sends the
 * user to their own home rather than a generic landing page.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/client/today";

  if (!code) {
    return NextResponse.redirect(`${origin}/client/login?error=missing_code`);
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/client/login?error=expired`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
