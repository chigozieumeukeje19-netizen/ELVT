import { NextResponse } from "next/server";
import { handler } from "@/lib/api/context";

export const dynamic = "force-dynamic";

/** GET /api/v1/messages?since=. Sent messages only, newest last. */
export const GET = handler(async ({ clientId, db }, request) => {
  const since = new URL(request.url).searchParams.get("since");

  let query = db
    .from("messages")
    .select("id, thread_id, sender_id, body, kind, attachment_path, sent_at, read_at")
    .eq("client_id", clientId)
    // A scheduled message that has not gone yet does not exist as far as the
    // client is concerned. Returning it would show them tomorrow's message.
    .not("sent_at", "is", null)
    .order("sent_at");

  if (since) query = query.gt("sent_at", since);

  const { data: messages } = await query.limit(200);
  return NextResponse.json({ messages: messages ?? [] });
});
