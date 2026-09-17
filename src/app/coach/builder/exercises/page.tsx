import { redirect } from "next/navigation";
import { ExerciseTable, type ExerciseRow } from "@/components/ExerciseTable";
import { Field, Select } from "@/components/Field";
import { BuilderNav } from "@/components/BuilderNav";
import { ScreenHeader } from "@/components/ScreenHeader";
import { currentProfile, isStaff } from "@/lib/auth";
import { PATTERNS } from "@/lib/program/types";
import { supabaseServer } from "@/lib/supabase/server";
import { createExercise } from "../actions";

export const dynamic = "force-dynamic";

type Raw = {
  id: string;
  name: string;
  aliases: string[] | null;
  pattern: string | null;
  primary_muscle: string | null;
  equipment: string[] | null;
  level: string | null;
  needs_review: boolean;
  media: { youtube_id?: string | null } | null;
  exercise_contraindications: { flag_key: string }[] | null;
  exercise_alternatives: { id: string }[] | null;
};

export default async function ExerciseLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!isStaff(profile.role)) redirect("/client/today");

  const { error } = await searchParams;
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("exercises")
    .select(
      "id, name, aliases, pattern, primary_muscle, equipment, level, needs_review, media, exercise_contraindications(flag_key), exercise_alternatives!exercise_alternatives_exercise_id_fkey(id)",
    )
    .order("name");

  const rows: ExerciseRow[] = ((data ?? []) as unknown as Raw[]).map((e) => ({
    id: e.id,
    name: e.name,
    aliases: e.aliases ?? [],
    pattern: e.pattern,
    primary_muscle: e.primary_muscle,
    equipment: e.equipment ?? [],
    level: e.level,
    needs_review: e.needs_review,
    contraindications: (e.exercise_contraindications ?? []).map((c) => c.flag_key),
    alternatives: (e.exercise_alternatives ?? []).length,
    youtube_id: e.media?.youtube_id ?? null,
  }));

  const needsReview = rows.filter((r) => r.needs_review).length;

  return (
    <main className="px-5 py-4">
      <BuilderNav current="/coach/builder/exercises" />
      <ScreenHeader
        label="Builder"
        title={`${rows.length} movements`}
        note={
          needsReview > 0
            ? `${needsReview} still need a name or a video confirmed.`
            : undefined
        }
        error={error}
      />

      <ExerciseTable rows={rows} />

      <section className="mt-6 max-w-[760px]">
        <h2 className="elvt-label">Add a movement</h2>
        <form action={createExercise} className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input className="elvt-input" name="name" required minLength={2} />
          </Field>

          <Field label="Other spellings, separated by commas">
            <input className="elvt-input" name="aliases" />
          </Field>

          <Field label="Pattern">
            <Select name="pattern" options={PATTERNS} includeBlank="Not set" />
          </Field>

          <Field label="Primary muscle">
            <input className="elvt-input" name="primaryMuscle" />
          </Field>

          <Field label="Equipment, separated by commas">
            <input className="elvt-input" name="equipment" />
          </Field>

          <Field label="Level">
            <Select
              name="level"
              options={["beginner", "intermediate", "advanced"]}
              includeBlank="Not set"
            />
          </Field>

          <Field label="YouTube id">
            <input
              className="elvt-input"
              name="youtubeId"
              pattern="[A-Za-z0-9_\-]{11}"
              placeholder="Eleven characters"
            />
          </Field>

          <label className="flex items-center gap-2 self-end pb-2">
            <input type="checkbox" name="unilateral" />
            <span className="text-body">One side at a time</span>
          </label>

          <div className="sm:col-span-2">
            <button className="elvt-button" type="submit">
              Add movement
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
