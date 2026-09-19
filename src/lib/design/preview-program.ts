import { applyTemplate } from "@/lib/program/apply-template";
import type { LibraryExercise, ProgramTemplateBody } from "@/lib/program/types";
import { buildPeriodizationRows, buildProgramView } from "@/lib/program/view";

/**
 * A real applied program for the preview routes.
 *
 * This runs the actual template applier over a small library, so the program
 * tab is checked against something the engine produced rather than against
 * hand written cells that could drift from what the engine really outputs.
 *
 * Movement names and flag keys are library data, not client data.
 */

export const PREVIEW_LIBRARY: LibraryExercise[] = [
  {
    id: "back-squat", name: "Barbell Back Squat", aliases: [],
    pattern: "squat", equipment: ["barbell"], unilateral: false,
    contraindications: ["spine", "knee"], alternatives: [{ id: "goblet-squat", reason: "injury" }],
  },
  {
    id: "goblet-squat", name: "Goblet Squat", aliases: [],
    pattern: "squat", equipment: ["dumbbell"], unilateral: false,
    contraindications: [], alternatives: [],
  },
  {
    id: "romanian-deadlift", name: "Romanian Deadlift", aliases: [],
    pattern: "hinge", equipment: ["barbell"], unilateral: false,
    contraindications: ["spine"], alternatives: [],
  },
  {
    id: "db-bench", name: "Dumbbell Bench Press", aliases: [],
    pattern: "push_h", equipment: ["dumbbell"], unilateral: false,
    contraindications: ["shoulder"], alternatives: [],
  },
  {
    id: "chest-supported-row", name: "Chest Supported Row", aliases: [],
    pattern: "pull_h", equipment: ["dumbbell"], unilateral: false,
    contraindications: [], alternatives: [],
  },
];

const sets = [1, 2, 3].map((set) => ({ set, reps: 8, rir: 2 }));

export const PREVIEW_TEMPLATE: ProgramTemplateBody = {
  split: { liftsPerWeek: 2, runsPerWeek: 3 },
  phases: [
    { name: "Base", startWeek: 1, endWeek: 4, tone: "panel" },
    { name: "Build", startWeek: 5, endWeek: 8, tone: "panel-2" },
  ],
  deload: { everyNWeeks: 4, holdCalories: true },
  caloriePathShape: "mileage_linked",
  sessions: [
    {
      key: "lower", kind: "strength", name: "Lower body", stimulus: "lower_strength",
      workout: {
        stimulus: "lower_strength",
        sections: [
          {
            type: "regular",
            exercises: [
              { slot: { pattern: "squat", preferred: "Barbell Back Squat" }, sets, trackingFields: ["reps", "weight"] },
              { slot: { pattern: "hinge", preferred: "Romanian Deadlift" }, sets, trackingFields: ["reps", "weight"] },
            ],
          },
        ],
      },
    },
    {
      key: "upper", kind: "strength", name: "Upper body", stimulus: "upper_strength",
      workout: {
        stimulus: "upper_strength",
        sections: [
          {
            type: "regular",
            exercises: [
              { slot: { pattern: "push_h", preferred: "Dumbbell Bench Press" }, sets, trackingFields: ["reps", "weight"] },
              { slot: { pattern: "pull_h", preferred: "Chest Supported Row" }, sets, trackingFields: ["reps", "weight"] },
            ],
          },
        ],
      },
    },
    {
      key: "long-run", kind: "run", name: "Long run", stimulus: "long_run",
      pinToLongRunDay: true,
      run: { runType: "long", stimulus: "long_run", distanceTarget: 14 },
    },
    {
      key: "tempo-run", kind: "run", name: "Tempo run", stimulus: "hard_run",
      run: { runType: "tempo", stimulus: "hard_run", distanceTarget: 8 },
    },
    {
      key: "easy-run", kind: "run", name: "Easy run", stimulus: "easy_run",
      run: { runType: "easy", stimulus: "easy_run", distanceTarget: 5 },
    },
  ],
};

const applied = applyTemplate({
  template: PREVIEW_TEMPLATE,
  placement: {
    preferredTrainingDays: [1, 2, 4, 5, 6],
    preferredLongRunDay: 6,
    restDays: [0],
    flags: { achilles: true },
    combatSport: false,
    runningEnabled: true,
  },
  library: PREVIEW_LIBRARY,
  startDate: "2026-09-21",
  weeks: 8,
});

export const PREVIEW_PROGRAM = buildProgramView(applied, PREVIEW_TEMPLATE.phases);
export const PREVIEW_PROGRAM_ROWS = buildPeriodizationRows(applied);

/**
 * The week the stress rail has something to say about, so the flagged state is
 * checked rather than only the clean one.
 */
export const PREVIEW_FLAGGED_WEEK =
  PREVIEW_PROGRAM.weeks.find((w) => w.flags.length > 0)?.weekNumber ??
  PREVIEW_PROGRAM.weeks.length;
