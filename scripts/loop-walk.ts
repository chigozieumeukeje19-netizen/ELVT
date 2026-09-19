/**
 * The nine step loop walk.
 *
 * Runs the whole coaching loop once, end to end, against a throwaway database
 * built from the migrations and the synthetic seed, and says what each step
 * did. Every step either passes with a fact behind it or fails with the reason.
 * Nothing here skips: a step that cannot run is a failure, because a skipped
 * step in a final check reads exactly like a passing one.
 *
 * It is not a test of the screens. Playwright covers those. This is the path
 * the data takes, through the real modules, with real rows landing in real
 * tables under the real constraints.
 *
 * The exercise library is the one fixture. The real import is blocked on files
 * only Darren has, and the standing rules forbid seeding placeholder
 * exercises, so the walk inserts tests/fixtures/program.ts into its own
 * throwaway database and says so. That fixture exists precisely because it has
 * a barbell back squat in it, which is the only way step 9 can mean anything.
 */

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { deriveBlueprint, proposeTriggers } from "../src/lib/blueprint/derive";
import { draftProgram } from "../src/lib/blueprint/program-draft";
import { buildDailyForm, buildWeeklyForm, DAILY_MAX, DAILY_MIN } from "../src/lib/checkin/generate";
import { addDays } from "../src/lib/engine/clock";
import {
  scoreDay,
  scoreWeek,
  streakThrough,
  type WeekAdherence,
} from "../src/lib/engine/scoring";
import { planTriggers } from "../src/lib/engine/triggers";
import { planWeekRoll } from "../src/lib/engine/week-roll";
import { auditExport } from "../src/lib/export/audit";
import { generateApp } from "../src/lib/export/generate";
import { generateCaloriePath } from "../src/lib/nutrition/calorie-path";
import {
  adherenceLines,
  applyDecisions,
  pinSpine,
  type ProposedChange,
} from "../src/lib/queue/review-card";
import { INTAKE } from "../src/lib/questionnaire/intake";
import { progress, validate, type Answers } from "../src/lib/questionnaire/answers";
import { raceBriefing } from "../src/lib/race/mode";
import { LIBRARY, TEMPLATE } from "../tests/fixtures/program";
import type { ExportData } from "../src/lib/export/types";

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

const DB = process.env.LOOP_DB ?? "elvt_loop";

const BASE =
  process.env.ELVT_DB_URL ?? readEnvFile("ELVT_DB_URL") ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function readEnvFile(key: string): string | null {
  try {
    const file = execFileSync("cat", [".env.local"], { encoding: "utf8" });
    const line = file.split("\n").find((entry) => entry.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

function urlFor(database: string): string {
  const [withoutQuery, query] = BASE.split("?", 2);
  const base = withoutQuery.slice(0, withoutQuery.lastIndexOf("/"));
  return `${base}/${database}${query ? `?${query}` : ""}`;
}

/** One value back, or "" when the query returned nothing. */
function one(sql: string): string {
  return execFileSync("psql", [urlFor(DB), "-Atc", sql], { encoding: "utf8" }).trim();
}

/** Rows back, tab separated. */
function rows(sql: string): string[][] {
  const out = execFileSync("psql", [urlFor(DB), "-AtF", "\t", "-c", sql], { encoding: "utf8" });
  return out.trim() === "" ? [] : out.trim().split("\n").map((line) => line.split("\t"));
}

function run(sql: string): void {
  execFileSync("psql", [urlFor(DB), "-q", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    stdio: ["ignore", "ignore", "inherit"],
  });
}

/** Single quotes doubled, which is the only escaping these literals need. */
function q(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function json(value: unknown): string {
  return `${q(JSON.stringify(value))}::jsonb`;
}

const results: { step: number; title: string; ok: boolean; detail: string }[] = [];

function step(number: number, title: string, body: () => string): void {
  try {
    const detail = body();
    results.push({ step: number, title, ok: true, detail });
    process.stdout.write(`  [PASS] ${number}. ${title}\n         ${detail}\n`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ step: number, title, ok: false, detail });
    process.stdout.write(`  [FAIL] ${number}. ${title}\n         ${detail}\n`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// ---------------------------------------------------------------------------
// The walk
// ---------------------------------------------------------------------------

process.stdout.write("\nThe nine step loop walk\n=======================\n\n");
process.stdout.write(`Database: ${DB}\n\n`);

/** Monday, so week one starts where the week roll expects it to. */
const START = "2026-09-21";
const exerciseIds = new Map<string, string>();

// The library fixture, into this database only. Named so nobody mistakes these
// rows for the blocked import.
for (const exercise of LIBRARY) {
  const id = randomUUID();
  exerciseIds.set(exercise.id, id);
  run(
    `insert into public.exercises (id, name, aliases, pattern, equipment, unilateral, import_source)
     values (${q(id)}, ${q(exercise.name)}, array[${exercise.aliases.map(q).join(",") || "NULL"}]::text[],
             ${exercise.pattern === null ? "null" : q(exercise.pattern)}, array[${exercise.equipment.map(q).join(",") || "NULL"}]::text[],
             ${exercise.unilateral}, 'loop_walk_fixture')`,
  );
  for (const flag of exercise.contraindications) {
    run(
      `insert into public.exercise_contraindications (exercise_id, flag_key) values (${q(id)}, ${q(flag)})`,
    );
  }
}
for (const exercise of LIBRARY) {
  for (const alternative of exercise.alternatives) {
    const to = exerciseIds.get(alternative.id);
    if (!to) continue;
    run(
      `insert into public.exercise_alternatives (exercise_id, alt_exercise_id, reason)
       values (${q(exerciseIds.get(exercise.id)!)}, ${q(to)}, ${q(alternative.reason)})`,
    );
  }
}

// --- 1 ---------------------------------------------------------------------

const clientId = randomUUID();
let answers: Answers = {};

step(1, "Add a client, send the intake, complete it", () => {
  run(
    `insert into public.clients (id, slug, first_name, last_name, sex, dob, height_cm,
       start_weight, goal_weight, units, status, program_start_date, program_length_weeks,
       primary_goal, goal_statement, timezone, calorie_target, flag_config)
     values (${q(clientId)}, 'loop-walk', 'Ekaterina', 'Vasilyeva-Whitcombe', 'female',
             '1991-02-14', 168, 176.0, 168.0, 'imperial', 'onboarding', ${q(START)}, 12,
             'recomp', 'Hold my weight steady and change the shape of it.',
             'America/New_York', 2150, '{"spine": true}'::jsonb)`,
  );

  const questionnaireId = randomUUID();
  run(
    `insert into public.questionnaires (id, name, kind, sections)
     values (${q(questionnaireId)}, 'Intake', 'intake', ${json(INTAKE.sections)})`,
  );

  // A spinal fusion, which is the flag step 9 turns on.
  answers = {
    primary_goal: "Recomposition, both at once",
    goal_statement: "Hold my weight steady and change the shape of it.",
    goal_weight: 168,
    duration_weeks: "12 weeks",
    done_this_before: true,

    start_weight: 176,
    height_cm: 168,
    dob: "1991-02-14",
    typical_steps: 7000,

    days_per_week: "4",
    preferred_days: ["Monday", "Tuesday", "Thursday", "Friday"],
    session_length: "60 minutes",
    equipment: ["Full gym"],
    travel: "",

    runs_at_all: false,

    tracks_food: "Yes, every day",
    meals_per_day: "4",
    who_cooks: "Me, most days",
    foods_out: "No shellfish",
    alcohol: "One or two",

    sleep_hours: 7,
    sleep_quality: 7,
    stress: 5,
    recovery_habits: ["Walking"],

    current_pain: false,
    injury_areas: ["Lower back or spine"],
    surgery: "Lumbar fusion, 2019",
    cleared: true,
    medical_consent: "Ekaterina Vasilyeva-Whitcombe",

    what_worked: "Lifting three days a week and walking every lunchtime.",
    what_failed: "Anything that needed a 5am alarm. It falls apart in week three.",
    confidence: 8,

    tone: "Encouraging, but honest",
    reminder_time: "Early morning",
    checkin_day: "Sunday",
    accountability: 7,

    one_thing: "Protein at breakfast. I skip it and the whole day misses.",
    biggest_obstacle: "Back-to-back clinics with no lunch break.",
    anything_else: "",
    start_readiness: 5,
  };

  const issues = validate(INTAKE, answers);
  assert(issues.length === 0, `intake refused the answers: ${issues.map((i) => i.key).join(", ")}`);

  run(
    `insert into public.questionnaire_responses (client_id, questionnaire_id, answers, submitted_at)
     values (${q(clientId)}, ${q(questionnaireId)}, ${json(answers)}, now())`,
  );

  const saved = one(
    `select case when submitted_at is null then 'open' else 'submitted' end
       from public.questionnaire_responses where client_id = ${q(clientId)}`,
  );
  assert(saved === "submitted", `the response came back as "${saved}"`);

  const done = progress(INTAKE, answers);
  return `Client created, intake accepted with no validation issues, ${done.answered} of ${done.total} questions answered, response stored as submitted.`;
});

// --- 2 ---------------------------------------------------------------------

const derived = deriveBlueprint(answers);
let blueprintId = "";

step(2, "The Blueprint drafts and the coach approves it in one screen", () => {
  assert(derived.flags.includes("spine"), "the spine flag did not come out of the intake");
  assert(derived.durationWeeks === 12, `duration came out as ${derived.durationWeeks}`);
  assert(derived.runs === false, "running should be off for this client");

  const triggers = proposeTriggers(derived);
  assert(triggers.length > 0, "no triggers were proposed from the answers");

  blueprintId = randomUUID();
  run(
    `insert into public.blueprints (id, client_id, version, status, content)
     values (${q(blueprintId)}, ${q(clientId)}, 1, 'draft', ${json({ derived, triggers })})`,
  );

  // One screen, one action: the approval is a single update.
  run(
    `update public.blueprints set status = 'approved', approved_at = now() where id = ${q(blueprintId)}`,
  );

  const status = one(`select status from public.blueprints where id = ${q(blueprintId)}`);
  assert(status === "approved", `the blueprint is "${status}"`);

  for (const trigger of triggers) {
    run(
      `insert into public.client_triggers (client_id, key, threshold, suggested_message, active)
       values (${q(clientId)}, ${q(trigger.key)}, ${trigger.threshold}, ${q(trigger.suggestedMessage)}, true)`,
    );
  }

  return `Derived a 12 week recomp with the spine flag and running off, proposed ${triggers.length} triggers, approved in one update.`;
});

// --- 3 ---------------------------------------------------------------------

const draft = draftProgram({ derived, template: TEMPLATE, library: LIBRARY, startDate: START });
let programId = "";
const dayIds = new Map<string, string>();
const firstDaySessionExercises: { id: string; name: string }[] = [];

step(3, "The program materializes respecting every flag, and week 12 is the goal state", () => {
  assert(draft.program.weeks.length === 12, `the block came out ${draft.program.weeks.length} weeks`);

  const path = generateCaloriePath({
    weekCount: 12,
    startCalories: 2150,
    endCalories: 2000,
    protein: 150,
    deloadWeeks: draft.program.weeks.filter((w) => w.isDeload).map((w) => w.weekNumber),
    shape: TEMPLATE.caloriePathShape,
  });

  assert(path.length === 12, `the path came out ${path.length} weeks`);
  assert(
    path[11].calories === 2000,
    `week 12 is ${path[11].calories}, not the 2000 goal state`,
  );

  programId = randomUUID();
  run(
    `insert into public.programs (id, client_id, name, duration_weeks, status)
     values (${q(programId)}, ${q(clientId)}, 'Twelve week recomposition', 12, 'active')`,
  );

  for (const week of draft.program.weeks) {
    const weekId = randomUUID();
    const calories = path[week.weekNumber - 1];
    run(
      `insert into public.program_weeks (id, program_id, client_id, week_number, starts_on, is_deload,
         calories, protein, carbs, fat)
       values (${q(weekId)}, ${q(programId)}, ${q(clientId)}, ${week.weekNumber}, ${q(week.startsOn)},
               ${week.isDeload}, ${calories.calories}, ${calories.protein}, ${calories.carbs}, ${calories.fat})`,
    );

    for (const day of week.days) {
      const dayId = randomUUID();
      dayIds.set(day.date, dayId);
      run(
        `insert into public.program_days (id, program_week_id, client_id, date, day_of_week, is_rest)
         values (${q(dayId)}, ${q(weekId)}, ${q(clientId)}, ${q(day.date)}, ${day.dayOfWeek}, ${day.isRest})`,
      );

      for (const [index, session] of day.sessions.entries()) {
        const sessionId = randomUUID();
        run(
          `insert into public.sessions (id, program_day_id, client_id, kind, name, "order", from_template)
           values (${q(sessionId)}, ${q(dayId)}, ${q(clientId)}, ${q(session.kind)}, ${q(session.name)}, ${index}, true)`,
        );

        const sectionId = randomUUID();
        run(
          `insert into public.session_sections (id, session_id, client_id, type, "order")
           values (${q(sectionId)}, ${q(sessionId)}, ${q(clientId)}, 'regular', 0)`,
        );

        for (const [position, exercise] of session.exercises.entries()) {
          const rowId = randomUUID();
          const libraryId = exerciseIds.get(exercise.exerciseId);
          assert(libraryId !== undefined, `${exercise.name} is not in the library`);
          run(
            `insert into public.session_exercises (id, section_id, client_id, exercise_id, "order", sets, tracking_fields)
             values (${q(rowId)}, ${q(sectionId)}, ${q(clientId)}, ${q(libraryId!)}, ${position},
                     ${json(exercise.sets)}, array['reps','weight']::text[])`,
          );
          if (day.date === START) firstDaySessionExercises.push({ id: rowId, name: exercise.name });
        }
      }
    }
  }

  const dayCount = Number(one(`select count(*) from public.program_days where client_id = ${q(clientId)}`));
  assert(dayCount === 84, `the block wrote ${dayCount} days, not 84`);

  // Asserted after the rows land, not before. The steps below read what was
  // written, and an assertion that aborts the write turns one failure into
  // seven and hides which one is real.
  const substitutions = draft.explained.filter((entry) => entry.kind === "substitution");
  assert(substitutions.length > 0, "nothing was substituted for a client with a spinal fusion");

  return `84 days written, ${substitutions.length} substitutions explained, calorie path ${path[0].calories} to ${path[11].calories} with week 12 equal to the goal state.`;
});

// --- 4 ---------------------------------------------------------------------

let dailyFormId = "";

step(4, "The client sees day one, logs a session with weights, and submits the daily check-in", () => {
  const dayOne = rows(
    `select s.id, s.name, s.kind from public.sessions s
      join public.program_days d on d.id = s.program_day_id
     where d.date = ${q(START)} and s.client_id = ${q(clientId)}`,
  );
  assert(dayOne.length > 0, "day one has no session on it");
  assert(firstDaySessionExercises.length > 0, "day one's session has no movements");

  // Every logged set stores the prescription beside the result.
  let logged = 0;
  for (const exercise of firstDaySessionExercises) {
    const prescribed = JSON.parse(
      one(`select sets from public.session_exercises where id = ${q(exercise.id)}`),
    ) as { set: number; reps?: number }[];

    for (const set of prescribed) {
      // The prescription beside the result, which is the whole point of the
      // two columns: "3 x 10 at 95" is only meaningful next to what was asked.
      run(
        `insert into public.set_logs (session_exercise_id, client_id, set_number,
           prescribed, actual, logged_for_date)
         values (${q(exercise.id)}, ${q(clientId)}, ${set.set},
                 ${json(set)}, ${json({ reps: set.reps ?? 8, weight: 95 })}, ${q(START)})`,
      );
      logged += 1;
    }
  }
  assert(logged > 0, "no sets were logged");

  run(
    `update public.sessions set status = 'done', completed_at = now()
      where id = ${q(dayOne[0][0])}`,
  );

  run(
    `insert into public.daily_logs (client_id, date, steps, sleep_hours, weight, energy, session_status)
     values (${q(clientId)}, ${q(START)}, 8200, 7.5, 176.0, 4, 'done')`,
  );

  // The daily form is the real one out of the bank, not a hand written list.
  const form = buildDailyForm({
    goal: derived.goalType,
    flags: derived.flags,
    running: derived.runs,
  });
  assert(
    form.length >= DAILY_MIN && form.length <= DAILY_MAX,
    `the daily form came out ${form.length} questions`,
  );

  dailyFormId = randomUUID();
  run(
    `insert into public.checkin_forms (id, client_id, kind, questions, auto_send)
     values (${q(dailyFormId)}, ${q(clientId)}, 'daily', ${json(form.map((entry) => entry.key))}, true)`,
  );
  run(
    `insert into public.checkin_submissions (form_id, client_id, for_date, answers, submitted_at)
     values (${q(dailyFormId)}, ${q(clientId)}, ${q(START)},
             ${json({ daily_session: "done", daily_sleep: 7.5, daily_energy: 4, daily_steps: 8200 })}, now())`,
  );

  const stored = Number(one(`select count(*) from public.set_logs where client_id = ${q(clientId)}`));
  const withPrescription = Number(
    one(`select count(*) from public.set_logs where client_id = ${q(clientId)} and prescribed <> '{}'::jsonb`),
  );
  assert(stored === withPrescription, `${stored - withPrescription} logged sets kept no prescription`);

  // The weights are the ones a client's scoring_config carries. A day is
  // scored out of what was assigned, not out of a fixed hundred.
  const score = scoreDay(START, [
    { key: "training", weight: 3, done: true },
    { key: "calories", weight: 2, done: true },
    { key: "steps", weight: 1, done: true },
    { key: "sleep", weight: 1, done: true },
  ]);
  assert(Number.isFinite(score.score), `the day scored ${score.score}`);

  return `Day one served a session, ${stored} sets logged with the prescription beside each result, daily form of ${form.length} questions submitted, day scored ${score.score}.`;
});

// --- 5 ---------------------------------------------------------------------

const adherence: WeekAdherence = {
  training: { done: 4, planned: 4 },
  calories: { done: 6, planned: 7 },
  steps: { done: 5, planned: 7 },
  sleep: { done: 6, planned: 7 },
  checkin: { done: 6, planned: 7 },
};

let weeklyFormDate = "";

step(5, "The week rolls Sunday night, score and streak compute, the weekly form arrives", () => {
  const weekRows = rows(
    `select id, week_number, starts_on, is_deload, coalesce(planned_mileage, 0)
       from public.program_weeks where client_id = ${q(clientId)} order by week_number`,
  );

  const dailyScores = Array.from({ length: 7 }, (_, offset) => ({
    date: addDays(START, offset),
    score: 88 - offset,
  }));

  const plan = planWeekRoll(
    {
      // 23:59 on the client's Sunday, in New York, is 03:59 UTC on the Monday.
      instant: new Date("2026-09-28T03:59:00Z"),
      client: { id: clientId, slug: "loop-walk", name: "Ekaterina", timezone: "America/New_York" },
      programId,
      weeks: weekRows.map((row) => ({
        id: row[0],
        weekNumber: Number(row[1]),
        startsOn: row[2],
        isDeload: row[3] === "t",
        plannedMileage: Number(row[4]),
        snapshot: null,
      })),
      weekNumber: 1,
      adherence,
      scoringWeights: { training: 3, calories: 2, steps: 1, sleep: 1, checkin: 1 },
      dailyScores,
      weights: [{ date: START, weight: 176 }, { date: addDays(START, 6), weight: 175.2 }],
      completedMileage: {},
      spineVariable: null,
      spineChangeId: null,
      existing: { dailyFormDates: [], weeklyFormDates: [], eventKeys: [], queueKeys: [] },
    },
    null,
  );

  assert(plan.skipped === null, `the roll declined to run: ${plan.skipped}`);

  const snapshot = plan.writes.find((write) => write.kind === "snapshot");
  assert(snapshot !== undefined, "the week was not snapshotted");

  const weekly = plan.writes.find((write) => write.kind === "weekly_form");
  assert(weekly !== undefined, "no weekly form was written");
  weeklyFormDate = (weekly as { forDate: string }).forDate;

  const score = scoreWeek(adherence, { training: 3, calories: 2, steps: 1, sleep: 1, checkin: 1 });
  assert(score.score > 0, "the week scored zero");

  const streak = streakThrough(dailyScores);
  assert(streak === 7, `the streak came out ${streak}, not 7`);

  // The weekly form the client actually receives. Weight is question one.
  const form = buildWeeklyForm(
    { goal: derived.goalType, flags: derived.flags, running: derived.runs },
    { spineVariable: null, isFirstWeek: true },
  );
  assert(
    form.questions[0].produces?.includes("weight") === true ||
      form.questions[0].key.includes("weight"),
    `question one is "${form.questions[0].key}", not the weigh-in`,
  );

  for (const write of plan.writes) {
    if (write.kind === "week_score") {
      run(
        `update public.program_weeks set elvt_score = ${write.score}, adherence = ${json(write.adherence)}
          where id = ${q(write.weekId)}`,
      );
    }
    if (write.kind === "snapshot") {
      run(
        `update public.program_weeks set snapshot = ${json(write.snapshot)} where id = ${q(write.weekId)}`,
      );
    }
    if (write.kind === "queue_item") {
      // The idempotency key travels in the detail blob, which is where the
      // week roll's own persistence puts it and where it reads it back from.
      run(
        `insert into public.queue_items (client_id, kind, severity, title, detail)
         values (${q(clientId)}, ${q(write.kind_)}, ${write.severity}, ${q(write.title)},
                 ${json({ ...write.detail, key: write.key })})`,
      );
    }
  }

  const rolled = one(`select elvt_score from public.program_weeks where client_id = ${q(clientId)} and week_number = 1`);
  assert(rolled !== "", "no score landed on week one");

  return `Rolled at 23:59 local, ${plan.writes.length} writes, week scored ${score.score} with ${score.focus ?? "no"} focus, streak 7, weekly form for ${weeklyFormDate} with the weigh-in first.`;
});

// --- 6 ---------------------------------------------------------------------

step(6, "The Monday queue shows the card, and Accept All applies it", () => {
  const queued = rows(
    `select id, title, detail ->> 'key' from public.queue_items
      where client_id = ${q(clientId)} and kind = 'monday_review'`,
  );
  assert(queued.length === 1, `the queue holds ${queued.length} Monday cards, not one`);

  const lines = adherenceLines(adherence);
  assert(lines.length === 5, `the card shows ${lines.length} adherence lines, not five`);
  assert(
    lines.every((line) => line.planned === 0 || line.percent !== null),
    "a planned category came back with no percentage",
  );

  // The check-in, with the spine question pinned.
  const checkin = pinSpine([
    { key: "weekly_adherence", question: "How did the week go?", answer: "Good, missed one walk", isSpine: false },
    { key: "weekly_step_goal", question: "Did the step goal work?", answer: "Yes, easier than I expected", isSpine: true },
  ]);
  assert(checkin[0].isSpine, "the spine question is not first");

  const changes: ProposedChange[] = [
    { id: "c1", field: "calories", label: "Calories", from: "2150", to: "2100",
      reason: "Weight is flat over two weeks.", decision: "accept" },
    { id: "c2", field: "step_goal", label: "Step goal", from: "7000", to: "8000",
      reason: "They said the goal was easy.", decision: "edit", editedTo: "7500" },
    { id: "c3", field: "session_order", label: "Session order", from: "Lower A first", to: "Upper A first",
      reason: "Back is stiffer on Mondays.", decision: "reject" },
  ];

  const applied = applyDecisions(changes);
  assert(applied.length === 2, `Accept All applied ${applied.length} changes, not two`);
  assert(applied.find((change) => change.field === "step_goal")?.to === "7500",
    "the edited line did not carry the coach's value");

  for (const change of applied) {
    run(
      `insert into public.plan_changes (client_id, week_number, field, from_value, to_value, reason, source, status)
       values (${q(clientId)}, 2, ${q(change.field)}, ${q(change.from)}, ${q(change.to)},
               ${q(change.reason)}, ${q(change.source)}, 'applied')`,
    );
  }

  const threadId = randomUUID();
  run(`insert into public.threads (id, client_id, subject) values (${q(threadId)}, ${q(clientId)}, 'Week 1 review')`);
  run(
    `insert into public.messages (thread_id, client_id, kind, touchpoint, body, sent_at)
     values (${q(threadId)}, ${q(clientId)}, 'text', true,
             ${q("Week one is done. Training 4 of 4, steps 5 of 7. Calories go to 2,100 because the scale has not moved in two weeks. What made the step days you missed different?")}, now())`,
  );

  run(`update public.queue_items set status = 'done' where id = ${q(queued[0][0])}`);

  const stored = Number(one(`select count(*) from public.plan_changes where client_id = ${q(clientId)} and status = 'applied'`));
  const sent = Number(one(`select count(*) from public.messages where client_id = ${q(clientId)} and sent_at is not null`));
  const closed = one(`select status from public.queue_items where id = ${q(queued[0][0])}`);

  assert(stored === 2 && sent === 1 && closed === "done",
    `Accept All left ${stored} changes, ${sent} messages and a "${closed}" card`);

  const rejected = changes.filter((change) => change.decision === "reject").length;
  return `One card, five adherence lines, spine question pinned first, ${applied.length} of ${changes.length} changes applied and ${rejected} rejected, message sent, card closed.`;
});

// --- 7 ---------------------------------------------------------------------

step(7, "A trigger fires and its suggested message is waiting", () => {
  const triggers = rows(
    `select key, threshold, suggested_message from public.client_triggers
      where client_id = ${q(clientId)} and active = true`,
  );
  assert(triggers.length > 0, "the client has no triggers");

  const stepTrigger = triggers.find((row) => row[0] === "steps_low");
  assert(stepTrigger !== undefined, `no step trigger among ${triggers.map((row) => row[0]).join(", ")}`);

  // Two days under the goal, which is the consecutive-days rule.
  const days = Array.from({ length: 14 }, (_, offset) => {
    const date = addDays("2026-09-15", offset);
    const short = date === "2026-09-27" || date === "2026-09-28";
    return {
      date,
      steps: short ? 3200 : 8200,
      sleepHours: 7.5,
      weight: 176,
      sessionStatus: "done" as const,
      hadActivity: true,
      mealsLogged: 4,
      checkinSubmitted: true,
    };
  });

  const plan = planTriggers({
    instant: new Date("2026-09-29T01:05:00Z"), // 21:05 on the 28th in New York.
    client: { id: clientId, slug: "loop-walk", name: "Ekaterina", timezone: "America/New_York" },
    triggers: triggers.map((row) => ({
      key: row[0],
      threshold: Number(row[1]),
      suggestedMessage: row[2],
      active: true,
    })),
    days,
    existingQueueKeys: [],
    lastRunLocalDate: null,
  });

  assert(plan.skipped === null, `the trigger run declined: ${plan.skipped}`);
  assert(plan.fired.length > 0, "nothing fired on two days under the step goal");

  const fired = plan.fired[0];
  assert(fired.suggestedMessage.trim().length > 0, `${fired.key} fired with no suggested message`);

  for (const item of plan.fired) {
    run(
      `insert into public.queue_items (client_id, kind, severity, title, detail, suggested_action)
       values (${q(clientId)}, ${q(item.kind === "retention_risk" ? "retention_risk" : "trigger")},
               ${item.severity}, ${q(item.title)},
               ${json({ ...item.detail, key: item.key })},
               ${json({ message: item.suggestedMessage })})`,
    );
  }

  // Run again on the same evening. Idempotency is the thing that makes a
  // minute-by-minute scheduler safe.
  const second = planTriggers({
    instant: new Date("2026-09-29T01:20:00Z"),
    client: { id: clientId, slug: "loop-walk", name: "Ekaterina", timezone: "America/New_York" },
    triggers: triggers.map((row) => ({ key: row[0], threshold: Number(row[1]), suggestedMessage: row[2], active: true })),
    days,
    existingQueueKeys: [],
    lastRunLocalDate: plan.localDate,
  });
  assert(second.fired.length === 0, `a second run on the same evening fired ${second.fired.length} more`);

  const waiting = Number(
    one(`select count(*) from public.queue_items
          where client_id = ${q(clientId)} and kind = 'trigger'
            and suggested_action ->> 'message' is not null`),
  );
  assert(waiting > 0, "the fired trigger reached the queue without a message");

  return `${fired.key} fired on ${plan.localDate} after two days under the goal, message waiting in the queue, a second run on the same evening added nothing.`;
});

// --- 8 ---------------------------------------------------------------------

step(8, "Every audit passes on the generated client app, legacy saved state included", () => {
  const weekRows = rows(
    `select week_number, starts_on, is_deload, calories, protein, carbs, fat
       from public.program_weeks where client_id = ${q(clientId)} order by week_number limit 2`,
  );
  assert(weekRows.length === 2, "not enough weeks to build an app from");

  const data: ExportData = {
    client: {
      id: clientId,
      slug: "loop-walk",
      firstName: "Ekaterina",
      lastName: "Vasilyeva-Whitcombe",
      units: "imperial",
      timezone: "America/New_York",
    },
    program: {
      name: "Twelve week recomposition",
      startDate: START,
      weeks: 12,
      goalStatement: derived.goalStatement,
    },
    races: [
      raceBriefing(
        { id: "r1", name: "Loop Walk Half", date: "2026-12-13", metres: 21097, goalTimeSeconds: 6900, notes: null },
        null,
      ),
    ],
    weeks: weekRows.map((week) => ({
      weekNumber: Number(week[0]),
      startsOn: week[1],
      isDeload: week[2] === "t",
      phase: "Build",
      calories: Number(week[3]),
      protein: Number(week[4]),
      carbs: Number(week[5]),
      fat: Number(week[6]),
      plannedMileage: null,
      days: Array.from({ length: 7 }, (_, offset) => ({
        date: addDays(week[1], offset),
        dayOfWeek: (new Date(`${week[1]}T00:00:00Z`).getUTCDay() + offset) % 7,
        isRest: offset === 2 || offset === 6,
        calories: null,
        protein: null,
        sessions:
          offset === 0
            ? [
                {
                  id: `session-${week[0]}`,
                  kind: "strength" as const,
                  name: "Lower A",
                  exercises: [
                    {
                      id: "goblet",
                      name: "Goblet Squat",
                      youtubeId: "dQw4w9WgXcQ",
                      cues: ["Elbows inside the knees", "Chest tall"],
                      logsWeight: true,
                      sets: [
                        { set: 1, reps: 10, rest: 90 },
                        { set: 2, reps: 10, rest: 90 },
                        { set: 3, reps: 10, rest: 90 },
                      ],
                    },
                  ],
                },
              ]
            : [],
      })),
    })),
    meals: [],
    habits: [],
    reference: [],
    apiBase: "https://portal.example/api/v1",
    generatedAt: new Date().toISOString(),
  };

  const html = generateApp(data);
  const findings = auditExport(html);
  assert(findings.length === 0, `${findings.length} findings: ${findings.map((f) => f.rule).join("; ")}`);

  // The legacy case by name: defaults first, then the saved state over them.
  assert(/Object\.assign\(\s*defaults\s*,\s*saved\s*\)/.test(html),
    "the app does not merge saved state over defaults");

  const audits = new Set(findings.map((finding) => finding.audit));
  return `File generated at ${(html.length / 1024).toFixed(0)} KB, every audit clean (${audits.size} findings), and the legacy saved state merge is in the file.`;
});

// --- 9 ---------------------------------------------------------------------

step(9, "The spinal fusion client receives no barbell back squat across all 84 days", () => {
  const backSquat = exerciseIds.get("back-squat");
  assert(backSquat !== undefined, "the library fixture has no barbell back squat to avoid");

  const days = Number(one(`select count(*) from public.program_days where client_id = ${q(clientId)}`));
  assert(days === 84, `the block is ${days} days, so this cannot be a claim about 84`);

  // Read out of the database rather than the materialized object, because the
  // rows are what a client is served.
  const found = Number(
    one(
      `select count(*) from public.session_exercises where client_id = ${q(clientId)}
         and exercise_id = ${q(backSquat!)}`,
    ),
  );
  assert(found === 0, `the back squat appears ${found} times`);

  // Nor anything else the spine flag rules out.
  const contraindicated = rows(
    `select e.name, count(*) from public.session_exercises se
       join public.exercises e on e.id = se.exercise_id
       join public.exercise_contraindications c on c.exercise_id = e.id
      where se.client_id = ${q(clientId)} and c.flag_key = 'spine'
      group by e.name`,
  );
  assert(
    contraindicated.length === 0,
    `spine flagged movements reached the program: ${contraindicated.map((row) => `${row[0]} x${row[1]}`).join(", ")}`,
  );

  const placed = Number(one(`select count(*) from public.session_exercises where client_id = ${q(clientId)}`));
  const swapped = draft.explained.filter((entry) => entry.kind === "substitution").length;

  return `${placed} movements across 84 days, zero of them contraindicated for the spine, ${swapped} substitutions made and explained.`;
});

// ---------------------------------------------------------------------------

const failed = results.filter((result) => !result.ok);
process.stdout.write(
  `\n${results.length - failed.length} of ${results.length} steps passed.\n`,
);

if (failed.length > 0) {
  process.stdout.write(`\nFailed: ${failed.map((result) => result.step).join(", ")}\n`);
  process.exit(1);
}

process.stdout.write("\nThe loop walks end to end.\n");
