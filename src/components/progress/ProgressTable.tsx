import { formatValue, type Series } from "@/lib/progress/metrics";

/**
 * The same numbers as a table.
 *
 * Present because a chart is not the only way to read data and should not be
 * the only way offered: a reader who cannot see the marks, or who wants the
 * exact figure for a Tuesday, needs the rows. It is also what the CSV export
 * writes, so what is downloaded is what was on screen.
 */
export function ProgressTable({ series }: { series: Series[] }) {
  const dates = [
    ...new Set(series.flatMap((one) => one.points.map((point) => point.date))),
  ].sort().reverse();

  if (dates.length === 0) {
    return (
      <p className="text-txt-mute" data-testid="progress-table-empty">
        Nothing logged in this range. Try a longer one, or check the client has
        been using the app.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="elvt-table min-w-[560px]" data-testid="progress-table">
        <caption className="sr-only">Every reading in the selected range</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {series.map((one) => (
              <th key={one.metric} scope="col" className="text-right">
                {one.spec.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((date) => (
            <tr key={date} data-testid="progress-row">
              <th scope="row" className="elvt-num font-normal">
                {date}
              </th>
              {series.map((one) => {
                const point = one.points.find((candidate) => candidate.date === date);
                return (
                  <td key={one.metric} className="elvt-num text-right">
                    {point?.value === null || point?.value === undefined
                      ? <span className="text-txt-dim">not logged</span>
                      : formatValue(point.value, one.spec)}
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
