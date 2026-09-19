/**
 * Writes a generated client app to disk for the browser tests.
 *
 * The Playwright suite drives the real artifact rather than a stand-in, because
 * the non negotiables are runtime behaviour: whether render scrolls, whether a
 * broken card takes the page, whether last Tuesday shows last Tuesday. None of
 * that is visible to a static audit.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { raceBriefing } from "../src/lib/race/mode";
import { generateApp } from "../src/lib/export/generate";
import type { ExportData } from "../src/lib/export/types";

const root = path.resolve(__dirname, "..");

function day(date: string, dayOfWeek: number, overrides: Partial<ExportData["weeks"][0]["days"][0]> = {}) {
  return {
    date,
    dayOfWeek,
    isRest: false,
    calories: null,
    protein: null,
    sessions: [
      {
        id: `s-${date}`,
        kind: "strength" as const,
        name: "Lower body",
        exercises: [
          {
            id: `e-${date}`,
            name: "Goblet Squat",
            youtubeId: "aBc123",
            cues: ["Chest up"],
            logsWeight: true,
            sets: [
              { set: 1, reps: 8, rest: 90 },
              { set: 2, reps: 8, rest: 90 },
              { set: 3, reps: 8, rest: 90 },
            ],
          },
          {
            // A timed hold. No weight box, ever.
            id: `h-${date}`,
            name: "Dead Hang",
            youtubeId: "dEf456",
            cues: [],
            logsWeight: false,
            sets: [{ set: 1, time: 45 }],
          },
        ],
      },
    ],
    ...overrides,
  };
}

const DATA: ExportData = {
  client: {
    id: "c1",
    slug: "fixture-client",
    firstName: "Ekaterina",
    lastName: "Vasilyeva-Whitcombe",
    units: "imperial",
    timezone: "UTC",
  },
  program: {
    name: "Sixteen week recomposition",
    startDate: "2026-09-21",
    weeks: 16,
    goalStatement: "Down to 175 and still able to run a half",
  },
  races: [
    raceBriefing(
      {
        id: "race1",
        name: "Brighton Half",
        date: "2027-03-14",
        metres: 21097,
        goalTimeSeconds: 7080,
        notes: null,
      },
      null,
    ),
  ],
  weeks: [1, 2, 3].map((weekNumber) => {
    const start = ["2026-09-21", "2026-09-28", "2026-10-05"][weekNumber - 1];
    const dates = Array.from({ length: 7 }, (_, offset) => {
      const parts = start.split("-").map(Number);
      return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + offset))
        .toISOString()
        .slice(0, 10);
    });

    return {
      weekNumber,
      startsOn: start,
      isDeload: weekNumber === 3,
      phase: "Base",
      calories: 2650 - (weekNumber - 1) * 50,
      protein: 193,
      carbs: 300,
      fat: 80,
      plannedMileage: 18,
      days: dates.map((date, index) =>
        index === 6
          ? { ...day(date, 0), isRest: true, sessions: [] }
          : day(date, index === 6 ? 0 : index + 1),
      ),
    };
  }),
  meals: [
    { id: "m1", name: "Breakfast", calories: 640, protein: 48, carbs: 70, fat: 18, items: [] },
    { id: "m2", name: "Lunch", calories: 780, protein: 55, carbs: 85, fat: 22, items: [] },
  ],
  habits: [],
  reference: [{ title: "How to weigh in", body: "Same time, same conditions, every week." }],
  apiBase: "http://127.0.0.1:3000/api/v1",
  generatedAt: "2026-09-19T12:00:00.000Z",
};

const out = path.join(root, "tests/e2e/fixtures");
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "client-app.html"), generateApp(DATA));
console.log(`Wrote ${path.join(out, "client-app.html")}`);
