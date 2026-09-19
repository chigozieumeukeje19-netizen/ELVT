import { notFound, redirect } from "next/navigation";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CaloriePathTable } from "@/components/nutrition/CaloriePathTable";
import { GroceryHub } from "@/components/nutrition/GroceryHub";
import { MealPlanEditor } from "@/components/nutrition/MealPlanEditor";
import { RegeneratePath } from "@/components/nutrition/RegeneratePath";
import { SwapList } from "@/components/nutrition/SwapList";
import { currentProfile, isStaff } from "@/lib/auth";
import type { CalorieWeek, PathShape } from "@/lib/nutrition/calorie-path";
import { groceryList, type GroceryItem } from "@/lib/nutrition/grocery";
import { dayTarget, planMeals, type MealSlot } from "@/lib/nutrition/meals";
import { supabaseServer } from "@/lib/supabase/server";
import { regeneratePathAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Where the calorie path is going.
 *
 * The table is the screen. The meal plan, swaps and grocery list sit under it
 * because they are all downstream of the week's number: change the week and all
 * three follow, which is the point of deriving them rather than storing them.
 */
export default async function ClientNutritionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ week?: string; day?: string; error?: string }>;
}) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!isStaff(profile.role)) redirect("/client/today");

  const { slug } = await params;
  const { week: weekParam, day: dayParam, error } = await searchParams;
  const supabase = await supabaseServer();

  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, last_name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!client) notFound();
  const name = [client.first_name, client.last_name].filter(Boolean).join(" ");

  const { data: program } = await supabase
    .from("programs")
    .select("id, name, duration_weeks")
    .eq("client_id", client.id)
    .eq("status", "active")
    .maybeSingle();

  if (!program) {
    return (
      <main className="px-5 py-4">
        <ScreenHeader
          label="Nutrition"
          title={name}
          note="No active program, so there is no calorie path to write. Apply a template on the program tab first."
        />
      </main>
    );
  }

  const { data: weekRows } = await supabase
    .from("program_weeks")
    .select("week_number, calories, protein, carbs, fat, calorie_note, calorie_status, is_deload, planned_mileage")
    .eq("program_id", program.id)
    .order("week_number");

  const rows = weekRows ?? [];

  const path: CalorieWeek[] = rows
    .filter((row) => row.calories !== null && row.protein !== null)
    .map((row) => ({
      week: row.week_number,
      calories: row.calories as number,
      protein: row.protein as number,
      carbs: (row.carbs ?? 0) as number,
      fat: (row.fat ?? 0) as number,
      isDeload: row.is_deload,
      note: row.calorie_note ?? "",
      status: (row.calorie_status ?? "projected") as CalorieWeek["status"],
    }));

  const requested = Number(weekParam);
  const currentWeek =
    Number.isFinite(requested) && path.some((row) => row.week === requested)
      ? requested
      : (path[0]?.week ?? 1);

  const week = path.find((row) => row.week === currentWeek);
  const isRestDay = dayParam === "rest";

  const { data: mealRows } = await supabase
    .from("meals")
    .select("id, name, order, calories, items")
    .eq("client_id", client.id)
    .order("order");

  // A meal's stored calories are read as the share it takes of the day, since
  // shares are normalised by their own total. Mixing a stored calorie count
  // with a fractional default would give one meal 600 units and another 0.25,
  // so the defaults are used for the whole plan or not at all.
  const everyMealSized = (mealRows ?? []).every((meal) => (meal.calories ?? 0) > 0);
  const slots: MealSlot[] = (mealRows ?? []).map((meal, index) => ({
    key: meal.id,
    name: meal.name,
    share: everyMealSized
      ? (meal.calories as number)
      : DEFAULT_SHARES[index % DEFAULT_SHARES.length],
  }));

  const milesToday = isRestDay ? 0 : Number(rows.find((r) => r.week_number === currentWeek)?.planned_mileage ?? 0) / 7;

  const target = week
    ? dayTarget(
        {
          baseCalories: week.calories,
          baseProtein: week.protein,
          perMileCalories: PER_MILE_CALORIES,
          restDayCalories: isRestDay ? Math.round(week.calories * REST_DAY_FACTOR) : undefined,
        },
        { miles: milesToday, isRest: isRestDay },
      )
    : null;

  const meals = target && slots.length > 0 ? planMeals(target.calories, target.protein, slots) : [];

  const basket: GroceryItem[] = (mealRows ?? []).flatMap((meal) =>
    ((meal.items ?? []) as GroceryItem[]).map((item) => ({ ...item, key: `${meal.id}-${item.key}` })),
  );

  const planCalories = path[0]?.calories ?? week?.calories ?? 0;
  const lines = basket.length > 0 && week ? groceryList(basket, planCalories, week.calories) : [];

  const confirmed = path.filter((row) => row.status !== "projected").map((row) => row.week);

  return (
    <main className="px-5 py-4">
      <ScreenHeader
        label="Nutrition"
        title={name}
        note={program.name}
        error={error}
        actions={
          <>
            <a
              className="elvt-button-secondary"
              href={`/coach/clients/${slug}/nutrition?week=${currentWeek}&day=training`}
              aria-current={isRestDay ? undefined : "true"}
            >
              Training day
            </a>
            <a
              className="elvt-button-secondary"
              href={`/coach/clients/${slug}/nutrition?week=${currentWeek}&day=rest`}
              aria-current={isRestDay ? "true" : undefined}
            >
              Rest day
            </a>
          </>
        }
      />

      <CaloriePathTable path={path} currentWeek={currentWeek} />

      <nav aria-label="Weeks" className="mt-3 flex flex-wrap gap-2">
        {path.map((row) => (
          <a
            key={row.week}
            href={`/coach/clients/${slug}/nutrition?week=${row.week}${isRestDay ? "&day=rest" : ""}`}
            aria-current={row.week === currentWeek ? "page" : undefined}
            className={`elvt-chip ${row.week === currentWeek ? "bg-raised text-txt" : ""}`}
          >
            <span className="elvt-num">{row.week}</span>
          </a>
        ))}
      </nav>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="elvt-label">Meals, week {currentWeek}</h2>
          <div className="mt-2">
            {target && meals.length > 0 ? (
              <MealPlanEditor
                meals={meals}
                dayCalories={target.calories}
                dayProtein={target.protein}
                basis={target.basis}
              />
            ) : (
              <p className="text-txt-secondary">
                No meals set up yet. Add them and they will split this week&rsquo;s
                target exactly, with the last meal taking the remainder.
              </p>
            )}
          </div>
        </section>

        <section>
          <h2 className="elvt-label">Grocery list</h2>
          <div className="mt-2">
            <GroceryHub
              lines={lines}
              weekCalories={week?.calories ?? 0}
              planCalories={planCalories}
            />
          </div>
        </section>

        <section>
          <h2 className="elvt-label">Swaps</h2>
          <div className="mt-2">
            <SwapList groups={[]} />
          </div>
        </section>

        <section>
          <h2 className="elvt-label">Regenerate</h2>
          <div className="mt-2">
            <RegeneratePath
              action={regeneratePathAction}
              slug={slug}
              confirmedWeeks={confirmed}
              defaults={{
                weekCount: program.duration_weeks ?? path.length ?? 12,
                startCalories: path[0]?.calories ?? 2600,
                endCalories: path[path.length - 1]?.calories ?? 2200,
                protein: path[0]?.protein ?? 180,
                deloadWeeks: path.filter((row) => row.isDeload).map((row) => row.week).join(", "),
                shape: "linear" satisfies PathShape,
              }}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

/** Shares used when a meal has no stored share, so a new plan still splits. */
const DEFAULT_SHARES = [0.25, 0.3, 0.1, 0.35];

/** Fuel added per mile run that day. Stated once, used by every day card. */
const PER_MILE_CALORIES = 100;

/** How far a rest day sits below the training day number when one is asked for. */
const REST_DAY_FACTOR = 0.92;
