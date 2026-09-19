/**
 * The reminder dispatcher.
 *
 * Ticks every few minutes, works out what is due for each client on their own
 * clock, and sends it. Anything inside an hour goes as one digest, so a tick
 * that has been down all morning catches up without five separate pings.
 */

import { createClient } from "@supabase/supabase-js";
import { localDate } from "../src/lib/engine/clock";
import { planReminders, type ReminderKind, type ReminderSetting } from "../src/lib/reminders/plan";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`\n${name} is not set, so the dispatcher cannot run.\n`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const supabase = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const at = process.env.REMINDERS_AT ? new Date(process.env.REMINDERS_AT) : new Date();

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, slug, timezone, communication_prefs")
    .eq("status", "active");

  if (error) {
    console.error(`\nCould not read the roster: ${error.message}\n`);
    process.exit(1);
  }

  console.log(`Reminders at ${at.toISOString()}`);
  let sent = 0;

  for (const client of clients ?? []) {
    if (!client.timezone) {
      console.log(`  ${client.slug.padEnd(20)} no timezone, so there is no morning to send into`);
      continue;
    }

    const prefs = (client.communication_prefs ?? {}) as { reminders?: ReminderSetting[] };
    const settings = prefs.reminders ?? [];
    if (settings.length === 0) {
      console.log(`  ${client.slug.padEnd(20)} no reminders set up`);
      continue;
    }

    const today = localDate(at, client.timezone);

    // What has already gone today, so nothing repeats however often this runs.
    const { data: already } = await supabase
      .from("events")
      .select("payload")
      .eq("client_id", client.id)
      .eq("type", "reminder_sent")
      .gte("at", `${today}T00:00:00Z`);

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
        payload: { kinds: dispatch.kinds, body: dispatch.body, localDate: today },
      });

      if (insertError) {
        console.error(`  ${client.slug} failed: ${insertError.message}`);
        continue;
      }
      sent += 1;
    }

    console.log(
      `  ${client.slug.padEnd(20)} ${plan.local.hour}:${String(plan.local.minute).padStart(2, "0")} local, ${
        plan.dispatches.length
      } sent covering ${plan.dispatches.flatMap((d) => d.kinds).length} reminders`,
    );
  }

  console.log(`  ${sent} dispatches in total`);
}

main().catch((error) => {
  console.error(`\nThe dispatcher failed: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
