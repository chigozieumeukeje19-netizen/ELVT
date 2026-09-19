/**
 * The persistence half of the week roll.
 *
 * planWeekRoll decides what should happen. This applies it. The split is
 * deliberate: everything that could be wrong about a week roll is arithmetic or
 * a timezone, and both are tested without a database.
 *
 * Runs with the service role, because it writes on behalf of clients who are
 * asleep. It is therefore never reachable from a request handler.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "./clock";
import {
  planWeekRoll,
  WEEK_ROLL_SCHEDULE,
  type RollInput,
  type RollPlan,
  type RollWrite,
} from "./week-roll";
import type { WeekAdherence } from "./scoring";

export type RollResult = {
  clientId: string;
  slug: string;
  skipped: string | null;
  applied: number;
};

/**
 * Applies one client's plan.
 *
 * Every write is keyed, and the keys were already checked against what exists
 * when the plan was built, so this is an insert path rather than an upsert
 * path. The unique indexes behind these keys are the backstop: two schedulers
 * racing would have one of them fail rather than both succeed.
 */
async function applyPlan(
  supabase: SupabaseClient,
  clientId: string,
  plan: RollPlan,
): Promise<number> {
  let applied = 0;

  for (const write of plan.writes) {
    switch (write.kind) {
      case "snapshot": {
        const { error } = await supabase
          .from("program_weeks")
          .update({ snapshot: write.snapshot })
          .eq("id", write.weekId)
          // Only if it is still unfrozen. A second runner that got past the
          // plan check loses here rather than overwriting a frozen week.
          .is("snapshot", null);
        if (error) throw new Error(`Week ${write.weekNumber} snapshot: ${error.message}`);
        applied += 1;
        break;
      }

      case "week_score": {
        const { error } = await supabase
          .from("program_weeks")
          .update({ elvt_score: write.score, adherence: write.adherence })
          .eq("id", write.weekId);
        if (error) throw new Error(`Week score: ${error.message}`);
        applied += 1;
        break;
      }

      case "daily_form":
      case "weekly_form": {
        const kind = write.kind === "daily_form" ? "daily" : "weekly";

        // One form row per client per kind holds the questions; the submission
        // rows carry the dates. The unique index on (form_id, for_date) is what
        // makes a second run a no-op rather than a duplicate.
        const { data: form } = await supabase
          .from("checkin_forms")
          .select("id")
          .eq("client_id", clientId)
          .eq("kind", kind)
          .maybeSingle();

        if (!form) break;

        if (write.kind === "weekly_form") {
          await supabase
            .from("checkin_forms")
            .update({
              spine_variable: write.spineVariable,
              generated_from_change_id: write.generatedFromChangeId,
            })
            .eq("id", form.id);
        }

        const { error } = await supabase.from("checkin_submissions").insert({
          form_id: form.id,
          client_id: clientId,
          for_date: write.forDate,
        });

        // 23505 is a duplicate key, which here means another runner got there
        // first. That is the idempotency rule holding, not a failure.
        if (error && error.code !== "23505") {
          throw new Error(`${kind} form for ${write.forDate}: ${error.message}`);
        }
        if (!error) applied += 1;
        break;
      }

      case "event": {
        const { error } = await supabase.from("events").insert({
          type: write.type,
          client_id: clientId,
          payload: { ...write.payload, key: write.key },
        });
        if (error) throw new Error(`Event: ${error.message}`);
        applied += 1;
        break;
      }

      case "queue_item": {
        const { error } = await supabase.from("queue_items").insert({
          client_id: clientId,
          kind: write.kind_,
          severity: write.severity,
          title: write.title,
          detail: { ...write.detail, key: write.key },
        });
        if (error) throw new Error(`Queue item: ${error.message}`);
        applied += 1;
        break;
      }
    }
  }

  return applied;
}

/**
 * Gathers one client's week into the shape planWeekRoll reads.
 *
 * The keys already written are read back here rather than assumed, so a run
 * that died halfway through finishes the rest on its next tick instead of
 * either duplicating or skipping everything.
 */
export async function buildRollInput(
  supabase: SupabaseClient,
  instant: Date,
  client: { id: string; slug: string; first_name: string; last_name: string | null; timezone: string },
): Promise<{ input: RollInput; lastRun: string | null } | null> {
  const { data: program } = await supabase
    .from("programs")
    .select("id")
    .eq("client_id", client.id)
    .eq("status", "active")
    .maybeSingle();
  if (!program) return null;

  const { data: weekRows } = await supabase
    .from("program_weeks")
    .select("id, week_number, starts_on, is_deload, planned_mileage, snapshot")
    .eq("program_id", program.id)
    .order("week_number");

  const weeks = (weekRows ?? []).map((week) => ({
    id: week.id,
    weekNumber: week.week_number,
    startsOn: week.starts_on,
    isDeload: week.is_deload,
    plannedMileage: Number(week.planned_mileage ?? 0),
    snapshot: week.snapshot,
  }));

  // The week being closed is the earliest unfrozen one, so a run that missed a
  // Sunday catches up rather than skipping a week forever.
  const open = weeks.find((week) => week.snapshot === null);
  if (!open) return null;

  const weekEnd = addDays(open.startsOn, 6);

  const [{ data: days }, { data: logs }, { data: completions }, { data: runLogs }, { data: config }] =
    await Promise.all([
      supabase
        .from("program_days")
        .select("date, is_rest, sessions(kind, status)")
        .gte("date", open.startsOn)
        .lte("date", weekEnd),
      supabase
        .from("daily_logs")
        .select("date, weight, steps, session_status")
        .eq("client_id", client.id)
        .gte("date", addDays(open.startsOn, -7))
        .lte("date", weekEnd),
      supabase
        .from("day_completion")
        .select("date, score")
        .eq("client_id", client.id)
        .gte("date", open.startsOn)
        .lte("date", weekEnd),
      supabase
        .from("run_logs")
        .select("distance, created_at")
        .gte("created_at", open.startsOn),
      supabase
        .from("scoring_config")
        .select("weights, client_id")
        .or(`client_id.eq.${client.id},client_id.is.null`),
    ]);

  const sessions = (days ?? []).flatMap(
    (day) => (day.sessions ?? []) as { kind: string; status: string }[],
  );

  const counted = (kinds: string[]) => {
    const relevant = sessions.filter((session) => kinds.includes(session.kind));
    return {
      planned: relevant.length,
      done: relevant.filter((session) => session.status === "done" || session.status === "modified")
        .length,
    };
  };

  const dayCount = (days ?? []).length;
  const adherence: WeekAdherence = {
    training: counted(["strength", "conditioning"]),
    run: counted(["run"]),
    calories: { planned: dayCount, done: (logs ?? []).filter((log) => log.date >= open.startsOn).length },
    protein: { planned: dayCount, done: (logs ?? []).filter((log) => log.date >= open.startsOn).length },
    steps: {
      planned: dayCount,
      done: (logs ?? []).filter((log) => log.date >= open.startsOn && (log.steps ?? 0) > 0).length,
    },
    checkin: {
      planned: dayCount,
      done: (logs ?? []).filter((log) => log.date >= open.startsOn && log.session_status !== null)
        .length,
    },
  };

  // The client's own weights row wins over the default, which is the row with a
  // null client_id.
  const weights =
    (config ?? []).find((row) => row.client_id === client.id)?.weights ??
    (config ?? [])[0]?.weights ??
    {};

  const completedMileage: Record<number, number> = {};
  for (const week of weeks) {
    const snapshot = week.snapshot as { completedMileage?: number } | null;
    if (snapshot?.completedMileage !== undefined) {
      completedMileage[week.weekNumber] = snapshot.completedMileage;
    }
  }
  completedMileage[open.weekNumber] = (runLogs ?? []).reduce(
    (total, log) => total + Number(log.distance ?? 0),
    0,
  );

  const { data: spine } = await supabase
    .from("plan_changes")
    .select("id, field")
    .eq("client_id", client.id)
    .eq("status", "applied")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextWeek = weeks.find((week) => week.weekNumber === open.weekNumber + 1);
  const { data: existingSubmissions } = nextWeek
    ? await supabase
        .from("checkin_submissions")
        .select("for_date, checkin_forms(kind)")
        .eq("client_id", client.id)
        .gte("for_date", nextWeek.startsOn)
        .lte("for_date", addDays(nextWeek.startsOn, 6))
    : { data: [] };

  // PostgREST types an embedded row as an array here, so the shape is read
  // through a helper rather than asserted into something it is not.
  const submissions = (existingSubmissions ?? []) as unknown as {
    for_date: string;
    checkin_forms: { kind: string } | { kind: string }[] | null;
  }[];

  const formKind = (row: (typeof submissions)[number]): string | null => {
    const embedded = row.checkin_forms;
    if (!embedded) return null;
    return Array.isArray(embedded) ? (embedded[0]?.kind ?? null) : embedded.kind;
  };

  const { data: existingQueue } = await supabase
    .from("queue_items")
    .select("detail")
    .eq("client_id", client.id)
    .in("kind", ["monday_review", "mileage_spike"]);

  const { data: existingEvents } = await supabase
    .from("events")
    .select("payload")
    .eq("client_id", client.id)
    .eq("type", "week_rolled");

  const { data: lastRunRow } = await supabase
    .from("events")
    .select("payload")
    .eq("client_id", client.id)
    .eq("type", "week_rolled")
    .order("at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    lastRun: ((lastRunRow?.payload ?? {}) as { localDate?: string }).localDate ?? null,
    input: {
      instant,
      client: {
        id: client.id,
        slug: client.slug,
        name: [client.first_name, client.last_name].filter(Boolean).join(" "),
        timezone: client.timezone,
      },
      programId: program.id,
      weeks,
      weekNumber: open.weekNumber,
      adherence,
      scoringWeights: weights as Record<string, number>,
      dailyScores: (completions ?? []).map((row) => ({
        date: row.date,
        score: Number(row.score ?? 0),
      })),
      weights: (logs ?? []).map((log) => ({
        date: log.date,
        weight: log.weight === null ? null : Number(log.weight),
      })),
      completedMileage,
      spineVariable: spine?.field ?? null,
      spineChangeId: spine?.id ?? null,
      existing: {
        dailyFormDates: submissions
          .filter((row) => formKind(row) === "daily")
          .map((row) => row.for_date),
        weeklyFormDates: submissions
          .filter((row) => formKind(row) === "weekly")
          .map((row) => row.for_date),
        eventKeys: (existingEvents ?? []).map(
          (row) => ((row.payload ?? {}) as { key?: string }).key ?? "",
        ),
        queueKeys: (existingQueue ?? []).map(
          (row) => ((row.detail ?? {}) as { key?: string }).key ?? "",
        ),
      },
    },
  };
}

/** Rolls every active client whose local Sunday has just ended. */
export async function runWeekRoll(
  supabase: SupabaseClient,
  instant: Date = new Date(),
): Promise<RollResult[]> {
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, slug, first_name, last_name, timezone")
    .eq("status", "active");

  if (error) throw new Error(`Could not read the roster: ${error.message}`);

  const results: RollResult[] = [];

  for (const client of clients ?? []) {
    const built = await buildRollInput(supabase, instant, {
      ...client,
      // A client with no timezone is a data fault, not a reason to roll them on
      // the server's clock and quietly close the wrong day.
      timezone: client.timezone ?? "",
    });

    if (!built) {
      results.push({ clientId: client.id, slug: client.slug, skipped: "No open week.", applied: 0 });
      continue;
    }

    if (!client.timezone) {
      results.push({
        clientId: client.id,
        slug: client.slug,
        skipped: "No timezone set, so there is no Sunday to roll.",
        applied: 0,
      });
      continue;
    }

    const plan = planWeekRoll(built.input, built.lastRun);
    const applied = plan.writes.length > 0 ? await applyPlan(supabase, client.id, plan) : 0;

    results.push({
      clientId: client.id,
      slug: client.slug,
      skipped: plan.skipped,
      applied,
    });
  }

  return results;
}

export { WEEK_ROLL_SCHEDULE };
export type { RollWrite };
