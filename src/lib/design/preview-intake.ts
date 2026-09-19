import type { Answers } from "@/lib/questionnaire/answers";

/**
 * Fixtures for the intake preview routes.
 *
 * Deliberately awkward: a long name, a long free text answer, and a section
 * where every question has an error at once. The empty state and the full state
 * are both checked, per DESIGN.md constraint 4.
 */

export const PREVIEW_INTAKE_ANSWERS: Answers = {
  primary_goal: "Recomposition, both at once",
  goal_statement:
    "Down to 175 without losing the squat, and still able to run a half in under two hours by the spring.",
  duration_weeks: "12 weeks",
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
  tracks_food: "Sometimes",
  meals_per_day: "3",
  who_cooks: "Me, most days",
  sleep_hours: 6.5,
  sleep_quality: 6,
  stress: 7,
  current_pain: true,
  injury_areas: ["Lower back or spine", "Knee"],
  cleared: true,
  medical_consent: "signed",
  what_worked: "Lifting three times a week and walking the dog after dinner",
  what_failed:
    "Week three, every single time. Work travel starts, the routine goes, and I never rebuild it.",
  confidence: 7,
  tone: "Direct, tell me the number",
  reminder_time: "Early morning",
  checkin_day: "Sunday",
  accountability: 8,
  one_thing: "Walking after dinner on the days I do not train",
  biggest_obstacle: "Work trips, three or four a quarter",
  start_readiness: 4,
};

/** Every question in the medical section wrong at once. */
export const PREVIEW_INTAKE_ERRORS: Record<string, string> = {
  current_pain: "This one is needed before you can submit.",
  injury_areas: "Overhead is not one of the options.",
  surgery: "This one is needed before you can submit.",
  cleared: "This one is needed before you can submit.",
  medical_consent: "This one is needed before you can submit.",
};
