import type { GoalType } from "@/lib/blueprint/types";
import type { FlagKey } from "@/lib/program/types";
import type { ClientProfile } from "./generate";

/**
 * A client row in the shape the form generators read.
 *
 * Its own module rather than living beside the actions, because a "use server"
 * file may only export async functions: a plain helper exported from one is a
 * build error, and a helper is exactly what this is.
 */
export function profileFrom(client: {
  primary_goal: string | null;
  flag_config: unknown;
  feature_flags: unknown;
}): ClientProfile {
  const flags = Object.entries((client.flag_config ?? {}) as Record<string, unknown>)
    .filter(([, on]) => on === true)
    .map(([key]) => key as FlagKey);

  const features = (client.feature_flags ?? {}) as Record<string, unknown>;

  return {
    goal: (client.primary_goal as GoalType) ?? "recomp",
    flags,
    running: features.running !== false,
  };
}
