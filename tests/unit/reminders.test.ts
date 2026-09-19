import { describe, expect, it } from "vitest";
import {
  defaultSettings,
  digest,
  DIGEST_WINDOW_MINUTES,
  planReminders,
  REMINDER_COPY,
  REMINDER_KINDS,
  type ReminderSetting,
} from "@/lib/reminders/plan";

describe("the reminder set", () => {
  it("has copy for every kind", () => {
    for (const kind of REMINDER_KINDS) {
      expect(REMINDER_COPY[kind], kind).toBeTruthy();
    }
  });

  it("uses no dashes and no raw enum values in anything a client reads", () => {
    for (const kind of REMINDER_KINDS) {
      expect(REMINDER_COPY[kind]).not.toMatch(/\s[-–—]\s/);
      expect(REMINDER_COPY[kind]).not.toMatch(/\b[a-z]{2,}_[a-z][a-z_]*\b/);
    }
  });
});

const BLUEPRINT = {
  reminderTime: "06:30",
  checkinDay: "Sunday",
  runs: true,
  tracksFood: true,
  trainingDays: [1, 2, 4, 6],
};

describe("defaults from the blueprint", () => {
  it("puts the morning plan at the time they asked for", () => {
    const morning = defaultSettings(BLUEPRINT).find((s) => s.kind === "morning_plan")!;
    expect(morning.time).toBe("06:30");
  });

  it("spreads the rest through the day rather than stacking them on it", () => {
    // A client who asked for early morning reminders did not ask for an early
    // morning water reminder as well as an early morning plan.
    const settings = defaultSettings(BLUEPRINT);
    const times = settings
      .filter((s) => !["weigh_in", "photos"].includes(s.kind))
      .map((s) => s.time);
    expect(new Set(times).size).toBeGreaterThan(4);
  });

  it("turns off the run reminder for someone who does not run", () => {
    const settings = defaultSettings({ ...BLUEPRINT, runs: false });
    expect(settings.find((s) => s.kind === "run")!.enabled).toBe(false);
  });

  it("turns off the protein reminder for someone who does not track", () => {
    const settings = defaultSettings({ ...BLUEPRINT, tracksFood: false });
    expect(settings.find((s) => s.kind === "protein")!.enabled).toBe(false);
  });

  it("puts the workout reminder only on their training days", () => {
    const workout = defaultSettings(BLUEPRINT).find((s) => s.kind === "workout")!;
    expect(workout.days).toEqual([1, 2, 4, 6]);
  });

  it("puts the weigh in and the photos on Monday morning", () => {
    const settings = defaultSettings(BLUEPRINT);
    for (const kind of ["weigh_in", "photos"] as const) {
      const setting = settings.find((s) => s.kind === kind)!;
      expect(setting.days, kind).toEqual([1]);
      expect(setting.time, kind).toBe("06:30");
    }
  });

  it("follows the check-in day they chose", () => {
    expect(defaultSettings(BLUEPRINT).find((s) => s.kind === "checkin_due")!.days).toEqual([0]);
    expect(
      defaultSettings({ ...BLUEPRINT, checkinDay: "Monday" }).find((s) => s.kind === "checkin_due")!
        .days,
    ).toEqual([1]);
  });

  it("keeps every time inside waking hours", () => {
    // A late reminder time must not push the evening reflection to midnight.
    for (const reminderTime of ["05:00", "06:30", "12:30", "19:00"]) {
      for (const setting of defaultSettings({ ...BLUEPRINT, reminderTime })) {
        const hour = Number(setting.time.split(":")[0]);
        expect(hour, `${reminderTime} gave ${setting.kind} at ${setting.time}`).toBeGreaterThanOrEqual(5);
        expect(hour, `${reminderTime} gave ${setting.kind} at ${setting.time}`).toBeLessThanOrEqual(22);
      }
    }
  });
});

describe("the digest rule", () => {
  it("sends one reminder on its own", () => {
    const out = digest([{ kind: "steps", time: "14:00" }]);
    expect(out).toHaveLength(1);
    expect(out[0].body).toBe(REMINDER_COPY.steps);
  });

  it("groups everything inside an hour into one", () => {
    // The whole point. Five separate pings is how an app gets muted, and a
    // muted app delivers nothing at all.
    const out = digest([
      { kind: "morning_plan", time: "07:00" },
      { kind: "workout", time: "07:15" },
      { kind: "water", time: "07:30" },
      { kind: "steps", time: "07:45" },
      { kind: "protein", time: "08:00" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].kinds).toHaveLength(5);
    expect(out[0].time).toBe("07:00");
  });

  it("writes a digest as a list, not as a paragraph", () => {
    const out = digest([
      { kind: "morning_plan", time: "07:00" },
      { kind: "workout", time: "07:15" },
    ]);
    expect(out[0].body.split("\n")).toHaveLength(2);
  });

  it("keeps two reminders more than an hour apart separate", () => {
    const out = digest([
      { kind: "morning_plan", time: "07:00" },
      { kind: "steps", time: "14:00" },
    ]);
    expect(out).toHaveLength(2);
  });

  it("measures the window from the first in the group, not the last", () => {
    // 07:00, 07:50, 08:40 would otherwise chain into one endless digest and
    // the last one would arrive an hour and forty after it was due.
    const out = digest([
      { kind: "morning_plan", time: "07:00" },
      { kind: "workout", time: "07:50" },
      { kind: "steps", time: "08:40" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].kinds).toEqual(["morning_plan", "workout"]);
    expect(out[1].kinds).toEqual(["steps"]);
  });

  it("uses the window the rule names", () => {
    expect(DIGEST_WINDOW_MINUTES).toBe(60);
  });

  it("sorts before it groups, so the order they arrive in does not matter", () => {
    const out = digest([
      { kind: "steps", time: "07:45" },
      { kind: "morning_plan", time: "07:00" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].time).toBe("07:00");
  });

  it("refuses a time that is not a time", () => {
    expect(() => digest([{ kind: "steps", time: "morning" }])).toThrow(/not a time/);
  });
});

const SETTINGS: ReminderSetting[] = defaultSettings(BLUEPRINT);

/** 08:00 on Monday 21 September in New York. */
const MONDAY_MORNING = new Date("2026-09-21T12:00:00Z");

describe("what is due right now", () => {
  it("runs on the client's clock", () => {
    const ny = planReminders({
      instant: MONDAY_MORNING,
      timezone: "America/New_York",
      settings: SETTINGS,
      alreadyDone: [],
      alreadySent: [],
    });
    expect(ny.local.hour).toBe(8);
    expect(ny.local.weekday).toBe(1);

    // The same instant is late afternoon in Kabul, so their whole morning has
    // already passed and more is due.
    const kabul = planReminders({
      instant: MONDAY_MORNING,
      timezone: "Asia/Kabul",
      settings: SETTINGS,
      alreadyDone: [],
      alreadySent: [],
    });
    expect(kabul.local.hour).toBe(16);
    expect(
      kabul.dispatches.flatMap((d) => d.kinds).length,
    ).toBeGreaterThan(ny.dispatches.flatMap((d) => d.kinds).length);
  });

  it("does not send a reminder before its time", () => {
    const early = planReminders({
      instant: new Date("2026-09-21T10:00:00Z"), // 06:00 in New York
      timezone: "America/New_York",
      settings: SETTINGS,
      alreadyDone: [],
      alreadySent: [],
    });
    expect(early.dispatches).toEqual([]);
  });

  it("does not send one twice", () => {
    const sent = planReminders({
      instant: MONDAY_MORNING,
      timezone: "America/New_York",
      settings: SETTINGS,
      alreadyDone: [],
      alreadySent: REMINDER_KINDS.slice(),
    });
    expect(sent.dispatches).toEqual([]);
  });

  it("does not nag about something they have already done", () => {
    // A client who logged their steps at ten does not need a steps reminder.
    const before = planReminders({
      instant: new Date("2026-09-21T20:00:00Z"), // 16:00 in New York
      timezone: "America/New_York",
      settings: SETTINGS,
      alreadyDone: [],
      alreadySent: [],
    });
    const after = planReminders({
      instant: new Date("2026-09-21T20:00:00Z"),
      timezone: "America/New_York",
      settings: SETTINGS,
      alreadyDone: ["steps", "water"],
      alreadySent: [],
    });

    const kindsBefore = before.dispatches.flatMap((d) => d.kinds);
    const kindsAfter = after.dispatches.flatMap((d) => d.kinds);
    expect(kindsBefore).toContain("steps");
    expect(kindsAfter).not.toContain("steps");
    expect(kindsAfter).not.toContain("water");
  });

  it("catches up as one digest rather than four pings at once", () => {
    // The dispatcher was down all morning. This is exactly the case the digest
    // rule exists for.
    const late = planReminders({
      instant: new Date("2026-09-21T15:30:00Z"), // 11:30 in New York
      timezone: "America/New_York",
      settings: SETTINGS,
      alreadyDone: [],
      alreadySent: [],
    });

    const total = late.dispatches.flatMap((d) => d.kinds).length;
    expect(total).toBeGreaterThan(2);
    // Every overdue reminder is carried, but not as one ping each.
    expect(late.dispatches.length).toBeLessThan(total);
  });

  it("skips a reminder that is not on today", () => {
    // Tuesday, so no weigh in and no photos.
    const tuesday = planReminders({
      instant: new Date("2026-09-22T20:00:00Z"),
      timezone: "America/New_York",
      settings: SETTINGS,
      alreadyDone: [],
      alreadySent: [],
    });
    const kinds = tuesday.dispatches.flatMap((d) => d.kinds);
    expect(kinds).not.toContain("weigh_in");
    expect(kinds).not.toContain("photos");
  });

  it("skips one the client turned off", () => {
    const off = SETTINGS.map((setting) =>
      setting.kind === "water" ? { ...setting, enabled: false } : setting,
    );
    const out = planReminders({
      instant: new Date("2026-09-21T20:00:00Z"),
      timezone: "America/New_York",
      settings: off,
      alreadyDone: [],
      alreadySent: [],
    });
    expect(out.dispatches.flatMap((d) => d.kinds)).not.toContain("water");
  });
});
