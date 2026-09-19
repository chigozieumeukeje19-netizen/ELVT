import { describe, expect, it } from "vitest";
import { fill, holesIn, QUICK_REPLIES } from "@/lib/messages/quick-replies";
import { decideSends, instantFor, STALE_AFTER_HOURS } from "@/lib/messages/schedule";
import {
  countTouchpoints,
  quietestFirst,
  STRONG_WEEK,
  weekStart,
  WEEKLY_TARGET,
} from "@/lib/messages/touchpoints";
import { checkVoice } from "@/lib/ai/voice";

describe("the quick replies", () => {
  it("declares exactly the holes it contains", () => {
    // A declared variable that is not in the body would never be asked for, and
    // a hole that is not declared would never be filled.
    for (const template of QUICK_REPLIES) {
      expect(holesIn(template.body).sort(), template.key).toEqual([...template.variables].sort());
    }
  });

  it("follows the voice rules once filled", () => {
    for (const template of QUICK_REPLIES) {
      const values = Object.fromEntries(template.variables.map((name) => [name, "7"]));
      const result = fill(template, values);
      expect(result.ok, template.key).toBe(true);
      if (!result.ok) continue;

      // Two to five lines, one question, real numbers, no dashes, US English.
      expect(checkVoice(result.body, { isMessage: true }), template.key).toEqual([]);
    }
  });

  it("names a missing value rather than leaving a hole", () => {
    // A message reading "Steps were  then  against your usual" is worse than no
    // message. One where the number silently became 0 is worse still.
    const steps = QUICK_REPLIES.find((template) => template.key === "steps_two_days")!;
    const result = fill(steps, { steps_a: 5200 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual(["steps_b", "step_goal"]);
  });

  it("treats an empty string as missing", () => {
    const steps = QUICK_REPLIES.find((template) => template.key === "steps_two_days")!;
    expect(fill(steps, { steps_a: 5200, steps_b: "", step_goal: 7400 }).ok).toBe(false);
  });

  it("puts the real numbers in", () => {
    const steps = QUICK_REPLIES.find((template) => template.key === "steps_two_days")!;
    const result = fill(steps, { steps_a: 5200, steps_b: 4800, step_goal: 7400 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toContain("5200");
    expect(result.body).toContain("4800");
    expect(result.body).toContain("7400");
    expect(result.body).not.toContain("{");
  });
});

const NY = "America/New_York";

describe("scheduled sends", () => {
  it("does not send before it is due", () => {
    const decisions = decideSends(
      [{ id: "m1", clientId: "c1", timezone: NY, scheduledFor: "2026-09-21T12:00:00Z", sentAt: null }],
      new Date("2026-09-21T11:00:00Z"),
    );
    expect(decisions[0].send).toBe(false);
    expect(decisions[0].reason).toContain("Not due");
  });

  it("sends when it is due", () => {
    const decisions = decideSends(
      [{ id: "m1", clientId: "c1", timezone: NY, scheduledFor: "2026-09-21T12:00:00Z", sentAt: null }],
      new Date("2026-09-21T12:00:00Z"),
    );
    expect(decisions[0].send).toBe(true);
  });

  it("does not send the same message twice", () => {
    const decisions = decideSends(
      [{
        id: "m1", clientId: "c1", timezone: NY,
        scheduledFor: "2026-09-21T12:00:00Z", sentAt: "2026-09-21T12:00:03Z",
      }],
      new Date("2026-09-21T13:00:00Z"),
    );
    expect(decisions[0].send).toBe(false);
  });

  it("leaves a stale message unsent rather than waking a client at 3am", () => {
    // The dispatcher was down overnight. Yesterday's 7am nudge is not worth
    // sending now, and a stale nudge costs more trust than a missing one.
    const decisions = decideSends(
      [{ id: "m1", clientId: "c1", timezone: NY, scheduledFor: "2026-09-21T11:00:00Z", sentAt: null }],
      new Date(`2026-09-21T${11 + STALE_AFTER_HOURS + 1}:00:00Z`),
    );
    expect(decisions[0].send).toBe(false);
    expect(decisions[0].reason).toContain("late");
  });

  it("still sends one that is only a little late", () => {
    const decisions = decideSends(
      [{ id: "m1", clientId: "c1", timezone: NY, scheduledFor: "2026-09-21T12:00:00Z", sentAt: null }],
      new Date("2026-09-21T13:30:00Z"),
    );
    expect(decisions[0].send).toBe(true);
  });
});

describe("turning a local time into an instant", () => {
  it("resolves a summer morning in New York", () => {
    // 07:00 on 21 September in New York is 11:00 UTC, because it is UTC-4.
    expect(instantFor("2026-09-21", "07:00", NY).toISOString()).toBe("2026-09-21T11:00:00.000Z");
  });

  it("resolves the same local time differently in winter", () => {
    // UTC-5 in December, so a fixed offset would be an hour out.
    expect(instantFor("2026-12-21", "07:00", NY).toISOString()).toBe("2026-12-21T12:00:00.000Z");
  });

  it("handles a timezone with a half hour offset", () => {
    expect(instantFor("2026-09-21", "07:00", "Asia/Kolkata").toISOString()).toBe(
      "2026-09-21T01:30:00.000Z",
    );
  });

  it("handles a quarter hour offset", () => {
    // Nepal is UTC+5:45. A whole hour search never matches it, which is not an
    // edge case for this roster, it is a client on a deployment.
    expect(instantFor("2026-09-21", "07:00", "Asia/Kathmandu").toISOString()).toBe(
      "2026-09-21T01:15:00.000Z",
    );
  });

  it("refuses a local time that does not exist", () => {
    // Clocks go forward at 02:00 on 8 March 2026 in New York, so 02:30 that
    // morning never happens. Silently sending it an hour out is worse.
    expect(() => instantFor("2026-03-08", "02:30", NY)).toThrow(/does not exist/);
  });

  it("refuses something that is not a time", () => {
    expect(() => instantFor("2026-09-21", "seven", NY)).toThrow(/not a time/);
  });
});

describe("touchpoints", () => {
  it("counts the week Monday to Sunday, not a rolling seven days", () => {
    // A rolling window makes the roster column mean something different every
    // day. A coach glancing at it on Thursday wants to know how this week is
    // going.
    expect(weekStart("2026-09-24")).toBe("2026-09-21"); // Thursday to its Monday
    expect(weekStart("2026-09-21")).toBe("2026-09-21"); // Monday to itself
    expect(weekStart("2026-09-20")).toBe("2026-09-14"); // Sunday to the Monday before
  });

  it("counts this week and last week separately", () => {
    const count = countTouchpoints(
      [
        { kind: "message", at: "2026-09-15T10:00:00Z" },
        { kind: "checkin_review", at: "2026-09-17T10:00:00Z" },
        { kind: "message", at: "2026-09-22T10:00:00Z" },
      ],
      "2026-09-24",
    );
    expect(count.thisWeek).toBe(1);
    expect(count.lastWeek).toBe(2);
    expect(count.daysSinceLast).toBe(2);
  });

  it("bands on the target rather than on a percentage", () => {
    const at = (n: number) =>
      countTouchpoints(
        Array.from({ length: n }, () => ({ kind: "message" as const, at: "2026-09-22T10:00:00Z" })),
        "2026-09-24",
      ).band;

    expect(at(0)).toBe("flag");
    expect(at(WEEKLY_TARGET)).toBe("watch");
    expect(at(STRONG_WEEK)).toBe("ok");
  });

  it("says never rather than zero days when there has been no contact", () => {
    expect(countTouchpoints([], "2026-09-24").daysSinceLast).toBeNull();
  });

  it("puts the quietest client first, whatever their adherence", () => {
    // A client having a great week who has not heard from anyone in nine days
    // is exactly who cancels.
    const rows = [
      { name: "recent", touchpoints: countTouchpoints([{ kind: "message" as const, at: "2026-09-23T10:00:00Z" }], "2026-09-24") },
      { name: "quiet", touchpoints: countTouchpoints([{ kind: "message" as const, at: "2026-09-15T10:00:00Z" }], "2026-09-24") },
      { name: "never", touchpoints: countTouchpoints([], "2026-09-24") },
    ];
    expect(quietestFirst(rows).map((row) => row.name)).toEqual(["never", "quiet", "recent"]);
  });
});
