"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentProfile, isStaff } from "@/lib/auth";
import { buildDailyForm, buildWeeklyForm, spineFrom } from "@/lib/checkin/generate";
import { profileFrom } from "@/lib/checkin/profile";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Writing a review, and regenerating a client's forms.
 *
 * A review opens a thread rather than leaving a note. The client can answer in
 * it, which is the thing HubFit's own help center lists as missing: feedback
 * that cannot be replied to is feedback the client either follows without
 * understanding or ignores.
 */

function pathFor(slug: string) {
  return `/coach/clients/${slug}/checkins`;
}

function fail(slug: string, message: string): never {
  redirect(`${pathFor(slug)}?error=${encodeURIComponent(message)}`);
}

async function staffContext(slug: string) {
  const profile = await currentProfile();
  if (!profile || !isStaff(profile.role)) fail(slug, "Not allowed.");

  const supabase = await supabaseServer();
  const { data: client } = await supabase
    .from("clients")
    .select("id, primary_goal, flag_config, feature_flags")
    .eq("slug", slug)
    .maybeSingle();
  if (!client) fail(slug, "That client could not be found.");

  return { supabase, profile, client };
}

const reviewSchema = z.object({
  slug: z.string().min(1),
  submissionId: z.string().uuid(),
  body: z.string().trim().min(1),
});

export async function reviewSubmissionAction(formData: FormData) {
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    fail(String(formData.get("slug") ?? ""), "A review needs something written in it.");
  }

  const { slug, submissionId, body } = parsed.data;
  const { supabase, profile, client } = await staffContext(slug);

  const { data: submission } = await supabase
    .from("checkin_submissions")
    .select("id, client_id, thread_id")
    .eq("id", submissionId)
    .eq("client_id", client.id)
    .maybeSingle();

  if (!submission) fail(slug, "That submission could not be found.");

  let threadId = submission.thread_id;

  if (!threadId) {
    const { data: thread, error } = await supabase
      .from("threads")
      .insert({ client_id: client.id, subject: "Check-in review" })
      .select("id")
      .single();
    if (error || !thread) fail(slug, `That review could not be started. ${error?.message ?? ""}`);
    threadId = thread.id;

    await supabase
      .from("checkin_submissions")
      .update({ thread_id: threadId })
      .eq("id", submission.id);
  }

  const { error: messageError } = await supabase.from("messages").insert({
    thread_id: threadId,
    // messages.client_id is not null. A thread id alone is not enough, and the
    // RLS policy for the client role reads this column rather than the thread.
    client_id: client.id,
    sender_id: profile.id,
    body,
    kind: "text",
    sent_at: new Date().toISOString(),
    // A review is a touchpoint. It is the whole reason the counter exists.
    touchpoint: true,
  });

  if (messageError) fail(slug, `That review could not be sent. ${messageError.message}`);

  await supabase
    .from("checkin_submissions")
    .update({ reviewed_at: new Date().toISOString(), review_note: body })
    .eq("id", submission.id);

  await supabase.from("touchpoints").insert({
    client_id: client.id,
    kind: "checkin_review",
    ref_id: submission.id,
  });

  await supabase.from("events").insert({
    type: "checkin_reviewed",
    client_id: client.id,
    payload: { submissionId: submission.id },
  });

  revalidatePath(pathFor(slug));
}

const regenerateSchema = z.object({
  slug: z.string().min(1),
  weekNumber: z.coerce.number().int().min(1),
});

/**
 * Rebuilds this client's two forms from the bank.
 *
 * The weekly is built around the spine, so regenerating it after a Monday's
 * changes is what makes next Sunday ask whether those changes worked.
 */
export async function regenerateFormsAction(formData: FormData) {
  const parsed = regenerateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(String(formData.get("slug") ?? ""), "That week number is not valid.");

  const { slug, weekNumber } = parsed.data;
  const { supabase, client } = await staffContext(slug);
  const profile = profileFrom(client);

  const { data: changes } = await supabase
    .from("plan_changes")
    .select("field, week_number, created_at")
    .eq("client_id", client.id)
    .eq("status", "applied");

  const spine = spineFrom(
    (changes ?? []).map((change) => ({
      field: change.field,
      weekNumber: change.week_number,
      createdAt: change.created_at,
    })),
    weekNumber,
  );

  const daily = buildDailyForm(profile);
  const weekly = buildWeeklyForm(profile, {
    spineVariable: spine,
    isFirstWeek: weekNumber === 1,
  });

  for (const [kind, questions, spineVariable] of [
    ["daily", daily, null],
    [weekNumber === 1 ? "week1" : "weekly", weekly.questions, weekly.spineVariable],
  ] as const) {
    const { data: existing } = await supabase
      .from("checkin_forms")
      .select("id")
      .eq("client_id", client.id)
      .eq("kind", kind)
      .maybeSingle();

    const row = {
      client_id: client.id,
      kind,
      questions,
      spine_variable: spineVariable,
      schedule:
        kind === "daily"
          ? { days: [0, 1, 2, 3, 4, 5, 6], time: "20:00" }
          : { days: [0], time: "18:00" },
    };

    const { error } = existing
      ? await supabase.from("checkin_forms").update(row).eq("id", existing.id)
      : await supabase.from("checkin_forms").insert(row);

    if (error) fail(slug, `The ${kind} form could not be written. ${error.message}`);
  }

  revalidatePath(pathFor(slug));
}
