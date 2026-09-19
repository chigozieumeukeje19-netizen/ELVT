"use server";

import { z } from "zod";
import { INTAKE } from "@/lib/questionnaire/intake";
import { route, validate, visible, type Answers } from "@/lib/questionnaire/answers";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Saving and submitting the intake.
 *
 * The client filling this in is not signed in: they have a link and nothing
 * else. So the token is the whole authorisation, every write goes through the
 * service role, and the token is only ever used to look up one response row.
 * Nothing here takes a client id from the caller.
 */

const answerSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
);

async function responseFor(token: string) {
  const parsed = z.string().uuid().safeParse(token);
  if (!parsed.success) return null;

  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("questionnaire_responses")
    .select("id, client_id, submitted_at")
    .eq("id", parsed.data)
    .maybeSingle();

  return data ?? null;
}

export async function saveIntakeDraft(token: string, raw: unknown) {
  const answers = answerSchema.safeParse(raw);
  if (!answers.success) return { ok: false as const, error: "Those answers could not be read." };

  const response = await responseFor(token);
  if (!response) return { ok: false as const, error: "That link is not valid." };

  // A submitted form is closed. Letting a draft save reopen it would let the
  // answers drift away from the blueprint the coach already approved.
  if (response.submitted_at) {
    return { ok: false as const, error: "This has already been sent to your coach." };
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("questionnaire_responses")
    .update({ answers: answers.data })
    .eq("id", response.id);

  if (error) return { ok: false as const, error: "That did not save. Your answers are still here." };
  return { ok: true as const };
}

export async function submitIntake(token: string, raw: unknown) {
  const parsed = answerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Those answers could not be read." };

  const response = await responseFor(token);
  if (!response) return { ok: false as const, error: "That link is not valid." };
  if (response.submitted_at) {
    return { ok: false as const, error: "This has already been sent to your coach." };
  }

  const answers = parsed.data as Answers;
  const shown = visible(INTAKE, answers);

  // Validated on the server as well as in the form. The form is a convenience;
  // this is the check.
  const issues = validate(shown, answers);
  if (issues.length > 0) {
    return {
      ok: false as const,
      error: `${issues.length === 1 ? "One answer needs" : `${issues.length} answers need`} another look.`,
      issues,
    };
  }

  const routed = route(shown, answers);
  const supabase = supabaseAdmin();
  const submittedAt = new Date().toISOString();

  const { error } = await supabase
    .from("questionnaire_responses")
    .update({ answers: routed.answers, submitted_at: submittedAt })
    .eq("id", response.id)
    // Only if it is still open, so two taps on a slow phone submit once.
    .is("submitted_at", null);

  if (error) return { ok: false as const, error: "That did not send. Try again in a moment." };

  // Metric answers become real rows rather than sitting in a blob nothing
  // reads. One daily_logs row per client per day, so this merges into today's.
  if (routed.metrics.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("daily_logs").upsert(
      {
        client_id: response.client_id,
        date: today,
        ...Object.fromEntries(routed.metrics.map((metric) => [metric.metric, metric.value])),
      },
      { onConflict: "client_id,date" },
    );
  }

  await supabase.from("clients").update({ status: "pending_approval" }).eq("id", response.client_id);

  await supabase.from("queue_items").insert({
    client_id: response.client_id,
    kind: "approval",
    severity: 3,
    title: "Intake submitted, blueprint ready to draft",
    detail: { responseId: response.id, key: `intake_submitted:${response.id}` },
  });

  await supabase.from("events").insert({
    type: "intake_submitted",
    client_id: response.client_id,
    payload: { responseId: response.id, metrics: routed.metrics.length, photos: routed.photos.length },
  });

  return { ok: true as const };
}
