import type {
  BlueprintPlacement,
  LibraryExercise,
  ProgramTemplateBody,
  SessionSkeleton,
} from "@/lib/program/types";

/**
 * Test input for the template applier.
 *
 * This is a library and a template, not client data and not a seed. It exists
 * so the applier can be held to its rules with a barbell back squat present in
 * the library, which is the only way to prove the spine client never receives
 * one.
 */

export const LIBRARY: LibraryExercise[] = [
  {
    id: "back-squat",
    name: "Barbell Back Squat",
    aliases: ["BB Back Squat", "Back Squat"],
    pattern: "squat",
    equipment: ["barbell", "rack"],
    unilateral: false,
    contraindications: ["spine", "knee"],
    alternatives: [
      { id: "goblet-squat", reason: "injury" },
      { id: "leg-press", reason: "equipment" },
    ],
  },
  {
    id: "goblet-squat",
    name: "Goblet Squat",
    aliases: [],
    pattern: "squat",
    equipment: ["dumbbell"],
    unilateral: false,
    contraindications: [],
    alternatives: [],
  },
  {
    id: "leg-press",
    name: "Leg Press",
    aliases: [],
    pattern: "squat",
    equipment: ["machine"],
    unilateral: false,
    contraindications: ["knee"],
    alternatives: [],
  },
  {
    id: "romanian-deadlift",
    name: "Romanian Deadlift",
    aliases: ["RDL"],
    pattern: "hinge",
    equipment: ["barbell"],
    unilateral: false,
    contraindications: ["spine"],
    alternatives: [{ id: "hip-thrust", reason: "injury" }],
  },
  {
    id: "hip-thrust",
    name: "Hip Thrust",
    aliases: [],
    pattern: "hinge",
    equipment: ["barbell", "bench"],
    unilateral: false,
    contraindications: [],
    alternatives: [],
  },
  {
    id: "db-bench",
    name: "Dumbbell Bench Press",
    aliases: ["DB Bench Press"],
    pattern: "push_h",
    equipment: ["dumbbell", "bench"],
    unilateral: false,
    contraindications: ["shoulder"],
    alternatives: [{ id: "floor-press", reason: "injury" }],
  },
  {
    id: "floor-press",
    name: "Floor Press",
    aliases: [],
    pattern: "push_h",
    equipment: ["dumbbell"],
    unilateral: false,
    contraindications: [],
    alternatives: [],
  },
  {
    id: "chest-supported-row",
    name: "Chest Supported Row",
    aliases: ["CSR"],
    pattern: "pull_h",
    equipment: ["dumbbell", "bench"],
    unilateral: false,
    contraindications: [],
    alternatives: [],
  },
  {
    id: "walking-lunge",
    name: "Walking Lunge",
    aliases: [],
    pattern: "lunge",
    equipment: ["body only"],
    unilateral: true,
    contraindications: ["knee"],
    alternatives: [],
  },
];

const THREE_BY_EIGHT = [
  { set: 1, reps: 8 },
  { set: 2, reps: 8 },
  { set: 3, reps: 8 },
];

function lift(key: string, name: string, stimulus: SessionSkeleton["stimulus"], slots: {
  pattern: "squat" | "hinge" | "push_h" | "pull_h" | "lunge";
  preferred: string;
}[]): SessionSkeleton {
  return {
    key,
    kind: "strength",
    name,
    stimulus,
    workout: {
      stimulus,
      sections: [
        {
          type: "regular",
          exercises: slots.map((slot) => ({
            slot,
            sets: THREE_BY_EIGHT,
            trackingFields: ["reps", "weight", "rest"],
          })),
        },
      ],
    },
  };
}

/** Four lifts and three runs, so the combat sport cap has something to cut. */
export const TEMPLATE: ProgramTemplateBody = {
  split: { liftsPerWeek: 4, runsPerWeek: 3 },
  phases: [{ name: "Build", startWeek: 1, endWeek: 12, tone: "panel-2" }],
  deload: { everyNWeeks: 4, holdCalories: true },
  caloriePathShape: "linear",
  sessions: [
    lift("lower-a", "Lower A", "lower_strength", [
      { pattern: "squat", preferred: "Barbell Back Squat" },
      { pattern: "lunge", preferred: "Walking Lunge" },
    ]),
    lift("upper-a", "Upper A", "upper_strength", [
      { pattern: "push_h", preferred: "Dumbbell Bench Press" },
      { pattern: "pull_h", preferred: "Chest Supported Row" },
    ]),
    lift("lower-b", "Lower B", "lower_strength", [
      { pattern: "hinge", preferred: "Romanian Deadlift" },
    ]),
    lift("upper-b", "Upper B", "upper_strength", [
      { pattern: "push_h", preferred: "Dumbbell Bench Press" },
    ]),
    {
      key: "long-run",
      kind: "run",
      name: "Long run",
      stimulus: "long_run",
      pinToLongRunDay: true,
      run: { runType: "long", stimulus: "long_run", distanceTarget: 10 },
    },
    {
      key: "easy-run",
      kind: "run",
      name: "Easy run",
      stimulus: "easy_run",
      run: { runType: "easy", stimulus: "easy_run", distanceTarget: 5 },
    },
    {
      key: "tempo-run",
      kind: "run",
      name: "Tempo run",
      stimulus: "hard_run",
      run: { runType: "tempo", stimulus: "hard_run", distanceTarget: 8 },
    },
  ],
};

/**
 * Placements for the synthetic clients, matching supabase/seed.sql. Only the
 * fields that change where a session lands or whether a movement is allowed.
 */
export const PLACEMENTS: Record<string, BlueprintPlacement> = {
  // Recomp with a spine flag. Nothing loaded through the spine ever reaches
  // this program. This is the client the permanent assertion is about.
  "nadia-brookes": {
    preferredTrainingDays: [1, 2, 4, 5],
    preferredLongRunDay: null,
    restDays: [0, 3],
    flags: { spine: true },
    combatSport: false,
    runningEnabled: false,
  },
  // Marathoner with a calf flag. The long run is pinned to Saturday.
  "theo-vance": {
    preferredTrainingDays: [1, 2, 4, 6],
    preferredLongRunDay: 6,
    restDays: [0],
    flags: { achilles: true },
    combatSport: false,
    runningEnabled: true,
  },
  // Combat sport plus lifting. The cap is the point of this one.
  "marcus-oyelaran": {
    preferredTrainingDays: [1, 2, 4, 5, 6],
    preferredLongRunDay: null,
    restDays: [0, 3],
    flags: { shoulder: true },
    combatSport: true,
    runningEnabled: true,
  },
  // Knee flag, no running. Walking lunges and leg press are both out.
  "priya-raghavan": {
    preferredTrainingDays: [1, 3, 5],
    preferredLongRunDay: null,
    restDays: [0, 6],
    flags: { knee: true },
    combatSport: false,
    runningEnabled: false,
  },
  // Three flags at once, the widest filter in the roster.
  "caleb-whitlock": {
    preferredTrainingDays: [1, 2, 4, 5],
    preferredLongRunDay: null,
    restDays: [0, 3, 6],
    flags: { knee: true, shoulder: true, spine: true },
    combatSport: false,
    runningEnabled: false,
  },
};

export const START_DATE = "2026-09-21"; // A Monday.
