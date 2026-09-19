"use client";

import { useState } from "react";
import { IntakeForm } from "@/components/intake/IntakeForm";
import type { Answers } from "@/lib/questionnaire/answers";
import type { Questionnaire } from "@/lib/questionnaire/types";
import { saveIntakeDraft, submitIntake } from "./actions";

/**
 * Wires the form to its two server actions and owns the one screen the form
 * itself does not: what the client sees once it has gone.
 */
export function IntakeClient({
  token,
  questionnaire,
  initialAnswers,
  firstName,
}: {
  token: string;
  questionnaire: Questionnaire;
  initialAnswers: Answers;
  firstName: string | null;
}) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <div className="mx-auto w-full max-w-[560px] px-4 py-6" data-testid="intake-done">
        <p className="elvt-label">ELVT intake</p>
        <h1 className="mt-1 text-h2">
          {firstName ? `Thanks ${firstName}` : "Thanks"}
        </h1>
        <p className="mt-2 text-txt-secondary">
          That is with your coach. You will hear back with your plan, and the app
          will have your first week in it before you start.
        </p>
      </div>
    );
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mx-auto max-w-[560px] px-4 pt-4 text-flag">
          {error}
        </p>
      ) : null}

      <IntakeForm
        questionnaire={questionnaire}
        initialAnswers={initialAnswers}
        storageKey={`elvt-intake-${token}`}
        onSaveSection={async (answers) => {
          const result = await saveIntakeDraft(token, answers);
          if (!result.ok) throw new Error(result.error);
        }}
        onSubmit={async (answers) => {
          const result = await submitIntake(token, answers);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setError(null);
          setSent(true);
        }}
      />
    </>
  );
}
