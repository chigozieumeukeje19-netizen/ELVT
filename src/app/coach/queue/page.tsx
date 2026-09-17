import { redirect } from "next/navigation";
import { currentProfile, isStaff } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type QueueItem = {
  id: string;
  kind: string;
  severity: number;
  title: string;
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
    .select("id, kind, severity, title, created_at, clients(first_name, last_name, slug)")
    .eq("status", "open")
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false });

  const items = (data ?? []) as unknown as QueueItem[];

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
        <ul className="mt-5" data-testid="queue-list">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex h-row items-center gap-4 border-line [border-top-width:1px]"
              data-testid="queue-item"
            >
              <span
                aria-hidden="true"
                className={[
                  "h-row w-1",
                  item.severity >= 4
                    ? "bg-flag"
                    : item.severity >= 3
                      ? "bg-watch"
                      : "bg-line",
                ].join(" ")}
              />
              <span className="w-[180px] truncate text-txt">
                {item.clients
                  ? [item.clients.first_name, item.clients.last_name]
                      .filter(Boolean)
                      .join(" ")
                  : "Unassigned"}
              </span>
              <span className="flex-1 truncate">{item.title}</span>
              <span className="elvt-label pr-3">{item.kind.replace(/_/g, " ")}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
