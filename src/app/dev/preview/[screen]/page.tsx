import { notFound } from "next/navigation";
import { BuilderNav } from "@/components/BuilderNav";
import { ExerciseTable } from "@/components/ExerciseTable";
import { DayGrid } from "@/components/program/DayGrid";
import { PeriodizationGrid } from "@/components/program/PeriodizationGrid";
import { StressRail } from "@/components/program/StressRail";
import { WeekActions } from "@/components/program/WeekActions";
import { WeekStrip } from "@/components/program/WeekStrip";
import { RosterTable } from "@/components/RosterTable";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Sidebar } from "@/components/Sidebar";
import {
  DENSE_ROSTER,
  SEED_EXERCISES,
  SEED_QUEUE,
  SEED_ROSTER,
  STRESS_EXERCISES,
  STRESS_ROSTER,
} from "@/lib/design/preview-fixtures";
import { ComposerPreview } from "@/components/messages/ComposerPreview";
import { ReminderSettings } from "@/components/reminders/ReminderSettings";
import {
  PREVIEW_REMINDERS,
  PREVIEW_REMINDERS_SPARSE,
} from "@/lib/design/preview-reminders";
import { ThreadList } from "@/components/messages/ThreadView";
import {
  PREVIEW_COMPOSER_THIN,
  PREVIEW_COMPOSER_VALUES,
  PREVIEW_THREADS,
} from "@/lib/design/preview-messages";
import { quietestFirst } from "@/lib/messages/touchpoints";
import { MondayCard } from "@/components/queue/MondayCard";
import { PREVIEW_CARD, PREVIEW_CARDS, PREVIEW_CARD_QUIET } from "@/lib/design/preview-monday";
import { QueueLanes } from "@/components/queue/QueueLanes";
import { PREVIEW_QUEUE_ONE_LANE, PREVIEW_QUEUE_ROWS } from "@/lib/design/preview-queue";
import { CompareView } from "@/components/checkin/CompareView";
import { ReviewThread } from "@/components/checkin/ReviewThread";
import { SubmissionList } from "@/components/checkin/SubmissionList";
import {
  PREVIEW_BANK,
  PREVIEW_COMPARE,
  PREVIEW_COMPARE_WEEKS,
  PREVIEW_DAILY_FORM,
  PREVIEW_NO_SPINE_FORM,
  PREVIEW_SUBMISSIONS,
  PREVIEW_THREAD,
  PREVIEW_WEEK1_FORM,
  PREVIEW_WEEKLY_FORM,
} from "@/lib/design/preview-checkin";
import { humanize } from "@/components/Field";
import { BlueprintView } from "@/components/blueprint/BlueprintView";
import { DecisionList } from "@/components/blueprint/DecisionList";
import { WeekRationale } from "@/components/blueprint/WeekRationale";
import {
  PREVIEW_BLUEPRINT,
  PREVIEW_BLUEPRINT_EMPTY,
  PREVIEW_PROGRAM_DRAFT,
} from "@/lib/design/preview-blueprint";
import { IntakeSectionPreview } from "@/components/intake/IntakeSectionPreview";
import { QuestionnaireOutline } from "@/components/questionnaire/QuestionnaireOutline";
import { INTAKE } from "@/lib/questionnaire/intake";
import { visible } from "@/lib/questionnaire/answers";
import {
  PREVIEW_INTAKE_ANSWERS,
  PREVIEW_INTAKE_ERRORS,
} from "@/lib/design/preview-intake";
import { CaloriePathTable } from "@/components/nutrition/CaloriePathTable";
import { GroceryHub } from "@/components/nutrition/GroceryHub";
import { MealPlanEditor } from "@/components/nutrition/MealPlanEditor";
import { SwapList } from "@/components/nutrition/SwapList";
import {
  PREVIEW_CURRENT_WEEK,
  PREVIEW_GROCERY,
  PREVIEW_PATH,
  PREVIEW_PATH_MIXED,
  PREVIEW_REST_MEALS,
  PREVIEW_REST_TARGET,
  PREVIEW_SWAPS,
  PREVIEW_TRAINING_MEALS,
  PREVIEW_TRAINING_TARGET,
} from "@/lib/design/preview-nutrition";
import {
  PREVIEW_FLAGGED_WEEK,
  PREVIEW_PROGRAM,
  PREVIEW_PROGRAM_ROWS,
} from "@/lib/design/preview-program";

/**
 * Preview routes for the visual and density pass.
 *
 * These render the real components with the seed fixtures so the layout can be
 * measured without a live Supabase session. They exist for the same reason a
 * component workbench does: the screens have to be checked against the longest
 * real string and the empty state, and waiting on a signed in session to do
 * that means it never gets done.
 *
 * They are not a way in. Nothing here reads the database, nothing here takes a
 * parameter that reaches one, and every route returns 404 unless
 * ENABLE_DESIGN_PREVIEW is explicitly set to 1. That flag is set by the
 * Playwright visual project and by nothing else; a test asserts the deploy
 * config never sets it.
 */

export const dynamic = "force-dynamic";

const SCREENS = [
  "roster",
  "roster-stress",
  "roster-dense",
  "roster-empty",
  "queue",
  "queue-empty",
  "builder-exercises",
  "builder-exercises-stress",
  "builder-exercises-empty",
  "program-week",
  "program-week-flagged",
  "program-periodization",
  "nutrition-path",
  "nutrition-path-empty",
  "nutrition-meals",
  "nutrition-meals-rest",
  "nutrition-grocery",
  "nutrition-swaps",
  "nutrition-swaps-empty",
  "intake-goals",
  "intake-medical",
  "intake-medical-errors",
  "intake-running-hidden",
  "builder-questionnaire",
  "builder-questionnaire-empty",
  "blueprint",
  "blueprint-empty",
  "program-draft",
  "program-draft-empty",
  "checkins",
  "checkins-empty",
  "checkin-compare",
  "checkin-thread",
  "checkin-thread-empty",
  "builder-question-bank",
  "checkin-daily-form",
  "checkin-weekly-form",
  "checkin-week1-form",
  "checkin-no-spine-form",
  "queue-lanes",
  "queue-lanes-one",
  "queue-lanes-empty",
  "monday-card",
  "monday-card-quiet",
  "monday-cards",
  "messages",
  "messages-empty",
  "composer",
  "composer-thin",
  "reminders",
  "reminders-sparse",
] as const;

type Screen = (typeof SCREENS)[number];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink">
      <Sidebar current="/coach/clients" queueCount={SEED_QUEUE.length} />
      {/*
        A deterministic ready signal for the visual suite. Waiting on network
        idle is unreliable in Next: a font request, a prefetch or a socket can
        keep the network busy forever, and the test hangs until its timeout
        rather than failing. Waiting on a element the screen must render is
        exact.
      */}
      <div className="pl-rail lg:pl-sidebar" data-testid="screen-ready">
        {children}
      </div>
    </div>
  );
}

function RosterScreen({ rows, label }: { rows: typeof SEED_ROSTER; label: string }) {
  return (
    <Shell>
      <main className="px-5 py-4">
        <p className="elvt-label">Roster</p>
        <h1 className="mt-1 text-section">{label}</h1>
        <div className="mt-4">
          <RosterTable rows={rows} />
        </div>
      </main>
    </Shell>
  );
}

function QueueScreen({ items }: { items: typeof SEED_QUEUE }) {
  return (
    <Shell>
      <main className="px-5 py-4">
        <p className="elvt-label">Queue</p>
        <h1 className="elvt-num mt-1 text-hero" data-testid="queue-count">
          {items.length}
        </h1>
        <p className="text-txt-mute">
          {items.length === 1 ? "item open" : "items open"}
        </p>

        {items.length === 0 ? (
          <p className="mt-5 max-w-[60ch] text-txt-mute" data-testid="queue-empty">
            Nothing is waiting on you. Triggers run at 21:00 in each client&apos;s
            timezone, and the week rolls Sunday night, so the next cards land
            Monday morning.
          </p>
        ) : (
          <ul className="mt-5" data-testid="queue-list">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex h-row items-center gap-4 border-line [border-top-width:1px]"
                data-testid="queue-item"
              >
                <span
                  aria-hidden="true"
                  className={[
                    "h-row w-1",
                    item.severity >= 4
                      ? "bg-flag"
                      : item.severity >= 3
                        ? "bg-watch"
                        : "bg-line",
                  ].join(" ")}
                />
                <span className="w-[110px] shrink-0 truncate text-txt lg:w-[180px]">{item.client}</span>
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <span className="elvt-label hidden shrink-0 pr-3 lg:inline">
                  {item.kind.replace(/_/g, " ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </Shell>
  );
}

function ExerciseLibraryScreen({
  rows,
}: {
  rows: typeof SEED_EXERCISES;
}) {
  return (
    <Shell>
      <main className="px-5 py-4">
        <BuilderNav current="/coach/builder/exercises" />
        <ScreenHeader label="Builder" title={`${rows.length} movements`} />
        <ExerciseTable rows={rows} />
      </main>
    </Shell>
  );
}

function ProgramScreen({
  weekNumber,
}: {
  weekNumber: number;
}) {
  const view = PREVIEW_PROGRAM;
  const week = view.weeks.find((w) => w.weekNumber === weekNumber) ?? view.weeks[0];

  return (
    <Shell>
      <main className="px-5 py-4">
        <ScreenHeader
          label="Program"
          title="Theo Vance"
          note={`Marathon build, week ${week.weekNumber} of ${view.weeks.length}`}
        />
        <WeekStrip
          weeks={view.weeks}
          currentWeek={week.weekNumber}
          hrefFor={(n) => `/dev/preview/program-week?week=${n}`}
        />
        <div className="mt-4 flex gap-5">
          <div className="min-w-0 flex-1">
            <DayGrid week={week} peakDayStress={view.peakDayStress} readOnly />
            <WeekActions
              weekNumber={week.weekNumber}
              weekCount={view.weeks.length}
              isDeload={week.isDeload}
            />
          </div>
          <StressRail week={week} />
        </div>
      </main>
    </Shell>
  );
}

function PeriodizationScreen() {
  return (
    <Shell>
      <main className="px-5 py-4">
        <ScreenHeader label="Program" title="Periodization" />
        <PeriodizationGrid
          rows={PREVIEW_PROGRAM_ROWS}
          weekCount={PREVIEW_PROGRAM.weeks.length}
          currentWeek={2}
        />
      </main>
    </Shell>
  );
}

function NutritionPathScreen({ path }: { path: typeof PREVIEW_PATH }) {
  return (
    <Shell>
      <main className="px-5 py-4">
        <ScreenHeader
          label="Nutrition"
          title="Ekaterina Vasilyeva-Whitcombe"
          note="Twelve week recomposition, front loaded"
        />
        <CaloriePathTable path={path} currentWeek={PREVIEW_CURRENT_WEEK} />
      </main>
    </Shell>
  );
}

function NutritionMealsScreen({ rest }: { rest: boolean }) {
  const target = rest ? PREVIEW_REST_TARGET : PREVIEW_TRAINING_TARGET;
  const meals = rest ? PREVIEW_REST_MEALS : PREVIEW_TRAINING_MEALS;

  return (
    <Shell>
      <main className="px-5 py-4">
        <ScreenHeader
          label="Nutrition"
          title={rest ? "Rest day" : "Training day"}
          note={`Week ${PREVIEW_CURRENT_WEEK}`}
        />
        <MealPlanEditor
          meals={meals}
          dayCalories={target.calories}
          dayProtein={target.protein}
          basis={target.basis}
        />
      </main>
    </Shell>
  );
}

function NutritionGroceryScreen() {
  return (
    <Shell>
      <main className="px-5 py-4">
        <ScreenHeader label="Nutrition" title="Grocery list" />
        <GroceryHub
          lines={PREVIEW_GROCERY}
          weekCalories={PREVIEW_PATH[PREVIEW_CURRENT_WEEK - 1].calories}
          planCalories={PREVIEW_PATH[0].calories}
        />
      </main>
    </Shell>
  );
}

function NutritionSwapScreen({ groups }: { groups: typeof PREVIEW_SWAPS }) {
  return (
    <Shell>
      <main className="px-5 py-4">
        <ScreenHeader label="Nutrition" title="Swaps" />
        <SwapList groups={groups} />
      </main>
    </Shell>
  );
}

/**
 * The intake sections, rendered with the real question components.
 *
 * Not inside the Shell: a client filling this in has no sidebar and is holding
 * a phone. The 390px run is the one that matters here.
 */
function IntakeScreen({
  sectionKey,
  answers,
  errors,
}: {
  sectionKey: string;
  answers: typeof PREVIEW_INTAKE_ANSWERS;
  errors?: Record<string, string>;
}) {
  const shown = visible(INTAKE, answers);
  const section = shown.sections.find((candidate) => candidate.key === sectionKey)!;

  return (
    <div className="min-h-screen bg-ink">
      <div
        className="mx-auto w-full max-w-[560px] px-4 py-5"
        data-testid="screen-ready"
      >
        <p className="elvt-label">ELVT intake</p>
        <h1 className="mt-1 text-section">{section.title}</h1>
        <p className="mt-2 text-txt-mute">{section.intent}</p>

        <IntakeSectionPreview section={section} answers={answers} errors={errors} />
      </div>
    </div>
  );
}

function QuestionnaireBuilderScreen({ empty }: { empty: boolean }) {
  return (
    <Shell>
      <main className="px-5 py-4">
        <BuilderNav current="/coach/builder/questionnaires" />
        <ScreenHeader label="Builder" title={empty ? "New questionnaire" : INTAKE.name} />
        <QuestionnaireOutline
          questionnaire={empty ? { ...INTAKE, sections: [] } : INTAKE}
        />
      </main>
    </Shell>
  );
}

function BlueprintScreen({ blueprint }: { blueprint: typeof PREVIEW_BLUEPRINT }) {
  return (
    <Shell>
      <main className="px-5 py-4">
        <ScreenHeader
          label="Blueprint"
          title="Ekaterina Vasilyeva-Whitcombe"
          note="Version 2, in draft"
        />
        <BlueprintView blueprint={blueprint} />
      </main>
    </Shell>
  );
}

function ProgramDraftScreen({ withRationale }: { withRationale: boolean }) {
  const draft = PREVIEW_PROGRAM_DRAFT;
  return (
    <Shell>
      <main className="px-5 py-4">
        <ScreenHeader
          label="Program draft"
          title="Ekaterina Vasilyeva-Whitcombe"
          note={`${draft.program.weeks.length} weeks, from the blueprint and the hybrid template`}
        />

        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="elvt-label">What the applier changed, and why</h2>
            <div className="mt-2">
              <DecisionList decisions={draft.explained} />
            </div>
          </section>

          <section>
            <h2 className="elvt-label">What each week is for</h2>
            <div className="mt-2">
              <WeekRationale
                rationale={withRationale ? draft.rationale : []}
                weekCount={draft.program.weeks.length}
              />
            </div>
          </section>
        </div>
      </main>
    </Shell>
  );
}

function CheckinsScreen({ rows }: { rows: typeof PREVIEW_SUBMISSIONS }) {
  return (
    <Shell>
      <main className="px-5 py-4">
        <ScreenHeader
          label="Check-ins"
          title="Ekaterina Vasilyeva-Whitcombe"
          note="This week's form is built around calories, which is what changed last Monday"
        />
        <SubmissionList rows={rows} />
      </main>
    </Shell>
  );
}

function CompareScreen() {
  return (
    <Shell>
      <main className="px-5 py-4">
        <ScreenHeader label="Check-ins" title="The same question, week by week" />
        <p className="mb-3 text-txt-dim">
          One bad week is noise. Two is a signal. This is where that shows.
        </p>
        <CompareView rows={PREVIEW_COMPARE} weeks={PREVIEW_COMPARE_WEEKS} />
      </main>
    </Shell>
  );
}

function ThreadScreen({ messages }: { messages: typeof PREVIEW_THREAD }) {
  return (
    <Shell>
      <main className="px-5 py-4">
        <ScreenHeader label="Check-ins" title="Review, 2026-09-13" />
        <div className="max-w-[70ch]">
          <ReviewThread messages={messages} readOnly />
        </div>
      </main>
    </Shell>
  );
}

function QuestionBankScreen() {
  return (
    <Shell>
      <main className="px-5 py-4">
        <BuilderNav current="/coach/builder/questions" />
        <ScreenHeader label="Builder" title={`${PREVIEW_BANK.length} questions`} />
        <div className="overflow-x-auto">
          <table className="elvt-table min-w-[820px]" data-testid="question-bank">
            <caption className="sr-only">The question bank</caption>
            <thead>
              <tr>
                <th scope="col">Question</th>
                <th scope="col">Category</th>
                <th scope="col">Can change</th>
              </tr>
            </thead>
            <tbody>
              {PREVIEW_BANK.map((question) => (
                <tr key={question.key} data-testid="bank-row">
                  <th scope="row" className="max-w-[40ch] truncate font-normal">
                    {question.text}
                  </th>
                  <td className="text-txt-mute">{humanize(question.category)}</td>
                  <td className="max-w-[28ch] truncate text-txt-mute">
                    {question.produces.map(humanize).join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </Shell>
  );
}

function FormScreen({
  title,
  form,
  spineKeys,
}: {
  title: string;
  form: { key: string; text: string }[];
  spineKeys?: string[];
}) {
  return (
    <div className="min-h-screen bg-ink">
      <div className="mx-auto w-full max-w-[560px] px-4 py-5" data-testid="screen-ready">
        <p className="elvt-label">ELVT check-in</p>
        <h1 className="mt-1 text-section">{title}</h1>
        <ol className="mt-4" data-testid="form-questions">
          {form.map((question, index) => (
            <li
              key={question.key}
              data-testid="form-question"
              data-spine={spineKeys?.includes(question.key) ? "true" : undefined}
              className="flex h-row items-center gap-3 border-line [border-bottom-width:1px]"
            >
              <span className="elvt-num w-[3ch] shrink-0 text-txt-dim">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate">{question.text}</span>
              {spineKeys?.includes(question.key) ? (
                <span className="elvt-label shrink-0 text-watch">Spine</span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function QueueLaneScreen({ rows }: { rows: typeof PREVIEW_QUEUE_ROWS }) {
  return (
    <Shell>
      <main className="px-5 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="elvt-num text-hero" data-testid="queue-count">
            {rows.length}
          </h1>
          <div>
            <p className="elvt-label">Queue</p>
            <p className="text-txt-mute">{rows.length === 1 ? "item open" : "items open"}</p>
          </div>
        </div>
        <QueueLanes rows={rows} />
      </main>
    </Shell>
  );
}

function MondayScreen({ cards }: { cards: typeof PREVIEW_CARDS }) {
  return (
    <Shell>
      <main className="px-5 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="elvt-num text-hero" data-testid="queue-count">
            {cards.length}
          </h1>
          <div>
            <p className="elvt-label">Queue</p>
            <p className="text-txt-mute">
              {cards.length === 1 ? "review waiting" : "reviews waiting"}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          {cards.map((card) => (
            <MondayCard key={card.clientId} card={card} readOnly />
          ))}
        </div>
      </main>
    </Shell>
  );
}

function MessagesScreen({ rows }: { rows: typeof PREVIEW_THREADS }) {
  return (
    <Shell>
      <main className="px-5 py-4">
        <ScreenHeader
          label="Messages"
          title={`${rows.length} clients`}
          note="Ordered by who has heard from you least, not by who wrote last."
        />
        <ThreadList rows={quietestFirst(rows)} />
      </main>
    </Shell>
  );
}

function ComposerScreen({ values }: { values: Record<string, string | number> }) {
  return (
    <Shell>
      <main className="px-5 py-4">
        <ScreenHeader label="Messages" title="Ekaterina Vasilyeva-Whitcombe" />
        <div className="max-w-[560px]">
          <ComposerPreview values={values} />
        </div>
      </main>
    </Shell>
  );
}

function RemindersScreen({ settings }: { settings: typeof PREVIEW_REMINDERS }) {
  return (
    <Shell>
      <main className="px-5 py-4">
        <ScreenHeader
          label="Settings"
          title="Reminders"
          note="Ekaterina Vasilyeva-Whitcombe, their time"
        />
        <ReminderSettings settings={settings} readOnly />
      </main>
    </Shell>
  );
}

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  if (process.env.ENABLE_DESIGN_PREVIEW !== "1") notFound();

  const { screen } = await params;
  if (!SCREENS.includes(screen as Screen)) notFound();

  switch (screen as Screen) {
    case "roster":
      return <RosterScreen rows={SEED_ROSTER} label="8 clients" />;
    case "roster-stress":
      return <RosterScreen rows={STRESS_ROSTER} label="9 clients" />;
    case "roster-dense":
      return <RosterScreen rows={DENSE_ROSTER} label="24 clients" />;
    case "roster-empty":
      return <RosterScreen rows={[]} label="No clients" />;
    case "queue":
      return <QueueScreen items={SEED_QUEUE} />;
    case "queue-empty":
      return <QueueScreen items={[]} />;
    case "builder-exercises":
      return <ExerciseLibraryScreen rows={SEED_EXERCISES} />;
    case "builder-exercises-stress":
      return <ExerciseLibraryScreen rows={STRESS_EXERCISES} />;
    case "builder-exercises-empty":
      return <ExerciseLibraryScreen rows={[]} />;
    case "program-week":
      return <ProgramScreen weekNumber={1} />;
    case "program-week-flagged":
      return <ProgramScreen weekNumber={PREVIEW_FLAGGED_WEEK} />;
    case "program-periodization":
      return <PeriodizationScreen />;
    case "nutrition-path":
      return <NutritionPathScreen path={PREVIEW_PATH_MIXED} />;
    case "nutrition-path-empty":
      return <NutritionPathScreen path={[]} />;
    case "nutrition-meals":
      return <NutritionMealsScreen rest={false} />;
    case "nutrition-meals-rest":
      return <NutritionMealsScreen rest />;
    case "nutrition-grocery":
      return <NutritionGroceryScreen />;
    case "nutrition-swaps":
      return <NutritionSwapScreen groups={PREVIEW_SWAPS} />;
    case "nutrition-swaps-empty":
      return <NutritionSwapScreen groups={[]} />;
    case "intake-goals":
      return <IntakeScreen sectionKey="goals" answers={PREVIEW_INTAKE_ANSWERS} />;
    case "intake-medical":
      return <IntakeScreen sectionKey="medical" answers={PREVIEW_INTAKE_ANSWERS} />;
    case "intake-medical-errors":
      return (
        <IntakeScreen
          sectionKey="medical"
          answers={PREVIEW_INTAKE_ANSWERS}
          errors={PREVIEW_INTAKE_ERRORS}
        />
      );
    case "intake-running-hidden":
      return <IntakeScreen sectionKey="running" answers={{ runs_at_all: false }} />;
    case "builder-questionnaire":
      return <QuestionnaireBuilderScreen empty={false} />;
    case "builder-questionnaire-empty":
      return <QuestionnaireBuilderScreen empty />;
    case "blueprint":
      return <BlueprintScreen blueprint={PREVIEW_BLUEPRINT} />;
    case "blueprint-empty":
      return <BlueprintScreen blueprint={PREVIEW_BLUEPRINT_EMPTY} />;
    case "program-draft":
      return <ProgramDraftScreen withRationale />;
    case "program-draft-empty":
      return <ProgramDraftScreen withRationale={false} />;
    case "checkins":
      return <CheckinsScreen rows={PREVIEW_SUBMISSIONS} />;
    case "checkins-empty":
      return <CheckinsScreen rows={[]} />;
    case "checkin-compare":
      return <CompareScreen />;
    case "checkin-thread":
      return <ThreadScreen messages={PREVIEW_THREAD} />;
    case "checkin-thread-empty":
      return <ThreadScreen messages={[]} />;
    case "builder-question-bank":
      return <QuestionBankScreen />;
    case "checkin-daily-form":
      return <FormScreen title="Today" form={PREVIEW_DAILY_FORM} />;
    case "checkin-weekly-form":
      return (
        <FormScreen
          title="This week"
          form={PREVIEW_WEEKLY_FORM.questions}
          spineKeys={PREVIEW_WEEKLY_FORM.spineKeys}
        />
      );
    case "checkin-week1-form":
      return <FormScreen title="Week one" form={PREVIEW_WEEK1_FORM.questions} />;
    case "checkin-no-spine-form":
      return <FormScreen title="This week" form={PREVIEW_NO_SPINE_FORM.questions} />;
    case "queue-lanes":
      return <QueueLaneScreen rows={PREVIEW_QUEUE_ROWS} />;
    case "queue-lanes-one":
      return <QueueLaneScreen rows={PREVIEW_QUEUE_ONE_LANE} />;
    case "queue-lanes-empty":
      return <QueueLaneScreen rows={[]} />;
    case "monday-card":
      return <MondayScreen cards={[PREVIEW_CARD]} />;
    case "monday-card-quiet":
      return <MondayScreen cards={[PREVIEW_CARD_QUIET]} />;
    case "monday-cards":
      return <MondayScreen cards={PREVIEW_CARDS} />;
    case "messages":
      return <MessagesScreen rows={PREVIEW_THREADS} />;
    case "messages-empty":
      return <MessagesScreen rows={[]} />;
    case "composer":
      return <ComposerScreen values={PREVIEW_COMPOSER_VALUES} />;
    case "composer-thin":
      return <ComposerScreen values={PREVIEW_COMPOSER_THIN} />;
    case "reminders":
      return <RemindersScreen settings={PREVIEW_REMINDERS} />;
    case "reminders-sparse":
      return <RemindersScreen settings={PREVIEW_REMINDERS_SPARSE} />;
  }
}
