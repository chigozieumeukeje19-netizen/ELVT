import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, handler, jsonBody, writeFailure } from "@/lib/api/context";
import { localDate } from "@/lib/engine/clock";

export const dynamic = "force-dynamic";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  weight: z.number().min(20).max(700).optional(),
  steps: z.number().int().min(0).max(200_000).optional(),
  water: z.number().min(0).max(20_000).optional(),
  sleep_hours: z.number().min(0).max(24).optional(),
  energy: z.number().int().min(1).max(10).optional(),
  mood: z.number().int().min(1).max(10).optional(),
  session_status: z.enum(["done", "modified", "no", "rest"]).optional(),
});

/** How far back a daily log may be backdated. Part 9: seven days for the daily. */
const BACKDATE_DAYS = 7;

/**
 * POST /api/v1/daily-log
 *
 * Backdating is allowed up to a week, because streaks count by scheduled date
 * and a client who writes up Tuesday on Wednesday morning should not lose one.
 * Forward dating is not: a log for tomorrow is either a mistake or a way to
 * game a streak.
 */
export const POST = handler(async ({ clientId, db }, request) => {
  const body = await jsonBody(request, schema);

  const { data: client } = await db
    .from("clients")
    .select("timezone")
    .eq("id", clientId)
    .maybeSingle();

  const today = localDate(new Date(), client?.timezone || "UTC");
  const date = body.date ?? today;

  if (date > today) {
    return apiError(400, "A day cannot be logged before it happens.");
  }

  const ageDays = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000,
  );
  if (ageDays > BACKDATE_DAYS) {
    return apiError(400, `Days can be filled in for up to ${BACKDATE_DAYS} days back.`);
  }

  const { date: _ignored, ...fields } = body;
  void _ignored;

  const { data, error } = await db
    .from("daily_logs")
    .upsert({ client_id: clientId, date, ...fields }, { onConflict: "client_id,date" })
    .select("id, date, weight, steps, water, sleep_hours, energy, mood, session_status");

  const failure = writeFailure(error, data, "the daily log");
  if (failure) return failure;

  return NextResponse.json({ daily_log: data![0] });
});
