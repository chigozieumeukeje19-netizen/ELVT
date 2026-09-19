import { ALL_QUESTIONS } from "@/lib/checkin/bank";
import { buildDailyForm, buildWeeklyForm } from "@/lib/checkin/generate";
import type { CompareRow } from "@/components/checkin/CompareView";
import type { ThreadMessage } from "@/components/checkin/ReviewThread";
import type { SubmissionRow } from "@/components/checkin/SubmissionList";

/**
 * Fixtures for the check-in preview routes.
 *
 * The forms are produced by the real generators, so the screens are checked
 * against what a client would actually be asked. The submissions and the thread
 * are written out, since they stand in for rows.
 *
 * The client here carries a spine flag and runs, which is the case that pulls
 * the most from the bank, and one of the compare rows has a gap in it so the
 * "not asked" cell is exercised rather than assumed.
 */

const CLIENT = { goal: "recomp" as const, flags: ["spine" as const], running: true };

export const PREVIEW_DAILY_FORM = buildDailyForm(CLIENT);
export const PREVIEW_WEEKLY_FORM = buildWeeklyForm(CLIENT, { spineVariable: "calories" });
export const PREVIEW_WEEK1_FORM = buildWeeklyForm(CLIENT, { isFirstWeek: true });
export const PREVIEW_NO_SPINE_FORM = buildWeeklyForm(CLIENT, { spineVariable: null });

export const PREVIEW_BANK = ALL_QUESTIONS;

export const PREVIEW_SUBMISSIONS: SubmissionRow[] = [
  {
    id: "s9", kind: "weekly", forDate: "2026-09-20", submittedAt: "2026-09-20T18:12:00Z",
    reviewedAt: null,
    headline: "Travel week. Ate out four times and the steps went with it.",
    replies: 0,
  },
  {
    id: "s8", kind: "daily", forDate: "2026-09-19", submittedAt: "2026-09-19T20:40:00Z",
    reviewedAt: "2026-09-19T21:05:00Z", headline: "Submitted", replies: 0,
  },
  {
    id: "s7", kind: "daily", forDate: "2026-09-18", submittedAt: null,
    reviewedAt: null, headline: "Waiting on them", replies: 0,
  },
  {
    id: "s6", kind: "weekly", forDate: "2026-09-13", submittedAt: "2026-09-13T17:55:00Z",
    reviewedAt: "2026-09-14T07:30:00Z",
    headline: "Getting to bed. Everything else follows from it.",
    replies: 2,
  },
  {
    id: "s1", kind: "week1", forDate: "2026-08-23", submittedAt: "2026-08-23T19:02:00Z",
    reviewedAt: "2026-08-24T08:10:00Z",
    headline: "Four sessions is one too many in a normal week.",
    replies: 1,
  },
];

export const PREVIEW_COMPARE_WEEKS = [1, 2, 3, 4, 5];

export const PREVIEW_COMPARE: CompareRow[] = [
  {
    questionKey: "fasted_weight", text: "Fasted weight",
    values: [
      { week: 1, value: 192.5 }, { week: 2, value: 191.2 }, { week: 3, value: 191.4 },
      { week: 4, value: 190.1 }, { week: 5, value: 189.8 },
    ],
  },
  {
    questionKey: "adherence", text: "How closely did you follow the plan?",
    values: [
      { week: 1, value: 8 }, { week: 2, value: 9 }, { week: 3, value: 5 },
      { week: 4, value: 4 }, { week: 5, value: 7 },
    ],
  },
  {
    questionKey: "sleep_quality", text: "How well did you sleep?",
    values: [
      { week: 1, value: 6 }, { week: 2, value: 6 }, { week: 3, value: 4 },
      { week: 4, value: 5 }, { week: 5, value: 7 },
    ],
  },
  {
    // Added at week 3, so the first two are gaps rather than zeroes.
    questionKey: "back_pain", text: "Any back discomfort this week?",
    values: [
      { week: 1, value: null }, { week: 2, value: null }, { week: 3, value: 3 },
      { week: 4, value: 2 }, { week: 5, value: 1 },
    ],
  },
];

export const PREVIEW_THREAD: ThreadMessage[] = [
  {
    id: "m1", from: "coach", at: "2026-09-14",
    body:
      "Adherence 5 on a week you were away is fine. Weight is flat at 191, which is what I would expect.\nSteps are the one to fix: 4,200 average against 7,400.\nWhat does the walk look like on a normal Tuesday?",
  },
  {
    id: "m2", from: "client", at: "2026-09-14",
    body: "Tuesday I am in the office until 7. I can do 20 minutes at lunch if that counts.",
  },
  {
    id: "m3", from: "coach", at: "2026-09-15",
    body:
      "It counts. 20 minutes at lunch is about 2,000, which gets you to 6,000 on those days.\nI have put the step goal at 6,500 for next week rather than 7,400.\nCan you start tomorrow?",
  },
];
