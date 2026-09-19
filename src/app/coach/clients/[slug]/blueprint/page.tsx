import { notFound, redirect } from "next/navigation";
import { ScreenHeader } from "@/components/ScreenHeader";
import { BlueprintView } from "@/components/blueprint/BlueprintView";
import { PromptAndPaste } from "@/components/blueprint/PromptAndPaste";
import { blueprintDrafterPrompt } from "@/lib/ai/prompts";
import { currentProfile, isStaff } from "@/lib/auth";
import { deriveBlueprint, proposeTriggers } from "@/lib/blueprint/derive";
import { EMPTY_DRAFT, type Blueprint } from "@/lib/blueprint/types";
import { aiEnabled } from "@/lib/env";
import type { Answers } from "@/lib/questionnaire/answers";
import { supabaseServer } from "@/lib/supabase/server";
import {
  approveBlueprintAction,
  editBlueprintAction,
  saveBlueprintPasteAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function BlueprintPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; warned?: string }>;
}) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!isStaff(profile.role)) redirect("/client/today");

  const { slug } = await params;
  const { error, warned } = await searchParams;
  const supabase = await supabaseServer();

  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, last_name")
    .eq("slug", slug)
    .maybeSingle();
  if (!client) notFound();

  const name = [client.first_name, client.last_name].filter(Boolean).join(" ");

  const { data: response } = await supabase
    .from("questionnaire_responses")
    .select("answers, submitted_at")
    .eq("client_id", client.id)
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!response) {
    return (
      <main className="px-5 py-4">
        <ScreenHeader
          label="Blueprint"
          title={name}
          note="Nothing to draft from yet. The blueprint is built from the intake, so it waits until that is submitted."
        />
      </main>
    );
  }

  const answers = (response.answers ?? {}) as Answers;
  const derived = deriveBlueprint(answers);

  const { data: versions } = await supabase
    .from("blueprints")
    .select("id, version, status, content, approved_at")
    .eq("client_id", client.id)
    .order("version", { ascending: false });

  const rows = versions ?? [];
  const draft = rows.find((row) => row.status === "draft");
  const approved = rows.find((row) => row.status === "approved");
  const showing = draft ?? approved;

  const blueprint: Blueprint = showing
    ? (showing.content as Blueprint)
    : { derived, drafted: { ...EMPTY_DRAFT, triggers: proposeTriggers(derived) } };

  return (
    <main className="px-5 py-4">
      <ScreenHeader
        label="Blueprint"
        title={name}
        note={
          showing
            ? `Version ${showing.version}, ${showing.status === "approved" ? "approved" : "in draft"}`
            : "No draft yet"
        }
        error={error}
        actions={
          draft ? (
            <form action={approveBlueprintAction}>
              <input type="hidden" name="slug" value={slug} />
              <button className="elvt-button" type="submit" data-testid="approve-blueprint">
                Approve version {draft.version}
              </button>
            </form>
          ) : undefined
        }
      />

      {warned ? (
        <p className="mb-4 text-watch" data-testid="voice-warned">
          Saved, with {warned === "1" ? "one voice rule" : `${warned} voice rules`} worth
          a look. Edit below before you approve.
        </p>
      ) : null}

      {rows.length > 1 ? (
        <p className="mb-4 text-txt-mute">
          {rows.length} versions. The approved one is what every later draft
          reads, so an older program stays explicable after this changes.
        </p>
      ) : null}

      <BlueprintView blueprint={blueprint} />

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <PromptAndPaste
          title={aiEnabled() ? "Draft it" : "Draft it, prompt and paste"}
          prompt={blueprintDrafterPrompt(derived, answers as Record<string, unknown>)}
          action={saveBlueprintPasteAction}
          slug={slug}
          pasteName="paste"
          submitLabel="Save the draft"
        />

        <section>
          <h2 className="elvt-label">Or write it yourself</h2>
          <p className="mt-1 text-txt-dim">
            Everything here is editable until you approve. The facts on the left
            are not: those came from the client.
          </p>

          <form action={editBlueprintAction} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="slug" value={slug} />

            <label className="block">
              <span className="elvt-label">Summary</span>
              <textarea
                className="elvt-input mt-1 min-h-[80px]"
                name="summary"
                defaultValue={blueprint.drafted.summary}
              />
            </label>

            <label className="block">
              <span className="elvt-label">The one thing</span>
              <textarea
                className="elvt-input mt-1 min-h-[60px]"
                name="oneThing"
                defaultValue={blueprint.drafted.oneThing}
              />
            </label>

            <label className="block">
              <span className="elvt-label">Likely failure mode</span>
              <textarea
                className="elvt-input mt-1 min-h-[80px]"
                name="failureMode"
                defaultValue={blueprint.drafted.failureMode}
              />
            </label>

            <label className="block">
              <span className="elvt-label">How to write to them</span>
              <textarea
                className="elvt-input mt-1 min-h-[60px]"
                name="toneNotes"
                defaultValue={blueprint.drafted.toneNotes}
              />
            </label>

            <button className="elvt-button" type="submit">
              Save it
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
