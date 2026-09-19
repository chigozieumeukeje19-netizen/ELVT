/**
 * The client detail Overview.
 *
 * Everything here is a pure function of the client's rows and the day being
 * read. Nothing calls a clock, for the same reason race mode does not: the
 * countdown, the day number and "upcoming" all mean something different on a
 * different day, and a function that asks the system what day it is cannot be
 * asked what yesterday looked like.
 */

import { addDays, daysBetween } from "@/lib/engine/clock";
import type { PhaseBand } from "@/lib/program/types";

export const TABS = [
  "overview",
  "program",
  "nutrition",
  "checkins",
  "progress",
  "photos",
  "blueprint",
  "race",
] as const;
export type Tab = (typeof TABS)[number];

export const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  program: "Program",
  nutrition: "Nutrition",
  checkins: "Check-ins",
  progress: "Progress",
  photos: "Photos",
  blueprint: "Blueprint",
  race: "Race",
};

/**
 * The seven from Part 4, plus Race.
 *
 * Race is the eighth because the route exists and nothing else reaches it, and
 * leaving it off would recreate the hole this screen is here to close. It is
 * hidden for a client with nothing in the diary rather than shown empty: a tab
 * that is always there and usually says "no race" is a tab people stop
 * reading.
 */
export function tabsFor(hasRace: boolean): Tab[] {
  return TABS.filter((tab) => tab !== "race" || hasRace);
}

/** Whole years, counting the birthday. Null with no date of birth on file. */
export function ageOn(dob: string | null, on: string): number | null {
  if (!dob) return null;

  const [birthYear, birthMonth, birthDay] = dob.split("-").map(Number);
  const [year, month, day] = on.split("-").map(Number);
  if (!Number.isFinite(birthYear) || !Number.isFinite(year)) return null;

  let age = year - birthYear;
  // Before the birthday this year, they are still last year's age.
  if (month < birthMonth || (month === birthMonth && day < birthDay)) age -= 1;
  return age >= 0 ? age : null;
}

export type ProgramPosition = {
  /** One based. Day 1 is the start date. */
  day: number;
  totalDays: number;
  week: number;
  totalWeeks: number;
  endsOn: string;
  /** Before it starts, or after it finishes. */
  state: "before" | "running" | "finished";
};

/**
 * Where in the block this day falls.
 *
 * Clamped rather than allowed to go negative or past the end, because "Day 0
 * of 84" and "Day 91 of 84" are both things a screen should never print. The
 * state says which side of the block the day is on so the screen can say it in
 * words instead.
 */
export function positionOn(
  startDate: string | null,
  weeks: number | null,
  on: string,
): ProgramPosition | null {
  if (!startDate || !weeks || weeks <= 0) return null;

  const totalDays = weeks * 7;
  const endsOn = addDays(startDate, totalDays - 1);
  const offset = daysBetween(startDate, on);

  const state = offset < 0 ? "before" : offset >= totalDays ? "finished" : "running";
  const day = Math.min(Math.max(offset + 1, 1), totalDays);

  return {
    day,
    totalDays,
    week: Math.ceil(day / 7),
    totalWeeks: weeks,
    endsOn,
    state,
  };
}

export function phaseOn(phases: PhaseBand[], week: number): string | null {
  return phases.find((band) => week >= band.startWeek && week <= band.endWeek)?.name ?? null;
}

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

export type ActiveFlag = {
  key: string;
  /** When it went on file, or null when nothing recorded it. */
  since: string | null;
};

/**
 * The flags on file, with the date each one arrived.
 *
 * flag_config is a jsonb object whose values are either `true` or a date
 * string. Both shapes are in the wild: the seed writes booleans and the
 * blueprint approval writes dates. A boolean means "on file, date unknown",
 * which is shown as such rather than as today.
 */
export function activeFlags(config: Record<string, unknown> | null): ActiveFlag[] {
  if (!config) return [];

  return Object.entries(config)
    .filter(([, value]) => value !== false && value !== null && value !== undefined)
    .map(([key, value]) => ({
      key,
      since: typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

// ---------------------------------------------------------------------------
// Upcoming events
// ---------------------------------------------------------------------------

export const UPCOMING_KINDS = ["photos", "race", "phase_change", "retest", "program_end"] as const;
export type UpcomingKind = (typeof UPCOMING_KINDS)[number];

export const UPCOMING_LABELS: Record<UpcomingKind, string> = {
  photos: "Photos and weigh-in",
  race: "Race",
  phase_change: "Phase change",
  retest: "Retest",
  program_end: "Block ends",
};

export type UpcomingEvent = {
  kind: UpcomingKind;
  date: string;
  detail: string;
  /** Days from the viewed date. Zero is today. */
  inDays: number;
};

export type UpcomingInput = {
  on: string;
  position: ProgramPosition | null;
  phases: PhaseBand[];
  /** The Monday the block's week N starts on, by week number. */
  weekStarts: Record<number, string>;
  raceDate: string | null;
  raceName: string | null;
  /** Week numbers a retest is scheduled in. */
  retestWeeks: number[];
  /** How far ahead to look. */
  horizonDays?: number;
};

/** Six weeks, which is as far ahead as anything on this screen is actionable. */
export const UPCOMING_HORIZON_DAYS = 42;

/**
 * What is coming, soonest first.
 *
 * Nothing in the past and nothing past the horizon. An empty list is a real
 * answer and the screen says so rather than padding it out.
 */
export function upcoming(input: UpcomingInput): UpcomingEvent[] {
  const horizon = input.horizonDays ?? UPCOMING_HORIZON_DAYS;
  const events: UpcomingEvent[] = [];

  const add = (kind: UpcomingKind, date: string | null, detail: string) => {
    if (!date) return;
    const inDays = daysBetween(input.on, date);
    if (inDays < 0 || inDays > horizon) return;
    events.push({ kind, date, detail, inDays });
  };

  // Photos and the weigh-in are Monday, every week, which is the one recurring
  // thing on this list.
  add("photos", nextWeekday(input.on, 1), "Monday, every week");

  add("race", input.raceDate, input.raceName ?? "In the diary");

  if (input.position) {
    add("program_end", input.position.endsOn, `Week ${input.position.totalWeeks} of ${input.position.totalWeeks}`);
  }

  for (const band of input.phases) {
    const start = input.weekStarts[band.startWeek];
    // The change is the day the phase begins, and only the ones ahead of the
    // day being read. A phase already under way is the phase chip, not an
    // event.
    if (start) add("phase_change", start, `${band.name} starts, week ${band.startWeek}`);
  }

  for (const week of input.retestWeeks) {
    const start = input.weekStarts[week];
    if (start) add("retest", start, `Week ${week}`);
  }

  return events.sort((a, b) => (a.date === b.date ? a.kind.localeCompare(b.kind) : a.date < b.date ? -1 : 1));
}

/** The next given weekday on or after a date. 0 is Sunday. */
export function nextWeekday(from: string, weekday: number): string {
  const [year, month, day] = from.split("-").map(Number);
  const current = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDays(from, (weekday - current + 7) % 7);
}

// ---------------------------------------------------------------------------
// Touchpoints
// ---------------------------------------------------------------------------

export type TouchpointLine = {
  kind: string;
  at: string;
  /** Days before the viewed date. */
  daysAgo: number;
};

/** The last five that reached them, most recent first. */
export function lastTouchpoints(
  rows: { kind: string; at: string }[],
  on: string,
  limit = 5,
): TouchpointLine[] {
  return rows
    .filter((row) => row.at.slice(0, 10) <= on)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, limit)
    .map((row) => ({
      kind: row.kind,
      at: row.at,
      daysAgo: daysBetween(row.at.slice(0, 10), on),
    }));
}

// ---------------------------------------------------------------------------
// Last check-in
// ---------------------------------------------------------------------------

export type CheckinSummary = {
  forDate: string;
  daysAgo: number;
  /** Up to three answered questions, as read lines. */
  lines: { question: string; answer: string }[];
  reviewed: boolean;
};

/**
 * The last weekly, summarised.
 *
 * Three lines, because this is a glance and the Check-ins tab is where the
 * whole thing lives. Blank answers are dropped rather than shown as empty
 * rows: a client who skipped a question did not answer it, and a row saying
 * nothing costs a line of a dense screen.
 */
export function summariseCheckin(
  submission: {
    for_date: string;
    answers: Record<string, unknown> | null;
    reviewed_at: string | null;
  } | null,
  questionText: Record<string, string>,
  on: string,
  limit = 3,
): CheckinSummary | null {
  if (!submission) return null;

  const lines = Object.entries(submission.answers ?? {})
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .slice(0, limit)
    .map(([key, value]) => ({
      question: questionText[key] ?? key.replace(/_/g, " "),
      answer: Array.isArray(value) ? value.join(", ") : String(value),
    }));

  return {
    forDate: submission.for_date,
    daysAgo: daysBetween(submission.for_date, on),
    lines,
    reviewed: submission.reviewed_at !== null,
  };
}
