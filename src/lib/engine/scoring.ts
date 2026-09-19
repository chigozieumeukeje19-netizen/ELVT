/**
 * Scores and adherence.
 *
 * The daily score is the sum of the weights of the behaviours the client was
 * actually asked for that day, and only those. A rest day does not silently
 * score 70 out of 100 because no session was possible: the weights rescale to
 * whatever was assigned, so a perfect rest day is 100. Anything else teaches
 * the client that the number punishes them for following the plan.
 *
 * The weekly ELVT score is five category scores and their weighted mean, and
 * the category furthest below 80 is tagged as the focus. That tag is what the
 * Monday card leads with, so it is computed here rather than guessed there.
 */

export const SCORE_CATEGORIES = [
  "training", "nutrition", "movement", "recovery", "accountability",
] as const;
export type ScoreCategory = (typeof SCORE_CATEGORIES)[number];

/** Which category each scored behaviour belongs to. */
export const TASK_CATEGORY: Record<string, ScoreCategory> = {
  training: "training",
  run: "training",
  calories: "nutrition",
  protein: "nutrition",
  steps: "movement",
  water: "recovery",
  recovery: "recovery",
  sleep: "recovery",
  checkin: "accountability",
};

export type ScoredTask = {
  key: string;
  /** Weight from scoring_config. */
  weight: number;
  done: boolean;
};

export type DayScore = {
  date: string;
  score: number;
  tasks: ScoredTask[];
};

/**
 * A day out of 100.
 *
 * Only the tasks passed in count, so a day with no run assigned is scored out
 * of the remaining weights rather than out of a fixed 100 with the run's 20
 * permanently lost.
 */
export function scoreDay(date: string, tasks: ScoredTask[]): DayScore {
  const assigned = tasks.reduce((sum, task) => sum + task.weight, 0);
  if (assigned <= 0) return { date, score: 0, tasks };

  const done = tasks.reduce((sum, task) => sum + (task.done ? task.weight : 0), 0);
  return {
    date,
    score: Math.round((done / assigned) * 100 * 100) / 100,
    tasks,
  };
}

export type AdherenceFraction = { done: number; planned: number };

/** The fractions the Monday card shows: lifts 3/3, runs 1/2, protein days 5/7. */
export type WeekAdherence = Record<string, AdherenceFraction>;

export function adherencePercent(fraction: AdherenceFraction): number | null {
  if (fraction.planned <= 0) return null;
  return Math.round((fraction.done / fraction.planned) * 100);
}

export type WeekScore = {
  categories: Record<ScoreCategory, number | null>;
  score: number;
  /** The category furthest below 80, or null when nothing is. */
  focus: ScoreCategory | null;
};

/**
 * The weekly ELVT score.
 *
 * A category with nothing planned scores null rather than zero and is left out
 * of the mean. A client with no runs programmed is not failing at running.
 */
export function scoreWeek(
  adherence: WeekAdherence,
  weights: Record<string, number>,
): WeekScore {
  const totals: Record<string, { done: number; weight: number }> = {};

  for (const [key, fraction] of Object.entries(adherence)) {
    const category = TASK_CATEGORY[key];
    if (!category) continue;
    if (fraction.planned <= 0) continue;

    const weight = weights[key] ?? 0;
    if (weight <= 0) continue;

    const bucket = (totals[category] ??= { done: 0, weight: 0 });
    bucket.done += (fraction.done / fraction.planned) * weight;
    bucket.weight += weight;
  }

  const categories = Object.fromEntries(
    SCORE_CATEGORIES.map((category) => {
      const bucket = totals[category];
      return [
        category,
        bucket && bucket.weight > 0
          ? Math.round((bucket.done / bucket.weight) * 100 * 100) / 100
          : null,
      ];
    }),
  ) as Record<ScoreCategory, number | null>;

  const scored = SCORE_CATEGORIES.map((category) => ({
    category,
    value: categories[category],
    weight: totals[category]?.weight ?? 0,
  })).filter((entry): entry is { category: ScoreCategory; value: number; weight: number } =>
    entry.value !== null,
  );

  const totalWeight = scored.reduce((sum, entry) => sum + entry.weight, 0);
  const score =
    totalWeight > 0
      ? Math.round(
          (scored.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / totalWeight) * 100,
        ) / 100
      : 0;

  let focus: ScoreCategory | null = null;
  let worst = 80;
  for (const entry of scored) {
    if (entry.value < worst) {
      worst = entry.value;
      focus = entry.category;
    }
  }

  return { categories, score, focus };
}

/**
 * The streak.
 *
 * Counted on the date a day was scheduled for, not the timestamp a client
 * happened to log at. CoachRx counts by log time and clients who write up the
 * next morning lose the streak, which is the behaviour this deliberately does
 * not copy. Backfill within the week is therefore free: the day is scored on
 * its own date whenever the log arrives.
 */
export const STREAK_THRESHOLD = 70;

export function streakThrough(days: { date: string; score: number }[]): number {
  const ordered = [...days].sort((a, b) => (a.date < b.date ? 1 : -1));
  let streak = 0;
  for (const day of ordered) {
    if (day.score < STREAK_THRESHOLD) break;
    streak += 1;
  }
  return streak;
}

/** Seven day average weight, and the change on the seven days before it. */
export type WeightTrend = {
  average: number | null;
  previousAverage: number | null;
  change: number | null;
};

export function weightTrend(
  weights: { date: string; weight: number | null }[],
  weekStart: string,
  previousWeekStart: string,
): WeightTrend {
  const mean = (from: string) => {
    const values = weights
      .filter((row) => row.date >= from && row.date < addDaysLocal(from, 7))
      .map((row) => row.weight)
      .filter((weight): weight is number => weight !== null);
    if (values.length === 0) return null;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  };

  const average = mean(weekStart);
  const previousAverage = mean(previousWeekStart);

  return {
    average,
    previousAverage,
    change:
      average !== null && previousAverage !== null
        ? Math.round((average - previousAverage) * 100) / 100
        : null,
  };
}

/** Local to this file so scoring does not depend on the clock module. */
function addDaysLocal(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
