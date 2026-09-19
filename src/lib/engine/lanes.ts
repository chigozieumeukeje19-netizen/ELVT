/**
 * The three decision rules, as the queue's lanes.
 *
 * Part 9 of the spec states them, and they are the whole reason this product
 * looks different from a form tool:
 *
 *   1. A flag at an actionable level is handled the same day, not on Monday.
 *   2. A trend across two weeks is a signal. One bad week is noise.
 *   3. A direct request is always answered, even when the answer is no.
 *
 * And the rule that decides what is NOT in the queue, which is the one that
 * actually saves the coach's week: a single bad week with no flag and no trend
 * changes nothing. A queue that surfaces every dip is a queue nobody opens.
 *
 * Encoded here rather than described in a prompt, so the queue's shape holds
 * whether or not an AI job ran.
 */

export const LANES = ["same_day", "trend", "request"] as const;
export type Lane = (typeof LANES)[number];

export const LANE_TITLES: Record<Lane, string> = {
  same_day: "Today",
  trend: "Two weeks running",
  request: "They asked you something",
};

export const LANE_NOTES: Record<Lane, string> = {
  same_day: "A flag at a level that changes what they do today.",
  trend: "Two weeks pointing the same way. One week on its own is noise.",
  request: "Answered either way, including when the answer is no.",
};

/** Where a lane sits. Same day always outranks a trend, which outranks a request. */
export const LANE_RANK: Record<Lane, number> = { same_day: 0, trend: 1, request: 2 };

export type WeekSignal = {
  key: string;
  label: string;
  /** This week's value, and last week's. */
  value: number | null;
  previous: number | null;
  /** The number below which this counts as bad. */
  threshold: number;
  /** True when a lower number is worse. Steps yes, pain no. */
  lowerIsWorse: boolean;
};

export type LaneItem = {
  lane: Lane;
  key: string;
  title: string;
  detail: string;
  severity: number;
};

/** A value on the wrong side of its threshold. */
function isBad(signal: WeekSignal, value: number | null): boolean {
  if (value === null) return false;
  return signal.lowerIsWorse ? value < signal.threshold : value > signal.threshold;
}

/**
 * The rule that keeps the queue short.
 *
 * A bad week only reaches the coach if last week was bad too. One week is
 * noise, and a queue that surfaces every dip trains the coach to skim it.
 */
export function trendItems(signals: WeekSignal[]): LaneItem[] {
  const items: LaneItem[] = [];

  for (const signal of signals) {
    const badNow = isBad(signal, signal.value);
    const badBefore = isBad(signal, signal.previous);

    if (!badNow || !badBefore) continue;

    items.push({
      lane: "trend",
      key: `trend:${signal.key}`,
      title: `${signal.label} has been under ${signal.threshold} for two weeks`,
      detail: `${signal.previous} then ${signal.value}.`,
      severity: 3,
    });
  }

  return items;
}

export type FlagReading = {
  key: string;
  label: string;
  /** What the client reported, on the question's own scale. */
  value: number;
  /** At or above this, it is handled today rather than on Monday. */
  actionableAt: number;
  date: string;
};

export function sameDayItems(readings: FlagReading[]): LaneItem[] {
  return readings
    .filter((reading) => reading.value >= reading.actionableAt)
    .map((reading) => ({
      lane: "same_day" as const,
      key: `flag:${reading.key}:${reading.date}`,
      title: `${reading.label} reported at ${reading.value}`,
      detail: `Above the ${reading.actionableAt} they agreed is worth a message the same day.`,
      // A flag well past its level is the most urgent thing in the queue.
      severity: reading.value >= reading.actionableAt + 2 ? 5 : 4,
    }));
}

export type ClientRequest = {
  key: string;
  question: string;
  askedOn: string;
  answered: boolean;
};

export function requestItems(requests: ClientRequest[]): LaneItem[] {
  return requests
    .filter((request) => !request.answered)
    .map((request) => ({
      lane: "request" as const,
      key: `request:${request.key}`,
      title: "They asked you something",
      detail: request.question,
      severity: 3,
    }));
}

/**
 * The whole queue for one client, in lane order.
 *
 * An empty result is the normal case and a correct one. It means nothing
 * flagged, nothing trended, and nothing was asked, which is exactly when the
 * coach should be doing nothing.
 */
export function buildLanes(input: {
  readings: FlagReading[];
  signals: WeekSignal[];
  requests: ClientRequest[];
}): LaneItem[] {
  return [
    ...sameDayItems(input.readings),
    ...trendItems(input.signals),
    ...requestItems(input.requests),
  ].sort(
    (a, b) => LANE_RANK[a.lane] - LANE_RANK[b.lane] || b.severity - a.severity,
  );
}
