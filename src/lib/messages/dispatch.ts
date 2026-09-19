import type { SupabaseClient } from "@supabase/supabase-js";
import { decideSends, type ScheduledMessage } from "./schedule";

/**
 * The scheduled message dispatcher, without the process around it.
 *
 * Lifted out of scripts/dispatch-messages.ts so there is something to point a
 * test at. The script was the only caller and the only definition, which meant
 * the half that reads and writes rows had no test at all: the planner was
 * covered and the queries were not.
 *
 * The planner decides; this reads the rows in and writes the results back.
 */

export type DispatchLine = {
  id: string;
  sent: boolean;
  /** Why it was held, when it was. */
  reason: string | null;
};

export type DispatchResult = {
  at: string;
  pending: number;
  sent: number;
  lines: DispatchLine[];
};

export async function dispatchMessages(
  supabase: SupabaseClient,
  at: Date,
): Promise<DispatchResult> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, client_id, scheduled_for, sent_at, clients(timezone)")
    .not("scheduled_for", "is", null)
    .is("sent_at", null);

  if (error) throw new Error(`Could not read the queue: ${error.message}`);

  const pending: ScheduledMessage[] = (data ?? []).map((row) => {
    // PostgREST returns an embedded one-to-one as an object and a one-to-many
    // as an array, and which one it picks depends on the foreign keys it can
    // see. Both shapes are handled rather than assumed.
    const embedded = row.clients as { timezone: string } | { timezone: string }[] | null;
    const client = Array.isArray(embedded) ? embedded[0] : embedded;
    return {
      id: row.id,
      clientId: row.client_id,
      timezone: client?.timezone ?? "UTC",
      scheduledFor: row.scheduled_for as string,
      sentAt: row.sent_at,
    };
  });

  const decisions = decideSends(pending, at);
  const lines: DispatchLine[] = [];
  let sent = 0;

  for (const decision of decisions) {
    if (!decision.send) {
      lines.push({ id: decision.id, sent: false, reason: decision.reason });
      continue;
    }

    const message = pending.find((candidate) => candidate.id === decision.id)!;

    const { data: updated, error: sendError } = await supabase
      .from("messages")
      .update({ sent_at: at.toISOString(), touchpoint: true })
      .eq("id", decision.id)
      // Only while it is still unsent, so two dispatchers send once.
      .is("sent_at", null)
      // And the rows it actually changed, which is the part that was missing.
      // An update matching nothing is not an error, so the loser of a race
      // between two overlapping ticks saw no error and went on to record a
      // touchpoint for a message it had not sent. Touchpoints are what the
      // roster's retention column counts, so that inflated the one number the
      // coach uses to decide who to contact next.
      .select("id");

    if (sendError) {
      lines.push({ id: decision.id, sent: false, reason: sendError.message });
      continue;
    }

    if (!updated || updated.length === 0) {
      lines.push({ id: decision.id, sent: false, reason: "Another dispatcher sent it first." });
      continue;
    }

    await supabase.from("touchpoints").insert({
      client_id: message.clientId,
      kind: "message",
      ref_id: decision.id,
    });

    lines.push({ id: decision.id, sent: true, reason: null });
    sent += 1;
  }

  return { at: at.toISOString(), pending: pending.length, sent, lines };
}
