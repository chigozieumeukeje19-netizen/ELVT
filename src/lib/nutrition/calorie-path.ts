/**
 * The calorie path: a different number for every week of the block, generated
 * from where the client starts and where the program has to end.
 *
 * Four rules hold for every shape, and they are what the tests are about:
 *
 *   1. Protein never moves. It is the one number held flat across the whole
 *      block, so every calorie that comes out comes out of carbs and fat.
 *   2. A deload week carries the previous week's number. Dropping calories in
 *      the week built for recovery is the mistake this exists to prevent.
 *   3. The final week equals the goal state exactly. Not approximately: the
 *      whole point of generating a path rather than stepping by hand is that
 *      week 12 lands on the number the program was sold on.
 *   4. Macros sum to the week's calories exactly, with no rounding drift, so a
 *      client adding up their day never finds it 7 short of the target.
 *
 * Where rule 2 and rule 3 collide, which happens when the last week is marked
 * deload, rule 3 wins and the row says so in its note. A deload final week is
 * a programming choice the coach can still make; silently missing the goal
 * state is not.
 */

export const PATH_SHAPES = ["linear", "front_loaded", "mileage_linked", "rising"] as const;
export type PathShape = (typeof PATH_SHAPES)[number];

export const CALORIE_STATUSES = ["projected", "confirmed", "edited"] as const;
export type CalorieStatus = (typeof CALORIE_STATUSES)[number];

export type CaloriePathInput = {
  weekCount: number;
  startCalories: number;
  endCalories: number;
  /** Grams per day. Held flat across every week, deloads included. */
  protein: number;
  /** Week numbers, one based. */
  deloadWeeks?: number[];
  shape: PathShape;
  /**
   * Planned mileage per week, one entry per week. Required by the
   * mileage_linked shape and ignored by the others: a week that runs more eats
   * more, so the path bends around the running rather than ignoring it.
   */
  mileage?: number[];
  /**
   * Share of the non protein calories that comes from fat. One number, stated
   * here rather than assumed at three call sites.
   */
  fatRatio?: number;
};

export type CalorieWeek = {
  week: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  isDeload: boolean;
  note: string;
  status: CalorieStatus;
};

export const DEFAULT_FAT_RATIO = 0.3;

/**
 * How far a running week is allowed to pull the path off the calendar ramp, at
 * the point of maximum effect. 0.4 means the heaviest week sits a fifth of the
 * block behind schedule and the lightest a fifth ahead.
 */
const MILEAGE_BEND = 0.4;

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/**
 * Splits a week's calories into carbs and fat around a fixed protein, landing
 * on the calorie number exactly.
 *
 * Integer grams cannot hit every calorie total at the ideal ratio: 4 and 9 do
 * not divide every remainder. Rather than let the difference drift into the
 * displayed number, fat is walked away from its ideal gram count until the
 * carbohydrate remainder divides by 4. Because 9 mod 4 is 1, every fourth step
 * hits, so the answer is always within 3g of the ideal split and the total is
 * always exact.
 */
export function macrosFor(
  calories: number,
  protein: number,
  fatRatio: number = DEFAULT_FAT_RATIO,
): { protein: number; carbs: number; fat: number } {
  const nonProtein = calories - protein * KCAL_PER_G.protein;
  if (nonProtein < 0) {
    throw new Error(
      `Protein alone is ${protein * KCAL_PER_G.protein} kcal, which is more than the ${calories} kcal target.`,
    );
  }

  const idealFat = Math.round((nonProtein * fatRatio) / KCAL_PER_G.fat);

  for (let step = 0; step <= 4; step += 1) {
    for (const fat of step === 0 ? [idealFat] : [idealFat - step, idealFat + step]) {
      if (fat < 0) continue;
      const carbKcal = nonProtein - fat * KCAL_PER_G.fat;
      if (carbKcal < 0) continue;
      if (carbKcal % KCAL_PER_G.carbs === 0) {
        return { protein, carbs: carbKcal / KCAL_PER_G.carbs, fat };
      }
    }
  }

  // Unreachable while KCAL_PER_G.fat mod KCAL_PER_G.carbs is 1, which the
  // conformance test asserts, but a wrong answer here would be invisible.
  throw new Error(`No exact macro split for ${calories} kcal at ${protein}g protein.`);
}

/**
 * Where a week sits between the start and the end.
 *
 * `index` is the week's position among the weeks that actually ramp, which is
 * not its week number once deloads are in the block. `week` is the week number,
 * and mileage is indexed by it: reading mileage at the ramp position instead
 * silently shifts every week's running total after the first deload.
 */
function progressFor(
  shape: PathShape,
  index: number,
  span: number,
  week: number,
  mileage?: number[],
): number {
  if (span <= 0) return 1;
  const t = index / span;

  switch (shape) {
    case "linear":
      return t;

    // Most of the change taken early, while adherence and glycogen are highest,
    // then a long flat tail. An ease out curve, not a guess.
    case "front_loaded":
      return 1 - (1 - t) ** 2;

    // The mirror. Gentle at first so a gaining client is not force fed in week
    // one, steeper as work capacity climbs.
    case "rising":
      return t ** 2;

    // Calories track the running. A week that runs further sits nearer the
    // start of the path than a pure ramp would put it, because the deficit is
    // already being paid in miles, and a down week takes more of the cut.
    //
    // The bend is applied through a bell that is zero at both ends, so the
    // mileage moves the middle of the path and never the start or the goal
    // state. Without that, a heavy final week would pull the block off its
    // end point, which rule 3 does not allow.
    case "mileage_linked": {
      if (!mileage || mileage.length === 0) return t;
      const max = Math.max(...mileage);
      const min = Math.min(...mileage);
      if (max === min) return t;

      // 0 on the biggest running week, 1 on the smallest.
      const relief = (max - mileage[week - 1]) / (max - min);
      const bell = 4 * t * (1 - t);
      const bend = (relief - 0.5) * MILEAGE_BEND * bell;

      return Math.min(1, Math.max(0, t + bend));
    }
  }
}

export function generateCaloriePath(input: CaloriePathInput): CalorieWeek[] {
  const {
    weekCount,
    startCalories,
    endCalories,
    protein,
    shape,
    mileage,
    fatRatio = DEFAULT_FAT_RATIO,
  } = input;

  if (weekCount < 1) throw new Error("A calorie path needs at least one week.");
  if (shape === "mileage_linked" && (!mileage || mileage.length !== weekCount)) {
    throw new Error(
      `The mileage_linked shape needs one mileage entry per week: ${weekCount} expected, ${mileage?.length ?? 0} given.`,
    );
  }

  const deloads = new Set(input.deloadWeeks ?? []);
  const rows: CalorieWeek[] = [];

  // Deload weeks hold, so they take no step of the ramp. The ramp is spread
  // across the weeks that actually move.
  const rampingWeeks: number[] = [];
  for (let week = 1; week <= weekCount; week += 1) {
    if (!deloads.has(week) || week === weekCount) rampingWeeks.push(week);
  }
  const span = rampingWeeks.length - 1;

  let previous = startCalories;

  for (let week = 1; week <= weekCount; week += 1) {
    const isDeload = deloads.has(week);
    const isFinal = week === weekCount;

    let calories: number;
    let note = "";

    if (isDeload && !isFinal) {
      // Rule 2. Week 1 has nothing before it, so it holds the start.
      calories = previous;
      note = "Deload, calories held";
    } else if (isFinal) {
      // Rule 3, unconditionally.
      calories = endCalories;
      note = isDeload ? "Deload week, held at the goal state" : "Goal state";
    } else {
      const index = rampingWeeks.indexOf(week);
      const t = progressFor(shape, index, span, week, mileage);
      calories = Math.round(startCalories + (endCalories - startCalories) * t);
    }

    const macros = macrosFor(calories, protein, fatRatio);
    rows.push({
      week,
      calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      isDeload,
      note,
      status: "projected",
    });

    previous = calories;
  }

  return rows;
}

/**
 * Editing one week.
 *
 * The default is that nothing after it moves: a coach who drops week 6 because
 * the client had a bad week is saying something about week 6, not redrawing the
 * block. Re-ramping is the explicit other choice, and it regenerates from the
 * edited week to the end so the goal state still lands on the final week.
 */
export function editWeek(
  path: CalorieWeek[],
  week: number,
  calories: number,
  options: { reRampFromHere?: boolean; shape?: PathShape; mileage?: number[]; fatRatio?: number } = {},
): CalorieWeek[] {
  const index = path.findIndex((row) => row.week === week);
  if (index === -1) throw new Error(`Week ${week} is not in this path.`);

  const protein = path[index].protein;
  const fatRatio = options.fatRatio ?? DEFAULT_FAT_RATIO;
  const edited: CalorieWeek = {
    ...path[index],
    calories,
    ...macrosFor(calories, protein, fatRatio),
    status: "edited",
  };

  const next = [...path];
  next[index] = edited;

  if (!options.reRampFromHere) return next;

  const tail = path.slice(index);
  const regenerated = generateCaloriePath({
    weekCount: tail.length,
    startCalories: calories,
    endCalories: path[path.length - 1].calories,
    protein,
    deloadWeeks: tail.filter((row) => row.isDeload).map((row) => row.week - week + 1),
    shape: options.shape ?? "linear",
    mileage: options.mileage?.slice(index),
    fatRatio,
  });

  for (let offset = 0; offset < tail.length; offset += 1) {
    next[index + offset] = {
      ...regenerated[offset],
      week: tail[offset].week,
      status: offset === 0 ? "edited" : "projected",
    };
  }

  return next;
}
