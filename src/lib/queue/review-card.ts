/**
 * The Monday review card.
 *
 * One client, everything needed to decide, in an order built around the two
 * minute target: the numbers that say what kind of week it was, then what they
 * said about it, then what to change, then the message that goes out. A coach
 * reading eight of these in fifteen minutes cannot be scrolling back up.
 *
 * Assembled here as a pure function so the card's contents are testable without
 * a database and, more to the point, so what is on it is a decision recorded in
 * code rather than whatever a query happened to return.
 */

import { bandFor, type Band } from "@/lib/design/bands";
import { adherencePercent, type WeekAdherence } from "@/lib/engine/scoring";

export const CHANGE_SOURCES = ["coach", "ai_accepted", "ai_edited", "ai_draft", "system"] as const;
export type ChangeSource = (typeof CHANGE_SOURCES)[number];

export const CHANGE_DECISIONS = ["pending", "accept", "edit", "reject"] as const;
export type ChangeDecision = (typeof CHANGE_DECISIONS)[number];

export type ProposedChange = {
  id: string;
  field: string;
  label: string;
  from: string;
  to: string;
  reason: string;
  decision: ChangeDecision;
  /** Set when the coach edited the value rather than accepting it. */
  editedTo?: string;
};

export type WeightLine = {
  average: number | null;
  vsLastWeek: number | null;
  /** Against where the calorie path expected them to be by now. */
  vsPlan: number | null;
};

export type AdherenceLine = {
  key: string;
  label: string;
  done: number;
  planned: number;
  percent: number | null;
  band: Band | null;
};

export type CheckinAnswer = {
  key: string;
  question: string;
  answer: string;
  /** True on the question about whatever changed last Monday. */
  isSpine: boolean;
};

export type FiredFlag = {
  key: string;
  label: string;
  detail: string;
  date: string;
};

export type ReviewCard = {
  clientId: string;
  slug: string;
  name: string;
  weekNumber: number;
  weekCount: number;
  score: number;
  focus: string | null;
  weight: WeightLine;
  adherence: AdherenceLine[];
  spineVariable: string | null;
  checkin: CheckinAnswer[];
  flags: FiredFlag[];
  changes: ProposedChange[];
  message: string;
  /** How urgent this card is, for the order they are read in. */
  severity: number;
};

/** The five categories the card shows, in the order it shows them. */
export const ADHERENCE_LINES: { key: string; label: string }[] = [
  { key: "training", label: "Training" },
  { key: "run", label: "Running" },
  { key: "calories", label: "Nutrition" },
  { key: "steps", label: "Movement" },
  { key: "recovery", label: "Recovery" },
];

export function adherenceLines(adherence: WeekAdherence): AdherenceLine[] {
  return ADHERENCE_LINES.map(({ key, label }) => {
    const fraction = adherence[key] ?? { done: 0, planned: 0 };
    const percent = adherencePercent(fraction);
    return {
      key,
      label,
      done: fraction.done,
      planned: fraction.planned,
      percent,
      // A category with nothing planned has no band. A client with no runs
      // programmed is not failing at running, and coloring it red would send
      // the coach after a problem that does not exist.
      band: fraction.planned > 0 ? bandFor(percent) : null,
    };
  });
}

/**
 * Puts the spine question at the top of the check-in.
 *
 * The rest keep their order. The spine question is the one that says whether
 * last Monday's change worked, so it is the first thing read and it is marked,
 * rather than being somewhere in a list of fifteen.
 */
export function pinSpine(answers: CheckinAnswer[]): CheckinAnswer[] {
  const spine = answers.filter((answer) => answer.isSpine);
  const rest = answers.filter((answer) => !answer.isSpine);
  return [...spine, ...rest];
}

/**
 * What the coach is actually applying when they hit Accept All.
 *
 * Rejected lines are dropped. Edited lines carry the coach's value and are
 * recorded as ai_edited rather than ai_accepted, because a change the coach
 * rewrote is not a change the machine got right, and the difference is the only
 * way to tell later whether the drafting is any good.
 */
export type AppliedChange = {
  field: string;
  from: string;
  to: string;
  reason: string;
  source: ChangeSource;
};

export function applyDecisions(changes: ProposedChange[]): AppliedChange[] {
  return changes
    .filter((change) => change.decision === "accept" || change.decision === "edit")
    .map((change) => ({
      field: change.field,
      from: change.from,
      to: change.decision === "edit" ? (change.editedTo ?? change.to) : change.to,
      reason: change.reason,
      source: change.decision === "edit" ? "ai_edited" : "ai_accepted",
    }));
}

/** Nothing decided yet is not the same as nothing to do. */
export function undecided(changes: ProposedChange[]): ProposedChange[] {
  return changes.filter((change) => change.decision === "pending");
}

/**
 * How far up the list a card sits.
 *
 * Built from the things that make a week worth opening first: a flag fired, a
 * weak score, or weight going the wrong way. The thresholds come from bandFor,
 * so a card at the top of the queue is the same client whose roster row is red.
 */
export const WEIGHT_WRONG_WAY = 0.5;

export function cardSeverity(input: {
  score: number;
  flags: number;
  weightChange: number | null;
  losingWeight: boolean;
}): number {
  if (input.flags > 0) return 5;

  const band = bandFor(input.score);
  if (band === "flag") return 4;

  const wrongWay =
    input.weightChange !== null &&
    (input.losingWeight
      ? input.weightChange > WEIGHT_WRONG_WAY
      : input.weightChange < -WEIGHT_WRONG_WAY);

  if (band === "watch" || wrongWay) return 3;
  return 2;
}
