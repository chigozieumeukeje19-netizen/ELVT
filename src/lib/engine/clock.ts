/**
 * Client local time.
 *
 * Every scheduled job in this product runs on the client's clock, never the
 * server's. The week rolls at 23:59 on the client's Sunday, triggers fire at
 * 21:00 on the client's evening, reminders land at the time the client chose.
 * A server in UTC rolling Kyle's week at its own midnight would roll his
 * Saturday, and he would open Monday to a week that had not finished.
 *
 * All of this goes through Intl rather than through arithmetic on offsets,
 * because offsets change twice a year and a hand rolled one is wrong for two
 * weekends a year in a way nobody notices until a client complains.
 */

export type LocalMoment = {
  /** The client's local calendar date as YYYY-MM-DD. */
  date: string;
  /** 0 is Sunday, matching getUTCDay and the schedule jsonb. */
  weekday: number;
  hour: number;
  minute: number;
};

const CACHE = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  const cached = CACHE.get(timezone);
  if (cached) return cached;

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
  } catch {
    throw new Error(
      `"${timezone}" is not a timezone this runtime knows. Client timezones are IANA names such as America/New_York.`,
    );
  }

  CACHE.set(timezone, formatter);
  return formatter;
}

const WEEKDAYS: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export function localMoment(instant: Date, timezone: string): LocalMoment {
  const parts = formatterFor(timezone).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  // Intl renders midnight as hour 24 in some runtimes. That is the same instant
  // as hour 0, and treating it as 24 would put the week roll an hour late once
  // a day, so it is normalised here rather than guarded at every caller.
  const hour = Number(get("hour")) % 24;

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: WEEKDAYS[get("weekday")] ?? 0,
    hour,
    minute: Number(get("minute")),
  };
}

/** The client's local calendar date, which is what every date column stores. */
export function localDate(instant: Date, timezone: string): string {
  return localMoment(instant, timezone).date;
}

export type Schedule = {
  /** 0 is Sunday. */
  weekday: number;
  /** "23:59" in the client's own time. */
  time: string;
};

/**
 * Whether a scheduled moment has arrived for this client.
 *
 * `lastRunLocalDate` is the local date the job last ran for. It is what makes
 * the job idempotent across a scheduler that ticks every minute: once the roll
 * has happened for Sunday the 14th, it does not happen again on the 14th no
 * matter how often the job is woken.
 */
export function isDue(
  instant: Date,
  timezone: string,
  schedule: Schedule,
  lastRunLocalDate: string | null,
): boolean {
  // Parsed before the weekday is looked at, on purpose. Checking the day first
  // means a malformed schedule is silently ignored on six days out of seven and
  // only throws on the seventh, which is the worst way to find out.
  const [hour, minute] = schedule.time.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error(`"${schedule.time}" is not a time. Schedules are "HH:MM".`);
  }

  const now = localMoment(instant, timezone);
  if (now.weekday !== schedule.weekday) return false;

  const reached = now.hour > hour || (now.hour === hour && now.minute >= minute);
  if (!reached) return false;

  return lastRunLocalDate !== now.date;
}

/** The date n days after a YYYY-MM-DD, in calendar days, with no timezone involved. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  // UTC on purpose: this is calendar arithmetic on a plain date, and going
  // through local time here is how a date shifts by one across a DST boundary.
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/** Days between two plain dates, b minus a. */
export function daysBetween(a: string, b: string): number {
  const toUtc = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}
