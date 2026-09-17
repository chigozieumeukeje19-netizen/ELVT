"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentProfile, isStaff } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import {
  CALORIE_SHAPES,
  FLAG_KEYS,
  PATTERNS,
  RUN_TYPES,
  SECTION_TYPES,
  STIMULI,
} from "@/lib/program/types";

/**
 * Builder writes. Every one of these is staff only and reports a problem by
 * sending the coach back to the screen with a message, because a server action
 * bound straight to a form has to return void.
 */

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function requireStaff(path: string) {
  const profile = await currentProfile();
  if (!profile || !isStaff(profile.role)) fail(path, "Not allowed.");
  return profile;
}

const EXERCISES_PATH = "/coach/builder/exercises";

/** Comma separated free text into a clean list, no empties, no duplicates. */
function toList(value: FormDataEntryValue | null): string[] {
  return [
    ...new Set(
      String(value ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

const exerciseSchema = z.object({
  name: z.string().min(2).max(90),
  pattern: z.enum(PATTERNS).nullable(),
  type: z.string().nullable(),
  primary_muscle: z.string().nullable(),
  level: z.enum(["beginner", "intermediate", "advanced"]).nullable(),
  unilateral: z.boolean(),
  youtube_id: z.string().regex(/^[A-Za-z0-9_-]{11}$/).nullable(),
});

function readExerciseForm(formData: FormData) {
  const youtube = String(formData.get("youtubeId") ?? "").trim();
  return exerciseSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    pattern: (String(formData.get("pattern") ?? "") || null) as never,
    type: String(formData.get("type") ?? "").trim() || null,
    primary_muscle: String(formData.get("primaryMuscle") ?? "").trim() || null,
    level: (String(formData.get("level") ?? "") || null) as never,
    unilateral: formData.get("unilateral") === "on",
    youtube_id: youtube || null,
  });
}

export async function createExercise(formData: FormData): Promise<void> {
  await requireStaff(EXERCISES_PATH);

  const parsed = readExerciseForm(formData);
  if (!parsed.success) {
    fail(EXERCISES_PATH, "Check the name, and the video id if you gave one.");
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.from("exercises").insert({
    name: parsed.data.name,
    aliases: toList(formData.get("aliases")),
    pattern: parsed.data.pattern,
    type: parsed.data.type,
    primary_muscle: parsed.data.primary_muscle,
    equipment: toList(formData.get("equipment")),
    level: parsed.data.level,
    unilateral: parsed.data.unilateral,
    is_custom: true,
    media: {
      youtube_id: parsed.data.youtube_id,
      gif_url: null,
      video_url: null,
      thumb_url: parsed.data.youtube_id
        ? `https://i.ytimg.com/vi/${parsed.data.youtube_id}/hqdefault.jpg`
        : null,
      source: parsed.data.youtube_id ? "youtube_verified" : null,
      verified_at: parsed.data.youtube_id ? new Date().toISOString() : null,
    },
  });

  if (error) {
    fail(
      EXERCISES_PATH,
      error.code === "23505"
        ? "A movement with that name is already in the library."
        : error.message,
    );
  }

  revalidatePath(EXERCISES_PATH);
}

export async function updateExercise(formData: FormData): Promise<void> {
  await requireStaff(EXERCISES_PATH);

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) fail(EXERCISES_PATH, "That movement could not be identified.");

  const parsed = readExerciseForm(formData);
  if (!parsed.success) {
    fail(`${EXERCISES_PATH}/${id.data}`, "Check the name and the video id.");
  }

  const supabase = await supabaseServer();
  const { data: existing } = await supabase
    .from("exercises")
    .select("media")
    .eq("id", id.data)
    .maybeSingle();

  const { error } = await supabase
    .from("exercises")
    .update({
      name: parsed.data.name,
      aliases: toList(formData.get("aliases")),
      pattern: parsed.data.pattern,
      type: parsed.data.type,
      primary_muscle: parsed.data.primary_muscle,
      equipment: toList(formData.get("equipment")),
      level: parsed.data.level,
      unilateral: parsed.data.unilateral,
      media: {
        ...((existing?.media as Record<string, unknown>) ?? {}),
        youtube_id: parsed.data.youtube_id,
        source: parsed.data.youtube_id ? "youtube_verified" : null,
        thumb_url: parsed.data.youtube_id
          ? `https://i.ytimg.com/vi/${parsed.data.youtube_id}/hqdefault.jpg`
          : null,
      },
      needs_review: false,
    })
    .eq("id", id.data);

  if (error) fail(`${EXERCISES_PATH}/${id.data}`, error.message);

  revalidatePath(EXERCISES_PATH);
  revalidatePath(`${EXERCISES_PATH}/${id.data}`);
}

export async function deleteExercise(formData: FormData): Promise<void> {
  await requireStaff(EXERCISES_PATH);

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) fail(EXERCISES_PATH, "That movement could not be identified.");

  const supabase = await supabaseServer();
  const { error } = await supabase.from("exercises").delete().eq("id", id.data);

  if (error) {
    fail(
      EXERCISES_PATH,
      error.code === "23503"
        ? "That movement is used in a program, so it cannot be deleted. Retire it instead."
        : error.message,
    );
  }

  revalidatePath(EXERCISES_PATH);
  redirect(EXERCISES_PATH);
}

/**
 * Contraindications are the whole safety mechanism: the applier and every swap
 * list join through this table, so a client carrying the flag never sees the
 * movement. Saved as a full replacement of the set rather than a diff, so the
 * checkboxes on screen are exactly what ends up stored.
 */
export async function setContraindications(formData: FormData): Promise<void> {
  await requireStaff(EXERCISES_PATH);

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) fail(EXERCISES_PATH, "That movement could not be identified.");

  const chosen = FLAG_KEYS.filter((key) => formData.get(`flag_${key}`) === "on");
  const supabase = await supabaseServer();

  const { error: clearError } = await supabase
    .from("exercise_contraindications")
    .delete()
    .eq("exercise_id", id.data);
  if (clearError) fail(`${EXERCISES_PATH}/${id.data}`, clearError.message);

  if (chosen.length > 0) {
    const { error } = await supabase.from("exercise_contraindications").insert(
      chosen.map((flag_key) => ({ exercise_id: id.data, flag_key })),
    );
    if (error) fail(`${EXERCISES_PATH}/${id.data}`, error.message);
  }

  revalidatePath(`${EXERCISES_PATH}/${id.data}`);
}

export async function addAlternative(formData: FormData): Promise<void> {
  await requireStaff(EXERCISES_PATH);

  const parsed = z
    .object({
      id: z.string().uuid(),
      altId: z.string().uuid(),
      reason: z.enum(["equipment", "injury", "level"]),
    })
    .safeParse({
      id: formData.get("id"),
      altId: formData.get("altId"),
      reason: formData.get("reason"),
    });

  if (!parsed.success) fail(EXERCISES_PATH, "Pick a movement and a reason.");
  if (parsed.data.id === parsed.data.altId) {
    fail(`${EXERCISES_PATH}/${parsed.data.id}`, "A movement cannot replace itself.");
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.from("exercise_alternatives").insert({
    exercise_id: parsed.data.id,
    alt_exercise_id: parsed.data.altId,
    reason: parsed.data.reason,
  });

  if (error && error.code !== "23505") {
    fail(`${EXERCISES_PATH}/${parsed.data.id}`, error.message);
  }

  revalidatePath(`${EXERCISES_PATH}/${parsed.data.id}`);
}

export async function removeAlternative(formData: FormData): Promise<void> {
  await requireStaff(EXERCISES_PATH);

  const parsed = z
    .object({ id: z.string().uuid(), rowId: z.string().uuid() })
    .safeParse({ id: formData.get("id"), rowId: formData.get("rowId") });

  if (!parsed.success) fail(EXERCISES_PATH, "That alternative could not be identified.");

  const supabase = await supabaseServer();
  await supabase.from("exercise_alternatives").delete().eq("id", parsed.data.rowId);

  revalidatePath(`${EXERCISES_PATH}/${parsed.data.id}`);
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const TEMPLATES_PATH = "/coach/builder/templates";

export async function createProgramTemplate(formData: FormData): Promise<void> {
  await requireStaff(TEMPLATES_PATH);

  const parsed = z
    .object({
      name: z.string().min(2).max(90),
      goalType: z.string().min(1),
      durationWeeks: z.coerce.number().int().min(1).max(52),
      liftsPerWeek: z.coerce.number().int().min(0).max(7),
      runsPerWeek: z.coerce.number().int().min(0).max(7),
      deloadEveryNWeeks: z.coerce.number().int().min(0).max(12),
      caloriePathShape: z.enum(CALORIE_SHAPES),
    })
    .safeParse({
      name: formData.get("name"),
      goalType: formData.get("goalType"),
      durationWeeks: formData.get("durationWeeks"),
      liftsPerWeek: formData.get("liftsPerWeek"),
      runsPerWeek: formData.get("runsPerWeek"),
      deloadEveryNWeeks: formData.get("deloadEveryNWeeks"),
      caloriePathShape: formData.get("caloriePathShape"),
    });

  if (!parsed.success) fail(TEMPLATES_PATH, "Check the split and the duration.");

  const d = parsed.data;
  const supabase = await supabaseServer();
  const { error } = await supabase.from("program_templates").insert({
    name: d.name,
    goal_type: d.goalType,
    duration_weeks: d.durationWeeks,
    split: `${d.liftsPerWeek} lifts, ${d.runsPerWeek} runs`,
    body: {
      split: { liftsPerWeek: d.liftsPerWeek, runsPerWeek: d.runsPerWeek },
      // One phase spanning the block until the coach splits it. A template
      // with no phases would leave the week strip with nothing to band.
      phases: [
        { name: "Build", startWeek: 1, endWeek: d.durationWeeks, tone: "panel-2" },
      ],
      deload: { everyNWeeks: d.deloadEveryNWeeks, holdCalories: true },
      caloriePathShape: d.caloriePathShape,
      sessions: [],
    },
  });

  if (error) fail(TEMPLATES_PATH, error.message);
  revalidatePath(TEMPLATES_PATH);
}

export async function createWorkoutTemplate(formData: FormData): Promise<void> {
  await requireStaff(TEMPLATES_PATH);

  const parsed = z
    .object({
      name: z.string().min(2).max(90),
      stimulus: z.enum(STIMULI),
      sectionType: z.enum(SECTION_TYPES),
    })
    .safeParse({
      name: formData.get("name"),
      stimulus: formData.get("stimulus"),
      sectionType: formData.get("sectionType"),
    });

  if (!parsed.success) fail(TEMPLATES_PATH, "Check the name and the stimulus.");

  const supabase = await supabaseServer();
  const { error } = await supabase.from("workout_templates").insert({
    name: parsed.data.name,
    body: {
      stimulus: parsed.data.stimulus,
      sections: [{ type: parsed.data.sectionType, exercises: [] }],
    },
  });

  if (error) fail(TEMPLATES_PATH, error.message);
  revalidatePath(TEMPLATES_PATH);
}

export async function createRunTemplate(formData: FormData): Promise<void> {
  await requireStaff(TEMPLATES_PATH);

  const parsed = z
    .object({
      name: z.string().min(2).max(90),
      runType: z.enum(RUN_TYPES),
      distanceTarget: z.coerce.number().min(0).max(200).nullable(),
    })
    .safeParse({
      name: formData.get("name"),
      runType: formData.get("runType"),
      distanceTarget: formData.get("distanceTarget") || null,
    });

  if (!parsed.success) fail(TEMPLATES_PATH, "Check the name and the run type.");

  // A long run and a hard session load the same tissue, which is what the
  // spacing rule needs to know.
  const stimulus =
    parsed.data.runType === "long"
      ? "long_run"
      : ["tempo", "threshold", "intervals", "hills", "race_pace", "race"].includes(
            parsed.data.runType,
          )
        ? "hard_run"
        : "easy_run";

  const supabase = await supabaseServer();
  const { error } = await supabase.from("run_templates").insert({
    name: parsed.data.name,
    run_type: parsed.data.runType,
    body: {
      runType: parsed.data.runType,
      stimulus,
      distanceTarget: parsed.data.distanceTarget ?? undefined,
    },
  });

  if (error) fail(TEMPLATES_PATH, error.message);
  revalidatePath(TEMPLATES_PATH);
}
