"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { QuestionField } from "@/components/intake/QuestionField";
import {
  progress,
  sectionProgress,
  validate,
  visible,
  type AnswerValue,
  type Answers,
} from "@/lib/questionnaire/answers";
import type { Questionnaire } from "@/lib/questionnaire/types";

/**
 * The intake, one section at a time.
 *
 * Resumable in two places on purpose. Every change is written to
 * localStorage immediately, so closing the tab loses nothing even offline, and
 * every section advance is saved to the server, so changing phone loses nothing
 * either. A form this long that loses answers is a form nobody finishes twice.
 *
 * Validation runs on the section being left, not on the whole form, so a client
 * on section two is never shown eight errors about section nine.
 */
export function IntakeForm({
  questionnaire,
  initialAnswers,
  storageKey,
  onSaveSection,
  onSubmit,
}: {
  questionnaire: Questionnaire;
  initialAnswers: Answers;
  storageKey: string;
  onSaveSection: (answers: Answers) => Promise<void>;
  onSubmit: (answers: Answers) => Promise<void>;
}) {
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [index, setIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  // Whatever is newer wins. A draft saved on this device after the server copy
  // is the one the client was last looking at.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as { answers: Answers; at: number };
      if (parsed?.answers) setAnswers((current) => ({ ...current, ...parsed.answers }));
    } catch {
      // A private window, or storage the browser refuses. The server copy is
      // still there, so this is a convenience rather than the mechanism.
    }
  }, [storageKey]);

  const shown = useMemo(() => visible(questionnaire, answers), [questionnaire, answers]);
  const sections = shown.sections;
  const section = sections[Math.min(index, sections.length - 1)];
  const bar = progress(shown, answers);
  const perSection = sectionProgress(shown, answers);

  const set = useCallback(
    (key: string, value: AnswerValue) => {
      setAnswers((current) => {
        const next = { ...current, [key]: value };
        try {
          window.localStorage.setItem(storageKey, JSON.stringify({ answers: next, at: Date.now() }));
        } catch {
          // See above. Nothing here depends on it succeeding.
        }
        return next;
      });
      setErrors((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    },
    [storageKey],
  );

  /** Only the section being left, so nobody is shown errors about section nine. */
  function checkSection(): boolean {
    const only = { ...shown, sections: [section] };
    const issues = validate(only, Object.fromEntries(
      section.questions.map((question) => [question.key, answers[question.key] ?? null]),
    ));

    const map = Object.fromEntries(issues.map((issue) => [issue.key, issue.message]));
    setErrors(map);
    return issues.length === 0;
  }

  async function next() {
    if (!checkSection()) return;
    setBusy(true);
    try {
      await onSaveSection(answers);
      setSaveNote("Saved");
    } catch {
      // The local copy is already written, so the client can carry on and the
      // answers survive. Saying it saved when it did not would be the lie.
      setSaveNote("Not saved yet, we will try again");
    }
    setBusy(false);
    setIndex((current) => Math.min(current + 1, sections.length - 1));
    window.scrollTo({ top: 0 });
  }

  async function submit() {
    if (!checkSection()) return;

    const issues = validate(shown, answers);
    if (issues.length > 0) {
      setErrors(Object.fromEntries(issues.map((issue) => [issue.key, issue.message])));
      // Send them to the first section that still has something outstanding
      // rather than leaving them on the last page wondering.
      const firstBad = sections.findIndex((candidate) =>
        candidate.questions.some((question) => issues.some((issue) => issue.key === question.key)),
      );
      if (firstBad >= 0) setIndex(firstBad);
      return;
    }

    setBusy(true);
    await onSubmit(answers);
    setBusy(false);
  }

  const last = index >= sections.length - 1;

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 py-5" data-testid="intake-form">
      <header>
        <p className="elvt-label">ELVT intake</p>
        <div className="mt-2 flex items-baseline justify-between">
          <h1 className="text-h2">{section.title}</h1>
          <span className="elvt-num text-txt-secondary" data-testid="progress-count">
            {bar.answered} of {bar.total}
          </span>
        </div>

        {/* The bar counts every question the client can see, optional ones
            included. A bar that reads 90 and then asks four more things is
            worse than no bar. */}
        <div
          className="mt-2 h-1 w-full bg-raised"
          role="progressbar"
          aria-valuenow={bar.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="How far through the form you are"
          data-testid="progress-bar"
        >
          <div className="h-1 bg-txt-mute" style={{ width: `${bar.percent}%` }} />
        </div>

        <p className="mt-3 text-txt-secondary">{section.intent}</p>
      </header>

      <nav aria-label="Sections" className="mt-4 flex flex-wrap gap-1">
        {sections.map((candidate, i) => (
          <button
            key={candidate.key}
            type="button"
            data-testid="section-chip"
            aria-current={i === index ? "step" : undefined}
            onClick={() => setIndex(i)}
            className={[
              "elvt-chip",
              i === index ? "bg-raised text-txt" : perSection[i].complete ? "text-ok" : "text-txt-tertiary",
            ].join(" ")}
          >
            <span className="elvt-num">{i + 1}</span>
          </button>
        ))}
      </nav>

      <div className="mt-2">
        {section.questions.map((question) => (
          <QuestionField
            key={question.key}
            question={question}
            value={answers[question.key]}
            error={errors[question.key]}
            onChange={(value) => set(question.key, value)}
          />
        ))}
      </div>

      {saveNote ? (
        <p className="mt-4 text-txt-secondary" data-testid="save-note">
          {saveNote}
        </p>
      ) : null}

      <div className="mt-5 flex gap-2">
        {index > 0 ? (
          <button
            type="button"
            className="elvt-button-secondary flex-1"
            onClick={() => {
              setIndex((current) => current - 1);
              window.scrollTo({ top: 0 });
            }}
          >
            Back
          </button>
        ) : null}

        <button
          type="button"
          className="elvt-button flex-1"
          disabled={busy}
          data-testid={last ? "intake-submit" : "intake-next"}
          onClick={() => void (last ? submit() : next())}
        >
          {busy ? "Saving" : last ? "Send it to your coach" : "Next"}
        </button>
      </div>

      <p className="mt-4 text-txt-secondary">
        You can close this and come back. Your answers are kept as you go.
      </p>
    </div>
  );
}
