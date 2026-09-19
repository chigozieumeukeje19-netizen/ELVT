"use client";

import { useState } from "react";

/**
 * Every AI job in the portal, as one component.
 *
 * The real API call sits behind AI_PROVIDER and is off by default, so this is
 * the product rather than a fallback: copy the prompt, take it wherever you
 * already pay for a model, paste the answer back. The coach approves what comes
 * back either way, which is the same approve step the API path would have.
 *
 * The prompt is shown, not hidden behind the button. A coach who cannot read
 * what is being asked on their client's behalf has no way to judge the answer.
 */
export function PromptAndPaste({
  title,
  prompt,
  action,
  slug,
  pasteName,
  warnings,
  error,
  submitLabel,
}: {
  title: string;
  prompt: string;
  action: (formData: FormData) => void;
  slug: string;
  pasteName: string;
  warnings?: { rule: string; detail: string }[];
  error?: string;
  submitLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <section data-testid="prompt-and-paste">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="elvt-label">{title}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            className="elvt-button-secondary"
            onClick={() => setOpen((current) => !current)}
          >
            {open ? "Hide the prompt" : "Read the prompt"}
          </button>
          <button
            type="button"
            className="elvt-button"
            data-testid="copy-prompt"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(prompt);
                setCopied(true);
              } catch {
                // Clipboard refused, usually an insecure origin. The prompt is
                // on screen either way, so say so rather than pretending.
                setOpen(true);
                setCopied(false);
              }
            }}
          >
            {copied ? "Copied" : "Copy the prompt"}
          </button>
        </div>
      </div>

      {open ? (
        <pre
          className="mt-3 max-h-[320px] overflow-auto bg-raised p-3 text-txt-secondary"
          data-testid="prompt-text"
        >
          {prompt}
        </pre>
      ) : null}

      <form action={action} className="mt-4">
        <input type="hidden" name="slug" value={slug} />

        <label className="block">
          <span className="elvt-label">Paste what came back</span>
          <textarea
            className="elvt-input mt-1 min-h-[160px] font-mono"
            name={pasteName}
            data-testid="paste-box"
            placeholder={`{\n  "summary": "..."\n}`}
          />
        </label>

        {error ? (
          <p role="alert" className="mt-3 text-flag" data-testid="paste-error">
            {error}
          </p>
        ) : null}

        {warnings && warnings.length > 0 ? (
          <div className="mt-3" data-testid="voice-warnings">
            <p className="elvt-label text-watch">
              {warnings.length === 1 ? "One voice rule" : `${warnings.length} voice rules`} to look at
            </p>
            <ul className="mt-1">
              {warnings.map((warning, index) => (
                <li key={index} className="text-txt-secondary">
                  {warning.detail}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <button className="elvt-button mt-4" type="submit">
          {submitLabel}
        </button>
      </form>
    </section>
  );
}
