import { redirect } from "next/navigation";
import { RosterTable, type RosterRow } from "@/components/RosterTable";
import { FilterBar } from "@/components/roster/FilterBar";
import { currentProfile, isStaff } from "@/lib/auth";
import {
  applyFilters,
  countsFor,
  FILTERS,
  type FilterKey,
  type RosterCandidate,
  type Segment,
} from "@/lib/roster/filters";
import { countTouchpoints } from "@/lib/messages/touchpoints";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Roster. Who is drifting.
 *
 * The eye should land on the flagged rows, because they are the only colored
 * thing on the screen. So the header above the table stays at two lines: any
 * more and it costs rows the coach needs above the fold.
 */
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[] }>;
}) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!isStaff(profile.role)) redirect("/client/today");

  const { f } = await searchParams;
  const active = ([] as string[])
    .concat(f ?? [])
    .filter((key): key is FilterKey => (FILTERS as readonly string[]).includes(key));

  const supabase = await supabaseServer();

  const { data: touchpoints } = await supabase
    .from("touchpoints")
    .select("client_id, kind, at")
    .gte("at", new Date(Date.now() - 21 * 86_400_000).toISOString());

  const { data } = await supabase
    .from("clients")
    .select(
      "id, slug, first_name, last_name, primary_goal, program_length_weeks, program_start_date, status, last_activity_at, flag_config",
    )
    .order("first_name");

  const [{ data: queueItems }, { data: blueprints }, { data: programs }, { data: submissions }, { data: segmentRows }] =
    await Promise.all([
      supabase.from("queue_items").select("client_id").eq("status", "open"),
      supabase.from("blueprints").select("client_id").eq("status", "approved"),
      supabase.from("programs").select("client_id").eq("status", "active"),
      supabase
        .from("checkin_submissions")
        .select("client_id, for_date")
        .not("submitted_at", "is", null)
        .order("for_date", { ascending: false }),
      supabase.from("client_segments").select("id, name, filters").order("name"),
    ]);

  const segments: Segment[] = (segmentRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    filters: ((row.filters ?? []) as string[]).filter((key): key is FilterKey =>
      (FILTERS as readonly string[]).includes(key),
    ),
  }));

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
      ...touchpointsFor(touchpoints ?? [], c.id),
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

  const candidates: RosterCandidate[] = (data ?? []).map((c) => {
    const lastCheckin = (submissions ?? []).find((row) => row.client_id === c.id);
    const flags = Object.values((c.flag_config ?? {}) as Record<string, unknown>).filter(
      (on) => on === true,
    ).length;

    return {
      id: c.id,
      slug: c.slug,
      name: [c.first_name, c.last_name].filter(Boolean).join(" "),
      status: c.status ?? "active",
      // Computed at week roll, so null until the first Sunday.
      adherence: null,
      openQueueItems: (queueItems ?? []).filter((item) => item.client_id === c.id).length,
      flags,
      daysSinceCheckin: lastCheckin
        ? Math.round((today - Date.parse(`${lastCheckin.for_date}T00:00:00Z`)) / 864e5)
        : null,
      // The race date lives on the approved blueprint, which is read on the
      // client's own tab. Until that is joined here it is null, which reads as
      // "no race" rather than as a wrong countdown.
      daysToRace: null,
      hasApprovedBlueprint: (blueprints ?? []).some((row) => row.client_id === c.id),
      hasProgram: (programs ?? []).some((row) => row.client_id === c.id),
    };
  });

  const counts = countsFor(candidates, active);
  const kept = new Set(applyFilters(candidates, active).map((entry) => entry.id));
  const shown = rows.filter((row) => kept.has(row.id));

  const hrefFor = (key: FilterKey) => {
    const next = active.includes(key)
      ? active.filter((entry) => entry !== key)
      : [...active, key];
    const params = new URLSearchParams();
    for (const entry of next) params.append("f", entry);
    return next.length === 0 ? "/coach/clients" : `/coach/clients?${params.toString()}`;
  };

  return (
    <main className="px-5 py-4">
      <p className="elvt-label">Roster</p>
      <h1 className="mt-1 text-section">
        {rows.length} clients
      </h1>

      <div className="mt-4">
        <FilterBar
        active={active}
        counts={counts}
        segments={segments}
        hrefFor={hrefFor}
        segmentHrefFor={(segment) =>
          `/coach/clients?${segment.filters.map((key) => `f=${key}`).join("&")}`
        }
        total={rows.length}
        showing={shown.length}
      />

      <RosterTable rows={shown} />
      </div>
    </main>
  );
}

/**
 * The touchpoint figures for one client's row.
 *
 * Counted Monday to Sunday rather than over a rolling week, so the column means
 * the same thing every day someone looks at it.
 */
function touchpointsFor(
  all: { client_id: string; kind: string; at: string }[],
  clientId: string,
): { touchpoints: number | null; daysSinceTouch: number | null } {
  const theirs = all.filter((touchpoint) => touchpoint.client_id === clientId);
  if (theirs.length === 0) return { touchpoints: null, daysSinceTouch: null };

  const today = new Date().toISOString().slice(0, 10);
  const count = countTouchpoints(
    theirs.map((touchpoint) => ({ kind: touchpoint.kind as never, at: touchpoint.at })),
    today,
  );

  return { touchpoints: count.thisWeek, daysSinceTouch: count.daysSinceLast };
}
