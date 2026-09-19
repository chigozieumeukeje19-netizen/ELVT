import { describe, expect, it } from "vitest";
import {
  DEFAULT_FAT_RATIO,
  editWeek,
  generateCaloriePath,
  macrosFor,
  PATH_SHAPES,
  type CaloriePathInput,
} from "@/lib/nutrition/calorie-path";
import { dayTarget, planMeals } from "@/lib/nutrition/meals";
import { groceryList } from "@/lib/nutrition/grocery";

/** A twelve week fat loss block with the usual two deloads. */
const BLOCK: CaloriePathInput = {
  weekCount: 12,
  startCalories: 2650,
  endCalories: 2200,
  protein: 190,
  deloadWeeks: [4, 8],
  shape: "linear",
};

describe("calorie path", () => {
  it("holds protein identical in every week, for every shape", () => {
    for (const shape of PATH_SHAPES) {
      const path = generateCaloriePath({
        ...BLOCK,
        shape,
        mileage: shape === "mileage_linked" ? MILEAGE : undefined,
      });
      const proteins = new Set(path.map((row) => row.protein));
      expect(proteins, `${shape} moved protein`).toEqual(new Set([BLOCK.protein]));
    }
  });

  it("carries the previous week's number through a deload", () => {
    const path = generateCaloriePath(BLOCK);
    for (const week of BLOCK.deloadWeeks!) {
      expect(path[week - 1].calories, `week ${week}`).toBe(path[week - 2].calories);
      expect(path[week - 1].isDeload).toBe(true);
      expect(path[week - 1].note).toContain("held");
    }
  });

  it("lands the final week on the goal state exactly, for every shape", () => {
    for (const shape of PATH_SHAPES) {
      const path = generateCaloriePath({
        ...BLOCK,
        shape,
        mileage: shape === "mileage_linked" ? MILEAGE : undefined,
      });
      expect(path[path.length - 1].calories, shape).toBe(BLOCK.endCalories);
    }
  });

  it("lands the goal state even when the final week is a deload", () => {
    // Rule 3 beats rule 2 where they collide, and the row says which.
    const path = generateCaloriePath({ ...BLOCK, deloadWeeks: [4, 8, 12] });
    expect(path[11].calories).toBe(BLOCK.endCalories);
    expect(path[11].note).toContain("goal state");
  });

  it("takes the whole reduction out of carbs and fat", () => {
    const path = generateCaloriePath(BLOCK);
    const first = path[0];
    const last = path[path.length - 1];

    const calorieDrop = first.calories - last.calories;
    const proteinKcalDrop = (first.protein - last.protein) * 4;
    const carbFatKcalDrop = (first.carbs - last.carbs) * 4 + (first.fat - last.fat) * 9;

    expect(proteinKcalDrop).toBe(0);
    expect(carbFatKcalDrop).toBe(calorieDrop);
  });

  it("makes every week's macros add up to its calories exactly", () => {
    for (const shape of PATH_SHAPES) {
      const path = generateCaloriePath({
        ...BLOCK,
        shape,
        mileage: shape === "mileage_linked" ? MILEAGE : undefined,
      });
      for (const row of path) {
        expect(row.protein * 4 + row.carbs * 4 + row.fat * 9, `${shape} week ${row.week}`).toBe(
          row.calories,
        );
      }
    }
  });

  it("stays within 3g of the intended fat split while doing it", () => {
    // The exactness above is bought by walking fat off its ideal. That walk has
    // to stay small, or the split stops being the split the coach chose.
    for (let calories = 1600; calories <= 3600; calories += 1) {
      const macros = macrosFor(calories, 190);
      const ideal = ((calories - 190 * 4) * DEFAULT_FAT_RATIO) / 9;
      expect(Math.abs(macros.fat - ideal), `${calories} kcal`).toBeLessThanOrEqual(3);
    }
  });

  it("refuses a target that protein alone overshoots", () => {
    expect(() => macrosFor(700, 190)).toThrow(/more than/);
  });

  it("refuses the mileage shape without mileage", () => {
    expect(() => generateCaloriePath({ ...BLOCK, shape: "mileage_linked" })).toThrow(/one mileage entry/);
  });

  it("feeds the heaviest running week more than the lightest", () => {
    const path = generateCaloriePath({ ...BLOCK, shape: "mileage_linked", mileage: MILEAGE });
    // Weeks 6 and 7 carry the same calendar position give or take, but week 6
    // runs 34 miles and week 7 runs 18.
    expect(path[5].calories).toBeGreaterThan(path[6].calories);
  });
});

/** Peak and down weeks, so the mileage shape has something to bend around. */
const MILEAGE = [16, 20, 24, 14, 26, 34, 18, 16, 32, 36, 22, 12];

describe("editing a week", () => {
  it("does not move later weeks", () => {
    const path = generateCaloriePath(BLOCK);
    const edited = editWeek(path, 6, 2400);

    expect(edited[5].calories).toBe(2400);
    expect(edited[5].status).toBe("edited");
    for (let week = 7; week <= 12; week += 1) {
      expect(edited[week - 1], `week ${week}`).toEqual(path[week - 1]);
    }
  });

  it("re-ramps from here only when asked, and still lands the goal state", () => {
    const path = generateCaloriePath(BLOCK);
    const edited = editWeek(path, 6, 2400, { reRampFromHere: true });

    expect(edited[5].calories).toBe(2400);
    expect(edited[11].calories).toBe(BLOCK.endCalories);

    const moved = edited.slice(6, 11).some((row, i) => row.calories !== path[6 + i].calories);
    expect(moved).toBe(true);

    // Weeks before the edit are untouched either way.
    for (let week = 1; week <= 5; week += 1) {
      expect(edited[week - 1]).toEqual(path[week - 1]);
    }
  });

  it("keeps protein flat through an edit", () => {
    const path = generateCaloriePath(BLOCK);
    const edited = editWeek(path, 6, 2400, { reRampFromHere: true });
    expect(new Set(edited.map((row) => row.protein))).toEqual(new Set([BLOCK.protein]));
  });
});

const SLOTS = [
  { key: "breakfast", name: "Breakfast", share: 0.25 },
  { key: "lunch", name: "Lunch", share: 0.3 },
  { key: "snack", name: "Snack", share: 0.1 },
  { key: "dinner", name: "Dinner", share: 0.35 },
];

describe("meals", () => {
  it("sums exactly to the day target, with the last meal absorbing the rounding", () => {
    // Every awkward total in the range, not one convenient one.
    for (let calories = 1900; calories <= 3100; calories += 1) {
      const meals = planMeals(calories, 190, SLOTS);
      const sum = meals.reduce((total, meal) => total + meal.calories, 0);
      expect(sum, `${calories} kcal`).toBe(calories);
      expect(meals[meals.length - 1].absorbsRounding).toBe(true);
      expect(meals.slice(0, -1).every((meal) => !meal.absorbsRounding)).toBe(true);
    }
  });

  it("sums protein exactly too", () => {
    for (let protein = 120; protein <= 260; protein += 1) {
      const meals = planMeals(2500, protein, SLOTS);
      expect(meals.reduce((total, meal) => total + meal.protein, 0), `${protein}g`).toBe(protein);
    }
  });

  it("makes each meal's own macros add up", () => {
    for (const meal of planMeals(2487, 193, SLOTS)) {
      expect(meal.protein * 4 + meal.carbs * 4 + meal.fat * 9, meal.name).toBe(meal.calories);
    }
  });
});

describe("day targets", () => {
  it("supports a base plus a per mile allowance", () => {
    const rule = { baseCalories: 2400, baseProtein: 190, perMileCalories: 100 };
    expect(dayTarget(rule, { miles: 0 }).calories).toBe(2400);
    expect(dayTarget(rule, { miles: 8 }).calories).toBe(3200);
    expect(dayTarget(rule, { miles: 8 }).basis).toContain("per mile");
  });

  it("uses the rest day number when one is set", () => {
    const rule = { baseCalories: 2400, baseProtein: 190, restDayCalories: 2150 };
    expect(dayTarget(rule, { isRest: true }).calories).toBe(2150);
    expect(dayTarget(rule, { isRest: false }).calories).toBe(2400);
  });

  it("keeps a day's macros exact at every mileage", () => {
    const rule = { baseCalories: 2400, baseProtein: 190, perMileCalories: 97 };
    for (let miles = 0; miles <= 26; miles += 1) {
      const target = dayTarget(rule, { miles });
      expect(target.protein * 4 + target.carbs * 4 + target.fat * 9, `${miles} miles`).toBe(
        target.calories,
      );
    }
  });
});

const BASKET = [
  { key: "rice", name: "Jasmine rice", unit: "kg", baseQuantity: 2, category: "Carbs" },
  { key: "oats", name: "Rolled oats", unit: "kg", baseQuantity: 1.5, category: "Carbs" },
  { key: "chicken", name: "Chicken breast", unit: "kg", baseQuantity: 2.5, isProtein: true, category: "Protein" },
  { key: "oil", name: "Olive oil", unit: "ml", baseQuantity: 500, category: "Fats" },
];

describe("grocery list", () => {
  it("scales quantities with the current week's target", () => {
    const list = groceryList(BASKET, 2650, 2200);
    const rice = list.find((line) => line.key === "rice")!;
    expect(rice.quantity).toBeLessThan(2);
    expect(rice.scaled).toBe(true);
  });

  it("holds protein items flat, because the path holds protein flat", () => {
    const list = groceryList(BASKET, 2650, 2200);
    const chicken = list.find((line) => line.key === "chicken")!;
    expect(chicken.quantity).toBe(2.5);
    expect(chicken.scaled).toBe(false);
  });

  it("changes nothing when the week matches the plan", () => {
    for (const line of groceryList(BASKET, 2650, 2650)) {
      expect(line.scaled).toBe(false);
    }
  });
});
