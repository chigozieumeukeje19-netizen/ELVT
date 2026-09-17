"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentProfile, isStaff } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Week level writes for the program tab.
 *
 * The logic each of these applies lives in src/lib/program/edits.ts as a pure
 * transform with its own tests. These are the persistence half: they read the
 * week, hand it to the transform, and write the result back.
 *
 * Sessions move by being re-parented to a different program_day, so a move
 * keeps the session row and everything hanging off it. Rebuilding the session
 * would lose its logs.
 */

function pathFor(slug: string) {
  return `/coach/clients/${slug}/program`;
}

function fail(slug: string, message: string): never {
  redirect(`${pathFor(slug)}?error=${encodeURIComponent(message)}`);
}

async function requireStaff(slug: string) {
  const profile = await currentProfile();
  if (!profile || !isStaff(profile.role)) fail(slug, "Not allowed.");
}

const base = z.object({ slug: z.string().min(1), weekNumber: z.coerce.number().int().min(1) });

async function weekContext(slug: string, weekNumber: number) {
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
  if (!program) fail(slug, "This client has no active program yet.");

  const { data: week } = await supabase
    .from("program_weeks")
    .select("id, week_number, is_deload, program_days(id, date, day_of_week, is_rest)")
    .eq("program_id", program.id)
    .eq("week_number", weekNumber)
    .maybeSingle();
  if (!week) fail(slug, "That week is not part of this program.");

  return { supabase, client, program, week };
}

/** Marks or unmarks a deload. A deload holds calories flat, per spec 6.3. */
export async function setDeloadAction(formData: FormData): Promise<void> {
  const parsed = base
    .extend({ isDeload: z.enum(["0", "1"]) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(String(formData.get("slug") ?? ""), "Could not read that week.");

  await requireStaff(parsed.data.slug);
  const { supabase, week } = await weekContext(parsed.data.slug, parsed.data.weekNumber);

  await supabase
    .from("program_weeks")
    .update({ is_deload: parsed.data.isDeload === "1" })
    .eq("id", week.id);

  revalidatePath(pathFor(parsed.data.slug));
}

/** Empties a week. The days stay; what sits on them goes. */
export async function clearWeekAction(formData: FormData): Promise<void> {
  const parsed = base.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(String(formData.get("slug") ?? ""), "Could not read that week.");

  await requireStaff(parsed.data.slug);
  const { supabase, week } = await weekContext(parsed.data.slug, parsed.data.weekNumber);

  const dayIds = (week.program_days as { id: string }[]).map((d) => d.id);
  await supabase.from("sessions").delete().in("program_day_id", dayIds);
  await supabase.from("program_days").update({ is_rest: true }).in("id", dayIds);

  revalidatePath(pathFor(parsed.data.slug));
}

/**
 * Swaps two days. Re-parenting the sessions moves the work; the rest markers
 * are swapped alongside so a day keeps its whole character.
 */
export async function swapDaysAction(formData: FormData): Promise<void> {
  const parsed = base
    .extend({
      dayA: z.coerce.number().int().min(0).max(6),
      dayB: z.coerce.number().int().min(0).max(6),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(String(formData.get("slug") ?? ""), "Pick two days.");
  if (parsed.data.dayA === parsed.data.dayB) {
    fail(parsed.data.slug, "Those are the same day.");
  }

  await requireStaff(parsed.data.slug);
  const { supabase, week } = await weekContext(parsed.data.slug, parsed.data.weekNumber);

  const days = week.program_days as {
    id: string;
    day_of_week: number;
    is_rest: boolean;
  }[];
  const a = days.find((d) => d.day_of_week === parsed.data.dayA);
  const b = days.find((d) => d.day_of_week === parsed.data.dayB);
  if (!a || !b) fail(parsed.data.slug, "One of those days is not in this week.");

  // Park one side on a day that cannot collide, then land both.
  await supabase.from("sessions").update({ program_day_id: b.id }).eq("program_day_id", a.id);
  await supabase.from("sessions").update({ program_day_id: a.id }).eq("program_day_id", b.id);
  await supabase.from("program_days").update({ is_rest: b.is_rest }).eq("id", a.id);
  await supabase.from("program_days").update({ is_rest: a.is_rest }).eq("id", b.id);

  revalidatePath(pathFor(parsed.data.slug));
}

/** Moves one session to another date. This is what the day grid drop calls. */
export async function moveSessionAction(input: {
  slug: string;
  sessionId: string;
  toDate: string;
}): Promise<{ ok: boolean; error?: string }> {
  const profile = await currentProfile();
  if (!profile || !isStaff(profile.role)) return { ok: false, error: "Not allowed." };

  const parsed = z
    .object({
      slug: z.string().min(1),
      sessionId: z.string().uuid(),
      toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Could not read that move." };

  const supabase = await supabaseServer();

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", parsed.data.slug)
    .maybeSingle();
  if (!client) return { ok: false, error: "That client could not be found." };

  // The target day has to belong to this client, or a crafted request could
  // move a session into someone else's program. RLS would refuse the write,
  // but failing here gives a readable answer instead of a silent no-op.
  const { data: target } = await supabase
    .from("program_days")
    .select("id")
    .eq("client_id", client.id)
    .eq("date", parsed.data.toDate)
    .maybeSingle();
  if (!target) return { ok: false, error: "That day is not in this program." };

  const { error } = await supabase
    .from("sessions")
    .update({ program_day_id: target.id, from_template: false })
    .eq("id", parsed.data.sessionId)
    .eq("client_id", client.id);

  if (error) return { ok: false, error: error.message };

  await supabase.from("program_days").update({ is_rest: false }).eq("id", target.id);
  revalidatePath(pathFor(parsed.data.slug));
  return { ok: true };
}

/**
 * Deep copies one week's sessions onto another week's days.
 *
 * A duplicate is new rows, not a reference: the coach edits week 5 afterwards
 * without week 4 changing under them. Logs are not copied, because they belong
 * to the week that was actually trained.
 */
async function copyWeek(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  clientId: string,
  sourceWeekId: string,
  targetWeekId: string,
): Promise<void> {
  const { data: source } = await supabase
    .from("program_days")
    .select(
      `id, day_of_week, is_rest,
       sessions ( kind, name, order, fueling_notes, coach_notes, from_template,
         session_sections ( type, order, rounds, duration_sec, name,
           session_exercises ( exercise_id, order, sets, tracking_fields, notes, rir_guidance ) ),
         runs ( run_type, distance_target, duration_target, pace_min, pace_max,
                hr_min, hr_max, rpe_target, warmup, workout_body, cooldown, fueling ) )`,
    )
    .eq("program_week_id", sourceWeekId);

  const { data: targetDays } = await supabase
    .from("program_days")
    .select("id, day_of_week")
    .eq("program_week_id", targetWeekId);

  if (!source || !targetDays) return;

  const targetByDow = new Map(targetDays.map((d) => [d.day_of_week, d.id]));

  // The target week is replaced, not merged, so duplicating twice is the same
  // as duplicating once.
  await supabase
    .from("sessions")
    .delete()
    .in("program_day_id", targetDays.map((d) => d.id));

  for (const day of source as unknown as {
    day_of_week: number;
    is_rest: boolean;
    sessions: Record<string, unknown>[];
  }[]) {
    const targetDayId = targetByDow.get(day.day_of_week);
    if (!targetDayId) continue;

    await supabase
      .from("program_days")
      .update({ is_rest: day.is_rest })
      .eq("id", targetDayId);

    for (const session of day.sessions ?? []) {
      const { session_sections, runs, ...sessionFields } = session as {
        session_sections: Record<string, unknown>[];
        runs: Record<string, unknown>[];
      } & Record<string, unknown>;

      const { data: inserted } = await supabase
        .from("sessions")
        .insert({ ...sessionFields, client_id: clientId, program_day_id: targetDayId })
        .select("id")
        .single();
      if (!inserted) continue;

      for (const section of session_sections ?? []) {
        const { session_exercises, ...sectionFields } = section as {
          session_exercises: Record<string, unknown>[];
        } & Record<string, unknown>;

        const { data: newSection } = await supabase
          .from("session_sections")
          .insert({ ...sectionFields, client_id: clientId, session_id: inserted.id })
          .select("id")
          .single();
        if (!newSection) continue;

        if ((session_exercises ?? []).length > 0) {
          await supabase.from("session_exercises").insert(
            session_exercises.map((exercise) => ({
              ...exercise,
              client_id: clientId,
              section_id: newSection.id,
            })),
          );
        }
      }

      for (const run of runs ?? []) {
        await supabase
          .from("runs")
          .insert({ ...run, client_id: clientId, session_id: inserted.id });
      }
    }
  }
}

export async function duplicateWeekAction(formData: FormData): Promise<void> {
  const parsed = base.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(String(formData.get("slug") ?? ""), "Could not read that week.");

  await requireStaff(parsed.data.slug);
  const { supabase, client, program, week } = await weekContext(
    parsed.data.slug,
    parsed.data.weekNumber,
  );

  const { data: next } = await supabase
    .from("program_weeks")
    .select("id")
    .eq("program_id", program.id)
    .eq("week_number", parsed.data.weekNumber + 1)
    .maybeSingle();

  if (!next) fail(parsed.data.slug, "This is the last week of the program.");

  await copyWeek(supabase, client.id, week.id, next.id);
  revalidatePath(pathFor(parsed.data.slug));
}

export async function duplicateToRangeAction(formData: FormData): Promise<void> {
  const parsed = base
    .extend({
      fromWeek: z.coerce.number().int().min(1),
      toWeek: z.coerce.number().int().min(1),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(String(formData.get("slug") ?? ""), "Check the week range.");

  await requireStaff(parsed.data.slug);
  const { supabase, client, program, week } = await weekContext(
    parsed.data.slug,
    parsed.data.weekNumber,
  );

  const low = Math.min(parsed.data.fromWeek, parsed.data.toWeek);
  const high = Math.max(parsed.data.fromWeek, parsed.data.toWeek);

  const { data: targets } = await supabase
    .from("program_weeks")
    .select("id, week_number")
    .eq("program_id", program.id)
    .gte("week_number", low)
    .lte("week_number", high)
    .order("week_number");

  for (const target of targets ?? []) {
    if (target.week_number === parsed.data.weekNumber) continue;
    await copyWeek(supabase, client.id, week.id, target.id);
  }

  revalidatePath(pathFor(parsed.data.slug));
}

/**
 * Shifts a week's contents one day later or earlier, wrapping. The dates stay
 * put and what sits on them moves, which is the transform in edits.ts.
 */
export async function shiftWeekAction(formData: FormData): Promise<void> {
  const parsed = base
    .extend({ days: z.coerce.number().int().min(-6).max(6) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(String(formData.get("slug") ?? ""), "Could not read that shift.");

  await requireStaff(parsed.data.slug);
  const { supabase, week } = await weekContext(parsed.data.slug, parsed.data.weekNumber);

  const days = (week.program_days as { id: string; day_of_week: number; is_rest: boolean }[])
    .slice()
    .sort((a, b) => a.day_of_week - b.day_of_week);

  const size = days.length;
  const offset = ((parsed.data.days % size) + size) % size;

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, program_day_id")
    .in("program_day_id", days.map((d) => d.id));

  const targetFor = new Map<string, string>();
  const restFor = new Map<string, boolean>();
  days.forEach((day, index) => {
    const target = days[(index + offset) % size];
    targetFor.set(day.id, target.id);
    restFor.set(target.id, day.is_rest);
  });

  for (const session of sessions ?? []) {
    const target = targetFor.get(session.program_day_id);
    if (target) {
      await supabase.from("sessions").update({ program_day_id: target }).eq("id", session.id);
    }
  }

  for (const [dayId, isRest] of restFor) {
    await supabase.from("program_days").update({ is_rest: isRest }).eq("id", dayId);
  }

  revalidatePath(pathFor(parsed.data.slug));
}
