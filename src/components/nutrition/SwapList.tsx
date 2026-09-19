/**
 * Swaps, grouped by what they are standing in for.
 *
 * A swap is a like for like trade inside one macro category, so the day still
 * adds up after it. The portion is stated in the unit the client actually
 * weighs, never per 100g, because per 100g math is where clients lose the plot.
 */

export type SwapOption = {
  key: string;
  name: string;
  portion: string;
  calories: number;
  protein: number;
};

export type SwapGroup = {
  category: string;
  swapsFor: string;
  options: SwapOption[];
};

export function SwapList({ groups }: { groups: SwapGroup[] }) {
  if (groups.length === 0) {
    return (
      <p className="text-txt-secondary" data-testid="swaps-empty">
        No swaps set up yet. Add one per macro category and the client can trade
        without leaving the day&rsquo;s numbers.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="swap-list">
      {groups.map((group) => (
        <section key={group.category}>
          <p className="elvt-label">{group.category}</p>
          <p className="text-txt-secondary">Instead of {group.swapsFor}</p>

          <ul className="mt-2">
            {group.options.map((option) => (
              <li
                key={option.key}
                data-testid="swap-option"
                className="flex h-row items-center justify-between gap-3 border-line [border-bottom-width:1px]"
              >
                <span className="min-w-0 truncate">{option.name}</span>
                <span className="flex shrink-0 items-center gap-4">
                  <span className="text-txt-secondary">{option.portion}</span>
                  <span className="elvt-num">{option.calories}</span>
                  <span className="elvt-num text-txt-secondary">{option.protein}g</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
