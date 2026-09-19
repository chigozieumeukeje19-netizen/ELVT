import { NextResponse } from "next/server";
import { handlerWithParams, notFound } from "@/lib/api/context";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/session/:id/start
 *
 * No client_id in the filter and none in the body. The update is by session id
 * alone and RLS decides whether this caller owns it, which is the requirement
 * stated exactly: at the RLS layer, not only in code. A zero row update and a
 * session that does not exist both answer 404, so the endpoint cannot be used
 * to find out whether someone else's session id is real.
 */
export const POST = handlerWithParams<{ id: string }>(async ({ db }, _request, params) => {
  const { data } = await db
    .from("sessions")
    .update({ status: "planned", started_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("id, started_at");

  if (!data || data.length === 0) return notFound();
  return NextResponse.json({ session: data[0] });
});
