import {
  applyFilters,
  availableActions,
  countsFor,
  wouldAffect,
  type BulkAction,
  type RosterCandidate,
  type Segment,
} from "@/lib/roster/filters";

/**
 * Fixtures for the filter bar.
 *
 * Deliberately includes a filter that matches nobody, because a dead filter is
 * the case worth checking: it stays on screen saying zero rather than
 * disappearing, so a coach looking for it sees that nobody qualifies rather
 * than wondering where the button went.
 */

export const PREVIEW_CANDIDATES: RosterCandidate[] = [
  { id: "1", slug: "aisha", name: "Aisha Nkemdirim", status: "active", adherence: 93, openQueueItems: 0, flags: 1, daysSinceCheckin: 1, daysToRace: 19, hasApprovedBlueprint: true, hasProgram: true },
  { id: "2", slug: "caleb", name: "Caleb Whitlock", status: "active", adherence: 48, openQueueItems: 2, flags: 3, daysSinceCheckin: 14, daysToRace: null, hasApprovedBlueprint: true, hasProgram: true },
  { id: "3", slug: "ekaterina", name: "Ekaterina Vasilyeva-Whitcombe", status: "active", adherence: 71, openQueueItems: 1, flags: 0, daysSinceCheckin: 3, daysToRace: null, hasApprovedBlueprint: true, hasProgram: true },
  { id: "4", slug: "karar", name: "Karar Al-Mansouri", status: "active", adherence: 55, openQueueItems: 1, flags: 0, daysSinceCheckin: null, daysToRace: null, hasApprovedBlueprint: true, hasProgram: true },
  { id: "5", slug: "theo", name: "Theo Vance", status: "active", adherence: 96, openQueueItems: 0, flags: 0, daysSinceCheckin: 2, daysToRace: 84, hasApprovedBlueprint: true, hasProgram: true },
  { id: "6", slug: "janessa", name: "Janessa Okonkwo-Bright", status: "paused", adherence: 62, openQueueItems: 0, flags: 2, daysSinceCheckin: 9, daysToRace: null, hasApprovedBlueprint: true, hasProgram: true },
  { id: "7", slug: "marcus", name: "Marcus Delacroix", status: "onboarding", adherence: null, openQueueItems: 1, flags: 0, daysSinceCheckin: null, daysToRace: null, hasApprovedBlueprint: false, hasProgram: false },
  { id: "8", slug: "priya", name: "Priya Ramanathan", status: "active", adherence: 88, openQueueItems: 0, flags: 0, daysSinceCheckin: 4, daysToRace: null, hasApprovedBlueprint: true, hasProgram: true },
];

export const PREVIEW_SEGMENTS: Segment[] = [
  { id: "s1", name: "Slipping", filters: ["low_adherence", "checkin_overdue"] },
  { id: "s2", name: "Race block", filters: ["race_soon"] },
];

export const PREVIEW_COUNTS = countsFor(PREVIEW_CANDIDATES, []);
export const PREVIEW_COUNTS_FILTERED = countsFor(PREVIEW_CANDIDATES, ["low_adherence"]);
export const PREVIEW_FILTERED = applyFilters(PREVIEW_CANDIDATES, ["low_adherence"]);

const SELECTED = PREVIEW_CANDIDATES.slice(0, 3);
export const PREVIEW_BULK_ACTIONS = availableActions(SELECTED);
export const PREVIEW_BULK_AFFECTS: Record<string, number> = Object.fromEntries(
  PREVIEW_BULK_ACTIONS.map((action: BulkAction) => [action, wouldAffect(action, SELECTED)]),
);
export const PREVIEW_BULK_SELECTED = SELECTED.length;
