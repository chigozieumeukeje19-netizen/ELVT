import Link from "next/link";
import { TrendDownIcon, TrendFlatIcon, TrendUpIcon } from "@/components/icons";
import { bandFor, bandLabel, bandTextClass } from "@/lib/design/bands";

/**
 * The marker for a column with nothing in it yet. A middle dot rather than a
 * dash, because no copy in this product uses a dash.
 */
const NO_DATA = "\u00B7";

/**
 * The roster. A dense sortable table, one row per client, 44px rows.
 *
 * DESIGN.md Part 2: signal colors appear in the adherence and weight columns
 * only. Everything else is neutral, so the flagged rows are the only colored
 * thing on the screen and the eye lands on them first. No card wraps this. A
 * table is a table.
 */

export type RosterRow = {
  id: string;
  slug: string;
  name: string;
  program: string | null;
  week: number | null;
  weeks: number | null;
  phase: string | null;
  score: number | null;
  adherence: number | null;
  weightDelta: number | null;
  lastActivityDays: number | null;
  flags: number;
};

function WeightTrend({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-txt-dim">No data</span>;
  }

  // Direction carries the meaning, not the color. Losing weight is not
  // universally good and gaining is not universally bad, so this column is
  // neutral unless the number is standing still, which is the thing worth
  // noticing on any goal.
  const Icon = delta < -0.1 ? TrendDownIcon : delta > 0.1 ? TrendUpIcon : TrendFlatIcon;
  const stalled = Math.abs(delta) <= 0.1;

  return (
    <span className={`flex items-center gap-2 ${stalled ? "text-watch" : "text-txt"}`}>
      <Icon />
      <span className="elvt-num">
        {delta > 0 ? "+" : ""}
        {delta.toFixed(1)}
      </span>
    </span>
  );
}

export function RosterTable({ rows }: { rows: RosterRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-3 py-5 text-txt-mute">
        No clients yet. Add one and send the intake link, and they show up here
        the moment they finish it.
      </p>
    );
  }

  return (
    <table className="elvt-table" data-testid="roster">
      <thead>
        <tr>
          <th scope="col" className="w-[220px]">Client</th>
          <th scope="col" className="w-[150px]">Program</th>
          <th scope="col" className="w-[90px]">Week</th>
          <th scope="col" className="w-[110px]">Phase</th>
          <th scope="col" className="w-[80px]">Score</th>
          <th scope="col" className="w-[110px]">Adherence</th>
          <th scope="col" className="w-[110px]">Weight</th>
          <th scope="col" className="w-[100px]">Last seen</th>
          <th scope="col" className="w-[80px]">Flags</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const adherenceBand = bandFor(row.adherence);
          const scoreBand = bandFor(row.score);

          return (
            <tr key={row.id} data-testid="roster-row">
              <td>
                <Link href={`/coach/clients/${row.slug}`} className="text-txt">
                  {row.name}
                </Link>
              </td>
              <td className="text-txt-mute">{row.program ?? "Not started"}</td>
              <td className="elvt-num text-txt-mute">
                {row.week !== null && row.weeks !== null
                  ? `${row.week} of ${row.weeks}`
                  : NO_DATA}
              </td>
              <td className="text-txt-mute">{row.phase ?? NO_DATA}</td>
              <td className={`elvt-num ${bandTextClass(scoreBand)}`}>
                {row.score === null ? NO_DATA : Math.round(row.score)}
              </td>
              <td
                className={`elvt-num ${bandTextClass(adherenceBand)}`}
                title={bandLabel(adherenceBand)}
              >
                {row.adherence === null ? NO_DATA : `${Math.round(row.adherence)}%`}
              </td>
              <td>
                <WeightTrend delta={row.weightDelta} />
              </td>
              <td className="elvt-num text-txt-mute">
                {row.lastActivityDays === null
                  ? "Never"
                  : row.lastActivityDays === 0
                    ? "Today"
                    : `${row.lastActivityDays}d`}
              </td>
              <td className={row.flags > 0 ? "elvt-num text-flag" : "elvt-num text-txt-dim"}>
                {row.flags > 0 ? row.flags : NO_DATA}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
