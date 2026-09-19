import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExportData, ExportExercise, ExportSession, ExportWeek } from "./types";

/**
 * Reads one client's whole program into the shape the generator wants.
 *
 * Runs with the service role, because it is a coach action producing a file for
 * a client who is not signed in. It is reachable only from the export route,
 * which checks the caller is staff first.
 */
export async function loadExportData(
  supabase: SupabaseClient,
  slug: string,
  apiBase: string,
): Promise<ExportData | null> {
  const { data: client } = await supabase
    .from("clients")
    .select("id, slug, first_name, last_name, units, timezone, goal_statement, program_start_date, program_length_weeks")
    .eq("slug", slug)
    .maybeSingle();

  if (!client) return null;

  const { data: program } = await supabase
    .from("programs")
    .select("id, name, phases, duration_weeks")
    .eq("client_id", client.id)
    .eq("status", "active")
    .maybeSingle();

  const { data: weekRows } = await supabase
    .from("program_weeks")
    .select("id, week_number, starts_on, is_deload, calories, protein, carbs, fat, planned_mileage")
    .eq("client_id", client.id)
    .order("week_number");

  const { data: dayRows } = await supabase
    .from("program_days")
    .select("id, program_week_id, date, day_of_week, is_rest, calories_override, protein_override")
    .eq("client_id", client.id)
    .order("date");

  const { data: sessionRows } = await supabase
    .from("sessions")
    .select("id, program_day_id, kind, name, order")
    .eq("client_id", client.id)
    .order("order");

  const { data: sectionRows } = await supabase
    .from("session_sections")
    .select("id, session_id, order")
    .eq("client_id", client.id)
    .order("order");

  const { data: exerciseRows } = await supabase
    .from("session_exercises")
    .select("id, section_id, exercise_id, order, sets, tracking_fields")
    .eq("client_id", client.id)
    .order("order");

  const libraryIds = [...new Set((exerciseRows ?? []).map((row) => row.exercise_id))];
  const { data: library } = libraryIds.length
    ? await supabase.from("exercises").select("id, name, media, cues").in("id", libraryIds)
    : { data: [] };

  const { data: runRows } = await supabase
    .from("runs")
    .select("session_id, distance_target, pace_min, pace_max, hr_min, hr_max, fueling")
    .eq("client_id", client.id);

  const { data: meals } = await supabase
    .from("meals")
    .select("id, name, calories, protein, carbs, fat, items")
    .eq("client_id", client.id)
    .order("order");

  const { data: habits } = await supabase
    .from("habits")
    .select("id, name, unit, target")
    .eq("client_id", client.id);

  const libraryById = new Map((library ?? []).map((row) => [row.id, row]));

  const exercisesFor = (sessionId: string): ExportExercise[] => {
    const sections = (sectionRows ?? []).filter((section) => section.session_id === sessionId);
    return sections.flatMap((section) =>
      (exerciseRows ?? [])
        .filter((row) => row.section_id === section.id)
        .map((row) => {
          const entry = libraryById.get(row.exercise_id);
          const media = (entry?.media ?? {}) as { youtube_id?: string };
          const sets = (row.sets ?? []) as ExportExercise["sets"];
          const fields = (row.tracking_fields ?? []) as string[];

          return {
            id: row.id,
            name: entry?.name ?? "Movement",
            youtubeId: media.youtube_id ?? "",
            cues: (entry?.cues ?? []) as string[],
            // Rep based work only. The prescription decides, not the app.
            logsWeight:
              fields.includes("weight") && sets.some((set) => typeof set.reps === "number"),
            sets,
          };
        }),
    );
  };

  const weeks: ExportWeek[] = (weekRows ?? []).map((week) => ({
    weekNumber: week.week_number,
    startsOn: week.starts_on,
    isDeload: week.is_deload,
    phase: null,
    calories: week.calories,
    protein: week.protein,
    carbs: week.carbs,
    fat: week.fat,
    plannedMileage: week.planned_mileage === null ? null : Number(week.planned_mileage),
    days: (dayRows ?? [])
      .filter((day) => day.program_week_id === week.id)
      .map((day) => ({
        date: day.date,
        dayOfWeek: day.day_of_week,
        isRest: day.is_rest,
        calories: day.calories_override,
        protein: day.protein_override,
        sessions: (sessionRows ?? [])
          .filter((session) => session.program_day_id === day.id)
          .map((session): ExportSession => {
            const run = (runRows ?? []).find((candidate) => candidate.session_id === session.id);
            return {
              id: session.id,
              kind: session.kind as ExportSession["kind"],
              name: session.name,
              // A run has no weight boxes, so its exercises are empty by
              // construction rather than by a check somewhere downstream.
              exercises: session.kind === "run" ? [] : exercisesFor(session.id),
              run: run
                ? {
                    distanceTarget: run.distance_target === null ? null : Number(run.distance_target),
                    paceMin: run.pace_min === null ? null : Number(run.pace_min),
                    paceMax: run.pace_max === null ? null : Number(run.pace_max),
                    hrMin: run.hr_min,
                    hrMax: run.hr_max,
                    fueling: typeof run.fueling === "string" ? run.fueling : null,
                  }
                : undefined,
            };
          }),
      })),
  }));

  return {
    client: {
      id: client.id,
      slug: client.slug,
      firstName: client.first_name,
      lastName: client.last_name,
      units: (client.units ?? "imperial") as "imperial" | "metric",
      timezone: client.timezone ?? "",
    },
    program: {
      name: program?.name ?? "Program",
      startDate: client.program_start_date ?? weeks[0]?.startsOn ?? "",
      weeks: program?.duration_weeks ?? client.program_length_weeks ?? weeks.length,
      goalStatement: client.goal_statement ?? "",
      raceDate: null,
    },
    weeks,
    meals: (meals ?? []).map((meal) => ({
      id: meal.id,
      name: meal.name,
      calories: meal.calories ?? 0,
      protein: meal.protein ?? 0,
      carbs: meal.carbs ?? 0,
      fat: meal.fat ?? 0,
      items: (meal.items ?? []) as { name: string; portion: string }[],
    })),
    habits: (habits ?? []).map((habit) => ({
      id: habit.id,
      name: habit.name,
      unit: habit.unit ?? "check",
      target: Number(habit.target ?? 1),
    })),
    reference: [],
    apiBase,
    generatedAt: new Date().toISOString(),
  };
}
