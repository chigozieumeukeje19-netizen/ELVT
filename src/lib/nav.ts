/**
 * The portal's navigation, as data.
 *
 * Its own module rather than a constant inside the sidebar so a test can read
 * it without rendering a component. Three of these links shipped pointing at
 * pages that did not exist, and the reason nothing caught it is that nothing
 * could reach the list.
 *
 * Every href here must have a page behind it. tests/unit/nav.test.ts enforces
 * that; a destination that is specified but unbuilt stays out of the nav and
 * goes in docs/OPEN_QUESTIONS.md instead.
 */
export type NavItem = { href: string; label: string; icon: NavIcon };

export type NavIcon = "queue" | "roster" | "builder" | "messages" | "settings";

export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: "Coaching",
    items: [
      { href: "/coach/queue", label: "Queue", icon: "queue" },
      { href: "/coach/clients", label: "Clients", icon: "roster" },
      { href: "/coach/messages", label: "Messages", icon: "messages" },
    ],
  },
  {
    label: "Building",
    items: [
      { href: "/coach/builder/exercises/review", label: "Builder", icon: "builder" },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/coach/settings", label: "Settings", icon: "settings" }],
  },
];
