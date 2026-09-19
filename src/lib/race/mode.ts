/**
 * Race mode.
 *
 * Everything here is a pure function of a race, a date being viewed, and what
 * the client has actually run. Nothing reads a clock. That is deliberate: the
 * countdown has to reflect the day being looked at rather than today, so a
 * coach scrolling back to last Tuesday sees the number the client saw on that
 * Tuesday, and a function that reads Date.now() cannot do that.
 */

import { bandFor, type Band } from "@/lib/design/bands";
import { addDays, daysBetween } from "@/lib/engine/clock";

/** Metres in a mile, exactly. Everything internal is metres. */
export const METRES_PER_MILE = 1609.344;

export const DISTANCES = [
  { key: "5k", name: "5K", metres: 5000 },
  { key: "10k", name: "10K", metres: 10000 },
  { key: "half", name: "Half marathon", metres: 21097 },
  { key: "marathon", name: "Marathon", metres: 42195 },
  { key: "50k", name: "50K", metres: 50000 },
] as const;

export type DistanceKey = (typeof DISTANCES)[number]["key"];

/**
 * The name for a distance in metres.
 *
 * Matched with a tolerance because a half marathon is 21,097.5 metres and
 * every race listing rounds it somewhere different. Anything that is not a
 * standard distance keeps its own number rather than being forced into the
 * nearest name, because a 12 mile trail race is not a half marathon.
 *
 * The tolerance is named rather than written into the comparison. Sixty metres
 * is a rounding allowance on a race distance and has nothing to do with the
 * adherence band that happens to share the number, and the next person reading
 * it should not have to work that out.
 */
const DISTANCE_TOLERANCE_METRES = 60;

export function distanceName(metres: number): string {
  const named = DISTANCES.find(
    (entry) => Math.abs(entry.metres - metres) <= DISTANCE_TOLERANCE_METRES,
  );
  if (named) return named.name;
  return `${(metres / METRES_PER_MILE).toFixed(1)} miles`;
}

export type Race = {
  id: string;
  name: string;
  /** YYYY-MM-DD. */
  date: string;
  metres: number;
  /** Null when the goal is to finish, which is a real answer. */
  goalTimeSeconds: number | null;
  notes: string | null;
};

/**
 * The race race mode is about, as of the day being viewed.
 *
 * The next one on or after that day. A marathoner with a tune-up half in the
 * diary has two, and the countdown belongs to the one in front of them, not
 * the one furthest away. Once every race has been run the most recent one is
 * returned rather than nothing, so the screen can say it went rather than
 * emptying itself the morning after.
 */
export function nextRace(races: Race[], viewedDate: string): Race | null {
  if (races.length === 0) return null;

  const byDate = [...races].sort((a, b) => a.date.localeCompare(b.date));
  return byDate.find((race) => race.date >= viewedDate) ?? byDate[byDate.length - 1];
}

export const RACE_PHASES = ["build", "taper", "race_week", "race_day", "done"] as const;
export type RacePhase = (typeof RACE_PHASES)[number];

export const PHASE_LABELS: Record<RacePhase, string> = {
  build: "Building",
  taper: "Taper",
  race_week: "Race week",
  race_day: "Race day",
  done: "Run",
};

/**
 * How long the taper runs, in weeks.
 *
 * Longer races need longer tapers because the fatigue they are shedding took
 * longer to build. These are the standard bands: about a week for a 5K or 10K,
 * a fortnight for a half, three weeks for a marathon or further.
 */
export function taperWeeks(metres: number): number {
  if (metres < 15000) return 1;
  if (metres < 32000) return 2;
  return 3;
}

/**
 * The first day of the taper.
 *
 * Race day is the last day of it, so a three week taper starts twenty days
 * before the race and the race itself is day twenty-one.
 */
export function taperStartsOn(race: Race): string {
  return addDays(race.date, -(taperWeeks(race.metres) * 7 - 1));
}

export type RaceStatus = {
  /** Days from the viewed date to race day. Negative once it has been run. */
  daysOut: number;
  /** Rounded up, so any part of a week counts as a week. Zero on race day. */
  weeksRemaining: number;
  phase: RacePhase;
  taperStartsOn: string;
  /** Days from the viewed date to the first day of the taper, or null once in it. */
  daysToTaper: number | null;
};

/**
 * Where the client is, as of the day being viewed.
 *
 * Race week is the six days before race day. The taper contains race week and
 * starts earlier, so the phase returned is the most specific one that applies:
 * being in race week is more useful than being told you are tapering.
 */
export function raceStatus(race: Race, viewedDate: string): RaceStatus {
  const daysOut = daysBetween(viewedDate, race.date);
  const taperStart = taperStartsOn(race);
  const daysToTaper = daysBetween(viewedDate, taperStart);

  const phase: RacePhase =
    daysOut < 0
      ? "done"
      : daysOut === 0
        ? "race_day"
        : daysOut <= 6
          ? "race_week"
          : daysToTaper <= 0
            ? "taper"
            : "build";

  return {
    daysOut,
    weeksRemaining: daysOut <= 0 ? 0 : Math.ceil(daysOut / 7),
    phase,
    taperStartsOn: taperStart,
    daysToTaper: daysToTaper <= 0 ? null : daysToTaper,
  };
}

/** Whether the client dashboard should be showing race mode at all. */
export function inRaceMode(status: RaceStatus): boolean {
  return status.phase === "taper" || status.phase === "race_week" || status.phase === "race_day";
}

// ---------------------------------------------------------------------------
// Pace
// ---------------------------------------------------------------------------

export type RacePace = {
  secondsPerMile: number;
  secondsPerKm: number;
};

/** Null when there is no goal time, rather than a made up one. */
export function racePace(race: Race): RacePace | null {
  if (race.goalTimeSeconds === null || race.goalTimeSeconds <= 0) return null;
  return {
    secondsPerMile: race.goalTimeSeconds / (race.metres / METRES_PER_MILE),
    secondsPerKm: race.goalTimeSeconds / (race.metres / 1000),
  };
}

/** "7:42". Seconds are padded; minutes are not, because nobody writes 07:42. */
export function formatPace(seconds: number): string {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

/** "3:45:00" over an hour, "42:10" under it. */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, "0");
  if (hours === 0) return `${minutes}:${rest}`;
  return `${hours}:${String(minutes).padStart(2, "0")}:${rest}`;
}

// ---------------------------------------------------------------------------
// Fueling
// ---------------------------------------------------------------------------

export type FuelingPlan = {
  /** How long the race is expected to take, and where that number came from. */
  estimatedSeconds: number;
  source: "goal_time" | "recent_pace";
  carbsPerHourMin: number;
  carbsPerHourMax: number;
  fluidMlPerHourMin: number;
  fluidMlPerHourMax: number;
  /** At about 25g of carbohydrate each, which is what a standard gel carries. */
  gels: number;
  firstFuelMinutes: number;
  everyMinutes: number;
  note: string;
};

/** A gel is about this much carbohydrate. Used to turn grams into a count. */
const GRAMS_PER_GEL = 25;

/**
 * What to eat and drink, and when.
 *
 * Driven by how long the race will take rather than how far it is, because an
 * hour is an hour whether it was four miles or seven. The bands are the
 * standard endurance ones: nothing under an hour, 30 to 60 grams an hour up to
 * about two and a half, 60 to 90 beyond that.
 *
 * Returns null when there is nothing to base a duration on. A fueling plan
 * invented from no information is worse than an empty panel saying what it
 * needs, because the client would take it to the start line.
 */
export function fuelingPlan(
  race: Race,
  recentSecondsPerMile: number | null,
): FuelingPlan | null {
  const pace = racePace(race);

  const estimated = pace
    ? { seconds: race.goalTimeSeconds as number, source: "goal_time" as const }
    : recentSecondsPerMile !== null && recentSecondsPerMile > 0
      ? {
          seconds: recentSecondsPerMile * (race.metres / METRES_PER_MILE),
          source: "recent_pace" as const,
        }
      : null;

  if (!estimated) return null;

  const hours = estimated.seconds / 3600;

  if (hours < 1) {
    return {
      estimatedSeconds: estimated.seconds,
      source: estimated.source,
      carbsPerHourMin: 0,
      carbsPerHourMax: 0,
      fluidMlPerHourMin: 0,
      fluidMlPerHourMax: 400,
      gels: 0,
      firstFuelMinutes: 0,
      everyMinutes: 0,
      note: "Under an hour. Nothing to carry. Drink to thirst and get to the start line topped up.",
    };
  }

  const long = hours >= 2.5;
  const carbsPerHourMin = long ? 60 : 30;
  const carbsPerHourMax = long ? 90 : 60;
  const midpoint = (carbsPerHourMin + carbsPerHourMax) / 2;

  return {
    estimatedSeconds: estimated.seconds,
    source: estimated.source,
    carbsPerHourMin,
    carbsPerHourMax,
    fluidMlPerHourMin: 400,
    fluidMlPerHourMax: 800,
    // Fueling starts at 45 minutes, so the hours before that are not carrying
    // anything and the count is not inflated by them.
    gels: Math.max(1, Math.round(((estimated.seconds - 45 * 60) / 3600) * midpoint / GRAMS_PER_GEL)),
    firstFuelMinutes: 45,
    everyMinutes: long ? 20 : 25,
    note: "Rehearse it on a long run. The start line is not the place to find out your stomach disagrees.",
  };
}

// ---------------------------------------------------------------------------
// Race week checklist
// ---------------------------------------------------------------------------

export type ChecklistItem = {
  key: string;
  /** Days before the race this belongs to. 0 is race morning. */
  daysBefore: number;
  text: string;
};

/**
 * The race week checklist, fixed.
 *
 * Every line is something that goes wrong when it is left to race morning. It
 * is ordered by when it should happen rather than by importance, because the
 * order is the useful part.
 */
export const RACE_WEEK_CHECKLIST: ChecklistItem[] = [
  { key: "logistics", daysBefore: 6, text: "Confirm the start time, how you are getting there, and where you are parking." },
  { key: "last_quality", daysBefore: 5, text: "Last hard session is done. Everything from here stays easy, and that is the point." },
  { key: "forecast", daysBefore: 4, text: "Check the forecast and decide what you are wearing in it." },
  { key: "kit", daysBefore: 3, text: "Lay the kit out. Shoes you have already run in. Nothing new on race day." },
  { key: "rehearse_breakfast", daysBefore: 2, text: "Eat the race morning breakfast, at the time you will eat it, and see how it sits." },
  { key: "hydrate", daysBefore: 2, text: "Drink across the day rather than a litre before bed." },
  { key: "number", daysBefore: 1, text: "Pin the number, fit the timing chip, charge the watch." },
  { key: "early_night", daysBefore: 1, text: "Two nights out is the sleep that counts. Get it tonight." },
  { key: "fuel", daysBefore: 0, text: "Carry the fuel you trained with, warm up, and start slower than feels right." },
];

export type ChecklistLine = ChecklistItem & {
  /** The calendar date this line belongs to. */
  date: string;
  /** Today by the viewed date. */
  isToday: boolean;
  /** Its day has already passed. */
  isPast: boolean;
};

export function checklistFor(race: Race, viewedDate: string): ChecklistLine[] {
  return RACE_WEEK_CHECKLIST.map((item) => {
    const date = addDays(race.date, -item.daysBefore);
    const offset = daysBetween(viewedDate, date);
    return { ...item, date, isToday: offset === 0, isPast: offset < 0 };
  });
}

// ---------------------------------------------------------------------------
// Planned versus completed mileage
// ---------------------------------------------------------------------------

export type PlannedWeek = {
  weekNumber: number;
  /** YYYY-MM-DD, the Monday or whichever day the block starts on. */
  startsOn: string;
  plannedMileage: number | null;
};

export type RunLog = {
  loggedForDate: string;
  /** Miles. Null when the client logged a run without a distance. */
  distance: number | null;
};

export type WeekMileage = {
  weekNumber: number;
  startsOn: string;
  planned: number | null;
  completed: number;
  /** Null when there is no plan to compare against, never zero. */
  percent: number | null;
  isTaper: boolean;
  isRaceWeek: boolean;
};

/**
 * Planned against completed, week by week.
 *
 * A week with no plan reports null rather than zero percent. Zero percent says
 * the client missed everything; null says nobody asked them for anything, and
 * those are opposite facts.
 */
export function mileageByWeek(
  weeks: PlannedWeek[],
  logs: RunLog[],
  race: Race | null,
): WeekMileage[] {
  const taperStart = race ? taperStartsOn(race) : null;
  const raceWeekStart = race ? addDays(race.date, -6) : null;

  return weeks.map((week) => {
    const end = addDays(week.startsOn, 6);
    const completed = logs
      .filter((log) => log.loggedForDate >= week.startsOn && log.loggedForDate <= end)
      .reduce((total, log) => total + (log.distance ?? 0), 0);

    const planned = week.plannedMileage;

    return {
      weekNumber: week.weekNumber,
      startsOn: week.startsOn,
      planned,
      completed: round1(completed),
      percent: planned === null || planned === 0 ? null : (completed / planned) * 100,
      // A week counts as taper or race week when the race falls inside it or
      // after it, not when it merely overlaps a day of it.
      isTaper: taperStart !== null && end >= taperStart && week.startsOn <= (race as Race).date,
      isRaceWeek:
        raceWeekStart !== null && end >= raceWeekStart && week.startsOn <= (race as Race).date,
    };
  });
}

/** Miles run in the seven days ending on the given date, inclusive. */
export function weeklyMileage(logs: RunLog[], endingOn: string): number {
  const start = addDays(endingOn, -6);
  return round1(
    logs
      .filter((log) => log.loggedForDate >= start && log.loggedForDate <= endingOn)
      .reduce((total, log) => total + (log.distance ?? 0), 0),
  );
}

export type LongestRun = { distance: number; date: string };

/**
 * The longest single run on or before the viewed date.
 *
 * Bounded by the viewed date for the same reason the countdown is: looking at
 * last Tuesday should not show a run that had not happened yet.
 */
export function longestRun(logs: RunLog[], onOrBefore: string): LongestRun | null {
  let best: LongestRun | null = null;
  for (const log of logs) {
    if (log.distance === null || log.loggedForDate > onOrBefore) continue;
    if (!best || log.distance > best.distance) {
      best = { distance: log.distance, date: log.loggedForDate };
    }
  }
  return best;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * The band a mileage week reads in.
 *
 * Null during the taper, on purpose. Under plan is the thing the adherence
 * bands are built to catch, and under plan in a taper week is what a taper is
 * for. Colouring those rows would teach the coach that the signal colours mean
 * nothing here, which costs more than the row is worth. The rows still say
 * "Taper" in words, and the numbers are still there to read.
 */
export function mileageBand(row: WeekMileage): Band | null {
  if (row.isTaper) return null;
  return bandFor(row.percent);
}

// ---------------------------------------------------------------------------
// The briefing the client app is built from
// ---------------------------------------------------------------------------

export type RaceBriefing = {
  name: string;
  date: string;
  /** Already a phrase. The app never renders a distance in metres. */
  distance: string;
  goalTime: string | null;
  pacePerMile: string | null;
  taperStartsOn: string;
  raceWeekStartsOn: string;
  checklist: { key: string; date: string; text: string }[];
  fueling: {
    carbs: string;
    fluid: string;
    gels: number;
    timing: string;
    note: string;
  } | null;
};

/**
 * Everything the client app needs about a race, worked out here.
 *
 * The exported app is a single file with no imports, so anything it computes
 * is a second implementation of a rule. Every part of race mode that does not
 * depend on which day is being looked at is resolved at export time and
 * inlined: the taper start, race week's first day, the checklist with its
 * dates, the pace, the fueling plan.
 *
 * What is left for the app is comparing the viewed date against three fixed
 * dates. That is date arithmetic, not a rule, and it cannot drift from this.
 */
export function raceBriefing(race: Race, recentSecondsPerMile: number | null): RaceBriefing {
  const pace = racePace(race);
  const plan = fuelingPlan(race, recentSecondsPerMile);

  return {
    name: race.name,
    date: race.date,
    distance: distanceName(race.metres),
    goalTime: race.goalTimeSeconds === null ? null : formatDuration(race.goalTimeSeconds),
    pacePerMile: pace ? formatPace(pace.secondsPerMile) : null,
    taperStartsOn: taperStartsOn(race),
    raceWeekStartsOn: addDays(race.date, -6),
    checklist: RACE_WEEK_CHECKLIST.map((item) => ({
      key: item.key,
      date: addDays(race.date, -item.daysBefore),
      text: item.text,
    })),
    fueling:
      plan === null || plan.gels === 0
        ? plan === null
          ? null
          : {
              carbs: "Nothing to carry",
              fluid: `Up to ${plan.fluidMlPerHourMax} ml an hour`,
              gels: 0,
              timing: "Drink to thirst",
              note: plan.note,
            }
        : {
            carbs: `${plan.carbsPerHourMin} to ${plan.carbsPerHourMax} g an hour`,
            fluid: `${plan.fluidMlPerHourMin} to ${plan.fluidMlPerHourMax} ml an hour`,
            gels: plan.gels,
            timing: `First at ${plan.firstFuelMinutes} minutes, then every ${plan.everyMinutes}`,
            note: plan.note,
          },
  };
}
