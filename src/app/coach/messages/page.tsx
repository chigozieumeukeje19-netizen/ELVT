import { redirect } from "next/navigation";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ThreadList, type ThreadRow } from "@/components/messages/ThreadView";
import { currentProfile, isStaff } from "@/lib/auth";
import { localDate } from "@/lib/engine/clock";
import { countTouchpoints, quietestFirst } from "@/lib/messages/touchpoints";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * The inbox, ordered by who has heard from you least.
 *
 * Not by most recent. The thread at the top of a recency list is the client you
 * are already talking to; the one who needs a message is the one who has sent
 * you nothing, and recency buries them. That ordering is the retention
 * mechanic, so it is the default rather than a sort option.
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!isStaff(profile.role)) redirect("/client/today");

  const { error } = await searchParams;
  const supabase = await supabaseServer();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, slug, first_name, last_name, timezone")
    .eq("status", "active");

  const { data: touchpoints } = await supabase
    .from("touchpoints")
    .select("client_id, kind, at")
    .gte("at", new Date(Date.now() - 21 * 86_400_000).toISOString());

  const { data: messages } = await supabase
    .from("messages")
    .select("id, client_id, body, sender_id, sent_at, scheduled_for, created_at")
    .order("created_at", { ascending: false })
    .limit(400);

  const rows: ThreadRow[] = (clients ?? []).map((client) => {
    const today = localDate(new Date(), client.timezone || "UTC");
    const theirs = (touchpoints ?? [])
      .filter((touchpoint) => touchpoint.client_id === client.id)
      .map((touchpoint) => ({ kind: touchpoint.kind, at: touchpoint.at }));

    const theirMessages = (messages ?? []).filter(
      (message) => message.client_id === client.id,
    );
    const last = theirMessages.find((message) => message.sent_at);

    return {
      id: client.id,
      clientId: client.id,
      slug: client.slug,
      name: [client.first_name, client.last_name].filter(Boolean).join(" "),
      lastBody: last?.body ?? "Nothing sent yet",
      lastAt: (last?.sent_at ?? "").slice(0, 10),
      lastFrom: last?.sender_id === profile.id ? "coach" : "client",
      unread: false,
      scheduled: theirMessages.filter((message) => message.scheduled_for && !message.sent_at).length,
      touchpoints: countTouchpoints(
        theirs as { kind: never; at: string }[],
        today,
      ),
    };
  });

  return (
    <main className="px-5 py-4">
      <ScreenHeader
        label="Messages"
        title={`${rows.length} clients`}
        note="Ordered by who has heard from you least, not by who wrote last."
        error={error}
      />
      <ThreadList rows={quietestFirst(rows)} />
    </main>
  );
}
