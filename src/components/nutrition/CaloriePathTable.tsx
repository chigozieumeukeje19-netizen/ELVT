import { humanize } from "@/components/Field";
import type { CalorieWeek } from "@/lib/nutrition/calorie-path";

/**
 * The calorie path is the nutrition screen, not a widget on it.
 *
 * Twelve to sixteen rows, every figure in a mono column so the eye can run down
 * calories and see the ramp without reading a chart. The current week carries
 * the raised surface and nothing else does, so the first thing seen is where
 * the client is right now.
 *
 * Status is a word, never a color. Projected, confirmed and edited are not
 * signals in the DESIGN.md sense, and tinting them would spend the signal
 * vocabulary on bookkeeping.
 */
export function CaloriePathTable({
  path,
  currentWeek,
}: {
  path: CalorieWeek[];
  currentWeek: number;
}) {
  if (path.length === 0) {
    return (
      <p className="text-txt-mute" data-testid="path-empty">
        No calorie path yet. Generate one from the client&rsquo;s start and goal
        numbers and it will fill this table week by week.
      </p>
    );
  }

  return (
    // Seven columns of figures do not fit a phone, and shrinking them would cost
    // the thing the screen is for. The table gets its own horizontal scroller so
    // every column is reachable and the page itself never goes sideways.
    <div className="overflow-x-auto">
      <table className="elvt-table min-w-[720px]" data-testid="calorie-path">
        <caption className="sr-only">Calorie path by week</caption>
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col" className="text-right">
              Calories
            </th>
            <th scope="col" className="text-right">
              Protein
            </th>
            <th scope="col" className="text-right">
              Carbs
            </th>
            <th scope="col" className="text-right">
              Fat
            </th>
            <th scope="col">Note</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {path.map((row) => {
            const current = row.week === currentWeek;
            return (
              <tr
                key={row.week}
                data-testid="path-row"
                aria-current={current ? "true" : undefined}
                className={current ? "bg-panel-2 text-txt" : undefined}
              >
                <th scope="row" className="elvt-num font-normal">
                  {row.week}
                </th>
                <td className="elvt-num text-right">{row.calories}</td>
                <td className="elvt-num text-right">{row.protein}g</td>
                <td className="elvt-num text-right">{row.carbs}g</td>
                <td className="elvt-num text-right">{row.fat}g</td>
                <td className="max-w-[28ch] truncate text-txt-mute">
                  {row.note || (row.isDeload ? "Deload" : "")}
                </td>
                <td className="text-txt-mute">{humanize(row.status)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
