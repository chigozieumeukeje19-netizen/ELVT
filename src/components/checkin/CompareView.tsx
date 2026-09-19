/**
 * One question across every week it was asked.
 *
 * This is the view that turns a form into a signal. The three decision rules
 * say one bad week is noise and two is a trend, and a coach cannot apply that
 * rule from a list of submissions. They can from a row.
 *
 * Weeks where the question was not asked show as a gap rather than a zero, so
 * a question that only appeared for three weeks does not read as a collapse.
 */
export type CompareRow = {
  questionKey: string;
  text: string;
  /** One entry per week, in week order. null means the question was not asked. */
  values: { week: number; value: string | number | null }[];
};

export function CompareView({ rows, weeks }: { rows: CompareRow[]; weeks: number[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-txt-mute" data-testid="compare-empty">
        Nothing to compare yet. Two weekly check-ins is enough for a trend, so
        this fills in once the second one is submitted.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="elvt-table min-w-[640px]" data-testid="compare-view">
        <caption className="sr-only">One question across weeks</caption>
        <thead>
          <tr>
            <th scope="col">Question</th>
            {weeks.map((week) => (
              <th key={week} scope="col" className="text-right">
                {week}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.questionKey} data-testid="compare-row">
              <th scope="row" className="max-w-[34ch] truncate font-normal">
                {row.text}
              </th>
              {weeks.map((week) => {
                const entry = row.values.find((value) => value.week === week);
                const missing = !entry || entry.value === null;
                return (
                  <td
                    key={week}
                    className={`text-right ${missing ? "text-txt-dim" : "elvt-num"}`}
                    data-testid="compare-cell"
                  >
                    {/* A gap, not a zero. A question that was not asked is not
                        a week the client scored nothing on. */}
                    {missing ? "not asked" : String(entry.value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
