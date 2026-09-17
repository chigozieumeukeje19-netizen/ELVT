import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

/**
 * Request-scoped client that reads and writes the auth cookies. Everything the
 * coach UI does goes through this, so RLS applies to the signed in user rather
 * than being bypassed.
 */
export async function supabaseServer() {
  const { url, anon } = publicEnv();
  const store = await cookies();

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) {
            store.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read only. The
          // middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}
