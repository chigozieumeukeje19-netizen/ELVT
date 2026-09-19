/**
 * Roster filters.
 *
 * Five of them, and each answers a question a coach actually asks on a Monday
 * rather than describing a column. "Low adherence" is a question; "adherence
 * less than" is a query builder, and a query builder is a feature nobody uses
 * twice.
 *
 * Every filter is a pure predicate over one row, so the counts beside each one
 * are computed from the same function that does the filtering. A count that
 * disagrees with what the filter shows is worse than no count.
 */

import { bandFor } from "@/lib/design/bands";

export const FILTERS = [
  "needs_attention",
  "low_adherence",
  "checkin_overdue",
  "race_soon",
  "onboarding_incomplete",
] as const;
export type FilterKey = (typeof FILTERS)[number];

export const FILTER_LABELS: Record<FilterKey, string> = {
  needs_attention: "Needs attention",
  low_adherence: "Low adherence",
  checkin_overdue: "Check-in overdue",
  race_soon: "Race within 6 weeks",
  onboarding_incomplete: "Onboarding incomplete",
};

/** What each one means, shown beside it so nobody has to guess. */
export const FILTER_NOTES: Record<FilterKey, string> = {
  needs_attention: "A flag fired, or the queue has something open on them.",
  low_adherence: "Under 60 percent, which is the band that changes what you do.",
  checkin_overdue: "Their last weekly is more than eight days old.",
  race_soon: "Inside six weeks, which is when the taper starts mattering.",
  onboarding_incomplete: "No approved blueprint, or no program yet.",
};

export type RosterCandidate = {
  id: string;
  slug: string;
  name: string;
  status: string;
  adherence: number | null;
  openQueueItems: number;
  flags: number;
  /** Days since their last weekly check-in, or null if they have never sent one. */
  daysSinceCheckin: number | null;
  /** Days until their race, or null when there is not one. */
  daysToRace: number | null;
  hasApprovedBlueprint: boolean;
  hasProgram: boolean;
};

/** Eight days, so a Sunday check-in is not overdue on the following Monday. */
export const CHECKIN_OVERDUE_DAYS = 8;

/** Six weeks, from the item. Where the taper starts mattering. */
export const RACE_SOON_DAYS = 42;

export const PREDICATES: Record<FilterKey, (row: RosterCandidate) => boolean> = {
  needs_attention: (row) => row.openQueueItems > 0 || row.flags > 0,

  // The band, not a number typed here. A client at 59 and a client at 61 are
  // on different sides of a line the whole product already draws.
  low_adherence: (row) => row.adherence !== null && bandFor(row.adherence) === "flag",

  // Never sent one is overdue, which is not the same as having no data and is
  // the case most worth seeing.
  checkin_overdue: (row) =>
    row.daysSinceCheckin === null || row.daysSinceCheckin > CHECKIN_OVERDUE_DAYS,

  race_soon: (row) =>
    row.daysToRace !== null && row.daysToRace >= 0 && row.daysToRace <= RACE_SOON_DAYS,

  onboarding_incomplete: (row) => !row.hasApprovedBlueprint || !row.hasProgram,
};

/**
 * Filters are AND, not OR.
 *
 * "Low adherence and check-in overdue" is a real question; "low adherence or
 * check-in overdue" is most of the roster. Selecting two and getting more rows
 * than one is the behaviour nobody expects.
 */
export function applyFilters(rows: RosterCandidate[], active: FilterKey[]): RosterCandidate[] {
  if (active.length === 0) return rows;
  return rows.filter((row) => active.every((key) => PREDICATES[key](row)));
}

/**
 * How many rows each filter would leave, given what is already selected.
 *
 * Counted against the current selection rather than against the whole roster,
 * so a filter showing 3 leaves 3 rows when clicked. A count that promises more
 * than the click delivers is the thing that makes people stop trusting them.
 */
export function countsFor(
  rows: RosterCandidate[],
  active: FilterKey[],
): Record<FilterKey, number> {
  return Object.fromEntries(
    FILTERS.map((key) => [
      key,
      applyFilters(rows, active.includes(key) ? active : [...active, key]).length,
    ]),
  ) as Record<FilterKey, number>;
}

/**
 * A saved segment.
 *
 * A named set of filters rather than a named list of clients: a list goes stale
 * the moment someone's adherence changes, and the whole point of "low adherence
 * and no check-in" is that its membership moves.
 */
export type Segment = {
  id: string;
  name: string;
  filters: FilterKey[];
};

export function segmentMatches(segment: Segment, rows: RosterCandidate[]): RosterCandidate[] {
  return applyFilters(rows, segment.filters);
}

export const BULK_ACTIONS = ["message", "checkin_nudge", "pause", "tag"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

export const BULK_LABELS: Record<BulkAction, string> = {
  message: "Message them",
  checkin_nudge: "Nudge about the check-in",
  pause: "Pause",
  tag: "Tag",
};

/**
 * Which bulk actions make sense for a selection.
 *
 * Pausing someone who is already paused does nothing, and offering it makes the
 * coach check afterwards whether it worked. An action that would be a no-op for
 * every selected client is not offered.
 */
export function availableActions(selected: RosterCandidate[]): BulkAction[] {
  if (selected.length === 0) return [];

  const actions: BulkAction[] = ["message", "tag"];
  if (selected.some((row) => row.daysSinceCheckin === null || row.daysSinceCheckin > 0)) {
    actions.push("checkin_nudge");
  }
  if (selected.some((row) => row.status === "active")) {
    actions.push("pause");
  }

  return actions;
}

/**
 * How many a bulk action would actually change.
 *
 * Shown on the button, because "Pause 6" when two of them are already paused is
 * a button that lies about what it is about to do.
 */
export function wouldAffect(action: BulkAction, selected: RosterCandidate[]): number {
  switch (action) {
    case "pause":
      return selected.filter((row) => row.status === "active").length;
    case "checkin_nudge":
      return selected.filter(
        (row) => row.daysSinceCheckin === null || row.daysSinceCheckin > 0,
      ).length;
    case "message":
    case "tag":
      return selected.length;
  }
}
