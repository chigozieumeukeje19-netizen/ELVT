import { humanize } from "@/components/Field";
import { LANE_NOTES, LANE_TITLES, LANES, type Lane } from "@/lib/engine/lanes";

/**
 * The queue, in the three lanes the coaching model actually uses.
 *
 * A flat list sorted by severity looks tidier and is worse: it hides which of
 * the three decision rules an item is under, and those rules are what tell the
 * coach whether to act today, act Monday, or reply. The lanes are the rules.
 *
 * A lane with nothing in it still shows its heading and says so. An absent
 * heading reads as a screen that failed to load; a heading saying nothing
 * trended reads as the answer, which is what it is.
 */

export type QueueRow = {
  id: string;
  lane: Lane;
  client: string;
  slug: string;
  title: string;
  detail: string;
  kind: string;
  severity: number;
  suggestedMessage: string | null;
};

export function QueueLanes({ rows }: { rows: QueueRow[] }) {
  return (
    <div data-testid="queue-lanes">
      {LANES.map((lane) => {
        const items = rows
          .filter((row) => row.lane === lane)
          .sort((a, b) => b.severity - a.severity);

        return (
          <section key={lane} className="mt-6" data-testid="queue-lane" data-lane={lane}>
            <div className="flex items-baseline justify-between gap-4 border-line pb-1 [border-bottom-width:1px]">
              <h2 className="elvt-label">{LANE_TITLES[lane]}</h2>
              <span className="elvt-num text-txt-tertiary">{items.length}</span>
            </div>
            <p className="mt-1 text-txt-tertiary">{LANE_NOTES[lane]}</p>

            {items.length === 0 ? (
              <p className="mt-2 text-txt-secondary" data-testid="lane-empty">
                {lane === "same_day"
                  ? "No flag is at a level that changes today."
                  : lane === "trend"
                    ? "Nothing has pointed the same way two weeks running."
                    : "Nobody is waiting on an answer."}
              </p>
            ) : (
              <ul className="mt-2">
                {items.map((row) => (
                  <li
                    key={row.id}
                    data-testid="lane-item"
                    className="flex items-start gap-4 border-line py-3 [border-bottom-width:1px]"
                  >
                    <span
                      aria-hidden="true"
                      className={[
                        "mt-2 h-1 w-1 shrink-0",
                        row.severity >= 4 ? "bg-flag" : row.severity >= 3 ? "bg-watch" : "bg-line",
                      ].join(" ")}
                    />

                    <span className="w-[110px] shrink-0 truncate lg:w-[180px]">{row.client}</span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{row.title}</span>
                      {row.detail ? (
                        <span className="block truncate text-txt-secondary">{row.detail}</span>
                      ) : null}
                      {row.suggestedMessage ? (
                        <span
                          className="mt-1 block max-w-[68ch] bg-raised px-3 py-2 text-txt-secondary"
                          data-testid="suggested-message"
                        >
                          {row.suggestedMessage}
                        </span>
                      ) : null}
                    </span>

                    <span className="elvt-label hidden shrink-0 pr-3 lg:inline">
                      {humanize(row.kind)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/**
 * Which lane a stored queue item belongs to.
 *
 * Stored rows carry a kind rather than a lane, because the kind is what
 * produced them and the lane is what the coach does about them. Mapping here
 * rather than at write time means changing the coaching model does not need a
 * migration.
 */
export function laneFor(kind: string, severity: number): Lane {
  if (kind === "trigger" && severity >= 4) return "same_day";
  if (kind === "retention_risk") return "same_day";
  if (kind === "checkin_submitted") return "request";
  if (kind === "approval") return "request";
  return "trend";
}
