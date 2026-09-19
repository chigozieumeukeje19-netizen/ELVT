/**
 * Darren's voice rules, as a check rather than as a paragraph in a prompt.
 *
 * Every AI job in this portal is a copyable prompt and a paste box. The prompt
 * states the rules; this checks whether what came back followed them. A rule
 * that only lives in a prompt is a rule that holds most of the time, and "most
 * of the time" is how a client gets a message with an em dash in it from a
 * coach who has never used one.
 *
 * These run on the paste before it is saved, and the coach sees what failed.
 * Nothing is rewritten silently: the coach either edits it or accepts it, which
 * is the same approve step every other AI output goes through.
 */

import {
  BRITISH_SPELLINGS,
  COACHING_FILLER,
  MARKETING_CLICHES,
} from "@/lib/design/banned-copy";

export type VoiceIssue = { rule: string; detail: string };

export const MAX_MESSAGE_LINES = 5;
export const MIN_MESSAGE_LINES = 2;

// The same list the design audit scans the codebase with, so a phrase banned in
// code cannot still arrive from a model.
const FILLER = [...COACHING_FILLER, ...MARKETING_CLICHES];
const BRITISH = BRITISH_SPELLINGS;

export function checkVoice(
  text: string,
  options: { isMessage?: boolean } = {},
): VoiceIssue[] {
  const issues: VoiceIssue[] = [];
  const lower = text.toLowerCase();

  // A dash used as punctuation. Hyphenated words are fine, which is why this
  // looks for a dash with space around it or an em or en dash anywhere.
  if (/\s[-]\s/.test(text) || /[–—]/.test(text)) {
    issues.push({
      rule: "no dashes",
      detail: "There is a dash used as punctuation. Rewrite the sentence without it.",
    });
  }

  for (const phrase of FILLER) {
    if (lower.includes(phrase)) {
      issues.push({ rule: "no motivational filler", detail: `"${phrase}" is filler.` });
    }
  }

  for (const [british, american] of Object.entries(BRITISH)) {
    if (new RegExp(`\\b${british}`, "i").test(text)) {
      issues.push({ rule: "US English", detail: `"${british}" should be "${american}".` });
    }
  }

  if (options.isMessage) {
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

    if (lines.length > MAX_MESSAGE_LINES) {
      issues.push({
        rule: "two to five lines",
        detail: `This is ${lines.length} lines. A message to a client is ${MIN_MESSAGE_LINES} to ${MAX_MESSAGE_LINES}.`,
      });
    }
    if (lines.length < MIN_MESSAGE_LINES) {
      issues.push({
        rule: "two to five lines",
        detail: `This is ${lines.length === 1 ? "one line" : "empty"}. A message to a client is at least ${MIN_MESSAGE_LINES} lines.`,
      });
    }

    if (!/\?/.test(text)) {
      issues.push({
        rule: "one real question",
        detail: "There is no question in this. Every message asks one.",
      });
    }

    if (!/\d/.test(text)) {
      issues.push({
        rule: "real numbers",
        detail: "There is no number in this. A message with no number is a message with no content.",
      });
    }
  }

  return issues;
}
