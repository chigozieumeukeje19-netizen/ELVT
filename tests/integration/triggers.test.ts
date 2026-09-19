import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTriggerInput, runNightly } from "@/lib/engine/run-triggers";
import { assertRestIsLive, cleanup, makeClient, serviceClient } from "./harness";

/**
 * buildTriggerInput, against real rows.
 *
 * The fourteen day window is assembled here out of five tables, and a day that
 * exists in none of them still has to appear in the array as a day with
 * nothing on it. That is what the retention checks count: gaps, not rows. A
 * builder that returned only the days it found rows for would report a client
 * who logged nothing for a week as having no missed days at all.
 */

let supabase: SupabaseClient;

/** 21:05 in New York on 2026-09-28. */
const INSTANT = new Date("2026-09-29T01:05:00Z");
const TODAY = "2026-09-28";

function who(client: { id: string; slug: string }) {
  return {
    id: client.id,
    slug: client.slug,
    first_name: "Integration",
    last_name: "Fixture",
    timezone: "America/New_York",
  };
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

describe("buildTriggerInput", () => {
  it("refuses a client with no timezone rather than using the server's", async () => {
    // A trigger on the wrong clock reaches half the roster at lunchtime and
    // the rest at three in the morning.
    //
    // The row cannot actually be in that state: clients.timezone is NOT NULL,
    // so this guard is defensive against something the schema forbids. It is
    // still asserted, because the guard is on the argument rather than on the
    // row and nothing stops a caller assembling one by hand.
    const client = await makeClient(supabase);
    expect(await buildTriggerInput(supabase, INSTANT, { ...who(client), timezone: "" })).toBeNull();
  });

  it("returns fourteen days, including the ones with nothing in any table", async () => {
    const client = await makeClient(supabase);
    const { error } = await supabase.from("daily_logs").insert({
      client_id: client.id,
      date: TODAY,
      steps: 9000,
    });
    if (error) throw new Error(error.message);

    const input = await buildTriggerInput(supabase, INSTANT, who(client));

    expect(input!.days).toHaveLength(14);
    expect(input!.days[0].date).toBe(addDays(TODAY, -13));
    expect(input!.days[13].date).toBe(TODAY);
    // The thirteen days with no row are days with nothing on them, not days
    // that are missing from the array.
    expect(input!.days.filter((day) => day.hadActivity)).toHaveLength(1);
  });

  it("counts a meal log as activity even with no daily log", async () => {
    // A client who logged lunch and nothing else has not gone quiet, and the
    // 72 hour retention check is the thing that would have messaged them.
    const client = await makeClient(supabase);
    const { error } = await supabase.from("meal_logs").insert({
      client_id: client.id,
      date: TODAY,
      custom: { name: "Lunch", calories: 600 },
      source: "custom",
    });
    if (error) throw new Error(error.message);

    const input = await buildTriggerInput(supabase, INSTANT, who(client));
    const today = input!.days.find((day) => day.date === TODAY)!;

    expect(today.hadActivity).toBe(true);
    expect(today.mealsLogged).toBe(1);
  });

  it("counts only a submitted check-in, not one that was merely created", async () => {
    const client = await makeClient(supabase);

    const { data: form, error: formError } = await supabase
      .from("checkin_forms")
      .insert({ client_id: client.id, kind: "daily", questions: ["daily_sleep"] })
      .select("id")
      .single();
    if (formError) throw new Error(formError.message);

    await supabase.from("checkin_submissions").insert([
      { form_id: form!.id, client_id: client.id, for_date: TODAY, submitted_at: new Date().toISOString() },
      { form_id: form!.id, client_id: client.id, for_date: addDays(TODAY, -1), submitted_at: null },
    ]);

    const input = await buildTriggerInput(supabase, INSTANT, who(client));

    expect(input!.days.find((day) => day.date === TODAY)!.checkinSubmitted).toBe(true);
    expect(input!.days.find((day) => day.date === addDays(TODAY, -1))!.checkinSubmitted).toBe(false);
  });

  it("reads the client's own thresholds, and nobody else's", async () => {
    const mine = await makeClient(supabase);
    const theirs = await makeClient(supabase);

    await supabase.from("client_triggers").insert([
      { client_id: mine.id, key: "steps_low", threshold: 5600, suggested_message: "Mine", active: true },
      { client_id: theirs.id, key: "steps_low", threshold: 12000, suggested_message: "Theirs", active: true },
    ]);

    const input = await buildTriggerInput(supabase, INSTANT, who(mine));

    expect(input!.triggers).toHaveLength(1);
    expect(input!.triggers[0].threshold).toBe(5600);
    // Numeric, not the string a numeric column comes back as.
    expect(typeof input!.triggers[0].threshold).toBe("number");
  });

  it("hands over the keys already in the queue, so nothing fires twice", async () => {
    const client = await makeClient(supabase);
    await supabase.from("queue_items").insert({
      client_id: client.id,
      kind: "trigger",
      severity: 3,
      title: "Steps under",
      detail: { key: `steps_low:${client.id}:${TODAY}` },
    });

    const input = await buildTriggerInput(supabase, INSTANT, who(client));
    expect(input!.existingQueueKeys).toContain(`steps_low:${client.id}:${TODAY}`);
  });

  it("reads the last run off the events table", async () => {
    const client = await makeClient(supabase);
    await supabase.from("events").insert({
      type: "triggers_evaluated",
      client_id: client.id,
      payload: { localDate: "2026-09-27", fired: 0 },
    });

    const input = await buildTriggerInput(supabase, INSTANT, who(client));
    expect(input!.lastRunLocalDate).toBe("2026-09-27");
  });
});

describe("runNightly", () => {
  it("writes the fired trigger, its message, and the run marker", async () => {
    const client = await makeClient(supabase);

    await supabase.from("client_triggers").insert({
      client_id: client.id,
      key: "steps_low",
      threshold: 6000,
      suggested_message: "Two quiet days on steps. What does tomorrow look like?",
      active: true,
    });

    // Two days running under the threshold, which is the consecutive rule.
    for (let offset = 13; offset >= 0; offset -= 1) {
      const date = addDays(TODAY, -offset);
      const short = date === TODAY || date === addDays(TODAY, -1);
      await supabase.from("daily_logs").insert({
        client_id: client.id,
        date,
        steps: short ? 2800 : 9000,
        sleep_hours: 7,
        session_status: "done",
      });
    }

    const results = await runNightly(supabase, INSTANT);
    const mine = results.find((result) => result.clientId === client.id)!;
    expect(mine.skipped).toBeNull();
    expect(mine.fired).toBeGreaterThan(0);

    const { data: queue } = await supabase
      .from("queue_items")
      .select("kind, suggested_action, detail")
      .eq("client_id", client.id);

    // The step trigger, plus the retention check for a client who has sent no
    // check-in all fortnight. Both are correct, so the assertion names the one
    // it is about rather than taking whichever row came back first.
    const keys = queue!.map((item) => (item.detail as { key?: string }).key ?? "");
    expect(keys.some((key) => key.startsWith("steps_low:"))).toBe(true);
    expect(keys.every((key) => key.includes(client.id))).toBe(true);

    const steps = queue!.find((item) =>
      ((item.detail as { key?: string }).key ?? "").startsWith("steps_low:"),
    )!;
    expect((steps.suggested_action as { message?: string }).message).toContain("steps");
    expect(steps.kind).toBe("trigger");
    expect(queue!.some((item) => item.kind === "retention_risk")).toBe(true);

    const { data: events } = await supabase
      .from("events")
      .select("payload")
      .eq("client_id", client.id)
      .eq("type", "triggers_evaluated");
    expect((events![0].payload as { localDate?: string }).localDate).toBe(TODAY);
  });

  it("adds nothing on a second run of the same evening", async () => {
    // The marker written above is what stops it, and this is the only test
    // that proves the marker is read back out of the database rather than
    // remembered in the process.
    const before = await countQueue();
    await runNightly(supabase, new Date("2026-09-29T01:40:00Z"));
    expect(await countQueue()).toBe(before);
  });
});

async function countQueue(): Promise<number> {
  const { count } = await supabase
    .from("queue_items")
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}
