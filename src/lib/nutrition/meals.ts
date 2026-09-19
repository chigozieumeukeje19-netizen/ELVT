/**
 * Meals for a day, and the two things that are easy to get wrong about them.
 *
 * First, they have to sum to the day's target exactly. A plan whose meals add
 * up to 2,487 against a 2,500 target teaches the client that the numbers are
 * decorative. Shares are floated, every meal is rounded down, and the last meal
 * takes whatever is left, so the column always adds up.
 *
 * Second, the day target is not always the week target. A runner's day is
 * a base plus something per mile, and a training day differs from a rest day.
 * Those overrides are computed here so the meal split and the client's card
 * cannot disagree about what today's number is.
 */

import { macrosFor, DEFAULT_FAT_RATIO } from "./calorie-path";

export type MealSlot = {
  key: string;
  name: string;
  /** Share of the day's calories. Shares across a plan need not be exact. */
  share: number;
};

export type PlannedMeal = {
  key: string;
  name: string;
  order: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** True on the meal that carries the rounding, so the UI can say so. */
  absorbsRounding: boolean;
};

/**
 * Splits a day target across named meals.
 *
 * Protein is split by the same shares as calories and then corrected the same
 * way, because protein is the number the client is actually chasing and a plan
 * that quietly loses 4g of it across five meals is wrong in the direction that
 * matters.
 */
export function planMeals(
  dayCalories: number,
  dayProtein: number,
  slots: MealSlot[],
  fatRatio: number = DEFAULT_FAT_RATIO,
): PlannedMeal[] {
  if (slots.length === 0) throw new Error("A day needs at least one meal.");

  const total = slots.reduce((sum, slot) => sum + slot.share, 0);
  if (total <= 0) throw new Error("Meal shares have to add up to something.");

  const meals: PlannedMeal[] = [];
  let caloriesLeft = dayCalories;
  let proteinLeft = dayProtein;

  slots.forEach((slot, index) => {
    const last = index === slots.length - 1;

    // Floor rather than round, so the remainder is always positive and the last
    // meal is never asked to give calories back.
    const calories = last ? caloriesLeft : Math.floor((dayCalories * slot.share) / total);
    const protein = last ? proteinLeft : Math.floor((dayProtein * slot.share) / total);

    caloriesLeft -= calories;
    proteinLeft -= protein;

    const macros = macrosFor(calories, protein, fatRatio);
    meals.push({
      key: slot.key,
      name: slot.name,
      order: index,
      calories,
      protein,
      carbs: macros.carbs,
      fat: macros.fat,
      absorbsRounding: last,
    });
  });

  return meals;
}

export type DayTargetRule = {
  /** What the day starts at before any running is counted. */
  baseCalories: number;
  baseProtein: number;
  /**
   * Added per mile run that day. This is the Rodrigo shape: a fixed plan plus
   * fuel for the distance, rather than a different number invented each week.
   */
  perMileCalories?: number;
  perMileProtein?: number;
  /** Replaces the base outright on a rest day, when the coach sets one. */
  restDayCalories?: number;
  restDayProtein?: number;
};

export type DayTarget = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** What produced this number, shown on the day card so it is never a mystery. */
  basis: string;
};

export function dayTarget(
  rule: DayTargetRule,
  day: { miles?: number; isRest?: boolean },
  fatRatio: number = DEFAULT_FAT_RATIO,
): DayTarget {
  const miles = day.miles ?? 0;

  if (day.isRest && rule.restDayCalories !== undefined) {
    const protein = rule.restDayProtein ?? rule.baseProtein;
    const { carbs, fat } = macrosFor(rule.restDayCalories, protein, fatRatio);
    return {
      calories: rule.restDayCalories,
      protein,
      carbs,
      fat,
      basis: "Rest day target",
    };
  }

  const perMile = rule.perMileCalories ?? 0;
  const calories = Math.round(rule.baseCalories + perMile * miles);
  const protein = Math.round(rule.baseProtein + (rule.perMileProtein ?? 0) * miles);

  const { carbs, fat } = macrosFor(calories, protein, fatRatio);

  return {
    calories,
    protein,
    carbs,
    fat,
    basis:
      perMile > 0 && miles > 0
        ? `${rule.baseCalories} base plus ${perMile} per mile across ${miles}`
        : "Week target",
  };
}
