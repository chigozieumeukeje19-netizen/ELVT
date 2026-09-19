import { describe, expect, it } from "vitest";
import { addDays, daysBetween, isDue, localDate, localMoment } from "@/lib/engine/clock";
import {
  adherencePercent,
  scoreDay,
  scoreWeek,
  streakThrough,
  weightTrend,
} from "@/lib/engine/scoring";
import { planWeekRoll, rampIncrease, type RollInput } from "@/lib/engine/week-roll";

/**
 * The timezone tests are the point of this file.
 *
 * A server in UTC rolling at its own midnight rolls the wrong day for most of
 * the roster. Every case below picks an instant where the server's date and the
 * client's date disagree, because that is the only case where a wrong
 * implementation is visible.
 */
describe("client local clock", () => {
  it("reads the client's date, not the server's", () => {
    // 02:30 UTC on Monday the 21st. It is still Sunday the 20th in New York and
    // already Monday the 21st in Kabul.
    const instant = new Date("2026-09-21T02:30:00Z");

    expect(localDate(instant, "UTC")).toBe("2026-09-21");
    expect(localDate(instant, "America/New_York")).toBe("2026-09-20");
    expect(localDate(instant, "Asia/Kabul")).toBe("2026-09-21");
  });

  it("gets the weekday right on both sides of the boundary", () => {
    const instant = new Date("2026-09-21T02:30:00Z");
    expect(localMoment(instant, "America/New_York").weekday).toBe(0); // Sunday
    expect(localMoment(instant, "Asia/Kabul").weekday).toBe(1); // Monday
  });

  it("follows daylight saving rather than a fixed offset", () => {
    // New York is UTC-4 in September and UTC-5 in December. A hand rolled
    // offset is wrong for one of these.
    expect(localMoment(new Date("2026-09-21T02:30:00Z"), "America/New_York").hour).toBe(22);
    expect(localMoment(new Date("2026-12-21T02:30:00Z"), "America/New_York").hour).toBe(21);
  });

  it("refuses a timezone it does not know rather than falling back to UTC", () => {
    expect(() => localDate(new Date(), "Mars/Olympus")).toThrow(/not a timezone/);
  });

  it("does arithmetic on plain dates without a timezone shifting them", () => {
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    // Across the US spring forward, where local arithmetic loses an hour and a
    // naive implementation lands back on the same day.
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(daysBetween("2026-03-08", "2026-03-15")).toBe(7);
  });
});

const SUNDAY_2359_NY = new Date("2026-09-21T03:59:00Z"); // 23:59 Sunday in New York
const SUNDAY_2200_NY = new Date("2026-09-21T02:00:00Z"); // 22:00 Sunday in New York

describe("is due", () => {
  const schedule = { weekday: 0, time: "23:59" };

  it("is due at 23:59 on the client's Sunday", () => {
    expect(isDue(SUNDAY_2359_NY, "America/New_York", schedule, null)).toBe(true);
  });

  it("is not due an hour earlier", () => {
    expect(isDue(SUNDAY_2200_NY, "America/New_York", schedule, null)).toBe(false);
  });

  it("is not due for a client whose Sunday has not started", () => {
    // The same instant is already Monday in Kabul, so Sunday is gone.
    expect(isDue(SUNDAY_2359_NY, "Asia/Kabul", schedule, null)).toBe(false);
  });

  it("does not fire twice on the same local date", () => {
    expect(isDue(SUNDAY_2359_NY, "America/New_York", schedule, "2026-09-20")).toBe(false);
  });

  it("refuses a schedule time that is not a time", () => {
    expect(() => isDue(SUNDAY_2359_NY, "UTC", { weekday: 0, time: "half eleven" }, null)).toThrow(
      /not a time/,
    );
  });
});

describe("scoring", () => {
  it("scales a rest day so a perfect one is 100", () => {
    const rest = scoreDay("2026-09-20", [
      { key: "calories", weight: 15, done: true },
      { key: "protein", weight: 15, done: true },
      { key: "steps", weight: 10, done: true },
      { key: "checkin", weight: 5, done: true },
    ]);
    expect(rest.score).toBe(100);
  });

  it("does not credit a task that was not assigned", () => {
    const day = scoreDay("2026-09-20", [
      { key: "training", weight: 30, done: true },
      { key: "calories", weight: 15, done: false },
    ]);
    expect(day.score).toBe(Math.round((30 / 45) * 10000) / 100);
  });

  it("leaves a category with nothing planned out of the week score", () => {
    const week = scoreWeek(
      {
        training: { done: 3, planned: 3 },
        run: { done: 0, planned: 0 },
        calories: { done: 5, planned: 7 },
        protein: { done: 7, planned: 7 },
        steps: { done: 4, planned: 7 },
        checkin: { done: 7, planned: 7 },
      },
      { training: 30, run: 20, calories: 15, protein: 15, steps: 10, checkin: 5 },
    );

    // Nothing was run, so training is not dragged down by it.
    expect(week.categories.training).toBe(100);
    expect(week.score).toBeGreaterThan(0);
  });

  it("names the category furthest below 80 as the focus", () => {
    const week = scoreWeek(
      {
        training: { done: 3, planned: 3 },
        calories: { done: 6, planned: 7 },
        steps: { done: 2, planned: 7 },
        checkin: { done: 7, planned: 7 },
      },
      { training: 30, calories: 15, steps: 10, checkin: 5 },
    );
    expect(week.focus).toBe("movement");
  });

  it("has no focus when nothing is below 80", () => {
    const week = scoreWeek(
      { training: { done: 3, planned: 3 }, checkin: { done: 7, planned: 7 } },
      { training: 30, checkin: 5 },
    );
    expect(week.focus).toBeNull();
  });

  it("counts a streak by scheduled date, so a backfilled day still counts", () => {
    const days = [
      { date: "2026-09-14", score: 90 },
      { date: "2026-09-15", score: 72 },
      { date: "2026-09-16", score: 88 },
      { date: "2026-09-17", score: 95 },
    ];
    expect(streakThrough(days)).toBe(4);
    expect(streakThrough([...days].reverse())).toBe(4);
  });

  it("is not fooled by the order the days arrive in", () => {
    // The 14th scored 55 and is first in the array. A streak read in arrival
    // order stops there and reports 0. Read by scheduled date it is the 17th,
    // 16th and 15th that count, and the run ends at the 14th: three days.
    //
    // This is the case a client who logs Tuesday's session on Wednesday
    // morning actually produces, and the reason the sort is there.
    const arrivedOutOfOrder = [
      { date: "2026-09-14", score: 55 },
      { date: "2026-09-17", score: 95 },
      { date: "2026-09-15", score: 90 },
      { date: "2026-09-16", score: 88 },
    ];
    expect(streakThrough(arrivedOutOfOrder)).toBe(3);
  });

  it("breaks a streak below 70", () => {
    expect(
      streakThrough([
        { date: "2026-09-14", score: 90 },
        { date: "2026-09-15", score: 55 },
        { date: "2026-09-16", score: 88 },
      ]),
    ).toBe(1);
  });

  it("gives a weight trend against the week before", () => {
    const weights = [
      { date: "2026-09-07", weight: 186 },
      { date: "2026-09-09", weight: 185 },
      { date: "2026-09-14", weight: 184 },
      { date: "2026-09-16", weight: 183 },
    ];
    const trend = weightTrend(weights, "2026-09-14", "2026-09-07");
    expect(trend.average).toBe(183.5);
    expect(trend.previousAverage).toBe(185.5);
    expect(trend.change).toBe(-2);
  });

  it("reports no percentage when nothing was planned", () => {
    expect(adherencePercent({ done: 0, planned: 0 })).toBeNull();
  });
});

describe("mileage ramp", () => {
  it("says nothing without three weeks of history", () => {
    expect(rampIncrease({ 4: 30, 5: 40 }, 5)).toBeNull();
  });

  it("measures against the previous three weeks", () => {
    const ramp = rampIncrease({ 2: 20, 3: 20, 4: 20, 5: 26 }, 5)!;
    expect(ramp.average).toBe(20);
    expect(Math.round(ramp.increase)).toBe(30);
  });
});

/** A New York client closing week 5 of a twelve week block. */
function rollInput(overrides: Partial<RollInput> = {}): RollInput {
  const weeks = Array.from({ length: 12 }, (_, i) => ({
    id: `week-${i + 1}`,
    weekNumber: i + 1,
    startsOn: addDays("2026-08-17", i * 7),
    isDeload: i + 1 === 4 || i + 1 === 8,
    plannedMileage: 24,
    snapshot: null,
  }));

  return {
    instant: SUNDAY_2359_NY,
    client: { id: "c1", slug: "sample", name: "Ekaterina Vasilyeva-Whitcombe", timezone: "America/New_York" },
    programId: "p1",
    weeks,
    weekNumber: 5,
    adherence: {
      training: { done: 3, planned: 3 },
      run: { done: 1, planned: 2 },
      calories: { done: 5, planned: 7 },
      protein: { done: 6, planned: 7 },
      steps: { done: 4, planned: 7 },
      checkin: { done: 7, planned: 7 },
    },
    scoringWeights: { training: 30, run: 20, calories: 15, protein: 15, steps: 10, checkin: 5 },
    dailyScores: Array.from({ length: 7 }, (_, i) => ({
      date: addDays("2026-09-14", i),
      score: 80,
    })),
    weights: [
      { date: "2026-09-07", weight: 186 },
      { date: "2026-09-14", weight: 184.5 },
    ],
    completedMileage: { 2: 20, 3: 20, 4: 20, 5: 21 },
    spineVariable: "calories",
    spineChangeId: "change-1",
    existing: { dailyFormDates: [], weeklyFormDates: [], eventKeys: [], queueKeys: [] },
    ...overrides,
  };
}

describe("week roll", () => {
  it("does nothing before 23:59 on the client's Sunday", () => {
    const plan = planWeekRoll(rollInput({ instant: SUNDAY_2200_NY }), null);
    expect(plan.writes).toEqual([]);
    expect(plan.skipped).toMatch(/Sunday/);
  });

  it("rolls the client's Sunday, not the server's", () => {
    // The same instant is Monday in Kabul, so the Kabul client's Sunday has
    // already gone and nothing is produced for them.
    const ny = planWeekRoll(rollInput(), null);
    const kabul = planWeekRoll(
      rollInput({
        client: { id: "c2", slug: "other", name: "Karar Al-Mansouri", timezone: "Asia/Kabul" },
      }),
      null,
    );

    expect(ny.writes.length).toBeGreaterThan(0);
    expect(ny.localDate).toBe("2026-09-20");
    expect(kabul.writes).toEqual([]);
  });

  it("freezes a snapshot with the score, streak, adherence and weight trend", () => {
    const plan = planWeekRoll(rollInput(), null);
    const snapshot = plan.writes.find((write) => write.kind === "snapshot");

    expect(snapshot).toBeDefined();
    if (snapshot?.kind !== "snapshot") throw new Error("no snapshot");

    expect(snapshot.snapshot.weekNumber).toBe(5);
    expect(snapshot.snapshot.streak).toBe(7);
    expect(snapshot.snapshot.score.score).toBeGreaterThan(0);
    expect(snapshot.snapshot.adherencePercent.run).toBe(50);
    expect(snapshot.snapshot.weight.change).toBe(-1.5);
  });

  it("generates seven daily forms and one weekly for next week", () => {
    const plan = planWeekRoll(rollInput(), null);
    const dailies = plan.writes.filter((write) => write.kind === "daily_form");
    const weeklies = plan.writes.filter((write) => write.kind === "weekly_form");

    expect(dailies).toHaveLength(7);
    expect(weeklies).toHaveLength(1);

    // Week 6 starts 2026-09-21, so its Sunday is the 27th.
    if (weeklies[0].kind !== "weekly_form") throw new Error("no weekly");
    expect(weeklies[0].forDate).toBe("2026-09-27");
    expect(weeklies[0].spineVariable).toBe("calories");
    expect(weeklies[0].generatedFromChangeId).toBe("change-1");
  });

  it("emits the event and creates the Monday card", () => {
    const plan = planWeekRoll(rollInput(), null);
    expect(plan.writes.filter((w) => w.kind === "event")).toHaveLength(1);

    const cards = plan.writes.filter((w) => w.kind === "queue_item");
    expect(cards).toHaveLength(1);
    if (cards[0].kind !== "queue_item") throw new Error("no card");
    expect(cards[0].kind_).toBe("monday_review");
    expect(cards[0].title).toContain("Ekaterina");
  });

  it("adds a mileage card when the ramp is over 10 percent", () => {
    const plan = planWeekRoll(
      rollInput({ completedMileage: { 2: 20, 3: 20, 4: 20, 5: 30 } }),
      null,
    );
    const spike = plan.writes.find(
      (write) => write.kind === "queue_item" && write.kind_ === "mileage_spike",
    );
    expect(spike).toBeDefined();
  });

  it("does not double anything when run twice", () => {
    const first = planWeekRoll(rollInput(), null);
    expect(first.writes.length).toBeGreaterThan(0);

    // Everything the first run produced, fed back in as already present.
    const existing = {
      dailyFormDates: first.writes.filter((w) => w.kind === "daily_form").map((w) => w.forDate),
      weeklyFormDates: first.writes.filter((w) => w.kind === "weekly_form").map((w) => w.forDate),
      eventKeys: first.writes.filter((w) => w.kind === "event").map((w) => w.key),
      queueKeys: first.writes.filter((w) => w.kind === "queue_item").map((w) => w.key),
    };

    const weeks = rollInput().weeks.map((week) =>
      week.weekNumber === 5 ? { ...week, snapshot: { frozen: true } } : week,
    );

    const second = planWeekRoll(rollInput({ weeks, existing }), null);
    expect(second.writes).toEqual([]);
    expect(second.skipped).toMatch(/already rolled/);
  });

  it("finishes a run that died halfway without writing the forms twice", () => {
    // Nothing is frozen, so the roll goes ahead. Four of next week's dailies
    // and the weekly already exist from the run that died. Those five are not
    // written again, and the three missing dailies are.
    const first = planWeekRoll(rollInput(), null);
    const dailyDates = first.writes
      .filter((write) => write.kind === "daily_form")
      .map((write) => (write.kind === "daily_form" ? write.forDate : ""));

    const partial = planWeekRoll(
      rollInput({
        existing: {
          dailyFormDates: dailyDates.slice(0, 4),
          weeklyFormDates: ["2026-09-27"],
          eventKeys: [],
          queueKeys: [],
        },
      }),
      null,
    );

    expect(partial.writes.filter((w) => w.kind === "daily_form")).toHaveLength(3);
    expect(partial.writes.filter((w) => w.kind === "weekly_form")).toHaveLength(0);
    // The snapshot was never written, so it still is.
    expect(partial.writes.find((w) => w.kind === "snapshot")).toBeDefined();
  });

  it("does not repeat the event or the queue card a half finished run left behind", () => {
    const first = planWeekRoll(rollInput(), null);
    const eventKeys = first.writes.filter((w) => w.kind === "event").map((w) => w.key);
    const queueKeys = first.writes.filter((w) => w.kind === "queue_item").map((w) => w.key);

    const partial = planWeekRoll(
      rollInput({
        existing: { dailyFormDates: [], weeklyFormDates: [], eventKeys, queueKeys },
      }),
      null,
    );

    expect(partial.writes.filter((w) => w.kind === "event")).toHaveLength(0);
    expect(partial.writes.filter((w) => w.kind === "queue_item")).toHaveLength(0);
    expect(partial.writes.filter((w) => w.kind === "daily_form")).toHaveLength(7);
  });

  it("does not run again for a local date it already ran for", () => {
    const plan = planWeekRoll(rollInput(), "2026-09-20");
    expect(plan.writes).toEqual([]);
  });

  it("produces no forms for the last week of a block", () => {
    const plan = planWeekRoll(rollInput({ weekNumber: 12 }), null);
    expect(plan.writes.filter((w) => w.kind === "daily_form")).toHaveLength(0);
    expect(plan.writes.filter((w) => w.kind === "weekly_form")).toHaveLength(0);
    // The snapshot and the card still happen, since the block still ended.
    expect(plan.writes.find((w) => w.kind === "snapshot")).toBeDefined();
  });
});
