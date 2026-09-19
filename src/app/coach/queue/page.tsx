import { redirect } from "next/navigation";
import { QueueLanes, laneFor, type QueueRow } from "@/components/queue/QueueLanes";
import { currentProfile, isStaff } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type QueueItem = {
  id: string;
  kind: string;
  severity: number;
  title: string;
  detail: Record<string, unknown> | null;
  suggested_action: Record<string, unknown> | null;
  created_at: string;
  clients: { first_name: string; last_name: string | null; slug: string } | null;
};

/**
 * Queue. What needs a decision today.
 *
 * A single stacked list, highest attention first. The first thing the eye hits
 * is the count of items open, so that is the largest thing on the screen and
 * nothing competes with it. Deliberately no stat tiles across the top: a row of
 * identical cards is hard fail 9, and none of those numbers would change what
 * the coach does next anyway.
 */
export default async function QueuePage() {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!isStaff(profile.role)) redirect("/client/today");

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("queue_items")
    .select(
      "id, kind, severity, title, detail, suggested_action, created_at, clients(first_name, last_name, slug)",
    )
    .eq("status", "open")
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false });

  const items = (data ?? []) as unknown as QueueItem[];

  const rows: QueueRow[] = items.map((item) => ({
    id: item.id,
    lane: laneFor(item.kind, item.severity),
    client: item.clients
      ? [item.clients.first_name, item.clients.last_name].filter(Boolean).join(" ")
      : "Unassigned",
    slug: item.clients?.slug ?? "",
    title: item.title,
    detail: readDetail(item.detail),
    kind: item.kind,
    severity: item.severity,
    suggestedMessage:
      typeof item.suggested_action?.message === "string" ? item.suggested_action.message : null,
  }));

  return (
    <main className="px-5 py-4">
      <p className="elvt-label">Queue</p>

      <h1 className="elvt-num mt-1 text-hero" data-testid="queue-count">
        {items.length}
      </h1>
      <p className="text-txt-mute">
        {items.length === 1 ? "item open" : "items open"}
      </p>

      {items.length === 0 ? (
        <p className="mt-5 max-w-[60ch] text-txt-mute" data-testid="queue-empty">
          Nothing is waiting on you. Triggers run at 21:00 in each client&apos;s
          timezone, and the week rolls Sunday night, so the next cards land
          Monday morning.
        </p>
      ) : (
        <QueueLanes rows={rows} />
      )}
    </main>
  );
}

/** One line out of a detail blob, without printing the blob. */
function readDetail(detail: Record<string, unknown> | null): string {
  if (!detail) return "";
  if (typeof detail.lastActive === "string") return `Last logged ${detail.lastActive}`;
  if (Array.isArray(detail.dates)) return `Missed ${detail.dates.join(", ")}`;
  if (typeof detail.since === "string") return `Since ${detail.since}`;
  if (typeof detail.threeWeekAverage === "number") {
    return `Against ${detail.threeWeekAverage} over the previous three weeks`;
  }
  return "";
}
