import { describe, expect, it } from "vitest";
import {
  ANGLES,
  byWeek,
  clientIdFromPath,
  comparisonsFor,
  pathFor,
  SIGNED_URL_SECONDS,
  type Photo,
} from "@/lib/photos/gallery";

function photo(week: number, angle: (typeof ANGLES)[number], takenOn: string, id = `${week}-${angle}`): Photo {
  return { id, weekNumber: week, takenOn, angle, storagePath: `c/week-${week}/${angle}` };
}

describe("grouping by week", () => {
  it("puts the three angles of a week together", () => {
    const weeks = byWeek([
      photo(1, "front", "2026-09-21"),
      photo(1, "side", "2026-09-21"),
      photo(1, "back", "2026-09-21"),
    ]);

    expect(weeks).toHaveLength(1);
    expect(weeks[0].taken).toBe(3);
    for (const angle of ANGLES) expect(weeks[0].photos[angle]).not.toBeNull();
  });

  it("marks a partial week rather than dropping it", () => {
    // A client who took the front and forgot the back is a different fact from
    // a client who took nothing, and only the first is worth a message.
    const weeks = byWeek([photo(1, "front", "2026-09-21")]);
    expect(weeks[0].taken).toBe(1);
    expect(weeks[0].photos.back).toBeNull();
  });

  it("keeps the most recent when an angle is retaken", () => {
    const weeks = byWeek([
      photo(1, "front", "2026-09-21", "old"),
      photo(1, "front", "2026-09-22", "new"),
    ]);
    expect(weeks[0].photos.front!.id).toBe("new");
    expect(weeks[0].taken).toBe(1);
  });

  it("orders the weeks", () => {
    const weeks = byWeek([
      photo(8, "front", "2026-11-09"),
      photo(1, "front", "2026-09-21"),
      photo(4, "front", "2026-10-12"),
    ]);
    expect(weeks.map((week) => week.weekNumber)).toEqual([1, 4, 8]);
  });
});

describe("the comparisons offered", () => {
  const twelve = byWeek([
    photo(1, "front", "2026-09-21"),
    photo(4, "front", "2026-10-12"),
    photo(8, "front", "2026-11-09"),
    photo(12, "front", "2026-12-07"),
  ]);

  it("offers the three presets the spec names", () => {
    const comparisons = comparisonsFor(twelve, 12);
    expect(comparisons.map((entry) => entry.to)).toEqual([4, 8, 12]);
    for (const entry of comparisons) expect(entry.from).toBe(1);
  });

  it("offers nothing when there is only one set", () => {
    // A comparison needs two. Offering a button that does nothing is worse
    // than not offering one.
    expect(comparisonsFor(byWeek([photo(1, "front", "2026-09-21")]), 12)).toEqual([]);
  });

  it("only offers weeks that actually have photos", () => {
    const sparse = byWeek([photo(1, "front", "2026-09-21"), photo(5, "front", "2026-10-19")]);
    const comparisons = comparisonsFor(sparse, 12);
    expect(comparisons.map((entry) => entry.to)).toEqual([5]);
    expect(comparisons[0].label).toContain("week 5");
  });

  it("does not offer a week against itself", () => {
    const one = byWeek([photo(4, "front", "2026-10-12"), photo(8, "front", "2026-11-09")]);
    expect(comparisonsFor(one, 12).every((entry) => entry.from !== entry.to)).toBe(true);
  });

  it("does not offer the same pair twice", () => {
    // A twelve week program where the latest set is week 12 would otherwise
    // list "against week 12" as both the final and the latest.
    const comparisons = comparisonsFor(twelve, 12);
    expect(new Set(comparisons.map((entry) => entry.to)).size).toBe(comparisons.length);
  });
});

describe("where a photo lives", () => {
  it("keys the folder on the client id", () => {
    // The path is built from the verified token's client_id and never from
    // anything a caller sends, and the storage policy reads the first segment.
    expect(pathFor("11111111-1111-4111-8111-111111111111", 3, "side")).toBe(
      "11111111-1111-4111-8111-111111111111/week-3/side",
    );
  });

  it("reads the client back out of a path", () => {
    expect(clientIdFromPath("11111111-1111-4111-8111-111111111111/week-3/side-1")).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("refuses a path that does not start with a client id", () => {
    expect(clientIdFromPath("week-3/side")).toBeNull();
    expect(clientIdFromPath("../../etc/passwd")).toBeNull();
  });

  it("expires a link in minutes, not days", () => {
    // These are photographs of a person's body. A link that keeps working after
    // it leaks is the thing to avoid.
    expect(SIGNED_URL_SECONDS).toBeLessThanOrEqual(600);
    expect(SIGNED_URL_SECONDS).toBeGreaterThan(60);
  });
});
