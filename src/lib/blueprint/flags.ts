import type { FlagKey } from "@/lib/program/types";
import type { DerivedBlueprint } from "./types";

/**
 * The flag a movement slot ran into, in words.
 *
 * The applier records the slot's pattern rather than the flag, because a slot
 * can be ruled out by more than one. This names whichever of the client's own
 * flags are plausible for that pattern, so the explanation says "the spine
 * flag" rather than "a contraindication".
 */
const PATTERN_FLAGS: Record<string, FlagKey[]> = {
  squat: ["knee", "spine", "hip", "ankle"],
  hinge: ["spine", "hip"],
  lunge: ["knee", "hip", "ankle"],
  push_h: ["shoulder", "elbow", "wrist"],
  push_v: ["shoulder", "elbow", "neck"],
  pull_h: ["shoulder", "elbow", "spine"],
  pull_v: ["shoulder", "elbow"],
  carry: ["spine", "shoulder", "wrist"],
  core: ["spine", "neck", "rib"],
  rotation: ["spine", "rib"],
};

export function humanizeFlag(slot: string, derived: DerivedBlueprint): string {
  const plausible = (PATTERN_FLAGS[slot] ?? []).filter((flag) => derived.flags.includes(flag));
  if (plausible.length === 0) return "injury";
  if (plausible.length === 1) return plausible[0];
  return `${plausible.slice(0, -1).join(", ")} and ${plausible[plausible.length - 1]}`;
}
