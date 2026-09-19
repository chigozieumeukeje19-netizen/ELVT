import { redirect } from "next/navigation";
import { BuilderNav } from "@/components/BuilderNav";
import { ScreenHeader } from "@/components/ScreenHeader";
import { humanize } from "@/components/Field";
import { currentProfile, isStaff } from "@/lib/auth";
import { ALL_QUESTIONS, CATEGORIES } from "@/lib/checkin/bank";

export const dynamic = "force-dynamic";

/**
 * The question bank.
 *
 * Three columns carry the weight: who it applies to, what it can change, and
 * which category it belongs to. A question that applies to everyone and changes
 * nothing is a question that costs a client a minute every week and never moves
 * anything, and this is the screen where that is obvious.
 */
export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!isStaff(profile.role)) redirect("/client/today");

  const { category } = await searchParams;
  const shown = category
    ? ALL_QUESTIONS.filter((question) => question.category === category)
    : ALL_QUESTIONS;

  return (
    <main className="px-5 py-4">
      <BuilderNav current="/coach/builder/questions" />
      <ScreenHeader
        label="Builder"
        title={`${shown.length} questions`}
        note="Every one of these can change something. That is what lets a weekly form be built around whatever changed last Monday."
      />

      <nav aria-label="Categories" className="mb-4 flex flex-wrap gap-2">
        <a
          href="/coach/builder/questions"
          aria-current={category ? undefined : "page"}
          className={`elvt-chip ${category ? "" : "bg-panel-2 text-txt"}`}
        >
          All
        </a>
        {CATEGORIES.map((name) => (
          <a
            key={name}
            href={`/coach/builder/questions?category=${name}`}
            aria-current={category === name ? "page" : undefined}
            className={`elvt-chip ${category === name ? "bg-panel-2 text-txt" : ""}`}
          >
            {humanize(name)}
          </a>
        ))}
      </nav>

      <div className="overflow-x-auto">
        <table className="elvt-table min-w-[820px]" data-testid="question-bank">
          <caption className="sr-only">The question bank</caption>
          <thead>
            <tr>
              <th scope="col">Question</th>
              <th scope="col">Category</th>
              <th scope="col">Asked of</th>
              <th scope="col">Can change</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((question) => {
              const when = question.appliesWhen;
              const audience = [
                when.goals?.map(humanize).join(", "),
                when.flags?.length ? `${when.flags.map(humanize).join(" or ")} flag` : null,
                when.running ? "runners" : null,
                when.firstWeek ? "week 1" : null,
              ]
                .filter(Boolean)
                .join(", ");

              return (
                <tr key={question.key} data-testid="bank-row">
                  <th scope="row" className="max-w-[40ch] truncate font-normal">
                    {question.text}
                  </th>
                  <td className="text-txt-mute">{humanize(question.category)}</td>
                  <td className="max-w-[26ch] truncate text-txt-mute">
                    {audience || "Everyone"}
                  </td>
                  <td className="max-w-[28ch] truncate text-txt-mute">
                    {question.produces.map(humanize).join(", ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
