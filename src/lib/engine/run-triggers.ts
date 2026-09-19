/**
 * The persistence half of the nightly job.
 *
 * planTriggers decides. This writes. Same split as the week roll, for the same
 * reason: the thresholds and the timezone are what can be wrong, and neither
 * needs a database to be proved.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, localDate } from "./clock";
import { planTriggers, type DayRow, type TriggerInput } from "./triggers";

export type NightlyResult = {
  clientId: string;
  slug: string;
  skipped: string | null;
  fired: number;
};

const WINDOW_DAYS = 14;

async function buildInput(
  supabase: SupabaseClient,
  instant: Date,
  client: { id: string; slug: string; first_name: string; last_name: string | null; timezone: string },
): Promise<TriggerInput | null> {
  if (!client.timezone) return null;

  const today = localDate(instant, client.timezone);
  const from = addDays(today, -(WINDOW_DAYS - 1));

  const [{ data: triggers }, { data: logs }, { data: meals }, { data: submissions }, { data: queue }, { data: events }] =
    await Promise.all([
      supabase
        .from("client_triggers")
        .select("key, threshold, suggested_message, active")
        .eq("client_id", client.id),
      supabase
        .from("daily_logs")
        .select("date, steps, sleep_hours, weight, session_status, updated_at")
        .eq("client_id", client.id)
        .gte("date", from)
        .lte("date", today),
      supabase
        .from("meal_logs")
        .select("date")
        .eq("client_id", client.id)
        .gte("date", from)
        .lte("date", today),
      supabase
        .from("checkin_submissions")
        .select("for_date, submitted_at")
        .eq("client_id", client.id)
        .gte("for_date", from)
        .lte("for_date", today),
      supabase
        .from("queue_items")
        .select("detail")
        .eq("client_id", client.id)
        .in("kind", ["trigger", "retention_risk"]),
      supabase
        .from("events")
        .select("payload")
        .eq("client_id", client.id)
        .eq("type", "triggers_evaluated")
        .order("at", { ascending: false })
        .limit(1),
    ]);

  const logByDate = new Map((logs ?? []).map((log) => [log.date, log]));
  const mealCount = new Map<string, number>();
  for (const meal of meals ?? []) {
    mealCount.set(meal.date, (mealCount.get(meal.date) ?? 0) + 1);
  }
  const checkinDates = new Set(
    (submissions ?? []).filter((row) => row.submitted_at).map((row) => row.for_date),
  );

  const days: DayRow[] = Array.from({ length: WINDOW_DAYS }, (_, offset) => {
    const date = addDays(from, offset);
    const log = logByDate.get(date);
    const mealsLogged = mealCount.get(date) ?? 0;
    const checkinSubmitted = checkinDates.has(date);

    return {
      date,
      steps: log?.steps ?? null,
      sleepHours: log?.sleep_hours === undefined || log?.sleep_hours === null ? null : Number(log.sleep_hours),
      weight: log?.weight === undefined || log?.weight === null ? null : Number(log.weight),
      sessionStatus: (log?.session_status ?? null) as DayRow["sessionStatus"],
      // Any of the three counts as opening the app. A client who logged a meal
      // and nothing else has not gone quiet.
      hadActivity: Boolean(log) || mealsLogged > 0 || checkinSubmitted,
      mealsLogged,
      checkinSubmitted,
    };
  });

  return {
    instant,
    client: {
      id: client.id,
      slug: client.slug,
      name: [client.first_name, client.last_name].filter(Boolean).join(" "),
      timezone: client.timezone,
    },
    triggers: (triggers ?? []).map((trigger) => ({
      key: trigger.key,
      threshold: Number(trigger.threshold ?? 0),
      suggestedMessage: trigger.suggested_message ?? "",
      active: trigger.active,
    })),
    days,
    existingQueueKeys: (queue ?? []).map(
      (row) => ((row.detail ?? {}) as { key?: string }).key ?? "",
    ),
    lastRunLocalDate:
      ((events ?? [])[0]?.payload as { localDate?: string } | undefined)?.localDate ?? null,
  };
}

export async function runNightly(
  supabase: SupabaseClient,
  instant: Date = new Date(),
): Promise<NightlyResult[]> {
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, slug, first_name, last_name, timezone")
    .eq("status", "active");

  if (error) throw new Error(`Could not read the roster: ${error.message}`);

  const results: NightlyResult[] = [];

  for (const client of clients ?? []) {
    const built = await buildInput(supabase, instant, client);

    if (!built) {
      results.push({
        clientId: client.id,
        slug: client.slug,
        // Never fall back to the server's clock. A trigger on the wrong clock
        // reaches half the roster at lunchtime and the rest at three am.
        skipped: "No timezone set, so there is no evening to run in.",
        fired: 0,
      });
      continue;
    }

    const plan = planTriggers(built);

    for (const item of plan.fired) {
      const { error: insertError } = await supabase.from("queue_items").insert({
        client_id: client.id,
        kind: item.kind,
        severity: item.severity,
        title: item.title,
        detail: { ...item.detail, key: item.key },
        suggested_action: { message: item.suggestedMessage },
      });
      if (insertError) throw new Error(`Queue item for ${client.slug}: ${insertError.message}`);
    }

    if (plan.localDate) {
      // Written whether or not anything fired, because it is what stops the job
      // running twice on the same evening.
      await supabase.from("events").insert({
        type: "triggers_evaluated",
        client_id: client.id,
        payload: { localDate: plan.localDate, fired: plan.fired.length },
      });

      for (const item of plan.fired) {
        const key = item.key.split(":")[0];
        await supabase
          .from("client_triggers")
          .update({ last_fired_at: instant.toISOString() })
          .eq("client_id", client.id)
          .eq("key", key);
      }
    }

    results.push({
      clientId: client.id,
      slug: client.slug,
      skipped: plan.skipped,
      fired: plan.fired.length,
    });
  }

  return results;
}
