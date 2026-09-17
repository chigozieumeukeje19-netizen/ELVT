"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentProfile, isStaff } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

const REVIEW_PATH = "/coach/builder/exercises/review";

/**
 * A server action bound straight to a form has to return void, so a problem is
 * reported by sending the coach back to the screen with a message rather than
 * by returning one.
 */
function fail(message: string): never {
  redirect(`${REVIEW_PATH}?error=${encodeURIComponent(message)}`);
}

const resolveSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(90),
  youtubeId: z.string().regex(/^[A-Za-z0-9_-]{11}$/).or(z.literal("")),
  aliases: z.string().optional(),
});

/**
 * Accepts a reviewed movement: sets the name a coach confirmed, keeps whatever
 * the parser produced as an alias so the next import matches it, and clears the
 * review flag.
 */
export async function resolveExercise(formData: FormData): Promise<void> {
  const profile = await currentProfile();
  if (!profile || !isStaff(profile.role)) fail("Not allowed.");

  const parsed = resolveSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    youtubeId: formData.get("youtubeId") ?? "",
    aliases: formData.get("aliases") ?? "",
  });

  if (!parsed.success) fail("Check the name and the video id.");

  const supabase = await supabaseServer();

  const { data: existing } = await supabase
    .from("exercises")
    .select("name, aliases, media")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (!existing) fail("That movement is no longer in the library.");

  const aliases = new Set<string>(existing.aliases ?? []);
  if (existing.name && existing.name !== parsed.data.name) {
    // Only keep a real former spelling, not the placeholder the import wrote
    // for a video it could not name.
    if (!existing.name.startsWith("Unnamed video ")) {
      aliases.add(existing.name);
    }
  }
  for (const extra of (parsed.data.aliases ?? "").split(",")) {
    const trimmed = extra.trim();
    if (trimmed) aliases.add(trimmed);
  }

  const media = {
    ...(existing.media as Record<string, unknown>),
    youtube_id: parsed.data.youtubeId || null,
    source: parsed.data.youtubeId ? "youtube_verified" : null,
    thumb_url: parsed.data.youtubeId
      ? `https://i.ytimg.com/vi/${parsed.data.youtubeId}/hqdefault.jpg`
      : null,
    verified_at: parsed.data.youtubeId ? new Date().toISOString() : null,
  };

  const { error } = await supabase
    .from("exercises")
    .update({
      name: parsed.data.name,
      aliases: [...aliases],
      media,
      needs_review: false,
      review_note: null,
    })
    .eq("id", parsed.data.id);

  if (error) fail(error.message);

  revalidatePath(REVIEW_PATH);
}

/** Drops a row the import produced that is not a movement at all. */
export async function discardExercise(formData: FormData): Promise<void> {
  const profile = await currentProfile();
  if (!profile || !isStaff(profile.role)) fail("Not allowed.");

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) fail("That row could not be identified.");

  const supabase = await supabaseServer();
  const { error } = await supabase.from("exercises").delete().eq("id", id.data);
  if (error) fail(error.message);

  revalidatePath(REVIEW_PATH);
}
