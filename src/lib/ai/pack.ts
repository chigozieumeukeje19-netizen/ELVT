import { deriveBlueprint } from "@/lib/blueprint/derive";
import type { Blueprint } from "@/lib/blueprint/types";
import type { Answers } from "@/lib/questionnaire/answers";

/**
 * The synthetic client every AI prompt in docs/ai-prompts is generated
 * against, and the examples that go beside each prompt.
 *
 * Its own module rather than living in the script, so the tests can hold the
 * examples to the real parsers. A document claiming a response is accepted is
 * worth nothing unless something runs it.
 *
 * Synthetic, like everything else here. No real client data, ever.
 */

const ANSWERS: Answers = {
  primary_goal: "Recomposition, both at once",
  goal_statement: "Hold my weight steady and change the shape of it over sixteen weeks.",
  goal_weight: 168,
  duration_weeks: "16 weeks",
  done_this_before: true,

  start_weight: 176,
  height_cm: 168,
  dob: "1991-02-14",
  typical_steps: 7000,

  days_per_week: "4",
  preferred_days: ["Monday", "Tuesday", "Thursday", "Friday"],
  session_length: "60 minutes",
  equipment: ["Full gym"],
  travel: "Two conferences, one in November and one in January.",

  runs_at_all: false,

  tracks_food: "Yes, every day",
  meals_per_day: "4",
  who_cooks: "Me, most days",
  foods_out: "No shellfish.",
  alcohol: "One or two",

  sleep_hours: 7,
  sleep_quality: 6,
  stress: 7,
  recovery_habits: ["Walking"],

  current_pain: false,
  injury_areas: ["Lower back or spine"],
  surgery: "Lumbar fusion at L4 to L5, 2019. Cleared, nothing loaded through the spine.",
  cleared: true,
  medical_consent: "Ekaterina Vasilyeva-Whitcombe",

  what_worked: "Lifting three days a week and walking every lunchtime.",
  what_failed:
    "Anything needing a five am alarm. It holds for two weeks and falls apart in the third.",
  confidence: 7,

  tone: "Encouraging, but honest",
  reminder_time: "Early morning",
  checkin_day: "Sunday",
  accountability: 7,

  one_thing: "Protein at breakfast. I skip it and the whole day misses.",
  biggest_obstacle: "Back-to-back clinics with no lunch break.",
  anything_else: "",
  start_readiness: 4,
};

const DERIVED = deriveBlueprint(ANSWERS);

export const PACK_CLIENT = {
  answers: ANSWERS,
  derived: DERIVED,
  blueprint: {
    derived: DERIVED,
    drafted: {
      summary:
        "Ekaterina has held the same weight for two years and wants the shape of it to change rather than the number. A lumbar fusion rules out anything loaded through the spine, so the lower body work is machine and hip dominant throughout.",
      oneThing: "Thirty grams of protein before the first clinic of the day.",
      failureMode:
        "Week three, when a clinic overruns and lunch becomes a coffee. The early sign is two days in a row with no food logged before four in the afternoon.",
      toneNotes: "Warm, but give her the number. She asks direct questions and wants direct answers.",
      triggers: [],
    },
  } satisfies Blueprint,
  week: {
    weekNumber: 3,
    score: 74.5,
    focus: "steps",
    adherence: { training: 100, run: null, calories: 71, steps: 43, recovery: 86 },
    weightChange: -0.2,
    checkinAnswers: {
      fasted_weight: 175.8,
      adherence: "Four sessions, but the walks went completely.",
      biggest_struggle: "Two clinics overran and I ate at the desk both days.",
      the_one_thing: "Protein at breakfast, four days out of seven.",
    },
  },
  description: [
    "A forty-something recomposition client with a lumbar fusion, four training",
    "days, no running, and a stated failure mode in week three. She is the",
    "hardest of the eight synthetic clients to draft for, which is why the pack",
    "uses her: a model that handles the spine flag and the week three pattern",
    "well will handle the straightforward ones.",
  ].join("\n"),
};

export type PackJob = {
  key: string;
  title: string;
  what: string;
  goodNotes: string;
  good: string;
  parserNotes: string;
  bad: { why: string; paste: string }[];
};

export const PACK_JOBS: PackJob[] = [
  {
    key: "blueprint-drafter",
    title: "Blueprint drafter",
    what:
      "Turns the intake into the prose half of a Blueprint: the summary a coach reads before a call, the One Thing, the failure mode and the tone.",
    goodNotes: [
      "Specific to this client rather than to any client. The failure mode names",
      "week three because she did, the One Thing is something she could do",
      "tomorrow and somebody could check, and nothing restates a fact the context",
      "block already carried.",
    ].join("\n"),
    good: JSON.stringify(
      {
        summary:
          "Ekaterina has held 176 for two years and wants the shape of it to change rather than the number. The fusion rules out loaded spinal work, so the lower body is machine and hip dominant. Four days is enough for this, and the thing that will decide it is whether she eats on clinic days.",
        oneThing: "Thirty grams of protein before the first clinic of the day.",
        failureMode:
          "Week three, when a clinic overruns and lunch becomes a coffee. The early sign is two days running with nothing logged before four.",
        toneNotes:
          "Warm, but give her the number. She asks direct questions and expects direct answers.",
        triggers: [],
      },
      null,
      2,
    ),
    parserNotes: [
      "`readBlueprintPaste` parses it strictly and takes the four prose fields.",
      "`triggers` is asked for in the shape so a model does not invent its own key,",
      "and whatever comes back in it is discarded: the portal proposes triggers",
      "from the client's own numbers.",
    ].join("\n"),
    bad: [
      {
        why: "Prose instead of JSON, which is what happens when a model explains itself first",
        paste: "Here is the blueprint you asked for:\n\nEkaterina is a recomposition client...",
      },
      {
        why: "A key missing, usually because the model merged two of them",
        paste: JSON.stringify(
          { summary: "She wants to change shape.", oneThing: "Protein at breakfast." },
          null,
          2,
        ),
      },
      {
        why: "An empty string, which parses as JSON and means nothing on a screen",
        paste: JSON.stringify(
          { summary: "", oneThing: "Protein at breakfast.", failureMode: "Week three." },
          null,
          2,
        ),
      },
    ],
  },
  {
    key: "program-drafter",
    title: "Program drafter",
    what:
      "Writes one line per week explaining what that week is for. The program itself is built by code from the template and the client's flags, so this explains it rather than designing it.",
    goodNotes: [
      "One entry per week, every week, and no exercise named. Substitutions are",
      "explained by the portal from the decision the applier actually made, and a",
      "model's version would disagree with it.",
    ].join("\n"),
    good: JSON.stringify(
      {
        weeks: Array.from({ length: 12 }, (_, index) => ({
          week: index + 1,
          rationale:
            index === 3
              ? "Deload. Volume drops by a third and the calories hold, because the point is to arrive at week five able to add load."
              : `Week ${index + 1}. ${
                  index < 3
                    ? "Build the habit before the load. Four sessions completed matters more than what is on the bar."
                    : index < 7
                      ? "Add load to the hip dominant work while the step goal holds."
                      : "Hold the sessions and let the nutrition do the rest of the work."
                }`,
        })),
      },
      null,
      2,
    ),
    parserNotes: [
      "`readProgramPaste` requires a line for every week of the block. A response",
      "covering eleven of twelve is rejected rather than filled in, because a",
      "missing week would show up on the screen as a blank nobody put there.",
    ].join("\n"),
    bad: [
      {
        why: "Short by a week, which is the most common failure on a twelve week block",
        paste: JSON.stringify(
          { weeks: Array.from({ length: 11 }, (_, index) => ({ week: index + 1, rationale: "A week." })) },
          null,
          2,
        ),
      },
      {
        why: "The array under a different key",
        paste: JSON.stringify({ rationales: [{ week: 1, rationale: "A week." }] }, null, 2),
      },
    ],
  },
  {
    key: "weekly-review",
    title: "Weekly review drafter",
    what:
      "Drafts the Monday card: what to change, why, and the message to the client. The coach accepts, edits or rejects every line.",
    goodNotes: [
      "The three decision rules are the whole job. This week has no flag and no",
      "two week trend, so it proposes the one change her own words point at and",
      "nothing else. A response that changes calories on the strength of a single",
      "bad week is the failure mode to watch for.",
      "",
      "The message is two to five lines, carries real numbers, asks one question,",
      "and contains no dash.",
    ].join("\n"),
    good: JSON.stringify(
      {
        changes: [
          {
            field: "step_goal",
            from: "7000",
            to: "6000",
            reason:
              "Three of seven on steps for two weeks running, and both times it was a clinic day. A goal she hits on a bad day is worth more than one she hits on a good one.",
          },
        ],
        message:
          "Week three: four sessions out of four, which is the part that matters.\nSteps were 3 of 7 and both misses were clinic days.\nI am dropping the step goal to 6,000 so a bad day still counts.\nWhat would make the walk happen on a day a clinic overruns?",
      },
      null,
      2,
    ),
    parserNotes: "",
    bad: [],
  },
];
