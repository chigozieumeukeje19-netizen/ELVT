"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { DayGrid } from "@/components/program/DayGrid";
import type { WeekView } from "@/lib/program/view";

/**
 * Wires the day grid's drag and drop to the move action. Kept apart from the
 * grid so the grid stays a presentational component the preview routes can
 * render without a server action behind it.
 */
export function DayGridClient({
  week,
  peakDayStress,
  slug,
  move,
}: {
  week: WeekView;
  peakDayStress: number;
  slug: string;
  move: (input: {
    slug: string;
    sessionId: string;
    toDate: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <DayGrid
      week={week}
      peakDayStress={peakDayStress}
      onMove={({ sessionKey, toDate }) => {
        startTransition(async () => {
          // The session key is its row id once the program comes from the
          // database, which is what the action needs.
          const result = await move({ slug, sessionId: sessionKey, toDate });
          if (!result.ok) {
            router.push(
              `/coach/clients/${slug}/program?error=${encodeURIComponent(
                result.error ?? "That move did not save.",
              )}`,
            );
            return;
          }
          router.refresh();
        });
      }}
    />
  );
}
