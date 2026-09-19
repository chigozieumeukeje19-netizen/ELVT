import Link from "next/link";
import { TrendDownIcon, TrendFlatIcon, TrendUpIcon } from "@/components/icons";
import { bandFor, bandLabel, bandTextClass } from "@/lib/design/bands";
import { STRONG_WEEK } from "@/lib/messages/touchpoints";

/**
 * The marker for a column with nothing in it yet. A middle dot rather than a
 * dash, because no copy in this product uses a dash.
 */
const NO_DATA = "\u00B7";

/** Turns a stored enum value into something a person reads. */
function label(value: string | null): string | null {
  if (!value) return null;
  const words = value.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

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
  /** Coach interactions that actually reached them this week. */
  touchpoints: number | null;
  /** Days since the last one, or null when there has never been one. */
  daysSinceTouch: number | null;
};

/**
 * The touchpoint column's color.
 *
 * Its own banding rather than bandFor, because this is a count against a
 * target, not a percentage. Two a week is the number CoachRx's compliance data
 * points at, so two is on plan and none is the thing to fix.
 */
function touchBand(count: number | null): string {
  if (count === null || count === 0) return "text-flag";
  if (count >= STRONG_WEEK) return "text-ok";
  return "text-watch";
}

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
    // The column widths below are what make the table readable. On a narrow
    // viewport the table scrolls inside this container rather than pushing the
    // page sideways.
    <div className="overflow-x-auto">
      <table className="elvt-table" data-testid="roster">
        <thead>
          <tr>
            <th scope="col" className="w-[220px]">Client</th>
            <th scope="col" className="w-[150px]">Program</th>
            <th scope="col" className="w-[90px]">Week</th>
            <th scope="col" className="w-[110px]">Status</th>
            <th scope="col" className="w-[80px]">Score</th>
            <th scope="col" className="w-[110px]">Adherence</th>
            <th scope="col" className="w-[110px]">Weight</th>
            <th scope="col" className="w-[100px]">Last seen</th>
            <th scope="col" className="w-[100px]">Last heard</th>
            <th scope="col" className="w-[80px]">Limits</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const adherenceBand = bandFor(row.adherence);

            return (
              <tr key={row.id} data-testid="roster-row">
                <td>
                  <Link href={`/coach/clients/${row.slug}`} className="text-txt">
                    {row.name}
                  </Link>
                </td>
                <td className="text-txt-mute">{label(row.program) ?? "Not started"}</td>
                <td className="elvt-num text-txt-mute">
                  {row.week !== null && row.weeks !== null
                    ? `${row.week} of ${row.weeks}`
                    : NO_DATA}
                </td>
                <td className="text-txt-mute">{label(row.phase) ?? NO_DATA}</td>
                <td className="elvt-num text-txt">
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
                {/*
                  Touchpoints. CoachRx's own data: clients getting more than two
                  coach interactions a week sit around 75 percent compliance, so
                  this is a retention number rather than an activity number, and
                  it counts what actually reached the client.
                */}
                <td
                  className={`elvt-num ${touchBand(row.touchpoints)}`}
                  data-testid="touchpoints"
                  title="Coach messages and reviews that reached them this week"
                >
                  {row.daysSinceTouch === null
                    ? "Never"
                    : row.daysSinceTouch === 0
                      ? "Today"
                      : `${row.daysSinceTouch}d`}
                  {row.touchpoints ? (
                    <span className="ml-2 text-txt-dim">{row.touchpoints}</span>
                  ) : null}
                </td>
                <td
                  className="elvt-num text-txt-mute"
                  title="Contraindications on file. These shape the program; they are not an open flag."
                >
                  {row.flags > 0 ? row.flags : NO_DATA}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
