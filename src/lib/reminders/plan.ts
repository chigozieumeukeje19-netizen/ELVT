/**
 * Reminders.
 *
 * Nine kinds, each at a time the client chose, on the client's clock. The whole
 * design constraint is the one at the end of the item: never spam. Five
 * separate pings inside an hour is how an app gets muted, and a muted app
 * delivers nothing at all, so anything close together becomes one digest.
 *
 * Pure. The digest rule has enough edge cases (two due at once, one due while
 * another is still inside the window, a client who has already done the thing)
 * that it needs testing without a push service in the way.
 */

import { localMoment, type LocalMoment } from "@/lib/engine/clock";

export const REMINDER_KINDS = [
  "morning_plan",
  "workout",
  "run",
  "protein",
  "water",
  "steps",
  "evening_reflection",
  "weigh_in",
  "photos",
  "checkin_due",
] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** What each one says when it goes on its own. */
export const REMINDER_COPY: Record<ReminderKind, string> = {
  morning_plan: "Here is today.",
  workout: "Session today.",
  run: "Run today.",
  protein: "Protein check.",
  water: "Water.",
  steps: "Steps.",
  evening_reflection: "Two minutes on how today went.",
  weigh_in: "Weigh in before you eat.",
  photos: "Photos this morning.",
  checkin_due: "The weekly is waiting.",
};

export type ReminderSetting = {
  kind: ReminderKind;
  /** "07:00" in the client's own time. */
  time: string;
  enabled: boolean;
  /** 0 is Sunday. Empty means every day. */
  days: number[];
};

/**
 * The defaults a blueprint produces.
 *
 * The morning time is the one the client picked; everything else is placed
 * around it, because a client who asked for early morning reminders did not ask
 * for an early morning water reminder as well as an early morning plan.
 */
export function defaultSettings(input: {
  reminderTime: string;
  checkinDay: string;
  runs: boolean;
  tracksFood: boolean;
  trainingDays: number[];
}): ReminderSetting[] {
  const [hour] = input.reminderTime.split(":").map(Number);
  const at = (offset: number) =>
    `${String(Math.min(22, Math.max(5, hour + offset))).padStart(2, "0")}:00`;

  const checkinWeekday = input.checkinDay === "Monday" ? 1 : 0;

  const settings: ReminderSetting[] = [
    { kind: "morning_plan", time: input.reminderTime, enabled: true, days: [] },
    { kind: "workout", time: at(2), enabled: true, days: input.trainingDays },
    { kind: "run", time: at(1), enabled: input.runs, days: [] },
    { kind: "protein", time: at(7), enabled: input.tracksFood, days: [] },
    { kind: "water", time: at(5), enabled: true, days: [] },
    { kind: "steps", time: at(9), enabled: true, days: [] },
    { kind: "evening_reflection", time: at(12), enabled: true, days: [] },
    // Monday morning, before anything is eaten.
    { kind: "weigh_in", time: input.reminderTime, enabled: true, days: [1] },
    { kind: "photos", time: input.reminderTime, enabled: true, days: [1] },
    { kind: "checkin_due", time: at(10), enabled: true, days: [checkinWeekday] },
  ];

  return settings;
}

export type DueReminder = {
  kind: ReminderKind;
  time: string;
};

/**
 * How close together two reminders have to be before they become one.
 *
 * An hour, from the item: "one digest rather than five separate pings in an
 * hour". Anything inside this window goes out together.
 */
export const DIGEST_WINDOW_MINUTES = 60;

function minutesOf(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error(`"${time}" is not a time. Reminders are set as "HH:MM".`);
  }
  return hour * 60 + minute;
}

export type Dispatch = {
  /** The time this goes out, which is the earliest in the group. */
  time: string;
  kinds: ReminderKind[];
  body: string;
};

/**
 * What actually gets sent.
 *
 * Reminders inside an hour of each other are grouped, and a group of more than
 * one is written as a list rather than as a sentence, because a digest is read
 * at a glance and a paragraph is not.
 */
export function digest(due: DueReminder[]): Dispatch[] {
  if (due.length === 0) return [];

  // Validated up front rather than relying on the sort to do it. A one element
  // array never calls its comparator, so a single reminder with a malformed
  // time went through silently and was sent.
  for (const reminder of due) minutesOf(reminder.time);

  const sorted = [...due].sort((a, b) => minutesOf(a.time) - minutesOf(b.time));
  const groups: DueReminder[][] = [];

  for (const reminder of sorted) {
    const current = groups[groups.length - 1];
    if (
      current &&
      minutesOf(reminder.time) - minutesOf(current[0].time) <= DIGEST_WINDOW_MINUTES
    ) {
      current.push(reminder);
    } else {
      groups.push([reminder]);
    }
  }

  return groups.map((group) => ({
    time: group[0].time,
    kinds: group.map((reminder) => reminder.kind),
    body:
      group.length === 1
        ? REMINDER_COPY[group[0].kind]
        : group.map((reminder) => REMINDER_COPY[reminder.kind]).join("\n"),
  }));
}

export type DispatchInput = {
  instant: Date;
  timezone: string;
  settings: ReminderSetting[];
  /**
   * Kinds already done today, which are the ones not to send. A client who
   * logged their steps at ten does not need a steps reminder at two.
   */
  alreadyDone: ReminderKind[];
  /** Kinds already sent today, so the job is idempotent. */
  alreadySent: ReminderKind[];
};

/**
 * Everything due for one client right now, grouped.
 *
 * A reminder is due once its time has passed and it has not gone yet. That
 * means a job that was down for two hours catches up rather than skipping the
 * day, and the catch up is one digest rather than four pings at once, which is
 * exactly the case the digest rule exists for.
 */
export function planReminders(input: DispatchInput): {
  local: LocalMoment;
  dispatches: Dispatch[];
} {
  const local = localMoment(input.instant, input.timezone);
  const nowMinutes = local.hour * 60 + local.minute;

  const due = input.settings
    .filter((setting) => setting.enabled)
    .filter((setting) => setting.days.length === 0 || setting.days.includes(local.weekday))
    .filter((setting) => !input.alreadySent.includes(setting.kind))
    .filter((setting) => !input.alreadyDone.includes(setting.kind))
    .filter((setting) => minutesOf(setting.time) <= nowMinutes)
    .map((setting) => ({ kind: setting.kind, time: setting.time }));

  return { local, dispatches: digest(due) };
}
