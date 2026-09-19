/**
 * Validating answers, and working out where each one has to go.
 *
 * Three question types are not just data:
 *
 *   metric          writes a column on daily_logs, so a weight typed into the
 *                   intake appears on the weight chart
 *   progress_photos writes to the gallery, filed by week and angle
 *   signature       is kept, but never rendered on a screen a coach browses
 *
 * Everything else lives in the response's answers jsonb. The routing is worked
 * out here rather than at the write site so there is one list of what leaves
 * the blob, and so it can be tested without a database.
 */

import {
  METRIC_TARGETS,
  PHOTO_ANGLES,
  SCALE_DEFAULTS,
  STAR_DEFAULTS,
  questionAt,
  totalQuestions,
  type MetricTarget,
  type PhotoAngle,
  type Question,
  type Questionnaire,
} from "./types";

export type AnswerValue = string | number | boolean | string[] | null;
export type Answers = Record<string, AnswerValue>;

export type ValidationIssue = { key: string; message: string };

/** Whether an answer counts as given, for the progress bar and for required. */
export function isAnswered(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * How far through the form the client is.
 *
 * Counts every question they can see, optional ones included. A bar that says
 * 80 percent and then asks four more things has lied, and a form that lies
 * about its length is one people abandon.
 */
export function progress(questionnaire: Questionnaire, answers: Answers) {
  const total = totalQuestions(questionnaire);
  const answered = questionnaire.sections
    .flatMap((section) => section.questions)
    .filter((question) => isAnswered(answers[question.key])).length;

  return {
    answered,
    total,
    percent: total === 0 ? 0 : Math.round((answered / total) * 100),
  };
}

export function sectionProgress(
  questionnaire: Questionnaire,
  answers: Answers,
): { key: string; answered: number; total: number; complete: boolean }[] {
  return questionnaire.sections.map((section) => {
    const answered = section.questions.filter((question) =>
      isAnswered(answers[question.key]),
    ).length;
    const required = section.questions.filter((question) => question.required);
    return {
      key: section.key,
      answered,
      total: section.questions.length,
      complete: required.every((question) => isAnswered(answers[question.key])),
    };
  });
}

function validateOne(question: Question, value: AnswerValue | undefined): string | null {
  if (!isAnswered(value)) {
    return question.required ? "This one is needed before you can submit." : null;
  }

  switch (question.type) {
    case "number":
    case "metric": {
      const number = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(number)) return "This needs to be a number.";
      if (number < 0) return "This cannot be negative.";
      return null;
    }

    case "scale":
    case "star_rating": {
      const defaults = question.type === "scale" ? SCALE_DEFAULTS : STAR_DEFAULTS;
      const min = question.min ?? defaults.min;
      const max = question.max ?? defaults.max;
      const number = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(number)) return "Pick a value.";
      if (number < min || number > max) return `Pick something between ${min} and ${max}.`;
      return null;
    }

    case "multiple_choice": {
      const options = question.options ?? [];
      const chosen = Array.isArray(value) ? value : [String(value)];
      if (!question.allowMultiple && chosen.length > 1) return "Pick one.";
      const unknown = chosen.filter((option) => !options.includes(option));
      if (unknown.length > 0) return `${unknown[0]} is not one of the options.`;
      return null;
    }

    case "yes_no":
      if (typeof value !== "boolean") return "Answer yes or no.";
      return null;

    case "date": {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return "Use a date.";
      }
      if (Number.isNaN(Date.parse(value))) return "That date does not exist.";
      return null;
    }

    case "progress_photos": {
      const angles = Array.isArray(value) ? value : [];
      const allowed = question.angles ?? [...PHOTO_ANGLES];
      const unknown = angles.filter((angle) => !allowed.includes(angle as PhotoAngle));
      if (unknown.length > 0) return `${unknown[0]} is not one of the angles asked for.`;
      return null;
    }

    case "text":
    case "media":
    case "signature":
      return null;
  }
}

export function validate(questionnaire: Questionnaire, answers: Answers): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const section of questionnaire.sections) {
    for (const question of section.questions) {
      const message = validateOne(question, answers[question.key]);
      if (message) issues.push({ key: question.key, message });
    }
  }

  // An answer to a question that does not exist is not a typo, it is someone
  // posting whatever they like at a public endpoint. Named rather than dropped
  // quietly, so a genuine renaming shows up rather than losing answers.
  for (const key of Object.keys(answers)) {
    if (!questionAt(questionnaire, key)) {
      issues.push({ key, message: "There is no question with this key." });
    }
  }

  return issues;
}

export type MetricWrite = { metric: MetricTarget; value: number };
export type PhotoWrite = { questionKey: string; angle: PhotoAngle };

export type Routed = {
  /** Everything that stays in questionnaire_responses.answers. */
  answers: Answers;
  /** Answers that become daily_logs columns. */
  metrics: MetricWrite[];
  /** Answers that become gallery rows. */
  photos: PhotoWrite[];
};

/**
 * Splits a submission into the blob and the rows that leave it.
 *
 * A metric question whose target is not on the allow list is dropped from the
 * metric writes and kept in the blob. The target is chosen by whoever built
 * the questionnaire and the answer arrives from a public form, so "the
 * questionnaire said so" is not enough to write an arbitrary column.
 */
export function route(questionnaire: Questionnaire, answers: Answers): Routed {
  const metrics: MetricWrite[] = [];
  const photos: PhotoWrite[] = [];

  for (const section of questionnaire.sections) {
    for (const question of section.questions) {
      const value = answers[question.key];
      if (!isAnswered(value)) continue;

      if (question.type === "metric" && question.metric) {
        if (!METRIC_TARGETS.includes(question.metric)) continue;
        const number = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(number)) continue;
        metrics.push({ metric: question.metric, value: number });
      }

      if (question.type === "progress_photos") {
        const angles = Array.isArray(value) ? value : [];
        const allowed = question.angles ?? [...PHOTO_ANGLES];
        for (const angle of angles) {
          if (!allowed.includes(angle as PhotoAngle)) continue;
          photos.push({ questionKey: question.key, angle: angle as PhotoAngle });
        }
      }
    }
  }

  return { answers, metrics, photos };
}

/**
 * Which questions a client actually sees.
 *
 * The running section is five questions nobody who does not run should be
 * asked. This is the only branching the intake has, and it is stated here
 * rather than hidden in the form component, so the progress bar and the
 * required check agree with what is on screen.
 */
export function visible(questionnaire: Questionnaire, answers: Answers): Questionnaire {
  const runs = answers.runs_at_all === true;

  return {
    ...questionnaire,
    sections: questionnaire.sections.map((section) => {
      if (section.key !== "running" || runs) return section;
      return {
        ...section,
        questions: section.questions.filter((question) => question.key === "runs_at_all"),
      };
    }),
  };
}
