import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Where a magic link lands. Exchanges the code for a session, then sends the
 * client to their own home.
 *
 * Every redirect here is RELATIVE, and that is the whole point.
 *
 * This used to build an absolute URL from `new URL(request.url).origin`, which
 * is whatever host the server believed it was serving. When that disagreed with
 * the host the browser was actually on, the redirect crossed origins: the
 * session cookie was written on one host and the next request went to the
 * other, which does not send it. The client landed back on the login page with
 * a perfectly good session sitting on an origin nobody was looking at.
 *
 * A relative Location is resolved by the browser against the URL it asked for,
 * so the client stays on whatever origin they arrived on and the cookie always
 * travels with them. localhost and 127.0.0.1 are different origins to a
 * browser, and so are a bare domain and its www form, which is the same trap
 * waiting on production.
 */

/** Only ever a path on this site. An absolute URL here would be an open redirect. */
function safePath(candidate: string | null, fallback: string): string {
  if (!candidate) return fallback;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  return candidate;
}

function redirectTo(path: string): NextResponse {
  // 303 so the browser issues a GET regardless of how it arrived.
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safePath(searchParams.get("next"), "/client/today");

  if (!code) {
    return redirectTo("/client/login?error=missing_code");
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectTo(
      `/client/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return redirectTo(next);
}
