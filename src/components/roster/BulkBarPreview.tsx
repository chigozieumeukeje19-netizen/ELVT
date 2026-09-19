"use client";

import { BulkBar } from "@/components/roster/FilterBar";

/**
 * The bulk bar for the visual pass.
 *
 * A client component because the bar takes a server action, and a function
 * cannot cross the server boundary into one. The preview route is a server
 * component, so the no-op has to be created here.
 */
export function BulkBarPreview({
  selected,
  actions,
  affects,
}: {
  selected: number;
  actions: Parameters<typeof BulkBar>[0]["actions"];
  affects: Record<string, number>;
}) {
  return <BulkBar selected={selected} actions={actions} affects={affects} action={() => {}} />;
}
