/**
 * Reading back what the coach pasted.
 *
 * The paste is untrusted input. It came from a model, through a clipboard, and
 * nothing about it is guaranteed: not that it is JSON, not that it has the keys
 * asked for, not that it followed the voice rules, and certainly not that it
 * left the derived half of the blueprint alone.
 *
 * So it is parsed strictly, checked against the voice rules, and only the
 * drafted half is ever taken from it. A paste cannot change a client's injury
 * flags no matter what it contains.
 */

import { z } from "zod";
import { checkVoice, type VoiceIssue } from "./voice";
import { EMPTY_DRAFT, type DraftedBlueprint } from "@/lib/blueprint/types";

export type PasteResult<T> =
  | { ok: true; value: T; warnings: VoiceIssue[] }
  | { ok: false; error: string; warnings: VoiceIssue[] };

/** Models wrap JSON in a fence more often than not. */
export function unfence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/);
  return (fenced ? fenced[1] : trimmed).trim();
}

const draftedSchema = z.object({
  summary: z.string().min(1),
  oneThing: z.string().min(1),
  failureMode: z.string().min(1),
  toneNotes: z.string().default(""),
  // Present in the prompt's shape so a model does not invent its own key, but
  // the portal proposes triggers from the client's numbers, so whatever comes
  // back here is discarded.
  triggers: z.array(z.unknown()).optional(),
});

export function readBlueprintPaste(raw: string): PasteResult<DraftedBlueprint> {
  if (!raw.trim()) {
    return { ok: false, error: "Nothing was pasted.", warnings: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(unfence(raw));
  } catch {
    return {
      ok: false,
      error: "That is not JSON. Paste the whole answer including the braces.",
      warnings: [],
    };
  }

  const result = draftedSchema.safeParse(parsed);
  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    return { ok: false, error: `The answer is missing: ${missing}`, warnings: [] };
  }

  const value: DraftedBlueprint = {
    ...EMPTY_DRAFT,
    summary: result.data.summary.trim(),
    oneThing: result.data.oneThing.trim(),
    failureMode: result.data.failureMode.trim(),
    toneNotes: result.data.toneNotes.trim(),
    // Deliberately not taken from the paste.
    triggers: [],
  };

  // Warnings, not errors. The coach approves every word of this anyway, and
  // refusing a good draft over one dash would just teach them to work around
  // the check.
  const warnings = [
    ...checkVoice(value.summary),
    ...checkVoice(value.oneThing),
    ...checkVoice(value.failureMode),
    ...checkVoice(value.toneNotes),
  ];

  return { ok: true, value, warnings };
}

const rationaleSchema = z.object({
  weeks: z
    .array(z.object({ week: z.number().int().positive(), rationale: z.string().min(1) }))
    .min(1),
});

export function readProgramPaste(
  raw: string,
  weekCount: number,
): PasteResult<{ week: number; rationale: string }[]> {
  if (!raw.trim()) return { ok: false, error: "Nothing was pasted.", warnings: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(unfence(raw));
  } catch {
    return { ok: false, error: "That is not JSON. Paste the whole answer.", warnings: [] };
  }

  const result = rationaleSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: "The answer has no weeks array.", warnings: [] };
  }

  const weeks = result.data.weeks.filter((entry) => entry.week >= 1 && entry.week <= weekCount);
  if (weeks.length !== weekCount) {
    return {
      ok: false,
      error: `That covers ${weeks.length} of ${weekCount} weeks. Every week needs a line.`,
      warnings: [],
    };
  }

  const warnings = weeks.flatMap((entry) =>
    checkVoice(entry.rationale).map((issue) => ({
      ...issue,
      detail: `Week ${entry.week}: ${issue.detail}`,
    })),
  );

  return { ok: true, value: weeks, warnings };
}
