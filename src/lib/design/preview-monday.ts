import { adherenceLines, cardSeverity, pinSpine, type ReviewCard } from "@/lib/queue/review-card";

/**
 * Fixtures for the Monday card.
 *
 * Built through the real assembly functions so the bands, the pinned spine and
 * the severity on screen are the ones the code produces. Three cards: a week
 * with a flag, an ordinary week with a diff, and a week where nothing needs to
 * change, because that third one is the most common and the easiest to get
 * wrong.
 */

const ADHERENCE = {
  training: { done: 3, planned: 3 },
  run: { done: 1, planned: 2 },
  calories: { done: 5, planned: 7 },
  steps: { done: 3, planned: 7 },
  recovery: { done: 2, planned: 3 },
};

export const PREVIEW_CARD: ReviewCard = {
  clientId: "11111111-1111-4111-8111-111111111111",
  slug: "ekaterina",
  name: "Ekaterina Vasilyeva-Whitcombe",
  weekNumber: 5,
  weekCount: 16,
  score: 71.4,
  focus: "movement",
  weight: { average: 189.8, vsLastWeek: -0.3, vsPlan: 1.2 },
  adherence: adherenceLines(ADHERENCE),
  spineVariable: "calories",
  checkin: pinSpine([
    { key: "fasted_weight", question: "Fasted weight", answer: "189.8", isSpine: false },
    { key: "adherence", question: "How closely did you follow the plan?", answer: "6", isSpine: false },
    {
      key: "hunger",
      question: "How hungry were you this week?",
      answer: "8. Constantly from Wednesday on, which is when the travel started.",
      isSpine: true,
    },
    {
      key: "biggest_struggle",
      question: "Biggest struggle",
      answer: "Airport food and two dinners I did not choose.",
      isSpine: false,
    },
    {
      key: "the_one_thing",
      question: "What is the one thing you know you should be doing and are not?",
      answer: "Walking after dinner. I have not done it once since the trip.",
      isSpine: false,
    },
  ]),
  flags: [],
  changes: [
    {
      id: "c1", field: "calories", label: "Calories", from: "2550", to: "2450",
      reason: "Hunger at 8 and the average has moved 0.3 in two weeks. The cut is not landing.",
      decision: "pending",
    },
    {
      id: "c2", field: "step_goal", label: "Step goal", from: "7400", to: "6500",
      reason: "Steps 3 of 7 for two weeks. A target they hit beats a target they read.",
      decision: "pending",
    },
    {
      id: "c3", field: "planned_mileage", label: "Mileage", from: "24", to: "24",
      reason: "Hold. The ramp has room but the travel week is not where to use it.",
      decision: "pending",
    },
  ],
  message:
    "Weight is 189.8, down 0.3 on the week, which is slower than we planned.\nHunger at 8 tells me the number is too low for a travel week rather than too high, so calories go to 2,450 and the step goal drops to 6,500 until you are home.\nMileage holds at 24.\nWhat does the walk after dinner look like on a normal Tuesday?",
  severity: cardSeverity({ score: 71.4, flags: 0, weightChange: -0.3, losingWeight: true }),
};

export const PREVIEW_CARD_FLAGGED: ReviewCard = {
  ...PREVIEW_CARD,
  clientId: "22222222-2222-4222-8222-222222222222",
  slug: "janessa",
  name: "Janessa Okonkwo-Bright",
  score: 58.2,
  focus: "training",
  weight: { average: 164.2, vsLastWeek: 0.8, vsPlan: 2.4 },
  flags: [
    {
      key: "back_pain",
      label: "Back discomfort at 6",
      detail: "Above the 4 agreed as worth a message the same day.",
      date: "2026-09-18",
    },
  ],
  changes: [
    {
      id: "f1", field: "training_volume", label: "Lower volume", from: "4 sets", to: "2 sets",
      reason: "Back at 6 on Friday. Half the hinging until it settles.",
      decision: "accept",
    },
    {
      id: "f2", field: "calories", label: "Calories", from: "2200", to: "2200",
      reason: "Hold. Nothing about the week says the food is the problem.",
      decision: "reject",
    },
  ],
  severity: cardSeverity({ score: 58.2, flags: 1, weightChange: 0.8, losingWeight: true }),
};

export const PREVIEW_CARD_QUIET: ReviewCard = {
  ...PREVIEW_CARD,
  clientId: "33333333-3333-4333-8333-333333333333",
  slug: "theo",
  name: "Theo Vance",
  score: 93.6,
  focus: null,
  weight: { average: 171.4, vsLastWeek: -0.6, vsPlan: -0.1 },
  adherence: adherenceLines({
    training: { done: 3, planned: 3 },
    run: { done: 4, planned: 4 },
    calories: { done: 7, planned: 7 },
    steps: { done: 6, planned: 7 },
    recovery: { done: 0, planned: 0 },
  }),
  spineVariable: null,
  flags: [],
  changes: [],
  message:
    "Everything landed this week. 7 of 7 on calories, 4 of 4 runs, weight down 0.6 to 171.4.\nNothing changes for week 6.\nLong run goes to 12 miles on Sunday. Still happy with Sunday?",
  severity: cardSeverity({ score: 93.6, flags: 0, weightChange: -0.6, losingWeight: true }),
};

export const PREVIEW_CARDS = [PREVIEW_CARD_FLAGGED, PREVIEW_CARD, PREVIEW_CARD_QUIET];
