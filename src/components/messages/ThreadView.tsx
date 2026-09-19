import { bandTextClass } from "@/lib/design/bands";
import type { TouchpointCount } from "@/lib/messages/touchpoints";

export type ThreadRow = {
  id: string;
  clientId: string;
  slug: string;
  name: string;
  lastBody: string;
  lastAt: string;
  lastFrom: "coach" | "client";
  unread: boolean;
  scheduled: number;
  touchpoints: TouchpointCount;
};

/**
 * The inbox, ordered by who has heard from you least.
 *
 * Not by most recent, which is what every messaging app does and is exactly
 * wrong here: the thread at the top of a recency list is the client you are
 * already talking to. The one who needs a message is the one who has not sent
 * you anything, and a recency list buries them.
 */
export function ThreadList({ rows }: { rows: ThreadRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-txt-secondary" data-testid="threads-empty">
        No threads yet. A review or a trigger message starts one, and the client
        can answer in it.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="elvt-table min-w-[760px]" data-testid="thread-list">
        <caption className="sr-only">Message threads</caption>
        <thead>
          <tr>
            <th scope="col">Client</th>
            <th scope="col">Last message</th>
            <th scope="col" className="text-right">Last heard</th>
            <th scope="col" className="text-right">This week</th>
            <th scope="col">Scheduled</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-testid="thread-row">
              <th scope="row" className="max-w-[22ch] truncate font-normal">
                {row.name}
              </th>
              <td className="max-w-[40ch] truncate text-txt-secondary">
                {row.lastFrom === "client" ? "They: " : "You: "}
                {row.lastBody}
              </td>
              <td
                className={`elvt-num text-right ${bandTextClass(row.touchpoints.band)}`}
                data-testid="days-since"
              >
                {row.touchpoints.daysSinceLast === null
                  ? "never"
                  : row.touchpoints.daysSinceLast === 0
                    ? "today"
                    : `${row.touchpoints.daysSinceLast}d`}
              </td>
              <td className={`elvt-num text-right ${bandTextClass(row.touchpoints.band)}`}>
                {row.touchpoints.thisWeek}
              </td>
              <td className="elvt-num text-txt-secondary">{row.scheduled || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
