import { NextResponse } from "next/server";
import { handler } from "@/lib/api/context";

export const dynamic = "force-dynamic";

/** GET /api/v1/program. Every week, the phase bands, and the calorie path. */
export const GET = handler(async ({ clientId, db }) => {
  const { data: program } = await db
    .from("programs")
    .select("id, name, phases, duration_weeks, status")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();

  const { data: weeks } = await db
    .from("program_weeks")
    .select("week_number, starts_on, is_deload, calories, protein, carbs, fat, calorie_note, calorie_status, planned_mileage, elvt_score, adherence")
    .eq("client_id", clientId)
    .order("week_number");

  return NextResponse.json({ program: program ?? null, weeks: weeks ?? [] });
});
