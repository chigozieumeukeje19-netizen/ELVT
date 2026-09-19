import Link from "next/link";
import { humanize } from "@/components/Field";
import { EM_DASH, figureClass, type Figure } from "@/lib/design/semantic";

/**
 * The roster. A dense sortable table, one row per client, 48px rows.
 *
 * DESIGN_V2.md 3.4: a table is a table, no card wraps it, row rules only, no
 * zebra striping, numeric columns right aligned on tabular figures.
 *
 * Every figure in here arrives already resolved by the adherence semantic. The
 * table picks no colors and decides no thresholds: it renders what it is
 * given and puts the state in a title attribute so the meaning survives
 * without color. That is the whole point of the helper, and it is why the two
 * defects this table used to carry are gone rather than fixed twice.
 */

export type RosterRow = {
  id: string;
  slug: string;
  name: string;
  program: string | null;
  week: number | null;
  weeks: number | null;
  phase: string | null;
  /** Resolved figures, not raw numbers. */
  score: Figure;
  adherence: Figure;
  weight: Figure;
  lastSeen: Figure;
  lastHeard: Figure;
  limits: Figure;
};

/** One figure in one cell, with its state in words for anyone not seeing it. */
function Cell({ figure, testId }: { figure: Figure; testId?: string }) {
  return (
    <span
      className={`elvt-num ${figureClass(figure.state)}`}
      title={figure.waitingFor ?? figure.label}
      data-testid={testId}
      data-state={figure.state}
    >
      {figure.display}
    </span>
  );
}

export function RosterTable({ rows }: { rows: RosterRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-3 py-5 text-txt-secondary">
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
            <th scope="col" className="w-[80px] text-right">Score</th>
            <th scope="col" className="w-[110px] text-right">Adherence</th>
            <th scope="col" className="w-[130px] text-right">Weight</th>
            <th scope="col" className="w-[100px] text-right">Last seen</th>
            <th scope="col" className="w-[100px] text-right">Last heard</th>
            <th scope="col" className="w-[80px] text-right">Limits</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-testid="roster-row">
              <td>
                <Link href={`/coach/clients/${row.slug}`} className="text-txt font-semibold">
                  {row.name}
                </Link>
                {row.phase ? (
                  <span className="block text-small text-txt-tertiary">{humanize(row.phase)}</span>
                ) : null}
              </td>
              <td className="text-txt-secondary">
                {row.program ? humanize(row.program) : "Not started"}
              </td>
              <td className="elvt-num text-txt-secondary">
                {row.week !== null && row.weeks !== null ? `${row.week} of ${row.weeks}` : EM_DASH}
              </td>
              <td className="text-txt-secondary">{row.phase ? humanize(row.phase) : EM_DASH}</td>
              <td className="text-right"><Cell figure={row.score} /></td>
              <td className="text-right"><Cell figure={row.adherence} /></td>
              <td className="text-right"><Cell figure={row.weight} testId="weight" /></td>
              <td className="text-right"><Cell figure={row.lastSeen} /></td>
              {/*
                Touchpoints. CoachRx's own data: clients getting more than two
                coach interactions a week sit around 75 percent compliance, so
                this is a retention number rather than an activity number.
              */}
              <td className="text-right"><Cell figure={row.lastHeard} testId="touchpoints" /></td>
              {/*
                Contraindications on file. A count, never a signal: they shape
                the program and are not an open item to clear.
              */}
              <td className="text-right"><Cell figure={row.limits} testId="limits" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
