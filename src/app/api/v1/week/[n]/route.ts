import { NextResponse } from "next/server";
import { handlerWithParams, notFound } from "@/lib/api/context";
import { addDays } from "@/lib/engine/clock";

export const dynamic = "force-dynamic";

/** GET /api/v1/week/:n. Seven days with everything on them. */
export const GET = handlerWithParams<{ n: string }>(async ({ clientId, db }, _request, params) => {
  const weekNumber = Number(params.n);
  if (!Number.isInteger(weekNumber) || weekNumber < 1) {
    return NextResponse.json({ error: "That is not a week." }, { status: 400 });
  }

  const { data: week } = await db
    .from("program_weeks")
    .select("id, week_number, starts_on, is_deload, calories, protein, carbs, fat, planned_mileage, elvt_score, adherence")
    .eq("client_id", clientId)
    .eq("week_number", weekNumber)
    .maybeSingle();

  if (!week) return notFound();

  const { data: days } = await db
    .from("program_days")
    .select(
      "id, date, day_of_week, is_rest, calories_override, protein_override, notes, sessions(id, kind, name, order, status, difficulty_rating, duration_min, fueling_notes)",
    )
    .gte("date", week.starts_on)
    .lte("date", addDays(week.starts_on, 6))
    .order("date");

  return NextResponse.json({ week, days: days ?? [] });
});
