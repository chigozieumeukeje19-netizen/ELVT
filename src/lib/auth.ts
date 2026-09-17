import { supabaseServer } from "@/lib/supabase/server";

export type AppRole = "client" | "coach" | "admin";

export type SessionProfile = {
  id: string;
  role: AppRole;
  display_name: string | null;
  email: string;
  timezone: string;
};

/**
 * The single place role is read. Everything that gates on coach or client goes
 * through here so there is one definition of what a role means.
 */
export async function currentProfile(): Promise<SessionProfile | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, role, display_name, email, timezone")
    .eq("id", user.id)
    .maybeSingle();

  return (data as SessionProfile | null) ?? null;
}

export function isStaff(role: AppRole | undefined | null): boolean {
  return role === "coach" || role === "admin";
}
