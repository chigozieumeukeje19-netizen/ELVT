/**
 * Blueprint plus template to a materialized program, with every decision put
 * into words a coach can argue with.
 *
 * The applier already records why it did each thing. What was missing was the
 * translation: "substitution, squat, Barbell Back Squat, Goblet Squat, injury"
 * is a log line, not an explanation. A coach approving a program for a client
 * with a spinal fusion needs to read that the back squat was removed because
 * this client's spine flag rules it out, and what took its place.
 *
 * The per week rationale is the only part of this that goes through the AI
 * prompt and paste flow, because it is the only part that is judgement. Every
 * substitution is explained here, in code, from the decision the applier
 * actually made.
 */

import { applyTemplate, type Decision, type MaterializedProgram } from "@/lib/program/apply-template";
import type { BlueprintPlacement, LibraryExercise, ProgramTemplateBody } from "@/lib/program/types";
import { humanizeFlag } from "./flags";
import type { DerivedBlueprint } from "./types";

/** The Blueprint's days in the 0 is Sunday shape the applier reads. */
const DAY_NUMBER: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

export function placementFor(derived: DerivedBlueprint): BlueprintPlacement {
  const preferred = derived.preferredDays
    .map((day) => DAY_NUMBER[day])
    .filter((day): day is number => day !== undefined);

  // Whatever is left over after the days they said they can train. Stated
  // rather than assumed, so a client who named four days gets three rest days
  // and not a schedule that quietly uses them.
  const rest = [0, 1, 2, 3, 4, 5, 6].filter((day) => !preferred.includes(day));

  return {
    preferredTrainingDays: preferred,
    // The longest day of the week goes on the first weekend day they have
    // free, which is the only day most people can spend two hours running.
    preferredLongRunDay: derived.runs ? (rest.includes(6) ? 6 : (rest[0] ?? null)) : null,
    restDays: rest,
    flags: Object.fromEntries(derived.flags.map((flag) => [flag, true])),
    combatSport: false,
    runningEnabled: derived.runs,
  };
}

export type ExplainedDecision = {
  kind: Decision["kind"];
  /** One sentence a coach reads. No enum values, no slot keys. */
  explanation: string;
};

export function explainDecision(decision: Decision, derived: DerivedBlueprint): ExplainedDecision {
  switch (decision.kind) {
    case "substitution":
      return {
        kind: decision.kind,
        explanation:
          decision.cause === "injury"
            ? `${decision.from} is out because of the ${humanizeFlag(decision.slot, derived)} flag, so the slot is ${decision.to}.`
            : `${decision.from} is not available with this client's equipment, so the slot is ${decision.to}.`,
      };

    case "slot_dropped":
      return {
        kind: decision.kind,
        explanation: `Nothing in the library fits that slot for this client, so it is empty. ${decision.reason}`,
      };

    case "session_dropped":
      return {
        kind: decision.kind,
        explanation: `${decision.session} did not fit the week without breaking a spacing rule, so it is not in the block. ${decision.reason}`,
      };

    case "lift_cap":
      return {
        kind: decision.kind,
        explanation: `Lifting is capped at ${decision.to} sessions a week rather than ${decision.from}, because the other hard days are already spoken for.`,
      };

    case "day_relaxed":
      return {
        kind: decision.kind,
        explanation: `The week does not sit entirely on the days they asked for. ${decision.reason}`,
      };
  }
}

export type ProgramDraft = {
  program: MaterializedProgram;
  explained: ExplainedDecision[];
  /** Filled by the paste. One line per week, or empty until then. */
  rationale: { week: number; rationale: string }[];
};

export function draftProgram(input: {
  derived: DerivedBlueprint;
  template: ProgramTemplateBody;
  library: LibraryExercise[];
  startDate: string;
  rationale?: { week: number; rationale: string }[];
}): ProgramDraft {
  const program = applyTemplate({
    template: input.template,
    placement: placementFor(input.derived),
    library: input.library,
    startDate: input.startDate,
    weeks: input.derived.durationWeeks,
  });

  return {
    program,
    explained: program.decisions.map((decision) => explainDecision(decision, input.derived)),
    rationale: input.rationale ?? [],
  };
}
