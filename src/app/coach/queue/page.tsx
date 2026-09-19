import { redirect } from "next/navigation";
import { MondayCard } from "@/components/queue/MondayCard";
import { QueueLanes, laneFor, type QueueRow } from "@/components/queue/QueueLanes";
import { loadReviewCards } from "@/lib/queue/load-cards";
import { currentProfile, isStaff } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { acceptAllAction } from "./actions";

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

  // The Monday cards come out of the queue rows the week roll wrote, assembled
  // into the shape the card reads. They are shown above the lanes rather than
  // inside one: a review is not a decision about today, it is the whole week.
  const cards = await loadReviewCards(supabase, items.map((item) => item.id));

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
      {/*
        The count is still the first thing the eye hits, per DESIGN.md, but it
        sits beside its label rather than above it. Stacked, this header cost
        135px before the first review card started, which pushed the card past
        the fold and broke the rule about seeing the top edge of the next one.
      */}
      <div className="flex items-baseline gap-3">
        <h1 className="elvt-num text-display" data-testid="queue-count">
          {items.length}
        </h1>
        <div>
          <p className="elvt-label">Queue</p>
          <p className="text-txt-secondary">
            {items.length === 1 ? "item open" : "items open"}
          </p>
        </div>
      </div>

      {cards.length > 0 ? (
        <section className="mt-5">
          <h2 className="elvt-label">Monday reviews</h2>
          <div className="mt-2 flex flex-col gap-4">
            {cards.map((card) => (
              <MondayCard key={card.clientId} card={card} action={acceptAllAction} />
            ))}
          </div>
        </section>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-5 max-w-[60ch] text-txt-secondary" data-testid="queue-empty">
          Nothing is waiting on you. Triggers run at 21:00 in each client&apos;s
          timezone, and the week rolls Sunday night, so the next cards land
          Monday morning.
        </p>
      ) : (
        <QueueLanes rows={rows.filter((row) => row.kind !== "monday_review")} />
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
