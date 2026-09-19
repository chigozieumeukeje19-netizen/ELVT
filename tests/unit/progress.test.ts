import { describe, expect, it } from "vitest";
import {
  buildSeries,
  defaultsFor,
  everythingElse,
  formatValue,
  METRICS,
  PHASE_DEFAULTS,
  RANGES,
  smooth,
  SPECS,
  toCsv,
  withinRange,
  type Point,
} from "@/lib/progress/metrics";
import { GOAL_TYPES } from "@/lib/blueprint/types";

function points(values: (number | null)[], from = "2026-09-01"): Point[] {
  const parts = from.split("-").map(Number);
  return values.map((value, index) => ({
    date: new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + index))
      .toISOString()
      .slice(0, 10),
    value,
  }));
}

describe("phase defaults", () => {
  it("covers every goal type", () => {
    for (const goal of GOAL_TYPES) {
      expect(PHASE_DEFAULTS[goal], goal).toBeDefined();
    }
  });

  it("opens with four, not with everything", () => {
    // Showing everything shows nothing. A fat loss client opening to mileage
    // and readiness has to hunt for the four their block is about.
    for (const goal of GOAL_TYPES) {
      expect(defaultsFor(goal), goal).toHaveLength(4);
    }
  });

  it("gives a fat loss client the four the spec names", () => {
    expect(defaultsFor("fat_loss")).toEqual(["weight", "calories", "protein", "steps"]);
  });

  it("gives a race prep client mileage rather than weight", () => {
    expect(defaultsFor("race_prep")).toContain("mileage");
    expect(defaultsFor("race_prep")).not.toContain("weight");
  });

  it("names only metrics that exist", () => {
    for (const goal of GOAL_TYPES) {
      for (const metric of defaultsFor(goal)) {
        expect(METRICS, `${goal} wants ${metric}`).toContain(metric);
        expect(SPECS[metric]).toBeDefined();
      }
    }
  });

  it("puts everything not shown behind the expander, with no overlap", () => {
    for (const goal of GOAL_TYPES) {
      const shown = defaultsFor(goal);
      const rest = everythingElse(goal);
      expect([...shown, ...rest].sort()).toEqual([...METRICS].sort());
      expect(rest.filter((metric) => shown.includes(metric))).toEqual([]);
    }
  });
});

describe("the series", () => {
  it("smooths over seven days, so one heavy day is not a trend", () => {
    const raw = points([180, 180, 180, 180, 180, 180, 180, 200]);
    const smoothed = smooth(raw);
    const last = smoothed[smoothed.length - 1].value!;
    // The 200 moves the mean by less than 3, not by 20.
    expect(last).toBeGreaterThan(180);
    expect(last).toBeLessThan(183);
  });

  it("ignores gaps rather than treating them as zero", () => {
    // A client who did not weigh in on Tuesday did not weigh zero.
    const smoothed = smooth(points([180, null, 182]));
    expect(smoothed[2].value).toBe(181);
  });

  it("returns null where there is nothing to average", () => {
    expect(smooth(points([null, null]))[0].value).toBeNull();
  });

  it("compares against a week ago, not against the previous reading", () => {
    // A client who skipped four days would otherwise show a four day change as
    // if it happened overnight.
    const series = buildSeries("weight", points([190, null, null, null, null, null, null, 188]));
    expect(series.latest).toBe(188);
    expect(series.change).toBe(-2);
  });

  it("knows which direction is good for this metric", () => {
    const losing = buildSeries("weight", points([190, 189, 188, 187, 186, 185, 184, 183]));
    expect(losing.change).toBeLessThan(0);
    expect(losing.improving).toBe(true);

    const walking = buildSeries("steps", points([5000, 6000, 7000, 8000, 9000, 9500, 10000, 11000]));
    expect(walking.change).toBeGreaterThan(0);
    expect(walking.improving).toBe(true);
  });

  it("calls a gain on a weight loss client the wrong direction", () => {
    const gaining = buildSeries("weight", points([180, 181, 182, 183, 184, 185, 186, 187]));
    expect(gaining.improving).toBe(false);
  });

  it("has no opinion when nothing moved", () => {
    // Flat is not improving and not failing, and coloring it either way is a
    // claim the data does not support.
    const flat = buildSeries("weight", points([180, 180, 180, 180, 180, 180, 180, 180]));
    expect(flat.change).toBe(0);
    expect(flat.improving).toBeNull();
  });

  it("has no opinion with one reading", () => {
    const one = buildSeries("weight", points([180]));
    expect(one.change).toBeNull();
    expect(one.improving).toBeNull();
  });
});

describe("formatting", () => {
  it("carries the precision the metric deserves", () => {
    expect(formatValue(183.46, SPECS.weight)).toBe("183.5 lb");
    expect(formatValue(9421, SPECS.steps)).toBe("9,421");
  });

  it("says nothing rather than zero when there is nothing", () => {
    expect(formatValue(null, SPECS.weight)).toBe("");
  });
});

describe("the date range", () => {
  it("offers the three the tab needs", () => {
    expect(RANGES.map((range) => range.key)).toEqual(["28d", "84d", "all"]);
  });

  it("cuts to the range", () => {
    const all = points(Array.from({ length: 60 }, (_, i) => 180 + i), "2026-08-01");
    const today = all[all.length - 1].date;
    expect(withinRange(all, "28d", today)).toHaveLength(28);
    expect(withinRange(all, "all", today)).toHaveLength(60);
  });
});

describe("the CSV export", () => {
  const series = [
    buildSeries("weight", points([190, 189.5, null])),
    buildSeries("steps", points([8000, null, 9200])),
  ];

  it("carries every reading, not a summary", () => {
    // The point of an export is doing something the portal does not do.
    const csv = toCsv(series);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("date,Weight,Steps");
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe("2026-09-01,190,8000");
  });

  it("leaves a gap empty rather than writing a zero", () => {
    const csv = toCsv(series);
    expect(csv.split("\n")[2]).toBe("2026-09-02,189.5,");
  });

  it("quotes a value that would otherwise shift every column after it", () => {
    const awkward = [
      {
        ...buildSeries("weight", points([1])),
        spec: { ...SPECS.weight, label: 'Weight, "fasted"' },
      },
    ];
    const header = toCsv(awkward).split("\n")[0];
    expect(header).toBe('date,"Weight, ""fasted"""');
  });
});
