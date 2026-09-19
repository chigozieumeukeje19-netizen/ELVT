/**
 * The grocery hub.
 *
 * Quantities are not stored. They are derived from the week the client is
 * actually on, because a list written for week 1 is wrong by week 8 and a
 * client shopping off a stale list is the most boring way to miss a target.
 *
 * Each line states the quantity its recipe was written at, and the list scales
 * every line by the ratio between the current week's calories and the week the
 * meal plan was built for. Protein lines are the exception: protein is held
 * flat across the whole block by design, so scaling them would undo that.
 */

export type GroceryItem = {
  key: string;
  name: string;
  unit: string;
  /** Quantity at the calorie level the meal plan was written for. */
  baseQuantity: number;
  /**
   * True for items bought to hit the protein number. Held flat, because the
   * calorie path holds protein flat.
   */
  isProtein?: boolean;
  category: string;
};

export type GroceryLine = {
  key: string;
  name: string;
  unit: string;
  quantity: number;
  category: string;
  /** Says whether this line moved with the week, for the "why" column. */
  scaled: boolean;
};

export function groceryList(
  items: GroceryItem[],
  planCalories: number,
  weekCalories: number,
): GroceryLine[] {
  if (planCalories <= 0) throw new Error("The meal plan has no calorie level to scale from.");
  const ratio = weekCalories / planCalories;

  return items.map((item) => {
    const scale = item.isProtein ? 1 : ratio;
    return {
      key: item.key,
      name: item.name,
      unit: item.unit,
      // Rounded to a tenth. Nobody buys 0.7431 kg of rice, and a list that
      // reads like a float is a list nobody trusts.
      quantity: Math.round(item.baseQuantity * scale * 10) / 10,
      category: item.category,
      scaled: !item.isProtein && ratio !== 1,
    };
  });
}
