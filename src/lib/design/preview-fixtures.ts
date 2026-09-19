import type { ExerciseRow } from "@/components/ExerciseTable";
import type { RosterRow } from "@/components/RosterTable";

/**
 * Fixtures for the visual and density pass.
 *
 * DESIGN.md constraint 3: design every screen against the synthetic seed
 * clients, including the long names and the empty states. These are the same
 * eight people as supabase/seed.sql, so what the test renders is what the coach
 * sees on a local database.
 *
 * Every person here is invented, same as the seed.
 */

export const SEED_ROSTER: RosterRow[] = [
  {
    id: "1", slug: "aisha-nkemdirim", name: "Aisha Nkemdirim",
    program: "race_prep", week: 6, weeks: 14, phase: "active",
    score: 91, adherence: 93, weightDelta: -0.4, lastActivityDays: 0, flags: 1,
    touchpoints: null, daysSinceTouch: null,
  },
  {
    id: "2", slug: "caleb-whitlock", name: "Caleb Whitlock",
    program: "fat_loss", week: 3, weeks: 26, phase: "active",
    score: 72, adherence: 68, weightDelta: -1.8, lastActivityDays: 1, flags: 3,
    touchpoints: 0, daysSinceTouch: 9,
  },
  {
    id: "3", slug: "elena-marsh", name: "Elena Marsh",
    program: "maintain", week: 11, weeks: 20, phase: "active",
    score: 88, adherence: 86, weightDelta: 0.0, lastActivityDays: 2, flags: 2,
    touchpoints: 1, daysSinceTouch: 4,
  },
  {
    id: "4", slug: "jonah-petrakis", name: "Jonah Petrakis",
    program: "fitness_test", week: 8, weeks: 12, phase: "active",
    score: 54, adherence: 47, weightDelta: -0.2, lastActivityDays: 5, flags: 2,
    touchpoints: 2, daysSinceTouch: 1,
  },
  {
    id: "5", slug: "marcus-oyelaran", name: "Marcus Oyelaran",
    program: "performance", week: 2, weeks: 12, phase: "active",
    score: 84, adherence: 79, weightDelta: -0.9, lastActivityDays: 0, flags: 2,
    touchpoints: 3, daysSinceTouch: 0,
  },
  {
    id: "6", slug: "nadia-brookes", name: "Nadia Brookes",
    program: "recomp", week: 5, weeks: 16, phase: "active",
    score: 96, adherence: 97, weightDelta: -0.1, lastActivityDays: 0, flags: 1,
    touchpoints: 0, daysSinceTouch: 12,
  },
  {
    id: "7", slug: "priya-raghavan", name: "Priya Raghavan",
    program: "fat_loss", week: 9, weeks: 16, phase: "active",
    score: 63, adherence: 61, weightDelta: -0.6, lastActivityDays: 3, flags: 1,
    touchpoints: 2, daysSinceTouch: 2,
  },
  {
    id: "8", slug: "theo-vance", name: "Theo Vance",
    program: "race_prep", week: 14, weeks: 18, phase: "active",
    score: null, adherence: null, weightDelta: null, lastActivityDays: null, flags: 2,
    touchpoints: 1, daysSinceTouch: 6,
  },
];

/**
 * The stress cases tell 10 asks for: a 40 character client name, a three digit
 * day count, and a program label longer than its column. If any of these
 * silently clips, the layout is wrong, not the data.
 */
export const STRESS_ROSTER: RosterRow[] = [
  {
    id: "s1",
    slug: "long-name",
    name: "Alexandra Constance Fairweather-Whitmore",
    program: "six month transformation",
    week: 104, weeks: 104, phase: "pending_approval",
    score: 100, adherence: 100, weightDelta: -12.4, lastActivityDays: 365, flags: 9,
    touchpoints: null, daysSinceTouch: null,
  },
  ...SEED_ROSTER,
];

/**
 * A roster long enough to observe the density target directly rather than only
 * computing it. Names are numbered rather than invented so nobody mistakes
 * these for people.
 */
export const DENSE_ROSTER: RosterRow[] = Array.from({ length: 24 }, (_, i) => {
  const base = SEED_ROSTER[i % SEED_ROSTER.length];
  return {
    ...base,
    id: `d${i}`,
    slug: `${base.slug}-${i}`,
    name: i < SEED_ROSTER.length ? base.name : `${base.name} ${i + 1}`,
  };
});

export type PreviewQueueItem = {
  id: string;
  client: string;
  title: string;
  kind: string;
  severity: number;
};

export const SEED_QUEUE: PreviewQueueItem[] = [
  {
    id: "q1", client: "Jonah Petrakis", severity: 5, kind: "trigger",
    title: "Steps under 6,000 two days running",
  },
  {
    id: "q2", client: "Theo Vance", severity: 5, kind: "trigger",
    title: "Calf rated 7 this morning, long run is Saturday",
  },
  {
    id: "q3", client: "Caleb Whitlock", severity: 4, kind: "retention_risk",
    title: "Nothing logged in 72 hours",
  },
  {
    id: "q4", client: "Priya Raghavan", severity: 3, kind: "checkin_submitted",
    title: "Weekly check-in in, adherence 6 of 10",
  },
  {
    id: "q5", client: "Elena Marsh", severity: 3, kind: "checkin_due",
    title: "Weekly check-in overdue since Sunday",
  },
  {
    id: "q6", client: "Marcus Oyelaran", severity: 2, kind: "approval",
    title: "Blueprint draft ready to approve",
  },
];

/**
 * Library fixtures. These are movement names and flag keys, not client data, so
 * they can be concrete. The contraindications are the real ones: a barbell back
 * squat loads the spine, walking lunges load the knee.
 */
export const SEED_EXERCISES: ExerciseRow[] = [
  {
    id: "e1", name: "Barbell Back Squat", aliases: ["BB Back Squat"],
    pattern: "squat", primary_muscle: "quads", equipment: ["barbell", "rack"],
    level: "intermediate", needs_review: false,
    contraindications: ["spine", "knee"], alternatives: 3, youtube_id: "aaaaaaaaaaa",
  },
  {
    id: "e2", name: "Goblet Squat", aliases: [],
    pattern: "squat", primary_muscle: "quads", equipment: ["dumbbell"],
    level: "beginner", needs_review: false,
    contraindications: [], alternatives: 1, youtube_id: "bbbbbbbbbbb",
  },
  {
    id: "e3", name: "Romanian Deadlift", aliases: ["RDL"],
    pattern: "hinge", primary_muscle: "hamstrings", equipment: ["barbell"],
    level: "intermediate", needs_review: false,
    contraindications: ["spine"], alternatives: 2, youtube_id: "ccccccccccc",
  },
  {
    id: "e4", name: "Dumbbell Bench Press", aliases: ["DB Bench Press"],
    pattern: "push_h", primary_muscle: "chest", equipment: ["dumbbell", "bench"],
    level: "beginner", needs_review: false,
    contraindications: ["shoulder"], alternatives: 1, youtube_id: "ddddddddddd",
  },
  {
    id: "e5", name: "Walking Lunge", aliases: [],
    pattern: "lunge", primary_muscle: "quads", equipment: ["body only"],
    level: "beginner", needs_review: false,
    contraindications: ["knee"], alternatives: 2, youtube_id: "eeeeeeeeeee",
  },
  {
    id: "e6", name: "Chest Supported Row", aliases: ["CSR"],
    pattern: "pull_h", primary_muscle: "back", equipment: ["dumbbell", "bench"],
    level: "beginner", needs_review: false,
    contraindications: [], alternatives: 0, youtube_id: "fffffffffff",
  },
  {
    id: "e7", name: "Unnamed video ggggggggggg (client-6.html)", aliases: [],
    pattern: null, primary_muscle: null, equipment: [],
    level: null, needs_review: true,
    contraindications: [], alternatives: 0, youtube_id: "ggggggggggg",
  },
];

/** The longest real movement name plus every column at its widest. */
export const STRESS_EXERCISES: ExerciseRow[] = [
  {
    id: "s1",
    name: "Single Arm Half Kneeling Landmine Press With Pause",
    aliases: ["SA HK Landmine Press", "Half Kneeling Landmine Press"],
    pattern: "push_v", primary_muscle: "shoulders",
    equipment: ["barbell", "landmine", "bench", "band"],
    level: "advanced", needs_review: true,
    contraindications: ["shoulder", "elbow", "wrist", "spine"],
    alternatives: 12, youtube_id: "hhhhhhhhhhh",
  },
  ...SEED_EXERCISES,
];
