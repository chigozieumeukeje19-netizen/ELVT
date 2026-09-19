import { notFound, redirect } from "next/navigation";
import { ScreenHeader } from "@/components/ScreenHeader";
import { RacePanel } from "@/components/race/RacePanel";
import { currentProfile, isStaff } from "@/lib/auth";
import { localDate } from "@/lib/engine/clock";
import {
  longestRun,
  mileageByWeek,
  nextRace,
  weeklyMileage,
  type Race,
  type RunLog,
} from "@/lib/race/mode";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Race mode.
 *
 * Every number on this page is read as of a date, and that date comes off the
 * query string with the client's own today as the default. The spec asks for a
 * countdown that reflects the day being viewed rather than today, and the only
 * way to honour that is for the page to have no opinion about what today is
 * beyond supplying a default.
 */
export default async function RacePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ on?: string }>;
}) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!isStaff(profile.role)) redirect("/client/today");

  const { slug } = await params;
  const { on } = await searchParams;
  const supabase = await supabaseServer();

  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, last_name, timezone")
    .eq("slug", slug)
    .maybeSingle();
  if (!client) notFound();

  const name = [client.first_name, client.last_name].filter(Boolean).join(" ");

  // The client's own today, not the server's. A coach in London reading a
  // client in Portland should see the countdown the client sees.
  const today = localDate(new Date(), client.timezone || "UTC");
  const viewedDate = /^\d{4}-\d{2}-\d{2}$/.test(on ?? "") ? (on as string) : today;

  const { data: raceRows } = await supabase
    .from("races")
    .select("id, name, race_date, distance_metres, goal_time_seconds, notes")
    .eq("client_id", client.id)
    .order("race_date");

  const races: Race[] = (raceRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    date: row.race_date,
    metres: row.distance_metres,
    goalTimeSeconds: row.goal_time_seconds,
    notes: row.notes,
  }));

  const race = nextRace(races, viewedDate);

  if (!race) {
    return (
      <main className="px-5 py-4">
        <ScreenHeader label="Race" title={name} note="Nothing in the diary." />
        <p className="max-w-[60ch] text-txt-mute" data-testid="race-empty">
          Race mode turns on when there is a race to count down to. Add one with
          a date and a distance, and the countdown, the taper, the fueling plan
          and the race week checklist all come from those two facts.
        </p>
      </main>
    );
  }

  const { data: weekRows } = await supabase
    .from("program_weeks")
    .select("week_number, starts_on, planned_mileage")
    .eq("client_id", client.id)
    .order("week_number");

  const { data: logRows } = await supabase
    .from("run_logs")
    .select("logged_for_date, distance, avg_pace")
    .eq("client_id", client.id)
    .order("logged_for_date");

  const logs: RunLog[] = (logRows ?? []).map((row) => ({
    loggedForDate: row.logged_for_date,
    distance: row.distance === null ? null : Number(row.distance),
  }));

  const mileage = mileageByWeek(
    (weekRows ?? []).map((week) => ({
      weekNumber: week.week_number,
      startsOn: week.starts_on,
      plannedMileage: week.planned_mileage === null ? null : Number(week.planned_mileage),
    })),
    logs,
    race,
  );

  return (
    <main className="px-5 py-4">
      <ScreenHeader
        label="Race"
        title={name}
        note={
          viewedDate === today
            ? undefined
            : `Read as of ${viewedDate}, not today. Everything below is the number they saw that day.`
        }
      />

      <RacePanel
        race={race}
        viewedDate={viewedDate}
        weeklyMiles={weeklyMileage(logs, viewedDate)}
        longest={longestRun(logs, viewedDate)}
        recentSecondsPerMile={recentPace(logRows ?? [], viewedDate)}
        mileage={mileage}
      />
    </main>
  );
}

/**
 * The pace the fueling plan falls back on when there is no goal time.
 *
 * The most recent logged pace on or before the viewed date, in seconds per
 * mile. Null when nothing usable is there, because an invented duration
 * produces an invented fueling plan and the client would carry it.
 */
function recentPace(
  rows: { logged_for_date: string; avg_pace: string | null }[],
  onOrBefore: string,
): number | null {
  for (let at = rows.length - 1; at >= 0; at -= 1) {
    const row = rows[at];
    if (row.logged_for_date > onOrBefore || !row.avg_pace) continue;

    // Stored as "8:42" per mile. Anything else is left alone rather than
    // guessed at.
    const match = /^(\d+):([0-5]\d)$/.exec(row.avg_pace.trim());
    if (!match) continue;
    return Number(match[1]) * 60 + Number(match[2]);
  }
  return null;
}
