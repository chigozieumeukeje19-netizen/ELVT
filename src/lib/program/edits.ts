import type { MaterializedDay, MaterializedWeek } from "./apply-template";

/**
 * Week level edits from spec 4.2, as pure transforms.
 *
 * The rule that matters across all of them: a day carries its whole load, not
 * just its session. Swapping two days moves the sessions, the rest marker and
 * anything else hanging off the day together, because moving a session and
 * leaving the nutrition target behind is how a plan quietly stops making sense.
 *
 * These are pure so they can be tested without a database, and so the server
 * action and any future job apply exactly the same transformation.
 */

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Everything a day carries, minus its position in the week. */
function contentsOf(day: MaterializedDay) {
  return { isRest: day.isRest, sessions: day.sessions };
}

/**
 * Moves every day's contents N positions later in the week, wrapping. The dates
 * stay where they are; what sits on them moves.
 */
export function shiftWeek(week: MaterializedWeek, by: number): MaterializedWeek {
  const size = week.days.length;
  const offset = ((by % size) + size) % size;

  const days = week.days.map((day, index) => {
    const source = week.days[(index - offset + size) % size];
    return { ...day, ...contentsOf(source) };
  });

  return { ...week, days };
}

/** Swaps two days by day of week, contents and all. */
export function swapDays(
  week: MaterializedWeek,
  dayA: number,
  dayB: number,
): MaterializedWeek {
  if (dayA === dayB) return week;

  const a = week.days.find((d) => d.dayOfWeek === dayA);
  const b = week.days.find((d) => d.dayOfWeek === dayB);
  if (!a || !b) return week;

  const days = week.days.map((day) => {
    if (day.dayOfWeek === dayA) return { ...day, ...contentsOf(b) };
    if (day.dayOfWeek === dayB) return { ...day, ...contentsOf(a) };
    return day;
  });

  return { ...week, days };
}

/**
 * Copies one week's contents onto another, keeping the target's dates, week
 * number and deload marking. A deload week that receives a hard week's contents
 * is still marked deload, and the stress rail will say it is not one.
 */
export function copyWeekInto(
  source: MaterializedWeek,
  target: MaterializedWeek,
): MaterializedWeek {
  const days = target.days.map((day, index) => ({
    ...day,
    ...contentsOf(source.days[index]),
  }));

  return { ...target, days };
}

/** Copies one week across an inclusive range of others. */
export function duplicateAcross(
  weeks: MaterializedWeek[],
  sourceWeekNumber: number,
  fromWeek: number,
  toWeek: number,
): MaterializedWeek[] {
  const source = weeks.find((w) => w.weekNumber === sourceWeekNumber);
  if (!source) return weeks;

  const low = Math.min(fromWeek, toWeek);
  const high = Math.max(fromWeek, toWeek);

  return weeks.map((week) => {
    if (week.weekNumber < low || week.weekNumber > high) return week;
    if (week.weekNumber === sourceWeekNumber) return week;
    return copyWeekInto(source, week);
  });
}

/** Empties a week, leaving seven rest days. */
export function clearWeek(week: MaterializedWeek): MaterializedWeek {
  return {
    ...week,
    days: week.days.map((day) => ({ ...day, isRest: true, sessions: [] })),
  };
}

export function setDeload(
  week: MaterializedWeek,
  isDeload: boolean,
): MaterializedWeek {
  return { ...week, isDeload };
}

/**
 * Moves one session between two dates. Used by the day grid's drag and drop.
 *
 * Returns the week unchanged when the session is not where the caller thinks it
 * is, so a stale drag from a page that has since changed cannot duplicate a
 * session or drop one on the floor.
 */
export function moveSession(
  week: MaterializedWeek,
  sessionKey: string,
  fromDate: string,
  toDate: string,
): MaterializedWeek {
  if (fromDate === toDate) return week;

  const from = week.days.find((d) => d.date === fromDate);
  const to = week.days.find((d) => d.date === toDate);
  if (!from || !to) return week;

  const session = from.sessions.find((s) => s.key === sessionKey);
  if (!session) return week;

  const days = week.days.map((day) => {
    if (day.date === fromDate) {
      const sessions = day.sessions.filter((s) => s.key !== sessionKey);
      return { ...day, sessions, isRest: sessions.length === 0 };
    }
    if (day.date === toDate) {
      const sessions = [...day.sessions, session];
      return { ...day, sessions, isRest: false };
    }
    return day;
  });

  return { ...week, days };
}

/** Shifts every date in a week by N days, for a program that moves wholesale. */
export function reschedule(week: MaterializedWeek, byDays: number): MaterializedWeek {
  return {
    ...week,
    startsOn: addDays(week.startsOn, byDays),
    days: week.days.map((day) => ({
      ...day,
      date: addDays(day.date, byDays),
      dayOfWeek: new Date(`${addDays(day.date, byDays)}T00:00:00Z`).getUTCDay(),
    })),
  };
}
