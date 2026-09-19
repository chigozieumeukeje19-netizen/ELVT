import { buildSeries, defaultsFor, type Point, type Series } from "@/lib/progress/metrics";

/**
 * Fixtures for the progress screens.
 *
 * Built through the real series builder so the deltas and the directions on
 * screen are the ones the code produces. The shapes are chosen to exercise the
 * cases that go wrong: a metric moving the right way, one moving the wrong way,
 * one that is flat, and one with gaps in it.
 */

function trend(from: number, to: number, days = 84, gaps: number[] = []): Point[] {
  const parts = [2026, 7, 1];
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + index))
      .toISOString()
      .slice(0, 10);

    if (gaps.includes(index)) return { date, value: null };

    // A trend with real day to day noise on it, deterministic so the fixture
    // does not move between runs.
    const progress = index / (days - 1);
    const noise = Math.sin(index * 1.7) * (Math.abs(to - from) * 0.06);
    return { date, value: Math.round((from + (to - from) * progress + noise) * 100) / 100 };
  });
}

export const PREVIEW_PROGRESS: Series[] = [
  buildSeries("weight", trend(192.5, 183.4)),
  buildSeries("calories", trend(2650, 2300, 12)),
  buildSeries("protein", trend(193, 193, 12)),
  buildSeries("steps", trend(7400, 5200, 84, [12, 13, 14, 40])),
];

/** Everything, which is what the expander shows. */
export const PREVIEW_PROGRESS_ALL: Series[] = [
  ...PREVIEW_PROGRESS,
  buildSeries("sleep_hours", trend(6.2, 7.1)),
  buildSeries("water", trend(1800, 2400)),
  buildSeries("energy", trend(5, 7)),
  buildSeries("mood", trend(6, 6)),
  buildSeries("readiness", trend(58, 71)),
  buildSeries("mileage", trend(16, 34, 12)),
  buildSeries("adherence", trend(72, 91, 12)),
  buildSeries("elvt_score", trend(68, 88, 12)),
];

/** A client who has logged once, so the charts have nothing to draw. */
export const PREVIEW_PROGRESS_THIN: Series[] = defaultsFor("fat_loss").map((metric) =>
  buildSeries(metric, [{ date: "2026-09-21", value: 190 }]),
);

export const PREVIEW_PROGRESS_EMPTY: Series[] = defaultsFor("fat_loss").map((metric) =>
  buildSeries(metric, []),
);
