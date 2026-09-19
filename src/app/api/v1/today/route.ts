import { NextResponse } from "next/server";
import { handler } from "@/lib/api/context";
import { localDate } from "@/lib/engine/clock";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/today
 *
 * Everything the Today screen shows, in one call. One call because a client
 * opens this on a phone in a gym: five round trips on a bad connection is five
 * chances to show a half drawn screen.
 *
 * "Today" is the client's today. The date is computed from their timezone
 * rather than the server's, so a session does not appear a day early for
 * anyone east of the server.
 */
export const GET = handler(async ({ clientId, db }) => {
  const { data: client } = await db
    .from("clients")
    .select("timezone")
    .eq("id", clientId)
    .maybeSingle();

  const today = localDate(new Date(), client?.timezone || "UTC");

  const { data: day } = await db
    .from("program_days")
    .select(
      "id, date, is_rest, calories_override, protein_override, notes, sessions(id, kind, name, order, status, difficulty_rating, fueling_notes)",
    )
    .eq("date", today)
    .maybeSingle();

  const { data: week } = await db
    .from("program_weeks")
    .select("week_number, calories, protein, carbs, fat, planned_mileage")
    .eq("client_id", clientId)
    .lte("starts_on", today)
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [{ data: meals }, { data: habits }, { data: log }, { data: completion }, { data: forms }] =
    await Promise.all([
      db.from("meals").select("id, name, order, calories, protein, carbs, fat, items").eq("client_id", clientId).order("order"),
      db.from("habits").select("id, habit_id, target, unit, days_of_week").eq("client_id", clientId),
      db.from("daily_logs").select("*").eq("client_id", clientId).eq("date", today).maybeSingle(),
      db.from("day_completion").select("score, tasks, streak_after").eq("client_id", clientId).eq("date", today).maybeSingle(),
      db.from("checkin_forms").select("id, kind, questions, schedule").eq("client_id", clientId),
    ]);

  const { data: message } = await db
    .from("messages")
    .select("id, body, sent_at")
    .eq("client_id", clientId)
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    date: today,
    is_rest: day?.is_rest ?? false,
    sessions: day?.sessions ?? [],
    nutrition: {
      calories: day?.calories_override ?? week?.calories ?? null,
      protein: day?.protein_override ?? week?.protein ?? null,
      carbs: week?.carbs ?? null,
      fat: week?.fat ?? null,
      meals: meals ?? [],
    },
    habits: habits ?? [],
    log: log ?? null,
    score: completion?.score ?? 0,
    streak: completion?.streak_after ?? 0,
    tasks: completion?.tasks ?? [],
    coach_message: message ?? null,
    checkins_due: (forms ?? []).map((form) => ({ id: form.id, kind: form.kind })),
    week: week?.week_number ?? null,
  });
});
