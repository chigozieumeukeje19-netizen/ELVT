import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, handlerWithParams, jsonBody, notFound } from "@/lib/api/context";

export const dynamic = "force-dynamic";

const schema = z.object({
  kcal: z.number().int().min(800).max(8000).optional(),
  p: z.number().int().min(0).max(500).optional(),
});

/**
 * POST /api/v1/day/:date/target-override
 *
 * A one day change, on the day. The week's number is untouched, so tomorrow
 * goes back to the plan and the coach's path is not quietly rewritten by a
 * client having a big day.
 */
export const POST = handlerWithParams<{ date: string }>(async ({ db }, request, params) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) return apiError(400, "That is not a date.");

  const body = await jsonBody(request, schema);

  const { data } = await db
    .from("program_days")
    .update({
      calories_override: body.kcal ?? null,
      protein_override: body.p ?? null,
    })
    .eq("date", params.date)
    .select("date, calories_override, protein_override");

  if (!data || data.length === 0) return notFound();
  return NextResponse.json({ day: data[0] });
});
