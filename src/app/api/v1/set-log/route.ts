import { NextResponse } from "next/server";
import { z } from "zod";
import { handler, jsonBody, notFound } from "@/lib/api/context";

export const dynamic = "force-dynamic";

const schema = z.object({
  session_exercise_id: z.string().uuid(),
  set_number: z.number().int().min(1).max(50),
  actual: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
  logged_for_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * POST /api/v1/set-log
 *
 * The prescription is copied in from the row rather than taken from the body.
 * Prescribed versus actual is kept forever and it is the record of what the
 * coach asked for; a client app sending both could overwrite the ask with
 * whatever it happened to render.
 */
export const POST = handler(async ({ db }, request) => {
  const body = await jsonBody(request, schema);

  const { data: exercise } = await db
    .from("session_exercises")
    .select("id, sets")
    .eq("id", body.session_exercise_id)
    .maybeSingle();

  if (!exercise) return notFound();

  const sets = (exercise.sets ?? []) as { set: number }[];
  const prescribed = sets.find((set) => set.set === body.set_number) ?? null;

  const { data, error } = await db
    .from("set_logs")
    .upsert(
      {
        session_exercise_id: body.session_exercise_id,
        set_number: body.set_number,
        prescribed,
        actual: body.actual,
        logged_at: new Date().toISOString(),
        logged_for_date: body.logged_for_date ?? new Date().toISOString().slice(0, 10),
      },
      { onConflict: "session_exercise_id,set_number" },
    )
    .select("id, set_number, prescribed, actual, is_pr, pr_type");

  if (error || !data || data.length === 0) return notFound();
  return NextResponse.json({ set_log: data[0] });
});
