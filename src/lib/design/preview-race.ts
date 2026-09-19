import {
  longestRun,
  mileageByWeek,
  weeklyMileage,
  type PlannedWeek,
  type Race,
  type RunLog,
} from "@/lib/race/mode";

/**
 * Fixtures for race mode.
 *
 * Every date is fixed rather than relative to today, because a preview whose
 * screenshot changes tomorrow is a preview that cannot be asserted against.
 * The viewed dates below are chosen to land the screen in each phase.
 */

export const PREVIEW_RACE: Race = {
  id: "race-1",
  name: "Portland Marathon",
  date: "2026-04-19",
  metres: 42195,
  goalTimeSeconds: 3 * 3600 + 30 * 60,
  notes: null,
};

/** No goal time, so the fueling card has to say what it needs. */
export const PREVIEW_RACE_NO_GOAL: Race = {
  ...PREVIEW_RACE,
  id: "race-2",
  name: "Cascade Lakes Relay Leg Three",
  goalTimeSeconds: null,
};

/** Deep in the block. */
export const PREVIEW_VIEWED_BUILD = "2026-02-23";
/** Inside the three week taper, before race week. */
export const PREVIEW_VIEWED_TAPER = "2026-04-02";
/** Thursday of race week. */
export const PREVIEW_VIEWED_RACE_WEEK = "2026-04-16";

export const PREVIEW_PLANNED: PlannedWeek[] = [
  { weekNumber: 9, startsOn: "2026-02-16", plannedMileage: 38 },
  { weekNumber: 10, startsOn: "2026-02-23", plannedMileage: 42 },
  { weekNumber: 11, startsOn: "2026-03-02", plannedMileage: 30 },
  { weekNumber: 12, startsOn: "2026-03-09", plannedMileage: 46 },
  { weekNumber: 13, startsOn: "2026-03-16", plannedMileage: 50 },
  { weekNumber: 14, startsOn: "2026-03-23", plannedMileage: 44 },
  { weekNumber: 15, startsOn: "2026-03-30", plannedMileage: 34 },
  { weekNumber: 16, startsOn: "2026-04-06", plannedMileage: 26 },
  { weekNumber: 17, startsOn: "2026-04-13", plannedMileage: 16 },
];

/**
 * Deliberately uneven. Week 11 is a deload he over-ran, week 14 he missed
 * most of, and week 17 is the taper, which is under plan on purpose and must
 * not be coloured for it.
 */
export const PREVIEW_RUN_LOGS: RunLog[] = [
  { loggedForDate: "2026-02-17", distance: 7 },
  { loggedForDate: "2026-02-19", distance: 9 },
  { loggedForDate: "2026-02-21", distance: 20 },
  { loggedForDate: "2026-02-24", distance: 8 },
  { loggedForDate: "2026-02-26", distance: 10 },
  { loggedForDate: "2026-02-28", distance: 22 },
  { loggedForDate: "2026-03-03", distance: 9 },
  { loggedForDate: "2026-03-07", distance: 23 },
  { loggedForDate: "2026-03-10", distance: 10 },
  { loggedForDate: "2026-03-12", distance: 9 },
  { loggedForDate: "2026-03-14", distance: 22 },
  { loggedForDate: "2026-03-17", distance: 11 },
  { loggedForDate: "2026-03-21", distance: 26 },
  { loggedForDate: "2026-03-24", distance: 6 },
  { loggedForDate: "2026-03-28", distance: 12 },
  { loggedForDate: "2026-03-31", distance: 8 },
  { loggedForDate: "2026-04-04", distance: 14 },
  { loggedForDate: "2026-04-07", distance: 7 },
  { loggedForDate: "2026-04-11", distance: 10 },
  { loggedForDate: "2026-04-14", distance: 5 },
];

export const PREVIEW_MILEAGE = mileageByWeek(PREVIEW_PLANNED, PREVIEW_RUN_LOGS, PREVIEW_RACE);

export function previewWeekly(on: string): number {
  return weeklyMileage(PREVIEW_RUN_LOGS, on);
}

export function previewLongest(on: string) {
  return longestRun(PREVIEW_RUN_LOGS, on);
}

/** Eight and a half minute miles, so the no-goal-time card still has a plan. */
export const PREVIEW_RECENT_PACE_SECONDS = 8 * 60 + 30;
