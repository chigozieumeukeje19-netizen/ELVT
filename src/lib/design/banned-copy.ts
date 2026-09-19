/**
 * Phrases that never appear in front of a person, wherever they come from.
 *
 * One list, read by two things that used to keep their own copies:
 *
 *   scripts/design-audit.ts   scans the codebase for them in UI copy
 *   src/lib/ai/voice.ts       checks a pasted AI draft for them
 *
 * Keeping the list twice meant the audit flagged the voice checker's copy as
 * copy, which is the right finding on a duplicate and the wrong finding on a
 * ban list. It also meant the two could drift, so a phrase banned in code would
 * still get through from a model.
 *
 * This file is the list itself, so it is the one place the audit skips.
 */

/** Marketing clichés. DESIGN.md tell 11. */
export const MARKETING_CLICHES = [
  "transform your",
  "supercharge",
  "unleash",
  "effortlessly",
  "seamlessly",
  "reimagined",
  "elevate your",
  "unlock the power",
] as const;

/** Motivational filler a coach would never text. Part 10 of the portal spec. */
export const COACHING_FILLER = [
  "you've got this",
  "you got this",
  "crush it",
  "let's go",
  "amazing work",
  "incredible",
  "journey",
  "level up",
  "no excuses",
  "trust the process",
] as const;

/** Placeholder empty states. DESIGN.md tell 11. */
export const EMPTY_STATE_FILLER = [
  "nothing here yet",
  "no items yet",
  "nothing to see here",
  "coming soon",
  "lorem ipsum",
] as const;

/** Not US English. The portal is US English only. */
export const BRITISH_SPELLINGS: Readonly<Record<string, string>> = {
  programme: "program",
  litre: "liter",
  metre: "meter",
  colour: "color",
  favourite: "favorite",
  practise: "practice",
  behaviour: "behavior",
  kilogramme: "kilogram",
};

/** The list as one case insensitive alternation, for the audit's scanner. */
export function asPattern(phrases: readonly string[]): RegExp {
  const escaped = phrases.map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(?:${escaped.join("|")})`, "i");
}
