import { describe, expect, it } from "vitest";
import {
  adherenceLines,
  applyDecisions,
  cardSeverity,
  pinSpine,
  undecided,
  WEIGHT_WRONG_WAY,
  type CheckinAnswer,
  type ProposedChange,
} from "@/lib/queue/review-card";
import { BAND_THRESHOLDS } from "@/lib/design/bands";

const ADHERENCE = {
  training: { done: 3, planned: 3 },
  run: { done: 1, planned: 2 },
  calories: { done: 5, planned: 7 },
  steps: { done: 3, planned: 7 },
  recovery: { done: 0, planned: 0 },
};

describe("the adherence lines", () => {
  it("shows the five categories in a fixed order", () => {
    expect(adherenceLines(ADHERENCE).map((line) => line.key)).toEqual([
      "training", "run", "calories", "steps", "recovery",
    ]);
  });

  it("gives no band to a category with nothing planned", () => {
    // A client with no recovery work programmed is not failing at recovery,
    // and coloring it red sends the coach after a problem that does not exist.
    const recovery = adherenceLines(ADHERENCE).find((line) => line.key === "recovery")!;
    expect(recovery.planned).toBe(0);
    expect(recovery.percent).toBeNull();
    expect(recovery.band).toBeNull();
  });

  it("reads the bands from the same thresholds the roster uses", () => {
    const lines = adherenceLines(ADHERENCE);
    expect(lines.find((line) => line.key === "training")!.band).toBe("ok");
    // 5 of 7 is 71, between the two thresholds.
    expect(lines.find((line) => line.key === "calories")!.band).toBe("watch");
    // 3 of 7 is 43.
    expect(lines.find((line) => line.key === "steps")!.band).toBe("flag");
    expect(BAND_THRESHOLDS.ok).toBe(85);
  });

  it("keeps the fraction, not just the percentage", () => {
    // Lifts 3/3 and runs 1/2 is what a coach reads. Both being 50 percent and
    // 100 percent loses which of them was one session.
    const run = adherenceLines(ADHERENCE).find((line) => line.key === "run")!;
    expect(run.done).toBe(1);
    expect(run.planned).toBe(2);
  });
});

const ANSWERS: CheckinAnswer[] = [
  { key: "fasted_weight", question: "Fasted weight", answer: "189.8", isSpine: false },
  { key: "adherence", question: "How closely did you follow the plan?", answer: "6", isSpine: false },
  { key: "hunger", question: "How hungry were you this week?", answer: "8", isSpine: true },
  { key: "biggest_win", question: "Biggest win", answer: "Three sessions done", isSpine: false },
];

describe("the check-in on the card", () => {
  it("pins the spine question to the top", () => {
    // It is the one that says whether last Monday's change worked, so it is
    // never somewhere in the middle of fifteen.
    expect(pinSpine(ANSWERS)[0].key).toBe("hunger");
  });

  it("leaves the rest in the order they were asked", () => {
    expect(pinSpine(ANSWERS).slice(1).map((answer) => answer.key)).toEqual([
      "fasted_weight", "adherence", "biggest_win",
    ]);
  });

  it("changes nothing when there is no spine", () => {
    const none = ANSWERS.map((answer) => ({ ...answer, isSpine: false }));
    expect(pinSpine(none).map((a) => a.key)).toEqual(none.map((a) => a.key));
  });
});

const CHANGES: ProposedChange[] = [
  {
    id: "c1", field: "calories", label: "Calories", from: "2550", to: "2450",
    reason: "Hunger at 8 and weight flat for two weeks.", decision: "accept",
  },
  {
    id: "c2", field: "planned_mileage", label: "Mileage", from: "24", to: "28",
    reason: "Legs fresh and the ramp has room.", decision: "edit", editedTo: "26",
  },
  {
    id: "c3", field: "protein", label: "Protein", from: "190", to: "200",
    reason: "Protein days 5 of 7.", decision: "reject",
  },
  {
    id: "c4", field: "step_goal", label: "Steps", from: "7400", to: "8000",
    reason: "Steps 3 of 7.", decision: "pending",
  },
];

describe("applying the diff", () => {
  it("takes accepted and edited lines and drops rejected ones", () => {
    const applied = applyDecisions(CHANGES);
    expect(applied.map((change) => change.field)).toEqual(["calories", "planned_mileage"]);
  });

  it("uses the coach's value on an edited line, not the drafted one", () => {
    const mileage = applyDecisions(CHANGES).find((c) => c.field === "planned_mileage")!;
    expect(mileage.to).toBe("26");
  });

  it("records an edited line as ai_edited, not ai_accepted", () => {
    // A change the coach rewrote is not a change the machine got right, and the
    // difference is the only way to tell later whether the drafting is useful.
    const applied = applyDecisions(CHANGES);
    expect(applied.find((c) => c.field === "calories")!.source).toBe("ai_accepted");
    expect(applied.find((c) => c.field === "planned_mileage")!.source).toBe("ai_edited");
  });

  it("leaves a pending line out, because pending is not accepted", () => {
    expect(applyDecisions(CHANGES).some((c) => c.field === "step_goal")).toBe(false);
    expect(undecided(CHANGES).map((c) => c.id)).toEqual(["c4"]);
  });

  it("applies nothing when everything was rejected", () => {
    expect(applyDecisions(CHANGES.map((c) => ({ ...c, decision: "reject" as const })))).toEqual([]);
  });

  it("carries the reason through, because it becomes the spine record", () => {
    expect(applyDecisions(CHANGES)[0].reason).toContain("Hunger at 8");
  });
});

describe("how far up the list a card sits", () => {
  it("puts a fired flag above everything", () => {
    expect(cardSeverity({ score: 95, flags: 1, weightChange: 0, losingWeight: true })).toBe(5);
  });

  it("uses the same bands the roster colors use", () => {
    expect(cardSeverity({ score: 40, flags: 0, weightChange: null, losingWeight: true })).toBe(4);
    expect(cardSeverity({ score: 70, flags: 0, weightChange: null, losingWeight: true })).toBe(3);
    expect(cardSeverity({ score: 95, flags: 0, weightChange: null, losingWeight: true })).toBe(2);
  });

  it("raises a card where weight went the wrong way", () => {
    const gaining = cardSeverity({
      score: 95, flags: 0, weightChange: WEIGHT_WRONG_WAY + 0.1, losingWeight: true,
    });
    expect(gaining).toBe(3);
  });

  it("knows which way is wrong for the client", () => {
    // The same number is good news for someone gaining and bad for someone
    // losing. A card that flags a muscle gain client for putting weight on has
    // not read their blueprint.
    const forGainer = cardSeverity({
      score: 95, flags: 0, weightChange: 1, losingWeight: false,
    });
    expect(forGainer).toBe(2);

    const gainerLosing = cardSeverity({
      score: 95, flags: 0, weightChange: -1, losingWeight: false,
    });
    expect(gainerLosing).toBe(3);
  });

  it("leaves a good week near the bottom", () => {
    expect(cardSeverity({ score: 92, flags: 0, weightChange: -0.4, losingWeight: true })).toBe(2);
  });
});
