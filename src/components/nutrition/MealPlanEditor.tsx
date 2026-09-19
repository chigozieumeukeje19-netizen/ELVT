import type { PlannedMeal } from "@/lib/nutrition/meals";

/**
 * The day's meals, with the one that carries the rounding named.
 *
 * Meals are generated to sum to the day target exactly, and the split leaves a
 * few calories over. Rather than hide that, the last meal says it absorbs it.
 * A client who adds the column up and finds it right is a client who believes
 * the rest of the numbers.
 */
export function MealPlanEditor({
  meals,
  dayCalories,
  dayProtein,
  basis,
}: {
  meals: PlannedMeal[];
  dayCalories: number;
  dayProtein: number;
  basis: string;
}) {
  const summed = meals.reduce((total, meal) => total + meal.calories, 0);
  const proteinSummed = meals.reduce((total, meal) => total + meal.protein, 0);

  return (
    <div data-testid="meal-plan">
      <p className="elvt-label">{basis}</p>

      <div className="mt-2 overflow-x-auto">
        <table className="elvt-table min-w-[560px]">
          <caption className="sr-only">Meals for the day</caption>
          <thead>
            <tr>
              <th scope="col">Meal</th>
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
            </tr>
          </thead>
          <tbody>
            {meals.map((meal) => (
              <tr key={meal.key} data-testid="meal-row">
                <th scope="row" className="font-normal">
                  <span className="truncate">{meal.name}</span>
                  {meal.absorbsRounding ? (
                    <span className="elvt-label ml-2 text-txt-tertiary">
                      Takes the remainder
                    </span>
                  ) : null}
                </th>
                <td className="elvt-num text-right">{meal.calories}</td>
                <td className="elvt-num text-right">{meal.protein}g</td>
                <td className="elvt-num text-right">{meal.carbs}g</td>
                <td className="elvt-num text-right">{meal.fat}g</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr data-testid="meal-total">
              <th scope="row" className="font-normal text-txt-secondary">
                Day total
              </th>
              <td className="elvt-num text-right">{summed}</td>
              <td className="elvt-num text-right">{proteinSummed}g</td>
              <td colSpan={2} className="text-txt-secondary">
                {summed === dayCalories && proteinSummed === dayProtein
                  ? "Matches the target"
                  : `Target is ${dayCalories} and ${dayProtein}g`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
