import { NextResponse } from "next/server";
import { z } from "zod";
import { handlerWithParams, jsonBody, notFound } from "@/lib/api/context";

export const dynamic = "force-dynamic";

const schema = z.object({ note: z.string().max(500) });

/**
 * POST /api/v1/session/:id/customize
 *
 * The pencil override, and the only free text a client can write anywhere in
 * this product. Standing ELVT rule: apps are pure accountability, all coaching
 * data comes from check-ins. This is the one exception and it is capped, so it
 * cannot become a notes field by accident.
 */
export const POST = handlerWithParams<{ id: string }>(async ({ db }, request, params) => {
  const body = await jsonBody(request, schema);

  const { data } = await db
    .from("sessions")
    .update({ status: "modified", coach_notes: null, fueling_notes: body.note })
    .eq("id", params.id)
    .select("id, status");

  if (!data || data.length === 0) return notFound();
  return NextResponse.json({ session: data[0] });
});
