import { humanize } from "@/components/Field";
import type { WeekView } from "@/lib/program/view";

/**
 * Weeks 1 to N with phase bands. The first thing the eye hits on this screen is
 * the current week, so it is the only one carrying the raised surface.
 *
 * Phase bands are drawn with the neutral surface steps rather than color, since
 * DESIGN.md Part 2 gives color to signals only. A phase is not a signal.
 */
export function WeekStrip({
  weeks,
  currentWeek,
  hrefFor,
}: {
  weeks: WeekView[];
  currentWeek: number;
  hrefFor: (weekNumber: number) => string;
}) {
  return (
    <nav aria-label="Weeks" className="overflow-x-auto">
      <PhaseBands weeks={weeks} />
      <ul className="flex min-w-max" data-testid="week-strip">
        {weeks.map((week) => {
          const selected = week.weekNumber === currentWeek;
          const worst = week.flags.some((f) => f.severity === "flag")
            ? "flag"
            : week.flags.length > 0
              ? "watch"
              : null;

          return (
            <li key={week.weekNumber}>
              <a
                href={hrefFor(week.weekNumber)}
                aria-current={selected ? "page" : undefined}
                data-testid="week-chip"
                className={[
                  "flex h-row w-[88px] flex-col justify-center border-line px-2 [border-right-width:1px]",
                  selected ? "bg-raised text-txt" : "text-txt-secondary",
                ].join(" ")}
              >
                <span className="flex items-center gap-1">
                  <span className="elvt-num text-body">{week.weekNumber}</span>
                  {worst ? (
                    <span
                      aria-hidden="true"
                      className={[
                        "h-1 w-1",
                        worst === "flag" ? "bg-flag" : "bg-watch",
                      ].join(" ")}
                    />
                  ) : null}
                </span>
                <span className="elvt-label truncate">
                  {week.isDeload ? "Deload" : (week.phase ?? "")}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The phase bands above the strip, so a block is readable at a glance. */
function PhaseBands({ weeks }: { weeks: WeekView[] }) {
  const runs: { phase: string; span: number }[] = [];
  for (const week of weeks) {
    const name = week.phase ?? "Unphased";
    const last = runs[runs.length - 1];
    if (last && last.phase === name) last.span += 1;
    else runs.push({ phase: name, span: 1 });
  }

  return (
    <div className="flex min-w-max" data-testid="phase-bands">
      {runs.map((run, i) => (
        <div
          key={`${run.phase}-${i}`}
          style={{ width: run.span * 88 }}
          className={[
            "elvt-label truncate border-line px-2 py-1 [border-right-width:1px]",
            i % 2 === 0 ? "bg-card" : "bg-raised",
          ].join(" ")}
        >
          {humanize(run.phase)}
        </div>
      ))}
    </div>
  );
}
