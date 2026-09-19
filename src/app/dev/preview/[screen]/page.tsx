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
  }
}
