import { redirect } from "next/navigation";
import { RosterTable, type RosterRow } from "@/components/RosterTable";
import { currentProfile, isStaff } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Roster. Who is drifting.
 *
 * The eye should land on the flagged rows, because they are the only colored
 * thing on the screen. So the header above the table stays at two lines: any
 * more and it costs rows the coach needs above the fold.
 */
export default async function ClientsPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!isStaff(profile.role)) redirect("/client/today");

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("clients")
    .select(
      "id, slug, first_name, last_name, primary_goal, program_length_weeks, program_start_date, status, last_activity_at, flag_config",
    )
    .order("first_name");

  const today = Date.now();

  const rows: RosterRow[] = (data ?? []).map((c) => {
    const started = c.program_start_date ? new Date(c.program_start_date) : null;
    const week = started
      ? Math.max(1, Math.ceil((today - started.getTime()) / (7 * 864e5)))
      : null;

    return {
      id: c.id,
      slug: c.slug,
      name: [c.first_name, c.last_name].filter(Boolean).join(" "),
      program: c.primary_goal,
      week,
      weeks: c.program_length_weeks,
      phase: c.status,
      // Block B computes these at week roll. Until then the column reads as
      // no data rather than showing an invented number.
      score: null,
      adherence: null,
      weightDelta: null,
      lastActivityDays: c.last_activity_at
        ? Math.floor((today - new Date(c.last_activity_at).getTime()) / 864e5)
        : null,
      flags: Object.values((c.flag_config ?? {}) as Record<string, unknown>).filter(
        Boolean,
      ).length,
    };
  });

  return (
    <main className="px-5 py-4">
      <p className="elvt-label">Roster</p>
      <h1 className="mt-1 text-section">
        {rows.length} clients
      </h1>

      <div className="mt-4">
        <RosterTable rows={rows} />
      </div>
    </main>
  );
}
