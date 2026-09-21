import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, handlerWithParams, jsonBody, notFound, writeFailure } from "@/lib/api/context";
import { localDate } from "@/lib/engine/clock";
import { resolveQuestions } from "@/lib/checkin/bank";

export const dynamic = "force-dynamic";

const schema = z.object({
  for_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  answers: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
  ),
});

/**
 * POST /api/v1/checkin/:form_id/submit
 *
 * Metric answers are written through to daily_logs, so a weight typed into the
 * weekly appears on the chart rather than sitting in a jsonb blob nothing
 * reads. That is the same routing the intake does, for the same reason.
 */
export const POST = handlerWithParams<{ id: string }>(async ({ clientId, db }, request, params) => {
  const body = await jsonBody(request, schema);

  const { data: form } = await db
    .from("checkin_forms")
    .select("id, kind, questions")
    .eq("id", params.id)
    .maybeSingle();

  if (!form) return notFound();

  const { data: client } = await db
    .from("clients")
    .select("timezone")
    .eq("id", clientId)
    .maybeSingle();

  const forDate = body.for_date ?? localDate(new Date(), client?.timezone || "UTC");

  const { data, error } = await db
    .from("checkin_submissions")
    .upsert(
      {
        form_id: form.id,
        client_id: clientId,
        for_date: forDate,
        answers: body.answers,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "form_id,for_date" },
    )
    .select("id, for_date, submitted_at");

  const failure = writeFailure(error, data, "the check-in");
  if (failure) return failure;

  // Metric answers become rows. The question declares which column it writes,
  // and only the columns on daily_logs are writable this way.
  // Resolved against the bank, because the column holds keys as often as
  // objects and a metric answer cannot be routed without the type.
  const questions = resolveQuestions(form.questions);
  const METRICS = ["weight", "steps", "sleep_hours", "water", "energy", "mood"];
  const metricWrites: Record<string, number> = {};

  for (const question of questions) {
    if (question.type !== "metric" || !question.metric) continue;
    if (!METRICS.includes(question.metric)) continue;
    const value = body.answers[question.key];
    const number = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(number)) metricWrites[question.metric] = number;
  }

  if (Object.keys(metricWrites).length > 0) {
    await db
      .from("daily_logs")
      .upsert({ client_id: clientId, date: forDate, ...metricWrites }, { onConflict: "client_id,date" });
  }

  return NextResponse.json({ submission: data![0], metrics_written: Object.keys(metricWrites) });
});
