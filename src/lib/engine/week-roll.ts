/**
 * The week roll. Sunday 23:59 in the client's own timezone.
 *
 * This is the job the whole Monday queue hangs off, so it is written as a pure
 * function from a bundle of rows to a list of writes. Nothing here touches the
 * database. That matters for two reasons: the arithmetic can be tested against
 * a client in Kabul whose Sunday ends before the server's Saturday does, and
 * the idempotency rule can be proved by running it twice on the same input and
 * comparing the plans rather than by inspecting a database afterwards.
 *
 * Idempotency is by construction, not by checking afterwards. Every write this
 * produces is keyed, and a key that already exists in the input is skipped. Run
 * it twice and the second plan is empty.
 */

import { bandFor } from "@/lib/design/bands";
import { addDays, isDue, localMoment } from "./clock";
import {
  adherencePercent,
  scoreWeek,
  streakThrough,
  weightTrend,
  type WeekAdherence,
  type WeekScore,
  type WeightTrend,
} from "./scoring";

/** 23:59 on Sunday, in the client's own time. */
export const WEEK_ROLL_SCHEDULE = { weekday: 0, time: "23:59" } as const;

export type RollClient = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
};

export type RollWeek = {
  id: string;
  weekNumber: number;
  startsOn: string;
  isDeload: boolean;
  plannedMileage: number;
  /** Already frozen. Present means this week has been rolled before. */
  snapshot: unknown | null;
};

export type RollInput = {
  instant: Date;
  client: RollClient;
  programId: string;
  /** Every week of the block, ascending. */
  weeks: RollWeek[];
  /** The week being closed. */
  weekNumber: number;
  adherence: WeekAdherence;
  scoringWeights: Record<string, number>;
  dailyScores: { date: string; score: number }[];
  weights: { date: string; weight: number | null }[];
  /** Mileage actually run, per week number, for the ramp check. */
  completedMileage: Record<number, number>;
  /** The variable the coach changed last Monday. Drives next week's form. */
  spineVariable: string | null;
  spineChangeId: string | null;
  /** Keys already written, so a second run produces nothing. */
  existing: {
    dailyFormDates: string[];
    weeklyFormDates: string[];
    eventKeys: string[];
    queueKeys: string[];
  };
};

export type RollWrite =
  | { kind: "snapshot"; weekId: string; weekNumber: number; snapshot: WeekSnapshot }
  | { kind: "week_score"; weekId: string; score: number; adherence: WeekAdherence }
  | { kind: "daily_form"; forDate: string; questionsFrom: "bank" }
  | { kind: "weekly_form"; forDate: string; spineVariable: string | null; generatedFromChangeId: string | null }
  | { kind: "event"; key: string; type: string; payload: Record<string, unknown> }
  | { kind: "queue_item"; key: string; kind_: "monday_review" | "mileage_spike"; severity: number; title: string; detail: Record<string, unknown> };

export type WeekSnapshot = {
  weekNumber: number;
  startsOn: string;
  isDeload: boolean;
  adherence: WeekAdherence;
  adherencePercent: Record<string, number | null>;
  score: WeekScore;
  streak: number;
  weight: WeightTrend;
  plannedMileage: number;
  completedMileage: number;
  frozenAt: string;
};

export type RollPlan = {
  /** Why nothing was produced, when nothing was. */
  skipped: string | null;
  localDate: string | null;
  writes: RollWrite[];
};

const NOTHING: RollPlan = { skipped: null, localDate: null, writes: [] };

/**
 * The mileage ramp check, run at the roll against what was actually run.
 *
 * The program tab's version of this runs over planned mileage while a coach is
 * editing. This one runs over completed mileage after the week is over, which
 * is the number that predicts an injury.
 */
export const MAX_RAMP_PCT = 10;

export function rampIncrease(
  completed: Record<number, number>,
  weekNumber: number,
): { increase: number; average: number } | null {
  const history = [weekNumber - 3, weekNumber - 2, weekNumber - 1]
    .map((week) => completed[week])
    .filter((miles): miles is number => typeof miles === "number");

  if (history.length < 3) return null;

  const average = history.reduce((a, b) => a + b, 0) / history.length;
  if (average <= 0) return null;

  const thisWeek = completed[weekNumber] ?? 0;
  return { increase: ((thisWeek - average) / average) * 100, average };
}

export function planWeekRoll(input: RollInput, lastRunLocalDate: string | null): RollPlan {
  if (!isDue(input.instant, input.client.timezone, WEEK_ROLL_SCHEDULE, lastRunLocalDate)) {
    return { ...NOTHING, skipped: "Not 23:59 on this client's Sunday yet." };
  }

  const localDate = localMoment(input.instant, input.client.timezone).date;
  const week = input.weeks.find((candidate) => candidate.weekNumber === input.weekNumber);
  if (!week) {
    return { skipped: `Week ${input.weekNumber} is not in this program.`, localDate, writes: [] };
  }

  // Already frozen. Everything downstream keys off the snapshot, so a week that
  // has one has been rolled and nothing else is produced.
  if (week.snapshot !== null) {
    return { skipped: `Week ${input.weekNumber} was already rolled.`, localDate, writes: [] };
  }

  const writes: RollWrite[] = [];

  const score = scoreWeek(input.adherence, input.scoringWeights);
  const streak = streakThrough(input.dailyScores);
  const trend = weightTrend(input.weights, week.startsOn, addDays(week.startsOn, -7));
  const completed = input.completedMileage[input.weekNumber] ?? 0;

  const snapshot: WeekSnapshot = {
    weekNumber: week.weekNumber,
    startsOn: week.startsOn,
    isDeload: week.isDeload,
    adherence: input.adherence,
    adherencePercent: Object.fromEntries(
      Object.entries(input.adherence).map(([key, fraction]) => [key, adherencePercent(fraction)]),
    ),
    score,
    streak,
    weight: trend,
    plannedMileage: week.plannedMileage,
    completedMileage: completed,
    frozenAt: input.instant.toISOString(),
  };

  writes.push({ kind: "snapshot", weekId: week.id, weekNumber: week.weekNumber, snapshot });
  writes.push({
    kind: "week_score",
    weekId: week.id,
    score: score.score,
    adherence: input.adherence,
  });

  // Next week's forms. The dailies are one per day of the coming week, the
  // weekly is the Sunday at the end of it.
  const nextWeek = input.weeks.find((candidate) => candidate.weekNumber === input.weekNumber + 1);

  if (nextWeek) {
    for (let offset = 0; offset < 7; offset += 1) {
      const forDate = addDays(nextWeek.startsOn, offset);
      if (input.existing.dailyFormDates.includes(forDate)) continue;
      writes.push({ kind: "daily_form", forDate, questionsFrom: "bank" });
    }

    // The weekly lands on the Sunday that closes the coming week, which is six
    // days after its Monday start.
    const weeklyDate = addDays(nextWeek.startsOn, 6);
    if (!input.existing.weeklyFormDates.includes(weeklyDate)) {
      writes.push({
        kind: "weekly_form",
        forDate: weeklyDate,
        spineVariable: input.spineVariable,
        generatedFromChangeId: input.spineChangeId,
      });
    }
  }

  const ramp = rampIncrease(input.completedMileage, input.weekNumber);
  if (ramp && ramp.increase > MAX_RAMP_PCT) {
    const key = `mileage_spike:${input.client.id}:${input.weekNumber}`;
    if (!input.existing.queueKeys.includes(key)) {
      writes.push({
        kind: "queue_item",
        key,
        kind_: "mileage_spike",
        severity: ramp.increase > 25 ? 4 : 3,
        title: `${input.client.name} ran ${Math.round(ramp.increase)} percent above the previous three weeks`,
        detail: {
          weekNumber: input.weekNumber,
          completed,
          threeWeekAverage: Math.round(ramp.average * 10) / 10,
        },
      });
    }
  }

  const mondayKey = `monday_review:${input.client.id}:${input.weekNumber}`;
  if (!input.existing.queueKeys.includes(mondayKey)) {
    writes.push({
      kind: "queue_item",
      key: mondayKey,
      kind_: "monday_review",
      severity: severityFor(score, trend),
      title: `${input.client.name}, week ${input.weekNumber}`,
      detail: {
        weekNumber: input.weekNumber,
        score: score.score,
        focus: score.focus,
        adherence: snapshot.adherencePercent,
        weight: trend,
        streak,
      },
    });
  }

  const eventKey = `week_rolled:${input.client.id}:${input.weekNumber}`;
  if (!input.existing.eventKeys.includes(eventKey)) {
    writes.push({
      kind: "event",
      key: eventKey,
      type: "week_rolled",
      payload: {
        programId: input.programId,
        weekNumber: input.weekNumber,
        score: score.score,
        focus: score.focus,
        streak,
        localDate,
      },
    });
  }

  return { skipped: null, localDate, writes };
}

/**
 * How far up the queue this card sits.
 *
 * A low score or a weight moving the wrong way is what makes a card urgent. The
 * thresholds come from bandFor, which is the one place that knows 85 and 60, so
 * a card that sorts to the top of the queue is the same client whose roster row
 * is red. Writing the numbers here would let the two drift apart.
 */

/** A gain this size in a week, on a client losing weight, is worth a look. */
const WEIGHT_GAIN_KG = 0.5;

function severityFor(score: WeekScore, trend: WeightTrend): number {
  const band = bandFor(score.score);
  if (band === "flag") return 4;
  if (band === "watch") return 3;
  if (trend.change !== null && trend.change > WEIGHT_GAIN_KG) return 3;
  return 2;
}
