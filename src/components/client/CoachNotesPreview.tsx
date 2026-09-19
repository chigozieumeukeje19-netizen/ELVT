"use client";

import { CoachNotes } from "./Overview";

/**
 * The coach notes panel for a preview screen.
 *
 * A server component cannot hand a function to a client component, and the
 * preview has no server action to hand it, so the no-op lives here behind its
 * own "use client" boundary.
 */
export function CoachNotesPreview({ notes }: { notes: string | null }) {
  return <CoachNotes notes={notes} action={() => undefined} />;
}
