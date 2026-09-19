/**
 * Quick replies.
 *
 * A message template with named holes in it, filled from the client's own
 * numbers. The point is not saving typing: it is that a reply sent in ten
 * seconds carries the real figure rather than "your steps were low", which is
 * the difference between a message that changes something and one that reads as
 * automated.
 *
 * Every template here obeys the voice rules, and a test checks them rather than
 * trusting that whoever wrote them remembered.
 */

export type QuickReply = {
  key: string;
  name: string;
  body: string;
  /** Names of the holes, so a caller can be told which are missing. */
  variables: string[];
};

export const QUICK_REPLIES: QuickReply[] = [
  {
    key: "steps_two_days",
    name: "Steps down two days",
    body: "Steps were {steps_a} then {steps_b} against your usual {step_goal}.\nTwo days is worth changing rather than waiting on.\nWhat does a 20 minute walk look like tomorrow?",
    variables: ["steps_a", "steps_b", "step_goal"],
  },
  {
    key: "session_missed",
    name: "Session missed",
    body: "You have {done} of {planned} sessions this week.\nThe one you missed was {session}, and it is the one the block is built on.\nCan it go in on {day}?",
    variables: ["done", "planned", "session", "day"],
  },
  {
    key: "weight_stalled",
    name: "Weight standing still",
    body: "The 7 day average is {average}, which is {change} on last week.\nTwo weeks flat means the number is wrong rather than you are, so calories go to {new_calories}.\nAnything about the week that would explain it?",
    variables: ["average", "change", "new_calories"],
  },
  {
    key: "good_week",
    name: "Good week",
    body: "{score} this week, and {training_done} of {training_planned} sessions.\nNothing changes for week {next_week}.\nSame again?",
    variables: ["score", "training_done", "training_planned", "next_week"],
  },
  {
    key: "flag_reported",
    name: "Flag reported",
    body: "You put {area} at {level} today, which is above the {threshold} we agreed.\nSkip tomorrow's {movement} and do the mobility instead.\nWhat were you doing when it went?",
    variables: ["area", "level", "threshold", "movement"],
  },
  {
    key: "gone_quiet",
    name: "Gone quiet",
    body: "Nothing logged since {last_date}, which is {days} days.\nNo lecture, I just want to know whether it is the app or the week.\nWhich is it?",
    variables: ["last_date", "days"],
  },
  {
    key: "checkin_due",
    name: "Check-in due",
    body: "The weekly is sitting there and it takes about {minutes} minutes.\nFasted weight first, then the rest.\nCan you do it before you start tomorrow?",
    variables: ["minutes"],
  },
  {
    key: "race_week",
    name: "Race week",
    body: "{days} days out. Mileage drops to {mileage} and the last hard session is {last_session}.\nEverything from here is about arriving fresh.\nHave you settled what you are eating on the morning?",
    variables: ["days", "mileage", "last_session"],
  },
];

export type FillResult =
  | { ok: true; body: string }
  | { ok: false; missing: string[] };

/**
 * Fills a template.
 *
 * A missing value is named rather than left as a hole or blanked out. A message
 * that goes out reading "Steps were  then  against your usual" is worse than no
 * message, and one where the number silently became 0 is worse still.
 */
export function fill(template: QuickReply, values: Record<string, string | number>): FillResult {
  const missing = template.variables.filter(
    (name) => values[name] === undefined || values[name] === null || values[name] === "",
  );
  if (missing.length > 0) return { ok: false, missing };

  const body = template.body.replace(/\{([a-z_]+)\}/g, (_whole, name: string) =>
    String(values[name]),
  );

  return { ok: true, body };
}

/** The holes a template actually contains, for checking against its declared list. */
export function holesIn(body: string): string[] {
  return [...new Set([...body.matchAll(/\{([a-z_]+)\}/g)].map((match) => match[1]))];
}
