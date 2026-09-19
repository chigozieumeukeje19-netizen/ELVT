/**
 * Intake answers to the half of the Blueprint that is fact rather than
 * judgement.
 *
 * Every field here is something the client stated. Nothing is inferred, nothing
 * is smoothed, and nothing goes through a model, because a model paraphrasing
 * "lower back or spine" into "some back stiffness" is how a client with a
 * spinal fusion ends up under a barbell.
 *
 * The flags are the important output. flag_config drives the template applier's
 * contraindication filter, so the mapping from what a client ticked to the flag
 * key that protects them is written once, here, and tested directly.
 */

import type { FlagKey } from "@/lib/program/types";
import type { Answers } from "@/lib/questionnaire/answers";
import type { DerivedBlueprint, GoalType, Tone } from "./types";

/** What a client ticked, to the flag key that keeps movements away from them. */
export const INJURY_TO_FLAG: Record<string, FlagKey> = {
  "Lower back or spine": "spine",
  Knee: "knee",
  Shoulder: "shoulder",
  Elbow: "elbow",
  Hip: "hip",
  "Achilles or calf": "achilles",
  Wrist: "wrist",
  Ankle: "ankle",
  Neck: "neck",
  Ribs: "rib",
};

const GOAL_TO_TYPE: Record<string, GoalType> = {
  "Lose fat": "fat_loss",
  "Build muscle": "muscle_gain",
  "Recomposition, both at once": "recomp",
  "Train for a race": "race_prep",
  "Pass a fitness test": "fitness_test",
  "Get back to training after a break": "return_to_training",
};

const TONE_MAP: Record<string, Tone> = {
  "Direct, tell me the number": "direct",
  "Encouraging, but honest": "encouraging",
  "Mostly leave me to it": "hands_off",
  "Check on me often": "close_contact",
};

const REMINDER_TIME: Record<string, string> = {
  "Early morning": "06:30",
  "Mid morning": "09:30",
  Lunchtime: "12:30",
  Evening: "19:00",
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim() !== "") return [value];
  return [];
}

/** "12 weeks" to 12, "Not sure, you decide" to the house default. */
export const DEFAULT_DURATION_WEEKS = 12;
export const DEFAULT_SESSION_MINUTES = 60;

function weeksFrom(value: unknown): number {
  const parsed = Number(text(value).match(/\d+/)?.[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DURATION_WEEKS;
}

function minutesFrom(value: unknown): number {
  const parsed = Number(text(value).match(/\d+/)?.[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SESSION_MINUTES;
}

export function deriveBlueprint(answers: Answers): DerivedBlueprint {
  const runs = answers.runs_at_all === true;

  // Only the injuries that map to a flag. "None of these" maps to nothing,
  // which is the answer, not an omission.
  const flags = [
    ...new Set(
      list(answers.injury_areas)
        .map((area) => INJURY_TO_FLAG[area])
        .filter((flag): flag is FlagKey => Boolean(flag)),
    ),
  ];

  const medical: string[] = [];
  if (answers.current_pain === true) medical.push("Reports current pain at intake");
  if (answers.cleared === false) medical.push("Not cleared to train by a doctor or physio");
  const surgery = text(answers.surgery);
  if (surgery) medical.push(surgery);

  const constraints: string[] = [];
  const foodsOut = text(answers.foods_out);
  if (foodsOut) constraints.push(foodsOut);
  const travel = text(answers.travel);
  if (travel) constraints.push(`Travel: ${travel}`);
  const cooks = text(answers.who_cooks);
  if (cooks === "A dining facility or canteen") {
    constraints.push("Eats from a dining facility, so the meal plan has to work from what is served");
  }

  return {
    goalType: GOAL_TO_TYPE[text(answers.primary_goal)] ?? "recomp",
    goalStatement: text(answers.goal_statement),
    goalWeight: number(answers.goal_weight),
    durationWeeks: weeksFrom(answers.duration_weeks),

    daysPerWeek: number(answers.days_per_week) ?? 3,
    preferredDays: list(answers.preferred_days),
    sessionMinutes: minutesFrom(answers.session_length),
    equipment: list(answers.equipment),

    runs,
    // A client who does not run has no mileage, whatever is left in the box
    // from before they answered no.
    weeklyMileage: runs ? number(answers.weekly_mileage) : null,
    longestRun: runs ? number(answers.longest_run) : null,
    raceDate: runs ? (text(answers.race_date) || null) : null,

    nutritionStructure: text(answers.tracks_food),
    mealsPerDay: number(answers.meals_per_day) ?? 3,
    constraints,

    startWeight: number(answers.start_weight),
    heightCm: number(answers.height_cm),
    dob: text(answers.dob) || null,
    stepGoal: number(answers.typical_steps),
    sleepHours: number(answers.sleep_hours),

    flags,
    medical,

    tone: TONE_MAP[text(answers.tone)] ?? "encouraging",
    reminderTime: REMINDER_TIME[text(answers.reminder_time)] ?? "07:00",
    checkinDay: text(answers.checkin_day) || "Sunday",
    accountability: number(answers.accountability) ?? 5,
  };
}

/**
 * The trigger thresholds a client's own answers imply.
 *
 * Proposed rather than applied. They land on the approval screen with the rest
 * of the draft and the coach can change any of them, but they start from what
 * the client actually said rather than from a house default that fits nobody.
 */
export function proposeTriggers(derived: DerivedBlueprint) {
  const triggers = [];

  if (derived.stepGoal !== null) {
    // Eighty percent of their own normal day. A threshold set at a round 10,000
    // fires constantly for someone who walks 7,000 and never for someone who
    // walks 15,000.
    const threshold = Math.round((derived.stepGoal * 0.8) / 100) * 100;
    triggers.push({
      key: "steps_low",
      name: "Steps under their own normal, two days running",
      threshold,
      suggestedMessage: `Two quiet days on steps. What does tomorrow look like?`,
    });
  }

  if (derived.sleepHours !== null && derived.sleepHours < 7) {
    triggers.push({
      key: "sleep_low",
      name: "Sleep below their stated normal",
      threshold: Math.max(4, Math.floor(derived.sleepHours - 1)),
      suggestedMessage: "Sleep is down on your usual. Anything changed this week?",
    });
  }

  if (derived.runs) {
    triggers.push({
      key: "mileage_ramp",
      name: "Weekly mileage more than 10 percent above the last three weeks",
      threshold: 10,
      suggestedMessage: "Mileage jumped this week. Hold it here next week.",
    });
  }

  if (derived.flags.length > 0) {
    triggers.push({
      key: "flag_pain",
      name: "Pain reported above none on a flagged area",
      threshold: 1,
      suggestedMessage: "You flagged discomfort. Where exactly, and what were you doing?",
    });
  }

  return triggers;
}
