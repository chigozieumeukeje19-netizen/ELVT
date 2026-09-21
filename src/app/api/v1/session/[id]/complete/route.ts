import { NextResponse } from "next/server";
import { z } from "zod";
import { handlerWithParams, jsonBody, notFound, writeFailure } from "@/lib/api/context";

export const dynamic = "force-dynamic";

const schema = z.object({
  difficulty: z.number().int().min(1).max(5).optional(),
  duration_min: z.number().int().min(1).max(600).optional(),
});

/** POST /api/v1/session/:id/complete. Difficulty 1 to 5, as the player asks for. */
export const POST = handlerWithParams<{ id: string }>(async ({ db }, request, params) => {
  const body = await jsonBody(request, schema);

  const { data, error } = await db
    .from("sessions")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
      difficulty_rating: body.difficulty ?? null,
      duration_min: body.duration_min ?? null,
    })
    .eq("id", params.id)
    .select("id, status, completed_at, difficulty_rating");

  const failure = writeFailure(error, data, "the session");
  if (failure) return failure;
  return NextResponse.json({ session: data![0] });
});
