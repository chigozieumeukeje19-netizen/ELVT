import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  activeFlags,
  ageOn,
  lastTouchpoints,
  nextWeekday,
  phaseOn,
  positionOn,
  summariseCheckin,
  TAB_LABELS,
  TABS,
  tabsFor,
  upcoming,
  UPCOMING_HORIZON_DAYS,
  UPCOMING_LABELS,
  UPCOMING_KINDS,
} from "@/lib/client/overview";
import type { PhaseBand } from "@/lib/program/types";

describe("the tabs", () => {
  it("are the seven from the spec, plus race", () => {
    expect(tabsFor(false)).toEqual([
      "overview", "program", "nutrition", "checkins", "progress", "photos", "blueprint",
    ]);
  });

  it("shows race only when there is one", () => {
    // A tab that is always there and usually says "no race" is a tab people
    // stop reading.
    expect(tabsFor(true)).toContain("race");
    expect(tabsFor(false)).not.toContain("race");
  });

  it("never renders a raw key", () => {
    for (const tab of TABS) {
      expect(TAB_LABELS[tab], tab).toBeTruthy();
      expect(TAB_LABELS[tab]).not.toContain("_");
    }
  });
});

describe("age", () => {
  it("does not count the birthday before it happens", () => {
    expect(ageOn("1991-06-14", "2026-06-13")).toBe(34);
    expect(ageOn("1991-06-14", "2026-06-14")).toBe(35);
  });

  it("is null with no date of birth, not zero", () => {
    // Zero is a number a screen would print.
    expect(ageOn(null, "2026-06-14")).toBeNull();
  });

  it("handles a birthday in December read in January", () => {
    expect(ageOn("1991-12-31", "2026-01-01")).toBe(34);
  });
});

describe("where in the block a day falls", () => {
  const start = "2026-09-21";

  it("makes the start date day one", () => {
    expect(positionOn(start, 12, start)).toMatchObject({ day: 1, week: 1, state: "running" });
  });

  it("counts weeks by sevens", () => {
    expect(positionOn(start, 12, "2026-09-27")!.week).toBe(1);
    expect(positionOn(start, 12, "2026-09-28")!.week).toBe(2);
  });

  it("never prints day zero or day ninety-one of eighty-four", () => {
    // Both are things a screen should never say, so the number is clamped and
    // the state carries the truth instead.
    const before = positionOn(start, 12, "2026-09-01")!;
    expect(before.day).toBe(1);
    expect(before.state).toBe("before");

    const after = positionOn(start, 12, "2027-01-01")!;
    expect(after.day).toBe(84);
    expect(after.state).toBe("finished");
  });

  it("knows the last day of the block", () => {
    expect(positionOn(start, 12, start)!.endsOn).toBe("2026-12-13");
    expect(positionOn(start, 12, "2026-12-13")!.state).toBe("running");
    expect(positionOn(start, 12, "2026-12-14")!.state).toBe("finished");
  });

  it("is null with no start date or no length", () => {
    expect(positionOn(null, 12, start)).toBeNull();
    expect(positionOn(start, null, start)).toBeNull();
    expect(positionOn(start, 0, start)).toBeNull();
  });
});

const PHASES: PhaseBand[] = [
  { name: "Base", startWeek: 1, endWeek: 4, tone: "panel" },
  { name: "Build", startWeek: 5, endWeek: 9, tone: "panel-2" },
  { name: "Peak", startWeek: 10, endWeek: 12, tone: "panel" },
];

describe("the phase chip", () => {
  it("reads the band the week sits in", () => {
    expect(phaseOn(PHASES, 1)).toBe("Base");
    expect(phaseOn(PHASES, 4)).toBe("Base");
    expect(phaseOn(PHASES, 5)).toBe("Build");
    expect(phaseOn(PHASES, 12)).toBe("Peak");
  });

  it("is null outside every band rather than guessing the nearest", () => {
    expect(phaseOn(PHASES, 13)).toBeNull();
    expect(phaseOn([], 1)).toBeNull();
  });
});

describe("active flags", () => {
  it("reads both shapes flag_config comes in", () => {
    // The seed writes booleans; blueprint approval writes dates. Both are in
    // the wild.
    expect(activeFlags({ spine: true, knee: "2026-08-03" })).toEqual([
      { key: "knee", since: "2026-08-03" },
      { key: "spine", since: null },
    ]);
  });

  it("does not invent a date for a boolean", () => {
    // "On file since today" would be a claim nothing supports.
    expect(activeFlags({ spine: true })[0].since).toBeNull();
  });

  it("drops the ones turned off", () => {
    expect(activeFlags({ spine: false, knee: true }).map((flag) => flag.key)).toEqual(["knee"]);
    expect(activeFlags(null)).toEqual([]);
  });
});

const WEEK_STARTS: Record<number, string> = {
  1: "2026-09-21", 2: "2026-09-28", 3: "2026-10-05", 4: "2026-10-12",
  5: "2026-10-19", 6: "2026-10-26", 7: "2026-11-02", 8: "2026-11-09",
  9: "2026-11-16", 10: "2026-11-23", 11: "2026-11-30", 12: "2026-12-07",
};

function events(on: string, overrides: Partial<Parameters<typeof upcoming>[0]> = {}) {
  return upcoming({
    on,
    position: positionOn("2026-09-21", 12, on),
    phases: PHASES,
    weekStarts: WEEK_STARTS,
    raceDate: "2026-10-18",
    raceName: "Portland Half",
    retestWeeks: [6],
    ...overrides,
  });
}

describe("upcoming events", () => {
  it("is in date order, soonest first", () => {
    const dates = events("2026-09-21").map((event) => event.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("puts the Monday photos in even on a Monday", () => {
    // It is today, not next week. A screen that says "in 7 days" on the
    // morning it is due is worse than saying nothing.
    const photos = events("2026-09-21").find((event) => event.kind === "photos")!;
    expect(photos.date).toBe("2026-09-21");
    expect(photos.inDays).toBe(0);
  });

  it("holds nothing that has already happened", () => {
    // Read after the race, the race is not upcoming.
    expect(events("2026-10-19").some((event) => event.kind === "race")).toBe(false);
  });

  it("stops at the horizon rather than listing the whole block", () => {
    const far = events("2026-09-21");
    expect(far.every((event) => event.inDays <= UPCOMING_HORIZON_DAYS)).toBe(true);
    // The block ends 83 days out, which is past it.
    expect(far.some((event) => event.kind === "program_end")).toBe(false);
    expect(events("2026-12-01").some((event) => event.kind === "program_end")).toBe(true);
  });

  it("finds the phase changes ahead and not the one under way", () => {
    // Read in week 4. Build (week 5) and Peak (week 10, 41 days out) are both
    // inside the horizon; Base, which started three weeks ago, is the phase
    // chip rather than an event.
    const ahead = events("2026-10-13").filter((event) => event.kind === "phase_change");
    expect(ahead.map((event) => event.detail)).toEqual([
      "Build starts, week 5",
      "Peak starts, week 10",
    ]);
  });

  it("returns nothing rather than padding the list out", () => {
    expect(
      events("2026-09-21", { phases: [], retestWeeks: [], raceDate: null, position: null })
        .filter((event) => event.kind !== "photos"),
    ).toEqual([]);
  });

  it("names every kind in words", () => {
    for (const kind of UPCOMING_KINDS) {
      expect(UPCOMING_LABELS[kind], kind).toBeTruthy();
      expect(UPCOMING_LABELS[kind]).not.toContain("_");
    }
  });
});

describe("the next weekday", () => {
  it("returns today when today is it", () => {
    expect(nextWeekday("2026-09-21", 1)).toBe("2026-09-21");
  });

  it("wraps into the following week", () => {
    expect(nextWeekday("2026-09-22", 1)).toBe("2026-09-28");
    expect(nextWeekday("2026-09-22", 0)).toBe("2026-09-27");
  });
});

describe("the last five touchpoints", () => {
  const rows = [
    { kind: "message", at: "2026-09-14T10:00:00Z" },
    { kind: "checkin_review", at: "2026-09-15T10:00:00Z" },
    { kind: "message", at: "2026-09-16T10:00:00Z" },
    { kind: "call", at: "2026-09-17T10:00:00Z" },
    { kind: "message", at: "2026-09-18T10:00:00Z" },
    { kind: "voice_note", at: "2026-09-19T10:00:00Z" },
    { kind: "message", at: "2026-09-25T10:00:00Z" },
  ];

  it("is five, most recent first", () => {
    const lines = lastTouchpoints(rows, "2026-09-21");
    expect(lines).toHaveLength(5);
    expect(lines[0].kind).toBe("voice_note");
  });

  it("does not show one that has not happened on the day being read", () => {
    // Same rule as the race countdown. Scrolling back must not leak forward.
    expect(lastTouchpoints(rows, "2026-09-21").some((line) => line.at.startsWith("2026-09-25"))).toBe(
      false,
    );
  });

  it("says how long ago each one was", () => {
    expect(lastTouchpoints(rows, "2026-09-21")[0].daysAgo).toBe(2);
  });

  it("is empty when nothing has reached them", () => {
    expect(lastTouchpoints([], "2026-09-21")).toEqual([]);
  });
});

describe("the last check-in summary", () => {
  const submission = {
    for_date: "2026-09-20",
    answers: {
      weekly_weight: 176.4,
      weekly_adherence: "Good, missed one walk",
      weekly_win: "",
      weekly_struggle: "Thursday evenings",
      weekly_one_thing: "Protein at breakfast",
    },
    reviewed_at: null,
  };

  it("keeps three lines, because the tab holds the rest", () => {
    expect(summariseCheckin(submission, {}, "2026-09-21")!.lines).toHaveLength(3);
  });

  it("drops a question they skipped rather than showing an empty row", () => {
    const lines = summariseCheckin(submission, {}, "2026-09-21", 10)!.lines;
    expect(lines.some((line) => line.answer === "")).toBe(false);
    expect(lines).toHaveLength(4);
  });

  it("uses the question text when the bank has it", () => {
    const lines = summariseCheckin(
      submission,
      { weekly_weight: "Fasted weight, first thing" },
      "2026-09-21",
    )!.lines;
    expect(lines[0].question).toBe("Fasted weight, first thing");
  });

  it("never renders a raw key", () => {
    const lines = summariseCheckin(submission, {}, "2026-09-21")!.lines;
    expect(lines.every((line) => !line.question.includes("_"))).toBe(true);
  });

  it("says how long ago, and whether it has been reviewed", () => {
    const summary = summariseCheckin(submission, {}, "2026-09-21")!;
    expect(summary.daysAgo).toBe(1);
    expect(summary.reviewed).toBe(false);
  });

  it("is null when there has never been one", () => {
    expect(summariseCheckin(null, {}, "2026-09-21")).toBeNull();
  });
});

describe("the module", () => {
  it("reads no clock", () => {
    // Every number on this screen means something different on a different
    // day, so the day is an argument. Comments stripped first: the sentence
    // explaining the rule is not a violation of it.
    const source = readFileSync("src/lib/client/overview.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*\/\/.*$/gm, " ");
    expect(source).not.toMatch(/Date\.now|new Date\(\)/);
  });
});

describe("every tab points at a screen that exists", () => {
  // This is the guard for the hole this screen closes. The roster linked to
  // /coach/clients/<slug> for weeks and that route had no page.tsx, so a tab
  // bar full of plausible links is exactly the thing to check against the
  // filesystem rather than against itself.
  const ROOT = "src/app/coach/clients/[slug]";

  it("has a page for the overview itself", () => {
    expect(existsSync(`${ROOT}/page.tsx`)).toBe(true);
  });

  it("has a page for every other tab", () => {
    const missing = TABS.filter(
      (tab) => tab !== "overview" && !existsSync(`${ROOT}/${tab}/page.tsx`),
    );
    expect(missing).toEqual([]);
  });

  it("checks the real directory, not a list of its own", () => {
    // A test that reads the same array it asserts over proves nothing.
    expect(existsSync(`${ROOT}/definitely-not-a-tab/page.tsx`)).toBe(false);
  });
});
