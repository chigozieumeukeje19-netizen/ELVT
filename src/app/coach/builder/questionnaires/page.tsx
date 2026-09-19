import { redirect } from "next/navigation";
import { BuilderNav } from "@/components/BuilderNav";
import { ScreenHeader } from "@/components/ScreenHeader";
import { QuestionnaireOutline } from "@/components/questionnaire/QuestionnaireOutline";
import { currentProfile, isStaff } from "@/lib/auth";
import { INTAKE } from "@/lib/questionnaire/intake";
import { totalQuestions, type Questionnaire } from "@/lib/questionnaire/types";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * The questionnaire builder.
 *
 * The ELVT intake ships in code rather than in a row, because everything
 * downstream reads its keys: the blueprint drafter, the template applier's
 * flags, the calorie path's nutrition structure. A questionnaire a coach can
 * rename a key in at three in the morning would break all of them silently.
 * Stored questionnaires sit alongside it and can be edited freely.
 */
export default async function QuestionnaireBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!isStaff(profile.role)) redirect("/client/today");

  const { id } = await searchParams;
  const supabase = await supabaseServer();

  const { data: stored } = await supabase
    .from("questionnaires")
    .select("id, name, kind, sections")
    .order("created_at");

  const rows = stored ?? [];
  const selected = rows.find((row) => row.id === id);

  const questionnaire: Questionnaire = selected
    ? {
        name: selected.name,
        kind: selected.kind as Questionnaire["kind"],
        sections: (selected.sections ?? []) as Questionnaire["sections"],
      }
    : INTAKE;

  return (
    <main className="px-5 py-4">
      <BuilderNav current="/coach/builder/questionnaires" />
      <ScreenHeader
        label="Builder"
        title={questionnaire.name}
        note={`${questionnaire.sections.length} sections, ${totalQuestions(questionnaire)} questions`}
      />

      <nav aria-label="Questionnaires" className="mb-5 flex flex-wrap gap-2">
        <a
          href="/coach/builder/questionnaires"
          aria-current={selected ? undefined : "page"}
          className={`elvt-chip ${selected ? "" : "bg-raised text-txt"}`}
        >
          ELVT intake
        </a>
        {rows.map((row) => (
          <a
            key={row.id}
            href={`/coach/builder/questionnaires?id=${row.id}`}
            aria-current={selected?.id === row.id ? "page" : undefined}
            className={`elvt-chip ${selected?.id === row.id ? "bg-raised text-txt" : ""}`}
          >
            {row.name}
          </a>
        ))}
      </nav>

      {selected ? null : (
        <p className="mb-5 max-w-[70ch] text-txt-secondary">
          This one ships in code, because the blueprint drafter, the flag filter
          and the calorie path all read its keys by name. Copy it to make a
          version you can edit.
        </p>
      )}

      <QuestionnaireOutline questionnaire={questionnaire} />
    </main>
  );
}
