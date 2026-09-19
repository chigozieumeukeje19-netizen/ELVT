/**
 * Which metrics a client's Progress tab opens with.
 *
 * Phase defaults, because showing everything shows nothing. A fat loss client
 * opening to mileage and HRV has to hunt for the four numbers their block is
 * actually about, and a coach glancing at the tab between calls will not.
 *
 * Everything else is one toggle away, and the toggle says how many it will add
 * rather than being an unlabelled expander.
 */

import type { GoalType } from "@/lib/blueprint/types";

export const METRICS = [
  "weight", "steps", "sleep_hours", "water", "energy", "mood", "readiness",
  "calories", "protein", "mileage", "adherence", "elvt_score",
] as const;
export type Metric = (typeof METRICS)[number];

export type MetricSpec = {
  key: Metric;
  label: string;
  unit: string;
  /** Whether a higher number is the good direction, for the delta wording. */
  higherIsBetter: boolean;
  /** Where it is read from. daily_logs, or the week roll's snapshot. */
  source: "daily" | "weekly";
  /** How many decimals the figure carries. */
  precision: 0 | 1 | 2;
};

export const SPECS: Record<Metric, MetricSpec> = {
  weight: { key: "weight", label: "Weight", unit: "lb", higherIsBetter: false, source: "daily", precision: 1 },
  steps: { key: "steps", label: "Steps", unit: "", higherIsBetter: true, source: "daily", precision: 0 },
  sleep_hours: { key: "sleep_hours", label: "Sleep", unit: "h", higherIsBetter: true, source: "daily", precision: 1 },
  water: { key: "water", label: "Water", unit: "ml", higherIsBetter: true, source: "daily", precision: 0 },
  energy: { key: "energy", label: "Energy", unit: "", higherIsBetter: true, source: "daily", precision: 0 },
  mood: { key: "mood", label: "Mood", unit: "", higherIsBetter: true, source: "daily", precision: 0 },
  readiness: { key: "readiness", label: "Readiness", unit: "", higherIsBetter: true, source: "daily", precision: 0 },
  calories: { key: "calories", label: "Calories", unit: "", higherIsBetter: true, source: "weekly", precision: 0 },
  protein: { key: "protein", label: "Protein", unit: "g", higherIsBetter: true, source: "weekly", precision: 0 },
  mileage: { key: "mileage", label: "Mileage", unit: "mi", higherIsBetter: true, source: "weekly", precision: 1 },
  adherence: { key: "adherence", label: "Adherence", unit: "%", higherIsBetter: true, source: "weekly", precision: 0 },
  elvt_score: { key: "elvt_score", label: "ELVT score", unit: "", higherIsBetter: true, source: "weekly", precision: 0 },
};

/**
 * The four each phase opens with, from Part 4.5 of the spec.
 *
 * Four rather than a number chosen by what fits: four is what a coach can read
 * without scrolling and what a client can hold in their head.
 */
export const PHASE_DEFAULTS: Record<GoalType, Metric[]> = {
  fat_loss: ["weight", "calories", "protein", "steps"],
  recomp: ["weight", "calories", "protein", "steps"],
  muscle_gain: ["weight", "calories", "protein", "elvt_score"],
  race_prep: ["mileage", "calories", "sleep_hours", "readiness"],
  fitness_test: ["elvt_score", "steps", "sleep_hours", "adherence"],
  return_to_training: ["adherence", "sleep_hours", "energy", "steps"],
};

export function defaultsFor(goal: GoalType): Metric[] {
  return PHASE_DEFAULTS[goal] ?? PHASE_DEFAULTS.recomp;
}

export function everythingElse(goal: GoalType): Metric[] {
  const shown = new Set(defaultsFor(goal));
  return METRICS.filter((metric) => !shown.has(metric));
}

export type Point = { date: string; value: number | null };

export type Series = {
  metric: Metric;
  spec: MetricSpec;
  points: Point[];
  /** Latest value, and how it has moved. Null when there is not enough data. */
  latest: number | null;
  change: number | null;
  /**
   * Whether the change is in the direction the client wants. Null when there is
   * no change to judge, which is not the same as "no movement is fine".
   */
  improving: boolean | null;
};

/** A seven day mean, so a single heavy day does not read as a trend. */
export function smooth(points: Point[], window = 7): Point[] {
  return points.map((point, index) => {
    const slice = points
      .slice(Math.max(0, index - window + 1), index + 1)
      .map((entry) => entry.value)
      .filter((value): value is number => value !== null);

    return {
      date: point.date,
      value: slice.length === 0 ? null : slice.reduce((a, b) => a + b, 0) / slice.length,
    };
  });
}

export function buildSeries(metric: Metric, points: Point[]): Series {
  const spec = SPECS[metric];
  const real = points.filter((point) => point.value !== null);

  const latest = real.length > 0 ? real[real.length - 1].value : null;

  // Compared against a week ago rather than against the previous reading. A
  // client who skipped four days would otherwise show a four day change as if
  // it were a daily one.
  const weekAgo = real.length > 1 ? real[Math.max(0, real.length - 8)].value : null;

  const change =
    latest !== null && weekAgo !== null
      ? Math.round((latest - weekAgo) * 100) / 100
      : null;

  return {
    metric,
    spec,
    points,
    latest,
    change,
    improving:
      change === null || change === 0
        ? null
        : spec.higherIsBetter
          ? change > 0
          : change < 0,
  };
}

export function formatValue(value: number | null, spec: MetricSpec): string {
  if (value === null) return "";
  const rounded = value.toFixed(spec.precision);
  const withCommas = Number(rounded).toLocaleString("en-US", {
    minimumFractionDigits: spec.precision,
    maximumFractionDigits: spec.precision,
  });
  return spec.unit ? `${withCommas}${spec.unit === "%" ? "" : " "}${spec.unit}` : withCommas;
}

/**
 * CSV of exactly what is on screen.
 *
 * Every value, not a summary, because the point of an export is that the coach
 * can do something the portal does not do. CoachRx's own reviews name the lack
 * of one, so this carries the raw rows.
 */
export function toCsv(series: Series[]): string {
  const dates = [...new Set(series.flatMap((one) => one.points.map((point) => point.date)))].sort();

  const header = ["date", ...series.map((one) => one.spec.label)];
  const rows = dates.map((date) => [
    date,
    ...series.map((one) => {
      const point = one.points.find((candidate) => candidate.date === date);
      return point?.value === null || point?.value === undefined ? "" : String(point.value);
    }),
  ]);

  return [header, ...rows]
    .map((row) =>
      row
        // A label with a comma in it would otherwise shift every column after
        // it, and the file would open looking almost right.
        .map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
        .join(","),
    )
    .join("\n");
}

export const RANGES = [
  { key: "28d", label: "4 weeks", days: 28 },
  { key: "84d", label: "12 weeks", days: 84 },
  { key: "all", label: "Everything", days: null },
] as const;
export type RangeKey = (typeof RANGES)[number]["key"];

export function withinRange(points: Point[], range: RangeKey, today: string): Point[] {
  const spec = RANGES.find((entry) => entry.key === range);
  if (!spec || spec.days === null) return points;

  const parts = today.split("-").map(Number);
  const from = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] - spec.days + 1))
    .toISOString()
    .slice(0, 10);

  return points.filter((point) => point.date >= from);
}
