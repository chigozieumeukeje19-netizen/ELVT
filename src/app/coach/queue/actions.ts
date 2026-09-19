"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentProfile, isStaff } from "@/lib/auth";
import { applyDecisions, type ProposedChange } from "@/lib/queue/review-card";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Accept All.
 *
 * The one button on this screen that writes, and it writes five things at
 * once: next week's values, the week's published state, the message, a
 * plan_changes row per accepted line, and the event. All of them or none: a
 * half applied review leaves the client with a plan that does not match the
 * message they just read.
 *
 * Supabase has no interactive transaction over PostgREST, so ordering carries
 * the weight instead. The plan is written first and the message last, because a
 * client who gets a plan and no message is behind on information, while a
 * client who gets a message about a plan that did not change is being lied to.
 */

function fail(message: string): never {
  redirect(`/coach/queue?error=${encodeURIComponent(message)}`);
}

const decisionSchema = z.object({
  cardId: z.string().uuid(),
  weekNumber: z.coerce.number().int().min(1),
  intent: z.string().optional(),
  decisions: z.string().default("[]"),
  message: z.string().default(""),
});

/** What the plan_changes.field names map to on program_weeks. */
const FIELD_COLUMN: Record<string, string> = {
  calories: "calories",
  protein: "protein",
  carbs: "carbs",
  fat: "fat",
  planned_mileage: "planned_mileage",
};

export async function acceptAllAction(formData: FormData) {
  const parsed = decisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("That review could not be read.");

  const profile = await currentProfile();
  if (!profile || !isStaff(profile.role)) fail("Not allowed.");

  const { cardId: clientId, weekNumber, intent, message } = parsed.data;
  const supabase = await supabaseServer();

  // Nothing this week is a real answer and is recorded as one, so the queue
  // does not put the card back tomorrow.
  if (intent === "skip") {
    await supabase
      .from("queue_items")
      .update({ status: "dismissed" })
      .eq("client_id", clientId)
      .eq("kind", "monday_review")
      .eq("status", "open");

    await supabase.from("events").insert({
      type: "week_reviewed",
      client_id: clientId,
      payload: { weekNumber, changes: 0, skipped: true },
    });

    revalidatePath("/coach/queue");
    return;
  }

  let changes: ProposedChange[];
  try {
    changes = JSON.parse(parsed.data.decisions) as ProposedChange[];
  } catch {
    fail("Those decisions could not be read.");
  }

  const applied = applyDecisions(changes);

  const { data: nextWeek } = await supabase
    .from("program_weeks")
    .select("id, program_id")
    .eq("client_id", clientId)
    .eq("week_number", weekNumber + 1)
    .maybeSingle();

  if (!nextWeek && applied.length > 0) {
    fail(`There is no week ${weekNumber + 1} to write these changes onto.`);
  }

  // 1. The plan. First, because everything after it describes it.
  if (nextWeek && applied.length > 0) {
    const update: Record<string, unknown> = {};
    for (const change of applied) {
      const column = FIELD_COLUMN[change.field];
      if (!column) continue;
      const value = Number(change.to);
      if (Number.isFinite(value)) update[column] = value;
    }

    if (Object.keys(update).length > 0) {
      update.calorie_status = "confirmed";
      const { error } = await supabase
        .from("program_weeks")
        .update(update)
        .eq("id", nextWeek.id);
      if (error) fail(`Next week could not be written. ${error.message}`);
    }
  }

  // 2. The spine record. One row per accepted line, carrying whether the coach
  //    took the draft or rewrote it, which is the only way to tell later
  //    whether the drafting is any good.
  for (const change of applied) {
    const { error } = await supabase.from("plan_changes").insert({
      client_id: clientId,
      week_number: weekNumber + 1,
      field: change.field,
      from_value: change.from,
      to_value: change.to,
      reason: change.reason,
      source: change.source,
      status: "applied",
    });
    if (error) fail(`That change could not be recorded. ${error.message}`);
  }

  // 3. Publish. The client's app reads this.
  if (nextWeek) {
    await supabase.from("events").insert({
      type: "week_published",
      client_id: clientId,
      payload: { weekNumber: weekNumber + 1, changes: applied.length },
    });
  }

  // 4. The message. Last, so it never describes a plan that failed to save.
  if (message.trim()) {
    const { data: thread } = await supabase
      .from("threads")
      .select("id")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let threadId = thread?.id;
    if (!threadId) {
      const { data: created, error } = await supabase
        .from("threads")
        .insert({ client_id: clientId, subject: "Weekly review" })
        .select("id")
        .single();
      if (error || !created) fail(`The message could not be sent. ${error?.message ?? ""}`);
      threadId = created.id;
    }

    const { error } = await supabase.from("messages").insert({
      thread_id: threadId,
      client_id: clientId,
      sender_id: profile.id,
      body: message.trim(),
      kind: "text",
      sent_at: new Date().toISOString(),
      touchpoint: true,
    });
    if (error) fail(`The message could not be sent. ${error.message}`);

    await supabase.from("touchpoints").insert({
      client_id: clientId,
      kind: "message",
      ref_id: threadId,
    });
  }

  // 5. Clear the card.
  await supabase
    .from("queue_items")
    .update({ status: "done" })
    .eq("client_id", clientId)
    .eq("kind", "monday_review")
    .eq("status", "open");

  await supabase.from("events").insert({
    type: "week_reviewed",
    client_id: clientId,
    payload: {
      weekNumber,
      changes: applied.length,
      accepted: applied.filter((change) => change.source === "ai_accepted").length,
      edited: applied.filter((change) => change.source === "ai_edited").length,
    },
  });

  revalidatePath("/coach/queue");
}
