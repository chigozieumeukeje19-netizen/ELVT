import type { MaterializedDay, MaterializedWeek } from "./apply-template";
import type { RunType, SetTarget, Stimulus } from "./types";

/**
 * Hybrid stress. Spec 6.4.
 *
 * The point is not a precise training load number. It is that lifting and
 * running are scored on one scale so a hard run the day before a leg session
 * can actually be seen. Nobody else in coaching software computes combined
 * stress, which is the whole reason this exists.
 */

/** Legs cost more than arms, which is what makes the run interaction visible. */
const MUSCLE_WEIGHT: Record<string, number> = {
  lower_strength: 1.4,
  full_strength: 1.3,
  upper_strength: 1.0,
  conditioning: 1.2,
  skill: 0.6,
  mobility: 0.3,
};

/** Intensity factor per run type. Spec 6.4 names zone 2, tempo, intervals, long. */
const RUN_INTENSITY: Record<string, number> = {
  recovery: 0.8,
  easy: 1.0,
  zone2: 1.0,
  walk_run: 0.8,
  long: 1.3,
  progression: 1.4,
  tempo: 1.6,
  threshold: 1.7,
  hills: 1.8,
  strides: 1.2,
  intervals: 2.0,
  race_pace: 1.9,
  race: 2.2,
  brick: 1.5,
  custom: 1.0,
};

/**
 * A set at the top of its range costs more than a back off set. Without a
 * logged load the prescription is all we have, so RIR stands in: fewer reps in
 * reserve is a harder set.
 */
function loadFactor(sets: SetTarget[]): number {
  if (sets.length === 0) return 1;
  const perSet = sets.map((set) => {
    if (typeof set.pct_1rm === "number") return 0.6 + set.pct_1rm / 100;
    if (typeof set.rpe === "number") return 0.6 + set.rpe / 12.5;
    if (typeof set.rir === "number") return 1.4 - Math.min(set.rir, 5) * 0.08;
    return 1;
  });
  return perSet.reduce((a, b) => a + b, 0) / perSet.length;
}

export function strengthStress(session: {
  stimulus: Stimulus;
  exercises: { sets: SetTarget[] }[];
}): number {
  const totalSets = session.exercises.reduce((n, e) => n + e.sets.length, 0);
  if (totalSets === 0) return 0;
  const factor = loadFactor(session.exercises.flatMap((e) => e.sets));
  const weight = MUSCLE_WEIGHT[session.stimulus] ?? 1;
  return round(totalSets * factor * weight);
}

export function runStress(run: {
  runType: RunType;
  distanceTarget?: number;
  durationTarget?: number;
}): number {
  const intensity = RUN_INTENSITY[run.runType] ?? 1;
  // Distance is the honest input. A duration only run falls back to an
  // assumed easy pace rather than scoring zero.
  const distance = run.distanceTarget ?? (run.durationTarget ?? 0) / 9;
  return round(distance * intensity);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function dayStress(day: MaterializedDay): number {
  let total = 0;
  for (const session of day.sessions) {
    if (session.run) {
      total += runStress(session.run);
    } else {
      total += strengthStress(session);
    }
  }
  return round(total);
}

export function weekStress(week: MaterializedWeek): number {
  return round(week.days.reduce((sum, day) => sum + dayStress(day), 0));
}

export function weekMileage(week: MaterializedWeek): number {
  let total = 0;
  for (const day of week.days) {
    for (const session of day.sessions) {
      total += session.run?.distanceTarget ?? 0;
    }
  }
  return round(total);
}

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

export type StressFlagKind =
  | "legs_near_hard_run"
  | "hard_runs_consecutive"
  | "mileage_ramp"
  | "week_spike"
  | "deload_not_easier";

export type StressFlag = {
  kind: StressFlagKind;
  weekNumber: number;
  date?: string;
  /**
   * Severity maps to the two signal colors Part 2 already defines: watch for
   * drifting, flag for actionable. Nothing here invents a third meaning.
   */
  severity: "watch" | "flag";
  message: string;
};

const HARD_RUN_TYPES: RunType[] = [
  "tempo", "threshold", "intervals", "hills", "race_pace", "race",
];

function isHardRun(session: { run?: { runType: RunType } }): boolean {
  return session.run ? HARD_RUN_TYPES.includes(session.run.runType) : false;
}

function isLegSession(session: { stimulus: Stimulus; run?: unknown }): boolean {
  return (
    !session.run &&
    (session.stimulus === "lower_strength" || session.stimulus === "full_strength")
  );
}

/**
 * Every flag spec 6.4 names, computed over the whole block so the ones that
 * need history (the mileage ramp, the block average) can actually see it.
 */
export function stressFlags(weeks: MaterializedWeek[]): StressFlag[] {
  const flags: StressFlag[] = [];
  const days = weeks.flatMap((week) =>
    week.days.map((day) => ({ day, weekNumber: week.weekNumber })),
  );

  // A leg session within 24 hours either side of a hard run.
  for (let i = 0; i < days.length - 1; i += 1) {
    const today = days[i];
    const tomorrow = days[i + 1];

    const legsToday = today.day.sessions.some(isLegSession);
    const hardRunToday = today.day.sessions.some(isHardRun);
    const legsTomorrow = tomorrow.day.sessions.some(isLegSession);
    const hardRunTomorrow = tomorrow.day.sessions.some(isHardRun);

    if (legsToday && hardRunTomorrow) {
      flags.push({
        kind: "legs_near_hard_run",
        weekNumber: tomorrow.weekNumber,
        date: tomorrow.day.date,
        severity: "flag",
        message: "Legs the day before a hard run. One of them will be worse than planned.",
      });
    } else if (hardRunToday && legsTomorrow) {
      flags.push({
        kind: "legs_near_hard_run",
        weekNumber: tomorrow.weekNumber,
        date: tomorrow.day.date,
        severity: "flag",
        message: "Legs the day after a hard run. One of them will be worse than planned.",
      });
    }

    if (hardRunToday && hardRunTomorrow) {
      flags.push({
        kind: "hard_runs_consecutive",
        weekNumber: tomorrow.weekNumber,
        date: tomorrow.day.date,
        severity: "flag",
        message: "Two hard runs back to back.",
      });
    }
  }

  // Weekly mileage more than 10 percent above the previous three week average.
  const mileage = weeks.map(weekMileage);
  for (let i = 0; i < weeks.length; i += 1) {
    const history = mileage.slice(Math.max(0, i - 3), i);
    if (history.length < 3) continue;
    const average = history.reduce((a, b) => a + b, 0) / history.length;
    if (average === 0) continue;

    const increase = ((mileage[i] - average) / average) * 100;
    if (increase > 10) {
      flags.push({
        kind: "mileage_ramp",
        weekNumber: weeks[i].weekNumber,
        severity: increase > 25 ? "flag" : "watch",
        message: `Mileage is ${Math.round(increase)} percent above the previous three weeks.`,
      });
    }
  }

  // A week more than 25 percent above the block average, when it is not a
  // planned peak. A deload week is never a peak.
  const stress = weeks.map(weekStress);
  const blockAverage =
    stress.length > 0 ? stress.reduce((a, b) => a + b, 0) / stress.length : 0;

  for (let i = 0; i < weeks.length; i += 1) {
    if (blockAverage === 0 || weeks[i].isDeload) continue;
    const over = ((stress[i] - blockAverage) / blockAverage) * 100;
    if (over > 25) {
      flags.push({
        kind: "week_spike",
        weekNumber: weeks[i].weekNumber,
        severity: "watch",
        message: `Week stress is ${Math.round(over)} percent above the block average. Mark it a planned peak or bring it down.`,
      });
    }
  }

  // A deload carrying more than the week before it is not a deload.
  for (let i = 1; i < weeks.length; i += 1) {
    if (!weeks[i].isDeload) continue;
    if (stress[i] > stress[i - 1]) {
      flags.push({
        kind: "deload_not_easier",
        weekNumber: weeks[i].weekNumber,
        severity: "flag",
        message: "This deload carries more than the week before it.",
      });
    }
  }

  return flags;
}
