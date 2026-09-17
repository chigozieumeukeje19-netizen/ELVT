import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Today is the client home. Block E fills it from GET /today; for now it proves
 * the magic link session resolves to exactly one client through RLS.
 */
export default async function TodayPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/client/login");

  const supabase = await supabaseServer();
  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, goal_statement, program_length_weeks, one_thing")
    .maybeSingle();

  if (!client) {
    return (
      <main className="mx-auto max-w-[520px] px-5 py-6">
        <p className="elvt-label">Today</p>
        <h1 className="mt-1 text-section">Your program is being built</h1>
        <p className="mt-2 text-txt-mute">
          Your coach is setting this up. It will be here before your first
          session.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[520px] px-5 py-6">
      <p className="elvt-label">Today</p>
      <h1 className="mt-1 text-name" data-testid="client-greeting">
        {client.first_name}
      </h1>
      <p className="mt-2 max-w-[48ch] text-txt-mute">{client.goal_statement}</p>

      <section className="mt-6">
        <p className="elvt-label">Program length</p>
        <p className="elvt-num mt-1 text-section">
          {client.program_length_weeks} weeks
        </p>
      </section>
    </main>
  );
}
