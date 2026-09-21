import { NextResponse } from "next/server";
import { z } from "zod";
import { handler, jsonBody, notFound, writeFailure } from "@/lib/api/context";

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
export const POST = handler(async ({ clientId, db }, request) => {
  const body = await jsonBody(request, schema);

  const { data: exercise } = await db
    .from("session_exercises")
    .select("id, sets")
    .eq("id", body.session_exercise_id)
    .maybeSingle();

  if (!exercise) return notFound();

  const sets = (exercise.sets ?? []) as { set: number }[];
  const prescribed = sets.find((set) => set.set === body.set_number) ?? null;

  /*
   * `prescribed` is written once, when the row is created, and never again.
   *
   * This was an upsert that sent it on every call. The value is server-derived
   * so it was not a hole, but it meant the column needed UPDATE privilege, and
   * `prescribed` is precisely the column a client must never be able to write:
   * it is what the coach asked for, and the whole point of `actual` is that it
   * is compared against something the client did not choose.
   *
   * So: correct the existing row's `actual` if there is one, insert with the
   * prescription if there is not. Two statements rather than one, and the
   * privilege the client holds is exactly the one they need.
   */
  const logged_at = new Date().toISOString();
  const logged_for_date = body.logged_for_date ?? logged_at.slice(0, 10);

  const { data: existing } = await db
    .from("set_logs")
    .select("id")
    .eq("session_exercise_id", body.session_exercise_id)
    .eq("set_number", body.set_number)
    .maybeSingle();

  const write = existing
    ? db
        .from("set_logs")
        .update({ actual: body.actual, logged_at, logged_for_date })
        .eq("id", existing.id)
    : db.from("set_logs").insert({
        session_exercise_id: body.session_exercise_id,
        client_id: clientId,
        set_number: body.set_number,
        prescribed,
        actual: body.actual,
        logged_at,
        logged_for_date,
      });

  const { data, error } = await write.select(
    "id, set_number, prescribed, actual, is_pr, pr_type",
  );

  const failure = writeFailure(error, data, "the set log");
  if (failure) return failure;

  return NextResponse.json({ set_log: data![0] });
});
