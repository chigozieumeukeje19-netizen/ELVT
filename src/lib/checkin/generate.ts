/**
 * Building a client's forms.
 *
 * The daily is six to seven questions and has to be answerable in under a
 * minute. The first four are identical for everyone, which is what makes two
 * clients' weeks comparable, and the rest come from the bank.
 *
 * The weekly is about fifteen, and it is built around the spine: whichever
 * variable the coach changed last Monday, the generator pulls the questions
 * whose `produces` matches it. That is what turns a check-in from a form into
 * the input to a decision. A week where nothing changed has no spine, and the
 * form says so rather than inventing one.
 */

import type { FlagKey } from "@/lib/program/types";
import type { GoalType } from "@/lib/blueprint/types";
import {
  BANK,
  DAILY_CORE,
  FIT_SECTION,
  WEEKLY_CLOSERS,
  WEEKLY_CORE,
  type BankQuestion,
  type Produces,
} from "./bank";

export type ClientProfile = {
  goal: GoalType;
  flags: FlagKey[];
  running: boolean;
};

export const DAILY_MIN = 6;
export const DAILY_MAX = 7;
export const WEEKLY_TARGET = 15;

/** Whether a bank question applies to this client at all. */
export function applies(
  question: BankQuestion,
  client: ClientProfile,
  options: { firstWeek?: boolean } = {},
): boolean {
  const when = question.appliesWhen;

  if (when.firstWeek && !options.firstWeek) return false;
  if (when.running === true && !client.running) return false;
  if (when.goals && when.goals.length > 0 && !when.goals.includes(client.goal)) return false;

  // A flagged question needs one of its flags. A question about a knee is never
  // asked of someone whose knee is fine, and an injury question that reached the
  // wrong client would train them to answer "none" without reading.
  if (when.flags && when.flags.length > 0) {
    if (!when.flags.some((flag) => client.flags.includes(flag))) return false;
  }

  return true;
}

/**
 * The daily form.
 *
 * The four shared questions, then two or three from the bank. Injury questions
 * come first among those, because a flagged area going wrong is the one thing
 * that has to be handled the same day rather than on Monday.
 */
export function buildDailyForm(client: ClientProfile): BankQuestion[] {
  const eligible = BANK.filter(
    (question) =>
      applies(question, client) &&
      // The daily is a minute long. Free text and photos belong on the weekly.
      question.type !== "text" &&
      question.type !== "progress_photos",
  );

  const injury = eligible.filter((question) => question.category === "injury");
  const rest = eligible
    .filter((question) => question.category !== "injury")
    .sort((a, b) => a.key.localeCompare(b.key));

  const extras = [...injury, ...rest].slice(0, DAILY_MAX - DAILY_CORE.length);
  return [...DAILY_CORE, ...extras];
}

export type WeeklyForm = {
  questions: BankQuestion[];
  /** The variable that changed last Monday, or null when nothing did. */
  spineVariable: Produces | null;
  /** Which questions are on the form because of the spine. */
  spineKeys: string[];
  isFirstWeek: boolean;
};

/**
 * The weekly form.
 *
 * Order matters and is fixed: fasted weight first, then the rest of the shared
 * block, then the spine questions, then whatever the client's goal and flags
 * pull in, then the two closers. A coach comparing week 4 against week 9 is
 * reading the same rows in the same order.
 */
export function buildWeeklyForm(
  client: ClientProfile,
  options: { spineVariable?: Produces | null; isFirstWeek?: boolean } = {},
): WeeklyForm {
  const isFirstWeek = options.isFirstWeek ?? false;
  const spineVariable = options.spineVariable ?? null;

  const chosen: BankQuestion[] = [...WEEKLY_CORE];
  const seen = new Set(chosen.map((question) => question.key));

  const add = (question: BankQuestion) => {
    if (seen.has(question.key)) return false;
    seen.add(question.key);
    chosen.push(question);
    return true;
  };

  const eligible = BANK.filter((question) => applies(question, client));

  // The spine first, so a question that asks whether last Monday's change
  // worked is never the one dropped for length.
  const spineKeys: string[] = [];
  if (spineVariable) {
    for (const question of eligible) {
      if (!question.produces.includes(spineVariable)) continue;
      if (add(question)) spineKeys.push(question.key);
    }
  }

  if (isFirstWeek) {
    for (const question of FIT_SECTION) add(question);
  }

  // Injury next. A flagged area going wrong outranks everything else here too.
  for (const question of eligible.filter((q) => q.category === "injury")) add(question);

  // Then the rest, deterministically, until the form is about the right length.
  const room = () => chosen.length + WEEKLY_CLOSERS.length < WEEKLY_TARGET;
  for (const question of [...eligible].sort((a, b) => a.key.localeCompare(b.key))) {
    if (!room()) break;
    add(question);
  }

  for (const question of WEEKLY_CLOSERS) add(question);

  return { questions: chosen, spineVariable, spineKeys, isFirstWeek };
}

/**
 * The variable to build next week's form around.
 *
 * Reads the most recent applied change. A week where the coach changed nothing
 * has no spine, and that is a real answer: the form falls back to the client's
 * goal and flags rather than pretending something moved.
 */
export function spineFrom(
  changes: { field: string; weekNumber: number | null; createdAt: string }[],
  forWeek: number,
): Produces | null {
  const lastWeek = changes
    .filter((change) => change.weekNumber === forWeek - 1)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const field = lastWeek[0]?.field;
  return (field as Produces) ?? null;
}
