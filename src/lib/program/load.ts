import type { SupabaseClient } from "@supabase/supabase-js";
import type { MaterializedProgram, MaterializedWeek } from "./apply-template";
import type { PhaseBand, SetTarget, Stimulus } from "./types";

/**
 * Reads a materialized program out of the database into the same shape the
 * applier produces, so the view model, the stress model and the edit transforms
 * all work against one structure whatever produced it.
 */

type Row = {
  id: string;
  week_number: number;
  starts_on: string;
  is_deload: boolean;
  program_days: {
    id: string;
    date: string;
    day_of_week: number;
    is_rest: boolean;
    sessions: {
      id: string;
      kind: string;
      name: string;
      order: number;
      from_template: boolean;
      session_sections: {
        id: string;
        session_exercises: {
          id: string;
          order: number;
          sets: SetTarget[] | null;
          tracking_fields: string[] | null;
          notes: string | null;
          exercises: { id: string; name: string } | null;
        }[];
      }[];
      runs: {
        run_type: string;
        distance_target: number | null;
        duration_target: number | null;
      }[];
    }[];
  }[];
};

const SELECT = `
  id, week_number, starts_on, is_deload,
  program_days (
    id, date, day_of_week, is_rest,
    sessions (
      id, kind, name, order, from_template,
      session_sections (
        id,
        session_exercises (
          id, order, sets, tracking_fields, notes,
          exercises ( id, name )
        )
      ),
      runs ( run_type, distance_target, duration_target )
    )
  )
`;

/**
 * Sessions carry a kind but not a stimulus in the database, because a stimulus
 * is a property of the work rather than of the row. It is derived here so the
 * spacing rule and the stress model see the same value they would have seen
 * from the applier.
 */
function stimulusFor(kind: string, runType: string | undefined, name: string): Stimulus {
  if (kind === "run") {
    if (runType === "long") return "long_run";
    if (
      runType &&
      ["tempo", "threshold", "intervals", "hills", "race_pace", "race"].includes(runType)
    ) {
      return "hard_run";
    }
    return "easy_run";
  }
  if (kind === "mobility") return "mobility";
  if (kind === "conditioning") return "conditioning";
  if (kind === "skill") return "skill";

  const lower = name.toLowerCase();
  if (lower.includes("lower") || lower.includes("leg")) return "lower_strength";
  if (lower.includes("upper")) return "upper_strength";
  return "full_strength";
}

export async function loadProgram(
  supabase: SupabaseClient,
  programId: string,
): Promise<{ program: MaterializedProgram; phases: PhaseBand[] } | null> {
  const { data: programRow } = await supabase
    .from("programs")
    .select("id, phases, duration_weeks")
    .eq("id", programId)
    .maybeSingle();

  if (!programRow) return null;

  const { data } = await supabase
    .from("program_weeks")
    .select(SELECT)
    .eq("program_id", programId)
    .order("week_number");

  const weeks: MaterializedWeek[] = ((data ?? []) as unknown as Row[]).map((week) => ({
    weekNumber: week.week_number,
    startsOn: week.starts_on,
    isDeload: week.is_deload,
    days: [...week.program_days]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => ({
        date: day.date,
        dayOfWeek: day.day_of_week,
        isRest: day.is_rest,
        sessions: [...day.sessions]
          .sort((a, b) => a.order - b.order)
          .map((session) => {
            const run = session.runs?.[0];
            return {
              key: session.id,
              kind: session.kind as "strength" | "run" | "mobility" | "conditioning" | "skill",
              name: session.name,
              stimulus: stimulusFor(session.kind, run?.run_type, session.name),
              fromTemplate: session.from_template as true,
              exercises: session.session_sections
                .flatMap((section) => section.session_exercises)
                .sort((a, b) => a.order - b.order)
                .map((exercise) => ({
                  exerciseId: exercise.exercises?.id ?? "",
                  name: exercise.exercises?.name ?? "Removed movement",
                  sets: exercise.sets ?? [],
                  trackingFields: exercise.tracking_fields ?? [],
                  notes: exercise.notes ?? undefined,
                })),
              run: run
                ? {
                    runType: run.run_type as never,
                    stimulus: stimulusFor("run", run.run_type, session.name),
                    distanceTarget: run.distance_target ?? undefined,
                    durationTarget: run.duration_target ?? undefined,
                  }
                : undefined,
            };
          }),
      })),
  }));

  return {
    program: { weeks, decisions: [] },
    phases: (programRow.phases ?? []) as PhaseBand[],
  };
}
