import { notFound, redirect } from "next/navigation";
import { ClientTabs } from "@/components/client/ClientTabs";
import {
  CoachNotes,
  Flags,
  LastCheckin,
  OneThing,
  ScoreAndTiles,
  TopStrip,
  Touchpoints,
  Upcoming,
  tilesFrom,
  weightTile,
} from "@/components/client/Overview";
import { currentProfile, isStaff } from "@/lib/auth";
import {
  activeFlags,
  ageOn,
  lastTouchpoints,
  phaseOn,
  positionOn,
  summariseCheckin,
  tabsFor,
  upcoming,
} from "@/lib/client/overview";
import { addDays, localDate } from "@/lib/engine/clock";
import type { WeekAdherence } from "@/lib/engine/scoring";
import type { PhaseBand } from "@/lib/program/types";
import { adherenceLines } from "@/lib/queue/review-card";
import { nextRace, raceStatus, PHASE_LABELS } from "@/lib/race/mode";
import { supabaseServer } from "@/lib/supabase/server";
import { saveCoachNotesAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Client detail, Overview tab.
 *
 * This is the screen the roster has been linking to since the roster existed.
 * It is read on a date, like race mode, with the client's own today as the
 * default, so "Day 34 of 84", "in 3 days" and "2d ago" all mean the same thing
 * to the coach as they do to the client.
 */
export default async function ClientOverviewPage({
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
    .select(
      "id, slug, first_name, last_name, sex, dob, units, goal_statement, one_thing, coach_notes, flag_config, program_start_date, program_length_weeks, timezone",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!client) notFound();

  const name = [client.first_name, client.last_name].filter(Boolean).join(" ");
  const today = localDate(new Date(), client.timezone || "UTC");
  const viewed = /^\d{4}-\d{2}-\d{2}$/.test(on ?? "") ? (on as string) : today;

  const [
    { data: program },
    { data: weeks },
    { data: races },
    { data: submission },
    { data: touchpointRows },
    { data: weightRows },
  ] = await Promise.all([
    supabase
      .from("programs")
      .select("id, name, phases, duration_weeks")
      .eq("client_id", client.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("program_weeks")
      .select("week_number, starts_on, elvt_score, adherence")
      .eq("client_id", client.id)
      .order("week_number"),
    supabase
      .from("races")
      .select("id, name, race_date, distance_metres, goal_time_seconds, notes")
      .eq("client_id", client.id)
      .order("race_date"),
    supabase
      .from("checkin_submissions")
      .select("for_date, answers, reviewed_at, checkin_forms(kind)")
      .eq("client_id", client.id)
      .not("submitted_at", "is", null)
      .order("for_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("touchpoints")
      .select("kind, at")
      .eq("client_id", client.id)
      .order("at", { ascending: false })
      .limit(20),
    supabase
      .from("daily_logs")
      .select("date, weight")
      .eq("client_id", client.id)
      .not("weight", "is", null)
      .lte("date", viewed)
      .order("date", { ascending: false })
      .limit(14),
  ]);

  const position = positionOn(
    client.program_start_date,
    program?.duration_weeks ?? client.program_length_weeks,
    viewed,
  );

  const phases = (program?.phases ?? []) as PhaseBand[];
  const weekStarts = Object.fromEntries(
    (weeks ?? []).map((week) => [week.week_number, week.starts_on]),
  ) as Record<number, string>;

  // The last week that actually closed, which is where the score and the
  // adherence come from. A week still running has neither.
  const closed = [...(weeks ?? [])]
    .filter((week) => week.elvt_score !== null && week.starts_on <= viewed)
    .sort((a, b) => b.week_number - a.week_number)[0];

  const adherence = (closed?.adherence ?? {}) as WeekAdherence;

  const race = nextRace(
    (races ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      date: row.race_date,
      metres: row.distance_metres,
      goalTimeSeconds: row.goal_time_seconds,
      notes: row.notes,
    })),
    viewed,
  );
  const status = race ? raceStatus(race, viewed) : null;

  const latestWeight = weightRows?.[0]?.weight ?? null;
  // A week earlier, or the oldest reading inside the fortnight if that day was
  // missed. Comparing against nothing is null rather than zero.
  const weekAgo =
    weightRows?.find((row) => row.date <= addDays(viewed, -7))?.weight ?? null;

  return (
    <main className="px-5 py-4">
      <TopStrip
        name={name}
        age={ageOn(client.dob, viewed)}
        sex={client.sex}
        goalStatement={client.goal_statement}
        programName={program?.name ?? null}
        position={position}
        phase={position ? phaseOn(phases, position.week) : null}
        raceLine={
          race && status
            ? status.daysOut < 0
              ? `${race.name}, run`
              : `${race.name} in ${status.daysOut}d, ${PHASE_LABELS[status.phase]}`
            : null
        }
        startDate={client.program_start_date}
      />

      <ClientTabs slug={slug} tabs={tabsFor(race !== null)} current="overview" />

      <ScoreAndTiles
        score={closed?.elvt_score === undefined || closed?.elvt_score === null ? null : Number(closed.elvt_score)}
        focus={weakest(adherence)}
        tiles={tilesFrom(
          adherenceLines(adherence),
          weightTile(
            latestWeight === null ? null : Number(latestWeight),
            latestWeight === null || weekAgo === null ? null : Number(latestWeight) - Number(weekAgo),
            client.units ?? "imperial",
          ),
        )}
      />

      <OneThing text={client.one_thing} />

      <Flags flags={activeFlags(client.flag_config as Record<string, unknown> | null)} />

      <LastCheckin
        summary={summariseCheckin(
          submission
            ? {
                for_date: submission.for_date,
                answers: submission.answers as Record<string, unknown> | null,
                reviewed_at: submission.reviewed_at,
              }
            : null,
          {},
          viewed,
        )}
        slug={slug}
      />

      <Touchpoints lines={lastTouchpoints(touchpointRows ?? [], viewed)} />

      <Upcoming
        events={upcoming({
          on: viewed,
          position,
          phases,
          weekStarts,
          raceDate: race && status && status.daysOut >= 0 ? race.date : null,
          raceName: race?.name ?? null,
          retestWeeks: [],
        })}
      />

      <CoachNotes
        notes={client.coach_notes}
        action={saveCoachNotesAction.bind(null, slug)}
      />
    </main>
  );
}

/** The weakest adherence category, or null when nothing is below the rest. */
function weakest(adherence: WeekAdherence): string | null {
  let worst: { key: string; percent: number } | null = null;

  for (const [key, fraction] of Object.entries(adherence)) {
    if (!fraction || fraction.planned <= 0) continue;
    const percent = (fraction.done / fraction.planned) * 100;
    if (!worst || percent < worst.percent) worst = { key, percent };
  }

  return worst?.key ?? null;
}
