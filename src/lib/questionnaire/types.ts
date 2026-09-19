/**
 * Questionnaires. Eleven question types, three of which are not just data.
 *
 * Metric answers write to daily_logs, so a weight typed into the intake lands
 * on the weight chart rather than sitting in a jsonb blob nothing reads.
 * Progress photo answers write to the gallery for the same reason. Signature
 * answers are kept but never rendered anywhere a coach browses casually.
 *
 * That routing is the whole reason this is a typed module rather than a free
 * jsonb shape: a question that says it produces a weight has to be checked
 * against the column it writes to before a client fills it in, not after.
 */

export const QUESTION_TYPES = [
  "text",
  "number",
  "multiple_choice",
  "scale",
  "yes_no",
  "media",
  "date",
  "star_rating",
  "signature",
  "progress_photos",
  "metric",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/**
 * Columns on daily_logs a metric question is allowed to write.
 *
 * A closed list rather than a free column name, because the answer arrives
 * from a public form and the target is chosen by whoever built the
 * questionnaire.
 */
export const METRIC_TARGETS = ["weight", "steps", "sleep_hours", "water", "energy", "mood"] as const;
export type MetricTarget = (typeof METRIC_TARGETS)[number];

export const PHOTO_ANGLES = ["front", "side", "back"] as const;
export type PhotoAngle = (typeof PHOTO_ANGLES)[number];

export type Question = {
  key: string;
  type: QuestionType;
  text: string;
  /** Shown under the question. Used for the unit, or for what "1" means. */
  help?: string;
  required?: boolean;

  /** multiple_choice. */
  options?: string[];
  allowMultiple?: boolean;

  /** scale and star_rating. */
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;

  /** number and metric. */
  unit?: string;

  /** metric only. Where the answer goes. */
  metric?: MetricTarget;

  /** progress_photos only. */
  angles?: PhotoAngle[];

  /**
   * Which client variable this answer can change, mirroring question_bank's
   * produces. Present on the intake too, so the Blueprint drafter knows which
   * answers it is allowed to reason from.
   */
  produces?: string[];
};

export type Section = {
  key: string;
  title: string;
  /** One line saying why this section is being asked. Shown above it. */
  intent: string;
  questions: Question[];
};

export type Questionnaire = {
  name: string;
  kind: "intake" | "reassessment" | "custom";
  sections: Section[];
};

/** Everything a section's questions need to be answerable. */
export const SCALE_DEFAULTS = { min: 1, max: 10 } as const;
export const STAR_DEFAULTS = { min: 1, max: 5 } as const;

/**
 * What a question is worth to the progress bar.
 *
 * Optional questions still count, because a form that says 60 percent and then
 * asks four more things has lied. Every question the client can see is one
 * step, and the bar counts the ones with an answer.
 */
export function totalQuestions(questionnaire: Questionnaire): number {
  return questionnaire.sections.reduce((sum, section) => sum + section.questions.length, 0);
}

export function questionAt(questionnaire: Questionnaire, key: string): Question | null {
  for (const section of questionnaire.sections) {
    const found = section.questions.find((question) => question.key === key);
    if (found) return found;
  }
  return null;
}
