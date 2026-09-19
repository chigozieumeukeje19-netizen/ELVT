import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, handler, jsonBody } from "@/lib/api/context";

export const dynamic = "force-dynamic";

const schema = z.object({
  date_a: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_b: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * POST /api/v1/day-swap
 *
 * Only if the client's feature flags allow it. Swapping days is a real
 * coaching decision for someone on a tight ramp, so it is off unless the coach
 * turned it on, and this is the check rather than the app hiding a button.
 *
 * Sessions are re-parented rather than rebuilt, which keeps every log hanging
 * off them.
 */
export const POST = handler(async ({ clientId, db }, request) => {
  const body = await jsonBody(request, schema);
  if (body.date_a === body.date_b) return apiError(400, "Those are the same day.");

  const { data: client } = await db
    .from("clients")
    .select("feature_flags")
    .eq("id", clientId)
    .maybeSingle();

  const flags = (client?.feature_flags ?? {}) as Record<string, unknown>;
  if (flags.day_swap !== true) {
    return apiError(403, "Moving days is not switched on for you. Ask your coach.");
  }

  const { data: days } = await db
    .from("program_days")
    .select("id, date")
    .in("date", [body.date_a, body.date_b]);

  const dayA = (days ?? []).find((day) => day.date === body.date_a);
  const dayB = (days ?? []).find((day) => day.date === body.date_b);
  if (!dayA || !dayB) return apiError(404, "One of those days is not in your program.");

  const { data: sessionsA } = await db.from("sessions").select("id").eq("program_day_id", dayA.id);
  const { data: sessionsB } = await db.from("sessions").select("id").eq("program_day_id", dayB.id);

  for (const session of sessionsA ?? []) {
    await db.from("sessions").update({ program_day_id: dayB.id }).eq("id", session.id);
  }
  for (const session of sessionsB ?? []) {
    await db.from("sessions").update({ program_day_id: dayA.id }).eq("id", session.id);
  }

  return NextResponse.json({
    swapped: [body.date_a, body.date_b],
    moved: (sessionsA ?? []).length + (sessionsB ?? []).length,
  });
});
