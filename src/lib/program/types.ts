/**
 * The shapes stored in the template jsonb bodies, and the vocabulary the
 * template applier reasons over.
 *
 * A template is a recipe, not a program. It names movements by pattern rather
 * than by row, so the applier can pick something flag-safe for each client
 * instead of the coach having to remember who cannot squat.
 */

export const PATTERNS = [
  "squat", "hinge", "push_h", "push_v", "pull_h", "pull_v",
  "carry", "core", "lunge", "rotation",
] as const;
export type Pattern = (typeof PATTERNS)[number];

export const FLAG_KEYS = [
  "elbow", "knee", "spine", "shoulder", "rib", "achilles",
  "hip", "wrist", "ankle", "neck",
] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];

export const SECTION_TYPES = [
  "regular", "superset", "circuit", "amrap", "interval",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

/**
 * What a day asks of the body. The applier uses this to keep two hard days of
 * the same kind off consecutive dates, which is the rule that actually protects
 * a hybrid athlete.
 */
export const STIMULI = [
  "lower_strength", "upper_strength", "full_strength",
  "hard_run", "easy_run", "long_run",
  "conditioning", "skill", "mobility",
] as const;
export type Stimulus = (typeof STIMULI)[number];

/** Whether a session is a hard day for the purpose of the spacing rule. */
export const HARD_STIMULI: readonly Stimulus[] = [
  "lower_strength", "upper_strength", "full_strength",
  "hard_run", "long_run", "conditioning",
];

/** Two stimuli that load the same tissue. Used by the back to back rule. */
export const SAME_STIMULUS_GROUPS: readonly (readonly Stimulus[])[] = [
  ["lower_strength", "full_strength"],
  ["upper_strength", "full_strength"],
  ["hard_run", "long_run"],
];

export type SetTarget = {
  set: number;
  reps?: number;
  weight?: number;
  pct_1rm?: number;
  time?: number;
  distance?: number;
  rest?: number;
  rpe?: number;
  rir?: number;
  tempo?: string;
};

/**
 * How a template refers to a movement. `pattern` is what the slot is for;
 * `preferred` is the coach's first choice by name, used when the client has no
 * flag that rules it out.
 */
export type ExerciseSlot = {
  pattern: Pattern;
  preferred?: string;
  equipment?: string[];
  unilateral?: boolean;
};

export type ProgressionRule =
  | { kind: "linear_load"; increment: number; unit: "lb" | "kg"; rirTarget: number }
  | { kind: "double_progression"; repLow: number; repHigh: number; increment: number }
  | { kind: "percentage"; percents: number[] }
  | { kind: "rpe_autoreg"; rpe: number }
  | { kind: "wave"; cycle: number[] }
  | { kind: "run_ramp"; maxWeeklyIncreasePct: number; downWeekEvery: number };

export type TemplateExercise = {
  slot: ExerciseSlot;
  sets: SetTarget[];
  trackingFields: string[];
  notes?: string;
  rirGuidance?: string;
  progression?: ProgressionRule;
};

export type SectionTemplateBody = {
  type: SectionType;
  name?: string;
  rounds?: number;
  durationSec?: number;
  exercises: TemplateExercise[];
};

export type WorkoutTemplateBody = {
  stimulus: Stimulus;
  sections: SectionTemplateBody[];
};

export const RUN_TYPES = [
  "easy", "recovery", "zone2", "long", "tempo", "threshold", "intervals",
  "progression", "hills", "strides", "race_pace", "race", "brick",
  "walk_run", "custom",
] as const;
export type RunType = (typeof RUN_TYPES)[number];

export type RunTemplateBody = {
  runType: RunType;
  stimulus: Stimulus;
  distanceTarget?: number;
  durationTarget?: number;
  paceMin?: string;
  paceMax?: string;
  hrMin?: number;
  hrMax?: number;
  rpeTarget?: number;
  warmup?: string;
  cooldown?: string;
  fueling?: Record<string, unknown>;
  progression?: ProgressionRule;
};

export const CALORIE_SHAPES = [
  "linear", "front_loaded", "mileage_linked", "muscle_gain",
] as const;
export type CalorieShape = (typeof CALORIE_SHAPES)[number];

export type PhaseBand = {
  name: string;
  startWeek: number;
  endWeek: number;
  /**
   * Phase bands are drawn with the neutral surface steps, not with color.
   * DESIGN.md Part 2 gives color to signals only, so this is an index into the
   * panel steps rather than a hex.
   */
  tone: "panel" | "panel-2" | "line";
};

/** One session the split asks for, before it is placed on a date. */
export type SessionSkeleton = {
  key: string;
  kind: "strength" | "run" | "mobility" | "conditioning" | "skill";
  name: string;
  stimulus: Stimulus;
  workout?: WorkoutTemplateBody;
  run?: RunTemplateBody;
  /** A long run is pinned to the client's chosen day rather than placed. */
  pinToLongRunDay?: boolean;
};

export type ProgramTemplateBody = {
  split: {
    liftsPerWeek: number;
    runsPerWeek: number;
    mobilityPerWeek?: number;
  };
  phases: PhaseBand[];
  deload: {
    /** A deload every N weeks. 0 means none. */
    everyNWeeks: number;
    /** Deload weeks hold calories flat. Part 6.3. */
    holdCalories: boolean;
  };
  caloriePathShape: CalorieShape;
  sessions: SessionSkeleton[];
  defaultHabitKeys?: string[];
  defaultQuestionKeys?: string[];
  defaultTriggerKeys?: string[];
};

/**
 * The slice of an approved Blueprint the applier reads. Everything here changes
 * where a session lands or whether an exercise is allowed, which is why the
 * applier takes this rather than the whole document.
 */
export type BlueprintPlacement = {
  /** 0 is Sunday, matching program_days.day_of_week. */
  preferredTrainingDays: number[];
  preferredLongRunDay: number | null;
  restDays: number[];
  flags: Partial<Record<FlagKey, boolean>>;
  /** A combat sport is already the fourth and fifth hard session of the week. */
  combatSport: boolean;
  runningEnabled: boolean;
};

/** An exercise as the applier needs it: enough to choose, nothing more. */
export type LibraryExercise = {
  id: string;
  name: string;
  aliases: string[];
  pattern: Pattern | null;
  equipment: string[];
  unilateral: boolean;
  /** Flag keys that rule this movement out for a client carrying them. */
  contraindications: FlagKey[];
};

export const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

/** Short form for a dense day grid header. */
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
