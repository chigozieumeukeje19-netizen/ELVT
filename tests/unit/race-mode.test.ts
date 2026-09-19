import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  checklistFor,
  DISTANCES,
  distanceName,
  formatDuration,
  formatPace,
  fuelingPlan,
  inRaceMode,
  longestRun,
  mileageBand,
  mileageByWeek,
  nextRace,
  PHASE_LABELS,
  RACE_PHASES,
  RACE_WEEK_CHECKLIST,
  raceBriefing,
  racePace,
  raceStatus,
  taperStartsOn,
  taperWeeks,
  weeklyMileage,
  type Race,
  type RunLog,
} from "@/lib/race/mode";

const MARATHON: Race = {
  id: "r1",
  name: "Manchester Marathon",
  date: "2026-04-19",
  metres: 42195,
  goalTimeSeconds: 3 * 3600 + 45 * 60,
  notes: null,
};

const TEN_K: Race = { ...MARATHON, id: "r2", name: "Parklife 10K", metres: 10000, goalTimeSeconds: 48 * 60 };

describe("the countdown", () => {
  it("counts from the day being viewed, not from today", () => {
    // The whole reason this module takes a date: a coach scrolling back to
    // last Tuesday sees the number the client saw on that Tuesday.
    expect(raceStatus(MARATHON, "2026-04-19").daysOut).toBe(0);
    expect(raceStatus(MARATHON, "2026-04-12").daysOut).toBe(7);
    expect(raceStatus(MARATHON, "2026-03-19").daysOut).toBe(31);
  });

  it("reads no clock at all", () => {
    // A function that asks the system what day it is cannot answer "what did
    // this say last Tuesday", which is the thing the spec asks for by name.
    //
    // Comments are stripped first. The first version of this test failed on
    // the sentence at the top of the module explaining why it reads no clock,
    // which is a check that cannot tell a rule from a violation of it.
    const source = readFileSync("src/lib/race/mode.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*\/\/.*$/gm, " ");
    expect(source).not.toMatch(/Date\.now|new Date\(\)/);
  });

  it("goes negative once the race has been run", () => {
    const status = raceStatus(MARATHON, "2026-04-26");
    expect(status.daysOut).toBe(-7);
    expect(status.phase).toBe("done");
    expect(status.weeksRemaining).toBe(0);
  });

  it("rounds weeks up, so eight days out is two weeks", () => {
    expect(raceStatus(MARATHON, "2026-04-11").weeksRemaining).toBe(2);
    expect(raceStatus(MARATHON, "2026-04-12").weeksRemaining).toBe(1);
    expect(raceStatus(MARATHON, "2026-04-18").weeksRemaining).toBe(1);
  });
});

describe("the taper", () => {
  it("is longer for longer races", () => {
    expect(taperWeeks(5000)).toBe(1);
    expect(taperWeeks(10000)).toBe(1);
    expect(taperWeeks(21097)).toBe(2);
    expect(taperWeeks(42195)).toBe(3);
    expect(taperWeeks(50000)).toBe(3);
  });

  it("ends on race day", () => {
    // A three week taper is twenty-one days including the race, so it starts
    // twenty days out rather than twenty-one.
    expect(taperStartsOn(MARATHON)).toBe("2026-03-30");
    expect(taperStartsOn(TEN_K)).toBe("2026-04-13");
  });

  it("says how many days until it starts, and stops saying it once inside", () => {
    expect(raceStatus(MARATHON, "2026-03-23").daysToTaper).toBe(7);
    expect(raceStatus(MARATHON, "2026-03-30").daysToTaper).toBeNull();
  });
});

describe("the phase", () => {
  it("prefers the most specific one that applies", () => {
    // Race week sits inside the taper. Being told you are tapering when it is
    // four days out is true and useless.
    expect(raceStatus(MARATHON, "2026-03-29").phase).toBe("build");
    expect(raceStatus(MARATHON, "2026-03-30").phase).toBe("taper");
    expect(raceStatus(MARATHON, "2026-04-12").phase).toBe("taper");
    expect(raceStatus(MARATHON, "2026-04-13").phase).toBe("race_week");
    expect(raceStatus(MARATHON, "2026-04-19").phase).toBe("race_day");
    expect(raceStatus(MARATHON, "2026-04-20").phase).toBe("done");
  });

  it("never renders a raw enum", () => {
    for (const phase of RACE_PHASES) {
      expect(PHASE_LABELS[phase], phase).toBeTruthy();
      expect(PHASE_LABELS[phase]).not.toContain("_");
    }
  });

  it("turns the client dashboard on for the taper and off before it", () => {
    expect(inRaceMode(raceStatus(MARATHON, "2026-03-29"))).toBe(false);
    expect(inRaceMode(raceStatus(MARATHON, "2026-03-30"))).toBe(true);
    expect(inRaceMode(raceStatus(MARATHON, "2026-04-19"))).toBe(true);
    expect(inRaceMode(raceStatus(MARATHON, "2026-04-20"))).toBe(false);
  });
});

describe("distances", () => {
  it("names the standard ones despite the rounding every listing does", () => {
    // A half marathon is 21,097.5 metres and no two race listings round it the
    // same way.
    expect(distanceName(21097)).toBe("Half marathon");
    expect(distanceName(21098)).toBe("Half marathon");
    expect(distanceName(42195)).toBe("Marathon");
  });

  it("leaves an odd distance as its own number", () => {
    // A 12 mile trail race is not a half marathon.
    expect(distanceName(19312)).toBe("12.0 miles");
  });

  it("offers the five that cover almost every diary", () => {
    expect(DISTANCES.map((entry) => entry.key)).toEqual(["5k", "10k", "half", "marathon", "50k"]);
  });
});

describe("race pace", () => {
  it("comes out of the goal time and the distance", () => {
    const pace = racePace(MARATHON);
    // 3:45 over 26.219 miles.
    expect(formatPace(pace!.secondsPerMile)).toBe("8:35");
    expect(formatPace(pace!.secondsPerKm)).toBe("5:20");
  });

  it("is null when the goal is to finish", () => {
    // Which is a real answer, and better than a pace nobody asked for.
    expect(racePace({ ...MARATHON, goalTimeSeconds: null })).toBeNull();
  });

  it("pads seconds and not minutes", () => {
    expect(formatPace(462)).toBe("7:42");
    expect(formatPace(425)).toBe("7:05");
    expect(formatDuration(13500)).toBe("3:45:00");
    expect(formatDuration(2530)).toBe("42:10");
  });
});

describe("the fueling plan", () => {
  it("carries nothing for a race under an hour", () => {
    const plan = fuelingPlan({ ...MARATHON, metres: 10000, goalTimeSeconds: 48 * 60 }, null);
    expect(plan!.gels).toBe(0);
    expect(plan!.carbsPerHourMax).toBe(0);
  });

  it("steps up past two and a half hours", () => {
    const short = fuelingPlan({ ...MARATHON, metres: 21097, goalTimeSeconds: 105 * 60 }, null)!;
    expect([short.carbsPerHourMin, short.carbsPerHourMax]).toEqual([30, 60]);

    const long = fuelingPlan(MARATHON, null)!;
    expect([long.carbsPerHourMin, long.carbsPerHourMax]).toEqual([60, 90]);
    expect(long.gels).toBeGreaterThan(6);
  });

  it("refuses to invent one with nothing to base a duration on", () => {
    // A plan made up from no information is worse than an empty panel, because
    // the client would take it to the start line.
    expect(fuelingPlan({ ...MARATHON, goalTimeSeconds: null }, null)).toBeNull();
  });

  it("falls back to a recent pace, and says that is what it did", () => {
    const plan = fuelingPlan({ ...MARATHON, goalTimeSeconds: null }, 9 * 60 + 30)!;
    expect(plan.source).toBe("recent_pace");
    expect(formatDuration(plan.estimatedSeconds)).toBe("4:09:05");
  });

  it("prefers the goal time when there is one", () => {
    expect(fuelingPlan(MARATHON, 12 * 60)!.source).toBe("goal_time");
  });
});

describe("the race week checklist", () => {
  it("runs from six days out to race morning", () => {
    const days = RACE_WEEK_CHECKLIST.map((item) => item.daysBefore);
    expect(Math.max(...days)).toBe(6);
    expect(Math.min(...days)).toBe(0);
    // Ordered by when it happens, because the order is the useful part.
    expect([...days].sort((a, b) => b - a)).toEqual(days);
  });

  it("dates every line against the race", () => {
    const lines = checklistFor(MARATHON, "2026-04-16");
    expect(lines.find((line) => line.key === "logistics")!.date).toBe("2026-04-13");
    expect(lines.find((line) => line.key === "fuel")!.date).toBe("2026-04-19");
  });

  it("marks today and what has already gone by, from the viewed day", () => {
    const lines = checklistFor(MARATHON, "2026-04-16");
    expect(lines.filter((line) => line.isToday).map((line) => line.key)).toEqual(["kit"]);
    expect(lines.find((line) => line.key === "logistics")!.isPast).toBe(true);
    expect(lines.find((line) => line.key === "number")!.isPast).toBe(false);
  });
});

const WEEKS = [
  { weekNumber: 1, startsOn: "2026-03-16", plannedMileage: 34 },
  { weekNumber: 2, startsOn: "2026-03-23", plannedMileage: 38 },
  { weekNumber: 3, startsOn: "2026-03-30", plannedMileage: 30 },
  { weekNumber: 4, startsOn: "2026-04-06", plannedMileage: 24 },
  { weekNumber: 5, startsOn: "2026-04-13", plannedMileage: 16 },
  { weekNumber: 6, startsOn: "2026-04-20", plannedMileage: null },
];

const LOGS: RunLog[] = [
  { loggedForDate: "2026-03-17", distance: 6 },
  { loggedForDate: "2026-03-19", distance: 8 },
  { loggedForDate: "2026-03-22", distance: 18 },
  { loggedForDate: "2026-03-24", distance: 6 },
  { loggedForDate: "2026-03-29", distance: 20 },
  { loggedForDate: "2026-04-15", distance: null },
  { loggedForDate: "2026-04-21", distance: 3 },
];

describe("planned against completed", () => {
  it("puts every run in the week that contains its date", () => {
    const rows = mileageByWeek(WEEKS, LOGS, MARATHON);
    expect(rows[0].completed).toBe(32);
    expect(rows[1].completed).toBe(26);
  });

  it("reports no plan as null rather than zero percent", () => {
    // Zero percent says the client missed everything. Null says nobody asked
    // them for anything, and those are opposite facts.
    const rows = mileageByWeek(WEEKS, LOGS, MARATHON);
    expect(rows[5].planned).toBeNull();
    expect(rows[5].percent).toBeNull();
    expect(rows[5].completed).toBe(3);
  });

  it("counts a run logged without a distance as no miles, not as a crash", () => {
    const rows = mileageByWeek(WEEKS, LOGS, MARATHON);
    expect(rows[4].completed).toBe(0);
    expect(rows[4].percent).toBe(0);
  });

  it("marks which weeks are taper and which is race week", () => {
    const rows = mileageByWeek(WEEKS, LOGS, MARATHON);
    expect(rows.filter((row) => row.isTaper).map((row) => row.weekNumber)).toEqual([3, 4, 5]);
    expect(rows.filter((row) => row.isRaceWeek).map((row) => row.weekNumber)).toEqual([5]);
  });

  it("marks nothing when there is no race", () => {
    const rows = mileageByWeek(WEEKS, LOGS, null);
    expect(rows.some((row) => row.isTaper || row.isRaceWeek)).toBe(false);
  });
});

describe("current and longest", () => {
  it("adds up the seven days ending on the viewed date", () => {
    expect(weeklyMileage(LOGS, "2026-03-22")).toBe(32);
    expect(weeklyMileage(LOGS, "2026-03-21")).toBe(14);
  });

  it("does not show a run that had not happened on the day being viewed", () => {
    // Same reason as the countdown. Scrolling back should not leak the future.
    expect(longestRun(LOGS, "2026-03-28")!.distance).toBe(18);
    expect(longestRun(LOGS, "2026-03-29")!.distance).toBe(20);
  });

  it("is null when nothing has been logged yet", () => {
    expect(longestRun([], "2026-03-28")).toBeNull();
    expect(longestRun([{ loggedForDate: "2026-03-01", distance: null }], "2026-03-28")).toBeNull();
  });
});

describe("picking the race", () => {
  const TUNE_UP: Race = { ...MARATHON, id: "r3", name: "Shamrock Half", date: "2026-03-08", metres: 21097 };

  it("counts down to the one in front of them", () => {
    // A marathoner with a tune-up half in the diary has two, and the countdown
    // belongs to the near one.
    expect(nextRace([MARATHON, TUNE_UP], "2026-02-01")!.id).toBe("r3");
    expect(nextRace([MARATHON, TUNE_UP], "2026-03-09")!.id).toBe("r1");
  });

  it("keeps race day itself", () => {
    expect(nextRace([MARATHON, TUNE_UP], "2026-03-08")!.id).toBe("r3");
  });

  it("holds on to the last one rather than emptying the morning after", () => {
    expect(nextRace([MARATHON, TUNE_UP], "2026-05-01")!.id).toBe("r1");
  });

  it("is null when there is no race", () => {
    expect(nextRace([], "2026-05-01")).toBeNull();
  });
});

describe("the mileage band", () => {
  const rows = mileageByWeek(WEEKS, LOGS, MARATHON);

  it("reads the same thresholds as every other band in the product", () => {
    // 32 of 34 is 94 percent, 26 of 38 is 68.
    expect(mileageBand(rows[0])).toBe("ok");
    expect(mileageBand(rows[1])).toBe("watch");
  });

  it("does not colour a taper week", () => {
    // Under plan is what the bands catch, and under plan in a taper week is
    // what a taper is for. Colouring it would teach the coach that the signal
    // colours mean nothing here.
    expect(rows[4].isTaper).toBe(true);
    expect(rows[4].percent).toBe(0);
    expect(mileageBand(rows[4])).toBeNull();
  });

  it("is null with no plan, not a colour", () => {
    expect(mileageBand(rows[5])).toBeNull();
  });
});

describe("the briefing the client app is built from", () => {
  it("resolves everything that does not depend on the day being viewed", () => {
    // The exported app has no imports, so anything it works out itself is a
    // second copy of a rule.
    const brief = raceBriefing(MARATHON, null);
    expect(brief.distance).toBe("Marathon");
    expect(brief.goalTime).toBe("3:45:00");
    expect(brief.pacePerMile).toBe("8:35");
    expect(brief.taperStartsOn).toBe("2026-03-30");
    expect(brief.raceWeekStartsOn).toBe("2026-04-13");
    expect(brief.checklist).toHaveLength(RACE_WEEK_CHECKLIST.length);
    expect(brief.checklist[0].date).toBe("2026-04-13");
  });

  it("renders no raw distance in metres", () => {
    // The client app never shows a number the client did not give.
    expect(raceBriefing({ ...MARATHON, metres: 21097 }, null).distance).toBe("Half marathon");
  });

  it("carries no fueling plan when there is nothing to base one on", () => {
    expect(raceBriefing({ ...MARATHON, goalTimeSeconds: null }, null).fueling).toBeNull();
  });

  it("says to carry nothing for a short race rather than carrying nothing to say", () => {
    const brief = raceBriefing({ ...TEN_K, goalTimeSeconds: 48 * 60 }, null);
    expect(brief.fueling!.gels).toBe(0);
    expect(brief.fueling!.carbs).toBe("Nothing to carry");
  });
});
