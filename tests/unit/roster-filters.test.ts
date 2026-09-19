import { describe, expect, it } from "vitest";
import {
  applyFilters,
  availableActions,
  BULK_ACTIONS,
  CHECKIN_OVERDUE_DAYS,
  countsFor,
  FILTER_LABELS,
  FILTER_NOTES,
  FILTERS,
  PREDICATES,
  RACE_SOON_DAYS,
  segmentMatches,
  wouldAffect,
  type RosterCandidate,
} from "@/lib/roster/filters";

function row(overrides: Partial<RosterCandidate> = {}): RosterCandidate {
  return {
    id: "1",
    slug: "sample",
    name: "Sample Client",
    status: "active",
    adherence: 92,
    openQueueItems: 0,
    flags: 0,
    daysSinceCheckin: 2,
    daysToRace: null,
    hasApprovedBlueprint: true,
    hasProgram: true,
    ...overrides,
  };
}

describe("the filters", () => {
  it("names and explains all five", () => {
    for (const key of FILTERS) {
      expect(FILTER_LABELS[key], key).toBeTruthy();
      // Beside each one, so nobody has to guess what it means.
      expect(FILTER_NOTES[key].length, key).toBeGreaterThan(20);
    }
  });

  it("finds a client with something open on them", () => {
    expect(PREDICATES.needs_attention(row({ openQueueItems: 2 }))).toBe(true);
    expect(PREDICATES.needs_attention(row({ flags: 1 }))).toBe(true);
    expect(PREDICATES.needs_attention(row())).toBe(false);
  });

  it("reads low adherence off the band, not off a number typed here", () => {
    // A client at 59 and a client at 61 are on different sides of a line the
    // whole product already draws.
    expect(PREDICATES.low_adherence(row({ adherence: 59 }))).toBe(true);
    expect(PREDICATES.low_adherence(row({ adherence: 61 }))).toBe(false);
    expect(PREDICATES.low_adherence(row({ adherence: null }))).toBe(false);
  });

  it("counts a client who has never checked in as overdue", () => {
    // Never sent one is not the same as having no data, and it is the case
    // most worth seeing.
    expect(PREDICATES.checkin_overdue(row({ daysSinceCheckin: null }))).toBe(true);
  });

  it("does not call a Sunday check-in overdue on the following Monday", () => {
    expect(PREDICATES.checkin_overdue(row({ daysSinceCheckin: CHECKIN_OVERDUE_DAYS }))).toBe(false);
    expect(PREDICATES.checkin_overdue(row({ daysSinceCheckin: CHECKIN_OVERDUE_DAYS + 1 }))).toBe(true);
  });

  it("finds a race inside six weeks and ignores one already run", () => {
    expect(PREDICATES.race_soon(row({ daysToRace: RACE_SOON_DAYS }))).toBe(true);
    expect(PREDICATES.race_soon(row({ daysToRace: RACE_SOON_DAYS + 1 }))).toBe(false);
    expect(PREDICATES.race_soon(row({ daysToRace: -3 }))).toBe(false);
    expect(PREDICATES.race_soon(row({ daysToRace: null }))).toBe(false);
  });

  it("calls onboarding incomplete when either half is missing", () => {
    expect(PREDICATES.onboarding_incomplete(row({ hasApprovedBlueprint: false }))).toBe(true);
    expect(PREDICATES.onboarding_incomplete(row({ hasProgram: false }))).toBe(true);
    expect(PREDICATES.onboarding_incomplete(row())).toBe(false);
  });
});

const ROSTER: RosterCandidate[] = [
  row({ id: "a", name: "Fine" }),
  row({ id: "b", name: "Drifting", adherence: 45 }),
  row({ id: "c", name: "Silent", daysSinceCheckin: null }),
  row({ id: "d", name: "Both", adherence: 40, daysSinceCheckin: 20 }),
  row({ id: "e", name: "Racing", daysToRace: 21 }),
  row({ id: "f", name: "New", hasProgram: false, daysSinceCheckin: null }),
];

describe("combining filters", () => {
  it("narrows rather than widens", () => {
    // "Low adherence or overdue" is most of the roster. Selecting two and
    // getting more rows than one is the behaviour nobody expects.
    const one = applyFilters(ROSTER, ["low_adherence"]);
    const two = applyFilters(ROSTER, ["low_adherence", "checkin_overdue"]);
    expect(two.length).toBeLessThanOrEqual(one.length);
    expect(two.map((entry) => entry.id)).toEqual(["d"]);
  });

  it("returns everything when nothing is selected", () => {
    expect(applyFilters(ROSTER, [])).toHaveLength(ROSTER.length);
  });

  it("can return nothing, which is a real answer", () => {
    expect(applyFilters(ROSTER, ["race_soon", "low_adherence"])).toEqual([]);
  });
});

describe("the counts beside each filter", () => {
  it("promises what the click delivers", () => {
    // A count that says 3 and then shows 5 is the thing that makes people stop
    // trusting them.
    const counts = countsFor(ROSTER, []);
    for (const key of FILTERS) {
      expect(applyFilters(ROSTER, [key]).length, key).toBe(counts[key]);
    }
  });

  it("counts against what is already selected", () => {
    const counts = countsFor(ROSTER, ["low_adherence"]);
    expect(counts.checkin_overdue).toBe(
      applyFilters(ROSTER, ["low_adherence", "checkin_overdue"]).length,
    );
  });

  it("shows a filter already on as the rows it is currently leaving", () => {
    const counts = countsFor(ROSTER, ["low_adherence"]);
    expect(counts.low_adherence).toBe(applyFilters(ROSTER, ["low_adherence"]).length);
  });
});

describe("saved segments", () => {
  it("stores the filters, not the clients", () => {
    // A list of names goes stale the moment someone's adherence changes, and
    // the whole point of "low adherence and no check-in" is that its membership
    // moves.
    const segment = { id: "s1", name: "Slipping", filters: ["low_adherence" as const] };
    expect(segmentMatches(segment, ROSTER).map((entry) => entry.id)).toEqual(["b", "d"]);

    const improved = ROSTER.map((entry) =>
      entry.id === "b" ? { ...entry, adherence: 95 } : entry,
    );
    expect(segmentMatches(segment, improved).map((entry) => entry.id)).toEqual(["d"]);
  });
});

describe("bulk actions", () => {
  it("offers nothing when nothing is selected", () => {
    expect(availableActions([])).toEqual([]);
  });

  it("does not offer pause when everyone selected is already paused", () => {
    // Offering it makes the coach check afterwards whether it worked.
    const paused = [row({ status: "paused" }), row({ id: "2", status: "paused" })];
    expect(availableActions(paused)).not.toContain("pause");
  });

  it("offers pause when at least one is active", () => {
    expect(availableActions([row({ status: "paused" }), row({ id: "2" })])).toContain("pause");
  });

  it("says how many a bulk action would actually change", () => {
    // "Pause 6" when two are already paused is a button that lies about what it
    // is about to do.
    const mixed = [row(), row({ id: "2", status: "paused" }), row({ id: "3" })];
    expect(wouldAffect("pause", mixed)).toBe(2);
    expect(wouldAffect("message", mixed)).toBe(3);
  });

  it("names every action it can offer", () => {
    const everything = availableActions([row({ daysSinceCheckin: 4 })]);
    for (const action of everything) {
      expect(BULK_ACTIONS).toContain(action);
    }
  });
});
