import type { WeekView } from "@/lib/program/view";

/**
 * The hybrid stress rail. Spec 6.4.
 *
 * Strength and running on one scale, with the flags that only exist because
 * both are on it: legs next to a hard run, two hard runs together, a mileage
 * ramp, a week above the block average, a deload that is not one.
 *
 * Severity uses the two signal colors Part 2 already defines. Nothing here
 * invents a third.
 */
export function StressRail({ week }: { week: WeekView }) {
  return (
    <aside aria-label="Week load" className="w-[260px] shrink-0">
      <h2 className="elvt-label">Week load</h2>

      <dl className="mt-3">
        <div className="flex h-row items-center justify-between border-line [border-top-width:1px]">
          <dt className="text-txt-secondary">Stress</dt>
          <dd className="elvt-num">{week.stress}</dd>
        </div>
        <div className="flex h-row items-center justify-between border-line [border-top-width:1px]">
          <dt className="text-txt-secondary">Planned miles</dt>
          <dd className="elvt-num">{week.mileage}</dd>
        </div>
        <div className="flex h-row items-center justify-between border-line [border-top-width:1px]">
          <dt className="text-txt-secondary">Deload</dt>
          <dd className="text-txt">{week.isDeload ? "Yes" : "No"}</dd>
        </div>
      </dl>

      <h2 className="elvt-label mt-5">Flags</h2>
      {week.flags.length === 0 ? (
        <p className="mt-2 text-txt-secondary">
          Nothing on this week reads as a conflict.
        </p>
      ) : (
        <ul className="mt-2" data-testid="stress-flags">
          {week.flags.map((flag, i) => (
            <li
              key={`${flag.kind}-${i}`}
              className="flex gap-2 border-line py-2 [border-top-width:1px]"
            >
              <span
                aria-hidden="true"
                className={[
                  "mt-1 h-1 w-1 shrink-0",
                  flag.severity === "flag" ? "bg-flag" : "bg-watch",
                ].join(" ")}
              />
              <span
                className={
                  flag.severity === "flag" ? "text-flag" : "text-watch"
                }
              >
                {flag.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
