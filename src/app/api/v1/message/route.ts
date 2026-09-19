import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, handler, jsonBody } from "@/lib/api/context";

export const dynamic = "force-dynamic";

const schema = z.object({ body: z.string().trim().min(1).max(2000) });

/** POST /api/v1/message. A client writing to their coach. Never a touchpoint. */
export const POST = handler(async ({ clientId, userId, db }, request) => {
  const { body } = await jsonBody(request, schema);

  const { data: thread } = await db
    .from("threads")
    .select("id")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let threadId = thread?.id;
  if (!threadId) {
    const { data: created, error } = await db
      .from("threads")
      .insert({ client_id: clientId, subject: "Messages" })
      .select("id")
      .single();
    if (error || !created) return apiError(400, "That could not be sent.");
    threadId = created.id;
  }

  const { data, error } = await db
    .from("messages")
    .insert({
      thread_id: threadId,
      client_id: clientId,
      sender_id: userId,
      body,
      kind: "text",
      sent_at: new Date().toISOString(),
      touchpoint: false,
    })
    .select("id, body, sent_at");

  if (error || !data || data.length === 0) return apiError(400, "That could not be sent.");
  return NextResponse.json({ message: data[0] });
});
