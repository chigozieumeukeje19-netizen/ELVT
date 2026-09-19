import { NextResponse } from "next/server";
import { handlerWithParams } from "@/lib/api/context";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/exercise/:id/history
 *
 * Every logged set for one movement, newest first. Read through the client's
 * own token, so the join back to sessions is filtered by RLS and this cannot
 * return anyone else's lifting.
 */
export const GET = handlerWithParams<{ id: string }>(async ({ db }, _request, params) => {
  const { data: sessionExercises } = await db
    .from("session_exercises")
    .select("id")
    .eq("exercise_id", params.id);

  const ids = (sessionExercises ?? []).map((row) => row.id);
  if (ids.length === 0) return NextResponse.json({ logs: [], best: null });

  const { data: logs } = await db
    .from("set_logs")
    .select("session_exercise_id, set_number, prescribed, actual, is_pr, pr_type, logged_for_date")
    .in("session_exercise_id", ids)
    .order("logged_for_date", { ascending: false })
    .limit(300);

  // The best set, by estimated one rep max. Epley, which is what the spec names.
  let best: { weight: number; reps: number; e1rm: number; date: string } | null = null;
  for (const log of logs ?? []) {
    const actual = (log.actual ?? {}) as { weight?: number; reps?: number };
    if (!actual.weight || !actual.reps) continue;
    const e1rm = actual.weight * (1 + actual.reps / 30);
    if (!best || e1rm > best.e1rm) {
      best = {
        weight: actual.weight,
        reps: actual.reps,
        e1rm: Math.round(e1rm * 10) / 10,
        date: log.logged_for_date,
      };
    }
  }

  return NextResponse.json({ logs: logs ?? [], best });
});
