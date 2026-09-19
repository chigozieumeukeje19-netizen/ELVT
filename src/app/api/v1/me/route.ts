import { NextResponse } from "next/server";
import { handler } from "@/lib/api/context";
import { localDate } from "@/lib/engine/clock";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me
 *
 * Who this client is and where they are in their program. The first call every
 * client surface makes, so it carries the feature flags too: a tab the client
 * cannot use should never render, and the app should not have to ask twice.
 */
export const GET = handler(async ({ clientId, db }) => {
  const { data: client } = await db
    .from("clients")
    .select(
      "id, slug, first_name, last_name, units, status, program_start_date, program_length_weeks, primary_goal, goal_statement, one_thing, feature_flags, timezone",
    )
    .eq("id", clientId)
    .maybeSingle();

  if (!client) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: program } = await db
    .from("programs")
    .select("id, name, phases, duration_weeks")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();

  const start = client.program_start_date ? new Date(client.program_start_date) : null;
  const dayOf = start
    ? Math.floor((Date.now() - start.getTime()) / 86_400_000) + 1
    : null;

  // The race countdown comes from the approved blueprint, which is the only
  // place a race date is agreed. A draft blueprint is not a commitment and does
  // not put a countdown in front of a client.
  const { data: blueprint } = await db
    .from("blueprints")
    .select("content")
    .eq("client_id", clientId)
    .eq("status", "approved")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const raceDate =
    ((blueprint?.content ?? {}) as { derived?: { raceDate?: string | null } }).derived?.raceDate ??
    null;

  const flags = (client.feature_flags ?? {}) as Record<string, boolean>;

  return NextResponse.json({
    client: {
      id: client.id,
      slug: client.slug,
      first_name: client.first_name,
      last_name: client.last_name,
      units: client.units,
      status: client.status,
      timezone: client.timezone,
      goal: client.primary_goal,
      goal_statement: client.goal_statement,
      // Shown to the client only when their own flag says so. It is the coach's
      // note about them, and not every client should read it.
      one_thing: flags.show_one_thing ? client.one_thing : null,
    },
    program: program
      ? {
          id: program.id,
          name: program.name,
          phases: program.phases,
          duration_weeks: program.duration_weeks,
          day: dayOf,
          days: (program.duration_weeks ?? 0) * 7,
        }
      : null,
    race: raceDate
      ? {
          date: raceDate,
          // Counted in whole days from the client's own today, so a countdown
          // never reads one day out for anyone east of the server.
          days_out: Math.max(
            0,
            Math.round(
              (Date.parse(`${raceDate}T00:00:00Z`) -
                Date.parse(`${localDate(new Date(), client.timezone || "UTC")}T00:00:00Z`)) /
                86_400_000,
            ),
          ),
        }
      : null,
    feature_flags: flags,
  });
});
