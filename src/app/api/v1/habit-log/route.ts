import { NextResponse } from "next/server";
import { z } from "zod";
import { handler, jsonBody, notFound } from "@/lib/api/context";

export const dynamic = "force-dynamic";

const schema = z.object({
  habit_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number().min(0).optional(),
  completed: z.boolean(),
});

/** POST /api/v1/habit-log. One row per habit per day, so a second tap corrects it. */
export const POST = handler(async ({ db }, request) => {
  const body = await jsonBody(request, schema);

  const { data, error } = await db
    .from("habit_logs")
    .upsert(body, { onConflict: "habit_id,date" })
    .select("id, habit_id, date, value, completed");

  if (error || !data || data.length === 0) return notFound();
  return NextResponse.json({ habit_log: data[0] });
});
