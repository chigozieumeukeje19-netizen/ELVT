"use client";

import { QuestionField } from "@/components/intake/QuestionField";
import type { AnswerValue } from "@/lib/questionnaire/answers";
import type { Section } from "@/lib/questionnaire/types";

/**
 * One intake section, rendered read only for the visual pass.
 *
 * A client component because QuestionField is one, and an event handler cannot
 * cross the server boundary. The preview route is a server component, so the
 * no-op onChange has to be created on this side of it.
 */
export function IntakeSectionPreview({
  section,
  answers,
  errors,
}: {
  section: Section;
  answers: Record<string, AnswerValue>;
  errors?: Record<string, string>;
}) {
  return (
    <div className="mt-2">
      {section.questions.map((question) => (
        <QuestionField
          key={question.key}
          question={question}
          value={answers[question.key]}
          error={errors?.[question.key]}
          onChange={() => {}}
        />
      ))}
    </div>
  );
}
