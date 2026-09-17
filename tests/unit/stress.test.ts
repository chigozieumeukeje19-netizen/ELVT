import { describe, expect, it } from "vitest";
import type { MaterializedWeek } from "@/lib/program/apply-template";
import {
  dayStress,
  runStress,
  strengthStress,
  stressFlags,
  weekMileage,
  weekStress,
} from "@/lib/program/stress";
import type { RunType, Stimulus } from "@/lib/program/types";

function day(
  date: string,
  sessions: MaterializedWeek["days"][number]["sessions"],
): MaterializedWeek["days"][number] {
  return {
    date,
    dayOfWeek: new Date(`${date}T00:00:00Z`).getUTCDay(),
    isRest: sessions.length === 0,
    sessions,
  };
}

function lift(stimulus: Stimulus, sets = 9) {
  return {
    key: "lift",
    kind: "strength" as const,
    name: "Lift",
    stimulus,
    fromTemplate: true as const,
    exercises: [
      {
        exerciseId: "x",
        name: "Movement",
        sets: Array.from({ length: sets }, (_, i) => ({ set: i + 1, reps: 8 })),
        trackingFields: ["reps", "weight"],
      },
    ],
  };
}

function run(runType: RunType, distance: number) {
  return {
    key: `run-${runType}`,
    kind: "run" as const,
    name: "Run",
    stimulus: (runType === "long"
      ? "long_run"
      : ["tempo", "threshold", "intervals", "hills", "race_pace", "race"].includes(runType)
        ? "hard_run"
        : "easy_run") as Stimulus,
    fromTemplate: true as const,
    exercises: [],
    run: { runType, stimulus: "easy_run" as Stimulus, distanceTarget: distance },
  };
}

function week(
  weekNumber: number,
  days: MaterializedWeek["days"],
  isDeload = false,
): MaterializedWeek {
  return { weekNumber, startsOn: days[0].date, isDeload, days };
}

describe("strength stress", () => {
  it("costs more for legs than for arms", () => {
    expect(strengthStress(lift("lower_strength"))).toBeGreaterThan(
      strengthStress(lift("upper_strength")),
    );
  });

  it("scales with the number of sets", () => {
    expect(strengthStress(lift("upper_strength", 12))).toBeGreaterThan(
      strengthStress(lift("upper_strength", 6)),
    );
  });

  it("is zero for a session with no sets", () => {
    expect(strengthStress({ stimulus: "mobility", exercises: [] })).toBe(0);
  });

  it("reads a percentage prescription as harder than an easy one", () => {
    const heavy = {
      stimulus: "lower_strength" as Stimulus,
      exercises: [{ sets: [{ set: 1, pct_1rm: 90 }] }],
    };
    const light = {
      stimulus: "lower_strength" as Stimulus,
      exercises: [{ sets: [{ set: 1, pct_1rm: 50 }] }],
    };
    expect(strengthStress(heavy)).toBeGreaterThan(strengthStress(light));
  });
});

describe("run stress", () => {
  it("follows the intensity factors in the spec", () => {
    // Zone 2 is 1, tempo 1.6, intervals 2, long run 1.3.
    expect(runStress({ runType: "zone2", distanceTarget: 10 })).toBe(10);
    expect(runStress({ runType: "tempo", distanceTarget: 10 })).toBe(16);
    expect(runStress({ runType: "intervals", distanceTarget: 10 })).toBe(20);
    expect(runStress({ runType: "long", distanceTarget: 10 })).toBe(13);
  });

  it("falls back to duration when there is no distance", () => {
    expect(runStress({ runType: "easy", durationTarget: 45 })).toBeGreaterThan(0);
  });
});

describe("day and week totals", () => {
  it("adds lifting and running on the same scale", () => {
    const d = day("2026-09-21", [lift("lower_strength"), run("easy", 5)]);
    expect(dayStress(d)).toBe(
      Math.round((strengthStress(lift("lower_strength")) + 5) * 10) / 10,
    );
  });

  it("sums mileage across the week", () => {
    const w = week(1, [
      day("2026-09-21", [run("easy", 5)]),
      day("2026-09-22", []),
      day("2026-09-23", [run("long", 15)]),
      day("2026-09-24", []),
      day("2026-09-25", []),
      day("2026-09-26", []),
      day("2026-09-27", []),
    ]);
    expect(weekMileage(w)).toBe(20);
    expect(weekStress(w)).toBeGreaterThan(0);
  });
});

describe("flags from spec 6.4", () => {
  it("flags a leg session the day before a hard run", () => {
    const w = week(1, [
      day("2026-09-20", []),
      day("2026-09-21", [lift("lower_strength")]),
      day("2026-09-22", [run("tempo", 8)]),
      day("2026-09-23", []),
      day("2026-09-24", []),
      day("2026-09-25", []),
      day("2026-09-26", []),
    ]);
    const kinds = stressFlags([w]).map((f) => f.kind);
    expect(kinds).toContain("legs_near_hard_run");
  });

  it("flags a leg session the day after a hard run", () => {
    const w = week(1, [
      day("2026-09-20", []),
      day("2026-09-21", [run("intervals", 8)]),
      day("2026-09-22", [lift("lower_strength")]),
      day("2026-09-23", []),
      day("2026-09-24", []),
      day("2026-09-25", []),
      day("2026-09-26", []),
    ]);
    expect(stressFlags([w]).map((f) => f.kind)).toContain("legs_near_hard_run");
  });

  it("does not flag an upper body session next to a hard run", () => {
    const w = week(1, [
      day("2026-09-20", []),
      day("2026-09-21", [lift("upper_strength")]),
      day("2026-09-22", [run("tempo", 8)]),
      day("2026-09-23", []),
      day("2026-09-24", []),
      day("2026-09-25", []),
      day("2026-09-26", []),
    ]);
    expect(stressFlags([w]).map((f) => f.kind)).not.toContain("legs_near_hard_run");
  });

  it("flags two hard runs back to back", () => {
    const w = week(1, [
      day("2026-09-20", []),
      day("2026-09-21", [run("tempo", 8)]),
      day("2026-09-22", [run("intervals", 6)]),
      day("2026-09-23", []),
      day("2026-09-24", []),
      day("2026-09-25", []),
      day("2026-09-26", []),
    ]);
    expect(stressFlags([w]).map((f) => f.kind)).toContain("hard_runs_consecutive");
  });

  it("flags a mileage ramp over ten percent of the previous three weeks", () => {
    const flat = (n: number, mileage: number) =>
      week(n, [
        day(`2026-09-${String(20 + (n - 1) * 7).padStart(2, "0")}`, [
          run("easy", mileage),
        ]),
        ...Array.from({ length: 6 }, (_, i) =>
          day(`2026-10-${String(1 + i + n).padStart(2, "0")}`, []),
        ),
      ]);

    const weeks = [flat(1, 20), flat(2, 20), flat(3, 20), flat(4, 30)];
    const ramp = stressFlags(weeks).filter((f) => f.kind === "mileage_ramp");
    expect(ramp.length).toBe(1);
    expect(ramp[0].weekNumber).toBe(4);
  });

  it("does not flag a ramp inside ten percent", () => {
    const flat = (n: number, mileage: number) =>
      week(n, [
        day(`2026-09-${String(20 + (n - 1) * 7).padStart(2, "0")}`, [
          run("easy", mileage),
        ]),
        ...Array.from({ length: 6 }, (_, i) =>
          day(`2026-10-${String(1 + i + n).padStart(2, "0")}`, []),
        ),
      ]);

    const weeks = [flat(1, 20), flat(2, 20), flat(3, 20), flat(4, 21)];
    expect(stressFlags(weeks).filter((f) => f.kind === "mileage_ramp")).toHaveLength(0);
  });

  it("flags a deload carrying more than the week before it", () => {
    const heavy = week(1, [
      day("2026-09-21", [lift("lower_strength", 12)]),
      ...Array.from({ length: 6 }, (_, i) =>
        day(`2026-09-${String(22 + i).padStart(2, "0")}`, []),
      ),
    ]);
    const notADeload = week(
      2,
      [
        day("2026-09-28", [lift("lower_strength", 20)]),
        ...Array.from({ length: 6 }, (_, i) =>
          day(`2026-09-${String(29 + i).padStart(2, "0")}`, []),
        ),
      ],
      true,
    );

    const kinds = stressFlags([heavy, notADeload]).map((f) => f.kind);
    expect(kinds).toContain("deload_not_easier");
  });

  it("never flags a deload week as a spike", () => {
    const heavy = week(
      1,
      [
        day("2026-09-21", [lift("lower_strength", 40)]),
        ...Array.from({ length: 6 }, (_, i) =>
          day(`2026-09-${String(22 + i).padStart(2, "0")}`, []),
        ),
      ],
      true,
    );
    const light = week(2, [
      day("2026-09-28", [lift("upper_strength", 3)]),
      ...Array.from({ length: 6 }, (_, i) =>
        day(`2026-09-${String(29 + i).padStart(2, "0")}`, []),
      ),
    ]);

    const spikes = stressFlags([heavy, light]).filter((f) => f.kind === "week_spike");
    expect(spikes.map((s) => s.weekNumber)).not.toContain(1);
  });

  it("only ever uses the two signal severities Part 2 defines", () => {
    const w = week(1, [
      day("2026-09-20", []),
      day("2026-09-21", [lift("lower_strength")]),
      day("2026-09-22", [run("tempo", 8)]),
      day("2026-09-23", []),
      day("2026-09-24", []),
      day("2026-09-25", []),
      day("2026-09-26", []),
    ]);
    for (const flag of stressFlags([w])) {
      expect(["watch", "flag"]).toContain(flag.severity);
    }
  });

  it("gives a clean week no flags at all", () => {
    const w = week(1, [
      day("2026-09-20", []),
      day("2026-09-21", [lift("upper_strength")]),
      day("2026-09-22", [run("easy", 5)]),
      day("2026-09-23", []),
      day("2026-09-24", [lift("lower_strength")]),
      day("2026-09-25", []),
      day("2026-09-26", [run("easy", 5)]),
    ]);
    expect(stressFlags([w])).toEqual([]);
  });
});
