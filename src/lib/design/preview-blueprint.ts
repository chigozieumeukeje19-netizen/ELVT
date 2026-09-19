import { deriveBlueprint, proposeTriggers } from "@/lib/blueprint/derive";
import { draftProgram } from "@/lib/blueprint/program-draft";
import type { Blueprint } from "@/lib/blueprint/types";
import { PREVIEW_LIBRARY, PREVIEW_TEMPLATE } from "./preview-program";
import type { Answers } from "@/lib/questionnaire/answers";

/**
 * Fixtures for the blueprint preview routes.
 *
 * The derived half is produced by the real deriver from real intake answers, so
 * the screen is checked against what the code actually outputs. The drafted
 * half is written out, because it stands in for a paste and there is no model
 * here to produce one.
 *
 * The client carries a spinal fusion, which is the case the whole flag chain
 * exists for, so the decisions list on this screen is not empty.
 */

const ANSWERS: Answers = {
  primary_goal: "Recomposition, both at once",
  goal_statement: "Down to 175 without losing the squat, and a half marathon in the spring",
  goal_weight: 175,
  duration_weeks: "16 weeks",
  start_weight: 192.5,
  height_cm: 183,
  dob: "1989-04-11",
  typical_steps: 7400,
  days_per_week: "4",
  preferred_days: ["Monday", "Tuesday", "Thursday", "Saturday"],
  session_length: "60 minutes",
  equipment: ["Full gym", "Dumbbells"],
  runs_at_all: true,
  weekly_mileage: 18,
  longest_run: 9,
  race_date: "2027-03-14",
  tracks_food: "Sometimes",
  meals_per_day: "3",
  who_cooks: "A dining facility or canteen",
  foods_out: "No shellfish",
  travel: "Two weeks in November",
  sleep_hours: 6.5,
  stress: 7,
  current_pain: true,
  injury_areas: ["Lower back or spine", "Knee"],
  surgery: "L5 S1 fusion in 2021, cleared for loaded hinging under 60 percent",
  cleared: true,
  tone: "Direct, tell me the number",
  reminder_time: "Early morning",
  checkin_day: "Sunday",
  accountability: 8,
};

const derived = deriveBlueprint(ANSWERS);

export const PREVIEW_BLUEPRINT: Blueprint = {
  derived,
  drafted: {
    summary:
      "Wants to be 175 and still squat, with a half in March. Sixteen weeks is enough for both if the running stays honest. The fusion decides the lifting, not the goal.",
    oneThing: "A 20 minute walk after dinner on the days he does not train.",
    failureMode:
      "Week three, when the travel starts. The first sign is steps under 6,000 two days running, and it goes from there.",
    toneNotes: "Direct. Give him the number and one question. He does not want encouragement.",
    triggers: proposeTriggers(derived),
  },
};

export const PREVIEW_BLUEPRINT_EMPTY: Blueprint = {
  derived,
  drafted: { summary: "", oneThing: "", failureMode: "", toneNotes: "", triggers: [] },
};

export const PREVIEW_PROGRAM_DRAFT = draftProgram({
  derived,
  template: PREVIEW_TEMPLATE,
  library: PREVIEW_LIBRARY,
  startDate: "2026-09-21",
  rationale: Array.from({ length: derived.durationWeeks }, (_, i) => ({
    week: i + 1,
    rationale:
      i === 3
        ? "Deload. Volume drops to two thirds and the long run holds at 7 miles."
        : `Volume climbs to ${3 + Math.floor(i / 4)} hard sets per movement and the long run reaches ${7 + i} miles.`,
  })),
});
