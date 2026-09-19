import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Field, Select, humanize } from "@/components/Field";
import { ScreenHeader } from "@/components/ScreenHeader";
import { currentProfile, isStaff } from "@/lib/auth";
import { FLAG_KEYS, PATTERNS } from "@/lib/program/types";
import { supabaseServer } from "@/lib/supabase/server";
import {
  addAlternative,
  deleteExercise,
  removeAlternative,
  setContraindications,
  updateExercise,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function ExerciseEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!isStaff(profile.role)) redirect("/client/today");

  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await supabaseServer();

  const { data: exercise } = await supabase
    .from("exercises")
    .select(
      "id, name, aliases, pattern, primary_muscle, equipment, level, unilateral, media, exercise_contraindications(flag_key)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!exercise) notFound();

  const [{ data: alternatives }, { data: library }] = await Promise.all([
    supabase
      .from("exercise_alternatives")
      .select("id, reason, alt:alt_exercise_id(id, name)")
      .eq("exercise_id", id),
    supabase.from("exercises").select("id, name").neq("id", id).order("name"),
  ]);

  const flagged = new Set(
    ((exercise.exercise_contraindications ?? []) as { flag_key: string }[]).map(
      (c) => c.flag_key,
    ),
  );
  const media = (exercise.media ?? {}) as { youtube_id?: string | null };
  const alts = (alternatives ?? []) as unknown as {
    id: string;
    reason: string;
    alt: { id: string; name: string } | null;
  }[];

  return (
    <main className="max-w-[860px] px-5 py-4">
      <ScreenHeader
        label="Builder"
        title={exercise.name}
        error={error}
        actions={
          <Link className="elvt-button-secondary" href="/coach/builder/exercises">
            Back to library
          </Link>
        }
      />

      <form action={updateExercise} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={exercise.id} />

        <Field label="Name">
          <input
            className="elvt-input"
            name="name"
            required
            minLength={2}
            defaultValue={exercise.name}
          />
        </Field>

        <Field label="Other spellings, separated by commas">
          <input
            className="elvt-input"
            name="aliases"
            defaultValue={(exercise.aliases ?? []).join(", ")}
          />
        </Field>

        <Field label="Pattern">
          <Select
            name="pattern"
            options={PATTERNS}
            includeBlank="Not set"
            defaultValue={exercise.pattern}
          />
        </Field>

        <Field label="Primary muscle">
          <input
            className="elvt-input"
            name="primaryMuscle"
            defaultValue={exercise.primary_muscle ?? ""}
          />
        </Field>

        <Field label="Equipment, separated by commas">
          <input
            className="elvt-input"
            name="equipment"
            defaultValue={(exercise.equipment ?? []).join(", ")}
          />
        </Field>

        <Field label="Level">
          <Select
            name="level"
            options={["beginner", "intermediate", "advanced"]}
            includeBlank="Not set"
            defaultValue={exercise.level}
          />
        </Field>

        <Field label="YouTube id">
          <input
            className="elvt-input"
            name="youtubeId"
            pattern="[A-Za-z0-9_\-]{11}"
            defaultValue={media.youtube_id ?? ""}
          />
        </Field>

        <label className="flex items-center gap-2 self-end pb-2">
          <input
            type="checkbox"
            name="unilateral"
            defaultChecked={exercise.unilateral}
          />
          <span className="text-body">One side at a time</span>
        </label>

        <div className="sm:col-span-2">
          <button className="elvt-button" type="submit">
            Save
          </button>
        </div>
      </form>

      {/*
        Contraindications are what make a flagged client safe by construction
        rather than by the coach remembering. The applier and every swap list
        join through this, so a box ticked here removes the movement from that
        client's programs permanently.
      */}
      <section className="mt-7 border-line pt-5 [border-top-width:1px]">
        <h2 className="elvt-label">Rules this movement out for</h2>
        <p className="mt-2 max-w-[68ch] text-txt-secondary">
          A client carrying any flag ticked here never sees this movement, in a
          generated program or in a swap list.
        </p>

        <form action={setContraindications} className="mt-4">
          <input type="hidden" name="id" value={exercise.id} />
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            {FLAG_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name={`flag_${key}`}
                  defaultChecked={flagged.has(key)}
                />
                <span className="text-body">{humanize(key)}</span>
              </label>
            ))}
          </div>
          <button className="elvt-button mt-4" type="submit">
            Save limits
          </button>
        </form>
      </section>

      <section className="mt-7 border-line pt-5 [border-top-width:1px]">
        <h2 className="elvt-label">Swaps</h2>
        <p className="mt-2 max-w-[68ch] text-txt-secondary">
          What this becomes when the client cannot do it. The applier picks from
          here before it gives up on the slot.
        </p>

        {alts.length > 0 ? (
          <ul className="mt-4">
            {alts.map((alt) => (
              <li
                key={alt.id}
                className="flex h-row items-center gap-4 border-line [border-top-width:1px]"
              >
                <span className="min-w-0 flex-1 truncate">
                  {alt.alt?.name ?? "Removed movement"}
                </span>
                <span className="elvt-label">{humanize(alt.reason)}</span>
                <form action={removeAlternative}>
                  <input type="hidden" name="id" value={exercise.id} />
                  <input type="hidden" name="rowId" value={alt.id} />
                  <button className="elvt-button-secondary" type="submit">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-txt-secondary">
            No swaps yet. Without one, a client who cannot do this movement gets
            the slot dropped rather than replaced.
          </p>
        )}

        <form action={addAlternative} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="id" value={exercise.id} />
          <Field label="Swap in" className="sm:col-span-1">
            <select name="altId" required className="elvt-input">
              <option value="">Pick a movement</option>
              {(library ?? []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reason">
            <Select name="reason" options={["equipment", "injury", "level"]} required />
          </Field>
          <div className="self-end pb-1">
            <button className="elvt-button" type="submit">
              Add swap
            </button>
          </div>
        </form>
      </section>

      <section className="mt-7 border-line pt-5 [border-top-width:1px]">
        <form action={deleteExercise}>
          <input type="hidden" name="id" value={exercise.id} />
          <button className="elvt-button-secondary" type="submit">
            Delete this movement
          </button>
        </form>
      </section>
    </main>
  );
}
