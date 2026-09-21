import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, handlerWithParams, jsonBody, notFound, writeFailure } from "@/lib/api/context";

export const dynamic = "force-dynamic";

const schema = z.object({ body: z.string().trim().min(1).max(2000) });

/**
 * POST /api/v1/checkin/:submission_id/reply
 *
 * The client answering their coach's review. This is the thing every competitor
 * here is missing: a client who reads "move the long run to Sunday" and cannot
 * ask why either follows it without understanding it or ignores it.
 *
 * A client reply is not a touchpoint. The touchpoint counter measures what the
 * coach did.
 */
export const POST = handlerWithParams<{ id: string }>(async ({ clientId, userId, db }, request, params) => {
  const { body } = await jsonBody(request, schema);

  const { data: submission } = await db
    .from("checkin_submissions")
    .select("id, thread_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!submission) return notFound();
  if (!submission.thread_id) {
    return apiError(409, "Your coach has not reviewed this one yet.");
  }

  const { data, error } = await db
    .from("messages")
    .insert({
      thread_id: submission.thread_id,
      client_id: clientId,
      sender_id: userId,
      body,
      kind: "text",
      sent_at: new Date().toISOString(),
      touchpoint: false,
    })
    .select("id, body, sent_at");

  const failure = writeFailure(error, data, "the reply");
  if (failure) return failure;
  return NextResponse.json({ message: data![0] });
});
