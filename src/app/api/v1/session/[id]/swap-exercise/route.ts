import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, handlerWithParams, jsonBody, notFound, writeFailure } from "@/lib/api/context";

export const dynamic = "force-dynamic";

const schema = z.object({
  session_exercise_id: z.string().uuid(),
  alt_exercise_id: z.string().uuid(),
});

/**
 * POST /api/v1/session/:id/swap-exercise
 *
 * A client swapping a movement for themselves. The replacement is checked
 * against their own flags before the write, because the swap list in the app is
 * a convenience and this is the enforcement: a caller posting an id straight at
 * this endpoint must not be able to put a contraindicated movement into their
 * own program.
 */
export const POST = handlerWithParams<{ id: string }>(async ({ clientId, db }, request, params) => {
  const body = await jsonBody(request, schema);

  const { data: client } = await db
    .from("clients")
    .select("flag_config")
    .eq("id", clientId)
    .maybeSingle();

  const activeFlags = Object.entries((client?.flag_config ?? {}) as Record<string, unknown>)
    .filter(([, on]) => on === true)
    .map(([key]) => key);

  const { data: contraindications } = await db
    .from("exercise_contraindications")
    .select("flag_key")
    .eq("exercise_id", body.alt_exercise_id);

  const blocked = (contraindications ?? [])
    .map((row) => row.flag_key)
    .filter((flag) => activeFlags.includes(flag));

  if (blocked.length > 0) {
    return apiError(
      409,
      "That movement is one your program leaves out on purpose. Pick another from the list.",
    );
  }

  const { data: current } = await db
    .from("session_exercises")
    .select("exercise_id")
    .eq("id", body.session_exercise_id)
    .maybeSingle();

  const { data, error } = await db
    .from("session_exercises")
    .update({
      exercise_id: body.alt_exercise_id,
      substituted_from_exercise_id: current?.exercise_id ?? null,
    })
    .eq("id", body.session_exercise_id)
    .select("id, exercise_id, substituted_from_exercise_id");

  const failure = writeFailure(error, data, "the exercise swap");
  if (failure) return failure;
  void params;
  return NextResponse.json({ session_exercise: data![0] });
});
