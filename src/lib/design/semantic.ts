/**
 * The adherence semantic. DESIGN_V2.md Section 2.4.
 *
 * Every figure on every screen resolves to exactly one of five states, and it
 * resolves here rather than on the screen. This is the most important rule in
 * the v2 spec and it is a correctness rule before it is a color rule: a screen
 * that decides for itself what red means will eventually disagree with the one
 * next to it, and the coach acts on whichever they looked at.
 *
 * Green is earned, never a default. Three things follow, and each one was
 * being broken somewhere in the build before this module existed:
 *
 *   Absent is not zero. A missing reading is an em dash and a line saying what
 *   is missing and when it arrives. It is never colored and never counted as
 *   a miss. A client added on Friday has not failed at anything.
 *
 *   Nothing planned is not a failure. A category with no prescription scores
 *   neutral. A rest day with no sessions is a rest day.
 *
 *   A weight figure is neutral unless that client's blueprint states a goal
 *   direction. Weight moving down is only good if down is the goal.
 */

import { BAND_THRESHOLDS, type Band } from "./bands";

/** The marker for an absent reading. The one em dash this product permits. */
export const EM_DASH = "—";

export const FIGURE_STATES = ["absent", "neutral", "ok", "watch", "flag"] as const;
export type FigureState = (typeof FIGURE_STATES)[number];

export type Figure = {
  state: FigureState;
  /** What to render. The em dash when absent. */
  display: string;
  /**
   * The state in words, always. Color is never the only carrier of meaning,
   * so every figure can say what it is without being seen.
   */
  label: string;
  /**
   * Only when absent: what is missing and when it would arrive. A screen that
   * shows an em dash and nothing else has told the reader nothing.
   */
  waitingFor: string | null;
};

export const STATE_LABELS: Record<FigureState, string> = {
  absent: "No reading yet",
  neutral: "No target",
  ok: "On plan",
  watch: "Drifting",
  flag: "Needs attention",
};

/** The Tailwind text color for a state. The only place a figure picks one. */
export function figureClass(state: FigureState): string {
  switch (state) {
    case "ok":
      return "text-ok";
    case "watch":
      return "text-watch";
    case "flag":
      return "text-flag";
    case "absent":
      return "text-txt-tertiary";
    case "neutral":
      return "text-txt";
  }
}

/** A band, as a figure state. Bands are defined once, in bands.ts. */
function stateOf(percent: number): Exclude<FigureState, "absent" | "neutral"> {
  if (percent >= BAND_THRESHOLDS.ok) return "ok";
  if (percent >= BAND_THRESHOLDS.watch) return "watch";
  return "flag";
}

// ---------------------------------------------------------------------------
// Constructors. Every figure on every screen comes from one of these.
// ---------------------------------------------------------------------------

/**
 * A reading that has not arrived.
 *
 * `waitingFor` says what and when, in a sentence a coach can act on. "Their
 * first weigh-in lands Monday" is useful; an em dash on its own is not.
 */
export function absent(waitingFor: string): Figure {
  return { state: "absent", display: EM_DASH, label: STATE_LABELS.absent, waitingFor };
}

/**
 * A real figure with no threshold behind it.
 *
 * A count, a raw measurement, a category with nothing planned. It renders in
 * primary text with no color, because there is nothing to be on plan against.
 */
export function neutral(display: string, label = STATE_LABELS.neutral): Figure {
  return { state: "neutral", display, label, waitingFor: null };
}

/**
 * An adherence fraction: what was done against what was planned.
 *
 * Nothing planned is neutral, not zero percent. Zero percent says the client
 * missed everything; nothing planned says nobody asked them for anything, and
 * those are opposite facts about the same row.
 */
export function adherence(done: number, planned: number): Figure {
  if (planned <= 0) return neutral(EM_DASH, "Nothing planned");

  const percent = (done / planned) * 100;
  const state = stateOf(percent);

  return {
    state,
    display: `${done} of ${planned}`,
    label: `${STATE_LABELS[state]}, ${Math.round(percent)} percent`,
    waitingFor: null,
  };
}

/** A percentage already computed against the bands. */
export function percentage(value: number | null, waitingFor: string): Figure {
  if (value === null || Number.isNaN(value)) return absent(waitingFor);

  const state = stateOf(value);
  return {
    state,
    display: `${Math.round(value)}%`,
    label: STATE_LABELS[state],
    waitingFor: null,
  };
}

/**
 * The ELVT score, which is a percentage and bands like one.
 *
 * Absent until a week has actually closed. A client in week one has no score
 * rather than a score of zero, and the difference is the whole first week.
 */
export function score(value: number | null): Figure {
  if (value === null || Number.isNaN(value)) {
    return absent("Their first week closes Sunday night");
  }

  const state = stateOf(value);
  return { state, display: `${Math.round(value)}`, label: STATE_LABELS[state], waitingFor: null };
}

/** Which way a client's blueprint says their weight should be going. */
export type GoalDirection = "down" | "up" | "hold" | null;

/**
 * A weight reading, and what it has done since last week.
 *
 * Neutral unless the blueprint states a direction. This is named in the spec
 * because it was wrong: the roster colored a stalled weight amber for every
 * client, including the ones whose goal is to hold it, where standing still is
 * the target being hit.
 */
export function weight(
  latest: number | null,
  change: number | null,
  direction: GoalDirection,
  units: "imperial" | "metric" = "imperial",
): Figure {
  const unit = units === "metric" ? "kg" : "lb";

  if (latest === null) return absent("Their next weigh-in is Monday morning");

  const display = `${latest.toFixed(1)} ${unit}`;
  if (direction === null || change === null) {
    return neutral(display, "No goal direction on their blueprint");
  }

  // A fifth of a unit either way is the scale and the time of day, not a
  // change. Anything inside it is standing still.
  const moved = Math.abs(change) > 0.2 ? (change > 0 ? "up" : "down") : "level";

  const state: FigureState =
    direction === "hold"
      ? moved === "level"
        ? "ok"
        : "watch"
      : moved === direction
        ? "ok"
        : moved === "level"
          ? "watch"
          : "flag";

  const words =
    moved === "level" ? "level on last week" : `${moved} ${Math.abs(change).toFixed(1)} on last week`;

  return { state, display, label: `${STATE_LABELS[state]}, ${words}`, waitingFor: null };
}

/**
 * A plain count. Never colored.
 *
 * Sessions logged, photos taken, flags on file. A number with no target is a
 * measurement, and coloring measurements is how a screen ends up with eleven
 * colored things and no signal.
 */
export function count(value: number | null, waitingFor: string, suffix = ""): Figure {
  if (value === null) return absent(waitingFor);
  return neutral(`${value}${suffix}`);
}

/**
 * A check-in, by how overdue it is.
 *
 * Never sent one is absent rather than flagged when the client has not been
 * asked yet, and overdue once they have. The caller says which.
 */
export function checkin(daysSince: number | null, overdueAfterDays: number): Figure {
  if (daysSince === null) return absent("Their first weekly lands on their check-in day");

  const state: FigureState =
    daysSince > overdueAfterDays ? "flag" : daysSince === overdueAfterDays ? "watch" : "neutral";

  return {
    state,
    display: daysSince === 0 ? "Today" : `${daysSince}d`,
    label:
      state === "flag"
        ? "Overdue"
        : state === "watch"
          ? "Due today"
          : `${daysSince} days ago`,
    waitingFor: null,
  };
}

/**
 * Coach contact this week, against the two-a-week target.
 *
 * `hasProgram` is what stops a client who started yesterday reading as
 * flagged. Before there is a program there is nothing to be behind on, which
 * is the same rule as "nothing planned is not a failure".
 */
export function touchpoints(
  thisWeek: number,
  daysSince: number | null,
  options: { target: number; strong: number; hasProgram: boolean },
): Figure {
  if (!options.hasProgram) {
    return neutral(daysSince === null ? EM_DASH : `${daysSince}d`, "Not started yet");
  }

  const state: FigureState =
    thisWeek >= options.strong ? "ok" : thisWeek >= options.target ? "watch" : "flag";

  return {
    state,
    display: daysSince === null ? "Never" : daysSince === 0 ? "Today" : `${daysSince}d`,
    label:
      thisWeek === 0
        ? "Nothing has reached them this week"
        : `${thisWeek} this week, ${STATE_LABELS[state].toLowerCase()}`,
    waitingFor: null,
  };
}

/**
 * A trigger that has actually fired, or a flag on file.
 *
 * Contraindications on file are NOT this. They shape the program and are never
 * an open item, so they are a count. Only a trigger that fired is flagged.
 */
export function fired(count: number, what: string): Figure {
  if (count === 0) return neutral("0", `No ${what}`);
  return {
    state: "flag",
    display: `${count}`,
    label: `${count} ${what}`,
    waitingFor: null,
  };
}

/**
 * A direction of travel across two weeks.
 *
 * One bad week is noise and two is a signal, which is decision rule 2, so the
 * worst a trend can be is drifting. Flagged is reserved for something that has
 * actually happened: a missed session, an overdue check-in, a fired trigger.
 */
export function trend(
  improving: boolean | null,
  display: string,
  direction: GoalDirection,
): Figure {
  if (direction === null) return neutral(display, "No goal direction on their blueprint");
  if (improving === null) return neutral(display, "Not enough readings yet");

  return improving
    ? { state: "ok", display, label: "Moving the right way", waitingFor: null }
    : { state: "watch", display, label: "Moving the wrong way", waitingFor: null };
}

/**
 * Which way a goal type says the scale should move.
 *
 * The one place this mapping exists. A recomp client is holding their weight
 * while the shape changes, so level is the target being hit rather than a
 * stall. Race prep, a fitness test and a return to training say nothing about
 * weight at all, and a figure with nothing to be measured against is neutral.
 */
export function goalDirectionFor(goalType: string | null): GoalDirection {
  switch (goalType) {
    case "fat_loss":
      return "down";
    case "muscle_gain":
      return "up";
    case "recomp":
      return "hold";
    default:
      return null;
  }
}
