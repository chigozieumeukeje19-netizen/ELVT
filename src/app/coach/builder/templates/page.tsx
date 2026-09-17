import { redirect } from "next/navigation";
import { Field, Select, humanize } from "@/components/Field";
import { BuilderNav } from "@/components/BuilderNav";
import { ScreenHeader } from "@/components/ScreenHeader";
import { currentProfile, isStaff } from "@/lib/auth";
import {
  CALORIE_SHAPES,
  RUN_TYPES,
  SECTION_TYPES,
  STIMULI,
  type ProgramTemplateBody,
} from "@/lib/program/types";
import { supabaseServer } from "@/lib/supabase/server";
import {
  createProgramTemplate,
  createRunTemplate,
  createWorkoutTemplate,
} from "../actions";

export const dynamic = "force-dynamic";

const NO_DATA = "·";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!isStaff(profile.role)) redirect("/client/today");

  const { error } = await searchParams;
  const supabase = await supabaseServer();

  const [programs, workouts, runs] = await Promise.all([
    supabase
      .from("program_templates")
      .select("id, name, goal_type, duration_weeks, split, body")
      .order("name"),
    supabase.from("workout_templates").select("id, name, body").order("name"),
    supabase.from("run_templates").select("id, name, run_type, body").order("name"),
  ]);

  const programRows = (programs.data ?? []) as {
    id: string;
    name: string;
    goal_type: string | null;
    duration_weeks: number | null;
    split: string | null;
    body: ProgramTemplateBody | null;
  }[];

  return (
    <main className="px-5 py-4">
      <BuilderNav current="/coach/builder/templates" />
      <ScreenHeader
        label="Builder"
        title="Templates"
        note="A template is a recipe, not a program. It names movements by pattern, so the applier can pick something safe for each client instead of you having to remember who cannot squat."
        error={error}
      />

      <section>
        <h2 className="elvt-label">Programs</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="elvt-table" data-testid="program-template-table">
            <thead>
              <tr>
                <th scope="col" className="w-[240px]">Template</th>
                <th scope="col" className="w-[140px]">Goal</th>
                <th scope="col" className="w-[100px]">Weeks</th>
                <th scope="col" className="w-[160px]">Split</th>
                <th scope="col" className="w-[130px]">Deload</th>
                <th scope="col" className="w-[160px]">Calorie path</th>
                <th scope="col" className="w-[110px]">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {programRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-txt-mute">
                    No program templates yet. Add one below, then apply it to a
                    client from their program tab.
                  </td>
                </tr>
              ) : (
                programRows.map((t) => (
                  <tr key={t.id} data-testid="program-template-row">
                    <td>{t.name}</td>
                    <td className="text-txt-mute">
                      {t.goal_type ? humanize(t.goal_type) : NO_DATA}
                    </td>
                    <td className="elvt-num text-txt-mute">
                      {t.duration_weeks ?? NO_DATA}
                    </td>
                    <td className="text-txt-mute">{t.split ?? NO_DATA}</td>
                    <td className="elvt-num text-txt-mute">
                      {t.body?.deload?.everyNWeeks
                        ? `Every ${t.body.deload.everyNWeeks}`
                        : "None"}
                    </td>
                    <td className="text-txt-mute">
                      {t.body?.caloriePathShape
                        ? humanize(t.body.caloriePathShape)
                        : NO_DATA}
                    </td>
                    <td className="elvt-num text-txt-mute">
                      {t.body?.sessions?.length ?? 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <form
          action={createProgramTemplate}
          className="mt-4 grid max-w-[860px] gap-3 sm:grid-cols-4"
        >
          <Field label="Name" className="sm:col-span-2">
            <input className="elvt-input" name="name" required minLength={2} />
          </Field>
          <Field label="Goal">
            <Select
              name="goalType"
              required
              options={[
                "fat_loss", "recomp", "race_prep", "performance",
                "maintain", "fitness_test",
              ]}
            />
          </Field>
          <Field label="Weeks">
            <input
              className="elvt-input"
              name="durationWeeks"
              type="number"
              min={1}
              max={52}
              defaultValue={12}
              required
            />
          </Field>
          <Field label="Lifts per week">
            <input
              className="elvt-input"
              name="liftsPerWeek"
              type="number"
              min={0}
              max={7}
              defaultValue={3}
              required
            />
          </Field>
          <Field label="Runs per week">
            <input
              className="elvt-input"
              name="runsPerWeek"
              type="number"
              min={0}
              max={7}
              defaultValue={2}
              required
            />
          </Field>
          <Field label="Deload every N weeks">
            <input
              className="elvt-input"
              name="deloadEveryNWeeks"
              type="number"
              min={0}
              max={12}
              defaultValue={4}
              required
            />
          </Field>
          <Field label="Calorie path shape">
            <Select name="caloriePathShape" options={CALORIE_SHAPES} required />
          </Field>
          <div className="sm:col-span-4">
            <button className="elvt-button" type="submit">
              Add program template
            </button>
          </div>
        </form>
      </section>

      <section className="mt-7 border-line pt-5 [border-top-width:1px]">
        <h2 className="elvt-label">Workouts</h2>
        <ul className="mt-3" data-testid="workout-template-list">
          {(workouts.data ?? []).length === 0 ? (
            <li className="py-3 text-txt-mute">
              No workout templates yet. A program template places these on days.
            </li>
          ) : (
            (workouts.data ?? []).map((w) => (
              <li
                key={w.id}
                className="flex h-row items-center gap-4 border-line [border-top-width:1px]"
              >
                <span className="min-w-0 flex-1 truncate">{w.name}</span>
                <span className="elvt-label">
                  {humanize(
                    ((w.body ?? {}) as { stimulus?: string }).stimulus ?? "not set",
                  )}
                </span>
              </li>
            ))
          )}
        </ul>

        <form
          action={createWorkoutTemplate}
          className="mt-4 grid max-w-[760px] gap-3 sm:grid-cols-3"
        >
          <Field label="Name">
            <input className="elvt-input" name="name" required minLength={2} />
          </Field>
          <Field label="Stimulus">
            <Select name="stimulus" options={STIMULI} required />
          </Field>
          <Field label="First section">
            <Select name="sectionType" options={SECTION_TYPES} required />
          </Field>
          <div className="sm:col-span-3">
            <button className="elvt-button" type="submit">
              Add workout template
            </button>
          </div>
        </form>
      </section>

      <section className="mt-7 border-line pt-5 [border-top-width:1px]">
        <h2 className="elvt-label">Runs</h2>
        <ul className="mt-3" data-testid="run-template-list">
          {(runs.data ?? []).length === 0 ? (
            <li className="py-3 text-txt-mute">
              No run templates yet. A run is its own object, with distance, pace
              and fueling, not a workout with cardio in it.
            </li>
          ) : (
            (runs.data ?? []).map((r) => (
              <li
                key={r.id}
                className="flex h-row items-center gap-4 border-line [border-top-width:1px]"
              >
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="elvt-num text-txt-mute">
                  {((r.body ?? {}) as { distanceTarget?: number }).distanceTarget ??
                    NO_DATA}
                </span>
                <span className="elvt-label">
                  {r.run_type ? humanize(r.run_type) : NO_DATA}
                </span>
              </li>
            ))
          )}
        </ul>

        <form
          action={createRunTemplate}
          className="mt-4 grid max-w-[760px] gap-3 sm:grid-cols-3"
        >
          <Field label="Name">
            <input className="elvt-input" name="name" required minLength={2} />
          </Field>
          <Field label="Run type">
            <Select name="runType" options={RUN_TYPES} required />
          </Field>
          <Field label="Distance">
            <input
              className="elvt-input"
              name="distanceTarget"
              type="number"
              step="0.1"
              min={0}
            />
          </Field>
          <div className="sm:col-span-3">
            <button className="elvt-button" type="submit">
              Add run template
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
