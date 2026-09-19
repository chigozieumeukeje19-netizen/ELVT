import type { SupabaseClient } from "@supabase/supabase-js";
import { localDate } from "@/lib/engine/clock";
import { planReminders, type ReminderKind, type ReminderSetting } from "./plan";

/**
 * The reminder dispatcher, without the process around it.
 *
 * Lifted out of scripts/dispatch-reminders.ts for the same reason as the
 * message one: the planner had tests and the half that reads what has already
 * gone out and what the client has already done had none, and that half is
 * where a silent duplicate or a silent nag comes from.
 */

export type ReminderLine = {
  clientId: string;
  slug: string;
  /** Null when something was sent. */
  skipped: string | null;
  dispatches: number;
  kinds: ReminderKind[];
};

export type ReminderResult = {
  at: string;
  sent: number;
  lines: ReminderLine[];
};

export async function dispatchReminders(
  supabase: SupabaseClient,
  at: Date,
): Promise<ReminderResult> {
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, slug, timezone, communication_prefs")
    .eq("status", "active");

  if (error) throw new Error(`Could not read the roster: ${error.message}`);

  const lines: ReminderLine[] = [];
  let sent = 0;

  for (const client of clients ?? []) {
    const line: ReminderLine = {
      clientId: client.id,
      slug: client.slug,
      skipped: null,
      dispatches: 0,
      kinds: [],
    };

    if (!client.timezone) {
      // Never fall back to the server's clock. A reminder on the wrong clock
      // reaches half the roster at lunchtime and the rest at three am.
      line.skipped = "No timezone set, so there is no morning to send into.";
      lines.push(line);
      continue;
    }

    const prefs = (client.communication_prefs ?? {}) as { reminders?: ReminderSetting[] };
    const settings = prefs.reminders ?? [];
    if (settings.length === 0) {
      line.skipped = "No reminders set up.";
      lines.push(line);
      continue;
    }

    const today = localDate(at, client.timezone);

    // What has already gone today, so nothing repeats however often this runs.
    //
    // Matched on the local date inside the marker, not on the row's timestamp.
    // The old filter compared a client's local date against a UTC column, which
    // is wrong at both ends of a day: for a client in New York it swept in
    // everything sent after 8pm the previous evening, and for one in Kolkata it
    // missed everything sent before 5:30am, so their morning reminders would go
    // out a second time. The marker already carries the local date it belongs
    // to, and that is the thing to match.
    const { data: already } = await supabase
      .from("events")
      .select("payload")
      .eq("client_id", client.id)
      .eq("type", "reminder_sent")
      .eq("payload->>localDate", today);

    const alreadySent = (already ?? []).flatMap(
      (row) => ((row.payload ?? {}) as { kinds?: ReminderKind[] }).kinds ?? [],
    );

    // What they have already done, so nothing nags.
    const { data: log } = await supabase
      .from("daily_logs")
      .select("steps, water, weight, session_status")
      .eq("client_id", client.id)
      .eq("date", today)
      .maybeSingle();

    const alreadyDone: ReminderKind[] = [];
    if (log?.steps) alreadyDone.push("steps");
    if (log?.water) alreadyDone.push("water");
    if (log?.weight) alreadyDone.push("weigh_in");
    if (log?.session_status && log.session_status !== "no") alreadyDone.push("workout");

    const plan = planReminders({
      instant: at,
      timezone: client.timezone,
      settings,
      alreadyDone,
      alreadySent,
    });

    for (const dispatch of plan.dispatches) {
      const { error: insertError } = await supabase.from("events").insert({
        type: "reminder_sent",
        client_id: client.id,
        // Stamped with the instant this run is for, not with the wall clock.
        // events.at defaults to now(), so a run for any instant but this one
        // wrote a marker dated today and the next tick could not see it. The
        // dispatcher takes an instant precisely so it can be run for one.
        at: at.toISOString(),
        payload: { kinds: dispatch.kinds, body: dispatch.body, localDate: today },
      });

      if (insertError) {
        line.skipped = insertError.message;
        continue;
      }

      line.dispatches += 1;
      line.kinds.push(...dispatch.kinds);
      sent += 1;
    }

    lines.push(line);
  }

  return { at: at.toISOString(), sent, lines };
}
