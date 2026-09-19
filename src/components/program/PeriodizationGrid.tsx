import type { PeriodizationRow } from "@/lib/program/view";

/**
 * One movement per row, one column per week, so a whole block of progressive
 * overload can be read and edited at once rather than a week at a time.
 *
 * A dense table, so it scrolls inside itself on a narrow screen rather than
 * taking the page sideways.
 */
export function PeriodizationGrid({
  rows,
  weekCount,
  currentWeek,
}: {
  rows: PeriodizationRow[];
  weekCount: number;
  currentWeek: number;
}) {
  if (rows.length === 0) {
    return (
      <p className="max-w-[68ch] text-txt-secondary">
        Nothing to show yet. Once the program has movements on it, this grid
        edits a lift across every week of the block at once.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="elvt-table" data-testid="periodization-grid">
        <thead>
          <tr>
            <th scope="col" className="w-[220px]">Movement</th>
            {Array.from({ length: weekCount }, (_, i) => (
              <th
                key={i}
                scope="col"
                className={[
                  "w-[70px]",
                  i + 1 === currentWeek ? "text-txt" : "",
                ].join(" ")}
              >
                W{i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.movement} data-testid="periodization-row">
              <th scope="row" className="truncate px-3 text-left font-normal">
                {row.movement}
              </th>
              {row.cells.map((cell, i) => (
                <td
                  key={i}
                  className={[
                    "elvt-num",
                    cell ? "text-txt" : "text-txt-tertiary",
                    i + 1 === currentWeek ? "bg-raised" : "",
                  ].join(" ")}
                >
                  {cell ?? "·"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
