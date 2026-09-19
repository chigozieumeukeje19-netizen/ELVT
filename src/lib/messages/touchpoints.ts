/**
 * Touchpoint counting.
 *
 * CoachRx's own data: clients getting more than two coach interactions a week
 * sit around 75 percent compliance. So the number is on the roster, and it is a
 * count of things that actually reached the client rather than a count of times
 * the coach opened their profile.
 *
 * What counts is stated here rather than at each write site, because the number
 * is only useful if it means the same thing every week.
 */

import { addDays, daysBetween } from "@/lib/engine/clock";

export const TOUCHPOINT_KINDS = [
  "message", "checkin_review", "comment", "consult", "call", "voice_note",
] as const;
export type TouchpointKind = (typeof TOUCHPOINT_KINDS)[number];

/** CoachRx's default, and the number the roster column is banded against. */
export const WEEKLY_TARGET = 1;
export const STRONG_WEEK = 2;

export type Touchpoint = { kind: TouchpointKind; at: string };

export type TouchpointCount = {
  thisWeek: number;
  lastWeek: number;
  /** Days since the last one, or null if there has never been one. */
  daysSinceLast: number | null;
  band: "ok" | "watch" | "flag";
};

/**
 * Counts the week that contains `today`, Monday to Sunday.
 *
 * A rolling seven days would be easier and would make the roster column change
 * meaning every day. A coach glancing at it on Thursday needs to know how this
 * week is going, not how the last 168 hours went.
 */
export function weekStart(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  // 0 is Sunday, and the week runs Monday to Sunday.
  const back = weekday === 0 ? 6 : weekday - 1;
  return addDays(date, -back);
}

export function countTouchpoints(touchpoints: Touchpoint[], today: string): TouchpointCount {
  const thisWeekStart = weekStart(today);
  const lastWeekStart = addDays(thisWeekStart, -7);

  const dates = touchpoints
    .map((touchpoint) => touchpoint.at.slice(0, 10))
    .sort();

  const thisWeek = dates.filter((date) => date >= thisWeekStart && date <= today).length;
  const lastWeek = dates.filter(
    (date) => date >= lastWeekStart && date < thisWeekStart,
  ).length;

  const last = dates[dates.length - 1];
  const daysSinceLast = last ? daysBetween(last, today) : null;

  return {
    thisWeek,
    lastWeek,
    daysSinceLast,
    // Banded on the target rather than on an adherence percentage, because this
    // is a count of what the coach did, not of what the client did.
    band: thisWeek >= STRONG_WEEK ? "ok" : thisWeek >= WEEKLY_TARGET ? "watch" : "flag",
  };
}

/**
 * Who to talk to next.
 *
 * The roster sorted by who has heard from you least. This is the whole
 * retention mechanic in one function, and it deliberately ignores how well the
 * client is doing: a client having a great week who has not heard from anyone
 * in nine days is exactly who cancels.
 */
export function quietestFirst<T extends { touchpoints: TouchpointCount }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aDays = a.touchpoints.daysSinceLast ?? Number.POSITIVE_INFINITY;
    const bDays = b.touchpoints.daysSinceLast ?? Number.POSITIVE_INFINITY;
    if (aDays !== bDays) return bDays - aDays;
    return a.touchpoints.thisWeek - b.touchpoints.thisWeek;
  });
}
