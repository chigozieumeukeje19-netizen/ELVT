"use client";

import { PHOTO_ANGLES, SCALE_DEFAULTS, STAR_DEFAULTS, type Question } from "@/lib/questionnaire/types";
import type { AnswerValue } from "@/lib/questionnaire/answers";

/**
 * One question, in whichever of the eleven shapes it takes.
 *
 * Built for a phone held one handed. Every tap target is a full width row at
 * least 44px tall, choices are rows rather than a dropdown, and the scale is
 * ten buttons rather than a slider, because a slider on a phone is how you get
 * a 6 when the client meant a 7.
 *
 * Nothing here is decorative. There is no icon, no illustration and no
 * encouragement between sections.
 */
export function QuestionField({
  question,
  value,
  error,
  onChange,
}: {
  question: Question;
  value: AnswerValue | undefined;
  error?: string;
  onChange: (value: AnswerValue) => void;
}) {
  const described = error ? `${question.key}-error` : question.help ? `${question.key}-help` : undefined;

  return (
    <fieldset className="border-line py-4 [border-bottom-width:1px]" data-testid="question">
      <legend className="sr-only">{question.text}</legend>

      <p className="text-h3" id={`${question.key}-label`}>
        {question.text}
        {question.required ? <span className="elvt-label ml-2 text-txt-tertiary">Needed</span> : null}
      </p>

      {question.help ? (
        <p className="mt-1 text-txt-secondary" id={`${question.key}-help`}>
          {question.help}
        </p>
      ) : null}

      <div className="mt-3">
        <Control question={question} value={value} described={described} onChange={onChange} />
      </div>

      {error ? (
        <p role="alert" id={`${question.key}-error`} className="mt-2 text-flag" data-testid="question-error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function Control({
  question,
  value,
  described,
  onChange,
}: {
  question: Question;
  value: AnswerValue | undefined;
  described?: string;
  onChange: (value: AnswerValue) => void;
}) {
  const labelledBy = `${question.key}-label`;

  switch (question.type) {
    case "text":
      return (
        <textarea
          className="elvt-input min-h-[88px]"
          aria-labelledby={labelledBy}
          aria-describedby={described}
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case "number":
    case "metric":
      return (
        <div className="flex items-center gap-3">
          <input
            className="elvt-input elvt-num"
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            aria-labelledby={labelledBy}
            aria-describedby={described}
            value={typeof value === "number" ? value : typeof value === "string" ? value : ""}
            onChange={(event) =>
              onChange(event.target.value === "" ? null : Number(event.target.value))
            }
          />
          {question.unit ? <span className="elvt-label shrink-0">{question.unit}</span> : null}
        </div>
      );

    case "date":
      return (
        <input
          className="elvt-input elvt-num"
          type="date"
          aria-labelledby={labelledBy}
          aria-describedby={described}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
        />
      );

    case "yes_no":
      return (
        <div className="flex gap-2" role="group" aria-labelledby={labelledBy}>
          {[
            { label: "Yes", answer: true },
            { label: "No", answer: false },
          ].map((choice) => (
            <button
              key={choice.label}
              type="button"
              aria-pressed={value === choice.answer}
              onClick={() => onChange(choice.answer)}
              className={[
                "h-row flex-1 border-line text-body [border-width:1px]",
                value === choice.answer ? "bg-raised text-txt" : "text-txt-secondary",
              ].join(" ")}
            >
              {choice.label}
            </button>
          ))}
        </div>
      );

    case "multiple_choice": {
      const chosen = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
      return (
        <div role="group" aria-labelledby={labelledBy}>
          {(question.options ?? []).map((option) => {
            const on = chosen.includes(option);
            return (
              <button
                key={option}
                type="button"
                data-testid="choice"
                aria-pressed={on}
                onClick={() => {
                  if (!question.allowMultiple) {
                    onChange(option);
                    return;
                  }
                  onChange(on ? chosen.filter((c) => c !== option) : [...chosen, option]);
                }}
                className={[
                  "flex h-row w-full items-center justify-between border-line px-3 text-left [border-bottom-width:1px]",
                  on ? "bg-raised text-txt" : "text-txt-secondary",
                ].join(" ")}
              >
                <span className="min-w-0 truncate">{option}</span>
                {on ? <span className="elvt-label shrink-0">Picked</span> : null}
              </button>
            );
          })}
        </div>
      );
    }

    case "scale":
    case "star_rating": {
      const defaults = question.type === "scale" ? SCALE_DEFAULTS : STAR_DEFAULTS;
      const min = question.min ?? defaults.min;
      const max = question.max ?? defaults.max;
      const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);

      return (
        <div>
          {/* Buttons rather than a slider. A slider on a phone is how a client
              means 7 and sends 6. */}
          <div className="flex gap-1" role="group" aria-labelledby={labelledBy}>
            {steps.map((step) => (
              <button
                key={step}
                type="button"
                data-testid="scale-step"
                aria-pressed={value === step}
                onClick={() => onChange(step)}
                className={[
                  "elvt-num h-row flex-1 border-line [border-width:1px]",
                  value === step ? "bg-raised text-txt" : "text-txt-secondary",
                ].join(" ")}
              >
                {step}
              </button>
            ))}
          </div>
          {question.minLabel || question.maxLabel ? (
            <div className="mt-1 flex justify-between">
              <span className="elvt-label">{question.minLabel}</span>
              <span className="elvt-label">{question.maxLabel}</span>
            </div>
          ) : null}
        </div>
      );
    }

    case "progress_photos": {
      const angles = question.angles ?? [...PHOTO_ANGLES];
      const done = Array.isArray(value) ? value : [];
      return (
        <div role="group" aria-labelledby={labelledBy}>
          {angles.map((angle) => {
            const on = done.includes(angle);
            return (
              <label
                key={angle}
                data-testid="photo-angle"
                className="flex h-row items-center justify-between border-line px-3 [border-bottom-width:1px]"
              >
                <span className="capitalize">{angle}</span>
                <span className="flex items-center gap-3">
                  {on ? <span className="elvt-label text-ok">Added</span> : null}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="w-[132px] text-txt-secondary"
                    onChange={(event) => {
                      const has = (event.target.files?.length ?? 0) > 0;
                      onChange(
                        has ? [...new Set([...done, angle])] : done.filter((a) => a !== angle),
                      );
                    }}
                  />
                </span>
              </label>
            );
          })}
        </div>
      );
    }

    case "media":
      return (
        <input
          type="file"
          accept="video/*,image/*"
          aria-labelledby={labelledBy}
          aria-describedby={described}
          className="w-full text-txt-secondary"
          onChange={(event) =>
            onChange(event.target.files?.[0]?.name ?? null)
          }
        />
      );

    case "signature":
      return (
        // The whole row is the target. A native checkbox is 13px, which is not
        // something to ask for from someone holding a phone one handed.
        <label className="flex h-row cursor-pointer items-center gap-3 border-line px-3 [border-width:1px]">
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0"
            checked={value === "signed"}
            aria-describedby={described}
            onChange={(event) => onChange(event.target.checked ? "signed" : null)}
          />
          <span className="min-w-0 text-txt-secondary">
            I confirm this is accurate
          </span>
        </label>
      );
  }
}
