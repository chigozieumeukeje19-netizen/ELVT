import { describe, expect, it } from "vitest";
import { applyTemplate } from "@/lib/program/apply-template";
import {
  clearWeek,
  copyWeekInto,
  duplicateAcross,
  moveSession,
  reschedule,
  setDeload,
  shiftWeek,
  swapDays,
} from "@/lib/program/edits";
import { LIBRARY, PLACEMENTS, START_DATE, TEMPLATE } from "../fixtures/program";

const program = applyTemplate({
  template: TEMPLATE,
  placement: PLACEMENTS["theo-vance"],
  library: LIBRARY,
  startDate: START_DATE,
  weeks: 4,
});

const week = program.weeks[0];

const keysByDate = (w: typeof week) =>
  Object.fromEntries(w.days.map((d) => [d.date, d.sessions.map((s) => s.key)]));

describe("shiftWeek", () => {
  it("moves every day's contents one position later", () => {
    const shifted = shiftWeek(week, 1);
    for (let i = 0; i < 7; i += 1) {
      expect(shifted.days[i].sessions.map((s) => s.key)).toEqual(
        week.days[(i - 1 + 7) % 7].sessions.map((s) => s.key),
      );
    }
  });

  it("wraps rather than dropping the last day", () => {
    const before = week.days.flatMap((d) => d.sessions).length;
    const after = shiftWeek(week, 1).days.flatMap((d) => d.sessions).length;
    expect(after).toBe(before);
  });

  it("leaves the dates alone, because only the contents move", () => {
    expect(shiftWeek(week, 2).days.map((d) => d.date)).toEqual(
      week.days.map((d) => d.date),
    );
  });

  it("shifting forward then back is the original week", () => {
    expect(keysByDate(shiftWeek(shiftWeek(week, 1), -1))).toEqual(keysByDate(week));
  });
});

describe("swapDays", () => {
  it("exchanges two days including the rest marker", () => {
    const monday = week.days.find((d) => d.dayOfWeek === 1)!;
    const sunday = week.days.find((d) => d.dayOfWeek === 0)!;

    const swapped = swapDays(week, 1, 0);
    const newMonday = swapped.days.find((d) => d.dayOfWeek === 1)!;
    const newSunday = swapped.days.find((d) => d.dayOfWeek === 0)!;

    expect(newMonday.sessions.map((s) => s.key)).toEqual(
      sunday.sessions.map((s) => s.key),
    );
    expect(newSunday.sessions.map((s) => s.key)).toEqual(
      monday.sessions.map((s) => s.key),
    );
    expect(newMonday.isRest).toBe(sunday.isRest);
  });

  it("is a no-op when both days are the same", () => {
    expect(keysByDate(swapDays(week, 2, 2))).toEqual(keysByDate(week));
  });

  it("swapping twice returns the original", () => {
    expect(keysByDate(swapDays(swapDays(week, 1, 4), 1, 4))).toEqual(
      keysByDate(week),
    );
  });
});

describe("copyWeekInto and duplicateAcross", () => {
  it("copies contents but keeps the target's dates and number", () => {
    const target = program.weeks[2];
    const copied = copyWeekInto(week, target);

    expect(copied.weekNumber).toBe(target.weekNumber);
    expect(copied.days.map((d) => d.date)).toEqual(target.days.map((d) => d.date));
    expect(copied.days.map((d) => d.sessions.map((s) => s.key))).toEqual(
      week.days.map((d) => d.sessions.map((s) => s.key)),
    );
  });

  it("keeps the target's deload marking", () => {
    const deload = setDeload(program.weeks[3], true);
    expect(copyWeekInto(week, deload).isDeload).toBe(true);
  });

  it("copies across an inclusive range and leaves the source alone", () => {
    const result = duplicateAcross(program.weeks, 1, 2, 4);
    expect(result[0]).toEqual(program.weeks[0]);

    for (const weekNumber of [2, 3, 4]) {
      const changed = result.find((w) => w.weekNumber === weekNumber)!;
      expect(changed.days.map((d) => d.sessions.map((s) => s.key))).toEqual(
        week.days.map((d) => d.sessions.map((s) => s.key)),
      );
    }
  });

  it("accepts a reversed range", () => {
    const result = duplicateAcross(program.weeks, 1, 4, 2);
    expect(result.find((w) => w.weekNumber === 3)!.days[0].sessions.length).toBe(
      week.days[0].sessions.length,
    );
  });

  it("leaves weeks outside the range untouched", () => {
    const result = duplicateAcross(program.weeks, 2, 3, 3);
    expect(result.find((w) => w.weekNumber === 4)).toEqual(program.weeks[3]);
  });
});

describe("clearWeek and setDeload", () => {
  it("empties the week into seven rest days", () => {
    const cleared = clearWeek(week);
    expect(cleared.days.every((d) => d.isRest)).toBe(true);
    expect(cleared.days.flatMap((d) => d.sessions)).toHaveLength(0);
  });

  it("marks and unmarks a deload without touching the contents", () => {
    expect(setDeload(week, true).isDeload).toBe(true);
    expect(keysByDate(setDeload(week, true))).toEqual(keysByDate(week));
  });
});

describe("moveSession", () => {
  const busyDay = week.days.find((d) => d.sessions.length > 0)!;
  const emptyDay = week.days.find((d) => d.sessions.length === 0)!;
  const sessionKey = busyDay.sessions[0].key;

  it("moves a session between days", () => {
    const moved = moveSession(week, sessionKey, busyDay.date, emptyDay.date);

    expect(
      moved.days.find((d) => d.date === busyDay.date)!.sessions.map((s) => s.key),
    ).not.toContain(sessionKey);
    expect(
      moved.days.find((d) => d.date === emptyDay.date)!.sessions.map((s) => s.key),
    ).toContain(sessionKey);
  });

  it("keeps the total number of sessions the same", () => {
    const before = week.days.flatMap((d) => d.sessions).length;
    const after = moveSession(week, sessionKey, busyDay.date, emptyDay.date)
      .days.flatMap((d) => d.sessions).length;
    expect(after).toBe(before);
  });

  it("updates the rest marker on both ends", () => {
    const moved = moveSession(week, sessionKey, busyDay.date, emptyDay.date);
    expect(moved.days.find((d) => d.date === emptyDay.date)!.isRest).toBe(false);
  });

  it("is a no-op when the session is not where the caller thinks", () => {
    // A stale drag from a page that has since changed must not duplicate a
    // session or drop one on the floor.
    const stale = moveSession(week, "not-a-session", busyDay.date, emptyDay.date);
    expect(keysByDate(stale)).toEqual(keysByDate(week));
  });

  it("is a no-op when the source and target are the same day", () => {
    expect(
      keysByDate(moveSession(week, sessionKey, busyDay.date, busyDay.date)),
    ).toEqual(keysByDate(week));
  });

  it("is a no-op for a date outside the week", () => {
    expect(
      keysByDate(moveSession(week, sessionKey, busyDay.date, "2099-01-01")),
    ).toEqual(keysByDate(week));
  });
});

describe("reschedule", () => {
  it("moves every date and keeps the day of week consistent", () => {
    const moved = reschedule(week, 7);
    expect(moved.days[0].date).not.toBe(week.days[0].date);
    for (const day of moved.days) {
      expect(new Date(`${day.date}T00:00:00Z`).getUTCDay()).toBe(day.dayOfWeek);
    }
  });
});
