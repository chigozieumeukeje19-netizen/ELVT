import Link from "next/link";
import { TAB_LABELS, type Tab } from "@/lib/client/overview";

/**
 * The tab bar under the top strip.
 *
 * Plain links to routes that already existed and were reachable only by typing
 * a URL. That was the hole: seven working screens with no way to click to any
 * of them.
 */
export function ClientTabs({
  slug,
  tabs,
  current,
}: {
  slug: string;
  tabs: Tab[];
  current: Tab;
}) {
  return (
    <nav aria-label="Client" className="mb-4 flex flex-wrap gap-1" data-testid="client-tabs">
      {tabs.map((tab) => {
        const href = tab === "overview" ? `/coach/clients/${slug}` : `/coach/clients/${slug}/${tab}`;
        const on = tab === current;

        return (
          <Link
            key={tab}
            href={href}
            aria-current={on ? "page" : undefined}
            data-testid="client-tab"
            data-tab={tab}
            data-active={on ? "true" : undefined}
            className={`elvt-chip ${on ? "bg-panel-2 text-txt" : "text-txt-mute"}`}
          >
            {TAB_LABELS[tab]}
          </Link>
        );
      })}
    </nav>
  );
}
