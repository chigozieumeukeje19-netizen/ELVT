/**
 * The nightly trigger engine and the retention scan.
 *
 * 21:00 in the client's own time, not the server's, for the same reason the
 * week roll is: a trigger that fires at the server's nine in the evening
 * reaches half the roster at lunchtime and the other half at three in the
 * morning.
 *
 * Pure, like the week roll. It takes a bundle of rows and returns queue items,
 * so the thresholds can be tested without a database and the idempotency rule
 * can be proved by running it twice on the same input.
 */

import { daysBetween, isDue, localMoment } from "./clock";

export const TRIGGER_SCHEDULE = { weekday: -1, time: "21:00" } as const;

export type TriggerDefinition = {
  key: string;
  threshold: number;
  suggestedMessage: string;
  active: boolean;
};

export type DayRow = {
  date: string;
  steps: number | null;
  sleepHours: number | null;
  weight: number | null;
  sessionStatus: "done" | "modified" | "no" | "rest" | null;
  /** Anything the client did in the app that day. */
  hadActivity: boolean;
  mealsLogged: number;
  checkinSubmitted: boolean;
};

export type TriggerInput = {
  instant: Date;
  client: { id: string; slug: string; name: string; timezone: string };
  triggers: TriggerDefinition[];
  /** The last fourteen days, ascending. */
  days: DayRow[];
  /** Keys already in the queue, so a second run adds nothing. */
  existingQueueKeys: string[];
  /** The local date the job last ran for this client. */
  lastRunLocalDate: string | null;
};

export type FiredTrigger = {
  key: string;
  title: string;
  detail: Record<string, unknown>;
  suggestedMessage: string;
  severity: number;
  kind: "trigger" | "retention_risk";
};

export type TriggerPlan = {
  skipped: string | null;
  localDate: string | null;
  fired: FiredTrigger[];
};

/** How many days in a row a threshold has to be missed before it fires. */
export const CONSECUTIVE_DAYS = 2;

/** The four retention checks, from Part 3 of the spec. */
export const NO_ACTIVITY_HOURS = 72;
export const MISSED_SESSIONS = 2;
export const NO_FOOD_LOG_DAYS = 3;
export const NO_CHECKIN_DAYS = 3;

function lastDays(days: DayRow[], count: number): DayRow[] {
  return days.slice(-count);
}

/**
 * Evaluates one client's night.
 *
 * Every fired item carries a key built from the client, the trigger and the
 * local date, so the same trigger firing on the same evening twice produces one
 * queue item however often the job is woken.
 */
export function planTriggers(input: TriggerInput): TriggerPlan {
  // A daily schedule, so the weekday is not checked. isDue handles the time and
  // the once per local date rule; the weekday is compared against itself.
  const now = localMoment(input.instant, input.client.timezone);
  const due = isDue(
    input.instant,
    input.client.timezone,
    { weekday: now.weekday, time: TRIGGER_SCHEDULE.time },
    input.lastRunLocalDate,
  );

  if (!due) {
    return { skipped: "Not 21:00 in this client's evening yet.", localDate: null, fired: [] };
  }

  const localDate = now.date;
  const fired: FiredTrigger[] = [];
  const seen = new Set(input.existingQueueKeys);

  const push = (item: Omit<FiredTrigger, "key"> & { keySuffix: string }) => {
    const key = `${item.keySuffix}:${input.client.id}:${localDate}`;
    if (seen.has(key)) return;
    seen.add(key);
    const { keySuffix: _unused, ...rest } = item;
    void _unused;
    fired.push({ ...rest, key });
  };

  const recent = lastDays(input.days, CONSECUTIVE_DAYS);

  for (const trigger of input.triggers) {
    if (!trigger.active) continue;

    if (trigger.key === "steps_low") {
      const values = recent.map((day) => day.steps);
      if (
        values.length === CONSECUTIVE_DAYS &&
        values.every((steps) => steps !== null && steps < trigger.threshold)
      ) {
        push({
          keySuffix: "steps_low",
          kind: "trigger",
          title: `${input.client.name} was under ${trigger.threshold} steps two days running`,
          detail: { days: recent.map((day) => ({ date: day.date, steps: day.steps })) },
          suggestedMessage: trigger.suggestedMessage,
          severity: 3,
        });
      }
    }

    if (trigger.key === "sleep_low") {
      const values = recent.map((day) => day.sleepHours);
      if (
        values.length === CONSECUTIVE_DAYS &&
        values.every((hours) => hours !== null && hours < trigger.threshold)
      ) {
        push({
          keySuffix: "sleep_low",
          kind: "trigger",
          title: `${input.client.name} slept under ${trigger.threshold} hours two nights running`,
          detail: { days: recent.map((day) => ({ date: day.date, sleep: day.sleepHours })) },
          suggestedMessage: trigger.suggestedMessage,
          severity: 3,
        });
      }
    }
  }

  // --- Retention. Four checks, each a different kind of going quiet. ---

  const lastActive = [...input.days].reverse().find((day) => day.hadActivity);

  if (!lastActive) {
    if (input.days.length > 0) {
      push({
        keySuffix: "retention_silent",
        kind: "retention_risk",
        title: `${input.client.name} has not opened the app at all`,
        detail: { since: input.days[0].date },
        suggestedMessage: "Nothing logged since you started. What is getting in the way?",
        severity: 4,
      });
    }
  } else {
    const hoursQuiet = daysBetween(lastActive.date, localDate) * 24;
    if (hoursQuiet >= NO_ACTIVITY_HOURS) {
      push({
        keySuffix: "retention_quiet",
        kind: "retention_risk",
        title: `${input.client.name} has not logged anything for ${Math.floor(hoursQuiet / 24)} days`,
        detail: { lastActive: lastActive.date, hoursQuiet },
        suggestedMessage: "Quiet few days. Everything alright?",
        severity: 4,
      });
    }
  }

  const missed = input.days.filter((day) => day.sessionStatus === "no").length;
  if (missed >= MISSED_SESSIONS) {
    push({
      keySuffix: "retention_missed",
      kind: "retention_risk",
      title: `${input.client.name} has missed ${missed} sessions`,
      detail: {
        dates: input.days.filter((day) => day.sessionStatus === "no").map((day) => day.date),
      },
      suggestedMessage: "Two sessions missed. Is the week working or does it need moving?",
      severity: 4,
    });
  }

  const foodDays = lastDays(input.days, NO_FOOD_LOG_DAYS);
  if (
    foodDays.length === NO_FOOD_LOG_DAYS &&
    foodDays.every((day) => day.mealsLogged === 0)
  ) {
    push({
      keySuffix: "retention_no_food",
      kind: "retention_risk",
      title: `${input.client.name} has logged no food for ${NO_FOOD_LOG_DAYS} days`,
      detail: { since: foodDays[0].date },
      suggestedMessage: "No food logged since the weekend. Is the tracking the problem or the food?",
      severity: 3,
    });
  }

  const checkinDays = lastDays(input.days, NO_CHECKIN_DAYS);
  if (
    checkinDays.length === NO_CHECKIN_DAYS &&
    checkinDays.every((day) => !day.checkinSubmitted)
  ) {
    push({
      keySuffix: "retention_no_checkin",
      kind: "retention_risk",
      title: `${input.client.name} has skipped ${NO_CHECKIN_DAYS} check-ins`,
      detail: { since: checkinDays[0].date },
      suggestedMessage: "Three check-ins missed. They take a minute, and I read every one.",
      severity: 3,
    });
  }

  return { skipped: null, localDate, fired };
}
