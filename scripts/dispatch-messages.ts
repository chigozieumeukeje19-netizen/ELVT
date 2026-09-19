/**
 * The scheduled message dispatcher.
 *
 * Ticks every few minutes and sends whatever has come due. A message more than
 * a few hours late is left unsent rather than waking a client in the middle of
 * their night with yesterday's nudge.
 */

import { createClient } from "@supabase/supabase-js";
import { decideSends, type ScheduledMessage } from "../src/lib/messages/schedule";

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

  const at = process.env.DISPATCH_AT ? new Date(process.env.DISPATCH_AT) : new Date();

  const { data, error } = await supabase
    .from("messages")
    .select("id, client_id, scheduled_for, sent_at, clients(timezone)")
    .not("scheduled_for", "is", null)
    .is("sent_at", null);

  if (error) {
    console.error(`\nCould not read the queue: ${error.message}\n`);
    process.exit(1);
  }

  const pending: ScheduledMessage[] = (data ?? []).map((row) => {
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
  let sent = 0;

  for (const decision of decisions) {
    if (!decision.send) continue;

    const message = pending.find((candidate) => candidate.id === decision.id)!;

    const { error: sendError } = await supabase
      .from("messages")
      .update({ sent_at: at.toISOString(), touchpoint: true })
      .eq("id", decision.id)
      // Only while it is still unsent, so two dispatchers send once.
      .is("sent_at", null);

    if (sendError) {
      console.error(`  ${decision.id} failed: ${sendError.message}`);
      continue;
    }

    await supabase.from("touchpoints").insert({
      client_id: message.clientId,
      kind: "message",
      ref_id: decision.id,
    });

    sent += 1;
  }

  console.log(`Dispatch at ${at.toISOString()}`);
  console.log(`  ${pending.length} scheduled, ${sent} sent`);

  for (const decision of decisions.filter((candidate) => !candidate.send)) {
    console.log(`  ${decision.id} held: ${decision.reason}`);
  }
}

main().catch((error) => {
  console.error(`\nThe dispatcher failed: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
