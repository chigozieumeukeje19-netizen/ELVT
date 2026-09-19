/**
 * Scheduled sends.
 *
 * A message is scheduled for a time in the client's day, not the server's. The
 * portal already runs every job on client local time and a message is the most
 * visible of all of them: a 7am nudge that lands at 2am costs a client's trust
 * in a way a late week roll never does.
 *
 * Pure, so the boundary cases can be tested: a message scheduled for a time
 * that has already passed, one scheduled across a date line, and one scheduled
 * while the job was down.
 */

import { localMoment } from "@/lib/engine/clock";

export type ScheduledMessage = {
  id: string;
  clientId: string;
  timezone: string;
  /** The instant the coach asked for, stored in UTC. */
  scheduledFor: string;
  sentAt: string | null;
};

export type SendDecision = {
  id: string;
  send: boolean;
  reason: string;
};

/**
 * How late a message can be and still be worth sending.
 *
 * A dispatcher that was down overnight should not wake a client at 3am with
 * yesterday's 7am nudge. Past this, the message is left unsent and the coach is
 * told, because a stale nudge is worse than a missing one.
 */
export const STALE_AFTER_HOURS = 6;

export function decideSends(
  messages: ScheduledMessage[],
  instant: Date,
): SendDecision[] {
  return messages.map((message) => {
    if (message.sentAt) {
      return { id: message.id, send: false, reason: "Already sent." };
    }

    const due = new Date(message.scheduledFor);
    if (Number.isNaN(due.getTime())) {
      return { id: message.id, send: false, reason: "That is not a time." };
    }

    const lateByHours = (instant.getTime() - due.getTime()) / 3_600_000;

    if (lateByHours < 0) {
      return { id: message.id, send: false, reason: "Not due yet." };
    }

    if (lateByHours > STALE_AFTER_HOURS) {
      const local = localMoment(instant, message.timezone);
      return {
        id: message.id,
        send: false,
        reason: `Over ${STALE_AFTER_HOURS} hours late, so it is ${local.hour}:00 where they are. Left unsent.`,
      };
    }

    return { id: message.id, send: true, reason: "Due." };
  });
}

/**
 * The instant a local time on a local date corresponds to.
 *
 * Scheduling is done in the client's words ("Tuesday at 7") and stored as an
 * instant, so this is where the conversion happens. It searches rather than
 * computing an offset, because an offset is wrong twice a year and the search
 * is over 24 candidates.
 */
export function instantFor(date: string, time: string, timezone: string): Date {
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error(`"${time}" is not a time. Use "HH:MM".`);
  }

  const [year, month, day] = date.split("-").map(Number);

  // Every quarter hour offset that could be this local date, checked against
  // what the client's clock would actually read.
  //
  // Quarter hours, not whole hours: India is UTC+5:30 and Nepal is UTC+5:45,
  // and a whole hour search simply never matches them. That is not an edge
  // case for this roster, it is a client with a deployment.
  for (let quarters = -14 * 4; quarters <= 14 * 4; quarters += 1) {
    const candidate = new Date(
      Date.UTC(year, month - 1, day, hour, minute - quarters * 15),
    );
    const local = localMoment(candidate, timezone);
    if (local.date === date && local.hour === hour && local.minute === minute) {
      return candidate;
    }
  }

  throw new Error(
    `${time} on ${date} does not exist in ${timezone}. Clocks going forward skip an hour.`,
  );
}
