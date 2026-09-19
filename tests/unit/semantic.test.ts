import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BAND_THRESHOLDS } from "@/lib/design/bands";
import {
  absent,
  adherence,
  checkin,
  count,
  EM_DASH,
  FIGURE_STATES,
  figureClass,
  fired,
  neutral,
  percentage,
  score,
  STATE_LABELS,
  touchpoints,
  trend,
  goalDirectionFor,
  weight,
} from "@/lib/design/semantic";

/**
 * The adherence semantic, DESIGN_V2.md Section 2.4.
 *
 * A correctness rule before it is a color rule. Each of these held a real
 * defect in the build before the helper existed, and each one is a thing a
 * coach would have acted on.
 */

describe("absent is not zero", () => {
  it("renders an em dash and says what is missing and when", () => {
    const figure = absent("Their next weigh-in is Monday morning");

    expect(figure.state).toBe("absent");
    expect(figure.display).toBe(EM_DASH);
    expect(figure.waitingFor).toContain("Monday");
  });

  it("takes no color", () => {
    expect(figureClass(absent("soon").state)).not.toMatch(/text-(ok|watch|flag)/);
  });

  it("is what a score with no closed week reads as", () => {
    // A client in week one has no score rather than a score of zero, and the
    // difference is the whole first week.
    const figure = score(null);
    expect(figure.state).toBe("absent");
    expect(figure.waitingFor).toBeTruthy();
  });
});

describe("nothing planned is not a failure", () => {
  it("scores a category with no prescription as neutral", () => {
    // Zero percent says the client missed everything. Nothing planned says
    // nobody asked them for anything.
    const figure = adherence(0, 0);

    expect(figure.state).toBe("neutral");
    expect(figure.label).toBe("Nothing planned");
    expect(figure.display).toBe(EM_DASH);
  });

  it("still bands a category that was planned and missed", () => {
    expect(adherence(0, 4).state).toBe("flag");
  });

  it("reads the fraction, not a percentage", () => {
    // "3 of 7" is what the coach acts on. A percentage hides the denominator.
    expect(adherence(3, 7).display).toBe("3 of 7");
  });
});

describe("the bands", () => {
  it("come from one place", () => {
    expect(percentage(BAND_THRESHOLDS.ok, "x").state).toBe("ok");
    expect(percentage(BAND_THRESHOLDS.ok - 1, "x").state).toBe("watch");
    expect(percentage(BAND_THRESHOLDS.watch, "x").state).toBe("watch");
    expect(percentage(BAND_THRESHOLDS.watch - 1, "x").state).toBe("flag");
  });

  it("names no threshold of its own", () => {
    // Every consumer reads bands.ts. A literal here would let the queue and
    // the roster disagree about the same client.
    const source = readFileSync("src/lib/design/semantic.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*\/\/.*$/gm, " ");
    expect(source).not.toMatch(/[<>]=?\s*(?:85|60)\b/);
  });
});

describe("a weight figure", () => {
  it("is neutral with no goal direction on the blueprint", () => {
    // Named in the spec because it was wrong: the roster colored a stalled
    // weight amber for every client.
    const figure = weight(176.4, -0.1, null);

    expect(figure.state).toBe("neutral");
    expect(figure.label).toContain("goal direction");
  });

  it("is on plan when it moves the way the blueprint asks", () => {
    expect(weight(176.4, -1.2, "down").state).toBe("ok");
    expect(weight(176.4, 1.2, "up").state).toBe("ok");
  });

  it("is flagged only when it moves the wrong way", () => {
    expect(weight(176.4, 1.2, "down").state).toBe("flag");
    expect(weight(176.4, -1.2, "up").state).toBe("flag");
  });

  it("calls standing still drifting, not failing", () => {
    expect(weight(176.4, 0.1, "down").state).toBe("watch");
  });

  it("counts standing still as on plan when holding is the goal", () => {
    // A client whose goal is to hold their weight is hitting the target when
    // the number does not move, and the old roster flagged exactly that.
    expect(weight(176.4, 0.1, "hold").state).toBe("ok");
    expect(weight(176.4, 2.0, "hold").state).toBe("watch");
  });

  it("is absent with no reading at all", () => {
    expect(weight(null, null, "down").state).toBe("absent");
  });

  it("carries the unit the client reads in", () => {
    expect(weight(176.4, null, null).display).toBe("176.4 lb");
    expect(weight(80.1, null, null, "metric").display).toBe("80.1 kg");
  });
});

describe("a count", () => {
  it("is never colored", () => {
    // A number with no target is a measurement. Coloring measurements is how
    // a screen ends up with eleven colored things and no signal.
    for (const value of [0, 1, 99]) {
      expect(count(value, "x").state).toBe("neutral");
    }
  });

  it("is absent rather than zero when there is no reading", () => {
    expect(count(null, "Nothing logged yet").state).toBe("absent");
  });
});

describe("contact with the client", () => {
  it("does not flag a client who has no program yet", () => {
    // Before there is a program there is nothing to be behind on. A client
    // added on Friday had been reading as flagged all weekend.
    const figure = touchpoints(0, null, { target: 1, strong: 2, hasProgram: false });

    expect(figure.state).toBe("neutral");
    expect(figure.label).toBe("Not started yet");
  });

  it("flags a running client nobody has spoken to", () => {
    expect(touchpoints(0, 9, { target: 1, strong: 2, hasProgram: true }).state).toBe("flag");
  });

  it("bands against the target", () => {
    expect(touchpoints(1, 2, { target: 1, strong: 2, hasProgram: true }).state).toBe("watch");
    expect(touchpoints(2, 1, { target: 1, strong: 2, hasProgram: true }).state).toBe("ok");
  });

  it("says in words what the color says", () => {
    expect(touchpoints(0, 9, { target: 1, strong: 2, hasProgram: true }).label).toContain(
      "reached them",
    );
  });
});

describe("a check-in", () => {
  it("is absent before they have ever been asked", () => {
    expect(checkin(null, 8).state).toBe("absent");
  });

  it("is due today on the day, and overdue after it", () => {
    expect(checkin(7, 8).state).toBe("neutral");
    expect(checkin(8, 8).state).toBe("watch");
    expect(checkin(9, 8).state).toBe("flag");
  });
});

describe("a trend", () => {
  it("is drifting at worst, never flagged", () => {
    // One bad week is noise and two is a signal. Flagged is reserved for
    // something that actually happened.
    expect(trend(false, "up 0.4", "down").state).toBe("watch");
    expect(trend(true, "down 0.4", "down").state).toBe("ok");
  });

  it("is neutral with no goal direction", () => {
    expect(trend(true, "up 0.4", null).state).toBe("neutral");
  });

  it("is neutral with too few readings", () => {
    expect(trend(null, "0.0", "down").state).toBe("neutral");
  });
});

describe("a fired trigger", () => {
  it("is the one thing a count may be flagged for", () => {
    expect(fired(2, "triggers fired").state).toBe("flag");
    expect(fired(0, "triggers fired").state).toBe("neutral");
  });
});

describe("every figure", () => {
  it("says its state in words, so color is never the only carrier", () => {
    const figures = [
      absent("soon"),
      neutral("4"),
      adherence(4, 4),
      adherence(0, 4),
      score(74),
      weight(176.4, -1.2, "down"),
      touchpoints(0, 9, { target: 1, strong: 2, hasProgram: true }),
      checkin(9, 8),
      trend(false, "up", "down"),
      fired(1, "triggers fired"),
    ];

    for (const figure of figures) {
      expect(figure.label.trim().length, JSON.stringify(figure)).toBeGreaterThan(0);
      expect(figure.display.trim().length).toBeGreaterThan(0);
    }
  });

  it("resolves to exactly one of the five states", () => {
    expect([...FIGURE_STATES]).toEqual(["absent", "neutral", "ok", "watch", "flag"]);
    for (const state of FIGURE_STATES) {
      expect(STATE_LABELS[state], state).toBeTruthy();
      expect(figureClass(state), state).toBeTruthy();
    }
  });

  it("only ever earns green from a real threshold", () => {
    // Green is earned, never a default. Nothing that lacks a threshold may
    // come back on plan.
    expect(neutral("4").state).not.toBe("ok");
    expect(absent("soon").state).not.toBe("ok");
    expect(adherence(0, 0).state).not.toBe("ok");
    expect(count(99, "x").state).not.toBe("ok");
    expect(weight(176.4, -5, null).state).not.toBe("ok");
  });
});

describe("the goal direction", () => {
  it("comes from the goal type, in one place", () => {
    expect(goalDirectionFor("fat_loss")).toBe("down");
    expect(goalDirectionFor("muscle_gain")).toBe("up");
    expect(goalDirectionFor("recomp")).toBe("hold");
  });

  it("says nothing for a goal that says nothing about weight", () => {
    // Race prep, a fitness test and a return to training are not about the
    // scale, so a weight figure for one of them takes no color at all.
    for (const goal of ["race_prep", "fitness_test", "return_to_training", null]) {
      expect(goalDirectionFor(goal), String(goal)).toBeNull();
    }
  });
});
