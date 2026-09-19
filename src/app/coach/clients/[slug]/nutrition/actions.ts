"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentProfile, isStaff } from "@/lib/auth";
import { generateCaloriePath, PATH_SHAPES } from "@/lib/nutrition/calorie-path";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Writes for the nutrition tab.
 *
 * The arithmetic lives in src/lib/nutrition as pure functions with their own
 * tests. These read the weeks, hand them to those functions, and write the rows
 * back, so there is exactly one implementation of the rules and it is the
 * tested one.
 */

function pathFor(slug: string) {
  return `/coach/clients/${slug}/nutrition`;
}

function fail(slug: string, message: string): never {
  redirect(`${pathFor(slug)}?error=${encodeURIComponent(message)}`);
}

async function requireStaff(slug: string) {
  const profile = await currentProfile();
  if (!profile || !isStaff(profile.role)) fail(slug, "Not allowed.");
}

/** "4, 8" and "4 8" both mean the same thing to a coach typing quickly. */
function parseWeekList(raw: string, weekCount: number): number[] {
  return [
    ...new Set(
      raw
        .split(/[^0-9]+/)
        .filter(Boolean)
        .map(Number)
        .filter((week) => week >= 1 && week <= weekCount),
    ),
  ].sort((a, b) => a - b);
}

async function programFor(slug: string) {
  const supabase = await supabaseServer();

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!client) fail(slug, "That client could not be found.");

  const { data: program } = await supabase
    .from("programs")
    .select("id, duration_weeks")
    .eq("client_id", client.id)
    .eq("status", "active")
    .maybeSingle();
  if (!program) fail(slug, "That client has no active program.");

  return { supabase, clientId: client.id, program };
}

const regenerateSchema = z.object({
  slug: z.string().min(1),
  weekCount: z.coerce.number().int().min(1).max(52),
  startCalories: z.coerce.number().int().min(800).max(8000),
  endCalories: z.coerce.number().int().min(800).max(8000),
  protein: z.coerce.number().int().min(40).max(400),
  deloadWeeks: z.string().default(""),
  shape: z.enum(PATH_SHAPES),
});

export async function regeneratePathAction(formData: FormData) {
  const parsed = regenerateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const slug = String(formData.get("slug") ?? "");
    fail(slug, "Those numbers do not make a path. Check the calories and week count.");
  }

  const input = parsed.data;
  await requireStaff(input.slug);
  const { supabase, program } = await programFor(input.slug);

  // Mileage comes from the weeks themselves, so a mileage linked path bends
  // around what is actually programmed rather than around a number retyped here.
  const { data: weeks } = await supabase
    .from("program_weeks")
    .select("id, week_number, planned_mileage")
    .eq("program_id", program.id)
    .order("week_number");

  const rows = weeks ?? [];
  if (rows.length === 0) fail(input.slug, "That program has no weeks to write a path onto.");

  const mileage =
    input.shape === "mileage_linked"
      ? rows.slice(0, input.weekCount).map((week) => Number(week.planned_mileage ?? 0))
      : undefined;

  if (input.shape === "mileage_linked" && (mileage?.length ?? 0) < input.weekCount) {
    fail(input.slug, "A mileage linked path needs planned mileage on every week.");
  }

  let path;
  try {
    path = generateCaloriePath({
      weekCount: input.weekCount,
      startCalories: input.startCalories,
      endCalories: input.endCalories,
      protein: input.protein,
      deloadWeeks: parseWeekList(input.deloadWeeks, input.weekCount),
      shape: input.shape,
      mileage,
    });
  } catch (error) {
    fail(input.slug, error instanceof Error ? error.message : "That path could not be generated.");
  }

  for (const row of path) {
    const week = rows.find((candidate) => candidate.week_number === row.week);
    if (!week) continue;

    const { error } = await supabase
      .from("program_weeks")
      .update({
        calories: row.calories,
        protein: row.protein,
        carbs: row.carbs,
        fat: row.fat,
        calorie_note: row.note,
        calorie_status: "projected",
        is_deload: row.isDeload,
      })
      .eq("id", week.id);

    if (error) fail(input.slug, `Week ${row.week} could not be saved. ${error.message}`);
  }

  revalidatePath(pathFor(input.slug));
}
