import { defaultSettings } from "@/lib/reminders/plan";

/**
 * Fixtures for the reminder settings screen.
 *
 * Produced by the real defaults, so the grouping shown is the grouping the
 * dispatcher would actually produce. One set is a runner who tracks food, the
 * other neither, because the difference between them is which rows are off.
 */

export const PREVIEW_REMINDERS = defaultSettings({
  reminderTime: "06:30",
  checkinDay: "Sunday",
  runs: true,
  tracksFood: true,
  trainingDays: [1, 2, 4, 6],
});

/** A late riser who neither runs nor tracks, so several rows are off. */
export const PREVIEW_REMINDERS_SPARSE = defaultSettings({
  reminderTime: "09:00",
  checkinDay: "Monday",
  runs: false,
  tracksFood: false,
  trainingDays: [2, 4],
});
