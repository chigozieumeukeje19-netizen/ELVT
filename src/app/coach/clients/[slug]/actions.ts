"use server";

import { revalidatePath } from "next/cache";
import { currentProfile, isStaff } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Coach notes. Private, and never rendered anywhere a client can reach.
 *
 * A server action rather than an API route because it is one field on one
 * screen, and it runs as the coach so RLS decides whether this row is theirs
 * to write.
 */
export async function saveCoachNotesAction(slug: string, formData: FormData): Promise<void> {
  const profile = await currentProfile();
  if (!profile || !isStaff(profile.role)) {
    throw new Error("Only staff can write coach notes.");
  }

  const notes = String(formData.get("notes") ?? "");
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("clients")
    .update({ coach_notes: notes })
    .eq("slug", slug);

  if (error) throw new Error(`Coach notes: ${error.message}`);

  revalidatePath(`/coach/clients/${slug}`);
}
