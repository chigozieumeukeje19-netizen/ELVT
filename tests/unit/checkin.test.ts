import { describe, expect, it } from "vitest";
import {
  ALL_QUESTIONS,
  BANK,
  CATEGORIES,
  DAILY_CORE,
  PRODUCES,
  WEEKLY_CLOSERS,
  WEEKLY_CORE,
} from "@/lib/checkin/bank";
import {
  applies,
  buildDailyForm,
  buildWeeklyForm,
  DAILY_MAX,
  DAILY_MIN,
  spineFrom,
  WEEKLY_TARGET,
  type ClientProfile,
} from "@/lib/checkin/generate";
import { QUESTION_TYPES } from "@/lib/questionnaire/types";
import { FLAG_KEYS } from "@/lib/program/types";

const FAT_LOSS: ClientProfile = { goal: "fat_loss", flags: [], running: false };
const RUNNER_WITH_CALF: ClientProfile = { goal: "race_prep", flags: ["achilles"], running: true };
const FUSION: ClientProfile = { goal: "recomp", flags: ["spine", "knee"], running: true };

describe("the question bank", () => {
  it("gives every question a unique key", () => {
    const keys = ALL_QUESTIONS.map((question) => question.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("makes every question produce at least one client variable", () => {
    // A question that produces nothing can never be pulled by the spine, so it
    // would be asked forever and answer nothing.
    for (const question of ALL_QUESTIONS) {
      expect(question.produces.length, question.key).toBeGreaterThan(0);
      for (const produces of question.produces) {
        expect(PRODUCES, `${question.key} produces ${produces}`).toContain(produces);
      }
    }
  });

  it("gives every question a category and a type that exist", () => {
    for (const question of ALL_QUESTIONS) {
      expect(CATEGORIES, question.key).toContain(question.category);
      expect(QUESTION_TYPES, question.key).toContain(question.type);
    }
  });

  it("names only flags that exist", () => {
    for (const question of ALL_QUESTIONS) {
      for (const flag of question.appliesWhen.flags ?? []) {
        expect(FLAG_KEYS, question.key).toContain(flag);
      }
    }
  });

  it("renders no raw enum value in anything a client reads", () => {
    for (const question of ALL_QUESTIONS) {
      for (const text of [question.text, question.help ?? "", ...(question.options ?? [])]) {
        expect(text, question.key).not.toMatch(/\b[a-z]{2,}_[a-z][a-z_]*\b/);
      }
    }
  });

  it("uses no dashes in anything a client reads", () => {
    for (const question of ALL_QUESTIONS) {
      for (const text of [question.text, question.help ?? "", ...(question.options ?? [])]) {
        expect(text, text).not.toMatch(/\s[-–—]\s/);
      }
    }
  });
});

describe("who a question applies to", () => {
  it("keeps an injury question away from a client whose area is fine", () => {
    const knee = BANK.find((question) => question.key === "knee_pain")!;
    expect(applies(knee, FUSION)).toBe(true);
    expect(applies(knee, FAT_LOSS)).toBe(false);
    // Asking someone with no knee problem about their knee trains them to
    // answer "none" without reading, which is how a real one gets missed.
    expect(applies(knee, RUNNER_WITH_CALF)).toBe(false);
  });

  it("keeps a running question away from someone who does not run", () => {
    const legs = BANK.find((question) => question.key === "run_legs")!;
    expect(applies(legs, RUNNER_WITH_CALF)).toBe(true);
    expect(applies(legs, FAT_LOSS)).toBe(false);
  });

  it("filters on goal", () => {
    const hunger = BANK.find((question) => question.key === "hunger")!;
    expect(applies(hunger, FAT_LOSS)).toBe(true);
    expect(applies(hunger, RUNNER_WITH_CALF)).toBe(false);
  });

  it("holds the fit questions back until week 1", () => {
    const fit = BANK.concat(
      // FIT_SECTION is not in BANK, so it is reached through the weekly form.
      [],
    );
    expect(fit).toBeDefined();
    const week1 = buildWeeklyForm(FAT_LOSS, { isFirstWeek: true });
    const later = buildWeeklyForm(FAT_LOSS, { isFirstWeek: false });
    expect(week1.questions.some((q) => q.category === "fit")).toBe(true);
    expect(later.questions.some((q) => q.category === "fit")).toBe(false);
  });
});

describe("the daily form", () => {
  it("opens with the same four questions for everyone, in the same order", () => {
    for (const client of [FAT_LOSS, RUNNER_WITH_CALF, FUSION]) {
      const form = buildDailyForm(client);
      expect(form.slice(0, 4).map((q) => q.key)).toEqual([
        "session_done", "sleep_hours", "energy", "steps",
      ]);
    }
  });

  it("stays between six and seven questions", () => {
    for (const client of [FAT_LOSS, RUNNER_WITH_CALF, FUSION]) {
      const form = buildDailyForm(client);
      expect(form.length, `${client.goal}`).toBeGreaterThanOrEqual(DAILY_MIN);
      expect(form.length, `${client.goal}`).toBeLessThanOrEqual(DAILY_MAX);
    }
  });

  it("puts an injury question first among the extras", () => {
    // A flagged area going wrong is handled the same day, not on Monday, so it
    // cannot be the question that falls off the end.
    const form = buildDailyForm(FUSION);
    expect(form[4].category).toBe("injury");
  });

  it("asks nothing that takes a minute to answer", () => {
    for (const client of [FAT_LOSS, RUNNER_WITH_CALF, FUSION]) {
      for (const question of buildDailyForm(client)) {
        expect(question.type, question.key).not.toBe("text");
        expect(question.type, question.key).not.toBe("progress_photos");
      }
    }
  });

  it("is the same form twice for the same client", () => {
    expect(buildDailyForm(FUSION).map((q) => q.key)).toEqual(
      buildDailyForm(FUSION).map((q) => q.key),
    );
  });
});

describe("the weekly form", () => {
  it("always asks fasted weight first", () => {
    for (const client of [FAT_LOSS, RUNNER_WITH_CALF, FUSION]) {
      for (const spine of [null, "calories", "run_volume"] as const) {
        const form = buildWeeklyForm(client, { spineVariable: spine });
        expect(form.questions[0].key, `${client.goal} / ${spine}`).toBe("fasted_weight");
      }
    }
  });

  it("keeps the shared block in order behind it", () => {
    const form = buildWeeklyForm(FAT_LOSS);
    expect(form.questions.slice(0, 5).map((q) => q.key)).toEqual(
      WEEKLY_CORE.map((q) => q.key),
    );
  });

  it("always closes with accountability and the one thing", () => {
    for (const client of [FAT_LOSS, RUNNER_WITH_CALF, FUSION]) {
      const form = buildWeeklyForm(client, { isFirstWeek: true });
      expect(form.questions.slice(-2).map((q) => q.key)).toEqual(
        WEEKLY_CLOSERS.map((q) => q.key),
      );
    }
  });

  it("pulls the spine questions when a variable changed last Monday", () => {
    const form = buildWeeklyForm(FAT_LOSS, { spineVariable: "calories" });
    expect(form.spineKeys.length).toBeGreaterThan(0);
    for (const key of form.spineKeys) {
      const question = form.questions.find((q) => q.key === key)!;
      expect(question.produces, key).toContain("calories");
    }
  });

  it("puts the spine questions straight after the shared block", () => {
    // A question asking whether last Monday's change worked is never the one
    // dropped for length.
    const form = buildWeeklyForm(FAT_LOSS, { spineVariable: "calories" });
    const firstSpineAt = form.questions.findIndex((q) => form.spineKeys.includes(q.key));
    expect(firstSpineAt).toBe(WEEKLY_CORE.length);
  });

  it("has no spine when nothing changed, and says so rather than inventing one", () => {
    const form = buildWeeklyForm(FAT_LOSS, { spineVariable: null });
    expect(form.spineVariable).toBeNull();
    expect(form.spineKeys).toEqual([]);
    // Still a usable form built from goal and flags.
    expect(form.questions.length).toBeGreaterThan(8);
  });

  it("lands near fifteen questions", () => {
    for (const client of [FAT_LOSS, RUNNER_WITH_CALF, FUSION]) {
      const form = buildWeeklyForm(client, { spineVariable: "calories" });
      expect(form.questions.length, `${client.goal}`).toBeGreaterThanOrEqual(12);
      expect(form.questions.length, `${client.goal}`).toBeLessThanOrEqual(WEEKLY_TARGET + 4);
    }
  });

  it("carries the fit section in week 1 on top of everything else", () => {
    const week1 = buildWeeklyForm(FAT_LOSS, { isFirstWeek: true });
    expect(week1.questions.filter((q) => q.category === "fit")).toHaveLength(4);
    expect(week1.questions[0].key).toBe("fasted_weight");
    expect(week1.questions.slice(-2).map((q) => q.key)).toEqual(["accountability", "the_one_thing"]);
  });

  it("never asks the same question twice", () => {
    for (const client of [FAT_LOSS, RUNNER_WITH_CALF, FUSION]) {
      for (const spine of [null, "calories", "training_volume", "run_volume"] as const) {
        const keys = buildWeeklyForm(client, { spineVariable: spine, isFirstWeek: true }).questions.map(
          (q) => q.key,
        );
        expect(new Set(keys).size, `${client.goal} / ${spine}`).toBe(keys.length);
      }
    }
  });

  it("never asks a client about an area they did not flag", () => {
    const form = buildWeeklyForm(FAT_LOSS, { spineVariable: "exercise_swap" });
    expect(form.questions.some((q) => q.category === "injury")).toBe(false);
  });
});

describe("finding the spine", () => {
  it("takes the most recent change from last week", () => {
    const spine = spineFrom(
      [
        { field: "calories", weekNumber: 5, createdAt: "2026-09-14T09:00:00Z" },
        { field: "step_goal", weekNumber: 5, createdAt: "2026-09-14T11:00:00Z" },
        { field: "run_volume", weekNumber: 4, createdAt: "2026-09-07T09:00:00Z" },
      ],
      6,
    );
    expect(spine).toBe("step_goal");
  });

  it("is null when nothing changed last week", () => {
    expect(spineFrom([{ field: "calories", weekNumber: 2, createdAt: "x" }], 6)).toBeNull();
  });

  it("ignores changes from other weeks", () => {
    expect(
      spineFrom([{ field: "calories", weekNumber: 7, createdAt: "x" }], 6),
    ).toBeNull();
  });
});
