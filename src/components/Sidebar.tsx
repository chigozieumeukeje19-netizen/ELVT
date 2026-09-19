"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BuilderIcon,
  CalendarIcon,
  LibraryIcon,
  MessagesIcon,
  QueueIcon,
  RosterIcon,
  SettingsIcon,
  SignOutIcon,
} from "@/components/icons";

/**
 * Persistent left sidebar, fixed during scroll. Square corners, no border,
 * separated from the content by a single 1px rule.
 *
 * 240px with icon and label on a desktop. Below the lg breakpoint it collapses
 * to a 44px icon rail, because a dense table needs the width back and the
 * portal is read on a phone rarely enough that icons alone will do.
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
  /** Overrides the live path. Only the preview routes pass this. */
  current?: string;
  queueCount?: number;
}) {
  const pathname = usePathname();
  const active = current ?? pathname;

  return (
    <nav
      aria-label="Portal"
      className="fixed left-0 top-0 z-10 flex h-screen w-rail flex-col border-line bg-panel [border-right-width:1px] lg:w-sidebar"
    >
      <div className="flex h-row items-center justify-center lg:justify-start lg:px-4">
        <span
          className="text-wordmark"
          style={{
            fontSize: "var(--text-emphasis)",
            fontStretch: "125%",
            fontWeight: 700,
            letterSpacing: "0.14em",
          }}
        >
          <span className="lg:hidden">E</span>
          <span className="hidden lg:inline">ELVT</span>
        </span>
      </div>

      <ul className="mt-2">
        {NAV.map(({ href, label, Icon }) => {
          const isActive = active === href || active.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "flex h-row items-center justify-center gap-3 text-body lg:justify-start lg:px-4",
                  isActive ? "bg-panel-2 text-txt" : "text-txt-mute",
                ].join(" ")}
              >
                <Icon />
                <span className="hidden flex-1 lg:inline">{label}</span>
                {label === "Queue" && queueCount ? (
                  <span className="elvt-num hidden text-label text-txt-mute lg:inline">
                    {queueCount}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      <form action="/auth/signout" method="post" className="mt-auto lg:p-4">
        <button
          type="submit"
          aria-label="Sign out"
          className="flex h-row w-full items-center justify-center gap-2 text-txt-mute lg:h-auto lg:rounded-control lg:border lg:border-line lg:py-2 lg:text-txt"
        >
          <SignOutIcon />
          <span className="hidden lg:inline">Sign out</span>
        </button>
      </form>
    </nav>
  );
}
