import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, handlerWithParams, jsonBody } from "@/lib/api/context";
import { scoreDay, type ScoredTask } from "@/lib/engine/scoring";

export const dynamic = "force-dynamic";

const schema = z.object({ key: z.string().min(1).max(60), done: z.boolean() });

/**
 * POST /api/v1/day/:date/task
 *
 * One tap on the Today list. The score is recomputed from the weights already
 * on the row rather than sent by the caller, because the score is the thing the
 * streak is built on and a client app should not be able to name its own.
 */
export const POST = handlerWithParams<{ date: string }>(async ({ clientId, db }, request, params) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) return apiError(400, "That is not a date.");

  const body = await jsonBody(request, schema);

  const { data: existing } = await db
    .from("day_completion")
    .select("id, tasks, streak_after")
    .eq("client_id", clientId)
    .eq("date", params.date)
    .maybeSingle();

  const tasks = ((existing?.tasks ?? []) as ScoredTask[]).map((task) =>
    task.key === body.key ? { ...task, done: body.done } : task,
  );

  if (!tasks.some((task) => task.key === body.key)) {
    return apiError(404, "That is not one of today's tasks.");
  }

  const scored = scoreDay(params.date, tasks);

  const { data, error } = await db
    .from("day_completion")
    .upsert(
      {
        client_id: clientId,
        date: params.date,
        tasks: scored.tasks,
        score: scored.score,
        streak_after: existing?.streak_after ?? 0,
      },
      { onConflict: "client_id,date" },
    )
    .select("date, score, tasks, streak_after");

  if (error || !data || data.length === 0) return apiError(400, "That could not be saved.");
  return NextResponse.json({ day: data[0] });
});
