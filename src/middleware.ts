import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Role middleware.
 *
 * Refreshes the Supabase session on every request, then gates by
 * profiles.role: /coach is staff only, /client is the client area, and a signed
 * in user who lands on the wrong side is redirected to their own home rather
 * than shown an error.
 *
 * This is a convenience layer, not the security boundary. RLS is the boundary.
 */

const COACH_PREFIX = "/coach";
const CLIENT_PREFIX = "/client";
const COACH_HOME = "/coach/queue";
const CLIENT_HOME = "/client/today";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        for (const { name, value } of toSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const wantsCoach = path.startsWith(COACH_PREFIX);
  const wantsClient =
    path.startsWith(CLIENT_PREFIX) && path !== "/client/login";

  if (!wantsCoach && !wantsClient) return response;

  if (!user) {
    const to = request.nextUrl.clone();
    to.pathname = wantsCoach ? "/login" : "/client/login";
    to.searchParams.set("next", path);
    return NextResponse.redirect(to);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role as "client" | "coach" | "admin" | undefined;
  const staff = role === "coach" || role === "admin";

  if (wantsCoach && !staff) {
    const to = request.nextUrl.clone();
    to.pathname = CLIENT_HOME;
    to.search = "";
    return NextResponse.redirect(to);
  }

  if (wantsClient && staff) {
    const to = request.nextUrl.clone();
    to.pathname = COACH_HOME;
    to.search = "";
    return NextResponse.redirect(to);
  }

  return response;
}

export const config = {
  matcher: ["/coach/:path*", "/client/:path*"],
};
