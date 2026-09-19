import type { GroceryLine } from "@/lib/nutrition/grocery";

/**
 * The shopping list for the week the client is actually on.
 *
 * Quantities are derived rather than stored, so a list written for week 1 does
 * not send the client out with week 1 quantities in week 8. The "why" column
 * says which lines moved and which did not, because protein is held flat by the
 * calorie path and a client who sees chicken unchanged should know it is on
 * purpose.
 */
export function GroceryHub({
  lines,
  weekCalories,
  planCalories,
}: {
  lines: GroceryLine[];
  weekCalories: number;
  planCalories: number;
}) {
  if (lines.length === 0) {
    return (
      <p className="text-txt-secondary" data-testid="grocery-empty">
        Nothing on the list. Add the items the meal plan is built from and the
        quantities will follow the week&rsquo;s target.
      </p>
    );
  }

  const categories = [...new Set(lines.map((line) => line.category))];

  return (
    <div data-testid="grocery-hub">
      <p className="elvt-label">
        Scaled to week {weekCalories} from a plan written at {planCalories}
      </p>

      <div className="mt-2 flex flex-col gap-4">
        {categories.map((category) => (
          <section key={category}>
            <p className="elvt-label">{category}</p>
            <ul className="mt-1">
              {lines
                .filter((line) => line.category === category)
                .map((line) => (
                  <li
                    key={line.key}
                    data-testid="grocery-line"
                    className="flex h-row items-center justify-between gap-3 border-line [border-bottom-width:1px]"
                  >
                    <span className="min-w-0 truncate">{line.name}</span>
                    <span className="flex shrink-0 items-center gap-4">
                      <span className="elvt-num">
                        {line.quantity} {line.unit}
                      </span>
                      <span className="elvt-label w-[9ch] text-txt-tertiary">
                        {line.scaled ? "Scaled" : "Held flat"}
                      </span>
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
