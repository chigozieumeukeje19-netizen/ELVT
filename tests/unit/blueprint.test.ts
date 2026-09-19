import { describe, expect, it } from "vitest";
import { deriveBlueprint, INJURY_TO_FLAG, proposeTriggers } from "@/lib/blueprint/derive";
import { readBlueprintPaste, readProgramPaste, unfence } from "@/lib/ai/paste";
import { blueprintDrafterPrompt, contextBlock, VOICE_RULES } from "@/lib/ai/prompts";
import { checkVoice } from "@/lib/ai/voice";
import { FLAG_KEYS } from "@/lib/program/types";
import type { Answers } from "@/lib/questionnaire/answers";

const ANSWERS: Answers = {
  primary_goal: "Recomposition, both at once",
  goal_statement: "Down to 175 without losing the squat",
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
  injury_areas: ["Lower back or spine", "Knee", "None of these"],
  surgery: "L5 S1 fusion in 2021",
  cleared: true,
  tone: "Direct, tell me the number",
  reminder_time: "Early morning",
  checkin_day: "Sunday",
  accountability: 8,
};

describe("deriving the blueprint from the intake", () => {
  it("reads the facts the client stated", () => {
    const derived = deriveBlueprint(ANSWERS);
    expect(derived.goalType).toBe("recomp");
    expect(derived.durationWeeks).toBe(16);
    expect(derived.daysPerWeek).toBe(4);
    expect(derived.sessionMinutes).toBe(60);
    expect(derived.goalWeight).toBe(175);
    expect(derived.tone).toBe("direct");
  });

  it("turns ticked injuries into the flag keys that protect them", () => {
    // This is the mapping that keeps a barbell back squat away from a spinal
    // fusion. If it is wrong, nothing downstream can save the client.
    const derived = deriveBlueprint(ANSWERS);
    expect(derived.flags).toContain("spine");
    expect(derived.flags).toContain("knee");
    expect(derived.flags).toHaveLength(2);
  });

  it("maps every injury option to a flag key that exists", () => {
    for (const [option, flag] of Object.entries(INJURY_TO_FLAG)) {
      expect(FLAG_KEYS, `${option} maps to ${flag}`).toContain(flag);
    }
  });

  it("treats none of these as an answer, not a flag", () => {
    const derived = deriveBlueprint({ ...ANSWERS, injury_areas: ["None of these"] });
    expect(derived.flags).toEqual([]);
  });

  it("carries the medical notes rather than flattening them", () => {
    const derived = deriveBlueprint(ANSWERS);
    expect(derived.medical).toContain("L5 S1 fusion in 2021");
    expect(derived.medical.some((note) => note.includes("current pain"))).toBe(true);
  });

  it("notices the dining facility, because the meal plan has to work from it", () => {
    const derived = deriveBlueprint(ANSWERS);
    expect(derived.constraints.some((c) => c.includes("dining facility"))).toBe(true);
    expect(derived.constraints).toContain("No shellfish");
  });

  it("drops running numbers for someone who does not run", () => {
    // The box can still hold a number from before they answered no.
    const derived = deriveBlueprint({ ...ANSWERS, runs_at_all: false });
    expect(derived.runs).toBe(false);
    expect(derived.weeklyMileage).toBeNull();
    expect(derived.raceDate).toBeNull();
  });

  it("falls back to the house default when the client did not choose a length", () => {
    const derived = deriveBlueprint({ ...ANSWERS, duration_weeks: "Not sure, you decide" });
    expect(derived.durationWeeks).toBe(12);
  });
});

describe("proposed triggers", () => {
  it("sets the step threshold from their own normal, not a round 10,000", () => {
    // 10,000 fires constantly for someone who walks 7,400 and never for
    // someone who walks 15,000.
    const triggers = proposeTriggers(deriveBlueprint(ANSWERS));
    const steps = triggers.find((trigger) => trigger.key === "steps_low")!;
    expect(steps.threshold).toBe(5900);
  });

  it("proposes a pain trigger only when there is a flag", () => {
    expect(
      proposeTriggers(deriveBlueprint(ANSWERS)).some((t) => t.key === "flag_pain"),
    ).toBe(true);
    expect(
      proposeTriggers(deriveBlueprint({ ...ANSWERS, injury_areas: [] })).some(
        (t) => t.key === "flag_pain",
      ),
    ).toBe(false);
  });

  it("proposes a mileage ramp trigger only for a runner", () => {
    expect(
      proposeTriggers(deriveBlueprint({ ...ANSWERS, runs_at_all: false })).some(
        (t) => t.key === "mileage_ramp",
      ),
    ).toBe(false);
  });
});

describe("the prompt", () => {
  it("carries the client's flags and medical notes into the context block", () => {
    const block = contextBlock(deriveBlueprint(ANSWERS));
    expect(block).toContain("spine");
    expect(block).toContain("L5 S1 fusion");
  });

  it("states the voice rules", () => {
    const prompt = blueprintDrafterPrompt(deriveBlueprint(ANSWERS), ANSWERS as Record<string, unknown>);
    expect(prompt).toContain(VOICE_RULES);
    expect(prompt).toContain("No dashes");
  });

  it("includes what the client wrote in their own words", () => {
    const prompt = blueprintDrafterPrompt(deriveBlueprint(ANSWERS), ANSWERS as Record<string, unknown>);
    expect(prompt).toContain("Down to 175 without losing the squat");
  });
});

describe("the voice check", () => {
  it("catches a dash used as punctuation", () => {
    expect(checkVoice("Steps were low - fix that").some((i) => i.rule === "no dashes")).toBe(true);
    expect(checkVoice("Steps were low — fix that").some((i) => i.rule === "no dashes")).toBe(true);
  });

  it("leaves a hyphenated word alone", () => {
    expect(checkVoice("A well-run week at 2,400 calories")).toEqual([]);
  });

  it("catches motivational filler", () => {
    expect(checkVoice("You've got this").some((i) => i.rule === "no motivational filler")).toBe(true);
  });

  // Written out rather than looped over the list they come from. A test that
  // iterates the source it is checking cannot fail when something is removed
  // from it, which is exactly the change worth catching.
  it.each([
    "We will unleash your training",
    "Supercharge your week",
    "Transform your body in twelve weeks",
    "Effortlessly hit your protein",
    "Seamlessly move to week two",
    "Your training, reimagined",
    "Elevate your running",
    "Unlock the power of consistency",
  ])("catches the marketing cliche in %s", (text) => {
    // The audit and this check used to keep their own copies of the list, which
    // meant the audit flagged the checker's copy as copy, and meant a phrase
    // banned in code could still arrive from a model. One list now, and these
    // are the tests that hold the merge together.
    expect(checkVoice(text).some((issue) => issue.rule === "no motivational filler")).toBe(true);
  });

  it.each([
    "Week two. You've got this.",
    "Week two. Crush it.",
    "Week two. Let's go.",
    "Week two. Amazing work.",
    "Week two. Incredible.",
    "Week two of your journey.",
    "Week two. Level up.",
    "Week two. No excuses.",
    "Week two. Trust the process.",
  ])("catches the coaching filler in %s", (text) => {
    expect(checkVoice(text).some((issue) => issue.rule === "no motivational filler")).toBe(true);
  });

  it("catches British spelling", () => {
    expect(checkVoice("Your programme starts Monday").some((i) => i.rule === "US English")).toBe(true);
  });

  it("holds a client message to two to five lines with a question and a number", () => {
    const good = "Steps were 5,200 on Tuesday and Wednesday.\nThat is the second week running.\nWhat gets in the way on those days?";
    expect(checkVoice(good, { isMessage: true })).toEqual([]);

    const noQuestion = "Steps were 5,200 twice.\nHold them at 8,000 this week.";
    expect(checkVoice(noQuestion, { isMessage: true }).some((i) => i.rule === "one real question")).toBe(true);

    const noNumbers = "Steps were low again.\nWhat gets in the way?";
    expect(checkVoice(noNumbers, { isMessage: true }).some((i) => i.rule === "real numbers")).toBe(true);

    const tooLong = Array.from({ length: 7 }, (_, i) => `Line ${i} with 5 in it?`).join("\n");
    expect(checkVoice(tooLong, { isMessage: true }).some((i) => i.rule === "two to five lines")).toBe(true);
  });
});

const GOOD_PASTE = JSON.stringify({
  summary: "Wants to be 175 and still squat. The block is 16 weeks and the fusion decides the lifting.",
  oneThing: "A 20 minute walk after dinner on the days he does not train.",
  failureMode: "Week three, when travel starts. The first sign is steps under 6,000 two days running.",
  toneNotes: "Direct. Give him the number and one question.",
  triggers: [{ key: "whatever", threshold: 1 }],
});

describe("reading the paste", () => {
  it("accepts a clean answer", () => {
    const result = readBlueprintPaste(GOOD_PASTE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.oneThing).toContain("20 minute walk");
  });

  it("accepts an answer wrapped in a code fence, because models do that", () => {
    const result = readBlueprintPaste("```json\n" + GOOD_PASTE + "\n```");
    expect(result.ok).toBe(true);
  });

  it("discards whatever the paste said about triggers", () => {
    // The portal proposes triggers from the client's own numbers. A model
    // inventing thresholds is a model deciding, and it only ever drafts.
    const result = readBlueprintPaste(GOOD_PASTE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.triggers).toEqual([]);
  });

  it("says what is missing rather than failing vaguely", () => {
    const result = readBlueprintPaste(JSON.stringify({ summary: "Just this" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("oneThing");
  });

  it("refuses prose that is not JSON", () => {
    const result = readBlueprintPaste("Here is the blueprint you asked for!");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("not JSON");
  });

  it("warns about a voice rule rather than refusing the whole draft", () => {
    const withDash = JSON.parse(GOOD_PASTE);
    withDash.oneThing = "Walk after dinner - every day";
    const result = readBlueprintPaste(JSON.stringify(withDash));
    expect(result.ok).toBe(true);
    expect(result.warnings.some((issue) => issue.rule === "no dashes")).toBe(true);
  });

  it("unfences without mangling a plain answer", () => {
    expect(unfence('{"a":1}')).toBe('{"a":1}');
    expect(unfence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
});

describe("reading the program rationale paste", () => {
  const weeks = (count: number) =>
    JSON.stringify({
      weeks: Array.from({ length: count }, (_, i) => ({
        week: i + 1,
        rationale: `Week ${i + 1} builds to 3 hard sets.`,
      })),
    });

  it("accepts one line per week", () => {
    expect(readProgramPaste(weeks(12), 12).ok).toBe(true);
  });

  it("refuses a partial answer and says how short it is", () => {
    const result = readProgramPaste(weeks(8), 12);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("8 of 12");
  });

  it("names the week a voice problem is in", () => {
    const parsed = JSON.parse(weeks(3));
    parsed.weeks[1].rationale = "Build volume - then hold it at 3 sets.";
    const result = readProgramPaste(JSON.stringify(parsed), 3);
    expect(result.ok).toBe(true);
    expect(result.warnings[0].detail).toContain("Week 2");
  });
});

import { draftProgram, explainDecision, placementFor } from "@/lib/blueprint/program-draft";
import { PREVIEW_LIBRARY, PREVIEW_TEMPLATE } from "@/lib/design/preview-program";

describe("the program drafter", () => {
  const derived = deriveBlueprint(ANSWERS);

  it("turns the client's stated days into training days and the rest into rest", () => {
    const placement = placementFor(derived);
    // Monday, Tuesday, Thursday, Saturday.
    expect(placement.preferredTrainingDays).toEqual([1, 2, 4, 6]);
    expect(placement.restDays).toEqual([0, 3, 5]);
  });

  it("carries the flags into the placement, which is what keeps the client safe", () => {
    expect(placementFor(derived).flags).toEqual({ spine: true, knee: true });
  });

  it("turns off running placement for someone who does not run", () => {
    const placement = placementFor(deriveBlueprint({ ...ANSWERS, runs_at_all: false }));
    expect(placement.runningEnabled).toBe(false);
    expect(placement.preferredLongRunDay).toBeNull();
  });

  it("explains a substitution by naming the flag, not the enum", () => {
    const explained = explainDecision(
      {
        kind: "substitution",
        slot: "squat",
        from: "Barbell Back Squat",
        to: "Goblet Squat",
        cause: "injury",
        reason: "The first choice is ruled out by one of this client's flags.",
      },
      derived,
    );
    expect(explained.explanation).toContain("Barbell Back Squat");
    expect(explained.explanation).toContain("Goblet Squat");
    // The squat pattern can be ruled out by knee or spine, and this client has
    // both, so the sentence names both rather than saying "a contraindication".
    expect(explained.explanation).toContain("knee");
    expect(explained.explanation).toContain("spine");
  });

  it("explains an equipment substitution differently from an injury one", () => {
    const equipment = explainDecision(
      {
        kind: "substitution",
        slot: "squat",
        from: "Barbell Back Squat",
        to: "Goblet Squat",
        cause: "equipment",
        reason: "Not in this client's equipment list.",
      },
      derived,
    );
    expect(equipment.explanation).toContain("equipment");
    expect(equipment.explanation).not.toContain("flag");
  });

  it("explains every decision the applier made, with nothing left as a log line", () => {
    const draft = draftProgram({
      derived,
      template: PREVIEW_TEMPLATE,
      library: PREVIEW_LIBRARY,
      startDate: "2026-09-21",
    });

    expect(draft.explained).toHaveLength(draft.program.decisions.length);
    for (const explained of draft.explained) {
      expect(explained.explanation.trim().length).toBeGreaterThan(20);
      // A raw enum reaching a coach's screen is the tell that something went
      // straight from the engine to the reader.
      expect(explained.explanation).not.toMatch(/\b[a-z]{2,}_[a-z][a-z_]*\b/);
    }
  });

  it("explains a real substitution by its flag, not as an equipment problem", () => {
    // The applier filters its pool on flags and nothing else, so every
    // substitution it makes is an injury one. An explanation that said
    // "equipment" would be telling a coach the wrong thing about a safety
    // decision, which is the bug this catches.
    const draft = draftProgram({
      derived,
      template: PREVIEW_TEMPLATE,
      library: PREVIEW_LIBRARY,
      startDate: "2026-09-21",
    });

    const subs = draft.explained.filter((entry) => entry.kind === "substitution");
    expect(subs.length).toBeGreaterThan(0);
    for (const sub of subs) {
      expect(sub.explanation).toContain("flag");
      expect(sub.explanation).not.toContain("equipment");
    }
  });

  it("builds as many weeks as the blueprint asked for", () => {
    const draft = draftProgram({
      derived,
      template: PREVIEW_TEMPLATE,
      library: PREVIEW_LIBRARY,
      startDate: "2026-09-21",
    });
    expect(draft.program.weeks).toHaveLength(derived.durationWeeks);
  });

  it("never puts a contraindicated movement in the block", () => {
    // The whole reason the flags are derived rather than drafted.
    const draft = draftProgram({
      derived,
      template: PREVIEW_TEMPLATE,
      library: PREVIEW_LIBRARY,
      startDate: "2026-09-21",
    });

    const banned = PREVIEW_LIBRARY.filter((exercise) =>
      exercise.contraindications.some((flag) => derived.flags.includes(flag)),
    ).map((exercise) => exercise.name);

    const used = draft.program.weeks.flatMap((week) =>
      week.days.flatMap((day) =>
        day.sessions.flatMap((session) => session.exercises.map((exercise) => exercise.name)),
      ),
    );

    for (const name of banned) {
      expect(used, `${name} reached a client with ${derived.flags.join(" and ")}`).not.toContain(name);
    }
  });
});
