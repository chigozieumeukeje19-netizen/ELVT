import { NextResponse } from "next/server";
import { handler } from "@/lib/api/context";

export const dynamic = "force-dynamic";

/** GET /api/v1/checkins. Forms due, submissions, and the review threads. */
export const GET = handler(async ({ clientId, db }) => {
  const [{ data: forms }, { data: submissions }] = await Promise.all([
    db.from("checkin_forms").select("id, kind, questions, schedule, auto_send, spine_variable").eq("client_id", clientId),
    db
      .from("checkin_submissions")
      .select("id, form_id, for_date, answers, submitted_at, reviewed_at, review_note, thread_id")
      .eq("client_id", clientId)
      .order("for_date", { ascending: false })
      .limit(60),
  ]);

  const threadIds = (submissions ?? [])
    .map((submission) => submission.thread_id)
    .filter((id): id is string => Boolean(id));

  const { data: messages } = threadIds.length
    ? await db
        .from("messages")
        .select("id, thread_id, sender_id, body, sent_at")
        .in("thread_id", threadIds)
        .not("sent_at", "is", null)
        .order("created_at")
    : { data: [] };

  return NextResponse.json({
    forms: forms ?? [],
    submissions: submissions ?? [],
    // Threaded, so a client can read what the coach said and answer it. One way
    // feedback is the gap in every other product here.
    thread_messages: messages ?? [],
  });
});
