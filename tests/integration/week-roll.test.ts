import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyPlan, buildRollInput } from "@/lib/engine/run-week-roll";
import { planWeekRoll } from "@/lib/engine/week-roll";
import { assertRestIsLive, cleanup, makeClient, serviceClient } from "./harness";

/**
 * buildRollInput and applyPlan, against real rows.
 *
 * The planner has thirty unit tests. What had none was the half that decides
 * which week is being closed, which scores go in, what has already been
 * written and therefore what must not be written again. A planner handed the
 * wrong week produces a confident, wrong, frozen snapshot.
 *
 * So these assert the numbers, not the absence of a throw.
 */

let supabase: SupabaseClient;

const START = "2026-09-21"; // A Monday.

async function buildProgram(
  clientId: string,
  options: {
    weeks?: number;
    frozen?: number[];
    /** Day offsets inside week one that carry a strength session. */
    sessionsOnDays?: number[];
    /** Which of those were completed. */
    doneOnDays?: number[];
  } = {},
): Promise<string> {
  const weeks = options.weeks ?? 4;
  const programId = randomUUID();

  const { error } = await supabase.from("programs").insert({
    id: programId,
    client_id: clientId,
    name: "Integration block",
    duration_weeks: weeks,
    status: "active",
  });
  if (error) throw new Error(error.message);

  for (let week = 1; week <= weeks; week += 1) {
    const startsOn = addDays(START, (week - 1) * 7);
    const { error: weekError } = await supabase.from("program_weeks").insert({
      program_id: programId,
      client_id: clientId,
      week_number: week,
      starts_on: startsOn,
      is_deload: week === 4,
      planned_mileage: 20 + week * 4,
      // A frozen week is one the roll has already closed.
      snapshot: options.frozen?.includes(week) ? { weekNumber: week, frozenAt: "2026-01-01" } : null,
    });
    if (weekError) throw new Error(weekError.message);
  }

  // All seven days of week one, which is the week these tests close. Rest days
  // are rows too: the calorie and step targets are counted against every day of
  // the week, not against the days that happen to carry a session.
  if (options.sessionsOnDays) {
    const { data: weekRow } = await supabase
      .from("program_weeks")
      .select("id")
      .eq("client_id", clientId)
      .eq("week_number", 1)
      .single();

    for (let offset = 0; offset < 7; offset += 1) {
      const hasSession = options.sessionsOnDays.includes(offset);
      const { data: day, error: dayError } = await supabase
        .from("program_days")
        .insert({
          program_week_id: weekRow!.id,
          client_id: clientId,
          date: addDays(START, offset),
          day_of_week: (1 + offset) % 7,
          is_rest: !hasSession,
        })
        .select("id")
        .single();
      if (dayError) throw new Error(dayError.message);

      if (!hasSession) continue;

      const { error: sessionError } = await supabase.from("sessions").insert({
        program_day_id: day!.id,
        client_id: clientId,
        kind: "strength",
        name: "Session",
        order: 0,
        status: options.doneOnDays?.includes(offset) ? "done" : "planned",
      });
      if (sessionError) throw new Error(sessionError.message);
    }
  }

  return programId;
}

/**
 * A run row for this client, so run_logs has something to point at.
 *
 * run_logs.run_id is NOT NULL, so a logged run always belongs to a prescribed
 * one. The day it is logged for is on the log, not on the run, which is what
 * lets a client log Tuesday's run on Wednesday.
 */
async function makeRun(clientId: string, programId: string): Promise<string> {
  const { data: week } = await supabase
    .from("program_weeks")
    .select("id")
    .eq("program_id", programId)
    .eq("week_number", 1)
    .single();

  const { data: day, error: dayError } = await supabase
    .from("program_days")
    .insert({
      program_week_id: week!.id,
      client_id: clientId,
      date: START,
      day_of_week: 1,
      is_rest: false,
    })
    .select("id")
    .single();
  if (dayError) throw new Error(dayError.message);

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({
      program_day_id: day!.id,
      client_id: clientId,
      kind: "run",
      name: "Easy run",
      order: 0,
    })
    .select("id")
    .single();
  if (sessionError) throw new Error(sessionError.message);

  const { data: run, error: runError } = await supabase
    .from("runs")
    .insert({ session_id: session!.id, client_id: clientId, run_type: "easy" })
    .select("id")
    .single();
  if (runError) throw new Error(runError.message);

  return run!.id;
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

beforeAll(async () => {
  supabase = await serviceClient();
  await assertRestIsLive(supabase);
});

afterAll(async () => {
  await cleanup(supabase);
});

describe("buildRollInput", () => {
  it("returns nothing at all for a client with no active program", async () => {
    const client = await makeClient(supabase);
    const built = await buildRollInput(supabase, new Date("2026-09-28T03:59:00Z"), {
      id: client.id,
      slug: client.slug,
      first_name: "Integration",
      last_name: "Fixture",
      timezone: "America/New_York",
    });

    expect(built).toBeNull();
  });

  it("picks the earliest week that has not been frozen", async () => {
    // Not "the week containing today". A run that missed a Sunday has to close
    // the one it missed, and this is the query that decides which.
    const client = await makeClient(supabase);
    await buildProgram(client.id, { frozen: [1, 2] });

    const built = await buildRollInput(supabase, new Date("2026-10-19T03:59:00Z"), {
      id: client.id,
      slug: client.slug,
      first_name: "Integration",
      last_name: "Fixture",
      timezone: "America/New_York",
    });

    expect(built).not.toBeNull();
    expect(built!.input.weekNumber).toBe(3);
  });

  it("hands the planner every week of the block, with the deload marked", async () => {
    const client = await makeClient(supabase);
    await buildProgram(client.id);

    const built = await buildRollInput(supabase, new Date("2026-09-28T03:59:00Z"), {
      id: client.id,
      slug: client.slug,
      first_name: "Integration",
      last_name: "Fixture",
      timezone: "America/New_York",
    });

    const weeks = built!.input.weeks;
    expect(weeks.map((week) => week.weekNumber)).toEqual([1, 2, 3, 4]);
    expect(weeks.map((week) => week.startsOn)).toEqual([
      "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12",
    ]);
    expect(weeks.find((week) => week.isDeload)!.weekNumber).toBe(4);
    // Numeric, not the string PostgREST returns for a numeric column.
    expect(weeks.map((week) => week.plannedMileage)).toEqual([24, 28, 32, 36]);
  });

  it("counts only this client's days, not the whole roster's", async () => {
    // This job runs with the service role, which bypasses RLS, so a query
    // missing its client filter is not caught by a policy: it silently returns
    // everybody. The program_days query had no filter at all, and every
    // client's adherence was being counted against every client's sessions.
    const mine = await makeClient(supabase);
    const theirs = await makeClient(supabase);
    await buildProgram(mine.id, { sessionsOnDays: [0, 2] });
    await buildProgram(theirs.id, { sessionsOnDays: [0, 1, 2, 3, 4, 5, 6] });

    const built = await buildRollInput(supabase, new Date("2026-09-28T03:59:00Z"), {
      id: mine.id,
      slug: mine.slug,
      first_name: "Integration",
      last_name: "Fixture",
      timezone: "America/New_York",
    });

    // Two planned sessions, mine. Not nine.
    expect(built!.input.adherence.training.planned).toBe(2);
  });

  it("reads adherence out of the rows rather than defaulting it to nothing", async () => {
    const client = await makeClient(supabase);
    await buildProgram(client.id, { sessionsOnDays: [0, 1, 2, 3], doneOnDays: [0, 2, 3] });

    for (const [offset, steps] of [[0, 9000], [1, 3000], [2, 9500], [3, 10000]] as const) {
      const { error } = await supabase.from("daily_logs").insert({
        client_id: client.id,
        date: addDays(START, offset),
        steps,
        sleep_hours: 7,
        weight: 180 - offset * 0.2,
        session_status: offset === 1 ? "no" : "done",
      });
      if (error) throw new Error(error.message);
    }

    for (const offset of [0, 1, 2, 3]) {
      const { error } = await supabase.from("day_completion").insert({
        client_id: client.id,
        date: addDays(START, offset),
        score: 80 + offset,
      });
      if (error) throw new Error(error.message);
    }

    const built = await buildRollInput(supabase, new Date("2026-09-28T03:59:00Z"), {
      id: client.id,
      slug: client.slug,
      first_name: "Integration",
      last_name: "Fixture",
      timezone: "America/New_York",
    });

    const adherence = built!.input.adherence;
    expect(adherence.training).toEqual({ planned: 4, done: 3 });
    // Seven days in the week, four of them logged.
    expect(adherence.steps).toEqual({ planned: 7, done: 4 });

    expect(built!.input.dailyScores).toEqual([
      { date: "2026-09-21", score: 80 },
      { date: "2026-09-22", score: 81 },
      { date: "2026-09-23", score: 82 },
      { date: "2026-09-24", score: 83 },
    ]);

    // The weights the trend is read from, this week and the one before it.
    expect(built!.input.weights.map((entry) => entry.date)).toEqual([
      "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24",
    ]);
  });

  it("counts only this client's miles, on the days of the week being closed", async () => {
    // The run_logs query filtered on created_at, which is when the row was
    // written, had no upper bound, and named no client. All three mattered.
    const mine = await makeClient(supabase);
    const theirs = await makeClient(supabase);
    const myProgram = await buildProgram(mine.id);
    const theirProgram = await buildProgram(theirs.id);
    const myRun = await makeRun(mine.id, myProgram);
    const theirRun = await makeRun(theirs.id, theirProgram);

    const runs = [
      { run_id: myRun, client_id: mine.id, distance: 6, logged_for_date: addDays(START, 1) },
      { run_id: myRun, client_id: mine.id, distance: 12, logged_for_date: addDays(START, 5) },
      // After the week being closed.
      { run_id: myRun, client_id: mine.id, distance: 99, logged_for_date: addDays(START, 9) },
      // Somebody else's.
      { run_id: theirRun, client_id: theirs.id, distance: 40, logged_for_date: addDays(START, 2) },
    ];
    for (const run of runs) {
      const { error } = await supabase.from("run_logs").insert(run);
      if (error) throw new Error(error.message);
    }

    const built = await buildRollInput(supabase, new Date("2026-09-28T03:59:00Z"), {
      id: mine.id,
      slug: mine.slug,
      first_name: "Integration",
      last_name: "Fixture",
      timezone: "America/New_York",
    });

    expect(built!.input.completedMileage[1]).toBe(18);
  });

  it("hands over the keys already written, so a second run adds nothing", async () => {
    const client = await makeClient(supabase);
    await buildProgram(client.id);

    const instant = new Date("2026-09-28T03:59:00Z");
    const who = {
      id: client.id,
      slug: client.slug,
      first_name: "Integration",
      last_name: "Fixture",
      timezone: "America/New_York",
    };

    const first = await buildRollInput(supabase, instant, who);
    const firstPlan = planWeekRoll(first!.input, first!.lastRun);
    expect(firstPlan.writes.length).toBeGreaterThan(0);
    const applied = await applyPlan(supabase, client.id, firstPlan);
    expect(applied).toBe(firstPlan.writes.length);

    // Built again from the database, which now holds everything the first run
    // wrote. This is the whole point of reading the keys back.
    const second = await buildRollInput(supabase, instant, who);
    const secondPlan = planWeekRoll(second!.input, second!.lastRun);
    expect(secondPlan.writes).toEqual([]);
  });
});

describe("applyPlan", () => {
  it("writes the snapshot, the score, the forms and the card", async () => {
    const client = await makeClient(supabase);
    await buildProgram(client.id);

    const who = {
      id: client.id,
      slug: client.slug,
      first_name: "Integration",
      last_name: "Fixture",
      timezone: "America/New_York",
    };
    const built = await buildRollInput(supabase, new Date("2026-09-28T03:59:00Z"), who);
    const plan = planWeekRoll(built!.input, built!.lastRun);

    await applyPlan(supabase, client.id, plan);

    const { data: week } = await supabase
      .from("program_weeks")
      .select("snapshot, elvt_score, adherence")
      .eq("client_id", client.id)
      .eq("week_number", 1)
      .single();

    expect(week!.snapshot).not.toBeNull();
    expect(week!.elvt_score).not.toBeNull();

    // One form row per kind holds the questions; the submission rows carry the
    // dates. Both are made by the roll: nothing else creates them for a client
    // who has not been through the coach's Check-ins screen, and this used to
    // skip in silence.
    const { data: forms } = await supabase
      .from("checkin_forms")
      .select("id, kind")
      .eq("client_id", client.id);
    expect(forms!.map((form) => form.kind).sort()).toEqual(["daily", "weekly"]);

    const { data: submissions } = await supabase
      .from("checkin_submissions")
      .select("for_date, form_id")
      .eq("client_id", client.id);
    const dailyId = forms!.find((form) => form.kind === "daily")!.id;
    expect(submissions!.filter((row) => row.form_id === dailyId)).toHaveLength(7);
    expect(submissions!.filter((row) => row.form_id !== dailyId)).toHaveLength(1);

    const { data: queue } = await supabase
      .from("queue_items")
      .select("kind, detail")
      .eq("client_id", client.id);
    expect(queue!.some((item) => item.kind === "monday_review")).toBe(true);

    // The idempotency key travels in the detail blob and is what the next run
    // reads back.
    const card = queue!.find((item) => item.kind === "monday_review")!;
    expect((card.detail as { key?: string }).key).toBeTruthy();
  });

  it("does not overwrite a week that is already frozen", async () => {
    // Two schedulers racing: the second one gets past the plan check and has
    // to lose here rather than replacing the record.
    const client = await makeClient(supabase);
    await buildProgram(client.id);

    const who = {
      id: client.id,
      slug: client.slug,
      first_name: "Integration",
      last_name: "Fixture",
      timezone: "America/New_York",
    };
    const built = await buildRollInput(supabase, new Date("2026-09-28T03:59:00Z"), who);
    const plan = planWeekRoll(built!.input, built!.lastRun);

    await applyPlan(supabase, client.id, plan);
    const { data: first } = await supabase
      .from("program_weeks")
      .select("snapshot")
      .eq("client_id", client.id)
      .eq("week_number", 1)
      .single();

    // The same plan again, as a racing runner would.
    const snapshotWrite = plan.writes.find((write) => write.kind === "snapshot");
    await applyPlan(supabase, client.id, { ...plan, writes: [snapshotWrite!] });

    const { data: second } = await supabase
      .from("program_weeks")
      .select("snapshot")
      .eq("client_id", client.id)
      .eq("week_number", 1)
      .single();

    expect(second!.snapshot).toEqual(first!.snapshot);
  });
});
