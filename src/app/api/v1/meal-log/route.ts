import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, handler, jsonBody } from "@/lib/api/context";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    meal_id: z.string().uuid().optional(),
    custom: z
      .object({
        name: z.string().max(120),
        kcal: z.number().min(0).max(10_000),
        p: z.number().min(0).max(1000),
        c: z.number().min(0).max(2000),
        f: z.number().min(0).max(1000),
      })
      .optional(),
    source: z.enum(["plan_tick", "custom", "barcode"]).default("plan_tick"),
  })
  .refine((value) => value.meal_id || value.custom, {
    message: "Tick a plan meal or send what you ate.",
  });

/**
 * POST /api/v1/meal-log
 *
 * A custom entry carries the numbers for the amount the client actually
 * weighed. Never per 100g: that math is where clients lose the plot, and an
 * endpoint that accepted a per 100g value plus a weight would be doing the
 * multiplication somewhere the client cannot see.
 */
export const POST = handler(async ({ clientId, db }, request) => {
  const body = await jsonBody(request, schema);

  const { data, error } = await db
    .from("meal_logs")
    .insert({
      client_id: clientId,
      date: body.date,
      meal_id: body.meal_id ?? null,
      custom: body.custom ?? {},
      source: body.source,
    })
    .select("id, date, meal_id, custom, source");

  if (error || !data || data.length === 0) return apiError(400, "That could not be logged.");
  return NextResponse.json({ meal_log: data[0] });
});
