/**
 * The Blueprint. The approved document every generator reads before it writes,
 * and the context block every AI job receives.
 *
 * Split into two halves on purpose:
 *
 *   derived   computed from the intake answers by code, deterministically.
 *             Goal, duration, training days, equipment, flags, targets. These
 *             are facts the client stated, and a model paraphrasing them is a
 *             model that can get them wrong.
 *   drafted   the prose. The summary, the proposed One Thing, the failure mode
 *             and the tone. Judgement rather than transcription, so this is the
 *             half that goes through the prompt and paste flow.
 *
 * Nothing in `derived` is ever written by a paste. That is the whole point of
 * the split: an AI job cannot quietly change which movements a client with a
 * spinal fusion is allowed to do.
 */

import type { FlagKey } from "@/lib/program/types";

export const GOAL_TYPES = [
  "fat_loss", "muscle_gain", "recomp", "race_prep", "fitness_test", "return_to_training",
] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const TONES = ["direct", "encouraging", "hands_off", "close_contact"] as const;
export type Tone = (typeof TONES)[number];

export type DerivedBlueprint = {
  goalType: GoalType;
  goalStatement: string;
  goalWeight: number | null;
  durationWeeks: number;

  daysPerWeek: number;
  preferredDays: string[];
  sessionMinutes: number;
  equipment: string[];

  runs: boolean;
  weeklyMileage: number | null;
  longestRun: number | null;
  raceDate: string | null;

  nutritionStructure: string;
  mealsPerDay: number;
  constraints: string[];

  startWeight: number | null;
  heightCm: number | null;
  dob: string | null;
  stepGoal: number | null;
  sleepHours: number | null;

  /** Drives every contraindication filter. Never written by a paste. */
  flags: FlagKey[];
  medical: string[];

  tone: Tone;
  reminderTime: string;
  checkinDay: string;
  accountability: number;
};

export type TriggerProposal = {
  key: string;
  name: string;
  threshold: number;
  suggestedMessage: string;
};

export type DraftedBlueprint = {
  /** Two or three sentences a coach can read before a call. */
  summary: string;
  oneThing: string;
  failureMode: string;
  toneNotes: string;
  triggers: TriggerProposal[];
};

export type Blueprint = {
  derived: DerivedBlueprint;
  drafted: DraftedBlueprint;
};

export const EMPTY_DRAFT: DraftedBlueprint = {
  summary: "",
  oneThing: "",
  failureMode: "",
  toneNotes: "",
  triggers: [],
};
