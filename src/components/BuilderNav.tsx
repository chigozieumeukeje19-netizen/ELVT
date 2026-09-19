import Link from "next/link";

/**
 * Sub navigation for the Builder. A row of links rather than a second sidebar,
 * because the Builder has a handful of places and a nested rail would cost width the
 * library table wants.
 */
const TABS = [
  { href: "/coach/builder/exercises", label: "Movements" },
  { href: "/coach/builder/templates", label: "Templates" },
  { href: "/coach/builder/questionnaires", label: "Questionnaires" },
  { href: "/coach/builder/questions", label: "Question bank" },
  { href: "/coach/builder/exercises/review", label: "Review" },
];

export function BuilderNav({ current }: { current: string }) {
  return (
    <nav
      aria-label="Builder"
      className="mb-4 flex gap-4 overflow-x-auto border-line [border-bottom-width:1px]"
    >
      {TABS.map((tab) => {
        const active = current === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={[
              "elvt-label shrink-0 whitespace-nowrap pb-2",
              active ? "text-txt [border-bottom:1px_solid_var(--txt)]" : "",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
