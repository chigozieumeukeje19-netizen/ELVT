import { NextResponse } from "next/server";
import { z } from "zod";
import { handler, jsonBody, notFound, writeFailure } from "@/lib/api/context";

export const dynamic = "force-dynamic";

const schema = z.object({
  habit_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number().min(0).optional(),
  completed: z.boolean(),
});

/**
 * POST /api/v1/habit-log. One row per habit per day, so a second tap corrects it.
 *
 * This endpoint had never worked. It upserted the request body, which carries
 * no client_id, and habit_logs.client_id is NOT NULL with no default, so every
 * call in the product's life violated that constraint. The failure went into
 * the same branch as a missing row and came back as 404, which is why nobody
 * noticed: the endpoint answered plausibly and wrote nothing.
 *
 * Two things fix it. The client id comes from the token rather than from the
 * caller, and the habit is checked to be theirs first, so a valid uuid
 * belonging to someone else is a 404 rather than an insert that RLS refuses
 * for reasons the caller has to guess at.
 */
export const POST = handler(async ({ clientId, db }, request) => {
  const body = await jsonBody(request, schema);

  const { data: habit } = await db
    .from("habits")
    .select("id")
    .eq("id", body.habit_id)
    .eq("client_id", clientId)
    .maybeSingle();

  if (!habit) return notFound();

  const { data, error } = await db
    .from("habit_logs")
    .upsert(
      {
        client_id: clientId,
        habit_id: body.habit_id,
        date: body.date,
        value: body.value ?? null,
        completed: body.completed,
      },
      { onConflict: "habit_id,date" },
    )
    .select("id, habit_id, date, value, completed");

  const failure = writeFailure(error, data, "the habit log");
  if (failure) return failure;

  return NextResponse.json({ habit_log: data![0] });
});
