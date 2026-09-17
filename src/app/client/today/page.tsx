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
      <main className="mx-auto max-w-lg px-6 py-10">
        <h1 className="text-2xl font-semibold">Almost there</h1>
        <p className="mt-2 text-mut">
          Your coach is still setting up your program.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      <p className="elvt-label">Today</p>
      <h1 className="mt-2 text-3xl font-semibold" data-testid="client-greeting">
        Morning, {client.first_name}
      </h1>
      <p className="mt-3 text-mut">{client.goal_statement}</p>

      <section className="elvt-panel mt-8 p-5">
        <p className="elvt-label">Your program</p>
        <p className="mt-1 text-lg">
          {client.program_length_weeks} weeks
        </p>
      </section>
    </main>
  );
}
