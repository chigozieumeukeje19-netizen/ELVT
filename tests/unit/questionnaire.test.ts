import { describe, expect, it } from "vitest";
import {
  isAnswered,
  progress,
  route,
  sectionProgress,
  validate,
  visible,
  type Answers,
} from "@/lib/questionnaire/answers";
import { INTAKE } from "@/lib/questionnaire/intake";
import { METRIC_TARGETS, QUESTION_TYPES, totalQuestions } from "@/lib/questionnaire/types";

describe("the intake form", () => {
  it("has ten sections", () => {
    expect(INTAKE.sections).toHaveLength(10);
  });

  it("uses every one of the eleven question types somewhere", () => {
    const used = new Set(
      INTAKE.sections.flatMap((section) => section.questions.map((question) => question.type)),
    );
    for (const type of QUESTION_TYPES) {
      expect(used.has(type), `${type} is never asked`).toBe(true);
    }
  });

  it("gives every question a unique key", () => {
    const keys = INTAKE.sections.flatMap((section) => section.questions.map((q) => q.key));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("says why every section is being asked", () => {
    for (const section of INTAKE.sections) {
      expect(section.intent.trim().length, section.key).toBeGreaterThan(20);
    }
  });

  it("points every metric question at a column that exists", () => {
    for (const section of INTAKE.sections) {
      for (const question of section.questions) {
        if (question.type !== "metric") continue;
        expect(question.metric, question.key).toBeDefined();
        expect(METRIC_TARGETS).toContain(question.metric!);
      }
    }
  });

  it("gives every multiple choice question its options", () => {
    for (const section of INTAKE.sections) {
      for (const question of section.questions) {
        if (question.type !== "multiple_choice") continue;
        expect((question.options ?? []).length, question.key).toBeGreaterThan(1);
      }
    }
  });

  it("says which client variable every answer can change", () => {
    // Mirrors question_bank.produces. An answer nothing reads is a question
    // that should not be asked.
    for (const section of INTAKE.sections) {
      for (const question of section.questions) {
        expect((question.produces ?? []).length, question.key).toBeGreaterThan(0);
      }
    }
  });

  it("renders no raw enum value in any question a client reads", () => {
    for (const section of INTAKE.sections) {
      const strings = [
        section.title,
        section.intent,
        ...section.questions.flatMap((q) => [q.text, q.help ?? "", ...(q.options ?? [])]),
      ];
      for (const text of strings) {
        expect(text, `${section.key}: ${text}`).not.toMatch(/\b[a-z]{2,}_[a-z][a-z_]*\b/);
      }
    }
  });

  it("uses no dashes in anything a client reads, per the voice rules", () => {
    for (const section of INTAKE.sections) {
      const strings = [
        section.title,
        section.intent,
        ...section.questions.flatMap((q) => [q.text, q.help ?? "", ...(q.options ?? [])]),
      ];
      for (const text of strings) {
        expect(text, text).not.toMatch(/\s[-–—]\s/);
      }
    }
  });
});

const COMPLETE: Answers = {
  primary_goal: "Lose fat",
  goal_statement: "Down to 175 and still able to run a half",
  duration_weeks: "12 weeks",
  start_weight: 192.5,
  height_cm: 183,
  dob: "1989-04-11",
  days_per_week: "4",
  preferred_days: ["Monday", "Tuesday", "Thursday", "Saturday"],
  session_length: "60 minutes",
  equipment: ["Full gym"],
  runs_at_all: true,
  tracks_food: "Sometimes",
  meals_per_day: "3",
  who_cooks: "Me, most days",
  sleep_hours: 6.5,
  sleep_quality: 6,
  stress: 7,
  current_pain: false,
  cleared: true,
  medical_consent: "signed",
  what_worked: "Lifting three times a week",
  what_failed: "Week three, always",
  confidence: 7,
  tone: "Direct, tell me the number",
  reminder_time: "Early morning",
  checkin_day: "Sunday",
  accountability: 8,
  one_thing: "Walking after dinner",
  biggest_obstacle: "Work trips",
  start_readiness: 4,
};

describe("validation", () => {
  it("accepts a complete submission", () => {
    expect(validate(visible(INTAKE, COMPLETE), COMPLETE)).toEqual([]);
  });

  it("names every missing required answer, not just the first", () => {
    const issues = validate(visible(INTAKE, {}), {});
    expect(issues.length).toBeGreaterThan(5);
    expect(issues.every((issue) => issue.message.includes("needed"))).toBe(true);
  });

  it("refuses a choice that is not one of the options", () => {
    const issues = validate(INTAKE, { ...COMPLETE, primary_goal: "Become taller" });
    expect(issues).toContainEqual({
      key: "primary_goal",
      message: "Become taller is not one of the options.",
    });
  });

  it("refuses two answers to a single choice question", () => {
    const issues = validate(INTAKE, { ...COMPLETE, primary_goal: ["Lose fat", "Build muscle"] });
    expect(issues.some((issue) => issue.key === "primary_goal" && issue.message === "Pick one.")).toBe(true);
  });

  it("refuses a scale answer outside its range", () => {
    const issues = validate(INTAKE, { ...COMPLETE, confidence: 11 });
    expect(issues.some((issue) => issue.key === "confidence")).toBe(true);
  });

  it("refuses a star rating above five even though scales go to ten", () => {
    const issues = validate(INTAKE, { ...COMPLETE, start_readiness: 8 });
    expect(issues.some((issue) => issue.key === "start_readiness")).toBe(true);
  });

  it("refuses a date that is not a date", () => {
    expect(validate(INTAKE, { ...COMPLETE, dob: "11 April 1989" })).toContainEqual({
      key: "dob",
      message: "Use a date.",
    });
  });

  it("refuses a negative metric", () => {
    expect(
      validate(INTAKE, { ...COMPLETE, start_weight: -5 }).some((i) => i.key === "start_weight"),
    ).toBe(true);
  });

  it("names an answer to a question that does not exist", () => {
    // A public endpoint takes whatever is posted at it. Dropping the extra
    // quietly would also hide a genuine renaming.
    expect(validate(INTAKE, { ...COMPLETE, is_admin: true })).toContainEqual({
      key: "is_admin",
      message: "There is no question with this key.",
    });
  });

  it("refuses a photo angle nobody asked for", () => {
    expect(
      validate(INTAKE, { ...COMPLETE, start_photos: ["front", "overhead"] }).some(
        (issue) => issue.key === "start_photos",
      ),
    ).toBe(true);
  });
});

describe("the running branch", () => {
  it("asks only whether you run, when you do not", () => {
    const shown = visible(INTAKE, { runs_at_all: false });
    const running = shown.sections.find((section) => section.key === "running")!;
    expect(running.questions).toHaveLength(1);
    expect(running.questions[0].key).toBe("runs_at_all");
  });

  it("asks the rest when you do", () => {
    const shown = visible(INTAKE, { runs_at_all: true });
    const running = shown.sections.find((section) => section.key === "running")!;
    expect(running.questions).toHaveLength(5);
  });

  it("does not count hidden questions against the progress bar", () => {
    const answers: Answers = { runs_at_all: false };
    const shown = visible(INTAKE, answers);
    expect(progress(shown, answers).total).toBe(totalQuestions(INTAKE) - 4);
  });
});

describe("progress", () => {
  it("counts optional questions too, so the bar does not lie about the length", () => {
    // Every question the client can see is one step. A bar that reads 100 and
    // then asks four more things is worse than no bar.
    const shown = visible(INTAKE, COMPLETE);
    const bar = progress(shown, COMPLETE);
    expect(bar.total).toBe(totalQuestions(shown));
    expect(bar.percent).toBeLessThan(100);
  });

  it("reaches 100 only when everything visible is answered", () => {
    const shown = visible(INTAKE, COMPLETE);
    const everything: Answers = { ...COMPLETE };
    for (const section of shown.sections) {
      for (const question of section.questions) {
        if (isAnswered(everything[question.key])) continue;
        everything[question.key] = question.type === "yes_no" ? true : "something";
      }
    }
    expect(progress(shown, everything).percent).toBe(100);
  });

  it("marks a section complete on its required questions, not all of them", () => {
    const shown = visible(INTAKE, COMPLETE);
    const one = sectionProgress(shown, COMPLETE).find((s) => s.key === "one_thing")!;
    // anything_else is optional and unanswered.
    expect(one.answered).toBeLessThan(one.total);
    expect(one.complete).toBe(true);
  });
});

describe("routing an answer to where it has to go", () => {
  it("sends metric answers to daily_logs", () => {
    const routed = route(INTAKE, COMPLETE);
    expect(routed.metrics).toContainEqual({ metric: "weight", value: 192.5 });
    expect(routed.metrics).toContainEqual({ metric: "sleep_hours", value: 6.5 });
  });

  it("sends photo answers to the gallery, one per angle", () => {
    const routed = route(INTAKE, { ...COMPLETE, start_photos: ["front", "side", "back"] });
    expect(routed.photos).toHaveLength(3);
    expect(routed.photos.map((photo) => photo.angle)).toEqual(["front", "side", "back"]);
  });

  it("leaves everything else in the response blob", () => {
    const routed = route(INTAKE, COMPLETE);
    expect(routed.answers.one_thing).toBe("Walking after dinner");
    // A text answer is not a metric no matter what it contains.
    expect(routed.metrics.map((metric) => metric.metric)).not.toContain("energy");
  });

  it("refuses to write a column outside the allow list", () => {
    // The target is chosen by whoever built the questionnaire and the answer
    // arrives from a public form, so "the questionnaire said so" is not enough.
    const rogue = {
      ...INTAKE,
      sections: [
        {
          key: "rogue",
          title: "Rogue",
          intent: "A questionnaire pointing a metric at a column nobody allowed.",
          questions: [
            {
              key: "rogue_metric",
              type: "metric" as const,
              metric: "role" as never,
              text: "Role",
              produces: ["role"],
            },
          ],
        },
      ],
    };

    expect(route(rogue, { rogue_metric: 1 }).metrics).toEqual([]);
  });

  it("writes no metric for a question left blank", () => {
    const partial: Answers = { ...COMPLETE, start_weight: null, sleep_hours: null };
    expect(route(INTAKE, partial).metrics).toEqual([]);
  });
});
