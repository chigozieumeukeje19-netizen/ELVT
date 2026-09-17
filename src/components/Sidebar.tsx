import Link from "next/link";
import {
  BuilderIcon,
  CalendarIcon,
  LibraryIcon,
  MessagesIcon,
  QueueIcon,
  RosterIcon,
  SettingsIcon,
} from "@/components/icons";

/**
 * Persistent 240px left sidebar, fixed during scroll. Square corners, no
 * border, separated from the content by a single 1px rule.
 *
 * The wordmark is the only place ELVT gold appears in the entire portal. It is
 * brand identity, not a UI accent; using it on a button would pull the portal
 * toward the cream and gold client-app look, which is hard fail 0.
 */

const NAV = [
  { href: "/coach/queue", label: "Queue", Icon: QueueIcon },
  { href: "/coach/clients", label: "Clients", Icon: RosterIcon },
  { href: "/coach/builder/exercises/review", label: "Builder", Icon: BuilderIcon },
  { href: "/coach/calendar", label: "Calendar", Icon: CalendarIcon },
  { href: "/coach/messages", label: "Messages", Icon: MessagesIcon },
  { href: "/coach/library", label: "Library", Icon: LibraryIcon },
  { href: "/coach/settings", label: "Settings", Icon: SettingsIcon },
];

export function Sidebar({
  current,
  queueCount,
}: {
  current: string;
  queueCount?: number;
}) {
  return (
    <nav
      aria-label="Portal"
      className="fixed left-0 top-0 z-10 flex h-screen w-sidebar flex-col border-line bg-panel [border-right-width:1px]"
    >
      <div className="flex h-row items-center px-4">
        <span
          className="text-wordmark"
          style={{
            fontSize: "var(--text-emphasis)",
            fontStretch: "125%",
            fontWeight: 700,
            letterSpacing: "0.14em",
          }}
        >
          ELVT
        </span>
      </div>

      <ul className="mt-2">
        {NAV.map(({ href, label, Icon }) => {
          const active = current === href || current.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex h-row items-center gap-3 px-4 text-body",
                  active ? "bg-panel-2 text-txt" : "text-txt-mute",
                ].join(" ")}
              >
                <Icon />
                <span className="flex-1">{label}</span>
                {label === "Queue" && queueCount ? (
                  <span className="elvt-num text-label text-txt-mute">
                    {queueCount}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      <form action="/auth/signout" method="post" className="mt-auto p-4">
        <button type="submit" className="elvt-button-secondary w-full">
          Sign out
        </button>
      </form>
    </nav>
  );
}
