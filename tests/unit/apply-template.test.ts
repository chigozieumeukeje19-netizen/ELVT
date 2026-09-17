import { describe, expect, it } from "vitest";
import {
  TemplateApplyError,
  applyTemplate,
  assertProgramIsSafe,
  isHard,
  safePool,
  sameStimulus,
  type MaterializedProgram,
} from "@/lib/program/apply-template";
import { LIBRARY, PLACEMENTS, START_DATE, TEMPLATE } from "../fixtures/program";

function build(slug: keyof typeof PLACEMENTS, weeks = 12): MaterializedProgram {
  return applyTemplate({
    template: TEMPLATE,
    placement: PLACEMENTS[slug],
    library: LIBRARY,
    startDate: START_DATE,
    weeks,
  });
}

const allSessions = (program: MaterializedProgram) =>
  program.weeks.flatMap((w) => w.days.flatMap((d) => d.sessions));

const allExercises = (program: MaterializedProgram) =>
  allSessions(program).flatMap((s) => s.exercises);

// ---------------------------------------------------------------------------
// Rule 1. Contraindicated movements are removed for that client's flags.
// ---------------------------------------------------------------------------

describe("rule 1: contraindications", () => {
  it("keeps every movement a flag rules out off the client's program", () => {
    for (const slug of Object.keys(PLACEMENTS) as (keyof typeof PLACEMENTS)[]) {
      const placement = PLACEMENTS[slug];
      const active = Object.entries(placement.flags)
        .filter(([, on]) => on)
        .map(([key]) => key);

      for (const exercise of allExercises(build(slug))) {
        const source = LIBRARY.find((e) => e.id === exercise.exerciseId)!;
        for (const flag of active) {
          expect(
            source.contraindications,
            `${slug} was given ${source.name}, which is ruled out by ${flag}`,
          ).not.toContain(flag);
        }
      }
    }
  });

  it("substitutes rather than dropping when a declared swap is safe", () => {
    const program = build("priya-raghavan");
    const names = allExercises(program).map((e) => e.name);

    // Knee rules out the back squat. Goblet Squat is its declared injury swap.
    expect(names).not.toContain("Barbell Back Squat");
    expect(names).toContain("Goblet Squat");

    const substitution = program.decisions.find(
      (d) => d.kind === "substitution" && d.to === "Goblet Squat",
    );
    expect(substitution).toBeDefined();
  });

  it("records a dropped slot rather than quietly giving nothing", () => {
    // Knee rules out both the walking lunge and the leg press, and no other
    // lunge pattern exists in the library.
    const program = build("priya-raghavan");
    const dropped = program.decisions.filter((d) => d.kind === "slot_dropped");
    expect(dropped.length).toBeGreaterThan(0);
    expect(dropped[0]).toHaveProperty("reason");
  });

  it("builds the safe pool from the flags, not from the slot", () => {
    const pool = safePool(LIBRARY, PLACEMENTS["caleb-whitlock"]);
    const names = pool.map((e) => e.name);
    expect(names).not.toContain("Barbell Back Squat"); // knee and spine
    expect(names).not.toContain("Romanian Deadlift"); // spine
    expect(names).not.toContain("Dumbbell Bench Press"); // shoulder
    expect(names).not.toContain("Walking Lunge"); // knee
    expect(names).toContain("Hip Thrust");
  });
});

// ---------------------------------------------------------------------------
// THE PERMANENT ASSERTION
// ---------------------------------------------------------------------------

describe("the spine flagged client never receives a barbell back squat", () => {
  /**
   * This is the assertion the whole contraindication mechanism exists to make
   * true, and it stays in the suite permanently. Twelve weeks is 84 days, and
   * every one of them is checked.
   *
   * The library used here deliberately contains a barbell back squat, and the
   * template deliberately asks for one by name. A pass means the applier
   * refused it, not that it was never offered.
   */
  const program = build("nadia-brookes", 12);

  it("covers all 84 days", () => {
    const days = program.weeks.flatMap((w) => w.days);
    expect(days).toHaveLength(84);
  });

  it("never once across those 84 days", () => {
    const offenders: string[] = [];

    for (const week of program.weeks) {
      for (const day of week.days) {
        for (const session of day.sessions) {
          for (const exercise of session.exercises) {
            const name = exercise.name.toLowerCase();
            if (name.includes("back squat") || exercise.exerciseId === "back-squat") {
              offenders.push(`${day.date} ${session.name} ${exercise.name}`);
            }
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("and never anything else loaded through the spine", () => {
    const names = allExercises(program).map((e) => e.name);
    expect(names).not.toContain("Romanian Deadlift");
  });

  it("but still gets a squat pattern, substituted", () => {
    // Removing the movement is not the same as removing the training.
    const names = allExercises(program).map((e) => e.name);
    expect(names).toContain("Goblet Squat");
  });
});

// ---------------------------------------------------------------------------
// Rule 2. Preferred training days.
// ---------------------------------------------------------------------------

describe("rule 2: preferred training days", () => {
  it("puts every session on a day the client chose", () => {
    for (const slug of Object.keys(PLACEMENTS) as (keyof typeof PLACEMENTS)[]) {
      const placement = PLACEMENTS[slug];
      const program = build(slug);
      const relaxed = program.decisions.some((d) => d.kind === "day_relaxed");
      if (relaxed) continue;

      for (const week of program.weeks) {
        for (const day of week.days) {
          if (day.sessions.length === 0) continue;
          expect(
            placement.preferredTrainingDays,
            `${slug} has a session on day ${day.dayOfWeek}`,
          ).toContain(day.dayOfWeek);
        }
      }
    }
  });

  it("says so when it had to widen past them", () => {
    // Every relaxation is recorded, so a coach is never surprised by a session
    // on a day the client did not pick.
    for (const slug of Object.keys(PLACEMENTS) as (keyof typeof PLACEMENTS)[]) {
      const program = build(slug);
      for (const decision of program.decisions) {
        if (decision.kind === "day_relaxed") {
          expect(decision.reason.length).toBeGreaterThan(20);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Rule 3. The long run lands on the client's chosen day.
// ---------------------------------------------------------------------------

describe("rule 3: the long run", () => {
  it("lands on the day the client chose", () => {
    const placement = PLACEMENTS["theo-vance"];
    const program = build("theo-vance");

    let found = 0;
    for (const week of program.weeks) {
      for (const day of week.days) {
        for (const session of day.sessions) {
          if (session.key !== "long-run") continue;
          found += 1;
          expect(day.dayOfWeek).toBe(placement.preferredLongRunDay);
        }
      }
    }

    expect(found).toBe(program.weeks.length);
  });

  it("does not appear at all for a client with running switched off", () => {
    const program = build("nadia-brookes");
    expect(allSessions(program).map((s) => s.key)).not.toContain("long-run");
  });
});

// ---------------------------------------------------------------------------
// Rule 4. Never two hard same-stimulus days back to back.
// ---------------------------------------------------------------------------

describe("rule 4: hard day spacing", () => {
  it("never puts two hard sessions of the same kind on consecutive days", () => {
    for (const slug of Object.keys(PLACEMENTS) as (keyof typeof PLACEMENTS)[]) {
      const days = build(slug).weeks.flatMap((w) => w.days);

      for (let i = 0; i < days.length - 1; i += 1) {
        for (const a of days[i].sessions) {
          for (const b of days[i + 1].sessions) {
            expect(
              sameStimulus(a.stimulus, b.stimulus),
              `${slug}: ${days[i].date} ${a.stimulus} then ${days[i + 1].date} ${b.stimulus}`,
            ).toBe(false);
          }
        }
      }
    }
  });

  it("never puts two hard sessions on the same day", () => {
    for (const slug of Object.keys(PLACEMENTS) as (keyof typeof PLACEMENTS)[]) {
      for (const week of build(slug).weeks) {
        for (const day of week.days) {
          const hard = day.sessions.filter((s) => isHard(s.stimulus));
          expect(hard.length, `${slug} ${day.date}`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("treats a long run and a hard run as the same tissue", () => {
    expect(sameStimulus("long_run", "hard_run")).toBe(true);
    expect(sameStimulus("lower_strength", "full_strength")).toBe(true);
    expect(sameStimulus("easy_run", "hard_run")).toBe(false);
    expect(sameStimulus("lower_strength", "upper_strength")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rule 5. Lifting caps at three when a combat sport is present.
// ---------------------------------------------------------------------------

describe("rule 5: the combat sport cap", () => {
  it("caps lifting at three sessions a week", () => {
    const program = build("marcus-oyelaran");
    const firstWeek = program.weeks[0];
    const lifts = firstWeek.days
      .flatMap((d) => d.sessions)
      .filter((s) => s.kind === "strength");

    expect(lifts.length).toBeLessThanOrEqual(3);
  });

  it("says why it cut one", () => {
    const program = build("marcus-oyelaran");
    const cap = program.decisions.find((d) => d.kind === "lift_cap");
    expect(cap).toBeDefined();
    expect(cap).toMatchObject({ from: 4, to: 3 });
  });

  it("leaves the cap off for a client with no combat sport", () => {
    const program = build("theo-vance");
    const cap = program.decisions.find((d) => d.kind === "lift_cap");
    expect(cap).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Rule 6. Rest days are honored.
// ---------------------------------------------------------------------------

describe("rule 6: rest days", () => {
  it("never puts a session on a rest day", () => {
    for (const slug of Object.keys(PLACEMENTS) as (keyof typeof PLACEMENTS)[]) {
      const placement = PLACEMENTS[slug];
      for (const week of build(slug).weeks) {
        for (const day of week.days) {
          if (!placement.restDays.includes(day.dayOfWeek)) continue;
          expect(day.sessions, `${slug} ${day.date}`).toHaveLength(0);
          expect(day.isRest).toBe(true);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

describe("the materialized program", () => {
  it("marks the deload weeks the template asked for", () => {
    const program = build("theo-vance", 12);
    const deloads = program.weeks.filter((w) => w.isDeload).map((w) => w.weekNumber);
    expect(deloads).toEqual([4, 8, 12]);
  });

  it("produces seven days for every week", () => {
    for (const week of build("theo-vance", 12).weeks) {
      expect(week.days).toHaveLength(7);
    }
  });

  it("is deterministic, so the same client and template give the same program", () => {
    const a = JSON.stringify(build("caleb-whitlock"));
    const b = JSON.stringify(build("caleb-whitlock"));
    expect(a).toBe(b);
  });

  it("marks every generated session as coming from the template", () => {
    // Re-applying a template later only touches these, never a session the
    // coach has edited.
    for (const session of allSessions(build("theo-vance"))) {
      expect(session.fromTemplate).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Controls
//
// The tests above pass if the applier refuses the movement. They would also
// pass if the template never asked for it, which would make the whole suite
// meaningless. These prove the mechanism is doing the work.
// ---------------------------------------------------------------------------

describe("controls: the safety tests are actually testing something", () => {
  const unflagged = {
    preferredTrainingDays: [1, 2, 4, 5],
    preferredLongRunDay: null,
    restDays: [0, 3],
    flags: {},
    combatSport: false,
    runningEnabled: false,
  };

  it("a client with no flags does receive the barbell back squat", () => {
    const program = applyTemplate({
      template: TEMPLATE,
      placement: unflagged,
      library: LIBRARY,
      startDate: START_DATE,
      weeks: 12,
    });

    const names = allExercises(program).map((e) => e.name);
    expect(names).toContain("Barbell Back Squat");
  });

  it("the library really does carry the movement, with the spine flag on it", () => {
    const squat = LIBRARY.find((e) => e.name === "Barbell Back Squat");
    expect(squat).toBeDefined();
    expect(squat!.contraindications).toContain("spine");
  });

  it("the template really does ask for it by name", () => {
    const asked = TEMPLATE.sessions
      .flatMap((s) => s.workout?.sections ?? [])
      .flatMap((section) => section.exercises)
      .some((e) => e.slot.preferred === "Barbell Back Squat");
    expect(asked).toBe(true);
  });

  it("the invariant check throws when handed an unsafe program", () => {
    const program = applyTemplate({
      template: TEMPLATE,
      placement: unflagged,
      library: LIBRARY,
      startDate: START_DATE,
      weeks: 1,
    });

    // The spine client's safe pool, applied to a program built without flags.
    const spinePool = new Set(
      safePool(LIBRARY, PLACEMENTS["nadia-brookes"]).map((e) => e.id),
    );

    expect(() =>
      assertProgramIsSafe(program.weeks, PLACEMENTS["nadia-brookes"], spinePool),
    ).toThrow(TemplateApplyError);
  });

  it("the invariant check throws on a session placed on a rest day", () => {
    const program = applyTemplate({
      template: TEMPLATE,
      placement: unflagged,
      library: LIBRARY,
      startDate: START_DATE,
      weeks: 1,
    });

    const allIds = new Set(LIBRARY.map((e) => e.id));
    const everyDayIsRest = { ...unflagged, restDays: [0, 1, 2, 3, 4, 5, 6] };

    expect(() =>
      assertProgramIsSafe(program.weeks, everyDayIsRest, allIds),
    ).toThrow(/rest day/);
  });
});
