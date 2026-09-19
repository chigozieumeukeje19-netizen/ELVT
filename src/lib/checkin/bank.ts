/**
 * The question bank.
 *
 * Three fields decide whether a question reaches a client:
 *
 *   category    which part of the week it is about
 *   appliesWhen goal types and flags. A question about a knee is never asked
 *               of someone whose knee is fine.
 *   produces    which client variable the answer can change
 *
 * `produces` is the one that matters most. It is what makes the weekly
 * generator work: whichever variable the coach changed last Monday, the form
 * pulls the questions whose produces matches it, so next Sunday asks whether
 * the change worked. A question that produces nothing can never be pulled by
 * the spine, so it would be asked forever and answer nothing. The bank refuses
 * to hold one.
 */

import type { FlagKey } from "@/lib/program/types";
import type { GoalType } from "@/lib/blueprint/types";
import { SCALE_DEFAULTS, type Question } from "@/lib/questionnaire/types";

export const CATEGORIES = [
  "shared", "steps", "injury", "nutrition", "sleep", "recovery",
  "running", "training", "life", "accountability", "fit",
] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * The client variables a check-in answer can move. These are what plan_changes
 * records in its `field`, so the spine can match one against the other.
 */
export const PRODUCES = [
  "calories", "protein", "carbs", "step_goal", "training_volume", "training_days",
  "session_order", "run_volume", "long_run_day", "run_intensity", "deload",
  "exercise_swap", "sleep_target", "recovery_work", "habit", "message_cadence",
  "nothing_yet",
] as const;
export type Produces = (typeof PRODUCES)[number];

export type BankQuestion = Question & {
  category: Category;
  appliesWhen: {
    /** Empty means every goal. */
    goals?: GoalType[];
    /** Any one of these flags is enough. */
    flags?: FlagKey[];
    /** Only for clients who run. */
    running?: boolean;
    /** Only in week 1. */
    firstWeek?: boolean;
  };
  produces: Produces[];
};

const scale = { type: "scale" as const, ...SCALE_DEFAULTS };

/**
 * The four daily questions every client gets, in this order, before anything
 * from the bank. Identical across the roster on purpose: they are what makes
 * two clients' weeks comparable.
 */
export const DAILY_CORE: BankQuestion[] = [
  {
    key: "session_done",
    type: "multiple_choice",
    text: "Session done?",
    options: ["Yes", "Modified", "No"],
    required: true,
    category: "shared",
    appliesWhen: {},
    produces: ["training_volume", "training_days"],
  },
  {
    key: "sleep_hours",
    type: "metric",
    metric: "sleep_hours",
    text: "Hours of sleep",
    unit: "hours",
    required: true,
    category: "shared",
    appliesWhen: {},
    produces: ["sleep_target", "recovery_work"],
  },
  {
    key: "energy",
    ...scale,
    text: "Energy today",
    minLabel: "Empty",
    maxLabel: "Full",
    required: true,
    category: "shared",
    appliesWhen: {},
    produces: ["training_volume", "calories", "recovery_work"],
  },
  {
    key: "steps",
    type: "metric",
    metric: "steps",
    text: "Steps",
    required: true,
    category: "shared",
    appliesWhen: {},
    produces: ["step_goal"],
  },
];

/**
 * The weekly questions every client gets, in this order.
 *
 * Fasted weight is always question 1. Not because it is the most important
 * number but because it is the one that has to be taken under the same
 * conditions every week, and asking it first is what keeps that habit.
 */
export const WEEKLY_CORE: BankQuestion[] = [
  {
    key: "fasted_weight",
    type: "metric",
    metric: "weight",
    text: "Fasted weight",
    help: "First thing, after the bathroom, before you eat or drink.",
    unit: "lb",
    required: true,
    category: "shared",
    appliesWhen: {},
    produces: ["calories"],
  },
  {
    key: "adherence",
    ...scale,
    text: "How closely did you follow the plan?",
    minLabel: "Not at all",
    maxLabel: "To the letter",
    required: true,
    category: "shared",
    appliesWhen: {},
    produces: ["training_volume", "calories", "message_cadence"],
  },
  {
    key: "biggest_win",
    type: "text",
    text: "Biggest win this week",
    required: true,
    category: "shared",
    appliesWhen: {},
    produces: ["habit", "message_cadence"],
  },
  {
    key: "biggest_struggle",
    type: "text",
    text: "Biggest struggle",
    required: true,
    category: "shared",
    appliesWhen: {},
    produces: ["habit", "training_volume", "calories"],
  },
  {
    key: "photos_done",
    type: "progress_photos",
    text: "Progress photos",
    help: "Same spot, same light, same time of day.",
    angles: ["front", "side", "back"],
    category: "shared",
    appliesWhen: {},
    produces: ["nothing_yet"],
  },
];

/**
 * The two questions every weekly form closes with, whatever else is on it.
 *
 * The second one is the whole ELVT model in a sentence. It is the question
 * whose answer becomes the client's One Thing, and it is asked every week
 * because the answer changes.
 */
export const WEEKLY_CLOSERS: BankQuestion[] = [
  {
    key: "accountability",
    ...scale,
    text: "How much accountability did you need this week?",
    minLabel: "None",
    maxLabel: "A lot",
    required: true,
    category: "accountability",
    appliesWhen: {},
    produces: ["message_cadence"],
  },
  {
    key: "the_one_thing",
    type: "text",
    text: "What is the one thing you know you should be doing and are not?",
    required: true,
    category: "accountability",
    appliesWhen: {},
    produces: ["habit"],
  },
];

/** Week 1 only. Whether the plan fits the life it landed in. */
export const FIT_SECTION: BankQuestion[] = [
  {
    key: "fit_structure",
    ...scale,
    text: "Does the structure fit your week?",
    minLabel: "Not at all",
    maxLabel: "Perfectly",
    required: true,
    category: "fit",
    appliesWhen: { firstWeek: true },
    produces: ["training_days", "session_order"],
  },
  {
    key: "fit_confusing",
    type: "text",
    text: "What confused you?",
    category: "fit",
    appliesWhen: { firstWeek: true },
    produces: ["session_order", "message_cadence"],
  },
  {
    key: "fit_unsustainable",
    type: "text",
    text: "What already feels unsustainable?",
    required: true,
    category: "fit",
    appliesWhen: { firstWeek: true },
    produces: ["training_volume", "calories", "habit"],
  },
  {
    key: "fit_app",
    ...scale,
    text: "How easy was the app to use?",
    minLabel: "Painful",
    maxLabel: "No trouble",
    category: "fit",
    appliesWhen: { firstWeek: true },
    produces: ["nothing_yet"],
  },
];

/** Everything else. Pulled by goal, by flag, and by the spine. */
export const BANK: BankQuestion[] = [
  {
    key: "hunger",
    ...scale,
    text: "How hungry were you this week?",
    minLabel: "Not at all",
    maxLabel: "Constantly",
    category: "nutrition",
    appliesWhen: { goals: ["fat_loss", "recomp"] },
    produces: ["calories", "protein"],
  },
  {
    key: "protein_days",
    type: "number",
    text: "Days you hit your protein",
    unit: "days",
    category: "nutrition",
    appliesWhen: { goals: ["fat_loss", "muscle_gain", "recomp"] },
    produces: ["protein", "calories"],
  },
  {
    key: "calorie_confidence",
    ...scale,
    text: "How accurate do you think your tracking was?",
    minLabel: "A guess",
    maxLabel: "Weighed everything",
    category: "nutrition",
    appliesWhen: {},
    produces: ["calories"],
  },
  {
    key: "eating_out",
    type: "number",
    text: "Meals you did not plan",
    unit: "meals",
    category: "nutrition",
    appliesWhen: {},
    produces: ["calories", "habit"],
  },
  {
    key: "steps_hard_days",
    type: "text",
    text: "Which days were hardest to move on?",
    category: "steps",
    appliesWhen: {},
    produces: ["step_goal", "habit"],
  },
  {
    key: "session_difficulty",
    ...scale,
    text: "How hard were the sessions?",
    minLabel: "Too easy",
    maxLabel: "Could not finish",
    category: "training",
    appliesWhen: {},
    produces: ["training_volume", "run_intensity"],
  },
  {
    key: "lifts_felt",
    type: "text",
    text: "Which lift felt worst, and why?",
    category: "training",
    appliesWhen: {},
    produces: ["exercise_swap", "training_volume"],
  },
  {
    key: "missed_sessions",
    type: "text",
    text: "What got in the way of the sessions you missed?",
    category: "training",
    appliesWhen: {},
    produces: ["training_days", "session_order", "habit"],
  },
  {
    key: "run_legs",
    ...scale,
    text: "How did the legs feel on the runs?",
    minLabel: "Heavy",
    maxLabel: "Fresh",
    category: "running",
    appliesWhen: { running: true },
    produces: ["run_volume", "run_intensity", "deload"],
  },
  {
    key: "long_run_day",
    type: "text",
    text: "Did the long run land on the right day?",
    category: "running",
    appliesWhen: { running: true },
    produces: ["long_run_day", "session_order"],
  },
  {
    key: "run_fueling",
    type: "text",
    text: "What did you take on the long run?",
    category: "running",
    appliesWhen: { running: true },
    produces: ["carbs", "run_volume"],
  },
  {
    key: "knee_pain",
    ...scale,
    text: "Any knee discomfort this week?",
    minLabel: "None",
    maxLabel: "Stopped me training",
    category: "injury",
    appliesWhen: { flags: ["knee"] },
    produces: ["exercise_swap", "training_volume", "run_volume"],
  },
  {
    key: "back_pain",
    ...scale,
    text: "Any back discomfort this week?",
    minLabel: "None",
    maxLabel: "Stopped me training",
    category: "injury",
    appliesWhen: { flags: ["spine"] },
    produces: ["exercise_swap", "training_volume"],
  },
  {
    key: "shoulder_pain",
    ...scale,
    text: "Any shoulder discomfort this week?",
    minLabel: "None",
    maxLabel: "Stopped me training",
    category: "injury",
    appliesWhen: { flags: ["shoulder"] },
    produces: ["exercise_swap", "training_volume"],
  },
  {
    key: "calf_pain",
    ...scale,
    text: "Any calf or achilles discomfort?",
    minLabel: "None",
    maxLabel: "Stopped me running",
    category: "injury",
    appliesWhen: { flags: ["achilles"] },
    produces: ["run_volume", "run_intensity", "exercise_swap"],
  },
  {
    key: "elbow_pain",
    ...scale,
    text: "Any elbow discomfort this week?",
    minLabel: "None",
    maxLabel: "Stopped me training",
    category: "injury",
    appliesWhen: { flags: ["elbow"] },
    produces: ["exercise_swap"],
  },
  {
    key: "sleep_quality",
    ...scale,
    text: "How well did you sleep?",
    minLabel: "Badly",
    maxLabel: "Straight through",
    category: "sleep",
    appliesWhen: {},
    produces: ["sleep_target", "recovery_work", "training_volume"],
  },
  {
    key: "bedtime_drift",
    type: "text",
    text: "What pushed your bedtime back?",
    category: "sleep",
    appliesWhen: {},
    produces: ["sleep_target", "habit"],
  },
  {
    key: "soreness",
    ...scale,
    text: "How sore were you day to day?",
    minLabel: "Not at all",
    maxLabel: "Every session hurt",
    category: "recovery",
    appliesWhen: {},
    produces: ["training_volume", "deload", "recovery_work"],
  },
  {
    key: "recovery_done",
    type: "yes_no",
    text: "Did you do the recovery work?",
    category: "recovery",
    appliesWhen: {},
    produces: ["recovery_work", "habit"],
  },
  {
    key: "stress",
    ...scale,
    text: "How stressful was the week?",
    minLabel: "Calm",
    maxLabel: "Flat out",
    category: "life",
    appliesWhen: {},
    produces: ["training_volume", "message_cadence", "deload"],
  },
  {
    key: "travel_next",
    type: "text",
    text: "Anything next week that will break the routine?",
    category: "life",
    appliesWhen: {},
    produces: ["training_days", "calories", "habit"],
  },
  {
    key: "alcohol_week",
    type: "number",
    text: "Drinks this week",
    unit: "drinks",
    category: "life",
    appliesWhen: { goals: ["fat_loss", "recomp"] },
    produces: ["calories", "sleep_target"],
  },
  {
    key: "race_nerves",
    ...scale,
    text: "How ready do you feel for the race?",
    minLabel: "Not at all",
    maxLabel: "Completely",
    category: "running",
    appliesWhen: { goals: ["race_prep"], running: true },
    produces: ["run_volume", "run_intensity", "message_cadence"],
  },
  {
    key: "test_standards",
    type: "text",
    text: "Which part of the test still worries you?",
    category: "training",
    appliesWhen: { goals: ["fitness_test"] },
    produces: ["training_volume", "session_order"],
  },
];

export const ALL_QUESTIONS: BankQuestion[] = [
  ...DAILY_CORE,
  ...WEEKLY_CORE,
  ...WEEKLY_CLOSERS,
  ...FIT_SECTION,
  ...BANK,
];

/**
 * The questions a stored form actually asks.
 *
 * `checkin_forms.questions` holds two different shapes. The seed and the week
 * roll write an array of keys; the coach's Check-ins screen wrote whole
 * question objects. Three readers assumed objects, so a client whose form came
 * from the seed or from the roll got a Monday card with an empty check-in and
 * a submit route that could not route a metric answer. Nothing reported it.
 *
 * Keys are the shape that survives, because the bank is already the single
 * source of a question's text and type, and a frozen copy of the wording drifts
 * from the bank the first time a question is reworded. This accepts both so
 * rows written before that decision still open, and resolves either to the
 * bank.
 *
 * A key the bank does not know is dropped rather than rendered raw: an
 * unrecognised key on a screen is a question nobody can answer.
 */
export function resolveQuestions(stored: unknown): BankQuestion[] {
  if (!Array.isArray(stored)) return [];

  const byKey = new Map(ALL_QUESTIONS.map((question) => [question.key, question]));

  return stored
    .map((entry) => {
      if (typeof entry === "string") return byKey.get(entry) ?? null;
      if (entry && typeof entry === "object" && "key" in entry) {
        const key = String((entry as { key: unknown }).key);
        // The bank's copy wins over the frozen one, so a reworded question
        // reads the same everywhere.
        return byKey.get(key) ?? (entry as BankQuestion);
      }
      return null;
    })
    .filter((question): question is BankQuestion => question !== null);
}
