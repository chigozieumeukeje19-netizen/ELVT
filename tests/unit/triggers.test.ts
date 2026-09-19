import { describe, expect, it } from "vitest";
import {
  buildLanes,
  LANE_RANK,
  requestItems,
  sameDayItems,
  trendItems,
  type FlagReading,
  type WeekSignal,
} from "@/lib/engine/lanes";
import {
  CONSECUTIVE_DAYS,
  MISSED_SESSIONS,
  NO_ACTIVITY_HOURS,
  planTriggers,
  type DayRow,
  type TriggerInput,
} from "@/lib/engine/triggers";

/** 21:00 on the 20th in New York. */
const EVENING_NY = new Date("2026-09-21T01:00:00Z");
const AFTERNOON_NY = new Date("2026-09-20T19:00:00Z");

function day(date: string, overrides: Partial<DayRow> = {}): DayRow {
  return {
    date,
    steps: 9000,
    sleepHours: 7.5,
    weight: null,
    sessionStatus: "done",
    hadActivity: true,
    mealsLogged: 3,
    checkinSubmitted: true,
    ...overrides,
  };
}

function input(overrides: Partial<TriggerInput> = {}): TriggerInput {
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 7 + i));
    return d.toISOString().slice(0, 10);
  });

  return {
    instant: EVENING_NY,
    client: { id: "c1", slug: "sample", name: "Karar Al-Mansouri", timezone: "America/New_York" },
    triggers: [
      { key: "steps_low", threshold: 6000, suggestedMessage: "Two quiet days on steps. What does tomorrow look like?", active: true },
      { key: "sleep_low", threshold: 6, suggestedMessage: "Sleep is down. Anything changed?", active: true },
    ],
    days: dates.map((date) => day(date)),
    existingQueueKeys: [],
    lastRunLocalDate: null,
    ...overrides,
  };
}

describe("when the trigger engine runs", () => {
  it("runs at 21:00 in the client's evening, not the server's", () => {
    expect(planTriggers(input()).fired.length).toBe(0); // nothing wrong, but it ran
    expect(planTriggers(input()).skipped).toBeNull();

    // The same instant is already past midnight in Kabul, so their evening has
    // gone and nothing runs for them.
    const kabul = planTriggers(
      input({
        client: { id: "c2", slug: "other", name: "Andi Lehmann", timezone: "Asia/Kabul" },
      }),
    );
    expect(kabul.skipped).toMatch(/evening/);
  });

  it("does not run in the afternoon", () => {
    expect(planTriggers(input({ instant: AFTERNOON_NY })).skipped).toMatch(/evening/);
  });

  it("does not run twice on the same local date", () => {
    expect(planTriggers(input({ lastRunLocalDate: "2026-09-20" })).fired).toEqual([]);
  });
});

describe("thresholds", () => {
  it("fires on steps under the client's own threshold two days running", () => {
    const days = input().days;
    days[12] = day(days[12].date, { steps: 5200 });
    days[13] = day(days[13].date, { steps: 4800 });

    const fired = planTriggers(input({ days })).fired;
    expect(fired.some((item) => item.key.startsWith("steps_low"))).toBe(true);
    expect(fired.find((item) => item.key.startsWith("steps_low"))!.suggestedMessage).toContain(
      "tomorrow",
    );
  });

  it("does not fire on one bad day", () => {
    // One day is noise. A queue that surfaces every dip is a queue nobody opens.
    const days = input().days;
    days[13] = day(days[13].date, { steps: 4800 });
    expect(planTriggers(input({ days })).fired.some((i) => i.key.startsWith("steps_low"))).toBe(false);
  });

  it("does not fire on two bad days that are not consecutive", () => {
    const days = input().days;
    days[11] = day(days[11].date, { steps: 4800 });
    days[13] = day(days[13].date, { steps: 4900 });
    expect(planTriggers(input({ days })).fired.some((i) => i.key.startsWith("steps_low"))).toBe(false);
  });

  it("treats a missing day as missing, not as a zero", () => {
    // A client who did not sync is not a client who took no steps.
    const days = input().days;
    days[12] = day(days[12].date, { steps: null });
    days[13] = day(days[13].date, { steps: 4800 });
    expect(planTriggers(input({ days })).fired.some((i) => i.key.startsWith("steps_low"))).toBe(false);
  });

  it("ignores a trigger the coach turned off", () => {
    const days = input().days;
    days[12] = day(days[12].date, { steps: 100 });
    days[13] = day(days[13].date, { steps: 100 });

    const off = planTriggers(
      input({
        days,
        triggers: [
          { key: "steps_low", threshold: 6000, suggestedMessage: "x", active: false },
        ],
      }),
    );
    expect(off.fired.some((i) => i.key.startsWith("steps_low"))).toBe(false);
  });

  it("uses each client's own threshold rather than a house number", () => {
    const days = input().days;
    days[12] = day(days[12].date, { steps: 7000 });
    days[13] = day(days[13].date, { steps: 7000 });

    const walker = planTriggers(
      input({ days, triggers: [{ key: "steps_low", threshold: 12000, suggestedMessage: "x", active: true }] }),
    );
    const sitter = planTriggers(
      input({ days, triggers: [{ key: "steps_low", threshold: 5000, suggestedMessage: "x", active: true }] }),
    );

    expect(walker.fired.some((i) => i.key.startsWith("steps_low"))).toBe(true);
    expect(sitter.fired.some((i) => i.key.startsWith("steps_low"))).toBe(false);
  });
});

describe("the retention scan", () => {
  it("notices 72 hours of silence", () => {
    const days = input().days.map((row, i) =>
      i >= 11 ? day(row.date, { hadActivity: false }) : row,
    );
    const fired = planTriggers(input({ days })).fired;
    expect(fired.some((item) => item.key.startsWith("retention_quiet"))).toBe(true);
  });

  it("does not call two quiet days a retention risk", () => {
    const days = input().days.map((row, i) =>
      i >= 13 ? day(row.date, { hadActivity: false }) : row,
    );
    expect(
      planTriggers(input({ days })).fired.some((i) => i.key.startsWith("retention_quiet")),
    ).toBe(false);
  });

  it("notices a client who never started", () => {
    const days = input().days.map((row) => day(row.date, { hadActivity: false }));
    const fired = planTriggers(input({ days })).fired;
    expect(fired.some((item) => item.key.startsWith("retention_silent"))).toBe(true);
    expect(fired.some((item) => item.key.startsWith("retention_quiet"))).toBe(false);
  });

  it("notices two missed sessions", () => {
    const days = input().days;
    days[9] = day(days[9].date, { sessionStatus: "no" });
    days[12] = day(days[12].date, { sessionStatus: "no" });
    expect(
      planTriggers(input({ days })).fired.some((i) => i.key.startsWith("retention_missed")),
    ).toBe(true);
  });

  it("does not count a rest day or a modified session as a miss", () => {
    const days = input().days;
    days[9] = day(days[9].date, { sessionStatus: "rest" });
    days[10] = day(days[10].date, { sessionStatus: "modified" });
    days[11] = day(days[11].date, { sessionStatus: "rest" });
    expect(
      planTriggers(input({ days })).fired.some((i) => i.key.startsWith("retention_missed")),
    ).toBe(false);
  });

  it("notices three days with no food logged", () => {
    const days = input().days.map((row, i) => (i >= 11 ? day(row.date, { mealsLogged: 0 }) : row));
    expect(
      planTriggers(input({ days })).fired.some((i) => i.key.startsWith("retention_no_food")),
    ).toBe(true);
  });

  it("notices three skipped check-ins", () => {
    const days = input().days.map((row, i) =>
      i >= 11 ? day(row.date, { checkinSubmitted: false }) : row,
    );
    expect(
      planTriggers(input({ days })).fired.some((i) => i.key.startsWith("retention_no_checkin")),
    ).toBe(true);
  });

  it("says nothing about a client who is doing everything", () => {
    // The normal case, and the queue being empty is the correct answer.
    expect(planTriggers(input()).fired).toEqual([]);
  });
});

describe("running it twice", () => {
  it("produces nothing the second time", () => {
    const days = input().days;
    days[12] = day(days[12].date, { steps: 4000 });
    days[13] = day(days[13].date, { steps: 4000 });

    const first = planTriggers(input({ days }));
    expect(first.fired.length).toBeGreaterThan(0);

    const second = planTriggers(
      input({ days, existingQueueKeys: first.fired.map((item) => item.key) }),
    );
    expect(second.fired).toEqual([]);
  });

  it("keys on the local date, so tomorrow is a new evening", () => {
    const days = input().days;
    days[12] = day(days[12].date, { steps: 4000 });
    days[13] = day(days[13].date, { steps: 4000 });

    const tonight = planTriggers(input({ days }));
    const tomorrow = planTriggers(
      input({
        days,
        instant: new Date("2026-09-22T01:00:00Z"),
        existingQueueKeys: tonight.fired.map((item) => item.key),
      }),
    );
    expect(tomorrow.fired.length).toBeGreaterThan(0);
  });
});

const SIGNALS: WeekSignal[] = [
  { key: "steps", label: "Steps", value: 5200, previous: 5600, threshold: 7000, lowerIsWorse: true },
  { key: "adherence", label: "Adherence", value: 4, previous: 8, threshold: 6, lowerIsWorse: true },
  { key: "sleep", label: "Sleep", value: 7.5, previous: 7.2, threshold: 6.5, lowerIsWorse: true },
];

describe("the three decision rules as lanes", () => {
  it("surfaces a signal that has been wrong for two weeks", () => {
    const items = trendItems(SIGNALS);
    expect(items).toHaveLength(1);
    expect(items[0].title).toContain("Steps");
  });

  it("says nothing about one bad week", () => {
    // Adherence went 8 then 4. Bad, but one week, so it is noise.
    expect(trendItems(SIGNALS).some((item) => item.title.includes("Adherence"))).toBe(false);
  });

  it("says nothing at all when nothing trended", () => {
    const fine: WeekSignal[] = SIGNALS.map((signal) => ({ ...signal, value: 9000, previous: 9000 }));
    expect(trendItems(fine)).toEqual([]);
  });

  it("handles a signal where a higher number is worse", () => {
    const pain: WeekSignal[] = [
      { key: "back", label: "Back pain", value: 5, previous: 4, threshold: 3, lowerIsWorse: false },
    ];
    expect(trendItems(pain)).toHaveLength(1);
  });

  it("puts an actionable flag in the same day lane", () => {
    const readings: FlagReading[] = [
      { key: "back", label: "Back discomfort", value: 6, actionableAt: 4, date: "2026-09-20" },
      { key: "knee", label: "Knee discomfort", value: 2, actionableAt: 4, date: "2026-09-20" },
    ];
    const items = sameDayItems(readings);
    expect(items).toHaveLength(1);
    expect(items[0].lane).toBe("same_day");
    // Two past the level is more urgent than one.
    expect(items[0].severity).toBe(5);
  });

  it("answers a direct request either way", () => {
    const items = requestItems([
      { key: "q1", question: "Can I move the long run to Saturday?", askedOn: "2026-09-19", answered: false },
      { key: "q2", question: "Should I take creatine?", askedOn: "2026-09-12", answered: true },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].detail).toContain("long run");
  });

  it("sorts same day above trend above request", () => {
    const items = buildLanes({
      readings: [{ key: "back", label: "Back", value: 6, actionableAt: 4, date: "2026-09-20" }],
      signals: SIGNALS,
      requests: [{ key: "q1", question: "Can I move it?", askedOn: "2026-09-19", answered: false }],
    });

    expect(items.map((item) => item.lane)).toEqual(["same_day", "trend", "request"]);
    for (let i = 1; i < items.length; i += 1) {
      expect(LANE_RANK[items[i].lane]).toBeGreaterThanOrEqual(LANE_RANK[items[i - 1].lane]);
    }
  });

  it("returns nothing for a single bad week with no flag and no trend", () => {
    // The rule that actually saves the coach's week.
    const items = buildLanes({
      readings: [{ key: "back", label: "Back", value: 1, actionableAt: 4, date: "2026-09-20" }],
      signals: [
        { key: "steps", label: "Steps", value: 5200, previous: 9000, threshold: 7000, lowerIsWorse: true },
      ],
      requests: [],
    });
    expect(items).toEqual([]);
  });
});

describe("the constants are the ones the spec names", () => {
  it("matches Part 3", () => {
    expect(NO_ACTIVITY_HOURS).toBe(72);
    expect(MISSED_SESSIONS).toBe(2);
    expect(CONSECUTIVE_DAYS).toBe(2);
  });
});
