import {
  activeFlags,
  ageOn,
  lastTouchpoints,
  phaseOn,
  positionOn,
  summariseCheckin,
  upcoming,
} from "@/lib/client/overview";
import type { PhaseBand } from "@/lib/program/types";
import { adherenceLines } from "@/lib/queue/review-card";
import type { WeekAdherence } from "@/lib/engine/scoring";

/**
 * Fixtures for the client detail Overview.
 *
 * Fixed dates, because a preview whose screenshot changes tomorrow cannot be
 * asserted against. The long name and the long goal statement are the point of
 * the loaded screen: this is where the top strip either wraps or clips.
 */

export const PREVIEW_ON = "2026-10-22";

export const PREVIEW_PHASES: PhaseBand[] = [
  { name: "Base", startWeek: 1, endWeek: 4, tone: "panel" },
  { name: "Build", startWeek: 5, endWeek: 9, tone: "panel-2" },
  { name: "Peak", startWeek: 10, endWeek: 12, tone: "panel" },
];

export const PREVIEW_WEEK_STARTS: Record<number, string> = Object.fromEntries(
  Array.from({ length: 12 }, (_, index) => {
    const parts = "2026-09-21".split("-").map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + index * 7));
    return [index + 1, date.toISOString().slice(0, 10)];
  }),
);

export const PREVIEW_ADHERENCE: WeekAdherence = {
  training: { done: 4, planned: 4 },
  run: { done: 1, planned: 2 },
  calories: { done: 5, planned: 7 },
  steps: { done: 3, planned: 7 },
  recovery: { done: 6, planned: 7 },
};

/** A client with nothing logged, which is what day one looks like. */
export const PREVIEW_ADHERENCE_EMPTY: WeekAdherence = {};

export const PREVIEW_CLIENT = {
  name: "Ekaterina Vasilyeva-Whitcombe",
  sex: "female",
  dob: "1991-02-14",
  units: "imperial",
  goalStatement:
    "Hold my weight steady and change the shape of it over sixteen weeks, without giving up the Friday dinners.",
  programName: "Twelve week recomposition",
  startDate: "2026-09-21",
  weeks: 12,
  oneThing: "Protein at breakfast. She skips it and the whole day misses.",
  flagConfig: { spine: true, knee: "2026-08-03" } as Record<string, unknown>,
  coachNotes:
    "Fusion at L4 to L5 in 2019. Cleared, but nothing loaded through the spine. She asks about deadlifts roughly once a month; the answer stays no and the hip thrust is the reason it does not matter.",
  score: 78.4,
};

export const PREVIEW_POSITION = positionOn(
  PREVIEW_CLIENT.startDate,
  PREVIEW_CLIENT.weeks,
  PREVIEW_ON,
);

export const PREVIEW_AGE = ageOn(PREVIEW_CLIENT.dob, PREVIEW_ON);
export const PREVIEW_PHASE = PREVIEW_POSITION
  ? phaseOn(PREVIEW_PHASES, PREVIEW_POSITION.week)
  : null;

export const PREVIEW_FLAGS = activeFlags(PREVIEW_CLIENT.flagConfig);

export const PREVIEW_TILES_ADHERENCE = adherenceLines(PREVIEW_ADHERENCE);
export const PREVIEW_TILES_EMPTY = adherenceLines(PREVIEW_ADHERENCE_EMPTY);

export const PREVIEW_CHECKIN = summariseCheckin(
  {
    for_date: "2026-10-18",
    answers: {
      weekly_weight: 174.6,
      weekly_adherence:
        "Four sessions, but the walks went completely. Two clinics ran over and I ate at the desk.",
      weekly_struggle: "Thursday evenings",
      weekly_win: "",
    },
    reviewed_at: null,
  },
  {
    weekly_weight: "Fasted weight, first thing",
    weekly_adherence: "How did the week actually go?",
    weekly_struggle: "Where did it fall apart?",
  },
  PREVIEW_ON,
);

export const PREVIEW_TOUCHPOINTS = lastTouchpoints(
  [
    { kind: "message", at: "2026-10-21T09:12:00Z" },
    { kind: "checkin_review", at: "2026-10-19T18:40:00Z" },
    { kind: "voice_note", at: "2026-10-15T07:05:00Z" },
    { kind: "message", at: "2026-10-13T12:00:00Z" },
    { kind: "call", at: "2026-10-06T16:30:00Z" },
    { kind: "message", at: "2026-09-29T08:00:00Z" },
  ],
  PREVIEW_ON,
);

export const PREVIEW_UPCOMING = upcoming({
  on: PREVIEW_ON,
  position: PREVIEW_POSITION,
  phases: PREVIEW_PHASES,
  weekStarts: PREVIEW_WEEK_STARTS,
  raceDate: "2026-11-08",
  raceName: "Portland Half",
  retestWeeks: [12],
});

export const PREVIEW_RACE_LINE = "Portland Half in 17d, Building";
