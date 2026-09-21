import { NextResponse } from "next/server";
import { handlerWithParams, notFound, writeFailure } from "@/lib/api/context";

export const dynamic = "force-dynamic";

/** POST /api/v1/session/:id/skip. Skipped is a real answer and is recorded as one. */
export const POST = handlerWithParams<{ id: string }>(async ({ db }, _request, params) => {
  const { data, error } = await db
    .from("sessions")
    .update({ status: "skipped" })
    .eq("id", params.id)
    .select("id, status");

  const failure = writeFailure(error, data, "the session");
  if (failure) return failure;
  return NextResponse.json({ session: data![0] });
});
