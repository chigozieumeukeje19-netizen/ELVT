import { NextResponse } from "next/server";
import { handlerWithParams, notFound } from "@/lib/api/context";

export const dynamic = "force-dynamic";

/** POST /api/v1/session/:id/skip. Skipped is a real answer and is recorded as one. */
export const POST = handlerWithParams<{ id: string }>(async ({ db }, _request, params) => {
  const { data } = await db
    .from("sessions")
    .update({ status: "skipped" })
    .eq("id", params.id)
    .select("id, status");

  if (!data || data.length === 0) return notFound();
  return NextResponse.json({ session: data[0] });
});
