"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { readBlueprintPaste } from "@/lib/ai/paste";
import { currentProfile, isStaff } from "@/lib/auth";
import { deriveBlueprint, proposeTriggers } from "@/lib/blueprint/derive";
import { EMPTY_DRAFT, type Blueprint, type DraftedBlueprint } from "@/lib/blueprint/types";
import type { Answers } from "@/lib/questionnaire/answers";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Drafting, editing and approving a blueprint.
 *
 * Versioned rather than edited in place. The approved blueprint is the context
 * block every later AI job receives and the document the program was built
 * from, so a program written in week 1 has to stay explicable in week 9 even
 * after the blueprint has moved on. Approving therefore writes a new version
 * rather than overwriting the last one.
 *
 * The derived half is recomputed from the intake on every write. It is never
 * taken from a form and never taken from a paste, so no route through this file
 * can change a client's injury flags.
 */

function pathFor(slug: string) {
  return `/coach/clients/${slug}/blueprint`;
}

function fail(slug: string, message: string): never {
  redirect(`${pathFor(slug)}?error=${encodeURIComponent(message)}`);
}

async function context(slug: string) {
  const profile = await currentProfile();
  if (!profile || !isStaff(profile.role)) fail(slug, "Not allowed.");

  const supabase = await supabaseServer();
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!client) fail(slug, "That client could not be found.");

  const { data: response } = await supabase
    .from("questionnaire_responses")
    .select("answers, submitted_at")
    .eq("client_id", client.id)
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!response) fail(slug, "That client has not submitted their intake yet.");

  return {
    supabase,
    profile,
    clientId: client.id,
    answers: (response.answers ?? {}) as Answers,
  };
}

/** The version to write next. Never reuses a number, even after a delete. */
async function nextVersion(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  clientId: string,
): Promise<number> {
  const { data } = await supabase
    .from("blueprints")
    .select("version")
    .eq("client_id", clientId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.version ?? 0) + 1;
}

async function writeDraft(
  slug: string,
  clientId: string,
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  answers: Answers,
  drafted: DraftedBlueprint,
) {
  const derived = deriveBlueprint(answers);
  const blueprint: Blueprint = {
    derived,
    drafted: { ...drafted, triggers: proposeTriggers(derived) },
  };

  // One open draft at a time. A second would leave the coach approving a
  // document without knowing which of two they were looking at.
  const { data: open } = await supabase
    .from("blueprints")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "draft")
    .maybeSingle();

  if (open) {
    const { error } = await supabase
      .from("blueprints")
      .update({ content: blueprint })
      .eq("id", open.id);
    if (error) fail(slug, `That draft could not be saved. ${error.message}`);
    return;
  }

  const { error } = await supabase.from("blueprints").insert({
    client_id: clientId,
    version: await nextVersion(supabase, clientId),
    status: "draft",
    content: blueprint,
  });
  if (error) fail(slug, `That draft could not be saved. ${error.message}`);
}

export async function saveBlueprintPasteAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { supabase, clientId, answers } = await context(slug);

  const result = readBlueprintPaste(String(formData.get("paste") ?? ""));
  if (!result.ok) fail(slug, result.error);

  await writeDraft(slug, clientId, supabase, answers, result.value);

  const warned = result.warnings.length;
  redirect(
    warned > 0
      ? `${pathFor(slug)}?warned=${warned}`
      : pathFor(slug),
  );
}

const editSchema = z.object({
  slug: z.string().min(1),
  summary: z.string().min(1),
  oneThing: z.string().min(1),
  failureMode: z.string().min(1),
  toneNotes: z.string().default(""),
});

export async function editBlueprintAction(formData: FormData) {
  const parsed = editSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    fail(String(formData.get("slug") ?? ""), "The summary, the one thing and the failure mode all need something in them.");
  }

  const { slug, ...edited } = parsed.data;
  const { supabase, clientId, answers } = await context(slug);

  await writeDraft(slug, clientId, supabase, answers, { ...EMPTY_DRAFT, ...edited });
  revalidatePath(pathFor(slug));
}

export async function approveBlueprintAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { supabase, profile, clientId } = await context(slug);

  const { data: draft } = await supabase
    .from("blueprints")
    .select("id, version, content")
    .eq("client_id", clientId)
    .eq("status", "draft")
    .maybeSingle();

  if (!draft) fail(slug, "There is no draft to approve.");

  const blueprint = draft.content as Blueprint;
  if (!blueprint?.drafted?.oneThing) {
    fail(slug, "The one thing is empty, and every later job reads it. Draft or write it first.");
  }

  const { error } = await supabase
    .from("blueprints")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: profile.id,
    })
    .eq("id", draft.id)
    // Only while it is still a draft, so two clicks approve once.
    .eq("status", "draft");

  if (error) fail(slug, `That could not be approved. ${error.message}`);

  // The flags reach flag_config here and nowhere else, which is what makes the
  // template applier safe by construction rather than by memory.
  await supabase
    .from("clients")
    .update({
      flag_config: Object.fromEntries(blueprint.derived.flags.map((flag) => [flag, true])),
      one_thing: blueprint.drafted.oneThing,
      primary_goal: blueprint.derived.goalType,
      goal_statement: blueprint.derived.goalStatement,
      program_length_weeks: blueprint.derived.durationWeeks,
      communication_prefs: {
        tone: blueprint.derived.tone,
        reminder_time: blueprint.derived.reminderTime,
        checkin_day: blueprint.derived.checkinDay,
      },
    })
    .eq("id", clientId);

  for (const trigger of blueprint.drafted.triggers) {
    await supabase.from("client_triggers").upsert(
      {
        client_id: clientId,
        key: trigger.key,
        threshold: trigger.threshold,
        suggested_message: trigger.suggestedMessage,
        active: true,
      },
      { onConflict: "client_id,key" },
    );
  }

  await supabase.from("events").insert({
    type: "blueprint_approved",
    client_id: clientId,
    payload: { version: draft.version },
  });

  revalidatePath(pathFor(slug));
}
