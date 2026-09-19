import { NextResponse } from "next/server";
import { handlerWithParams, notFound } from "@/lib/api/context";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/session/:id
 *
 * Everything the session player needs, including the last performance per
 * exercise and the alternatives the client may swap to. The alternatives are
 * filtered against this client's flags, so a swap list can never offer a
 * movement their program deliberately excluded.
 */
export const GET = handlerWithParams<{ id: string }>(async ({ clientId, db }, _request, params) => {
  const { data: session } = await db
    .from("sessions")
    .select(
      "id, kind, name, order, status, difficulty_rating, duration_min, fueling_notes, coach_notes, session_sections(id, type, order, rounds, duration_sec, name, session_exercises(id, exercise_id, order, sets, tracking_fields, notes, rir_guidance, substituted_from_exercise_id))",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!session) return notFound();

  const exerciseIds = (session.session_sections ?? []).flatMap(
    (section: { session_exercises?: { exercise_id: string }[] }) =>
      (section.session_exercises ?? []).map((exercise) => exercise.exercise_id),
  );

  const { data: exercises } = exerciseIds.length
    ? await db
        .from("exercises")
        .select("id, name, media, cues, default_fields, pattern, primary_muscle, unilateral")
        .in("id", exerciseIds)
    : { data: [] };

  const { data: client } = await db
    .from("clients")
    .select("flag_config")
    .eq("id", clientId)
    .maybeSingle();

  const activeFlags = Object.entries((client?.flag_config ?? {}) as Record<string, unknown>)
    .filter(([, on]) => on === true)
    .map(([key]) => key);

  const { data: alternatives } = exerciseIds.length
    ? await db
        .from("exercise_alternatives")
        .select("exercise_id, alt_exercise_id, reason")
        .in("exercise_id", exerciseIds)
    : { data: [] };

  const altIds = (alternatives ?? []).map((alt) => alt.alt_exercise_id);
  const { data: altExercises } = altIds.length
    ? await db
        .from("exercises")
        .select("id, name, media, exercise_contraindications(flag_key)")
        .in("id", altIds)
    : { data: [] };

  // Flag safe by construction. An alternative carrying a flag this client has
  // is not offered, whatever the library says.
  const safeAlternatives = (alternatives ?? []).filter((alt) => {
    const target = (altExercises ?? []).find((exercise) => exercise.id === alt.alt_exercise_id);
    const contras = ((target?.exercise_contraindications ?? []) as { flag_key: string }[]).map(
      (row) => row.flag_key,
    );
    return !contras.some((flag) => activeFlags.includes(flag));
  });

  const { data: history } = exerciseIds.length
    ? await db
        .from("set_logs")
        .select("session_exercise_id, set_number, prescribed, actual, is_pr, pr_type, logged_for_date")
        .order("logged_for_date", { ascending: false })
        .limit(200)
    : { data: [] };

  return NextResponse.json({
    session,
    exercises: exercises ?? [],
    alternatives: safeAlternatives,
    alternative_exercises: (altExercises ?? []).filter((exercise) =>
      safeAlternatives.some((alt) => alt.alt_exercise_id === exercise.id),
    ),
    history: history ?? [],
  });
});
