import { createClient } from "@supabase/supabase-js";

export const COACH_EMAIL = process.env.SEED_COACH_EMAIL ?? "coach@elvt.test";
export const COACH_PASSWORD = process.env.SEED_COACH_PASSWORD ?? "ElvtCoach2026";

/** The first of the eight synthetic clients from the seed. */
export const CLIENT_EMAIL = process.env.SEED_CLIENT_EMAIL ?? "nadia.brookes@elvt.test";
export const CLIENT_PASSWORD = process.env.SEED_CLIENT_PASSWORD ?? "ElvtClient2026";

/**
 * These tests need the Supabase stack, not just the database: signing in goes
 * through Auth.
 *
 * UNTIL THIS RUNS GREEN ON A MACHINE WITH THE STACK UP, THE LOGIN FLOW IS
 * UNVERIFIED. Nothing downstream may assume a coach or a client can actually
 * sign in. Skipped is not passed.
 */
export async function supabaseIsUp(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return false;
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Generates a real magic link the way Supabase would email it, so the client
 * path is tested end to end without waiting on SMTP.
 */
export async function magicLinkFor(email: string): Promise<string> {
  const { data, error } = await adminClient().auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data?.properties?.action_link) {
    throw new Error(`Could not generate a magic link for ${email}: ${error?.message}`);
  }
  return data.properties.action_link;
}

/**
 * One skip reason, used by every spec that needs Auth, so the report says the
 * same loud thing everywhere rather than eight slightly different sentences.
 */
export const SKIP_REASON =
  "UNVERIFIED: Supabase Auth is not reachable, so the login flow has not been proved. Run npm run db:start, then npm run test:e2e.";
