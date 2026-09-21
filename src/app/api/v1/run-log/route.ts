import { NextResponse } from "next/server";
import { z } from "zod";
import { handler, jsonBody, notFound, writeFailure } from "@/lib/api/context";

export const dynamic = "force-dynamic";

const schema = z.object({
  run_id: z.string().uuid(),
  distance: z.number().min(0).max(300).optional(),
  duration: z.number().int().min(0).max(86_400).optional(),
  avg_pace: z.number().min(0).optional(),
  avg_hr: z.number().int().min(20).max(250).optional(),
  max_hr: z.number().int().min(20).max(250).optional(),
  rpe: z.number().int().min(1).max(10).optional(),
  cadence: z.number().int().min(0).max(300).optional(),
  elevation: z.number().optional(),
  felt: z.enum(["easy", "ok", "hard"]).optional(),
  stayed_in_zone: z.boolean().optional(),
  source: z.enum(["manual", "strava", "garmin", "apple"]).default("manual"),
});

/** POST /api/v1/run-log. A run is its own object, so it logs its own fields. */
export const POST = handler(async ({ db }, request) => {
  const body = await jsonBody(request, schema);
  const { run_id, ...fields } = body;

  const { data, error } = await db
    .from("run_logs")
    .insert({ run_id, ...fields })
    .select("id, distance, duration, avg_pace, avg_hr, rpe, felt, stayed_in_zone");

  const failure = writeFailure(error, data, "the run log");
  if (failure) return failure;
  return NextResponse.json({ run_log: data![0] });
});
