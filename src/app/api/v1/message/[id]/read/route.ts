import { NextResponse } from "next/server";
import { handlerWithParams, notFound } from "@/lib/api/context";

export const dynamic = "force-dynamic";

/** POST /api/v1/message/:id/read. */
export const POST = handlerWithParams<{ id: string }>(async ({ db }, _request, params) => {
  const { data } = await db
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", params.id)
    .is("read_at", null)
    .select("id, read_at");

  // Already read is not a failure. A client app marking on every render should
  // not see an error on the second one.
  if (!data || data.length === 0) {
    const { data: exists } = await db
      .from("messages")
      .select("id, read_at")
      .eq("id", params.id)
      .maybeSingle();
    if (!exists) return notFound();
    return NextResponse.json({ message: exists });
  }

  return NextResponse.json({ message: data[0] });
});
