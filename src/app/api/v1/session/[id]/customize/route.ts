import { NextResponse } from "next/server";
import { z } from "zod";
import { handlerWithParams, jsonBody, writeFailure } from "@/lib/api/context";

export const dynamic = "force-dynamic";

const schema = z.object({ note: z.string().max(500) });

/**
 * POST /api/v1/session/:id/customize
 *
 * The pencil override, and the only free text a client can write anywhere in
 * this product. Standing ELVT rule: apps are pure accountability, all coaching
 * data comes from check-ins. This is the one exception and it is capped, so it
 * cannot become a notes field by accident.
 *
 * It used to write `coach_notes: null` in the same statement. A client tidying
 * their own session silently deleted the coach's note on it, and neither of
 * them would ever have known: the client saw a saved session, the coach saw a
 * blank field and no record of who blanked it. The client's note has its own
 * column and the coach's is not the client's to touch.
 */
export const POST = handlerWithParams<{ id: string }>(async ({ db }, request, params) => {
  const body = await jsonBody(request, schema);

  const { data, error } = await db
    .from("sessions")
    .update({ status: "modified", fueling_notes: body.note })
    .eq("id", params.id)
    .select("id, status");

  const failure = writeFailure(error, data, "the session");
  if (failure) return failure;

  return NextResponse.json({ session: data![0] });
});
