import { humanize } from "@/components/Field";
import type { Questionnaire } from "@/lib/questionnaire/types";

/**
 * A questionnaire as the coach reads it: sections down the page, questions as
 * rows, the type and what the answer can change stated on each one.
 *
 * The produces column is the point of this screen. A question that changes
 * nothing is a question that wastes a client's attention, and this is where
 * that shows up.
 */
export function QuestionnaireOutline({ questionnaire }: { questionnaire: Questionnaire }) {
  if (questionnaire.sections.length === 0) {
    return (
      <p className="text-txt-secondary" data-testid="outline-empty">
        Nothing in this questionnaire yet. Add a section and its questions and
        they will show up here in the order a client sees them.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="questionnaire-outline">
      {questionnaire.sections.map((section, index) => (
        <section key={section.key} data-testid="outline-section">
          <div className="flex items-baseline gap-3">
            <span className="elvt-num text-txt-tertiary">{index + 1}</span>
            <h3 className="text-h3">{section.title}</h3>
            <span className="elvt-label text-txt-tertiary">
              {section.questions.length}{" "}
              {section.questions.length === 1 ? "question" : "questions"}
            </span>
          </div>
          <p className="mt-1 max-w-[70ch] text-txt-secondary">{section.intent}</p>

          <div className="mt-2 overflow-x-auto">
            <table className="elvt-table min-w-[640px]">
              <caption className="sr-only">Questions in {section.title}</caption>
              <thead>
                <tr>
                  <th scope="col">Question</th>
                  <th scope="col">Type</th>
                  <th scope="col">Needed</th>
                  <th scope="col">Can change</th>
                </tr>
              </thead>
              <tbody>
                {section.questions.map((question) => (
                  <tr key={question.key} data-testid="outline-question">
                    <th scope="row" className="max-w-[40ch] truncate font-normal">
                      {question.text}
                    </th>
                    <td className="text-txt-secondary">{humanize(question.type)}</td>
                    <td className="text-txt-secondary">{question.required ? "Yes" : "No"}</td>
                    <td className="max-w-[24ch] truncate text-txt-secondary">
                      {(question.produces ?? []).map(humanize).join(", ") || "Nothing"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
