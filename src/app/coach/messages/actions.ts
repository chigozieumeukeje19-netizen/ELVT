"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentProfile, isStaff } from "@/lib/auth";
import { instantFor } from "@/lib/messages/schedule";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Sending, and scheduling.
 *
 * A scheduled message is stored as an instant, worked out from the time the
 * coach typed and the client's timezone. Not the browser's: a coach in London
 * scheduling 7am for a client in Denver means the client's 7am.
 */

function fail(message: string): never {
  redirect(`/coach/messages?error=${encodeURIComponent(message)}`);
}

const schema = z.object({
  clientId: z.string().uuid(),
  body: z.string().trim().min(1),
  scheduled: z.string().optional(),
  sendDate: z.string().optional(),
  sendTime: z.string().optional(),
});

export async function sendMessageAction(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("A message needs something written in it.");

  const profile = await currentProfile();
  if (!profile || !isStaff(profile.role)) fail("Not allowed.");

  const { clientId, body, scheduled, sendDate, sendTime } = parsed.data;
  const supabase = await supabaseServer();

  const { data: client } = await supabase
    .from("clients")
    .select("id, timezone")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) fail("That client could not be found.");

  let scheduledFor: string | null = null;
  if (scheduled) {
    if (!sendDate || !sendTime) fail("A scheduled message needs a date and a time.");
    if (!client.timezone) {
      fail("That client has no timezone set, so there is no way to know when their 7am is.");
    }

    try {
      scheduledFor = instantFor(sendDate, sendTime, client.timezone).toISOString();
    } catch (error) {
      fail(error instanceof Error ? error.message : "That time could not be worked out.");
    }
  }

  const { data: thread } = await supabase
    .from("threads")
    .select("id")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let threadId = thread?.id;
  if (!threadId) {
    const { data: created, error } = await supabase
      .from("threads")
      .insert({ client_id: clientId, subject: "Messages" })
      .select("id")
      .single();
    if (error || !created) fail(`That thread could not be started. ${error?.message ?? ""}`);
    threadId = created.id;
  }

  const sentAt = scheduledFor ? null : new Date().toISOString();

  const { error } = await supabase.from("messages").insert({
    thread_id: threadId,
    client_id: clientId,
    sender_id: profile.id,
    body,
    kind: "text",
    scheduled_for: scheduledFor,
    sent_at: sentAt,
    // A scheduled message is not a touchpoint until it has actually gone. The
    // whole number is a count of what reached the client.
    touchpoint: sentAt !== null,
  });
  if (error) fail(`That message could not be saved. ${error.message}`);

  if (sentAt) {
    await supabase.from("touchpoints").insert({
      client_id: clientId,
      kind: "message",
      ref_id: threadId,
    });
  }

  revalidatePath("/coach/messages");
}

const replySchema = z.object({
  threadId: z.string().uuid(),
  body: z.string().trim().min(1),
});

/**
 * A client answering a review.
 *
 * Runs as the client, so RLS decides whether they may write to this thread
 * rather than a check in code. A client reply is not a touchpoint: the counter
 * measures what the coach did.
 */
export async function replyAsClientAction(formData: FormData) {
  const parsed = replySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/client/today?error=empty");

  const profile = await currentProfile();
  if (!profile) redirect("/client/login");

  const supabase = await supabaseServer();

  const { data: thread } = await supabase
    .from("threads")
    .select("id, client_id")
    .eq("id", parsed.data.threadId)
    .maybeSingle();

  if (!thread) redirect("/client/today?error=missing");

  const { error } = await supabase.from("messages").insert({
    thread_id: thread.id,
    client_id: thread.client_id,
    sender_id: profile.id,
    body: parsed.data.body,
    kind: "text",
    sent_at: new Date().toISOString(),
    touchpoint: false,
  });

  if (error) redirect("/client/today?error=send");

  revalidatePath("/client/today");
}
