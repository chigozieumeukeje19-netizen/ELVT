"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Theme } from "@/lib/design/theme";
import {
  BuilderIcon,
  MessagesIcon,
  QueueIcon,
  RosterIcon,
  SettingsIcon,
  SignOutIcon,
} from "@/components/icons";
import { NAV, type NavIcon } from "@/lib/nav";

const ICONS: Record<NavIcon, (props: { size?: number }) => React.ReactElement> = {
  queue: QueueIcon,
  roster: RosterIcon,
  builder: BuilderIcon,
  messages: MessagesIcon,
  settings: SettingsIcon,
};

/**
 * Persistent left sidebar, fixed during scroll. DESIGN_V2.md 3.1.
 *
 * 248px on the page surface, with no border and no panel color. v1 gave it a
 * panel background and a hairline rule; v2 carries separation by lightness
 * instead, so the sidebar blends with the page and the active item is the only
 * lit surface in it. Below lg it collapses to a 64px icon rail, because a dense
 * table needs the width back.
 *
 * The wordmark is the only place ELVT gold appears in the entire portal. It is
 * brand identity, not a UI accent; using it on a button would pull the portal
 * toward the cream and gold client-app look, which is hard fail 0. The 3px
 * marker on the active item is the one exception the spec grants it.
 *
 * Every destination here has a page behind it. Calendar and Library were in
 * this list with nothing on the other end, which is the same defect as the
 * Settings 404 and is recorded in docs/OPEN_QUESTIONS.md. They come back when
 * they exist; tests/unit/nav.test.ts fails the build if one goes dead again.
 */


export function Sidebar({
  current,
  queueCount,
  theme = "dark",
}: {
  /** Overrides the live path. Only the preview routes pass this. */
  current?: string;
  queueCount?: number;
  /** The server's answer, so the toggle's first paint is never wrong. */
  theme?: Theme;
}) {
  const pathname = usePathname();
  const active = current ?? pathname;

  return (
    <nav
      aria-label="Portal"
      className="fixed left-0 top-0 z-10 flex h-screen w-rail flex-col bg-page lg:w-sidebar"
    >
      <div className="flex h-topbar items-center justify-center lg:justify-start lg:px-4">
        <span
          className="text-wordmark"
          style={{
            fontSize: "20px",
            fontStretch: "125%",
            fontWeight: 700,
            letterSpacing: "0.14em",
          }}
        >
          <span className="lg:hidden">E</span>
          <span className="hidden lg:inline">ELVT</span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {NAV.map((group) => (
          <div key={group.label} className="mt-4 lg:px-3">
            <p className="hidden px-2 pb-1 text-caption text-txt-tertiary lg:block">
              {group.label}
            </p>
            <ul>
              {group.items.map(({ href, label, icon }) => {
                const Icon = ICONS[icon];
                const isActive = active === href || active.startsWith(`${href}/`);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={isActive ? "page" : undefined}
                      data-active={isActive ? "true" : undefined}
                      className={[
                        "relative flex h-control items-center justify-center gap-3 rounded-md text-body lg:justify-start lg:px-2",
                        isActive
                          ? "bg-card text-txt shadow-lift-1"
                          : "text-txt-secondary hover:bg-hover",
                      ].join(" ")}
                    >
                      {/*
                        3px on the left edge, square. The spec calls it a dot;
                        a rounded one is a pill shape outside a status pill,
                        which tell 5 fails and the audit catches.
                      */}
                      {isActive ? (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-2 h-5 w-marker bg-wordmark"
                        />
                      ) : null}
                      <Icon size={18} />
                      <span className="hidden flex-1 lg:inline">{label}</span>
                      {label === "Queue" && queueCount ? (
                        <span className="elvt-num hidden text-caption text-txt-secondary lg:inline">
                          {queueCount}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-2 pb-4 lg:flex-row lg:px-4">
        <ThemeToggle theme={theme} />
        <form action="/auth/signout" method="post" className="lg:flex-1">
          <button
            type="submit"
            aria-label="Sign out"
            className="flex h-control w-full items-center justify-center gap-2 rounded-md text-txt-secondary hover:bg-hover lg:px-2"
          >
            <SignOutIcon size={18} />
            <span className="hidden lg:inline">Sign out</span>
          </button>
        </form>
      </div>
    </nav>
  );
}
