import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dispatchMessages } from "@/lib/messages/dispatch";
import { dispatchReminders } from "@/lib/reminders/dispatch";
import { assertRestIsLive, cleanup, makeClient, serviceClient } from "./harness";

/**
 * Both dispatchers, against real rows.
 *
 * These are the two jobs whose failure mode nobody sees: a message that
 * silently does not send, or one that sends twice at six in the morning. The
 * planners are pure and tested. What had nothing was the half that reads what
 * is pending, writes the sent marker, and reads back what has already gone out
 * today, and that is where both of those failures live.
 */

let supabase: SupabaseClient;

async function makeThread(clientId: string): Promise<string> {
  const { data, error } = await supabase
    .from("threads")
    .insert({ client_id: clientId, subject: "Integration" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data!.id;
}

async function schedule(
  clientId: string,
  threadId: string,
  scheduledFor: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      thread_id: threadId,
      client_id: clientId,
      kind: "text",
      body: "How did the walk go?",
      scheduled_for: scheduledFor,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data!.id;
}

beforeAll(async () => {
  supabase = await serviceClient();
  await assertRestIsLive(supabase);
});

afterAll(async () => {
  await cleanup(supabase);
});

describe("dispatchMessages", () => {
  it("sends the one that is due and leaves the one that is not", async () => {
    const client = await makeClient(supabase);
    const thread = await makeThread(client.id);

    const due = await schedule(client.id, thread, "2026-10-05T13:00:00Z");
    const later = await schedule(client.id, thread, "2026-10-06T13:00:00Z");

    const result = await dispatchMessages(supabase, new Date("2026-10-05T13:05:00Z"));

    expect(result.lines.find((line) => line.id === due)!.sent).toBe(true);
    expect(result.lines.find((line) => line.id === later)!.sent).toBe(false);

    const { data: rows } = await supabase
      .from("messages")
      .select("id, sent_at, touchpoint")
      .in("id", [due, later]);

    expect(rows!.find((row) => row.id === due)!.sent_at).not.toBeNull();
    expect(rows!.find((row) => row.id === due)!.touchpoint).toBe(true);
    expect(rows!.find((row) => row.id === later)!.sent_at).toBeNull();
  });

  it("records the touchpoint, because that is what the roster counts", async () => {
    const client = await makeClient(supabase);
    const thread = await makeThread(client.id);
    const id = await schedule(client.id, thread, "2026-10-05T13:00:00Z");

    await dispatchMessages(supabase, new Date("2026-10-05T13:05:00Z"));

    const { data: touchpoints } = await supabase
      .from("touchpoints")
      .select("kind, ref_id")
      .eq("client_id", client.id);

    expect(touchpoints).toHaveLength(1);
    expect(touchpoints![0].kind).toBe("message");
    expect(touchpoints![0].ref_id).toBe(id);
  });

  it("holds one that is hours late rather than waking them with it", async () => {
    // A nudge about yesterday, delivered at three in the morning, is worse
    // than one that never arrives.
    const client = await makeClient(supabase);
    const thread = await makeThread(client.id);
    const id = await schedule(client.id, thread, "2026-10-04T13:00:00Z");

    const result = await dispatchMessages(supabase, new Date("2026-10-05T13:05:00Z"));
    const line = result.lines.find((entry) => entry.id === id)!;

    expect(line.sent).toBe(false);
    expect(line.reason).toBeTruthy();

    const { data: row } = await supabase.from("messages").select("sent_at").eq("id", id).single();
    expect(row!.sent_at).toBeNull();
  });

  it("sends once when two dispatchers run over the same row", async () => {
    // The update is guarded on sent_at still being null, which is the only
    // thing standing between a tick that overlaps and a client getting the
    // same message twice.
    const client = await makeClient(supabase);
    const thread = await makeThread(client.id);
    const id = await schedule(client.id, thread, "2026-10-05T13:00:00Z");

    // Five at once, so several of them certainly read the row as pending
    // before any of them writes. Running two in sequence proves nothing: the
    // second does not see the row at all, because the query already asks for
    // unsent rows. Only an overlap exercises the guard, and two overlapping
    // runs can still interleave benignly.
    const at = new Date("2026-10-05T13:05:00Z");
    const runs = await Promise.all(
      Array.from({ length: 5 }, () => dispatchMessages(supabase, at)),
    );

    // The invariant that matters: one message, one touchpoint, however many
    // ticks overlapped.
    // Whichever way they interleave, exactly one reports sending it. How many
    // of them saw it pending is up to the scheduler, so it is not asserted:
    // the test below injects the overlap deterministically instead.
    const reported = runs.flatMap((result) => result.lines.filter((line) => line.id === id));
    expect(reported.filter((line) => line.sent)).toHaveLength(1);

    // One of them wins the update; the other finds nothing to change and does
    // not record a second touchpoint.
    const { count } = await supabase
      .from("touchpoints")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id);
    expect(count).toBe(1);
  });

  it("records no touchpoint when another dispatcher got there first", async () => {
    // The overlap, injected rather than raced for. The client below sends the
    // row on its way to the guarded update, which is exactly the window a
    // second tick opens in production: read it as pending, and by the time the
    // write lands somebody else has sent it.
    //
    // This is the only stand-in in these tests, and it models the real race
    // without loosening anything: the update it wraps is the real one, against
    // the real row, and the row really has been sent by the time it runs.
    const client = await makeClient(supabase);
    const thread = await makeThread(client.id);
    const id = await schedule(client.id, thread, "2026-10-05T13:00:00Z");

    let intercepted = false;
    const raced = await serviceClient({
      async beforeFetch(url, init) {
        if (intercepted || init?.method !== "PATCH" || !url.includes("/messages")) return;
        intercepted = true;
        await supabase
          .from("messages")
          .update({ sent_at: "2026-10-05T13:04:00Z", touchpoint: true })
          .eq("id", id);
      },
    });

    const result = await dispatchMessages(raced, new Date("2026-10-05T13:05:00Z"));
    expect(intercepted).toBe(true);

    const line = result.lines.find((entry) => entry.id === id)!;
    expect(line.sent).toBe(false);
    expect(line.reason).toContain("first");

    const { count } = await supabase
      .from("touchpoints")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id);
    expect(count).toBe(0);
  });

  it("changes nothing on a row another dispatcher has already sent", async () => {
    // The mechanism behind the test above, on its own, so it is proved rather
    // than left to an interleaving. An update that matches no rows is not an
    // error, which is how the loser of a race came to record a touchpoint for
    // a message it had not sent.
    const client = await makeClient(supabase);
    const thread = await makeThread(client.id);
    const id = await schedule(client.id, thread, "2026-10-05T13:00:00Z");

    await dispatchMessages(supabase, new Date("2026-10-05T13:05:00Z"));

    const { data, error } = await supabase
      .from("messages")
      .update({ sent_at: new Date().toISOString(), touchpoint: true })
      .eq("id", id)
      .is("sent_at", null)
      .select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("never picks up a message that was never scheduled", async () => {
    const client = await makeClient(supabase);
    const thread = await makeThread(client.id);
    const { data } = await supabase
      .from("messages")
      .insert({ thread_id: thread, client_id: client.id, kind: "text", body: "Sent by hand" })
      .select("id")
      .single();

    const result = await dispatchMessages(supabase, new Date("2026-10-05T13:05:00Z"));
    expect(result.lines.some((line) => line.id === data!.id)).toBe(false);
  });
});

describe("dispatchReminders", () => {
  /** 07:05 in New York on 2026-10-05. */
  const MORNING = new Date("2026-10-05T11:05:00Z");

  async function withReminders(overrides: Record<string, unknown> = {}) {
    return makeClient(supabase, {
      communication_prefs: {
        reminders: [
          { kind: "morning_plan", time: "07:00", enabled: true, days: [] },
          { kind: "steps", time: "07:00", enabled: true, days: [] },
        ],
      },
      ...overrides,
    });
  }

  it("says why it sent nothing rather than saying nothing", async () => {
    const client = await makeClient(supabase);
    const result = await dispatchReminders(supabase, MORNING);
    const line = result.lines.find((entry) => entry.clientId === client.id)!;

    expect(line.dispatches).toBe(0);
    expect(line.skipped).toBe("No reminders set up.");
  });

  it("sends the morning digest and records what was in it", async () => {
    const client = await withReminders();
    const result = await dispatchReminders(supabase, MORNING);
    const line = result.lines.find((entry) => entry.clientId === client.id)!;

    expect(line.skipped).toBeNull();
    expect(line.dispatches).toBe(1);
    expect(line.kinds.sort()).toEqual(["morning_plan", "steps"]);

    const { data: events } = await supabase
      .from("events")
      .select("payload")
      .eq("client_id", client.id)
      .eq("type", "reminder_sent");

    expect(events).toHaveLength(1);
    const payload = events![0].payload as { kinds?: string[]; localDate?: string };
    expect(payload.localDate).toBe("2026-10-05");
    expect(payload.kinds!.sort()).toEqual(["morning_plan", "steps"]);
  });

  it("does not send the same reminder twice in one day", async () => {
    // Read back out of the events table, not remembered in the process. A tick
    // every few minutes means this is the only thing stopping five pings.
    const client = await withReminders();

    await dispatchReminders(supabase, MORNING);
    const second = await dispatchReminders(supabase, new Date("2026-10-05T11:20:00Z"));
    const line = second.lines.find((entry) => entry.clientId === client.id)!;

    expect(line.dispatches).toBe(0);

    const { count } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("type", "reminder_sent");
    expect(count).toBe(1);
  });

  it("does not nag about something they have already done", async () => {
    const client = await withReminders();
    const { error } = await supabase.from("daily_logs").insert({
      client_id: client.id,
      date: "2026-10-05",
      steps: 9400,
    });
    if (error) throw new Error(error.message);

    const result = await dispatchReminders(supabase, MORNING);
    const line = result.lines.find((entry) => entry.clientId === client.id)!;

    expect(line.kinds).not.toContain("steps");
    expect(line.kinds).toContain("morning_plan");
  });

  it("reads each client's own day, on each client's own clock", async () => {
    // 20:00 UTC is 16:00 on the 5th in New York and 01:30 on the 6th in
    // Kolkata. A 07:00 reminder has come round for one of them and has not
    // happened yet for the other, and they are not even on the same date.
    const newYork = await withReminders();
    const kolkata = await withReminders({ timezone: "Asia/Kolkata" });

    const evening = new Date("2026-10-05T20:00:00Z");
    const result = await dispatchReminders(supabase, evening);

    expect(result.lines.find((line) => line.clientId === newYork.id)!.dispatches).toBe(1);
    expect(result.lines.find((line) => line.clientId === kolkata.id)!.dispatches).toBe(0);

    const { data: marker } = await supabase
      .from("events")
      .select("payload")
      .eq("client_id", newYork.id)
      .eq("type", "reminder_sent")
      .single();
    expect((marker!.payload as { localDate?: string }).localDate).toBe("2026-10-05");
  });

  it("stamps the marker with the instant the run is for", async () => {
    // events.at defaults to now(), so a run for any instant but this one wrote
    // a row dated today. The dispatcher takes an instant precisely so it can
    // be run for one, and anything reading these rows in order needs them to
    // agree with the local date in the payload.
    const client = await withReminders();
    const at = new Date("2026-10-05T11:05:00Z");
    await dispatchReminders(supabase, at);

    const { data } = await supabase
      .from("events")
      .select("at")
      .eq("client_id", client.id)
      .eq("type", "reminder_sent")
      .single();

    expect(new Date(data!.at as string).toISOString()).toBe(at.toISOString());
  });

  it("does not repeat a reminder whose local date is ahead of the server's", async () => {
    // 03:00 on the 6th in Kolkata is 21:30 on the 5th in UTC. Matching the
    // marker on the row's UTC timestamp against the client's local date put
    // those two on different days, so the marker was invisible and the
    // reminder went out again on the next tick.
    const client = await makeClient(supabase, {
      timezone: "Asia/Kolkata",
      communication_prefs: {
        reminders: [{ kind: "morning_plan", time: "02:00", enabled: true, days: [] }],
      },
    });

    const first = await dispatchReminders(supabase, new Date("2026-10-05T21:30:00Z"));
    expect(first.lines.find((line) => line.clientId === client.id)!.dispatches).toBe(1);

    const second = await dispatchReminders(supabase, new Date("2026-10-05T21:45:00Z"));
    expect(second.lines.find((line) => line.clientId === client.id)!.dispatches).toBe(0);

    const { count } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("type", "reminder_sent");
    expect(count).toBe(1);
  });

  it("keeps the marker on the client's local date, not on the server's", async () => {
    // A client just past midnight in Kolkata is on tomorrow's date while the
    // server is still on yesterday's. Matching the marker on the row's UTC
    // timestamp put those two on different days, and their morning reminders
    // went out twice.
    const client = await withReminders({ timezone: "Asia/Kolkata" });

    // 03:00 on the 6th in Kolkata, which is 21:30 on the 5th in UTC.
    const past = new Date("2026-10-05T21:30:00Z");
    const earlier = await dispatchReminders(supabase, past);
    expect(earlier.lines.find((line) => line.clientId === client.id)!.dispatches).toBe(0);

    // 08:00 on the 6th in Kolkata.
    const morning = new Date("2026-10-06T02:30:00Z");
    const first = await dispatchReminders(supabase, morning);
    expect(first.lines.find((line) => line.clientId === client.id)!.dispatches).toBe(1);

    const second = await dispatchReminders(supabase, new Date("2026-10-06T02:45:00Z"));
    expect(second.lines.find((line) => line.clientId === client.id)!.dispatches).toBe(0);
  });

  it("leaves a paused client alone", async () => {
    const client = await withReminders({ status: "paused" });
    const result = await dispatchReminders(supabase, MORNING);
    expect(result.lines.some((line) => line.clientId === client.id)).toBe(false);
  });
});
