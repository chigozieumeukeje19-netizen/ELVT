import { notFound } from "next/navigation";
import { INTAKE } from "@/lib/questionnaire/intake";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Answers } from "@/lib/questionnaire/answers";
import { IntakeClient } from "./IntakeClient";

export const dynamic = "force-dynamic";

/**
 * The intake, opened from a link.
 *
 * Public by design: a new client has no account yet, and asking them to make
 * one before they have decided to work with you is how a form goes unfinished.
 * The token is a response row id and nothing else is taken from the URL.
 */
export default async function IntakePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = supabaseAdmin();
  const { data: response } = await supabase
    .from("questionnaire_responses")
    .select("id, answers, submitted_at, clients(first_name)")
    .eq("id", token)
    .maybeSingle();

  if (!response) notFound();

  if (response.submitted_at) {
    return (
      <main className="mx-auto w-full max-w-[560px] px-4 py-6" data-testid="intake-done">
        <p className="elvt-label">ELVT intake</p>
        <h1 className="mt-1 text-h2">That is with your coach</h1>
        <p className="mt-2 text-txt-secondary">
          Nothing else to do. You will hear back with your plan, and the app will
          have your first week in it before you start.
        </p>
      </main>
    );
  }

  const embedded = response.clients as { first_name?: string } | { first_name?: string }[] | null;
  const firstName = Array.isArray(embedded) ? embedded[0]?.first_name : embedded?.first_name;

  return (
    <main className="min-h-screen bg-page">
      <IntakeClient
        token={token}
        questionnaire={INTAKE}
        initialAnswers={(response.answers ?? {}) as Answers}
        firstName={firstName ?? null}
      />
    </main>
  );
}
